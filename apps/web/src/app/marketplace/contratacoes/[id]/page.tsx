"use client";

import { Alert, Breadcrumb, Button, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useLocale } from "../../../../components/locale-provider";
import {
  MARKETPLACE_ENGAGEMENT_STATUS_LABELS,
  cancelMarketplaceEngagement,
  fetchMarketplaceEngagement,
  initiateMarketplaceProviderPayment,
  isApiFailure,
  marketplaceErrorMessage,
  requestMarketplaceRefund,
  type MarketplaceDelivery,
  type MarketplaceDispute,
  type MarketplaceEngagement,
  type MarketplaceEngagementEvent,
} from "../../../../lib/marketplace";
import { useOrgContext } from "../../../../lib/use-org-context";

const CANCELLABLE = new Set([
  "pending_contract",
  "pending_payment",
  "active",
  "waiting_client",
  "waiting_provider",
  "delivered",
]);

export default function MarketplaceEngagementPublicPage() {
  const { t, locale } = useLocale();
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const org = useOrgContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [engagement, setEngagement] = useState<MarketplaceEngagement | null>(null);
  const [deliveries, setDeliveries] = useState<MarketplaceDelivery[]>([]);
  const [disputes, setDisputes] = useState<MarketplaceDispute[]>([]);
  const [events, setEvents] = useState<MarketplaceEngagementEvent[]>([]);
  const [cancelReason, setCancelReason] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  async function reload(orgId: string) {
    const data = await fetchMarketplaceEngagement(orgId, params.id);
    if (isApiFailure(data)) {
      setError(marketplaceErrorMessage(data));
      return;
    }
    setEngagement(data.engagement);
    setDeliveries(data.deliveries);
    setDisputes(data.disputes);
    setEvents(data.events ?? []);
    setError(null);
  }

  useEffect(() => {
    const orgId = org.orgId;
    const engagementId = params.id;
    if (!org.ready || !orgId || !engagementId) return;
    let cancelled = false;
    void (async () => {
      const data = await fetchMarketplaceEngagement(orgId, engagementId);
      if (cancelled) return;
      if (isApiFailure(data)) {
        setError(marketplaceErrorMessage(data));
      } else {
        setEngagement(data.engagement);
        setDeliveries(data.deliveries);
        setDisputes(data.disputes);
        setEvents(data.events ?? []);
        setError(null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, params.id]);

  async function startProviderPayment() {
    if (!org.orgId || !engagement) return;
    setPaying(true);
    setPayError(null);
    const result = await initiateMarketplaceProviderPayment(org.orgId, engagement.id, {
      paymentMethod: "pix",
    });
    setPaying(false);
    if (isApiFailure(result)) {
      setPayError(marketplaceErrorMessage(result));
      return;
    }
    if (result.checkoutUrl) {
      window.location.assign(result.checkoutUrl);
      return;
    }
    setPayError(
      t(
        "inicio.pay.noUrl",
        "Cobrança criada, mas sem URL de checkout. Confirme o pagamento apenas após validação do provedor (webhook).",
      ),
    );
  }

  async function onCancel() {
    if (!org.orgId || !engagement || cancelReason.trim().length < 10) return;
    setActing(true);
    setActionError(null);
    const result = await cancelMarketplaceEngagement(org.orgId, engagement.id, {
      reason: cancelReason.trim(),
    });
    setActing(false);
    if (isApiFailure(result)) {
      setActionError(marketplaceErrorMessage(result));
      return;
    }
    setCancelReason("");
    await reload(org.orgId);
  }

  async function onRefund() {
    if (!org.orgId || !engagement || refundReason.trim().length < 10) return;
    setActing(true);
    setActionError(null);
    const result = await requestMarketplaceRefund(org.orgId, engagement.id, {
      reason: refundReason.trim(),
    });
    setActing(false);
    if (isApiFailure(result)) {
      setActionError(marketplaceErrorMessage(result));
      return;
    }
    setRefundReason("");
    await reload(org.orgId);
  }

  const inApp = pathname.startsWith("/app/");
  const homeHref = inApp ? "/app" : "/marketplace";
  const listHref = inApp ? "/app/marketplace/contratacoes" : "/marketplace";

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: t("marketplace.title"), href: homeHref },
          { label: t("marketplace.engagements", "Contratações"), href: listHref },
          { label: t("inicio.engagement.detail", "Detalhe") },
        ]}
      />
      {loading ? <LoadingState label={t("common.loading")} /> : null}
      {error ? <ErrorState title={t("common.error", "Erro")}>{error}</ErrorState> : null}
      {engagement ? (
        <>
          <PageHeader
            title={`${t("inicio.engagement.title", "Contratação")} ${engagement.id.slice(0, 8)}`}
            description={
              MARKETPLACE_ENGAGEMENT_STATUS_LABELS[engagement.status] ?? engagement.status
            }
          />
          {engagement.financialStatus && engagement.financialStatus !== "none" ? (
            <Alert tone="info" title={t("inicio.engagement.financial", "Status financeiro")}>
              {engagement.financialStatus}
              {engagement.cancellationReason
                ? ` — ${engagement.cancellationReason.slice(0, 120)}`
                : null}
            </Alert>
          ) : null}

          {engagement.status === "pending_payment" ? (
            <section className="vj-card vj-stack" aria-labelledby="payment-heading">
              <h2 id="payment-heading" className="vj-subtitle">
                {t("inicio.pay.title", "Pagamento")}
              </h2>
              <p className="vj-hint">
                {t(
                  "inicio.pay.hint",
                  "A liberação do serviço ocorre somente após confirmação financeira no backend (webhook/provedor). O retorno visual do checkout não marca o pedido como pago.",
                )}
              </p>
              {payError ? (
                <ErrorState title={t("inicio.pay.title", "Pagamento")}>{payError}</ErrorState>
              ) : null}
              <Button type="button" onClick={() => void startProviderPayment()} disabled={paying}>
                {paying
                  ? t("inicio.pay.running", "Gerando cobrança…")
                  : t("inicio.pay.pix", "Pagar com Pix (Asaas)")}
              </Button>
            </section>
          ) : null}

          {engagement.conversationThreadId ? (
            <p className="vj-hint">
              {t("inicio.engagement.thread", "Conversa vinculada")}:{" "}
              <a href={`/app/comunicacao`}>{engagement.conversationThreadId.slice(0, 8)}…</a>
            </p>
          ) : null}

          <section className="vj-card vj-stack" aria-labelledby="timeline-heading">
            <h2 id="timeline-heading" className="vj-subtitle">
              {t("inicio.engagement.timeline", "Linha do tempo")}
            </h2>
            {events.length === 0 ? (
              <p className="vj-meta">
                {t("inicio.engagement.noEvents", "Sem eventos registrados ainda.")}
              </p>
            ) : (
              <ol className="vj-inicio-timeline">
                {events.map((ev) => (
                  <li key={ev.id}>
                    <strong>{ev.eventType}</strong>
                    {ev.fromStatus || ev.toStatus ? (
                      <span className="vj-meta">
                        {" "}
                        {ev.fromStatus ?? "—"} → {ev.toStatus ?? "—"}
                      </span>
                    ) : null}
                    {ev.reason ? <p>{ev.reason}</p> : null}
                    <time className="vj-meta" dateTime={ev.createdAt}>
                      {new Date(ev.createdAt).toLocaleString(locale)}
                    </time>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {CANCELLABLE.has(engagement.status) ? (
            <section className="vj-card vj-stack" aria-labelledby="cancel-heading">
              <h2 id="cancel-heading" className="vj-subtitle">
                {t("inicio.cancel.title", "Cancelamento")}
              </h2>
              <p className="vj-hint">
                {t(
                  "inicio.cancel.hint",
                  "Cancelamentos após pagamento podem gerar solicitação de reembolso. Estorno não é imediato e depende do provedor.",
                )}
              </p>
              <label className="vj-field">
                <span className="vj-label">{t("inicio.cancel.reason", "Motivo")}</span>
                <textarea
                  className="vj-input"
                  rows={3}
                  minLength={10}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
              </label>
              <Button
                type="button"
                className="vj-button-secondary"
                disabled={acting || cancelReason.trim().length < 10}
                onClick={() => void onCancel()}
              >
                {t("inicio.cancel.cta", "Solicitar cancelamento")}
              </Button>
            </section>
          ) : null}

          {engagement.status === "cancelled" &&
          engagement.financialStatus === "refund_requested" ? (
            <Alert tone="warning" title={t("inicio.refund.pendingTitle", "Reembolso")}>
              {t(
                "inicio.refund.pendingBody",
                "Solicitação de reembolso registrada. Aguardando confirmação externa do provedor — não há estorno automático confirmado nesta tela.",
              )}
            </Alert>
          ) : null}

          {(engagement.status === "cancelled" || engagement.status === "disputed") &&
          engagement.financialStatus !== "refund_requested" &&
          engagement.financialStatus !== "refunded" &&
          engagement.financialStatus !== "refund_pending" ? (
            <section className="vj-card vj-stack" aria-labelledby="refund-heading">
              <h2 id="refund-heading" className="vj-subtitle">
                {t("inicio.refund.title", "Solicitar reembolso")}
              </h2>
              <label className="vj-field">
                <span className="vj-label">{t("inicio.refund.reason", "Motivo")}</span>
                <textarea
                  className="vj-input"
                  rows={3}
                  minLength={10}
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                />
              </label>
              <Button
                type="button"
                disabled={acting || refundReason.trim().length < 10}
                onClick={() => void onRefund()}
              >
                {t("inicio.refund.cta", "Registrar solicitação de reembolso")}
              </Button>
            </section>
          ) : null}

          {actionError ? (
            <ErrorState title={t("common.error", "Erro")}>{actionError}</ErrorState>
          ) : null}

          <h2 className="vj-subtitle">{t("inicio.engagement.deliveries", "Entregas")}</h2>
          <ul className="vj-stack">
            {deliveries.map((d) => (
              <li key={d.id} className="vj-card">
                <strong>{d.status}</strong>
                <p>{d.description}</p>
              </li>
            ))}
            {deliveries.length === 0 ? (
              <li className="vj-meta">
                {t("inicio.engagement.noDeliveries", "Nenhuma entrega ainda.")}
              </li>
            ) : null}
          </ul>

          {disputes.length > 0 ? (
            <>
              <h2 className="vj-subtitle">{t("inicio.engagement.disputes", "Disputas")}</h2>
              <ul className="vj-stack">
                {disputes.map((d) => (
                  <li key={d.id} className="vj-card">
                    <strong>{d.status}</strong>
                    <p>
                      {d.reasonCode}: {d.description}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
