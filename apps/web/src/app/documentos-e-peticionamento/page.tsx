import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Documentos e peticionamento" };

export default function DocumentosPeticionamentoPage() {
  redirect("/ferramentas?categoria=documentos");
}
