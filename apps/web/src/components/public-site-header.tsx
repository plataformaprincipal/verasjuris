"use client";

import { CSRF_HEADER } from "@verasjuris/security/constants";
import { ButtonLink, Menu } from "@verasjuris/ui";
import { LogOut } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { fetchSessionAccount } from "../lib/crm";
import type { Account } from "../lib/types";
import { BrandMark } from "./brand-mark";
import { LanguageSwitcher, useLocale } from "./locale-provider";
import { PublicMainNav } from "./public-main-nav";

export function PublicSiteHeader() {
  const { t } = useLocale();
  const pathname = usePathname() ?? "/";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  const panelId = useId();
  const authenticated = Boolean(account);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const session = await fetchSessionAccount();
      if (!cancelled) setAccount(session);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  async function logout() {
    await fetch("/api/v1/auth/logout", {
      method: "POST",
      headers: { [CSRF_HEADER]: "1" },
    });
    await fetch("/session/organizacao", {
      method: "DELETE",
      headers: { [CSRF_HEADER]: "1" },
    });
    window.location.assign("/");
  }

  return (
    <>
      <header className="vj-public-header vj-public-header-rich">
        <a
          href={authenticated ? "/app" : "/"}
          aria-label={t("nav.homeBrand", "VerasJuris, início")}
          className="vj-public-brand"
        >
          <BrandMark />
        </a>

        <div className="vj-public-nav-desktop" id="navegacao">
          <PublicMainNav variant="desktop" authenticated={authenticated} />
        </div>

        <div className="vj-header-actions vj-public-header-actions">
          <Menu label={t("nav.more")}>
            <a href="/planos" role="menuitem">
              {t("footer.plans")}
            </a>
            <a href={authenticated ? "/app/marketplace" : "/marketplace-juridico"} role="menuitem">
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
          {account === undefined ? (
            <span className="vj-meta" aria-live="polite">
              …
            </span>
          ) : account ? (
            <Menu label={account.user.displayName || t("nav.account", "Minha conta")}>
              <p className="vj-meta" role="presentation">
                {account.user.email}
              </p>
              <a href="/app" role="menuitem">
                {t("nav.platformHome", "Início da plataforma")}
              </a>
              <a href="/app/conta" role="menuitem">
                {t("nav.account", "Minha conta")}
              </a>
              <a href="/app/configuracoes/seguranca" role="menuitem">
                {t("nav.settings", "Configurações")}
              </a>
              <a href="/app/carrinho" role="menuitem">
                {t("nav.cart", "Carrinho e compras")}
              </a>
              <a href="/app/marketplace" role="menuitem">
                {t("nav.orders", "Pedidos e marketplace")}
              </a>
              <a href="/explorar" role="menuitem">
                {t("nav.publications", "Publicações")}
              </a>
              <a href="/ferramentas" role="menuitem">
                {t("nav.tools", "Ferramentas")}
              </a>
              <a href="/app/juris-one" role="menuitem">
                {t("public.tab.jurisOne", "Juris One")}
              </a>
              <button type="button" role="menuitem" onClick={() => void logout()}>
                <LogOut size={16} aria-hidden="true" /> {t("auth.logout", "Sair")}
              </button>
            </Menu>
          ) : (
            <>
              <ButtonLink href="/entrar" variant="ghost">
                {t("nav.login")}
              </ButtonLink>
              <ButtonLink href="/cadastro">{t("nav.signup")}</ButtonLink>
            </>
          )}
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
            <PublicMainNav
              variant="mobile-drawer"
              authenticated={authenticated}
              onNavigate={() => setMobileOpen(false)}
            />
            <div className="vj-stack" style={{ marginTop: "1rem" }}>
              <a href="/planos">{t("footer.plans")}</a>
              <a href={authenticated ? "/app/marketplace" : "/marketplace-juridico"}>
                {t("footer.marketplace")}
              </a>
              {authenticated ? (
                <>
                  <a href="/app/conta">{t("nav.account", "Minha conta")}</a>
                  <a href="/app/configuracoes/seguranca">{t("nav.settings", "Configurações")}</a>
                  <a href="/app/carrinho">{t("nav.cart", "Carrinho e compras")}</a>
                </>
              ) : (
                <>
                  <a href="/entrar">{t("nav.login")}</a>
                  <a href="/cadastro">{t("nav.signup")}</a>
                </>
              )}
              <a href="/acessibilidade">{t("nav.accessibility")}</a>
              <a href="/institucional/ajuda">{t("nav.help")}</a>
            </div>
          </div>
        ) : null}
      </header>
      <PublicMainNav variant="bottom" authenticated={authenticated} />
    </>
  );
}
