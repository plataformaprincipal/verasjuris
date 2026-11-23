"use client";

import { ButtonLink } from "@verasjuris/ui";
import {
  Briefcase,
  Building2,
  Calculator,
  CalendarDays,
  FileText,
  FolderOpen,
  Gavel,
  HeartPulse,
  Home,
  Landmark,
  Scale,
  Shield,
  Store,
  Users,
  BrainCircuit,
  Workflow,
} from "lucide-react";
import { PUBLIC_CATALOG } from "../lib/public-catalog";
import {
  featureNameKey,
  featureSummaryKey,
  solutionSummaryKey,
  solutionTitleKey,
} from "../lib/public-i18n";
import { SOLUTIONS } from "../lib/solutions";
import { HomeProductPreview } from "./home-product-preview";
import { PublicPageShell, PublicSection, AvailabilityBadge } from "./public-page-shell";
import { useLocale } from "./locale-provider";

const SERVICES = [
  { labelKey: "home.service.consulting", href: "/marketplace-juridico", icon: Scale },
  { labelKey: "home.service.online", href: "/atendimento-juridico", icon: Users },
  { labelKey: "home.service.socialSecurity", href: "/gestao-previdenciaria", icon: Shield },
  {
    labelKey: "home.service.labor",
    href: "/ferramentas?categoria=gestao_juridica",
    icon: Briefcase,
  },
  { labelKey: "home.service.corporate", href: "/solucoes/empresas", icon: Building2 },
  { labelKey: "home.service.tax", href: "/ferramentas", icon: Landmark },
  { labelKey: "home.service.civil", href: "/ferramentas", icon: FileText },
  { labelKey: "home.service.family", href: "/ferramentas", icon: HeartPulse },
  { labelKey: "home.service.consumer", href: "/ferramentas", icon: Store },
  { labelKey: "home.service.administrative", href: "/processos-administrativos", icon: FolderOpen },
  { labelKey: "home.service.realEstate", href: "/ferramentas", icon: Home },
  { labelKey: "home.service.digital", href: "/ferramentas", icon: Workflow },
  { labelKey: "home.service.health", href: "/ferramentas", icon: HeartPulse },
] as const;

const DEMO_TOOLS = [
  { slug: "processos-judiciais", icon: Gavel },
  { slug: "clientes", icon: Users },
  { slug: "agenda", icon: CalendarDays },
  { slug: "documentos", icon: FileText },
  { slug: "calculo-previdenciario", icon: Calculator },
  { slug: "assistente-ia", icon: BrainCircuit },
  { slug: "contratos", icon: FileText },
  { slug: "fluxos-trabalho", icon: Workflow },
] as const;

const FAQ = [
  { qKey: "home.faq.public.q", aKey: "home.faq.public.a" },
  { qKey: "home.faq.jurisOne.q", aKey: "home.faq.jurisOne.a" },
  { qKey: "home.faq.marketplace.q", aKey: "home.faq.marketplace.a" },
] as const;

export function HomeCommercial() {
  const { t } = useLocale();
  const highlights = DEMO_TOOLS.map((item) => ({
    ...item,
    feature: PUBLIC_CATALOG.find((feature) => feature.slug === item.slug),
  })).filter((item) => item.feature);

  return (
    <PublicPageShell wide className="vj-home">
      <section className="vj-commercial-hero">
        <div className="vj-stack">
          <p className="vj-meta">VerasJuris</p>
          <h1 className="vj-display">{t("home.hero.title")}</h1>
          <p className="vj-lead">{t("home.hero.lead")}</p>
          <div className="vj-form-actions">
            <ButtonLink href="/ferramentas">{t("home.hero.ctaTools")}</ButtonLink>
            <ButtonLink href="/explorar" variant="secondary">
              {t("home.hero.ctaExplore")}
            </ButtonLink>
            <ButtonLink href="/juris-one" variant="ghost">
              {t("home.hero.ctaJurisOne")}
            </ButtonLink>
          </div>
        </div>
        <HomeProductPreview />
      </section>

      <PublicSection title={t("home.areas.title")} lead={t("home.areas.lead")}>
        <div className="vj-service-grid">
          {SERVICES.map((service) => {
            const Icon = service.icon;
            return (
              <a key={service.labelKey} className="vj-service-card" href={service.href}>
                <Icon size={20} aria-hidden="true" />
                <strong>{t(service.labelKey)}</strong>
              </a>
            );
          })}
        </div>
      </PublicSection>

      <PublicSection title={t("home.marketplace.title")} lead={t("home.marketplace.lead")}>
        <div className="vj-form-actions">
          <ButtonLink href="/marketplace-juridico">{t("home.marketplace.ctaExplore")}</ButtonLink>
        </div>
      </PublicSection>

      <PublicSection title={t("home.tools.title")} lead={t("home.tools.lead")}>
        <div className="vj-feature-grid">
          {highlights.map(({ feature, icon: Icon }) =>
            feature ? (
              <a
                key={feature.slug}
                className="vj-interactive-card"
                href={`/ferramentas/${feature.slug}`}
              >
                <Icon size={20} aria-hidden="true" />
                <AvailabilityBadge availability={feature.availability} />
                <strong>{t(featureNameKey(feature.slug), feature.name)}</strong>
                <p>{t(featureSummaryKey(feature.slug), feature.summary)}</p>
              </a>
            ) : null,
          )}
        </div>
        <ButtonLink href="/ferramentas" variant="secondary">
          {t("home.tools.viewAll", "Ver todas as ferramentas")}
        </ButtonLink>
      </PublicSection>

      <PublicSection title={t("home.solutions.title")} lead={t("home.solutions.lead")}>
        <div className="vj-audience-grid">
          {SOLUTIONS.map((solution) => (
            <a key={solution.slug} className="vj-service-card" href={`/solucoes/${solution.slug}`}>
              <strong>{t(solutionTitleKey(solution.slug), solution.title)}</strong>
              <span className="vj-meta">
                {t(solutionSummaryKey(solution.slug), solution.summary)}
              </span>
            </a>
          ))}
        </div>
      </PublicSection>

      <PublicSection title={t("home.jurisOne.title")} lead={t("home.jurisOne.lead")}>
        <div className="vj-card vj-stack">
          <div className="vj-inline-actions">
            <BrainCircuit size={22} aria-hidden="true" />
            <AvailabilityBadge availability="in_development" />
          </div>
          <h3 className="vj-section-title">{t("home.jurisOne.tagline")}</h3>
          <p>
            {t(
              "home.jurisOne.body",
              "Visitantes podem iniciar uma conversa informativa. Respostas com modelos pagos dependem de provedor configurado, autenticação e limites. O Juris One não substitui advogado habilitado.",
            )}
          </p>
          <div className="vj-form-actions">
            <ButtonLink href="/juris-one">{t("home.jurisOne.cta")}</ButtonLink>
            <ButtonLink href="/planos" variant="secondary">
              {t("home.jurisOne.plans", "Ver planos")}
            </ButtonLink>
          </div>
        </div>
      </PublicSection>

      <PublicSection title={t("home.faq.title")}>
        <div className="vj-stack">
          {FAQ.map((item) => (
            <details key={t(item.qKey)} className="vj-card">
              <summary className="vj-section-title">{t(item.qKey)}</summary>
              <p>{t(item.aKey)}</p>
            </details>
          ))}
        </div>
      </PublicSection>
    </PublicPageShell>
  );
}
