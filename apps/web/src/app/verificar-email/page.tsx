import type { Metadata } from "next";
import { VerifyEmailForm } from "../../components/auth-forms";
import { BrandMark } from "../../components/brand-mark";
import { LanguageSwitcher } from "../../components/locale-provider";

export const metadata: Metadata = { title: "Verificar e-mail" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
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
          <h1 className="vj-title">Verificar e-mail</h1>
          <p>
            Confirme o endereço da sua conta. Se o envio por e-mail não estiver configurado neste
            ambiente, use o fluxo de desenvolvimento documentado.
          </p>
          <VerifyEmailForm initialToken={params.token ?? ""} />
        </div>
      </main>
    </div>
  );
}
