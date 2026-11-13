import { describe, expect, it } from "vitest";
import {
  getFeature,
  listByCategory,
  listCategories,
  PUBLIC_CATALOG,
  searchFeatures,
} from "./public-catalog";
import { DEMO_VIEWS, isDemoView } from "./demo-data";
import { SOLUTIONS } from "./solutions";

describe("public catalog", () => {
  it("possui slugs únicos e categorias válidas", () => {
    const slugs = PUBLIC_CATALOG.map((feature) => feature.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(listCategories().length).toBeGreaterThanOrEqual(8);
    expect(PUBLIC_CATALOG.length).toBeGreaterThanOrEqual(25);
  });

  it("referencia apenas visualizações demonstrativas válidas", () => {
    for (const feature of PUBLIC_CATALOG) {
      if (feature.demoView) {
        expect(isDemoView(feature.demoView), feature.slug).toBe(true);
      }
    }
    expect(DEMO_VIEWS.length).toBeGreaterThan(5);
  });

  it("mantém soluções ligadas a funcionalidades existentes", () => {
    for (const solution of SOLUTIONS) {
      for (const slug of solution.features) {
        expect(getFeature(slug), `${solution.slug}:${slug}`).toBeTruthy();
      }
    }
  });

  it("pesquisa ignora acentos", () => {
    const results = searchFeatures("peticoes");
    expect(results.some((feature) => feature.slug === "peticoes-assistidas")).toBe(true);
    expect(searchFeatures("analise").some((feature) => feature.slug === "analise-documentos")).toBe(
      true,
    );
    expect(listByCategory("inteligencia_artificial").length).toBeGreaterThan(0);
  });
});
