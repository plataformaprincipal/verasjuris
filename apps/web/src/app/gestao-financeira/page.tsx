import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Gestão financeira" };

export default function GestaoFinanceiraPage() {
  redirect("/ferramentas?categoria=financeiro");
}
