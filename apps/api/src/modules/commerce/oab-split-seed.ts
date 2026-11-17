import {
  marketplaceEngagements,
  marketplaceRequests,
  marketplaceServiceCategories,
  splitRules,
  type AppDatabase,
} from "@verasjuris/database";
import { MARKETPLACE_COMMISSION_RULES } from "@verasjuris/validation";
import { and, eq, isNull } from "drizzle-orm";

/** productType canônico para splits de marketplace OAB-safe. */
export const MARKETPLACE_SPLIT_PRODUCT_TYPE = "marketplace" as const;

export type OabServiceType = "legal_fees" | "non_legal_services" | "digital_courses";

const BPS_BY_SERVICE: Record<OabServiceType, number> = {
  legal_fees: 0,
  non_legal_services: 1000,
  digital_courses: 1500,
};

/**
 * Seed idempotente de regras OAB-safe (orgId null = platform default).
 * Honorários advocatícios: 0%; serviços não jurídicos: 10%; digitais: 15%.
 */
export async function ensureOabMarketplaceSplitRules(db: AppDatabase): Promise<{
  created: number;
  ensured: number;
}> {
  let created = 0;
  let ensured = 0;

  for (const rule of MARKETPLACE_COMMISSION_RULES) {
    const serviceType = rule.category as OabServiceType;
    const platformKey = `oab_${serviceType}_platform`;
    const professionalKey = `oab_${serviceType}_professional`;

    for (const spec of [
      {
        key: platformKey,
        beneficiaryType: "platform" as const,
        calculationType: "percentage" as const,
        percentageBps: BPS_BY_SERVICE[serviceType],
        priority: 10,
      },
      {
        key: professionalKey,
        beneficiaryType: "professional" as const,
        calculationType: "remainder" as const,
        percentageBps: null as number | null,
        priority: 100,
      },
    ]) {
      const existing = await db.query.splitRules.findFirst({
        where: and(
          isNull(splitRules.organizationId),
          eq(splitRules.key, spec.key),
          eq(splitRules.productType, MARKETPLACE_SPLIT_PRODUCT_TYPE),
          eq(splitRules.status, "active"),
        ),
      });
      if (existing) {
        ensured += 1;
        continue;
      }
      await db.insert(splitRules).values({
        organizationId: null,
        key: spec.key,
        productType: MARKETPLACE_SPLIT_PRODUCT_TYPE,
        serviceType,
        beneficiaryType: spec.beneficiaryType,
        calculationType: spec.calculationType,
        percentageBps: spec.percentageBps,
        fixedAmountCents: null,
        priority: spec.priority,
        status: "active",
        version: 1,
        snapshotJson: {
          oabSafe: true,
          note: rule.note,
          commercialVersion: "2026-09",
          bps: BPS_BY_SERVICE[serviceType],
        },
      });
      created += 1;
      ensured += 1;
    }
  }

  return { created, ensured };
}

/**
 * Classifica engagement marketplace para split OAB-safe.
 * Default conservador: legal_fees (0% plataforma) — nunca cobrar honorários por engano.
 */
export async function resolveMarketplaceOabServiceType(
  db: AppDatabase,
  engagementId: string,
): Promise<{
  serviceType: OabServiceType;
  professionalBeneficiaryId: string | null;
  categoryKey: string | null;
}> {
  const engagement = await db.query.marketplaceEngagements.findFirst({
    where: eq(marketplaceEngagements.id, engagementId),
  });
  if (!engagement) {
    return { serviceType: "legal_fees", professionalBeneficiaryId: null, categoryKey: null };
  }

  const request = await db.query.marketplaceRequests.findFirst({
    where: eq(marketplaceRequests.id, engagement.requestId),
  });
  let categoryKey: string | null = null;
  let hasLegalArea = false;
  if (request?.categoryId) {
    const category = await db.query.marketplaceServiceCategories.findFirst({
      where: eq(marketplaceServiceCategories.id, request.categoryId),
    });
    categoryKey = category?.key ?? null;
    hasLegalArea = Boolean(category?.legalAreaId);
  }

  const key = (categoryKey ?? "").toLowerCase();
  let serviceType: OabServiceType = "legal_fees";
  if (
    key.includes("digital") ||
    key.includes("curso") ||
    key.includes("course") ||
    key.includes("educacao") ||
    key.includes("education")
  ) {
    serviceType = "digital_courses";
  } else if (
    key.includes("non_legal") ||
    key.includes("nao_juridico") ||
    key.includes("admin_service") ||
    (!hasLegalArea && key.includes("servico"))
  ) {
    serviceType = "non_legal_services";
  } else if (hasLegalArea || key.includes("jurid") || key.includes("legal") || !categoryKey) {
    serviceType = "legal_fees";
  }

  return {
    serviceType,
    professionalBeneficiaryId: engagement.professionalProfileId ?? null,
    categoryKey,
  };
}
