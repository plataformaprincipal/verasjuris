import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Gestão jurídica",
};

export default function GestaoJuridicaPage() {
  redirect("/ferramentas?categoria=gestao_juridica");
}
