import { redirect } from "next/navigation";

/** Mantém compatibilidade com links existentes. */
export default function LegacyTermsPage() {
  redirect("/termos-de-uso");
}
