import { recordAudit } from "@verasjuris/audit";
import type { SessionAccount } from "@verasjuris/auth";
import {
  administrativeBodies,
  administrativeProcesses,
  administrativeRequests,
  benefitChecklists,
  documentVersions,
  documents,
  legalMatters,
  type AppDatabase,
} from "@verasjuris/database";
import {
  NationalAdministrativeHolidayCalendar,
  NotConfiguredNotificationProvider,
} from "@verasjuris/notifications";
import { AppError } from "@verasjuris/types";
import {
  ADMINISTRATIVE_AGENCIES,
  ADMINISTRATIVE_PROCEDURES,
  BENEFIT_CHECKLISTS,
  CHECKLIST_STATUS_LABEL,
  getBenefitChecklist,
  getProcedure,
  summarizeChecklist,
  type AdministrativeProcedure,
  type ChecklistItemStatus,
} from "@verasjuris/validation";
import { and, desc, eq, type SQL } from "drizzle-orm";
import { requireOrganizationPermission } from "../auth/routes.js";
import type { RequestMeta } from "../auth/service.js";
import { createDeadline } from "../deadlines/service.js";
import { createTask } from "../tasks/service.js";

const ADMIN_READ = "administrative_process.read" as const;
const ADMIN_REQUESTS = "administrative_process.manage_requests" as const;
const PREV_READ = "previdentiary.read" as const;
const PREV_UPDATE = "previdentiary.update" as const;

export function getCatalog(account: SessionAccount, organizationId: string) {
  requireOrganizationPermission(account, organizationId, ADMIN_READ);
  return {
    agencies: ADMINISTRATIVE_AGENCIES,
    procedures: ADMINISTRATIVE_PROCEDURES,
    benefits: BENEFIT_CHECKLISTS,
    checklistStatuses: CHECKLIST_STATUS_LABEL,
  };
}

async function loadProcess(db: AppDatabase, organizationId: string, processId: string) {
  const process = await db.query.administrativeProcesses.findFirst({
    where: and(
      eq(administrativeProcesses.id, processId),
      eq(administrativeProcesses.organizationId, organizationId),
    ),
  });
  if (!process) throw new AppError("NOT_FOUND", "Processo administrativo não encontrado.");
  const body = await db.query.administrativeBodies.findFirst({
    where: eq(administrativeBodies.id, process.administrativeBodyId),
  });
  return { process, bodyCode: body?.code ?? null };
}

function assertProcedureFits(procedure: AdministrativeProcedure, bodyCode: string | null) {
  const fits =
    bodyCode === procedure.agencyCode ||
    (procedure.agencyCode.startsWith("PROCON") && bodyCode?.startsWith("PROCON")) ||
    (procedure.agencyCode.startsWith("DETRAN") && bodyCode?.startsWith("DETRAN"));
  if (!fits) {
    throw new AppError(
      "VALIDATION_ERROR",
      `O procedimento “${procedure.name}” é de outro órgão (${procedure.agencyCode}).`,
    );
  }
}

/**
 * Planeja o ato: cria os prazos do procedimento a partir da data informada
 * (ex.: ciência da exigência) e uma tarefa com o passo a passo e os documentos.
 */
export async function planProcedure(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  processId: string,
  input: { procedureKey: string; startDate: string; responsibleMembershipId?: string },
  meta: RequestMeta,
) {
  requireOrganizationPermission(account, organizationId, ADMIN_REQUESTS);
  const procedure = getProcedure(input.procedureKey);
  if (!procedure) throw new AppError("VALIDATION_ERROR", "Procedimento desconhecido.");
  const { process, bodyCode } = await loadProcess(db, organizationId, processId);
  assertProcedureFits(procedure, bodyCode);

  const deadlinesCreated: string[] = [];
  let lastDue: string | undefined;
  for (const rule of procedure.deadlines.filter((r) => r.actor === "party" && r.days)) {
    const deadline = await createDeadline(
      db,
      account,
      organizationId,
      {
        title: `${rule.label} — ${procedure.name}`,
        description: `${procedure.summary}\n\nContagem a partir de: ${rule.startsFrom}.\n${rule.basis}\n\nPrazo sugerido: confirme a data de ciência e feriados locais.`,
        baseDate: `${input.startDate}T12:00:00.000Z`,
        baseDateLabel: rule.startsFrom,
        ruleType: rule.counting === "business_days" ? "business_days" : "calendar_days",
        ruleDays: rule.days ?? undefined,
        ruleDescription: rule.basis,
        timezone: "America/Sao_Paulo",
        sourceType: "administrative_deadline",
        legalMatterId: process.legalMatterId,
        administrativeProcessId: process.id,
        responsibleMembershipId: input.responsibleMembershipId,
        status: "suggested",
        calculate: true,
      },
      {
        holidays: new NationalAdministrativeHolidayCalendar(),
        notifications: new NotConfiguredNotificationProvider("in_app"),
      },
      meta,
    );
    deadlinesCreated.push(deadline.id);
    lastDue = deadline.calculatedDueAt ?? lastDue;
  }

  const task = await createTask(
    db,
    account,
    organizationId,
    {
      title: `${procedure.name} — ${procedure.portalName}`,
      description: [
        procedure.summary,
        `Onde: ${procedure.portalName} (${procedure.portalUrl})`,
        "",
        "Passo a passo:",
        ...procedure.steps.map((s, i) => `${i + 1}. ${s}`),
        "",
        "Documentos:",
        ...procedure.documents.map((d) => `- ${d}`),
        "",
        "Depois de protocolar, registre o número e anexe o comprovante no processo.",
      ].join("\n"),
      priority: "high",
      legalMatterId: process.legalMatterId,
      administrativeProcessId: process.id,
      responsibleMembershipId: input.responsibleMembershipId,
      dueAt: lastDue,
    },
    meta,
  );

  return { deadlineIds: deadlinesCreated, taskId: task.id };
}

/**
 * Registra o protocolo feito no portal do órgão. Exige comprovante anexado
 * (documento da organização com versão disponível): sem comprovante, não há
 * protocolo confirmado.
 */
export async function registerGuidedProtocol(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  processId: string,
  input: {
    procedureKey: string;
    protocolNumber: string;
    protocolDate: string;
    receiptDocumentId: string;
    notes?: string;
  },
  meta: RequestMeta,
) {
  const actor = requireOrganizationPermission(account, organizationId, ADMIN_REQUESTS);
  const procedure = getProcedure(input.procedureKey);
  if (!procedure) throw new AppError("VALIDATION_ERROR", "Procedimento desconhecido.");
  const { process, bodyCode } = await loadProcess(db, organizationId, processId);
  assertProcedureFits(procedure, bodyCode);

  const receipt = await db.query.documents.findFirst({
    where: and(
      eq(documents.id, input.receiptDocumentId),
      eq(documents.organizationId, organizationId),
    ),
  });
  if (!receipt)
    throw new AppError("VALIDATION_ERROR", "Comprovante não encontrado nesta organização.");
  const version = await db.query.documentVersions.findFirst({
    where: and(
      eq(documentVersions.documentId, receipt.id),
      eq(documentVersions.status, "available"),
    ),
  });
  if (!version) {
    throw new AppError(
      "VALIDATION_ERROR",
      "O comprovante ainda não tem arquivo disponível. Conclua o upload antes de registrar o protocolo.",
    );
  }

  const protocolDate = new Date(`${input.protocolDate}T12:00:00.000Z`);
  const result = await db.transaction(async (tx) => {
    const [request] = await tx
      .insert(administrativeRequests)
      .values({
        organizationId,
        administrativeProcessId: process.id,
        requestType: procedure.key,
        title: procedure.name,
        description: input.notes ?? null,
        status: "confirmed",
        requestedAt: protocolDate,
        submittedAt: protocolDate,
        protocolNumber: input.protocolNumber.trim(),
        protocolReference: procedure.portalName,
        procedureKey: procedure.key,
        receiptDocumentId: receipt.id,
        source: "document",
        createdByMembershipId: actor.membershipId,
        reviewedByMembershipId: actor.membershipId,
      })
      .returning();
    await tx
      .update(administrativeProcesses)
      .set({
        protocolNumber: process.protocolNumber ?? input.protocolNumber.trim(),
        protocolDate: process.protocolDate ?? protocolDate,
        protocolSource: process.protocolSource ?? "document",
        protocolReference: process.protocolReference ?? procedure.portalName,
        status: process.status === "draft" ? "waiting_body" : process.status,
        filedAt: process.filedAt ?? protocolDate,
        lastActivityAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(administrativeProcesses.id, process.id));
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "administrative_process.protocol_registered",
      resourceType: "administrative_request",
      resourceId: request!.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: {
        procedureKey: procedure.key,
        protocolNumber: input.protocolNumber,
        receiptDocumentId: receipt.id,
      },
    });
    return request!;
  });

  // Acompanhamento de prazos do órgão (não são prazos do escritório).
  const followUps: string[] = [];
  for (const rule of procedure.deadlines.filter((r) => r.actor === "agency" && r.days)) {
    const due = new Date(protocolDate);
    due.setUTCDate(due.getUTCDate() + (rule.days ?? 0));
    const task = await createTask(
      db,
      account,
      organizationId,
      {
        title: `${rule.label} — protocolo ${input.protocolNumber}`,
        description: `${rule.basis}\nContagem a partir de: ${rule.startsFrom}.`,
        priority: "normal",
        legalMatterId: process.legalMatterId,
        administrativeProcessId: process.id,
        dueAt: due.toISOString(),
      },
      meta,
    );
    followUps.push(task.id);
  }

  return {
    request: {
      id: result.id,
      procedureKey: procedure.key,
      protocolNumber: result.protocolNumber,
      submittedAt: result.submittedAt?.toISOString() ?? null,
      receiptDocumentId: result.receiptDocumentId,
      status: result.status,
    },
    followUpTaskIds: followUps,
  };
}

export async function listGuidedProtocols(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  processId: string,
) {
  requireOrganizationPermission(account, organizationId, ADMIN_READ);
  const { process } = await loadProcess(db, organizationId, processId);
  const rows = await db.query.administrativeRequests.findMany({
    where: and(
      eq(administrativeRequests.administrativeProcessId, process.id),
      eq(administrativeRequests.organizationId, organizationId),
    ),
    orderBy: [desc(administrativeRequests.createdAt)],
  });
  return {
    items: rows
      .filter((r) => r.procedureKey)
      .map((r) => ({
        id: r.id,
        procedureKey: r.procedureKey,
        procedureName: getProcedure(r.procedureKey ?? "")?.name ?? r.title,
        protocolNumber: r.protocolNumber,
        submittedAt: r.submittedAt?.toISOString() ?? null,
        receiptDocumentId: r.receiptDocumentId,
        status: r.status,
      })),
  };
}

// ------------------------------------------------- checklists de benefícios

type ChecklistItems = Record<
  string,
  {
    status: ChecklistItemStatus;
    note?: string | null;
    documentId?: string | null;
    updatedAt: string;
    updatedByMembershipId: string;
  }
>;

function serializeChecklist(row: typeof benefitChecklists.$inferSelect) {
  const definition = getBenefitChecklist(row.benefitKey);
  const items = (row.items ?? {}) as ChecklistItems;
  return {
    id: row.id,
    benefitKey: row.benefitKey,
    benefitName: definition?.name ?? row.benefitKey,
    legalMatterId: row.legalMatterId,
    administrativeProcessId: row.administrativeProcessId,
    clientLabel: row.clientLabel,
    requirements: (definition?.requirements ?? []).map((req) => ({
      ...req,
      status: items[req.key]?.status ?? "nao_identificado",
      note: items[req.key]?.note ?? null,
      documentId: items[req.key]?.documentId ?? null,
      updatedAt: items[req.key]?.updatedAt ?? null,
    })),
    summary: definition
      ? summarizeChecklist(definition, items)
      : { total: 0, counts: {}, open: [] },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listChecklists(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { legalMatterId?: string; administrativeProcessId?: string },
) {
  requireOrganizationPermission(account, organizationId, PREV_READ);
  const conditions: SQL[] = [eq(benefitChecklists.organizationId, organizationId)];
  if (query.legalMatterId)
    conditions.push(eq(benefitChecklists.legalMatterId, query.legalMatterId));
  if (query.administrativeProcessId) {
    conditions.push(eq(benefitChecklists.administrativeProcessId, query.administrativeProcessId));
  }
  const rows = await db.query.benefitChecklists.findMany({
    where: and(...conditions),
    orderBy: [desc(benefitChecklists.updatedAt)],
    limit: 100,
  });
  return { items: rows.map(serializeChecklist) };
}

export async function createChecklist(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    benefitKey: string;
    legalMatterId?: string;
    administrativeProcessId?: string;
    clientLabel?: string;
  },
  meta: RequestMeta,
) {
  const actor = requireOrganizationPermission(account, organizationId, PREV_UPDATE);
  if (input.legalMatterId) {
    const matter = await db.query.legalMatters.findFirst({
      where: and(
        eq(legalMatters.id, input.legalMatterId),
        eq(legalMatters.organizationId, organizationId),
      ),
    });
    if (!matter) throw new AppError("NOT_FOUND", "Caso não encontrado.");
  }
  if (input.administrativeProcessId) {
    const process = await db.query.administrativeProcesses.findFirst({
      where: and(
        eq(administrativeProcesses.id, input.administrativeProcessId),
        eq(administrativeProcesses.organizationId, organizationId),
      ),
    });
    if (!process) throw new AppError("NOT_FOUND", "Processo administrativo não encontrado.");
  }
  const [row] = await db
    .insert(benefitChecklists)
    .values({
      organizationId,
      benefitKey: input.benefitKey,
      legalMatterId: input.legalMatterId ?? null,
      administrativeProcessId: input.administrativeProcessId ?? null,
      clientLabel: input.clientLabel ?? null,
      createdByMembershipId: actor.membershipId,
    })
    .returning();
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "benefit_checklist.created",
    resourceType: "benefit_checklist",
    resourceId: row!.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { benefitKey: input.benefitKey },
  });
  return { checklist: serializeChecklist(row!) };
}

export async function getChecklist(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  id: string,
) {
  requireOrganizationPermission(account, organizationId, PREV_READ);
  const row = await db.query.benefitChecklists.findFirst({
    where: and(eq(benefitChecklists.id, id), eq(benefitChecklists.organizationId, organizationId)),
  });
  if (!row) throw new AppError("NOT_FOUND", "Checklist não encontrado.");
  return { checklist: serializeChecklist(row) };
}

export async function updateChecklistItem(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  id: string,
  requirementKey: string,
  input: { status: ChecklistItemStatus; note?: string; documentId?: string | null },
  meta: RequestMeta,
) {
  const actor = requireOrganizationPermission(account, organizationId, PREV_UPDATE);
  const row = await db.query.benefitChecklists.findFirst({
    where: and(eq(benefitChecklists.id, id), eq(benefitChecklists.organizationId, organizationId)),
  });
  if (!row) throw new AppError("NOT_FOUND", "Checklist não encontrado.");
  const definition = getBenefitChecklist(row.benefitKey);
  if (!definition?.requirements.some((r) => r.key === requirementKey)) {
    throw new AppError("VALIDATION_ERROR", "Requisito desconhecido para este benefício.");
  }
  if (input.documentId) {
    const doc = await db.query.documents.findFirst({
      where: and(eq(documents.id, input.documentId), eq(documents.organizationId, organizationId)),
    });
    if (!doc) throw new AppError("VALIDATION_ERROR", "Documento não encontrado nesta organização.");
  }
  if (input.status === "comprovado" && !input.documentId && !input.note?.trim()) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Para marcar como comprovado, vincule um documento ou descreva a prova.",
    );
  }
  const items = { ...((row.items ?? {}) as ChecklistItems) };
  const before = items[requirementKey]?.status ?? "nao_identificado";
  items[requirementKey] = {
    status: input.status,
    note: input.note ?? null,
    documentId: input.documentId ?? null,
    updatedAt: new Date().toISOString(),
    updatedByMembershipId: actor.membershipId,
  };
  const [updated] = await db
    .update(benefitChecklists)
    .set({ items, updatedAt: new Date() })
    .where(eq(benefitChecklists.id, id))
    .returning();
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "benefit_checklist.item_updated",
    resourceType: "benefit_checklist",
    resourceId: id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    before: { [requirementKey]: before },
    after: { [requirementKey]: input.status },
  });
  return { checklist: serializeChecklist(updated!) };
}
