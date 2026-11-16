"use client";

import {
  Breadcrumb,
  ButtonLink,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@verasjuris/ui";
import { useEffect, useState } from "react";
import {
  apiErrorMessage,
  fetchCrmOverview,
  getActiveOrgId,
  isApiFailure,
  type CrmOverview,
} from "../../../lib/crm";
import { useLocale } from "../../../components/locale-provider";

export default function CrmOverviewPage() {
  const { t } = useLocale();
  const [overview, setOverview] = useState<CrmOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const activeId = await getActiveOrgId();
      if (cancelled) return;
      if (!activeId) {
        setError(t("crm.noOrg"));
        setLoading(false);
        return;
      }
      const data = await fetchCrmOverview(activeId);
      if (cancelled) return;
      if (isApiFailure(data)) {
        setError(apiErrorMessage(data, t("crm.errorLoad")));
        setLoading(false);
        return;
      }
      setOverview(data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const empty =
    overview && overview.leads === 0 && overview.openLeads === 0 && overview.clients === 0;

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: t("dashboard.title"), href: "/app" },
          { label: t("crm.title"), href: "/app/crm" },
          { label: t("crm.overview") },
        ]}
      />
      <PageHeader
        title={t("crm.title")}
        description={t("crm.description")}
        eyebrow={t("crm.overview")}
      />
      {loading ? <LoadingState label={t("crm.loading")} /> : null}
      {error ? <ErrorState title={t("crm.error")}>{error}</ErrorState> : null}
      {!loading && !error && overview ? (
        empty ? (
          <EmptyState
            title={t("crm.emptyTitle")}
            action={
              <ButtonLink href="/app/crm/leads/novo" variant="primary">
                {t("crm.firstLead")}
              </ButtonLink>
            }
          >
            {t("crm.emptyBody")}
          </EmptyState>
        ) : (
          <>
            <div className="vj-split vj-metrics">
              <section className="vj-card" aria-labelledby="metric-leads">
                <h2 id="metric-leads" className="vj-section-title">
                  {t("crm.leads")}
                </h2>
                <p className="vj-display" style={{ fontSize: "2rem", margin: 0 }}>
                  {overview.leads}
                </p>
                <p className="vj-meta">{t("common.totalRegistered")}</p>
              </section>
              <section className="vj-card" aria-labelledby="metric-open">
                <h2 id="metric-open" className="vj-section-title">
                  {t("crm.openLeads")}
                </h2>
                <p className="vj-display" style={{ fontSize: "2rem", margin: 0 }}>
                  {overview.openLeads}
                </p>
                <p className="vj-meta">{t("crm.openLeadsHint")}</p>
              </section>
              <section className="vj-card" aria-labelledby="metric-clients">
                <h2 id="metric-clients" className="vj-section-title">
                  {t("dashboard.clients")}
                </h2>
                <p className="vj-display" style={{ fontSize: "2rem", margin: 0 }}>
                  {overview.clients}
                </p>
                <p className="vj-meta">{t("common.totalRegistered")}</p>
              </section>
            </div>
            <div className="vj-inline-actions">
              <ButtonLink href="/app/crm/leads">{t("crm.viewLeads")}</ButtonLink>
              <ButtonLink href="/app/crm/clientes" variant="secondary">
                {t("crm.viewClients")}
              </ButtonLink>
            </div>
          </>
        )
      ) : null}
    </div>
  );
}
