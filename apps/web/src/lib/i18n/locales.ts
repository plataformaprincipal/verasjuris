export const SUPPORTED_LOCALES = [
  "pt-BR",
  "pt-PT",
  "en-US",
  "en-GB",
  "es-ES",
  "es-MX",
  "es-AR",
  "fr-FR",
  "de-DE",
  "it-IT",
  "nl-NL",
  "pl-PL",
  "ro-RO",
  "uk-UA",
  "ru-RU",
  "tr-TR",
  "ar-SA",
  "he-IL",
  "fa-IR",
  "hi-IN",
  "bn-BD",
  "id-ID",
  "ms-MY",
  "th-TH",
  "vi-VN",
  "ja-JP",
  "ko-KR",
  "zh-CN",
  "zh-TW",
  "sv-SE",
] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "pt-BR";

export const LOCALE_LABELS: Record<Locale, string> = {
  "pt-BR": "Português (Brasil)",
  "pt-PT": "Português (Portugal)",
  "en-US": "English (US)",
  "en-GB": "English (UK)",
  "es-ES": "Español (España)",
  "es-MX": "Español (México)",
  "es-AR": "Español (Argentina)",
  "fr-FR": "Français",
  "de-DE": "Deutsch",
  "it-IT": "Italiano",
  "nl-NL": "Nederlands",
  "pl-PL": "Polski",
  "ro-RO": "Română",
  "uk-UA": "Українська",
  "ru-RU": "Русский",
  "tr-TR": "Türkçe",
  "ar-SA": "العربية",
  "he-IL": "עברית",
  "fa-IR": "فارسی",
  "hi-IN": "हिन्दी",
  "bn-BD": "বাংলা",
  "id-ID": "Bahasa Indonesia",
  "ms-MY": "Bahasa Melayu",
  "th-TH": "ไทย",
  "vi-VN": "Tiếng Việt",
  "ja-JP": "日本語",
  "ko-KR": "한국어",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
  "sv-SE": "Svenska",
};

export type TextDirection = "ltr" | "rtl";
export type LocaleDirection = TextDirection;

export const LOCALE_META: Record<Locale, { dir: TextDirection }> = {
  "pt-BR": { dir: "ltr" },
  "pt-PT": { dir: "ltr" },
  "en-US": { dir: "ltr" },
  "en-GB": { dir: "ltr" },
  "es-ES": { dir: "ltr" },
  "es-MX": { dir: "ltr" },
  "es-AR": { dir: "ltr" },
  "fr-FR": { dir: "ltr" },
  "de-DE": { dir: "ltr" },
  "it-IT": { dir: "ltr" },
  "nl-NL": { dir: "ltr" },
  "pl-PL": { dir: "ltr" },
  "ro-RO": { dir: "ltr" },
  "uk-UA": { dir: "ltr" },
  "ru-RU": { dir: "ltr" },
  "tr-TR": { dir: "ltr" },
  "ar-SA": { dir: "rtl" },
  "he-IL": { dir: "rtl" },
  "fa-IR": { dir: "rtl" },
  "hi-IN": { dir: "ltr" },
  "bn-BD": { dir: "ltr" },
  "id-ID": { dir: "ltr" },
  "ms-MY": { dir: "ltr" },
  "th-TH": { dir: "ltr" },
  "vi-VN": { dir: "ltr" },
  "ja-JP": { dir: "ltr" },
  "ko-KR": { dir: "ltr" },
  "zh-CN": { dir: "ltr" },
  "zh-TW": { dir: "ltr" },
  "sv-SE": { dir: "ltr" },
};

export function localeDirection(locale: Locale): TextDirection {
  return LOCALE_META[locale]?.dir ?? "ltr";
}

const LANGUAGE_FALLBACKS: Record<string, Locale> = {
  pt: "pt-BR",
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  it: "it-IT",
  nl: "nl-NL",
  pl: "pl-PL",
  ro: "ro-RO",
  uk: "uk-UA",
  ru: "ru-RU",
  tr: "tr-TR",
  ar: "ar-SA",
  he: "he-IL",
  fa: "fa-IR",
  hi: "hi-IN",
  bn: "bn-BD",
  id: "id-ID",
  ms: "ms-MY",
  th: "th-TH",
  vi: "vi-VN",
  ja: "ja-JP",
  ko: "ko-KR",
  zh: "zh-CN",
  sv: "sv-SE",
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

  if (lower === "zh-hans" || lower.startsWith("zh-cn") || lower.startsWith("zh-hans")) {
    return "zh-CN";
  }
  if (
    lower === "zh-hant" ||
    lower.startsWith("zh-tw") ||
    lower.startsWith("zh-hant") ||
    lower.startsWith("zh-hk")
  ) {
    return "zh-TW";
  }

  const [language, region] = lower.split("-");
  if (!language) return null;

  if (region) {
    const candidate = `${language}-${region.toUpperCase()}` as Locale;
    if (isLocale(candidate)) return candidate;
    const matched = SUPPORTED_LOCALES.find((locale) => {
      const [lang, reg] = locale.toLowerCase().split("-");
      return lang === language && reg === region;
    });
    if (matched) return matched;
  }

  return LANGUAGE_FALLBACKS[language] ?? null;
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
