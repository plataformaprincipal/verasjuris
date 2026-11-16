import { describe, expect, it } from "vitest";
import { PUBLIC_CATALOG } from "../public-catalog";
import { assertCatalogCoverage, getCommercialSheet, getToolDemoMeta } from "./registry";
import { listDemoKinds } from "./registry";

describe("tool-demos registry", () => {
  it("covers every catalog slug", () => {
    expect(assertCatalogCoverage()).toEqual([]);
  });

  it("maps each slug to valid meta", () => {
    for (const feature of PUBLIC_CATALOG) {
      const meta = getToolDemoMeta(feature.slug);
      expect(meta).not.toBeNull();
      if (meta?.kind) {
        expect(listDemoKinds()).toContain(meta.kind);
      }
      if (meta?.publicDemo) {
        expect(["A", "B", "C", "D"]).toContain(meta.publicDemo);
      }
    }
  });

  it("commercial sheets never invent plan prices", () => {
    const priceLike = /R\$\s*\d|\$\s*\d|€\s*\d|preço mensal|R\$\d/i;
    for (const feature of PUBLIC_CATALOG) {
      const sheet = getCommercialSheet(feature.slug);
      expect(sheet).not.toBeNull();
      expect(sheet!.eligiblePlan).toBeNull();
      const blob = JSON.stringify(sheet);
      expect(blob).not.toMatch(priceLike);
    }
  });
});
