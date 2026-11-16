import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_A11Y,
  applyAccessibilityToDocument,
  fromApi,
  toApiPatch,
  type AccessibilityPreferences,
} from "./accessibility";

describe("applyAccessibilityToDocument", () => {
  afterEach(() => {
    const root = document.documentElement;
    root.removeAttribute("style");
    for (const key of Object.keys({ ...root.dataset })) {
      delete root.dataset[key as keyof DOMStringMap];
    }
  });

  it("applies font scale, theme black, letter spacing and interactive highlight", () => {
    const prefs: AccessibilityPreferences = {
      ...DEFAULT_A11Y,
      fontScale: "150",
      colorTheme: "black",
      letterSpacing: "wide",
      highlightInteractive: true,
      uiZoom: "125",
      reduceDistractions: true,
      highVisibilityCursor: true,
      simplifiedUi: true,
      underlineLinks: true,
    };

    applyAccessibilityToDocument(prefs);

    const root = document.documentElement;
    expect(root.style.getPropertyValue("--vj-a11y-font-scale")).toBe("1.5");
    expect(root.style.getPropertyValue("--vj-a11y-ui-zoom")).toBe("1.25");
    expect(root.style.getPropertyValue("--vj-a11y-letter-spacing")).toBe("0.04em");
    expect(root.dataset.theme).toBe("black");
    expect(root.dataset.letterSpacing).toBe("wide");
    expect(root.dataset.highlightInteractive).toBe("true");
    expect(root.dataset.largeCursor).toBe("true");
    expect(root.dataset.reduceDistractions).toBe("true");
    expect(root.dataset.simplifiedUi).toBe("true");
    expect(root.dataset.underlineLinks).toBe("true");
    expect(root.dataset.uiZoom).toBe("125");
  });

  it("preserves local-only fields on API merge and omits them from patch body", () => {
    const prefs = fromApi(
      {
        fontScalePercent: 120,
        contrastMode: "high",
        colorBlindnessMode: "none",
        reduceMotion: false,
        screenReaderHints: true,
        largeControls: false,
        captionsEnabled: true,
        signLanguageEnabled: true,
      },
      {
        underlineLinks: true,
        colorTheme: "black",
        letterSpacing: "wider",
        highlightInteractive: true,
        uiZoom: "150",
        reduceDistractions: true,
        simplifiedUi: true,
      },
    );

    expect(prefs.signLanguagePreferred).toBe(true);
    expect(prefs.colorTheme).toBe("black");
    expect(prefs.letterSpacing).toBe("wider");
    expect(prefs.highlightInteractive).toBe(true);
    expect(prefs.uiZoom).toBe("150");
    expect(prefs.reduceDistractions).toBe(true);
    expect(prefs.simplifiedUi).toBe(true);

    const body = toApiPatch({
      fontScale: "120",
      signLanguagePreferred: true,
      underlineLinks: true,
      colorTheme: "black",
      letterSpacing: "wider",
      highlightInteractive: true,
      uiZoom: "150",
      reduceDistractions: true,
      simplifiedUi: true,
    });

    expect(body.fontScalePercent).toBe(120);
    expect(body.signLanguageEnabled).toBe(true);
    expect(body).not.toHaveProperty("underlineLinks");
    expect(body).not.toHaveProperty("colorTheme");
    expect(body).not.toHaveProperty("letterSpacing");
    expect(body).not.toHaveProperty("highlightInteractive");
    expect(body).not.toHaveProperty("uiZoom");
    expect(body).not.toHaveProperty("reduceDistractions");
    expect(body).not.toHaveProperty("simplifiedUi");
  });
});
