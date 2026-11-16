"use client";

import { Badge, EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import {
  fetchPlatformIntegrations,
  isApiFailure,
  platformAdminErrorMessage,
  type IntegrationHealthItem,
} from "../../../../lib/platform-admin";

export default function AdminIntegrationsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<IntegrationHealthItem[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetchPlatformIntegrations();
      if (cancelled) return;
      if (isApiFailure(res)) {
        setError(platformAdminErrorMessage(res));
      } else {
        setItems(res.items);
        setGeneratedAt(res.generatedAt);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="vj-stack">
      <PageHeader
        title="Integrações e saúde"
        description="Classificação honesta: presença de variável de ambiente não implica homologação."
      />
      {generatedAt ? (
        <p className="vj-meta">Última verificação: {new Date(generatedAt).toLocaleString("pt-BR")}</p>
      ) : null}
      {loading ? <LoadingState label="Verificando integrações…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && items.length === 0 ? (
        <EmptyState title="Sem integrações">Nenhum provider reportado.</EmptyState>
      ) : null}
      <div className="vj-admin-metrics">
        {items.map((item) => (
          <article key={item.key} className="vj-card vj-stack">
            <div className="vj-inline-actions" style={{ justifyContent: "space-between" }}>
              <strong>{item.name}</strong>
              <Badge>{item.label}</Badge>
            </div>
            <p className="vj-meta">
              Ambiente: {item.environment} · status técnico: {item.status}
            </p>
            {item.detail ? <p className="vj-hint">{item.detail}</p> : null}
            <ul className="vj-stack">
              {item.pendencies.map((p) => (
                <li key={p} className="vj-hint">
                  {p}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}
