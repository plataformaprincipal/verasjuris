"use client";

import { Alert, ButtonLink, EmptyState, ErrorState, LoadingState } from "@verasjuris/ui";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  fetchPlatformMe,
  isApiFailure,
  platformAdminErrorMessage,
  type PlatformMe,
} from "../lib/platform-admin";
import { AdminShell } from "./admin-shell";

export function AdminGate({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<PlatformMe["platform"] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetchPlatformMe();
      if (cancelled) return;
      if (isApiFailure(res)) {
        setError(platformAdminErrorMessage(res));
        setMe(null);
      } else {
        setMe(res.platform);
        setError(null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="vj-admin-gate">
        <LoadingState label="Verificando permissões administrativas…" />
      </div>
    );
  }

  if (error || !me) {
    return (
      <div className="vj-admin-gate vj-stack">
        <ErrorState title="Acesso administrativo">
          {error ?? "Você não possui permissão para acessar esta área."}
        </ErrorState>
        <ButtonLink href="/entrar?redirect=%2Fadmin">Entrar</ButtonLink>
        <Link href="/app">Ir para o app</Link>
      </div>
    );
  }

  if (me.forcePasswordChange) {
    return (
      <div className="vj-admin-gate vj-stack">
        <Alert tone="warning" title="Senha pendente">
          Defina uma nova senha antes de usar o painel administrativo.
        </Alert>
        <ButtonLink href="/app/conta">Abrir conta</ButtonLink>
      </div>
    );
  }

  if (me.mfaRequired && !me.mfaEnabled) {
    return (
      <div className="vj-admin-gate vj-stack">
        <Alert tone="warning" title="MFA obrigatório">
          A autenticação em dois fatores é obrigatória para a equipe administrativa.
        </Alert>
        <ButtonLink href="/app/configuracoes/seguranca">
          Abrir configurações de segurança
        </ButtonLink>
        <EmptyState title="Painel bloqueado até MFA">
          Após ativar o MFA, recarregue esta página.
        </EmptyState>
      </div>
    );
  }

  return <AdminShell roles={me.roles}>{children}</AdminShell>;
}
