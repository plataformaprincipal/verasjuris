import { z } from "zod";

const uuid = z.string().uuid("O identificador não é válido.");

function stripControlChars(value: string): string {
  let out = "";
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127)) {
      out += char;
    }
  }
  return out;
}

const safeText = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .transform((v) => stripControlChars(v));

export const SOCIAL_VISIBILITIES = ["public", "connections", "private", "draft"] as const;
export const SOCIAL_FEED_MODES = ["for_you", "following", "recent", "saved"] as const;
export const SOCIAL_TREND_WINDOWS = ["24h", "7d", "30d"] as const;

export const createSocialPostSchema = z.object({
  body: safeText(1, 5000),
  visibility: z.enum(SOCIAL_VISIBILITIES).default("public"),
  legalCategory: z.string().trim().max(80).optional(),
  hashtags: z.string().trim().max(400).optional(),
  linkUrl: z
    .string()
    .url()
    .max(2000)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  status: z.enum(["published", "draft"]).default("published"),
});

export const updateSocialPostSchema = createSocialPostSchema.partial();

export const socialFeedQuerySchema = z.object({
  mode: z.enum(SOCIAL_FEED_MODES).default("recent"),
  legalCategory: z.string().trim().max(80).optional(),
  cursor: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const createSocialCommentSchema = z.object({
  body: safeText(1, 2000),
  parentCommentId: uuid.optional(),
});

export const updateSocialCommentSchema = z.object({
  body: safeText(1, 2000),
});

export const createSocialReportSchema = z.object({
  reasonCode: z.string().trim().min(2).max(80),
  description: safeText(5, 2000).optional(),
});

export const patchSocialProfileSchema = z.object({
  bio: safeText(0, 1000).optional(),
  headline: z.string().trim().max(160).optional(),
  practiceAreas: z.string().trim().max(400).optional(),
  locationLabel: z.string().trim().max(120).optional(),
  coverImageUrl: z.string().url().max(2000).optional().nullable(),
  avatarUrl: z.string().url().max(2000).optional().nullable(),
  profileVisibility: z.enum(["public", "connections", "private"]).optional(),
  whoCanFollow: z.enum(["everyone", "connections"]).optional(),
  whoCanMessage: z.enum(["everyone", "connections", "nobody"]).optional(),
  whoCanConnect: z.enum(["everyone", "nobody"]).optional(),
  showOrganization: z.boolean().optional(),
  marketplaceOptIn: z.boolean().optional(),
});

export const socialSearchPeopleSchema = z.object({
  q: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const socialTrendingQuerySchema = z.object({
  window: z.enum(SOCIAL_TREND_WINDOWS).default("7d"),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const socialNotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(30),
  unreadOnly: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => v === "true"),
});
