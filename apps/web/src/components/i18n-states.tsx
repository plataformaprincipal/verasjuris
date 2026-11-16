"use client";

import { ButtonLink, ErrorState, LoadingState } from "@verasjuris/ui";
import { useLocale } from "./locale-provider";

export function LocalizedLoadingPage({ variant = "page" }: { variant?: "page" | "app" }) {
  const { t } = useLocale();
  const label = variant === "app" ? t("common.loadingApp") : t("common.loadingPage");
  if (variant === "app") return <LoadingState label={label} />;
  return (
    <main className="vj-page" id="conteudo">
      <LoadingState label={label} />
    </main>
  );
}

export function LocalizedGlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLocale();
  return (
    <main className="vj-page" id="conteudo">
      <ErrorState
        title={t("errors.pageTitle")}
        action={
          <button className="vj-button vj-button-primary" type="button" onClick={reset}>
            {t("common.retry")}
          </button>
        }
      >
        {error.digest
          ? t("errors.pageBodyDigest", undefined, { digest: error.digest })
          : t("errors.pageBody")}
      </ErrorState>
    </main>
  );
}

export function LocalizedNotFound() {
  const { t } = useLocale();
  return (
    <main className="vj-page" id="conteudo">
      <h1 className="vj-title">{t("errors.notFoundTitle")}</h1>
      <p>{t("common.notFoundBody")}</p>
      <ButtonLink href="/">{t("common.backHome")}</ButtonLink>
    </main>
  );
}

export function LocalizedAppError({ reset }: { reset: () => void }) {
  const { t } = useLocale();
  return (
    <ErrorState
      title={t("errors.appArea")}
      action={
        <button className="vj-button vj-button-primary" type="button" onClick={reset}>
          {t("common.retry")}
        </button>
      }
    >
      {t("errors.pageBody")}
    </ErrorState>
  );
}

export function LocalizedSessionUnavailable({ message }: { message: string }) {
  const { t } = useLocale();
  return (
    <main className="vj-page" id="conteudo">
      <h1 className="vj-title">{t("errors.sessionLoad")}</h1>
      <p>{message}</p>
    </main>
  );
}
