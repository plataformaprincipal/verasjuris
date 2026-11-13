import type { Metadata } from "next";
import { JurisOneChat } from "../../components/juris-one-chat";
import { PublicPageShell } from "../../components/public-page-shell";

export const metadata: Metadata = {
  title: "Juris One",
  description:
    "Juris One — assistente inteligente do VerasJuris. Orientação informativa, etapa gratuita controlada e encaminhamento para ferramentas e serviços. Não substitui advogado.",
};

export default function JurisOnePage() {
  return (
    <PublicPageShell wide>
      <div className="vj-stack">
        <div>
          <p className="vj-meta">Juris One</p>
          <h1 className="vj-display">Seu assistente inteligente no universo jurídico</h1>
          <p className="vj-lead">
            Chat para perguntas, explicações gerais e organização de caminhos na plataforma. O modo
            Work estruturado será anunciado somente quando a infraestrutura de tarefas estiver
            operacional.
          </p>
        </div>
        <JurisOneChat />
      </div>
    </PublicPageShell>
  );
}
