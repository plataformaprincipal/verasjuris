import { describe, expect, it } from "vitest";
import { homeForAccount, homeForPersona, resolveAuthenticatedHome } from "./persona-home";
import type { Account } from "./types";

function account(persona: string | null): Account {
  return {
    user: {
      id: "u1",
      email: "a@exemplo.com",
      displayName: "Ana",
      locale: "pt-BR",
      timeZone: "America/Sao_Paulo",
      onboardingPersona: persona,
    },
    professionalVerificationStatus: "not_submitted",
    memberships: [],
  };
}

describe("persona-home", () => {
  it("direciona client_pf ao portal e demais personas ao app", () => {
    expect(homeForPersona("client_pf")).toBe("/portal");
    expect(homeForPersona("lawyer")).toBe("/app");
    expect(homeForPersona(null)).toBe("/app");
    expect(homeForAccount(account("client_pf"))).toBe("/portal");
    expect(homeForAccount(account("partner_service"))).toBe("/app");
  });

  it("respeita ?redirect= seguro e usa persona como fallback", () => {
    expect(resolveAuthenticatedHome(account("client_pf"), "/app/casos")).toBe("/app/casos");
    expect(resolveAuthenticatedHome(account("client_pf"), null)).toBe("/portal");
    expect(resolveAuthenticatedHome(account("lawyer"), "https://evil.example")).toBe("/app");
  });
});
