import { Badge, Breadcrumb, EmptyState, PageHeader } from "@verasjuris/ui";
import { notFound } from "next/navigation";
import {
  AVAILABILITY_META,
  CATEGORY_META,
  getFeature,
  type Availability,
} from "../../../../lib/public-catalog";

export const dynamic = "force-dynamic";

const TONE: Record<Availability, "neutral" | "success" | "warning" | "error"> = {
  available: "success",
  in_test: "warning",
  in_development: "neutral",
  planned: "error",
};

export default async function ModulePreviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const feature = getFeature(slug);
  if (!feature) notFound();

  const isOperational = feature.availability === "available";
  const demoHref = feature.demoView ? `/explorar?view=${feature.demoView}` : null;

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Painel", href: "/app" },
          { label: "Pré-visualização", href: "/app/previsualizacao" },
          { label: feature.name },
        ]}
      />
      <PageHeader
        eyebrow={CATEGORY_META[feature.category].label}
        title={feature.name}
        description={feature.summary}
      />

      <section className="vj-card">
        <div className="vj-inline-actions">
          <Badge tone={TONE[feature.availability]}>
            {AVAILABILITY_META[feature.availability].label}
          </Badge>
        </div>
        <h2 className="vj-section-title">Objetivo</h2>
        <p>{feature.problem}</p>
      </section>

      <section className="vj-card">
        <h2 className="vj-section-title">Recursos previstos</h2>
        <ul>
          {feature.capabilities.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="vj-card">
        <h2 className="vj-section-title">Público e benefícios</h2>
        <p>
          <strong>Público:</strong> {feature.audience.join(", ")}
        </p>
        <ul>
          {feature.benefits.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="vj-card">
        <h2 className="vj-section-title">Limitações atuais</h2>
        <ul>
          {feature.limitations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        {!isOperational ? (
          <EmptyState title="Pré-visualização — sem operação real">
            Esta página não executa cobranças, protocolos externos nem alterações em produção. Use-a
            para conhecer o módulo e acompanhar o estágio de implementação.
          </EmptyState>
        ) : null}
      </section>

      {feature.requiresAuthFor.length > 0 ? (
        <section className="vj-card">
          <h2 className="vj-section-title">Operações que exigem autenticação</h2>
          <ul>
            {feature.requiresAuthFor.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="vj-inline-actions">
        <a className="vj-button vj-button-secondary" href="/app">
          Voltar ao painel
        </a>
        <a className="vj-button vj-button-ghost" href="/app/previsualizacao">
          Catálogo completo
        </a>
        {demoHref ? (
          <a className="vj-button vj-button-ghost" href={demoHref}>
            Abrir demonstração fictícia
          </a>
        ) : null}
        {isOperational && feature.requiresAuthFor.length > 0 ? (
          <a className="vj-button vj-button-primary" href="/app">
            Ir ao ambiente operacional
          </a>
        ) : null}
      </div>
    </div>
  );
}
