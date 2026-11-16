/** Idiomas oficiais do VerasJuris — apenas estes três na interface. */
export const SUPPORTED_LOCALES = ["pt-BR", "en-US", "es-ES"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "pt-BR";

export const LOCALE_LABELS: Record<Locale, string> = {
  "pt-BR": "Português (Brasil)",
  "en-US": "English (US)",
  "es-ES": "Español (España)",
};

export const LOCALE_SHORT_LABELS: Record<Locale, string> = {
  "pt-BR": "PT",
  "en-US": "EN",
  "es-ES": "ES",
};

export type TextDirection = "ltr" | "rtl";
export type LocaleDirection = TextDirection;

export const LOCALE_META: Record<Locale, { dir: TextDirection }> = {
  "pt-BR": { dir: "ltr" },
  "en-US": { dir: "ltr" },
  "es-ES": { dir: "ltr" },
};

export function localeDirection(locale: Locale): TextDirection {
  return LOCALE_META[locale]?.dir ?? "ltr";
}

/** Preferências legadas (antes dos 30 idiomas) → locale oficial. */
const LEGACY_LOCALE_MAP: Record<string, Locale> = {
  "pt-pt": "pt-BR",
  "en-gb": "en-US",
  "es-mx": "es-ES",
  "es-ar": "es-ES",
  pt: "pt-BR",
  en: "en-US",
  es: "es-ES",
};

export function isLocale(value: string | null | undefined): value is Locale {
  return SUPPORTED_LOCALES.includes(value as Locale);
}

export function normalizeLocale(value: string | null | undefined): Locale | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (isLocale(trimmed)) return trimmed;

  const lower = trimmed.toLowerCase().replace(/_/g, "-");
  const exact = SUPPORTED_LOCALES.find((locale) => locale.toLowerCase() === lower);
  if (exact) return exact;

  if (LEGACY_LOCALE_MAP[lower]) return LEGACY_LOCALE_MAP[lower]!;

  const [language] = lower.split("-");
  if (!language) return null;
  return LEGACY_LOCALE_MAP[language] ?? null;
}

/** Resolução: user → org → localStorage → browser → pt-BR */
export function resolveLocale(input: {
  userLocale?: string | null;
  orgLocale?: string | null;
  storedLocale?: string | null;
  browserLocale?: string | null;
}): Locale {
  return (
    normalizeLocale(input.userLocale) ??
    normalizeLocale(input.orgLocale) ??
    normalizeLocale(input.storedLocale) ??
    normalizeLocale(input.browserLocale) ??
    DEFAULT_LOCALE
  );
}

export function browserPreferredLocale(): string | null {
  if (typeof navigator === "undefined") return null;
  return navigator.languages?.[0] ?? navigator.language ?? null;
}

export const LOCALE_STORAGE_KEY = "vj.locale";
