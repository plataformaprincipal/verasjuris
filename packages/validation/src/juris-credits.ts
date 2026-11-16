import { z } from "zod";

export const ensureInitialWorkCreditsSchema = z.object({}).strict();

export const adjustWorkCreditsSchema = z.object({
  quantity: z.number().int().positive().max(10_000),
  reason: z.string().trim().min(3).max(500),
  idempotencyKey: z.string().trim().min(8).max(200),
  direction: z.enum(["credit", "debit"]).default("credit"),
});
