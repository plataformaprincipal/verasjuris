"use client";

import { useLocale } from "./locale-provider";

export function AuthLoginRedirectHint() {
  const { t } = useLocale();
  return (
    <p className="vj-meta" role="status">
      {t("auth.page.loginRedirectHint")}
    </p>
  );
}

export function AuthLoginFooter({ redirectTo }: { redirectTo?: string }) {
  const { t } = useLocale();
  const href = redirectTo ? `/cadastro?redirect=${encodeURIComponent(redirectTo)}` : "/cadastro";
  return (
    <p>
      {t("auth.noAccount")} <a href={href}>{t("auth.createAccount")}</a>
    </p>
  );
}

export function AuthRegisterFooter({ loginHref }: { loginHref: string }) {
  const { t } = useLocale();
  return (
    <p>
      {t("auth.alreadyHaveAccount")} <a href={loginHref}>{t("auth.login")}</a>
    </p>
  );
}

export function AuthRecoverFooter() {
  const { t } = useLocale();
  return (
    <p>
      <a href="/entrar">{t("auth.backToLogin")}</a>
    </p>
  );
}
