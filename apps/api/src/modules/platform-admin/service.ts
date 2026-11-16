import { recordAudit } from "@verasjuris/audit";
import type { SessionAccount } from "@verasjuris/auth";
import { revokeAllUserSessions } from "@verasjuris/auth";
import type { AIGateway } from "@verasjuris/ai";
import type { AppDatabase } from "@verasjuris/database";
import {
  aiUsage,
  jurisWorkCreditBalances,
  organizations,
  platformAdminInvites,
  platformStaff,
  professionalProfiles,
  profiles,
  sessions,
  users,
} from "@verasjuris/database";
import { generateOpaqueToken, hashOpaqueToken, hashPassword } from "@verasjuris/security";
import {
  AppError,
  PLATFORM_ROLE_KEYS,
  type PlatformRoleKey,
} from "@verasjuris/types";
import { and, count, desc, eq, gte, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";
import type { RequestMeta } from "../auth/service.js";
import { requirePlatformPermission, requirePlatformStaffBootstrap } from "./authorize.js";

const INVITE_TTL_DAYS_DEFAULT = 7;
const BOOTSTRAP_EMAIL = "acesseverasjuris@gmail.com";

export type PlatformAdminDeps = {
  db: AppDatabase;
  gateway?: AIGateway | null;
  emailHealth?: () => Promise<{ status: string; detail?: string; checkedAt: string }>;
  paymentHealth?: () => Promise<{ status: string; detail?: string; checkedAt: string }>;
  paymentsLive?: boolean;
  emailProviderMode?: string;
  paymentProviderMode?: string;
  featureAi?: boolean;
  aiProviderMode?: string;
  openaiKeyPresent?: boolean;
};

function iso(d: Date) {
  return d.toISOString();
}

function assertRole(roleKey: string): PlatformRoleKey {
  if (!(PLATFORM_ROLE_KEYS as readonly string[]).includes(roleKey)) {
    throw new AppError("VALIDATION_ERROR", "Função administrativa inválida.");
  }
  return roleKey as PlatformRoleKey;
}

export async function getPlatformMe(account: SessionAccount) {
  const platform = requirePlatformStaffBootstrap(account);
  return {
    platform: {
      roles: platform.roles,
      permissions: platform.permissions,
      mfaRequired: platform.mfaRequired,
      forcePasswordChange: platform.forcePasswordChange,
      mfaEnabled: platform.mfaEnabled,
      adminReady:
        !platform.forcePasswordChange && (!platform.mfaRequired || platform.mfaEnabled),
    },
  };
}

export async function createPlatformInvite(
  deps: PlatformAdminDeps,
  account: SessionAccount,
  input: {
    email: string;
    roleKey: PlatformRoleKey;
    note?: string;
    expiresInDays?: number;
  },
  meta: RequestMeta,
) {
  requirePlatformPermission(account, "platform.staff.manage");
  const email = input.email.trim().toLowerCase();
  const roleKey = assertRole(input.roleKey);
  const days = input.expiresInDays ?? INVITE_TTL_DAYS_DEFAULT;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const { token, hash } = generateOpaqueToken();

  await deps.db
    .update(platformAdminInvites)
    .set({ status: "revoked", updatedAt: new Date() })
    .where(
      and(
        eq(platformAdminInvites.email, email),
        eq(platformAdminInvites.status, "pending"),
      ),
    );

  const [invite] = await deps.db
    .insert(platformAdminInvites)
    .values({
      email,
      roleKey,
      tokenHash: hash,
      status: "pending",
      expiresAt,
      invitedByUserId: account.user.id,
      note: input.note ?? null,
    })
    .returning();

  await recordAudit(deps.db, {
    actorUserId: account.user.id,
    organizationId: null,
    action: "platform.staff.invite_created",
    resourceType: "platform_admin_invite",
    resourceId: invite!.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { email, roleKey, expiresAt: iso(expiresAt) },
  });

  return {
    invite: {
      id: invite!.id,
      email,
      roleKey,
      expiresAt: iso(expiresAt),
      status: "pending" as const,
    },
    /** Token em claro — exibido uma vez ao criador; nunca persistido. */
    activationToken: token,
  };
}

/**
 * Bootstrap operacional: cria convite SUPER_ADMIN para o e-mail inicial
 * se ainda não houver staff SUPER_ADMIN ativo. Idempotente.
 */
export async function ensureBootstrapSuperAdminInvite(
  deps: PlatformAdminDeps,
  meta: RequestMeta,
  email = BOOTSTRAP_EMAIL,
): Promise<{ created: boolean; inviteId?: string; activationToken?: string; reason: string }> {
  const existingStaff = await deps.db.query.platformStaff.findFirst({
    where: and(eq(platformStaff.roleKey, "SUPER_ADMIN"), eq(platformStaff.status, "active")),
  });
  if (existingStaff) {
    return { created: false, reason: "already_has_active_super_admin" };
  }

  const pending = await deps.db.query.platformAdminInvites.findFirst({
    where: and(
      eq(platformAdminInvites.email, email.toLowerCase()),
      eq(platformAdminInvites.roleKey, "SUPER_ADMIN"),
      eq(platformAdminInvites.status, "pending"),
      gte(platformAdminInvites.expiresAt, new Date()),
    ),
  });
  if (pending) {
    return { created: false, inviteId: pending.id, reason: "pending_invite_exists" };
  }

  const { token, hash } = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS_DEFAULT * 24 * 60 * 60 * 1000);
  const [invite] = await deps.db
    .insert(platformAdminInvites)
    .values({
      email: email.toLowerCase(),
      roleKey: "SUPER_ADMIN",
      tokenHash: hash,
      status: "pending",
      expiresAt,
      note: "Bootstrap SUPER_ADMIN inicial",
    })
    .returning();

  await recordAudit(deps.db, {
    actorUserId: undefined,
    organizationId: undefined,
    action: "platform.staff.bootstrap_invite",
    resourceType: "platform_admin_invite",
    resourceId: invite!.id,
    source: "system",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { email: email.toLowerCase(), roleKey: "SUPER_ADMIN" },
  });

  return {
    created: true,
    inviteId: invite!.id,
    activationToken: token,
    reason: "created",
  };
}

export async function activatePlatformInvite(
  deps: PlatformAdminDeps,
  input: { token: string; password: string; displayName?: string },
  meta: RequestMeta,
) {
  const tokenHash = hashOpaqueToken(input.token.trim());
  const invite = await deps.db.query.platformAdminInvites.findFirst({
    where: eq(platformAdminInvites.tokenHash, tokenHash),
  });
  if (!invite || invite.status !== "pending") {
    throw new AppError("NOT_FOUND", "Convite inválido ou já utilizado.");
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    await deps.db
      .update(platformAdminInvites)
      .set({ status: "expired", updatedAt: new Date() })
      .where(eq(platformAdminInvites.id, invite.id));
    throw new AppError("VALIDATION_ERROR", "Este convite expirou. Solicite um novo.");
  }

  const roleKey = assertRole(invite.roleKey);
  const email = invite.email.toLowerCase();
  const now = new Date();
  const passwordHash = await hashPassword(input.password);

  const result = await deps.db.transaction(async (tx) => {
    let user = await tx.query.users.findFirst({ where: eq(users.email, email) });
    let createdUser = false;

    if (!user) {
      const [created] = await tx
        .insert(users)
        .values({
          email,
          passwordHash,
          status: "active",
          emailVerifiedAt: now,
          mfaEnabled: false,
          mfaStatus: "required",
        })
        .returning();
      user = created!;
      createdUser = true;
      await tx.insert(profiles).values({
        userId: user.id,
        displayName: (input.displayName?.trim() || email.split("@")[0] || "Administrador").slice(
          0,
          80,
        ),
      });
      await tx.insert(professionalProfiles).values({ userId: user.id });
    } else {
      // Conta existente: não sobrescreve senha sem o fluxo de ativação com token válido.
      // Exige que o ativador defina senha nova (substitui) + força MFA.
      await tx
        .update(users)
        .set({
          passwordHash,
          status: "active",
          emailVerifiedAt: user.emailVerifiedAt ?? now,
          mfaStatus: "required",
          updatedAt: now,
        })
        .where(eq(users.id, user.id));
      if (input.displayName?.trim()) {
        await tx
          .update(profiles)
          .set({ displayName: input.displayName.trim().slice(0, 80), updatedAt: now })
          .where(eq(profiles.userId, user.id));
      }
    }

    const existingStaff = await tx.query.platformStaff.findFirst({
      where: and(eq(platformStaff.userId, user.id), eq(platformStaff.roleKey, roleKey)),
    });
    if (existingStaff) {
      await tx
        .update(platformStaff)
        .set({
          status: "active",
          mfaRequired: true,
          forcePasswordChange: false,
          activatedAt: now,
          revokedAt: null,
          updatedAt: now,
        })
        .where(eq(platformStaff.id, existingStaff.id));
    } else {
      await tx.insert(platformStaff).values({
        userId: user.id,
        roleKey,
        status: "active",
        mfaRequired: true,
        forcePasswordChange: false,
        activatedAt: now,
        createdByUserId: invite.invitedByUserId,
      });
    }

    await tx
      .update(platformAdminInvites)
      .set({
        status: "accepted",
        usedAt: now,
        acceptedUserId: user.id,
        updatedAt: now,
      })
      .where(eq(platformAdminInvites.id, invite.id));

    await revokeAllUserSessions(tx, user.id, now);

    return { userId: user.id, createdUser, roleKey };
  });

  await recordAudit(deps.db, {
    actorUserId: result.userId,
    organizationId: null,
    action: "platform.staff.invite_accepted",
    resourceType: "platform_admin_invite",
    resourceId: invite.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { roleKey: result.roleKey, createdUser: result.createdUser },
  });

  return {
    userId: result.userId,
    email,
    roleKey: result.roleKey,
    createdUser: result.createdUser,
    next: {
      loginRequired: true,
      mfaSetupRequired: true,
      message:
        "Conta administrativa ativada. Entre com o e-mail e a senha definidos e configure a autenticação em dois fatores.",
    },
  };
}

export async function getPlatformDashboard(
  deps: PlatformAdminDeps,
  account: SessionAccount,
) {
  requirePlatformPermission(account, "platform.dashboard.read");
  const now = new Date();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [
    usersTotal,
    usersActive,
    orgsTotal,
    newUsersDay,
    newUsersMonth,
    sessionsActive,
    staffActive,
    creditRows,
  ] = await Promise.all([
    deps.db.select({ n: count() }).from(users),
    deps.db.select({ n: count() }).from(users).where(eq(users.status, "active")),
    deps.db.select({ n: count() }).from(organizations),
    deps.db.select({ n: count() }).from(users).where(gte(users.createdAt, dayStart)),
    deps.db.select({ n: count() }).from(users).where(gte(users.createdAt, monthStart)),
    deps.db
      .select({ n: count() })
      .from(sessions)
      .where(and(isNull(sessions.revokedAt), gte(sessions.expiresAt, now))),
    deps.db.select({ n: count() }).from(platformStaff).where(eq(platformStaff.status, "active")),
    deps.db
      .select({
        balance: sql<string>`coalesce(sum(${jurisWorkCreditBalances.balance}), 0)::text`,
      })
      .from(jurisWorkCreditBalances),
  ]);

  let aiSpendMonthMicros: number | null = null;
  try {
    const [row] = await deps.db
      .select({
        total: sql<string>`coalesce(sum(${aiUsage.estimatedCostMicros}), 0)::text`,
      })
      .from(aiUsage)
      .where(gte(aiUsage.recordedAt, monthStart));
    aiSpendMonthMicros = Number(row?.total ?? 0);
  } catch {
    aiSpendMonthMicros = null;
  }

  return {
    period: {
      dayStart: iso(dayStart),
      monthStart: iso(monthStart),
      generatedAt: iso(now),
    },
    metrics: {
      usersRegistered: Number(usersTotal[0]?.n ?? 0),
      usersActive: Number(usersActive[0]?.n ?? 0),
      organizations: Number(orgsTotal[0]?.n ?? 0),
      newRegistrationsToday: Number(newUsersDay[0]?.n ?? 0),
      newRegistrationsMonth: Number(newUsersMonth[0]?.n ?? 0),
      activeSessions: Number(sessionsActive[0]?.n ?? 0),
      platformStaffActive: Number(staffActive[0]?.n ?? 0),
      workCreditsBalanceTotal: Number(creditRows[0]?.balance ?? 0),
      aiEstimatedSpendMonthMicros: aiSpendMonthMicros,
      /** Campos financeiros de PSP: só quando houver dados reais — sem inventar receita. */
      subscriptions: null as number | null,
      confirmedRevenueCents: null as number | null,
      pendingPayments: null as number | null,
      cancellations: null as number | null,
      refunds: null as number | null,
      supportTicketsOpen: null as number | null,
      socialReportsOpen: null as number | null,
    },
    notes: [
      "Indicadores financeiros de PSP aparecem quando houver registros confirmados no banco.",
      "Não confundir faturamento, receita recebida, saldo disponível e lucro.",
    ],
  };
}

export async function listPlatformUsers(
  deps: PlatformAdminDeps,
  account: SessionAccount,
  query: { q?: string; status?: string; limit?: number; offset?: number },
) {
  requirePlatformPermission(account, "platform.users.read");
  const limit = query.limit ?? 50;
  const offset = query.offset ?? 0;
  const filters = [];
  if (query.status) {
    filters.push(
      eq(
        users.status,
        query.status as "active" | "pending_verification" | "suspended" | "disabled",
      ),
    );
  }
  if (query.q) {
    const term = `%${query.q}%`;
    filters.push(or(ilike(users.email, term), ilike(profiles.displayName, term))!);
  }

  const rows = await deps.db
    .select({
      id: users.id,
      email: users.email,
      status: users.status,
      emailVerifiedAt: users.emailVerifiedAt,
      lastLoginAt: users.lastLoginAt,
      mfaEnabled: users.mfaEnabled,
      createdAt: users.createdAt,
      displayName: profiles.displayName,
    })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    items: rows.map((row) => ({
      id: row.id,
      email: row.email,
      displayName: row.displayName,
      status: row.status,
      emailVerified: Boolean(row.emailVerifiedAt),
      lastLoginAt: row.lastLoginAt ? iso(row.lastLoginAt) : null,
      mfaEnabled: row.mfaEnabled,
      createdAt: iso(row.createdAt),
    })),
    limit,
    offset,
  };
}

export async function updatePlatformUserStatus(
  deps: PlatformAdminDeps,
  account: SessionAccount,
  userId: string,
  input: { status: "active" | "suspended" | "disabled"; reason: string },
  meta: RequestMeta,
) {
  requirePlatformPermission(account, "platform.users.suspend");
  if (userId === account.user.id) {
    throw new AppError("VALIDATION_ERROR", "Não é permitido alterar o próprio status por esta via.");
  }

  const target = await deps.db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!target) throw new AppError("NOT_FOUND", "Usuário não encontrado.");

  const targetStaff = await deps.db.query.platformStaff.findMany({
    where: and(eq(platformStaff.userId, userId), eq(platformStaff.status, "active")),
  });
  if (targetStaff.some((s) => s.roleKey === "SUPER_ADMIN")) {
    const otherSupers = await deps.db
      .select({ n: count() })
      .from(platformStaff)
      .where(
        and(
          eq(platformStaff.roleKey, "SUPER_ADMIN"),
          eq(platformStaff.status, "active"),
          ne(platformStaff.userId, userId),
        ),
      );
    if (Number(otherSupers[0]?.n ?? 0) === 0 && input.status !== "active") {
      throw new AppError(
        "VALIDATION_ERROR",
        "Não é permitido desativar o último SUPER_ADMIN ativo.",
      );
    }
  }

  await deps.db
    .update(users)
    .set({ status: input.status, updatedAt: new Date() })
    .where(eq(users.id, userId));

  if (input.status !== "active") {
    await revokeAllUserSessions(deps.db, userId);
  }

  await recordAudit(deps.db, {
    actorUserId: account.user.id,
    organizationId: null,
    action: "platform.users.status_changed",
    resourceType: "user",
    resourceId: userId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { status: input.status, reason: input.reason },
  });

  return { id: userId, status: input.status };
}

export async function listPlatformOrganizations(
  deps: PlatformAdminDeps,
  account: SessionAccount,
  query: { q?: string; limit?: number; offset?: number },
) {
  requirePlatformPermission(account, "platform.orgs.read");
  const limit = query.limit ?? 50;
  const offset = query.offset ?? 0;
  const rows = await deps.db.query.organizations.findMany({
    where: query.q ? ilike(organizations.name, `%${query.q}%`) : undefined,
    orderBy: [desc(organizations.createdAt)],
    limit,
    offset,
  });
  return {
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.status,
      internalCompany: row.internalCompany,
      createdAt: iso(row.createdAt),
    })),
    limit,
    offset,
  };
}

export async function updatePlatformOrgStatus(
  deps: PlatformAdminDeps,
  account: SessionAccount,
  organizationId: string,
  input: { status: "active" | "suspended"; reason: string },
  meta: RequestMeta,
) {
  requirePlatformPermission(account, "platform.orgs.write");
  const org = await deps.db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
  });
  if (!org) throw new AppError("NOT_FOUND", "Organização não encontrada.");

  await deps.db
    .update(organizations)
    .set({ status: input.status, updatedAt: new Date() })
    .where(eq(organizations.id, organizationId));

  await recordAudit(deps.db, {
    actorUserId: account.user.id,
    organizationId,
    action: "platform.orgs.status_changed",
    resourceType: "organization",
    resourceId: organizationId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { status: input.status, reason: input.reason },
  });

  return { id: organizationId, status: input.status };
}

function classifyIntegration(input: {
  configured: boolean;
  healthStatus?: string;
  liveGate?: boolean;
  homologated?: boolean;
}): {
  classification:
    | "configured_homologated"
    | "configured_not_homologated"
    | "partial"
    | "not_configured"
    | "unavailable";
  label: string;
} {
  if (!input.configured) {
    return { classification: "not_configured", label: "Não configurada" };
  }
  if (input.healthStatus === "unavailable") {
    return { classification: "unavailable", label: "Indisponível" };
  }
  if (input.homologated === true && input.healthStatus === "ok") {
    return { classification: "configured_homologated", label: "Configurada e homologada" };
  }
  if (input.healthStatus === "degraded" || input.healthStatus === "ok") {
    return {
      classification: "configured_not_homologated",
      label: "Configurada, mas não homologada",
    };
  }
  return { classification: "partial", label: "Parcialmente funcional" };
}

export async function getPlatformIntegrationsHealth(
  deps: PlatformAdminDeps,
  account: SessionAccount,
) {
  requirePlatformPermission(account, "platform.integrations.read");
  const checkedAt = new Date().toISOString();

  const [emailHealth, paymentHealth, aiHealth] = await Promise.all([
    deps.emailHealth?.() ??
      Promise.resolve({ status: "not_configured", detail: "Provider não injetado.", checkedAt }),
    deps.paymentHealth?.() ??
      Promise.resolve({ status: "not_configured", detail: "Provider não injetado.", checkedAt }),
    deps.gateway?.healthCheck() ??
      Promise.resolve({ status: "not_configured" as const, detail: "Gateway ausente.", checkedAt }),
  ]);

  const emailConfigured = (deps.emailProviderMode ?? "not_configured") === "resend";
  const paymentConfigured = (deps.paymentProviderMode ?? "not_configured") === "asaas";
  const aiConfigured =
    Boolean(deps.featureAi) &&
    (deps.aiProviderMode ?? "not_configured") === "openai" &&
    Boolean(deps.openaiKeyPresent);

  const emailClass = classifyIntegration({
    configured: emailConfigured,
    healthStatus: emailHealth.status,
    homologated: false,
  });
  const paymentClass = classifyIntegration({
    configured: paymentConfigured,
    healthStatus: paymentHealth.status,
    liveGate: deps.paymentsLive === true,
    homologated: false,
  });
  const aiClass = classifyIntegration({
    configured: aiConfigured,
    healthStatus: aiHealth.status,
    homologated: false,
  });

  return {
    generatedAt: checkedAt,
    items: [
      {
        key: "resend",
        name: "Resend (e-mail)",
        environment: deps.emailProviderMode ?? "not_configured",
        status: emailHealth.status,
        detail: emailHealth.detail ?? null,
        lastCheckedAt: emailHealth.checkedAt ?? checkedAt,
        ...emailClass,
        pendencies: emailConfigured
          ? ["Homologar domínio remetente e fluxos de cadastro/recuperação."]
          : ["Definir EMAIL_PROVIDER=resend e credenciais no servidor."],
      },
      {
        key: "openai",
        name: "OpenAI (Juris One)",
        environment: deps.aiProviderMode ?? "not_configured",
        status: aiHealth.status,
        detail: aiHealth.detail ?? null,
        lastCheckedAt: "checkedAt" in aiHealth ? aiHealth.checkedAt : checkedAt,
        featureAi: Boolean(deps.featureAi),
        keyPresent: Boolean(deps.openaiKeyPresent),
        ...aiClass,
        pendencies: aiConfigured
          ? ["Homologar modelos, streaming e limites financeiros."]
          : ["Ativar FEATURE_AI, AI_PROVIDER=openai e chave no servidor."],
      },
      {
        key: "asaas",
        name: "Asaas (pagamentos)",
        environment: deps.paymentProviderMode ?? "not_configured",
        status: paymentHealth.status,
        detail: paymentHealth.detail ?? null,
        lastCheckedAt: paymentHealth.checkedAt ?? checkedAt,
        paymentsLive: Boolean(deps.paymentsLive),
        ...paymentClass,
        pendencies: paymentConfigured
          ? [
              deps.paymentsLive
                ? "PAYMENTS_LIVE=1 — validar sandbox/homologação antes de produção."
                : "Provider presente com cobrança real bloqueada (PAYMENTS_LIVE≠1).",
              "Homologar Pix/boleto/cartão, webhooks e conciliação.",
            ]
          : ["Configurar PAYMENT_PROVIDER=asaas e credenciais no servidor."],
      },
    ],
  };
}

export async function listPlatformStaff(
  deps: PlatformAdminDeps,
  account: SessionAccount,
) {
  requirePlatformPermission(account, "platform.staff.manage");
  const rows = await deps.db.query.platformStaff.findMany({
    orderBy: [desc(platformStaff.createdAt)],
    limit: 100,
  });
  const userIds = [...new Set(rows.map((r) => r.userId))];
  const userRows =
    userIds.length === 0
      ? []
      : await deps.db
          .select({
            id: users.id,
            email: users.email,
            displayName: profiles.displayName,
            mfaEnabled: users.mfaEnabled,
          })
          .from(users)
          .leftJoin(profiles, eq(profiles.userId, users.id))
          .where(inArray(users.id, userIds));

  const byId = new Map(userRows.map((u) => [u.id, u]));
  return {
    items: rows.map((row) => {
      const u = byId.get(row.userId);
      return {
        id: row.id,
        userId: row.userId,
        email: u?.email ?? null,
        displayName: u?.displayName ?? null,
        roleKey: row.roleKey,
        status: row.status,
        mfaRequired: row.mfaRequired,
        mfaEnabled: u?.mfaEnabled ?? false,
        forcePasswordChange: row.forcePasswordChange,
        activatedAt: row.activatedAt ? iso(row.activatedAt) : null,
        createdAt: iso(row.createdAt),
      };
    }),
  };
}

export { BOOTSTRAP_EMAIL };
