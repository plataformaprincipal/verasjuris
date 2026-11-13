/**
 * Integração Asaas (PaymentProvider) + webhook — sem cobrança pública.
 * - Default: fetch mockado (sandbox shape); não chama rede Asaas.
 * - Opcional: RUN_ASAAS_SANDBOX=1 + ASAAS_API_KEY sandbox para ping real (não cria cobrança
 *   a menos que ASAAS_SANDBOX_CHARGE=1).
 * Gates: PAYMENTS_LIVE e FEATURE_PUBLIC_CHECKOUT devem permanecer 0 em produção.
 */
import type { PaymentProvider, PaymentWebhookEvent } from "@verasjuris/ai";
import {
  AsaasPaymentProvider,
  createPaymentProviderFromEnv,
  NotConfiguredPaymentProvider,
} from "@verasjuris/ai";
import { seedReferenceData } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildApp } from "./app.js";
import { bootstrapEtapa6, type Etapa6Setup } from "./etapa6.fixtures.js";
import { call } from "./test-helpers.js";

const WEBHOOK_TOKEN = "whsec_test_token_with_32_chars_min!!";

function mockAsaasFetch(): typeof fetch {
  let paySeq = 0;
  return vi.fn(async (url: string | URL, init?: RequestInit) => {
    const href = String(url);
    const method = (init?.method ?? "GET").toUpperCase();
    if (href.includes("/customers") && method === "POST") {
      return new Response(JSON.stringify({ id: "cus_test_1" }), { status: 200 });
    }
    if (href.endsWith("/customers?limit=1") && method === "GET") {
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }
    if (href.endsWith("/payments") && method === "POST") {
      paySeq += 1;
      const id = `pay_test_${paySeq}`;
      const body = init?.body ? (JSON.parse(String(init.body)) as { value?: number }) : {};
      return new Response(
        JSON.stringify({
          id,
          status: "PENDING",
          value: body.value ?? 25.5,
          billingType: "PIX",
          invoiceUrl: `https://sandbox.asaas.com/i/${id}`,
        }),
        { status: 200 },
      );
    }
    if (href.includes("/pixQrCode")) {
      return new Response(
        JSON.stringify({
          encodedImage: "iVBORw0KGgo=",
          payload: "00020126BR.GOV.BCB.PIX0136mock",
          expirationDate: "2027-01-01T00:00:00Z",
        }),
        { status: 200 },
      );
    }
    if (href.includes("/refund") && method === "POST") {
      return new Response(JSON.stringify({ id: "pay_test_1", status: "REFUNDED", value: 25.5 }), {
        status: 200,
      });
    }
    if (method === "DELETE" && href.includes("/payments/")) {
      return new Response(JSON.stringify({ id: "pay_test_1", status: "DELETED", value: 25.5 }), {
        status: 200,
      });
    }
    return new Response(JSON.stringify({ errors: [{ description: `mock 404 ${href}` }] }), {
      status: 404,
    });
  }) as unknown as typeof fetch;
}

describe("Asaas payments integration (mock sandbox)", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let s: Etapa6Setup;
  let provider: PaymentProvider;
  let payerId: string;

  beforeAll(async () => {
    database = await started;
    await seedReferenceData(database.db);
    provider = new AsaasPaymentProvider({
      apiKey: "$aact_hmlg_test_only",
      environment: "sandbox",
      webhookToken: WEBHOOK_TOKEN,
      fetchImpl: mockAsaasFetch(),
      healthCheckNetwork: false,
    });
    app = await buildApp({
      db: database.db,
      logger: false,
      webOrigin: "http://127.0.0.1:3000",
      isProduction: false,
      email,
      paymentProvider: provider,
    });
    s = await bootstrapEtapa6(app, email, "asaas-int");
    payerId = (await call(app, "GET", "/v1/auth/session", undefined, s.ownerA)).json<{
      account: { user: { id: string } };
    }>().account.user.id;
  });

  afterAll(async () => {
    await app?.close();
    await database?.close();
  });

  it("provider status asaas ok e factory respeita PAYMENTS_LIVE em production", async () => {
    const status = await call(
      app,
      "GET",
      `/v1/organizations/${s.orgA}/payments/provider-status`,
      undefined,
      s.ownerA,
    );
    expect(status.statusCode).toBe(200);
    expect(status.json<{ provider: { status: string } }>().provider.status).toBe("ok");

    expect(
      createPaymentProviderFromEnv({
        PAYMENT_PROVIDER: "asaas",
        ASAAS_API_KEY: "k",
        ASAAS_ENVIRONMENT: "production",
        PAYMENTS_LIVE: "0",
      }).id,
    ).toBe("not_configured");
    expect(new NotConfiguredPaymentProvider().id).toBe("not_configured");
  });

  it("cria intent Pix com metadata QR/copia-e-cola", async () => {
    const res = await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/payments/intents`,
      {
        payerType: "user",
        payerId,
        referenceType: "test",
        referenceId: s.matterAId,
        amountCents: 2550,
        currency: "BRL",
        paymentMethod: "pix",
        idempotencyKey: `asaas-pix-${Date.now()}`,
        metadata: { customerName: "Teste", customerEmail: "t@exemplo.com" },
      },
      s.ownerA,
    );
    expect(res.statusCode).toBe(201);
    const body = res.json<{
      paymentIntent: {
        status: string;
        providerKey: string;
        externalIntentId: string | null;
        metadata: Record<string, unknown> | null;
      };
    }>();
    expect(body.paymentIntent.providerKey).toBe("asaas");
    expect(body.paymentIntent.externalIntentId).toBe("pay_test_1");
    expect(body.paymentIntent.metadata?.pixCopyPaste).toBeTruthy();
    expect(body.paymentIntent.status).not.toBe("confirmed");
  });

  it("webhook inválido 403; válido confirma; duplicado already_processed", async () => {
    const intentRes = await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/payments/intents`,
      {
        payerType: "user",
        payerId,
        referenceType: "test",
        referenceId: s.matterAId,
        amountCents: 1000,
        currency: "BRL",
        paymentMethod: "pix",
        idempotencyKey: `asaas-wh-${Date.now()}`,
      },
      s.ownerA,
    );
    expect(intentRes.statusCode).toBe(201);
    const intent = intentRes.json<{
      paymentIntent: { id: string; externalIntentId: string | null };
    }>().paymentIntent;
    expect(intent.externalIntentId).toBeTruthy();

    const payload = {
      id: `evt_${Date.now()}`,
      event: "PAYMENT_RECEIVED",
      dateCreated: new Date().toISOString(),
      payment: {
        id: intent.externalIntentId,
        status: "RECEIVED",
        value: 10,
      },
    };

    const bad = await app.inject({
      method: "POST",
      url: "/v1/webhooks/payments/asaas",
      payload: JSON.stringify(payload),
      headers: {
        "content-type": "application/json",
        "asaas-access-token": "wrong-token",
      },
    });
    expect(bad.statusCode).toBe(403);

    const ok = await app.inject({
      method: "POST",
      url: "/v1/webhooks/payments/asaas",
      payload: JSON.stringify(payload),
      headers: {
        "content-type": "application/json",
        "asaas-access-token": WEBHOOK_TOKEN,
      },
    });
    expect(ok.statusCode).toBe(200);
    const first = ok.json<{ status: string }>();
    expect(first.status).not.toBe("error");

    const dup = await app.inject({
      method: "POST",
      url: "/v1/webhooks/payments/asaas",
      payload: JSON.stringify(payload),
      headers: {
        "content-type": "application/json",
        "asaas-access-token": WEBHOOK_TOKEN,
      },
    });
    expect(dup.statusCode).toBe(200);
    expect(dup.json<{ status: string }>().status).toBe("already_processed");
  });

  it("parseWebhook distingue paid vs refunded com externalEventId", async () => {
    const paid = await provider.parseWebhook({
      rawBody: JSON.stringify({
        id: "evt_paid",
        event: "PAYMENT_CONFIRMED",
        payment: { id: "pay_x", status: "CONFIRMED", value: 1 },
      }),
      headers: {},
    });
    const refunded = await provider.parseWebhook({
      rawBody: JSON.stringify({
        id: "evt_ref",
        event: "PAYMENT_REFUNDED",
        payment: { id: "pay_x", status: "REFUNDED", value: 1 },
      }),
      headers: {},
    });
    expect((paid as PaymentWebhookEvent).type).toBe("payment.paid");
    expect((refunded as PaymentWebhookEvent).type).toBe("payment.refunded");
    expect(paid.externalEventId).not.toBe(refunded.externalEventId);
  });
});

describe("Asaas sandbox live (opt-in)", () => {
  const run = process.env.RUN_ASAAS_SANDBOX === "1";
  const key = process.env.ASAAS_API_KEY?.trim();

  it.skipIf(!run || !key)("healthCheck de rede no sandbox sem cobrança", async () => {
    expect(process.env.PAYMENTS_LIVE ?? "0").not.toBe("1");
    expect(process.env.FEATURE_PUBLIC_CHECKOUT ?? "0").not.toBe("1");
    const apiKey = key ?? "";
    expect(apiKey.length).toBeGreaterThan(0);
    const provider = new AsaasPaymentProvider({
      apiKey,
      environment: "sandbox",
      healthCheckNetwork: true,
      ...(process.env.ASAAS_WEBHOOK_TOKEN ? { webhookToken: process.env.ASAAS_WEBHOOK_TOKEN } : {}),
    });
    const health = await provider.healthCheck();
    expect(["ok", "degraded", "unavailable"]).toContain(health.status);
  });
});
