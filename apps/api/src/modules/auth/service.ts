import { recordAudit } from "@verasjuris/audit";
import {
  findSession,
  revokeAllUserSessions,
  revokeOtherSessions,
  revokeSession,
  toPublicSession,
  type SessionAccount,
} from "@verasjuris/auth";
import type { AppDatabase } from "@verasjuris/database";
import {
  emailVerificationTokens,
  isUniqueViolation,
  lawyerProfiles,
  membershipRoles,
  organizationMembers,
  organizations,
  partnerProfiles,
  passwordResetTokens,
  professionalProfiles,
  profiles,
  roles,
  sessions,
  users,
} from "@verasjuris/database";
import {
  publicEmailDeliveryMessage,
  type EmailDeliveryStatus,
  type EmailProvider,
} from "@verasjuris/email";
import type { InProcessEventBus } from "@verasjuris/events";
import {
  EMAIL_VERIFICATION_TTL_MS,
  generateOpaqueToken,
  generateSessionToken,
  hashOpaqueToken,
  hashPassword,
  PASSWORD_RESET_TTL_MS,
  SESSION_TTL_MS,
  verifyPasswordOrDummy,
} from "@verasjuris/security";
import { AppError } from "@verasjuris/types";
import {
  ONBOARDING_PERSONA_META,
  slugifyName,
  type OnboardingPersona,
  type OnboardingRegisterInput,
} from "@verasjuris/validation";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { ensureCrmCatalog } from "../crm/catalog.js";
import { ensureLegalAreasCatalog } from "../intake/catalog.js";
import { ensureJudicialReferenceCatalog } from "../judicial/catalog.js";
import { ensureDemandTypesCatalog } from "../matters/catalog.js";
import { ensureLossReasonsCatalog } from "../pipeline/catalog.js";

export type RequestMeta = {
  requestId: string;
  ip: string | null;
  userAgent: string | null;
};

export type AuthEmailContext = {
  provider: EmailProvider;
  webOrigin: string;
};

type Writer = Pick<AppDatabase, "insert" | "update" | "transaction" | "query" | "delete">;

const LOGIN_FAILURE_MESSAGE =
  "Não foi possível entrar. Confira e-mail e senha. Nenhuma sessão foi aberta.";

const NEUTRAL_ACCOUNT_MESSAGE =
  "Se existir uma conta elegível para este e-mail, enviaremos as próximas instruções.";

async function issueSession(
  db: Writer,
  userId: string,
  meta: RequestMeta,
  now = new Date(),
): Promise<{ token: string; sessionId: string }> {
  const { token, hash } = generateSessionToken();
  const [session] = await db
    .insert(sessions)
    .values({
      userId,
      tokenHash: hash,
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
      ip: meta.ip,
      userAgent: meta.userAgent,
    })
    .returning({ id: sessions.id });
  if (!session) {
    throw new AppError(
      "INTERNAL_ERROR",
      "Não foi possível abrir a sessão. Nenhuma sessão foi confirmada. Tente novamente.",
    );
  }
  return { token, sessionId: session.id };
}

function verificationLink(webOrigin: string, token: string): string {
  return `${webOrigin}/verificar-email?token=${encodeURIComponent(token)}`;
}

function resetLink(webOrigin: string, token: string): string {
  return `${webOrigin}/redefinir-senha?token=${encodeURIComponent(token)}`;
}

/** Status público do provider — não revela se o e-mail existe. */
function publicProviderDelivery(provider: EmailProvider): EmailDeliveryStatus {
  return provider.status === "memory" ? "captured" : "not_configured";
}

function neutralAccepted(provider: EmailProvider): {
  status: "accepted";
  emailDelivery: EmailDeliveryStatus;
  message: string;
} {
  const emailDelivery = publicProviderDelivery(provider);
  return {
    status: "accepted",
    emailDelivery,
    message: `${NEUTRAL_ACCOUNT_MESSAGE} ${publicEmailDeliveryMessage(emailDelivery)}`,
  };
}

async function createVerificationToken(
  db: Writer,
  userId: string,
  now = new Date(),
): Promise<string> {
  await db
    .update(emailVerificationTokens)
    .set({ usedAt: now })
    .where(
      and(
        eq(emailVerificationTokens.userId, userId),
        isNull(emailVerificationTokens.usedAt),
        gt(emailVerificationTokens.expiresAt, now),
      ),
    );
  const { token, hash } = generateOpaqueToken();
  await db.insert(emailVerificationTokens).values({
    userId,
    tokenHash: hash,
    expiresAt: new Date(now.getTime() + EMAIL_VERIFICATION_TTL_MS),
  });
  return token;
}

export type RegisterAccountInput =
  | { mode: "legacy"; displayName: string; email: string; password: string }
  | ({ mode: "onboarding" } & OnboardingRegisterInput);

function organizationNameFor(input: RegisterAccountInput): string {
  if (input.mode === "legacy") return `Espaço de ${input.displayName}`;
  if (input.organizationName?.trim()) return input.organizationName.trim();
  if (input.persona === "lawyer") return `Escritório de ${input.fullName}`;
  if (input.persona === "partner_legal" || input.persona === "partner_service") {
    return `Espaço profissional de ${input.fullName}`;
  }
  return `Espaço de ${input.fullName}`;
}

function redirectFor(persona: OnboardingPersona | "legacy"): "/app" | "/portal" {
  if (persona === "legacy") return "/app";
  return ONBOARDING_PERSONA_META[persona].redirectTo;
}

export async function registerAccount(
  db: AppDatabase,
  input: RegisterAccountInput,
  meta: RequestMeta,
  events: InProcessEventBus,
  _email: AuthEmailContext,
): Promise<{
  status: "created";
  token: string;
  account: ReturnType<typeof toPublicSession>;
  redirectTo: "/app" | "/portal";
  emailVerified: false;
  message: string;
}> {
  const emailAddress = input.email;
  const displayName = input.mode === "legacy" ? input.displayName : input.displayName;
  const password = input.password;
  const persona: OnboardingPersona | "legacy" =
    input.mode === "legacy" ? "legacy" : input.persona;

  const existing = await db.query.users.findFirst({ where: eq(users.email, emailAddress) });
  if (existing) {
    throw new AppError(
      "CONFLICT",
      "Não foi possível criar a conta com os dados informados. Se você já possui acesso, entre com seu e-mail e senha.",
    );
  }

  if (input.mode === "onboarding" && input.cpf) {
    const cpfOwner = await db.query.profiles.findFirst({
      where: eq(profiles.cpfNormalized, input.cpf),
    });
    if (cpfOwner) {
      throw new AppError(
        "CONFLICT",
        "Não foi possível criar a conta com os dados informados. Se você já possui acesso, entre com seu e-mail e senha.",
      );
    }
  }

  const passwordHash = await hashPassword(password);
  const now = new Date();
  let userId = "";
  let sessionToken = "";

  try {
    const created = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email: emailAddress,
          passwordHash,
          status: "active",
          emailVerifiedAt: null,
          lastLoginAt: now,
        })
        .returning({ id: users.id });
      if (!user) {
        throw new AppError(
          "INTERNAL_ERROR",
          "Não foi possível criar a conta. Nenhuma conta foi registrada. Tente novamente.",
        );
      }

      await tx.insert(profiles).values({
        userId: user.id,
        displayName,
        socialName: input.mode === "onboarding" ? input.socialName ?? null : null,
        phoneE164: input.mode === "onboarding" ? input.phone : null,
        cpfNormalized: input.mode === "onboarding" ? input.cpf ?? null : null,
        birthDate:
          input.mode === "onboarding" && input.birthDate
            ? new Date(`${input.birthDate}T12:00:00.000Z`)
            : null,
        addressJson:
          input.mode === "onboarding" ? JSON.stringify(input.address) : null,
        onboardingPersona: persona === "legacy" ? "client_pf" : persona,
        termsAcceptedAt: now,
        termsVersion: input.mode === "onboarding" ? input.termsVersion : "2026-11",
        privacyAcceptedAt: now,
        privacyVersion: input.mode === "onboarding" ? input.privacyVersion : "2026-11",
      });
      await tx.insert(professionalProfiles).values({
        userId: user.id,
        verificationStatus:
          persona === "lawyer" || persona === "law_firm" || persona === "partner_legal"
            ? "pending"
            : "not_submitted",
      });

      const orgName = organizationNameFor(input);
      const baseSlug = slugifyName(orgName);
      let slug = baseSlug;
      for (let index = 0; index < 20; index += 1) {
        const candidate = index === 0 ? baseSlug : `${baseSlug}-${index + 1}`.slice(0, 70);
        const clash = await tx.query.organizations.findFirst({
          where: eq(organizations.slug, candidate),
        });
        if (!clash) {
          slug = candidate;
          break;
        }
      }

      const ownerRole = await tx.query.roles.findFirst({
        where: and(eq(roles.key, "owner"), eq(roles.isSystem, true)),
      });
      if (!ownerRole) {
        throw new AppError(
          "INTERNAL_ERROR",
          "Os papéis de referência não estão disponíveis. Nenhuma alteração foi confirmada. Execute a carga inicial do banco.",
        );
      }

      const [organization] = await tx
        .insert(organizations)
        .values({ name: orgName, slug, createdByUserId: user.id })
        .returning({ id: organizations.id });
      if (!organization) {
        throw new AppError(
          "INTERNAL_ERROR",
          "Não foi possível criar a organização. Nenhuma conta foi concluída. Tente novamente.",
        );
      }
      const [membership] = await tx
        .insert(organizationMembers)
        .values({ organizationId: organization.id, userId: user.id, status: "active" })
        .returning({ id: organizationMembers.id });
      if (!membership) {
        throw new AppError(
          "INTERNAL_ERROR",
          "Não foi possível vincular a organização. Nenhuma conta foi concluída. Tente novamente.",
        );
      }
      await tx.insert(membershipRoles).values({ membershipId: membership.id, roleId: ownerRole.id });

      if (
        (persona === "lawyer" || persona === "law_firm") &&
        input.mode === "onboarding" &&
        input.oabNumber &&
        input.oabUf
      ) {
        await tx.insert(lawyerProfiles).values({
          userId: user.id,
          professionalName: input.fullName,
          oabNumber: input.oabNumber,
          oabUf: input.oabUf,
          oabSection: input.oabUf,
          practiceAreas: input.practiceAreas,
          oabVerificationStatus: "informed",
          visibility: "private",
        });
      }

      if (
        (persona === "partner_legal" || persona === "partner_service") &&
        input.mode === "onboarding" &&
        input.partnerCategory
      ) {
        await tx.insert(partnerProfiles).values({
          userId: user.id,
          category: input.partnerCategory,
          presentation: input.partnerDescription,
          visibility: "organization",
        });
      }

      const session = await issueSession(tx, user.id, meta, now);
      await recordAudit(tx, {
        actorUserId: user.id,
        organizationId: organization.id,
        action: "user.registered",
        resourceType: "user",
        resourceId: user.id,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
        after: {
          status: "active",
          emailVerified: false,
          persona,
          organizationId: organization.id,
        },
      });
      return {
        userId: user.id,
        token: session.token,
        organizationId: organization.id,
      };
    });
    userId = created.userId;
    sessionToken = created.token;

    await ensureCrmCatalog(db, created.organizationId);
    await ensureLegalAreasCatalog(db, created.organizationId);
    await ensureDemandTypesCatalog(db, created.organizationId);
    await ensureLossReasonsCatalog(db, created.organizationId);
    await ensureJudicialReferenceCatalog(db);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(
        "CONFLICT",
        "Não foi possível criar a conta com os dados informados. Se você já possui acesso, entre com seu e-mail e senha.",
      );
    }
    throw error;
  }

  const account = await findSession(db, sessionToken);
  if (!account) {
    throw new AppError(
      "INTERNAL_ERROR",
      "A conta foi criada, mas a sessão não pôde ser confirmada. Entre com seu e-mail e senha.",
    );
  }

  events.publish("auth.registered", { userId, requestId: meta.requestId });
  events.publish("auth.login_succeeded", { userId, requestId: meta.requestId });
  return {
    status: "created",
    token: sessionToken,
    account: toPublicSession(account),
    redirectTo: redirectFor(persona),
    emailVerified: false,
    message:
      "Conta criada com sucesso. Seu e-mail ainda não foi verificado; isso não impede o acesso básico nesta fase.",
  };
}

export async function requestEmailVerification(
  db: AppDatabase,
  emailAddress: string,
  meta: RequestMeta,
  email: AuthEmailContext,
): Promise<{ status: "accepted"; emailDelivery: EmailDeliveryStatus; message: string }> {
  const user = await db.query.users.findFirst({ where: eq(users.email, emailAddress) });
  if (user && user.status !== "disabled" && user.status !== "suspended" && !user.emailVerifiedAt) {
    const token = await createVerificationToken(db, user.id);
    const sent = await email.provider.send({
      kind: "email_verification",
      to: user.email,
      subject: "Confirme seu e-mail no VerasJuris",
      text: `Confirme seu e-mail: ${verificationLink(email.webOrigin, token)}`,
      token,
    });
    await recordAudit(db, {
      actorUserId: user.id,
      action: "email.verification_requested",
      resourceType: "user",
      resourceId: user.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      metadata: { delivery: sent.status },
    });
  }
  return neutralAccepted(email.provider);
}

export async function confirmEmailVerification(
  db: AppDatabase,
  token: string,
  meta: RequestMeta,
): Promise<{ verified: true }> {
  const hash = hashOpaqueToken(token);
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      select id from email_verification_tokens
      where token_hash = ${hash}
      for update
    `);
    const row = await tx.query.emailVerificationTokens.findFirst({
      where: eq(emailVerificationTokens.tokenHash, hash),
    });
    if (!row) {
      throw new AppError(
        "AUTHENTICATION_ERROR",
        "Este link de verificação não é válido. Nenhuma alteração foi feita.",
      );
    }
    if (row.usedAt) {
      throw new AppError(
        "CONFLICT",
        "Este link de verificação já foi utilizado. Nenhuma alteração adicional foi feita.",
      );
    }
    if (row.expiresAt <= now) {
      throw new AppError(
        "AUTHENTICATION_ERROR",
        "Este link de verificação expirou. Solicite um novo. Nenhuma alteração foi feita.",
      );
    }
    const user = await tx.query.users.findFirst({ where: eq(users.id, row.userId) });
    if (!user || user.status === "disabled" || user.status === "suspended") {
      throw new AppError(
        "AUTHENTICATION_ERROR",
        "Este link de verificação não é válido. Nenhuma alteração foi feita.",
      );
    }
    if (user.emailVerifiedAt) {
      await tx
        .update(emailVerificationTokens)
        .set({ usedAt: now })
        .where(eq(emailVerificationTokens.id, row.id));
      return;
    }
    await tx
      .update(emailVerificationTokens)
      .set({ usedAt: now })
      .where(eq(emailVerificationTokens.id, row.id));
    await tx
      .update(users)
      .set({
        status: "active",
        emailVerifiedAt: now,
        updatedAt: now,
      })
      .where(eq(users.id, user.id));
    await recordAudit(tx, {
      actorUserId: user.id,
      action: "email.verified",
      resourceType: "user",
      resourceId: user.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { status: "active", emailVerified: true },
    });
  });
  return { verified: true };
}

export async function loginAccount(
  db: AppDatabase,
  input: { email: string; password: string },
  meta: RequestMeta,
  events: InProcessEventBus,
): Promise<{ token: string; account: ReturnType<typeof toPublicSession> }> {
  const user = await db.query.users.findFirst({ where: eq(users.email, input.email) });
  const matches = await verifyPasswordOrDummy(input.password, user?.passwordHash ?? null);
  const eligible = Boolean(user) && matches && user?.status === "active";
  if (!eligible || !user) {
    await recordAudit(db, {
      actorUserId: user?.id ?? null,
      action: "auth.login_failed",
      resourceType: "session",
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      metadata: { method: "password", result: "rejected" },
    });
    throw new AppError("AUTHENTICATION_ERROR", LOGIN_FAILURE_MESSAGE);
  }
  const now = new Date();
  const issued = await db.transaction(async (tx) => {
    const session = await issueSession(tx, user.id, meta, now);
    await tx.update(users).set({ lastLoginAt: now, updatedAt: now }).where(eq(users.id, user.id));
    await recordAudit(tx, {
      actorUserId: user.id,
      action: "auth.login_succeeded",
      resourceType: "session",
      resourceId: session.sessionId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      metadata: { method: "password" },
    });
    return session;
  });
  const account = await findSession(db, issued.token);
  if (!account) {
    throw new AppError(
      "INTERNAL_ERROR",
      "Não foi possível abrir a sessão. Nenhuma sessão foi confirmada. Tente novamente.",
    );
  }
  events.publish("auth.login_succeeded", { userId: user.id, requestId: meta.requestId });
  return { token: issued.token, account: toPublicSession(account) };
}

export async function logoutAccount(
  db: AppDatabase,
  account: SessionAccount | null,
  meta: RequestMeta,
): Promise<void> {
  if (!account) return;
  await db.transaction(async (tx) => {
    await revokeSession(tx, account.sessionId);
    await recordAudit(tx, {
      actorUserId: account.user.id,
      action: "auth.logout",
      resourceType: "session",
      resourceId: account.sessionId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
    });
  });
}

export async function requestPasswordReset(
  db: AppDatabase,
  emailAddress: string,
  meta: RequestMeta,
  email: AuthEmailContext,
): Promise<{ status: "accepted"; emailDelivery: EmailDeliveryStatus; message: string }> {
  const user = await db.query.users.findFirst({ where: eq(users.email, emailAddress) });
  // Recuperação por e-mail só funciona com provider configurado; conta ativa basta.
  if (user && user.status === "active") {
    const now = new Date();
    await db
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(
        and(
          eq(passwordResetTokens.userId, user.id),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, now),
        ),
      );
    const { token, hash } = generateOpaqueToken();
    await db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash: hash,
      expiresAt: new Date(now.getTime() + PASSWORD_RESET_TTL_MS),
    });
    const sent = await email.provider.send({
      kind: "password_reset",
      to: user.email,
      subject: "Redefinição de senha no VerasJuris",
      text: `Redefina sua senha: ${resetLink(email.webOrigin, token)}`,
      token,
    });
    await recordAudit(db, {
      actorUserId: user.id,
      action: "password.reset_requested",
      resourceType: "user",
      resourceId: user.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      metadata: { delivery: sent.status },
    });
  }
  return neutralAccepted(email.provider);
}

export async function confirmPasswordReset(
  db: AppDatabase,
  input: { token: string; password: string },
  meta: RequestMeta,
): Promise<{ reset: true }> {
  const hash = hashOpaqueToken(input.token);
  const passwordHash = await hashPassword(input.password);
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      select id from password_reset_tokens
      where token_hash = ${hash}
      for update
    `);
    const row = await tx.query.passwordResetTokens.findFirst({
      where: eq(passwordResetTokens.tokenHash, hash),
    });
    if (!row || row.usedAt || row.expiresAt <= now) {
      throw new AppError(
        "AUTHENTICATION_ERROR",
        "Este link de redefinição não é válido ou expirou. Nenhuma senha foi alterada.",
      );
    }
    const user = await tx.query.users.findFirst({ where: eq(users.id, row.userId) });
    const activeUser = user?.status === "active" ? user : null;
    if (!activeUser) {
      throw new AppError(
        "AUTHENTICATION_ERROR",
        "Este link de redefinição não é válido ou expirou. Nenhuma senha foi alterada.",
      );
    }
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(eq(passwordResetTokens.id, row.id));
    await tx.update(users).set({ passwordHash, updatedAt: now }).where(eq(users.id, activeUser.id));
    await revokeAllUserSessions(tx, activeUser.id, now);
    await recordAudit(tx, {
      actorUserId: activeUser.id,
      action: "password.reset_completed",
      resourceType: "user",
      resourceId: activeUser.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      metadata: { sessionsRevoked: true },
    });
  });
  return { reset: true };
}

export async function changePassword(
  db: AppDatabase,
  account: SessionAccount,
  input: { currentPassword: string; newPassword: string },
  meta: RequestMeta,
): Promise<{ changed: true }> {
  const user = await db.query.users.findFirst({ where: eq(users.id, account.user.id) });
  if (!user) {
    throw new AppError(
      "AUTHENTICATION_ERROR",
      "Entre para continuar. Nenhuma alteração foi feita.",
    );
  }
  const matches = await verifyPasswordOrDummy(input.currentPassword, user.passwordHash);
  if (!matches) {
    throw new AppError(
      "AUTHENTICATION_ERROR",
      "A senha atual não confere. Nenhuma alteração foi feita.",
    );
  }
  const passwordHash = await hashPassword(input.newPassword);
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash, updatedAt: now }).where(eq(users.id, user.id));
    await revokeOtherSessions(tx, user.id, account.sessionId, now);
    await recordAudit(tx, {
      actorUserId: user.id,
      action: "password.changed",
      resourceType: "user",
      resourceId: user.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      metadata: { otherSessionsRevoked: true },
    });
  });
  return { changed: true };
}

export async function listSessions(db: AppDatabase, account: SessionAccount) {
  const now = new Date();
  const rows = await db.query.sessions.findMany({
    where: and(
      eq(sessions.userId, account.user.id),
      isNull(sessions.revokedAt),
      gt(sessions.expiresAt, now),
    ),
    orderBy: [desc(sessions.createdAt)],
  });
  return rows.map((row) => ({
    id: row.id,
    current: row.id === account.sessionId,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? row.createdAt.toISOString(),
    ipHint: row.ip ? `${row.ip.split(".").slice(0, 2).join(".")}.*` : null,
    userAgentHint: row.userAgent ? row.userAgent.slice(0, 48) : null,
  }));
}

export async function updateProfile(
  db: AppDatabase,
  account: SessionAccount,
  input: { displayName: string; locale: string; timeZone: string },
  meta: RequestMeta,
) {
  const before = {
    displayName: account.user.displayName,
    locale: account.user.locale,
    timeZone: account.user.timeZone,
  };
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(profiles)
      .set({
        displayName: input.displayName,
        locale: input.locale,
        timeZone: input.timeZone,
        updatedAt: now,
      })
      .where(eq(profiles.userId, account.user.id));
    await recordAudit(tx, {
      actorUserId: account.user.id,
      action: "profile.updated",
      resourceType: "profile",
      resourceId: account.user.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      before,
      after: input,
    });
  });
  return {
    profile: {
      displayName: input.displayName,
      locale: input.locale,
      timeZone: input.timeZone,
    },
  };
}

export async function revokeOwnSession(
  db: AppDatabase,
  account: SessionAccount,
  sessionId: string,
  meta: RequestMeta,
): Promise<void> {
  const row = await db.query.sessions.findFirst({
    where: and(eq(sessions.id, sessionId), eq(sessions.userId, account.user.id)),
  });
  if (!row || row.revokedAt) {
    throw new AppError("NOT_FOUND", "Não encontramos esta sessão no seu acesso.");
  }
  await db.transaction(async (tx) => {
    await revokeSession(tx, sessionId);
    await recordAudit(tx, {
      actorUserId: account.user.id,
      action: "session.revoked",
      resourceType: "session",
      resourceId: sessionId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      metadata: { current: sessionId === account.sessionId },
    });
  });
}

export async function revokeOtherOwnSessions(
  db: AppDatabase,
  account: SessionAccount,
  meta: RequestMeta,
): Promise<void> {
  await db.transaction(async (tx) => {
    await revokeOtherSessions(tx, account.user.id, account.sessionId);
    await recordAudit(tx, {
      actorUserId: account.user.id,
      action: "session.revoked",
      resourceType: "session",
      resourceId: account.sessionId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      metadata: { scope: "others" },
    });
  });
}

export type { EmailDeliveryStatus };
