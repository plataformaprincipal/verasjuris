import {
  billingPlanFeatures,
  organizationCommercialGrants,
  subscriptions,
  type AppDatabase,
} from "@verasjuris/database";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";

const ACTIVE_SUBSCRIPTION_STATUSES = ["trialing", "active"] as const;

export type EntitlementLimitType =
  | "boolean"
  | "count"
  | "amount_cents"
  | "unlimited"
  | "storage"
  | "rate"
  | "credit"
  | "currency";

export type EntitlementCheck = {
  featureKey: string;
  allowed: boolean;
  limitType: EntitlementLimitType | null;
  limitValue: number | null;
  subscriptionId: string | null;
  planId: string | null;
  planVersionId: string | null;
  reason: string;
};

/**
 * Fonte única de feature gates por plano.
 * Nunca espalhar `plan === PRO` — sempre passar por aqui.
 * Limit types: boolean | count | amount_cents | unlimited | storage | rate | credit | currency.
 */
export class EntitlementService {
  constructor(private readonly db: AppDatabase) {}

  async getActiveSubscription(input: { organizationId?: string | null; userId?: string | null }) {
    const filters = [inArray(subscriptions.status, [...ACTIVE_SUBSCRIPTION_STATUSES])];
    if (input.organizationId) {
      filters.push(eq(subscriptions.organizationId, input.organizationId));
    } else if (input.userId) {
      filters.push(eq(subscriptions.userId, input.userId));
    } else {
      return null;
    }

    return this.db.query.subscriptions.findFirst({
      where: and(...filters),
      orderBy: [desc(subscriptions.createdAt)],
    });
  }

  async checkFeature(input: {
    organizationId?: string | null;
    userId?: string | null;
    featureKey: string;
  }): Promise<EntitlementCheck> {
    const subscription = await this.getActiveSubscription(input);
    const planCheck = subscription
      ? await this.checkPlanFeature(subscription, input.featureKey)
      : null;

    const grantCheck = input.organizationId
      ? await this.checkCommercialGrant(input.organizationId, input.featureKey)
      : null;

    // Additive: commercial grants after payment can unlock features beyond (or without) plan.
    if (planCheck?.allowed && grantCheck?.allowed) {
      return mergeEntitlementChecks(input.featureKey, planCheck, grantCheck);
    }
    if (planCheck?.allowed) return planCheck;
    if (grantCheck?.allowed) return grantCheck;

    if (planCheck) return planCheck;
    if (grantCheck) return grantCheck;

    return {
      featureKey: input.featureKey,
      allowed: false,
      limitType: null,
      limitValue: null,
      subscriptionId: null,
      planId: null,
      planVersionId: null,
      reason: "no_active_subscription",
    };
  }

  private async checkPlanFeature(
    subscription: typeof subscriptions.$inferSelect,
    featureKey: string,
  ): Promise<EntitlementCheck> {
    const feature = await this.db.query.billingPlanFeatures.findFirst({
      where: and(
        eq(billingPlanFeatures.planId, subscription.planId),
        eq(billingPlanFeatures.featureKey, featureKey),
        or(
          eq(billingPlanFeatures.planVersionId, subscription.planVersionId),
          isNull(billingPlanFeatures.planVersionId),
        ),
      ),
      orderBy: [desc(billingPlanFeatures.createdAt)],
    });

    if (!feature) {
      return {
        featureKey,
        allowed: false,
        limitType: null,
        limitValue: null,
        subscriptionId: subscription.id,
        planId: subscription.planId,
        planVersionId: subscription.planVersionId,
        reason: "feature_not_in_plan",
      };
    }

    const limitType = feature.limitType as EntitlementLimitType;

    if (limitType === "boolean") {
      const allowed = feature.limitValue === null || feature.limitValue > 0;
      return {
        featureKey,
        allowed,
        limitType,
        limitValue: feature.limitValue,
        subscriptionId: subscription.id,
        planId: subscription.planId,
        planVersionId: subscription.planVersionId,
        reason: allowed ? "ok" : "boolean_disabled",
      };
    }

    if (limitType === "unlimited") {
      return {
        featureKey,
        allowed: true,
        limitType,
        limitValue: null,
        subscriptionId: subscription.id,
        planId: subscription.planId,
        planVersionId: subscription.planVersionId,
        reason: "ok",
      };
    }

    return {
      featureKey,
      allowed: true,
      limitType,
      limitValue: feature.limitValue,
      subscriptionId: subscription.id,
      planId: subscription.planId,
      planVersionId: subscription.planVersionId,
      reason: "ok_with_limit",
    };
  }

  private async checkCommercialGrant(
    organizationId: string,
    featureKey: string,
  ): Promise<EntitlementCheck | null> {
    const now = new Date();
    const grant = await this.db.query.organizationCommercialGrants.findFirst({
      where: and(
        eq(organizationCommercialGrants.organizationId, organizationId),
        eq(organizationCommercialGrants.featureKey, featureKey),
        eq(organizationCommercialGrants.status, "active"),
        eq(organizationCommercialGrants.active, true),
        or(
          isNull(organizationCommercialGrants.expiresAt),
          sql`${organizationCommercialGrants.expiresAt} > ${now}`,
        ),
      ),
      orderBy: [desc(organizationCommercialGrants.createdAt)],
    });
    if (!grant) return null;

    const limitType = grant.limitType as EntitlementLimitType;
    if (limitType === "boolean") {
      const allowed = grant.limitValue === null || grant.limitValue > 0;
      return {
        featureKey,
        allowed,
        limitType,
        limitValue: grant.limitValue,
        subscriptionId: null,
        planId: null,
        planVersionId: null,
        reason: allowed ? "commercial_grant_ok" : "commercial_grant_disabled",
      };
    }
    if (limitType === "unlimited") {
      return {
        featureKey,
        allowed: true,
        limitType,
        limitValue: null,
        subscriptionId: null,
        planId: null,
        planVersionId: null,
        reason: "commercial_grant_ok",
      };
    }
    return {
      featureKey,
      allowed: true,
      limitType,
      limitValue: grant.limitValue,
      subscriptionId: null,
      planId: null,
      planVersionId: null,
      reason: "commercial_grant_ok_with_limit",
    };
  }

  /**
   * Convenience: check numeric quota (count/storage/rate/credit/currency/amount_cents).
   * Owners are never blocked solely by seat/member quotas (caller must pass isOwner).
   */
  async checkQuota(input: {
    organizationId?: string | null;
    userId?: string | null;
    featureKey: string;
    currentUsage: number;
    isOwner?: boolean;
  }): Promise<EntitlementCheck & { remaining: number | null; exceeded: boolean }> {
    const base = await this.checkFeature(input);
    if (!base.allowed) {
      return { ...base, remaining: null, exceeded: true };
    }
    if (base.limitType === "unlimited" || base.limitType === "boolean") {
      return { ...base, remaining: null, exceeded: false };
    }
    if (base.limitValue === null) {
      return { ...base, remaining: null, exceeded: false };
    }
    // Seat/member entitlements must not lock out organization owners.
    if (input.isOwner && (input.featureKey === "seats" || input.featureKey === "users")) {
      return {
        ...base,
        remaining: Math.max(0, base.limitValue - input.currentUsage),
        exceeded: false,
        reason: "owner_exempt_from_seat_block",
      };
    }
    const remaining = base.limitValue - input.currentUsage;
    const exceeded = remaining < 0;
    return {
      ...base,
      remaining: Math.max(0, remaining),
      exceeded,
      allowed: !exceeded,
      reason: exceeded ? "quota_exceeded" : base.reason,
    };
  }

  async listPlanFeatures(planId: string, planVersionId?: string | null) {
    return this.db.query.billingPlanFeatures.findMany({
      where: and(
        eq(billingPlanFeatures.planId, planId),
        planVersionId
          ? or(
              eq(billingPlanFeatures.planVersionId, planVersionId),
              isNull(billingPlanFeatures.planVersionId),
            )
          : undefined,
      ),
    });
  }
}

/** Prefer unlimited / higher numeric limit when plan + commercial grant both apply. */
function mergeEntitlementChecks(
  featureKey: string,
  plan: EntitlementCheck,
  grant: EntitlementCheck,
): EntitlementCheck {
  if (plan.limitType === "unlimited" || grant.limitType === "unlimited") {
    return {
      ...plan,
      featureKey,
      allowed: true,
      limitType: "unlimited",
      limitValue: null,
      reason: "ok_merged_unlimited",
    };
  }
  const planVal = plan.limitValue ?? 0;
  const grantVal = grant.limitValue ?? 0;
  const useGrant = grantVal > planVal;
  return {
    ...(useGrant ? grant : plan),
    featureKey,
    allowed: true,
    subscriptionId: plan.subscriptionId,
    planId: plan.planId,
    planVersionId: plan.planVersionId,
    reason: "ok_merged_max_limit",
  };
}
