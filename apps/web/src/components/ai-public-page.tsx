"use client";

import { ButtonLink } from "@verasjuris/ui";
import { listByCategory } from "../lib/public-catalog";
import { featureNameKey, featureProblemKey, featureSummaryKey } from "../lib/public-i18n";
import { AvailabilityBadge, PublicPageShell } from "./public-page-shell";
import { RequireAuthCta } from "./require-auth-cta";
import { useLocale } from "./locale-provider";

export function AiPublicPage() {
  const { t } = useLocale();
  const features = listByCategory("inteligencia_artificial");

  return (
    <PublicPageShell>
      <div className="vj-stack">
        <div>
          <p className="vj-meta">{t("public.ai.meta")}</p>
          <h1 className="vj-display">{t("public.ai.title")}</h1>
          <p className="vj-lead">{t("public.ai.lead")}</p>
          <div className="vj-form-actions">
            <ButtonLink href="/ferramentas?categoria=inteligencia_artificial">
              {t("public.ai.toolsCta")}
            </ButtonLink>
            <RequireAuthCta
              actionLabel={t("public.ai.runAnalysis")}
              title={t("public.ai.authTitle")}
              message={t("public.ai.authMessage")}
              redirectTo="/app/ia"
              variant="secondary"
            />
          </div>
        </div>

        <section className="vj-card vj-card-calm">
          <h2 className="vj-section-title">{t("public.ai.noticesTitle")}</h2>
          <ul>
            <li>{t("public.ai.purpose1")}</li>
            <li>{t("public.ai.purpose2")}</li>
            <li>{t("public.ai.purpose3")}</li>
            <li>{t("public.ai.purpose4")}</li>
          </ul>
        </section>

        <div className="vj-feature-grid">
          {features.map((feature) => (
            <article key={feature.slug} className="vj-card">
              <AvailabilityBadge availability={feature.availability} />
              <h2 className="vj-section-title">
                <a href={`/ferramentas/${feature.slug}`}>
                  {t(featureNameKey(feature.slug), feature.name)}
                </a>
              </h2>
              <p>{t(featureSummaryKey(feature.slug), feature.summary)}</p>
              <p className="vj-meta">
                {t("public.ai.purposeLabel")}: {t(featureProblemKey(feature.slug), feature.problem)}
              </p>
              <p className="vj-meta">
                {t("public.ai.limitationsLabel")}: {feature.limitations[0]}
              </p>
            </article>
          ))}
        </div>
      </div>
    </PublicPageShell>
  );
}
