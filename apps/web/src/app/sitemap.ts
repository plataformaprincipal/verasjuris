import type { MetadataRoute } from "next";
import { PUBLIC_CATALOG } from "../lib/public-catalog";
import { SOLUTIONS } from "../lib/solutions";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.verasjuris.com";
  const now = new Date();

  const staticRoutes = [
    "",
    "/plataforma",
    "/ferramentas",
    "/explorar",
    "/juris-one",
    "/inteligencia-artificial",
    "/marketplace-juridico",
    "/integracoes",
    "/automacao",
    "/planos",
    "/solucoes",
    "/idiomas",
    "/acessibilidade",
    "/institucional/sobre",
    "/institucional/contato",
    "/institucional/ajuda",
    "/politicas/termos",
    "/politicas/privacidade",
    "/politicas/cookies",
    "/politicas/seguranca",
    "/entrar",
    "/cadastro",
  ];

  return [
    ...staticRoutes.map((path) => ({
      url: `${base}${path}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1 : 0.7,
    })),
    ...PUBLIC_CATALOG.map((feature) => ({
      url: `${base}/ferramentas/${feature.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...SOLUTIONS.map((solution) => ({
      url: `${base}/solucoes/${solution.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
