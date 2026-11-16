import { describe, expect, it } from "vitest";
import { MESSAGE_CATALOGS, SOURCE_KEYS } from "./catalogs";
import { coverageReport, differenceRatio, listMissingKeys } from "./coverage";
import { DEFAULT_LOCALE, LOCALE_META, SUPPORTED_LOCALES, normalizeLocale } from "./locales";

describe("i18n coverage — três idiomas oficiais", () => {
  it("formaliza exatamente pt-BR, en-US e es-ES", () => {
    expect(SUPPORTED_LOCALES).toEqual(["pt-BR", "en-US", "es-ES"]);
    expect(Object.keys(MESSAGE_CATALOGS).sort()).toEqual(["en-US", "es-ES", "pt-BR"]);
  });

  it("garante 100% das chaves de pt-BR em cada locale oficial", () => {
    const report = coverageReport();
    for (const locale of SUPPORTED_LOCALES) {
      expect(listMissingKeys(locale), locale).toEqual([]);
      expect(report[locale], locale).toBe(100);
    }
    expect(SOURCE_KEYS.length).toBeGreaterThan(150);
  });

  it("usa direção LTR nos três idiomas oficiais", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(LOCALE_META[locale].dir).toBe("ltr");
    }
  });

  it("não copia o catálogo pt-BR para en-US e es-ES", () => {
    expect(differenceRatio("en-US")).toBeGreaterThanOrEqual(0.8);
    expect(differenceRatio("es-ES")).toBeGreaterThanOrEqual(0.5);
  });

  it("normaliza locales legados para os oficiais e faz fallback para pt-BR", () => {
    expect(normalizeLocale("pt-PT")).toBe("pt-BR");
    expect(normalizeLocale("en-GB")).toBe("en-US");
    expect(normalizeLocale("es-MX")).toBe("es-ES");
    expect(normalizeLocale("fr-FR")).toBeNull();
    expect(normalizeLocale("en")).toBe("en-US");
    expect(DEFAULT_LOCALE).toBe("pt-BR");
  });
});
