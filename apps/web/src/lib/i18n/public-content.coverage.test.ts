import { describe, expect, it } from "vitest";
import { PUBLIC_CATALOG, listCategories } from "../public-catalog";
import { SOLUTIONS } from "../solutions";
import { MESSAGE_CATALOGS } from "./catalogs";
import { SUPPORTED_LOCALES } from "./locales";
import {
  categoryLabelKey,
  featureNameKey,
  featureSummaryKey,
  solutionSummaryKey,
  solutionTitleKey,
} from "../public-i18n";

describe("conteúdo público nos três idiomas oficiais", () => {
  it("expõe apenas pt-BR, en-US e es-ES", () => {
    expect(SUPPORTED_LOCALES).toEqual(["pt-BR", "en-US", "es-ES"]);
  });

  it("traduz categorias, soluções e nomes/resumos do catálogo", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const catalog = MESSAGE_CATALOGS[locale];
      for (const category of listCategories()) {
        expect(catalog[categoryLabelKey(category) as keyof typeof catalog]).toBeTruthy();
      }
      for (const solution of SOLUTIONS) {
        expect(catalog[solutionTitleKey(solution.slug) as keyof typeof catalog]).toBeTruthy();
        expect(catalog[solutionSummaryKey(solution.slug) as keyof typeof catalog]).toBeTruthy();
      }
      for (const feature of PUBLIC_CATALOG) {
        expect(catalog[featureNameKey(feature.slug) as keyof typeof catalog]).toBeTruthy();
        expect(catalog[featureSummaryKey(feature.slug) as keyof typeof catalog]).toBeTruthy();
      }
      expect(catalog["demo.banner"]).toBeTruthy();
      expect(catalog["nav.language"]).toBeTruthy();
    }
  });
});
