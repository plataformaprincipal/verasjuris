import { AppError } from "@verasjuris/types";
import {
  ASAAS_PROVIDER_ID,
  AsaasClient,
  type AsaasClientOptions,
  type AsaasPayment,
  asaasValueToCents,
  centsToAsaasValue,
  headerValue,
  mapAsaasBillingType,
  mapAsaasIntentStatus,
  mapAsaasPaymentStatus,
  safeEqualToken,
} from "./asaas-client.js";
import type {
  CheckoutSessionInput,
  CheckoutSessionResult,
  CreatePaymentInput,
  PaymentIntentCreateInput,
  PaymentIntentRecord,
  PaymentProvider,
  PaymentProviderCapability,
  PaymentProviderHealth,
  PaymentRecord,
  PaymentWebhookEvent,
  PaymentWebhookPayload,
  PaymentWebhookResult,
  PaymentWebhookVerificationResult,
  PaymentWebhookVerifyInput,
} from "./payment-provider.js";

export type AsaasPaymentProviderOptions = AsaasClientOptions & {
  /** Quando false, healthCheck não chama a rede. */
  healthCheckNetwork?: boolean;
};

type AsaasWebhookBody = {
  id?: string | number;
  event?: string;
  dateCreated?: string;
  payment?: AsaasPayment & { creditCard?: unknown };
  subscription?: { id?: string; status?: string };
};

function dueDateFromExpires(expiresAt?: string): string {
  if (expiresAt) {
    const d = new Date(expiresAt);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return tomorrow.toISOString().slice(0, 10);
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function mapWebhookEventType(raw: string | undefined): PaymentWebhookEvent["type"] {
  switch ((raw ?? "").toUpperCase()) {
    case "PAYMENT_CREATED":
      return "payment.created";
    case "PAYMENT_UPDATED":
      return "payment.updated";
    case "PAYMENT_CONFIRMED":
    case "PAYMENT_RECEIVED":
    case "PAYMENT_RECEIVED_IN_CASH":
      return "payment.paid";
    case "PAYMENT_OVERDUE":
    case "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED":
    case "PAYMENT_REPROVED_BY_RISK_ANALYSIS":
      return "payment.failed";
    case "PAYMENT_DELETED":
    case "PAYMENT_RESTORED":
      return "payment.cancelled";
    case "PAYMENT_REFUNDED":
    case "PAYMENT_PARTIALLY_REFUNDED":
    case "PAYMENT_REFUND_IN_PROGRESS":
      return "payment.refunded";
    default:
      return "unknown";
  }
}

/**
 * Adapter Asaas para `PaymentProvider`.
 *
 * - PIX: cobrança + QR Code (imagem base64) e copia-e-cola em metadata.
 * - Boleto: invoiceUrl / bankSlipUrl / linha digitável em metadata.
 * - Cartão: **nunca** aceita PAN/CVV nesta API — usa fatura hospedada Asaas (`invoiceUrl`).
 * - Webhook: valida header `asaas-access-token` contra `ASAAS_WEBHOOK_TOKEN`.
 */
export class AsaasPaymentProvider implements PaymentProvider {
  readonly id = ASAAS_PROVIDER_ID;
  readonly capabilities: readonly PaymentProviderCapability[] = [
    "refund",
    "webhook",
    "checkout_session",
  ];

  private readonly client: AsaasClient;
  private readonly healthCheckNetwork: boolean;

  constructor(options: AsaasPaymentProviderOptions) {
    this.client = new AsaasClient(options);
    this.healthCheckNetwork = options.healthCheckNetwork === true;
  }

  private async resolveCustomerId(
    input: {
      customerReference?: string;
      metadata?: Record<string, string>;
      description?: string;
    },
    signal?: AbortSignal,
  ): Promise<string> {
    const existing = input.metadata?.asaasCustomerId?.trim();
    if (existing) return existing;

    const name =
      input.metadata?.customerName?.trim() ||
      input.description?.trim() ||
      input.customerReference?.trim() ||
      "Cliente VerasJuris";
    const email = input.metadata?.customerEmail?.trim();
    const cpfCnpj = input.metadata?.customerCpfCnpj?.trim()?.replace(/\D/g, "");

    const customer = await this.client.createCustomer(
      {
        name,
        ...(email ? { email } : {}),
        ...(cpfCnpj ? { cpfCnpj } : {}),
        ...(input.customerReference
          ? { externalReference: input.customerReference.slice(0, 100) }
          : {}),
      },
      signal,
    );
    return customer.id;
  }

  private async enrichPaymentMetadata(
    payment: AsaasPayment,
    billingType: string,
    signal?: AbortSignal,
  ): Promise<Record<string, string>> {
    const meta: Record<string, string> = {
      asaasStatus: payment.status ?? "",
      billingType,
    };
    if (payment.invoiceUrl) meta.invoiceUrl = payment.invoiceUrl;
    if (payment.bankSlipUrl) meta.bankSlipUrl = payment.bankSlipUrl;
    if (payment.identificationField) meta.boletoDigitableLine = payment.identificationField;
    if (payment.externalReference) meta.externalReference = payment.externalReference;

    if (billingType === "PIX") {
      try {
        const qr = await this.client.getPixQrCode(payment.id, signal);
        if (qr.payload) meta.pixCopyPaste = qr.payload;
        if (qr.encodedImage) meta.pixQrCodeBase64 = qr.encodedImage;
        if (qr.expirationDate) meta.pixExpiresAt = qr.expirationDate;
      } catch {
        // QR pode falhar se chave Pix ausente; cobrança ainda existe.
      }
    }

    if (billingType === "BOLETO" && !meta.boletoDigitableLine) {
      try {
        const field = await this.client.getIdentificationField(payment.id, signal);
        if (field.identificationField) meta.boletoDigitableLine = field.identificationField;
      } catch {
        // optional
      }
    }

    return meta;
  }

  private toPaymentRecord(payment: AsaasPayment, amountCentsFallback = 0): PaymentRecord {
    return {
      externalPaymentId: payment.id,
      status: mapAsaasPaymentStatus(payment.status),
      providerKey: this.id,
      amountCents: asaasValueToCents(payment.value) || amountCentsFallback,
      paidAt: payment.paymentDate || payment.clientPaymentDate || null,
    };
  }

  async createPayment(input: CreatePaymentInput): Promise<PaymentRecord> {
    const customer = await this.resolveCustomerId(input, input.signal);
    const billingType = mapAsaasBillingType(input.metadata?.paymentMethod);
    const payment = await this.client.createPayment(
      {
        customer,
        billingType: billingType === "UNDEFINED" ? "PIX" : billingType,
        value: centsToAsaasValue(input.amountCents),
        dueDate: todayIsoDate(),
        description: input.description?.slice(0, 500),
        externalReference: input.idempotencyKey ?? input.customerReference,
      },
      input.signal,
      input.idempotencyKey,
    );
    return this.toPaymentRecord(payment, input.amountCents);
  }

  async createPaymentIntent(input: PaymentIntentCreateInput): Promise<PaymentIntentRecord> {
    const customer = await this.resolveCustomerId(input, input.signal);
    const billingType = mapAsaasBillingType(input.paymentMethod);
    const effectiveBilling = billingType === "UNDEFINED" ? "PIX" : billingType;

    // Cartão: sem PAN/CVV — fatura hospedada Asaas (PCI).
    const payment = await this.client.createPayment(
      {
        customer,
        billingType: effectiveBilling,
        value: centsToAsaasValue(input.amountCents),
        dueDate: dueDateFromExpires(input.expiresAt),
        description: input.description?.slice(0, 500),
        externalReference:
          input.idempotencyKey ??
          (input.referenceType && input.referenceId
            ? `${input.referenceType}:${input.referenceId}`
            : undefined),
        ...(input.invoiceId ? { metadata: `invoice:${input.invoiceId}` } : {}),
      },
      input.signal,
      input.idempotencyKey,
    );

    const enriched = await this.enrichPaymentMetadata(payment, effectiveBilling, input.signal);
    const intentStatus = mapAsaasIntentStatus(payment.status);

    return {
      externalIntentId: payment.id,
      status:
        effectiveBilling === "CREDIT_CARD" ||
        effectiveBilling === "PIX" ||
        effectiveBilling === "BOLETO"
          ? intentStatus === "confirmed"
            ? "confirmed"
            : "requires_action"
          : intentStatus,
      providerKey: this.id,
      amountCents: input.amountCents,
      currency: (input.currency ?? "BRL").toUpperCase(),
      paymentMethod: input.paymentMethod ?? null,
      clientSecret: null,
      checkoutUrl: payment.invoiceUrl ?? null,
      expiresAt: enriched.pixExpiresAt ?? input.expiresAt ?? null,
      metadata: {
        ...(input.metadata ?? {}),
        ...enriched,
        asaasCustomerId: customer,
      },
    };
  }

  async createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
    const method = input.paymentMethods?.[0] ?? "pix";
    const intent = await this.createPaymentIntent({
      amountCents: input.amountCents,
      currency: input.currency,
      paymentMethod: method,
      description: input.description,
      customerReference: input.customerReference,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      metadata: {
        ...(input.metadata ?? {}),
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
      },
      idempotencyKey: input.idempotencyKey,
      expiresAt: input.expiresAt,
      signal: input.signal,
    });

    return {
      externalSessionId: intent.externalIntentId,
      status: intent.checkoutUrl ? "open" : "unavailable",
      providerKey: this.id,
      checkoutUrl: intent.checkoutUrl ?? null,
      amountCents: input.amountCents,
      currency: (input.currency ?? "BRL").toUpperCase(),
      expiresAt: intent.expiresAt ?? null,
    };
  }

  async getStatus(externalPaymentId: string, signal?: AbortSignal): Promise<PaymentRecord> {
    const payment = await this.client.getPayment(externalPaymentId, signal);
    return this.toPaymentRecord(payment);
  }

  getPaymentStatus(externalPaymentId: string, signal?: AbortSignal): Promise<PaymentRecord> {
    return this.getStatus(externalPaymentId, signal);
  }

  async cancel(externalPaymentId: string, signal?: AbortSignal): Promise<PaymentRecord> {
    const payment = await this.client.deletePayment(externalPaymentId, signal);
    return {
      ...this.toPaymentRecord(payment),
      status: "cancelled",
    };
  }

  cancelPayment(externalPaymentId: string, signal?: AbortSignal): Promise<PaymentRecord> {
    return this.cancel(externalPaymentId, signal);
  }

  async refund(
    externalPaymentId: string,
    amountCents?: number,
    signal?: AbortSignal,
  ): Promise<PaymentRecord> {
    const body =
      amountCents !== undefined
        ? { value: centsToAsaasValue(amountCents), description: "Estorno VerasJuris" }
        : { description: "Estorno VerasJuris" };
    const payment = await this.client.refundPayment(externalPaymentId, body, signal);
    return this.toPaymentRecord(payment, amountCents ?? 0);
  }

  refundPayment(
    externalPaymentId: string,
    amountCents?: number,
    signal?: AbortSignal,
  ): Promise<PaymentRecord> {
    return this.refund(externalPaymentId, amountCents, signal);
  }

  async verifyWebhook(
    payload: PaymentWebhookVerifyInput | PaymentWebhookPayload,
  ): Promise<boolean | PaymentWebhookVerificationResult> {
    const token = this.client.webhookToken;
    if (!token) {
      return {
        valid: false,
        reason: "ASAAS_WEBHOOK_TOKEN ausente",
        timestamp: null,
        timestampOutOfTolerance: false,
      };
    }

    const received = headerValue(payload.headers ?? {}, [
      "asaas-access-token",
      "asaas_access_token",
      "x-asaas-access-token",
    ]);
    const valid = safeEqualToken(token, received);

    let timestamp: number | null = null;
    let timestampOutOfTolerance = false;
    const tolerance =
      "toleranceSeconds" in payload && typeof payload.toleranceSeconds === "number"
        ? payload.toleranceSeconds
        : 300;

    if ("timestamp" in payload && payload.timestamp !== undefined) {
      const ts =
        typeof payload.timestamp === "number"
          ? payload.timestamp
          : Number.parseInt(String(payload.timestamp), 10);
      if (Number.isFinite(ts)) {
        timestamp = ts > 1_000_000_000_000 ? Math.floor(ts / 1000) : ts;
        const now = Math.floor(Date.now() / 1000);
        timestampOutOfTolerance = Math.abs(now - timestamp) > tolerance;
      }
    } else {
      // Asaas autentica por token estático; parseia dateCreated do body se presente.
      try {
        const raw =
          typeof payload.rawBody === "string"
            ? payload.rawBody
            : Buffer.from(payload.rawBody).toString("utf8");
        const body = JSON.parse(raw) as AsaasWebhookBody;
        if (body.dateCreated) {
          const ms = Date.parse(body.dateCreated);
          if (!Number.isNaN(ms)) {
            timestamp = Math.floor(ms / 1000);
            const now = Math.floor(Date.now() / 1000);
            timestampOutOfTolerance = Math.abs(now - timestamp) > Math.max(tolerance, 86_400);
          }
        }
      } catch {
        // body inválido — verify só autentica; parseWebhook falhará depois
      }
    }

    return {
      valid,
      reason: valid ? undefined : "asaas-access-token inválido",
      timestamp,
      timestampOutOfTolerance: valid ? timestampOutOfTolerance : false,
    };
  }

  async parseWebhook(payload: PaymentWebhookPayload): Promise<PaymentWebhookEvent> {
    const raw =
      typeof payload.rawBody === "string"
        ? payload.rawBody
        : Buffer.from(payload.rawBody).toString("utf8");
    let body: AsaasWebhookBody;
    try {
      body = JSON.parse(raw) as AsaasWebhookBody;
    } catch {
      throw new AppError("VALIDATION_ERROR", "Payload de webhook Asaas inválido.");
    }

    const payment = body.payment;
    const rawType = body.event ?? "unknown";
    const type = mapWebhookEventType(rawType);
    const externalPaymentId = payment?.id ?? null;
    const eventId =
      body.id !== undefined && body.id !== null
        ? `asaas:${body.id}`
        : `asaas:${rawType}:${externalPaymentId ?? "none"}:${payment?.status ?? ""}:${body.dateCreated ?? ""}`;

    return {
      type,
      externalEventId: eventId,
      externalPaymentId,
      externalIntentId: externalPaymentId,
      externalSessionId: null,
      status: payment ? mapAsaasPaymentStatus(payment.status) : undefined,
      amountCents: payment ? asaasValueToCents(payment.value) : null,
      rawType,
      detail: payment?.description ?? undefined,
      occurredAt: body.dateCreated ?? payment?.paymentDate ?? null,
    };
  }

  async handleWebhook(payload: PaymentWebhookPayload): Promise<PaymentWebhookResult> {
    const verification = await this.verifyWebhook(payload);
    const valid = typeof verification === "boolean" ? verification : verification.valid;
    if (!valid) {
      throw new AppError("AUTHORIZATION_ERROR", "Assinatura de webhook Asaas inválida.");
    }
    const event = await this.parseWebhook(payload);
    if (!event.externalPaymentId) {
      throw new AppError("VALIDATION_ERROR", "Webhook Asaas sem identificador de pagamento.");
    }
    return {
      externalPaymentId: event.externalPaymentId,
      status:
        event.type === "payment.failed"
          ? "failed"
          : event.type === "payment.refunded"
            ? "refunded"
            : event.type === "payment.cancelled"
              ? "cancelled"
              : event.type === "payment.paid"
                ? "paid"
                : "pending",
      detail: event.rawType,
    };
  }

  async healthCheck(): Promise<PaymentProviderHealth> {
    const checkedAt = new Date().toISOString();
    if (!this.healthCheckNetwork) {
      return {
        status: "ok",
        detail: `Asaas (${this.client.environment}) configurado; health de rede desativado.`,
        checkedAt,
      };
    }
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2_500);
      try {
        await this.client.healthPing(controller.signal);
      } finally {
        clearTimeout(timer);
      }
      return {
        status: "ok",
        detail: `Asaas (${this.client.environment}) alcançável.`,
        checkedAt: new Date().toISOString(),
      };
    } catch {
      return {
        status: "unavailable",
        detail: `Asaas (${this.client.environment}) indisponível no health check.`,
        checkedAt: new Date().toISOString(),
      };
    }
  }
}
