export type LegalDocId = "terms-of-use" | "terms-of-service" | "privacy-policy";

export type LegalDocStatus = "draft" | "published" | "superseded";

export type LegalClause = {
  id: string;
  number: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
  callout?: string;
};

export type LegalSection = {
  id: string;
  number: string;
  title: string;
  intro?: string;
  clauses: LegalClause[];
};

export type LegalDocument = {
  id: LegalDocId;
  slug: string;
  href: string;
  title: string;
  shortTitle: string;
  summary: string;
  category: string;
  version: string;
  publishedAt: string;
  effectiveAt: string;
  status: LegalDocStatus;
  readingMinutes: number;
  sections: LegalSection[];
  related: LegalDocId[];
  pendingItems: string[];
};

export type LegalVersionRegistry = {
  /** Pacote contratual enviado em `termsVersion` (uso + serviço). */
  packageVersion: string;
  termsOfUseVersion: string;
  termsOfServiceVersion: string;
  privacyPolicyVersion: string;
  effectiveAt: string;
  status: LegalDocStatus;
};
