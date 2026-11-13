import type { Metadata } from "next";
import { RequestResetForm } from "../../components/auth-forms";
import { BrandMark } from "../../components/brand-mark";
import { LanguageSwitcher } from "../../components/locale-provider";

export const metadata: Metadata = { title: "Recuperar conta" };

export default function RecoverPage() {
  return (
    <div className="vj-auth-shell">
      <header className="vj-public-header">
        <a href="/">
          <BrandMark />
        </a>
        <LanguageSwitcher />
      </header>
      <main className="vj-page" id="conteudo">
        <div className="vj-card vj-panel vj-auth-panel">
          <h1 className="vj-title">Recuperar conta</h1>
          <p>
            Informe o e-mail da conta. A resposta é sempre neutra e não confirma se o endereço
            existe.
          </p>
          <RequestResetForm />
          <p>
            <a href="/entrar">Voltar para entrar</a>
          </p>
        </div>
      </main>
    </div>
  );
}
