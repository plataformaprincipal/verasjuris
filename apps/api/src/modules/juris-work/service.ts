import { recordAudit } from "@verasjuris/audit";
import type { AIGateway } from "@verasjuris/ai";
import { policyAi, type SessionAccount } from "@verasjuris/auth";
import { jurisWorkSteps, jurisWorkTasks, type AppDatabase } from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, asc, desc, eq } from "drizzle-orm";
import { authorize, iso } from "../ai/shared.js";
import type { RequestMeta } from "../auth/service.js";
import {
  consumeReservedCredit,
  ensureInitialWorkCredits,
  getWorkCreditBalance,
  listWorkCreditLedger,
  releaseReservedCredit,
  reserveWorkCredit,
  reserveWorkCreditIdempotencyKey,
} from "./credits.js";
import {
  executeInternalWorkStep,
  isExternalTool,
  planWorkSteps,
  type JurisWorkToolName,
} from "./executor.js";

export type { JurisWorkToolName };

/** Status em que ainda não houve trabalho significativo — cancelamento reembolsa crédito. */
const PRE_RUN_STATUSES = new Set(["draft", "planned", "awaiting_approval"]);

export type JurisWorkRuntimeDeps = {
  gateway?: AIGateway | null;
};

function requireJurisWorkAccess(account: SessionAccount, organizationId: string) {
  return authorize(account, organizationId, (membership) => policyAi(membership, "ai.use"));
}

function serializeTask(row: typeof jurisWorkTasks.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    createdByUserId: row.createdByUserId,
    title: row.title,
    objective: row.objective,
    status: row.status,
    plan: row.planJson,
    result: row.resultJson,
    budgetMicros: row.budgetMicros,
    spentMicros: row.spentMicros,
    maxSteps: row.maxSteps,
    requiresHumanApproval: row.requiresHumanApproval,
    approvedAt: iso(row.approvedAt),
    approvedByUserId: row.approvedByUserId,
    cancelledAt: iso(row.cancelledAt),
    completedAt: iso(row.completedAt),
    lastError: row.lastError,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function serializeStep(row: typeof jurisWorkSteps.$inferSelect) {
  return {
    id: row.id,
    taskId: row.taskId,
    stepIndex: row.stepIndex,
    toolName: row.toolName,
    title: row.title,
    status: row.status,
    requiresApproval: row.requiresApproval,
    input: row.inputJson,
    output: row.outputJson,
    approvedAt: iso(row.approvedAt),
    approvedByUserId: row.approvedByUserId,
    startedAt: iso(row.startedAt),
    completedAt: iso(row.completedAt),
    errorCode: row.errorCode,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

async function creditsPayload(
  db: AppDatabase,
  organizationId: string,
  userId: string,
): Promise<{ balance: number; lifetimeGranted: number }> {
  const credits = await getWorkCreditBalance(db, organizationId, userId);
  return { balance: credits.balance, lifetimeGranted: credits.lifetimeGranted };
}

export async function createJurisWorkTask(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    title: string;
    objective: string;
    budgetMicros?: number;
    maxSteps?: number;
  },
  meta: RequestMeta,
  runtime: JurisWorkRuntimeDeps = {},
) {
  const membership = requireJurisWorkAccess(account, organizationId);
  const planned = await planWorkSteps({
    gateway: runtime.gateway,
    account,
    organizationId,
    objective: input.objective,
  });
  const plan = planned.steps;
  const now = new Date();

  await ensureInitialWorkCredits(db, {
    organizationId,
    userId: account.user.id,
    actorUserId: account.user.id,
  });

  let task: typeof jurisWorkTasks.$inferSelect | null = null;
  try {
    task = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(jurisWorkTasks)
        .values({
          organizationId,
          createdByUserId: account.user.id,
          createdByMembershipId: membership.membershipId,
          title: input.title.trim().slice(0, 180),
          objective: input.objective.trim().slice(0, 4000),
          status: "awaiting_approval",
          planJson: {
            version: 2,
            source: planned.source,
            tools: plan.map((s) => s.toolName),
            note: planned.note,
          },
          budgetMicros: input.budgetMicros ?? 500_000,
          maxSteps: input.maxSteps ?? plan.length,
          requiresHumanApproval: true,
        })
        .returning();

      await tx.insert(jurisWorkSteps).values(
        plan.map((step, index) => ({
          taskId: inserted!.id,
          organizationId,
          stepIndex: index,
          toolName: step.toolName,
          title: step.title,
          status: step.requiresApproval ? ("awaiting_approval" as const) : ("pending" as const),
          requiresApproval: step.requiresApproval,
          inputJson: { objective: input.objective.trim().slice(0, 1000) },
        })),
      );

      return inserted!;
    });

    await reserveWorkCredit(db, {
      organizationId,
      userId: account.user.id,
      taskId: task.id,
      idempotencyKey: reserveWorkCreditIdempotencyKey(task.id),
      actorUserId: account.user.id,
    });
  } catch (error) {
    if (task) {
      // Reserva falhou após insert — não deixar órfã; marcar cancelled + tentar liberar.
      await db
        .update(jurisWorkTasks)
        .set({
          status: "cancelled",
          cancelledAt: new Date(),
          lastError: "Falha ao reservar crédito Work",
          updatedAt: new Date(),
        })
        .where(eq(jurisWorkTasks.id, task.id));
      try {
        await releaseReservedCredit(db, {
          organizationId,
          userId: account.user.id,
          taskId: task.id,
          actorUserId: account.user.id,
          reason: "Rollback após falha de reserva",
        });
      } catch {
        // best-effort
      }
    }
    throw error;
  }

  if (!task) {
    throw new AppError("INTERNAL_ERROR", "Falha ao criar tarefa do JurisOne Work.");
  }

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "juris_work.task_created",
    resourceType: "juris_work_task",
    resourceId: task.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { status: task.status, steps: plan.length },
  });

  const credits = await creditsPayload(db, organizationId, account.user.id);
  return { task: serializeTask(task), credits, createdAt: iso(now) };
}

export async function listJurisWorkTasks(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  requireJurisWorkAccess(account, organizationId);
  await ensureInitialWorkCredits(db, {
    organizationId,
    userId: account.user.id,
    actorUserId: account.user.id,
  });
  const rows = await db.query.jurisWorkTasks.findMany({
    where: eq(jurisWorkTasks.organizationId, organizationId),
    orderBy: [desc(jurisWorkTasks.createdAt)],
    limit: 50,
  });
  const credits = await creditsPayload(db, organizationId, account.user.id);
  return { items: rows.map(serializeTask), credits };
}

export async function getJurisWorkTask(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  taskId: string,
) {
  requireJurisWorkAccess(account, organizationId);
  const task = await db.query.jurisWorkTasks.findFirst({
    where: and(eq(jurisWorkTasks.id, taskId), eq(jurisWorkTasks.organizationId, organizationId)),
  });
  if (!task) throw new AppError("NOT_FOUND", "Tarefa do JurisOne Work não encontrada.");
  const steps = await db.query.jurisWorkSteps.findMany({
    where: eq(jurisWorkSteps.taskId, taskId),
    orderBy: [asc(jurisWorkSteps.stepIndex)],
  });
  const credits = await creditsPayload(db, organizationId, account.user.id);
  return { task: serializeTask(task), steps: steps.map(serializeStep), credits };
}

export async function getJurisWorkCredits(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  requireJurisWorkAccess(account, organizationId);
  await ensureInitialWorkCredits(db, {
    organizationId,
    userId: account.user.id,
    actorUserId: account.user.id,
  });
  const credits = await getWorkCreditBalance(db, organizationId, account.user.id);
  const ledger = await listWorkCreditLedger(db, organizationId, account.user.id, 50);
  return {
    credits: {
      balance: credits.balance,
      lifetimeGranted: credits.lifetimeGranted,
    },
    ledger: ledger.items,
  };
}

export async function ensureJurisWorkInitialCredits(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  requireJurisWorkAccess(account, organizationId);
  const result = await ensureInitialWorkCredits(db, {
    organizationId,
    userId: account.user.id,
    actorUserId: account.user.id,
  });
  return {
    granted: result.granted,
    credits: {
      balance: result.credits.balance,
      lifetimeGranted: result.credits.lifetimeGranted,
    },
  };
}

export async function approveJurisWorkTask(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  taskId: string,
  meta: RequestMeta,
) {
  requireJurisWorkAccess(account, organizationId);
  const task = await db.query.jurisWorkTasks.findFirst({
    where: and(eq(jurisWorkTasks.id, taskId), eq(jurisWorkTasks.organizationId, organizationId)),
  });
  if (!task) throw new AppError("NOT_FOUND", "Tarefa do JurisOne Work não encontrada.");
  if (task.status !== "awaiting_approval" && task.status !== "planned") {
    throw new AppError("CONFLICT", "Esta tarefa não está aguardando aprovação.");
  }

  const now = new Date();
  const [updated] = await db
    .update(jurisWorkTasks)
    .set({
      status: "running",
      approvedAt: now,
      approvedByUserId: account.user.id,
      updatedAt: now,
    })
    .where(eq(jurisWorkTasks.id, taskId))
    .returning();

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "juris_work.task_approved",
    resourceType: "juris_work_task",
    resourceId: taskId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });

  const credits = await creditsPayload(db, organizationId, account.user.id);
  return { task: serializeTask(updated!), credits };
}

/**
 * Executa apenas passos internos seguros. Ferramentas externas permanecem bloqueadas
 * mesmo após aprovação da tarefa, exigindo aprovação explícita por passo.
 *
 * Créditos: após início significativo (approve → running / steps), falha ou conclusão
 * consome a reserva — não reembolsa (custo de compute já incorrido).
 */
export async function runNextJurisWorkStep(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  taskId: string,
  meta: RequestMeta,
  runtime: JurisWorkRuntimeDeps = {},
) {
  requireJurisWorkAccess(account, organizationId);
  const task = await db.query.jurisWorkTasks.findFirst({
    where: and(eq(jurisWorkTasks.id, taskId), eq(jurisWorkTasks.organizationId, organizationId)),
  });
  if (!task) throw new AppError("NOT_FOUND", "Tarefa do JurisOne Work não encontrada.");
  if (task.status !== "running") {
    throw new AppError("CONFLICT", "Aprove a tarefa antes de executar passos.");
  }
  if (task.budgetMicros != null && task.spentMicros >= task.budgetMicros) {
    await db
      .update(jurisWorkTasks)
      .set({ status: "budget_exceeded", updatedAt: new Date() })
      .where(eq(jurisWorkTasks.id, taskId));
    await consumeReservedCredit(db, {
      organizationId,
      userId: task.createdByUserId,
      taskId,
      actorUserId: account.user.id,
    });
    throw new AppError("AI_BUDGET_EXCEEDED", "Orçamento da tarefa esgotado.");
  }

  const steps = await db.query.jurisWorkSteps.findMany({
    where: eq(jurisWorkSteps.taskId, taskId),
    orderBy: [asc(jurisWorkSteps.stepIndex)],
  });
  const next = steps.find((s) => s.status === "pending" || s.status === "awaiting_approval");
  if (!next) {
    const [completed] = await db
      .update(jurisWorkTasks)
      .set({
        status: "completed",
        completedAt: new Date(),
        resultJson: {
          summary: "Todos os passos internos elegíveis foram concluídos.",
          humanReviewRequired: true,
        },
        updatedAt: new Date(),
      })
      .where(eq(jurisWorkTasks.id, taskId))
      .returning();

    await consumeReservedCredit(db, {
      organizationId,
      userId: task.createdByUserId,
      taskId,
      actorUserId: account.user.id,
    });

    const credits = await creditsPayload(db, organizationId, account.user.id);
    return { task: serializeTask(completed!), step: null, done: true as const, credits };
  }

  if (isExternalTool(next.toolName) || (next.requiresApproval && !next.approvedAt)) {
    throw new AppError(
      "AUTHORIZATION_ERROR",
      `O passo "${next.title}" exige aprovação humana explícita e não executa ações externas automaticamente.`,
    );
  }

  const startedAt = new Date();
  await db
    .update(jurisWorkSteps)
    .set({ status: "running", startedAt, updatedAt: startedAt })
    .where(eq(jurisWorkSteps.id, next.id));

  let output: Awaited<ReturnType<typeof executeInternalWorkStep>>;
  try {
    output = await executeInternalWorkStep({
      db,
      gateway: runtime.gateway,
      account,
      organizationId,
      objective: task.objective,
      toolName: next.toolName,
      stepTitle: next.title,
    });
  } catch (error) {
    const failedAt = new Date();
    const code = error instanceof AppError ? error.code : "INTERNAL_ERROR";
    await db
      .update(jurisWorkSteps)
      .set({
        status: "failed",
        completedAt: failedAt,
        errorCode: code,
        outputJson: {
          status: "failed",
          errorCode: code,
          message: error instanceof AppError ? error.message : "Falha ao executar etapa Work.",
        },
        updatedAt: failedAt,
      })
      .where(eq(jurisWorkSteps.id, next.id));
    await db
      .update(jurisWorkTasks)
      .set({
        status: "failed",
        lastError: error instanceof AppError ? error.message : "Falha ao executar etapa Work.",
        updatedAt: failedAt,
      })
      .where(eq(jurisWorkTasks.id, taskId));
    throw error;
  }

  const now = new Date();
  const stepCost = Math.max(25_000, output.usage.estimatedCostMicros || 25_000);
  const [updatedStep] = await db
    .update(jurisWorkSteps)
    .set({
      status: "completed",
      startedAt,
      completedAt: now,
      outputJson: output,
      updatedAt: now,
    })
    .where(eq(jurisWorkSteps.id, next.id))
    .returning();

  await db
    .update(jurisWorkTasks)
    .set({
      spentMicros: task.spentMicros + stepCost,
      updatedAt: now,
    })
    .where(eq(jurisWorkTasks.id, taskId));

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "juris_work.step_completed",
    resourceType: "juris_work_step",
    resourceId: next.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: {
      toolName: next.toolName,
      costMicros: stepCost,
      provider: output.provider,
      model: output.model,
    },
  });

  const credits = await creditsPayload(db, organizationId, account.user.id);
  return {
    task: serializeTask({ ...task, spentMicros: task.spentMicros + stepCost }),
    step: serializeStep(updatedStep!),
    done: false as const,
    credits,
  };
}

export async function approveJurisWorkStep(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  taskId: string,
  stepId: string,
  meta: RequestMeta,
) {
  requireJurisWorkAccess(account, organizationId);
  const step = await db.query.jurisWorkSteps.findFirst({
    where: and(
      eq(jurisWorkSteps.id, stepId),
      eq(jurisWorkSteps.taskId, taskId),
      eq(jurisWorkSteps.organizationId, organizationId),
    ),
  });
  if (!step) throw new AppError("NOT_FOUND", "Passo não encontrado.");
  if (!step.requiresApproval) {
    throw new AppError("CONFLICT", "Este passo não exige aprovação.");
  }
  if (isExternalTool(step.toolName)) {
    throw new AppError(
      "NOT_CONFIGURED",
      "Ações externas (envio, protocolo, assinatura, pagamento, exclusão) permanecem bloqueadas até conectores homologados.",
    );
  }

  const now = new Date();
  const [updated] = await db
    .update(jurisWorkSteps)
    .set({
      status: "pending",
      approvedAt: now,
      approvedByUserId: account.user.id,
      requiresApproval: false,
      updatedAt: now,
    })
    .where(eq(jurisWorkSteps.id, stepId))
    .returning();

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "juris_work.step_approved",
    resourceType: "juris_work_step",
    resourceId: stepId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });

  return { step: serializeStep(updated!) };
}

export async function cancelJurisWorkTask(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  taskId: string,
  meta: RequestMeta,
) {
  requireJurisWorkAccess(account, organizationId);
  const existing = await db.query.jurisWorkTasks.findFirst({
    where: and(eq(jurisWorkTasks.id, taskId), eq(jurisWorkTasks.organizationId, organizationId)),
  });
  if (!existing) throw new AppError("NOT_FOUND", "Tarefa do JurisOne Work não encontrada.");

  const now = new Date();
  const [updated] = await db
    .update(jurisWorkTasks)
    .set({ status: "cancelled", cancelledAt: now, updatedAt: now })
    .where(and(eq(jurisWorkTasks.id, taskId), eq(jurisWorkTasks.organizationId, organizationId)))
    .returning();
  if (!updated) throw new AppError("NOT_FOUND", "Tarefa do JurisOne Work não encontrada.");

  // Cancelamento antes de running → libera crédito; após início → consome (sem reembolso).
  if (PRE_RUN_STATUSES.has(existing.status)) {
    await releaseReservedCredit(db, {
      organizationId,
      userId: existing.createdByUserId,
      taskId,
      actorUserId: account.user.id,
      reason: "Cancelamento antes da execução",
    });
  } else if (existing.status === "running" || existing.status === "budget_exceeded") {
    await consumeReservedCredit(db, {
      organizationId,
      userId: existing.createdByUserId,
      taskId,
      actorUserId: account.user.id,
    });
  }

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "juris_work.task_cancelled",
    resourceType: "juris_work_task",
    resourceId: taskId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });

  const credits = await creditsPayload(db, organizationId, account.user.id);
  return { task: serializeTask(updated), credits };
}
