"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { CommercialPlansGrid } from "../../components/commerce-catalog-ui";
import {
  commerceErrorMessage,
  fetchCommercialCatalog,
  isApiFailure,
  type CommercialCatalogItem,
} from "../../lib/commerce";
import { useLocale } from "../../components/locale-provider";

export default function PublicPlanosPage() {
  const { t } = useLocale();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<CommercialCatalogItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetchCommercialCatalog({
        commercialType: "plan",
        publicOnly: true,
        limit: 50,
      });
      if (cancelled) return;
      if (isApiFailure(res)) setError(commerceErrorMessage(res));
      else setItems(res.items);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="vj-page" id="conteudo">
      <div className="vj-stack">
        <Breadcrumb
          items={[{ label: t("plans.homeBreadcrumb"), href: "/" }, { label: t("plans.title") }]}
        />
        <PageHeader title={t("plans.title")} description={t("plans.description")} />
        {loading ? <LoadingState label={t("plans.loading")} /> : null}
        {error ? <ErrorState title={t("plans.error")}>{error}</ErrorState> : null}
        {!loading && !error ? <CommercialPlansGrid items={items} /> : null}
      </div>
    </main>
  );
}
