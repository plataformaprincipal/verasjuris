import type { HolidayCalendarProvider } from "./types.js";

/**
 * Calendário forense nacional.
 *
 * Cobre feriados nacionais (Lei 662/1949, Lei 6.802/1980, Lei 14.759/2023), datas
 * móveis observadas pelo Judiciário (Carnaval, Sexta-feira Santa, Corpus Christi),
 * o Dia da Justiça (8/12, Lei 1.408/1951), o recesso de expediente de 20/12 a 6/1
 * (Resolução CNJ 244/2016) e a suspensão de prazos de 20/12 a 20/1 (CPC, art. 220).
 *
 * NÃO cobre feriados estaduais e municipais nem portarias de tribunal (expediente
 * suspenso, falhas de sistema). Por isso o prazo calculado continua sugerido e
 * exige conferência humana.
 */

const FIXED_NATIONAL: ReadonlyArray<readonly [number, number, string]> = [
  [1, 1, "Confraternização Universal"],
  [4, 21, "Tiradentes"],
  [5, 1, "Dia do Trabalho"],
  [9, 7, "Independência do Brasil"],
  [10, 12, "Nossa Senhora Aparecida"],
  [11, 2, "Finados"],
  [11, 15, "Proclamação da República"],
  [11, 20, "Dia Nacional de Zumbi e da Consciência Negra"],
  [12, 8, "Dia da Justiça"],
  [12, 25, "Natal"],
];

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher), em UTC. */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function shift(date: Date, days: number): Date {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function key(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Data civil (AAAA-MM-DD) no fuso informado. */
export function civilDate(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return parts;
}

const cache = new Map<number, Map<string, string>>();

/** Mapa AAAA-MM-DD → nome, para um ano. */
export function nationalForensicHolidays(year: number): Map<string, string> {
  const cached = cache.get(year);
  if (cached) return cached;
  const map = new Map<string, string>();
  for (const [month, day, name] of FIXED_NATIONAL) {
    map.set(key(new Date(Date.UTC(year, month - 1, day))), name);
  }
  const easter = easterSunday(year);
  map.set(key(shift(easter, -48)), "Carnaval (segunda-feira)");
  map.set(key(shift(easter, -47)), "Carnaval (terça-feira)");
  map.set(key(shift(easter, -2)), "Sexta-feira Santa");
  map.set(key(shift(easter, 60)), "Corpus Christi");
  cache.set(year, map);
  return map;
}

/** Suspensão de prazos de 20/12 a 20/1, inclusive (CPC, art. 220). */
export function isForensicRecess(isoDate: string): boolean {
  const [, month, day] = isoDate.split("-").map(Number) as [number, number, number];
  return (month === 12 && day >= 20) || (month === 1 && day <= 20);
}

/** Expediente forense suspenso de 20/12 a 6/1 (Resolução CNJ 244/2016). */
export function isExpedientRecess(isoDate: string): boolean {
  const [, month, day] = isoDate.split("-").map(Number) as [number, number, number];
  return (month === 12 && day >= 20) || (month === 1 && day <= 6);
}

export type NonBusinessReason = { date: string; reason: string };

/**
 * Motivo pelo qual a data não conta, ou null se conta.
 * - "counting": contagem de prazo (suspensão até 20/1).
 * - "expedient": dia de expediente forense, usado para a data de publicação.
 */
export function nonBusinessReason(
  isoDate: string,
  mode: "counting" | "expedient" = "counting",
): string | null {
  const date = new Date(`${isoDate}T12:00:00.000Z`);
  const weekday = date.getUTCDay();
  if (weekday === 0) return "domingo";
  if (weekday === 6) return "sábado";
  const holiday = nationalForensicHolidays(date.getUTCFullYear()).get(isoDate);
  if (holiday) return holiday;
  if (mode === "counting" && isForensicRecess(isoDate)) {
    return "prazos suspensos de 20/12 a 20/1 (CPC, art. 220)";
  }
  if (mode === "expedient" && isExpedientRecess(isoDate)) {
    return "recesso forense de 20/12 a 6/1";
  }
  return null;
}

export class NationalForensicHolidayCalendar implements HolidayCalendarProvider {
  readonly status = "READY" as const;
  readonly coverage =
    "Feriados nacionais, datas forenses móveis, Dia da Justiça e recesso de 20/12 a 20/1. Sem feriados estaduais, municipais ou portarias de tribunal.";

  async isHoliday(date: Date, timezone: string): Promise<boolean> {
    return nonBusinessReason(civilDate(date, timezone)) !== null;
  }
}

/**
 * Dias úteis em órgãos administrativos federais: fins de semana, feriados
 * nacionais e datas móveis (Carnaval, Sexta-feira Santa, Corpus Christi).
 * Sem recesso forense nem Dia da Justiça, que são do Judiciário.
 */
export class NationalAdministrativeHolidayCalendar implements HolidayCalendarProvider {
  readonly status = "READY" as const;
  readonly coverage =
    "Feriados nacionais e datas móveis. Sem feriados locais nem pontos facultativos de cada órgão.";

  async isHoliday(date: Date, timezone: string): Promise<boolean> {
    const iso = civilDate(date, timezone);
    const d = new Date(`${iso}T12:00:00.000Z`);
    const weekday = d.getUTCDay();
    if (weekday === 0 || weekday === 6) return true;
    const holiday = nationalForensicHolidays(d.getUTCFullYear()).get(iso);
    return Boolean(holiday && holiday !== "Dia da Justiça");
  }
}

/** Próximo dia útil estritamente posterior à data (AAAA-MM-DD). */
export function nextBusinessDay(
  isoDate: string,
  mode: "counting" | "expedient" = "counting",
): { date: string; skipped: NonBusinessReason[] } {
  const skipped: NonBusinessReason[] = [];
  let cursor = new Date(`${isoDate}T12:00:00.000Z`);
  for (let guard = 0; guard < 60; guard += 1) {
    cursor = shift(cursor, 1);
    const candidate = key(cursor);
    const reason = nonBusinessReason(candidate, mode);
    if (!reason) return { date: candidate, skipped };
    skipped.push({ date: candidate, reason });
  }
  throw new Error("Não foi possível encontrar dia útil em 60 dias.");
}

export type DjenTermDates = {
  /** Data de disponibilização no DJEN. */
  availableOn: string;
  /** Publicação: primeiro dia de expediente seguinte à disponibilização (Lei 11.419/2006, art. 4º, §3º). */
  publishedOn: string;
  /** Início do prazo: primeiro dia útil seguinte à publicação, fora da suspensão do art. 220 (art. 4º, §4º; CPC, art. 224, §3º). */
  termStartsOn: string;
  skipped: NonBusinessReason[];
};

export function djenTermDates(availableOn: string): DjenTermDates {
  const published = nextBusinessDay(availableOn, "expedient");
  const start = nextBusinessDay(published.date, "counting");
  return {
    availableOn,
    publishedOn: published.date,
    termStartsOn: start.date,
    skipped: [...published.skipped, ...start.skipped],
  };
}

/**
 * Último dia de um prazo em dias úteis contado a partir do termo inicial
 * (o termo inicial é o 1º dia). Ex.: 15 dias úteis começando em 2026-03-02.
 */
export function addForensicBusinessDays(termStartsOn: string, days: number): string {
  if (days < 1) throw new Error("Quantidade de dias deve ser positiva.");
  let current = termStartsOn;
  if (nonBusinessReason(current)) current = nextBusinessDay(current).date;
  for (let counted = 1; counted < days; counted += 1) {
    current = nextBusinessDay(current).date;
  }
  return current;
}
