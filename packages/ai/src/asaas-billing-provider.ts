import {
  ASAAS_PROVIDER_ID,
  AsaasClient,
  type AsaasClientOptions,
  type AsaasSubscription,
  centsToAsaasValue,
} from "./asaas-client.js";
import type {
  BillingInterval,
  BillingProvider,
  BillingProviderHealth,
  CancelExternalSubscriptionInput,
  CreateExternalSubscriptionInput,
  ExternalSubscriptionRecord,
  ExternalSubscriptionStatus,
  SyncExternalSubscriptionInput,
} from "./billing-provider.js";

export type AsaasBillingProviderOptions = AsaasClientOptions & {
  healthCheckNetwork?: boolean;
};

function mapCycle(interval: BillingInterval | undefined): "MONTHLY" | "YEARLY" | "WEEKLY" {
  switch (interval) {
    case "yearly":
      return "YEARLY";
    case "quarterly":
      // Asaas não tem quarterly nativo — usa MONTHLY × valor já calculado no plano.
      return "MONTHLY";
    default:
      return "MONTHLY";
  }
}

function mapSubscriptionStatus(status: string | undefined | null): ExternalSubscriptionStatus {
  switch ((status ?? "").toUpperCase()) {
    case "ACTIVE":
      return "active";
    case "INACTIVE":
    case "EXPIRED":
      return "expired";
    case "DELETED":
      return "cancelled";
    default:
      return "incomplete";
  }
}

function nextDueDate(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Assinaturas recorrentes Asaas (`BillingProvider`).
 * Não marca `active` sem status real do Asaas. Liquidação de cada ciclo via `PaymentProvider`/webhooks.
 */
export class AsaasBillingProvider implements BillingProvider {
  readonly id = ASAAS_PROVIDER_ID;
  private readonly client: AsaasClient;
  private readonly healthCheckNetwork: boolean;

  constructor(options: AsaasBillingProviderOptions) {
    this.client = new AsaasClient(options);
    this.healthCheckNetwork = options.healthCheckNetwork === true;
  }

  private async resolveCustomerId(input: CreateExternalSubscriptionInput): Promise<string> {
    const existing = input.metadata?.asaasCustomerId?.trim();
    if (existing) return existing;
    const name =
      input.metadata?.customerName?.trim() ||
      input.customerReference?.trim() ||
      `Plano ${input.planKey}`;
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
      input.signal,
    );
    return customer.id;
  }

  private toRecord(sub: AsaasSubscription, planKey: string): ExternalSubscriptionRecord {
    return {
      externalSubscriptionId: sub.id,
      providerKey: this.id,
      status: mapSubscriptionStatus(sub.status),
      planKey,
      currentPeriodEnd: sub.nextDueDate ?? null,
      cancelAtPeriodEnd: false,
    };
  }

  async createSubscription(
    input: CreateExternalSubscriptionInput,
  ): Promise<ExternalSubscriptionRecord> {
    const valueCents = Number.parseInt(input.metadata?.amountCents ?? "0", 10);
    const value =
      Number.isFinite(valueCents) && valueCents > 0
        ? centsToAsaasValue(valueCents)
        : Number.parseFloat(input.metadata?.value ?? "0") || 0;
    if (!(value > 0)) {
      // Sem valor explícito: não cria cobrança fantasma no Asaas.
      return {
        externalSubscriptionId: null,
        providerKey: this.id,
        status: "incomplete",
        planKey: input.planKey,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      };
    }

    const customer = await this.resolveCustomerId(input);
    const billingType = (input.metadata?.billingType ?? "PIX").toUpperCase();
    const sub = await this.client.createSubscription(
      {
        customer,
        billingType: ["PIX", "BOLETO", "CREDIT_CARD"].includes(billingType) ? billingType : "PIX",
        value,
        nextDueDate: nextDueDate(),
        cycle: mapCycle(input.billingInterval),
        description: `Assinatura ${input.planKey}`.slice(0, 500),
        externalReference: input.idempotencyKey ?? `${input.organizationId ?? ""}:${input.planKey}`,
      },
      input.signal,
      input.idempotencyKey,
    );
    // Criação ≠ pagamento confirmado — status vem do Asaas (geralmente ACTIVE só após ciclo pago).
    return this.toRecord(sub, input.planKey);
  }

  async getSubscription(
    externalSubscriptionId: string,
    signal?: AbortSignal,
  ): Promise<ExternalSubscriptionRecord> {
    const sub = await this.client.getSubscription(externalSubscriptionId, signal);
    return this.toRecord(sub, "");
  }

  async cancelSubscription(
    input: CancelExternalSubscriptionInput,
  ): Promise<ExternalSubscriptionRecord> {
    if (input.atPeriodEnd) {
      // Asaas: atualiza para não renovar via update; delete cancela imediato.
      const sub = await this.client.updateSubscription(
        input.externalSubscriptionId,
        { status: "INACTIVE" },
        input.signal,
      );
      return {
        ...this.toRecord(sub, ""),
        status: "cancelled",
        cancelAtPeriodEnd: true,
      };
    }
    const sub = await this.client.deleteSubscription(input.externalSubscriptionId, input.signal);
    return {
      ...this.toRecord(sub, ""),
      status: "cancelled",
      cancelAtPeriodEnd: false,
    };
  }

  async syncSubscription(
    input: SyncExternalSubscriptionInput,
  ): Promise<ExternalSubscriptionRecord> {
    return this.getSubscription(input.externalSubscriptionId, input.signal);
  }

  async healthCheck(): Promise<BillingProviderHealth> {
    const checkedAt = new Date().toISOString();
    if (!this.healthCheckNetwork) {
      return {
        status: "ok",
        detail: `Asaas billing (${this.client.environment}) configurado; health de rede desativado.`,
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
        detail: `Asaas billing (${this.client.environment}) alcançável.`,
        checkedAt: new Date().toISOString(),
      };
    } catch {
      return {
        status: "unavailable",
        detail: `Asaas billing (${this.client.environment}) indisponível.`,
        checkedAt: new Date().toISOString(),
      };
    }
  }
}
