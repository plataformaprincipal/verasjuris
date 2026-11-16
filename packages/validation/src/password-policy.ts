import { z } from "zod";
import { isCommonPassword } from "./br-documents.js";

/**
 * Política de senha do VerasJuris.
 * - Mínimo aceito (BOA): 8 caracteres + composição completa.
 * - EXCELENTE: 12+ caracteres + composição completa.
 * Classificação é indicador de conformidade, não garantia criptográfica.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_EXCELLENT_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export const PASSWORD_REQUIREMENT_MESSAGE =
  "A senha deve ter pelo menos 8 caracteres, com letra maiúscula, minúscula, número e caractere especial.";
export const PASSWORD_REQUIRED_MESSAGE = "Informe a senha.";
export const PASSWORD_MIN_LENGTH_MESSAGE = "A senha precisa ter pelo menos 8 caracteres.";
export const PASSWORD_TOO_LONG_MESSAGE = "A senha é longa demais.";
export const PASSWORD_COMMON_MESSAGE = "Escolha uma senha menos comum.";

export type PasswordRequirements = {
  minLength: boolean;
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
  special: boolean;
  notCommon: boolean;
};

export type PasswordClassification = "nao_atende" | "boa" | "excelente";

export function evaluatePasswordRequirements(password: string): PasswordRequirements {
  return {
    minLength: password.length >= PASSWORD_MIN_LENGTH,
    uppercase: /[A-ZÀ-ÖØ-Þ]/.test(password),
    lowercase: /[a-zà-öø-ÿ]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-zÀ-ÖØ-Þà-öø-ÿ0-9]/.test(password),
    notCommon: password.length === 0 ? true : !isCommonPassword(password),
  };
}

export function passwordMeetsComposition(requirements: PasswordRequirements): boolean {
  return (
    requirements.minLength &&
    requirements.uppercase &&
    requirements.lowercase &&
    requirements.number &&
    requirements.special
  );
}

export function isPasswordAcceptable(password: string): boolean {
  const requirements = evaluatePasswordRequirements(password);
  return (
    password.length <= PASSWORD_MAX_LENGTH &&
    passwordMeetsComposition(requirements) &&
    requirements.notCommon
  );
}

export function classifyPassword(password: string): PasswordClassification {
  if (!password) return "nao_atende";
  const requirements = evaluatePasswordRequirements(password);
  if (!passwordMeetsComposition(requirements) || !requirements.notCommon) return "nao_atende";
  if (password.length >= PASSWORD_EXCELLENT_LENGTH) return "excelente";
  return "boa";
}

export function passwordStrength(password: string): {
  score: 0 | 1 | 2 | 3;
  label: string;
  classification: PasswordClassification;
  requirements: PasswordRequirements;
} {
  const requirements = evaluatePasswordRequirements(password);
  const classification = classifyPassword(password);
  if (!password) {
    return { score: 0, label: "Informe uma senha", classification, requirements };
  }
  if (!requirements.notCommon) {
    return { score: 0, label: "Senha muito comum", classification: "nao_atende", requirements };
  }
  if (classification === "nao_atende") {
    return { score: 1, label: "Não atende", classification, requirements };
  }
  if (classification === "boa") {
    return { score: 2, label: "Boa", classification, requirements };
  }
  return { score: 3, label: "Excelente", classification, requirements };
}

export function passwordPolicyError(password: string): string | undefined {
  if (!password) return PASSWORD_REQUIRED_MESSAGE;
  if (password.length > PASSWORD_MAX_LENGTH) return PASSWORD_TOO_LONG_MESSAGE;
  const requirements = evaluatePasswordRequirements(password);
  if (!requirements.minLength) {
    return PASSWORD_MIN_LENGTH_MESSAGE;
  }
  // Prefer the common-password signal (aligned with passwordStrength) before composition gaps.
  if (!requirements.notCommon) return PASSWORD_COMMON_MESSAGE;
  if (!passwordMeetsComposition(requirements)) {
    return PASSWORD_REQUIREMENT_MESSAGE;
  }
  return undefined;
}

/** Schema Zod compartilhado (cadastro, reset e troca de senha). */
export const passwordSchema = z
  .string()
  .min(1, PASSWORD_REQUIRED_MESSAGE)
  .max(PASSWORD_MAX_LENGTH, PASSWORD_TOO_LONG_MESSAGE)
  .superRefine((value, ctx) => {
    const error = passwordPolicyError(value);
    if (error && error !== PASSWORD_REQUIRED_MESSAGE) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
    }
  });
