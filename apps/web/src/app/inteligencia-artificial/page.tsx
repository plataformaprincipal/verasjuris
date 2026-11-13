import type { Metadata } from "next";
import { ButtonLink } from "@verasjuris/ui";
import { AvailabilityBadge, PublicPageShell } from "../../components/public-page-shell";
import { RequireAuthCta } from "../../components/require-auth-cta";
import { listByCategory } from "../../lib/public-catalog";

export const metadata: Metadata = {
  title: "Inteligência artificial jurídica",
  description:
    "Recursos de inteligência artificial do VerasJuris: finalidade, limites e necessidade de revisão humana.",
};

export default function InteligenciaArtificialPage() {
  const features = listByCategory("inteligencia_artificial");

  return (
    <PublicPageShell>
      <div className="vj-stack">
        <div>
          <p className="vj-meta">Inteligência artificial</p>
          <h1 className="vj-display">Apoio assistido, com revisão humana obrigatória</h1>
          <p className="vj-lead">
            O VerasJuris oferece recursos de inteligência artificial para organizar informações,
            apoiar a leitura de documentos e auxiliar na elaboração de textos. Os resultados não
            substituem a análise de um profissional habilitado e não constituem parecer jurídico
            automático.
          </p>
          <div className="vj-form-actions">
            <ButtonLink href="/ferramentas?categoria=inteligencia_artificial">
              Ver ferramentas
            </ButtonLink>
            <RequireAuthCta
              actionLabel="Executar análise"
              title="Entre para usar a inteligência artificial"
              message="Para executar uma análise jurídica com inteligência artificial, entre na sua conta ou cadastre-se no VerasJuris."
              redirectTo="/app/ia"
              variant="secondary"
            />
          </div>
        </div>

        <section className="vj-card vj-card-calm">
          <h2 className="vj-section-title">Avisos importantes</h2>
          <ul>
            <li>Resultados gerados por inteligência artificial exigem revisão humana.</li>
            <li>A demonstração pública não executa modelos pagos nem processa dados reais.</li>
            <li>O uso autenticado depende de provedor configurado, orçamento e permissões.</li>
            <li>O sistema não garante resultados jurídicos nem substitui advogado.</li>
          </ul>
        </section>

        <div className="vj-feature-grid">
          {features.map((feature) => (
            <article key={feature.slug} className="vj-card">
              <AvailabilityBadge availability={feature.availability} />
              <h2 className="vj-section-title">
                <a href={`/ferramentas/${feature.slug}`}>{feature.name}</a>
              </h2>
              <p>{feature.summary}</p>
              <p className="vj-meta">Finalidade: {feature.problem}</p>
              <p className="vj-meta">Limitações: {feature.limitations[0]}</p>
            </article>
          ))}
        </div>
      </div>
    </PublicPageShell>
  );
}
