import { createHmac, timingSafeEqual } from "node:crypto";
import { AppError } from "@verasjuris/types";
import type { EmailProvider, OutboundEmail, SendEmailResult } from "./index.js";
import { extractActionUrlFromText, renderTransactionalEmailHtml } from "./templates.js";

export type ResendEmailProviderOptions = {
  apiKey: string;
  fromEmail: string;
  /** Injável em testes. */
  fetchImpl?: typeof fetch;
  endpoint?: string;
  /** Timeout por tentativa (ms). */
  timeoutMs?: number;
  /** Tentativas extras após a primeira (0–2). */
  maxRetries?: number;
};

type ResendSendResponse = {
  id?: string;
};

/**
 * Adapter Resend via fetch — sem SDK.
 * Nunca registra a API key em logs.
 * Aceitação pelo provedor (`sent`) ≠ entrega na caixa (`delivered` via webhook).
 */
export class ResendEmailProvider implements EmailProvider {
  readonly status = "configured" as const;
  private readonly apiKey: string;
  private readonly fromEmail: string;
  private readonly fetchImpl: typeof fetch;
  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(options: ResendEmailProviderOptions) {
    const apiKey = options.apiKey.trim();
    const fromEmail = options.fromEmail.trim();
    if (!apiKey) {
      throw new AppError("NOT_CONFIGURED", "RESEND_API_KEY é obrigatória para o provedor Resend.");
    }
    if (!fromEmail) {
      throw new AppError(
        "NOT_CONFIGURED",
        "RESEND_FROM_EMAIL é obrigatória quando EMAIL_PROVIDER=resend.",
      );
    }
    this.apiKey = apiKey;
    this.fromEmail = fromEmail;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.endpoint = options.endpoint ?? "https://api.resend.com/emails";
    this.timeoutMs = Math.min(Math.max(options.timeoutMs ?? 15_000, 2_000), 60_000);
    this.maxRetries = Math.min(Math.max(options.maxRetries ?? 1, 0), 2);
  }

  async send(message: OutboundEmail): Promise<SendEmailResult> {
    const to = message.to.trim().toLowerCase();
    if (!to || !to.includes("@") || to.length > 320) {
      throw new AppError("VALIDATION_ERROR", "Destinatário de e-mail inválido.");
    }

    const html =
      message.html ??
      renderTransactionalEmailHtml({
        kind: message.kind,
        subject: message.subject,
        text: message.text,
        actionUrl: extractActionUrlFromText(message.text),
      });

    const body = JSON.stringify({
      from: this.fromEmail,
      to: [to],
      subject: message.subject.slice(0, 200),
      text: message.text,
      html,
      ...(message.metadata?.idempotencyKey
        ? { headers: { "X-Entity-Ref-ID": message.metadata.idempotencyKey.slice(0, 128) } }
        : {}),
    });

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetchImpl(this.endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            ...(message.metadata?.idempotencyKey
              ? { "Idempotency-Key": message.metadata.idempotencyKey.slice(0, 256) }
              : {}),
          },
          body,
          signal: controller.signal,
        });

        if (response.status === 429 || response.status >= 500) {
          lastError = new AppError(
            "EXTERNAL_SERVICE_ERROR",
            "Falha temporária ao enviar e-mail pelo provedor configurado.",
          );
          if (attempt < this.maxRetries) {
            await sleep(250 * (attempt + 1));
            continue;
          }
          throw lastError;
        }

        if (!response.ok) {
          throw new AppError(
            "EXTERNAL_SERVICE_ERROR",
            "Falha ao enviar e-mail pelo provedor configurado.",
          );
        }

        let providerMessageId: string | undefined;
        try {
          const json = (await response.json()) as ResendSendResponse;
          if (typeof json.id === "string" && json.id.trim()) {
            providerMessageId = json.id.trim();
          }
        } catch {
          // Corpo opcional; aceitação HTTP 2xx basta para sent_to_provider.
        }

        return {
          status: "sent",
          providerAcceptance: "sent_to_provider",
          providerMessageId: providerMessageId ?? null,
          providerKey: "resend",
        };
      } catch (error) {
        lastError = error;
        if (error instanceof AppError && error.code !== "EXTERNAL_SERVICE_ERROR") throw error;
        if (attempt < this.maxRetries && isRetryableNetworkError(error)) {
          await sleep(250 * (attempt + 1));
          continue;
        }
        if (error instanceof AppError) throw error;
        throw new AppError(
          "EXTERNAL_SERVICE_ERROR",
          "Falha ao enviar e-mail pelo provedor configurado.",
        );
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError instanceof AppError
      ? lastError
      : new AppError("EXTERNAL_SERVICE_ERROR", "Falha ao enviar e-mail pelo provedor configurado.");
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableNetworkError(error: unknown): boolean {
  if (error instanceof AppError && error.code === "EXTERNAL_SERVICE_ERROR") return true;
  if (error instanceof Error && error.name === "AbortError") return true;
  return false;
}

/**
 * Verifica assinatura Svix usada pelos webhooks Resend.
 * `secret` é o valor `whsec_...` (base64 após o prefixo) ou o segredo bruto.
 */
export function verifyResendWebhookSignature(input: {
  rawBody: string | Uint8Array;
  headers: Record<string, string | string[] | undefined>;
  secret: string;
  toleranceSeconds?: number;
}): { valid: boolean; reason?: string; timestampOutOfTolerance?: boolean } {
  const secret = input.secret.trim();
  if (!secret) return { valid: false, reason: "missing_secret" };

  const header = (name: string) => {
    const value = input.headers[name] ?? input.headers[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  };

  const msgId = header("svix-id")?.trim();
  const timestamp = header("svix-timestamp")?.trim();
  const signatureHeader = header("svix-signature")?.trim();
  if (!msgId || !timestamp || !signatureHeader) {
    return { valid: false, reason: "missing_headers" };
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return { valid: false, reason: "invalid_timestamp" };
  const tolerance = input.toleranceSeconds ?? 300;
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - ts) > tolerance) {
    return { valid: false, reason: "timestamp_out_of_tolerance", timestampOutOfTolerance: true };
  }

  const raw =
    typeof input.rawBody === "string" ? input.rawBody : Buffer.from(input.rawBody).toString("utf8");
  const signedContent = `${msgId}.${timestamp}.${raw}`;

  let key = secret;
  if (secret.startsWith("whsec_")) {
    key = secret.slice("whsec_".length);
  }
  const keyBuf = Buffer.from(key, "base64");
  const expected = createHmac("sha256", keyBuf).update(signedContent).digest("base64");

  const candidates = signatureHeader
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (part.startsWith("v1,") ? part.slice(3) : part));

  for (const candidate of candidates) {
    try {
      const a = Buffer.from(candidate);
      const b = Buffer.from(expected);
      if (a.length === b.length && timingSafeEqual(a, b)) {
        return { valid: true };
      }
    } catch {
      // continue
    }
  }
  return { valid: false, reason: "invalid_signature" };
}
