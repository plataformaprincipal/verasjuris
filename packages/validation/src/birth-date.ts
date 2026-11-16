/**
 * Idade mínima provisória para cadastro no VerasJuris.
 * Decisão documentada para aprovação antes da publicação em produção.
 * Se a política oficial definir outro valor, ajustar MIN_ACCOUNT_AGE_YEARS
 * e a mensagem correspondente.
 */
export const MIN_ACCOUNT_AGE_YEARS = 18;
export const MAX_ACCOUNT_AGE_YEARS = 120;

export const BIRTH_DATE_INVALID_MESSAGE = "Informe uma data de nascimento válida.";
export const BIRTH_DATE_FUTURE_MESSAGE =
  "A data de nascimento não pode ser posterior à data atual.";
export const BIRTH_DATE_UNDERAGE_MESSAGE =
  "Para criar uma conta no VerasJuris, você deve ter pelo menos 18 anos de idade.";
export const BIRTH_DATE_REQUIRED_MESSAGE = "Informe a data de nascimento.";

/** Parseia AAAA-MM-DD como data de calendário real (rejeita 2024-02-31 etc.). */
export function parseCalendarDate(
  value: string,
): { year: number; month: number; day: number } | null {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const [yearRaw, monthRaw, dayRaw] = trimmed.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const probe = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (
    Number.isNaN(probe.getTime()) ||
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

/** Idade completa em anos no fuso UTC, respeitando dia/mês e anos bissextos. */
export function ageInFullYears(
  birth: { year: number; month: number; day: number },
  now: Date = new Date(),
): number {
  const nowYear = now.getUTCFullYear();
  const nowMonth = now.getUTCMonth() + 1;
  const nowDay = now.getUTCDate();
  let age = nowYear - birth.year;
  if (nowMonth < birth.month || (nowMonth === birth.month && nowDay < birth.day)) {
    age -= 1;
  }
  return age;
}

export function validateBirthDateValue(value: string, now: Date = new Date()): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return BIRTH_DATE_REQUIRED_MESSAGE;

  const parsed = parseCalendarDate(trimmed);
  if (!parsed) return BIRTH_DATE_INVALID_MESSAGE;

  const birthUtc = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, 12, 0, 0));
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0),
  );
  if (birthUtc.getTime() > todayUtc.getTime()) return BIRTH_DATE_FUTURE_MESSAGE;

  const age = ageInFullYears(parsed, now);
  if (age > MAX_ACCOUNT_AGE_YEARS) return BIRTH_DATE_INVALID_MESSAGE;
  if (age < MIN_ACCOUNT_AGE_YEARS) return BIRTH_DATE_UNDERAGE_MESSAGE;
  return undefined;
}
