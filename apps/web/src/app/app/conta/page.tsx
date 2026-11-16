"use client";

import { CSRF_HEADER } from "@verasjuris/security/constants";
import { Breadcrumb, Button, ButtonLink, FormField, Input, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { useLocale } from "../../../components/locale-provider";
import type { ApiFailure } from "../../../lib/types";

type SessionRow = {
  id: string;
  current: boolean;
  createdAt: string;
  expiresAt: string;
  ipHint: string | null;
  userAgentHint: string | null;
};

export default function AccountPage() {
  const { t, locale } = useLocale();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [profile, setProfile] = useState({
    displayName: "",
    locale: "pt-BR",
    timeZone: "America/Sao_Paulo",
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [sessionsResponse, profileResponse] = await Promise.all([
        fetch("/api/v1/sessions", { cache: "no-store" }),
        fetch("/api/v1/account/profile", { cache: "no-store" }),
      ]);
      if (!sessionsResponse.ok) {
        if (!cancelled) setError(t("account.sessionsLoadError"));
      } else {
        const body = (await sessionsResponse.json()) as { sessions: SessionRow[] };
        if (!cancelled) setSessions(body.sessions);
      }
      if (profileResponse.ok) {
        const body = (await profileResponse.json()) as {
          profile: { displayName: string; locale: string; timeZone: string };
        };
        if (!cancelled) setProfile(body.profile);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  async function reloadSessions() {
    const response = await fetch("/api/v1/sessions", { cache: "no-store" });
    if (!response.ok) {
      setError(t("account.sessionsLoadError"));
      return;
    }
    const body = (await response.json()) as { sessions: SessionRow[] };
    setSessions(body.sessions);
  }

  async function saveProfile(formData: FormData) {
    setPending(true);
    setProfileMessage(null);
    setError(null);
    const response = await fetch("/api/v1/account/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json", [CSRF_HEADER]: "1" },
      body: JSON.stringify({
        displayName: String(formData.get("displayName") ?? ""),
        locale: String(formData.get("locale") ?? "pt-BR"),
        timeZone: String(formData.get("timeZone") ?? "America/Sao_Paulo"),
      }),
    });
    const data = (await response.json().catch(() => ({}))) as ApiFailure & {
      profile?: { displayName: string; locale: string; timeZone: string };
    };
    setPending(false);
    if (!response.ok) {
      setError(data.error?.message ?? t("account.profileUpdateError"));
      return;
    }
    if (data.profile) setProfile(data.profile);
    setProfileMessage(t("account.profileUpdated"));
  }

  async function changePassword(formData: FormData) {
    setPending(true);
    setPasswordMessage(null);
    setError(null);
    const response = await fetch("/api/v1/auth/password/change", {
      method: "POST",
      headers: { "content-type": "application/json", [CSRF_HEADER]: "1" },
      body: JSON.stringify({
        currentPassword: String(formData.get("currentPassword") ?? ""),
        newPassword: String(formData.get("newPassword") ?? ""),
      }),
    });
    const data = (await response.json().catch(() => ({}))) as ApiFailure;
    setPending(false);
    if (!response.ok) {
      setError(data.error?.message ?? t("account.passwordChangeError"));
      return;
    }
    setPasswordMessage(t("account.passwordChanged"));
    await reloadSessions();
  }

  async function revoke(sessionId: string) {
    setError(null);
    const response = await fetch(`/api/v1/sessions/${sessionId}`, {
      method: "DELETE",
      headers: { [CSRF_HEADER]: "1" },
    });
    if (!response.ok && response.status !== 204) {
      setError(t("account.revokeError"));
      return;
    }
    if (sessions.find((item) => item.id === sessionId)?.current) {
      window.location.assign("/entrar");
      return;
    }
    await reloadSessions();
  }

  async function revokeOthers() {
    setError(null);
    const response = await fetch("/api/v1/sessions/revoke-others", {
      method: "POST",
      headers: { [CSRF_HEADER]: "1" },
    });
    if (!response.ok) {
      setError(t("account.revokeOthersError"));
      return;
    }
    await reloadSessions();
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: t("nav.app"), href: "/app" }, { label: t("account.title") }]} />
      <PageHeader title={t("account.title")} description={t("account.description")} />
      {error ? (
        <p role="alert" className="vj-field-error">
          {error}
        </p>
      ) : null}
      <section className="vj-card vj-stack">
        <h2 className="vj-section-title">{t("account.profile")}</h2>
        {profileMessage ? <p role="status">{profileMessage}</p> : null}
        <form
          key={`${profile.displayName}|${profile.locale}|${profile.timeZone}`}
          className="vj-stack"
          action={saveProfile}
        >
          <FormField id="displayName" label={t("account.displayName")}>
            <Input
              id="displayName"
              name="displayName"
              defaultValue={profile.displayName}
              required
              minLength={2}
              maxLength={80}
            />
          </FormField>
          <FormField id="locale" label={t("account.locale")}>
            <Input id="locale" name="locale" defaultValue={profile.locale} required />
          </FormField>
          <FormField id="timeZone" label={t("account.timeZone")}>
            <Input id="timeZone" name="timeZone" defaultValue={profile.timeZone} required />
          </FormField>
          <Button type="submit" loading={pending} loadingLabel={t("auth.saving")}>
            {t("account.saveProfile")}
          </Button>
        </form>
      </section>
      <section className="vj-card vj-stack">
        <h2 className="vj-section-title">{t("account.profilesLinks")}</h2>
        <p>{t("account.profilesLinksDesc")}</p>
        <ButtonLink href="/app/perfis" variant="secondary">
          {t("account.manageProfiles")}
        </ButtonLink>
      </section>
      <section className="vj-card vj-stack">
        <h2 className="vj-section-title">{t("footer.legalCenter", "Documentos legais")}</h2>
        <p>
          {t(
            "account.legal.lead",
            "Consulte Termos de Uso, Termos de Serviço e Política de Privacidade vigentes.",
          )}
        </p>
        <ButtonLink href="/documentos-legais" variant="secondary">
          {t("footer.legalCenter", "Documentos legais")}
        </ButtonLink>
      </section>
      <section className="vj-card vj-stack">
        <h2 className="vj-section-title">{t("account.changePassword")}</h2>
        {passwordMessage ? <p role="status">{passwordMessage}</p> : null}
        <form className="vj-stack" action={changePassword}>
          <FormField id="currentPassword" label={t("account.currentPassword")}>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
          </FormField>
          <FormField id="newPassword" label={t("auth.newPassword")} hint={t("auth.passwordHint")}>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
            />
          </FormField>
          <Button type="submit" loading={pending} loadingLabel={t("auth.saving")}>
            {t("account.savePassword")}
          </Button>
        </form>
      </section>
      <section className="vj-card vj-stack">
        <h2 className="vj-section-title">{t("account.sessions")}</h2>
        <Button type="button" variant="secondary" onClick={() => void revokeOthers()}>
          {t("account.revokeOthers")}
        </Button>
        {sessions.length === 0 ? (
          <p>{t("account.noSessions")}</p>
        ) : (
          <ul className="vj-stack">
            {sessions.map((session) => (
              <li key={session.id}>
                {session.current ? t("account.currentSession") : t("account.otherSession")} ·{" "}
                {t("account.createdAt")} {new Date(session.createdAt).toLocaleString(locale)}
                {session.ipHint ? ` · ${session.ipHint}` : ""}
                <div>
                  <Button type="button" variant="secondary" onClick={() => void revoke(session.id)}>
                    {t("account.revoke")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
