/**
 * Navegação principal da plataforma VerasJuris (público e autenticado).
 * Guest e autenticado compartilham a mesma estrutura visual; hrefs mudam.
 */

export const PLATFORM_MAIN_TABS = [
  {
    id: "home",
    guestHref: "/",
    authHref: "/app",
    labelKey: "public.tab.home",
    icon: "house" as const,
  },
  {
    id: "explore",
    guestHref: "/explorar",
    authHref: "/explorar",
    labelKey: "public.tab.explore",
    icon: "compass" as const,
  },
  {
    id: "tools",
    guestHref: "/ferramentas",
    authHref: "/ferramentas",
    labelKey: "public.tab.tools",
    icon: "wrench" as const,
  },
  {
    id: "marketplace",
    guestHref: "/marketplace-juridico",
    authHref: "/app/marketplace",
    labelKey: "public.tab.marketplace",
    icon: "store" as const,
  },
  {
    id: "jurisOne",
    guestHref: "/juris-one",
    authHref: "/app/juris-one",
    labelKey: "public.tab.jurisOne",
    icon: "brain-circuit" as const,
  },
] as const;

export type PlatformMainTab = (typeof PLATFORM_MAIN_TABS)[number];

/** Destino “Voltar à plataforma” a partir do painel/perfil. */
export const PLATFORM_HOME_HREF = "/app";

/** @deprecated Prefer PLATFORM_MAIN_TABS — mantido para imports legados. */
export const PUBLIC_MAIN_TABS = PLATFORM_MAIN_TABS.map((tab) => ({
  href: tab.guestHref,
  labelKey: tab.labelKey,
  icon: tab.icon,
}));

export function platformTabHref(tab: PlatformMainTab, authenticated: boolean): string {
  return authenticated ? tab.authHref : tab.guestHref;
}

export function isPlatformTabActive(pathname: string, href: string): boolean {
  if (href === "/" || href === "/app") {
    return pathname === "/" || pathname === "/app";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Indica se a rota atual é “painel/workspace” (AppShell) e deve oferecer
 * o atalho de retorno à navegação principal da plataforma.
 */
export function shouldShowBackToPlatform(pathname: string): boolean {
  if (!pathname.startsWith("/app")) return false;
  // O próprio Início autenticado já é a plataforma — não precisa do botão.
  if (pathname === "/app") return false;
  return true;
}

export function isPlatformSurfacePath(pathname: string): boolean {
  if (pathname === "/" || pathname === "/app") return true;
  return PLATFORM_MAIN_TABS.some((tab) => {
    const hrefs = [tab.guestHref, tab.authHref];
    return hrefs.some(
      (href) =>
        href !== "/" && href !== "/app" && (pathname === href || pathname.startsWith(`${href}/`)),
    );
  });
}
