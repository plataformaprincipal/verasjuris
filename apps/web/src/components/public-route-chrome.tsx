"use client";

import { ButtonLink } from "@verasjuris/ui";
import type { CatalogCategory } from "../lib/public-catalog";
import { CATEGORY_META } from "../lib/public-catalog";
import { categoryLabelKey } from "../lib/public-i18n";
import { useLocale } from "./locale-provider";

export function ExploreRouteChrome({ children }: { children: React.ReactNode }) {
  const { t } = useLocale();
  return (
    <div className="vj-stack">
      <div>
        <p className="vj-meta">{t("public.explore.meta")}</p>
        <h1 className="vj-display">{t("public.explore.title")}</h1>
        <p className="vj-lead">{t("public.explore.lead")}</p>
      </div>
      {children}
    </div>
  );
}

export function ToolsRouteChrome({
  categories,
  children,
}: {
  categories: CatalogCategory[];
  children: React.ReactNode;
}) {
  const { t } = useLocale();
  return (
    <div className="vj-stack">
      <header className="vj-showroom-hero">
        <div className="vj-showroom-hero-orb" aria-hidden="true" />
        <div className="vj-showroom-hero-orb vj-showroom-hero-orb-2" aria-hidden="true" />
        <p className="vj-inicio-eyebrow">{t("public.tools.meta")}</p>
        <h1 className="vj-showroom-hero-title">{t("public.tools.title")}</h1>
        <p className="vj-lead">
          {t(
            "showroom.hero.lead",
            "Showroom jurídico interativo: experimente ferramentas com dados fictícios, entenda limitações e siga para o módulo real.",
          )}
        </p>
        <div className="vj-form-actions">
          <ButtonLink href="#catalogo">{t("showroom.hero.browse", "Explorar catálogo")}</ButtonLink>
          <ButtonLink href="/cadastro" variant="secondary">
            {t("public.tools.signupCta")}
          </ButtonLink>
          <ButtonLink href="/explorar?view=painel" variant="ghost">
            {t("public.tools.demoCta")}
          </ButtonLink>
        </div>
        <nav className="vj-chip-grid" aria-label={t("public.tools.categoriesAria")}>
          {categories.map((category) => (
            <a key={category} className="vj-badge" href={`/ferramentas?categoria=${category}`}>
              {t(categoryLabelKey(category), CATEGORY_META[category].label)}
            </a>
          ))}
        </nav>
      </header>
      <div id="catalogo">{children}</div>
    </div>
  );
}

export function JurisOneRouteChrome({ children }: { children: React.ReactNode }) {
  const { t } = useLocale();
  return (
    <div className="vj-stack">
      <div>
        <p className="vj-meta">{t("public.jurisOne.meta")}</p>
        <h1 className="vj-display">{t("public.jurisOne.title")}</h1>
        <p className="vj-lead">{t("public.jurisOne.lead")}</p>
      </div>
      {children}
    </div>
  );
}
