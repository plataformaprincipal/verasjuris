import { describe, expect, it } from "vitest";
import { fromApi, fromApiPreferences, toApiPatch } from "./accessibility";

describe("accessibility API mapping", () => {
  it("maps API shape into client preferences", () => {
    const prefs = fromApi(
      {
        fontScalePercent: 150,
        contrastMode: "normal",
        colorBlindnessMode: "deuteranopia",
        reduceMotion: true,
        screenReaderHints: true,
        largeControls: true,
        captionsEnabled: true,
        signLanguageEnabled: false,
        focusEnhancement: true,
        readingGuide: true,
      },
      { underlineLinks: true, colorTheme: "dark" },
    );

    expect(prefs.fontScale).toBe("150");
    expect(prefs.contrastMode).toBe("default");
    expect(prefs.colorVisionMode).toBe("deuteranopia");
    expect(prefs.reducedMotion).toBe(true);
    expect(prefs.screenReaderOptimized).toBe(true);
    expect(prefs.largeControls).toBe(true);
    expect(prefs.interfaceDensity).toBe("spacious");
    expect(prefs.underlineLinks).toBe(true);
    expect(prefs.colorTheme).toBe("dark");
  });

  it("maps client patch into API body", () => {
    const body = toApiPatch({
      fontScale: "125",
      contrastMode: "high",
      colorVisionMode: "protanopia",
      reducedMotion: true,
      screenReaderOptimized: false,
      largeControls: true,
      focusEnhancement: true,
      underlineLinks: true,
      colorTheme: "dark",
    });

    expect(body).toEqual({
      fontScalePercent: 125,
      contrastMode: "high",
      colorBlindnessMode: "protanopia",
      reduceMotion: true,
      screenReaderHints: false,
      largeControls: true,
      focusEnhancement: true,
    });
  });
});
