import type { Metadata } from "next";
import { LegalHub } from "../../components/legal/legal-hub";
import { PublicPageShell } from "../../components/public-page-shell";

export const metadata: Metadata = {
  title: "Documentos legais — VerasJuris",
  description:
    "Central jurídica institucional com Termos de Uso, Termos de Serviço e Política de Privacidade do VerasJuris.",
};

export default function LegalHubPage() {
  return (
    <PublicPageShell wide>
      <LegalHub />
    </PublicPageShell>
  );
}
