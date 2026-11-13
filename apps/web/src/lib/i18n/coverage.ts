import { MESSAGE_CATALOGS, SOURCE_KEYS, type MessageKey } from "./catalogs";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from "./locales";

export function listMissingKeys(locale: Locale): MessageKey[] {
  const catalog = MESSAGE_CATALOGS[locale];
  return SOURCE_KEYS.filter((key) => {
    const value = catalog[key];
    return typeof value !== "string" || value.length === 0;
  });
}

export function coverageReport(): Record<Locale, number> {
  const sourceCount = SOURCE_KEYS.length;
  const report = {} as Record<Locale, number>;
  for (const locale of SUPPORTED_LOCALES) {
    const missing = listMissingKeys(locale).length;
    const covered = sourceCount - missing;
    report[locale] = sourceCount === 0 ? 100 : Math.round((covered / sourceCount) * 10000) / 100;
  }
  return report;
}

export function differenceRatio(locale: Locale, against: Locale = DEFAULT_LOCALE): number {
  const left = MESSAGE_CATALOGS[locale];
  const right = MESSAGE_CATALOGS[against];
  let different = 0;
  for (const key of SOURCE_KEYS) {
    if (left[key] !== right[key]) different += 1;
  }
  return SOURCE_KEYS.length === 0 ? 0 : different / SOURCE_KEYS.length;
}
