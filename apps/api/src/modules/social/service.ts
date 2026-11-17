import { recordAudit } from "@verasjuris/audit";
import type { SessionAccount } from "@verasjuris/auth";
import {
  isUniqueViolation,
  lawyerProfiles,
  professionalProfiles,
  profiles,
  socialBlocks,
  socialBookmarks,
  socialComments,
  socialConnections,
  socialFollows,
  socialHides,
  socialNotifications,
  socialPostLikes,
  socialPosts,
  socialProfiles,
  socialReports,
  socialReposts,
  type AppDatabase,
} from "@verasjuris/database";
import type { MemoryRateLimiter } from "@verasjuris/security";
import { AppError } from "@verasjuris/types";
import { and, desc, eq, ilike, inArray, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { escapeLike, iso } from "../ai/shared.js";
import type { RequestMeta } from "../auth/service.js";

type DbTx = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];

export type SocialModuleDeps = {
  rateLimiter?: MemoryRateLimiter;
};

const SCORE_LIKE = 3;
const SCORE_COMMENT = 5;
const SCORE_REPOST = 4;

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

function consumeRateLimit(deps: SocialModuleDeps | undefined, key: string, label: string) {
  if (!deps?.rateLimiter) return;
  const result = deps.rateLimiter.consume(key, 30, 60_000);
  if (!result.allowed) {
    throw new AppError(
      "RATE_LIMIT",
      `Muitas tentativas de ${label}. Aguarde ${result.retryAfterSeconds}s e tente novamente.`,
    );
  }
}

export async function ensureSocialProfile(db: AppDatabase | DbTx, userId: string) {
  await db.insert(socialProfiles).values({ userId }).onConflictDoNothing();
  const row = await db.query.socialProfiles.findFirst({
    where: eq(socialProfiles.userId, userId),
  });
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o perfil social.");
  return row;
}

export async function publicAuthorProjection(db: AppDatabase | DbTx, userId: string) {
  const [identity, social, professional, lawyer] = await Promise.all([
    db.query.profiles.findFirst({ where: eq(profiles.userId, userId) }),
    db.query.socialProfiles.findFirst({ where: eq(socialProfiles.userId, userId) }),
    db.query.professionalProfiles.findFirst({
      where: eq(professionalProfiles.userId, userId),
    }),
    db.query.lawyerProfiles.findFirst({ where: eq(lawyerProfiles.userId, userId) }),
  ]);

  const verificationStatus = professional?.verificationStatus ?? "not_submitted";
  const oabVerificationStatus = lawyer?.oabVerificationStatus ?? null;

  return {
    userId,
    displayName: identity?.displayName ?? "Usuário",
    headline: social?.headline ?? lawyer?.marketplaceHeadline ?? null,
    avatarUrl: social?.avatarUrl ?? null,
    locationLabel: social?.locationLabel ?? null,
    practiceAreas: social?.practiceAreas ?? lawyer?.practiceAreas ?? null,
    verificationStatus,
    oabVerificationStatus,
    verified: verificationStatus === "verified" || oabVerificationStatus === "verified",
  };
}

async function notify(
  db: AppDatabase | DbTx,
  input: {
    userId: string;
    actorUserId: string | null;
    type: string;
    postId?: string | null;
    commentId?: string | null;
    body: string;
  },
) {
  if (input.actorUserId && input.actorUserId === input.userId) return;
  await db.insert(socialNotifications).values({
    userId: input.userId,
    actorUserId: input.actorUserId,
    type: input.type,
    postId: input.postId ?? null,
    commentId: input.commentId ?? null,
    body: sanitizeText(input.body).slice(0, 500),
  });
}

function serializeSocialProfile(row: typeof socialProfiles.$inferSelect) {
  return {
    userId: row.userId,
    bio: row.bio,
    headline: row.headline,
    practiceAreas: row.practiceAreas,
    locationLabel: row.locationLabel,
    coverImageUrl: row.coverImageUrl,
    avatarUrl: row.avatarUrl,
    profileVisibility: row.profileVisibility,
    whoCanFollow: row.whoCanFollow,
    whoCanMessage: row.whoCanMessage,
    whoCanConnect: row.whoCanConnect,
    showOrganization: row.showOrganization,
    marketplaceOptIn: row.marketplaceOptIn,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

async function serializePost(
  db: AppDatabase | DbTx,
  row: typeof socialPosts.$inferSelect,
  viewerUserId?: string | null,
) {
  const author = await publicAuthorProjection(db, row.authorUserId);
  let likedByMe = false;
  let bookmarkedByMe = false;
  let repostedByMe = false;
  if (viewerUserId) {
    const [like, bookmark, repost] = await Promise.all([
      db.query.socialPostLikes.findFirst({
        where: and(eq(socialPostLikes.postId, row.id), eq(socialPostLikes.userId, viewerUserId)),
      }),
      db.query.socialBookmarks.findFirst({
        where: and(eq(socialBookmarks.postId, row.id), eq(socialBookmarks.userId, viewerUserId)),
      }),
      db.query.socialReposts.findFirst({
        where: and(eq(socialReposts.postId, row.id), eq(socialReposts.userId, viewerUserId)),
      }),
    ]);
    likedByMe = Boolean(like);
    bookmarkedByMe = Boolean(bookmark);
    repostedByMe = Boolean(repost);
  }
  return {
    id: row.id,
    authorUserId: row.authorUserId,
    organizationId: row.organizationId,
    body: row.body,
    visibility: row.visibility,
    status: row.status,
    legalCategory: row.legalCategory,
    hashtags: row.hashtags,
    linkUrl: row.linkUrl,
    likeCount: row.likeCount,
    commentCount: row.commentCount,
    repostCount: row.repostCount,
    bookmarkCount: row.bookmarkCount,
    score24h: row.score24h,
    score7d: row.score7d,
    publishedAt: iso(row.publishedAt),
    archivedAt: iso(row.archivedAt),
    deletedAt: iso(row.deletedAt),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    likedByMe,
    bookmarkedByMe,
    repostedByMe,
    author,
  };
}

function serializeComment(
  row: typeof socialComments.$inferSelect,
  author: Awaited<ReturnType<typeof publicAuthorProjection>>,
) {
  return {
    id: row.id,
    postId: row.postId,
    authorUserId: row.authorUserId,
    parentCommentId: row.parentCommentId,
    body: row.deletedAt ? null : row.body,
    deletedAt: iso(row.deletedAt),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    author,
  };
}

async function requirePost(
  db: AppDatabase | DbTx,
  postId: string,
  opts?: { allowDeleted?: boolean },
) {
  const row = await db.query.socialPosts.findFirst({
    where: eq(socialPosts.id, postId),
  });
  if (!row || (!opts?.allowDeleted && row.deletedAt)) {
    throw new AppError("NOT_FOUND", "Não encontramos esta publicação.");
  }
  return row;
}

async function viewerBlockSet(db: AppDatabase | DbTx, viewerUserId: string) {
  const rows = await db
    .select({
      blockerUserId: socialBlocks.blockerUserId,
      blockedUserId: socialBlocks.blockedUserId,
    })
    .from(socialBlocks)
    .where(
      or(
        eq(socialBlocks.blockerUserId, viewerUserId),
        eq(socialBlocks.blockedUserId, viewerUserId),
      ),
    );
  const blocked = new Set<string>();
  for (const row of rows) {
    if (row.blockerUserId === viewerUserId) blocked.add(row.blockedUserId);
    if (row.blockedUserId === viewerUserId) blocked.add(row.blockerUserId);
  }
  return blocked;
}

async function viewerHiddenPostIds(db: AppDatabase | DbTx, viewerUserId: string) {
  const rows = await db
    .select({ postId: socialHides.postId })
    .from(socialHides)
    .where(eq(socialHides.userId, viewerUserId));
  return new Set(rows.map((r) => r.postId));
}

async function areConnected(db: AppDatabase | DbTx, a: string, b: string) {
  const row = await db.query.socialConnections.findFirst({
    where: and(
      eq(socialConnections.status, "accepted"),
      or(
        and(eq(socialConnections.requesterUserId, a), eq(socialConnections.addresseeUserId, b)),
        and(eq(socialConnections.requesterUserId, b), eq(socialConnections.addresseeUserId, a)),
      ),
    ),
  });
  return Boolean(row);
}

function bumpScore(weight: number) {
  return {
    score7d: sql`${socialPosts.score7d} + ${weight}`,
    score24h: sql`${socialPosts.score24h} + ${weight}`,
  };
}

export async function getOrCreateMySocialProfile(db: AppDatabase, account: SessionAccount) {
  const row = await ensureSocialProfile(db, account.user.id);
  const author = await publicAuthorProjection(db, account.user.id);
  return { profile: serializeSocialProfile(row), author };
}

export async function patchMySocialProfile(
  db: AppDatabase,
  account: SessionAccount,
  input: {
    bio?: string;
    headline?: string;
    practiceAreas?: string;
    locationLabel?: string;
    coverImageUrl?: string | null;
    avatarUrl?: string | null;
    profileVisibility?: string;
    whoCanFollow?: string;
    whoCanMessage?: string;
    whoCanConnect?: string;
    showOrganization?: boolean;
    marketplaceOptIn?: boolean;
  },
  meta: RequestMeta,
) {
  await ensureSocialProfile(db, account.user.id);
  const now = new Date();
  const patch: Partial<typeof socialProfiles.$inferInsert> = { updatedAt: now };
  if (input.bio !== undefined) patch.bio = sanitizeText(input.bio);
  if (input.headline !== undefined) patch.headline = sanitizeText(input.headline);
  if (input.practiceAreas !== undefined) patch.practiceAreas = sanitizeText(input.practiceAreas);
  if (input.locationLabel !== undefined) patch.locationLabel = sanitizeText(input.locationLabel);
  if (input.coverImageUrl !== undefined) patch.coverImageUrl = input.coverImageUrl;
  if (input.avatarUrl !== undefined) patch.avatarUrl = input.avatarUrl;
  if (input.profileVisibility !== undefined) patch.profileVisibility = input.profileVisibility;
  if (input.whoCanFollow !== undefined) patch.whoCanFollow = input.whoCanFollow;
  if (input.whoCanMessage !== undefined) patch.whoCanMessage = input.whoCanMessage;
  if (input.whoCanConnect !== undefined) patch.whoCanConnect = input.whoCanConnect;
  if (input.showOrganization !== undefined) patch.showOrganization = input.showOrganization;
  if (input.marketplaceOptIn !== undefined) patch.marketplaceOptIn = input.marketplaceOptIn;

  const [row] = await db
    .update(socialProfiles)
    .set(patch)
    .where(eq(socialProfiles.userId, account.user.id))
    .returning();
  await recordAudit(db, {
    actorUserId: account.user.id,
    action: "social.profile_updated",
    resourceType: "social_profile",
    resourceId: account.user.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return { profile: serializeSocialProfile(row!) };
}

export async function createPost(
  db: AppDatabase,
  account: SessionAccount,
  input: {
    body: string;
    visibility?: "public" | "connections" | "private" | "draft";
    legalCategory?: string;
    hashtags?: string;
    linkUrl?: string;
    status?: "published" | "draft";
  },
  meta: RequestMeta,
  deps?: SocialModuleDeps,
) {
  consumeRateLimit(deps, `social:post:${account.user.id}`, "publicação");
  await ensureSocialProfile(db, account.user.id);
  const visibility = input.visibility ?? "public";
  let status = input.status ?? "published";
  if (visibility === "draft") status = "draft";
  const now = new Date();
  const [row] = await db
    .insert(socialPosts)
    .values({
      authorUserId: account.user.id,
      body: sanitizeText(input.body),
      visibility,
      status,
      legalCategory: input.legalCategory ? sanitizeText(input.legalCategory) : null,
      hashtags: input.hashtags ? sanitizeText(input.hashtags) : null,
      linkUrl: input.linkUrl || null,
      publishedAt: status === "published" ? now : null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  await recordAudit(db, {
    actorUserId: account.user.id,
    action: "social.post_created",
    resourceType: "social_post",
    resourceId: row!.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return { post: await serializePost(db, row!, account.user.id) };
}

export async function updatePost(
  db: AppDatabase,
  account: SessionAccount,
  postId: string,
  input: {
    body?: string;
    visibility?: "public" | "connections" | "private" | "draft";
    legalCategory?: string;
    hashtags?: string;
    linkUrl?: string;
    status?: "published" | "draft";
  },
  meta: RequestMeta,
) {
  const existing = await requirePost(db, postId);
  if (existing.authorUserId !== account.user.id) {
    throw new AppError("AUTHORIZATION_ERROR", "Você não pode editar esta publicação.");
  }
  const now = new Date();
  const patch: Partial<typeof socialPosts.$inferInsert> = { updatedAt: now };
  if (input.body !== undefined) patch.body = sanitizeText(input.body);
  if (input.visibility !== undefined) patch.visibility = input.visibility;
  if (input.legalCategory !== undefined) {
    patch.legalCategory = input.legalCategory ? sanitizeText(input.legalCategory) : null;
  }
  if (input.hashtags !== undefined) {
    patch.hashtags = input.hashtags ? sanitizeText(input.hashtags) : null;
  }
  if (input.linkUrl !== undefined) patch.linkUrl = input.linkUrl || null;

  let nextStatus = input.status ?? existing.status;
  const nextVisibility = input.visibility ?? existing.visibility;
  if (nextVisibility === "draft") nextStatus = "draft";
  if (input.status !== undefined || input.visibility !== undefined) {
    patch.status = nextStatus === "draft" ? "draft" : nextStatus;
    if (patch.status === "published" && !existing.publishedAt) {
      patch.publishedAt = now;
    }
  }

  const [row] = await db
    .update(socialPosts)
    .set(patch)
    .where(eq(socialPosts.id, postId))
    .returning();
  await recordAudit(db, {
    actorUserId: account.user.id,
    action: "social.post_updated",
    resourceType: "social_post",
    resourceId: postId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return { post: await serializePost(db, row!, account.user.id) };
}

export async function deletePost(
  db: AppDatabase,
  account: SessionAccount,
  postId: string,
  meta: RequestMeta,
) {
  const existing = await requirePost(db, postId);
  if (existing.authorUserId !== account.user.id) {
    throw new AppError("AUTHORIZATION_ERROR", "Você não pode remover esta publicação.");
  }
  const now = new Date();
  const [row] = await db
    .update(socialPosts)
    .set({ deletedAt: now, status: "removed", updatedAt: now })
    .where(eq(socialPosts.id, postId))
    .returning();
  await recordAudit(db, {
    actorUserId: account.user.id,
    action: "social.post_deleted",
    resourceType: "social_post",
    resourceId: postId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return { post: await serializePost(db, row!, account.user.id) };
}

export async function getFeed(
  db: AppDatabase,
  account: SessionAccount | null,
  query: {
    mode?: "for_you" | "following" | "recent" | "saved";
    legalCategory?: string;
    cursor?: string;
    limit?: number;
  },
) {
  const mode = query.mode ?? "recent";
  const limit = query.limit ?? 20;
  const viewerId = account?.user.id ?? null;

  if ((mode === "following" || mode === "saved") && !viewerId) {
    throw new AppError(
      "AUTHENTICATION_ERROR",
      "Entre para continuar. Nenhuma alteração foi feita.",
    );
  }

  const filters: SQL[] = [eq(socialPosts.status, "published"), isNull(socialPosts.deletedAt)];

  if (mode === "saved") {
    // visibility filter applied after join via bookmarks
  } else if (mode === "following") {
    // authors filtered below
  } else {
    filters.push(eq(socialPosts.visibility, "public"));
  }

  if (query.legalCategory) {
    filters.push(eq(socialPosts.legalCategory, query.legalCategory));
  }
  if (query.cursor) {
    filters.push(lt(socialPosts.publishedAt, new Date(query.cursor)));
  }

  let blocked = new Set<string>();
  let hidden = new Set<string>();
  if (viewerId) {
    [blocked, hidden] = await Promise.all([
      viewerBlockSet(db, viewerId),
      viewerHiddenPostIds(db, viewerId),
    ]);
  }

  let rows: Array<typeof socialPosts.$inferSelect> = [];

  if (mode === "saved" && viewerId) {
    const joined = await db
      .select({ post: socialPosts })
      .from(socialBookmarks)
      .innerJoin(socialPosts, eq(socialBookmarks.postId, socialPosts.id))
      .where(
        and(
          eq(socialBookmarks.userId, viewerId),
          eq(socialPosts.status, "published"),
          isNull(socialPosts.deletedAt),
          query.cursor ? lt(socialPosts.publishedAt, new Date(query.cursor)) : undefined,
          query.legalCategory ? eq(socialPosts.legalCategory, query.legalCategory) : undefined,
        ),
      )
      .orderBy(desc(socialPosts.publishedAt))
      .limit(limit + 20);
    rows = joined.map((r) => r.post);
  } else if (mode === "following" && viewerId) {
    const follows = await db
      .select({ followingUserId: socialFollows.followingUserId })
      .from(socialFollows)
      .where(eq(socialFollows.followerUserId, viewerId));
    const followingIds = follows.map((f) => f.followingUserId);
    if (followingIds.length === 0) {
      return { items: [], nextCursor: null };
    }
    rows = await db
      .select()
      .from(socialPosts)
      .where(
        and(
          ...filters,
          inArray(socialPosts.authorUserId, followingIds),
          or(eq(socialPosts.visibility, "public"), eq(socialPosts.visibility, "connections")),
        ),
      )
      .orderBy(desc(socialPosts.publishedAt))
      .limit(limit + 20);
  } else if (mode === "for_you") {
    rows = await db
      .select()
      .from(socialPosts)
      .where(and(...filters))
      .orderBy(desc(socialPosts.score7d), desc(socialPosts.publishedAt))
      .limit(limit + 20);
  } else {
    rows = await db
      .select()
      .from(socialPosts)
      .where(and(...filters))
      .orderBy(desc(socialPosts.publishedAt))
      .limit(limit + 20);
  }

  const filtered = rows
    .filter((row) => {
      if (viewerId && blocked.has(row.authorUserId)) return false;
      if (viewerId && hidden.has(row.id)) return false;
      return true;
    })
    .slice(0, limit);

  const items = [];
  for (const row of filtered) {
    items.push(await serializePost(db, row, viewerId));
  }
  const last = filtered[filtered.length - 1];
  return {
    items,
    nextCursor: last?.publishedAt ? iso(last.publishedAt) : null,
  };
}

export async function getPost(db: AppDatabase, account: SessionAccount | null, postId: string) {
  const row = await requirePost(db, postId);
  const viewerId = account?.user.id ?? null;

  if (row.status !== "published" || row.visibility !== "public") {
    if (!viewerId) {
      throw new AppError("NOT_FOUND", "Não encontramos esta publicação.");
    }
    if (row.authorUserId !== viewerId) {
      if (row.visibility === "connections") {
        const ok = await areConnected(db, viewerId, row.authorUserId);
        if (!ok || row.status !== "published") {
          throw new AppError("NOT_FOUND", "Não encontramos esta publicação.");
        }
      } else if (row.authorUserId !== viewerId) {
        throw new AppError("NOT_FOUND", "Não encontramos esta publicação.");
      }
    }
  }

  if (viewerId) {
    const blocked = await viewerBlockSet(db, viewerId);
    if (blocked.has(row.authorUserId)) {
      throw new AppError("NOT_FOUND", "Não encontramos esta publicação.");
    }
  }

  return { post: await serializePost(db, row, viewerId) };
}

export async function listComments(
  db: AppDatabase,
  account: SessionAccount | null,
  postId: string,
) {
  await getPost(db, account, postId);
  const rows = await db
    .select()
    .from(socialComments)
    .where(and(eq(socialComments.postId, postId), isNull(socialComments.deletedAt)))
    .orderBy(desc(socialComments.createdAt))
    .limit(200);
  const items = [];
  for (const row of rows) {
    items.push(serializeComment(row, await publicAuthorProjection(db, row.authorUserId)));
  }
  return { items };
}

export async function createComment(
  db: AppDatabase,
  account: SessionAccount,
  postId: string,
  input: { body: string; parentCommentId?: string },
  meta: RequestMeta,
  deps?: SocialModuleDeps,
) {
  consumeRateLimit(deps, `social:comment:${account.user.id}`, "comentário");
  const post = await requirePost(db, postId);
  if (post.status !== "published") {
    throw new AppError("CONFLICT", "Não é possível comentar nesta publicação.");
  }
  if (input.parentCommentId) {
    const parent = await db.query.socialComments.findFirst({
      where: eq(socialComments.id, input.parentCommentId),
    });
    if (!parent || parent.postId !== postId || parent.deletedAt) {
      throw new AppError("NOT_FOUND", "Não encontramos o comentário pai.");
    }
    if (parent.parentCommentId) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Respostas só são permitidas em um nível (sem encadear respostas).",
      );
    }
  }

  const now = new Date();
  const [row] = await db
    .insert(socialComments)
    .values({
      postId,
      authorUserId: account.user.id,
      parentCommentId: input.parentCommentId ?? null,
      body: sanitizeText(input.body),
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  await db
    .update(socialPosts)
    .set({
      commentCount: sql`${socialPosts.commentCount} + 1`,
      ...bumpScore(SCORE_COMMENT),
      updatedAt: now,
    })
    .where(eq(socialPosts.id, postId));

  await notify(db, {
    userId: post.authorUserId,
    actorUserId: account.user.id,
    type: "comment",
    postId,
    commentId: row!.id,
    body: `${account.user.displayName} comentou na sua publicação.`,
  });

  await recordAudit(db, {
    actorUserId: account.user.id,
    action: "social.comment_created",
    resourceType: "social_comment",
    resourceId: row!.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });

  return {
    comment: serializeComment(row!, await publicAuthorProjection(db, account.user.id)),
  };
}

export async function updateComment(
  db: AppDatabase,
  account: SessionAccount,
  commentId: string,
  input: { body: string },
  meta: RequestMeta,
) {
  const existing = await db.query.socialComments.findFirst({
    where: eq(socialComments.id, commentId),
  });
  if (!existing || existing.deletedAt) {
    throw new AppError("NOT_FOUND", "Não encontramos este comentário.");
  }
  if (existing.authorUserId !== account.user.id) {
    throw new AppError("AUTHORIZATION_ERROR", "Você não pode editar este comentário.");
  }
  const now = new Date();
  const [row] = await db
    .update(socialComments)
    .set({ body: sanitizeText(input.body), updatedAt: now })
    .where(eq(socialComments.id, commentId))
    .returning();
  await recordAudit(db, {
    actorUserId: account.user.id,
    action: "social.comment_updated",
    resourceType: "social_comment",
    resourceId: commentId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return {
    comment: serializeComment(row!, await publicAuthorProjection(db, account.user.id)),
  };
}

export async function deleteComment(
  db: AppDatabase,
  account: SessionAccount,
  commentId: string,
  meta: RequestMeta,
) {
  const existing = await db.query.socialComments.findFirst({
    where: eq(socialComments.id, commentId),
  });
  if (!existing || existing.deletedAt) {
    throw new AppError("NOT_FOUND", "Não encontramos este comentário.");
  }
  if (existing.authorUserId !== account.user.id) {
    throw new AppError("AUTHORIZATION_ERROR", "Você não pode remover este comentário.");
  }
  const now = new Date();
  await db
    .update(socialComments)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(socialComments.id, commentId));
  await db
    .update(socialPosts)
    .set({
      commentCount: sql`GREATEST(${socialPosts.commentCount} - 1, 0)`,
      updatedAt: now,
    })
    .where(eq(socialPosts.id, existing.postId));
  await recordAudit(db, {
    actorUserId: account.user.id,
    action: "social.comment_deleted",
    resourceType: "social_comment",
    resourceId: commentId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return { deleted: true };
}

export async function toggleLike(
  db: AppDatabase,
  account: SessionAccount,
  postId: string,
  meta: RequestMeta,
) {
  const post = await requirePost(db, postId);
  if (post.status !== "published") {
    throw new AppError("CONFLICT", "Não é possível curtir esta publicação.");
  }
  const existing = await db.query.socialPostLikes.findFirst({
    where: and(eq(socialPostLikes.postId, postId), eq(socialPostLikes.userId, account.user.id)),
  });
  const now = new Date();
  if (existing) {
    await db.delete(socialPostLikes).where(eq(socialPostLikes.id, existing.id));
    await db
      .update(socialPosts)
      .set({
        likeCount: sql`GREATEST(${socialPosts.likeCount} - 1, 0)`,
        score7d: sql`GREATEST(${socialPosts.score7d} - ${SCORE_LIKE}, 0)`,
        score24h: sql`GREATEST(${socialPosts.score24h} - ${SCORE_LIKE}, 0)`,
        updatedAt: now,
      })
      .where(eq(socialPosts.id, postId));
    await recordAudit(db, {
      actorUserId: account.user.id,
      action: "social.like_removed",
      resourceType: "social_post",
      resourceId: postId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
    });
    const refreshed = await requirePost(db, postId);
    return { liked: false, post: await serializePost(db, refreshed, account.user.id) };
  }

  try {
    await db.insert(socialPostLikes).values({
      postId,
      userId: account.user.id,
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const refreshed = await requirePost(db, postId);
    return { liked: true, post: await serializePost(db, refreshed, account.user.id) };
  }

  await db
    .update(socialPosts)
    .set({
      likeCount: sql`${socialPosts.likeCount} + 1`,
      ...bumpScore(SCORE_LIKE),
      updatedAt: now,
    })
    .where(eq(socialPosts.id, postId));

  await notify(db, {
    userId: post.authorUserId,
    actorUserId: account.user.id,
    type: "like",
    postId,
    body: `${account.user.displayName} curtiu sua publicação.`,
  });

  await recordAudit(db, {
    actorUserId: account.user.id,
    action: "social.like_added",
    resourceType: "social_post",
    resourceId: postId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });

  const refreshed = await requirePost(db, postId);
  return { liked: true, post: await serializePost(db, refreshed, account.user.id) };
}

export async function toggleBookmark(
  db: AppDatabase,
  account: SessionAccount,
  postId: string,
  meta: RequestMeta,
) {
  await requirePost(db, postId);
  const existing = await db.query.socialBookmarks.findFirst({
    where: and(eq(socialBookmarks.postId, postId), eq(socialBookmarks.userId, account.user.id)),
  });
  const now = new Date();
  if (existing) {
    await db.delete(socialBookmarks).where(eq(socialBookmarks.id, existing.id));
    await db
      .update(socialPosts)
      .set({
        bookmarkCount: sql`GREATEST(${socialPosts.bookmarkCount} - 1, 0)`,
        updatedAt: now,
      })
      .where(eq(socialPosts.id, postId));
    await recordAudit(db, {
      actorUserId: account.user.id,
      action: "social.bookmark_removed",
      resourceType: "social_post",
      resourceId: postId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
    });
    const refreshed = await requirePost(db, postId);
    return { bookmarked: false, post: await serializePost(db, refreshed, account.user.id) };
  }

  try {
    await db.insert(socialBookmarks).values({ postId, userId: account.user.id });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const refreshed = await requirePost(db, postId);
    return { bookmarked: true, post: await serializePost(db, refreshed, account.user.id) };
  }

  await db
    .update(socialPosts)
    .set({
      bookmarkCount: sql`${socialPosts.bookmarkCount} + 1`,
      updatedAt: now,
    })
    .where(eq(socialPosts.id, postId));

  await recordAudit(db, {
    actorUserId: account.user.id,
    action: "social.bookmark_added",
    resourceType: "social_post",
    resourceId: postId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });

  const refreshed = await requirePost(db, postId);
  return { bookmarked: true, post: await serializePost(db, refreshed, account.user.id) };
}

export async function createRepost(
  db: AppDatabase,
  account: SessionAccount,
  postId: string,
  input: { commentary?: string },
  meta: RequestMeta,
) {
  const post = await requirePost(db, postId);
  if (post.status !== "published") {
    throw new AppError("CONFLICT", "Não é possível republicar esta publicação.");
  }
  const existing = await db.query.socialReposts.findFirst({
    where: and(eq(socialReposts.postId, postId), eq(socialReposts.userId, account.user.id)),
  });
  if (existing) {
    throw new AppError("CONFLICT", "Você já republicou esta publicação.");
  }

  const now = new Date();
  try {
    await db.insert(socialReposts).values({
      postId,
      userId: account.user.id,
      commentary: input.commentary ? sanitizeText(input.commentary) : null,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("CONFLICT", "Você já republicou esta publicação.");
    }
    throw error;
  }

  await db
    .update(socialPosts)
    .set({
      repostCount: sql`${socialPosts.repostCount} + 1`,
      ...bumpScore(SCORE_REPOST),
      updatedAt: now,
    })
    .where(eq(socialPosts.id, postId));

  await notify(db, {
    userId: post.authorUserId,
    actorUserId: account.user.id,
    type: "repost",
    postId,
    body: `${account.user.displayName} republicou sua publicação.`,
  });

  await recordAudit(db, {
    actorUserId: account.user.id,
    action: "social.repost_created",
    resourceType: "social_post",
    resourceId: postId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });

  const refreshed = await requirePost(db, postId);
  return { reposted: true, post: await serializePost(db, refreshed, account.user.id) };
}

export async function hidePost(
  db: AppDatabase,
  account: SessionAccount,
  postId: string,
  meta: RequestMeta,
) {
  await requirePost(db, postId);
  try {
    await db.insert(socialHides).values({ userId: account.user.id, postId });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }
  await recordAudit(db, {
    actorUserId: account.user.id,
    action: "social.post_hidden",
    resourceType: "social_post",
    resourceId: postId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return { hidden: true };
}

export async function blockUser(
  db: AppDatabase,
  account: SessionAccount,
  targetUserId: string,
  meta: RequestMeta,
) {
  if (targetUserId === account.user.id) {
    throw new AppError("VALIDATION_ERROR", "Você não pode bloquear a si mesmo.");
  }
  const target = await db.query.profiles.findFirst({ where: eq(profiles.userId, targetUserId) });
  if (!target) throw new AppError("NOT_FOUND", "Não encontramos este usuário.");

  try {
    await db.insert(socialBlocks).values({
      blockerUserId: account.user.id,
      blockedUserId: targetUserId,
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }

  await db
    .delete(socialFollows)
    .where(
      or(
        and(
          eq(socialFollows.followerUserId, account.user.id),
          eq(socialFollows.followingUserId, targetUserId),
        ),
        and(
          eq(socialFollows.followerUserId, targetUserId),
          eq(socialFollows.followingUserId, account.user.id),
        ),
      ),
    );

  await recordAudit(db, {
    actorUserId: account.user.id,
    action: "social.user_blocked",
    resourceType: "user",
    resourceId: targetUserId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return { blocked: true };
}

export async function unblockUser(
  db: AppDatabase,
  account: SessionAccount,
  targetUserId: string,
  meta: RequestMeta,
) {
  await db
    .delete(socialBlocks)
    .where(
      and(
        eq(socialBlocks.blockerUserId, account.user.id),
        eq(socialBlocks.blockedUserId, targetUserId),
      ),
    );
  await recordAudit(db, {
    actorUserId: account.user.id,
    action: "social.user_unblocked",
    resourceType: "user",
    resourceId: targetUserId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return { blocked: false };
}

export async function reportPost(
  db: AppDatabase,
  account: SessionAccount,
  postId: string,
  input: { reasonCode: string; description?: string },
  meta: RequestMeta,
) {
  const post = await requirePost(db, postId);
  const [row] = await db
    .insert(socialReports)
    .values({
      reporterUserId: account.user.id,
      postId,
      reportedUserId: post.authorUserId,
      reasonCode: sanitizeText(input.reasonCode),
      description: input.description ? sanitizeText(input.description) : null,
      status: "open",
    })
    .returning();
  await recordAudit(db, {
    actorUserId: account.user.id,
    action: "social.post_reported",
    resourceType: "social_report",
    resourceId: row!.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return {
    report: {
      id: row!.id,
      postId: row!.postId,
      reasonCode: row!.reasonCode,
      status: row!.status,
      createdAt: iso(row!.createdAt),
    },
  };
}

export async function followUser(
  db: AppDatabase,
  account: SessionAccount,
  targetUserId: string,
  meta: RequestMeta,
) {
  if (targetUserId === account.user.id) {
    throw new AppError("VALIDATION_ERROR", "Você não pode seguir a si mesmo.");
  }
  const targetProfile = await ensureSocialProfile(db, targetUserId);
  if (targetProfile.whoCanFollow === "connections") {
    const connected = await areConnected(db, account.user.id, targetUserId);
    if (!connected) {
      throw new AppError(
        "AUTHORIZATION_ERROR",
        "Este perfil só aceita seguidores que já são conexões.",
      );
    }
  }

  try {
    await db.insert(socialFollows).values({
      followerUserId: account.user.id,
      followingUserId: targetUserId,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { following: true };
    }
    throw error;
  }

  await notify(db, {
    userId: targetUserId,
    actorUserId: account.user.id,
    type: "follow",
    body: `${account.user.displayName} começou a seguir você.`,
  });

  await recordAudit(db, {
    actorUserId: account.user.id,
    action: "social.follow",
    resourceType: "user",
    resourceId: targetUserId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return { following: true };
}

export async function unfollowUser(
  db: AppDatabase,
  account: SessionAccount,
  targetUserId: string,
  meta: RequestMeta,
) {
  await db
    .delete(socialFollows)
    .where(
      and(
        eq(socialFollows.followerUserId, account.user.id),
        eq(socialFollows.followingUserId, targetUserId),
      ),
    );
  await recordAudit(db, {
    actorUserId: account.user.id,
    action: "social.unfollow",
    resourceType: "user",
    resourceId: targetUserId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return { following: false };
}

function serializeConnection(row: typeof socialConnections.$inferSelect) {
  return {
    id: row.id,
    requesterUserId: row.requesterUserId,
    addresseeUserId: row.addresseeUserId,
    status: row.status,
    respondedAt: iso(row.respondedAt),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export async function requestConnection(
  db: AppDatabase,
  account: SessionAccount,
  targetUserId: string,
  meta: RequestMeta,
) {
  if (targetUserId === account.user.id) {
    throw new AppError("VALIDATION_ERROR", "Você não pode conectar-se a si mesmo.");
  }
  const target = await ensureSocialProfile(db, targetUserId);
  if (target.whoCanConnect === "nobody") {
    throw new AppError("AUTHORIZATION_ERROR", "Este perfil não aceita pedidos de conexão.");
  }

  const existing = await db.query.socialConnections.findFirst({
    where: or(
      and(
        eq(socialConnections.requesterUserId, account.user.id),
        eq(socialConnections.addresseeUserId, targetUserId),
      ),
      and(
        eq(socialConnections.requesterUserId, targetUserId),
        eq(socialConnections.addresseeUserId, account.user.id),
      ),
    ),
  });

  if (existing) {
    if (existing.status === "accepted") {
      throw new AppError("CONFLICT", "Vocês já estão conectados.");
    }
    if (existing.status === "pending") {
      throw new AppError("CONFLICT", "Já existe um pedido de conexão pendente.");
    }
    const now = new Date();
    const [row] = await db
      .update(socialConnections)
      .set({
        requesterUserId: account.user.id,
        addresseeUserId: targetUserId,
        status: "pending",
        respondedAt: null,
        updatedAt: now,
      })
      .where(eq(socialConnections.id, existing.id))
      .returning();
    await notify(db, {
      userId: targetUserId,
      actorUserId: account.user.id,
      type: "connection_request",
      body: `${account.user.displayName} enviou um pedido de conexão.`,
    });
    return { connection: serializeConnection(row!) };
  }

  const [row] = await db
    .insert(socialConnections)
    .values({
      requesterUserId: account.user.id,
      addresseeUserId: targetUserId,
      status: "pending",
    })
    .returning();

  await notify(db, {
    userId: targetUserId,
    actorUserId: account.user.id,
    type: "connection_request",
    body: `${account.user.displayName} enviou um pedido de conexão.`,
  });

  await recordAudit(db, {
    actorUserId: account.user.id,
    action: "social.connection_requested",
    resourceType: "social_connection",
    resourceId: row!.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });

  return { connection: serializeConnection(row!) };
}

export async function respondConnection(
  db: AppDatabase,
  account: SessionAccount,
  connectionId: string,
  action: "accept" | "decline",
  meta: RequestMeta,
) {
  const existing = await db.query.socialConnections.findFirst({
    where: eq(socialConnections.id, connectionId),
  });
  if (!existing || existing.status !== "pending") {
    throw new AppError("NOT_FOUND", "Não encontramos este pedido de conexão.");
  }
  if (existing.addresseeUserId !== account.user.id) {
    throw new AppError("AUTHORIZATION_ERROR", "Você não pode responder este pedido.");
  }
  const now = new Date();
  const status = action === "accept" ? "accepted" : "declined";
  const [row] = await db
    .update(socialConnections)
    .set({ status, respondedAt: now, updatedAt: now })
    .where(eq(socialConnections.id, connectionId))
    .returning();

  if (action === "accept") {
    await notify(db, {
      userId: existing.requesterUserId,
      actorUserId: account.user.id,
      type: "connection_accepted",
      body: `${account.user.displayName} aceitou seu pedido de conexão.`,
    });
  }

  await recordAudit(db, {
    actorUserId: account.user.id,
    action: `social.connection_${action}`,
    resourceType: "social_connection",
    resourceId: connectionId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });

  return { connection: serializeConnection(row!) };
}

export async function cancelConnectionRequest(
  db: AppDatabase,
  account: SessionAccount,
  connectionId: string,
  meta: RequestMeta,
) {
  const existing = await db.query.socialConnections.findFirst({
    where: eq(socialConnections.id, connectionId),
  });
  if (!existing || existing.status !== "pending") {
    throw new AppError("NOT_FOUND", "Não encontramos este pedido de conexão.");
  }
  if (existing.requesterUserId !== account.user.id) {
    throw new AppError("AUTHORIZATION_ERROR", "Você não pode cancelar este pedido.");
  }
  const now = new Date();
  const [row] = await db
    .update(socialConnections)
    .set({ status: "cancelled", respondedAt: now, updatedAt: now })
    .where(eq(socialConnections.id, connectionId))
    .returning();
  await recordAudit(db, {
    actorUserId: account.user.id,
    action: "social.connection_cancelled",
    resourceType: "social_connection",
    resourceId: connectionId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return { connection: serializeConnection(row!) };
}

export async function removeConnection(
  db: AppDatabase,
  account: SessionAccount,
  connectionId: string,
  meta: RequestMeta,
) {
  const existing = await db.query.socialConnections.findFirst({
    where: eq(socialConnections.id, connectionId),
  });
  if (!existing) {
    throw new AppError("NOT_FOUND", "Não encontramos esta conexão.");
  }
  const isParty =
    existing.requesterUserId === account.user.id || existing.addresseeUserId === account.user.id;
  if (!isParty) {
    throw new AppError("AUTHORIZATION_ERROR", "Você não pode remover esta conexão.");
  }

  if (existing.status === "pending" && existing.requesterUserId === account.user.id) {
    return cancelConnectionRequest(db, account, connectionId, meta);
  }

  if (existing.status !== "accepted") {
    throw new AppError("CONFLICT", "Só é possível remover conexões aceitas.");
  }

  await db.delete(socialConnections).where(eq(socialConnections.id, connectionId));
  await recordAudit(db, {
    actorUserId: account.user.id,
    action: "social.connection_removed",
    resourceType: "social_connection",
    resourceId: connectionId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return { removed: true };
}

export async function listConnections(db: AppDatabase, account: SessionAccount) {
  const rows = await db
    .select()
    .from(socialConnections)
    .where(
      and(
        or(
          eq(socialConnections.requesterUserId, account.user.id),
          eq(socialConnections.addresseeUserId, account.user.id),
        ),
        inArray(socialConnections.status, ["pending", "accepted"]),
      ),
    )
    .orderBy(desc(socialConnections.updatedAt))
    .limit(200);
  return { items: rows.map(serializeConnection) };
}

export async function listFollowers(
  db: AppDatabase,
  account: SessionAccount | null,
  userId: string,
) {
  const rows = await db
    .select()
    .from(socialFollows)
    .where(eq(socialFollows.followingUserId, userId))
    .orderBy(desc(socialFollows.createdAt))
    .limit(100);
  const items = [];
  for (const row of rows) {
    items.push({
      ...serializeFollow(row),
      user: await publicAuthorProjection(db, row.followerUserId),
    });
  }
  return { items };
}

export async function listFollowing(
  db: AppDatabase,
  account: SessionAccount | null,
  userId: string,
) {
  const rows = await db
    .select()
    .from(socialFollows)
    .where(eq(socialFollows.followerUserId, userId))
    .orderBy(desc(socialFollows.createdAt))
    .limit(100);
  const items = [];
  for (const row of rows) {
    items.push({
      ...serializeFollow(row),
      user: await publicAuthorProjection(db, row.followingUserId),
    });
  }
  return { items };
}

function serializeFollow(row: typeof socialFollows.$inferSelect) {
  return {
    id: row.id,
    followerUserId: row.followerUserId,
    followingUserId: row.followingUserId,
    createdAt: iso(row.createdAt),
  };
}

export async function searchPeople(
  db: AppDatabase,
  account: SessionAccount,
  query: { q?: string; limit?: number; offset?: number },
) {
  const limit = query.limit ?? 20;
  const offset = query.offset ?? 0;
  const filters: SQL[] = [];
  if (query.q) {
    filters.push(ilike(profiles.displayName, `%${escapeLike(query.q)}%`));
  }
  const rows = await db
    .select({
      userId: profiles.userId,
      displayName: profiles.displayName,
    })
    .from(profiles)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(profiles.displayName)
    .limit(limit)
    .offset(offset);

  const items = [];
  for (const row of rows) {
    if (row.userId === account.user.id) continue;
    items.push(await publicAuthorProjection(db, row.userId));
  }
  return { items };
}

export async function getTrending(
  db: AppDatabase,
  account: SessionAccount | null,
  query: { window?: "24h" | "7d" | "30d"; limit?: number },
) {
  const limit = query.limit ?? 20;
  const window = query.window ?? "7d";
  const scoreCol = window === "24h" ? socialPosts.score24h : socialPosts.score7d;
  const viewerId = account?.user.id ?? null;

  let blocked = new Set<string>();
  let hidden = new Set<string>();
  if (viewerId) {
    [blocked, hidden] = await Promise.all([
      viewerBlockSet(db, viewerId),
      viewerHiddenPostIds(db, viewerId),
    ]);
  }

  const rows = await db
    .select()
    .from(socialPosts)
    .where(
      and(
        eq(socialPosts.status, "published"),
        eq(socialPosts.visibility, "public"),
        isNull(socialPosts.deletedAt),
        sql`${scoreCol} > 0`,
      ),
    )
    .orderBy(desc(scoreCol), desc(socialPosts.publishedAt))
    .limit(limit + 20);

  const filtered = rows
    .filter((row) => {
      if (viewerId && blocked.has(row.authorUserId)) return false;
      if (viewerId && hidden.has(row.id)) return false;
      return true;
    })
    .slice(0, limit);

  const items = [];
  for (const row of filtered) {
    items.push(await serializePost(db, row, viewerId));
  }
  return { items, window };
}

export async function listNotifications(
  db: AppDatabase,
  account: SessionAccount,
  query: { limit?: number; unreadOnly?: boolean },
) {
  const limit = query.limit ?? 30;
  const filters: SQL[] = [eq(socialNotifications.userId, account.user.id)];
  if (query.unreadOnly) filters.push(isNull(socialNotifications.readAt));
  const rows = await db
    .select()
    .from(socialNotifications)
    .where(and(...filters))
    .orderBy(desc(socialNotifications.createdAt))
    .limit(limit);
  return {
    items: rows.map((row) => ({
      id: row.id,
      type: row.type,
      body: row.body,
      postId: row.postId,
      commentId: row.commentId,
      actorUserId: row.actorUserId,
      readAt: iso(row.readAt),
      createdAt: iso(row.createdAt),
    })),
  };
}

export async function markNotificationRead(
  db: AppDatabase,
  account: SessionAccount,
  notificationId: string,
) {
  const existing = await db.query.socialNotifications.findFirst({
    where: and(
      eq(socialNotifications.id, notificationId),
      eq(socialNotifications.userId, account.user.id),
    ),
  });
  if (!existing) throw new AppError("NOT_FOUND", "Não encontramos esta notificação.");
  if (!existing.readAt) {
    await db
      .update(socialNotifications)
      .set({ readAt: new Date() })
      .where(eq(socialNotifications.id, notificationId));
  }
  return { read: true };
}

export async function markAllNotificationsRead(db: AppDatabase, account: SessionAccount) {
  await db
    .update(socialNotifications)
    .set({ readAt: new Date() })
    .where(
      and(eq(socialNotifications.userId, account.user.id), isNull(socialNotifications.readAt)),
    );
  return { read: true };
}

export async function getPublicProfile(
  db: AppDatabase,
  account: SessionAccount | null,
  userId: string,
) {
  const identity = await db.query.profiles.findFirst({ where: eq(profiles.userId, userId) });
  if (!identity) throw new AppError("NOT_FOUND", "Não encontramos este perfil.");

  const social = await ensureSocialProfile(db, userId);
  const viewerId = account?.user.id ?? null;

  if (social.profileVisibility === "private" && viewerId !== userId) {
    throw new AppError("NOT_FOUND", "Não encontramos este perfil.");
  }
  if (social.profileVisibility === "connections" && viewerId !== userId) {
    if (!viewerId || !(await areConnected(db, viewerId, userId))) {
      throw new AppError("NOT_FOUND", "Não encontramos este perfil.");
    }
  }

  if (viewerId) {
    const blocked = await viewerBlockSet(db, viewerId);
    if (blocked.has(userId)) {
      throw new AppError("NOT_FOUND", "Não encontramos este perfil.");
    }
  }

  const author = await publicAuthorProjection(db, userId);
  let following = false;
  let connected = false;
  if (viewerId && viewerId !== userId) {
    const follow = await db.query.socialFollows.findFirst({
      where: and(
        eq(socialFollows.followerUserId, viewerId),
        eq(socialFollows.followingUserId, userId),
      ),
    });
    following = Boolean(follow);
    connected = await areConnected(db, viewerId, userId);
  }

  const [followersCount] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(socialFollows)
    .where(eq(socialFollows.followingUserId, userId));
  const [followingCount] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(socialFollows)
    .where(eq(socialFollows.followerUserId, userId));

  return {
    profile: {
      ...serializeSocialProfile(social),
      bio: social.profileVisibility === "private" && viewerId !== userId ? null : social.bio,
    },
    author,
    following,
    connected,
    counts: {
      followers: followersCount?.value ?? 0,
      following: followingCount?.value ?? 0,
    },
  };
}
