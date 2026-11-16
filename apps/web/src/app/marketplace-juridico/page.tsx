"use client";

import { ButtonLink } from "@verasjuris/ui";
import { useLocale } from "../../components/locale-provider";
import { PublicPageShell } from "../../components/public-page-shell";
import { RequireAuthCta } from "../../components/require-auth-cta";
import { DEMO_MARKETPLACE_SERVICES } from "../../lib/demo-data";
import { getFeature } from "../../lib/public-catalog";

export default function MarketplaceJuridicoPage() {
  const { t } = useLocale();
  const feature = getFeature("marketplace-juridico");

  return (
    <PublicPageShell>
      <div className="vj-stack">
        <div>
          <p className="vj-meta">{t("marketplace.public.meta")}</p>
          <h1 className="vj-display">{t("marketplace.public.knowTitle")}</h1>
          <p className="vj-lead">{t("marketplace.public.lead")}</p>
          <p className="vj-demo-banner" role="status">
            {t("demo.banner")}
          </p>
          <div className="vj-form-actions">
            <RequireAuthCta
              actionLabel={t("marketplace.public.requestProposal")}
              title={t("marketplace.public.requestTitle")}
              message={t("marketplace.public.requestMessage")}
              redirectTo="/marketplace/solicitacoes/nova"
            />
            <ButtonLink href="/explorar?view=marketplace" variant="secondary">
              {t("marketplace.public.demoCta")}
            </ButtonLink>
            <ButtonLink href="/ferramentas/marketplace-juridico" variant="ghost">
              {t("marketplace.public.moduleDetails")}
            </ButtonLink>
          </div>
        </div>

        <section className="vj-card">
          <h2 className="vj-section-title">{t("marketplace.public.howTitle")}</h2>
          <ol>
            <li>{t("marketplace.public.how1")}</li>
            <li>{t("marketplace.public.how2")}</li>
            <li>{t("marketplace.public.how3")}</li>
            <li>{t("marketplace.public.how4")}</li>
          </ol>
        </section>

        <section className="vj-stack">
          <h2 className="vj-section-title">{t("marketplace.public.examplesTitle")}</h2>
          <div className="vj-feature-grid">
            {DEMO_MARKETPLACE_SERVICES.map((service) => (
              <article key={service.id} className="vj-card">
                <p className="vj-meta">{t("marketplace.public.demoProfile")}</p>
                <h3 className="vj-section-title">
                  {t(`demo.marketplace.${service.id}.title`, service.title)}
                </h3>
                <p>{t(`demo.marketplace.${service.id}.description`, service.description)}</p>
                <p className="vj-meta">
                  {t(`demo.marketplace.${service.id}.provider`, service.provider)} ·{" "}
                  {t(`demo.marketplace.${service.id}.area`, service.area)}
                </p>
                <p className="vj-meta">{t("demo.marketplace.priceNote", service.priceNote)}</p>
                <RequireAuthCta
                  actionLabel={t("marketplace.public.hire")}
                  title={t("marketplace.public.hireTitle")}
                  message={t("marketplace.public.hireMessage")}
                  redirectTo="/marketplace"
                  variant="secondary"
                />
              </article>
            ))}
          </div>
        </section>

        {feature ? (
          <section className="vj-card vj-card-calm">
            <h2 className="vj-section-title">{t("marketplace.public.limitationsTitle")}</h2>
            <ul>
              {feature.limitations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </PublicPageShell>
  );
}
