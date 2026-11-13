"use client";

import { ButtonLink } from "@verasjuris/ui";
import {
  AVAILABILITY_META,
  CATEGORY_META,
  PUBLIC_CATALOG,
  listCategories,
} from "../lib/public-catalog";
import { SOLUTIONS } from "../lib/solutions";
import { HomeProductPreview } from "./home-product-preview";
import { useLocale } from "./locale-provider";
import { AvailabilityBadge, PublicPageShell, PublicSection } from "./public-page-shell";

const HIGHLIGHT_SLUGS = [
  "processos-judiciais",
  "clientes",
  "documentos",
  "assistente-ia",
  "marketplace-juridico",
  "honorarios",
] as const;

export function HomeLanding() {
  const { t } = useLocale();
  const highlights = HIGHLIGHT_SLUGS.map((slug) =>
    PUBLIC_CATALOG.find((feature) => feature.slug === slug),
  ).filter(Boolean);

  return (
    <PublicPageShell wide className="vj-home">
      <section className="vj-home-hero">
        <div className="vj-home-hero-copy">
          <p className="vj-meta">VerasJuris</p>
          <h1 className="vj-display">
            Uma plataforma completa para a gestão e a transformação digital dos serviços jurídicos.
          </h1>
          <p className="vj-lead">
            Organize processos, clientes, documentos, atendimentos, prazos e operações jurídicas em
            um único ambiente, com recursos de automação, inteligência artificial e gestão
            integrada.
          </p>
          <div className="vj-form-actions">
            <ButtonLink href="/explorar">Conhecer a plataforma</ButtonLink>
            <ButtonLink href="/ferramentas" variant="secondary">
              Explorar funcionalidades
            </ButtonLink>
            <ButtonLink href="/cadastro" variant="ghost">
              {t("nav.signup")}
            </ButtonLink>
          </div>
          <p className="vj-meta">
            A pré-visualização é pública. Operações reais e dados privados exigem autenticação.
          </p>
        </div>
        <div className="vj-home-hero-preview">
          <HomeProductPreview />
        </div>
      </section>

      <PublicSection
        title="Conheça as áreas da plataforma"
        lead="O catálogo público cobre o escopo real do VerasJuris, com disponibilidade declarada com base no código e nas integrações efetivas."
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
        title="Funcionalidades em destaque"
        lead="Exemplos do que a plataforma organiza hoje. Cada item indica se está disponível, em testes, em desenvolvimento ou planejado."
      >
        <div className="vj-feature-grid">
          {highlights.map((feature) =>
            feature ? (
              <article key={feature.slug} className="vj-card">
                <div className="vj-inline-actions">
                  <AvailabilityBadge availability={feature.availability} />
                  <span className="vj-meta">{AVAILABILITY_META[feature.availability].label}</span>
                </div>
                <h3 className="vj-section-title">{feature.name}</h3>
                <p>{feature.summary}</p>
                <p className="vj-meta">{feature.problem}</p>
                <a href={`/ferramentas/${feature.slug}`}>Ver detalhes</a>
              </article>
            ) : null,
          )}
        </div>
      </PublicSection>

      <PublicSection
        title="Para quem é o VerasJuris"
        lead="Soluções orientadas a problemas concretos de profissionais, escritórios, empresas e clientes."
      >
        <div className="vj-feature-grid">
          {SOLUTIONS.map((solution) => (
            <a
              key={solution.slug}
              className="vj-card vj-card-link"
              href={`/solucoes/${solution.slug}`}
            >
              <h3 className="vj-section-title">{solution.title}</h3>
              <p>{solution.summary}</p>
            </a>
          ))}
        </div>
      </PublicSection>

      <PublicSection
        title="Segurança, acessibilidade e idiomas"
        lead="Controles de acesso por organização, preferências de acessibilidade e infraestrutura para múltiplos idiomas."
      >
        <div className="vj-split">
          <article className="vj-card">
            <h3 className="vj-section-title">Segurança e privacidade</h3>
            <p>
              Sessões autenticadas, permissões por organização e políticas institucionais em
              evolução. Dados de demonstração nunca misturam registros reais.
            </p>
            <a href="/politicas/seguranca">Conhecer segurança</a>
          </article>
          <article className="vj-card">
            <h3 className="vj-section-title">Acessibilidade e idiomas</h3>
            <p>
              Painel de acessibilidade com controles reais e seleção de idioma. A cobertura textual
              completa segue em expansão; a interface comunica o que já está disponível.
            </p>
            <div className="vj-inline-actions">
              <a href="/acessibilidade">Acessibilidade</a>
              <a href="/idiomas">Idiomas</a>
            </div>
          </article>
        </div>
      </PublicSection>

      <section className="vj-home-cta vj-card">
        <h2 className="vj-section-title">Pronto para organizar sua operação jurídica?</h2>
        <p className="vj-lead">
          Explore a demonstração sem cadastro. Quando precisar executar uma operação real, entre ou
          crie sua conta.
        </p>
        <div className="vj-form-actions">
          <ButtonLink href="/explorar">Explorar o VerasJuris</ButtonLink>
          <ButtonLink href="/planos" variant="secondary">
            Ver planos
          </ButtonLink>
          <ButtonLink href="/cadastro" variant="ghost">
            Criar conta
          </ButtonLink>
        </div>
      </section>
    </PublicPageShell>
  );
}
