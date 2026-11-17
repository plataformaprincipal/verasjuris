/**
 * Executor interno do Juris One Work.
 * Usa OpenAI via AIGateway para passos internos autorizados.
 * Nunca dispara protocolo, pagamento, e-mail externo ou exclusão.
 */
import type { AIGateway } from "@verasjuris/ai";
import type { SessionAccount } from "@verasjuris/auth";
import { authorizeAccess } from "@verasjuris/auth";
import { documents, type AppDatabase } from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, desc, eq } from "drizzle-orm";
import { accessOf } from "../ai/shared.js";

export const WORK_FEATURE = "juris_one.work" as const;
export const WORK_PROMPT_VERSION = "juris-work-v1" as const;

export const SAFE_INTERNAL_TOOLS = [
  "organize_dossier",
  "extract_data",
  "generate_report",
  "compare_versions",
  "prepare_draft",
  "create_checklist",
  "build_timeline",
  "identify_missing_documents",
] as const;

export const EXTERNAL_ACTION_TOOLS = [
  "send_external_message",
  "protocol_petition",
  "sign_contract",
  "execute_payment",
  "delete_records",
] as const;

export type SafeInternalTool = (typeof SAFE_INTERNAL_TOOLS)[number];
export type ExternalActionTool = (typeof EXTERNAL_ACTION_TOOLS)[number];
export type JurisWorkToolName = SafeInternalTool | ExternalActionTool;

const TOOL_INSTRUCTIONS: Record<SafeInternalTool, string> = {
  identify_missing_documents:
    "Com base no objetivo e na lista de documentos disponíveis (metadados), liste lacunas documentais plausíveis. Não invente arquivos inexistentes.",
  organize_dossier:
    "Proponha uma organização de dossiê (pastas/etapas) a partir do objetivo e dos documentos listados. Não altere o armazenamento.",
  extract_data:
    "Extraia campos estruturados candidatos a partir do objetivo e dos títulos/metadados disponíveis. Indique incerteza; não invente conteúdo de arquivos não lidos.",
  generate_report:
    "Gere um relatório interno assistivo em markdown curto. Marque premissas e o que exige revisão humana.",
  compare_versions:
    "Compare versões apenas se houver metadados suficientes; caso contrário, explique o que falta para comparar com segurança.",
  prepare_draft:
    "Prepare uma minuta assistida (rascunho). Deixe claro que não é peça protocolável e exige revisão de advogado responsável.",
  create_checklist:
    "Monte um checklist operacional interno alinhado ao objetivo, sem ações externas.",
  build_timeline:
    "Monte uma linha do tempo candidata a partir do objetivo e metadados. Sem datas inventadas como fato.",
};

function isSafeTool(name: string): name is SafeInternalTool {
  return (SAFE_INTERNAL_TOOLS as readonly string[]).includes(name);
}

export function isExternalTool(name: string): name is ExternalActionTool {
  return (EXTERNAL_ACTION_TOOLS as readonly string[]).includes(name);
}

async function loadOrgDocumentSummaries(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
): Promise<{
  allowed: boolean;
  items: Array<{ id: string; title: string; kind: string; status: string }>;
  note: string;
}> {
  const decision = authorizeAccess({
    membership: accessOf(account, organizationId),
    required: "document.read",
  });
  if (!decision.ok) {
    return {
      allowed: false,
      items: [],
      note: "Sem permissão document.read — análise documental limitada ao objetivo textual.",
    };
  }
  const rows = await db.query.documents.findMany({
    where: and(eq(documents.organizationId, organizationId), eq(documents.status, "active")),
    orderBy: [desc(documents.updatedAt)],
    limit: 25,
  });
  return {
    allowed: true,
    items: rows.map((row) => ({
      id: row.id,
      title: row.title,
      kind: row.documentKind,
      status: row.status,
    })),
    note:
      rows.length === 0
        ? "Nenhum documento ativo na organização; o agente não inventará conteúdo documental."
        : `Metadados de ${rows.length} documento(s) ativos (sem OCR automático nesta etapa).`,
  };
}

function requireConfiguredGateway(gateway: AIGateway | undefined | null): AIGateway {
  if (!gateway) {
    throw new AppError(
      "AI_PROVIDER_NOT_CONFIGURED",
      "O Juris One Work exige inteligência artificial configurada. Nenhuma etapa foi simulada.",
    );
  }
  return gateway;
}

export async function assertWorkGatewayReady(gateway: AIGateway | undefined | null): Promise<{
  gateway: AIGateway;
  provider: string;
}> {
  const g = requireConfiguredGateway(gateway);
  const description = g.describe();
  const health = await g.healthCheck();
  if (description.status === "not_configured" || health.status === "not_configured") {
    throw new AppError(
      "AI_PROVIDER_NOT_CONFIGURED",
      "O Juris One Work exige inteligência artificial configurada. Nenhuma etapa foi simulada.",
    );
  }
  if (health.status === "unavailable") {
    throw new AppError(
      "AI_PROVIDER_UNAVAILABLE",
      "O provedor de inteligência artificial está indisponível. Tente novamente mais tarde.",
    );
  }
  return { gateway: g, provider: description.provider ?? "unknown" };
}

export type WorkStepExecutionResult = {
  status: "ai_assisted_internal";
  toolName: string;
  content: string;
  provider: string;
  model: string;
  feature: string;
  humanReviewRequired: true;
  documentsConsidered: number;
  documentAccess: boolean;
  usage: {
    inputTokens: number;
    outputTokens: number;
    estimatedCostMicros: number;
  };
  disclaimer: string;
};

export async function executeInternalWorkStep(input: {
  db: AppDatabase;
  gateway: AIGateway | undefined | null;
  account: SessionAccount;
  organizationId: string;
  objective: string;
  toolName: string;
  stepTitle: string;
}): Promise<WorkStepExecutionResult> {
  if (isExternalTool(input.toolName)) {
    throw new AppError(
      "NOT_CONFIGURED",
      "Ações externas permanecem bloqueadas até conectores homologados.",
    );
  }
  if (!isSafeTool(input.toolName)) {
    throw new AppError("VALIDATION_ERROR", `Ferramenta Work desconhecida: ${input.toolName}.`);
  }

  const { gateway } = await assertWorkGatewayReady(input.gateway);
  const docs = await loadOrgDocumentSummaries(input.db, input.account, input.organizationId);
  const toolGuide = TOOL_INSTRUCTIONS[input.toolName];

  const result = await gateway.generateText({
    userId: input.account.user.id,
    organizationId: input.organizationId,
    feature: WORK_FEATURE,
    promptVersion: WORK_PROMPT_VERSION,
    maxOutputTokens: 1_200,
    temperature: 0.3,
    retrySafe: false,
    instructions: [
      "Você é o agente Juris One Work do VerasJuris.",
      "Produza apenas saída assistiva interna para revisão humana.",
      "Não invente jurisprudência, números de processo, protocolos ou fatos documentais não fornecidos.",
      "Não execute nem sugira como concluídas ações externas (protocolar, pagar, enviar e-mail, assinar, excluir).",
      "Responda em português do Brasil, em markdown objetivo.",
      toolGuide,
    ].join(" "),
    input: [
      `Etapa: ${input.stepTitle}`,
      `Ferramenta: ${input.toolName}`,
      `Objetivo da tarefa: ${input.objective.slice(0, 3_500)}`,
      `Acesso a documentos: ${docs.allowed ? "autorizado" : "negado"}`,
      `Nota documental: ${docs.note}`,
      `Documentos (metadados): ${JSON.stringify(docs.items)}`,
    ].join("\n"),
  });

  return {
    status: "ai_assisted_internal",
    toolName: input.toolName,
    content: result.data,
    provider: result.provider,
    model: result.model,
    feature: result.feature,
    humanReviewRequired: true,
    documentsConsidered: docs.items.length,
    documentAccess: docs.allowed,
    usage: {
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      estimatedCostMicros: result.usage.estimatedCostMicros,
    },
    disclaimer:
      "Saída assistiva gerada por IA. Não constitui ato jurídico, protocolo, consulta oficial nem autorização de ação externa.",
  };
}

export type PlannedWorkStep = {
  toolName: JurisWorkToolName;
  title: string;
  requiresApproval: boolean;
};

/** Plano determinístico local (sem IA) — usado quando o gateway está indisponível no create. */
export function buildLocalWorkPlan(objective: string): PlannedWorkStep[] {
  const lower = objective.toLowerCase();
  const steps: PlannedWorkStep[] = [
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

  if (/\b(minuta|petição|peticao|contrato|checklist)\b/i.test(lower)) {
    steps.push({
      toolName: "prepare_draft",
      title: "Preparar minuta assistida (revisão humana obrigatória)",
      requiresApproval: true,
    });
  }
  if (/\b(linha do tempo|timeline|cronologia)\b/i.test(lower)) {
    steps.push({
      toolName: "build_timeline",
      title: "Montar linha do tempo candidata",
      requiresApproval: false,
    });
  }
  if (/\b(enviar|protocolar|assinar|pagar|excluir)\b/i.test(lower)) {
    steps.push({
      toolName: "send_external_message",
      title: "Ação externa bloqueada até homologação e aprovação explícita",
      requiresApproval: true,
    });
  }

  return steps.slice(0, 12);
}

/**
 * Tenta refinar o plano com IA. Em falha ou IA off, usa plano local (sem inventar execução).
 * O create da tarefa não exige IA; a execução dos passos internos, sim.
 */
export async function planWorkSteps(input: {
  gateway: AIGateway | undefined | null;
  account: SessionAccount;
  organizationId: string;
  objective: string;
}): Promise<{ steps: PlannedWorkStep[]; source: "ai" | "local"; note: string }> {
  const local = buildLocalWorkPlan(input.objective);
  if (!input.gateway) {
    return {
      steps: local,
      source: "local",
      note: "Plano local. A execução dos passos internos exigirá IA configurada.",
    };
  }

  try {
    const { gateway } = await assertWorkGatewayReady(input.gateway);
    const allowed = SAFE_INTERNAL_TOOLS.join(", ");
    const result = await gateway.generateText({
      userId: input.account.user.id,
      organizationId: input.organizationId,
      feature: WORK_FEATURE,
      promptVersion: WORK_PROMPT_VERSION,
      maxOutputTokens: 600,
      temperature: 0.2,
      retrySafe: false,
      instructions: [
        "Planeje etapas internas do Juris One Work.",
        `Use apenas ferramentas desta lista: ${allowed}.`,
        'Responda SOMENTE com JSON: {"steps":[{"toolName":"...","title":"...","requiresApproval":false}]}',
        "Máximo 8 passos. Não inclua ações externas.",
        "requiresApproval=true apenas para prepare_draft.",
      ].join(" "),
      input: input.objective.slice(0, 3_500),
    });

    const match = result.data.match(/\{[\s\S]*\}/);
    if (!match) {
      return {
        steps: local,
        source: "local",
        note: "Plano local (IA não retornou JSON válido).",
      };
    }
    const parsed = JSON.parse(match[0]) as {
      steps?: Array<{ toolName?: string; title?: string; requiresApproval?: boolean }>;
    };
    const steps: PlannedWorkStep[] = (parsed.steps ?? [])
      .filter((step) => step.toolName && isSafeTool(step.toolName))
      .slice(0, 8)
      .map((step) => ({
        toolName: step.toolName as SafeInternalTool,
        title: String(step.title ?? step.toolName).slice(0, 180),
        requiresApproval: Boolean(step.requiresApproval) || step.toolName === "prepare_draft",
      }));

    if (steps.length === 0) {
      return {
        steps: local,
        source: "local",
        note: "Plano local (IA não listou ferramentas válidas).",
      };
    }

    // Se o objetivo pede ação externa, anexa passo bloqueado (aprovação + NOT_CONFIGURED).
    if (/\b(enviar|protocolar|assinar|pagar|excluir)\b/i.test(input.objective)) {
      steps.push({
        toolName: "send_external_message",
        title: "Ação externa bloqueada até homologação e aprovação explícita",
        requiresApproval: true,
      });
    }

    return {
      steps: steps.slice(0, 12),
      source: "ai",
      note: "Plano gerado com assistência de IA. Ferramentas externas permanecem bloqueadas.",
    };
  } catch {
    return {
      steps: local,
      source: "local",
      note: "Plano local (IA indisponível no planejamento). A execução exigirá IA configurada.",
    };
  }
}
