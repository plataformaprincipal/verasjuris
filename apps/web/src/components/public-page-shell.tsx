import type { ReactNode } from "react";
import { PublicSiteHeader } from "./public-site-header";

export function PublicPageShell({
  children,
  wide = false,
  className = "",
}: {
  children: ReactNode;
  wide?: boolean;
  className?: string;
}) {
  return (
    <div className={`vj-public-shell ${className}`.trim()}>
      <PublicSiteHeader />
      <main className={wide ? "vj-page vj-page-wide" : "vj-page"} id="conteudo">
        {children}
      </main>
    </div>
  );
}

export function PublicSection({
  eyebrow,
  title,
  lead,
  children,
  id,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  children?: ReactNode;
  id?: string;
}) {
  return (
    <section className="vj-public-section" id={id}>
      {eyebrow ? <p className="vj-meta">{eyebrow}</p> : null}
      <h2 className="vj-section-title">{title}</h2>
      {lead ? <p className="vj-lead">{lead}</p> : null}
      {children}
    </section>
  );
}

export function AvailabilityBadge({
  availability,
}: {
  availability: "available" | "in_test" | "in_development" | "planned";
}) {
  const labels = {
    available: "Disponível",
    in_test: "Em testes",
    in_development: "Em desenvolvimento",
    planned: "Planejada",
  } as const;
  const className =
    availability === "available"
      ? "vj-badge vj-badge-success"
      : availability === "in_test"
        ? "vj-badge vj-badge-warning"
        : "vj-badge";
  return <span className={className}>{labels[availability]}</span>;
}
