import { CSRF_HEADER } from "@verasjuris/security/constants";
import type { AiApiFailure } from "./ai";
import { isApiFailure } from "./ai";

export type ContrastMode =
  | "default"
  | "high"
  | "inverted"
  | "custom"
  | "extra_high"
  | "dark_high_contrast";
export type ColorVisionMode =
  | "none"
  | "protanopia"
  | "deuteranopia"
  | "tritanopia"
  | "achromatopsia";
export type InterfaceDensity = "comfortable" | "compact" | "spacious";
export type ColorTheme = "system" | "light" | "dark" | "black";
export type LetterSpacingMode = "normal" | "wide" | "wider";
export type LineSpacingMode = "normal" | "relaxed" | "loose";
export type UiZoomMode = "100" | "110" | "125" | "150";

export type AccessibilityPreferences = {
  fontScale: string;
  lineSpacing: string;
  contrastMode: ContrastMode;
  colorVisionMode: ColorVisionMode;
  reducedMotion: boolean;
  reducedTransparency: boolean;
  focusEnhancement: boolean;
  screenReaderOptimized: boolean;
  simplifiedLanguage: boolean;
  dyslexiaFriendlyMode: boolean;
  cognitiveSupportMode: boolean;
  captionsPreferred: boolean;
  signLanguagePreferred: boolean;
  keyboardOnly: boolean;
  highVisibilityCursor: boolean;
  readingGuide: boolean;
  interfaceDensity: InterfaceDensity;
  activeProfile: string | null;
  largeControls?: boolean;
  underlineLinks?: boolean;
  colorTheme?: ColorTheme;
  /** Local-only until API schema expands. */
  letterSpacing?: LetterSpacingMode;
  highlightInteractive?: boolean;
  uiZoom?: UiZoomMode;
  reduceDistractions?: boolean;
  simplifiedUi?: boolean;
};

/** Shape returned/accepted by `/v1/me/accessibility-preferences`. */
export type AccessibilityApiPreferences = {
  fontScalePercent?: number;
  contrastMode?: string;
  colorBlindnessMode?: ColorVisionMode;
  reduceMotion?: boolean;
  screenReaderHints?: boolean;
  largeControls?: boolean;
  captionsEnabled?: boolean;
  signLanguageEnabled?: boolean;
  fontScale?: string;
  lineSpacing?: string;
  focusEnhancement?: boolean;
  simplifiedLanguage?: boolean;
  dyslexiaFriendlyMode?: boolean;
  cognitiveSupportMode?: boolean;
  keyboardOnly?: boolean;
  highVisibilityCursor?: boolean;
  readingGuide?: boolean;
  interfaceDensity?: InterfaceDensity;
  activeProfile?: string | null;
  colorVisionMode?: ColorVisionMode;
  reducedMotion?: boolean;
  screenReaderOptimized?: boolean;
  captionsPreferred?: boolean;
  signLanguagePreferred?: boolean;
  reducedTransparency?: boolean;
};

/** Campos locais que a API ainda não persiste — preservados no merge. */
export type AccessibilityLocalExtras = Pick<
  AccessibilityPreferences,
  | "underlineLinks"
  | "colorTheme"
  | "letterSpacing"
  | "highlightInteractive"
  | "uiZoom"
  | "reduceDistractions"
  | "simplifiedUi"
>;

export const DEFAULT_A11Y: AccessibilityPreferences = {
  fontScale: "100",
  lineSpacing: "normal",
  contrastMode: "default",
  colorVisionMode: "none",
  reducedMotion: false,
  reducedTransparency: false,
  focusEnhancement: false,
  screenReaderOptimized: false,
  simplifiedLanguage: false,
  dyslexiaFriendlyMode: false,
  cognitiveSupportMode: false,
  captionsPreferred: true,
  signLanguagePreferred: false,
  keyboardOnly: false,
  highVisibilityCursor: false,
  readingGuide: false,
  interfaceDensity: "comfortable",
  activeProfile: null,
  largeControls: false,
  underlineLinks: false,
  colorTheme: "system",
  letterSpacing: "normal",
  highlightInteractive: false,
  uiZoom: "100",
  reduceDistractions: false,
  simplifiedUi: false,
};

export type QuickProfileId =
  | "screen_reader"
  | "low_vision"
  | "color_blind"
  | "reduced_mobility"
  | "keyboard"
  | "autism"
  | "dyslexia"
  | "adhd"
  | "reduced_motion"
  | "high_contrast"
  | "simplified";

export const QUICK_PROFILES: Array<{
  id: QuickProfileId;
  labelKey: string;
  patch: Partial<AccessibilityPreferences>;
}> = [
  {
    id: "screen_reader",
    labelKey: "a11y.profile.screen_reader",
    patch: {
      screenReaderOptimized: true,
      focusEnhancement: true,
      activeProfile: "screen_reader",
    },
  },
  {
    id: "low_vision",
    labelKey: "a11y.profile.low_vision",
    patch: {
      fontScale: "150",
      contrastMode: "high",
      largeControls: true,
      focusEnhancement: true,
      interfaceDensity: "spacious",
      uiZoom: "125",
      activeProfile: "low_vision",
    },
  },
  {
    id: "color_blind",
    labelKey: "a11y.profile.color_blind",
    patch: { colorVisionMode: "deuteranopia", activeProfile: "color_blind" },
  },
  {
    id: "reduced_mobility",
    labelKey: "a11y.profile.reduced_mobility",
    patch: {
      largeControls: true,
      keyboardOnly: true,
      focusEnhancement: true,
      interfaceDensity: "spacious",
      activeProfile: "reduced_mobility",
    },
  },
  {
    id: "keyboard",
    labelKey: "a11y.profile.keyboard",
    patch: {
      keyboardOnly: true,
      focusEnhancement: true,
      activeProfile: "keyboard",
    },
  },
  {
    id: "autism",
    labelKey: "a11y.profile.autism",
    patch: {
      cognitiveSupportMode: true,
      reducedMotion: true,
      simplifiedLanguage: true,
      reduceDistractions: true,
      simplifiedUi: true,
      activeProfile: "autism",
    },
  },
  {
    id: "dyslexia",
    labelKey: "a11y.profile.dyslexia",
    patch: {
      dyslexiaFriendlyMode: true,
      lineSpacing: "relaxed",
      letterSpacing: "wide",
      readingGuide: true,
      fontScale: "120",
      activeProfile: "dyslexia",
    },
  },
  {
    id: "adhd",
    labelKey: "a11y.profile.adhd",
    patch: {
      cognitiveSupportMode: true,
      reducedMotion: true,
      readingGuide: true,
      reduceDistractions: true,
      activeProfile: "adhd",
    },
  },
  {
    id: "reduced_motion",
    labelKey: "a11y.profile.reduced_motion",
    patch: { reducedMotion: true, activeProfile: "reduced_motion" },
  },
  {
    id: "high_contrast",
    labelKey: "a11y.profile.high_contrast",
    patch: { contrastMode: "high", activeProfile: "high_contrast" },
  },
  {
    id: "simplified",
    labelKey: "a11y.profile.simplified",
    patch: {
      simplifiedLanguage: true,
      cognitiveSupportMode: true,
      simplifiedUi: true,
      reduceDistractions: true,
      activeProfile: "simplified",
    },
  },
];

const STORAGE_KEY = "vj.accessibility.preferences";
export const A11Y_CHANGE_EVENT = "vj:accessibility-change";

function pickLocalExtras(prefs: AccessibilityPreferences): AccessibilityLocalExtras {
  return {
    underlineLinks: prefs.underlineLinks,
    colorTheme: prefs.colorTheme,
    letterSpacing: prefs.letterSpacing,
    highlightInteractive: prefs.highlightInteractive,
    uiZoom: prefs.uiZoom,
    reduceDistractions: prefs.reduceDistractions,
    simplifiedUi: prefs.simplifiedUi,
  };
}

export function loadLocalAccessibility(): AccessibilityPreferences {
  if (typeof window === "undefined") return { ...DEFAULT_A11Y };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_A11Y };
    return { ...DEFAULT_A11Y, ...(JSON.parse(raw) as Partial<AccessibilityPreferences>) };
  } catch {
    return { ...DEFAULT_A11Y };
  }
}

export function saveLocalAccessibility(prefs: AccessibilityPreferences): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  window.dispatchEvent(new CustomEvent(A11Y_CHANGE_EVENT, { detail: prefs }));
}

function mapContrastFromApi(mode?: string): ContrastMode {
  if (mode === "normal" || mode === "default") return "default";
  if (mode === "high") return "high";
  if (mode === "extra_high") return "extra_high";
  if (mode === "dark_high_contrast") return "dark_high_contrast";
  if (mode === "inverted") return "inverted";
  if (mode === "custom") return "custom";
  return "default";
}

function mapContrastToApi(
  mode: ContrastMode | undefined,
): "normal" | "high" | "extra_high" | "dark_high_contrast" {
  if (mode === "high") return "high";
  if (mode === "extra_high") return "extra_high";
  if (mode === "dark_high_contrast" || mode === "inverted") return "dark_high_contrast";
  return "normal";
}

export function fromApi(
  api: AccessibilityApiPreferences,
  localExtras?: AccessibilityLocalExtras,
): AccessibilityPreferences {
  return fromApiPreferences(api, localExtras);
}

export function fromApiPreferences(
  api: AccessibilityApiPreferences,
  localExtras?: AccessibilityLocalExtras,
): AccessibilityPreferences {
  const fontScale = String(api.fontScalePercent ?? api.fontScale ?? DEFAULT_A11Y.fontScale);
  const largeControls =
    api.largeControls !== undefined
      ? api.largeControls
      : api.interfaceDensity === "spacious" || Boolean(DEFAULT_A11Y.largeControls);
  return {
    ...DEFAULT_A11Y,
    fontScale,
    lineSpacing: api.lineSpacing ?? DEFAULT_A11Y.lineSpacing,
    contrastMode: mapContrastFromApi(api.contrastMode),
    colorVisionMode: api.colorBlindnessMode ?? api.colorVisionMode ?? DEFAULT_A11Y.colorVisionMode,
    reducedMotion: api.reduceMotion ?? api.reducedMotion ?? DEFAULT_A11Y.reducedMotion,
    reducedTransparency: api.reducedTransparency ?? DEFAULT_A11Y.reducedTransparency,
    focusEnhancement: api.focusEnhancement ?? DEFAULT_A11Y.focusEnhancement,
    screenReaderOptimized:
      api.screenReaderHints ?? api.screenReaderOptimized ?? DEFAULT_A11Y.screenReaderOptimized,
    simplifiedLanguage: api.simplifiedLanguage ?? DEFAULT_A11Y.simplifiedLanguage,
    dyslexiaFriendlyMode: api.dyslexiaFriendlyMode ?? DEFAULT_A11Y.dyslexiaFriendlyMode,
    cognitiveSupportMode: api.cognitiveSupportMode ?? DEFAULT_A11Y.cognitiveSupportMode,
    captionsPreferred:
      api.captionsEnabled ?? api.captionsPreferred ?? DEFAULT_A11Y.captionsPreferred,
    signLanguagePreferred:
      api.signLanguageEnabled ?? api.signLanguagePreferred ?? DEFAULT_A11Y.signLanguagePreferred,
    keyboardOnly: api.keyboardOnly ?? DEFAULT_A11Y.keyboardOnly,
    highVisibilityCursor: api.highVisibilityCursor ?? DEFAULT_A11Y.highVisibilityCursor,
    readingGuide: api.readingGuide ?? DEFAULT_A11Y.readingGuide,
    interfaceDensity:
      api.interfaceDensity ?? (largeControls ? "spacious" : DEFAULT_A11Y.interfaceDensity),
    activeProfile: api.activeProfile ?? null,
    largeControls: Boolean(largeControls),
    underlineLinks: localExtras?.underlineLinks ?? DEFAULT_A11Y.underlineLinks,
    colorTheme: localExtras?.colorTheme ?? DEFAULT_A11Y.colorTheme,
    letterSpacing: localExtras?.letterSpacing ?? DEFAULT_A11Y.letterSpacing,
    highlightInteractive: localExtras?.highlightInteractive ?? DEFAULT_A11Y.highlightInteractive,
    uiZoom: localExtras?.uiZoom ?? DEFAULT_A11Y.uiZoom,
    reduceDistractions: localExtras?.reduceDistractions ?? DEFAULT_A11Y.reduceDistractions,
    simplifiedUi: localExtras?.simplifiedUi ?? DEFAULT_A11Y.simplifiedUi,
  };
}

export function toApiPatch(patch: Partial<AccessibilityPreferences>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (patch.fontScale !== undefined) {
    body.fontScalePercent = Number.parseInt(patch.fontScale, 10) || 100;
  }
  if (patch.contrastMode !== undefined) {
    body.contrastMode = mapContrastToApi(patch.contrastMode);
  }
  if (patch.colorVisionMode !== undefined) body.colorBlindnessMode = patch.colorVisionMode;
  if (patch.reducedMotion !== undefined) body.reduceMotion = patch.reducedMotion;
  if (patch.screenReaderOptimized !== undefined) {
    body.screenReaderHints = patch.screenReaderOptimized;
  }
  if (patch.largeControls !== undefined) body.largeControls = patch.largeControls;
  if (patch.captionsPreferred !== undefined) body.captionsEnabled = patch.captionsPreferred;
  if (patch.signLanguagePreferred !== undefined) {
    body.signLanguageEnabled = patch.signLanguagePreferred;
  }
  if (patch.lineSpacing !== undefined) body.lineSpacing = patch.lineSpacing;
  if (patch.focusEnhancement !== undefined) body.focusEnhancement = patch.focusEnhancement;
  if (patch.simplifiedLanguage !== undefined) body.simplifiedLanguage = patch.simplifiedLanguage;
  if (patch.dyslexiaFriendlyMode !== undefined) {
    body.dyslexiaFriendlyMode = patch.dyslexiaFriendlyMode;
  }
  if (patch.cognitiveSupportMode !== undefined) {
    body.cognitiveSupportMode = patch.cognitiveSupportMode;
  }
  if (patch.keyboardOnly !== undefined) body.keyboardOnly = patch.keyboardOnly;
  if (patch.highVisibilityCursor !== undefined) {
    body.highVisibilityCursor = patch.highVisibilityCursor;
  }
  if (patch.readingGuide !== undefined) body.readingGuide = patch.readingGuide;
  if (patch.interfaceDensity !== undefined) body.interfaceDensity = patch.interfaceDensity;
  if (patch.activeProfile !== undefined) body.activeProfile = patch.activeProfile;
  if (patch.reducedTransparency !== undefined) {
    body.reducedTransparency = patch.reducedTransparency;
  }
  // Local-only fields intentionally omitted from API body.
  return body;
}

function boolAttr(value: boolean | undefined): "true" | "false" {
  return value ? "true" : "false";
}

/** Aplica preferências em <html> via CSS variables e data-attributes (sem filtros globais). */
export function applyAccessibilityToDocument(prefs: AccessibilityPreferences): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const scale = Number.parseInt(prefs.fontScale, 10);
  const zoom = Number.parseInt(prefs.uiZoom ?? "100", 10);
  root.style.setProperty("--vj-a11y-font-scale", Number.isFinite(scale) ? `${scale / 100}` : "1");
  root.style.setProperty("--vj-a11y-ui-zoom", Number.isFinite(zoom) ? `${zoom / 100}` : "1");

  const letter =
    prefs.letterSpacing === "wider" ? "0.08em" : prefs.letterSpacing === "wide" ? "0.04em" : "0";
  root.style.setProperty("--vj-a11y-letter-spacing", letter);

  root.dataset.contrast = prefs.contrastMode;
  root.dataset.colorVision = prefs.colorVisionMode;
  root.dataset.reducedMotion = boolAttr(prefs.reducedMotion);
  root.dataset.cognitiveSupport = boolAttr(prefs.cognitiveSupportMode);
  root.dataset.readingGuide = boolAttr(prefs.readingGuide);
  root.dataset.dyslexia = boolAttr(prefs.dyslexiaFriendlyMode);
  root.dataset.lineSpacing = prefs.lineSpacing || "normal";
  root.dataset.letterSpacing = prefs.letterSpacing ?? "normal";
  root.dataset.focusEnhancement = boolAttr(prefs.focusEnhancement);
  root.dataset.largeControls = boolAttr(prefs.largeControls);
  root.dataset.simplifiedLanguage = boolAttr(prefs.simplifiedLanguage);
  root.dataset.keyboardOnly = boolAttr(prefs.keyboardOnly);
  root.dataset.density = prefs.interfaceDensity;
  root.dataset.a11yProfile = prefs.activeProfile ?? "";
  root.dataset.underlineLinks = boolAttr(prefs.underlineLinks);
  root.dataset.theme = prefs.colorTheme ?? "system";
  root.dataset.highlightInteractive = boolAttr(prefs.highlightInteractive);
  root.dataset.largeCursor = boolAttr(prefs.highVisibilityCursor);
  root.dataset.uiZoom = prefs.uiZoom ?? "100";
  root.dataset.reduceDistractions = boolAttr(prefs.reduceDistractions);
  root.dataset.simplifiedUi = boolAttr(prefs.simplifiedUi);
  root.dataset.screenReader = boolAttr(prefs.screenReaderOptimized);
  root.dataset.signLanguage = boolAttr(prefs.signLanguagePreferred);
  root.dataset.reducedTransparency = boolAttr(prefs.reducedTransparency);
}

async function request<T>(path: string, init?: RequestInit): Promise<T | AiApiFailure> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...(init?.method && init.method !== "GET" ? { [CSRF_HEADER]: "1" } : {}),
        ...init?.headers,
      },
      cache: "no-store",
    });
  } catch {
    return { httpStatus: 0, error: { code: "network", message: "Falha de rede." } };
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as AiApiFailure;
    return { httpStatus: response.status, ...body };
  }
  if (response.status === 204) return {} as T;
  return (await response.json()) as T;
}

export async function fetchAccessibilityPreferences(): Promise<
  AccessibilityPreferences | AiApiFailure
> {
  const local = loadLocalAccessibility();
  const res = await request<{ preferences: AccessibilityApiPreferences }>(
    "/api/v1/me/accessibility-preferences",
  );
  if (isApiFailure(res)) return res;
  return fromApiPreferences(res.preferences, pickLocalExtras(local));
}

export async function updateAccessibilityPreferences(
  patch: Partial<AccessibilityPreferences>,
): Promise<AccessibilityPreferences | AiApiFailure> {
  const local = loadLocalAccessibility();
  const nextLocal: AccessibilityPreferences = {
    ...local,
    ...patch,
  };
  saveLocalAccessibility(nextLocal);
  applyAccessibilityToDocument(nextLocal);

  const res = await request<{ preferences: AccessibilityApiPreferences }>(
    "/api/v1/me/accessibility-preferences",
    { method: "PUT", body: JSON.stringify(toApiPatch(patch)) },
  );
  if (isApiFailure(res)) {
    // Preferências locais (tema, letter-spacing, etc.) permanecem aplicadas.
    return nextLocal;
  }
  return fromApiPreferences(res.preferences, pickLocalExtras(nextLocal));
}

/** Documentação: gráficos devem oferecer tabela alternativa (padrão control-ui). */
export function chartTableAlternativeHint(): string {
  return "Todo gráfico deve expor descrição textual e tabela de dados equivalente (não depender só de cor).";
}
