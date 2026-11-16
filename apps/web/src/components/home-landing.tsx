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
          <h1 className="vj-display">{t("home.heroTitle")}</h1>
          <p className="vj-lead">{t("home.heroLead")}</p>
          <div className="vj-form-actions">
            <ButtonLink href="/explorar">{t("home.ctaExplore")}</ButtonLink>
            <ButtonLink href="/ferramentas" variant="secondary">
              {t("home.ctaFeatures")}
            </ButtonLink>
            <ButtonLink href="/cadastro" variant="ghost">
              {t("nav.signup")}
            </ButtonLink>
          </div>
          <p className="vj-meta">{t("home.previewNote")}</p>
        </div>
        <div className="vj-home-hero-preview">
          <HomeProductPreview />
        </div>
      </section>

      <PublicSection title={t("home.areasTitle")} lead={t("home.areasLead")}>
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

      <PublicSection title={t("home.highlightsTitle")} lead={t("home.highlightsLead")}>
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
                <a href={`/ferramentas/${feature.slug}`}>{t("home.viewDetails")}</a>
              </article>
            ) : null,
          )}
        </div>
      </PublicSection>

      <PublicSection title={t("home.audienceTitle")} lead={t("home.audienceLead")}>
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

      <PublicSection title={t("home.trustTitle")} lead={t("home.trustLead")}>
        <div className="vj-split">
          <article className="vj-card">
            <h3 className="vj-section-title">{t("home.securityTitle")}</h3>
            <p>{t("home.securityBody")}</p>
            <a href="/politicas/seguranca">{t("home.securityCta")}</a>
          </article>
          <article className="vj-card">
            <h3 className="vj-section-title">{t("home.a11yLanguagesTitle")}</h3>
            <p>{t("home.a11yLanguagesBody")}</p>
            <div className="vj-inline-actions">
              <a href="/acessibilidade">{t("nav.accessibility")}</a>
              <a href="/idiomas">{t("footer.languages")}</a>
            </div>
          </article>
        </div>
      </PublicSection>

      <section className="vj-home-cta vj-card">
        <h2 className="vj-section-title">{t("home.finalCtaTitle")}</h2>
        <p className="vj-lead">{t("home.finalCtaLead")}</p>
        <div className="vj-form-actions">
          <ButtonLink href="/explorar">{t("home.finalCtaExplore")}</ButtonLink>
          <ButtonLink href="/planos" variant="secondary">
            {t("home.viewPlans")}
          </ButtonLink>
          <ButtonLink href="/cadastro" variant="ghost">
            {t("nav.signup")}
          </ButtonLink>
        </div>
      </section>
    </PublicPageShell>
  );
}
