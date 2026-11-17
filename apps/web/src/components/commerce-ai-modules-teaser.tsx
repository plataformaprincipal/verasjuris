"use client";

import { useEffect, useState } from "react";
import { CommercialAiModulesTable } from "./commerce-catalog-ui";
import { fetchCommercialCatalog, isApiFailure, type CommercialCatalogItem } from "../lib/commerce";

/** Compact teaser of AI commercial SKUs for /ferramentas. */
export function CommerceAiModulesTeaser() {
  const [items, setItems] = useState<CommercialCatalogItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetchCommercialCatalog({
        commercialType: "ai_module",
        publicOnly: true,
        limit: 24,
      });
      if (cancelled) return;
      if (!isApiFailure(res)) setItems(res.items);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready || items.length === 0) return null;

  return (
    <section className="vj-stack" aria-labelledby="ai-commerce-title">
      <h2 id="ai-commerce-title" className="vj-subtitle">
        Módulos de IA (catálogo comercial)
      </h2>
      <p className="vj-meta">
        Preços e status vindos do backend (`GET /v1/commerce/catalog`). Compra self-serve ainda não
        disponível. <a href="/funcionalidades/modulos-ia">Ver lista completa</a> ·{" "}
        <a href="/planos">Planos</a>
      </p>
      <CommercialAiModulesTable items={items} />
    </section>
  );
}
