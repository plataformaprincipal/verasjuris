import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicPageShell } from "../../../components/public-page-shell";
import { SolutionPublicView } from "../../../components/solution-public-view";
import { getFeature } from "../../../lib/public-catalog";
import { getSolution, SOLUTIONS } from "../../../lib/solutions";

export function generateStaticParams() {
  return SOLUTIONS.map((solution) => ({ slug: solution.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const solution = getSolution(slug);
  if (!solution) return { title: "Solução" };
  return { title: solution.title, description: solution.summary };
}

export default async function SolutionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const solution = getSolution(slug);
  if (!solution) notFound();

  const features = solution.features
    .map((featureSlug) => getFeature(featureSlug))
    .filter((feature): feature is NonNullable<typeof feature> => Boolean(feature));

  return (
    <PublicPageShell>
      <SolutionPublicView solution={solution} features={features} />
    </PublicPageShell>
  );
}
