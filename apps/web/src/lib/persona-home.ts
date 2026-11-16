import {
  ONBOARDING_PERSONA_META,
  onboardingPersonaSchema,
  type OnboardingPersona,
} from "@verasjuris/validation";
import type { Account } from "./types";
import { isSafeRedirectPath, resolvePostAuthRedirect } from "./safe-redirect";

export type AuthenticatedHome = "/app" | "/portal";

export function personaFromAccount(account: Account): OnboardingPersona | null {
  const raw = account.user.onboardingPersona;
  if (!raw) return null;
  const parsed = onboardingPersonaSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Destino padrão pós-auth conforme persona (cadastro/login sem ?redirect=). */
export function homeForPersona(persona: OnboardingPersona | null | undefined): AuthenticatedHome {
  if (!persona) return "/app";
  return ONBOARDING_PERSONA_META[persona].redirectTo;
}

export function homeForAccount(account: Account): AuthenticatedHome {
  return homeForPersona(personaFromAccount(account));
}

/**
 * Resolve destino pós-login/cadastro:
 * 1) ?redirect= seguro; 2) persona; 3) /app.
 */
export function resolveAuthenticatedHome(account: Account, redirectParam?: string | null): string {
  if (redirectParam && isSafeRedirectPath(redirectParam)) {
    return resolvePostAuthRedirect(redirectParam, homeForAccount(account));
  }
  return homeForAccount(account);
}

export function personaLabelKey(persona: OnboardingPersona): string {
  return `register.persona.${persona}`;
}
