/**
 * Consultas somente-leitura autenticadas para o Assistente / Work.
 * Nunca inventa registros: devolve o que existir no PostgreSQL da organização ativa.
 */
import type { SessionAccount } from "@verasjuris/auth";
import {
  crmClients,
  deadlines,
  documents,
  legalMatters,
  tasks,
  type AppDatabase,
} from "@verasjuris/database";
import { and, desc, eq, ne } from "drizzle-orm";

function hasPermission(
  account: SessionAccount,
  organizationId: string,
  permission: string,
): boolean {
  const membership = account.memberships.find((m) => m.organizationId === organizationId);
  return Boolean(membership?.permissions.includes(permission));
}

export async function listOrgMatters(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  limit = 15,
) {
  if (!hasPermission(account, organizationId, "matter.read")) {
    return {
      allowed: false as const,
      items: [] as Array<Record<string, unknown>>,
      note: "Sem permissão matter.read.",
    };
  }
  const rows = await db.query.legalMatters.findMany({
    where: and(
      eq(legalMatters.organizationId, organizationId),
      ne(legalMatters.status, "archived"),
    ),
    orderBy: [desc(legalMatters.updatedAt)],
    limit,
  });
  return {
    allowed: true as const,
    items: rows.map((row) => ({
      id: row.id,
      title: row.title,
      internalReference: row.internalReference,
      status: row.status,
      priority: row.priority,
      openedAt: row.openedAt?.toISOString?.() ?? null,
    })),
    note: rows.length === 0 ? "Nenhum caso encontrado na organização." : undefined,
  };
}

export async function listOrgDocuments(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  limit = 15,
) {
  if (!hasPermission(account, organizationId, "document.read")) {
    return {
      allowed: false as const,
      items: [] as Array<Record<string, unknown>>,
      note: "Sem permissão document.read.",
    };
  }
  const rows = await db.query.documents.findMany({
    where: and(eq(documents.organizationId, organizationId), eq(documents.status, "active")),
    orderBy: [desc(documents.updatedAt)],
    limit,
  });
  return {
    allowed: true as const,
    items: rows.map((row) => ({
      id: row.id,
      title: row.title,
      kind: row.documentKind,
      status: row.status,
      confidentiality: row.confidentialityLevel,
    })),
    note:
      rows.length === 0
        ? "Nenhum documento ativo. Conteúdo de arquivo não é lido automaticamente (sem OCR nesta ferramenta)."
        : "Metadados apenas — conteúdo binário/OCR não incluso.",
  };
}

export async function listOrgDeadlines(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  limit = 15,
) {
  if (!hasPermission(account, organizationId, "deadline.read")) {
    return {
      allowed: false as const,
      items: [] as Array<Record<string, unknown>>,
      note: "Sem permissão deadline.read.",
    };
  }
  const rows = await db.query.deadlines.findMany({
    where: eq(deadlines.organizationId, organizationId),
    orderBy: [desc(deadlines.updatedAt)],
    limit,
  });
  return {
    allowed: true as const,
    items: rows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      confirmedDueAt: row.confirmedDueAt?.toISOString?.() ?? null,
      calculatedDueAt: row.calculatedDueAt?.toISOString?.() ?? null,
    })),
    note: rows.length === 0 ? "Nenhum prazo cadastrado." : undefined,
  };
}

export async function listOrgTasks(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  limit = 15,
) {
  if (!hasPermission(account, organizationId, "task.read")) {
    return {
      allowed: false as const,
      items: [] as Array<Record<string, unknown>>,
      note: "Sem permissão task.read.",
    };
  }
  const rows = await db.query.tasks.findMany({
    where: eq(tasks.organizationId, organizationId),
    orderBy: [desc(tasks.updatedAt)],
    limit,
  });
  return {
    allowed: true as const,
    items: rows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      priority: row.priority,
      dueAt: row.dueAt?.toISOString?.() ?? null,
    })),
    note: rows.length === 0 ? "Nenhuma tarefa encontrada." : undefined,
  };
}

export async function listOrgCrmClients(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  limit = 15,
) {
  if (!hasPermission(account, organizationId, "crm.read")) {
    return {
      allowed: false as const,
      items: [] as Array<Record<string, unknown>>,
      note: "Sem permissão crm.read.",
    };
  }
  const rows = await db.query.crmClients.findMany({
    where: and(eq(crmClients.organizationId, organizationId), eq(crmClients.status, "active")),
    orderBy: [desc(crmClients.updatedAt)],
    limit,
  });
  return {
    allowed: true as const,
    items: rows.map((row) => ({
      id: row.id,
      displayName: row.tradeName || row.legalName || row.socialName || row.fullName || "Sem nome",
      personType: row.personType,
      status: row.status,
      email: row.email ? "[presente]" : null,
      phone: row.phone ? "[presente]" : null,
    })),
    note:
      rows.length === 0
        ? "Nenhum cliente CRM ativo."
        : "Dados sensíveis mascarados; use o módulo CRM para detalhes completos.",
  };
}

/** Monta bloco de contexto verificado a partir da intenção do usuário. */
export async function gatherVerifiedOrgContext(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  userMessage: string,
): Promise<string> {
  const lower = userMessage.toLowerCase();
  const chunks: string[] = [];
  const wantsMatters = /\b(caso|processo|matter|pasta|cliente jurídico)\b/i.test(lower);
  const wantsDocs = /\b(documento|dossiê|dossie|arquivo|petição|peticao)\b/i.test(lower);
  const wantsDeadlines = /\b(prazo|deadline|vencimento)\b/i.test(lower);
  const wantsTasks = /\b(tarefa|task|atividade|to-?do)\b/i.test(lower);
  const wantsCrm = /\b(crm|cliente|lead|contato)\b/i.test(lower);
  const wantsAny =
    wantsMatters ||
    wantsDocs ||
    wantsDeadlines ||
    wantsTasks ||
    wantsCrm ||
    /\b(organiz|resumo)\b/i.test(lower);

  if (!wantsAny) return "";

  if (wantsMatters || wantsAny) {
    const matters = await listOrgMatters(db, account, organizationId, 8);
    chunks.push(`Casos: ${JSON.stringify(matters)}`);
  }
  if (wantsDocs) {
    const docs = await listOrgDocuments(db, account, organizationId, 8);
    chunks.push(`Documentos: ${JSON.stringify(docs)}`);
  }
  if (wantsDeadlines) {
    const d = await listOrgDeadlines(db, account, organizationId, 8);
    chunks.push(`Prazos: ${JSON.stringify(d)}`);
  }
  if (wantsTasks || wantsAny) {
    const t = await listOrgTasks(db, account, organizationId, 8);
    chunks.push(`Tarefas: ${JSON.stringify(t)}`);
  }
  if (wantsCrm) {
    const c = await listOrgCrmClients(db, account, organizationId, 8);
    chunks.push(`CRM: ${JSON.stringify(c)}`);
  }

  return [
    "DADOS VERIFICADOS DA ORGANIZAÇÃO (fonte: PostgreSQL; não inventar além disto):",
    ...chunks,
  ].join("\n");
}
