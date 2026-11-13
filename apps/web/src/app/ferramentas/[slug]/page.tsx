import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FeatureDetail } from "../../../components/feature-catalog-ui";
import { PublicPageShell } from "../../../components/public-page-shell";
import { getFeature, PUBLIC_CATALOG } from "../../../lib/public-catalog";

export function generateStaticParams() {
  return PUBLIC_CATALOG.map((feature) => ({ slug: feature.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const feature = getFeature(slug);
  if (!feature) return { title: "Ferramenta" };
  return { title: feature.name, description: feature.summary };
}

export default async function FerramentaDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const feature = getFeature(slug);
  if (!feature) notFound();
  return (
    <PublicPageShell>
      <FeatureDetail feature={feature} />
    </PublicPageShell>
  );
}
