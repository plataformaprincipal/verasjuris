import { AppError } from "@verasjuris/types";
import { ResendEmailProvider } from "./resend-provider.js";

export type EmailKind =
  | "email_verification"
  | "password_reset"
  | "organization_invitation"
  | "order_confirmation"
  | "proposal_update"
  | "payment_update"
  | "engagement_update"
  | "juris_work_update"
  | "security_alert"
  | "welcome"
  | "password_changed";

/** Status público/operacional do envio imediato (não confundir com entrega). */
export type EmailDeliveryStatus = "sent" | "not_configured" | "captured" | "failed";

/**
 * Aceitação pelo provedor vs estados de entrega (webhooks).
 * `sent` no SendEmailResult = SENT_TO_PROVIDER.
 */
export type EmailProviderAcceptance = "queued" | "sent_to_provider" | "failed";

export type EmailLifecycleStatus =
  | "queued"
  | "sent_to_provider"
  | "delivered"
  | "bounced"
  | "complained"
  | "failed";

export type OutboundEmail = {
  kind: EmailKind;
  to: string;
  subject: string;
  text: string;
  /** HTML opcional; se omitido, o provedor Resend gera a partir do texto. */
  html?: string;
  /** Presente apenas no adapter de memória (testes/dev). Nunca expor via API pública. */
  token?: string;
  metadata?: Record<string, string>;
};

export type SendEmailResult = {
  status: EmailDeliveryStatus;
  providerAcceptance?: EmailProviderAcceptance;
  providerMessageId?: string | null;
  providerKey?: string | null;
};

export interface EmailProvider {
  readonly status: "configured" | "not_configured" | "memory";
  send(message: OutboundEmail): Promise<SendEmailResult>;
}

export class NotConfiguredEmailProvider implements EmailProvider {
  readonly status = "not_configured" as const;

  async send(_message: OutboundEmail): Promise<SendEmailResult> {
    return {
      status: "not_configured",
      providerAcceptance: "failed",
      providerMessageId: null,
      providerKey: null,
    };
  }
}

export class MemoryEmailProvider implements EmailProvider {
  readonly status = "memory" as const;
  readonly outbox: OutboundEmail[] = [];
  private seq = 0;

  async send(message: OutboundEmail): Promise<SendEmailResult> {
    this.outbox.push(message);
    this.seq += 1;
    return {
      status: "captured",
      providerAcceptance: "sent_to_provider",
      providerMessageId: `mem_${this.seq}`,
      providerKey: "memory",
    };
  }

  latest(kind?: EmailKind, to?: string): OutboundEmail | undefined {
    for (let index = this.outbox.length - 1; index >= 0; index -= 1) {
      const item = this.outbox[index];
      if (!item) continue;
      if (kind && item.kind !== kind) continue;
      if (to && item.to !== to) continue;
      return item;
    }
    return undefined;
  }

  clear(): void {
    this.outbox.length = 0;
  }
}

export type EmailProviderMode = "not_configured" | "memory" | "resend";

export type EmailProviderEnv = {
  EMAIL_PROVIDER?: string | undefined;
  RESEND_API_KEY?: string | undefined;
  RESEND_FROM_EMAIL?: string | undefined;
};

/**
 * Factory de e-mail.
 * - `not_configured` (padrão): sem envio real
 * - `memory`: somente testes/dev
 * - `resend`: requer RESEND_API_KEY; sem chave retorna NotConfigured (não falha o boot)
 */
export function createEmailProvider(
  mode: EmailProviderMode = "not_configured",
  env: EmailProviderEnv = process.env,
): EmailProvider {
  if (mode === "memory") return new MemoryEmailProvider();
  if (mode === "resend") {
    const apiKey = env.RESEND_API_KEY?.trim();
    const fromEmail = env.RESEND_FROM_EMAIL?.trim();
    if (!apiKey) return new NotConfiguredEmailProvider();
    if (!fromEmail) {
      throw new AppError(
        "NOT_CONFIGURED",
        "RESEND_FROM_EMAIL é obrigatória quando EMAIL_PROVIDER=resend.",
      );
    }
    return new ResendEmailProvider({ apiKey, fromEmail });
  }
  return new NotConfiguredEmailProvider();
}

/** Lê `EMAIL_PROVIDER` (+ credenciais Resend) do ambiente. */
export function createEmailProviderFromEnv(
  env: EmailProviderEnv = process.env,
): EmailProvider {
  const modeRaw = (env.EMAIL_PROVIDER ?? "not_configured").trim().toLowerCase();
  const mode: EmailProviderMode =
    modeRaw === "memory" || modeRaw === "resend" || modeRaw === "not_configured"
      ? modeRaw
      : "not_configured";
  return createEmailProvider(mode, env);
}

export function publicEmailDeliveryMessage(status: EmailDeliveryStatus): string {
  if (status === "not_configured") {
    return "O envio por e-mail ainda não está configurado neste ambiente.";
  }
  if (status === "captured") {
    return "A mensagem foi capturada pelo adaptador de desenvolvimento. Nenhum e-mail real foi enviado.";
  }
  if (status === "failed") {
    return "Não foi possível concluir o envio neste momento. Tente novamente mais tarde.";
  }
  return "Se existir uma conta elegível para este e-mail, enviaremos as próximas instruções.";
}

/**
 * Status público do provider para respostas neutras (anti-enumeração).
 * Reflete capacidade do ambiente, não se a conta existe.
 */
export function publicProviderDeliveryStatus(provider: EmailProvider): EmailDeliveryStatus {
  if (provider.status === "memory") return "captured";
  if (provider.status === "configured") return "sent";
  return "not_configured";
}

export {
  ResendEmailProvider,
  verifyResendWebhookSignature,
  type ResendEmailProviderOptions,
} from "./resend-provider.js";
export {
  extractActionUrlFromText,
  renderTransactionalEmailHtml,
  type EmailTemplateRenderInput,
} from "./templates.js";
