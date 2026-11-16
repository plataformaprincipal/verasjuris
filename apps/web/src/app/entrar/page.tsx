import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthPageChrome } from "../../components/auth-page-chrome";
import { LoginForm } from "../../components/auth-forms";
import { AuthPageFooterLink } from "../../components/auth-page-footer";
import { resolveAuthenticatedHome } from "../../lib/persona-home";
import { getSession } from "../../lib/session";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const params = await searchParams;
  const session = await getSession();
  if (session.state === "authenticated") {
    redirect(resolveAuthenticatedHome(session.account, params.redirect ?? null));
  }

  const signupHref = params.redirect
    ? `/cadastro?redirect=${encodeURIComponent(params.redirect)}`
    : "/cadastro";

  return (
    <AuthPageChrome
      titleKey="auth.login"
      leadKey="auth.loginLead"
      showRedirectNotice={Boolean(params.redirect)}
    >
      {session.state === "unavailable" ? <p role="status">{session.message}</p> : null}
      <LoginForm redirectTo={params.redirect} />
      <AuthPageFooterLink
        prefixKey="auth.noAccount"
        href={signupHref}
        linkKey="auth.createAccount"
      />
    </AuthPageChrome>
  );
}
