import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Processos administrativos" };

export default function ProcessosAdministrativosPage() {
  redirect("/ferramentas/processos-administrativos");
}
