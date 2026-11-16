import { describe, expect, it } from "vitest";
import { MESSAGE_CATALOGS, SOURCE_KEYS } from "./catalogs";
import { translate } from "./translate";
import { SUPPORTED_LOCALES, type Locale } from "./locales";

/** Rotas e estados principais — chaves que devem existir nos três idiomas. */
const ROUTE_CHROME_KEYS = [
  "public.tab.home",
  "public.tab.tools",
  "public.tab.explore",
  "public.tab.jurisOne",
  "nav.login",
  "nav.signup",
  "nav.app",
  "nav.language",
  "auth.login",
  "auth.password",
  "register.title",
  "register.step.password",
  "register.birth.underage",
  "dashboard.title",
  "marketplace.title",
  "plans.title",
  "a11y.title",
  "a11y.category.vision",
  "a11y.category.reading",
  "a11y.category.navigation",
  "a11y.category.assistive",
  "a11y.vlibras",
  "a11y.reset",
  "languages.title",
  "common.empty",
  "common.error",
  "errors.network",
] as const;

describe("rotas e estados principais nos 3 idiomas", () => {
  it("possui chaves de chrome para abas públicas, auth, painel e a11y", () => {
    for (const key of ROUTE_CHROME_KEYS) {
      expect(SOURCE_KEYS.includes(key as (typeof SOURCE_KEYS)[number]), key).toBe(true);
      for (const locale of SUPPORTED_LOCALES) {
        const value = MESSAGE_CATALOGS[locale][key as keyof (typeof MESSAGE_CATALOGS)[Locale]];
        expect(typeof value, `${locale}:${key}`).toBe("string");
        expect(String(value).length, `${locale}:${key}`).toBeGreaterThan(0);
        expect(translate(locale, key)).toBe(String(value));
      }
    }
  });

  it("não mistura fallback vazio entre idiomas oficiais", () => {
    for (const locale of SUPPORTED_LOCALES) {
      if (locale === "pt-BR") continue;
      const sample = translate(locale, "nav.login");
      expect(sample).not.toBe("");
      expect(sample).not.toBe("nav.login");
    }
  });
});
