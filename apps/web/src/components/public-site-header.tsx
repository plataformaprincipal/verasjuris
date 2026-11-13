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
        <a href="/" aria-label={t("nav.homeBrand", "VerasJuris, início")} className="vj-public-brand">
          <BrandMark />
        </a>

        <div className="vj-public-nav-desktop" id="navegacao">
          <PublicMainNav variant="desktop" />
        </div>

        <div className="vj-header-actions vj-public-header-actions">
          <Menu label="Mais">
            <a href="/planos" role="menuitem">
              Planos
            </a>
            <a href="/marketplace-juridico" role="menuitem">
              Marketplace
            </a>
            <a href="/solucoes" role="menuitem">
              Soluções
            </a>
            <a href="/acessibilidade" role="menuitem">
              Acessibilidade
            </a>
            <a href="/institucional/ajuda" role="menuitem">
              Ajuda
            </a>
            <a href="/institucional/contato" role="menuitem">
              Contato
            </a>
          </Menu>
          <LanguageSwitcher />
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
              <a href="/planos">Planos</a>
              <a href="/marketplace-juridico">Marketplace</a>
              <a href="/acessibilidade">Acessibilidade</a>
              <a href="/institucional/ajuda">Ajuda</a>
            </div>
          </div>
        ) : null}
      </header>
      <PublicMainNav variant="bottom" />
    </>
  );
}
