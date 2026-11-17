"use client";

import { BrainCircuit, Compass, House, Store, Wrench } from "lucide-react";
import { usePathname } from "next/navigation";
import { isPlatformTabActive, PLATFORM_MAIN_TABS, platformTabHref } from "../lib/platform-nav";
import { useLocale } from "./locale-provider";

const ICONS = {
  house: House,
  wrench: Wrench,
  compass: Compass,
  "brain-circuit": BrainCircuit,
  store: Store,
} as const;

export function PublicMainNav({
  variant,
  onNavigate,
  authenticated = false,
}: {
  variant: "desktop" | "mobile-drawer" | "bottom" | "app-strip";
  onNavigate?: () => void;
  /** Quando true, usa hrefs autenticados (Início→/app, Marketplace→/app/marketplace, etc.). */
  authenticated?: boolean;
}) {
  const pathname = usePathname() ?? "/";
  const { t } = useLocale();
  const className =
    variant === "bottom"
      ? "vj-bottom-nav"
      : variant === "desktop"
        ? "vj-main-tabs"
        : variant === "app-strip"
          ? "vj-main-tabs vj-platform-strip"
          : "vj-main-tabs vj-main-tabs-drawer";

  return (
    <nav className={className} aria-label={t("public.nav.aria", "Principal")}>
      {PLATFORM_MAIN_TABS.map((tab) => {
        const Icon = ICONS[tab.icon];
        const href = platformTabHref(tab, authenticated);
        const current = isPlatformTabActive(pathname, href);
        return (
          <a
            key={tab.id}
            href={href}
            className={current ? "is-current" : undefined}
            aria-current={current ? "page" : undefined}
            onClick={onNavigate}
          >
            <Icon size={variant === "bottom" ? 22 : 18} aria-hidden="true" />
            <span>{t(tab.labelKey)}</span>
          </a>
        );
      })}
    </nav>
  );
}
