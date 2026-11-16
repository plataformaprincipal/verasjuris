import type { OnboardingPersona } from "@verasjuris/validation";

export type ModuleAvailability =
  | "available"
  | "partial"
  | "demo"
  | "in_development"
  | "unavailable";

export type WorkspaceModule = {
  id: string;
  href: string;
  titleKey: string;
  descriptionKey: string;
  permission?: string;
  availability: ModuleAvailability;
  /** Preview-only when the operational route is not yet wired for this persona. */
  previewHref?: string;
};

/** Módulos do shell /app, filtrados por persona + permissão no dashboard. */
const OFFICE_CORE: WorkspaceModule[] = [
  {
    id: "casos",
    href: "/app/casos",
    titleKey: "nav.matters",
    descriptionKey: "workspace.modules.matters",
    permission: "matter.read",
    availability: "available",
  },
  {
    id: "crm",
    href: "/app/crm",
    titleKey: "nav.crm",
    descriptionKey: "workspace.modules.crm",
    permission: "crm.read",
    availability: "available",
  },
  {
    id: "documentos",
    href: "/app/documentos",
    titleKey: "nav.documents",
    descriptionKey: "workspace.modules.documents",
    permission: "document.read",
    availability: "available",
  },
  {
    id: "agenda",
    href: "/app/agenda",
    titleKey: "nav.calendar",
    descriptionKey: "workspace.modules.calendar",
    permission: "calendar.read",
    availability: "available",
  },
  {
    id: "prazos",
    href: "/app/prazos",
    titleKey: "nav.deadlines",
    descriptionKey: "workspace.modules.deadlines",
    permission: "deadline.read",
    availability: "available",
  },
  {
    id: "tarefas",
    href: "/app/tarefas",
    titleKey: "nav.tasks",
    descriptionKey: "workspace.modules.tasks",
    permission: "task.read",
    availability: "available",
  },
  {
    id: "financeiro",
    href: "/app/financeiro",
    titleKey: "nav.finance",
    descriptionKey: "workspace.modules.finance",
    permission: "finance.read",
    availability: "partial",
  },
  {
    id: "marketplace",
    href: "/app/marketplace",
    titleKey: "nav.marketplace",
    descriptionKey: "workspace.modules.marketplace",
    permission: "marketplace.read",
    availability: "available",
  },
  {
    id: "ia",
    href: "/app/ia",
    titleKey: "nav.ai",
    descriptionKey: "workspace.modules.ai",
    permission: "ai.use",
    availability: "in_development",
    previewHref: "/app/previsualizacao/assistente-ia",
  },
  {
    id: "conta",
    href: "/app/conta",
    titleKey: "nav.account",
    descriptionKey: "workspace.modules.account",
    availability: "available",
  },
  {
    id: "perfis",
    href: "/app/perfis",
    titleKey: "nav.profiles",
    descriptionKey: "workspace.modules.profiles",
    availability: "available",
  },
  {
    id: "seguranca",
    href: "/app/configuracoes/seguranca",
    titleKey: "nav.security",
    descriptionKey: "workspace.modules.security",
    availability: "available",
  },
];

const LAWYER_EXTRA: WorkspaceModule[] = [
  {
    id: "atendimentos",
    href: "/app/atendimentos",
    titleKey: "nav.intake",
    descriptionKey: "workspace.modules.intake",
    permission: "intake.read",
    availability: "available",
  },
  {
    id: "pipeline",
    href: "/app/pipeline",
    titleKey: "nav.pipeline",
    descriptionKey: "workspace.modules.pipeline",
    permission: "pipeline.read",
    availability: "available",
  },
  {
    id: "verificacao",
    href: "/app/perfil/verificacao",
    titleKey: "workspace.modules.verificationTitle",
    descriptionKey: "workspace.modules.verification",
    availability: "partial",
  },
];

const PARTNER_EXTRA: WorkspaceModule[] = [
  {
    id: "correspondente",
    href: "/app/correspondente",
    titleKey: "workspace.modules.correspondentTitle",
    descriptionKey: "workspace.modules.correspondent",
    availability: "partial",
  },
  {
    id: "diligencias",
    href: "/app/diligencias",
    titleKey: "workspace.modules.diligenceTitle",
    descriptionKey: "workspace.modules.diligence",
    availability: "partial",
  },
];

const ADMIN_EXTRA: WorkspaceModule[] = [
  {
    id: "organizacao",
    href: "/app/organizacao",
    titleKey: "nav.organization",
    descriptionKey: "workspace.modules.organization",
    permission: "organization.read",
    availability: "available",
  },
  {
    id: "participantes",
    href: "/app/participantes",
    titleKey: "nav.members",
    descriptionKey: "workspace.modules.members",
    permission: "member.read",
    availability: "available",
  },
  {
    id: "auditoria",
    href: "/app/auditoria",
    titleKey: "nav.audit",
    descriptionKey: "workspace.modules.audit",
    permission: "audit.read",
    availability: "available",
  },
];

const PERSONA_MODULES: Record<OnboardingPersona, WorkspaceModule[]> = {
  client_pf: [],
  client_pj: [...OFFICE_CORE, ...ADMIN_EXTRA],
  lawyer: [...OFFICE_CORE, ...LAWYER_EXTRA],
  law_firm: [...OFFICE_CORE, ...LAWYER_EXTRA, ...ADMIN_EXTRA],
  corporate_legal: [...OFFICE_CORE, ...ADMIN_EXTRA],
  partner_legal: [...OFFICE_CORE, ...PARTNER_EXTRA],
  partner_service: [...OFFICE_CORE, ...PARTNER_EXTRA],
};

export function modulesForPersona(
  persona: OnboardingPersona | null,
  permissions: Set<string>,
): WorkspaceModule[] {
  const base = persona ? PERSONA_MODULES[persona] : OFFICE_CORE;
  const list = base.length > 0 ? base : OFFICE_CORE;
  return list.filter((module) => {
    if (!module.permission) return true;
    return permissions.has(module.permission);
  });
}

export const AVAILABILITY_LABEL_KEYS: Record<ModuleAvailability, string> = {
  available: "catalog.availability.available",
  partial: "workspace.availability.partial",
  demo: "workspace.availability.demo",
  in_development: "catalog.availability.inDevelopment",
  unavailable: "workspace.availability.unavailable",
};
