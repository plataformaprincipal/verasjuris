import type { Metadata } from "next";
import { ButtonLink } from "@verasjuris/ui";
import { FeatureCatalogBrowser } from "../../components/feature-catalog-ui";
import { PublicPageShell } from "../../components/public-page-shell";
import type { CatalogCategory } from "../../lib/public-catalog";
import { CATEGORY_META, listCategories } from "../../lib/public-catalog";

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
      <div className="vj-stack">
        <div>
          <p className="vj-meta">Ferramentas</p>
          <h1 className="vj-display">Catálogo e laboratório da plataforma</h1>
          <p className="vj-lead">
            Explore módulos de gestão, inteligência artificial, produtividade e integrações.
            Demonstrações usam dados fictícios. Operações reais exigem autenticação.
          </p>
          <div className="vj-form-actions">
            <ButtonLink href="/explorar?view=painel">Abrir demonstração</ButtonLink>
            <ButtonLink href="/cadastro" variant="secondary">
              Criar conta
            </ButtonLink>
          </div>
        </div>
        <nav className="vj-chip-grid" aria-label="Categorias de ferramentas">
          {categories.map((category) => (
            <a key={category} className="vj-badge" href={`/ferramentas?categoria=${category}`}>
              {CATEGORY_META[category].label}
            </a>
          ))}
        </nav>
        <FeatureCatalogBrowser initialCategory={initialCategory} initialQuery={params.q ?? ""} />
      </div>
    </PublicPageShell>
  );
}
