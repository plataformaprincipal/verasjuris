import {
  formatCep,
  formatCnpj,
  formatCpf,
  isCommonPassword,
  isValidCep,
  isValidCnpj,
  isValidCpf,
  passwordStrength,
  toE164BrMobile,
} from "./br-masks";
import { isSafeRedirectPath, resolvePostAuthRedirect } from "./safe-redirect";

/**
 * Personas oferecidas no cadastro público. Colaboradores (employee) entram por convite
 * e administradores nunca são criados por cadastro público.
 */
export const PUBLIC_PERSONAS = [
  "client_pf",
  "client_pj",
  "lawyer",
  "law_firm",
  "corporate_legal",
  "partner_legal",
  "partner_service",
] as const;

export type WizardPersona = (typeof PUBLIC_PERSONAS)[number];

export type WizardStepId =
  | "persona"
  | "identification"
  | "contact"
  | "address"
  | "profile"
  | "password"
  | "review";

export const STEP_TITLES: Record<WizardStepId, string> = {
  persona: "Perfil",
  identification: "Identificação",
  contact: "Contato",
  address: "Endereço",
  profile: "Dados profissionais",
  password: "Senha",
  review: "Revisão",
};

export const PARTNER_CATEGORIES = [
  { value: "correspondent", label: "Correspondente jurídico" },
  { value: "accountant", label: "Contabilidade" },
  { value: "expert", label: "Perito / assistente técnico" },
  { value: "translator", label: "Tradução juramentada" },
  { value: "dispatcher", label: "Despachante" },
  { value: "teacher", label: "Educação / treinamento" },
  { value: "specialist", label: "Especialista" },
  { value: "supplier", label: "Fornecedor" },
  { value: "other", label: "Outro" },
] as const;

export const BR_STATES = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

export type WizardState = {
  persona: WizardPersona | "";
  fullName: string;
  socialName: string;
  cpf: string;
  birthDate: string;
  email: string;
  phone: string;
  postalCode: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  organizationName: string;
  tradeName: string;
  cnpj: string;
  jobTitle: string;
  oabNumber: string;
  oabUf: string;
  practiceAreas: string;
  partnerCategory: string;
  partnerDescription: string;
  /** Mantido apenas em memória do componente; nunca persistido. */
  password: string;
  passwordConfirm: string;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  acceptMarketing: boolean;
  representationDeclaration: boolean;
};

export type WizardErrors = Partial<Record<keyof WizardState, string>>;

export const INITIAL_WIZARD_STATE: WizardState = {
  persona: "",
  fullName: "",
  socialName: "",
  cpf: "",
  birthDate: "",
  email: "",
  phone: "",
  postalCode: "",
  street: "",
  number: "",
  complement: "",
  district: "",
  city: "",
  state: "",
  organizationName: "",
  tradeName: "",
  cnpj: "",
  jobTitle: "",
  oabNumber: "",
  oabUf: "",
  practiceAreas: "",
  partnerCategory: "",
  partnerDescription: "",
  password: "",
  passwordConfirm: "",
  acceptTerms: false,
  acceptPrivacy: false,
  acceptMarketing: false,
  representationDeclaration: false,
};

// ---------------------------------------------------------------------------
// Regras por persona
// ---------------------------------------------------------------------------

export function isPublicPersona(value: unknown): value is WizardPersona {
  return typeof value === "string" && (PUBLIC_PERSONAS as readonly string[]).includes(value);
}

export function personaNeedsBirthDate(persona: WizardState["persona"]): boolean {
  return persona === "client_pf" || persona === "lawyer";
}

/** Pessoas jurídicas que exigem organização, CNPJ e declaração de representação. */
export function personaIsOrganization(persona: WizardState["persona"]): boolean {
  return persona === "client_pj" || persona === "law_firm" || persona === "corporate_legal";
}

export function personaNeedsOab(persona: WizardState["persona"]): boolean {
  return persona === "lawyer" || persona === "law_firm";
}

export function personaIsPartner(persona: WizardState["persona"]): boolean {
  return persona === "partner_legal" || persona === "partner_service";
}

/** Cliente pessoa física não possui campos profissionais específicos. */
export function personaHasProfileStep(persona: WizardState["persona"]): boolean {
  return persona !== "" && persona !== "client_pf";
}

export function getWizardSteps(persona: WizardState["persona"]): WizardStepId[] {
  const steps: WizardStepId[] = ["persona", "identification", "contact", "address"];
  if (personaHasProfileStep(persona)) steps.push("profile");
  steps.push("password", "review");
  return steps;
}

// ---------------------------------------------------------------------------
// Máscaras
// ---------------------------------------------------------------------------

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function maskCpf(value: string): string {
  return formatCpf(digitsOnly(value).slice(0, 11));
}

export function maskCnpj(value: string): string {
  return formatCnpj(digitsOnly(value).slice(0, 14));
}

export function maskCep(value: string): string {
  return formatCep(digitsOnly(value).slice(0, 8));
}

/** Máscara de celular brasileiro (sem DDI): (11) 91234-5678. */
export function maskPhone(value: string): string {
  const digits = digitsOnly(value).slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

// ---------------------------------------------------------------------------
// Validação por etapa (espelha onboardingRegisterSchema; o servidor continua a autoridade)
// ---------------------------------------------------------------------------

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateBirthDate(value: string, now: Date = new Date()): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return "Informe a data de nascimento.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return "Informe uma data de nascimento válida.";
  const date = new Date(`${trimmed}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date > now) return "Informe uma data de nascimento válida.";
  const years = (now.getTime() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  if (years < 16 || years > 120) return "Informe uma data de nascimento válida.";
  return undefined;
}

export function validatePasswordFields(
  password: string,
  passwordConfirm: string,
): Pick<WizardErrors, "password" | "passwordConfirm"> {
  const errors: Pick<WizardErrors, "password" | "passwordConfirm"> = {};
  if (password.length < 12) errors.password = "A senha precisa ter pelo menos 12 caracteres.";
  else if (password.length > 128) errors.password = "A senha é longa demais.";
  else if (isCommonPassword(password)) errors.password = "Escolha uma senha menos comum.";
  if (!passwordConfirm) errors.passwordConfirm = "Confirme a senha.";
  else if (password !== passwordConfirm) errors.passwordConfirm = "As senhas não coincidem.";
  return errors;
}

export function validateStep(
  step: WizardStepId,
  state: WizardState,
  now: Date = new Date(),
): WizardErrors {
  const errors: WizardErrors = {};
  const persona = state.persona;

  switch (step) {
    case "persona": {
      if (!isPublicPersona(persona)) errors.persona = "Selecione como você usará a VerasJuris.";
      break;
    }
    case "identification": {
      const name = state.fullName.trim();
      if (name.length < 2) errors.fullName = "Informe o nome completo.";
      else if (name.length > 120) errors.fullName = "O nome é longo demais.";
      else if (name.split(/\s+/).filter(Boolean).length < 2) {
        errors.fullName = "Informe nome e sobrenome.";
      }
      if (state.socialName.trim().length > 120) errors.socialName = "O nome social é longo demais.";
      if (!state.cpf.trim()) errors.cpf = "Informe o CPF.";
      else if (!isValidCpf(state.cpf)) errors.cpf = "Informe um CPF válido.";
      if (personaNeedsBirthDate(persona)) {
        const birthError = validateBirthDate(state.birthDate, now);
        if (birthError) errors.birthDate = birthError;
      }
      break;
    }
    case "contact": {
      const email = state.email.trim();
      if (!email) errors.email = "Informe o e-mail.";
      else if (email.length > 320 || !EMAIL_PATTERN.test(email)) {
        errors.email = "Informe um e-mail válido.";
      }
      if (!state.phone.trim()) errors.phone = "Informe o telefone.";
      else if (!toE164BrMobile(state.phone)) errors.phone = "Informe um celular válido com DDD.";
      break;
    }
    case "address": {
      if (!isValidCep(state.postalCode)) errors.postalCode = "Informe um CEP válido.";
      if (state.street.trim().length < 2) errors.street = "Informe o logradouro.";
      if (!state.number.trim()) errors.number = "Informe o número (ou S/N).";
      if (state.district.trim().length < 2) errors.district = "Informe o bairro.";
      if (state.city.trim().length < 2) errors.city = "Informe a cidade.";
      if (!(BR_STATES as readonly string[]).includes(state.state.trim().toUpperCase())) {
        errors.state = "Informe a UF com 2 letras.";
      }
      break;
    }
    case "profile": {
      if (personaIsOrganization(persona)) {
        if (state.organizationName.trim().length < 2) {
          errors.organizationName = "Informe a razão social ou nome da organização.";
        }
        if (!state.cnpj.trim()) errors.cnpj = "Informe o CNPJ.";
        else if (!isValidCnpj(state.cnpj)) errors.cnpj = "Informe um CNPJ válido.";
      }
      if (personaIsPartner(persona)) {
        if (!PARTNER_CATEGORIES.some((item) => item.value === state.partnerCategory)) {
          errors.partnerCategory = "Informe a categoria de atuação.";
        }
        if (state.organizationName.trim() && state.organizationName.trim().length < 2) {
          errors.organizationName = "Informe o nome da organização com pelo menos 2 caracteres.";
        }
        if (state.cnpj.trim() && !isValidCnpj(state.cnpj)) errors.cnpj = "Informe um CNPJ válido.";
        if (state.partnerDescription.trim().length > 600) {
          errors.partnerDescription = "A descrição pode ter no máximo 600 caracteres.";
        }
      }
      if (personaNeedsOab(persona)) {
        const oabNumber = digitsOnly(state.oabNumber);
        if (!oabNumber) errors.oabNumber = "Informe o número da OAB.";
        else if (oabNumber.length > 20) errors.oabNumber = "O número da OAB é longo demais.";
        if (!(BR_STATES as readonly string[]).includes(state.oabUf.trim().toUpperCase())) {
          errors.oabUf = "Informe a seccional da OAB.";
        }
        if (state.practiceAreas.trim().length > 400) {
          errors.practiceAreas = "As áreas de atuação podem ter no máximo 400 caracteres.";
        }
      }
      if (state.jobTitle.trim().length > 80) errors.jobTitle = "O cargo pode ter no máximo 80 caracteres.";
      if (state.tradeName.trim().length > 120) {
        errors.tradeName = "O nome fantasia pode ter no máximo 120 caracteres.";
      }
      break;
    }
    case "password": {
      Object.assign(errors, validatePasswordFields(state.password, state.passwordConfirm));
      break;
    }
    case "review": {
      if (!state.acceptTerms) errors.acceptTerms = "Aceite os Termos de Uso para continuar.";
      if (!state.acceptPrivacy) {
        errors.acceptPrivacy = "Aceite a Política de Privacidade para continuar.";
      }
      if (personaIsOrganization(persona) && !state.representationDeclaration) {
        errors.representationDeclaration = "Declare que possui poderes de representação.";
      }
      break;
    }
  }

  return errors;
}

/** Valida todas as etapas aplicáveis; retorna a primeira com erro (para navegação). */
export function validateAll(
  state: WizardState,
  now: Date = new Date(),
): { stepId: WizardStepId; errors: WizardErrors } | null {
  for (const step of getWizardSteps(state.persona)) {
    const errors = validateStep(step, state, now);
    if (Object.keys(errors).length > 0) return { stepId: step, errors };
  }
  return null;
}

export function hasErrors(errors: WizardErrors): boolean {
  return Object.keys(errors).length > 0;
}

// ---------------------------------------------------------------------------
// Payload
// ---------------------------------------------------------------------------

function optional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

/** Monta o corpo do POST /api/v1/auth/register. Campos vazios/irrelevantes são omitidos. */
export function buildRegisterPayload(state: WizardState): Record<string, unknown> {
  const persona = state.persona;
  const phone = toE164BrMobile(state.phone) ?? state.phone.trim();
  const payload: Record<string, unknown> = {
    persona,
    fullName: state.fullName.trim(),
    socialName: optional(state.socialName),
    cpf: digitsOnly(state.cpf),
    birthDate: personaNeedsBirthDate(persona) ? state.birthDate.trim() : undefined,
    email: state.email.trim().toLowerCase(),
    phone,
    address: {
      postalCode: digitsOnly(state.postalCode),
      street: state.street.trim(),
      number: state.number.trim(),
      complement: optional(state.complement),
      district: state.district.trim(),
      city: state.city.trim(),
      state: state.state.trim().toUpperCase(),
      country: "Brasil",
    },
    password: state.password,
    passwordConfirm: state.passwordConfirm,
    acceptTerms: state.acceptTerms,
    acceptPrivacy: state.acceptPrivacy,
    acceptMarketing: state.acceptMarketing,
  };

  if (personaIsOrganization(persona) || personaIsPartner(persona)) {
    payload.organizationName = optional(state.organizationName);
    payload.cnpj = state.cnpj.trim() ? digitsOnly(state.cnpj) : undefined;
  }
  if (personaIsOrganization(persona)) {
    payload.tradeName = optional(state.tradeName);
    payload.jobTitle = optional(state.jobTitle);
    payload.representationDeclaration = state.representationDeclaration;
  }
  if (personaNeedsOab(persona)) {
    payload.oabNumber = digitsOnly(state.oabNumber);
    payload.oabUf = state.oabUf.trim().toUpperCase();
    payload.practiceAreas = optional(state.practiceAreas);
  }
  if (personaIsPartner(persona)) {
    payload.partnerCategory = state.partnerCategory;
    payload.partnerDescription = optional(state.partnerDescription);
  }

  for (const key of Object.keys(payload)) {
    if (payload[key] === undefined) delete payload[key];
  }
  return payload;
}

// ---------------------------------------------------------------------------
// Erros do servidor → campos/etapas
// ---------------------------------------------------------------------------

const SERVER_PATH_TO_FIELD: Record<string, keyof WizardState> = {
  persona: "persona",
  fullName: "fullName",
  socialName: "socialName",
  cpf: "cpf",
  birthDate: "birthDate",
  email: "email",
  phone: "phone",
  "address.postalCode": "postalCode",
  "address.street": "street",
  "address.number": "number",
  "address.complement": "complement",
  "address.district": "district",
  "address.city": "city",
  "address.state": "state",
  organizationName: "organizationName",
  tradeName: "tradeName",
  cnpj: "cnpj",
  jobTitle: "jobTitle",
  oabNumber: "oabNumber",
  oabUf: "oabUf",
  practiceAreas: "practiceAreas",
  partnerCategory: "partnerCategory",
  partnerDescription: "partnerDescription",
  password: "password",
  passwordConfirm: "passwordConfirm",
  acceptTerms: "acceptTerms",
  acceptPrivacy: "acceptPrivacy",
  representationDeclaration: "representationDeclaration",
};

export const FIELD_STEP: Record<keyof WizardState, WizardStepId> = {
  persona: "persona",
  fullName: "identification",
  socialName: "identification",
  cpf: "identification",
  birthDate: "identification",
  email: "contact",
  phone: "contact",
  postalCode: "address",
  street: "address",
  number: "address",
  complement: "address",
  district: "address",
  city: "address",
  state: "address",
  organizationName: "profile",
  tradeName: "profile",
  cnpj: "profile",
  jobTitle: "profile",
  oabNumber: "profile",
  oabUf: "profile",
  practiceAreas: "profile",
  partnerCategory: "profile",
  partnerDescription: "profile",
  password: "password",
  passwordConfirm: "password",
  acceptTerms: "review",
  acceptPrivacy: "review",
  acceptMarketing: "review",
  representationDeclaration: "review",
};

export function mapServerErrors(
  details: Array<{ path: string; message: string }> | undefined,
): { errors: WizardErrors; firstStep: WizardStepId | null } {
  const errors: WizardErrors = {};
  let firstStep: WizardStepId | null = null;
  const order: WizardStepId[] = [
    "persona",
    "identification",
    "contact",
    "address",
    "profile",
    "password",
    "review",
  ];
  for (const detail of details ?? []) {
    const field = SERVER_PATH_TO_FIELD[detail.path];
    if (!field || errors[field]) continue;
    errors[field] = detail.message;
    const step = FIELD_STEP[field];
    if (!firstStep || order.indexOf(step) < order.indexOf(firstStep)) firstStep = step;
  }
  return { errors, firstStep };
}

// ---------------------------------------------------------------------------
// Redirecionamento
// ---------------------------------------------------------------------------

function isUnderAppOrPortal(path: string): boolean {
  const pathname = path.split(/[?#]/, 1)[0] ?? "";
  return (
    pathname === "/app" ||
    pathname.startsWith("/app/") ||
    pathname === "/portal" ||
    pathname.startsWith("/portal/")
  );
}

/**
 * Prefere ?redirect= apenas quando seguro E dentro de /app ou /portal; caso contrário usa o
 * redirectTo da API (validado), com /app como último recurso.
 */
export function resolveWizardRedirect(
  redirectParam: string | null | undefined,
  apiRedirectTo: string | null | undefined,
): string {
  if (redirectParam && isSafeRedirectPath(redirectParam) && isUnderAppOrPortal(redirectParam)) {
    return resolvePostAuthRedirect(redirectParam);
  }
  if (apiRedirectTo && isSafeRedirectPath(apiRedirectTo)) return apiRedirectTo;
  return "/app";
}

export { passwordStrength };
