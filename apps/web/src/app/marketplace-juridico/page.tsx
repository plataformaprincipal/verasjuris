"use client";

import { ButtonLink } from "@verasjuris/ui";
import { PublicPageShell } from "../../components/public-page-shell";
import { RequireAuthCta } from "../../components/require-auth-cta";
import { DEMO_BANNER, DEMO_MARKETPLACE_SERVICES } from "../../lib/demo-data";
import { getFeature } from "../../lib/public-catalog";

export default function MarketplaceJuridicoPage() {
  const feature = getFeature("marketplace-juridico");

  return (
    <PublicPageShell>
      <div className="vj-stack">
        <div>
          <p className="vj-meta">Marketplace jurídico</p>
          <h1 className="vj-display">Conheça o marketplace do VerasJuris</h1>
          <p className="vj-lead">
            Apresentação pública de categorias, perfis demonstrativos e o funcionamento geral da
            contratação. Solicitar propostas, contratar serviços e iniciar atendimentos exige
            autenticação. Perfis abaixo são exemplos e não representam profissionais reais
            cadastrados.
          </p>
          <p className="vj-demo-banner" role="status">
            {DEMO_BANNER}
          </p>
          <div className="vj-form-actions">
            <RequireAuthCta
              actionLabel="Solicitar proposta"
              title="Entre para solicitar uma proposta"
              message="Para solicitar uma proposta ou contratar um serviço, entre na sua conta ou cadastre-se no VerasJuris."
              redirectTo="/marketplace/solicitacoes/nova"
            />
            <ButtonLink href="/explorar?view=marketplace" variant="secondary">
              Ver demonstração
            </ButtonLink>
            <ButtonLink href="/ferramentas/marketplace-juridico" variant="ghost">
              Detalhes do módulo
            </ButtonLink>
          </div>
        </div>

        <section className="vj-card">
          <h2 className="vj-section-title">Como funciona</h2>
          <ol>
            <li>O visitante conhece categorias e o fluxo de contratação.</li>
            <li>Para criar solicitações ou contratar, é necessário entrar ou criar conta.</li>
            <li>A comunicação e o acompanhamento ocorrem na área autenticada.</li>
            <li>Pagamentos seguem a disponibilidade efetiva dos serviços de cobrança.</li>
          </ol>
        </section>

        <section className="vj-stack">
          <h2 className="vj-section-title">Exemplos de serviços</h2>
          <div className="vj-feature-grid">
            {DEMO_MARKETPLACE_SERVICES.map((service) => (
              <article key={service.id} className="vj-card">
                <p className="vj-meta">Perfil demonstrativo</p>
                <h3 className="vj-section-title">{service.title}</h3>
                <p>{service.description}</p>
                <p className="vj-meta">
                  {service.provider} · {service.area}
                </p>
                <p className="vj-meta">{service.priceNote}</p>
                <RequireAuthCta
                  actionLabel="Contratar serviço"
                  title="Entre para contratar"
                  message="Para contratar este serviço, entre na sua conta ou cadastre-se no VerasJuris."
                  redirectTo="/marketplace"
                  variant="secondary"
                />
              </article>
            ))}
          </div>
        </section>

        {feature ? (
          <section className="vj-card vj-card-calm">
            <h2 className="vj-section-title">Limitações relevantes</h2>
            <ul>
              {feature.limitations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </PublicPageShell>
  );
}
