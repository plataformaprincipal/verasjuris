import { afterEach, describe, expect, it, vi } from "vitest";
import { AsaasPaymentProvider } from "./asaas-payment-provider.js";
import {
  createBillingProviderFromEnv,
  createPaymentProviderFromEnv,
} from "./create-payment-provider.js";
import { resolveAsaasBaseUrl, safeEqualToken } from "./asaas-client.js";

describe("AsaasPaymentProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolveAsaasBaseUrl aponta sandbox e production oficiais", () => {
    expect(resolveAsaasBaseUrl("sandbox")).toBe("https://api-sandbox.asaas.com/v3");
    expect(resolveAsaasBaseUrl("production")).toBe("https://api.asaas.com/v3");
  });

  it("safeEqualToken rejeita tokens divergentes", () => {
    expect(safeEqualToken("token-a-com-mais-de-32-caracteres!!!!", "outro")).toBe(false);
    expect(
      safeEqualToken(
        "token-a-com-mais-de-32-caracteres!!!!",
        "token-a-com-mais-de-32-caracteres!!!!",
      ),
    ).toBe(true);
  });

  it("createPaymentIntent PIX chama /payments e /pixQrCode sem expor a API key em logs de body", async () => {
    const fetchMock = vi.fn(async (url: string | URL) => {
      const href = String(url);
      if (href.endsWith("/customers")) {
        return new Response(JSON.stringify({ id: "cus_1" }), { status: 200 });
      }
      if (href.endsWith("/payments")) {
        return new Response(
          JSON.stringify({
            id: "pay_pix_1",
            status: "PENDING",
            value: 10.5,
            billingType: "PIX",
            invoiceUrl: "https://asaas.test/i/1",
          }),
          { status: 200 },
        );
      }
      if (href.endsWith("/pixQrCode")) {
        return new Response(
          JSON.stringify({
            encodedImage: "base64img",
            payload: "00020126pix-copia-cola",
            expirationDate: "2027-01-01T00:00:00Z",
          }),
          { status: 200 },
        );
      }
      return new Response("{}", { status: 404 });
    });

    const provider = new AsaasPaymentProvider({
      apiKey: "$aact_hmlg_test_key",
      environment: "sandbox",
      webhookToken: "whsec_test_token_with_32_chars_min!!",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    const intent = await provider.createPaymentIntent({
      amountCents: 1050,
      currency: "BRL",
      paymentMethod: "pix",
      description: "Teste Pix",
      idempotencyKey: "idem-pix-1",
      metadata: { customerEmail: "a@b.co", customerName: "Ana" },
    });

    expect(intent.providerKey).toBe("asaas");
    expect(intent.externalIntentId).toBe("pay_pix_1");
    expect(intent.status).toBe("requires_action");
    expect(intent.metadata?.pixCopyPaste).toBe("00020126pix-copia-cola");
    expect(intent.metadata?.pixQrCodeBase64).toBe("base64img");
    expect(intent.checkoutUrl).toBe("https://asaas.test/i/1");

    const paymentCall = fetchMock.mock.calls.find((c) => String(c[0]).endsWith("/payments")) as
      | [string | URL, RequestInit?]
      | undefined;
    expect(paymentCall).toBeDefined();
    const init = (paymentCall?.[1] ?? {}) as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.access_token).toBe("$aact_hmlg_test_key");
    expect(headers["User-Agent"]).toBe("VerasJuris");
    const body = JSON.parse(String(init.body)) as { billingType: string; value: number };
    expect(body.billingType).toBe("PIX");
    expect(body.value).toBe(10.5);
    expect(JSON.stringify(body)).not.toContain("creditCard");
    expect(JSON.stringify(body)).not.toContain("number");
  });

  it("cartão usa CREDIT_CARD sem enviar PAN/CVV", async () => {
    const fetchMock = vi.fn(async (url: string | URL) => {
      const href = String(url);
      if (href.endsWith("/customers")) {
        return new Response(JSON.stringify({ id: "cus_2" }), { status: 200 });
      }
      if (href.endsWith("/payments")) {
        return new Response(
          JSON.stringify({
            id: "pay_cc_1",
            status: "PENDING",
            value: 99,
            billingType: "CREDIT_CARD",
            invoiceUrl: "https://asaas.test/i/cc",
          }),
          { status: 200 },
        );
      }
      return new Response("{}", { status: 404 });
    });

    const provider = new AsaasPaymentProvider({
      apiKey: "key",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    const intent = await provider.createPaymentIntent({
      amountCents: 9900,
      paymentMethod: "credit_card",
      idempotencyKey: "idem-cc",
    });

    expect(intent.checkoutUrl).toContain("asaas.test");
    const paymentCall = fetchMock.mock.calls.find((c) => String(c[0]).endsWith("/payments")) as
      | [string | URL, RequestInit?]
      | undefined;
    const body = JSON.parse(String(paymentCall?.[1]?.body)) as Record<string, unknown>;
    expect(body.billingType).toBe("CREDIT_CARD");
    expect(body.creditCard).toBeUndefined();
    expect(body.creditCardHolderInfo).toBeUndefined();
  });

  it("verifyWebhook valida asaas-access-token", async () => {
    const token = "whsec_test_token_with_32_chars_min!!";
    const provider = new AsaasPaymentProvider({
      apiKey: "key",
      webhookToken: token,
      fetchImpl: vi.fn() as unknown as typeof fetch,
    });

    const ok = await provider.verifyWebhook({
      rawBody: JSON.stringify({ event: "PAYMENT_RECEIVED", payment: { id: "pay_1" } }),
      headers: { "asaas-access-token": token },
    });
    expect(typeof ok === "boolean" ? ok : ok.valid).toBe(true);

    const bad = await provider.verifyWebhook({
      rawBody: "{}",
      headers: { "asaas-access-token": "wrong" },
    });
    expect(typeof bad === "boolean" ? bad : bad.valid).toBe(false);
  });

  it("parseWebhook mapeia PAYMENT_RECEIVED e gera externalEventId estável", async () => {
    const provider = new AsaasPaymentProvider({
      apiKey: "key",
      webhookToken: "t",
      fetchImpl: vi.fn() as unknown as typeof fetch,
    });
    const event = await provider.parseWebhook({
      rawBody: JSON.stringify({
        id: "evt_99",
        event: "PAYMENT_RECEIVED",
        dateCreated: "2026-01-01 12:00:00",
        payment: { id: "pay_1", status: "RECEIVED", value: 10.5 },
      }),
      headers: {},
    });
    expect(event.type).toBe("payment.paid");
    expect(event.externalPaymentId).toBe("pay_1");
    expect(event.externalEventId).toBe("asaas:evt_99");
    expect(event.amountCents).toBe(1050);
  });

  it("refund e cancel chamam endpoints corretos", async () => {
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const href = String(url);
      if (href.includes("/refund")) {
        expect(init?.method).toBe("POST");
        return new Response(JSON.stringify({ id: "pay_1", status: "REFUNDED", value: 5 }), {
          status: 200,
        });
      }
      if (init?.method === "DELETE") {
        return new Response(JSON.stringify({ id: "pay_1", status: "DELETED", value: 5 }), {
          status: 200,
        });
      }
      return new Response("{}", { status: 404 });
    });
    const provider = new AsaasPaymentProvider({
      apiKey: "key",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    const refunded = await provider.refund("pay_1", 500);
    expect(refunded.status).toBe("refunded");
    const cancelled = await provider.cancel("pay_1");
    expect(cancelled.status).toBe("cancelled");
  });

  it("createPaymentProviderFromEnv permanece not_configured sem chave ou sem LIVE em production", () => {
    expect(createPaymentProviderFromEnv({ PAYMENT_PROVIDER: "asaas" }).id).toBe("not_configured");
    expect(
      createPaymentProviderFromEnv({
        PAYMENT_PROVIDER: "asaas",
        ASAAS_API_KEY: "k",
        ASAAS_ENVIRONMENT: "production",
        PAYMENTS_LIVE: "0",
      }).id,
    ).toBe("not_configured");
    expect(
      createPaymentProviderFromEnv({
        PAYMENT_PROVIDER: "asaas",
        ASAAS_API_KEY: "k",
        ASAAS_ENVIRONMENT: "sandbox",
      }).id,
    ).toBe("asaas");
    expect(
      createBillingProviderFromEnv({
        PAYMENT_PROVIDER: "asaas",
        ASAAS_API_KEY: "k",
        ASAAS_ENVIRONMENT: "sandbox",
      }).id,
    ).toBe("asaas");
  });
});
