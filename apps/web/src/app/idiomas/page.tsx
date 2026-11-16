"use client";

import { PublicPageShell } from "../../components/public-page-shell";
import { LanguageSwitcher, useLocale } from "../../components/locale-provider";
import { LOCALE_LABELS, SUPPORTED_LOCALES } from "../../lib/i18n/locales";

export default function IdiomasPage() {
  const { t } = useLocale();

  return (
    <PublicPageShell>
      <div className="vj-stack">
        <div>
          <p className="vj-meta">{t("languages.title")}</p>
          <h1 className="vj-display">{t("languages.title")}</h1>
          <p className="vj-lead">{t("languages.lead")}</p>
        </div>

        <section className="vj-card" aria-labelledby="languages-select-title">
          <h2 className="vj-section-title" id="languages-select-title">
            {t("nav.language")}
          </h2>
          <LanguageSwitcher />
        </section>

        <section className="vj-card" aria-labelledby="languages-official-title">
          <h2 className="vj-section-title" id="languages-official-title">
            {t("languages.official")}
          </h2>
          <ul className="vj-locale-list">
            {SUPPORTED_LOCALES.map((locale) => (
              <li key={locale}>
                <strong>{LOCALE_LABELS[locale]}</strong>
                <span className="vj-meta"> · {locale}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </PublicPageShell>
  );
}
