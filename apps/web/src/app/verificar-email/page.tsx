import type { Metadata } from "next";
import { VerifyEmailForm } from "../../components/auth-forms";
import { AuthPageChrome } from "../../components/auth-page-chrome";

export const metadata: Metadata = { title: "Verificar e-mail" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthPageChrome titleKey="auth.page.verifyTitle" leadKey="auth.page.verifyLead">
      <VerifyEmailForm initialToken={params.token ?? ""} />
    </AuthPageChrome>
  );
}
