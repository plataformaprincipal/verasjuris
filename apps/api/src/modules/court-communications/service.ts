import type { DatajudProvider, DjenProvider } from "@verasjuris/ai";
import { recordAudit } from "@verasjuris/audit";
import type { SessionAccount } from "@verasjuris/auth";
import {
  courtCommunicationMonitors,
  courtCommunications,
  judicialMovements,
  judicialProcesses,
  lawyerProfiles,
  legalMatters,
  organizationMembers,
  profiles,
  type AppDatabase,
} from "@verasjuris/database";
import {
  addForensicBusinessDays,
  NationalForensicHolidayCalendar,
  NotConfiguredNotificationProvider,
} from "@verasjuris/notifications";
import { AppError } from "@verasjuris/types";
import { and, count, desc, eq, gte, ilike, lte, or, type SQL } from "drizzle-orm";
import { requireOrganizationPermission } from "../auth/routes.js";
import type { RequestMeta } from "../auth/service.js";
import { createDeadline } from "../deadlines/service.js";
import { createTask } from "../tasks/service.js";
import { captureForMonitor, type CaptureResult } from "./capture.js";

export type CourtCommunicationDeps = {
  djen: DjenProvider;
  datajud: DatajudProvider | null;
  /** Quando presente, a captura sob demanda roda no worker (IP brasileiro). */
  remoteCapture?: (
    monitorId: string,
    window: { from?: string; to?: string },
  ) => Promise<CaptureResult>;
};

const READ = "judicial_process.read" as const;
const MANAGE = "judicial_process.manage_movements" as const;

type MonitorRow = typeof courtCommunicationMonitors.$inferSelect;
type CommunicationRow = typeof courtCommunications.$inferSelect;

function serializeMonitor(row: MonitorRow) {
  return {
    id: row.id,
    provider: row.provider,
    membershipId: row.membershipId,
    lawyerName: row.lawyerName,
    oabNumber: row.oabNumber,
    oabUf: row.oabUf,
    active: row.active,
    capturedThrough: row.capturedThrough,
    lastRunAt: row.lastRunAt?.toISOString() ?? null,
    lastRunStatus: row.lastRunStatus,
    lastRunMessage: row.lastRunMessage,
    lastRunFound: row.lastRunFound,
    lastRunCreated: row.lastRunCreated,
    createdAt: row.createdAt.toISOString(),
  };
}

function serializeCommunication(row: CommunicationRow, options: { full?: boolean } = {}) {
  const preview = row.content.length > 280 ? `${row.content.slice(0, 277)}…` : row.content;
  return {
    id: row.id,
    monitorId: row.monitorId,
    provider: row.provider,
    externalId: row.externalId,
    tribunal: row.tribunal,
    communicationType: row.communicationType,
    documentType: row.documentType,
    courtBody: row.courtBody,
    className: row.className,
    processNumber: row.processNumber,
    processNumberMasked: row.processNumberMasked,
    medium: row.medium,
    preview,
    content: options.full ? row.content : undefined,
    link: row.link,
    certificateUrl: row.externalHash
      ? `https://comunicaapi.pje.jus.br/api/v1/comunicacao/${encodeURIComponent(row.externalHash)}/certidao`
      : null,
    recipients: row.recipients,
    lawyers: row.lawyers,
    availableOn: row.availableOn,
    publishedOn: row.publishedOn,
    termStartsOn: row.termStartsOn,
    status: row.status,
    category: row.category,
    suggestedAction: row.suggestedAction,
    suggestedDays: row.suggestedDays,
    suggestedRuleType: row.suggestedRuleType,
    suggestionBasis: row.suggestionBasis,
    suggestedDueOn:
      row.termStartsOn && row.suggestedDays
        ? addForensicBusinessDays(row.termStartsOn, row.suggestedDays)
        : null,
    judicialProcessId: row.judicialProcessId,
    deadlineId: row.deadlineId,
    taskId: row.taskId,
    triagedAt: row.triagedAt?.toISOString() ?? null,
    dismissedReason: row.dismissedReason,
    capturedAt: row.capturedAt.toISOString(),
  };
}

async function findMonitor(db: AppDatabase, organizationId: string, monitorId: string) {
  const row = await db.query.courtCommunicationMonitors.findFirst({
    where: and(
      eq(courtCommunicationMonitors.id, monitorId),
      eq(courtCommunicationMonitors.organizationId, organizationId),
    ),
  });
  if (!row) throw new AppError("NOT_FOUND", "Monitor de OAB não encontrado.");
  return row;
}

async function findCommunication(db: AppDatabase, organizationId: string, id: string) {
  const row = await db.query.courtCommunications.findFirst({
    where: and(
      eq(courtCommunications.id, id),
      eq(courtCommunications.organizationId, organizationId),
    ),
  });
  if (!row) throw new AppError("NOT_FOUND", "Comunicação não encontrada.");
  return row;
}

// ---------------------------------------------------------------- monitores

export async function listMonitors(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  requireOrganizationPermission(account, organizationId, READ);
  const rows = await db.query.courtCommunicationMonitors.findMany({
    where: eq(courtCommunicationMonitors.organizationId, organizationId),
    orderBy: [desc(courtCommunicationMonitors.createdAt)],
  });
  return { items: rows.map(serializeMonitor) };
}

/** OABs informadas pelos membros ativos, para sugerir monitores. */
export async function listOabSuggestions(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  requireOrganizationPermission(account, organizationId, READ);
  const rows = await db
    .select({
      membershipId: organizationMembers.id,
      displayName: profiles.displayName,
      professionalName: lawyerProfiles.professionalName,
      oabNumber: lawyerProfiles.oabNumber,
      oabUf: lawyerProfiles.oabUf,
    })
    .from(organizationMembers)
    .innerJoin(profiles, eq(profiles.userId, organizationMembers.userId))
    .innerJoin(lawyerProfiles, eq(lawyerProfiles.userId, organizationMembers.userId))
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.status, "active"),
      ),
    );
  const items = rows
    .filter((r) => r.oabNumber && r.oabUf)
    .map((r) => ({
      membershipId: r.membershipId,
      lawyerName: r.professionalName ?? r.displayName,
      oabNumber: r.oabNumber!.replace(/\D/g, ""),
      oabUf: r.oabUf!.toUpperCase(),
    }));
  return { items };
}

export async function createMonitor(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: { lawyerName: string; oabNumber: string; oabUf: string; membershipId?: string },
  meta: RequestMeta,
) {
  const actor = requireOrganizationPermission(account, organizationId, MANAGE);
  const oabNumber = input.oabNumber.replace(/\D/g, "");
  const oabUf = input.oabUf.trim().toUpperCase();
  if (input.membershipId) {
    const member = await db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.id, input.membershipId),
        eq(organizationMembers.organizationId, organizationId),
      ),
    });
    if (!member) throw new AppError("VALIDATION_ERROR", "Membro inválido para esta organização.");
  }
  const existing = await db.query.courtCommunicationMonitors.findFirst({
    where: and(
      eq(courtCommunicationMonitors.organizationId, organizationId),
      eq(courtCommunicationMonitors.provider, "djen"),
      eq(courtCommunicationMonitors.oabNumber, oabNumber),
      eq(courtCommunicationMonitors.oabUf, oabUf),
    ),
  });
  if (existing) {
    throw new AppError("CONFLICT", `A OAB ${oabNumber}/${oabUf} já está sendo monitorada.`);
  }
  const [row] = await db
    .insert(courtCommunicationMonitors)
    .values({
      organizationId,
      provider: "djen",
      membershipId: input.membershipId ?? null,
      lawyerName: input.lawyerName.trim(),
      oabNumber,
      oabUf,
      createdByMembershipId: actor.membershipId,
    })
    .returning();
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "court_communication_monitor.created",
    resourceType: "court_communication_monitor",
    resourceId: row!.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { oab: `${oabNumber}/${oabUf}` },
  });
  return { monitor: serializeMonitor(row!) };
}

export async function updateMonitor(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  monitorId: string,
  input: { active?: boolean; lawyerName?: string },
  meta: RequestMeta,
) {
  requireOrganizationPermission(account, organizationId, MANAGE);
  const current = await findMonitor(db, organizationId, monitorId);
  const [row] = await db
    .update(courtCommunicationMonitors)
    .set({
      active: input.active ?? current.active,
      lawyerName: input.lawyerName?.trim() || current.lawyerName,
      updatedAt: new Date(),
    })
    .where(eq(courtCommunicationMonitors.id, monitorId))
    .returning();
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "court_communication_monitor.updated",
    resourceType: "court_communication_monitor",
    resourceId: monitorId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    before: { active: current.active },
    after: { active: row!.active },
  });
  return { monitor: serializeMonitor(row!) };
}

export async function runMonitorNow(
  db: AppDatabase,
  deps: CourtCommunicationDeps,
  account: SessionAccount,
  organizationId: string,
  monitorId: string,
  input: { from?: string; to?: string },
) {
  requireOrganizationPermission(account, organizationId, MANAGE);
  const monitor = await findMonitor(db, organizationId, monitorId);
  let result: CaptureResult;
  if (deps.remoteCapture) {
    try {
      result = await deps.remoteCapture(monitor.id, input);
    } catch (error) {
      throw new AppError(
        "EXTERNAL_SERVICE_ERROR",
        error instanceof Error ? `Captura indisponível: ${error.message}` : "Captura indisponível.",
      );
    }
  } else {
    result = await captureForMonitor(db, deps.djen, monitor, input);
  }
  const updated = await findMonitor(db, organizationId, monitorId);
  return { result, monitor: serializeMonitor(updated) };
}

// ------------------------------------------------------------- comunicações

export async function listCommunications(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: {
    status?: CommunicationRow["status"];
    from?: string;
    to?: string;
    q?: string;
    monitorId?: string;
    judicialProcessId?: string;
    page?: number;
    pageSize?: number;
  },
) {
  requireOrganizationPermission(account, organizationId, READ);
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
  const conditions: SQL[] = [eq(courtCommunications.organizationId, organizationId)];
  if (query.status) conditions.push(eq(courtCommunications.status, query.status));
  if (query.from) conditions.push(gte(courtCommunications.availableOn, query.from));
  if (query.to) conditions.push(lte(courtCommunications.availableOn, query.to));
  if (query.monitorId) conditions.push(eq(courtCommunications.monitorId, query.monitorId));
  if (query.judicialProcessId) {
    conditions.push(eq(courtCommunications.judicialProcessId, query.judicialProcessId));
  }
  if (query.q?.trim()) {
    const term = `%${query.q.trim().replace(/[%_]/g, "")}%`;
    const digits = query.q.replace(/\D/g, "");
    const clauses: SQL[] = [
      ilike(courtCommunications.content, term),
      ilike(courtCommunications.courtBody, term),
    ];
    if (digits.length >= 4) clauses.push(ilike(courtCommunications.processNumber, `%${digits}%`));
    conditions.push(or(...clauses)!);
  }
  const where = and(...conditions);
  const [rows, [{ total } = { total: 0 }], byStatus] = await Promise.all([
    db
      .select()
      .from(courtCommunications)
      .where(where)
      .orderBy(desc(courtCommunications.availableOn), desc(courtCommunications.capturedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(courtCommunications).where(where),
    db
      .select({ status: courtCommunications.status, total: count() })
      .from(courtCommunications)
      .where(eq(courtCommunications.organizationId, organizationId))
      .groupBy(courtCommunications.status),
  ]);
  const counts = { new: 0, linked: 0, triaged: 0, dismissed: 0 };
  for (const row of byStatus) counts[row.status] = Number(row.total);
  return {
    items: rows.map((r) => serializeCommunication(r)),
    total: Number(total),
    page,
    pageSize,
    counts,
  };
}

export async function getCommunication(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  id: string,
) {
  requireOrganizationPermission(account, organizationId, READ);
  const row = await findCommunication(db, organizationId, id);
  let judicialProcess: { id: string; cnjNumber: string; legalMatterId: string } | null = null;
  if (row.judicialProcessId) {
    const process = await db.query.judicialProcesses.findFirst({
      where: eq(judicialProcesses.id, row.judicialProcessId),
    });
    if (process) {
      judicialProcess = {
        id: process.id,
        cnjNumber: process.cnjNumber,
        legalMatterId: process.legalMatterId,
      };
    }
  }
  return { communication: serializeCommunication(row, { full: true }), judicialProcess };
}

export async function linkCommunication(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  id: string,
  input: { judicialProcessId: string | null },
  meta: RequestMeta,
) {
  requireOrganizationPermission(account, organizationId, MANAGE);
  const row = await findCommunication(db, organizationId, id);
  if (input.judicialProcessId) {
    const process = await db.query.judicialProcesses.findFirst({
      where: and(
        eq(judicialProcesses.id, input.judicialProcessId),
        eq(judicialProcesses.organizationId, organizationId),
      ),
    });
    if (!process) throw new AppError("NOT_FOUND", "Processo não encontrado nesta organização.");
  }
  const status =
    row.status === "triaged" || row.status === "dismissed"
      ? row.status
      : input.judicialProcessId
        ? "linked"
        : "new";
  const [updated] = await db
    .update(courtCommunications)
    .set({ judicialProcessId: input.judicialProcessId, status, updatedAt: new Date() })
    .where(eq(courtCommunications.id, id))
    .returning();
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "court_communication.linked",
    resourceType: "court_communication",
    resourceId: id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    before: { judicialProcessId: row.judicialProcessId },
    after: { judicialProcessId: input.judicialProcessId },
  });
  return { communication: serializeCommunication(updated!, { full: true }) };
}

export async function dismissCommunication(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  id: string,
  input: { reason: string },
  meta: RequestMeta,
) {
  const actor = requireOrganizationPermission(account, organizationId, MANAGE);
  const row = await findCommunication(db, organizationId, id);
  if (row.status === "triaged") {
    throw new AppError(
      "CONFLICT",
      "Comunicação já triada: cancele o prazo e a tarefa criados, se for o caso.",
    );
  }
  const [updated] = await db
    .update(courtCommunications)
    .set({
      status: "dismissed",
      dismissedReason: input.reason.trim(),
      triagedByMembershipId: actor.membershipId,
      triagedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(courtCommunications.id, id))
    .returning();
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "court_communication.dismissed",
    resourceType: "court_communication",
    resourceId: id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { reason: input.reason },
  });
  return { communication: serializeCommunication(updated!, { full: true }) };
}

/**
 * Triagem: cria o prazo provisório (status "suggested", nunca confirmado
 * automaticamente), a tarefa e registra a movimentação no processo vinculado.
 */
export async function triageCommunication(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  id: string,
  input: {
    createDeadline: boolean;
    deadlineTitle?: string;
    ruleDays?: number;
    createTask: boolean;
    taskTitle?: string;
    responsibleMembershipId?: string;
    priority?: "low" | "normal" | "high" | "urgent";
  },
  meta: RequestMeta,
) {
  const actor = requireOrganizationPermission(account, organizationId, MANAGE);
  const row = await findCommunication(db, organizationId, id);
  if (row.status === "triaged") throw new AppError("CONFLICT", "Comunicação já triada.");
  if (row.status === "dismissed") throw new AppError("CONFLICT", "Comunicação descartada.");

  const process = row.judicialProcessId
    ? await db.query.judicialProcesses.findFirst({
        where: eq(judicialProcesses.id, row.judicialProcessId),
      })
    : null;
  const label = row.processNumberMasked ?? "processo não vinculado";
  const ruleDays = input.ruleDays ?? row.suggestedDays ?? undefined;

  let deadlineId: string | null = null;
  let dueAt: string | undefined;
  if (input.createDeadline) {
    if (!ruleDays || !row.publishedOn) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Informe a quantidade de dias úteis do prazo (esta comunicação não tem prazo sugerido).",
      );
    }
    const deadline = await createDeadline(
      db,
      account,
      organizationId,
      {
        title: input.deadlineTitle?.trim() || `${row.suggestedAction ?? "Prazo"} — ${label}`,
        description: `Comunicação do DJEN disponibilizada em ${row.availableOn}, publicada em ${row.publishedOn}, termo inicial ${row.termStartsOn}.\n\n${row.suggestionBasis ?? ""}\n\nPrazo provisório: confirme a regra, o termo inicial e feriados locais antes de validar.`,
        // O calculador conta a partir do dia seguinte à base: base = publicação.
        baseDate: `${row.publishedOn}T12:00:00.000Z`,
        baseDateLabel: "Publicação no DJEN",
        ruleType: "business_days",
        ruleDays,
        ruleDescription: row.suggestionBasis ?? undefined,
        timezone: "America/Sao_Paulo",
        sourceType: "judicial_movement",
        sourceId: row.id,
        legalMatterId: process?.legalMatterId,
        judicialProcessId: process?.id,
        responsibleMembershipId: input.responsibleMembershipId,
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
        title: input.taskTitle?.trim() || `Analisar intimação — ${label}`,
        description: `${row.suggestedAction ?? ""}\n\nTrecho: ${row.content.slice(0, 1200)}`,
        priority: input.priority ?? "high",
        legalMatterId: process?.legalMatterId,
        judicialProcessId: process?.id,
        responsibleMembershipId: input.responsibleMembershipId,
        dueAt,
      },
      meta,
    );
    taskId = task.id;
  }

  if (process) {
    await db
      .insert(judicialMovements)
      .values({
        organizationId,
        judicialProcessId: process.id,
        occurredAt: new Date(`${row.availableOn}T12:00:00.000Z`),
        title: `${row.communicationType ?? "Comunicação"} no DJEN`,
        description: row.content.slice(0, 4000),
        source: "court_provider",
        sourceReference: `djen:${row.externalId}`,
        capturedAt: row.capturedAt,
        createdByMembershipId: actor.membershipId,
      })
      .onConflictDoNothing();
  }

  const [updated] = await db
    .update(courtCommunications)
    .set({
      status: "triaged",
      deadlineId,
      taskId,
      triagedByMembershipId: actor.membershipId,
      triagedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(courtCommunications.id, id))
    .returning();
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "court_communication.triaged",
    resourceType: "court_communication",
    resourceId: id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { deadlineId, taskId, ruleDays: ruleDays ?? null },
  });
  return { communication: serializeCommunication(updated!, { full: true }), deadlineId, taskId };
}

// --------------------------------------------------------------- Datajud

export async function syncProcessFromDatajud(
  db: AppDatabase,
  deps: CourtCommunicationDeps,
  account: SessionAccount,
  organizationId: string,
  judicialProcessId: string,
  meta: RequestMeta,
) {
  const actor = requireOrganizationPermission(account, organizationId, MANAGE);
  if (!deps.datajud) {
    throw new AppError(
      "NOT_CONFIGURED",
      "Datajud não configurado: defina DATAJUD_API_KEY com a chave pública do CNJ.",
    );
  }
  const process = await db.query.judicialProcesses.findFirst({
    where: and(
      eq(judicialProcesses.id, judicialProcessId),
      eq(judicialProcesses.organizationId, organizationId),
    ),
  });
  if (!process) throw new AppError("NOT_FOUND", "Processo não encontrado.");

  const records = await deps.datajud.fetchByNumber(process.cnjNumberNormalized);
  if (records.length === 0) {
    return {
      found: false,
      created: 0,
      records: [],
      message:
        "O Datajud não tem este processo. Processos sigilosos e muito recentes podem não aparecer.",
    };
  }

  let created = 0;
  let latest: string | null = null;
  for (const record of records) {
    for (const movement of record.movements) {
      if (!movement.occurredAt) continue;
      if (!latest || movement.occurredAt > latest) latest = movement.occurredAt;
      const reference = `datajud:${record.id}:${movement.code ?? "x"}:${movement.occurredAt}`;
      const inserted = await db
        .insert(judicialMovements)
        .values({
          organizationId,
          judicialProcessId: process.id,
          occurredAt: new Date(movement.occurredAt),
          title: movement.name,
          description: movement.complements.length > 0 ? movement.complements.join("; ") : null,
          movementCode: movement.code !== null ? String(movement.code) : null,
          source: "court_provider",
          sourceReference: reference,
          capturedAt: new Date(),
          createdByMembershipId: actor.membershipId,
        })
        .onConflictDoNothing()
        .returning({ id: judicialMovements.id });
      created += inserted.length;
    }
  }

  const lastMovementAt = latest ? new Date(latest) : process.lastMovementAt;
  await db
    .update(judicialProcesses)
    .set({
      sourceUpdatedAt: new Date(),
      lastMovementAt:
        lastMovementAt && (!process.lastMovementAt || lastMovementAt > process.lastMovementAt)
          ? lastMovementAt
          : process.lastMovementAt,
      updatedAt: new Date(),
    })
    .where(eq(judicialProcesses.id, process.id));

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "judicial_process.datajud_synced",
    resourceType: "judicial_process",
    resourceId: process.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { created, degrees: records.map((r) => r.degree) },
  });

  return {
    found: true,
    created,
    message: null,
    records: records.map((r) => ({
      tribunal: r.tribunal,
      degree: r.degree,
      className: r.className,
      subjects: r.subjects.map((s) => s.name),
      courtBody: r.courtBody,
      filedAt: r.filedAt,
      system: r.system,
      lastUpdatedAt: r.lastUpdatedAt,
      movements: r.movements.length,
    })),
  };
}

/** Busca processos da organização pelo número, para vincular comunicações. */
export async function searchProcessOptions(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  q: string,
) {
  requireOrganizationPermission(account, organizationId, READ);
  const digits = q.replace(/\D/g, "");
  const conditions: SQL[] = [eq(judicialProcesses.organizationId, organizationId)];
  if (digits.length >= 3) {
    conditions.push(ilike(judicialProcesses.cnjNumberNormalized, `%${digits}%`));
  } else if (q.trim().length >= 2) {
    conditions.push(ilike(legalMatters.title, `%${q.trim().replace(/[%_]/g, "")}%`));
  }
  const rows = await db
    .select({
      id: judicialProcesses.id,
      cnjNumber: judicialProcesses.cnjNumber,
      matterId: legalMatters.id,
      matterTitle: legalMatters.title,
    })
    .from(judicialProcesses)
    .innerJoin(legalMatters, eq(legalMatters.id, judicialProcesses.legalMatterId))
    .where(and(...conditions))
    .orderBy(desc(judicialProcesses.updatedAt))
    .limit(20);
  return { items: rows };
}
