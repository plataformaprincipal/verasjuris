import { Badge, Breadcrumb, PageHeader } from "@verasjuris/ui";
import {
  AVAILABILITY_META,
  CATEGORY_META,
  PUBLIC_CATALOG,
  type Availability,
} from "../../../lib/public-catalog";

export const dynamic = "force-dynamic";

const TONE: Record<Availability, "neutral" | "success" | "warning" | "error"> = {
  available: "success",
  in_test: "warning",
  in_development: "neutral",
  planned: "error",
};

export default function ModulePreviewIndexPage() {
  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[{ label: "Painel", href: "/app" }, { label: "Pré-visualização de módulos" }]}
      />
      <PageHeader
        title="Catálogo de módulos"
        description="Apresentação navegável do escopo VerasJuris. Estados refletem a disponibilidade real — demonstrações não executam operações sensíveis."
      />
      <div className="vj-feature-grid">
        {PUBLIC_CATALOG.map((feature) => (
          <a
            key={feature.slug}
            className="vj-card vj-card-link"
            href={`/app/previsualizacao/${feature.slug}`}
          >
            <div className="vj-inline-actions">
              <Badge tone={TONE[feature.availability]}>
                {AVAILABILITY_META[feature.availability].label}
              </Badge>
              <span className="vj-meta">{CATEGORY_META[feature.category].label}</span>
            </div>
            <h2 className="vj-section-title">{feature.name}</h2>
            <p>{feature.summary}</p>
          </a>
        ))}
      </div>
      <p>
        <a className="vj-button vj-button-secondary" href="/app">
          Voltar ao painel
        </a>
      </p>
    </div>
  );
}
