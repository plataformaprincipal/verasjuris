import { onboardingRegisterSchema } from "@verasjuris/validation";
import { describe, expect, it } from "vitest";
import { passwordStrength } from "./br-masks";
import {
  INITIAL_WIZARD_STATE,
  PUBLIC_PERSONAS,
  buildRegisterPayload,
  getWizardSteps,
  mapServerErrors,
  maskCep,
  maskCpf,
  maskPhone,
  resolveWizardRedirect,
  validateAll,
  validateStep,
  type WizardState,
} from "./registration-wizard";

const NOW = new Date("2026-11-13T12:00:00.000Z");
const VALID_CPF = "529.982.247-25";
const VALID_CNPJ = "11.222.333/0001-81";

function state(overrides: Partial<WizardState>): WizardState {
  return { ...INITIAL_WIZARD_STATE, ...overrides };
}

const baseFilled: Partial<WizardState> = {
  fullName: "Maria Souza",
  cpf: VALID_CPF,
  birthDate: "1990-05-10",
  email: "Maria@Example.com",
  phone: "(11) 91234-5678",
  postalCode: "01310-100",
  street: "Avenida Paulista",
  number: "1000",
  district: "Bela Vista",
  city: "São Paulo",
  state: "SP",
  password: "uma-senha-bem-longa-9!",
  passwordConfirm: "uma-senha-bem-longa-9!",
  acceptTerms: true,
  acceptPrivacy: true,
};

describe("personas e etapas", () => {
  it("não oferece colaborador nem administrador", () => {
    expect(PUBLIC_PERSONAS).toHaveLength(7);
    expect(PUBLIC_PERSONAS as readonly string[]).not.toContain("employee");
    expect(PUBLIC_PERSONAS as readonly string[]).not.toContain("admin");
  });

  it("pula a etapa profissional para cliente pessoa física", () => {
    expect(getWizardSteps("client_pf")).toEqual([
      "persona",
      "identification",
      "contact",
      "address",
      "password",
      "review",
    ]);
    expect(getWizardSteps("lawyer")).toContain("profile");
    expect(getWizardSteps("")).not.toContain("profile");
  });
});

describe("validateStep", () => {
  it("exige persona", () => {
    expect(validateStep("persona", state({}), NOW).persona).toBeDefined();
    expect(validateStep("persona", state({ persona: "lawyer" }), NOW)).toEqual({});
  });

  it("valida identificação e exige data de nascimento apenas quando necessário", () => {
    const pf = state({ persona: "client_pf", fullName: "Maria", cpf: "111.111.111-11" });
    const errors = validateStep("identification", pf, NOW);
    expect(errors.fullName).toBe("Informe nome e sobrenome.");
    expect(errors.cpf).toBe("Informe um CPF válido.");
    expect(errors.birthDate).toBeDefined();

    const pj = state({ persona: "client_pj", fullName: "João Silva", cpf: VALID_CPF });
    expect(validateStep("identification", pj, NOW)).toEqual({});
  });

  it("rejeita data de nascimento futura ou de menor de 16 anos", () => {
    const base = { persona: "lawyer" as const, fullName: "Ana Lima", cpf: VALID_CPF };
    expect(validateStep("identification", state({ ...base, birthDate: "2027-01-01" }), NOW).birthDate)
      .toBeDefined();
    expect(validateStep("identification", state({ ...base, birthDate: "2020-01-01" }), NOW).birthDate)
      .toBeDefined();
    expect(validateStep("identification", state({ ...base, birthDate: "1985-03-02" }), NOW)).toEqual(
      {},
    );
  });

  it("valida contato", () => {
    const errors = validateStep("contact", state({ email: "invalido", phone: "123" }), NOW);
    expect(errors.email).toBeDefined();
    expect(errors.phone).toBeDefined();
    expect(
      validateStep("contact", state({ email: "a@b.com", phone: "(11) 91234-5678" }), NOW),
    ).toEqual({});
  });

  it("valida endereço com preenchimento manual", () => {
    expect(Object.keys(validateStep("address", state({}), NOW)).sort()).toEqual(
      ["city", "district", "number", "postalCode", "state", "street"].sort(),
    );
    expect(validateStep("address", state(baseFilled), NOW)).toEqual({});
  });

  it("valida etapa profissional por persona", () => {
    const pj = validateStep("profile", state({ persona: "client_pj" }), NOW);
    expect(pj.organizationName).toBeDefined();
    expect(pj.cnpj).toBeDefined();

    const law = validateStep("profile", state({ persona: "lawyer" }), NOW);
    expect(law.oabNumber).toBeDefined();
    expect(law.oabUf).toBeDefined();

    const partner = validateStep("profile", state({ persona: "partner_legal" }), NOW);
    expect(partner.partnerCategory).toBeDefined();
    expect(partner.cnpj).toBeUndefined();

    const badCnpj = validateStep(
      "profile",
      state({ persona: "partner_service", partnerCategory: "other", cnpj: "11.111.111/1111-11" }),
      NOW,
    );
    expect(badCnpj.cnpj).toBe("Informe um CNPJ válido.");

    expect(
      validateStep(
        "profile",
        state({ persona: "law_firm", organizationName: "Souza Advogados", cnpj: VALID_CNPJ, oabNumber: "12345", oabUf: "SP" }),
        NOW,
      ),
    ).toEqual({});
  });

  it("valida senha: mínimo 12, comum e confirmação", () => {
    expect(validateStep("password", state({ password: "curta" }), NOW).password).toContain("12");
    expect(
      validateStep("password", state({ password: "password1234", passwordConfirm: "password1234" }), NOW)
        .password,
    ).toBe("Escolha uma senha menos comum.");
    expect(
      validateStep("password", state({ password: "uma-senha-bem-longa-9!", passwordConfirm: "outra" }), NOW)
        .passwordConfirm,
    ).toBe("As senhas não coincidem.");
    expect(
      validateStep(
        "password",
        state({ password: "uma-senha-bem-longa-9!", passwordConfirm: "uma-senha-bem-longa-9!" }),
        NOW,
      ),
    ).toEqual({});
  });

  it("exige termos, privacidade e declaração de representação para PJ", () => {
    const pf = validateStep("review", state({ persona: "client_pf" }), NOW);
    expect(pf.acceptTerms).toBeDefined();
    expect(pf.acceptPrivacy).toBeDefined();
    expect(pf.representationDeclaration).toBeUndefined();

    const pj = validateStep(
      "review",
      state({ persona: "client_pj", acceptTerms: true, acceptPrivacy: true }),
      NOW,
    );
    expect(pj.representationDeclaration).toBeDefined();
  });
});

describe("validateAll e payload", () => {
  it("aponta a primeira etapa inválida", () => {
    const result = validateAll(state({ persona: "client_pf", ...baseFilled, email: "x" }), NOW);
    expect(result?.stepId).toBe("contact");
  });

  it("gera payload aceito pelo onboardingRegisterSchema (cliente PF)", () => {
    const s = state({ persona: "client_pf", ...baseFilled });
    expect(validateAll(s, NOW)).toBeNull();
    const parsed = onboardingRegisterSchema.safeParse(buildRegisterPayload(s));
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.phone).toBe("+5511912345678");
      expect(parsed.data.email).toBe("maria@example.com");
      expect(parsed.data.cpf).toBe("52998224725");
      expect(parsed.data.acceptMarketing).toBe(false);
    }
  });

  it("gera payload aceito para escritório (PJ + OAB + declaração)", () => {
    const s = state({
      persona: "law_firm",
      ...baseFilled,
      organizationName: "Souza Advogados",
      cnpj: VALID_CNPJ,
      oabNumber: "12.345",
      oabUf: "sp",
      representationDeclaration: true,
    });
    expect(validateAll(s, NOW)).toBeNull();
    const payload = buildRegisterPayload(s);
    expect(payload.oabNumber).toBe("12345");
    expect(payload.cnpj).toBe("11222333000181");
    expect(payload).not.toHaveProperty("partnerCategory");
    expect(onboardingRegisterSchema.safeParse(payload).success).toBe(true);
  });

  it("gera payload aceito para parceiro e omite campos irrelevantes", () => {
    const s = state({
      persona: "partner_legal",
      ...baseFilled,
      partnerCategory: "correspondent",
      organizationName: "",
      cnpj: "",
    });
    expect(validateAll(s, NOW)).toBeNull();
    const payload = buildRegisterPayload(s);
    expect(payload).not.toHaveProperty("organizationName");
    expect(payload).not.toHaveProperty("birthDate");
    expect(payload).not.toHaveProperty("representationDeclaration");
    expect(onboardingRegisterSchema.safeParse(payload).success).toBe(true);
  });
});

describe("máscaras", () => {
  it("formata CPF, CEP e telefone", () => {
    expect(maskCpf("52998224725")).toBe("529.982.247-25");
    expect(maskCep("01310100")).toBe("01310-100");
    expect(maskPhone("11912345678")).toBe("(11) 91234-5678");
    expect(maskPhone("1")).toBe("(1");
  });
});

describe("passwordStrength", () => {
  it("classifica senhas", () => {
    expect(passwordStrength("").score).toBe(0);
    expect(passwordStrength("password1234").score).toBe(0);
    expect(passwordStrength("curta").score).toBe(1);
    expect(passwordStrength("uma-senha-bem-longa-9!").score).toBeGreaterThanOrEqual(2);
  });
});

describe("mapServerErrors", () => {
  it("mapeia caminhos do servidor para campos e etapa mais antiga", () => {
    const { errors, firstStep } = mapServerErrors([
      { path: "address.postalCode", message: "CEP inválido" },
      { path: "email", message: "E-mail inválido" },
      { path: "desconhecido", message: "x" },
    ]);
    expect(errors.postalCode).toBe("CEP inválido");
    expect(errors.email).toBe("E-mail inválido");
    expect(firstStep).toBe("contact");
    expect(mapServerErrors(undefined)).toEqual({ errors: {}, firstStep: null });
  });
});

describe("resolveWizardRedirect", () => {
  it("prefere ?redirect= seguro sob /app ou /portal", () => {
    expect(resolveWizardRedirect("/app/processos", "/portal")).toBe("/app/processos");
    expect(resolveWizardRedirect("/portal/casos?x=1", "/app")).toBe("/portal/casos?x=1");
  });

  it("ignora redirects seguros fora de /app e /portal", () => {
    expect(resolveWizardRedirect("/checkout?plano=essencial", "/app")).toBe("/app");
    expect(resolveWizardRedirect("/marketplace", "/portal")).toBe("/portal");
  });

  it("ignora redirects inseguros e usa o da API", () => {
    expect(resolveWizardRedirect("//evil.com", "/portal")).toBe("/portal");
    expect(resolveWizardRedirect("https://evil.com/app", "/app")).toBe("/app");
    expect(resolveWizardRedirect("/app/../admin", "/portal")).toBe("/portal");
  });

  it("cai para /app se o redirectTo da API for inválido ou ausente", () => {
    expect(resolveWizardRedirect(null, undefined)).toBe("/app");
    expect(resolveWizardRedirect(null, "https://evil.com")).toBe("/app");
    expect(resolveWizardRedirect(null, "/portal")).toBe("/portal");
  });
});
