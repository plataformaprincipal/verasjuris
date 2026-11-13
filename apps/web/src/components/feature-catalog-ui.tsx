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

export function FeatureCatalogBrowser({
  initialCategory,
  initialQuery = "",
}: {
  initialCategory?: CatalogCategory | null;
  initialQuery?: string;
}) {
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
      <form
        className="vj-card vj-catalog-filters"
        onSubmit={(event) => event.preventDefault()}
        role="search"
        aria-label="Pesquisar funcionalidades"
      >
        <label className="vj-field">
          <span className="vj-label">Pesquisar</span>
          <input
            className="vj-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ex.: prazos, petições, marketplace"
            type="search"
          />
        </label>
        <label className="vj-field">
          <span className="vj-label">Categoria</span>
          <select
            className="vj-select"
            value={category}
            onChange={(event) => setCategory(event.target.value as CatalogCategory | "all")}
          >
            <option value="all">Todas</option>
            {listCategories().map((item) => (
              <option key={item} value={item}>
                {CATEGORY_META[item].label}
              </option>
            ))}
          </select>
        </label>
        <label className="vj-field">
          <span className="vj-label">Disponibilidade</span>
          <select
            className="vj-select"
            value={availability}
            onChange={(event) => setAvailability(event.target.value as Availability | "all")}
          >
            <option value="all">Todas</option>
            {(Object.keys(AVAILABILITY_META) as Availability[]).map((item) => (
              <option key={item} value={item}>
                {AVAILABILITY_META[item].label}
              </option>
            ))}
          </select>
        </label>
      </form>

      <p className="vj-meta" role="status">
        {results.length} funcionalidade{results.length === 1 ? "" : "s"} encontrada
        {results.length === 1 ? "" : "s"}
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
      <p className="vj-meta">Problema que resolve: {feature.problem}</p>
      <div className="vj-inline-actions">
        <ButtonLink href={`/ferramentas/${feature.slug}`} variant="secondary">
          Detalhes
        </ButtonLink>
        {feature.demoView ? (
          <ButtonLink href={`/explorar?view=${feature.demoView}`} variant="ghost">
            Ver demonstração
          </ButtonLink>
        ) : null}
      </div>
    </article>
  );
}

export function FeatureDetail({ feature }: { feature: CatalogFeature }) {
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
        <h2 className="vj-section-title">Principais recursos</h2>
        <ul>
          {feature.capabilities.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <div className="vj-split">
        <section className="vj-card">
          <h2 className="vj-section-title">Para quem</h2>
          <ul>
            {feature.audience.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
        <section className="vj-card">
          <h2 className="vj-section-title">Benefícios operacionais</h2>
          <ul>
            {feature.benefits.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>

      <section className="vj-card vj-card-calm">
        <h2 className="vj-section-title">Limitações e disponibilidade</h2>
        <p>{AVAILABILITY_META[feature.availability].description}</p>
        <ul>
          {feature.limitations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="vj-card">
        <h2 className="vj-section-title">Experimentar</h2>
        <p>
          A pré-visualização pública permite conhecer o módulo. Operações reais exigem autenticação.
        </p>
        <div className="vj-form-actions">
          {feature.demoView ? (
            <ButtonLink href={`/explorar?view=${feature.demoView}`}>Abrir demonstração</ButtonLink>
          ) : (
            <ButtonLink href="/explorar">Explorar o VerasJuris</ButtonLink>
          )}
          {feature.requiresAuthFor.slice(0, 2).map((action) => (
            <RequireAuthCta
              key={action}
              actionLabel={action}
              title="Entre para continuar"
              message={`Para ${action.toLowerCase()}, entre na sua conta ou cadastre-se no VerasJuris.`}
              redirectTo={`/app`}
              variant="secondary"
            />
          ))}
          <ButtonLink href="/cadastro" variant="ghost">
            Criar conta
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}
