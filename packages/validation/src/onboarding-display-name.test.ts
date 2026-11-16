import { describe, expect, it } from "vitest";
import { onboardingRegisterSchema } from "./onboarding.js";

const base = {
  persona: "client_pf" as const,
  fullName: "Maria Souza Lima",
  cpf: "390.533.447-05",
  birthDate: "1990-05-10",
  email: "maria.display@exemplo.com",
  phone: "11988887777",
  address: {
    postalCode: "01310-100",
    street: "Avenida Paulista",
    number: "1000",
    district: "Bela Vista",
    city: "São Paulo",
    state: "SP",
    country: "Brasil",
  },
  password: "Veras@Local12",
  passwordConfirm: "Veras@Local12",
  acceptTerms: true as const,
  acceptPrivacy: true as const,
};

describe("onboardingRegisterSchema displayName", () => {
  it("exige nome completo e deriva displayName quando omitido", () => {
    const parsed = onboardingRegisterSchema.safeParse(base);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.displayName).toBe("Maria Souza Lima");
      expect(parsed.data.fullName).toBe("Maria Souza Lima");
    }
  });

  it("rejeita quando fullName e displayName estão ausentes/inválidos", () => {
    const parsed = onboardingRegisterSchema.safeParse({
      ...base,
      fullName: "",
      displayName: undefined,
    });
    expect(parsed.success).toBe(false);
  });

  it("aceita displayName explícito enviado pelo wizard", () => {
    const parsed = onboardingRegisterSchema.safeParse({
      ...base,
      displayName: "Maria Souza Lima",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.displayName).toBe("Maria Souza Lima");
  });
});
