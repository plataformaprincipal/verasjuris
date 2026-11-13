import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Processos judiciais" };

export default function ProcessosJudiciaisPage() {
  redirect("/ferramentas/processos-judiciais");
}
