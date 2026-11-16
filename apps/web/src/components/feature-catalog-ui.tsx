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
import { AvailabilityBadge } from "./public-page-shell";
import { RequireAuthCta } from "./require-auth-cta";
import { useLocale } from "./locale-provider";

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

  const results = useMemo(() => {
    const base = query.trim() ? searchFeatures(query) : PUBLIC_CATALOG;
    return base.filter((feature) => {
      if (category !== "all" && feature.category !== category) return false;
      if (availability !== "all" && feature.availability !== availability) return false;
      return true;
    });
  }, [query, category, availability]);

  return (
    <div className="vj-stack">
      <search className="vj-card vj-catalog-filters" aria-label={t("catalog.searchAria")}>
        <form onSubmit={(event) => event.preventDefault()}>
          <label className="vj-field">
            <span className="vj-label">{t("catalog.search")}</span>
            <input
              className="vj-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("catalog.searchPlaceholder")}
              type="search"
            />
          </label>
          <label className="vj-field">
            <span className="vj-label">{t("catalog.category")}</span>
            <select
              className="vj-select"
              value={category}
              onChange={(event) => setCategory(event.target.value as CatalogCategory | "all")}
            >
              <option value="all">{t("catalog.all")}</option>
              {listCategories().map((item) => (
                <option key={item} value={item}>
                  {CATEGORY_META[item].label}
                </option>
              ))}
            </select>
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
        </form>
      </search>

      <p className="vj-meta" role="status">
        {results.length === 1
          ? t("catalog.results", undefined, { count: results.length })
          : t("catalog.resultsPlural", undefined, { count: results.length })}
      </p>

      <div className="vj-feature-grid">
        {results.map((feature) => (
          <FeatureCard key={feature.slug} feature={feature} />
        ))}
      </div>
    </div>
  );
}

function FeatureCard({ feature }: { feature: CatalogFeature }) {
  const { t } = useLocale();
  return (
    <article className="vj-card">
      <div className="vj-inline-actions">
        <AvailabilityBadge availability={feature.availability} />
        <span className="vj-meta">{CATEGORY_META[feature.category].label}</span>
      </div>
      <h2 className="vj-section-title">
        <a href={`/ferramentas/${feature.slug}`}>{feature.name}</a>
      </h2>
      <p>{feature.summary}</p>
      <p className="vj-meta">{t("catalog.problem", undefined, { problem: feature.problem })}</p>
      <div className="vj-inline-actions">
        <ButtonLink href={`/ferramentas/${feature.slug}`} variant="secondary">
          {t("catalog.details")}
        </ButtonLink>
        {feature.demoView ? (
          <ButtonLink href={`/explorar?view=${feature.demoView}`} variant="ghost">
            {t("catalog.demo")}
          </ButtonLink>
        ) : null}
      </div>
    </article>
  );
}

export function FeatureDetail({ feature }: { feature: CatalogFeature }) {
  const { t } = useLocale();
  return (
    <div className="vj-stack">
      <div className="vj-inline-actions">
        <AvailabilityBadge availability={feature.availability} />
        <span className="vj-meta">{CATEGORY_META[feature.category].label}</span>
      </div>
      <h1 className="vj-display">{feature.name}</h1>
      <p className="vj-lead">{feature.summary}</p>
      <p>{feature.problem}</p>

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
        <p>{AVAILABILITY_META[feature.availability].description}</p>
        <ul>
          {feature.limitations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="vj-card">
        <h2 className="vj-section-title">{t("catalog.try")}</h2>
        <p>{t("catalog.tryBody")}</p>
        <div className="vj-form-actions">
          {feature.demoView ? (
            <ButtonLink href={`/explorar?view=${feature.demoView}`}>
              {t("public.tools.demoCta")}
            </ButtonLink>
          ) : (
            <ButtonLink href="/explorar">{t("home.finalCtaExplore")}</ButtonLink>
          )}
          {feature.requiresAuthFor.slice(0, 2).map((action) => (
            <RequireAuthCta
              key={action}
              actionLabel={action}
              message={t("catalog.authMessage", undefined, { action: action.toLowerCase() })}
              redirectTo={`/app`}
              variant="secondary"
            />
          ))}
          <ButtonLink href="/cadastro" variant="ghost">
            {t("nav.signup")}
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}
