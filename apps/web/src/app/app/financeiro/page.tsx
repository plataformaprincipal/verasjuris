"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../components/ai-ui";
import {
  FinanceDashboardCards,
  HonorariosTable,
  InvoicesTable,
  PaymentIntentsTable,
  financeTabsForPermissions,
} from "../../../components/finance-ui";
import {
  fetchBillingDashboard,
  fetchBillingInvoices,
  fetchHonorarios,
  fetchPaymentIntents,
  financeErrorMessage,
  hasFinancePermission,
  isApiFailure,
  type BillingInvoice,
  type FinanceDashboard,
  type LegalFeeAgreement,
  type PaymentIntent,
} from "../../../lib/finance";
import { useOrgContext } from "../../../lib/use-org-context";
import { useLocale } from "../../../components/locale-provider";

export default function AppFinanceiroPage() {
  const { t } = useLocale();
  const org = useOrgContext();
  const can = hasFinancePermission(org.permissions, "read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<FinanceDashboard | null>(null);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [charges, setCharges] = useState<PaymentIntent[]>([]);
  const [fees, setFees] = useState<LegalFeeAgreement[]>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const [d, inv, intents, honor] = await Promise.all([
        fetchBillingDashboard(org.orgId!),
        fetchBillingInvoices(org.orgId!, { limit: 5 }),
        hasFinancePermission(org.permissions, "payment.read")
          ? fetchPaymentIntents(org.orgId!, { limit: 5 })
          : Promise.resolve({ items: [] as PaymentIntent[] }),
        hasFinancePermission(org.permissions, "fee.manage") || can
          ? fetchHonorarios(org.orgId!, { limit: 5 })
          : Promise.resolve({ items: [] as LegalFeeAgreement[] }),
      ]);
      if (cancelled) return;
      if (isApiFailure(d)) setError(financeErrorMessage(d));
      else setDashboard(d);
      if (!isApiFailure(inv)) setInvoices(inv.items);
      if (!isApiFailure(intents)) setCharges(intents.items);
      if (!isApiFailure(honor)) setFees(honor.items);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, can, org.permissions]);

  if (org.ready && !can) {
    return <NoPermission>{t("finance.noPermission")}</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: t("dashboard.title"), href: "/app" }, { label: t("finance.title") }]} />
      <PageHeader
        title={t("finance.title")}
        description={t("finance.description")}
      />
      <SectionTabs
        label={t("common.sections")}
        items={financeTabsForPermissions(org.permissions)}
        current="/app/financeiro"
      />
      {loading ? <LoadingState label={t("finance.loading")} /> : null}
      {error ? <ErrorState title={t("common.errorTitle")}>{error}</ErrorState> : null}
      {!loading && !error && dashboard ? <FinanceDashboardCards data={dashboard} /> : null}
      {!loading && !error ? (
        <>
          <section className="vj-stack">
            <h2 className="vj-subtitle">{t("finance.recentInvoices")}</h2>
            <InvoicesTable items={invoices} />
          </section>
          <section className="vj-stack">
            <h2 className="vj-subtitle">{t("finance.recentCharges")}</h2>
            <PaymentIntentsTable items={charges} />
          </section>
          <section className="vj-stack">
            <h2 className="vj-subtitle">{t("finance.fees")}</h2>
            <HonorariosTable items={fees} />
          </section>
        </>
      ) : null}
    </div>
  );
}
