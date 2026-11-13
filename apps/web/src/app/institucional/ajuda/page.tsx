import type { Metadata } from "next";
import { PublicPageShell } from "../../../components/public-page-shell";

export const metadata: Metadata = {
  title: "Central de ajuda",
  description: "Perguntas frequentes e orientação de uso do VerasJuris.",
};

const FAQ = [
  {
    q: "Posso conhecer a plataforma sem criar conta?",
    a: "Sim. A página inicial, o catálogo de funcionalidades, a demonstração e as páginas institucionais são públicos. Operações reais exigem autenticação.",
  },
  {
    q: "O que acontece se eu tentar criar um processo sem estar autenticado?",
    a: "Você será orientado a entrar ou criar uma conta. O destino pretendido pode ser preservado após o login, quando for seguro e autorizado.",
  },
  {
    q: "A inteligência artificial substitui um advogado?",
    a: "Não. Os recursos assistidos exigem revisão humana e não constituem parecer jurídico automático.",
  },
  {
    q: "Os pagamentos já estão ativos?",
    a: "A integração de cobranças está implementada no código e em fase de testes controlados. A contratação pública self-service só é anunciada quando estiver homologada.",
  },
  {
    q: "O sistema protocola automaticamente no INSS ou em tribunais?",
    a: "Não nesta versão. Processos e requerimentos são organizados na plataforma; protocolo oficial depende de integração comprovada, ainda não operacional.",
  },
  {
    q: "Como alterar idioma e acessibilidade?",
    a: "Use o seletor de idioma no cabeçalho ou rodapé e o painel de acessibilidade flutuante. Preferências podem ser sincronizadas após o login.",
  },
];

export default function AjudaPage() {
  return (
    <PublicPageShell>
      <div className="vj-stack">
        <div>
          <p className="vj-meta">Institucional</p>
          <h1 className="vj-display">Central de ajuda</h1>
          <p className="vj-lead">
            Respostas objetivas sobre a experiência pública, autenticação e limites da plataforma.
          </p>
          <p className="vj-draft-banner" role="status">
            Conteúdo orientativo — complementa, mas não substitui, as políticas oficiais.
          </p>
        </div>

        <div className="vj-stack">
          {FAQ.map((item) => (
            <details key={item.q} className="vj-card">
              <summary className="vj-section-title">{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>

        <section className="vj-card">
          <h2 className="vj-section-title">Canais</h2>
          <p>
            Para contato institucional, use a página de{" "}
            <a href="/institucional/contato">contato</a>. Para segurança e privacidade, consulte as{" "}
            <a href="/politicas/seguranca">políticas de segurança</a> e de{" "}
            <a href="/politicas/privacidade">privacidade</a>.
          </p>
        </section>
      </div>
    </PublicPageShell>
  );
}
