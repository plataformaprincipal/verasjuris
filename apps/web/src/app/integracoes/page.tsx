import type { Metadata } from "next";
import { IntegrationsPublicPage } from "../../components/integrations-public-page";

export const metadata: Metadata = {
  title: "Integrações",
  description:
    "Integrações do VerasJuris classificadas por disponibilidade efetiva: pagamentos, e-mail, agenda, tribunais e inteligência artificial.",
};

export default function IntegracoesPage() {
  return <IntegrationsPublicPage />;
}
