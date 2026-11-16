import { getFeature, PUBLIC_CATALOG, type CatalogFeature } from "../public-catalog";
import type {
  CommercialSheet,
  CostBand,
  DemoClassification,
  DemoKind,
  ToolDemoMeta,
} from "./types";

const AUTH_HREF: Record<string, string> = {
  "processos-judiciais": "/app/casos",
  "processos-administrativos": "/app/casos",
  casos: "/app/casos",
  prazos: "/app/prazos",
  agenda: "/app/agenda",
  tarefas: "/app/tarefas",
  relatorios: "/app/control",
  clientes: "/app/crm",
  contatos: "/app/crm",
  atendimentos: "/app/atendimentos",
  "potenciais-clientes": "/app/pipeline",
  "atendimento-online": "/app/advogado-online",
  "portal-cliente": "/app/comunicacao",
  documentos: "/app/documentos",
  dossies: "/app/documentos",
  contratos: "/app/contratos",
  "calculo-previdenciario": "/app/previdenciario",
  "protocolo-inss": "/app/previdenciario",
  "marketplace-juridico": "/app/marketplace",
  "perfil-profissional": "/app/marketplace/perfil",
  honorarios: "/app/financeiro",
  "cobrancas-asaas": "/app/financeiro",
  organizacoes: "/app/organizacao",
  equipes: "/app/participantes",
  permissoes: "/app/organizacao",
  "fluxos-trabalho": "/app/tarefas",
  lembretes: "/app/agenda",
  "assistente-ia": "/app/ia",
  "analise-documentos": "/app/ia",
  "peticoes-assistidas": "/app/documentos-juridicos",
  "integracao-tribunais": "/app/integracoes",
  "integracao-pagamentos": "/app/financeiro",
  "integracao-email": "/app/comunicacao",
  "integracao-agenda": "/app/agenda",
  "integracao-ia": "/app/ia",
};

const KIND_BY_SLUG: Record<string, DemoKind | null> = {
  "processos-judiciais": "processos",
  "processos-administrativos": "processos",
  casos: "processos",
  prazos: "prazos",
  agenda: "agenda",
  tarefas: "tarefas",
  relatorios: "relatorios",
  clientes: "clientes",
  contatos: "clientes",
  atendimentos: "clientes",
  "potenciais-clientes": "crm",
  "atendimento-online": "crm",
  "portal-cliente": null,
  documentos: "documentos",
  dossies: "documentos",
  contratos: "contratos",
  "calculo-previdenciario": "previdenciario",
  "protocolo-inss": "previdenciario",
  "marketplace-juridico": "marketplace",
  "perfil-profissional": "marketplace",
  honorarios: "financeiro",
  "cobrancas-asaas": "financeiro",
  organizacoes: "relatorios",
  equipes: "relatorios",
  permissoes: null,
  "fluxos-trabalho": "automacao",
  lembretes: "agenda",
  "assistente-ia": "ia",
  "analise-documentos": "ia",
  "peticoes-assistidas": "ia",
  "integracao-tribunais": "integracoes",
  "integracao-pagamentos": "integracoes",
  "integracao-email": "integracoes",
  "integracao-agenda": "integracoes",
  "integracao-ia": "integracoes",
};

const GUIDED_KINDS = new Set<DemoKind>(["ia", "integracoes", "previdenciario"]);

function costBandFor(feature: CatalogFeature): CostBand {
  if (feature.category === "inteligencia_artificial" || feature.category === "integracoes") {
    return "variavel";
  }
  if (feature.category === "marketplace" || feature.slug.includes("cobrancas")) {
    return "transacional";
  }
  if (feature.availability === "planned" || feature.availability === "in_development") {
    return "a_validar";
  }
  return "previsivel";
}

function publicClass(kind: DemoKind | null, feature: CatalogFeature): DemoClassification | null {
  if (!kind) return null;
  if (GUIDED_KINDS.has(kind)) return "C";
  if (feature.availability === "planned") return "C";
  if (kind === "marketplace" || kind === "financeiro" || kind === "automacao") return "B";
  return "A";
}

export function getToolDemoMeta(slug: string): ToolDemoMeta | null {
  const feature = getFeature(slug);
  if (!feature) return null;
  const kind = KIND_BY_SLUG[slug] ?? null;
  const authHref = AUTH_HREF[slug] ?? null;
  return {
    slug,
    kind,
    publicDemo: publicClass(kind, feature),
    authenticated: authHref ? "D" : null,
    authenticatedHref: authHref,
    guidedOnly: kind ? GUIDED_KINDS.has(kind) : true,
  };
}

export function listDemoKinds(): DemoKind[] {
  return [
    "processos",
    "clientes",
    "agenda",
    "prazos",
    "tarefas",
    "documentos",
    "contratos",
    "crm",
    "financeiro",
    "relatorios",
    "automacao",
    "previdenciario",
    "marketplace",
    "ia",
    "integracoes",
  ];
}

export function getCommercialSheet(slug: string): CommercialSheet | null {
  const feature = getFeature(slug);
  const meta = getToolDemoMeta(slug);
  if (!feature || !meta) return null;
  const band = costBandFor(feature);
  const demoOffered = meta.kind
    ? meta.guidedOnly
      ? "Prévia guiada com cenários preparados (sem integração externa ativa)."
      : "Demonstração interativa local com dados fictícios e reinício sob demanda."
    : "Somente descrição e acesso ao módulo autenticado, quando disponível.";

  return {
    problem: feature.problem,
    audience: feature.audience,
    primaryBenefit: feature.benefits[0] ?? feature.summary,
    demoOffered,
    realFeatures: feature.capabilities,
    technicalLimitations: feature.limitations,
    integrationDeps:
      feature.category === "integracoes" || feature.category === "inteligencia_artificial"
        ? ["Provedor externo configurado", "Credenciais de ambiente", "Homologação"]
        : feature.slug.includes("asaas") || feature.slug.includes("cobrancas")
          ? ["Provedor de pagamento (Asaas)", "Webhooks", "Homologação sandbox"]
          : [],
    estimatedOpsCost: band,
    variableCosts:
      band === "variavel"
        ? ["Uso de modelo/API", "Armazenamento", "Processamento"]
        : band === "transacional"
          ? ["Taxas de pagamento", "Conciliação"]
          : [],
    supportNeed:
      band === "previsivel"
        ? "Suporte padrão de onboarding e documentação."
        : "Suporte especializado e monitoramento de custos variáveis.",
    compliance: [
      "LGPD — demonstração pública não usa dados reais",
      "Operações reais exigem conta e permissões",
      ...(feature.category === "marketplace" ? ["Validação ética/OAB antes de ativação comercial"] : []),
    ],
    suggestedModality:
      band === "transacional"
        ? "Módulo + taxas/comissões a validar"
        : band === "variavel"
          ? "Assinatura + cotas de uso"
          : "Incluso em planos de gestão (sujeito a validação comercial)",
    eligiblePlan: null,
    cta: {
      label: meta.authenticatedHref ? "Acessar módulo" : "Criar conta",
      href: meta.authenticatedHref
        ? `/entrar?next=${encodeURIComponent(meta.authenticatedHref)}`
        : "/cadastro",
    },
    conversionSignals: [
      "abertura_demo",
      "interacao_demo",
      "cta_cadastro",
      "cta_acesso_modulo",
    ],
  };
}

export function assertCatalogCoverage(): string[] {
  return PUBLIC_CATALOG.filter((f) => !(f.slug in KIND_BY_SLUG)).map((f) => f.slug);
}
