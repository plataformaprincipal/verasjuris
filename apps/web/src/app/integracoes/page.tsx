import type { Metadata } from "next";
import { AvailabilityBadge, PublicPageShell } from "../../components/public-page-shell";
import { listByCategory } from "../../lib/public-catalog";

export const metadata: Metadata = {
  title: "Integrações",
  description:
    "Integrações do VerasJuris classificadas por disponibilidade efetiva: pagamentos, e-mail, agenda, tribunais e inteligência artificial.",
};

const EXTRA = [
  {
    name: "Tribunais e sistemas judiciais",
    availability: "planned" as const,
    note: "Não há protocolo eletrônico automático nem captura oficial de processos nesta versão.",
  },
  {
    name: "Órgãos administrativos e previdenciários",
    availability: "planned" as const,
    note: "Não há afirmação de protocolo automático no INSS ou em outros órgãos sem integração comprovada.",
  },
  {
    name: "Assinatura eletrônica",
    availability: "in_development" as const,
    note: "Contratos e fluxos de assinatura existem na plataforma; provedores externos dependem de configuração.",
  },
  {
    name: "Armazenamento de arquivos",
    availability: "in_development" as const,
    note: "Disponível quando o serviço de armazenamento estiver configurado para a organização.",
  },
];

export default function IntegracoesPage() {
  const catalog = listByCategory("integracoes");

  return (
    <PublicPageShell>
      <div className="vj-stack">
        <div>
          <p className="vj-meta">Integrações</p>
          <h1 className="vj-display">Serviços conectados, com disponibilidade explícita</h1>
          <p className="vj-lead">
            A existência de uma tela de integração não significa conexão operacional. Cada item
            abaixo reflete o estágio evidenciado no código e na configuração padrão.
          </p>
        </div>

        <div className="vj-feature-grid">
          {catalog.map((feature) => (
            <article key={feature.slug} className="vj-card">
              <AvailabilityBadge availability={feature.availability} />
              <h2 className="vj-section-title">
                <a href={`/ferramentas/${feature.slug}`}>{feature.name}</a>
              </h2>
              <p>{feature.summary}</p>
              <p className="vj-meta">{feature.limitations[0]}</p>
            </article>
          ))}
          {EXTRA.map((item) => (
            <article key={item.name} className="vj-card">
              <AvailabilityBadge availability={item.availability} />
              <h2 className="vj-section-title">{item.name}</h2>
              <p>{item.note}</p>
            </article>
          ))}
        </div>
      </div>
    </PublicPageShell>
  );
}
