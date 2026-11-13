import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "../../components/auth-forms";
import { BrandMark } from "../../components/brand-mark";
import { LanguageSwitcher } from "../../components/locale-provider";
import { resolvePostAuthRedirect } from "../../lib/safe-redirect";
import { getSession } from "../../lib/session";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const params = await searchParams;
  const nextPath = resolvePostAuthRedirect(params.redirect ?? null);
  const session = await getSession();
  if (session.state === "authenticated") redirect(nextPath);

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
          <h1 className="vj-title">Entrar</h1>
          <p>Use o e-mail e a senha da sua conta VerasJuris.</p>
          {params.redirect ? (
            <p className="vj-meta" role="status">
              Após entrar, você continua no destino solicitado, se estiver autorizado.
            </p>
          ) : null}
          {session.state === "unavailable" ? <p role="status">{session.message}</p> : null}
          <LoginForm redirectTo={params.redirect} />
          <p>
            Ainda não tem conta?{" "}
            <a
              href={
                params.redirect
                  ? `/cadastro?redirect=${encodeURIComponent(params.redirect)}`
                  : "/cadastro"
              }
            >
              Criar conta
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
