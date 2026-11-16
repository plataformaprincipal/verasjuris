import {
  BIRTH_DATE_FUTURE_MESSAGE,
  BIRTH_DATE_INVALID_MESSAGE,
  BIRTH_DATE_REQUIRED_MESSAGE,
  BIRTH_DATE_UNDERAGE_MESSAGE,
  PASSWORD_COMMON_MESSAGE,
  PASSWORD_MIN_LENGTH_MESSAGE,
  PASSWORD_REQUIREMENT_MESSAGE,
  PASSWORD_REQUIRED_MESSAGE,
  PASSWORD_TOO_LONG_MESSAGE,
  passwordPolicyError,
  validateBirthDateValue,
} from "@verasjuris/validation";
import {
  formatCep,
  formatCnpj,
  formatCpf,
  isValidCep,
  isValidCnpj,
  isValidCpf,
  passwordStrength,
  toE164BrMobile,
} from "./br-masks";
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from "./legal";
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

/** Chaves i18n (`register.step.*`) — traduzir com `t()` no componente. */
export const STEP_TITLES: Record<WizardStepId, string> = {
  persona: "register.step.persona",
  identification: "register.step.identification",
  contact: "register.step.contact",
  address: "register.step.address",
  profile: "register.step.profile",
  password: "register.step.password",
  review: "register.step.review",
};

export const PARTNER_CATEGORIES = [
  { value: "correspondent", labelKey: "register.partner.correspondent" },
  { value: "accountant", labelKey: "register.partner.accountant" },
  { value: "expert", labelKey: "register.partner.expert" },
  { value: "translator", labelKey: "register.partner.translator" },
  { value: "dispatcher", labelKey: "register.partner.dispatcher" },
  { value: "teacher", labelKey: "register.partner.teacher" },
  { value: "specialist", labelKey: "register.partner.specialist" },
  { value: "supplier", labelKey: "register.partner.supplier" },
  { value: "other", labelKey: "register.partner.other" },
] as const;

const BIRTH_ERROR_TO_KEY: Record<string, string> = {
  [BIRTH_DATE_REQUIRED_MESSAGE]: "register.validation.birthDate.required",
  [BIRTH_DATE_INVALID_MESSAGE]: "register.validation.birthDate.invalid",
  [BIRTH_DATE_FUTURE_MESSAGE]: "register.validation.birthDate.future",
  [BIRTH_DATE_UNDERAGE_MESSAGE]: "register.validation.birthDate.underage",
};

const PASSWORD_ERROR_TO_KEY: Record<string, string> = {
  [PASSWORD_REQUIRED_MESSAGE]: "register.validation.password.required",
  [PASSWORD_TOO_LONG_MESSAGE]: "register.validation.password.tooLong",
  [PASSWORD_MIN_LENGTH_MESSAGE]: "register.validation.password.minLength",
  [PASSWORD_REQUIREMENT_MESSAGE]: "register.validation.password.requirements",
  [PASSWORD_COMMON_MESSAGE]: "register.validation.password.common",
};

function birthDateErrorKey(value: string, now: Date): string | undefined {
  const message = validateBirthDateValue(value, now);
  if (!message) return undefined;
  return BIRTH_ERROR_TO_KEY[message] ?? "register.validation.birthDate.invalid";
}

function passwordErrorKey(password: string): string | undefined {
  const message = passwordPolicyError(password);
  if (!message) return undefined;
  return PASSWORD_ERROR_TO_KEY[message] ?? "register.validation.password.requirements";
}

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
  /** Pacote Termos de Uso + Termos de Serviço (campo API `termsVersion`). */
  termsVersion: string;
  /** Política de Privacidade (campo API `privacyVersion`). */
  privacyVersion: string;
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
  termsVersion: CURRENT_TERMS_VERSION,
  privacyVersion: CURRENT_PRIVACY_VERSION,
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
  return birthDateErrorKey(value, now);
}

export function validatePasswordFields(
  password: string,
  passwordConfirm: string,
): Pick<WizardErrors, "password" | "passwordConfirm"> {
  const errors: Pick<WizardErrors, "password" | "passwordConfirm"> = {};
  const passwordError = passwordErrorKey(password);
  if (passwordError) errors.password = passwordError;
  if (!passwordConfirm) errors.passwordConfirm = "register.validation.passwordConfirm";
  else if (password !== passwordConfirm) {
    errors.passwordConfirm = "register.validation.password.mismatch";
  }
  return errors;
}

/** Retorna chaves i18n (`register.validation.*`) por campo — traduzir com `t()` na UI. */
export function validateStep(
  step: WizardStepId,
  state: WizardState,
  now: Date = new Date(),
): WizardErrors {
  const errors: WizardErrors = {};
  const persona = state.persona;

  switch (step) {
    case "persona": {
      if (!isPublicPersona(persona)) errors.persona = "register.validation.persona";
      break;
    }
    case "identification": {
      const name = state.fullName.trim();
      if (name.length < 2) errors.fullName = "register.validation.fullName";
      else if (name.length > 120) errors.fullName = "register.validation.fullNameTooLong";
      else if (name.split(/\s+/).filter(Boolean).length < 2) {
        errors.fullName = "register.validation.fullNameParts";
      }
      if (state.socialName.trim().length > 120) {
        errors.socialName = "register.validation.socialNameTooLong";
      }
      if (!state.cpf.trim()) errors.cpf = "register.validation.cpfRequired";
      else if (!isValidCpf(state.cpf)) errors.cpf = "register.validation.cpf";
      if (personaNeedsBirthDate(persona)) {
        const birthError = validateBirthDate(state.birthDate, now);
        if (birthError) errors.birthDate = birthError;
      }
      break;
    }
    case "contact": {
      const email = state.email.trim();
      if (!email) errors.email = "register.validation.emailRequired";
      else if (email.length > 320 || !EMAIL_PATTERN.test(email)) {
        errors.email = "register.validation.email";
      }
      if (!state.phone.trim()) errors.phone = "register.validation.phoneRequired";
      else if (!toE164BrMobile(state.phone)) errors.phone = "register.validation.phone";
      break;
    }
    case "address": {
      if (!isValidCep(state.postalCode)) errors.postalCode = "register.validation.cep";
      if (state.street.trim().length < 2) errors.street = "register.validation.street";
      if (!state.number.trim()) errors.number = "register.validation.number";
      if (state.district.trim().length < 2) errors.district = "register.validation.district";
      if (state.city.trim().length < 2) errors.city = "register.validation.city";
      if (!(BR_STATES as readonly string[]).includes(state.state.trim().toUpperCase())) {
        errors.state = "register.validation.state";
      }
      break;
    }
    case "profile": {
      if (personaIsOrganization(persona)) {
        if (state.organizationName.trim().length < 2) {
          errors.organizationName = "register.validation.organizationName";
        }
        if (!state.cnpj.trim()) errors.cnpj = "register.validation.cnpjRequired";
        else if (!isValidCnpj(state.cnpj)) errors.cnpj = "register.validation.cnpj";
      }
      if (personaIsPartner(persona)) {
        if (!PARTNER_CATEGORIES.some((item) => item.value === state.partnerCategory)) {
          errors.partnerCategory = "register.validation.partnerCategory";
        }
        if (state.organizationName.trim() && state.organizationName.trim().length < 2) {
          errors.organizationName = "register.validation.organizationNameMin";
        }
        if (state.cnpj.trim() && !isValidCnpj(state.cnpj)) {
          errors.cnpj = "register.validation.cnpj";
        }
        if (state.partnerDescription.trim().length > 600) {
          errors.partnerDescription = "register.validation.partnerDescriptionTooLong";
        }
      }
      if (personaNeedsOab(persona)) {
        const oabNumber = digitsOnly(state.oabNumber);
        if (!oabNumber) errors.oabNumber = "register.validation.oab";
        else if (oabNumber.length > 20) errors.oabNumber = "register.validation.oabTooLong";
        if (!(BR_STATES as readonly string[]).includes(state.oabUf.trim().toUpperCase())) {
          errors.oabUf = "register.validation.oabUf";
        }
        if (state.practiceAreas.trim().length > 400) {
          errors.practiceAreas = "register.validation.practiceAreasTooLong";
        }
      }
      if (state.jobTitle.trim().length > 80) {
        errors.jobTitle = "register.validation.jobTitleTooLong";
      }
      if (state.tradeName.trim().length > 120) {
        errors.tradeName = "register.validation.tradeNameTooLong";
      }
      break;
    }
    case "password": {
      Object.assign(errors, validatePasswordFields(state.password, state.passwordConfirm));
      break;
    }
    case "review": {
      if (!state.acceptTerms) errors.acceptTerms = "register.validation.terms";
      if (!state.acceptPrivacy) errors.acceptPrivacy = "register.validation.privacy";
      if (personaIsOrganization(persona) && !state.representationDeclaration) {
        errors.representationDeclaration = "register.validation.representation";
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

/** displayName do perfil (máx. 80) a partir do nome completo já validado. */
export function displayNameFromFullName(fullName: string): string {
  const trimmed = fullName.trim();
  if (trimmed.length <= 80) return trimmed;
  return trimmed.slice(0, 80).trimEnd();
}

/** Monta o corpo do POST /api/v1/auth/register. Campos vazios/irrelevantes são omitidos. */
export function buildRegisterPayload(state: WizardState): Record<string, unknown> {
  const persona = state.persona;
  const fullName = state.fullName.trim();
  const phone = toE164BrMobile(state.phone) ?? state.phone.trim();
  const payload: Record<string, unknown> = {
    persona,
    fullName,
    displayName: displayNameFromFullName(fullName),
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
    termsVersion: state.termsVersion,
    privacyVersion: state.privacyVersion,
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
  termsVersion: "review",
  privacyVersion: "review",
};

export function mapServerErrors(
  details: Array<{ path: string; message: string }> | undefined,
  translateField?: (path: string, message: string) => string,
): {
  errors: WizardErrors;
  firstStep: WizardStepId | null;
} {
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
    errors[field] = translateField ? translateField(detail.path, detail.message) : detail.message;
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
