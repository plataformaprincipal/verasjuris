"use client";

import { LanguageSwitcher, useLocale } from "./locale-provider";

type FooterLink = { href: string; labelKey: string };

const PLATFORM: FooterLink[] = [
  { href: "/", labelKey: "footer.home" },
  { href: "/ferramentas", labelKey: "footer.tools" },
  { href: "/explorar", labelKey: "footer.explore" },
  { href: "/juris-one", labelKey: "footer.jurisOne" },
  { href: "/marketplace-juridico", labelKey: "footer.marketplace" },
  { href: "/planos", labelKey: "footer.plans" },
  { href: "/integracoes", labelKey: "footer.integrations" },
];

const SOLUTIONS: FooterLink[] = [
  { href: "/solucoes/advogados", labelKey: "footer.lawyers" },
  { href: "/solucoes/escritorios", labelKey: "footer.offices" },
  { href: "/solucoes/empresas", labelKey: "footer.companies" },
  { href: "/solucoes/departamentos-juridicos", labelKey: "footer.legalDepts" },
  { href: "/solucoes/clientes", labelKey: "footer.clients" },
];

const COMPANY: FooterLink[] = [
  { href: "/institucional/sobre", labelKey: "footer.about" },
  { href: "/institucional/contato", labelKey: "footer.contact" },
  { href: "/politicas/seguranca", labelKey: "footer.security" },
  { href: "/acessibilidade", labelKey: "footer.accessibility" },
  { href: "/institucional/ajuda", labelKey: "footer.help" },
  { href: "/idiomas", labelKey: "footer.languages" },
  { href: "/status", labelKey: "footer.status" },
];

const LEGAL: FooterLink[] = [
  { href: "/documentos-legais", labelKey: "footer.legalCenter" },
  { href: "/termos-de-uso", labelKey: "footer.terms" },
  { href: "/termos-de-servico", labelKey: "footer.termsOfService" },
  { href: "/politica-de-privacidade", labelKey: "footer.privacyPolicy" },
  { href: "/politicas/cookies", labelKey: "footer.cookies" },
  { href: "/politicas/lgpd", labelKey: "footer.lgpd" },
];

function Section({
  title,
  links,
  t,
}: {
  title: string;
  links: FooterLink[];
  t: (key: string, fallback?: string) => string;
}) {
  return (
    <section>
      <h2 className="vj-footer-heading">{title}</h2>
      <ul className="vj-footer-list">
        {links.map((link) => (
          <li key={link.href}>
            <a href={link.href}>{t(link.labelKey)}</a>
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
        <Section title={t("footer.platform")} links={PLATFORM} t={t} />
        <Section title={t("footer.solutions")} links={SOLUTIONS} t={t} />
        <Section title={t("footer.institutional")} links={COMPANY} t={t} />
        <Section title={t("footer.legal")} links={LEGAL} t={t} />
        <section>
          <h2 className="vj-footer-heading">{t("footer.languages")}</h2>
          <LanguageSwitcher />
        </section>
      </div>
      <p className="vj-meta">
        {t("footer.disclaimer", undefined, { draft: t("common.draft") })}
      </p>
    </footer>
  );
}
