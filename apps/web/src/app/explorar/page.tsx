import type { Metadata } from "next";
import { ExploreDemo } from "../../components/explore-demo";
import { ExploreSocial } from "../../components/explore-social";
import { PublicPageShell } from "../../components/public-page-shell";

export const metadata: Metadata = {
  title: "Explorar",
  description:
    "Rede social jurídica do VerasJuris: publicações públicas, temas e demonstrações. Conteúdo demonstrativo é identificado; operações reais exigem autenticação.",
};

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const params = await searchParams;
  const labView = params.view;

  return (
    <PublicPageShell wide>
      <div className="vj-stack">
        <div>
          <p className="vj-meta">Explorar</p>
          <h1 className="vj-display">Rede jurídica profissional</h1>
          <p className="vj-lead">
            Acompanhe atualizações públicas do ecossistema VerasJuris. Publicar, comentar e seguir
            exigem conta. Não há exposição de processos, clientes ou dados protegidos.
          </p>
        </div>
        {labView ? <ExploreDemo initialView={labView} /> : <ExploreSocial />}
      </div>
    </PublicPageShell>
  );
}
