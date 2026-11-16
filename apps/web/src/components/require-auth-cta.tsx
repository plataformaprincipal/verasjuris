"use client";

import { Button, ButtonLink, Dialog } from "@verasjuris/ui";
import { useCallback, useState } from "react";
import { isSafeRedirectPath, withRedirect } from "../lib/safe-redirect";
import { useLocale } from "./locale-provider";

type RequireAuthCtaProps = {
  actionLabel: string;
  message: string;
  title?: string;
  redirectTo?: string;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
};

function currentPath(): string | null {
  if (typeof window === "undefined") return null;
  return `${window.location.pathname}${window.location.search}`;
}

export function RequireAuthCta({
  actionLabel,
  message,
  title,
  redirectTo,
  variant = "primary",
  disabled,
}: RequireAuthCtaProps) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<string | null>(null);
  const close = useCallback(() => setOpen(false), []);
  const dialogTitle = title ?? t("auth.loginToContinue");

  function show() {
    const candidate = redirectTo ?? currentPath();
    setTarget(candidate && isSafeRedirectPath(candidate) ? candidate : null);
    setOpen(true);
  }

  return (
    <>
      <Button variant={variant} disabled={disabled} aria-haspopup="dialog" onClick={show}>
        {actionLabel}
      </Button>
      <Dialog open={open} title={dialogTitle} onClose={close}>
        <p>{message}</p>
        <p className="vj-meta">{t("auth.returnAfterLogin")}</p>
        <div className="vj-inline-actions">
          <ButtonLink href={withRedirect("/entrar", target)}>{t("nav.login")}</ButtonLink>
          <ButtonLink variant="secondary" href={withRedirect("/cadastro", target)}>
            {t("nav.signup")}
          </ButtonLink>
          <Button variant="ghost" onClick={close}>
            {t("auth.notNow")}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
