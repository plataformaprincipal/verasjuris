"use client";

import { CSRF_HEADER } from "@verasjuris/security/constants";
import { Button, FormField, Input } from "@verasjuris/ui";
import { useRouter } from "next/navigation";
import { useId, useState, type ReactNode } from "react";
import { translateApiFailure, translateFieldError } from "../lib/i18n/api-errors";
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from "../lib/legal";
import { resolveAuthenticatedHome } from "../lib/persona-home";
import { resolvePostAuthRedirect } from "../lib/safe-redirect";
import type { Account, ApiFailure } from "../lib/types";
import { useLocale } from "./locale-provider";

async function submit(path: string, body: Record<string, string>) {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [CSRF_HEADER]: "1",
    },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as ApiFailure & {
    status?: string;
    message?: string;
    emailDelivery?: string;
    verified?: boolean;
    reset?: boolean;
    account?: Account;
    redirectTo?: string;
  };
  return { response, data };
}

function fieldError(
  data: ApiFailure,
  path: string,
  t?: (key: string, fallback?: string) => string,
): string | undefined {
  const detail = data.error?.details?.find((item) => item.path === path);
  if (!detail?.message) return undefined;
  return t ? translateFieldError(path, detail.message, t) : detail.message;
}

function PasswordField({
  id,
  name,
  label,
  hint,
  error,
  autoComplete,
  minLength,
}: {
  id: string;
  name: string;
  label: string;
  hint?: string;
  error?: string;
  autoComplete: string;
  minLength?: number;
}) {
  const { t } = useLocale();
  const [visible, setVisible] = useState(false);
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <FormField id={id} label={label} hint={hint} error={error}>
      <div className="vj-password-field">
        <Input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          minLength={minLength}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
        />
        <button
          type="button"
          className="vj-button vj-button-secondary vj-password-toggle"
          aria-pressed={visible}
          aria-controls={id}
          aria-label={visible ? t("auth.hidePassword") : t("auth.showPassword")}
          onClick={() => setVisible((value) => !value)}
        >
          {visible ? t("auth.hidePassword") : t("auth.showPassword")}
        </button>
      </div>
    </FormField>
  );
}

function AuthAlert({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="vj-field-error">
      {children}
    </p>
  );
}

export function LoginForm({ redirectTo }: { redirectTo?: string | null } = {}) {
  const router = useRouter();
  const { t } = useLocale();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<ApiFailure>({});

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await submit("/api/v1/auth/login", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    });
    setPending(false);
    if (!result.response.ok) {
      setFields(result.data);
      setError(
        translateApiFailure(
          result.data,
          t,
          t("auth.loginFailed", "Não foi possível entrar. Nenhuma sessão foi aberta."),
        ),
      );
      return;
    }
    const account = result.data.account;
    router.push(
      account
        ? resolveAuthenticatedHome(account, redirectTo ?? null)
        : resolvePostAuthRedirect(redirectTo ?? null),
    );
    router.refresh();
  }

  const emailErr = fieldError(fields, "email", t);
  const passwordErr = fieldError(fields, "password", t);

  return (
    <form className="vj-stack" action={onSubmit} noValidate>
      {error ? <AuthAlert>{error}</AuthAlert> : null}
      <FormField id="email" label={t("auth.email")} error={emailErr}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={Boolean(emailErr)}
          aria-describedby={emailErr ? "email-error" : undefined}
        />
      </FormField>
      <PasswordField
        id="password"
        name="password"
        label={t("auth.password")}
        error={passwordErr}
        autoComplete="current-password"
      />
      <p>
        <a href="/recuperar-conta">{t("auth.forgotPassword")}</a>
      </p>
      <Button type="submit" loading={pending} loadingLabel={t("auth.entering")}>
        {t("auth.login")}
      </Button>
    </form>
  );
}

export function RegisterForm({ redirectTo }: { redirectTo?: string | null } = {}) {
  const router = useRouter();
  const { t } = useLocale();
  const termsId = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<ApiFailure>({});
  const [termsAccepted, setTermsAccepted] = useState(false);

  async function onSubmit(formData: FormData) {
    if (!termsAccepted) {
      setError(t("auth.termsRequired", "Aceite os termos para continuar."));
      return;
    }
    setPending(true);
    setError(null);
    const result = await submit("/api/v1/auth/register", {
      displayName: String(formData.get("displayName") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      // Legado: a API grava versões fixas; enviamos as versões atuais do pacote jurídico
      // para manter o contrato alinhado ao wizard quando o schema evoluir.
      termsVersion: CURRENT_TERMS_VERSION,
      privacyVersion: CURRENT_PRIVACY_VERSION,
    });
    setPending(false);
    if (!result.response.ok) {
      setFields(result.data);
      setError(
        translateApiFailure(
          result.data,
          t,
          t("auth.signupFailed", "Não foi possível criar a conta. Nenhum cadastro foi confirmado."),
        ),
      );
      return;
    }
    // Cadastro legado também emite sessão + cookie (201); redireciona como o wizard.
    const body = result.data as { redirectTo?: string };
    router.push(resolvePostAuthRedirect(redirectTo ?? body.redirectTo ?? null));
    router.refresh();
  }

  return (
    <form className="vj-stack" action={onSubmit} noValidate>
      {error ? <AuthAlert>{error}</AuthAlert> : null}
      <FormField
        id="displayName"
        label={t("auth.displayName")}
        error={fieldError(fields, "displayName", t)}
      >
        <Input
          id="displayName"
          name="displayName"
          autoComplete="name"
          required
          aria-invalid={Boolean(fieldError(fields, "displayName", t))}
          aria-describedby={fieldError(fields, "displayName", t) ? "displayName-error" : undefined}
        />
      </FormField>
      <FormField id="email" label={t("auth.email")} error={fieldError(fields, "email", t)}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={Boolean(fieldError(fields, "email", t))}
          aria-describedby={fieldError(fields, "email", t) ? "email-error" : undefined}
        />
      </FormField>
      <PasswordField
        id="password"
        name="password"
        label={t("auth.password")}
        hint={t("auth.passwordHint")}
        error={fieldError(fields, "password", t)}
        autoComplete="new-password"
        minLength={8}
      />
      <label className="vj-check-row" htmlFor={termsId}>
        <input
          id={termsId}
          type="checkbox"
          checked={termsAccepted}
          onChange={(event) => setTermsAccepted(event.target.checked)}
          required
        />
        <span>
          {t("auth.termsAccept")} <a href="/termos-de-uso">{t("footer.terms")}</a>
          {" · "}
          <a href="/termos-de-servico">{t("footer.termsOfService", "Termos de Serviço")}</a>
          {" · "}
          <a href="/politica-de-privacidade">{t("footer.privacyPolicy")}</a>
        </span>
      </label>
      <Button type="submit" loading={pending} loadingLabel={t("auth.creating")}>
        {t("auth.signup")}
      </Button>
      <p>
        {t("auth.alreadyHaveAccount")} <a href="/entrar">{t("auth.login")}</a> ·{" "}
        <a href="/verificar-email">{t("auth.verifyEmail", "Verificar e-mail")}</a>
      </p>
    </form>
  );
}

export function RequestResetForm() {
  const { t } = useLocale();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<ApiFailure>({});

  async function onSubmit(formData: FormData) {
    setPending(true);
    setMessage(null);
    setError(null);
    const result = await submit("/api/v1/auth/password-reset/request", {
      email: String(formData.get("email") ?? ""),
    });
    setPending(false);
    if (!result.response.ok) {
      setFields(result.data);
      setError(translateApiFailure(result.data, t, t("common.error")));
      return;
    }
    setMessage(
      result.data.message ??
        t("auth.resetRequested", "Se existir uma conta elegível, enviaremos as instruções."),
    );
  }

  return (
    <form className="vj-stack" action={onSubmit} noValidate>
      {error ? <AuthAlert>{error}</AuthAlert> : null}
      {message ? <p role="status">{message}</p> : null}
      <FormField id="email" label={t("auth.email")} error={fieldError(fields, "email", t)}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </FormField>
      <Button type="submit" loading={pending} loadingLabel={t("auth.sending")}>
        {t("auth.requestReset", "Solicitar redefinição")}
      </Button>
    </form>
  );
}

export function ConfirmResetForm({ token }: { token: string }) {
  const router = useRouter();
  const { t } = useLocale();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<ApiFailure>({});

  async function onSubmit(formData: FormData) {
    const password = String(formData.get("password") ?? "");
    const passwordConfirm = String(formData.get("passwordConfirm") ?? "");
    if (password !== passwordConfirm) {
      setError(t("register.validation.password.mismatch", "As senhas não coincidem."));
      return;
    }
    setPending(true);
    setError(null);
    const result = await submit("/api/v1/auth/password-reset/confirm", {
      token,
      password,
    });
    setPending(false);
    if (!result.response.ok) {
      setFields(result.data);
      setError(
        translateApiFailure(
          result.data,
          t,
          t("auth.resetFailed", "Não foi possível redefinir a senha."),
        ),
      );
      return;
    }
    router.push("/entrar");
    router.refresh();
  }

  if (!token) {
    return (
      <AuthAlert>
        {t("auth.resetLinkInvalid", "Este link de redefinição está incompleto ou já expirou.")}
      </AuthAlert>
    );
  }

  return (
    <form className="vj-stack" action={onSubmit} noValidate>
      {error ? <AuthAlert>{error}</AuthAlert> : null}
      <PasswordField
        id="password"
        name="password"
        label={t("auth.newPassword", "Nova senha")}
        hint={t("auth.passwordHint")}
        error={fieldError(fields, "password", t)}
        autoComplete="new-password"
        minLength={8}
      />
      <PasswordField
        id="passwordConfirm"
        name="passwordConfirm"
        label={t("register.field.passwordConfirm", "Confirmar senha")}
        autoComplete="new-password"
        minLength={8}
      />
      <Button type="submit" loading={pending} loadingLabel={t("auth.saving")}>
        {t("auth.confirmReset", "Redefinir senha")}
      </Button>
    </form>
  );
}

export function VerifyEmailForm({ initialToken = "" }: { initialToken?: string }) {
  const { t } = useLocale();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function confirm(token: string) {
    setPending(true);
    setError(null);
    setMessage(null);
    const result = await submit("/api/v1/auth/email-verification/confirm", { token });
    setPending(false);
    if (!result.response.ok) {
      setError(
        translateApiFailure(
          result.data,
          t,
          t("auth.verifyFailed", "Não foi possível verificar o e-mail."),
        ),
      );
      return;
    }
    setMessage(t("auth.verifySuccess", "E-mail verificado. Você já pode entrar."));
  }

  async function request(formData: FormData) {
    setPending(true);
    setError(null);
    setMessage(null);
    const result = await submit("/api/v1/auth/email-verification/request", {
      email: String(formData.get("email") ?? ""),
    });
    setPending(false);
    if (!result.response.ok) {
      setError(translateApiFailure(result.data, t, t("common.error")));
      return;
    }
    setMessage(
      result.data.message ??
        t("auth.resetRequested", "Se existir uma conta elegível, enviaremos as instruções."),
    );
  }

  if (initialToken) {
    return (
      <div className="vj-stack">
        {error ? <AuthAlert>{error}</AuthAlert> : null}
        {message ? (
          <p role="status">{message}</p>
        ) : (
          <Button
            type="button"
            loading={pending}
            loadingLabel={t("common.loading")}
            onClick={() => void confirm(initialToken)}
          >
            {t("auth.confirmEmail", "Confirmar e-mail")}
          </Button>
        )}
        {message ? (
          <p>
            <a href="/entrar">{t("auth.login")}</a>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form className="vj-stack" action={request} noValidate>
      {error ? <AuthAlert>{error}</AuthAlert> : null}
      {message ? <p role="status">{message}</p> : null}
      <FormField id="email" label={t("auth.email")}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </FormField>
      <Button type="submit" loading={pending} loadingLabel={t("auth.sending")}>
        {t("auth.resendVerification", "Reenviar verificação")}
      </Button>
    </form>
  );
}
