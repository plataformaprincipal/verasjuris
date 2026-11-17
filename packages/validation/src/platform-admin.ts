import { z } from "zod";
import { passwordSchema } from "./password-policy.js";

export const platformRoleKeySchema = z.enum([
  "SUPER_ADMIN",
  "ADMIN_OPERACIONAL",
  "ADMIN_FINANCEIRO",
  "SUPORTE",
  "MODERADOR",
  "ADMIN_COMERCIAL",
  "AUDITOR",
]);

export const createPlatformInviteSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(320)
    .transform((v) => v.toLowerCase()),
  roleKey: platformRoleKeySchema,
  note: z.string().trim().max(500).optional(),
  /** Dias até expirar; padrão 7. */
  expiresInDays: z.number().int().min(1).max(30).optional(),
});

export const activatePlatformInviteSchema = z.object({
  token: z.string().trim().min(20).max(200),
  password: passwordSchema,
  displayName: z.string().trim().min(2).max(120).optional(),
});

export const platformUserListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(["active", "pending_verification", "suspended", "disabled"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const updatePlatformUserStatusSchema = z.object({
  status: z.enum(["active", "suspended", "disabled"]),
  reason: z.string().trim().min(3).max(500),
});

export const updatePlatformOrgStatusSchema = z.object({
  status: z.enum(["active", "suspended"]),
  reason: z.string().trim().min(3).max(500),
});

export const platformAiSuspendSchema = z.object({
  suspended: z.boolean(),
  reason: z.string().trim().min(3).max(500),
});
