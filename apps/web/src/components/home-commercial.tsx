"use client";

import { ButtonLink } from "@verasjuris/ui";
import {
  Briefcase,
  Building2,
  Calculator,
  CalendarDays,
  FileText,
  FolderOpen,
  Gavel,
  HeartPulse,
  Home,
  Landmark,
  Scale,
  Shield,
  Store,
  Users,
  BrainCircuit,
  Workflow,
} from "lucide-react";
import { AVAILABILITY_META, PUBLIC_CATALOG } from "../lib/public-catalog";
import { DEMO_MARKETPLACE_SERVICES, DEMO_BANNER } from "../lib/demo-data";
import { SOLUTIONS } from "../lib/solutions";
import { HomeProductPreview } from "./home-product-preview";
import { PublicPageShell, PublicSection, AvailabilityBadge } from "./public-page-shell";
import { RequireAuthCta } from "./require-auth-cta";

const SERVICES = [
  { label: "Consultoria jurídica", href: "/marketplace-juridico", icon: Scale },
  { label: "Atendimento online", href: "/atendimento-juridico", icon: Users },
  { label: "Direito previdenciário", href: "/gestao-previdenciaria", icon: Shield },
  { label: "Direito trabalhista", href: "/ferramentas?categoria=gestao_juridica", icon: Briefcase },
  { label: "Direito empresarial", href: "/solucoes/empresas", icon: Building2 },
  { label: "Direito tributário", href: "/ferramentas", icon: Landmark },
  { label: "Direito civil", href: "/ferramentas", icon: FileText },
  { label: "Direito de família", href: "/ferramentas", icon: HeartPulse },
  { label: "Direito do consumidor", href: "/ferramentas", icon: Store },
  { label: "Direito administrativo", href: "/processos-administrativos", icon: FolderOpen },
  { label: "Direito imobiliário", href: "/ferramentas", icon: Home },
  { label: "Direito digital", href: "/ferramentas", icon: Workflow },
  { label: "Direito médico e da saúde", href: "/ferramentas", icon: HeartPulse },
] as const;

const DEMO_TOOLS = [
  { slug: "processos-judiciais", icon: Gavel },
  { slug: "clientes", icon: Users },
  { slug: "agenda", icon: CalendarDays },
  { slug: "documentos", icon: FileText },
  { slug: "calculo-previdenciario", icon: Calculator },
  { slug: "assistente-ia", icon: BrainCircuit },
  { slug: "contratos", icon: FileText },
  { slug: "fluxos-trabalho", icon: Workflow },
] as const;

const FAQ = [
  {
    q: "Posso conhecer a plataforma sem criar conta?",
    a: "Sim. As abas Início, Ferramentas, Explorar e Juris One são públicas. Operações reais exigem autenticação.",
  },
  {
    q: "O Juris One substitui um advogado?",
    a: "Não. É um assistente informativo da plataforma. Orientação jurídica individualizada cabe a profissionais habilitados.",
  },
  {
    q: "Como contrato um serviço do marketplace?",
    a: "Você pode explorar anúncios públicos. Solicitar propostas, mensagens privadas e pagamentos exigem conta e permissões.",
  },
];

export function HomeCommercial() {
  const highlights = DEMO_TOOLS.map((item) => ({
    ...item,
    feature: PUBLIC_CATALOG.find((feature) => feature.slug === item.slug),
  })).filter((item) => item.feature);

  return (
    <PublicPageShell wide className="vj-home">
      <section className="vj-commercial-hero">
        <div className="vj-stack">
          <p className="vj-meta">VerasJuris</p>
          <h1 className="vj-display">O universo jurídico em uma única plataforma.</h1>
          <p className="vj-lead">
            Gestão, inteligência artificial, serviços jurídicos e ferramentas digitais para
            profissionais, empresas e clientes.
          </p>
          <div className="vj-form-actions">
            <ButtonLink href="/ferramentas">Explorar ferramentas</ButtonLink>
            <ButtonLink href="/explorar" variant="secondary">
              Conhecer o VerasJuris
            </ButtonLink>
            <ButtonLink href="/juris-one" variant="ghost">
              Abrir Juris One
            </ButtonLink>
          </div>
        </div>
        <HomeProductPreview />
      </section>

      <PublicSection
        title="Áreas de atuação"
        lead="Navegue por categorias de serviços e soluções jurídicas. Cada item leva a uma área pública real da plataforma."
      >
        <div className="vj-service-grid">
          {SERVICES.map((service) => {
            const Icon = service.icon;
            return (
              <a key={service.label} className="vj-service-card" href={service.href}>
                <Icon size={20} aria-hidden="true" />
                <strong>{service.label}</strong>
              </a>
            );
          })}
        </div>
      </PublicSection>

      <PublicSection
        title="Marketplace jurídico"
        lead="Pesquise serviços e perfis demonstrativos. Contratações e mensagens privadas exigem autenticação."
      >
        <p className="vj-demo-banner" role="status">
          {DEMO_BANNER}
        </p>
        <div className="vj-feature-grid">
          {DEMO_MARKETPLACE_SERVICES.map((service) => (
            <article key={service.id} className="vj-card">
              <p className="vj-meta">Exemplo público</p>
              <h3 className="vj-section-title">{service.title}</h3>
              <p>{service.description}</p>
              <p className="vj-meta">
                {service.provider} · {service.area}
              </p>
              <p className="vj-meta">{service.priceNote}</p>
              <RequireAuthCta
                actionLabel="Solicitar proposta"
                title="Entre para solicitar uma proposta"
                message="Para solicitar propostas ou contratar serviços, entre ou crie sua conta no VerasJuris."
                redirectTo="/marketplace/solicitacoes/nova"
                variant="secondary"
              />
            </article>
          ))}
        </div>
        <div className="vj-form-actions">
          <ButtonLink href="/marketplace-juridico">Explorar marketplace</ButtonLink>
        </div>
      </PublicSection>

      <PublicSection
        title="Ferramentas em destaque"
        lead="Prévia do catálogo operacional. A disponibilidade reflete o estágio real de implementação."
      >
        <div className="vj-feature-grid">
          {highlights.map(({ feature, icon: Icon }) =>
            feature ? (
              <a
                key={feature.slug}
                className="vj-interactive-card"
                href={`/ferramentas/${feature.slug}`}
              >
                <Icon size={20} aria-hidden="true" />
                <AvailabilityBadge availability={feature.availability} />
                <strong>{feature.name}</strong>
                <span className="vj-meta">{AVAILABILITY_META[feature.availability].label}</span>
                <p>{feature.summary}</p>
              </a>
            ) : null,
          )}
        </div>
        <ButtonLink href="/ferramentas" variant="secondary">
          Ver todas as ferramentas
        </ButtonLink>
      </PublicSection>

      <PublicSection
        title="Soluções por público"
        lead="Escolha o perfil que melhor descreve sua necessidade."
      >
        <div className="vj-audience-grid">
          {SOLUTIONS.map((solution) => (
            <a key={solution.slug} className="vj-service-card" href={`/solucoes/${solution.slug}`}>
              <strong>{solution.title}</strong>
              <span className="vj-meta">{solution.summary}</span>
            </a>
          ))}
        </div>
      </PublicSection>

      <PublicSection
        title="Juris One"
        lead="Assistente inteligente do VerasJuris para orientação inicial, organização de informações e encaminhamento."
      >
        <div className="vj-card vj-stack">
          <div className="vj-inline-actions">
            <BrainCircuit size={22} aria-hidden="true" />
            <AvailabilityBadge availability="in_development" />
          </div>
          <h3 className="vj-section-title">Seu assistente no universo jurídico</h3>
          <p>
            Visitantes podem iniciar uma conversa informativa. Respostas com modelos pagos dependem
            de provedor configurado, autenticação e limites. O Juris One não substitui advogado
            habilitado.
          </p>
          <div className="vj-form-actions">
            <ButtonLink href="/juris-one">Iniciar Juris One</ButtonLink>
            <ButtonLink href="/planos" variant="secondary">
              Ver planos
            </ButtonLink>
          </div>
        </div>
      </PublicSection>

      <PublicSection title="Perguntas frequentes">
        <div className="vj-stack">
          {FAQ.map((item) => (
            <details key={item.q} className="vj-card">
              <summary className="vj-section-title">{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </PublicSection>
    </PublicPageShell>
  );
}
