import { aiCreditTransactions, aiCreditWallets, type AppDatabase } from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { creditsForAiFeature, resolveAiModuleForFeature } from "@verasjuris/validation";
import { and, eq, gte, sql } from "drizzle-orm";
import { EntitlementService } from "../finance/entitlement-service.js";

export type AiCreditGateResult = {
  feature: string;
  moduleSku: string | null;
  creditsCharged: number;
  source: "franchise" | "wallet" | "waived" | "skipped_unmapped";
  transactionId: string | null;
  enforcement: {
    moduleGates: boolean;
    creditBilling: boolean;
  };
};

function moduleGatesEnabled(): boolean {
  return process.env.FEATURE_AI_MODULE_GATES === "1";
}

function creditBillingEnabled(): boolean {
  // Default on: purchased credits / franchise must be respected when present.
  // Set FEATURE_AI_CREDIT_BILLING=0 only for emergency bypass (still NOT live payments).
  return process.env.FEATURE_AI_CREDIT_BILLING !== "0";
}

function monthStartUtc(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

async function ensureOrgWallet(db: AppDatabase, organizationId: string) {
  const existing = await db.query.aiCreditWallets.findFirst({
    where: eq(aiCreditWallets.organizationId, organizationId),
  });
  if (existing) return existing;
  const [created] = await db
    .insert(aiCreditWallets)
    .values({
      organizationId,
      userId: null,
      currencyLabel: "credit",
      balanceCredits: 0,
    })
    .returning();
  return created!;
}

async function monthlyConsumptionCredits(
  db: AppDatabase,
  walletId: string,
  since: Date,
): Promise<number> {
  const [row] = await db
    .select({
      total: sql<string>`coalesce(sum(${aiCreditTransactions.amountCredits}), 0)::text`,
    })
    .from(aiCreditTransactions)
    .where(
      and(
        eq(aiCreditTransactions.walletId, walletId),
        eq(aiCreditTransactions.type, "consumption"),
        gte(aiCreditTransactions.createdAt, since),
      ),
    );
  return Number(row?.total ?? 0);
}

/**
 * Gate Fase 5: módulo comercial + franquia/créditos antes da chamada de IA.
 * Idempotente por `idempotencyKey` quando fornecida.
 */
export async function assertAndConsumeAiCredits(
  db: AppDatabase,
  input: {
    organizationId: string;
    feature: string;
    idempotencyKey?: string | null;
    actorUserId?: string | null;
  },
): Promise<AiCreditGateResult> {
  const gates = moduleGatesEnabled();
  const billing = creditBillingEnabled();
  const binding = resolveAiModuleForFeature(input.feature);
  const credits = creditsForAiFeature(input.feature);
  const entitlements = new EntitlementService(db);

  if (binding) {
    const moduleCheck = await entitlements.checkFeature({
      organizationId: input.organizationId,
      featureKey: binding.entitlementKey,
    });
    const hasModule = moduleCheck.allowed;

    if (!hasModule && !binding.allowPlanFranchise) {
      if (gates) {
        throw new AppError(
          "AUTHORIZATION_ERROR",
          `Módulo ${binding.sku} não está ativo nesta organização. Adquira o módulo no catálogo comercial.`,
          [{ path: "feature", message: binding.entitlementKey }],
        );
      }
    }

    if (!hasModule && binding.allowPlanFranchise) {
      const franchise = await entitlements.checkFeature({
        organizationId: input.organizationId,
        featureKey: "ai.credits_monthly",
      });
      const light = await entitlements.checkFeature({
        organizationId: input.organizationId,
        featureKey: "ai.light_ops_monthly",
      });
      if (!franchise.allowed && !light.allowed && gates) {
        throw new AppError("AUTHORIZATION_ERROR", `Sem franquia de IA nem módulo ${binding.sku}.`, [
          { path: "feature", message: binding.entitlementKey },
        ]);
      }
    }
  }

  if (!billing) {
    return {
      feature: input.feature,
      moduleSku: binding?.sku ?? null,
      creditsCharged: 0,
      source: "waived",
      transactionId: null,
      enforcement: { moduleGates: gates, creditBilling: billing },
    };
  }

  if (!binding && process.env.FEATURE_AI_CREDIT_UNMAPPED !== "1") {
    // Features sem binding: não bloqueia; não cobra até mapeamento explícito.
    return {
      feature: input.feature,
      moduleSku: null,
      creditsCharged: 0,
      source: "skipped_unmapped",
      transactionId: null,
      enforcement: { moduleGates: gates, creditBilling: billing },
    };
  }

  const wallet = await ensureOrgWallet(db, input.organizationId);
  const idempotencyKey =
    input.idempotencyKey?.trim() ||
    `ai_consume:${input.organizationId}:${input.feature}:${Date.now()}`;

  const existing = await db.query.aiCreditTransactions.findFirst({
    where: and(
      eq(aiCreditTransactions.walletId, wallet.id),
      eq(aiCreditTransactions.idempotencyKey, idempotencyKey),
    ),
  });
  if (existing) {
    return {
      feature: input.feature,
      moduleSku: binding?.sku ?? null,
      creditsCharged: existing.amountCredits,
      source: existing.sourceType === "franchise" ? "franchise" : "wallet",
      transactionId: existing.id,
      enforcement: { moduleGates: gates, creditBilling: billing },
    };
  }

  // Franquia mensal do plano (se existir).
  const franchiseEntitlement = await entitlements.checkFeature({
    organizationId: input.organizationId,
    featureKey: "ai.credits_monthly",
  });
  const lightEntitlement = await entitlements.checkFeature({
    organizationId: input.organizationId,
    featureKey: "ai.light_ops_monthly",
  });
  const franchiseLimit =
    franchiseEntitlement.allowed && franchiseEntitlement.limitValue != null
      ? franchiseEntitlement.limitValue
      : lightEntitlement.allowed && lightEntitlement.limitValue != null
        ? lightEntitlement.limitValue
        : null;

  const usedThisMonth = await monthlyConsumptionCredits(db, wallet.id, monthStartUtc());
  const franchiseRemaining =
    franchiseLimit != null ? Math.max(0, franchiseLimit - usedThisMonth) : 0;

  if (franchiseRemaining >= credits) {
    const [tx] = await db
      .insert(aiCreditTransactions)
      .values({
        walletId: wallet.id,
        type: "consumption",
        amountCredits: credits,
        balanceAfterCredits: wallet.balanceCredits,
        reason: `Franquia IA — ${input.feature}`,
        sourceType: "franchise",
        sourceId: null,
        featureKey: input.feature,
        idempotencyKey,
      })
      .returning();
    return {
      feature: input.feature,
      moduleSku: binding?.sku ?? null,
      creditsCharged: credits,
      source: "franchise",
      transactionId: tx?.id ?? null,
      enforcement: { moduleGates: gates, creditBilling: billing },
    };
  }

  if (wallet.balanceCredits < credits) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Créditos de IA insuficientes. Compre um pack CREDITS_* ou aguarde a renovação da franquia.",
      [{ path: "credits", message: "insufficient_ai_credit_balance" }],
    );
  }

  const nextBalance = wallet.balanceCredits - credits;
  const [tx] = await db
    .insert(aiCreditTransactions)
    .values({
      walletId: wallet.id,
      type: "consumption",
      amountCredits: credits,
      balanceAfterCredits: nextBalance,
      reason: `Consumo IA — ${input.feature}`,
      sourceType: "ai_gateway",
      sourceId: null,
      featureKey: input.feature,
      idempotencyKey,
    })
    .returning();

  await db
    .update(aiCreditWallets)
    .set({ balanceCredits: nextBalance, updatedAt: new Date() })
    .where(eq(aiCreditWallets.id, wallet.id));

  return {
    feature: input.feature,
    moduleSku: binding?.sku ?? null,
    creditsCharged: credits,
    source: "wallet",
    transactionId: tx?.id ?? null,
    enforcement: { moduleGates: gates, creditBilling: billing },
  };
}
