import type { Metadata } from "next";
import { ButtonLink } from "@verasjuris/ui";
import { AvailabilityBadge, PublicPageShell } from "../../components/public-page-shell";
import { RequireAuthCta } from "../../components/require-auth-cta";
import { listByCategory } from "../../lib/public-catalog";

export const metadata: Metadata = {
  title: "Automação",
  description:
    "Fluxos de trabalho e lembretes do VerasJuris para reduzir tarefas repetitivas com supervisão humana.",
};

export default function AutomacaoPage() {
  const features = listByCategory("automacao");

  return (
    <PublicPageShell>
      <div className="vj-stack">
        <div>
          <p className="vj-meta">Automação</p>
          <h1 className="vj-display">Organize etapas e lembretes com supervisão</h1>
          <p className="vj-lead">
            Automatize tarefas repetitivas e acompanhe etapas dos seus casos. A automação não
            substitui decisões jurídicas nem executa protocolos oficiais sem integração comprovada.
          </p>
          <div className="vj-form-actions">
            <RequireAuthCta
              actionLabel="Configurar fluxo de trabalho"
              title="Entre para configurar automações"
              message="Para criar ou executar automações, entre na sua conta ou cadastre-se no VerasJuris."
              redirectTo="/app"
            />
            <ButtonLink href="/explorar" variant="secondary">
              Ver demonstração
            </ButtonLink>
          </div>
        </div>
        <div className="vj-feature-grid">
          {features.map((feature) => (
            <article key={feature.slug} className="vj-card">
              <AvailabilityBadge availability={feature.availability} />
              <h2 className="vj-section-title">
                <a href={`/ferramentas/${feature.slug}`}>{feature.name}</a>
              </h2>
              <p>{feature.summary}</p>
            </article>
          ))}
        </div>
      </div>
    </PublicPageShell>
  );
}
