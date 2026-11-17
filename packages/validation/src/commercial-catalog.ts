/**
 * Catálogo comercial canônico VerasJuris — versão 2026-09.
 * Fonte operacional: prompt mestre (set/2026). PDFs oficiais presentes em Downloads
 * mas texto embutido não parseável neste ambiente (image/compressed).
 *
 * Preços em centavos BRL. Compra live = Fase 2+ (homologationStatus ≠ purchase-ready).
 */
import { z } from "zod";

export const COMMERCIAL_VERSION = "2026-09" as const;

export const COMMERCIAL_TYPES = [
  "plan",
  "addon",
  "ai_credit_pack",
  "ai_module",
  "service",
  "api_package",
  "white_label",
  "enterprise",
  "marketplace_fee",
] as const;

export const HOMOLOGATION_STATUSES = ["catalog_only", "partial", "not_implemented"] as const;

export const PRICE_MODES = ["fixed", "starting_at", "proposal"] as const;

export const COMMERCIAL_BILLING_INTERVALS = [
  "monthly",
  "yearly",
  "one_time",
  "per_session",
  "per_cycle",
] as const;

/** Maps to monetization_product_type (incl. additive enum values). */
export const CATALOG_PRODUCT_TYPES = [
  "subscription",
  "one_time_service",
  "ai_credit_pack",
  "api_package",
  "license",
  "white_label_setup",
  "technology_fee",
  "addon",
  "ai_module",
  "other",
] as const;

export const MARKETPLACE_COMMISSION_RULES = [
  { category: "digital_courses", bps: 1500, note: "Cursos e produtos digitais: 15%" },
  { category: "non_legal_services", bps: 1000, note: "Serviços não jurídicos: 10%" },
  { category: "legal_fees", bps: 0, note: "Honorários advocatícios: 0% (OAB-safe)" },
] as const;

export const ANNUAL_DISCOUNT_BPS = 1500; // 15%
export const LAUNCH_DISCOUNT_BPS_CAP = 2000; // até 20% — não acumular automaticamente

export type CommercialType = (typeof COMMERCIAL_TYPES)[number];
export type HomologationStatus = (typeof HOMOLOGATION_STATUSES)[number];
export type PriceMode = (typeof PRICE_MODES)[number];
export type CommercialBillingInterval = (typeof COMMERCIAL_BILLING_INTERVALS)[number];
export type CatalogProductType = (typeof CATALOG_PRODUCT_TYPES)[number];

export type CommercialEntitlementDef = {
  featureKey: string;
  limitType: "boolean" | "count" | "amount_cents" | "unlimited" | "storage" | "rate" | "credit";
  limitValue?: number | null;
};

export type CommercialSkuDefinition = {
  sku: string;
  name: string;
  description: string;
  commercialType: CommercialType;
  productType: CatalogProductType;
  planTier?: "individual" | "professional" | "office" | "business" | "enterprise" | "white_label";
  planTarget?: "user" | "professional" | "organization" | "enterprise" | "partner";
  /** Centavos; 0 + priceMode proposal = sob consulta. */
  amountCents: number;
  currency: "BRL";
  interval: CommercialBillingInterval | null;
  priceMode: PriceMode;
  requiresProposal: boolean;
  franchises?: Record<string, number | string | boolean>;
  entitlements?: CommercialEntitlementDef[];
  placementPaths: string[];
  dependencies?: string[];
  cancelPolicyKey: string;
  refundPolicyKey: string;
  homologationStatus: HomologationStatus;
  public: boolean;
  creditsGranted?: number;
  sortOrder: number;
};

const brl = (reais: number) => Math.round(reais * 100);

const POLICY = {
  cancelSubscription: "cancel_end_of_period_v1",
  refundCredits: "credit_pack_refund_12m_v1",
  refundService: "service_milestone_refund_v1",
  proposalOnly: "proposal_no_self_serve_v1",
  addonCancel: "addon_cancel_end_of_period_v1",
} as const;

function plan(
  partial: Omit<
    CommercialSkuDefinition,
    | "commercialType"
    | "productType"
    | "currency"
    | "cancelPolicyKey"
    | "refundPolicyKey"
    | "homologationStatus"
    | "public"
    | "requiresProposal"
  > &
    Partial<
      Pick<
        CommercialSkuDefinition,
        "homologationStatus" | "public" | "cancelPolicyKey" | "refundPolicyKey" | "requiresProposal"
      >
    >,
): CommercialSkuDefinition {
  const { requiresProposal, homologationStatus, public: isPublic, ...rest } = partial;
  return {
    commercialType: "plan",
    productType: "subscription",
    currency: "BRL",
    cancelPolicyKey: POLICY.cancelSubscription,
    refundPolicyKey: POLICY.cancelSubscription,
    homologationStatus: homologationStatus ?? "catalog_only",
    public: isPublic ?? true,
    requiresProposal: requiresProposal ?? false,
    ...rest,
  };
}

/** Legacy seed keys superseded by PLAN_* — deactivated on sync. */
export const LEGACY_PLAN_KEYS = [
  "plan_individual",
  "plan_professional",
  "plan_office",
  "plan_business",
  "plan_enterprise",
  "plan_white_label",
] as const;

export const COMMERCIAL_CATALOG: CommercialSkuDefinition[] = [
  /* ─── Planos gratuitos ─── */
  plan({
    sku: "PLAN_CIDADAO_LIVRE",
    name: "Cidadão Livre",
    description:
      "Conta, perfil, documentos, triagem, chat limitado, marketplace, alertas básicos e ferramentas gratuitas.",
    planTier: "individual",
    planTarget: "user",
    amountCents: 0,
    interval: "monthly",
    priceMode: "fixed",
    franchises: {
      chatLimited: true,
      marketplaceBrowse: true,
      basicAlerts: true,
    },
    entitlements: [
      { featureKey: "juris_one.public_chat", limitType: "boolean", limitValue: 1 },
      { featureKey: "marketplace.browse", limitType: "boolean", limitValue: 1 },
    ],
    placementPaths: ["/", "/planos", "/app/perfil"],
    sortOrder: 10,
    homologationStatus: "partial",
  }),
  plan({
    sku: "PLAN_PROFISSIONAL_LIVRE",
    name: "Profissional Livre",
    description:
      "1 usuário, até 15 clientes, 10 casos, 5 processos monitorados, 2 GB, 30 ops leves de IA/mês (orçamento), agenda e perfil profissional.",
    planTier: "professional",
    planTarget: "professional",
    amountCents: 0,
    interval: "monthly",
    priceMode: "fixed",
    franchises: {
      users: 1,
      activeClients: 15,
      cases: 10,
      monitoredProcesses: 5,
      storageGb: 2,
      lightAiOpsMonthly: 30,
      ownTemplates: 5,
    },
    entitlements: [
      { featureKey: "seats", limitType: "count", limitValue: 1 },
      { featureKey: "clients.active", limitType: "count", limitValue: 15 },
      { featureKey: "matters.active", limitType: "count", limitValue: 10 },
      { featureKey: "processes.monitored", limitType: "count", limitValue: 5 },
      { featureKey: "storage.gb", limitType: "storage", limitValue: 2 },
      { featureKey: "ai.light_ops_monthly", limitType: "credit", limitValue: 30 },
    ],
    placementPaths: ["/", "/planos", "/app/perfil", "/app/juris-one"],
    sortOrder: 20,
    homologationStatus: "partial",
  }),

  /* ─── Planos pagos ─── */
  plan({
    sku: "PLAN_CIDADAO_PLUS",
    name: "Cidadão Plus",
    description: "10 processos, 5 GB, 500 créditos mensais.",
    planTier: "individual",
    planTarget: "user",
    amountCents: brl(29.9),
    interval: "monthly",
    priceMode: "fixed",
    franchises: { processes: 10, storageGb: 5, creditsMonthly: 500 },
    entitlements: [
      { featureKey: "processes.active", limitType: "count", limitValue: 10 },
      { featureKey: "storage.gb", limitType: "storage", limitValue: 5 },
      { featureKey: "ai.credits_monthly", limitType: "credit", limitValue: 500 },
    ],
    placementPaths: ["/", "/planos", "/app/perfil"],
    sortOrder: 30,
  }),
  plan({
    sku: "PLAN_ESTUDANTE",
    name: "Estudante",
    description: "Tutor de estudos, simulados, biblioteca, 5 GB, 800 créditos mensais.",
    planTier: "individual",
    planTarget: "user",
    amountCents: brl(39.9),
    interval: "monthly",
    priceMode: "fixed",
    franchises: {
      studyTutor: true,
      simulations: true,
      library: true,
      storageGb: 5,
      creditsMonthly: 800,
    },
    entitlements: [
      { featureKey: "education.tutor", limitType: "boolean", limitValue: 1 },
      { featureKey: "storage.gb", limitType: "storage", limitValue: 5 },
      { featureKey: "ai.credits_monthly", limitType: "credit", limitValue: 800 },
    ],
    placementPaths: ["/", "/planos", "/educacao", "/app/perfil"],
    sortOrder: 40,
  }),
  plan({
    sku: "PLAN_PRO_INDIVIDUAL",
    name: "Profissional Individual",
    description: "1 usuário, 200 processos ativos, 100 monitorados, 20 GB, 1.500 créditos mensais.",
    planTier: "professional",
    planTarget: "professional",
    amountCents: brl(129.9),
    interval: "monthly",
    priceMode: "fixed",
    franchises: {
      users: 1,
      activeProcesses: 200,
      monitoredProcesses: 100,
      storageGb: 20,
      creditsMonthly: 1500,
    },
    entitlements: [
      { featureKey: "seats", limitType: "count", limitValue: 1 },
      { featureKey: "processes.active", limitType: "count", limitValue: 200 },
      { featureKey: "processes.monitored", limitType: "count", limitValue: 100 },
      { featureKey: "storage.gb", limitType: "storage", limitValue: 20 },
      { featureKey: "ai.credits_monthly", limitType: "credit", limitValue: 1500 },
    ],
    placementPaths: ["/", "/planos", "/app/perfil", "/app/juris-one"],
    sortOrder: 50,
  }),
  plan({
    sku: "PLAN_ESSENCIAL",
    name: "Escritório Essencial",
    description: "5 usuários, 500 processos, 300 monitorados, 50 GB, 5.000 créditos mensais.",
    planTier: "office",
    planTarget: "organization",
    amountCents: brl(349.9),
    interval: "monthly",
    priceMode: "fixed",
    franchises: {
      users: 5,
      processes: 500,
      monitoredProcesses: 300,
      storageGb: 50,
      creditsMonthly: 5000,
    },
    entitlements: [
      { featureKey: "seats", limitType: "count", limitValue: 5 },
      { featureKey: "processes.active", limitType: "count", limitValue: 500 },
      { featureKey: "processes.monitored", limitType: "count", limitValue: 300 },
      { featureKey: "storage.gb", limitType: "storage", limitValue: 50 },
      { featureKey: "ai.credits_monthly", limitType: "credit", limitValue: 5000 },
    ],
    placementPaths: ["/", "/planos", "/app/financeiro/planos"],
    sortOrder: 60,
  }),
  plan({
    sku: "PLAN_PROFISSIONAL",
    name: "Escritório Profissional",
    description:
      "15 usuários, 2.000 processos, 1.000 monitorados, 250 GB, 15.000 créditos mensais.",
    planTier: "office",
    planTarget: "organization",
    amountCents: brl(749.9),
    interval: "monthly",
    priceMode: "fixed",
    franchises: {
      users: 15,
      processes: 2000,
      monitoredProcesses: 1000,
      storageGb: 250,
      creditsMonthly: 15000,
    },
    entitlements: [
      { featureKey: "seats", limitType: "count", limitValue: 15 },
      { featureKey: "processes.active", limitType: "count", limitValue: 2000 },
      { featureKey: "processes.monitored", limitType: "count", limitValue: 1000 },
      { featureKey: "storage.gb", limitType: "storage", limitValue: 250 },
      { featureKey: "ai.credits_monthly", limitType: "credit", limitValue: 15000 },
    ],
    placementPaths: ["/", "/planos", "/app/financeiro/planos"],
    sortOrder: 70,
  }),
  plan({
    sku: "PLAN_AVANCADO",
    name: "Escritório Avançado",
    description: "40 usuários, 6.000 processos, 3.000 monitorados, 1 TB, 50.000 créditos mensais.",
    planTier: "office",
    planTarget: "organization",
    amountCents: brl(1499.9),
    interval: "monthly",
    priceMode: "fixed",
    franchises: {
      users: 40,
      processes: 6000,
      monitoredProcesses: 3000,
      storageGb: 1024,
      creditsMonthly: 50000,
    },
    entitlements: [
      { featureKey: "seats", limitType: "count", limitValue: 40 },
      { featureKey: "processes.active", limitType: "count", limitValue: 6000 },
      { featureKey: "processes.monitored", limitType: "count", limitValue: 3000 },
      { featureKey: "storage.gb", limitType: "storage", limitValue: 1024 },
      { featureKey: "ai.credits_monthly", limitType: "credit", limitValue: 50000 },
    ],
    placementPaths: ["/", "/planos", "/app/financeiro/planos"],
    sortOrder: 80,
  }),
  plan({
    sku: "PLAN_EMPRESARIAL",
    name: "Jurídico Empresarial",
    description:
      "Configuração por proposta. Referência inicial: 20 usuários, contratos, demandas, fornecedores, 1 TB, implantação específica.",
    planTier: "business",
    planTarget: "organization",
    amountCents: brl(2490),
    interval: "monthly",
    priceMode: "starting_at",
    requiresProposal: true,
    franchises: { users: 20, storageGb: 1024, contracts: true, vendors: true },
    placementPaths: ["/", "/planos", "/empresarial"],
    sortOrder: 90,
  }),
  plan({
    sku: "PLAN_ASSOCIACOES",
    name: "Associações e Sindicatos",
    description: "Plano institucional sob proposta a partir da referência set/2026.",
    planTier: "business",
    planTarget: "organization",
    amountCents: brl(1990),
    interval: "monthly",
    priceMode: "starting_at",
    requiresProposal: true,
    placementPaths: ["/", "/planos", "/empresarial"],
    sortOrder: 100,
  }),
  plan({
    sku: "PLAN_CORPORATIVO",
    name: "Corporativo e Governo",
    description: "Preço por contrato: SLA, API, segurança reforçada, implantação, governança.",
    planTier: "enterprise",
    planTarget: "enterprise",
    amountCents: brl(5000),
    interval: "monthly",
    priceMode: "starting_at",
    requiresProposal: true,
    placementPaths: ["/", "/planos", "/empresarial", "/api"],
    sortOrder: 110,
  }),

  /* ─── Adicionais ─── */
  ...(
    [
      ["ADDON_USER", "Usuário adicional", 49, "monthly", "/planos", "/app/perfil"],
      [
        "ADDON_MONITOR_100",
        "100 processos monitorados",
        29,
        "monthly",
        "/planos",
        "/app/processos",
      ],
      [
        "ADDON_MONITOR_500",
        "500 processos monitorados",
        99,
        "monthly",
        "/planos",
        "/app/processos",
      ],
      [
        "ADDON_MONITOR_1000",
        "1.000 processos monitorados",
        169,
        "monthly",
        "/planos",
        "/app/processos",
      ],
      ["ADDON_STORAGE_100GB", "100 GB adicionais", 39, "monthly", "/planos", "/app/documentos"],
      ["ADDON_SUPPORT_PREMIUM", "Suporte Premium", 699, "monthly", "/planos", "/suporte"],
    ] as const
  ).map(
    ([sku, name, reais, interval, ...paths], i): CommercialSkuDefinition => ({
      sku,
      name,
      description: `${name} — adicional comercializável (catálogo 2026-09).`,
      commercialType: "addon",
      productType: "addon",
      amountCents: brl(reais),
      currency: "BRL",
      interval,
      priceMode: "fixed",
      requiresProposal: false,
      placementPaths: [...paths],
      cancelPolicyKey: POLICY.addonCancel,
      refundPolicyKey: POLICY.addonCancel,
      homologationStatus: "catalog_only",
      public: true,
      sortOrder: 200 + i,
    }),
  ),
  {
    sku: "ADDON_CSM",
    name: "Gerente de sucesso dedicado",
    description: "CSM dedicado — desde a referência set/2026; exige proposta.",
    commercialType: "addon",
    productType: "addon",
    amountCents: brl(1490),
    currency: "BRL",
    interval: "monthly",
    priceMode: "starting_at",
    requiresProposal: true,
    placementPaths: ["/planos", "/suporte"],
    cancelPolicyKey: POLICY.proposalOnly,
    refundPolicyKey: POLICY.proposalOnly,
    homologationStatus: "catalog_only",
    public: true,
    sortOrder: 210,
  },
  {
    sku: "ADDON_SPONSORED",
    name: "Destaque patrocinado",
    description: "Destaque no marketplace — desde R$ 79/mês.",
    commercialType: "marketplace_fee",
    productType: "addon",
    amountCents: brl(79),
    currency: "BRL",
    interval: "monthly",
    priceMode: "starting_at",
    requiresProposal: false,
    placementPaths: ["/marketplace", "/app/perfil", "/planos"],
    cancelPolicyKey: POLICY.addonCancel,
    refundPolicyKey: POLICY.addonCancel,
    homologationStatus: "catalog_only",
    public: true,
    sortOrder: 220,
  },
  {
    sku: "ADDON_MARKETPLACE_PRO",
    name: "Marketplace Profissional",
    description: "Assinatura de perfil profissional no marketplace.",
    commercialType: "marketplace_fee",
    productType: "addon",
    amountCents: brl(199),
    currency: "BRL",
    interval: "monthly",
    priceMode: "fixed",
    requiresProposal: false,
    placementPaths: ["/marketplace", "/app/perfil", "/planos"],
    cancelPolicyKey: POLICY.addonCancel,
    refundPolicyKey: POLICY.addonCancel,
    homologationStatus: "catalog_only",
    public: true,
    sortOrder: 230,
  },

  /* ─── Pacotes de créditos ─── */
  ...(
    [
      ["CREDITS_100", 100, 19.9],
      ["CREDITS_500", 500, 79.9],
      ["CREDITS_1500", 1500, 199.9],
      ["CREDITS_5000", 5000, 549.9],
      ["CREDITS_20000", 20000, 1790],
    ] as const
  ).map(
    ([sku, credits, reais], i): CommercialSkuDefinition => ({
      sku,
      name: `Pacote ${credits.toLocaleString("pt-BR")} créditos`,
      description: `Recarga de ${credits} créditos de IA. Validade comercial documental: 12 meses.`,
      commercialType: "ai_credit_pack",
      productType: "ai_credit_pack",
      amountCents: brl(reais),
      currency: "BRL",
      interval: "one_time",
      priceMode: "fixed",
      requiresProposal: false,
      creditsGranted: credits,
      franchises: { credits, validityMonths: 12 },
      placementPaths: [
        "/planos",
        "/app/juris-one",
        "/app/financeiro/monetizacao/ia",
        "/app/perfil",
      ],
      cancelPolicyKey: POLICY.refundCredits,
      refundPolicyKey: POLICY.refundCredits,
      homologationStatus: "catalog_only",
      public: true,
      sortOrder: 300 + i,
    }),
  ),

  /* ─── 24 módulos IA ─── */
  ...(
    [
      ["AI_ASSISTENTE", "Veras Assistente", 29.9, "partial"],
      ["AI_PESQUISA", "Veras Pesquisa", 59.9, "catalog_only"],
      ["AI_JURISPRUDENCIA", "Veras Jurisprudência", 59.9, "catalog_only"],
      ["AI_PROCESSO", "Veras Processo", 99.9, "catalog_only"],
      ["AI_PROVAS", "Veras Provas", 79.9, "catalog_only"],
      ["AI_PECAS", "Veras Peças", 99.9, "partial"],
      ["AI_REVISAO", "Veras Revisão", 69.9, "partial"],
      ["AI_CONTRATOS", "Veras Contratos", 89.9, "partial"],
      ["AI_CALCULOS", "Veras Cálculos", 79.9, "catalog_only"],
      ["AI_PRAZOS", "Veras Prazos", 49.9, "catalog_only"],
      ["AI_ATENDIMENTO", "Veras Atendimento", 39.9, "catalog_only"],
      ["AI_VOZ", "Veras Voz", 49.9, "not_implemented"],
      ["AI_BENEFICIOS", "Veras Benefícios", 99.9, "catalog_only"],
      ["AI_ADMINISTRATIVO", "Veras Administrativo", 99.9, "catalog_only"],
      ["AI_CARTORIOS", "Veras Cartórios", 69.9, "catalog_only"],
      ["AI_COMPLIANCE", "Veras Compliance", 119.9, "catalog_only"],
      ["AI_RISCO", "Veras Risco", 99.9, "catalog_only"],
      ["AI_VISION", "Veras Vision", 49.9, "catalog_only"],
      ["AI_TRADUCAO", "Veras Tradução", 39.9, "catalog_only"],
      ["AI_ESTUDOS", "Veras Estudos", 39.9, "partial"],
      ["AI_DUE_DILIGENCE", "Veras Due Diligence", 149.9, "catalog_only"],
      ["AI_JURIMETRIA", "Veras Jurimetria", 149.9, "catalog_only"],
      ["AI_BI", "Veras BI", 149.9, "catalog_only"],
      ["AI_AGENT", "Veras Agent", 249.9, "partial"],
    ] as const
  ).map(
    ([sku, name, reais, status], i): CommercialSkuDefinition => ({
      sku,
      name,
      description: `Módulo de IA ${name}. Catálogo comercial 2026-09 — compra self-serve na Fase 2; uso real na Fase 5.`,
      commercialType: "ai_module",
      productType: "ai_module",
      amountCents: brl(reais),
      currency: "BRL",
      interval: "monthly",
      priceMode: "fixed",
      requiresProposal: false,
      entitlements: [{ featureKey: `module.${sku}`, limitType: "boolean", limitValue: 1 }],
      placementPaths: [
        "/funcionalidades",
        "/ferramentas",
        "/planos",
        "/app/juris-one",
        `/funcionalidades/${sku.toLowerCase()}`,
      ],
      dependencies: sku === "AI_AGENT" ? ["AI_ASSISTENTE"] : undefined,
      cancelPolicyKey: POLICY.cancelSubscription,
      refundPolicyKey: POLICY.cancelSubscription,
      homologationStatus: status,
      public: true,
      sortOrder: 400 + i,
    }),
  ),

  /* ─── Serviços próprios ─── */
  ...(
    [
      ["SRV_IMPL_ESSENCIAL", "Implantação Essencial", 490, "one_time", "fixed", false],
      ["SRV_IMPL_PRO", "Implantação Profissional", 1490, "one_time", "fixed", false],
      ["SRV_IMPL_AVANCADA", "Implantação Avançada", 3990, "one_time", "fixed", false],
      ["SRV_MIG_BASICA", "Migração Básica", 990, "one_time", "fixed", false],
      ["SRV_MIG_ESTRUTURADA", "Migração Estruturada", 2990, "one_time", "fixed", false],
      ["SRV_MIG_GRANDE", "Migração de grande acervo", 7990, "one_time", "starting_at", true],
      ["SRV_TREINAMENTO", "Treinamento particular", 299, "per_session", "fixed", false],
      ["SRV_BOOTCAMP", "Bootcamp de equipe", 1490, "one_time", "fixed", false],
      ["SRV_REVISAO_OPERACIONAL", "Revisão trimestral", 990, "per_cycle", "starting_at", true],
    ] as const
  ).map(
    ([sku, name, reais, interval, priceMode, requiresProposal], i): CommercialSkuDefinition => ({
      sku,
      name,
      description: `Serviço próprio VerasJuris — ${name}.`,
      commercialType: "service",
      productType: "one_time_service",
      amountCents: brl(reais),
      currency: "BRL",
      interval,
      priceMode,
      requiresProposal,
      placementPaths: ["/servicos", "/planos", "/empresarial"],
      cancelPolicyKey: POLICY.refundService,
      refundPolicyKey: POLICY.refundService,
      homologationStatus: "catalog_only",
      public: true,
      sortOrder: 500 + i,
    }),
  ),

  /* ─── API / white-label / enterprise ─── */
  {
    sku: "API_BASIC",
    name: "API Básica",
    description: "Plano de API com quotas básicas.",
    commercialType: "api_package",
    productType: "api_package",
    amountCents: brl(499),
    currency: "BRL",
    interval: "monthly",
    priceMode: "fixed",
    requiresProposal: false,
    placementPaths: ["/api", "/planos", "/app/financeiro/monetizacao/apis"],
    cancelPolicyKey: POLICY.cancelSubscription,
    refundPolicyKey: POLICY.cancelSubscription,
    homologationStatus: "catalog_only",
    public: true,
    sortOrder: 600,
  },
  {
    sku: "API_PRO",
    name: "API Profissional",
    description: "Plano de API profissional com quotas elevadas.",
    commercialType: "api_package",
    productType: "api_package",
    amountCents: brl(1490),
    currency: "BRL",
    interval: "monthly",
    priceMode: "fixed",
    requiresProposal: false,
    placementPaths: ["/api", "/planos", "/app/financeiro/monetizacao/apis"],
    cancelPolicyKey: POLICY.cancelSubscription,
    refundPolicyKey: POLICY.cancelSubscription,
    homologationStatus: "catalog_only",
    public: true,
    sortOrder: 610,
  },
  {
    sku: "API_ENTERPRISE",
    name: "API Enterprise",
    description: "API enterprise sob consulta / proposta formal.",
    commercialType: "api_package",
    productType: "api_package",
    amountCents: 0,
    currency: "BRL",
    interval: "monthly",
    priceMode: "proposal",
    requiresProposal: true,
    placementPaths: ["/api", "/planos", "/empresarial"],
    cancelPolicyKey: POLICY.proposalOnly,
    refundPolicyKey: POLICY.proposalOnly,
    homologationStatus: "catalog_only",
    public: true,
    sortOrder: 620,
  },
  {
    sku: "WL_SETUP",
    name: "White-label — implantação",
    description: "Implantação white-label (R$ 25.000) + mensalidade separada.",
    commercialType: "white_label",
    productType: "white_label_setup",
    planTier: "white_label",
    planTarget: "partner",
    amountCents: brl(25000),
    currency: "BRL",
    interval: "one_time",
    priceMode: "fixed",
    requiresProposal: true,
    dependencies: ["WL_MONTHLY"],
    placementPaths: ["/white-label", "/planos", "/empresarial"],
    cancelPolicyKey: POLICY.proposalOnly,
    refundPolicyKey: POLICY.proposalOnly,
    homologationStatus: "not_implemented",
    public: true,
    sortOrder: 630,
  },
  {
    sku: "WL_MONTHLY",
    name: "White-label — mensalidade",
    description: "Mensalidade white-label após implantação.",
    commercialType: "white_label",
    productType: "subscription",
    planTier: "white_label",
    planTarget: "partner",
    amountCents: brl(5000),
    currency: "BRL",
    interval: "monthly",
    priceMode: "fixed",
    requiresProposal: true,
    dependencies: ["WL_SETUP"],
    placementPaths: ["/white-label", "/planos", "/empresarial"],
    cancelPolicyKey: POLICY.proposalOnly,
    refundPolicyKey: POLICY.proposalOnly,
    homologationStatus: "not_implemented",
    public: true,
    sortOrder: 640,
  },
  {
    sku: "ENV_DEDICATED",
    name: "Ambiente dedicado",
    description: "Ambiente dedicado desde R$ 3.500/mês + implantação.",
    commercialType: "enterprise",
    productType: "other",
    planTier: "enterprise",
    planTarget: "enterprise",
    amountCents: brl(3500),
    currency: "BRL",
    interval: "monthly",
    priceMode: "starting_at",
    requiresProposal: true,
    placementPaths: ["/empresarial", "/planos"],
    cancelPolicyKey: POLICY.proposalOnly,
    refundPolicyKey: POLICY.proposalOnly,
    homologationStatus: "not_implemented",
    public: true,
    sortOrder: 650,
  },
  {
    sku: "ENT_SSO_SCIM",
    name: "SSO/SCIM",
    description: "SSO/SCIM sob consulta.",
    commercialType: "enterprise",
    productType: "other",
    amountCents: 0,
    currency: "BRL",
    interval: null,
    priceMode: "proposal",
    requiresProposal: true,
    placementPaths: ["/empresarial", "/planos"],
    cancelPolicyKey: POLICY.proposalOnly,
    refundPolicyKey: POLICY.proposalOnly,
    homologationStatus: "not_implemented",
    public: true,
    sortOrder: 660,
  },
  {
    sku: "ENT_CRITICAL_SUPPORT",
    name: "Suporte crítico",
    description: "Suporte crítico — contrato específico.",
    commercialType: "enterprise",
    productType: "other",
    amountCents: 0,
    currency: "BRL",
    interval: null,
    priceMode: "proposal",
    requiresProposal: true,
    placementPaths: ["/suporte", "/empresarial", "/planos"],
    cancelPolicyKey: POLICY.proposalOnly,
    refundPolicyKey: POLICY.proposalOnly,
    homologationStatus: "not_implemented",
    public: true,
    sortOrder: 670,
  },
  {
    sku: "ENT_CUSTOM_INTEGRATIONS",
    name: "Integrações customizadas",
    description: "Integrações customizadas sob orçamento.",
    commercialType: "enterprise",
    productType: "other",
    amountCents: 0,
    currency: "BRL",
    interval: null,
    priceMode: "proposal",
    requiresProposal: true,
    placementPaths: ["/integracoes", "/empresarial", "/planos"],
    cancelPolicyKey: POLICY.proposalOnly,
    refundPolicyKey: POLICY.proposalOnly,
    homologationStatus: "not_implemented",
    public: true,
    sortOrder: 680,
  },
];

export function getCommercialSku(sku: string): CommercialSkuDefinition | undefined {
  return COMMERCIAL_CATALOG.find((item) => item.sku === sku);
}

export function listCommercialSkus(filter?: {
  commercialType?: CommercialType;
  publicOnly?: boolean;
}): CommercialSkuDefinition[] {
  return COMMERCIAL_CATALOG.filter((item) => {
    if (filter?.commercialType && item.commercialType !== filter.commercialType) return false;
    if (filter?.publicOnly && !item.public) return false;
    return true;
  }).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function yearlyAmountCents(monthlyCents: number, discountBps = ANNUAL_DISCOUNT_BPS): number {
  if (monthlyCents <= 0) return 0;
  const annual = monthlyCents * 12;
  return Math.round(annual * (1 - discountBps / 10_000));
}

export const commercialCatalogQuerySchema = z.object({
  commercialType: z.enum(COMMERCIAL_TYPES).optional(),
  homologationStatus: z.enum(HOMOLOGATION_STATUSES).optional(),
  placement: z.string().trim().max(120).optional(),
  publicOnly: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === true || v === "true")),
  limit: z.coerce.number().int().min(1).max(500).default(200),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export type CommercialCatalogQuery = z.infer<typeof commercialCatalogQuerySchema>;
