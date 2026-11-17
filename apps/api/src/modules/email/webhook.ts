import { verifyResendWebhookSignature } from "@verasjuris/email";
import { recordAudit } from "@verasjuris/audit";
import {
  emailDispatches,
  emailProviderEvents,
  isUniqueViolation,
  type AppDatabase,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";

type ResendWebhookBody = {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    created_at?: string;
    to?: string[];
    subject?: string;
  };
};

function mapLifecycle(eventType: string): string | null {
  switch (eventType) {
    case "email.delivered":
      return "delivered";
    case "email.bounced":
    case "email.failed":
      return "bounced";
    case "email.complained":
      return "complained";
    case "email.sent":
    case "email.delivery_delayed":
      return null;
    default:
      return null;
  }
}

export async function handleResendEmailWebhook(
  db: AppDatabase,
  input: {
    rawBody: string | Uint8Array;
    headers: Record<string, string | string[] | undefined>;
    webhookSecret: string | undefined;
  },
) {
  const secret = input.webhookSecret?.trim();
  if (!secret) {
    throw new AppError(
      "NOT_CONFIGURED",
      "Webhook Resend não configurado (RESEND_WEBHOOK_SECRET ausente).",
    );
  }

  const verified = verifyResendWebhookSignature({
    rawBody: input.rawBody,
    headers: input.headers,
    secret,
  });
  if (!verified.valid) {
    throw new AppError(
      "AUTHORIZATION_ERROR",
      verified.timestampOutOfTolerance
        ? "Timestamp de webhook fora da tolerância."
        : "Assinatura de webhook inválida.",
    );
  }

  const raw =
    typeof input.rawBody === "string" ? input.rawBody : Buffer.from(input.rawBody).toString("utf8");
  let body: ResendWebhookBody;
  try {
    body = JSON.parse(raw) as ResendWebhookBody;
  } catch {
    throw new AppError("VALIDATION_ERROR", "Payload de webhook inválido.");
  }

  const eventType = (body.type ?? "unknown").trim();
  const providerMessageId = body.data?.email_id?.trim() || null;
  const svixIdHeader = input.headers["svix-id"] ?? input.headers["Svix-Id"];
  const externalEventId = (
    Array.isArray(svixIdHeader) ? svixIdHeader[0] : svixIdHeader
  )?.trim() || createHash("sha256").update(raw).digest("hex");
  const payloadHash = createHash("sha256").update(raw).digest("hex");

  const duplicate = await db.query.emailProviderEvents.findFirst({
    where: and(
      eq(emailProviderEvents.providerKey, "resend"),
      eq(emailProviderEvents.externalEventId, externalEventId),
    ),
  });
  if (duplicate) {
    return {
      status: "already_processed" as const,
      eventId: duplicate.id,
    };
  }

  let eventRow: typeof emailProviderEvents.$inferSelect;
  try {
    const [created] = await db
      .insert(emailProviderEvents)
      .values({
        providerKey: "resend",
        externalEventId,
        eventType,
        providerMessageId,
        payloadHash,
        status: "processing",
      })
      .returning();
    eventRow = created!;
  } catch (error) {
    if (isUniqueViolation(error)) {
      const raced = await db.query.emailProviderEvents.findFirst({
        where: and(
          eq(emailProviderEvents.providerKey, "resend"),
          eq(emailProviderEvents.externalEventId, externalEventId),
        ),
      });
      return {
        status: "already_processed" as const,
        eventId: raced?.id ?? null,
      };
    }
    throw error;
  }

  const lifecycle = mapLifecycle(eventType);
  let dispatchId: string | null = null;
  if (providerMessageId) {
    const dispatch = await db.query.emailDispatches.findFirst({
      where: eq(emailDispatches.providerMessageId, providerMessageId),
    });
    if (dispatch) {
      dispatchId = dispatch.id;
      if (lifecycle) {
        await db
          .update(emailDispatches)
          .set({ status: lifecycle, updatedAt: new Date() })
          .where(eq(emailDispatches.id, dispatch.id));
      }
    }
  }

  const eventStatus =
    lifecycle != null || eventType.startsWith("email.") ? "processed" : "ignored";

  await db
    .update(emailProviderEvents)
    .set({
      status: eventStatus,
      dispatchId,
      processedAt: new Date(),
      errorCode: eventStatus === "ignored" ? "UNKNOWN_EVENT" : null,
    })
    .where(eq(emailProviderEvents.id, eventRow.id));

  await recordAudit(db, {
    actorUserId: null,
    organizationId: null,
    action: "email.provider_event_received",
    resourceType: "email_provider_event",
    resourceId: eventRow.id,
    source: "system",
    requestId: null,
    ip: null,
    after: { eventType, providerMessageId, lifecycle },
  });

  return {
    status: "processed" as const,
    eventId: eventRow.id,
    lifecycle,
  };
}
