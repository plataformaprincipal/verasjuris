/**
 * Papéis e permissões da equipe interna VerasJuris (plataforma).
 * Independente do RBAC de organizações-cliente.
 */

export const PLATFORM_ROLE_KEYS = [
  "SUPER_ADMIN",
  "ADMIN_OPERACIONAL",
  "ADMIN_FINANCEIRO",
  "SUPORTE",
  "MODERADOR",
  "ADMIN_COMERCIAL",
  "AUDITOR",
] as const;

export type PlatformRoleKey = (typeof PLATFORM_ROLE_KEYS)[number];

export const PLATFORM_ROLE_NAMES: Record<PlatformRoleKey, string> = {
  SUPER_ADMIN: "Super administrador",
  ADMIN_OPERACIONAL: "Administrador operacional",
  ADMIN_FINANCEIRO: "Administrador financeiro",
  SUPORTE: "Suporte",
  MODERADOR: "Moderador",
  ADMIN_COMERCIAL: "Administrador comercial",
  AUDITOR: "Auditor",
};

export const PLATFORM_PERMISSIONS = [
  "platform.dashboard.read",
  "platform.users.read",
  "platform.users.write",
  "platform.users.suspend",
  "platform.orgs.read",
  "platform.orgs.write",
  "platform.finance.read",
  "platform.finance.refund",
  "platform.marketplace.moderate",
  "platform.social.moderate",
  "platform.ai.admin",
  "platform.support.read",
  "platform.support.write",
  "platform.integrations.read",
  "platform.staff.manage",
  "platform.audit.read",
  "platform.commercial.read",
  "platform.commercial.homologate",
  "platform.payments.approve",
  "platform.security.admin",
] as const;

export type PlatformPermissionKey = (typeof PLATFORM_PERMISSIONS)[number];

export const PLATFORM_PERMISSION_DESCRIPTIONS: Record<PlatformPermissionKey, string> = {
  "platform.dashboard.read": "Consultar o dashboard executivo da plataforma.",
  "platform.users.read": "Listar e visualizar usuários da plataforma.",
  "platform.users.write": "Atualizar dados cadastrais de usuários (sem senhas).",
  "platform.users.suspend": "Bloquear, suspender ou reativar usuários.",
  "platform.orgs.read": "Consultar organizações e membros (metadados).",
  "platform.orgs.write": "Alterar status operacional de organizações.",
  "platform.finance.read": "Consultar cobranças, assinaturas e eventos financeiros.",
  "platform.finance.refund": "Executar estornos e cancelamentos financeiros autorizados.",
  "platform.marketplace.moderate": "Moderar anúncios, pedidos e disputas do marketplace.",
  "platform.social.moderate": "Moderar publicações, denúncias e contas da rede social.",
  "platform.ai.admin": "Administrar Juris One, orçamentos e suspensão de IA.",
  "platform.support.read": "Consultar chamados de suporte.",
  "platform.support.write": "Responder e gerenciar chamados de suporte.",
  "platform.integrations.read": "Consultar saúde de integrações externas.",
  "platform.staff.manage": "Convidar e revogar equipe administrativa.",
  "platform.audit.read": "Consultar auditoria da plataforma.",
  "platform.commercial.read": "Consultar planos, assinaturas e indicadores comerciais.",
  "platform.commercial.homologate": "Registrar evidências de homologação por SKU.",
  "platform.payments.approve": "Aprovar ou revogar liberação comercial live (não altera env).",
  "platform.security.admin": "Configurações de segurança administrativa.",
};

const ALL = [...PLATFORM_PERMISSIONS] as PlatformPermissionKey[];

export const PLATFORM_ROLE_PERMISSIONS: Record<PlatformRoleKey, readonly PlatformPermissionKey[]> =
  {
    SUPER_ADMIN: ALL,
    ADMIN_OPERACIONAL: [
      "platform.dashboard.read",
      "platform.users.read",
      "platform.users.write",
      "platform.users.suspend",
      "platform.orgs.read",
      "platform.orgs.write",
      "platform.marketplace.moderate",
      "platform.social.moderate",
      "platform.support.read",
      "platform.support.write",
      "platform.integrations.read",
      "platform.audit.read",
    ],
    ADMIN_FINANCEIRO: [
      "platform.dashboard.read",
      "platform.finance.read",
      "platform.finance.refund",
      "platform.commercial.read",
      "platform.commercial.homologate",
      "platform.payments.approve",
      "platform.audit.read",
      "platform.integrations.read",
    ],
    SUPORTE: [
      "platform.dashboard.read",
      "platform.users.read",
      "platform.orgs.read",
      "platform.support.read",
      "platform.support.write",
      "platform.integrations.read",
    ],
    MODERADOR: [
      "platform.dashboard.read",
      "platform.marketplace.moderate",
      "platform.social.moderate",
      "platform.users.read",
      "platform.audit.read",
    ],
    ADMIN_COMERCIAL: [
      "platform.dashboard.read",
      "platform.commercial.read",
      "platform.commercial.homologate",
      "platform.marketplace.moderate",
      "platform.finance.read",
      "platform.orgs.read",
      "platform.integrations.read",
    ],
    AUDITOR: [
      "platform.dashboard.read",
      "platform.users.read",
      "platform.orgs.read",
      "platform.finance.read",
      "platform.audit.read",
      "platform.integrations.read",
      "platform.ai.admin",
    ],
  };

export function platformRoleHasPermission(
  role: PlatformRoleKey,
  permission: PlatformPermissionKey,
): boolean {
  return PLATFORM_ROLE_PERMISSIONS[role].includes(permission);
}

export function collectPlatformPermissions(
  roles: readonly PlatformRoleKey[],
): PlatformPermissionKey[] {
  const set = new Set<PlatformPermissionKey>();
  for (const role of roles) {
    for (const p of PLATFORM_ROLE_PERMISSIONS[role] ?? []) set.add(p);
  }
  return [...set];
}
