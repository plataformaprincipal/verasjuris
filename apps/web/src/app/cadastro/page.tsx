import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandMark } from "../../components/brand-mark";
import { LanguageSwitcher } from "../../components/locale-provider";
import { RegistrationWizard } from "../../components/registration-wizard";
import { isSafeRedirectPath, resolvePostAuthRedirect, withRedirect } from "../../lib/safe-redirect";
import { getSession } from "../../lib/session";

export const metadata: Metadata = {
  title: "Criar conta",
  description:
    "Crie sua conta na VerasJuris em poucas etapas: escolha seu perfil, informe seus dados e comece a usar a plataforma.",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawRedirect = Array.isArray(params.redirect) ? params.redirect[0] : params.redirect;
  const redirectParam = rawRedirect && isSafeRedirectPath(rawRedirect) ? rawRedirect : null;

  const session = await getSession();
  if (session.state === "authenticated") {
    redirect(resolvePostAuthRedirect(redirectParam));
  }

  return (
    <div className="vj-auth-shell">
      <header className="vj-public-header">
        <a href="/" aria-label="VerasJuris — página inicial">
          <BrandMark />
        </a>
        <LanguageSwitcher />
      </header>
      <main className="vj-page" id="conteudo">
        <div className="vj-card vj-panel vj-wizard-panel">
          <h1 className="vj-title">Criar conta</h1>
          <p>
            Cadastro seguro em etapas. Solicitamos apenas os dados necessários para identificar sua
            conta; credenciais profissionais, como a OAB, são verificadas depois.
          </p>
          <RegistrationWizard redirectTo={redirectParam} />
          <p>
            Já tem uma conta? <a href={withRedirect("/entrar", redirectParam)}>Entrar</a>
          </p>
        </div>
      </main>
    </div>
  );
}
