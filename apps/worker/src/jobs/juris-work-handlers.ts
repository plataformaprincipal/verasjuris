/**
 * Continuação de tarefas Juris One Work via HTTP/cron do worker Vercel.
 *
 * Não é Vercel Workflow. Checkpoints = status das etapas no PostgreSQL.
 * Invocação: POST /internal/jobs/run { "type": "juris_work.continue", "payload": { ... } }
 * com header x-worker-invoke-secret (docs/PRODUCTION_DEPLOY.md).
 */
import { createAiGatewayFromEnv } from "@verasjuris/ai";
import type { SessionAccount } from "@verasjuris/auth";
import type { AppDatabase } from "@verasjuris/database";
import {
  jurisWorkSteps,
  jurisWorkTasks,
  organizationMembers,
  organizations,
  profiles,
  users,
} from "@verasjuris/database";
import type { JobHandler, JobRecord } from "@verasjuris/events";
import { AppError } from "@verasjuris/types";
import { runNextJurisWorkStep } from "@verasjuris/api/juris-work/service";
import { and, asc, eq, inArray } from "drizzle-orm";

export const JURIS_WORK_CONTINUE_JOB = "juris_work.continue";

type ContinuePayload = {
  organizationId?: string;
  taskId?: string;
  actorUserId?: string;
  maxSteps?: number;
};

type HandlerHost = {
  registerHandler(type: string, handler: JobHandler): void;
};

async function loadActorAccount(
  db: AppDatabase,
  userId: string,
  organizationId: string,
): Promise<SessionAccount | null> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return null;
  const profile = await db.query.profiles.findFirst({ where: eq(profiles.userId, userId) });
  const membership = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.userId, userId),
      eq(organizationMembers.organizationId, organizationId),
      eq(organizationMembers.status, "active"),
    ),
  });
  if (!membership) return null;
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
  });
  if (!org) return null;

  return {
    sessionId: `worker-continue-${userId}`,
    user: {
      id: user.id,
      email: user.email,
      displayName: profile?.displayName ?? user.email,
      locale: profile?.locale ?? "pt-BR",
      timeZone: profile?.timeZone ?? "America/Sao_Paulo",
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
      onboardingPersona: profile?.onboardingPersona ?? null,
    },
    professionalVerificationStatus: "not_submitted",
    memberships: [
      {
        membershipId: membership.id,
        organizationId,
        organizationName: org.name,
        organizationSlug: org.slug,
        organizationStatus: org.status === "suspended" ? "suspended" : "active",
        membershipStatus: "active",
        roles: ["member"],
        permissions: [
          "ai.use",
          "document.read",
          "matter.read",
          "deadline.read",
          "task.read",
          "crm.read",
          "assistant.use",
        ],
      },
    ],
    platform: null,
  };
}

export function registerJurisWorkHandlers(host: HandlerHost, db: AppDatabase): void {
  host.registerHandler(JURIS_WORK_CONTINUE_JOB, async (job: JobRecord) => {
    const payload = (job.payload ?? {}) as ContinuePayload;
    const maxSteps = Math.min(Math.max(payload.maxSteps ?? 1, 1), 5);
    const gateway = createAiGatewayFromEnv(process.env);

    const tasks = await db.query.jurisWorkTasks.findMany({
      where: payload.taskId
        ? and(eq(jurisWorkTasks.id, payload.taskId), eq(jurisWorkTasks.status, "running"))
        : eq(jurisWorkTasks.status, "running"),
      orderBy: [asc(jurisWorkTasks.updatedAt)],
      limit: 10,
    });

    for (const task of tasks) {
      if (payload.organizationId && task.organizationId !== payload.organizationId) continue;

      const actorId = payload.actorUserId ?? task.approvedByUserId ?? task.createdByUserId;
      const account = await loadActorAccount(db, actorId, task.organizationId);
      if (!account) continue;

      const pending = await db.query.jurisWorkSteps.findFirst({
        where: and(
          eq(jurisWorkSteps.taskId, task.id),
          inArray(jurisWorkSteps.status, ["pending", "awaiting_approval"]),
        ),
        orderBy: [asc(jurisWorkSteps.stepIndex)],
      });
      if (!pending || pending.status === "awaiting_approval") continue;

      let stepsRun = 0;
      while (stepsRun < maxSteps) {
        try {
          const result = await runNextJurisWorkStep(
            db,
            account,
            task.organizationId,
            task.id,
            { requestId: `worker:${job.id}`, ip: null, userAgent: "worker/juris_work.continue" },
            { gateway },
          );
          stepsRun += 1;
          if (result.done) break;
        } catch (error) {
          if (error instanceof AppError && error.code === "AUTHORIZATION_ERROR") break;
          throw error;
        }
      }
    }
  });
}
