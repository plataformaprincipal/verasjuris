"use client";

import type { ReactNode } from "react";
import { BrandMark } from "./brand-mark";
import { LanguageSwitcher, useLocale } from "./locale-provider";

export function AuthPageChrome({
  titleKey,
  titleFallback,
  leadKey,
  leadFallback,
  panelClassName = "vj-auth-panel",
  showRedirectNotice = false,
  children,
}: {
  titleKey: string;
  titleFallback?: string;
  leadKey?: string;
  leadFallback?: string;
  panelClassName?: string;
  showRedirectNotice?: boolean;
  children: ReactNode;
}) {
  const { t } = useLocale();

  return (
    <div className="vj-auth-shell">
      <header className="vj-public-header">
        <a href="/" aria-label={t("nav.homeBrand")}>
          <BrandMark />
        </a>
        <LanguageSwitcher />
      </header>
      <main className="vj-page" id="conteudo">
        <div className={`vj-card vj-panel ${panelClassName}`}>
          <h1 className="vj-title">{t(titleKey, titleFallback)}</h1>
          {leadKey ? <p>{t(leadKey, leadFallback)}</p> : null}
          {showRedirectNotice ? (
            <p className="vj-meta" role="status">
              {t("auth.redirectContinue")}
            </p>
          ) : null}
          {children}
        </div>
      </main>
    </div>
  );
}
