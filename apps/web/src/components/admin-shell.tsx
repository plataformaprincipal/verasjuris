"use client";

import {
  Activity,
  Building2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  HeadphonesIcon,
  LayoutDashboard,
  Plug,
  Shield,
  Sparkles,
  Store,
  Users,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/usuarios", label: "Usuários", icon: Users },
  { href: "/admin/organizacoes", label: "Organizações", icon: Building2 },
  { href: "/admin/equipe", label: "Equipe", icon: UsersRound },
  { href: "/admin/financeiro", label: "Financeiro", icon: CreditCard },
  { href: "/admin/marketplace", label: "Marketplace", icon: Store },
  { href: "/admin/social", label: "Rede social", icon: Activity },
  { href: "/admin/juris-one", label: "Juris One", icon: Sparkles },
  { href: "/admin/suporte", label: "Suporte", icon: HeadphonesIcon },
  { href: "/admin/integracoes", label: "Integrações", icon: Plug },
  { href: "/admin/seguranca", label: "Segurança", icon: Shield },
] as const;

export function AdminShell({ children, roles }: { children: ReactNode; roles?: string[] }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`vj-admin-shell${collapsed ? " vj-admin-shell-collapsed" : ""}`}>
      <aside className="vj-admin-sidebar" aria-label="Navegação administrativa">
        <div className="vj-admin-brand">
          <strong>VerasJuris</strong>
          {!collapsed ? <span className="vj-meta">Administração</span> : null}
        </div>
        <nav className="vj-admin-nav">
          {NAV.map((item) => {
            const active =
              "exact" in item && item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? "vj-admin-nav-link is-active" : "vj-admin-nav-link"}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={18} aria-hidden="true" />
                {!collapsed ? <span>{item.label}</span> : null}
              </Link>
            );
          })}
        </nav>
        <div className="vj-admin-sidebar-foot">
          {roles?.length ? <p className="vj-meta">{collapsed ? "…" : roles.join(", ")}</p> : null}
          <button
            type="button"
            className="vj-button vj-button-ghost"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
          <Link href="/app" className="vj-meta">
            Voltar ao app
          </Link>
        </div>
      </aside>
      <div className="vj-admin-main">{children}</div>
    </div>
  );
}
