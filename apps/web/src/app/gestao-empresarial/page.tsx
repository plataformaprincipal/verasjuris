import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Gestão empresarial" };

export default function GestaoEmpresarialPage() {
  redirect("/ferramentas?categoria=empresarial");
}
