import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Atendimento jurídico" };

export default function AtendimentoJuridicoPage() {
  redirect("/ferramentas?categoria=atendimento");
}
