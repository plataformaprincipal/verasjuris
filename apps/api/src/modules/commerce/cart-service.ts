import { recordAudit } from "@verasjuris/audit";
import { policyMonetization, policyPaymentIntent, type SessionAccount } from "@verasjuris/auth";
import {
  commerceCartItems,
  commerceCarts,
  commerceOrderItems,
  commerceOrders,
  isUniqueViolation,
  monetizationProducts,
  type AppDatabase,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import {
  COMMERCIAL_VERSION,
  PURCHASABLE_COMMERCIAL_TYPES,
  getCommercialSku,
  type CheckoutCommerceCartInput,
} from "@verasjuris/validation";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { authorize, iso } from "../ai/shared.js";
import type { RequestMeta } from "../auth/service.js";
import type { CheckoutService } from "../finance/checkout-service.js";
import { ensureCommercialCatalogSeeded } from "./catalog-sync.js";

const PURCHASABLE = new Set<string>(PURCHASABLE_COMMERCIAL_TYPES);

function sanitizeText(value: string): string {
  return Array.from(value)
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      if (code === 0x09 || code === 0x0a || code === 0x0d) return true;
      return code >= 0x20 && code !== 0x7f;
    })
    .join("")
    .trim();
}

function paymentsLive(): boolean {
  return process.env.PAYMENTS_LIVE === "1";
}

function purchaseGate() {
  return {
    purchaseReady: false as const,
    paymentsLive: paymentsLive(),
    homologation: "NOT_HOMOLOGATED" as const,
    note: paymentsLive()
      ? "PAYMENTS_LIVE=1 — cobrança real ativa; catálogo comercial ainda marcado NOT_HOMOLOGATED."
      : "Sandbox/Asaas gated: PAYMENTS_LIVE≠1. Checkout cria intent sem liberar cobrança de produção.",
  };
}

async function ensureOpenCart(
  db: AppDatabase,
  organizationId: string,
  userId: string,
): Promise<typeof commerceCarts.$inferSelect> {
  const checkingOut = await db.query.commerceCarts.findFirst({
    where: and(
      eq(commerceCarts.organizationId, organizationId),
      eq(commerceCarts.userId, userId),
      eq(commerceCarts.status, "checking_out"),
    ),
    orderBy: asc(commerceCarts.createdAt),
  });
  if (checkingOut) return checkingOut;

  const existing = await db.query.commerceCarts.findFirst({
    where: and(
      eq(commerceCarts.organizationId, organizationId),
      eq(commerceCarts.userId, userId),
      eq(commerceCarts.status, "open"),
    ),
    orderBy: asc(commerceCarts.createdAt),
  });
  if (existing) return existing;

  const [created] = await db
    .insert(commerceCarts)
    .values({ organizationId, userId, status: "open" })
    .returning();
  return created!;
}

type PricedLine = {
  item: typeof commerceCartItems.$inferSelect;
  product: typeof monetizationProducts.$inferSelect;
  unitAmountCents: number;
  lineTotalCents: number;
  commercialType: string;
  creditsGranted: number | null;
  interval: string | null;
  checkoutEligible: boolean;
  rejectReason: string | null;
};

async function resolveCartLines(
  db: AppDatabase,
  cartId: string,
): Promise<{ lines: PricedLine[]; totalCents: number; checkoutReady: boolean }> {
  await ensureCommercialCatalogSeeded(db);
  const items = await db.query.commerceCartItems.findMany({
    where: eq(commerceCartItems.cartId, cartId),
    orderBy: asc(commerceCartItems.createdAt),
  });
  if (items.length === 0) {
    return { lines: [], totalCents: 0, checkoutReady: false };
  }

  const skus = items.map((i) => i.skuCode);
  const products = await db.query.monetizationProducts.findMany({
    where: inArray(monetizationProducts.key, skus),
    with: { prices: true },
  });
  const bySku = new Map(products.map((p) => [p.key, p]));

  const lines: PricedLine[] = [];
  let totalCents = 0;
  let checkoutReady = true;

  for (const item of items) {
    const product = bySku.get(item.skuCode);
    const def = getCommercialSku(item.skuCode);
    if (!product || !product.active) {
      checkoutReady = false;
      lines.push({
        item,
        product: product as typeof monetizationProducts.$inferSelect,
        unitAmountCents: 0,
        lineTotalCents: 0,
        commercialType: def?.commercialType ?? "unknown",
        creditsGranted: def?.creditsGranted ?? null,
        interval: null,
        checkoutEligible: false,
        rejectReason: "sku_not_found_or_inactive",
      });
      continue;
    }

    const commercialType = product.commercialType ?? def?.commercialType ?? product.productType;
    const meta = (product.metadataJson ?? {}) as Record<string, unknown>;
    const requiresProposal = meta.requiresProposal === true || def?.requiresProposal === true;
    const priceMode = (meta.priceMode as string | undefined) ?? def?.priceMode ?? "fixed";
    const activePrice = [...(product.prices ?? [])]
      .filter((p) => p.active)
      .sort((a, b) => b.version - a.version)[0];
    const unitAmountCents = activePrice?.amountCents ?? def?.amountCents ?? 0;
    const interval = activePrice?.interval ?? def?.interval ?? null;

    let rejectReason: string | null = null;
    if (!PURCHASABLE.has(commercialType)) {
      rejectReason = "commercial_type_not_purchasable";
    } else if (requiresProposal || priceMode === "proposal") {
      rejectReason = "requires_proposal";
    } else if (unitAmountCents <= 0) {
      rejectReason = "zero_or_missing_price";
    } else if (product.homologationStatus === "not_implemented") {
      rejectReason = "not_implemented";
    }

    const eligible = rejectReason == null;
    if (!eligible) checkoutReady = false;
    const lineTotalCents = eligible ? unitAmountCents * item.quantity : 0;
    if (eligible) totalCents += lineTotalCents;

    lines.push({
      item,
      product,
      unitAmountCents,
      lineTotalCents,
      commercialType,
      creditsGranted:
        typeof meta.creditsGranted === "number"
          ? meta.creditsGranted
          : (def?.creditsGranted ?? null),
      interval,
      checkoutEligible: eligible,
      rejectReason,
    });
  }

  return { lines, totalCents, checkoutReady: checkoutReady && totalCents > 0 };
}

function serializeCart(
  cart: typeof commerceCarts.$inferSelect,
  lines: PricedLine[],
  totalCents: number,
  checkoutReady: boolean,
) {
  return {
    cart: {
      id: cart.id,
      organizationId: cart.organizationId,
      userId: cart.userId,
      status: cart.status,
      createdAt: iso(cart.createdAt),
      updatedAt: iso(cart.updatedAt),
    },
    items: lines.map((line) => ({
      id: line.item.id,
      sku: line.item.skuCode,
      productId: line.product?.id ?? line.item.productId,
      name: line.product?.name ?? line.item.skuCode,
      quantity: line.item.quantity,
      notes: line.item.notes,
      unitAmountCents: line.unitAmountCents,
      lineTotalCents: line.lineTotalCents,
      currency: "BRL",
      commercialType: line.commercialType,
      interval: line.interval,
      creditsGranted: line.creditsGranted,
      checkoutEligible: line.checkoutEligible,
      rejectReason: line.rejectReason,
      homologationStatus: line.product?.homologationStatus ?? null,
    })),
    totalCents,
    currency: "BRL",
    checkoutReady,
    commercialVersion: COMMERCIAL_VERSION,
    ...purchaseGate(),
  };
}

export async function getCommerceCart(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  authorize(account, organizationId, (m) => policyMonetization(m, "monetization.read"));
  const cart = await ensureOpenCart(db, organizationId, account.user.id);
  const priced = await resolveCartLines(db, cart.id);
  return serializeCart(cart, priced.lines, priced.totalCents, priced.checkoutReady);
}

export async function addCommerceCartItem(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: { sku: string; quantity: number; notes?: string },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (m) => policyMonetization(m, "monetization.read"));
  await ensureCommercialCatalogSeeded(db);

  const sku = input.sku.trim().toUpperCase();
  const def = getCommercialSku(sku);
  const product = await db.query.monetizationProducts.findFirst({
    where: eq(monetizationProducts.key, sku),
  });
  if (!product || !product.active) {
    throw new AppError("NOT_FOUND", `SKU comercial não encontrado: ${sku}`);
  }
  const commercialType = product.commercialType ?? def?.commercialType ?? product.productType;
  if (!PURCHASABLE.has(commercialType)) {
    throw new AppError("VALIDATION_ERROR", "Este SKU não é comprável no carrinho universal.", [
      { path: "sku", message: "commercial_type_not_purchasable" },
    ]);
  }
  const requiresProposal =
    (product.metadataJson as Record<string, unknown>)?.requiresProposal === true ||
    def?.requiresProposal === true;
  const priceMode =
    ((product.metadataJson as Record<string, unknown>)?.priceMode as string | undefined) ??
    def?.priceMode;
  if (requiresProposal || priceMode === "proposal") {
    throw new AppError(
      "VALIDATION_ERROR",
      "SKU exige proposta — não entra no checkout self-serve.",
      [{ path: "sku", message: "requires_proposal" }],
    );
  }

  const cart = await ensureOpenCart(db, organizationId, account.user.id);
  if (cart.status !== "open") {
    throw new AppError(
      "CONFLICT",
      "Há um checkout em andamento neste carrinho. Aguarde a conclusão ou abra um novo fluxo.",
    );
  }

  const now = new Date();
  try {
    const existing = await db.query.commerceCartItems.findFirst({
      where: and(eq(commerceCartItems.cartId, cart.id), eq(commerceCartItems.skuCode, sku)),
    });
    if (existing) {
      const [updated] = await db
        .update(commerceCartItems)
        .set({
          quantity: Math.min(50, existing.quantity + input.quantity),
          notes: input.notes != null ? sanitizeText(input.notes) || null : existing.notes,
          productId: product.id,
          updatedAt: now,
        })
        .where(eq(commerceCartItems.id, existing.id))
        .returning();
      await recordAudit(db, {
        actorUserId: account.user.id,
        organizationId,
        action: "commerce.cart_item_updated",
        resourceType: "commerce_cart_item",
        resourceId: updated!.id,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
      });
    } else {
      const [created] = await db
        .insert(commerceCartItems)
        .values({
          cartId: cart.id,
          organizationId,
          skuCode: sku,
          productId: product.id,
          quantity: input.quantity,
          notes: input.notes ? sanitizeText(input.notes) || null : null,
        })
        .returning();
      await recordAudit(db, {
        actorUserId: account.user.id,
        organizationId,
        action: "commerce.cart_item_added",
        resourceType: "commerce_cart_item",
        resourceId: created!.id,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
      });
    }
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("CONFLICT", "Item já presente no carrinho.");
    }
    throw error;
  }

  return getCommerceCart(db, account, organizationId);
}

export async function updateCommerceCartItem(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  itemId: string,
  input: { quantity: number; notes?: string },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (m) => policyMonetization(m, "monetization.read"));
  const cart = await ensureOpenCart(db, organizationId, account.user.id);
  if (cart.status !== "open") {
    throw new AppError("CONFLICT", "Carrinho em checkout — itens bloqueados.");
  }
  const item = await db.query.commerceCartItems.findFirst({
    where: and(
      eq(commerceCartItems.id, itemId),
      eq(commerceCartItems.cartId, cart.id),
      eq(commerceCartItems.organizationId, organizationId),
    ),
  });
  if (!item) throw new AppError("NOT_FOUND", "Item do carrinho não encontrado.");

  await db
    .update(commerceCartItems)
    .set({
      quantity: input.quantity,
      notes: input.notes != null ? sanitizeText(input.notes) || null : item.notes,
      updatedAt: new Date(),
    })
    .where(eq(commerceCartItems.id, item.id));

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "commerce.cart_item_updated",
    resourceType: "commerce_cart_item",
    resourceId: item.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });

  return getCommerceCart(db, account, organizationId);
}

export async function removeCommerceCartItem(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  itemId: string,
  meta: RequestMeta,
) {
  authorize(account, organizationId, (m) => policyMonetization(m, "monetization.read"));
  const cart = await ensureOpenCart(db, organizationId, account.user.id);
  if (cart.status !== "open") {
    throw new AppError("CONFLICT", "Carrinho em checkout — itens bloqueados.");
  }
  const item = await db.query.commerceCartItems.findFirst({
    where: and(
      eq(commerceCartItems.id, itemId),
      eq(commerceCartItems.cartId, cart.id),
      eq(commerceCartItems.organizationId, organizationId),
    ),
  });
  if (!item) throw new AppError("NOT_FOUND", "Item do carrinho não encontrado.");

  await db.delete(commerceCartItems).where(eq(commerceCartItems.id, item.id));
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "commerce.cart_item_removed",
    resourceType: "commerce_cart_item",
    resourceId: item.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return getCommerceCart(db, account, organizationId);
}

export async function checkoutCommerceCart(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: CheckoutCommerceCartInput,
  meta: RequestMeta,
  checkoutService: CheckoutService,
) {
  authorize(account, organizationId, (m) => policyPaymentIntent(m, "finance.payment.read"));

  const existingOrder = await db.query.commerceOrders.findFirst({
    where: and(
      eq(commerceOrders.organizationId, organizationId),
      eq(commerceOrders.idempotencyKey, input.idempotencyKey),
    ),
  });
  if (existingOrder) {
    return {
      order: serializeOrder(existingOrder),
      alreadyExists: true as const,
      ...purchaseGate(),
    };
  }

  const cart = await ensureOpenCart(db, organizationId, account.user.id);
  if (cart.status === "checking_out") {
    throw new AppError("CONFLICT", "Checkout já em andamento para este carrinho.");
  }

  const priced = await resolveCartLines(db, cart.id);
  if (!priced.checkoutReady || priced.lines.length === 0) {
    throw new AppError("VALIDATION_ERROR", "Carrinho sem itens elegíveis para checkout.", [
      { path: "cart", message: "checkout_not_ready" },
    ]);
  }
  const ineligible = priced.lines.filter((l) => !l.checkoutEligible);
  if (ineligible.length > 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Remova itens inelegíveis: ${ineligible.map((l) => l.item.skuCode).join(", ")}`,
    );
  }

  await db
    .update(commerceCarts)
    .set({ status: "checking_out", updatedAt: new Date() })
    .where(eq(commerceCarts.id, cart.id));

  try {
    const [order] = await db
      .insert(commerceOrders)
      .values({
        organizationId,
        userId: account.user.id,
        cartId: cart.id,
        status: "pending_payment",
        totalCents: priced.totalCents,
        currency: "BRL",
        idempotencyKey: input.idempotencyKey,
        commercialVersion: COMMERCIAL_VERSION,
        metadataJson: {
          ...purchaseGate(),
          skuCodes: priced.lines.map((l) => l.item.skuCode),
        },
      })
      .returning();

    for (const line of priced.lines) {
      await db.insert(commerceOrderItems).values({
        orderId: order!.id,
        organizationId,
        skuCode: line.item.skuCode,
        productId: line.product.id,
        commercialType: line.commercialType,
        quantity: line.item.quantity,
        unitAmountCents: line.unitAmountCents,
        lineTotalCents: line.lineTotalCents,
        creditsGranted: line.creditsGranted,
        metadataJson: {
          interval: line.interval,
          homologationStatus: line.product.homologationStatus,
        },
      });
    }

    const checkout = await checkoutService.checkout(
      account,
      organizationId,
      {
        payerType: "organization",
        payerId: organizationId,
        referenceType: "commerce_order",
        referenceId: order!.id,
        amountCents: priced.totalCents,
        currency: "BRL",
        paymentMethod: input.paymentMethod,
        description:
          input.description ??
          `VerasJuris comercial — ${priced.lines.map((l) => l.item.skuCode).join(", ")}`,
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
        idempotencyKey: `commerce_order:${input.idempotencyKey}`,
        createInvoiceIfMissing: true,
        invoiceLines: priced.lines.map((line) => ({
          type: "other" as const,
          description: `${line.product.name} (${line.item.skuCode})`,
          quantity: line.item.quantity,
          unitAmountCents: line.unitAmountCents,
          totalAmountCents: line.lineTotalCents,
          referenceType: "commerce_sku",
          referenceId: line.product.id,
          metadata: { sku: line.item.skuCode, commercialType: line.commercialType },
        })),
        metadata: {
          commerceOrderId: order!.id,
          commercialVersion: COMMERCIAL_VERSION,
          homologation: "NOT_HOMOLOGATED",
          paymentsLive: paymentsLive() ? "1" : "0",
        },
      },
      meta,
    );

    const [updatedOrder] = await db
      .update(commerceOrders)
      .set({
        paymentIntentId: checkout.paymentIntent.id,
        updatedAt: new Date(),
        metadataJson: {
          ...((order!.metadataJson as Record<string, unknown>) ?? {}),
          paymentIntentId: checkout.paymentIntent.id,
          providerStatus: checkout.providerStatus,
          unavailable: checkout.unavailable,
        },
      })
      .where(eq(commerceOrders.id, order!.id))
      .returning();

    await recordAudit(db, {
      actorUserId: account.user.id,
      organizationId,
      action: "commerce.checkout_started",
      resourceType: "commerce_order",
      resourceId: order!.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: {
        totalCents: priced.totalCents,
        paymentIntentId: checkout.paymentIntent.id,
        unavailable: checkout.unavailable,
      },
    });

    return {
      order: serializeOrder(updatedOrder!),
      paymentIntent: checkout.paymentIntent,
      checkout: checkout.checkout,
      providerStatus: checkout.providerStatus,
      unavailable: checkout.unavailable,
      alreadyExists: false as const,
      ...purchaseGate(),
    };
  } catch (error) {
    await db
      .update(commerceCarts)
      .set({ status: "open", updatedAt: new Date() })
      .where(eq(commerceCarts.id, cart.id));
    throw error;
  }
}

export async function getCommerceOrder(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  orderId: string,
) {
  authorize(account, organizationId, (m) => policyMonetization(m, "monetization.read"));
  const order = await db.query.commerceOrders.findFirst({
    where: and(eq(commerceOrders.id, orderId), eq(commerceOrders.organizationId, organizationId)),
  });
  if (!order) throw new AppError("NOT_FOUND", "Pedido comercial não encontrado.");
  const items = await db.query.commerceOrderItems.findMany({
    where: eq(commerceOrderItems.orderId, order.id),
    orderBy: asc(commerceOrderItems.createdAt),
  });
  return {
    order: serializeOrder(order),
    items: items.map((item) => ({
      id: item.id,
      sku: item.skuCode,
      productId: item.productId,
      commercialType: item.commercialType,
      quantity: item.quantity,
      unitAmountCents: item.unitAmountCents,
      lineTotalCents: item.lineTotalCents,
      creditsGranted: item.creditsGranted,
    })),
    ...purchaseGate(),
  };
}

function serializeOrder(order: typeof commerceOrders.$inferSelect) {
  return {
    id: order.id,
    organizationId: order.organizationId,
    userId: order.userId,
    cartId: order.cartId,
    status: order.status,
    totalCents: order.totalCents,
    currency: order.currency,
    paymentIntentId: order.paymentIntentId,
    idempotencyKey: order.idempotencyKey,
    commercialVersion: order.commercialVersion,
    fulfilledAt: iso(order.fulfilledAt),
    createdAt: iso(order.createdAt),
    updatedAt: iso(order.updatedAt),
    metadata: order.metadataJson,
  };
}

export async function listRecentCommerceOrders(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  limit = 20,
) {
  authorize(account, organizationId, (m) => policyMonetization(m, "monetization.read"));
  const rows = await db.query.commerceOrders.findMany({
    where: eq(commerceOrders.organizationId, organizationId),
    orderBy: [desc(commerceOrders.createdAt)],
    limit: Math.min(100, Math.max(1, limit)),
  });
  return { orders: rows.map(serializeOrder), ...purchaseGate() };
}
