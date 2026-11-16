"use client";

import { listByCategory } from "../lib/public-catalog";
import { featureNameKey, featureSummaryKey } from "../lib/public-i18n";
import { AvailabilityBadge, PublicPageShell } from "./public-page-shell";
import { useLocale } from "./locale-provider";

const EXTRA = [
  {
    key: "tribunais",
    availability: "planned" as const,
  },
  {
    key: "orgaos",
    availability: "planned" as const,
  },
  {
    key: "assinatura",
    availability: "in_development" as const,
  },
  {
    key: "storage",
    availability: "in_development" as const,
  },
];

export function IntegrationsPublicPage() {
  const { t } = useLocale();
  const catalog = listByCategory("integracoes");

  return (
    <PublicPageShell>
      <div className="vj-stack">
        <div>
          <p className="vj-meta">{t("public.integrations.meta")}</p>
          <h1 className="vj-display">{t("public.integrations.title")}</h1>
          <p className="vj-lead">{t("public.integrations.lead")}</p>
        </div>

        <div className="vj-feature-grid">
          {catalog.map((feature) => (
            <article key={feature.slug} className="vj-card">
              <AvailabilityBadge availability={feature.availability} />
              <h2 className="vj-section-title">
                <a href={`/ferramentas/${feature.slug}`}>
                  {t(featureNameKey(feature.slug), feature.name)}
                </a>
              </h2>
              <p>{t(featureSummaryKey(feature.slug), feature.summary)}</p>
              <p className="vj-meta">{feature.limitations[0]}</p>
            </article>
          ))}
          {EXTRA.map((item) => (
            <article key={item.key} className="vj-card">
              <AvailabilityBadge availability={item.availability} />
              <h2 className="vj-section-title">
                {t(`public.integrations.extra.${item.key}.name`)}
              </h2>
              <p>{t(`public.integrations.extra.${item.key}.note`)}</p>
            </article>
          ))}
        </div>
      </div>
    </PublicPageShell>
  );
}
