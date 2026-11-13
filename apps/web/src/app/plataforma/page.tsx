import type { Metadata } from "next";
import { ButtonLink } from "@verasjuris/ui";
import { PublicPageShell, PublicSection } from "../../components/public-page-shell";
import { CATEGORY_META, listCategories } from "../../lib/public-catalog";

export const metadata: Metadata = {
  title: "Visão geral da plataforma",
  description:
    "Como o VerasJuris organiza gestão jurídica, documentos, atendimento, financeiro e inteligência artificial assistida.",
};

export default function PlataformaPage() {
  return (
    <PublicPageShell>
      <div className="vj-stack">
        <div>
          <p className="vj-meta">Plataforma</p>
          <h1 className="vj-display">Uma operação jurídica organizada em um só ambiente</h1>
          <p className="vj-lead">
            O VerasJuris reúne gestão de processos, clientes, documentos, prazos, financeiro e
            recursos assistidos por inteligência artificial. Visitantes podem conhecer a estrutura
            sem cadastro; operações reais exigem autenticação e permissões.
          </p>
          <div className="vj-form-actions">
            <ButtonLink href="/explorar">Explorar demonstração</ButtonLink>
            <ButtonLink href="/ferramentas" variant="secondary">
              Ver funcionalidades
            </ButtonLink>
          </div>
        </div>

        <PublicSection
          title="Como a plataforma se organiza"
          lead="Módulos conectados à mesma organização, com controle de acesso e histórico de atividades."
        >
          <div className="vj-feature-grid">
            {listCategories().map((category) => (
              <a
                key={category}
                className="vj-card vj-card-link"
                href={`/ferramentas?categoria=${category}`}
              >
                <h3 className="vj-section-title">{CATEGORY_META[category].label}</h3>
                <p>{CATEGORY_META[category].description}</p>
              </a>
            ))}
          </div>
        </PublicSection>

        <PublicSection
          title="O que é público e o que exige conta"
          lead="A pré-visualização explica e demonstra. A execução opera somente após autenticação."
        >
          <div className="vj-split">
            <article className="vj-card">
              <h3 className="vj-section-title">Sem criar conta</h3>
              <ul>
                <li>Navegar pela apresentação institucional</li>
                <li>Consultar o catálogo de funcionalidades</li>
                <li>Explorar a demonstração com dados fictícios</li>
                <li>Ver planos, segurança, acessibilidade e idiomas</li>
              </ul>
            </article>
            <article className="vj-card">
              <h3 className="vj-section-title">Com autenticação</h3>
              <ul>
                <li>Criar processos, clientes, tarefas e documentos</li>
                <li>Executar análises assistidas por inteligência artificial</li>
                <li>Contratar serviços e gerenciar cobranças</li>
                <li>Acessar dados privados da organização</li>
              </ul>
            </article>
          </div>
        </PublicSection>
      </div>
    </PublicPageShell>
  );
}
