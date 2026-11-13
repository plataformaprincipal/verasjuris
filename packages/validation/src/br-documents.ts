/** Validação matemática de CPF/CNPJ — não prova existência na Receita. */

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function allSameDigits(value: string): boolean {
  return /^(\d)\1+$/.test(value);
}

export function isValidCpf(value: string): boolean {
  const cpf = digitsOnly(value);
  if (cpf.length !== 11 || allSameDigits(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += Number(cpf[i]) * (10 - i);
  let check = (sum * 10) % 11;
  if (check === 10) check = 0;
  if (check !== Number(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i += 1) sum += Number(cpf[i]) * (11 - i);
  check = (sum * 10) % 11;
  if (check === 10) check = 0;
  return check === Number(cpf[10]);
}

export function isValidCnpj(value: string): boolean {
  const cnpj = digitsOnly(value);
  if (cnpj.length !== 14 || allSameDigits(cnpj)) return false;
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i += 1) sum += Number(cnpj[i]) * weights1[i]!;
  let check = sum % 11;
  check = check < 2 ? 0 : 11 - check;
  if (check !== Number(cnpj[12])) return false;
  sum = 0;
  for (let i = 0; i < 13; i += 1) sum += Number(cnpj[i]) * weights2[i]!;
  check = sum % 11;
  check = check < 2 ? 0 : 11 - check;
  return check === Number(cnpj[13]);
}

export function formatCpf(value: string): string {
  const d = digitsOnly(value).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function formatCnpj(value: string): string {
  const d = digitsOnly(value).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function formatCep(value: string): string {
  const d = digitsOnly(value).slice(0, 8);
  return d.replace(/^(\d{5})(\d)/, "$1-$2");
}

export function isValidCep(value: string): boolean {
  return digitsOnly(value).length === 8;
}

/** Celular BR → E.164 (+55…). Aceita 10–11 dígitos nacionais. */
export function toE164BrMobile(value: string, countryCode = "55"): string | null {
  let digits = digitsOnly(value);
  if (digits.startsWith(countryCode) && digits.length > 11) {
    digits = digits.slice(countryCode.length);
  }
  if (digits.length === 10 || digits.length === 11) {
    return `+${countryCode}${digits}`;
  }
  return null;
}

const COMMON_PASSWORDS = new Set(
  [
    "123456789012",
    "password1234",
    "senha1234567",
    "qwertyuiopas",
    "abcdefghijkl",
    "verasjuris12",
    "passwordpassword",
    "123456123456",
  ].map((item) => item.toLowerCase()),
);

export function isCommonPassword(password: string): boolean {
  const normalized = password.trim().toLowerCase();
  if (COMMON_PASSWORDS.has(normalized)) return true;
  if (/^(.)\1{11,}$/.test(normalized)) return true;
  if (/^(0123456789|9876543210)/.test(normalized)) return true;
  return false;
}
