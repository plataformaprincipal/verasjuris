import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Gestão de clientes" };

export default function GestaoClientesPage() {
  redirect("/ferramentas/clientes");
}
