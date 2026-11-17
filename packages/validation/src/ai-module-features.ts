/**
 * Fase 5 — mapeamento gateway feature → módulo comercial AI_* + custo em créditos.
 * Módulos desbloqueiam uso; cobrança = franquia do plano + packs CREDITS_*.
 */

export const AI_MODULE_SKUS = [
  "AI_ASSISTENTE",
  "AI_PESQUISA",
  "AI_JURISPRUDENCIA",
  "AI_PROCESSO",
  "AI_PROVAS",
  "AI_PECAS",
  "AI_REVISAO",
  "AI_CONTRATOS",
  "AI_CALCULOS",
  "AI_PRAZOS",
  "AI_ATENDIMENTO",
  "AI_VOZ",
  "AI_BENEFICIOS",
  "AI_ADMINISTRATIVO",
  "AI_CARTORIOS",
  "AI_COMPLIANCE",
  "AI_RISCO",
  "AI_VISION",
  "AI_TRADUCAO",
  "AI_ESTUDOS",
  "AI_DUE_DILIGENCE",
  "AI_JURIMETRIA",
  "AI_BI",
  "AI_AGENT",
] as const;

export type AiModuleSku = (typeof AI_MODULE_SKUS)[number];

export type AiModuleFeatureBinding = {
  sku: AiModuleSku;
  entitlementKey: `module.${AiModuleSku}`;
  /** Prefixos ou chaves exatas de DEFAULT_AI_FEATURES. */
  featureMatchers: string[];
  creditsPerCall: number;
  /** Se true, plano com franquia de créditos pode usar sem grant do módulo. */
  allowPlanFranchise: boolean;
};

export const AI_MODULE_FEATURE_BINDINGS: readonly AiModuleFeatureBinding[] = [
  {
    sku: "AI_ASSISTENTE",
    entitlementKey: "module.AI_ASSISTENTE",
    featureMatchers: ["juris_one.chat", "juris_one.public_chat", "foundation-check"],
    creditsPerCall: 1,
    allowPlanFranchise: true,
  },
  {
    sku: "AI_AGENT",
    entitlementKey: "module.AI_AGENT",
    featureMatchers: ["juris_one.work"],
    creditsPerCall: 5,
    allowPlanFranchise: false,
  },
  {
    sku: "AI_PECAS",
    entitlementKey: "module.AI_PECAS",
    featureMatchers: ["legal_draft."],
    creditsPerCall: 3,
    allowPlanFranchise: false,
  },
  {
    sku: "AI_REVISAO",
    entitlementKey: "module.AI_REVISAO",
    featureMatchers: ["legal_review", "legal_analysis", "legal_comparison"],
    creditsPerCall: 2,
    allowPlanFranchise: false,
  },
  {
    sku: "AI_CONTRATOS",
    entitlementKey: "module.AI_CONTRATOS",
    featureMatchers: ["contract."],
    creditsPerCall: 3,
    allowPlanFranchise: false,
  },
  {
    sku: "AI_ESTUDOS",
    entitlementKey: "module.AI_ESTUDOS",
    featureMatchers: ["education."],
    creditsPerCall: 1,
    allowPlanFranchise: true,
  },
  {
    sku: "AI_VISION",
    entitlementKey: "module.AI_VISION",
    featureMatchers: [
      "document_vision",
      "document_classification",
      "document_summary",
      "document_metadata_extraction",
      "document_embedding",
    ],
    creditsPerCall: 2,
    allowPlanFranchise: false,
  },
  {
    sku: "AI_PESQUISA",
    entitlementKey: "module.AI_PESQUISA",
    featureMatchers: ["legal_research", "research."],
    creditsPerCall: 2,
    allowPlanFranchise: false,
  },
  {
    sku: "AI_JURISPRUDENCIA",
    entitlementKey: "module.AI_JURISPRUDENCIA",
    featureMatchers: ["jurisprudence.", "citation."],
    creditsPerCall: 2,
    allowPlanFranchise: false,
  },
  {
    sku: "AI_PROCESSO",
    entitlementKey: "module.AI_PROCESSO",
    featureMatchers: ["process.", "judicial."],
    creditsPerCall: 3,
    allowPlanFranchise: false,
  },
  {
    sku: "AI_PROVAS",
    entitlementKey: "module.AI_PROVAS",
    featureMatchers: ["evidence.", "proof."],
    creditsPerCall: 2,
    allowPlanFranchise: false,
  },
  {
    sku: "AI_CALCULOS",
    entitlementKey: "module.AI_CALCULOS",
    featureMatchers: ["calculation.", "tax.calculation"],
    creditsPerCall: 2,
    allowPlanFranchise: false,
  },
  {
    sku: "AI_PRAZOS",
    entitlementKey: "module.AI_PRAZOS",
    featureMatchers: ["deadline.", "prazo."],
    creditsPerCall: 1,
    allowPlanFranchise: false,
  },
  {
    sku: "AI_ATENDIMENTO",
    entitlementKey: "module.AI_ATENDIMENTO",
    featureMatchers: ["intake.", "attendance."],
    creditsPerCall: 1,
    allowPlanFranchise: true,
  },
  {
    sku: "AI_VOZ",
    entitlementKey: "module.AI_VOZ",
    featureMatchers: ["voice.", "speech."],
    creditsPerCall: 3,
    allowPlanFranchise: false,
  },
  {
    sku: "AI_BENEFICIOS",
    entitlementKey: "module.AI_BENEFICIOS",
    featureMatchers: ["previdentiary."],
    creditsPerCall: 3,
    allowPlanFranchise: false,
  },
  {
    sku: "AI_ADMINISTRATIVO",
    entitlementKey: "module.AI_ADMINISTRATIVO",
    featureMatchers: ["administrative.", "tax.admin"],
    creditsPerCall: 3,
    allowPlanFranchise: false,
  },
  {
    sku: "AI_CARTORIOS",
    entitlementKey: "module.AI_CARTORIOS",
    featureMatchers: ["cartorio.", "notary."],
    creditsPerCall: 2,
    allowPlanFranchise: false,
  },
  {
    sku: "AI_COMPLIANCE",
    entitlementKey: "module.AI_COMPLIANCE",
    featureMatchers: ["compliance."],
    creditsPerCall: 3,
    allowPlanFranchise: false,
  },
  {
    sku: "AI_RISCO",
    entitlementKey: "module.AI_RISCO",
    featureMatchers: ["auction.risk_extraction", "risk."],
    creditsPerCall: 3,
    allowPlanFranchise: false,
  },
  {
    sku: "AI_TRADUCAO",
    entitlementKey: "module.AI_TRADUCAO",
    featureMatchers: ["translation.", "traducao."],
    creditsPerCall: 2,
    allowPlanFranchise: false,
  },
  {
    sku: "AI_DUE_DILIGENCE",
    entitlementKey: "module.AI_DUE_DILIGENCE",
    featureMatchers: ["auction.due_diligence_assist", "due_diligence."],
    creditsPerCall: 5,
    allowPlanFranchise: false,
  },
  {
    sku: "AI_JURIMETRIA",
    entitlementKey: "module.AI_JURIMETRIA",
    featureMatchers: ["jurimetria.", "analytics.legal"],
    creditsPerCall: 4,
    allowPlanFranchise: false,
  },
  {
    sku: "AI_BI",
    entitlementKey: "module.AI_BI",
    featureMatchers: ["bi.", "analytics."],
    creditsPerCall: 4,
    allowPlanFranchise: false,
  },
] as const;

export function moduleEntitlementKey(sku: AiModuleSku): `module.${AiModuleSku}` {
  return `module.${sku}`;
}

export function resolveAiModuleForFeature(feature: string): AiModuleFeatureBinding | null {
  for (const binding of AI_MODULE_FEATURE_BINDINGS) {
    for (const matcher of binding.featureMatchers) {
      if (matcher.endsWith(".")) {
        if (feature.startsWith(matcher) || feature === matcher.slice(0, -1)) return binding;
      } else if (feature === matcher) {
        return binding;
      }
    }
  }
  return null;
}

export function creditsForAiFeature(feature: string): number {
  return resolveAiModuleForFeature(feature)?.creditsPerCall ?? 1;
}

/** Marcos padrão de serviços próprios (Fase 6). */
export const SERVICE_MILESTONE_DEPOSIT_BPS = 3000;
export const SERVICE_MILESTONE_DELIVERY_BPS = 7000;

export function splitServiceMilestoneCents(totalCents: number): {
  depositCents: number;
  deliveryCents: number;
} {
  if (!Number.isInteger(totalCents) || totalCents <= 0) {
    return { depositCents: 0, deliveryCents: 0 };
  }
  const depositCents = Math.round((totalCents * SERVICE_MILESTONE_DEPOSIT_BPS) / 10_000);
  const deliveryCents = totalCents - depositCents;
  return { depositCents, deliveryCents };
}
