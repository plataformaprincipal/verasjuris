import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Ferramentas",
  description: "Redirecionamento para o detalhe da ferramenta no VerasJuris.",
};

export default async function FuncionalidadeSlugRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/ferramentas/${slug}`);
}
