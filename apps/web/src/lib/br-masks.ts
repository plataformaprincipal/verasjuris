import {
  formatCep,
  formatCnpj,
  formatCpf,
  isCommonPassword,
  isValidCep,
  isValidCnpj,
  isValidCpf,
  toE164BrMobile,
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

export function passwordStrength(password: string): {
  score: 0 | 1 | 2 | 3;
  label: string;
} {
  if (!password) return { score: 0, label: "Informe uma senha" };
  let score = 0;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  if (/[^\s]/.test(password) && new Set(password).size >= 6) score += 1;
  if (isCommonPassword(password)) return { score: 0, label: "Senha muito comum" };
  if (score <= 1) return { score: 1, label: "Fraca" };
  if (score === 2) return { score: 2, label: "Adequada" };
  return { score: 3, label: "Forte" };
}
