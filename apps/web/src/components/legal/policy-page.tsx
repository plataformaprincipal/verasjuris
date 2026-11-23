import { Breadcrumb, PageHeader } from "@verasjuris/ui";
import type { ReactNode } from "react";
import { POLICIES_VERSION } from "../../lib/legal/company";
import { PublicPageShell } from "../public-page-shell";

export function PolicyPage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <PublicPageShell>
      <div className="vj-stack">
        <Breadcrumb
          items={[
            { label: "Início", href: "/" },
            { label: "Documentos legais", href: "/documentos-legais" },
            { label: title },
          ]}
        />
        <PageHeader title={title} description={description} />
        <p className="vj-meta">Versão {POLICIES_VERSION}</p>
        <div className="vj-prose">{children}</div>
      </div>
    </PublicPageShell>
  );
}
