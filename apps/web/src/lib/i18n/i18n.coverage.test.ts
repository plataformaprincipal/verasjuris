import { describe, expect, it } from "vitest";
import { MESSAGE_CATALOGS } from "./catalogs";
import { coverageReport, differenceRatio, listMissingKeys } from "./coverage";
import { LOCALE_META, SUPPORTED_LOCALES, type Locale } from "./locales";

const RTL_LOCALES: Locale[] = ["ar-SA", "he-IL", "fa-IR"];

describe("i18n coverage", () => {
  it("formaliza exatamente 30 locales", () => {
    expect(SUPPORTED_LOCALES).toHaveLength(30);
    expect(Object.keys(MESSAGE_CATALOGS)).toHaveLength(30);
  });

  it("garante 100% das chaves de pt-BR em cada locale", () => {
    const report = coverageReport();
    for (const locale of SUPPORTED_LOCALES) {
      expect(listMissingKeys(locale), locale).toEqual([]);
      expect(report[locale], locale).toBe(100);
    }
  });

  it("marca RTL para ar-SA, he-IL e fa-IR", () => {
    for (const locale of RTL_LOCALES) {
      expect(LOCALE_META[locale].dir).toBe("rtl");
    }
    for (const locale of SUPPORTED_LOCALES) {
      if (!RTL_LOCALES.includes(locale)) {
        expect(LOCALE_META[locale].dir).toBe("ltr");
      }
    }
  });

  it("não copia o catálogo pt-BR para outros idiomas", () => {
    for (const locale of SUPPORTED_LOCALES) {
      if (locale === "pt-BR") continue;
      expect(differenceRatio(locale), locale).toBeGreaterThan(0);
    }
    expect(differenceRatio("en-US")).toBeGreaterThanOrEqual(0.8);
    expect(differenceRatio("fr-FR")).toBeGreaterThanOrEqual(0.8);
    expect(differenceRatio("de-DE")).toBeGreaterThanOrEqual(0.8);
    expect(differenceRatio("ar-SA")).toBeGreaterThanOrEqual(0.8);
    expect(differenceRatio("ja-JP")).toBeGreaterThanOrEqual(0.8);
    // Cognatos com o português: exige maioria distinta, não 80%.
    expect(differenceRatio("es-ES")).toBeGreaterThanOrEqual(0.5);
  });
});
