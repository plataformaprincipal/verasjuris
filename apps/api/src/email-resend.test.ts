import { MemoryEmailProvider, verifyResendWebhookSignature } from "@verasjuris/email";
import { seedReferenceData } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { createMalwareScanner, LocalPrivateStorageProvider } from "@verasjuris/storage";
import { createHmac } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { call, registerVerified, testPassword } from "./test-helpers.js";

function signSvix(rawBody: string, secretBase64: string, msgId: string, timestamp: string) {
  const signed = `${msgId}.${timestamp}.${rawBody}`;
  const expected = createHmac("sha256", Buffer.from(secretBase64, "base64"))
    .update(signed)
    .digest("base64");
  return `v1,${expected}`;
}

describe("Resend e-mail — auth, idempotência e webhook", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  const webhookSecret = `whsec_${Buffer.from("test-webhook-secret-bytes-32!!!!").toString("base64")}`;
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let storageRoot: string;

  beforeAll(async () => {
    database = await started;
    await seedReferenceData(database.db);
    storageRoot = await mkdtemp(path.join(tmpdir(), "vj-email-"));
    app = await buildApp({
      db: database.db,
      logger: false,
      webOrigin: "http://127.0.0.1:3000",
      isProduction: false,
      email,
      resendWebhookSecret: webhookSecret,
      storage: new LocalPrivateStorageProvider(storageRoot),
      malwareScanner: createMalwareScanner(),
    });
  }, 120_000);

  afterAll(async () => {
    await app.close();
    await rm(storageRoot, { recursive: true, force: true });
    await database.close();
  });

  it("cadastro dispara verificação e recuperação envia link", async () => {
    email.clear();
    const cookie = await registerVerified(app, email, {
      displayName: "Email User",
      email: "email.user@exemplo.com",
    });
    expect(cookie).toBeTruthy();
    // registerVerified já cria conta; request explícito também é idempotente por token novo
    const reset = await call(app, "POST", "/v1/auth/password-reset/request", {
      email: "email.user@exemplo.com",
    });
    expect(reset.statusCode).toBe(200);
    const body = reset.json<{ status: string; emailDelivery: string }>();
    expect(body.status).toBe("accepted");
    expect(body.emailDelivery).toBe("captured");
    const msg = email.latest("password_reset", "email.user@exemplo.com");
    expect(msg?.text).toContain("/redefinir-senha?token=");
    expect(msg?.token).toBeTruthy();
  });

  it("e-mail inexistente não revela existência e não envia", async () => {
    email.clear();
    const before = email.outbox.length;
    const reset = await call(app, "POST", "/v1/auth/password-reset/request", {
      email: "nao.existe@exemplo.com",
    });
    expect(reset.statusCode).toBe(200);
    expect(reset.json<{ emailDelivery: string }>().emailDelivery).toBe("captured");
    expect(email.outbox.length).toBe(before);
  });

  it("redefinição completa invalida token e envia aviso de segurança", async () => {
    email.clear();
    await registerVerified(app, email, {
      displayName: "Reset User",
      email: "reset.user@exemplo.com",
    });
    await call(app, "POST", "/v1/auth/password-reset/request", {
      email: "reset.user@exemplo.com",
    });
    const token = email.latest("password_reset", "reset.user@exemplo.com")?.token;
    expect(token).toBeTruthy();

    const confirm = await call(app, "POST", "/v1/auth/password-reset/confirm", {
      token,
      password: testPassword,
    });
    expect(confirm.statusCode).toBe(200);

    const reuse = await call(app, "POST", "/v1/auth/password-reset/confirm", {
      token,
      password: "Veras@Local13",
    });
    expect(reuse.statusCode).toBe(401);

    expect(email.latest("password_changed", "reset.user@exemplo.com")).toBeTruthy();
  });

  it("webhook Resend: inválido rejeitado; válido e duplicado são idempotentes", async () => {
    const rawBody = JSON.stringify({
      type: "email.delivered",
      data: { email_id: "msg_test_1" },
    });
    const msgId = "msg_evt_1";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const secretRaw = webhookSecret.replace(/^whsec_/, "");
    const signature = signSvix(rawBody, secretRaw, msgId, timestamp);

    const bad = await app.inject({
      method: "POST",
      url: "/v1/webhooks/email/resend",
      payload: rawBody,
      headers: {
        "content-type": "application/json",
        "svix-id": msgId,
        "svix-timestamp": timestamp,
        "svix-signature": "v1,invalid",
      },
    });
    expect([401, 403]).toContain(bad.statusCode);

    const ok = await app.inject({
      method: "POST",
      url: "/v1/webhooks/email/resend",
      payload: rawBody,
      headers: {
        "content-type": "application/json",
        "svix-id": msgId,
        "svix-timestamp": timestamp,
        "svix-signature": signature,
      },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json<{ status: string }>().status).toBe("processed");

    const dup = await app.inject({
      method: "POST",
      url: "/v1/webhooks/email/resend",
      payload: rawBody,
      headers: {
        "content-type": "application/json",
        "svix-id": msgId,
        "svix-timestamp": timestamp,
        "svix-signature": signature,
      },
    });
    expect(dup.statusCode).toBe(200);
    expect(dup.json<{ status: string }>().status).toBe("already_processed");
  });

  it("verifyResendWebhookSignature rejeita timestamp antigo", () => {
    const rawBody = "{}";
    const msgId = "old";
    const timestamp = String(Math.floor(Date.now() / 1000) - 10_000);
    const secretRaw = "dGVzdC1zZWNyZXQ=";
    const signature = signSvix(rawBody, secretRaw, msgId, timestamp);
    const result = verifyResendWebhookSignature({
      rawBody,
      headers: {
        "svix-id": msgId,
        "svix-timestamp": timestamp,
        "svix-signature": signature,
      },
      secret: `whsec_${secretRaw}`,
      toleranceSeconds: 300,
    });
    expect(result.valid).toBe(false);
    expect(result.timestampOutOfTolerance).toBe(true);
  });
});
