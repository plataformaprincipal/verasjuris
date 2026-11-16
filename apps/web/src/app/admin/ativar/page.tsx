"use client";

import { Alert, Button, ErrorState, PageHeader } from "@verasjuris/ui";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import {
  activatePlatformInvite,
  isApiFailure,
  platformAdminErrorMessage,
} from "../../../lib/platform-admin";

function ActivateForm() {
  const params = useSearchParams();
  const tokenFromQuery = params.get("token") ?? "";
  const [token, setToken] = useState(tokenFromQuery);
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== passwordConfirm) {
      setError("As senhas não coincidem.");
      return;
    }
    setBusy(true);
    const res = await activatePlatformInvite({
      token: token.trim(),
      password,
      displayName: displayName.trim() || undefined,
    });
    setBusy(false);
    if (isApiFailure(res)) {
      setError(platformAdminErrorMessage(res));
      return;
    }
    setDone(res.next.message);
  }

  if (done) {
    return (
      <div className="vj-stack">
        <Alert tone="success" title="Ativação concluída">
          {done}
        </Alert>
        <a className="vj-button" href="/entrar?redirect=%2Fadmin">
          Entrar no painel
        </a>
      </div>
    );
  }

  return (
    <form className="vj-card vj-stack" onSubmit={(e) => void submit(e)}>
      <label className="vj-stack">
        Token de ativação
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          required
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <label className="vj-stack">
        Nome de exibição
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      </label>
      <label className="vj-stack">
        Senha forte
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
        />
      </label>
      <label className="vj-stack">
        Confirmar senha
        <input
          type="password"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          required
          autoComplete="new-password"
        />
      </label>
      {error ? <ErrorState title="Não foi possível ativar">{error}</ErrorState> : null}
      <Button type="submit" disabled={busy}>
        {busy ? "Ativando…" : "Ativar conta administrativa"}
      </Button>
      <p className="vj-hint">
        O token é de uso único e será invalidado após a ativação. Em seguida, configure MFA.
      </p>
    </form>
  );
}

export default function AdminActivatePage() {
  return (
    <main className="vj-admin-activate">
      <PageHeader
        title="Ativação administrativa"
        description="Defina uma senha forte para a conta da equipe VerasJuris. Nenhuma senha é armazenada em texto puro."
      />
      <Suspense fallback={<p className="vj-meta">Carregando…</p>}>
        <ActivateForm />
      </Suspense>
    </main>
  );
}
