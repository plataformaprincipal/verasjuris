import { AppError } from "@verasjuris/types";
import type { EmailProvider, OutboundEmail, SendEmailResult } from "./index.js";

export type ResendEmailProviderOptions = {
  apiKey: string;
  fromEmail: string;
  /** Injável em testes. */
  fetchImpl?: typeof fetch;
  endpoint?: string;
};

/**
 * Adapter Resend via fetch — sem SDK.
 * Nunca registra a API key em logs.
 */
export class ResendEmailProvider implements EmailProvider {
  readonly status = "configured" as const;
  private readonly apiKey: string;
  private readonly fromEmail: string;
  private readonly fetchImpl: typeof fetch;
  private readonly endpoint: string;

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
  }

  async send(message: OutboundEmail): Promise<SendEmailResult> {
    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.fromEmail,
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
    });

    if (!response.ok) {
      // Sem corpo/chave nos logs — mensagem genérica.
      throw new AppError(
        "EXTERNAL_SERVICE_ERROR",
        "Falha ao enviar e-mail pelo provedor configurado.",
      );
    }

    return { status: "sent" };
  }
}
