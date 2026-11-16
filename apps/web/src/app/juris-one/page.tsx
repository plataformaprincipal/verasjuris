import type { Metadata } from "next";
import { JurisOneChat } from "../../components/juris-one-chat";
import { JurisOneRouteChrome } from "../../components/public-route-chrome";
import { PublicPageShell } from "../../components/public-page-shell";

export const metadata: Metadata = {
  title: "Juris One",
  description:
    "Juris One — assistente inteligente do VerasJuris. Orientação informativa, etapa gratuita controlada e encaminhamento para ferramentas e serviços. Não substitui advogado.",
};

export default function JurisOnePage() {
  return (
    <PublicPageShell wide>
      <JurisOneRouteChrome>
        <JurisOneChat />
      </JurisOneRouteChrome>
    </PublicPageShell>
  );
}
