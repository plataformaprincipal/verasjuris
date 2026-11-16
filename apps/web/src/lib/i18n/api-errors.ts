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
} from "@verasjuris/validation";
import type { ApiFailure } from "../types";

type Translate = (key: string, fallback?: string) => string;

/**
 * Stable API error codes → catalog keys.
 * Prefer code (and field path) over comparing free-form message text.
 */
const CODE_KEYS: Record<string, string> = {
  VALIDATION_ERROR: "errors.validation",
  CONFLICT: "errors.conflict",
  RATE_LIMIT: "errors.rateLimited",
  RATE_LIMITED: "errors.rateLimited",
  AUTHENTICATION_ERROR: "errors.unauthorized",
  UNAUTHORIZED: "errors.unauthorized",
  AUTHORIZATION_ERROR: "errors.forbidden",
  FORBIDDEN: "errors.forbidden",
  NOT_FOUND: "errors.notFound",
  UNAVAILABLE: "errors.unavailable",
  SERVICE_UNAVAILABLE: "errors.unavailable",
  NOT_CONFIGURED: "errors.unavailable",
  AI_PROVIDER_NOT_CONFIGURED: "errors.unavailable",
  OCR_PROVIDER_NOT_CONFIGURED: "errors.unavailable",
  INTERNAL_ERROR: "errors.unexpected",
  INTERNAL_SERVER_ERROR: "errors.unexpected",
  PAYMENT_FAILED: "errors.paymentFailed",
  PAYMENT_PROVIDER_NOT_CONFIGURED: "errors.paymentUnavailable",
  NETWORK: "errors.network",
  NETWORK_ERROR: "errors.network",
};

/** Field paths → catalog keys when no more specific source-message match applies. */
const FIELD_KEYS: Record<string, string> = {
  password: "register.validation.password.requirements",
  passwordConfirm: "register.validation.password.mismatch",
  email: "register.validation.email",
  birthDate: "register.validation.birthDate.required",
  fullName: "register.validation.fullName",
  displayName: "register.validation.fullName",
  cpf: "register.validation.cpf",
  cnpj: "register.validation.cnpj",
  phone: "register.validation.phone",
  oabNumber: "register.validation.oab",
  oabUf: "register.validation.oabUf",
  acceptTerms: "register.validation.terms",
  acceptPrivacy: "register.validation.privacy",
  representationDeclaration: "register.validation.representation",
  persona: "register.validation.persona",
  postalCode: "register.validation.cep",
  "address.postalCode": "register.validation.cep",
  partnerCategory: "register.validation.partnerCategory",
};

/**
 * Exact source messages from @verasjuris/validation (stable tokens, not UI copy matching).
 * Used to distinguish multiple outcomes that share the same field path.
 */
const SOURCE_MESSAGE_KEYS: Record<string, string> = {
  [PASSWORD_REQUIRED_MESSAGE]: "register.validation.password.required",
  [PASSWORD_MIN_LENGTH_MESSAGE]: "register.validation.password.minLength",
  [PASSWORD_REQUIREMENT_MESSAGE]: "register.validation.password.requirements",
  [PASSWORD_COMMON_MESSAGE]: "register.validation.password.common",
  [PASSWORD_TOO_LONG_MESSAGE]: "register.validation.password.tooLong",
  [BIRTH_DATE_REQUIRED_MESSAGE]: "register.validation.birthDate.required",
  [BIRTH_DATE_INVALID_MESSAGE]: "register.validation.birthDate.invalid",
  [BIRTH_DATE_FUTURE_MESSAGE]: "register.validation.birthDate.future",
  [BIRTH_DATE_UNDERAGE_MESSAGE]: "register.validation.birthDate.underage",
};

export function mapErrorCode(code: string | undefined, t: Translate, fallback?: string): string {
  if (!code) return fallback ?? t("errors.unavailable");
  const key = CODE_KEYS[code];
  if (key) return t(key, fallback);
  return fallback ?? t("errors.unavailable");
}

/** @deprecated Prefer mapErrorCode — kept for existing call sites. */
export function translateApiErrorCode(
  code: string | undefined,
  t: Translate,
  fallback?: string,
): string {
  return mapErrorCode(code, t, fallback);
}

export function translateFieldError(
  path: string,
  message: string | undefined,
  t: Translate,
): string {
  if (message) {
    const bySource = SOURCE_MESSAGE_KEYS[message];
    if (bySource) return t(bySource, message);
  }
  const leaf = path.includes(".") ? (path.split(".").at(-1) ?? path) : path;
  const fieldKey = FIELD_KEYS[path] ?? FIELD_KEYS[leaf];
  if (fieldKey) return t(fieldKey, message);
  return message ?? t("errors.validation");
}

export function translateApiFailure(data: ApiFailure, t: Translate, fallback?: string): string {
  const code = data.error?.code;
  if (code === "CONFLICT") {
    return t("register.errors.conflict", fallback ?? data.error?.message);
  }
  if (code && CODE_KEYS[code]) {
    return mapErrorCode(code, t, fallback ?? data.error?.message);
  }
  return data.error?.message ?? fallback ?? t("errors.unavailable");
}

export function translateApiFieldErrors(
  details: Array<{ path: string; message: string }> | undefined,
  t: Translate,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const detail of details ?? []) {
    if (!detail.path || out[detail.path]) continue;
    out[detail.path] = translateFieldError(detail.path, detail.message, t);
  }
  return out;
}
