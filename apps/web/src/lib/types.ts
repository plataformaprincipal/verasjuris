export type Membership = {
  membershipId: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  organizationStatus: "active" | "suspended";
  membershipStatus: "active" | "suspended" | "removed";
  roles: string[];
  permissions: string[];
};

export type Account = {
  user: {
    id: string;
    email: string;
    displayName: string;
    locale: string;
    timeZone: string;
    status?: string;
    emailVerified?: boolean;
  };
  professionalVerificationStatus: "not_submitted" | "pending" | "verified" | "rejected";
  memberships: Membership[];
};

export type ApiFailure = {
  error?: {
    code?: string;
    message?: string;
    details?: Array<{ path: string; message: string }>;
  };
};

/**
 * Base URL da API para fetches do servidor Next (RSC, route handlers, BFF).
 * Prefere `API_INTERNAL_URL`. Não use `NEXT_PUBLIC_API_URL` no servidor.
 */
export function apiInternalUrl(): string {
  const internal = process.env.API_INTERNAL_URL?.trim();
  if (internal) return internal;
  return "http://127.0.0.1:4000";
}

/**
 * Base URL exposta ao browser, se necessário.
 * Nunca colocar segredos em NEXT_PUBLIC_*. Preferir o proxy BFF `/api/v1/*`.
 */
export function publicApiUrl(): string | undefined {
  const value = process.env.NEXT_PUBLIC_API_URL?.trim();
  return value || undefined;
}

export const ROLE_LABELS: Record<string, string> = {
  owner: "Proprietário",
  administrator: "Administrador",
  member: "Membro",
};

export const ACTION_LABELS: Record<string, string> = {
  "user.registered": "Conta criada",
  "auth.registered": "Conta criada",
  "auth.login_succeeded": "Entrada confirmada",
  "auth.login_failed": "Tentativa de entrada recusada",
  "auth.logout": "Sessão encerrada",
  "email.verification_requested": "Verificação de e-mail solicitada",
  "email.verified": "E-mail verificado",
  "password.reset_requested": "Redefinição de senha solicitada",
  "password.reset_completed": "Senha redefinida",
  "password.changed": "Senha alterada",
  "profile.updated": "Perfil atualizado",
  "session.revoked": "Sessão encerrada",
  "organization.created": "Organização criada",
  "organization.updated": "Organização atualizada",
  "organization.switched": "Organização ativa alterada",
  "organization.invitation_created": "Convite criado",
  "organization.invitation_revoked": "Convite revogado",
  "organization.invitation_resent": "Convite reenviado",
  "organization.invitation_accepted": "Convite aceito",
  "membership.created": "Participação criada",
  "membership.updated": "Participação atualizada",
};

export function roleLabel(key: string): string {
  return ROLE_LABELS[key] ?? key;
}

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? "Ação registrada";
}
