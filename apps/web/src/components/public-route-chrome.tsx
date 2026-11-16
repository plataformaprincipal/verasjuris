"use client";

import { ButtonLink } from "@verasjuris/ui";
import type { CatalogCategory } from "../lib/public-catalog";
import { CATEGORY_META } from "../lib/public-catalog";
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
      <div>
        <p className="vj-meta">{t("public.tools.meta")}</p>
        <h1 className="vj-display">{t("public.tools.title")}</h1>
        <p className="vj-lead">{t("public.tools.lead")}</p>
        <div className="vj-form-actions">
          <ButtonLink href="/explorar?view=painel">{t("public.tools.demoCta")}</ButtonLink>
          <ButtonLink href="/cadastro" variant="secondary">
            {t("public.tools.signupCta")}
          </ButtonLink>
        </div>
      </div>
      <nav className="vj-chip-grid" aria-label={t("public.tools.categoriesAria")}>
        {categories.map((category) => (
          <a key={category} className="vj-badge" href={`/ferramentas?categoria=${category}`}>
            {CATEGORY_META[category].label}
          </a>
        ))}
      </nav>
      {children}
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
