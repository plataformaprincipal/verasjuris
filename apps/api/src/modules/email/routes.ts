import { Readable } from "node:stream";
import type { FastifyInstance } from "fastify";
import type { ApiDeps } from "../auth/routes.js";
import { handleResendEmailWebhook } from "./webhook.js";
import { emailDispatches, emailProviderEvents } from "@verasjuris/database";
import { requireAccount } from "../auth/routes.js";
import { requirePlatformPermission } from "../platform-admin/authorize.js";
import { AppError } from "@verasjuris/types";
import { and, desc, eq, gte, sql } from "drizzle-orm";

type RequestWithRawBody = { rawBody?: Buffer };

/**
 * Webhook Resend + métricas administrativas de e-mail.
 * CSRF é ignorado em `/webhooks/` via http guards.
 */
export function registerEmailRoutes(app: FastifyInstance, deps: ApiDeps) {
  app.post(
    "/webhooks/email/resend",
    {
      config: { rawBody: true },
      preParsing: async (request, _reply, payload) => {
        const chunks: Buffer[] = [];
        for await (const chunk of payload) {
          chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk));
        }
        const raw = Buffer.concat(chunks);
        (request as RequestWithRawBody).rawBody = raw;
        return Readable.from(raw);
      },
    },
    async (request, reply) => {
      const rawBody =
        (request as RequestWithRawBody).rawBody ??
        Buffer.from(
          typeof request.body === "string" ? request.body : JSON.stringify(request.body ?? {}),
        );
      const result = await handleResendEmailWebhook(deps.db, {
        rawBody,
        headers: request.headers as Record<string, string | string[] | undefined>,
        webhookSecret: deps.resendWebhookSecret,
      });
      return reply.status(200).send(result);
    },
  );

  app.get("/admin/email/stats", async (request) => {
    const account = await requireAccount(deps, request);
    requirePlatformPermission(account, "platform.integrations.read");

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [totals] = await deps.db
      .select({
        total: sql<number>`count(*)::int`,
        sentToProvider: sql<number>`count(*) filter (where ${emailDispatches.status} = 'sent_to_provider')::int`,
        delivered: sql<number>`count(*) filter (where ${emailDispatches.status} = 'delivered')::int`,
        bounced: sql<number>`count(*) filter (where ${emailDispatches.status} = 'bounced')::int`,
        complained: sql<number>`count(*) filter (where ${emailDispatches.status} = 'complained')::int`,
        failed: sql<number>`count(*) filter (where ${emailDispatches.status} = 'failed')::int`,
        queued: sql<number>`count(*) filter (where ${emailDispatches.status} = 'queued')::int`,
      })
      .from(emailDispatches)
      .where(gte(emailDispatches.createdAt, since));

    const recent = await deps.db.query.emailDispatches.findMany({
      orderBy: desc(emailDispatches.createdAt),
      limit: 50,
    });

    const recentEvents = await deps.db.query.emailProviderEvents.findMany({
      orderBy: desc(emailProviderEvents.receivedAt),
      limit: 50,
    });

    return {
      provider: {
        mode: deps.email.status,
        webhookConfigured: Boolean(deps.resendWebhookSecret?.trim()),
      },
      windowDays: 30,
      totals: totals ?? {
        total: 0,
        sentToProvider: 0,
        delivered: 0,
        bounced: 0,
        complained: 0,
        failed: 0,
        queued: 0,
      },
      recentDispatches: recent.map((row) => ({
        id: row.id,
        kind: row.kind,
        status: row.status,
        category: row.category,
        providerMessageId: row.providerMessageId,
        organizationId: row.organizationId,
        createdAt: row.createdAt.toISOString(),
        sentAt: row.sentAt?.toISOString() ?? null,
        errorCode: row.errorCode,
      })),
      recentEvents: recentEvents.map((row) => ({
        id: row.id,
        eventType: row.eventType,
        status: row.status,
        providerMessageId: row.providerMessageId,
        receivedAt: row.receivedAt.toISOString(),
        errorCode: row.errorCode,
      })),
    };
  });

  app.get("/admin/email/dispatches/:id", async (request) => {
    const account = await requireAccount(deps, request);
    requirePlatformPermission(account, "platform.integrations.read");
    const params = request.params as { id?: string };
    const row = await deps.db.query.emailDispatches.findFirst({
      where: eq(emailDispatches.id, String(params.id ?? "")),
    });
    if (!row) throw new AppError("NOT_FOUND", "Despacho de e-mail não encontrado.");
    const events = await deps.db.query.emailProviderEvents.findMany({
      where: and(eq(emailProviderEvents.dispatchId, row.id)),
      orderBy: desc(emailProviderEvents.receivedAt),
      limit: 100,
    });
    return {
      dispatch: {
        id: row.id,
        kind: row.kind,
        status: row.status,
        category: row.category,
        subject: row.subject,
        providerKey: row.providerKey,
        providerMessageId: row.providerMessageId,
        organizationId: row.organizationId,
        recipientUserId: row.recipientUserId,
        errorCode: row.errorCode,
        createdAt: row.createdAt.toISOString(),
        sentAt: row.sentAt?.toISOString() ?? null,
      },
      events: events.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        status: e.status,
        receivedAt: e.receivedAt.toISOString(),
      })),
    };
  });
}
