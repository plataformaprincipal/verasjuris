"use client";

import {
  Breadcrumb,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@verasjuris/ui";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  checkoutMarketplaceCart,
  fetchMarketplaceCart,
  formatMoneyCents,
  isApiFailure,
  marketplaceErrorMessage,
  type MarketplaceCart,
  type MarketplaceCartItem,
} from "../../lib/marketplace";
import { useOrgContext } from "../../lib/use-org-context";

export default function CarrinhoPage() {
  const org = useOrgContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [cart, setCart] = useState<MarketplaceCart | null>(null);
  const [items, setItems] = useState<MarketplaceCartItem[]>([]);
  const [acceptTerms, setAcceptTerms] = useState(false);

  useEffect(() => {
    if (!org.ready || !org.orgId) return;
    let cancelled = false;
    void fetchMarketplaceCart(org.orgId).then((data) => {
      if (cancelled) return;
      if (isApiFailure(data)) setError(marketplaceErrorMessage(data));
      else {
        setCart(data.cart);
        setItems(data.items);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId]);

  async function onCheckout() {
    if (!org.orgId || !acceptTerms) return;
    setCheckingOut(true);
    setCheckoutError(null);
    const result = await checkoutMarketplaceCart(org.orgId, {
      paymentMethod: "pix",
      acceptTerms: true,
    });
    setCheckingOut(false);
    if (isApiFailure(result)) {
      setCheckoutError(marketplaceErrorMessage(result));
      return;
    }
    const firstUrl = result.items.find((i) => i.checkoutUrl)?.checkoutUrl;
    if (firstUrl) {
      window.location.assign(firstUrl);
      return;
    }
    const firstEngagement = result.items[0]?.engagementId;
    if (firstEngagement) {
      window.location.assign(`/marketplace/contratacoes/${firstEngagement}`);
    }
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Marketplace", href: "/marketplace" }, { label: "Carrinho" }]} />
      <PageHeader
        title="Carrinho"
        description="Preços e totais são recalculados no servidor. Serviços sob consulta não seguem para checkout imediato."
      />
      {loading ? <LoadingState label="Carregando carrinho…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState
          title="Carrinho vazio"
          action={
            <Link className="vj-button" href="/marketplace">
              Ir ao marketplace
            </Link>
          }
        >
          Explore o catálogo e adicione serviços com preço fixo.
        </EmptyState>
      ) : null}
      {items.length > 0 ? (
        <ul className="vj-stack">
          {items.map((item) => (
            <li key={item.id} className="vj-card">
              <strong>{item.service?.title ?? "Serviço"}</strong>
              <p className="vj-hint">
                Qtd. {item.quantity}
                {item.service?.quoteRequired
                  ? " · requer proposta personalizada"
                  : item.lineTotalCents != null
                    ? ` · ${formatMoneyCents(item.lineTotalCents)}`
                    : ""}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
      {cart ? (
        <section className="vj-card vj-stack" aria-labelledby="checkout-heading">
          <h2 id="checkout-heading" className="vj-subtitle">
            Checkout
          </h2>
          <p>
            Total:{" "}
            {cart.checkoutReady && cart.totalCents != null
              ? formatMoneyCents(cart.totalCents)
              : "indisponível (há itens sob consulta)"}
          </p>
          <label className="vj-stack">
            <span>
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
              />{" "}
              Aceito os termos e condições da contratação.
            </span>
          </label>
          {checkoutError ? <ErrorState title="Checkout">{checkoutError}</ErrorState> : null}
          <Button
            type="button"
            disabled={!cart.checkoutReady || !acceptTerms || checkingOut}
            onClick={() => void onCheckout()}
          >
            {checkingOut ? "Processando…" : "Contratar e pagar"}
          </Button>
        </section>
      ) : null}
    </div>
  );
}
