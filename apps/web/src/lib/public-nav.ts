export const PUBLIC_MAIN_TABS = [
  { href: "/", label: "Início", icon: "house" as const },
  { href: "/ferramentas", label: "Ferramentas", icon: "wrench" as const },
  { href: "/explorar", label: "Explorar", icon: "compass" as const },
  { href: "/juris-one", label: "Juris One", icon: "brain-circuit" as const },
] as const;

export type PublicMainTab = (typeof PUBLIC_MAIN_TABS)[number];

export function isPublicTabActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
