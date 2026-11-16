"use client";

import { EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import {
  fetchPlatformOrganizations,
  isApiFailure,
  platformAdminErrorMessage,
} from "../../../../lib/platform-admin";

export default function AdminOrgsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<
    Array<{
      id: string;
      name: string;
      slug: string;
      status: string;
      internalCompany: boolean;
      createdAt: string;
    }>
  >([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetchPlatformOrganizations({ limit: 50 });
      if (cancelled) return;
      if (isApiFailure(res)) {
        setError(platformAdminErrorMessage(res));
      } else {
        setItems(res.items);
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
        title="Organizações"
        description="Metadados cadastrais e status. Conteúdo confidencial dos clientes não é acessível automaticamente."
      />
      {loading ? <LoadingState label="Carregando organizações…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && items.length === 0 ? (
        <EmptyState title="Nenhuma organização">Ainda não há organizações cadastradas.</EmptyState>
      ) : null}
      <ul className="vj-stack">
        {items.map((org) => (
          <li key={org.id} className="vj-card vj-stack">
            <strong>{org.name}</strong>
            <p className="vj-meta">
              {org.slug} · {org.status}
              {org.internalCompany ? " · empresa interna" : ""}
            </p>
            <p className="vj-hint">Criada em {new Date(org.createdAt).toLocaleString("pt-BR")}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
