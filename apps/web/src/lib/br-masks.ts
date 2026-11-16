import {
  formatCep,
  formatCnpj,
  formatCpf,
  isCommonPassword,
  isValidCep,
  isValidCnpj,
  isValidCpf,
  passwordStrength as sharedPasswordStrength,
  toE164BrMobile,
  type PasswordRequirements,
} from "@verasjuris/validation";

export {
  formatCep,
  formatCnpj,
  formatCpf,
  isCommonPassword,
  isValidCep,
  isValidCnpj,
  isValidCpf,
  toE164BrMobile,
};

export type { PasswordRequirements };

export function passwordStrength(password: string): {
  score: 0 | 1 | 2 | 3;
  label: string;
  classification: "nao_atende" | "boa" | "excelente";
  requirements: PasswordRequirements;
} {
  return sharedPasswordStrength(password);
}
