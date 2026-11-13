import type { Metadata } from "next";
import { PublicPageShell } from "../../components/public-page-shell";
import { SOLUTIONS } from "../../lib/solutions";

export const metadata: Metadata = {
  title: "Soluções",
  description: "Soluções VerasJuris para advogados, escritórios, empresas, departamentos jurídicos e clientes.",
};

export default function SolucoesPage() {
  return (
    <PublicPageShell>
      <div className="vj-stack">
        <div>
          <p className="vj-meta">Soluções</p>
          <h1 className="vj-display">Para quem é o VerasJuris</h1>
          <p className="vj-lead">
            Escolha o perfil que melhor descreve sua necessidade e veja os módulos mais relevantes.
          </p>
        </div>
        <div className="vj-feature-grid">
          {SOLUTIONS.map((solution) => (
            <a key={solution.slug} className="vj-card vj-card-link" href={`/solucoes/${solution.slug}`}>
              <h2 className="vj-section-title">{solution.title}</h2>
              <p>{solution.summary}</p>
            </a>
          ))}
        </div>
      </div>
    </PublicPageShell>
  );
}
