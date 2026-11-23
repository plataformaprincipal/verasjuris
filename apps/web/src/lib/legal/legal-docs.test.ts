import { describe, expect, it } from "vitest";
import {
  CURRENT_LEGAL_REGISTRY,
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
  getDocumentBySlug,
  getLegalDocument,
  listLegalDocuments,
} from "./index";
import type { LegalDocId } from "./types";

const DOC_IDS: LegalDocId[] = ["terms-of-use", "terms-of-service", "privacy-policy"];

describe("legal documents", () => {
  it("lists all three documents", () => {
    const docs = listLegalDocuments();
    expect(docs.map((d) => d.id).sort()).toEqual([...DOC_IDS].sort());
  });

  for (const id of DOC_IDS) {
    describe(id, () => {
      const doc = getLegalDocument(id);

      it("has sections with clauses and content", () => {
        expect(doc.sections.length).toBeGreaterThan(0);
        for (const section of doc.sections) {
          expect(section.id).toBeTruthy();
          expect(section.title).toBeTruthy();
          expect(section.clauses.length).toBeGreaterThan(0);
          for (const clause of section.clauses) {
            expect(clause.paragraphs.length).toBeGreaterThan(0);
            expect(clause.number.startsWith(`${section.number}.`)).toBe(true);
          }
        }
      });

      it("has unique section ids and unique clause ids", () => {
        const sectionIds = doc.sections.map((s) => s.id);
        expect(new Set(sectionIds).size).toBe(sectionIds.length);
        const clauseIds = doc.sections.flatMap((s) => s.clauses.map((c) => c.id));
        expect(new Set(clauseIds).size).toBe(clauseIds.length);
      });

      it("is published", () => {
        expect(doc.status).toBe("published");
      });

      it("identifies the responsible entity", () => {
        expect(doc.pendingItems.length).toBe(0);
        expect(JSON.stringify(doc)).toContain("62.898.191/0001-08");
      });

      it("does not state prices or commissions", () => {
        const text = JSON.stringify(doc);
        expect(text).not.toMatch(/R\$\s?\d/);
        expect(text).not.toMatch(/\d+\s?%/);
      });

      it("resolves by slug, exposes href, and has valid related docs", () => {
        expect(doc.href).toBe(`/${doc.slug}`);
        expect(getDocumentBySlug(doc.slug)?.id).toBe(id);
        for (const related of doc.related) {
          expect(DOC_IDS).toContain(related);
          expect(related).not.toBe(id);
        }
      });
    });
  }

  it("has unique slugs", () => {
    const slugs = listLegalDocuments().map((d) => d.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("legal registry", () => {
  it("has package and document versions in published status", () => {
    expect(CURRENT_LEGAL_REGISTRY.packageVersion).toBe("2026-11-16");
    expect(CURRENT_LEGAL_REGISTRY.termsOfUseVersion).toBeTruthy();
    expect(CURRENT_LEGAL_REGISTRY.termsOfServiceVersion).toBeTruthy();
    expect(CURRENT_LEGAL_REGISTRY.privacyPolicyVersion).toBeTruthy();
    expect(CURRENT_LEGAL_REGISTRY.effectiveAt).toBe("2026-11-16");
    expect(CURRENT_LEGAL_REGISTRY.status).toBe("published");
  });

  it("exposes API version constants", () => {
    expect(CURRENT_TERMS_VERSION).toBe(CURRENT_LEGAL_REGISTRY.packageVersion);
    expect(CURRENT_PRIVACY_VERSION).toBe(CURRENT_LEGAL_REGISTRY.privacyPolicyVersion);
  });

  it("matches document versions", () => {
    expect(getLegalDocument("terms-of-use").version).toBe(CURRENT_LEGAL_REGISTRY.termsOfUseVersion);
    expect(getLegalDocument("terms-of-service").version).toBe(
      CURRENT_LEGAL_REGISTRY.termsOfServiceVersion,
    );
    expect(getLegalDocument("privacy-policy").version).toBe(
      CURRENT_LEGAL_REGISTRY.privacyPolicyVersion,
    );
  });
});
