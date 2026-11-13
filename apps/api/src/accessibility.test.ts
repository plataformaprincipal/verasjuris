import { seedReferenceData } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { call, registerVerified } from "./test-helpers.js";

describe("Etapa 31 — accessibility preferences", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let cookie: string;

  beforeAll(async () => {
    database = await started;
    await seedReferenceData(database.db);
    app = await buildApp({
      db: database.db,
      logger: false,
      webOrigin: "http://127.0.0.1:3000",
      isProduction: false,
      email,
    });
    cookie = await registerVerified(app, email, {
      displayName: "A11y User",
      email: "a11y.user@exemplo.com",
    });
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  it("GET/PUT preferences", async () => {
    const get1 = await call(app, "GET", "/v1/me/accessibility-preferences", undefined, cookie);
    expect(get1.statusCode).toBe(200);
    const put = await call(
      app,
      "PUT",
      "/v1/me/accessibility-preferences",
      {
        fontScalePercent: 125,
        reduceMotion: true,
        contrastMode: "high",
        focusEnhancement: true,
        readingGuide: true,
        keyboardOnly: true,
      },
      cookie,
    );
    expect(put.statusCode).toBe(200);
    const preferences = put.json<{
      preferences: {
        fontScalePercent: number;
        reduceMotion: boolean;
        focusEnhancement: boolean;
        readingGuide: boolean;
        keyboardOnly: boolean;
      };
    }>().preferences;
    expect(preferences.fontScalePercent).toBe(125);
    expect(preferences.reduceMotion).toBe(true);
    expect(preferences.focusEnhancement).toBe(true);
    expect(preferences.readingGuide).toBe(true);
    expect(preferences.keyboardOnly).toBe(true);

    const rich = await call(
      app,
      "PUT",
      "/v1/me/accessibility-preferences",
      {
        dyslexiaFriendlyMode: true,
        cognitiveSupportMode: true,
        simplifiedLanguage: true,
        highVisibilityCursor: true,
        interfaceDensity: "compact",
        activeProfile: "dyslexia",
        reducedTransparency: true,
        lineSpacing: "relaxed",
      },
      cookie,
    );
    expect(rich.statusCode).toBe(200);
    const richPrefs = rich.json<{
      preferences: {
        dyslexiaFriendlyMode: boolean;
        cognitiveSupportMode: boolean;
        simplifiedLanguage: boolean;
        highVisibilityCursor: boolean;
        interfaceDensity: string;
        activeProfile: string | null;
        reducedTransparency: boolean;
        lineSpacing: string;
        largeControls: boolean;
        reduceMotion: boolean;
      };
    }>().preferences;
    expect(richPrefs.dyslexiaFriendlyMode).toBe(true);
    expect(richPrefs.cognitiveSupportMode).toBe(true);
    expect(richPrefs.simplifiedLanguage).toBe(true);
    expect(richPrefs.highVisibilityCursor).toBe(true);
    expect(richPrefs.interfaceDensity).toBe("compact");
    expect(richPrefs.activeProfile).toBe("dyslexia");
    expect(richPrefs.reducedTransparency).toBe(true);
    expect(richPrefs.lineSpacing).toBe("relaxed");
    expect(richPrefs.largeControls).toBe(false);
    // Unrelated fields from the previous PUT must survive.
    expect(richPrefs.reduceMotion).toBe(true);

    const get2 = await call(app, "GET", "/v1/me/accessibility-preferences", undefined, cookie);
    expect(get2.statusCode).toBe(200);
    expect(
      get2.json<{ preferences: { focusEnhancement: boolean; activeProfile: string | null } }>()
        .preferences.focusEnhancement,
    ).toBe(true);
    expect(
      get2.json<{ preferences: { activeProfile: string | null } }>().preferences.activeProfile,
    ).toBe("dyslexia");
  });
});
