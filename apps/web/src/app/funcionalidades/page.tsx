import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Ferramentas",
  description: "Redirecionamento para o catálogo de ferramentas VerasJuris.",
};

export default async function FuncionalidadesRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; q?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.categoria) query.set("categoria", params.categoria);
  if (params.q) query.set("q", params.q);
  const suffix = query.toString();
  redirect(suffix ? `/ferramentas?${suffix}` : "/ferramentas");
}
