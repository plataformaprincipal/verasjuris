import { describe, expect, it } from "vitest";
import {
  isPlatformTabActive,
  PLATFORM_HOME_HREF,
  PLATFORM_MAIN_TABS,
  platformTabHref,
  shouldShowBackToPlatform,
} from "./platform-nav";

describe("platform-nav", () => {
  it("expõe Início, Explorar, Ferramentas, Marketplace e Juris One", () => {
    expect(PLATFORM_MAIN_TABS.map((t) => t.id)).toEqual([
      "home",
      "explore",
      "tools",
      "marketplace",
      "jurisOne",
    ]);
  });

  it("usa rotas autenticadas reais quando logado", () => {
    const home = PLATFORM_MAIN_TABS.find((t) => t.id === "home")!;
    const market = PLATFORM_MAIN_TABS.find((t) => t.id === "marketplace")!;
    const juris = PLATFORM_MAIN_TABS.find((t) => t.id === "jurisOne")!;
    expect(platformTabHref(home, true)).toBe("/app");
    expect(platformTabHref(market, true)).toBe("/app/marketplace");
    expect(platformTabHref(juris, true)).toBe("/app/juris-one");
    expect(platformTabHref(home, false)).toBe("/");
  });

  it("marca Início ativo em / e /app", () => {
    expect(isPlatformTabActive("/", "/app")).toBe(true);
    expect(isPlatformTabActive("/app", "/")).toBe(true);
    expect(isPlatformTabActive("/app/conta", "/app")).toBe(false);
  });

  it("mostra Voltar à plataforma só fora do Início autenticado", () => {
    expect(shouldShowBackToPlatform("/app")).toBe(false);
    expect(shouldShowBackToPlatform("/app/conta")).toBe(true);
    expect(shouldShowBackToPlatform("/app/configuracoes")).toBe(true);
    expect(shouldShowBackToPlatform("/explorar")).toBe(false);
    expect(PLATFORM_HOME_HREF).toBe("/app");
  });
});
