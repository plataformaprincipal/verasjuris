import type { Availability, CatalogCategory } from "./public-catalog";
import type { SolutionSlug } from "./solutions";

/** Chaves i18n do catálogo público — usar com t(key, fallbackPt). */
export function categoryLabelKey(category: CatalogCategory): string {
  return `catalog.category.${category}.label`;
}

export function categoryDescriptionKey(category: CatalogCategory): string {
  return `catalog.category.${category}.description`;
}

export function featureNameKey(slug: string): string {
  return `catalog.feature.${slug}.name`;
}

export function featureSummaryKey(slug: string): string {
  return `catalog.feature.${slug}.summary`;
}

export function featureProblemKey(slug: string): string {
  return `catalog.feature.${slug}.problem`;
}

export function availabilityLabelKey(availability: Availability): string {
  return `common.availability.${availability}`;
}

export function availabilityDescriptionKey(availability: Availability): string {
  return `common.availability.${availability}.description`;
}

export function solutionTitleKey(slug: SolutionSlug): string {
  return `solution.${slug}.title`;
}

export function solutionSummaryKey(slug: SolutionSlug): string {
  return `solution.${slug}.summary`;
}

export function demoViewLabelKey(view: string): string {
  return `demo.view.${view}`;
}
