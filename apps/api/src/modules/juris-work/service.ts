import { recordAudit } from "@verasjuris/audit";
import { policyAi, type SessionAccount } from "@verasjuris/auth";
import {
  jurisWorkSteps,
  jurisWorkTasks,
  type AppDatabase,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, asc, desc, eq } from "drizzle-orm";
import { authorize, iso } from "../ai/shared.js";
import type { RequestMeta } from "../auth/service.js";

/** Ferramentas internas permitidas sem ação externa irreversível. */
const SAFE_INTERNAL_TOOLS = [
  "organize_dossier",
  "extract_data",
  "generate_report",
  "compare_versions",
  "prepare_draft",
  "create_checklist",
  "build_timeline",
  "identify_missing_documents",
] as const;

const EXTERNAL_ACTION_TOOLS = [
  "send_external_message",
  "protocol_petition",
  "sign_contract",
  "execute_payment",
  "delete_records",
] as const;

export type JurisWorkToolName =
  | (typeof SAFE_INTERNAL_TOOLS)[number]
  | (typeof EXTERNAL_ACTION_TOOLS)[number];

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

function buildPlan(objective: string): Array<{
  toolName: JurisWorkToolName;
  title: string;
  requiresApproval: boolean;
}> {
  const lower = objective.toLowerCase();
  const steps: Array<{
    toolName: JurisWorkToolName;
    title: string;
    requiresApproval: boolean;
  }> = [
    {
      toolName: "identify_missing_documents",
      title: "Identificar documentos ausentes",
      requiresApproval: false,
    },
    {
      toolName: "organize_dossier",
      title: "Organizar dossiê interno",
      requiresApproval: false,
    },
    {
      toolName: "extract_data",
      title: "Extrair dados estruturados",
      requiresApproval: false,
    },
    {
      toolName: "generate_report",
      title: "Gerar relatório interno",
      requiresApproval: false,
    },
  ];

  if (/\b(minuta|petição|peticao|contrato)\b/i.test(lower)) {
    steps.push({
      toolName: "prepare_draft",
      title: "Preparar minuta assistida (revisão humana obrigatória)",
      requiresApproval: true,
    });
  }
  if (/\b(enviar|protocolar|assinar|pagar|excluir)\b/i.test(lower)) {
    steps.push({
      toolName: "send_external_message",
      title: "Ação externa bloqueada até aprovação explícita",
      requiresApproval: true,
    });
  }

  return steps.slice(0, 12);
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
) {
  const membership = requireJurisWorkAccess(account, organizationId);
  const plan = buildPlan(input.objective);
  const now = new Date();

  const [task] = await db
    .insert(jurisWorkTasks)
    .values({
      organizationId,
      createdByUserId: account.user.id,
      createdByMembershipId: membership.membershipId,
      title: input.title.trim().slice(0, 180),
      objective: input.objective.trim().slice(0, 4000),
      status: "awaiting_approval",
      planJson: {
        version: 1,
        tools: plan.map((s) => s.toolName),
        note: "Plano gerado localmente. Execução de ferramentas externas exige aprovação humana.",
      },
      budgetMicros: input.budgetMicros ?? 500_000,
      maxSteps: input.maxSteps ?? plan.length,
      requiresHumanApproval: true,
    })
    .returning();

  await db.insert(jurisWorkSteps).values(
    plan.map((step, index) => ({
      taskId: task!.id,
      organizationId,
      stepIndex: index,
      toolName: step.toolName,
      title: step.title,
      status: step.requiresApproval ? ("awaiting_approval" as const) : ("pending" as const),
      requiresApproval: step.requiresApproval,
      inputJson: { objective: input.objective.trim().slice(0, 1000) },
    })),
  );

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "juris_work.task_created",
    resourceType: "juris_work_task",
    resourceId: task!.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { status: task!.status, steps: plan.length },
  });

  return { task: serializeTask(task!), createdAt: iso(now) };
}

export async function listJurisWorkTasks(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  requireJurisWorkAccess(account, organizationId);
  const rows = await db.query.jurisWorkTasks.findMany({
    where: eq(jurisWorkTasks.organizationId, organizationId),
    orderBy: [desc(jurisWorkTasks.createdAt)],
    limit: 50,
  });
  return { items: rows.map(serializeTask) };
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
  return { task: serializeTask(task), steps: steps.map(serializeStep) };
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

  return { task: serializeTask(updated!) };
}

/**
 * Executa apenas passos internos seguros. Ferramentas externas permanecem bloqueadas
 * mesmo após aprovação da tarefa, exigindo aprovação explícita por passo.
 */
export async function runNextJurisWorkStep(
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
  if (task.status !== "running") {
    throw new AppError("CONFLICT", "Aprove a tarefa antes de executar passos.");
  }
  if (task.budgetMicros != null && task.spentMicros >= task.budgetMicros) {
    await db
      .update(jurisWorkTasks)
      .set({ status: "budget_exceeded", updatedAt: new Date() })
      .where(eq(jurisWorkTasks.id, taskId));
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
    return { task: serializeTask(completed!), step: null, done: true as const };
  }

  if (
    EXTERNAL_ACTION_TOOLS.includes(next.toolName as (typeof EXTERNAL_ACTION_TOOLS)[number]) ||
    (next.requiresApproval && !next.approvedAt)
  ) {
    throw new AppError(
      "AUTHORIZATION_ERROR",
      `O passo "${next.title}" exige aprovação humana explícita e não executa ações externas automaticamente.`,
    );
  }

  const now = new Date();
  const stepCost = 25_000;
  const [updatedStep] = await db
    .update(jurisWorkSteps)
    .set({
      status: "completed",
      startedAt: now,
      completedAt: now,
      outputJson: {
        status: "simulated_internal",
        detail:
          "Resultado interno gerado pelo scaffold JurisOne Work. Não constitui ato jurídico nem consulta oficial.",
        toolName: next.toolName,
        humanReviewRequired: true,
      },
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
    after: { toolName: next.toolName, costMicros: stepCost },
  });

  return { task: serializeTask({ ...task, spentMicros: task.spentMicros + stepCost }), step: serializeStep(updatedStep!), done: false as const };
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
  if (EXTERNAL_ACTION_TOOLS.includes(step.toolName as (typeof EXTERNAL_ACTION_TOOLS)[number])) {
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
  const now = new Date();
  const [updated] = await db
    .update(jurisWorkTasks)
    .set({ status: "cancelled", cancelledAt: now, updatedAt: now })
    .where(and(eq(jurisWorkTasks.id, taskId), eq(jurisWorkTasks.organizationId, organizationId)))
    .returning();
  if (!updated) throw new AppError("NOT_FOUND", "Tarefa do JurisOne Work não encontrada.");

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

  return { task: serializeTask(updated) };
}
