"use client";

import { Alert, EmptyState } from "@verasjuris/ui";
import type { CommercialCatalogItem } from "../lib/commerce";
import { CommerceOfferCard } from "./commerce-offer-card";

export function CommercePurchaseGuard({ version }: { version?: string | null }) {
  return (
    <Alert tone="warning" title="Compra live não homologada">
      Catálogo comercial {version ?? "2026-09"} disponível para consulta. Status: NOT_HOMOLOGATED /
      NOT_READY_FOR_PURCHASE. Carrinho/checkout sandbox existem; cobrança de produção permanece
      bloqueada (`PAYMENTS_LIVE≠1`).
    </Alert>
  );
}

export function CommercialPlansGrid({ items }: { items: CommercialCatalogItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState title="Planos não configurados">
        Nenhum plano público no catálogo 2026-09. Execute o sync admin do catálogo comercial.
      </EmptyState>
    );
  }

  return (
    <div className="vj-stack">
      <CommercePurchaseGuard version={items[0]?.commercialVersion} />
      <div className="vj-card-grid">
        {items.map((plan) => (
          <CommerceOfferCard key={plan.sku} item={plan} variant="card" />
        ))}
      </div>
    </div>
  );
}

export function CommercialAiModulesTable({ items }: { items: CommercialCatalogItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState title="Módulos de IA não listados">
        Nenhum SKU AI_* no catálogo público. O sync do catálogo 2026-09 ainda não foi aplicado.
      </EmptyState>
    );
  }

  return (
    <div className="vj-stack">
      <CommercePurchaseGuard version={items[0]?.commercialVersion} />
      <div className="vj-table-wrap">
        <table className="vj-table">
          <caption className="vj-visually-hidden">Módulos comerciais de IA</caption>
          <thead>
            <tr>
              <th scope="col">SKU</th>
              <th scope="col">Módulo</th>
              <th scope="col">Preço</th>
              <th scope="col">Implementação</th>
              <th scope="col">Gate comercial</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <CommerceOfferCard key={item.sku} item={item} variant="row" />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CommercialOffersLinks({
  items,
  title = "Ofertas relacionadas",
}: {
  items: CommercialCatalogItem[];
  title?: string;
}) {
  if (items.length === 0) return null;
  return (
    <section className="vj-stack" aria-labelledby="commerce-offers-title">
      <h2 id="commerce-offers-title" className="vj-subtitle">
        {title}
      </h2>
      <CommercePurchaseGuard version={items[0]?.commercialVersion} />
      <ul className="vj-stack">
        {items.map((item) => (
          <CommerceOfferCard key={item.sku} item={item} variant="compact" />
        ))}
      </ul>
    </section>
  );
}
