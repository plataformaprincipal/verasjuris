"use client";

import { Breadcrumb, Button, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  MARKETPLACE_ENGAGEMENT_STATUS_LABELS,
  fetchMarketplaceEngagement,
  initiateMarketplaceProviderPayment,
  isApiFailure,
  marketplaceErrorMessage,
  type MarketplaceDelivery,
  type MarketplaceEngagement,
} from "../../../../lib/marketplace";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function MarketplaceEngagementPublicPage() {
  const params = useParams<{ id: string }>();
  const org = useOrgContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [engagement, setEngagement] = useState<MarketplaceEngagement | null>(null);
  const [deliveries, setDeliveries] = useState<MarketplaceDelivery[]>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId) return;
    let cancelled = false;
    void fetchMarketplaceEngagement(org.orgId, params.id).then((data) => {
      if (cancelled) return;
      if (isApiFailure(data)) setError(marketplaceErrorMessage(data));
      else {
        setEngagement(data.engagement);
        setDeliveries(data.deliveries);
      }
      setLoading(false);
    });
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
      "Cobrança criada, mas sem URL de checkout. Confirme o pagamento apenas após validação do provedor (webhook).",
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[{ label: "Marketplace", href: "/marketplace" }, { label: "Contratação" }]}
      />
      {loading ? <LoadingState label="Carregando contratação…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {engagement ? (
        <>
          <PageHeader
            title={`Contratação ${engagement.id.slice(0, 8)}`}
            description={MARKETPLACE_ENGAGEMENT_STATUS_LABELS[engagement.status]}
          />
          {engagement.status === "pending_payment" ? (
            <section className="vj-card vj-stack" aria-labelledby="payment-heading">
              <h2 id="payment-heading" className="vj-subtitle">
                Pagamento
              </h2>
              <p className="vj-hint">
                A liberação do serviço ocorre somente após confirmação financeira no backend
                (webhook/provedor). O retorno visual do checkout não marca o pedido como pago.
              </p>
              {payError ? <ErrorState title="Pagamento">{payError}</ErrorState> : null}
              <Button type="button" onClick={() => void startProviderPayment()} disabled={paying}>
                {paying ? "Gerando cobrança…" : "Pagar com Pix (Asaas)"}
              </Button>
            </section>
          ) : null}
          {engagement.conversationThreadId ? (
            <p className="vj-hint">
              Conversa vinculada: {engagement.conversationThreadId.slice(0, 8)}…
            </p>
          ) : null}
          <h2 className="vj-subtitle">Entregas</h2>
          <ul className="vj-stack">
            {deliveries.map((d) => (
              <li key={d.id} className="vj-card">
                <strong>{d.status}</strong>
                <p>{d.description}</p>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
