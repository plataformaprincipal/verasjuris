"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { CommercialAiModulesTable } from "../../../components/commerce-catalog-ui";
import {
  commerceErrorMessage,
  fetchCommercialCatalog,
  isApiFailure,
  type CommercialCatalogItem,
} from "../../../lib/commerce";

/**
 * Catálogo público dos 24 módulos AI_* com preço server-side e badge de status real.
 * /funcionalidades continua redirecionando para /ferramentas; esta rota dedicada
 * atende o placement comercial da Fase 1 sem fingir checkout.
 */
export default function FuncionalidadesModulosIaPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<CommercialCatalogItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetchCommercialCatalog({
        commercialType: "ai_module",
        publicOnly: true,
        limit: 50,
      });
      if (cancelled) return;
      if (isApiFailure(res)) setError(commerceErrorMessage(res));
      else setItems(res.items);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="vj-page" id="conteudo">
      <div className="vj-stack">
        <Breadcrumb
          items={[
            { label: "Início", href: "/" },
            { label: "Funcionalidades", href: "/ferramentas" },
            { label: "Módulos de IA" },
          ]}
        />
        <PageHeader
          title="Módulos de IA"
          description="24 SKUs AI_* do catálogo comercial 2026-09, com preço e status de implementação honestos (catalog_only / partial / not_implemented). Compra self-serve = Fase 2."
        />
        <p>
          <a href="/ferramentas">Ver catálogo de ferramentas</a>
          {" · "}
          <a href="/planos">Ver planos</a>
        </p>
        {loading ? <LoadingState label="Carregando módulos…" /> : null}
        {error ? (
          <ErrorState title="Não foi possível carregar os módulos">{error}</ErrorState>
        ) : null}
        {!loading && !error ? <CommercialAiModulesTable items={items} /> : null}
      </div>
    </main>
  );
}
