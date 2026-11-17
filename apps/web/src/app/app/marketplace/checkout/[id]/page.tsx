"use client";

import { Alert, Breadcrumb, Button, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useLocale } from "../../../../../components/locale-provider";
import {
  fetchMarketplaceCheckout,
  formatMoneyCents,
  isApiFailure,
  marketplaceErrorMessage,
  type MarketplaceCheckoutAttempt,
} from "../../../../../lib/marketplace";
import { useOrgContext } from "../../../../../lib/use-org-context";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  processing: "Processando",
  completed: "Cobranças geradas",
  partial_failed: "Parcialmente concluído",
  failed: "Falhou",
  payment_initiated: "Aguardando pagamento",
  engagement_created: "Contratação criada",
  skipped: "Ignorado",
};

export default function MarketplaceCheckoutPage() {
  const { t, locale } = useLocale();
  const params = useParams<{ id: string }>();
  const org = useOrgContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<MarketplaceCheckoutAttempt | null>(null);

  useEffect(() => {
    if (!org.ready || !org.orgId) return;
    let cancelled = false;
    void fetchMarketplaceCheckout(org.orgId, params.id).then((data) => {
      if (cancelled) return;
      if (isApiFailure(data)) setError(marketplaceErrorMessage(data));
      else setCheckout(data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, params.id]);

  const orgId = org.orgId;
  const checkoutStatus = checkout?.status;
  useEffect(() => {
    if (!orgId || !checkoutStatus) return;
    if (checkoutStatus === "completed" || checkoutStatus === "failed") return;
    const timer = window.setInterval(() => {
      void fetchMarketplaceCheckout(orgId, params.id).then((data) => {
        if (!isApiFailure(data)) setCheckout(data);
      });
    }, 8000);
    return () => window.clearInterval(timer);
  }, [orgId, checkoutStatus, params.id]);

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: t("dashboard.title", "Início"), href: "/app" },
          { label: t("inicio.cart", "Carrinho"), href: "/app/carrinho" },
          { label: t("inicio.checkout.title", "Checkout") },
        ]}
      />
      {loading ? <LoadingState label={t("common.loading")} /> : null}
      {error ? <ErrorState title={t("common.error", "Erro")}>{error}</ErrorState> : null}
      {checkout ? (
        <>
          <PageHeader
            title={t("inicio.checkout.title", "Checkout")}
            description={`${STATUS_LABEL[checkout.status] ?? checkout.status} · ${formatMoneyCents(checkout.totalCents)}`}
          />
          <Alert tone="info" title={t("inicio.pay.confirmTitle", "Confirmação")}>
            {t(
              "inicio.pay.confirmBody",
              "O retorno desta página ou do Asaas não confirma o pagamento. A contratação só avança após webhook autenticado do provedor.",
            )}
          </Alert>
          {checkout.lastError ? (
            <ErrorState title={t("inicio.checkout.error", "Checkout")}>
              {checkout.lastError}
            </ErrorState>
          ) : null}
          <ul className="vj-stack">
            {checkout.items.map((item) => {
              const pix = item.paymentInstructions;
              return (
                <li key={item.id} className="vj-card vj-stack">
                  <strong>{item.serviceTitle}</strong>
                  <p className="vj-meta">
                    {STATUS_LABEL[item.status] ?? item.status}
                    {item.paymentStatus ? ` · ${item.paymentStatus}` : ""}
                    {" · "}
                    {formatMoneyCents(item.amountCents)}
                  </p>
                  {item.errorMessage ? <p className="vj-hint">{item.errorMessage}</p> : null}
                  {pix.pixQrCodeBase64 ? (
                    <img
                      alt={t("inicio.pay.pixQr", "QR Code Pix")}
                      src={`data:image/png;base64,${pix.pixQrCodeBase64}`}
                      width={180}
                      height={180}
                    />
                  ) : null}
                  {pix.pixCopyPaste ? (
                    <label className="vj-field">
                      <span className="vj-label">
                        {t("inicio.pay.pixCopy", "Pix copia e cola")}
                      </span>
                      <textarea className="vj-input" readOnly rows={3} value={pix.pixCopyPaste} />
                    </label>
                  ) : null}
                  {pix.boletoDigitableLine ? (
                    <p>
                      <strong>{t("inicio.pay.boletoLine", "Linha digitável")}:</strong>{" "}
                      {pix.boletoDigitableLine}
                    </p>
                  ) : null}
                  {pix.pixExpiresAt ? (
                    <p className="vj-meta">
                      {t("inicio.pay.expires", "Validade")}:{" "}
                      {new Date(pix.pixExpiresAt).toLocaleString(locale)}
                    </p>
                  ) : null}
                  <div className="vj-inline-actions">
                    {pix.checkoutUrl || pix.invoiceUrl || pix.bankSlipUrl ? (
                      <a
                        className="vj-button"
                        href={(pix.checkoutUrl || pix.invoiceUrl || pix.bankSlipUrl)!}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t("inicio.pay.openProvider", "Abrir no provedor")}
                      </a>
                    ) : null}
                    {item.engagementId ? (
                      <Link
                        className="vj-button vj-button-secondary"
                        href={`/app/marketplace/contratacoes/${item.engagementId}`}
                      >
                        {t("inicio.engagement.detail", "Ver contratação")}
                      </Link>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
          <Button
            type="button"
            className="vj-button-secondary"
            onClick={() => window.location.reload()}
          >
            {t("inicio.pay.refresh", "Atualizar status")}
          </Button>
        </>
      ) : null}
    </div>
  );
}
