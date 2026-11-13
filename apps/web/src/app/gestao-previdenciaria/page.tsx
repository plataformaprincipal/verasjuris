import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Gestão previdenciária" };

export default function GestaoPrevidenciariaPage() {
  redirect("/ferramentas?categoria=previdenciario");
}
