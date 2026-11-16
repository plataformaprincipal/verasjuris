"use client";

import { EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import {
  fetchPlatformStaff,
  isApiFailure,
  platformAdminErrorMessage,
} from "../../../../lib/platform-admin";

export default function AdminStaffPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<
    Array<{
      id: string;
      email: string | null;
      displayName: string | null;
      roleKey: string;
      status: string;
      mfaEnabled: boolean;
      mfaRequired: boolean;
      activatedAt: string | null;
    }>
  >([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetchPlatformStaff();
      if (cancelled) return;
      if (isApiFailure(res)) setError(platformAdminErrorMessage(res));
      else setItems(res.items);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="vj-stack">
      <PageHeader
        title="Equipe administrativa"
        description="Funções persistidas no backend (SUPER_ADMIN e demais). Acesso nunca depende só do e-mail."
      />
      {loading ? <LoadingState label="Carregando equipe…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && items.length === 0 ? (
        <EmptyState title="Nenhum membro">
          Use o script de provisionamento de convite SUPER_ADMIN ou crie convites pela API.
        </EmptyState>
      ) : null}
      <ul className="vj-stack">
        {items.map((row) => (
          <li key={row.id} className="vj-card vj-stack">
            <strong>
              {row.displayName ?? row.email ?? row.id} · {row.roleKey}
            </strong>
            <p className="vj-meta">
              {row.email} · {row.status} · MFA {row.mfaEnabled ? "ativo" : "pendente"}
              {row.mfaRequired ? " (obrigatório)" : ""}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
