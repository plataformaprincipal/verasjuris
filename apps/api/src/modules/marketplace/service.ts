import type { PaymentProvider } from "@verasjuris/ai";
import { recordAudit } from "@verasjuris/audit";
import {
  policyMarketplaceDispute,
  policyMarketplaceEngagement,
  policyMarketplaceProposal,
  policyMarketplaceRequest,
  type SessionAccount,
} from "@verasjuris/auth";
import {
  clientPaymentRecords,
  conversationParticipants,
  conversationThreads,
  isUniqueViolation,
  lawyerProfiles,
  legalAreas,
  marketplaceDeliveries,
  marketplaceDisputes,
  marketplaceEngagementEvents,
  marketplaceEngagements,
  marketplaceProposalHistory,
  marketplaceProposals,
  marketplaceRequests,
  marketplaceServiceCategories,
  paymentIntents,
  professionalServices,
  serviceReviews,
  type AppDatabase,
} from "@verasjuris/database";
import type { MemoryRateLimiter } from "@verasjuris/security";
import { AppError } from "@verasjuris/types";
import { and, asc, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { authorize, escapeLike, iso } from "../ai/shared.js";
import type { RequestMeta } from "../auth/service.js";
import { requireDocumentInOrg } from "../documents/service.js";
import { MarketplaceRankingService, type ProfessionalSearchFilters } from "./ranking.js";

type DbTx = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];

export type MarketplaceModuleDeps = {
  paymentProvider: PaymentProvider;
  rateLimiter: MemoryRateLimiter;
};

const ranker = new MarketplaceRankingService();

const OPEN_REQUEST_STATUSES = ["open", "receiving_proposals"] as const;
const CLOSED_REQUEST_STATUSES = [
  "proposal_selected",
  "contracting",
  "in_progress",
  "delivered",
  "completed",
  "cancelled",
  "disputed",
  "expired",
] as const;
const OPEN_DISPUTE_STATUSES = [
  "open",
  "under_review",
  "waiting_client",
  "waiting_provider",
  "mediation",
] as const;

const DEFAULT_CATEGORIES: Array<{ key: string; name: string; description: string }> = [
  {
    key: "parecer",
    name: "Parecer jurídico",
    description: "Análise e parecer escrito sobre questão específica.",
  },
  {
    key: "contrato",
    name: "Elaboração de contratos",
    description: "Redação, revisão e adaptação de contratos.",
  },
  {
    key: "consultoria",
    name: "Consultoria jurídica",
    description: "Orientação estratégica e consultiva.",
  },
  {
    key: "peticao",
    name: "Peças processuais",
    description: "Petições, recursos e manifestações.",
  },
  {
    key: "due_diligence",
    name: "Due diligence",
    description: "Análise documental e riscos.",
  },
];

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

function assertNonNegativePrices(input: {
  basePriceCents?: number | null;
  minPriceCents?: number | null;
  maxPriceCents?: number | null;
}) {
  for (const [key, val] of Object.entries(input)) {
    if (val !== null && val !== undefined && val < 0) {
      throw new AppError("VALIDATION_ERROR", "Preços não podem ser negativos.", [
        { path: key, message: "Valor inválido." },
      ]);
    }
  }
}

function marketplaceProfileActive(profile: typeof lawyerProfiles.$inferSelect): boolean {
  return profile.marketplaceEnabled && profile.marketplaceStatus === "active";
}

function consumeRateLimit(deps: MarketplaceModuleDeps, key: string, label: string) {
  const result = deps.rateLimiter.consume(key, 30, 60_000);
  if (!result.allowed) {
    throw new AppError(
      "RATE_LIMIT",
      `Muitas tentativas de ${label}. Aguarde ${result.retryAfterSeconds}s e tente novamente.`,
    );
  }
}

async function requireRequestInOrg(
  db: AppDatabase | DbTx,
  organizationId: string,
  requestId: string,
) {
  const row = await db.query.marketplaceRequests.findFirst({
    where: and(
      eq(marketplaceRequests.id, requestId),
      eq(marketplaceRequests.organizationId, organizationId),
    ),
  });
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos esta solicitação.");
  return row;
}

async function requireEngagementInOrg(
  db: AppDatabase | DbTx,
  organizationId: string,
  engagementId: string,
) {
  const row = await db.query.marketplaceEngagements.findFirst({
    where: and(
      eq(marketplaceEngagements.id, engagementId),
      eq(marketplaceEngagements.organizationId, organizationId),
    ),
  });
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos esta contratação.");
  return row;
}

async function assertLawyerProfile(db: AppDatabase, userId: string) {
  const profile = await db.query.lawyerProfiles.findFirst({
    where: eq(lawyerProfiles.userId, userId),
  });
  if (!profile) {
    throw new AppError("NOT_FOUND", "Perfil de advogado não encontrado para este usuário.");
  }
  return profile;
}

function serializeCategory(row: typeof marketplaceServiceCategories.$inferSelect) {
  return {
    id: row.id,
    parentId: row.parentId,
    key: row.key,
    name: row.name,
    description: row.description,
    legalAreaId: row.legalAreaId,
    legalSubareaId: row.legalSubareaId,
    sortOrder: row.sortOrder,
    active: row.active,
    isSystem: row.isSystem,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function serializeService(row: typeof professionalServices.$inferSelect) {
  return {
    id: row.id,
    professionalProfileId: row.professionalProfileId,
    categoryId: row.categoryId,
    title: row.title,
    description: row.description,
    deliveryMode: row.deliveryMode,
    pricingModel: row.pricingModel,
    basePriceCents: row.basePriceCents,
    minPriceCents: row.minPriceCents,
    maxPriceCents: row.maxPriceCents,
    estimatedDuration: row.estimatedDuration,
    active: row.active,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function serializeRequest(
  row: typeof marketplaceRequests.$inferSelect,
  options?: { includeDescription?: boolean },
) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    requesterUserId: row.requesterUserId,
    clientId: row.clientId,
    categoryId: row.categoryId,
    legalAreaId: row.legalAreaId,
    title: row.title,
    description: options?.includeDescription === false ? undefined : row.description,
    urgency: row.urgency,
    locationState: row.locationState,
    locationCity: row.locationCity,
    remoteAllowed: row.remoteAllowed,
    budgetMinCents: row.budgetMinCents,
    budgetMaxCents: row.budgetMaxCents,
    deadlineAt: iso(row.deadlineAt),
    status: row.status,
    acceptedProposalId: row.acceptedProposalId,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function serializeProposal(row: typeof marketplaceProposals.$inferSelect) {
  return {
    id: row.id,
    requestId: row.requestId,
    professionalProfileId: row.professionalProfileId,
    amountCents: row.amountCents,
    feeBreakdown: row.feeBreakdown,
    estimatedDeliveryAt: iso(row.estimatedDeliveryAt),
    message: row.message,
    terms: row.terms,
    status: row.status,
    version: row.version,
    expiresAt: iso(row.expiresAt),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function serializeEngagement(row: typeof marketplaceEngagements.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    requestId: row.requestId,
    proposalId: row.proposalId,
    clientId: row.clientId,
    professionalProfileId: row.professionalProfileId,
    contractId: row.contractId,
    paymentRecordId: row.paymentRecordId,
    conversationThreadId: row.conversationThreadId,
    legalMatterId: row.legalMatterId,
    status: row.status,
    financialStatus: row.financialStatus ?? "none",
    cancelledAt: iso(row.cancelledAt),
    cancellationReason: row.cancellationReason,
    revisionLimit: row.revisionLimit,
    revisionCount: row.revisionCount,
    startedAt: iso(row.startedAt),
    completedAt: iso(row.completedAt),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function serializeEngagementEvent(row: typeof marketplaceEngagementEvents.$inferSelect) {
  return {
    id: row.id,
    engagementId: row.engagementId,
    actorUserId: row.actorUserId,
    eventType: row.eventType,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    reason: row.reason,
    amountCents: row.amountCents,
    metadata: row.metadata,
    createdAt: iso(row.createdAt),
  };
}

function serializeDelivery(row: typeof marketplaceDeliveries.$inferSelect) {
  return {
    id: row.id,
    engagementId: row.engagementId,
    deliveredByUserId: row.deliveredByUserId,
    description: row.description,
    documentId: row.documentId,
    status: row.status,
    deliveredAt: iso(row.deliveredAt),
    acceptedAt: iso(row.acceptedAt),
    rejectedAt: iso(row.rejectedAt),
    revisionNotes: row.revisionNotes,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function serializeDispute(row: typeof marketplaceDisputes.$inferSelect) {
  return {
    id: row.id,
    engagementId: row.engagementId,
    sourceType: row.sourceType,
    openedByUserId: row.openedByUserId,
    reasonCode: row.reasonCode,
    description: row.description,
    status: row.status,
    resolution: row.resolution,
    resolvedAt: iso(row.resolvedAt),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function publicProfessionalProjection(profile: typeof lawyerProfiles.$inferSelect) {
  return {
    userId: profile.userId,
    professionalName: profile.professionalName,
    bio: profile.bio,
    oabUf: profile.oabUf,
    oabVerificationStatus: profile.oabVerificationStatus,
    practiceAreas: profile.practiceAreas,
    languages: profile.languages,
    remoteAvailable: profile.remoteAvailable,
    inPersonAvailable: profile.inPersonAvailable,
    serviceRegions: profile.serviceRegions,
    serviceStates: profile.serviceStates,
    marketplaceEnabled: profile.marketplaceEnabled,
    marketplaceHeadline: profile.marketplaceHeadline,
    marketplaceDescription: profile.marketplaceDescription,
    serviceCities: profile.serviceCities,
    marketplaceCategories: profile.marketplaceCategories,
    specialties: profile.specialties,
    responseTimeEstimate: profile.responseTimeEstimate,
    basePriceMinCents: profile.basePriceMinCents,
    basePriceMaxCents: profile.basePriceMaxCents,
    marketplaceStatus: profile.marketplaceStatus,
    availabilityStatus: profile.availabilityStatus,
    visibility: profile.visibility,
    updatedAt: iso(profile.updatedAt),
  };
}

export async function ensureMarketplaceCategories(db: AppDatabase) {
  const existing = await db.query.marketplaceServiceCategories.findMany({ limit: 1 });
  if (existing.length > 0) return existing.map(serializeCategory);
  const rows = await db
    .insert(marketplaceServiceCategories)
    .values(
      DEFAULT_CATEGORIES.map((c, i) => ({
        key: c.key,
        name: c.name,
        description: c.description,
        sortOrder: i,
        isSystem: true,
        active: true,
      })),
    )
    .onConflictDoNothing()
    .returning();
  if (rows.length > 0) return rows.map(serializeCategory);
  const all = await db.query.marketplaceServiceCategories.findMany({
    orderBy: asc(marketplaceServiceCategories.sortOrder),
  });
  return all.map(serializeCategory);
}

export async function listMarketplaceCategories(db: AppDatabase) {
  await ensureMarketplaceCategories(db);
  const items = await db.query.marketplaceServiceCategories.findMany({
    where: eq(marketplaceServiceCategories.active, true),
    orderBy: asc(marketplaceServiceCategories.sortOrder),
  });
  return { items: items.map(serializeCategory) };
}

export async function getMarketplacePaymentStatus(
  account: SessionAccount,
  organizationId: string,
  deps: MarketplaceModuleDeps,
) {
  authorize(account, organizationId, (access) =>
    policyMarketplaceRequest(access, "marketplace.read"),
  );
  const health = await deps.paymentProvider.healthCheck();
  return { payment: health };
}

export async function patchMarketplaceLawyerProfile(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: Record<string, unknown>,
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyMarketplaceRequest(access, "marketplace.service.manage"),
  );
  await assertLawyerProfile(db, account.user.id);
  const now = new Date();
  const patch = Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== undefined),
  ) as Partial<typeof lawyerProfiles.$inferInsert>;
  const [row] = await db
    .update(lawyerProfiles)
    .set({ ...patch, updatedAt: now })
    .where(eq(lawyerProfiles.userId, account.user.id))
    .returning();
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "marketplace.profile_updated",
    resourceType: "lawyer_profile",
    resourceId: account.user.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return { profile: publicProfessionalProjection(row!) };
}

export async function createProfessionalService(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    categoryId: string;
    title: string;
    description?: string;
    deliveryMode: (typeof professionalServices.$inferSelect)["deliveryMode"];
    pricingModel: (typeof professionalServices.$inferSelect)["pricingModel"];
    basePriceCents?: number | null;
    minPriceCents?: number | null;
    maxPriceCents?: number | null;
    estimatedDuration?: string;
    active: boolean;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyMarketplaceRequest(access, "marketplace.service.manage"),
  );
  const profile = await assertLawyerProfile(db, account.user.id);
  assertNonNegativePrices(input);
  const active = input.active && marketplaceProfileActive(profile);
  if (input.active && !active) {
    throw new AppError(
      "CONFLICT",
      "Ative seu perfil no marketplace (status active) antes de publicar serviços.",
    );
  }
  const [row] = await db
    .insert(professionalServices)
    .values({
      professionalProfileId: account.user.id,
      categoryId: input.categoryId,
      title: sanitizeText(input.title),
      description: input.description ? sanitizeText(input.description) : null,
      deliveryMode: input.deliveryMode,
      pricingModel: input.pricingModel,
      basePriceCents: input.basePriceCents ?? null,
      minPriceCents: input.minPriceCents ?? null,
      maxPriceCents: input.maxPriceCents ?? null,
      estimatedDuration: input.estimatedDuration ?? null,
      active,
    })
    .returning();
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "marketplace.service_created",
    resourceType: "professional_service",
    resourceId: row!.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return { service: serializeService(row!) };
}

export async function updateProfessionalService(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  serviceId: string,
  input: Partial<{
    categoryId: string;
    title: string;
    description: string;
    deliveryMode: (typeof professionalServices.$inferSelect)["deliveryMode"];
    pricingModel: (typeof professionalServices.$inferSelect)["pricingModel"];
    basePriceCents: number | null;
    minPriceCents: number | null;
    maxPriceCents: number | null;
    estimatedDuration: string;
    active: boolean;
  }>,
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyMarketplaceRequest(access, "marketplace.service.manage"),
  );
  const profile = await assertLawyerProfile(db, account.user.id);
  const existing = await db.query.professionalServices.findFirst({
    where: and(
      eq(professionalServices.id, serviceId),
      eq(professionalServices.professionalProfileId, account.user.id),
    ),
  });
  if (!existing) throw new AppError("NOT_FOUND", "Serviço não encontrado.");
  assertNonNegativePrices(input);
  let active = input.active ?? existing.active;
  if (active && !marketplaceProfileActive(profile)) active = false;
  const [row] = await db
    .update(professionalServices)
    .set({
      ...input,
      title: input.title ? sanitizeText(input.title) : undefined,
      description:
        input.description !== undefined
          ? input.description
            ? sanitizeText(input.description)
            : null
          : undefined,
      active,
      updatedAt: new Date(),
    })
    .where(eq(professionalServices.id, serviceId))
    .returning();
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "marketplace.service_updated",
    resourceType: "professional_service",
    resourceId: serviceId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return { service: serializeService(row!) };
}

export async function listMyProfessionalServices(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  authorize(account, organizationId, (access) =>
    policyMarketplaceRequest(access, "marketplace.service.manage"),
  );
  const items = await db.query.professionalServices.findMany({
    where: eq(professionalServices.professionalProfileId, account.user.id),
    orderBy: desc(professionalServices.updatedAt),
  });
  return { items: items.map(serializeService) };
}

export async function searchMarketplaceProfessionals(
  db: AppDatabase,
  account: SessionAccount,
  filters: ProfessionalSearchFilters & { limit: number; offset: number },
) {
  if (!account.memberships.length) {
    throw new AppError("AUTHENTICATION_ERROR", "Faça login para consultar profissionais.");
  }
  const lawyers = await db.query.lawyerProfiles.findMany();
  const services = await db.query.professionalServices.findMany({
    where: eq(professionalServices.active, true),
  });
  const reviews = await db.query.serviceReviews.findMany({
    where: eq(serviceReviews.origin, "marketplace"),
  });
  const ratingByPro = new Map<string, { sum: number; count: number }>();
  for (const r of reviews) {
    if (r.status !== "published" && r.status !== "pending") continue;
    const cur = ratingByPro.get(r.professionalProfileId) ?? { sum: 0, count: 0 };
    cur.sum += r.rating;
    cur.count += 1;
    ratingByPro.set(r.professionalProfileId, cur);
  }
  const enriched = lawyers.map((l) => ({
    ...l,
    services: services.filter((s) => s.professionalProfileId === l.userId),
    averageRating: ratingByPro.get(l.userId)
      ? ratingByPro.get(l.userId)!.sum / ratingByPro.get(l.userId)!.count
      : null,
    reviewCount: ratingByPro.get(l.userId)?.count ?? 0,
  }));
  const ranked = ranker.rank(enriched, filters, filters.limit + filters.offset);
  const slice = ranked.slice(filters.offset, filters.offset + filters.limit);
  const byId = new Map(enriched.map((p) => [p.userId, p]));
  return {
    items: slice.map((r) => ({
      ...publicProfessionalProjection(byId.get(r.professionalProfileId)!),
      ranking: r,
    })),
    limit: filters.limit,
    offset: filters.offset,
  };
}

export async function getMarketplaceProfessional(
  db: AppDatabase,
  account: SessionAccount,
  professionalUserId: string,
) {
  if (!account.memberships.length) {
    throw new AppError("AUTHENTICATION_ERROR", "Faça login para ver o perfil.");
  }
  const profile = await db.query.lawyerProfiles.findFirst({
    where: eq(lawyerProfiles.userId, professionalUserId),
  });
  if (!profile || !marketplaceProfileActive(profile)) {
    throw new AppError("NOT_FOUND", "Profissional não encontrado no marketplace.");
  }
  const services = await db.query.professionalServices.findMany({
    where: and(
      eq(professionalServices.professionalProfileId, professionalUserId),
      eq(professionalServices.active, true),
    ),
  });
  return {
    profile: publicProfessionalProjection(profile),
    services: services.map(serializeService),
  };
}

export async function createMarketplaceRequest(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    clientId?: string;
    categoryId: string;
    legalAreaId?: string;
    title: string;
    description: string;
    urgency: string;
    locationState?: string;
    locationCity?: string;
    remoteAllowed: boolean;
    budgetMinCents?: number | null;
    budgetMaxCents?: number | null;
    deadlineAt?: string;
    status: "draft" | "open";
  },
  deps: MarketplaceModuleDeps,
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyMarketplaceRequest(access, "marketplace.request.create"),
  );
  consumeRateLimit(deps, `marketplace:request:${account.user.id}`, "criação de solicitação");
  const status = input.status === "open" ? "receiving_proposals" : "draft";
  const [row] = await db
    .insert(marketplaceRequests)
    .values({
      organizationId,
      requesterUserId: account.user.id,
      clientId: input.clientId ?? null,
      categoryId: input.categoryId,
      legalAreaId: input.legalAreaId ?? null,
      title: sanitizeText(input.title),
      description: sanitizeText(input.description),
      urgency: input.urgency,
      locationState: input.locationState ?? null,
      locationCity: input.locationCity ?? null,
      remoteAllowed: input.remoteAllowed,
      budgetMinCents: input.budgetMinCents ?? null,
      budgetMaxCents: input.budgetMaxCents ?? null,
      deadlineAt: input.deadlineAt ? new Date(input.deadlineAt) : null,
      status,
    })
    .returning();
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "marketplace.request_created",
    resourceType: "marketplace_request",
    resourceId: row!.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { status, membershipId: membership.membershipId },
  });
  return { request: serializeRequest(row!) };
}

export async function publishMarketplaceRequest(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  requestId: string,
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyMarketplaceRequest(access, "marketplace.request.manage"),
  );
  const existing = await requireRequestInOrg(db, organizationId, requestId);
  if (existing.status !== "draft") {
    throw new AppError("CONFLICT", "Só é possível publicar solicitações em rascunho.");
  }
  const [row] = await db
    .update(marketplaceRequests)
    .set({ status: "receiving_proposals", updatedAt: new Date() })
    .where(eq(marketplaceRequests.id, requestId))
    .returning();
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "marketplace.request_published",
    resourceType: "marketplace_request",
    resourceId: requestId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return { request: serializeRequest(row!) };
}

export async function listMarketplaceRequests(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { status?: string; limit: number; offset: number },
) {
  authorize(account, organizationId, (access) =>
    policyMarketplaceRequest(access, "marketplace.read"),
  );
  const where = query.status
    ? and(
        eq(marketplaceRequests.organizationId, organizationId),
        eq(
          marketplaceRequests.status,
          query.status as (typeof marketplaceRequests.$inferSelect)["status"],
        ),
      )
    : eq(marketplaceRequests.organizationId, organizationId);
  const items = await db.query.marketplaceRequests.findMany({
    where,
    orderBy: desc(marketplaceRequests.createdAt),
    limit: query.limit,
    offset: query.offset,
  });
  return { items: items.map((r) => serializeRequest(r)), limit: query.limit, offset: query.offset };
}

export async function listMarketplaceOpportunities(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { limit: number; offset: number },
) {
  authorize(account, organizationId, (access) =>
    policyMarketplaceProposal(access, "marketplace.proposal.create"),
  );
  await assertLawyerProfile(db, account.user.id);
  const items = await db.query.marketplaceRequests.findMany({
    where: inArray(marketplaceRequests.status, [...OPEN_REQUEST_STATUSES, "receiving_proposals"]),
    orderBy: desc(marketplaceRequests.createdAt),
    limit: query.limit,
    offset: query.offset,
  });
  return {
    items: items.map((r) => serializeRequest(r, { includeDescription: false })),
    limit: query.limit,
    offset: query.offset,
  };
}

export async function getMarketplaceRequestPreview(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  requestId: string,
) {
  authorize(account, organizationId, (access) =>
    policyMarketplaceProposal(access, "marketplace.proposal.create"),
  );
  const row = await db.query.marketplaceRequests.findFirst({
    where: eq(marketplaceRequests.id, requestId),
  });
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos esta solicitação.");
  if (!OPEN_REQUEST_STATUSES.includes(row.status as (typeof OPEN_REQUEST_STATUSES)[number])) {
    throw new AppError("NOT_FOUND", "Não encontramos esta solicitação.");
  }
  return {
    preview: {
      id: row.id,
      categoryId: row.categoryId,
      legalAreaId: row.legalAreaId,
      title: row.title,
      urgency: row.urgency,
      locationState: row.locationState,
      locationCity: row.locationCity,
      remoteAllowed: row.remoteAllowed,
      budgetMinCents: row.budgetMinCents,
      budgetMaxCents: row.budgetMaxCents,
      deadlineAt: iso(row.deadlineAt),
      status: row.status,
    },
  };
}

export async function getMarketplaceRequest(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  requestId: string,
) {
  authorize(account, organizationId, (access) =>
    policyMarketplaceRequest(access, "marketplace.read"),
  );
  const row = await requireRequestInOrg(db, organizationId, requestId);
  return { request: serializeRequest(row) };
}

export async function submitMarketplaceProposal(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  requestId: string,
  input: {
    amountCents: number;
    feeBreakdown?: Record<string, number>;
    estimatedDeliveryAt?: string;
    message?: string;
    terms?: string;
    expiresAt?: string;
  },
  deps: MarketplaceModuleDeps,
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyMarketplaceProposal(access, "marketplace.proposal.create"),
  );
  consumeRateLimit(deps, `marketplace:proposal:${account.user.id}`, "envio de proposta");
  const request = await db.query.marketplaceRequests.findFirst({
    where: and(
      eq(marketplaceRequests.id, requestId),
      eq(marketplaceRequests.organizationId, organizationId),
    ),
  });
  if (!request) throw new AppError("NOT_FOUND", "Não encontramos esta solicitação.");
  if (request.requesterUserId === account.user.id) {
    throw new AppError("CONFLICT", "Você não pode enviar proposta para a própria solicitação.");
  }
  await assertLawyerProfile(db, account.user.id);
  if (
    !OPEN_REQUEST_STATUSES.includes(request.status as (typeof OPEN_REQUEST_STATUSES)[number]) &&
    request.status !== "receiving_proposals"
  ) {
    throw new AppError("CONFLICT", "Esta solicitação não está recebendo propostas.");
  }
  if (
    CLOSED_REQUEST_STATUSES.includes(request.status as (typeof CLOSED_REQUEST_STATUSES)[number])
  ) {
    throw new AppError("CONFLICT", "Esta solicitação já foi encerrada para propostas.");
  }

  const existing = await db.query.marketplaceProposals.findFirst({
    where: and(
      eq(marketplaceProposals.requestId, requestId),
      eq(marketplaceProposals.professionalProfileId, account.user.id),
    ),
  });
  if (existing?.status === "accepted") {
    throw new AppError("CONFLICT", "Proposta já aceita — não é possível alterar.");
  }
  if (existing && ["submitted", "viewed"].includes(existing.status)) {
    throw new AppError(
      "CONFLICT",
      "Já existe uma proposta ativa. Retire-a antes de enviar outra versão.",
    );
  }

  const now = new Date();
  return db.transaction(async (tx) => {
    const version = (existing?.version ?? 0) + 1;
    let proposal: typeof marketplaceProposals.$inferSelect;
    if (existing) {
      const [updated] = await tx
        .update(marketplaceProposals)
        .set({
          amountCents: input.amountCents,
          feeBreakdown: input.feeBreakdown ?? null,
          estimatedDeliveryAt: input.estimatedDeliveryAt
            ? new Date(input.estimatedDeliveryAt)
            : null,
          message: input.message ? sanitizeText(input.message) : null,
          terms: input.terms ? sanitizeText(input.terms) : null,
          status: "submitted",
          version,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          updatedAt: now,
        })
        .where(eq(marketplaceProposals.id, existing.id))
        .returning();
      proposal = updated!;
    } else {
      const [inserted] = await tx
        .insert(marketplaceProposals)
        .values({
          requestId,
          professionalProfileId: account.user.id,
          amountCents: input.amountCents,
          feeBreakdown: input.feeBreakdown ?? null,
          estimatedDeliveryAt: input.estimatedDeliveryAt
            ? new Date(input.estimatedDeliveryAt)
            : null,
          message: input.message ? sanitizeText(input.message) : null,
          terms: input.terms ? sanitizeText(input.terms) : null,
          status: "submitted",
          version: 1,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        })
        .returning();
      proposal = inserted!;
    }

    await tx.insert(marketplaceProposalHistory).values({
      proposalId: proposal.id,
      version: proposal.version,
      amountCents: proposal.amountCents,
      message: proposal.message,
      terms: proposal.terms,
      snapshot: {
        feeBreakdown: proposal.feeBreakdown,
        estimatedDeliveryAt: proposal.estimatedDeliveryAt,
      },
    });

    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "marketplace.proposal_submitted",
      resourceType: "marketplace_proposal",
      resourceId: proposal.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { version: proposal.version, requestId },
    });

    return { proposal: serializeProposal(proposal) };
  });
}

export async function listMarketplaceProposalsForRequest(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  requestId: string,
) {
  authorize(account, organizationId, (access) =>
    policyMarketplaceRequest(access, "marketplace.read"),
  );
  await requireRequestInOrg(db, organizationId, requestId);
  const items = await db.query.marketplaceProposals.findMany({
    where: eq(marketplaceProposals.requestId, requestId),
    orderBy: desc(marketplaceProposals.createdAt),
  });
  return { items: items.map(serializeProposal) };
}

export async function listMyMarketplaceProposals(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { limit: number; offset: number },
) {
  authorize(account, organizationId, (access) =>
    policyMarketplaceProposal(access, "marketplace.proposal.manage"),
  );
  const items = await db.query.marketplaceProposals.findMany({
    where: eq(marketplaceProposals.professionalProfileId, account.user.id),
    orderBy: desc(marketplaceProposals.updatedAt),
    limit: query.limit,
    offset: query.offset,
  });
  return { items: items.map(serializeProposal), limit: query.limit, offset: query.offset };
}

export async function acceptMarketplaceProposal(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  proposalId: string,
  input: { revisionLimit: number },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyMarketplaceRequest(access, "marketplace.request.manage"),
  );
  const now = new Date();

  try {
    return await db.transaction(async (tx) => {
      const proposal = await tx.query.marketplaceProposals.findFirst({
        where: eq(marketplaceProposals.id, proposalId),
      });
      if (!proposal) throw new AppError("NOT_FOUND", "Proposta não encontrada.");
      const request = await requireRequestInOrg(tx, organizationId, proposal.requestId);
      if (request.requesterUserId !== account.user.id) {
        throw new AppError("NOT_FOUND", "Não encontramos esta solicitação.");
      }
      if (proposal.status !== "submitted" && proposal.status !== "viewed") {
        throw new AppError("CONFLICT", "Esta proposta não pode ser aceita.");
      }

      const [accepted] = await tx
        .update(marketplaceProposals)
        .set({ status: "accepted", updatedAt: now })
        .where(
          and(
            eq(marketplaceProposals.id, proposalId),
            eq(marketplaceProposals.status, proposal.status),
          ),
        )
        .returning();
      if (!accepted) throw new AppError("CONFLICT", "Esta proposta não está mais disponível.");

      await tx
        .update(marketplaceProposals)
        .set({ status: "declined", updatedAt: now })
        .where(
          and(
            eq(marketplaceProposals.requestId, proposal.requestId),
            sql`${marketplaceProposals.id} <> ${proposalId}`,
            inArray(marketplaceProposals.status, ["submitted", "viewed", "draft"]),
          ),
        );

      const [thread] = await tx
        .insert(conversationThreads)
        .values({
          organizationId,
          clientId: request.clientId,
          subject: `Marketplace — ${sanitizeText(request.title).slice(0, 120)}`,
          status: "open",
          createdByUserId: account.user.id,
          contextType: "marketplace_proposal",
          contextId: proposal.id,
        })
        .returning();

      await tx.insert(conversationParticipants).values([
        {
          organizationId,
          threadId: thread!.id,
          userId: request.requesterUserId,
          participantRole: "client",
        },
        {
          organizationId,
          threadId: thread!.id,
          userId: proposal.professionalProfileId,
          participantRole: "provider",
        },
      ]);

      const [engagement] = await tx
        .insert(marketplaceEngagements)
        .values({
          organizationId,
          requestId: proposal.requestId,
          proposalId: proposal.id,
          clientId: request.clientId,
          professionalProfileId: proposal.professionalProfileId,
          conversationThreadId: thread!.id,
          status: "pending_payment",
          revisionLimit: input.revisionLimit,
          startedAt: now,
        })
        .returning();

      await tx
        .update(conversationThreads)
        .set({
          contextType: "marketplace_engagement",
          contextId: engagement!.id,
          updatedAt: now,
        })
        .where(eq(conversationThreads.id, thread!.id));

      await tx
        .update(marketplaceRequests)
        .set({
          status: "in_progress",
          acceptedProposalId: proposal.id,
          updatedAt: now,
        })
        .where(eq(marketplaceRequests.id, proposal.requestId));

      await recordAudit(tx, {
        actorUserId: account.user.id,
        organizationId,
        action: "marketplace.proposal_accepted",
        resourceType: "marketplace_proposal",
        resourceId: proposalId,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
      });
      await recordAudit(tx, {
        actorUserId: account.user.id,
        organizationId,
        action: "marketplace.engagement_started",
        resourceType: "marketplace_engagement",
        resourceId: engagement!.id,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
      });

      return {
        engagement: serializeEngagement(engagement!),
        proposal: serializeProposal(accepted),
      };
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new AppError("CONFLICT", "Esta solicitação já possui uma contratação aceita.");
    }
    throw err;
  }
}

export async function getMarketplaceEngagement(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  engagementId: string,
) {
  authorize(account, organizationId, (access) =>
    policyMarketplaceEngagement(access, "marketplace.read"),
  );
  const row = await requireEngagementInOrg(db, organizationId, engagementId);
  const deliveries = await db.query.marketplaceDeliveries.findMany({
    where: eq(marketplaceDeliveries.engagementId, engagementId),
    orderBy: desc(marketplaceDeliveries.deliveredAt),
  });
  const disputes = await db.query.marketplaceDisputes.findMany({
    where: eq(marketplaceDisputes.engagementId, engagementId),
  });
  const events = await db.query.marketplaceEngagementEvents.findMany({
    where: eq(marketplaceEngagementEvents.engagementId, engagementId),
    orderBy: desc(marketplaceEngagementEvents.createdAt),
    limit: 200,
  });
  const intent = await db.query.paymentIntents.findFirst({
    where: and(
      eq(paymentIntents.organizationId, organizationId),
      eq(paymentIntents.referenceType, "marketplace_engagement"),
      eq(paymentIntents.referenceId, engagementId),
    ),
    orderBy: desc(paymentIntents.createdAt),
  });
  const intentMeta =
    intent?.metadata && typeof intent.metadata === "object"
      ? (intent.metadata as Record<string, unknown>)
      : {};
  const payment =
    intent == null
      ? null
      : {
          paymentIntentId: intent.id,
          status: intent.status,
          amountCents: intent.amountCents,
          currency: intent.currency,
          paymentMethod: intent.paymentMethod,
          expiresAt: intent.expiresAt ? intent.expiresAt.toISOString() : null,
          externalIntentId: intent.externalIntentId,
          paymentInstructions: {
            checkoutUrl:
              typeof intentMeta.checkoutUrl === "string"
                ? intentMeta.checkoutUrl
                : typeof intentMeta.invoiceUrl === "string"
                  ? intentMeta.invoiceUrl
                  : null,
            invoiceUrl: typeof intentMeta.invoiceUrl === "string" ? intentMeta.invoiceUrl : null,
            bankSlipUrl:
              typeof intentMeta.bankSlipUrl === "string" ? intentMeta.bankSlipUrl : null,
            pixCopyPaste:
              typeof intentMeta.pixCopyPaste === "string" ? intentMeta.pixCopyPaste : null,
            pixQrCodeBase64:
              typeof intentMeta.pixQrCodeBase64 === "string"
                ? intentMeta.pixQrCodeBase64
                : null,
            pixExpiresAt:
              typeof intentMeta.pixExpiresAt === "string" ? intentMeta.pixExpiresAt : null,
            boletoDigitableLine:
              typeof intentMeta.boletoDigitableLine === "string"
                ? intentMeta.boletoDigitableLine
                : null,
            billingType: typeof intentMeta.billingType === "string" ? intentMeta.billingType : null,
          },
        };
  return {
    engagement: serializeEngagement(row),
    deliveries: deliveries.map(serializeDelivery),
    disputes: disputes.map(serializeDispute),
    events: events.map(serializeEngagementEvent),
    payment,
  };
}

export async function listMarketplaceEngagements(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { limit: number; offset: number },
) {
  authorize(account, organizationId, (access) =>
    policyMarketplaceEngagement(access, "marketplace.read"),
  );
  const items = await db.query.marketplaceEngagements.findMany({
    where: eq(marketplaceEngagements.organizationId, organizationId),
    orderBy: desc(marketplaceEngagements.updatedAt),
    limit: query.limit,
    offset: query.offset,
  });
  return { items: items.map(serializeEngagement), limit: query.limit, offset: query.offset };
}

export async function submitMarketplaceDelivery(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  engagementId: string,
  input: { description: string; documentId?: string },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyMarketplaceEngagement(access, "marketplace.delivery.manage"),
  );
  const engagement = await requireEngagementInOrg(db, organizationId, engagementId);
  if (engagement.professionalProfileId !== account.user.id) {
    throw new AppError("NOT_FOUND", "Não encontramos esta contratação.");
  }
  if (input.documentId) {
    await requireDocumentInOrg(db, organizationId, input.documentId);
  }
  const [row] = await db
    .insert(marketplaceDeliveries)
    .values({
      engagementId,
      deliveredByUserId: account.user.id,
      description: sanitizeText(input.description),
      documentId: input.documentId ?? null,
      status: "submitted",
    })
    .returning();
  await db
    .update(marketplaceEngagements)
    .set({ status: "delivered", updatedAt: new Date() })
    .where(eq(marketplaceEngagements.id, engagementId));
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "marketplace.delivery_submitted",
    resourceType: "marketplace_delivery",
    resourceId: row!.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return { delivery: serializeDelivery(row!) };
}

export async function reviewMarketplaceDelivery(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  engagementId: string,
  deliveryId: string,
  input: { action: "accept" | "request_revision" | "reject"; revisionNotes?: string },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyMarketplaceEngagement(access, "marketplace.delivery.manage"),
  );
  const engagement = await requireEngagementInOrg(db, organizationId, engagementId);
  const request = await requireRequestInOrg(db, organizationId, engagement.requestId);
  if (request.requesterUserId !== account.user.id) {
    throw new AppError("NOT_FOUND", "Não encontramos esta entrega.");
  }
  const delivery = await db.query.marketplaceDeliveries.findFirst({
    where: and(
      eq(marketplaceDeliveries.id, deliveryId),
      eq(marketplaceDeliveries.engagementId, engagementId),
    ),
  });
  if (!delivery) throw new AppError("NOT_FOUND", "Entrega não encontrada.");
  const now = new Date();

  if (input.action === "request_revision") {
    if (engagement.revisionCount >= engagement.revisionLimit) {
      throw new AppError("CONFLICT", "Limite de revisões atingido.");
    }
    const [row] = await db
      .update(marketplaceDeliveries)
      .set({
        status: "revision_requested",
        revisionNotes: input.revisionNotes ? sanitizeText(input.revisionNotes) : null,
        updatedAt: now,
      })
      .where(eq(marketplaceDeliveries.id, deliveryId))
      .returning();
    await db
      .update(marketplaceEngagements)
      .set({
        revisionCount: engagement.revisionCount + 1,
        status: "waiting_provider",
        updatedAt: now,
      })
      .where(eq(marketplaceEngagements.id, engagementId));
    await recordAudit(db, {
      actorUserId: account.user.id,
      organizationId,
      action: "marketplace.delivery_revision_requested",
      resourceType: "marketplace_delivery",
      resourceId: deliveryId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
    });
    return { delivery: serializeDelivery(row!) };
  }

  if (input.action === "reject") {
    const [row] = await db
      .update(marketplaceDeliveries)
      .set({ status: "rejected", rejectedAt: now, updatedAt: now })
      .where(eq(marketplaceDeliveries.id, deliveryId))
      .returning();
    await recordAudit(db, {
      actorUserId: account.user.id,
      organizationId,
      action: "marketplace.delivery_rejected",
      resourceType: "marketplace_delivery",
      resourceId: deliveryId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
    });
    return { delivery: serializeDelivery(row!) };
  }

  const [row] = await db
    .update(marketplaceDeliveries)
    .set({ status: "accepted", acceptedAt: now, updatedAt: now })
    .where(eq(marketplaceDeliveries.id, deliveryId))
    .returning();
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "marketplace.delivery_accepted",
    resourceType: "marketplace_delivery",
    resourceId: deliveryId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return { delivery: serializeDelivery(row!) };
}

export async function completeMarketplaceEngagement(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  engagementId: string,
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyMarketplaceEngagement(access, "marketplace.engagement.manage"),
  );
  const engagement = await requireEngagementInOrg(db, organizationId, engagementId);
  const disputes = await db.query.marketplaceDisputes.findMany({
    where: eq(marketplaceDisputes.engagementId, engagementId),
  });
  const openDispute = disputes.find((d) =>
    (OPEN_DISPUTE_STATUSES as readonly string[]).includes(d.status),
  );
  if (openDispute) {
    throw new AppError("CONFLICT", "Há uma disputa aberta — conclua-a antes de finalizar.");
  }
  const acceptedDelivery = await db.query.marketplaceDeliveries.findFirst({
    where: and(
      eq(marketplaceDeliveries.engagementId, engagementId),
      eq(marketplaceDeliveries.status, "accepted"),
    ),
  });
  if (!acceptedDelivery) {
    throw new AppError("CONFLICT", "Aceite uma entrega antes de concluir a contratação.");
  }
  const now = new Date();
  const [row] = await db
    .update(marketplaceEngagements)
    .set({ status: "completed", completedAt: now, updatedAt: now })
    .where(eq(marketplaceEngagements.id, engagementId))
    .returning();
  await db
    .update(marketplaceRequests)
    .set({ status: "completed", updatedAt: now })
    .where(eq(marketplaceRequests.id, engagement.requestId));
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "marketplace.engagement_completed",
    resourceType: "marketplace_engagement",
    resourceId: engagementId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return { engagement: serializeEngagement(row!) };
}

export async function openMarketplaceDispute(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  engagementId: string,
  input: { reasonCode: string; description: string },
  deps: MarketplaceModuleDeps,
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyMarketplaceDispute(access, "marketplace.dispute.open"),
  );
  consumeRateLimit(deps, `marketplace:dispute:${account.user.id}`, "abertura de disputa");
  const engagement = await requireEngagementInOrg(db, organizationId, engagementId);
  const [row] = await db
    .insert(marketplaceDisputes)
    .values({
      engagementId,
      openedByUserId: account.user.id,
      reasonCode: sanitizeText(input.reasonCode),
      description: sanitizeText(input.description),
      status: "open",
    })
    .returning();
  await db
    .update(marketplaceEngagements)
    .set({ status: "disputed", updatedAt: new Date() })
    .where(eq(marketplaceEngagements.id, engagementId));
  await db
    .update(marketplaceRequests)
    .set({ status: "disputed", updatedAt: new Date() })
    .where(eq(marketplaceRequests.id, engagement.requestId));
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "marketplace.dispute_opened",
    resourceType: "marketplace_dispute",
    resourceId: row!.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return { dispute: serializeDispute(row!) };
}

export async function getMarketplaceDispute(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  disputeId: string,
) {
  authorize(account, organizationId, (access) =>
    policyMarketplaceDispute(access, "marketplace.read"),
  );
  const dispute = await db.query.marketplaceDisputes.findFirst({
    where: eq(marketplaceDisputes.id, disputeId),
  });
  if (!dispute) throw new AppError("NOT_FOUND", "Disputa não encontrada.");
  if (dispute.engagementId) {
    await requireEngagementInOrg(db, organizationId, dispute.engagementId);
  } else if (dispute.sourceType === "marketplace") {
    throw new AppError("NOT_FOUND", "Disputa não encontrada.");
  }
  return { dispute: serializeDispute(dispute) };
}

export async function resolveMarketplaceDispute(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  disputeId: string,
  input: { resolution: string; status: "resolved" | "closed" },
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyMarketplaceDispute(access, "marketplace.dispute.resolve"),
  );
  const dispute = await db.query.marketplaceDisputes.findFirst({
    where: eq(marketplaceDisputes.id, disputeId),
  });
  if (!dispute) throw new AppError("NOT_FOUND", "Disputa não encontrada.");
  if (dispute.engagementId) {
    await requireEngagementInOrg(db, organizationId, dispute.engagementId);
  } else if (dispute.sourceType === "marketplace") {
    throw new AppError("NOT_FOUND", "Disputa não encontrada.");
  }
  const now = new Date();
  const [row] = await db
    .update(marketplaceDisputes)
    .set({
      status: input.status,
      resolution: sanitizeText(input.resolution),
      resolvedAt: now,
      resolvedByMembershipId: membership.membershipId,
      updatedAt: now,
    })
    .where(eq(marketplaceDisputes.id, disputeId))
    .returning();
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "marketplace.dispute_resolved",
    resourceType: "marketplace_dispute",
    resourceId: disputeId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return { dispute: serializeDispute(row!) };
}

export async function createMarketplaceReview(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  engagementId: string,
  input: { rating: number; comment?: string },
  deps: MarketplaceModuleDeps,
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyMarketplaceEngagement(access, "marketplace.review.create"),
  );
  consumeRateLimit(deps, `marketplace:review:${account.user.id}`, "avaliação");
  const engagement = await requireEngagementInOrg(db, organizationId, engagementId);
  if (engagement.status !== "completed") {
    throw new AppError("CONFLICT", "Só é possível avaliar após a conclusão da contratação.");
  }
  if (engagement.professionalProfileId === account.user.id) {
    throw new AppError("CONFLICT", "Você não pode avaliar a si mesmo.");
  }
  const request = await requireRequestInOrg(db, organizationId, engagement.requestId);
  if (request.requesterUserId !== account.user.id) {
    throw new AppError("NOT_FOUND", "Não encontramos esta contratação.");
  }

  try {
    const [row] = await db
      .insert(serviceReviews)
      .values({
        origin: "marketplace",
        engagementId,
        reviewerUserId: account.user.id,
        professionalProfileId: engagement.professionalProfileId,
        rating: input.rating,
        comment: input.comment ? sanitizeText(input.comment) : null,
        status: "published",
      })
      .returning();
    await recordAudit(db, {
      actorUserId: account.user.id,
      organizationId,
      action: "marketplace.review_created",
      resourceType: "service_review",
      resourceId: row!.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
    });
    return { review: row };
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new AppError("CONFLICT", "Esta contratação já foi avaliada.");
    }
    throw err;
  }
}

export async function initiateMarketplaceProviderPayment(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  engagementId: string,
  input: { paymentMethod?: "pix" | "boleto" | "credit_card" },
  deps: MarketplaceModuleDeps,
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyMarketplaceEngagement(access, "marketplace.engagement.manage"),
  );

  const health = await deps.paymentProvider.healthCheck();
  const configured =
    health.status !== "not_configured" && deps.paymentProvider.id !== "not_configured";
  if (!configured) {
    throw new AppError(
      "PAYMENT_PROVIDER_NOT_CONFIGURED",
      "Pagamento online não está configurado. Registre o pagamento manualmente com comprovante.",
    );
  }

  const engagement = await requireEngagementInOrg(db, organizationId, engagementId);
  if (engagement.status !== "pending_payment") {
    throw new AppError(
      "CONFLICT",
      "Somente contratações aguardando pagamento podem iniciar cobrança online.",
    );
  }

  const proposal = await db.query.marketplaceProposals.findFirst({
    where: eq(marketplaceProposals.id, engagement.proposalId),
  });
  if (!proposal) {
    throw new AppError("NOT_FOUND", "Proposta contratada não encontrada.");
  }
  if (proposal.amountCents <= 0) {
    throw new AppError("VALIDATION_ERROR", "O valor da proposta deve ser maior que zero.");
  }

  const idempotencyKey = `marketplace_engagement:${engagementId}:v1`;
  const existing = await db.query.paymentIntents.findFirst({
    where: and(
      eq(paymentIntents.organizationId, organizationId),
      eq(paymentIntents.idempotencyKey, idempotencyKey),
    ),
  });
  const instructionsFromMeta = (metadata: Record<string, unknown>) => ({
    checkoutUrl:
      typeof metadata.checkoutUrl === "string"
        ? metadata.checkoutUrl
        : typeof metadata.invoiceUrl === "string"
          ? metadata.invoiceUrl
          : null,
    invoiceUrl: typeof metadata.invoiceUrl === "string" ? metadata.invoiceUrl : null,
    bankSlipUrl: typeof metadata.bankSlipUrl === "string" ? metadata.bankSlipUrl : null,
    pixCopyPaste: typeof metadata.pixCopyPaste === "string" ? metadata.pixCopyPaste : null,
    pixQrCodeBase64:
      typeof metadata.pixQrCodeBase64 === "string" ? metadata.pixQrCodeBase64 : null,
    pixExpiresAt: typeof metadata.pixExpiresAt === "string" ? metadata.pixExpiresAt : null,
    boletoDigitableLine:
      typeof metadata.boletoDigitableLine === "string" ? metadata.boletoDigitableLine : null,
    billingType: typeof metadata.billingType === "string" ? metadata.billingType : null,
  });

  if (existing) {
    const existingMeta =
      existing.metadata && typeof existing.metadata === "object"
        ? (existing.metadata as Record<string, unknown>)
        : {};
    const instructions = instructionsFromMeta(existingMeta);
    return {
      paymentIntentId: existing.id,
      status: existing.status,
      checkoutUrl: instructions.checkoutUrl,
      paymentInstructions: instructions,
      alreadyExists: true as const,
      amountCents: existing.amountCents,
      currency: existing.currency,
      paymentMethod: existing.paymentMethod,
      expiresAt: existing.expiresAt ? existing.expiresAt.toISOString() : null,
    };
  }

  const paymentMethod = input.paymentMethod ?? "pix";
  const providerResult = await deps.paymentProvider.createPaymentIntent({
    amountCents: proposal.amountCents,
    currency: "BRL",
    paymentMethod,
    description: `Marketplace ${engagementId.slice(0, 8)}`,
    customerReference: account.user.id,
    referenceType: "marketplace_engagement",
    referenceId: engagementId,
    idempotencyKey,
    metadata: {
      engagementId,
      proposalId: proposal.id,
      requestId: engagement.requestId,
      customerName: account.user.displayName ?? account.user.email,
      customerEmail: account.user.email,
    },
  });
  if (providerResult.status === "not_configured" || !providerResult.externalIntentId) {
    throw new AppError(
      "PAYMENT_PROVIDER_NOT_CONFIGURED",
      "O provedor não criou uma cobrança válida. Use pagamento manual com comprovante ou verifique as credenciais.",
    );
  }

  try {
    const [intent] = await db
      .insert(paymentIntents)
      .values({
        organizationId,
        payerType: engagement.clientId ? "crm_client" : "user",
        payerId: engagement.clientId ?? account.user.id,
        invoiceId: null,
        referenceType: "marketplace_engagement",
        referenceId: engagementId,
        amountCents: proposal.amountCents,
        currency: "BRL",
        paymentMethod,
        status: providerResult.status,
        providerKey: providerResult.providerKey || deps.paymentProvider.id,
        externalIntentId: providerResult.externalIntentId,
        idempotencyKey,
        expiresAt: providerResult.expiresAt ? new Date(providerResult.expiresAt) : null,
        metadata: {
          engagementId,
          proposalId: proposal.id,
          ...(providerResult.metadata ?? {}),
          ...(providerResult.checkoutUrl ? { checkoutUrl: providerResult.checkoutUrl } : {}),
        },
      })
      .returning();

    await recordAudit(db, {
      actorUserId: account.user.id,
      organizationId,
      action: "marketplace.payment_intent_created",
      resourceType: "marketplace_engagement",
      resourceId: engagementId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: {
        paymentIntentId: intent!.id,
        amountCents: intent!.amountCents,
        providerKey: intent!.providerKey,
        status: intent!.status,
      },
    });

    const createdMeta = {
      ...(providerResult.metadata ?? {}),
      ...(providerResult.checkoutUrl ? { checkoutUrl: providerResult.checkoutUrl } : {}),
    };
    const instructions = instructionsFromMeta(createdMeta);
    return {
      paymentIntentId: intent!.id,
      status: intent!.status,
      checkoutUrl: instructions.checkoutUrl,
      paymentInstructions: instructions,
      alreadyExists: false as const,
      amountCents: intent!.amountCents,
      currency: intent!.currency,
      paymentMethod: intent!.paymentMethod,
      expiresAt: intent!.expiresAt ? intent!.expiresAt.toISOString() : null,
    };
  } catch (error) {
    if (isUniqueViolation(error)) {
      const raced = await db.query.paymentIntents.findFirst({
        where: and(
          eq(paymentIntents.organizationId, organizationId),
          eq(paymentIntents.idempotencyKey, idempotencyKey),
        ),
      });
      if (raced) {
        const racedMeta =
          raced.metadata && typeof raced.metadata === "object"
            ? (raced.metadata as Record<string, unknown>)
            : {};
        const instructions = instructionsFromMeta(racedMeta);
        return {
          paymentIntentId: raced.id,
          status: raced.status,
          checkoutUrl: instructions.checkoutUrl,
          paymentInstructions: instructions,
          alreadyExists: true as const,
          amountCents: raced.amountCents,
          currency: raced.currency,
          paymentMethod: raced.paymentMethod,
          expiresAt: raced.expiresAt ? raced.expiresAt.toISOString() : null,
        };
      }
    }
    throw error;
  }
}

/**
 * Liberação operacional após confirmação financeira confiável (webhook/provider/manual).
 * Nunca chama a partir do redirect visual do checkout.
 */
export async function activateMarketplaceEngagementOnPayment(
  db: AppDatabase,
  input: {
    organizationId: string;
    engagementId: string;
    paymentIntentId: string;
  },
): Promise<{ activated: boolean }> {
  const engagement = await db.query.marketplaceEngagements.findFirst({
    where: and(
      eq(marketplaceEngagements.id, input.engagementId),
      eq(marketplaceEngagements.organizationId, input.organizationId),
    ),
  });
  if (!engagement) return { activated: false };
  if (engagement.status !== "pending_payment") return { activated: false };

  const now = new Date();
  const [updated] = await db
    .update(marketplaceEngagements)
    .set({ status: "active", updatedAt: now })
    .where(
      and(
        eq(marketplaceEngagements.id, engagement.id),
        eq(marketplaceEngagements.status, "pending_payment"),
      ),
    )
    .returning();
  if (!updated) return { activated: false };

  await recordAudit(db, {
    actorUserId: null,
    organizationId: input.organizationId,
    action: "marketplace.engagement_activated_on_payment",
    resourceType: "marketplace_engagement",
    resourceId: engagement.id,
    source: "system",
    requestId: null,
    ip: null,
    after: { paymentIntentId: input.paymentIntentId, status: "active" },
  });

  return { activated: true };
}

export async function recordManualMarketplacePayment(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  engagementId: string,
  input: {
    amountCents: number;
    description: string;
    evidenceDocumentId: string;
    externalReference?: string;
  },
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyMarketplaceEngagement(access, "marketplace.engagement.manage"),
  );
  const engagement = await requireEngagementInOrg(db, organizationId, engagementId);
  if (!engagement.clientId) {
    throw new AppError("CONFLICT", "Vincule um cliente CRM para registrar pagamento.");
  }
  await requireDocumentInOrg(db, organizationId, input.evidenceDocumentId);
  const now = new Date();
  const [payment] = await db
    .insert(clientPaymentRecords)
    .values({
      organizationId,
      clientId: engagement.clientId,
      description: sanitizeText(input.description),
      amountCents: input.amountCents,
      paidAt: now,
      status: "paid",
      paymentMethod: "manual",
      source: "marketplace",
      evidenceDocumentId: input.evidenceDocumentId,
      externalReference: input.externalReference ?? null,
      recordedByMembershipId: membership.membershipId,
    })
    .returning();
  await db
    .update(marketplaceEngagements)
    .set({
      paymentRecordId: payment!.id,
      status: engagement.status === "pending_payment" ? "active" : engagement.status,
      updatedAt: now,
    })
    .where(eq(marketplaceEngagements.id, engagementId));
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "marketplace.payment_recorded_manual",
    resourceType: "marketplace_engagement",
    resourceId: engagementId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { paymentRecordId: payment!.id },
  });
  return { paymentRecordId: payment!.id };
}

async function resolveLegalAreaTerms(
  db: AppDatabase,
  organizationId: string,
  legalAreaId: string | undefined,
) {
  if (!legalAreaId) return null;
  const area = await db.query.legalAreas.findFirst({
    where: and(eq(legalAreas.id, legalAreaId), eq(legalAreas.organizationId, organizationId)),
  });
  return area ? { name: area.name, slug: area.slug } : null;
}

export async function searchMarketplaceProfessionalsForOrg(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: ProfessionalSearchFilters & { limit: number; offset: number; legalAreaId?: string },
) {
  authorize(account, organizationId, (access) =>
    policyMarketplaceRequest(access, "marketplace.read"),
  );
  const area = await resolveLegalAreaTerms(db, organizationId, query.legalAreaId);
  return searchMarketplaceProfessionals(db, account, {
    ...query,
    legalAreaName: area?.name ?? query.legalAreaName,
    legalAreaSlug: area?.slug ?? query.legalAreaSlug,
  });
}

// ---------------------------------------------------------------------------
// Catálogo de serviços (busca paginada em SQL) e cancelamento/reembolso de contratações
// ---------------------------------------------------------------------------

export type MarketplaceCatalogFilters = {
  q?: string;
  categoryId?: string;
  deliveryMode?: (typeof professionalServices.$inferSelect)["deliveryMode"];
  pricingModel?: (typeof professionalServices.$inferSelect)["pricingModel"];
  minPriceCents?: number;
  maxPriceCents?: number;
  sort?: "relevance" | "price_asc" | "price_desc" | "newest" | "rating";
  limit: number;
  offset: number;
};

const CATALOG_MAX_LIMIT = 50;

export async function searchMarketplaceCatalog(
  db: AppDatabase,
  account: SessionAccount,
  filters: MarketplaceCatalogFilters,
) {
  if (!account.memberships.length) {
    throw new AppError("AUTHENTICATION_ERROR", "Faça login para consultar o catálogo.");
  }
  const limit = Math.min(Math.max(Math.trunc(filters.limit) || 20, 1), CATALOG_MAX_LIMIT);
  const offset = Math.max(Math.trunc(filters.offset) || 0, 0);

  // Preço efetivo para filtro/ordenação: valor base, senão mínimo.
  const priceExpr = sql<number | null>`coalesce(${professionalServices.basePriceCents}, ${professionalServices.minPriceCents})`;
  const ratingExpr = sql<number | null>`(
    select avg(${serviceReviews.rating})::float8 from ${serviceReviews}
    where ${serviceReviews.professionalProfileId} = ${lawyerProfiles.userId}
      and ${serviceReviews.origin} = 'marketplace'
      and ${serviceReviews.status} in ('published', 'pending')
  )`;
  const reviewCountExpr = sql<number>`(
    select count(*)::int from ${serviceReviews}
    where ${serviceReviews.professionalProfileId} = ${lawyerProfiles.userId}
      and ${serviceReviews.origin} = 'marketplace'
      and ${serviceReviews.status} in ('published', 'pending')
  )`;

  const conditions: SQL[] = [
    eq(professionalServices.active, true),
    eq(lawyerProfiles.marketplaceEnabled, true),
    eq(lawyerProfiles.marketplaceStatus, "active"),
    eq(marketplaceServiceCategories.active, true),
  ];
  const q = filters.q?.trim();
  let qPattern: string | null = null;
  if (q) {
    const escaped = escapeLike(q);
    qPattern = `%${escaped}%`;
    conditions.push(
      sql`(${professionalServices.title} ilike ${qPattern} or ${professionalServices.description} ilike ${qPattern})`,
    );
  }
  if (filters.categoryId) conditions.push(eq(professionalServices.categoryId, filters.categoryId));
  if (filters.deliveryMode) {
    conditions.push(eq(professionalServices.deliveryMode, filters.deliveryMode));
  }
  if (filters.pricingModel) {
    conditions.push(eq(professionalServices.pricingModel, filters.pricingModel));
  }
  if (filters.minPriceCents !== undefined) {
    conditions.push(sql`${priceExpr} >= ${filters.minPriceCents}`);
  }
  if (filters.maxPriceCents !== undefined) {
    conditions.push(sql`${priceExpr} <= ${filters.maxPriceCents}`);
  }
  const where = and(...conditions);

  const sort = filters.sort ?? "relevance";
  const orderBy: SQL[] = [];
  if (sort === "price_asc") orderBy.push(sql`${priceExpr} asc nulls last`);
  else if (sort === "price_desc") orderBy.push(sql`${priceExpr} desc nulls last`);
  else if (sort === "newest") orderBy.push(desc(professionalServices.createdAt));
  else if (sort === "rating") orderBy.push(sql`${ratingExpr} desc nulls last`);
  else if (q) {
    const prefix = `${escapeLike(q)}%`;
    orderBy.push(
      sql`case when ${professionalServices.title} ilike ${prefix} then 0 when ${professionalServices.title} ilike ${qPattern} then 1 else 2 end`,
    );
  }
  orderBy.push(desc(professionalServices.updatedAt), asc(professionalServices.id));

  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(professionalServices)
    .innerJoin(lawyerProfiles, eq(lawyerProfiles.userId, professionalServices.professionalProfileId))
    .innerJoin(
      marketplaceServiceCategories,
      eq(marketplaceServiceCategories.id, professionalServices.categoryId),
    )
    .where(where);

  const rows = await db
    .select({
      service: professionalServices,
      categoryName: marketplaceServiceCategories.name,
      categoryKey: marketplaceServiceCategories.key,
      professionalUserId: lawyerProfiles.userId,
      professionalName: lawyerProfiles.professionalName,
      headline: lawyerProfiles.marketplaceHeadline,
      oabUf: lawyerProfiles.oabUf,
      oabVerificationStatus: lawyerProfiles.oabVerificationStatus,
      remoteAvailable: lawyerProfiles.remoteAvailable,
      inPersonAvailable: lawyerProfiles.inPersonAvailable,
      averageRating: ratingExpr,
      reviewCount: reviewCountExpr,
    })
    .from(professionalServices)
    .innerJoin(lawyerProfiles, eq(lawyerProfiles.userId, professionalServices.professionalProfileId))
    .innerJoin(
      marketplaceServiceCategories,
      eq(marketplaceServiceCategories.id, professionalServices.categoryId),
    )
    .where(where)
    .orderBy(...orderBy)
    .limit(limit)
    .offset(offset);

  return {
    items: rows.map((r) => ({
      ...serializeService(r.service),
      category: { id: r.service.categoryId, key: r.categoryKey, name: r.categoryName },
      professional: {
        userId: r.professionalUserId,
        professionalName: r.professionalName,
        headline: r.headline,
        oabUf: r.oabUf,
        oabVerificationStatus: r.oabVerificationStatus,
        remoteAvailable: r.remoteAvailable,
        inPersonAvailable: r.inPersonAvailable,
        averageRating: r.averageRating ?? null,
        reviewCount: r.reviewCount ?? 0,
      },
    })),
    total: countRow?.total ?? 0,
    limit,
    offset,
  };
}

const CANCELLABLE_ENGAGEMENT_STATUSES = [
  "pending_contract",
  "pending_payment",
  "active",
  "waiting_client",
  "waiting_provider",
  "delivered",
] as const;

const OPEN_REFUND_FINANCIAL_STATUSES = ["refund_requested", "refund_pending", "refunded"];

/**
 * Autoriza: quem gerencia contratações (permissão) OU é parte (solicitante / profissional).
 * Sem vínculo com a organização => NOT_FOUND via authorize.
 */
async function authorizeEngagementParty(
  db: AppDatabase | DbTx,
  account: SessionAccount,
  organizationId: string,
  engagement: typeof marketplaceEngagements.$inferSelect,
) {
  authorize(account, organizationId, (access) =>
    policyMarketplaceEngagement(access, "marketplace.read"),
  );
  let canManage = true;
  try {
    authorize(account, organizationId, (access) =>
      policyMarketplaceEngagement(access, "marketplace.engagement.manage"),
    );
  } catch {
    canManage = false;
  }
  const request = await db.query.marketplaceRequests.findFirst({
    where: eq(marketplaceRequests.id, engagement.requestId),
  });
  const isParty =
    engagement.professionalProfileId === account.user.id ||
    request?.requesterUserId === account.user.id;
  if (!canManage && !isParty) {
    throw new AppError("AUTHORIZATION_ERROR", "Você não pode alterar esta contratação.");
  }
  return { request: request ?? null };
}

/** Valor pago conhecido (registro de pagamento ou intenção confirmada pelo provedor). */
async function resolvePaidEvidence(
  db: AppDatabase | DbTx,
  organizationId: string,
  engagement: typeof marketplaceEngagements.$inferSelect,
): Promise<{ hasPayment: boolean; paidAmountCents: number | null; pendingIntent: boolean }> {
  let paidAmountCents: number | null = null;
  let hasPayment = false;
  if (engagement.paymentRecordId) {
    hasPayment = true;
    const record = await db.query.clientPaymentRecords.findFirst({
      where: and(
        eq(clientPaymentRecords.id, engagement.paymentRecordId),
        eq(clientPaymentRecords.organizationId, organizationId),
      ),
    });
    paidAmountCents = record?.amountCents ?? null;
  }
  const intents = await db.query.paymentIntents.findMany({
    where: and(
      eq(paymentIntents.organizationId, organizationId),
      eq(paymentIntents.referenceType, "marketplace_engagement"),
      eq(paymentIntents.referenceId, engagement.id),
    ),
  });
  const confirmed = intents.find((i) => i.status === "confirmed" || i.status === "authorized");
  if (confirmed) {
    hasPayment = true;
    paidAmountCents ??= confirmed.amountCents;
  }
  const pendingIntent = intents.some((i) =>
    ["created", "requires_action", "processing"].includes(i.status),
  );
  return { hasPayment, paidAmountCents, pendingIntent };
}

export async function cancelMarketplaceEngagement(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  engagementId: string,
  input: { reason: string; evidenceDocumentId?: string },
  meta: RequestMeta,
) {
  const engagement = await requireEngagementInOrg(db, organizationId, engagementId);
  const { request } = await authorizeEngagementParty(db, account, organizationId, engagement);
  if (!(CANCELLABLE_ENGAGEMENT_STATUSES as readonly string[]).includes(engagement.status)) {
    throw new AppError(
      "CONFLICT",
      `Não é possível cancelar uma contratação com status "${engagement.status}".`,
    );
  }
  if (input.evidenceDocumentId) {
    await requireDocumentInOrg(db, organizationId, input.evidenceDocumentId);
  }
  const reason = sanitizeText(input.reason);
  const now = new Date();
  const evidence = await resolvePaidEvidence(db, organizationId, engagement);
  // Pagamento ainda pendente (pending_*) cancela direto; só pede reembolso se houver pagamento confirmado.
  const needsRefund = evidence.hasPayment;
  const financialStatus = needsRefund ? "refund_requested" : "none";

  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(marketplaceEngagements)
      .set({
        status: "cancelled",
        financialStatus,
        cancelledAt: now,
        cancellationReason: reason,
        updatedAt: now,
      })
      .where(
        and(
          eq(marketplaceEngagements.id, engagementId),
          eq(marketplaceEngagements.status, engagement.status),
        ),
      )
      .returning();
    if (!row) throw new AppError("CONFLICT", "A contratação foi alterada. Atualize e tente de novo.");

    if (request) {
      await tx
        .update(marketplaceRequests)
        .set({ status: "cancelled", updatedAt: now })
        .where(eq(marketplaceRequests.id, request.id));
    }

    await tx.insert(marketplaceEngagementEvents).values({
      engagementId,
      organizationId,
      actorUserId: account.user.id,
      eventType: "cancelled",
      fromStatus: engagement.status,
      toStatus: "cancelled",
      reason,
      metadata: {
        evidenceDocumentId: input.evidenceDocumentId ?? null,
        hadPayment: evidence.hasPayment,
        pendingPaymentIntent: evidence.pendingIntent,
      },
    });
    if (needsRefund) {
      await tx.insert(marketplaceEngagementEvents).values({
        engagementId,
        organizationId,
        actorUserId: account.user.id,
        eventType: "refund_requested",
        fromStatus: "cancelled",
        toStatus: "cancelled",
        reason,
        amountCents: evidence.paidAmountCents,
        metadata: {
          note: "Reembolso solicitado; aguardando processamento manual/confirmação do provedor. Nenhum estorno foi confirmado.",
        },
      });
    }
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "marketplace.engagement_cancelled",
      resourceType: "marketplace_engagement",
      resourceId: engagementId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      before: { status: engagement.status, financialStatus: engagement.financialStatus },
      after: { status: "cancelled", financialStatus },
    });
    if (needsRefund) {
      await recordAudit(tx, {
        actorUserId: account.user.id,
        organizationId,
        action: "marketplace.refund_requested",
        resourceType: "marketplace_engagement",
        resourceId: engagementId,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
        after: { amountCents: evidence.paidAmountCents, financialStatus },
      });
    }
    return { engagement: serializeEngagement(row), refundRequested: needsRefund };
  });
}

export async function requestMarketplaceRefund(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  engagementId: string,
  input: { reason: string; amountCents?: number | null; evidenceDocumentId?: string },
  meta: RequestMeta,
) {
  const engagement = await requireEngagementInOrg(db, organizationId, engagementId);
  await authorizeEngagementParty(db, account, organizationId, engagement);

  let eligible = engagement.status === "cancelled" || engagement.status === "disputed";
  if (engagement.status === "completed") {
    // Concluída: só com disputa registrada na contratação.
    const dispute = await db.query.marketplaceDisputes.findFirst({
      where: eq(marketplaceDisputes.engagementId, engagementId),
    });
    eligible = Boolean(dispute);
  }
  if (!eligible) {
    throw new AppError(
      "CONFLICT",
      "Reembolso só pode ser solicitado para contratações canceladas, em disputa ou concluídas com disputa.",
    );
  }
  if (OPEN_REFUND_FINANCIAL_STATUSES.includes(engagement.financialStatus ?? "none")) {
    throw new AppError("CONFLICT", "Já existe uma solicitação de reembolso para esta contratação.");
  }
  if (input.evidenceDocumentId) {
    await requireDocumentInOrg(db, organizationId, input.evidenceDocumentId);
  }
  const evidence = await resolvePaidEvidence(db, organizationId, engagement);
  if (!evidence.hasPayment) {
    throw new AppError("CONFLICT", "Não há pagamento confirmado para reembolsar nesta contratação.");
  }
  const amountCents = input.amountCents ?? null;
  if (amountCents !== null && evidence.paidAmountCents !== null && amountCents > evidence.paidAmountCents) {
    throw new AppError("VALIDATION_ERROR", "O valor excede o total pago.", [
      { path: "amountCents", message: "Valor superior ao pago." },
    ]);
  }
  const reason = sanitizeText(input.reason);
  const now = new Date();
  const requestedAmount = amountCents ?? evidence.paidAmountCents;

  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(marketplaceEngagements)
      .set({ financialStatus: "refund_requested", updatedAt: now })
      .where(eq(marketplaceEngagements.id, engagementId))
      .returning();
    await tx.insert(marketplaceEngagementEvents).values({
      engagementId,
      organizationId,
      actorUserId: account.user.id,
      eventType: "refund_requested",
      fromStatus: engagement.status,
      toStatus: engagement.status,
      reason,
      amountCents: requestedAmount,
      metadata: {
        fullRefund: amountCents === null,
        evidenceDocumentId: input.evidenceDocumentId ?? null,
        note: "Solicitação registrada; reembolso depende de processamento manual/confirmação do provedor.",
      },
    });
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "marketplace.refund_requested",
      resourceType: "marketplace_engagement",
      resourceId: engagementId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      before: { financialStatus: engagement.financialStatus },
      after: { financialStatus: "refund_requested", amountCents: requestedAmount },
    });
    return { engagement: serializeEngagement(row!) };
  });
}
