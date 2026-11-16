import type { Metadata } from "next";
import { ExploreDemo } from "../../components/explore-demo";
import { ExploreSocial } from "../../components/explore-social";
import { ExploreRouteChrome } from "../../components/public-route-chrome";
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
      <ExploreRouteChrome>
        {labView ? <ExploreDemo initialView={labView} /> : <ExploreSocial />}
      </ExploreRouteChrome>
    </PublicPageShell>
  );
}
