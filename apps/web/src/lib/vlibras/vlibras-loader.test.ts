import { describe, expect, it } from "vitest";
import { vlibrasLoadOutcome } from "./vlibras-loader";

describe("vlibrasLoadOutcome", () => {
  it("retorna idle quando desativado", () => {
    expect(
      vlibrasLoadOutcome({ scriptLoaded: true, widgetAvailable: true, enabled: false }),
    ).toBe("idle");
  });

  it("retorna loading enquanto o script não carregou", () => {
    expect(
      vlibrasLoadOutcome({ scriptLoaded: false, widgetAvailable: false, enabled: true }),
    ).toBe("loading");
  });

  it("retorna ready quando script e widget estão disponíveis", () => {
    expect(
      vlibrasLoadOutcome({ scriptLoaded: true, widgetAvailable: true, enabled: true }),
    ).toBe("ready");
  });

  it("retorna unavailable quando o script carregou sem widget", () => {
    expect(
      vlibrasLoadOutcome({ scriptLoaded: true, widgetAvailable: false, enabled: true }),
    ).toBe("unavailable");
  });
});
