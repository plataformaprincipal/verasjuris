import type { Metadata } from "next";
import { PublicPageShell } from "../../components/public-page-shell";
import { LanguageSwitcher } from "../../components/locale-provider";
import { LOCALE_LABELS, LOCALE_META, SUPPORTED_LOCALES } from "../../lib/i18n/locales";

export const metadata: Metadata = {
  title: "Idiomas",
  description:
    "Idiomas previstos no VerasJuris. A cobertura textual completa segue em expansão; a seleção já está disponível na interface.",
};

export default function IdiomasPage() {
  return (
    <PublicPageShell>
      <div className="vj-stack">
        <div>
          <p className="vj-meta">Internacionalização</p>
          <h1 className="vj-display">Idiomas da plataforma</h1>
          <p className="vj-lead">
            O VerasJuris prevê suporte a {SUPPORTED_LOCALES.length} idiomas na infraestrutura de
            interface. A cobertura integral dos textos públicos e autenticados evolui de forma
            progressiva. Conteúdos jurídicos privados dos usuários não são traduzidos
            automaticamente sem operação específica e autorizada.
          </p>
        </div>

        <section className="vj-card">
          <h2 className="vj-section-title">Selecionar idioma</h2>
          <LanguageSwitcher />
        </section>

        <section className="vj-card">
          <h2 className="vj-section-title">Idiomas previstos</h2>
          <ul className="vj-locale-list">
            {SUPPORTED_LOCALES.map((locale) => (
              <li key={locale}>
                <strong>{LOCALE_LABELS[locale]}</strong>
                <span className="vj-meta">
                  {" "}
                  · {locale}
                  {LOCALE_META[locale].dir === "rtl" ? " · direita para esquerda" : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </PublicPageShell>
  );
}
