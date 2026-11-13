"use client";

import { Button, ButtonLink, Dialog } from "@verasjuris/ui";
import { useCallback, useState } from "react";
import { isSafeRedirectPath, withRedirect } from "../lib/safe-redirect";

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
  title = "Entre para continuar",
  redirectTo,
  variant = "primary",
  disabled,
}: RequireAuthCtaProps) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<string | null>(null);
  const close = useCallback(() => setOpen(false), []);

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
      <Dialog open={open} title={title} onClose={close}>
        <p>{message}</p>
        <p className="vj-meta">
          Ao entrar ou criar sua conta, você volta para esta página para continuar.
        </p>
        <div className="vj-inline-actions">
          <ButtonLink href={withRedirect("/entrar", target)}>Entrar</ButtonLink>
          <ButtonLink variant="secondary" href={withRedirect("/cadastro", target)}>
            Criar conta
          </ButtonLink>
          <Button variant="ghost" onClick={close}>
            Agora não
          </Button>
        </div>
      </Dialog>
    </>
  );
}
