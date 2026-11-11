import { AppError } from "@verasjuris/types";
import { ResendEmailProvider } from "./resend-provider.js";

export type EmailKind = "email_verification" | "password_reset" | "organization_invitation";

export type EmailDeliveryStatus = "sent" | "not_configured" | "captured";

export type OutboundEmail = {
  kind: EmailKind;
  to: string;
  subject: string;
  text: string;
  /** Presente apenas no adapter de memória (testes/dev). Nunca expor via API pública. */
  token?: string;
  metadata?: Record<string, string>;
};

export type SendEmailResult = {
  status: EmailDeliveryStatus;
};

export interface EmailProvider {
  readonly status: "configured" | "not_configured" | "memory";
  send(message: OutboundEmail): Promise<SendEmailResult>;
}

export class NotConfiguredEmailProvider implements EmailProvider {
  readonly status = "not_configured" as const;

  async send(_message: OutboundEmail): Promise<SendEmailResult> {
    return { status: "not_configured" };
  }
}

export class MemoryEmailProvider implements EmailProvider {
  readonly status = "memory" as const;
  readonly outbox: OutboundEmail[] = [];

  async send(message: OutboundEmail): Promise<SendEmailResult> {
    this.outbox.push(message);
    return { status: "captured" };
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

export function publicEmailDeliveryMessage(status: EmailDeliveryStatus): string {
  if (status === "not_configured") {
    return "O envio por e-mail ainda não está configurado neste ambiente.";
  }
  if (status === "captured") {
    return "A mensagem foi capturada pelo adaptador de desenvolvimento. Nenhum e-mail real foi enviado.";
  }
  return "Se existir uma conta elegível para este e-mail, enviaremos as próximas instruções.";
}

export { ResendEmailProvider, type ResendEmailProviderOptions } from "./resend-provider.js";
