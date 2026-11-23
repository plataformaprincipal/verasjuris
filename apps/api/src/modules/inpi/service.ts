import type { InpiRpiProvider } from "@verasjuris/ai";
import { recordAudit } from "@verasjuris/audit";
import type { SessionAccount } from "@verasjuris/auth";
import {
  inpiAttorneyMonitors,
  inpiDispatches,
  inpiMonitoredProcesses,
  inpiRpiRuns,
  legalMatters,
  type AppDatabase,
} from "@verasjuris/database";
import {
  NationalForensicHolidayCalendar,
  NotConfiguredNotificationProvider,
} from "@verasjuris/notifications";
import { AppError } from "@verasjuris/types";
import { getProcedure } from "@verasjuris/validation";
import { and, count, desc, eq, type SQL } from "drizzle-orm";
import { requireOrganizationPermission } from "../auth/routes.js";
import type { RequestMeta } from "../auth/service.js";
import { createDeadline } from "../deadlines/service.js";
import { createTask } from "../tasks/service.js";
import { processRpiEdition, type InpiRunResult } from "./capture.js";

/** INPI é processo administrativo: usa as permissões do módulo administrativo. */
const READ = "administrative_process.read" as const;
const MANAGE = "administrative_process.update" as const;

export type InpiDeps = {
  provider: InpiRpiProvider;
  remoteRun?: (input: { organizationId: string; edition?: number }) => Promise<InpiRunResult>;
};

type Dispatch = typeof inpiDispatches.$inferSelect;

function serializeDispatch(row: Dispatch) {
  const procedure = row.procedureKey ? getProcedure(row.procedureKey) : undefined;
  return {
    id: row.id,
    monitoredProcessId: row.monitoredProcessId,
    edition: row.edition,
    publishedOn: row.publishedOn,
    processNumber: row.processNumber,
    markName: row.markName,
    holders: row.holders,
    attorney: row.attorney,
    niceClasses: row.niceClasses,
    code: row.code,
    name: row.name,
    complement: row.complement,
    procedureKey: row.procedureKey,
    procedureName: procedure?.name ?? null,
    suggestedDays: row.suggestedDays,
    suggestedDueOn: row.suggestedDueOn,
    suggestionBasis: row.suggestionBasis,
    status: row.status,
    deadlineId: row.deadlineId,
    taskId: row.taskId,
    triagedAt: row.triagedAt?.toISOString() ?? null,
    dismissedReason: row.dismissedReason,
    consultUrl: `https://busca.inpi.gov.br/pePI/servlet/MarcasServletController?Action=searchMarca&tipoPesquisa=BY_NUM_PROC&NumPedido=${row.processNumber}`,
  };
}

// ------------------------------------------------------------- monitores

export async function listInpiMonitors(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  requireOrganizationPermission(account, organizationId, READ);
  const [processes, attorneys, lastRun] = await Promise.all([
    db.query.inpiMonitoredProcesses.findMany({
      where: eq(inpiMonitoredProcesses.organizationId, organizationId),
      orderBy: [desc(inpiMonitoredProcesses.updatedAt)],
    }),
    db.query.inpiAttorneyMonitors.findMany({
      where: eq(inpiAttorneyMonitors.organizationId, organizationId),
      orderBy: [desc(inpiAttorneyMonitors.createdAt)],
    }),
    db.query.inpiRpiRuns.findFirst({ orderBy: [desc(inpiRpiRuns.edition)] }),
  ]);
  return {
    processes: processes.map((p) => ({
      id: p.id,
      processNumber: p.processNumber,
      kind: p.kind,
      label: p.label,
      holderName: p.holderName,
      legalMatterId: p.legalMatterId,
      active: p.active,
      lastEdition: p.lastEdition,
      lastDispatchName: p.lastDispatchName,
      lastDispatchOn: p.lastDispatchOn,
      discovered: p.createdByMembershipId === null,
    })),
    attorneys: attorneys.map((a) => ({ id: a.id, attorneyName: a.attorneyName, active: a.active })),
    lastRun: lastRun
      ? {
          edition: lastRun.edition,
          publishedOn: lastRun.publishedOn,
          status: lastRun.status,
          processedAt: lastRun.processedAt.toISOString(),
        }
      : null,
  };
}

export async function addInpiProcess(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: { processNumber: string; label?: string; legalMatterId?: string },
  meta: RequestMeta,
) {
  const actor = requireOrganizationPermission(account, organizationId, MANAGE);
  const processNumber = input.processNumber.replace(/\D/g, "");
  if (processNumber.length !== 9) {
    throw new AppError("VALIDATION_ERROR", "O número de processo do INPI tem 9 dígitos.");
  }
  if (input.legalMatterId) {
    const matter = await db.query.legalMatters.findFirst({
      where: and(
        eq(legalMatters.id, input.legalMatterId),
        eq(legalMatters.organizationId, organizationId),
      ),
    });
    if (!matter) throw new AppError("NOT_FOUND", "Caso não encontrado.");
  }
  const [row] = await db
    .insert(inpiMonitoredProcesses)
    .values({
      organizationId,
      processNumber,
      label: input.label?.trim() || null,
      legalMatterId: input.legalMatterId ?? null,
      createdByMembershipId: actor.membershipId,
    })
    .onConflictDoNothing()
    .returning();
  if (!row) throw new AppError("CONFLICT", `O processo ${processNumber} já está monitorado.`);
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "inpi_process.monitored",
    resourceType: "inpi_monitored_process",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { processNumber },
  });
  return { process: { id: row.id, processNumber: row.processNumber, label: row.label } };
}

export async function setInpiProcessActive(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  id: string,
  active: boolean,
) {
  requireOrganizationPermission(account, organizationId, MANAGE);
  const [row] = await db
    .update(inpiMonitoredProcesses)
    .set({ active, updatedAt: new Date() })
    .where(
      and(
        eq(inpiMonitoredProcesses.id, id),
        eq(inpiMonitoredProcesses.organizationId, organizationId),
      ),
    )
    .returning();
  if (!row) throw new AppError("NOT_FOUND", "Processo monitorado não encontrado.");
  return { process: { id: row.id, active: row.active } };
}

export async function addInpiAttorney(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: { attorneyName: string },
  meta: RequestMeta,
) {
  const actor = requireOrganizationPermission(account, organizationId, MANAGE);
  const attorneyName = input.attorneyName.trim().replace(/\s+/g, " ");
  if (attorneyName.length < 5) {
    throw new AppError("VALIDATION_ERROR", "Informe o nome do procurador como aparece na RPI.");
  }
  const [row] = await db
    .insert(inpiAttorneyMonitors)
    .values({ organizationId, attorneyName, createdByMembershipId: actor.membershipId })
    .onConflictDoNothing()
    .returning();
  if (!row) throw new AppError("CONFLICT", "Este procurador já está monitorado.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "inpi_attorney.monitored",
    resourceType: "inpi_attorney_monitor",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return { attorney: { id: row.id, attorneyName: row.attorneyName, active: row.active } };
}

export async function setInpiAttorneyActive(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  id: string,
  active: boolean,
) {
  requireOrganizationPermission(account, organizationId, MANAGE);
  const [row] = await db
    .update(inpiAttorneyMonitors)
    .set({ active, updatedAt: new Date() })
    .where(
      and(eq(inpiAttorneyMonitors.id, id), eq(inpiAttorneyMonitors.organizationId, organizationId)),
    )
    .returning();
  if (!row) throw new AppError("NOT_FOUND", "Procurador monitorado não encontrado.");
  return { attorney: { id: row.id, active: row.active } };
}

export async function runInpiNow(
  db: AppDatabase,
  deps: InpiDeps,
  account: SessionAccount,
  organizationId: string,
  input: { edition?: number },
) {
  requireOrganizationPermission(account, organizationId, MANAGE);
  try {
    const result = deps.remoteRun
      ? await deps.remoteRun({ organizationId, edition: input.edition })
      : await processRpiEdition(db, deps.provider, {
          organizationId,
          edition: input.edition,
          force: true,
        });
    return { result };
  } catch (error) {
    throw new AppError(
      "EXTERNAL_SERVICE_ERROR",
      error instanceof Error
        ? `Consulta à RPI indisponível: ${error.message}`
        : "RPI indisponível.",
    );
  }
}

// ------------------------------------------------------------- despachos

export async function listInpiDispatches(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { status?: Dispatch["status"]; processNumber?: string; page?: number },
) {
  requireOrganizationPermission(account, organizationId, READ);
  const page = Math.max(1, query.page ?? 1);
  const pageSize = 25;
  const conditions: SQL[] = [eq(inpiDispatches.organizationId, organizationId)];
  if (query.status) conditions.push(eq(inpiDispatches.status, query.status));
  if (query.processNumber) {
    conditions.push(eq(inpiDispatches.processNumber, query.processNumber.replace(/\D/g, "")));
  }
  const where = and(...conditions);
  const [rows, [{ total } = { total: 0 }]] = await Promise.all([
    db
      .select()
      .from(inpiDispatches)
      .where(where)
      .orderBy(desc(inpiDispatches.publishedOn), desc(inpiDispatches.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(inpiDispatches).where(where),
  ]);
  return { items: rows.map(serializeDispatch), total: Number(total), page, pageSize };
}

async function findDispatch(db: AppDatabase, organizationId: string, id: string) {
  const row = await db.query.inpiDispatches.findFirst({
    where: and(eq(inpiDispatches.id, id), eq(inpiDispatches.organizationId, organizationId)),
  });
  if (!row) throw new AppError("NOT_FOUND", "Despacho não encontrado.");
  return row;
}

export async function triageInpiDispatch(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  id: string,
  input: { createDeadline: boolean; ruleDays?: number; createTask: boolean },
  meta: RequestMeta,
) {
  const actor = requireOrganizationPermission(account, organizationId, MANAGE);
  const row = await findDispatch(db, organizationId, id);
  if (row.deadlineId || row.taskId) throw new AppError("CONFLICT", "Despacho já triado.");
  if (row.status === "dismissed") throw new AppError("CONFLICT", "Despacho descartado.");
  const monitor = row.monitoredProcessId
    ? await db.query.inpiMonitoredProcesses.findFirst({
        where: eq(inpiMonitoredProcesses.id, row.monitoredProcessId),
      })
    : null;
  const label = `INPI ${row.processNumber}${row.markName ? ` (${row.markName})` : ""}`;
  const procedure = row.procedureKey ? getProcedure(row.procedureKey) : undefined;
  const days = input.ruleDays ?? row.suggestedDays ?? undefined;

  let deadlineId: string | null = null;
  let dueAt: string | undefined;
  if (input.createDeadline) {
    if (!days) {
      throw new AppError("VALIDATION_ERROR", "Informe a quantidade de dias do prazo.");
    }
    const deadline = await createDeadline(
      db,
      account,
      organizationId,
      {
        title: `${procedure?.name ?? row.name} — ${label}`,
        description: `Despacho publicado na RPI ${row.edition} (${row.publishedOn}): ${row.name}.\n\n${row.suggestionBasis ?? ""}\n\nPrazos da LPI são contínuos (art. 221). Se o vencimento cair em dia sem expediente no INPI, confira a prorrogação.`,
        baseDate: `${row.publishedOn}T12:00:00.000Z`,
        baseDateLabel: `Publicação na RPI ${row.edition}`,
        ruleType: "calendar_days",
        ruleDays: days,
        ruleDescription: row.suggestionBasis ?? undefined,
        timezone: "America/Sao_Paulo",
        sourceType: "administrative_requirement",
        sourceId: row.id,
        legalMatterId: monitor?.legalMatterId ?? undefined,
        administrativeProcessId: monitor?.administrativeProcessId ?? undefined,
        status: "suggested",
        calculate: true,
      },
      {
        holidays: new NationalForensicHolidayCalendar(),
        notifications: new NotConfiguredNotificationProvider("in_app"),
      },
      meta,
    );
    deadlineId = deadline.id;
    dueAt = deadline.calculatedDueAt ?? undefined;
  }

  let taskId: string | null = null;
  if (input.createTask) {
    const task = await createTask(
      db,
      account,
      organizationId,
      {
        title: `${procedure?.name ?? "Analisar despacho"} — ${label}`,
        description: `${row.name}${row.complement ? `\n\n${row.complement}` : ""}\n\n${row.suggestionBasis ?? ""}`,
        priority: "high",
        legalMatterId: monitor?.legalMatterId ?? undefined,
        administrativeProcessId: monitor?.administrativeProcessId ?? undefined,
        dueAt,
      },
      meta,
    );
    taskId = task.id;
  }

  const [updated] = await db
    .update(inpiDispatches)
    .set({
      status: "triaged",
      deadlineId,
      taskId,
      triagedByMembershipId: actor.membershipId,
      triagedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(inpiDispatches.id, id))
    .returning();
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "inpi_dispatch.triaged",
    resourceType: "inpi_dispatch",
    resourceId: id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { deadlineId, taskId, days: days ?? null },
  });
  return { dispatch: serializeDispatch(updated!), deadlineId, taskId };
}

export async function dismissInpiDispatch(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  id: string,
  input: { reason: string },
  meta: RequestMeta,
) {
  const actor = requireOrganizationPermission(account, organizationId, MANAGE);
  const row = await findDispatch(db, organizationId, id);
  if (row.deadlineId || row.taskId) {
    throw new AppError(
      "CONFLICT",
      "Despacho já triado: cancele o prazo e a tarefa, se for o caso.",
    );
  }
  const [updated] = await db
    .update(inpiDispatches)
    .set({
      status: "dismissed",
      dismissedReason: input.reason.trim(),
      triagedByMembershipId: actor.membershipId,
      triagedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(inpiDispatches.id, id))
    .returning();
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "inpi_dispatch.dismissed",
    resourceType: "inpi_dispatch",
    resourceId: id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { reason: input.reason },
  });
  return { dispatch: serializeDispatch(updated!) };
}
