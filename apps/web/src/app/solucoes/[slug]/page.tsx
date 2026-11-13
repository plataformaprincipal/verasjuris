import type { Metadata } from "next";
import { ButtonLink } from "@verasjuris/ui";
import { notFound } from "next/navigation";
import { PublicPageShell } from "../../../components/public-page-shell";
import { getFeature } from "../../../lib/public-catalog";
import { getSolution, SOLUTIONS } from "../../../lib/solutions";

export function generateStaticParams() {
  return SOLUTIONS.map((solution) => ({ slug: solution.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const solution = getSolution(slug);
  if (!solution) return { title: "Solução" };
  return { title: solution.title, description: solution.summary };
}

export default async function SolutionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const solution = getSolution(slug);
  if (!solution) notFound();

  const features = solution.features
    .map((featureSlug) => getFeature(featureSlug))
    .filter(Boolean);

  return (
    <PublicPageShell>
      <div className="vj-stack">
        <div>
          <p className="vj-meta">Soluções</p>
          <h1 className="vj-display">{solution.title}</h1>
          <p className="vj-lead">{solution.summary}</p>
          <div className="vj-form-actions">
            <ButtonLink href={solution.cta.href}>{solution.cta.label}</ButtonLink>
            <ButtonLink href="/explorar" variant="secondary">
              Explorar demonstração
            </ButtonLink>
          </div>
        </div>

        <section className="vj-card">
          <h2 className="vj-section-title">Problemas que esta solução aborda</h2>
          <ul>
            {solution.problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </section>

        <section className="vj-stack">
          <h2 className="vj-section-title">Funcionalidades relacionadas</h2>
          <div className="vj-feature-grid">
            {features.map((feature) =>
              feature ? (
                <a
                  key={feature.slug}
                  className="vj-card vj-card-link"
                  href={`/ferramentas/${feature.slug}`}
                >
                  <h3 className="vj-section-title">{feature.name}</h3>
                  <p>{feature.summary}</p>
                </a>
              ) : null,
            )}
          </div>
        </section>
      </div>
    </PublicPageShell>
  );
}
