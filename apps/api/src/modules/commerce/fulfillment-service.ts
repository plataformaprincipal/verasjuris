import { recordAudit } from "@verasjuris/audit";
import {
  aiCreditTransactions,
  aiCreditWallets,
  commerceCarts,
  commerceOrderItems,
  commerceOrders,
  commercialEntitlements,
  isUniqueViolation,
  monetizationProducts,
  organizationCommercialGrants,
  paymentIntents,
  type AppDatabase,
} from "@verasjuris/database";
import { getCommercialSku } from "@verasjuris/validation";
import { and, eq } from "drizzle-orm";

export type CommerceFulfillmentResult = {
  orderId: string;
  alreadyFulfilled: boolean;
  grantsCreated: number;
  creditsGranted: number;
  skus: string[];
};

/**
 * Entitlement engine pós-pagamento (Fase 3).
 * Idempotente por commerce_order.status / grants únicos por (order, sku, feature).
 */
export async function fulfillCommerceOrderOnPayment(
  db: AppDatabase,
  input: {
    organizationId: string;
    orderId: string;
    paymentIntentId: string;
  },
): Promise<CommerceFulfillmentResult> {
  const order = await db.query.commerceOrders.findFirst({
    where: and(
      eq(commerceOrders.id, input.orderId),
      eq(commerceOrders.organizationId, input.organizationId),
    ),
  });
  if (!order) {
    return {
      orderId: input.orderId,
      alreadyFulfilled: false,
      grantsCreated: 0,
      creditsGranted: 0,
      skus: [],
    };
  }
  if (order.status === "paid" && order.fulfilledAt) {
    return {
      orderId: order.id,
      alreadyFulfilled: true,
      grantsCreated: 0,
      creditsGranted: 0,
      skus: [],
    };
  }

  const items = await db.query.commerceOrderItems.findMany({
    where: eq(commerceOrderItems.orderId, order.id),
  });

  const paymentIntent = await db.query.paymentIntents.findFirst({
    where: eq(paymentIntents.id, input.paymentIntentId),
  });
  const paymentIntentId = paymentIntent?.id ?? null;

  let grantsCreated = 0;
  let creditsGranted = 0;
  const skus: string[] = [];

  for (const item of items) {
    skus.push(item.skuCode);
    const def = getCommercialSku(item.skuCode);
    const product = item.productId
      ? await db.query.monetizationProducts.findFirst({
          where: eq(monetizationProducts.id, item.productId),
        })
      : await db.query.monetizationProducts.findFirst({
          where: eq(monetizationProducts.key, item.skuCode),
        });

    const commercialType =
      item.commercialType || product?.commercialType || def?.commercialType || "other";

    if (commercialType === "ai_credit_pack") {
      const packCredits =
        item.creditsGranted ??
        def?.creditsGranted ??
        (typeof (product?.metadataJson as Record<string, unknown> | undefined)?.creditsGranted ===
        "number"
          ? ((product!.metadataJson as Record<string, unknown>).creditsGranted as number)
          : 0);
      if (packCredits > 0) {
        const granted = await grantAiCreditsPurchase(db, {
          organizationId: input.organizationId,
          amountCredits: packCredits * item.quantity,
          sourceId: order.id,
          idempotencyKey: `commerce_order:${order.id}:${item.skuCode}:credits`,
          reason: `Compra ${item.skuCode}`,
        });
        if (!granted.alreadyExists) creditsGranted += packCredits * item.quantity;
      }
    }

    // Planos / addons / módulos → grants de feature (additive ao EntitlementService).
    if (
      commercialType === "plan" ||
      commercialType === "addon" ||
      commercialType === "ai_module" ||
      commercialType === "marketplace_fee"
    ) {
      const entitlements = await db.query.commercialEntitlements.findMany({
        where: and(
          eq(commercialEntitlements.skuCode, item.skuCode),
          eq(commercialEntitlements.active, true),
        ),
      });
      const fallback = def?.entitlements ?? [];
      const defs =
        entitlements.length > 0
          ? entitlements.map((e) => ({
              featureKey: e.featureKey,
              limitType: e.limitType,
              limitValue: e.limitValue,
            }))
          : fallback.map((e) => ({
              featureKey: e.featureKey,
              limitType: e.limitType,
              limitValue: e.limitValue ?? null,
            }));

      for (const ent of defs) {
        try {
          const [row] = await db
            .insert(organizationCommercialGrants)
            .values({
              organizationId: input.organizationId,
              skuCode: item.skuCode,
              featureKey: ent.featureKey,
              limitType: ent.limitType,
              limitValue: ent.limitValue ?? null,
              sourceOrderId: order.id,
              sourcePaymentIntentId: paymentIntentId,
              status: "active",
              active: true,
            })
            .returning();
          if (row) grantsCreated += 1;
        } catch (error) {
          if (!isUniqueViolation(error)) throw error;
        }
      }
    }
  }

  await db
    .update(commerceOrders)
    .set({
      status: "paid",
      fulfilledAt: new Date(),
      ...(paymentIntentId ? { paymentIntentId } : {}),
      updatedAt: new Date(),
    })
    .where(eq(commerceOrders.id, order.id));

  if (order.cartId) {
    await db
      .update(commerceCarts)
      .set({ status: "converted", updatedAt: new Date() })
      .where(eq(commerceCarts.id, order.cartId));
  }

  await recordAudit(db, {
    actorUserId: order.userId,
    organizationId: input.organizationId,
    action: "commerce.order_fulfilled",
    resourceType: "commerce_order",
    resourceId: order.id,
    source: "system",
    after: { grantsCreated, creditsGranted, skus, paymentIntentId: input.paymentIntentId },
  });

  return {
    orderId: order.id,
    alreadyFulfilled: false,
    grantsCreated,
    creditsGranted,
    skus,
  };
}

async function grantAiCreditsPurchase(
  db: AppDatabase,
  input: {
    organizationId: string;
    amountCredits: number;
    sourceId: string;
    idempotencyKey: string;
    reason: string;
  },
) {
  let wallet = await db.query.aiCreditWallets.findFirst({
    where: eq(aiCreditWallets.organizationId, input.organizationId),
  });
  if (!wallet) {
    const [created] = await db
      .insert(aiCreditWallets)
      .values({
        organizationId: input.organizationId,
        userId: null,
        currencyLabel: "credit",
        balanceCredits: 0,
      })
      .returning();
    wallet = created!;
  }

  const existing = await db.query.aiCreditTransactions.findFirst({
    where: and(
      eq(aiCreditTransactions.walletId, wallet.id),
      eq(aiCreditTransactions.idempotencyKey, input.idempotencyKey),
    ),
  });
  if (existing) {
    return { alreadyExists: true as const, wallet };
  }

  const nextBalance = wallet.balanceCredits + input.amountCredits;
  await db.insert(aiCreditTransactions).values({
    walletId: wallet.id,
    type: "purchase",
    amountCredits: input.amountCredits,
    balanceAfterCredits: nextBalance,
    reason: input.reason,
    sourceType: "commerce_order",
    sourceId: input.sourceId,
    idempotencyKey: input.idempotencyKey,
  });
  await db
    .update(aiCreditWallets)
    .set({ balanceCredits: nextBalance, updatedAt: new Date() })
    .where(eq(aiCreditWallets.id, wallet.id));

  return { alreadyExists: false as const, wallet };
}
