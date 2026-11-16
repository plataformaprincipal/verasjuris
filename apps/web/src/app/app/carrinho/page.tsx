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
import { useLocale } from "../../../components/locale-provider";
import {
  checkoutMarketplaceCart,
  fetchMarketplaceCart,
  formatMoneyCents,
  isApiFailure,
  marketplaceErrorMessage,
  removeMarketplaceCartItem,
  updateMarketplaceCartItem,
  type MarketplaceCart,
  type MarketplaceCartItem,
} from "../../../lib/marketplace";
import { useOrgContext } from "../../../lib/use-org-context";

export default function AppCarrinhoPage() {
  const { t } = useLocale();
  const org = useOrgContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [cart, setCart] = useState<MarketplaceCart | null>(null);
  const [items, setItems] = useState<MarketplaceCartItem[]>([]);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [mutatingId, setMutatingId] = useState<string | null>(null);

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

  function applyCart(data: { cart: MarketplaceCart; items: MarketplaceCartItem[] }) {
    setCart(data.cart);
    setItems(data.items);
  }

  async function onRemove(itemId: string) {
    if (!org.orgId) return;
    setMutatingId(itemId);
    const result = await removeMarketplaceCartItem(org.orgId, itemId);
    setMutatingId(null);
    if (isApiFailure(result)) {
      setCheckoutError(marketplaceErrorMessage(result));
      return;
    }
    applyCart(result);
  }

  async function onQty(itemId: string, quantity: number) {
    if (!org.orgId || quantity < 1) return;
    setMutatingId(itemId);
    const result = await updateMarketplaceCartItem(org.orgId, itemId, { quantity });
    setMutatingId(null);
    if (isApiFailure(result)) {
      setCheckoutError(marketplaceErrorMessage(result));
      return;
    }
    applyCart(result);
  }

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
      window.location.assign(`/app/marketplace/contratacoes/${firstEngagement}`);
    }
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: t("dashboard.title", "Início"), href: "/app" },
          { label: t("inicio.cart", "Carrinho") },
        ]}
      />
      <PageHeader
        title={t("inicio.cart", "Carrinho")}
        description={t(
          "inicio.cart.desc",
          "Preços e totais são recalculados no servidor. Serviços sob consulta não seguem para checkout imediato.",
        )}
      />
      {loading ? <LoadingState label={t("common.loading")} /> : null}
      {error ? <ErrorState title={t("common.error", "Erro")}>{error}</ErrorState> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState
          title={t("inicio.cart.empty", "Carrinho vazio")}
          action={
            <Link className="vj-button" href="/app">
              {t("inicio.cart.explore", "Explorar marketplace")}
            </Link>
          }
        >
          {t("inicio.cart.emptyBody", "Explore o catálogo e adicione serviços com preço fixo.")}
        </EmptyState>
      ) : null}
      {!loading && !error && items.length > 0 ? (
        <section className="vj-stack">
          <ul className="vj-stack">
            {items.map((item) => (
              <li key={item.id} className="vj-card vj-stack">
                <strong>{item.service?.title ?? item.professionalServiceId}</strong>
                <p className="vj-meta">
                  {item.service?.quoteRequired
                    ? t("inicio.price.quote", "Sob consulta")
                    : item.lineTotalCents != null
                      ? formatMoneyCents(item.lineTotalCents)
                      : "—"}
                </p>
                <div className="vj-inline-actions">
                  <label className="vj-field">
                    <span className="vj-visually-hidden">{t("inicio.cart.qty", "Qtd.")}</span>
                    <input
                      className="vj-input"
                      type="number"
                      min={1}
                      max={20}
                      value={item.quantity}
                      disabled={mutatingId === item.id}
                      onChange={(e) => void onQty(item.id, Number(e.target.value))}
                      style={{ width: "4.5rem" }}
                    />
                  </label>
                  <Button
                    type="button"
                    className="vj-button-secondary"
                    disabled={mutatingId === item.id}
                    onClick={() => void onRemove(item.id)}
                  >
                    {t("inicio.cart.remove", "Remover")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <p>
            <strong>
              {t("inicio.cart.total", "Total")}:{" "}
              {cart?.totalCents != null ? formatMoneyCents(cart.totalCents) : "—"}
            </strong>
          </p>
          <label className="vj-field">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
            />{" "}
            {t(
              "inicio.cart.terms",
              "Aceito os termos específicos desta contratação. O pagamento só é confirmado via webhook do provedor.",
            )}
          </label>
          {checkoutError ? (
            <ErrorState title={t("inicio.checkout.error", "Checkout")}>{checkoutError}</ErrorState>
          ) : null}
          <Button
            type="button"
            disabled={!acceptTerms || checkingOut || !cart?.checkoutReady}
            onClick={() => void onCheckout()}
          >
            {checkingOut
              ? t("inicio.checkout.running", "Processando…")
              : t("inicio.checkout.cta", "Finalizar com Pix (sandbox)")}
          </Button>
          {!cart?.checkoutReady ? (
            <p className="vj-hint">
              {t(
                "inicio.cart.notReady",
                "Há itens sob consulta ou indisponíveis. Remova-os ou solicite proposta antes do checkout.",
              )}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
