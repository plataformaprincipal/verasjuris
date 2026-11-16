import type { Metadata } from "next";
import { FeatureCatalogBrowser } from "../../components/feature-catalog-ui";
import { ToolsRouteChrome } from "../../components/public-route-chrome";
import { PublicPageShell } from "../../components/public-page-shell";
import type { CatalogCategory } from "../../lib/public-catalog";
import { listCategories } from "../../lib/public-catalog";

export const metadata: Metadata = {
  title: "Ferramentas",
  description:
    "Catálogo público das ferramentas VerasJuris, com busca, filtros e disponibilidade real.",
};

export default async function FerramentasPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; q?: string }>;
}) {
  const params = await searchParams;
  const categories = listCategories();
  const initialCategory = categories.includes(params.categoria as CatalogCategory)
    ? (params.categoria as CatalogCategory)
    : null;

  return (
    <PublicPageShell>
      <ToolsRouteChrome categories={categories}>
        <FeatureCatalogBrowser initialCategory={initialCategory} initialQuery={params.q ?? ""} />
      </ToolsRouteChrome>
    </PublicPageShell>
  );
}
