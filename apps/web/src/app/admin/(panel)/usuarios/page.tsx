"use client";

import { Button, EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import {
  fetchPlatformUsers,
  isApiFailure,
  platformAdminErrorMessage,
  updateUserStatus,
} from "../../../../lib/platform-admin";

type UserRow = {
  id: string;
  email: string;
  displayName: string | null;
  status: string;
  emailVerified: boolean;
  lastLoginAt: string | null;
  mfaEnabled: boolean;
  createdAt: string;
};

export default function AdminUsersPage() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<UserRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh(search?: string) {
    setLoading(true);
    const res = await fetchPlatformUsers({ q: search?.trim() || undefined, limit: 50 });
    if (isApiFailure(res)) {
      setError(platformAdminErrorMessage(res));
      setItems([]);
    } else {
      setError(null);
      setItems(res.items);
    }
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function setStatus(userId: string, status: "active" | "suspended" | "disabled") {
    const reason = window.prompt("Informe o motivo (obrigatório, auditoria):");
    if (!reason || reason.trim().length < 3) return;
    setBusyId(userId);
    const res = await updateUserStatus(userId, { status, reason: reason.trim() });
    setBusyId(null);
    if (isApiFailure(res)) {
      setError(platformAdminErrorMessage(res));
      return;
    }
    await refresh(q);
  }

  return (
    <div className="vj-stack">
      <PageHeader
        title="Usuários"
        description="Gestão cadastral. Senhas nunca são exibidas. Documentos privados não são acessíveis por esta tela."
      />
      <form
        className="vj-inline-actions"
        onSubmit={(e) => {
          e.preventDefault();
          void refresh(q);
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por e-mail ou nome"
          aria-label="Buscar usuários"
        />
        <Button type="submit">Buscar</Button>
      </form>
      {loading ? <LoadingState label="Carregando usuários…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && items.length === 0 ? (
        <EmptyState title="Nenhum usuário">Ajuste a busca ou aguarde novos cadastros.</EmptyState>
      ) : null}
      <div className="vj-table-wrap">
        <table className="vj-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>E-mail</th>
              <th>Status</th>
              <th>MFA</th>
              <th>Último acesso</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id}>
                <td>{u.displayName ?? "—"}</td>
                <td>{u.email}</td>
                <td>{u.status}</td>
                <td>{u.mfaEnabled ? "Sim" : "Não"}</td>
                <td>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("pt-BR") : "—"}</td>
                <td className="vj-inline-actions">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busyId === u.id || u.status === "suspended"}
                    onClick={() => void setStatus(u.id, "suspended")}
                  >
                    Suspender
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busyId === u.id || u.status === "active"}
                    onClick={() => void setStatus(u.id, "active")}
                  >
                    Reativar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
