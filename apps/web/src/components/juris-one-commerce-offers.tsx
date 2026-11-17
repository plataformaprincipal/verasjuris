"use client";

import { useEffect, useState } from "react";
import { CommercialOffersLinks } from "./commerce-catalog-ui";
import { fetchCommercialCatalog, isApiFailure, type CommercialCatalogItem } from "../lib/commerce";

/** Links honestos para créditos / Agent / Assistente sem ativar checkout live. */
export function JurisOneCommerceOffers() {
  const [items, setItems] = useState<CommercialCatalogItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [credits, agent, assistente] = await Promise.all([
        fetchCommercialCatalog({ commercialType: "ai_credit_pack", limit: 5 }),
        fetchCommercialCatalog({ commercialType: "ai_module", limit: 30 }),
        fetchCommercialCatalog({ commercialType: "plan", limit: 20 }),
      ]);
      if (cancelled) return;
      const merged: CommercialCatalogItem[] = [];
      if (!isApiFailure(credits)) merged.push(...credits.items.slice(0, 3));
      if (!isApiFailure(agent)) {
        merged.push(
          ...agent.items.filter((i) => i.sku === "AI_AGENT" || i.sku === "AI_ASSISTENTE"),
        );
      }
      if (!isApiFailure(assistente)) {
        merged.push(
          ...assistente.items.filter(
            (i) => i.sku === "PLAN_PRO_INDIVIDUAL" || i.sku === "PLAN_PROFISSIONAL_LIVRE",
          ),
        );
      }
      setItems(merged);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <CommercialOffersLinks
      items={items}
      title="Créditos, módulos e planos relacionados (sem checkout live)"
    />
  );
}
