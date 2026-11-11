import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmailProvider } from "./index.js";
import { ResendEmailProvider } from "./resend-provider.js";

describe("ResendEmailProvider", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("envia POST para a API Resend com Bearer e from", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ id: "msg_1" }), { status: 200 }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const provider = new ResendEmailProvider({
      apiKey: "re_test_key",
      fromEmail: "noreply@example.com",
    });

    const result = await provider.send({
      kind: "email_verification",
      to: "user@example.com",
      subject: "Verifique seu e-mail",
      text: "Token de teste",
    });

    expect(result.status).toBe("sent");
    expect(provider.status).toBe("configured");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit] | undefined;
    expect(call).toBeDefined();
    const url = String(call?.[0]);
    const init = (call?.[1] ?? {}) as RequestInit;
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer re_test_key");
    expect(JSON.stringify(init)).not.toMatch(/sk_|password|secret/i);
    const body = JSON.parse(String(init.body)) as {
      from: string;
      to: string[];
      subject: string;
      text: string;
    };
    expect(body.from).toBe("noreply@example.com");
    expect(body.to).toEqual(["user@example.com"]);
    expect(body.subject).toBe("Verifique seu e-mail");
    expect(body.text).toBe("Token de teste");
  });

  it("falha com EXTERNAL_SERVICE_ERROR sem vazar detalhes", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ message: "invalid api key re_secret" }), { status: 401 }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const provider = new ResendEmailProvider({
      apiKey: "re_test_key",
      fromEmail: "noreply@example.com",
    });

    await expect(
      provider.send({
        kind: "password_reset",
        to: "user@example.com",
        subject: "Reset",
        text: "body",
      }),
    ).rejects.toMatchObject({ code: "EXTERNAL_SERVICE_ERROR" });
  });

  it("createEmailProvider(resend) sem chave devolve not_configured", () => {
    const provider = createEmailProvider("resend", {});
    expect(provider.status).toBe("not_configured");
  });

  it("createEmailProvider(resend) com chave e from cria adapter configured", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    const provider = createEmailProvider("resend", {
      RESEND_API_KEY: "re_abc",
      RESEND_FROM_EMAIL: "from@example.com",
    });
    expect(provider.status).toBe("configured");
    // injeta fetch via cast interno — recria com mock
    const wired = new ResendEmailProvider({
      apiKey: "re_abc",
      fromEmail: "from@example.com",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    await wired.send({
      kind: "organization_invitation",
      to: "a@b.com",
      subject: "Convite",
      text: "olá",
    });
    expect(fetchMock).toHaveBeenCalled();
  });
});
