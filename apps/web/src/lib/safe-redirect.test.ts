import { describe, expect, it } from "vitest";
import {
  isSafeRedirectPath,
  resolvePostAuthRedirect,
  SAFE_REDIRECT_PREFIXES,
  withRedirect,
} from "./safe-redirect";

describe("isSafeRedirectPath", () => {
  it("accepts allowlisted internal paths", () => {
    for (const prefix of SAFE_REDIRECT_PREFIXES) {
      expect(isSafeRedirectPath(prefix)).toBe(true);
      expect(isSafeRedirectPath(`${prefix}/sub`)).toBe(true);
    }
    expect(isSafeRedirectPath("/app/processos?aba=prazos#topo")).toBe(true);
    expect(isSafeRedirectPath("/checkout?plano=essencial")).toBe(true);
  });

  it.each([
    "//evil.com",
    "///evil.com",
    "/\\evil.com",
    "\\\\evil.com",
    "https://evil.com",
    "http://evil.com/app",
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "data:text/html,<script>",
    "app/processos",
    "evil.com",
    "",
    "/",
    "/outra-rota",
    "/application",
    "/app.evil.com",
    "/app/../admin",
    "/app/%2e%2e/admin",
    "/%2F%2Fevil.com",
    "/app\n/x",
    "/app\t",
    "/app x",
    "/%61pp/%2e%2e/%2e%2e/etc",
    "/app%",
    `/app/${"a".repeat(3000)}`,
  ])("rejects %j", (value) => {
    expect(isSafeRedirectPath(value)).toBe(false);
  });

  it("rejects non-string input", () => {
    expect(isSafeRedirectPath(undefined as unknown as string)).toBe(false);
    expect(isSafeRedirectPath(null as unknown as string)).toBe(false);
  });
});

describe("resolvePostAuthRedirect", () => {
  it("uses a safe redirect from search params", () => {
    const params = new URLSearchParams({ redirect: "/marketplace-juridico/servicos" });
    expect(resolvePostAuthRedirect(params)).toBe("/marketplace-juridico/servicos");
  });

  it("accepts a raw string candidate", () => {
    expect(resolvePostAuthRedirect("/portal/casos")).toBe("/portal/casos");
  });

  it("falls back for unsafe, missing or empty values", () => {
    expect(resolvePostAuthRedirect(new URLSearchParams({ redirect: "//evil.com" }))).toBe("/app");
    expect(resolvePostAuthRedirect("https://evil.com")).toBe("/app");
    expect(resolvePostAuthRedirect(new URLSearchParams())).toBe("/app");
    expect(resolvePostAuthRedirect(null)).toBe("/app");
    expect(resolvePostAuthRedirect(undefined)).toBe("/app");
    expect(resolvePostAuthRedirect("")).toBe("/app");
  });

  it("honors a custom safe fallback and ignores an unsafe one", () => {
    expect(resolvePostAuthRedirect(null, "/portal")).toBe("/portal");
    expect(resolvePostAuthRedirect(null, "//evil.com")).toBe("/app");
  });
});

describe("withRedirect", () => {
  it("preserves a safe redirect as an encoded query param", () => {
    expect(withRedirect("/entrar", "/checkout?plano=a&b=1")).toBe(
      "/entrar?redirect=%2Fcheckout%3Fplano%3Da%26b%3D1",
    );
  });

  it("drops unsafe or empty redirects", () => {
    expect(withRedirect("/entrar", "//evil.com")).toBe("/entrar");
    expect(withRedirect("/cadastro", null)).toBe("/cadastro");
  });
});
