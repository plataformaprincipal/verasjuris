import type { Metadata } from "next";
import { LegalDocumentView } from "../../components/legal/legal-document-view";
import { PublicPageShell } from "../../components/public-page-shell";
import { getLegalDocument } from "../../lib/legal";

const document = getLegalDocument("privacy-policy");

export const metadata: Metadata = {
  title: `${document.shortTitle} — VerasJuris`,
  description: document.summary,
};

export default function PrivacyPolicyPage() {
  return (
    <PublicPageShell wide>
      <LegalDocumentView document={document} />
    </PublicPageShell>
  );
}
