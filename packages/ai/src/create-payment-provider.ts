import { AsaasBillingProvider } from "./asaas-billing-provider.js";
import { AsaasPaymentProvider } from "./asaas-payment-provider.js";
import type { AsaasEnvironment } from "./asaas-client.js";
import { NotConfiguredBillingProvider, type BillingProvider } from "./billing-provider.js";
import { NotConfiguredPaymentProvider, type PaymentProvider } from "./payment-provider.js";

export type PaymentProviderEnv = {
  PAYMENT_PROVIDER?: string;
  BILLING_PROVIDER?: string;
  ASAAS_API_KEY?: string;
  ASAAS_API_URL?: string;
  ASAAS_ENVIRONMENT?: string;
  ASAAS_WEBHOOK_TOKEN?: string;
  ASAAS_USER_AGENT?: string;
  ASAAS_HEALTHCHECK?: string;
  /**
   * Gate de segurança: cobranças em ambiente production do Asaas só com `1`.
   * Sandbox não exige PAYMENTS_LIVE.
   */
  PAYMENTS_LIVE?: string;
  /** Checkout self-serve público; default desligado até homologação. */
  FEATURE_PUBLIC_CHECKOUT?: string;
};

function resolveEnvironment(env: PaymentProviderEnv): AsaasEnvironment {
  const raw = (env.ASAAS_ENVIRONMENT ?? "sandbox").trim().toLowerCase();
  return raw === "production" ? "production" : "sandbox";
}

function asaasOptions(env: PaymentProviderEnv) {
  const apiKey = env.ASAAS_API_KEY?.trim() ?? "";
  const environment = resolveEnvironment(env);
  return {
    apiKey,
    environment,
    ...(env.ASAAS_API_URL?.trim() ? { baseUrl: env.ASAAS_API_URL.trim() } : {}),
    ...(env.ASAAS_WEBHOOK_TOKEN?.trim() ? { webhookToken: env.ASAAS_WEBHOOK_TOKEN.trim() } : {}),
    ...(env.ASAAS_USER_AGENT?.trim() ? { userAgent: env.ASAAS_USER_AGENT.trim() } : {}),
    healthCheckNetwork: env.ASAAS_HEALTHCHECK === "1",
  };
}

function allowLiveProduction(env: PaymentProviderEnv, environment: AsaasEnvironment): boolean {
  if (environment !== "production") return true;
  return env.PAYMENTS_LIVE === "1";
}

/**
 * Factory do PaymentProvider a partir do ambiente.
 * Default: `not_configured`. Nunca inventa liquidação.
 *
 * Produção Asaas exige `PAYMENT_PROVIDER=asaas` + `ASAAS_API_KEY` + `PAYMENTS_LIVE=1`
 * + `ASAAS_ENVIRONMENT=production`. Sem isso, permanece not_configured.
 */
export function createPaymentProviderFromEnv(env: PaymentProviderEnv = {}): PaymentProvider {
  const provider = (env.PAYMENT_PROVIDER ?? "not_configured").trim().toLowerCase();
  if (provider !== "asaas") {
    return new NotConfiguredPaymentProvider();
  }

  const options = asaasOptions(env);
  if (!options.apiKey) {
    return new NotConfiguredPaymentProvider();
  }
  if (!allowLiveProduction(env, options.environment)) {
    return new NotConfiguredPaymentProvider();
  }

  return new AsaasPaymentProvider(options);
}

/**
 * Factory do BillingProvider (assinaturas). Pode espelhar PAYMENT_PROVIDER quando
 * BILLING_PROVIDER omitido e PAYMENT_PROVIDER=asaas.
 */
export function createBillingProviderFromEnv(env: PaymentProviderEnv = {}): BillingProvider {
  const explicit = (env.BILLING_PROVIDER ?? "").trim().toLowerCase();
  const payment = (env.PAYMENT_PROVIDER ?? "not_configured").trim().toLowerCase();
  const provider = explicit || (payment === "asaas" ? "asaas" : "not_configured");

  if (provider !== "asaas") {
    return new NotConfiguredBillingProvider();
  }

  const options = asaasOptions(env);
  if (!options.apiKey) {
    return new NotConfiguredBillingProvider();
  }
  if (!allowLiveProduction(env, options.environment)) {
    return new NotConfiguredBillingProvider();
  }

  return new AsaasBillingProvider(options);
}

export function isPublicCheckoutEnabled(env: PaymentProviderEnv = {}): boolean {
  return env.FEATURE_PUBLIC_CHECKOUT === "1";
}
