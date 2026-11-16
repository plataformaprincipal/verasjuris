import { redirect } from "next/navigation";

/** Mantém compatibilidade com links existentes. */
export default function LegacyPrivacyPage() {
  redirect("/politica-de-privacidade");
}
