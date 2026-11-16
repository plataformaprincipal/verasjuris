"use client";

import { ButtonLink, Menu } from "@verasjuris/ui";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { BrandMark } from "./brand-mark";
import { LanguageSwitcher, useLocale } from "./locale-provider";
import { PublicMainNav } from "./public-main-nav";

export function PublicSiteHeader() {
  const { t } = useLocale();
  const pathname = usePathname() ?? "/";
  const [mobileOpen, setMobileOpen] = useState(false);
  const panelId = useId();

  // Fecha o menu mobile em navegação — pathname é o gatilho intencional.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  return (
    <>
      <header className="vj-public-header vj-public-header-rich">
        <a
          href="/"
          aria-label={t("nav.homeBrand", "VerasJuris, início")}
          className="vj-public-brand"
        >
          <BrandMark />
        </a>

        <div className="vj-public-nav-desktop" id="navegacao">
          <PublicMainNav variant="desktop" />
        </div>

        <div className="vj-header-actions vj-public-header-actions">
          <Menu label={t("nav.more")}>
            <a href="/planos" role="menuitem">
              {t("footer.plans")}
            </a>
            <a href="/marketplace-juridico" role="menuitem">
              {t("footer.marketplace")}
            </a>
            <a href="/solucoes" role="menuitem">
              {t("nav.solutions")}
            </a>
            <a href="/acessibilidade" role="menuitem">
              {t("nav.accessibility")}
            </a>
            <a href="/institucional/ajuda" role="menuitem">
              {t("nav.help")}
            </a>
            <a href="/institucional/contato" role="menuitem">
              {t("nav.contact")}
            </a>
          </Menu>
          <LanguageSwitcher compact />
          <ButtonLink href="/entrar" variant="ghost">
            {t("nav.login")}
          </ButtonLink>
          <ButtonLink href="/cadastro">{t("nav.signup")}</ButtonLink>
          <button
            type="button"
            className="vj-button vj-button-secondary vj-public-menu-toggle"
            aria-expanded={mobileOpen}
            aria-controls={panelId}
            onClick={() => setMobileOpen((value) => !value)}
          >
            {mobileOpen ? t("nav.closeMenu", "Fechar menu") : t("nav.menu", "Menu")}
          </button>
        </div>

        {mobileOpen ? (
          <div
            id={panelId}
            className="vj-public-nav-mobile"
            role="dialog"
            aria-label={t("nav.menu", "Menu")}
          >
            <PublicMainNav variant="mobile-drawer" onNavigate={() => setMobileOpen(false)} />
            <div className="vj-stack" style={{ marginTop: "1rem" }}>
              <a href="/planos">{t("footer.plans")}</a>
              <a href="/marketplace-juridico">{t("footer.marketplace")}</a>
              <a href="/acessibilidade">{t("nav.accessibility")}</a>
              <a href="/institucional/ajuda">{t("nav.help")}</a>
            </div>
          </div>
        ) : null}
      </header>
      <PublicMainNav variant="bottom" />
    </>
  );
}
