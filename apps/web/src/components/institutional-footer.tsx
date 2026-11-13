"use client";

import { LanguageSwitcher, useLocale } from "./locale-provider";

type FooterLink = { href: string; label: string };

const PLATFORM: FooterLink[] = [
  { href: "/", label: "Início" },
  { href: "/ferramentas", label: "Ferramentas" },
  { href: "/explorar", label: "Explorar" },
  { href: "/juris-one", label: "Juris One" },
  { href: "/marketplace-juridico", label: "Marketplace" },
  { href: "/planos", label: "Planos" },
  { href: "/integracoes", label: "Integrações" },
];

const SOLUTIONS: FooterLink[] = [
  { href: "/solucoes/advogados", label: "Advogados" },
  { href: "/solucoes/escritorios", label: "Escritórios" },
  { href: "/solucoes/empresas", label: "Empresas" },
  { href: "/solucoes/departamentos-juridicos", label: "Departamentos jurídicos" },
  { href: "/solucoes/clientes", label: "Clientes" },
];

const COMPANY: FooterLink[] = [
  { href: "/institucional/sobre", label: "Sobre" },
  { href: "/institucional/contato", label: "Contato" },
  { href: "/politicas/seguranca", label: "Segurança" },
  { href: "/acessibilidade", label: "Acessibilidade" },
  { href: "/institucional/ajuda", label: "Central de ajuda" },
  { href: "/idiomas", label: "Idiomas" },
  { href: "/status", label: "Status" },
];

const LEGAL: FooterLink[] = [
  { href: "/politicas/termos", label: "Termos de uso" },
  { href: "/politicas/privacidade", label: "Privacidade" },
  { href: "/politicas/cookies", label: "Cookies" },
  { href: "/politicas/lgpd", label: "Informações legais / LGPD" },
];

function Section({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <section>
      <h2 className="vj-footer-heading">{title}</h2>
      <ul className="vj-footer-list">
        {links.map((link) => (
          <li key={link.href}>
            <a href={link.href}>{link.label}</a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function InstitutionalFooter() {
  const { t } = useLocale();
  return (
    <footer className="vj-institutional-footer" role="contentinfo">
      <div className="vj-institutional-footer-grid">
        <Section title="Plataforma" links={PLATFORM} />
        <Section title="Soluções" links={SOLUTIONS} />
        <Section title="Institucional" links={COMPANY} />
        <Section title="Jurídico" links={LEGAL} />
        <section>
          <h2 className="vj-footer-heading">{t("footer.languages")}</h2>
          <LanguageSwitcher />
        </section>
      </div>
      <p className="vj-meta">
        A Café Platine desenvolve a plataforma VerasJuris. O VerasJuris é independente de
        escritórios, autoridades e órgãos públicos. Políticas marcadas como {t("common.draft")} não
        têm aprovação jurídica final.
      </p>
    </footer>
  );
}
