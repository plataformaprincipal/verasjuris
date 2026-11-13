import { MESSAGE_CATALOGS, type MessageKey } from "./catalogs";
import { DEFAULT_LOCALE, type Locale } from "./locales";

export function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = params[key];
    return value === undefined ? match : String(value);
  });
}

export function translate(locale: Locale, key: string, fallback?: string): string {
  const catalog = MESSAGE_CATALOGS[locale];
  const defaultCatalog = MESSAGE_CATALOGS[DEFAULT_LOCALE];
  return catalog[key as MessageKey] ?? defaultCatalog[key as MessageKey] ?? fallback ?? key;
}
