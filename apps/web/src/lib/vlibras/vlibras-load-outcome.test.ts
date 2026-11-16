import { describe, expect, it } from "vitest";
import {
  handleScriptOnError,
  isVLibrasLoadReady,
  nextScriptUrl,
  toVLibrasUiStatus,
  vlibrasFromScriptEvent,
  vlibrasReady,
} from "./vlibras-load-outcome";

describe("vlibras-load-outcome", () => {
  it("handleScriptOnError não lança exceção e retorna unavailable", () => {
    expect(() => handleScriptOnError()).not.toThrow();
    const outcome = handleScriptOnError();
    expect(outcome.status).toBe("unavailable");
    expect(isVLibrasLoadReady(outcome)).toBe(false);
    expect(toVLibrasUiStatus(outcome)).toBe("unavailable");
  });

  it("timeout retorna status timeout sem lançar", () => {
    const outcome = vlibrasFromScriptEvent("timeout");
    expect(outcome.status).toBe("timeout");
    expect(toVLibrasUiStatus(outcome)).toBe("error");
  });

  it("button-missing retorna unavailable (sem falso positivo ready)", () => {
    const outcome = vlibrasFromScriptEvent("button-missing");
    expect(outcome.status).toBe("unavailable");
    expect(isVLibrasLoadReady(outcome)).toBe(false);
  });

  it("vlibrasReady indica sucesso", () => {
    expect(isVLibrasLoadReady(vlibrasReady())).toBe(true);
    expect(toVLibrasUiStatus(vlibrasReady())).toBe("ready");
  });

  it("nextScriptUrl tenta fallback secundário", () => {
    const urls = [
      "https://vlibras.gov.br/app/vlibras-plugin.js",
      "https://www.vlibras.gov.br/app/vlibras-plugin.js",
    ] as const;
    expect(nextScriptUrl(urls, ["https://vlibras.gov.br/app/vlibras-plugin.js"])).toBe(
      "https://www.vlibras.gov.br/app/vlibras-plugin.js",
    );
    expect(nextScriptUrl(urls, [...urls])).toBeNull();
  });
});
