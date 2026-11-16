import type { Metadata } from "next";
import { LegalDocumentView } from "../../components/legal/legal-document-view";
import { PublicPageShell } from "../../components/public-page-shell";
import { getLegalDocument } from "../../lib/legal";

const document = getLegalDocument("terms-of-service");

export const metadata: Metadata = {
  title: `${document.shortTitle} — VerasJuris`,
  description: document.summary,
};

export default function TermsOfServicePage() {
  return (
    <PublicPageShell wide>
      <LegalDocumentView document={document} />
    </PublicPageShell>
  );
}
