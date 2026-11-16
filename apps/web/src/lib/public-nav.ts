export const PUBLIC_MAIN_TABS = [
  { href: "/", labelKey: "public.tab.home", icon: "house" as const },
  { href: "/ferramentas", labelKey: "public.tab.tools", icon: "wrench" as const },
  { href: "/explorar", labelKey: "public.tab.explore", icon: "compass" as const },
  { href: "/juris-one", labelKey: "public.tab.jurisOne", icon: "brain-circuit" as const },
] as const;

export type PublicMainTab = (typeof PUBLIC_MAIN_TABS)[number];

export function isPublicTabActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
