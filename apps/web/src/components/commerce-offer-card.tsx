"use client";

import { Badge } from "@verasjuris/ui";
import {
  formatCatalogPrice,
  HOMOLOGATION_LABELS,
  PURCHASE_GATE_LABEL,
  type CommercialCatalogItem,
} from "../lib/commerce";

function statusTone(status: string | null): "neutral" | "warning" | "error" | "success" {
  if (status === "partial") return "warning";
  if (status === "not_implemented") return "error";
  return "neutral";
}

export type CommerceOfferVariant = "card" | "row" | "compact";

/**
 * Superfície canônica de oferta comercial (Fase 7).
 * Sempre exibe NOT_HOMOLOGATED / purchaseReady=false — nunca inventa compra pronta.
 */
export function CommerceOfferCard({
  item,
  variant = "card",
  href,
}: {
  item: CommercialCatalogItem;
  variant?: CommerceOfferVariant;
  href?: string;
}) {
  const price = formatCatalogPrice(item);
  const implLabel =
    HOMOLOGATION_LABELS[item.homologationStatus ?? ""] ?? item.homologationStatus ?? "catálogo";
  const link =
    href ?? (item.commercialType === "ai_module" ? "/funcionalidades/modulos-ia" : "/planos");

  const badges = (
    <div
      className="vj-commerce-offer__badges"
      style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}
    >
      <Badge tone="warning">{PURCHASE_GATE_LABEL}</Badge>
      <Badge tone="neutral">{item.purchaseStatus}</Badge>
      <Badge tone={statusTone(item.homologationStatus)}>{implLabel}</Badge>
      <Badge tone="neutral">{item.sku}</Badge>
      {item.requiresProposal ? <Badge tone="warning">Proposta</Badge> : null}
    </div>
  );

  if (variant === "compact") {
    return (
      <li className="vj-commerce-offer vj-commerce-offer--compact">
        <strong>{item.name}</strong> — {price} {badges} <a href={link}>Detalhes</a>
      </li>
    );
  }

  if (variant === "row") {
    return (
      <tr className="vj-commerce-offer vj-commerce-offer--row">
        <td>
          <code>{item.sku}</code>
        </td>
        <td>{item.name}</td>
        <td>{price}</td>
        <td>
          <Badge tone={statusTone(item.homologationStatus)}>{implLabel}</Badge>
        </td>
        <td>
          <Badge tone="warning">{PURCHASE_GATE_LABEL}</Badge>
        </td>
      </tr>
    );
  }

  return (
    <article className="vj-card vj-commerce-offer" aria-labelledby={`offer-${item.sku}`}>
      <div className="vj-stack" style={{ gap: "0.5rem" }}>
        <h2 id={`offer-${item.sku}`} className="vj-card-title">
          {item.name}
        </h2>
        <p className="vj-title">{price}</p>
        {item.description ? <p className="vj-meta">{item.description}</p> : null}
        {badges}
        {item.franchises && Object.keys(item.franchises).length > 0 ? (
          <ul>
            {Object.entries(item.franchises)
              .slice(0, 6)
              .map(([key, value]) => (
                <li key={key}>
                  {key}: {String(value)}
                </li>
              ))}
          </ul>
        ) : null}
        <p className="vj-meta">
          <a href={link}>Ver no catálogo</a>
        </p>
      </div>
    </article>
  );
}
