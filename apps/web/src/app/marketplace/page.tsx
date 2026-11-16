"use client";

import { Breadcrumb, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { SectionTabs } from "../../components/ai-ui";
import {
  MARKETPLACE_PUBLIC_TABS,
  translateMarketplaceTabs,
  MarketplacePaymentBanner,
  MarketplaceProfessionalsGrid,
  MarketplaceRequestsTable,
} from "../../components/marketplace-ui";
import {
  fetchMarketplaceCategories,
  fetchMarketplacePaymentStatus,
  fetchMarketplaceProfessionals,
  fetchMarketplaceRequests,
  getActiveOrgId,
  hasMarketplacePermission,
  isApiFailure,
  marketplaceErrorMessage,
  type MarketplaceProfessional,
  type MarketplaceRequest,
} from "../../lib/marketplace";
import { useOrgContext } from "../../lib/use-org-context";
import { useLocale } from "../../components/locale-provider";

export default function MarketplaceHomePage() {
  const { t } = useLocale();
  const org = useOrgContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [professionals, setProfessionals] = useState<MarketplaceProfessional[]>([]);
  const [requests, setRequests] = useState<MarketplaceRequest[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!org.ready) return;
      const orgId = org.orgId ?? (await getActiveOrgId());
      if (!orgId) {
        setLoading(false);
        return;
      }
      const [professionalsRes, requestsRes, payment] = await Promise.all([
        fetchMarketplaceProfessionals({ limit: 6 }),
        hasMarketplacePermission(org.permissions, "read")
          ? fetchMarketplaceRequests(orgId, { limit: 6 })
          : Promise.resolve({ items: [] as MarketplaceRequest[] }),
        fetchMarketplacePaymentStatus(orgId),
      ]);
      if (cancelled) return;
      if (isApiFailure(professionalsRes)) setError(marketplaceErrorMessage(professionalsRes));
      else {
        setProfessionals(professionalsRes.items);
        if (!isApiFailure(requestsRes)) setRequests(requestsRes.items);
      }
      if (!isApiFailure(payment)) setPaymentStatus(payment.payment.status);
      await fetchMarketplaceCategories(orgId);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, org.permissions]);

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: t("marketplace.publicTitle") }]} />
      <PageHeader
        title={t("marketplace.publicTitle")}
        description={t("marketplace.publicDescription")}
      />
      <SectionTabs
        label={t("common.sections")}
        items={translateMarketplaceTabs(t, MARKETPLACE_PUBLIC_TABS)}
        current=""
      />
      <MarketplacePaymentBanner status={paymentStatus} />
      {loading ? <LoadingState label={t("marketplace.loading")} /> : null}
      {error ? <p role="alert">{error}</p> : null}
      {!loading && !error ? (
        <>
          <section className="vj-stack">
            <h2 className="vj-subtitle">{t("marketplace.featuredProfessionals")}</h2>
            <MarketplaceProfessionalsGrid items={professionals} />
          </section>
          <section className="vj-stack">
            <h2 className="vj-subtitle">{t("marketplace.recentRequests")}</h2>
            <MarketplaceRequestsTable items={requests} />
          </section>
        </>
      ) : null}
    </div>
  );
}
