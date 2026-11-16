export type DemoKind =
  | "processos"
  | "clientes"
  | "agenda"
  | "prazos"
  | "tarefas"
  | "documentos"
  | "contratos"
  | "crm"
  | "financeiro"
  | "relatorios"
  | "automacao"
  | "previdenciario"
  | "marketplace"
  | "ia"
  | "integracoes";

/** A local funcional · B interativa fictícia · C prévia guiada de integração · D módulo autenticado real */
export type DemoClassification = "A" | "B" | "C" | "D";

export type CostBand = "previsivel" | "variavel" | "transacional" | "a_validar";

export type ToolDemoConfig = {
  id: string;
  kind: DemoKind;
  title: string;
  classification: DemoClassification;
  limitations: string[];
  maxItems: number;
  seedVersion: number;
};

export type CommercialSheet = {
  problem: string;
  audience: string[];
  primaryBenefit: string;
  demoOffered: string;
  realFeatures: string[];
  technicalLimitations: string[];
  integrationDeps: string[];
  estimatedOpsCost: CostBand;
  variableCosts: string[];
  supportNeed: string;
  compliance: string[];
  suggestedModality: string;
  eligiblePlan: string | null;
  cta: { label: string; href: string };
  conversionSignals: string[];
};

export type ToolDemoMeta = {
  slug: string;
  kind: DemoKind | null;
  publicDemo: DemoClassification | null;
  authenticated: DemoClassification | null;
  authenticatedHref: string | null;
  guidedOnly: boolean;
};
