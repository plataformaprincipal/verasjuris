/**
 * Carrinho universal + pedidos comerciais (planos / créditos / módulos).
 * Preços sempre recalculados no servidor a partir de product_prices / catálogo.
 */
import { relations } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { organizations, users } from "./identity.js";
import { monetizationProducts } from "./monetization.js";
import { paymentIntents } from "./finance.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const commerceCarts = pgTable(
  "commerce_carts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("open"),
    ...timestamps,
  },
  (table) => [
    index("commerce_carts_org_user_idx").on(table.organizationId, table.userId),
    index("commerce_carts_user_idx").on(table.userId),
    index("commerce_carts_status_idx").on(table.status),
  ],
);

export const commerceCartItems = pgTable(
  "commerce_cart_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => commerceCarts.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    skuCode: text("sku_code").notNull(),
    productId: uuid("product_id").references(() => monetizationProducts.id, {
      onDelete: "set null",
    }),
    quantity: integer("quantity").notNull().default(1),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("commerce_cart_items_cart_sku_unique").on(table.cartId, table.skuCode),
    index("commerce_cart_items_org_idx").on(table.organizationId),
    index("commerce_cart_items_sku_idx").on(table.skuCode),
  ],
);

export const commerceOrders = pgTable(
  "commerce_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    cartId: uuid("cart_id").references(() => commerceCarts.id, { onDelete: "set null" }),
    status: text("status").notNull().default("pending_payment"),
    totalCents: bigint("total_cents", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("BRL"),
    paymentIntentId: uuid("payment_intent_id").references(() => paymentIntents.id, {
      onDelete: "set null",
    }),
    idempotencyKey: text("idempotency_key").notNull(),
    commercialVersion: text("commercial_version"),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    fulfilledAt: timestamp("fulfilled_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("commerce_orders_org_idempotency_unique").on(
      table.organizationId,
      table.idempotencyKey,
    ),
    index("commerce_orders_org_status_idx").on(table.organizationId, table.status),
    index("commerce_orders_payment_intent_idx").on(table.paymentIntentId),
  ],
);

export const commerceOrderItems = pgTable(
  "commerce_order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => commerceOrders.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    skuCode: text("sku_code").notNull(),
    productId: uuid("product_id").references(() => monetizationProducts.id, {
      onDelete: "set null",
    }),
    commercialType: text("commercial_type").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitAmountCents: bigint("unit_amount_cents", { mode: "number" }).notNull(),
    lineTotalCents: bigint("line_total_cents", { mode: "number" }).notNull(),
    creditsGranted: integer("credits_granted"),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (table) => [
    index("commerce_order_items_order_idx").on(table.orderId),
    index("commerce_order_items_sku_idx").on(table.skuCode),
  ],
);

/** Grants ativados pós-pagamento (fonte adicional ao billing_plan_features). */
export const organizationCommercialGrants = pgTable(
  "organization_commercial_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    skuCode: text("sku_code").notNull(),
    featureKey: text("feature_key").notNull(),
    limitType: text("limit_type").notNull(),
    limitValue: bigint("limit_value", { mode: "number" }),
    sourceOrderId: uuid("source_order_id").references(() => commerceOrders.id, {
      onDelete: "set null",
    }),
    sourcePaymentIntentId: uuid("source_payment_intent_id").references(() => paymentIntents.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("active"),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("org_commercial_grants_order_feature_unique").on(
      table.sourceOrderId,
      table.featureKey,
      table.skuCode,
    ),
    index("org_commercial_grants_org_feature_idx").on(table.organizationId, table.featureKey),
    index("org_commercial_grants_status_idx").on(table.status),
  ],
);

export const commerceCartsRelations = relations(commerceCarts, ({ many }) => ({
  items: many(commerceCartItems),
  orders: many(commerceOrders),
}));

export const commerceCartItemsRelations = relations(commerceCartItems, ({ one }) => ({
  cart: one(commerceCarts, {
    fields: [commerceCartItems.cartId],
    references: [commerceCarts.id],
  }),
  product: one(monetizationProducts, {
    fields: [commerceCartItems.productId],
    references: [monetizationProducts.id],
  }),
}));

export const commerceOrdersRelations = relations(commerceOrders, ({ one, many }) => ({
  cart: one(commerceCarts, {
    fields: [commerceOrders.cartId],
    references: [commerceCarts.id],
  }),
  items: many(commerceOrderItems),
  paymentIntent: one(paymentIntents, {
    fields: [commerceOrders.paymentIntentId],
    references: [paymentIntents.id],
  }),
}));

export const commerceOrderItemsRelations = relations(commerceOrderItems, ({ one }) => ({
  order: one(commerceOrders, {
    fields: [commerceOrderItems.orderId],
    references: [commerceOrders.id],
  }),
  product: one(monetizationProducts, {
    fields: [commerceOrderItems.productId],
    references: [monetizationProducts.id],
  }),
}));

export const organizationCommercialGrantsRelations = relations(
  organizationCommercialGrants,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationCommercialGrants.organizationId],
      references: [organizations.id],
    }),
    order: one(commerceOrders, {
      fields: [organizationCommercialGrants.sourceOrderId],
      references: [commerceOrders.id],
    }),
  }),
);

/* ─── Fase 6: serviços próprios SRV_* com marcos 30/70 ─── */

export const commerceServiceProjects = pgTable(
  "commerce_service_projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    requesterUserId: uuid("requester_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    skuCode: text("sku_code").notNull(),
    productId: uuid("product_id").references(() => monetizationProducts.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("proposed"),
    totalCents: bigint("total_cents", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("BRL"),
    requiresProposal: boolean("requires_proposal").notNull().default(false),
    notes: text("notes"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: "date" }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true, mode: "date" }),
    deliveryAcceptedAt: timestamp("delivery_accepted_at", { withTimezone: true, mode: "date" }),
    deliverySummary: text("delivery_summary"),
    deliveryArtifactUrl: text("delivery_artifact_url"),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (table) => [
    index("commerce_service_projects_org_idx").on(table.organizationId),
    index("commerce_service_projects_sku_idx").on(table.skuCode),
    index("commerce_service_projects_status_idx").on(table.status),
  ],
);

export const commerceServiceMilestones = pgTable(
  "commerce_service_milestones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => commerceServiceProjects.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    label: text("label").notNull(),
    pctBps: integer("pct_bps").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    status: text("status").notNull().default("pending"),
    paymentIntentId: uuid("payment_intent_id").references(() => paymentIntents.id, {
      onDelete: "set null",
    }),
    paidAt: timestamp("paid_at", { withTimezone: true, mode: "date" }),
    dueAt: timestamp("due_at", { withTimezone: true, mode: "date" }),
    sortOrder: integer("sort_order").notNull().default(10),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("commerce_service_milestones_project_kind_unique").on(table.projectId, table.kind),
    index("commerce_service_milestones_org_idx").on(table.organizationId),
    index("commerce_service_milestones_status_idx").on(table.status),
  ],
);

export const commerceServiceProjectsRelations = relations(commerceServiceProjects, ({ many }) => ({
  milestones: many(commerceServiceMilestones),
}));

export const commerceServiceMilestonesRelations = relations(
  commerceServiceMilestones,
  ({ one }) => ({
    project: one(commerceServiceProjects, {
      fields: [commerceServiceMilestones.projectId],
      references: [commerceServiceProjects.id],
    }),
    paymentIntent: one(paymentIntents, {
      fields: [commerceServiceMilestones.paymentIntentId],
      references: [paymentIntents.id],
    }),
  }),
);
