import type {
  EmailKind,
  EmailProvider,
  OutboundEmail,
  SendEmailResult,
} from "@verasjuris/email";
import {
  emailDispatches,
  isUniqueViolation,
  type AppDatabase,
} from "@verasjuris/database";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";

export function hashEmailAddress(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

export type DispatchEmailInput = {
  kind: EmailKind;
  to: string;
  subject: string;
  text: string;
  html?: string;
  token?: string;
  recipientUserId?: string | null;
  organizationId?: string | null;
  idempotencyKey: string;
  category?: "transactional" | "security" | "operational" | "marketing";
  metadata?: Record<string, string>;
};

/**
 * Envia e-mail com persistência idempotente.
 * Reenvios com a mesma chave não geram nova chamada ao provedor se já sent_to_provider+.
 */
export async function dispatchTransactionalEmail(
  db: AppDatabase,
  provider: EmailProvider,
  input: DispatchEmailInput,
): Promise<{ result: SendEmailResult; dispatchId: string; replayed: boolean }> {
  const existing = await db.query.emailDispatches.findFirst({
    where: eq(emailDispatches.idempotencyKey, input.idempotencyKey),
  });
  if (
    existing &&
    (existing.status === "sent_to_provider" ||
      existing.status === "delivered" ||
      existing.status === "queued")
  ) {
    if (existing.status === "sent_to_provider" || existing.status === "delivered") {
      return {
        dispatchId: existing.id,
        replayed: true,
        result: {
          status:
            provider.status === "memory"
              ? "captured"
              : provider.status === "configured"
                ? "sent"
                : "not_configured",
          providerAcceptance: "sent_to_provider",
          providerMessageId: existing.providerMessageId,
          providerKey: existing.providerKey,
        },
      };
    }
  }

  let dispatchId = existing?.id;
  if (!dispatchId) {
    try {
      const [created] = await db
        .insert(emailDispatches)
        .values({
          kind: input.kind,
          recipientUserId: input.recipientUserId ?? null,
          organizationId: input.organizationId ?? null,
          toEmailHash: hashEmailAddress(input.to),
          idempotencyKey: input.idempotencyKey,
          status: "queued",
          subject: input.subject.slice(0, 200),
          category: input.category ?? "transactional",
          metadata: input.metadata ?? {},
        })
        .returning();
      dispatchId = created!.id;
    } catch (error) {
      if (isUniqueViolation(error)) {
        const raced = await db.query.emailDispatches.findFirst({
          where: eq(emailDispatches.idempotencyKey, input.idempotencyKey),
        });
        if (raced) {
          return {
            dispatchId: raced.id,
            replayed: true,
            result: {
              status:
                provider.status === "configured"
                  ? "sent"
                  : provider.status === "memory"
                    ? "captured"
                    : "not_configured",
              providerAcceptance: "sent_to_provider",
              providerMessageId: raced.providerMessageId,
              providerKey: raced.providerKey,
            },
          };
        }
      }
      throw error;
    }
  }

  const message: OutboundEmail = {
    kind: input.kind,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    token: input.token,
    metadata: {
      ...(input.metadata ?? {}),
      idempotencyKey: input.idempotencyKey,
    },
  };

  try {
    const result = await provider.send(message);
    const nextStatus =
      result.status === "not_configured"
        ? "failed"
        : result.status === "failed"
          ? "failed"
          : "sent_to_provider";
    await db
      .update(emailDispatches)
      .set({
        status: nextStatus,
        providerKey: result.providerKey ?? (provider.status === "memory" ? "memory" : "resend"),
        providerMessageId: result.providerMessageId ?? null,
        errorCode: nextStatus === "failed" ? result.status : null,
        sentAt: nextStatus === "sent_to_provider" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(emailDispatches.id, dispatchId));
    return { dispatchId, replayed: false, result };
  } catch (error) {
    await db
      .update(emailDispatches)
      .set({
        status: "failed",
        errorCode: "EXTERNAL_SERVICE_ERROR",
        updatedAt: new Date(),
      })
      .where(eq(emailDispatches.id, dispatchId));
    throw error;
  }
}
