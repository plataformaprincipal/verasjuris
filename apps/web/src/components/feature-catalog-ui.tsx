"use client";

import { ButtonLink } from "@verasjuris/ui";
import { useMemo, useState } from "react";
import {
  AVAILABILITY_META,
  CATEGORY_META,
  PUBLIC_CATALOG,
  type Availability,
  type CatalogCategory,
  type CatalogFeature,
  listCategories,
  searchFeatures,
} from "../lib/public-catalog";
import {
  availabilityDescriptionKey,
  categoryLabelKey,
  featureNameKey,
  featureProblemKey,
  featureSummaryKey,
} from "../lib/public-i18n";
import { getCommercialSheet, getToolDemoMeta } from "../lib/tool-demos/registry";
import type { DemoClassification } from "../lib/tool-demos/types";
import { AvailabilityBadge } from "./public-page-shell";
import { RequireAuthCta } from "./require-auth-cta";
import { ToolDemoPanel } from "./tool-demos/tool-demo-loader";
import { useLocale } from "./locale-provider";

function classLabel(c: DemoClassification | null, t: (k: string, f?: string) => string) {
  if (c === "A") return t("showroom.class.A", "Demo local funcional");
  if (c === "B") return t("showroom.class.B", "Demo interativa fictícia");
  if (c === "C") return t("showroom.class.C", "Prévia guiada");
  if (c === "D") return t("showroom.class.D", "Módulo autenticado");
  return t("showroom.class.none", "Sem demo pública");
}

export function FeatureCatalogBrowser({
  initialCategory,
  initialQuery = "",
}: {
  initialCategory?: CatalogCategory | null;
  initialQuery?: string;
}) {
  const { t } = useLocale();
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState<CatalogCategory | "all">(initialCategory ?? "all");
  const [availability, setAvailability] = useState<Availability | "all">("all");
  const [audience, setAudience] = useState("all");
  const [layout, setLayout] = useState<"grid" | "compact">("grid");

  const audiences = useMemo(() => {
    const set = new Set<string>();
    for (const f of PUBLIC_CATALOG) for (const a of f.audience) set.add(a);
    return [...set].sort();
  }, []);

  const results = useMemo(() => {
    const base = query.trim() ? searchFeatures(query) : PUBLIC_CATALOG;
    return base.filter((feature) => {
      if (category !== "all" && feature.category !== category) return false;
      if (availability !== "all" && feature.availability !== availability) return false;
      if (audience !== "all" && !feature.audience.includes(audience)) return false;
      return true;
    });
  }, [query, category, availability, audience]);

  return (
    <div className="vj-showroom">
      <div className="vj-showroom-layout">
        <aside className="vj-showroom-nav" aria-label={t("showroom.nav", "Categorias")}>
          <button
            type="button"
            className={
              category === "all" ? "vj-showroom-nav-item is-active" : "vj-showroom-nav-item"
            }
            onClick={() => setCategory("all")}
          >
            {t("catalog.all")}
          </button>
          {listCategories().map((item) => (
            <button
              key={item}
              type="button"
              className={
                category === item ? "vj-showroom-nav-item is-active" : "vj-showroom-nav-item"
              }
              onClick={() => setCategory(item)}
            >
              {t(categoryLabelKey(item), CATEGORY_META[item].label)}
            </button>
          ))}
        </aside>

        <div className="vj-stack">
          <search className="vj-showroom-filters" aria-label={t("catalog.searchAria")}>
            <form className="vj-inicio-filters" onSubmit={(event) => event.preventDefault()}>
              <label className="vj-field" style={{ gridColumn: "1 / -1" }}>
                <span className="vj-label">{t("catalog.search")}</span>
                <input
                  className="vj-input vj-showroom-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("catalog.searchPlaceholder")}
                  type="search"
                />
              </label>
              <label className="vj-field">
                <span className="vj-label">{t("catalog.availability")}</span>
                <select
                  className="vj-select"
                  value={availability}
                  onChange={(event) => setAvailability(event.target.value as Availability | "all")}
                >
                  <option value="all">{t("catalog.all")}</option>
                  {(Object.keys(AVAILABILITY_META) as Availability[]).map((item) => (
                    <option key={item} value={item}>
                      {t(`common.availability.${item}`, AVAILABILITY_META[item].label)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="vj-field">
                <span className="vj-label">{t("showroom.audienceFilter", "Público")}</span>
                <select
                  className="vj-select"
                  value={audience}
                  onChange={(event) => setAudience(event.target.value)}
                >
                  <option value="all">{t("catalog.all")}</option>
                  {audiences.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>
              <label className="vj-field">
                <span className="vj-label">{t("showroom.layout", "Visualização")}</span>
                <select
                  className="vj-select"
                  value={layout}
                  onChange={(e) => setLayout(e.target.value as "grid" | "compact")}
                >
                  <option value="grid">{t("showroom.layout.grid", "Catálogo")}</option>
                  <option value="compact">{t("showroom.layout.compact", "Lista")}</option>
                </select>
              </label>
            </form>
          </search>

          <p className="vj-meta" role="status">
            {results.length === 1
              ? t("catalog.results", undefined, { count: results.length })
              : t("catalog.resultsPlural", undefined, { count: results.length })}
          </p>

          <div className={layout === "grid" ? "vj-showroom-grid" : "vj-showroom-list"}>
            {results.map((feature, index) => (
              <FeatureCard
                key={feature.slug}
                feature={feature}
                index={index}
                compact={layout === "compact"}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  feature,
  index,
  compact,
}: {
  feature: CatalogFeature;
  index: number;
  compact?: boolean;
}) {
  const { t } = useLocale();
  const meta = getToolDemoMeta(feature.slug);
  return (
    <article
      className={compact ? "vj-showroom-card is-compact" : "vj-showroom-card"}
      style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
    >
      <div className="vj-showroom-card-preview" aria-hidden="true">
        <div className="vj-showroom-soft-ui">
          <span />
          <span />
          <span />
        </div>
      </div>
      <div className="vj-showroom-card-body">
        <div className="vj-inline-actions">
          <AvailabilityBadge availability={feature.availability} />
          <span className="vj-meta">
            {t(categoryLabelKey(feature.category), CATEGORY_META[feature.category].label)}
          </span>
        </div>
        <h2 className="vj-section-title">
          <a href={`/ferramentas/${feature.slug}`}>
            {t(featureNameKey(feature.slug), feature.name)}
          </a>
        </h2>
        <p>{t(featureSummaryKey(feature.slug), feature.summary)}</p>
        <p className="vj-meta">{classLabel(meta?.publicDemo ?? null, t)}</p>
        <div className="vj-inline-actions">
          <ButtonLink href={`/ferramentas/${feature.slug}`} variant="secondary">
            {t("catalog.details")}
          </ButtonLink>
          {meta?.kind ? (
            <ButtonLink href={`/ferramentas/${feature.slug}#demonstracao`} variant="ghost">
              {t("catalog.demo")}
            </ButtonLink>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function FeatureDetail({ feature }: { feature: CatalogFeature }) {
  const { t } = useLocale();
  const meta = getToolDemoMeta(feature.slug);
  const sheet = getCommercialSheet(feature.slug);
  const nextHref = meta?.authenticatedHref
    ? `/entrar?next=${encodeURIComponent(meta.authenticatedHref)}`
    : "/cadastro";

  return (
    <div className="vj-stack vj-showroom-detail">
      <div className="vj-inline-actions">
        <AvailabilityBadge availability={feature.availability} />
        <span className="vj-meta">
          {t(categoryLabelKey(feature.category), CATEGORY_META[feature.category].label)}
        </span>
        <span className="vj-demo-class">{classLabel(meta?.publicDemo ?? null, t)}</span>
      </div>
      <h1 className="vj-display">{t(featureNameKey(feature.slug), feature.name)}</h1>
      <p className="vj-lead">{t(featureSummaryKey(feature.slug), feature.summary)}</p>
      <p>
        <strong>{t("catalog.problemLabel", "Problema")}: </strong>
        {t(featureProblemKey(feature.slug), feature.problem)}
      </p>

      {meta?.kind ? (
        <section id="demonstracao" className="vj-stack">
          <h2 className="vj-section-title">{t("showroom.tryDemo", "Experimentar demonstração")}</h2>
          <ToolDemoPanel kind={meta.kind} />
        </section>
      ) : (
        <section className="vj-card vj-card-calm">
          <h2 className="vj-section-title">{t("showroom.noInteractive", "Demonstração")}</h2>
          <p>
            {t(
              "showroom.noInteractiveBody",
              "Esta ferramenta não possui simulador público interativo. Use o catálogo autenticado ou o explorar geral.",
            )}
          </p>
          <ButtonLink href="/explorar">{t("home.finalCtaExplore")}</ButtonLink>
        </section>
      )}

      <section className="vj-card">
        <h2 className="vj-section-title">{t("catalog.capabilities")}</h2>
        <ul>
          {feature.capabilities.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <div className="vj-split">
        <section className="vj-card">
          <h2 className="vj-section-title">{t("catalog.audience")}</h2>
          <ul>
            {feature.audience.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
        <section className="vj-card">
          <h2 className="vj-section-title">{t("catalog.benefits")}</h2>
          <ul>
            {feature.benefits.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>

      <section className="vj-card vj-card-calm">
        <h2 className="vj-section-title">{t("catalog.limitations")}</h2>
        <p>
          {t(
            availabilityDescriptionKey(feature.availability),
            AVAILABILITY_META[feature.availability].description,
          )}
        </p>
        <ul>
          {feature.limitations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      {sheet ? (
        <section className="vj-card vj-showroom-commercial" aria-labelledby="commercial-heading">
          <h2 id="commercial-heading" className="vj-section-title">
            {t("showroom.commercial.title", "Ficha comercial")}
          </h2>
          <dl className="vj-showroom-dl">
            <div>
              <dt>{t("showroom.commercial.benefit", "Benefício principal")}</dt>
              <dd>{sheet.primaryBenefit}</dd>
            </div>
            <div>
              <dt>{t("showroom.commercial.demo", "Demonstração oferecida")}</dt>
              <dd>{sheet.demoOffered}</dd>
            </div>
            <div>
              <dt>{t("showroom.commercial.cost", "Custo operacional")}</dt>
              <dd>{sheet.estimatedOpsCost}</dd>
            </div>
            <div>
              <dt>{t("showroom.commercial.modality", "Modalidade sugerida")}</dt>
              <dd>{sheet.suggestedModality}</dd>
            </div>
            <div>
              <dt>{t("showroom.commercial.plan", "Plano elegível")}</dt>
              <dd>
                {sheet.eligiblePlan ??
                  t("showroom.commercial.planNone", "A validar — sem preço publicado")}
              </dd>
            </div>
            <div>
              <dt>{t("showroom.commercial.deps", "Dependências")}</dt>
              <dd>
                {sheet.integrationDeps.length
                  ? sheet.integrationDeps.join(" · ")
                  : t("showroom.commercial.noDeps", "Nenhuma integração obrigatória na demo")}
              </dd>
            </div>
          </dl>
          <p className="vj-hint">
            {t(
              "showroom.commercial.disclaimer",
              "Sem preços definitivos ou comissões inventadas. Validação comercial e jurídica pendente.",
            )}
          </p>
        </section>
      ) : null}

      <section className="vj-card">
        <h2 className="vj-section-title">{t("catalog.try")}</h2>
        <p>{t("catalog.tryBody")}</p>
        <div className="vj-form-actions">
          {meta?.kind ? (
            <ButtonLink href={`#demonstracao`}>{t("public.tools.demoCta")}</ButtonLink>
          ) : (
            <ButtonLink href="/explorar">{t("home.finalCtaExplore")}</ButtonLink>
          )}
          {meta?.authenticatedHref ? (
            <RequireAuthCta
              actionLabel={t("showroom.openModule", "Abrir módulo real")}
              message={t(
                "showroom.openModuleMsg",
                "Entre para usar o módulo autenticado correspondente.",
              )}
              redirectTo={meta.authenticatedHref}
              variant="secondary"
            />
          ) : null}
          {feature.requiresAuthFor.slice(0, 2).map((action) => (
            <RequireAuthCta
              key={action}
              actionLabel={action}
              message={t("catalog.authMessage", undefined, { action: action.toLowerCase() })}
              redirectTo={meta?.authenticatedHref ?? "/app"}
              variant="secondary"
            />
          ))}
          <ButtonLink href="/cadastro" variant="ghost">
            {t("nav.signup")}
          </ButtonLink>
          <ButtonLink href={nextHref} variant="ghost">
            {t("showroom.continueJourney", "Continuar jornada")}
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}
