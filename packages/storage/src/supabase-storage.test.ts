import { afterEach, describe, expect, it, vi } from "vitest";
import { createStorageProvider } from "./factory.js";
import { SupabaseStorageProvider } from "./supabase-storage.js";

const KEY = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

describe("SupabaseStorageProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("putObject envia POST com upsert e headers de service role", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response("{}", {
          status: 200,
          headers: { etag: '"abc"' },
        }),
    );
    const provider = new SupabaseStorageProvider({
      supabaseUrl: "https://example.supabase.co",
      serviceRoleKey: "service_role_secret",
      bucket: "VERASJURIS",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    const result = await provider.putObject({
      key: KEY,
      body: Buffer.from("hello"),
      contentType: "text/plain",
    });

    expect(result.sizeBytes).toBe(5);
    expect(result.etag).toBe('"abc"');
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit] | undefined;
    expect(call).toBeDefined();
    const url = String(call?.[0]);
    const init = (call?.[1] ?? {}) as RequestInit;
    expect(url).toContain("/storage/v1/object/VERASJURIS/");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer service_role_secret");
    expect(headers.apikey).toBe("service_role_secret");
    expect(headers["x-upsert"]).toBe("true");
    expect(JSON.stringify(init.headers)).not.toMatch(/NEXT_PUBLIC/);
  });

  it("createTemporaryDownloadUrl usa endpoint sign e monta URL privada", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ signedURL: "/object/sign/VERASJURIS/path?token=t" }), {
          status: 200,
        }),
    );
    const provider = new SupabaseStorageProvider({
      supabaseUrl: "https://example.supabase.co",
      serviceRoleKey: "service_role_secret",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    const temp = await provider.createTemporaryDownloadUrl(KEY, 120);
    expect(temp.url).toBe(
      "https://example.supabase.co/storage/v1/object/sign/VERASJURIS/path?token=t",
    );
    expect(temp.expiresAt.getTime()).toBeGreaterThan(Date.now());
    const first = fetchMock.mock.calls[0] as unknown as [string, RequestInit] | undefined;
    const init = (first?.[1] ?? {}) as RequestInit;
    const body = JSON.parse(String(init.body)) as {
      expiresIn: number;
    };
    expect(body.expiresIn).toBe(120);
  });

  it("objectExists devolve false em 404", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 404 }));
    const provider = new SupabaseStorageProvider({
      supabaseUrl: "https://example.supabase.co",
      serviceRoleKey: "service_role_secret",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    await expect(provider.objectExists(KEY)).resolves.toBe(false);
  });

  it("createStorageProvider(supabase) exige URL e service role", () => {
    expect(() =>
      createStorageProvider({
        STORAGE_PROVIDER: "supabase",
        SUPABASE_URL: "",
        SUPABASE_SERVICE_ROLE_KEY: "",
      }),
    ).toThrow(/SUPABASE/);
  });

  it("createStorageProvider(supabase) instancia adapter quando env completo", () => {
    const provider = createStorageProvider({
      STORAGE_PROVIDER: "supabase",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service_role_secret",
      SUPABASE_STORAGE_BUCKET: "VERASJURIS",
    });
    expect(provider).toBeInstanceOf(SupabaseStorageProvider);
  });
});
