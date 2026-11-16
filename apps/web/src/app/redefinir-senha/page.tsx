import type { Metadata } from "next";
import { ConfirmResetForm } from "../../components/auth-forms";
import { AuthPageChrome } from "../../components/auth-page-chrome";

export const metadata: Metadata = { title: "Redefinir senha" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthPageChrome titleKey="auth.page.resetTitle" leadKey="auth.page.resetLead">
      <ConfirmResetForm token={params.token ?? ""} />
    </AuthPageChrome>
  );
}
