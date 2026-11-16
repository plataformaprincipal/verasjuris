import { describe, expect, it } from "vitest";
import { isPublicTabActive, PUBLIC_MAIN_TABS } from "./public-nav";

describe("public main tabs", () => {
  it("exposes Início, Explorar, Ferramentas, Marketplace e Juris One", () => {
    expect(PUBLIC_MAIN_TABS).toHaveLength(5);
    expect(PUBLIC_MAIN_TABS.map((tab) => tab.href)).toEqual([
      "/",
      "/explorar",
      "/ferramentas",
      "/marketplace-juridico",
      "/juris-one",
    ]);
  });

  it("matches nested ferramentas routes", () => {
    expect(isPublicTabActive("/ferramentas/documentos", "/ferramentas")).toBe(true);
    expect(isPublicTabActive("/explorar", "/ferramentas")).toBe(false);
    expect(isPublicTabActive("/", "/")).toBe(true);
    expect(isPublicTabActive("/ferramentas", "/")).toBe(false);
  });
});
