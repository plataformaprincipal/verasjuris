import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthPageChrome } from "../../components/auth-page-chrome";
import { AuthPageFooterLink } from "../../components/auth-page-footer";
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
    <AuthPageChrome
      titleKey="register.title"
      leadKey="auth.signupLead"
      panelClassName="vj-wizard-panel"
    >
      <RegistrationWizard redirectTo={redirectParam} />
      <AuthPageFooterLink
        prefixKey="auth.alreadyHaveAccount"
        href={withRedirect("/entrar", redirectParam)}
        linkKey="auth.login"
      />
    </AuthPageChrome>
  );
}
