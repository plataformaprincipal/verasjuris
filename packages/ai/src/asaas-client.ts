import { AppError } from "@verasjuris/types";
import { timingSafeEqual } from "node:crypto";

export const ASAAS_PROVIDER_ID = "asaas" as const;

export type AsaasEnvironment = "sandbox" | "production";

export type AsaasClientOptions = {
  apiKey: string;
  environment?: AsaasEnvironment;
  /** Override completo (ex.: https://api-sandbox.asaas.com/v3). */
  baseUrl?: string;
  webhookToken?: string;
  userAgent?: string;
  fetchImpl?: typeof fetch;
};

export type AsaasApiErrorBody = {
  errors?: Array<{ code?: string; description?: string }>;
};

export type AsaasCustomer = {
  id: string;
  name?: string;
  email?: string;
  cpfCnpj?: string;
};

export type AsaasPayment = {
  id: string;
  status?: string;
  value?: number;
  netValue?: number;
  billingType?: string;
  dueDate?: string;
  paymentDate?: string | null;
  clientPaymentDate?: string | null;
  invoiceUrl?: string | null;
  bankSlipUrl?: string | null;
  identificationField?: string | null;
  nossoNumero?: string | null;
  externalReference?: string | null;
  description?: string | null;
  customer?: string;
  subscription?: string | null;
  deleted?: boolean;
};

export type AsaasPixQrCode = {
  encodedImage?: string;
  payload?: string;
  expirationDate?: string;
};

export type AsaasSubscription = {
  id: string;
  status?: string;
  value?: number;
  cycle?: string;
  nextDueDate?: string;
  billingType?: string;
  description?: string | null;
  externalReference?: string | null;
  customer?: string;
};

const SANDBOX_BASE = "https://api-sandbox.asaas.com/v3";
const PRODUCTION_BASE = "https://api.asaas.com/v3";

export function resolveAsaasBaseUrl(
  environment: AsaasEnvironment = "sandbox",
  override?: string,
): string {
  if (override?.trim()) return override.replace(/\/$/, "");
  return environment === "production" ? PRODUCTION_BASE : SANDBOX_BASE;
}

export function centsToAsaasValue(amountCents: number): number {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new AppError("VALIDATION_ERROR", "Valor de pagamento inválido.");
  }
  return Math.round(amountCents) / 100;
}

export function asaasValueToCents(value: number | undefined | null): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

export function mapAsaasBillingType(
  method: string | null | undefined,
): "PIX" | "BOLETO" | "CREDIT_CARD" | "UNDEFINED" {
  switch (method) {
    case "pix":
      return "PIX";
    case "boleto":
      return "BOLETO";
    case "credit_card":
    case "debit_card":
      return "CREDIT_CARD";
    default:
      return "UNDEFINED";
  }
}

export function mapAsaasPaymentStatus(
  status: string | undefined | null,
): "pending" | "processing" | "paid" | "failed" | "cancelled" | "refunded" | "partially_refunded" {
  switch ((status ?? "").toUpperCase()) {
    case "RECEIVED":
    case "CONFIRMED":
    case "RECEIVED_IN_CASH":
      return "paid";
    case "REFUNDED":
      return "refunded";
    case "REFUND_REQUESTED":
    case "REFUND_IN_PROGRESS":
    case "PARTIAL_REFUND":
      return "partially_refunded";
    case "OVERDUE":
    case "PENDING":
      return "pending";
    case "AWAITING_RISK_ANALYSIS":
    case "AWAITING_CHARGEBACK_REVERSAL":
      return "processing";
    case "DELETED":
    case "REFUNDED_PARTIALLY": // legacy alias
      return status?.toUpperCase() === "DELETED" ? "cancelled" : "partially_refunded";
    case "CHARGEBACK_REQUESTED":
    case "CHARGEBACK_DISPUTE":
    case "DUNNING_REQUESTED":
    case "DUNNING_RECEIVED":
      return "processing";
    default:
      return "pending";
  }
}

export function mapAsaasIntentStatus(
  status: string | undefined | null,
):
  | "created"
  | "requires_action"
  | "processing"
  | "authorized"
  | "confirmed"
  | "failed"
  | "cancelled"
  | "expired" {
  switch ((status ?? "").toUpperCase()) {
    case "RECEIVED":
    case "CONFIRMED":
    case "RECEIVED_IN_CASH":
      return "confirmed";
    case "PENDING":
    case "OVERDUE":
      return "requires_action";
    case "AWAITING_RISK_ANALYSIS":
      return "processing";
    case "REFUNDED":
    case "DELETED":
      return "cancelled";
    default:
      return "created";
  }
}

export function safeEqualToken(expected: string, received: string | undefined): boolean {
  if (!expected || !received) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function headerValue(headers: Record<string, string>, names: string[]): string | undefined {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  for (const name of names) {
    const value = lower[name.toLowerCase()];
    if (value) return value;
  }
  return undefined;
}

/**
 * Cliente HTTP Asaas (fetch). Nunca registra a API key.
 */
export class AsaasClient {
  readonly environment: AsaasEnvironment;
  readonly baseUrl: string;
  readonly webhookToken: string | undefined;
  private readonly apiKey: string;
  private readonly userAgent: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: AsaasClientOptions) {
    const apiKey = options.apiKey.trim();
    if (!apiKey) {
      throw new AppError(
        "PAYMENT_PROVIDER_NOT_CONFIGURED",
        "ASAAS_API_KEY ausente. Nenhum pagamento foi criado.",
      );
    }
    this.apiKey = apiKey;
    this.environment = options.environment ?? "sandbox";
    this.baseUrl = resolveAsaasBaseUrl(this.environment, options.baseUrl);
    this.webhookToken = options.webhookToken?.trim() || undefined;
    this.userAgent = options.userAgent?.trim() || "VerasJuris";
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    signal?: AbortSignal,
    idempotencyKey?: string,
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": this.userAgent,
      access_token: this.apiKey,
    };
    if (idempotencyKey) {
      headers["Idempotency-Key"] = idempotencyKey;
    }

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      });
    } catch {
      throw new AppError(
        "EXTERNAL_SERVICE_ERROR",
        "O provedor Asaas está indisponível no momento.",
      );
    }

    if (response.status === 401 || response.status === 403) {
      throw new AppError("AUTHORIZATION_ERROR", "Credenciais Asaas rejeitadas pelo provedor.");
    }

    if (!response.ok) {
      let detail = `Asaas HTTP ${response.status}`;
      try {
        const errBody = (await response.json()) as AsaasApiErrorBody;
        const first = errBody.errors?.[0];
        if (first?.description) detail = first.description;
      } catch {
        // ignore parse
      }
      throw new AppError("EXTERNAL_SERVICE_ERROR", detail);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  }

  createCustomer(
    input: {
      name: string;
      email?: string;
      cpfCnpj?: string;
      phone?: string;
      externalReference?: string;
    },
    signal?: AbortSignal,
  ): Promise<AsaasCustomer> {
    return this.request<AsaasCustomer>("POST", "/customers", input, signal);
  }

  createPayment(
    input: Record<string, unknown>,
    signal?: AbortSignal,
    idempotencyKey?: string,
  ): Promise<AsaasPayment> {
    return this.request<AsaasPayment>("POST", "/payments", input, signal, idempotencyKey);
  }

  getPayment(id: string, signal?: AbortSignal): Promise<AsaasPayment> {
    return this.request<AsaasPayment>(
      "GET",
      `/payments/${encodeURIComponent(id)}`,
      undefined,
      signal,
    );
  }

  deletePayment(id: string, signal?: AbortSignal): Promise<AsaasPayment> {
    return this.request<AsaasPayment>(
      "DELETE",
      `/payments/${encodeURIComponent(id)}`,
      undefined,
      signal,
    );
  }

  refundPayment(
    id: string,
    body: { value?: number; description?: string } | undefined,
    signal?: AbortSignal,
  ): Promise<AsaasPayment> {
    return this.request<AsaasPayment>(
      "POST",
      `/payments/${encodeURIComponent(id)}/refund`,
      body ?? {},
      signal,
    );
  }

  getPixQrCode(id: string, signal?: AbortSignal): Promise<AsaasPixQrCode> {
    return this.request<AsaasPixQrCode>(
      "GET",
      `/payments/${encodeURIComponent(id)}/pixQrCode`,
      undefined,
      signal,
    );
  }

  getIdentificationField(
    id: string,
    signal?: AbortSignal,
  ): Promise<{ identificationField?: string }> {
    return this.request<{ identificationField?: string }>(
      "GET",
      `/payments/${encodeURIComponent(id)}/identificationField`,
      undefined,
      signal,
    );
  }

  createSubscription(
    input: Record<string, unknown>,
    signal?: AbortSignal,
    idempotencyKey?: string,
  ): Promise<AsaasSubscription> {
    return this.request<AsaasSubscription>("POST", "/subscriptions", input, signal, idempotencyKey);
  }

  getSubscription(id: string, signal?: AbortSignal): Promise<AsaasSubscription> {
    return this.request<AsaasSubscription>(
      "GET",
      `/subscriptions/${encodeURIComponent(id)}`,
      undefined,
      signal,
    );
  }

  deleteSubscription(id: string, signal?: AbortSignal): Promise<AsaasSubscription> {
    return this.request<AsaasSubscription>(
      "DELETE",
      `/subscriptions/${encodeURIComponent(id)}`,
      undefined,
      signal,
    );
  }

  updateSubscription(
    id: string,
    input: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<AsaasSubscription> {
    return this.request<AsaasSubscription>(
      "PUT",
      `/subscriptions/${encodeURIComponent(id)}`,
      input,
      signal,
    );
  }

  healthPing(signal?: AbortSignal): Promise<{ status?: string } | AsaasCustomer[] | unknown> {
    // Endpoint leve: listar customers com limit 1.
    return this.request("GET", "/customers?limit=1", undefined, signal);
  }
}
