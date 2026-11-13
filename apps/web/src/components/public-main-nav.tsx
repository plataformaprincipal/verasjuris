"use client";

import { BrainCircuit, Compass, House, Wrench } from "lucide-react";
import { usePathname } from "next/navigation";
import { isPublicTabActive, PUBLIC_MAIN_TABS } from "../lib/public-nav";

const ICONS = {
  house: House,
  wrench: Wrench,
  compass: Compass,
  "brain-circuit": BrainCircuit,
} as const;

export function PublicMainNav({
  variant,
  onNavigate,
}: {
  variant: "desktop" | "mobile-drawer" | "bottom";
  onNavigate?: () => void;
}) {
  const pathname = usePathname() ?? "/";
  const className =
    variant === "bottom"
      ? "vj-bottom-nav"
      : variant === "desktop"
        ? "vj-main-tabs"
        : "vj-main-tabs vj-main-tabs-drawer";

  return (
    <nav className={className} aria-label="Principal">
      {PUBLIC_MAIN_TABS.map((tab) => {
        const Icon = ICONS[tab.icon];
        const current = isPublicTabActive(pathname, tab.href);
        return (
          <a
            key={tab.href}
            href={tab.href}
            className={current ? "is-current" : undefined}
            aria-current={current ? "page" : undefined}
            onClick={onNavigate}
          >
            <Icon size={variant === "bottom" ? 22 : 18} aria-hidden="true" />
            <span>{tab.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
