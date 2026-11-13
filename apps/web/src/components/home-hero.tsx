"use client";

import { ButtonLink } from "@verasjuris/ui";
import { BrandMark } from "./brand-mark";
import { LanguageSwitcher, useLocale } from "./locale-provider";

export function HomeHero() {
  const { t } = useLocale();

  return (
    <>
      <header className="vj-public-header">
        <a href="/" aria-label={t("nav.homeBrand", "VerasJuris, início")}>
          <BrandMark />
        </a>
        <nav
          id="navegacao"
          className="vj-header-actions"
          aria-label={t("nav.primary", "Principal")}
        >
          <a href="/acessibilidade">{t("nav.accessibility")}</a>
          <a href="/status">{t("footer.status")}</a>
          <a href="/developers">{t("footer.developers")}</a>
          <LanguageSwitcher />
          <ButtonLink href="/entrar" variant="ghost">
            {t("nav.login")}
          </ButtonLink>
          <ButtonLink href="/cadastro">{t("nav.signup")}</ButtonLink>
        </nav>
      </header>
      <main className="vj-page" id="conteudo">
        <div className="vj-stack">
          <p className="vj-meta">{t("home.eyebrow")}</p>
          <h1 className="vj-display">{t("home.title")}</h1>
          <p className="vj-subtitle">{t("home.subtitle")}</p>
          <p className="vj-lead">{t("home.lead")}</p>
          <div className="vj-form-actions">
            <ButtonLink href="/cadastro">{t("nav.signup")}</ButtonLink>
            <ButtonLink href="/entrar" variant="secondary">
              {t("nav.login")}
            </ButtonLink>
          </div>
          <div className="vj-split">
            <section className="vj-card">
              <h2 className="vj-section-title">{t("home.availableTitle")}</h2>
              <ul>
                <li>{t("home.available.auth")}</li>
                <li>{t("home.available.org")}</li>
                <li>{t("home.available.modules")}</li>
                <li>{t("home.available.a11y")}</li>
              </ul>
            </section>
            <section className="vj-card vj-card-calm">
              <h2 className="vj-section-title">{t("home.limitsTitle")}</h2>
              <p>{t("home.limitsBody")}</p>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
