import type { Metadata } from "next";
import { RequestResetForm } from "../../components/auth-forms";
import { AuthPageChrome } from "../../components/auth-page-chrome";
import { AuthPageBackLink } from "../../components/auth-page-footer";

export const metadata: Metadata = { title: "Recuperar conta" };

export default function RecoverPage() {
  return (
    <AuthPageChrome titleKey="auth.page.recoverTitle" leadKey="auth.page.recoverLead">
      <RequestResetForm />
      <AuthPageBackLink href="/entrar" labelKey="auth.backToLogin" />
    </AuthPageChrome>
  );
}
