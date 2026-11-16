"use client";

import { ButtonLink } from "@verasjuris/ui";
import type { CatalogFeature } from "../lib/public-catalog";
import {
  featureNameKey,
  featureSummaryKey,
  solutionSummaryKey,
  solutionTitleKey,
} from "../lib/public-i18n";
import type { Solution } from "../lib/solutions";
import { useLocale } from "./locale-provider";

export function SolutionPublicView({
  solution,
  features,
}: {
  solution: Solution;
  features: CatalogFeature[];
}) {
  const { t } = useLocale();

  return (
    <div className="vj-stack">
      <div>
        <p className="vj-meta">{t("solution.page.meta")}</p>
        <h1 className="vj-display">{t(solutionTitleKey(solution.slug), solution.title)}</h1>
        <p className="vj-lead">{t(solutionSummaryKey(solution.slug), solution.summary)}</p>
        <div className="vj-form-actions">
          <ButtonLink href={solution.cta.href}>
            {solution.cta.href.startsWith("/cadastro")
              ? t("nav.signup")
              : solution.cta.href.includes("marketplace")
                ? t("home.marketplace.ctaExplore")
                : solution.cta.label}
          </ButtonLink>
          <ButtonLink href="/explorar" variant="secondary">
            {t("solution.page.exploreDemo")}
          </ButtonLink>
        </div>
      </div>

      <section className="vj-card">
        <h2 className="vj-section-title">{t("solution.page.problemsTitle")}</h2>
        <ul>
          {solution.problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      </section>

      <section className="vj-stack">
        <h2 className="vj-section-title">{t("solution.page.featuresTitle")}</h2>
        <div className="vj-feature-grid">
          {features.map((feature) => (
            <a
              key={feature.slug}
              className="vj-card vj-card-link"
              href={`/ferramentas/${feature.slug}`}
            >
              <h3 className="vj-section-title">{t(featureNameKey(feature.slug), feature.name)}</h3>
              <p>{t(featureSummaryKey(feature.slug), feature.summary)}</p>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
