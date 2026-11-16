import { redirect } from "next/navigation";

/** Alias institucional para Termos de Serviço. */
export default function LegacyServiceTermsPage() {
  redirect("/termos-de-servico");
}
