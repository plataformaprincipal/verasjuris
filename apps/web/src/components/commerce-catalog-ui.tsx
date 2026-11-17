"use client";

import { Alert, Badge, EmptyState } from "@verasjuris/ui";
import {
  formatCatalogPrice,
  HOMOLOGATION_LABELS,
  type CommercialCatalogItem,
} from "../lib/commerce";

function statusTone(status: string | null): "neutral" | "warning" | "error" | "success" {
  if (status === "partial") return "warning";
  if (status === "not_implemented") return "error";
  return "neutral";
}

export function CommercePurchaseGuard({ version }: { version?: string | null }) {
  return (
    <Alert tone="warning" title="Compra self-serve ainda não disponível">
      Catálogo comercial {version ?? "2026-09"} seedado no backend. Checkout Asaas universal e
      cobrança live ficam para a Fase 2 — status atual: NOT_READY_FOR_PURCHASE. Nenhuma cobrança de
      produção está habilitada nesta fase.
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
          <article key={plan.sku} className="vj-card" aria-labelledby={`plan-${plan.sku}`}>
            <div className="vj-stack" style={{ gap: "0.5rem" }}>
              <h2 id={`plan-${plan.sku}`} className="vj-card-title">
                {plan.name}
              </h2>
              <p className="vj-title">{formatCatalogPrice(plan)}</p>
              <p className="vj-meta">{plan.description}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                <Badge tone={statusTone(plan.homologationStatus)}>
                  {HOMOLOGATION_LABELS[plan.homologationStatus ?? ""] ??
                    plan.homologationStatus ??
                    "catálogo"}
                </Badge>
                <Badge tone="neutral">{plan.sku}</Badge>
                {plan.requiresProposal ? <Badge tone="warning">Proposta</Badge> : null}
              </div>
              {plan.franchises && Object.keys(plan.franchises).length > 0 ? (
                <ul>
                  {Object.entries(plan.franchises)
                    .slice(0, 6)
                    .map(([key, value]) => (
                      <li key={key}>
                        {key}: {String(value)}
                      </li>
                    ))}
                </ul>
              ) : null}
            </div>
          </article>
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
              <th scope="col">Status</th>
              <th scope="col">Compra</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.sku}>
                <td>
                  <code>{item.sku}</code>
                </td>
                <td>{item.name}</td>
                <td>{formatCatalogPrice(item)}</td>
                <td>
                  <Badge tone={statusTone(item.homologationStatus)}>
                    {HOMOLOGATION_LABELS[item.homologationStatus ?? ""] ??
                      item.homologationStatus ??
                      "—"}
                  </Badge>
                </td>
                <td>
                  <Badge tone="neutral">{item.purchaseStatus}</Badge>
                </td>
              </tr>
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
          <li key={item.sku}>
            <strong>{item.name}</strong> — {formatCatalogPrice(item)}{" "}
            <Badge tone={statusTone(item.homologationStatus)}>
              {HOMOLOGATION_LABELS[item.homologationStatus ?? ""] ?? item.homologationStatus}
            </Badge>{" "}
            <a href="/planos">Ver planos</a>
          </li>
        ))}
      </ul>
    </section>
  );
}
