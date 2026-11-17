import { z } from "zod";

const uuid = z.string().uuid();
const positiveQty = z.coerce.number().int().min(1).max(50);

export const PURCHASABLE_COMMERCIAL_TYPES = [
  "plan",
  "addon",
  "ai_credit_pack",
  "ai_module",
  "marketplace_fee",
] as const;

export const addCommerceCartItemSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[A-Z0-9_]+$/i, "SKU inválido."),
  quantity: positiveQty.default(1),
  notes: z.string().trim().max(500).optional(),
});

export const updateCommerceCartItemSchema = z.object({
  quantity: positiveQty,
  notes: z.string().trim().max(500).optional(),
});

export const checkoutCommerceCartSchema = z.object({
  paymentMethod: z.enum(["pix", "credit_card", "boleto", "other"]).default("pix"),
  successUrl: z.string().url().max(2000),
  cancelUrl: z.string().url().max(2000),
  idempotencyKey: z.string().trim().min(8).max(120),
  description: z.string().trim().max(500).optional(),
});

export type AddCommerceCartItemInput = z.infer<typeof addCommerceCartItemSchema>;
export type UpdateCommerceCartItemInput = z.infer<typeof updateCommerceCartItemSchema>;
export type CheckoutCommerceCartInput = z.infer<typeof checkoutCommerceCartSchema>;

export const commerceOrderIdSchema = uuid;
