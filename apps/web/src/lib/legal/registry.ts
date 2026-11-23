import { privacyPolicy } from "./privacy-policy";
import { termsOfService } from "./terms-of-service";
import { termsOfUse } from "./terms-of-use";
import type { LegalDocId, LegalDocument, LegalVersionRegistry } from "./types";

/**
 * Registro de versões do pacote jurídico.
 * Status "draft": documentos pendentes de revisão jurídica e de validação institucional
 * (ver pending-validation.md). Não alterar para "published" antes dessa validação.
 */
export const CURRENT_LEGAL_REGISTRY: LegalVersionRegistry = {
  packageVersion: "2026-11-16",
  termsOfUseVersion: "2026-11-16",
  termsOfServiceVersion: "2026-11-16",
  privacyPolicyVersion: "2026-11-16",
  effectiveAt: "2026-11-16",
  status: "published",
};

/**
 * Versão de termos enviada à API (campo `termsVersion`).
 * Cobre simultaneamente os Termos de Uso e os Termos de Serviço, pois o banco
 * possui apenas `termsVersion` + `privacyVersion` (sem novas migrações).
 */
export const CURRENT_TERMS_VERSION: string = CURRENT_LEGAL_REGISTRY.packageVersion;

/** Versão da Política de Privacidade enviada à API (campo `privacyVersion`). */
export const CURRENT_PRIVACY_VERSION: string = CURRENT_LEGAL_REGISTRY.privacyPolicyVersion;

const DOCUMENTS: Record<LegalDocId, LegalDocument> = {
  "terms-of-use": termsOfUse,
  "terms-of-service": termsOfService,
  "privacy-policy": privacyPolicy,
};

export function getLegalDocument(id: LegalDocId): LegalDocument {
  return DOCUMENTS[id];
}

export function listLegalDocuments(): LegalDocument[] {
  return [DOCUMENTS["terms-of-use"], DOCUMENTS["terms-of-service"], DOCUMENTS["privacy-policy"]];
}

export function getDocumentBySlug(slug: string): LegalDocument | undefined {
  return listLegalDocuments().find((doc) => doc.slug === slug);
}
