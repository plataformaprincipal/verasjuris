import type { SessionAccount } from "@verasjuris/auth";
import type { AppDatabase } from "@verasjuris/database";
import { accessibilityPreferences } from "@verasjuris/database";
import { eq } from "drizzle-orm";

function mapContrast(mode?: string): "default" | "high" | "inverted" | "custom" {
  if (mode === "high" || mode === "extra_high") return "high";
  if (mode === "dark_high_contrast" || mode === "inverted") return "inverted";
  if (mode === "custom") return "custom";
  return "default";
}

function toApi(row: typeof accessibilityPreferences.$inferSelect) {
  return {
    fontScalePercent: Number(row.fontScale) || 100,
    contrastMode:
      row.contrastMode === "high"
        ? "high"
        : row.contrastMode === "inverted"
          ? "dark_high_contrast"
          : "normal",
    colorBlindnessMode: row.colorVisionMode,
    reduceMotion: row.reducedMotion,
    screenReaderHints: row.screenReaderOptimized,
    largeControls: row.interfaceDensity === "spacious",
    captionsEnabled: row.captionsPreferred,
    signLanguageEnabled: row.signLanguagePreferred,
    fontScale: row.fontScale,
    lineSpacing: row.lineSpacing,
    focusEnhancement: row.focusEnhancement,
    simplifiedLanguage: row.simplifiedLanguage,
    dyslexiaFriendlyMode: row.dyslexiaFriendlyMode,
    cognitiveSupportMode: row.cognitiveSupportMode,
    keyboardOnly: row.keyboardOnly,
    highVisibilityCursor: row.highVisibilityCursor,
    readingGuide: row.readingGuide,
    interfaceDensity: row.interfaceDensity,
    activeProfile: row.activeProfile,
    reducedTransparency: row.reducedTransparency,
  };
}

type PutInput = Partial<{
  fontScalePercent: number;
  contrastMode: string;
  colorBlindnessMode: "none" | "protanopia" | "deuteranopia" | "tritanopia" | "achromatopsia";
  reduceMotion: boolean;
  screenReaderHints: boolean;
  largeControls: boolean;
  captionsEnabled: boolean;
  signLanguageEnabled: boolean;
  lineSpacing: string;
  focusEnhancement: boolean;
  simplifiedLanguage: boolean;
  dyslexiaFriendlyMode: boolean;
  cognitiveSupportMode: boolean;
  keyboardOnly: boolean;
  highVisibilityCursor: boolean;
  readingGuide: boolean;
  interfaceDensity: "comfortable" | "compact" | "spacious";
  activeProfile: string | null;
  reducedTransparency: boolean;
}>;

export class AccessibilityService {
  constructor(private readonly db: AppDatabase) {}

  async get(account: SessionAccount) {
    const row = await this.db.query.accessibilityPreferences.findFirst({
      where: eq(accessibilityPreferences.userId, account.user.id),
    });
    if (!row) {
      return {
        preferences: {
          fontScalePercent: 100,
          contrastMode: "normal",
          colorBlindnessMode: "none",
          reduceMotion: false,
          screenReaderHints: true,
          largeControls: false,
          captionsEnabled: true,
          signLanguageEnabled: false,
          lineSpacing: "normal",
          focusEnhancement: false,
          simplifiedLanguage: false,
          dyslexiaFriendlyMode: false,
          cognitiveSupportMode: false,
          keyboardOnly: false,
          highVisibilityCursor: false,
          readingGuide: false,
          interfaceDensity: "comfortable",
          activeProfile: null,
          reducedTransparency: false,
        },
      };
    }
    return { preferences: toApi(row) };
  }

  async put(account: SessionAccount, input: PutInput) {
    const existing = await this.db.query.accessibilityPreferences.findFirst({
      where: eq(accessibilityPreferences.userId, account.user.id),
    });

    let interfaceDensity =
      input.interfaceDensity ?? existing?.interfaceDensity ?? ("comfortable" as const);
    if (input.largeControls === true) interfaceDensity = "spacious";
    if (input.largeControls === false && input.interfaceDensity === undefined) {
      // Only collapse spacious → comfortable; keep compact untouched.
      interfaceDensity =
        existing?.interfaceDensity === "spacious"
          ? "comfortable"
          : (existing?.interfaceDensity ?? "comfortable");
    }

    const values = {
      fontScale: String(input.fontScalePercent ?? (existing ? Number(existing.fontScale) : 100)),
      contrastMode: mapContrast(input.contrastMode ?? existing?.contrastMode),
      colorVisionMode: input.colorBlindnessMode ?? existing?.colorVisionMode ?? "none",
      reducedMotion: input.reduceMotion ?? existing?.reducedMotion ?? false,
      screenReaderOptimized: input.screenReaderHints ?? existing?.screenReaderOptimized ?? false,
      interfaceDensity,
      captionsPreferred: input.captionsEnabled ?? existing?.captionsPreferred ?? false,
      signLanguagePreferred: input.signLanguageEnabled ?? existing?.signLanguagePreferred ?? false,
      lineSpacing: input.lineSpacing ?? existing?.lineSpacing ?? "normal",
      focusEnhancement: input.focusEnhancement ?? existing?.focusEnhancement ?? false,
      simplifiedLanguage: input.simplifiedLanguage ?? existing?.simplifiedLanguage ?? false,
      dyslexiaFriendlyMode: input.dyslexiaFriendlyMode ?? existing?.dyslexiaFriendlyMode ?? false,
      cognitiveSupportMode: input.cognitiveSupportMode ?? existing?.cognitiveSupportMode ?? false,
      keyboardOnly: input.keyboardOnly ?? existing?.keyboardOnly ?? false,
      highVisibilityCursor: input.highVisibilityCursor ?? existing?.highVisibilityCursor ?? false,
      readingGuide: input.readingGuide ?? existing?.readingGuide ?? false,
      activeProfile:
        input.activeProfile !== undefined ? input.activeProfile : (existing?.activeProfile ?? null),
      reducedTransparency: input.reducedTransparency ?? existing?.reducedTransparency ?? false,
      updatedAt: new Date(),
    };
    if (existing) {
      const [row] = await this.db
        .update(accessibilityPreferences)
        .set(values)
        .where(eq(accessibilityPreferences.id, existing.id))
        .returning();
      return { preferences: toApi(row!) };
    }
    const [row] = await this.db
      .insert(accessibilityPreferences)
      .values({ userId: account.user.id, ...values })
      .returning();
    return { preferences: toApi(row!) };
  }
}
