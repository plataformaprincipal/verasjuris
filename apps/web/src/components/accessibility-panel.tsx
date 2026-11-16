"use client";

import { Accessibility } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import {
  DEFAULT_A11Y,
  QUICK_PROFILES,
  applyAccessibilityToDocument,
  fetchAccessibilityPreferences,
  loadLocalAccessibility,
  saveLocalAccessibility,
  updateAccessibilityPreferences,
  type AccessibilityPreferences,
  type ColorTheme,
  type ContrastMode,
  type ColorVisionMode,
  type LetterSpacingMode,
  type UiZoomMode,
} from "../lib/accessibility";
import { isApiFailure } from "../lib/ai";
import { subscribeVLibrasUiStatus, type VLibrasUiStatus } from "../lib/vlibras/vlibras-status";
import { useLocale } from "./locale-provider";
import { useAnnouncer } from "./live-announcer";

function focusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true");
}

function describeChange(
  t: (key: string, fallback?: string) => string,
  partial: Partial<AccessibilityPreferences>,
): string {
  if (partial.activeProfile) {
    return t(`a11y.profile.${partial.activeProfile}`, t("a11y.profiles"));
  }
  const keys = Object.keys(partial);
  if (keys.length === 0) return t("a11y.reset");
  const first = keys[0]!;
  const labelMap: Record<string, string> = {
    fontScale: "a11y.fontScale",
    contrastMode: "a11y.contrast",
    colorVisionMode: "a11y.colorVision",
    reducedMotion: "a11y.reducedMotion",
    cognitiveSupportMode: "a11y.cognitive",
    readingGuide: "a11y.readingGuide",
    dyslexiaFriendlyMode: "a11y.dyslexia",
    simplifiedLanguage: "a11y.simplified",
    focusEnhancement: "a11y.focusEnhancement",
    largeControls: "a11y.largeControls",
    keyboardOnly: "a11y.keyboardOnly",
    underlineLinks: "a11y.underlineLinks",
    colorTheme: "a11y.theme",
    letterSpacing: "a11y.letterSpacing",
    highlightInteractive: "a11y.highlightInteractive",
    uiZoom: "a11y.uiZoom",
    reduceDistractions: "a11y.reduceDistractions",
    highVisibilityCursor: "a11y.cursor",
    signLanguagePreferred: "a11y.vlibras",
    simplifiedUi: "a11y.simplifiedUi",
  };
  const label = t(labelMap[first] ?? "a11y.title");
  const value = partial[first as keyof AccessibilityPreferences];
  if (typeof value === "boolean") {
    return `${label}: ${value ? t("a11y.on") : t("a11y.off")}`;
  }
  return `${label}: ${String(value)}`;
}

function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="vj-check-row">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function AccessibilityPanel() {
  const { t } = useLocale();
  const { announce } = useAnnouncer();
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<AccessibilityPreferences>(DEFAULT_A11Y);
  const [vlibrasStatus, setVlibrasStatus] = useState<VLibrasUiStatus>("idle");
  const panelId = useId();
  const titleId = useId();
  const fabRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const local = loadLocalAccessibility();
    setPrefs(local);
    applyAccessibilityToDocument(local);
    let cancelled = false;
    void (async () => {
      const remote = await fetchAccessibilityPreferences();
      if (cancelled || isApiFailure(remote)) return;
      setPrefs(remote);
      saveLocalAccessibility(remote);
      applyAccessibilityToDocument(remote);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => subscribeVLibrasUiStatus(setVlibrasStatus), []);

  useEffect(() => {
    if (!prefs.readingGuide) return;
    function moveGuide(clientY: number) {
      const guide = document.querySelector<HTMLElement>(".vj-reading-guide");
      if (!guide) return;
      guide.style.top = `${Math.max(0, clientY - 20)}px`;
    }
    function onMove(event: MouseEvent) {
      moveGuide(event.clientY);
    }
    function onFocus(event: FocusEvent) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const rect = target.getBoundingClientRect();
      moveGuide(rect.top + rect.height / 2);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("focusin", onFocus);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("focusin", onFocus);
    };
  }, [prefs.readingGuide]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    focusableElements(panel)[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const nodes = focusableElements(panel);
      if (nodes.length === 0) return;
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      } else {
        fabRef.current?.focus();
      }
    };
  }, [open]);

  async function commit(next: AccessibilityPreferences, announcement?: string) {
    setPrefs(next);
    applyAccessibilityToDocument(next);
    saveLocalAccessibility(next);
    announce(announcement ?? t("a11y.prefsUpdated"));
    const remote = await updateAccessibilityPreferences(next);
    if (!isApiFailure(remote)) {
      setPrefs(remote);
      saveLocalAccessibility(remote);
      applyAccessibilityToDocument(remote);
    }
  }

  function patch(partial: Partial<AccessibilityPreferences>) {
    void commit(
      { ...prefs, ...partial, activeProfile: partial.activeProfile ?? null },
      describeChange(t, partial),
    );
  }

  function bumpFont(delta: number) {
    const current = Number.parseInt(prefs.fontScale, 10) || 100;
    const next = Math.min(250, Math.max(100, current + delta));
    patch({ fontScale: String(next) });
  }

  const vlibrasLabel =
    vlibrasStatus === "ready"
      ? t("a11y.vlibras.ready")
      : vlibrasStatus === "loading"
        ? t("a11y.vlibras.loading")
        : vlibrasStatus === "unavailable"
          ? t("a11y.vlibras.unavailable")
          : vlibrasStatus === "error"
            ? t("a11y.vlibras.error")
            : t("a11y.vlibras.idle");

  return (
    <>
      <button
        ref={fabRef}
        type="button"
        className="vj-fab vj-fab-a11y"
        aria-label={t("a11y.open")}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <Accessibility size={22} aria-hidden="true" />
      </button>
      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          className="vj-a11y-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <div className="vj-a11y-panel-header">
            <h2 id={titleId} className="vj-section-title">
              {t("a11y.title")}
            </h2>
            <button type="button" className="vj-button vj-button-secondary" onClick={() => setOpen(false)}>
              {t("common.close")}
            </button>
          </div>
          <p className="vj-meta">
            <a href="/acessibilidade">{t("a11y.title")}</a>
            {" · "}
            <a href="/acessibilidade/declaracao">{t("a11y.statement")}</a>
          </p>

          <fieldset className="vj-stack">
            <legend>{t("a11y.profiles")}</legend>
            <div className="vj-chip-grid">
              {QUICK_PROFILES.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  className="vj-button vj-button-secondary"
                  aria-pressed={prefs.activeProfile === profile.id}
                  onClick={() =>
                    void commit(
                      {
                        ...DEFAULT_A11Y,
                        ...profile.patch,
                        underlineLinks: prefs.underlineLinks,
                        colorTheme: prefs.colorTheme,
                      },
                      t(profile.labelKey),
                    )
                  }
                >
                  {t(profile.labelKey)}
                </button>
              ))}
            </div>
          </fieldset>

          <section className="vj-a11y-category" aria-labelledby={`${panelId}-vision`}>
            <h3 id={`${panelId}-vision`} className="vj-section-title">
              {t("a11y.category.vision")}
            </h3>
            <div className="vj-a11y-inline-actions">
              <button type="button" className="vj-button vj-button-secondary" onClick={() => bumpFont(-10)}>
                {t("a11y.fontDecrease")}
              </button>
              <button type="button" className="vj-button vj-button-secondary" onClick={() => bumpFont(10)}>
                {t("a11y.fontIncrease")}
              </button>
              <span className="vj-meta">{prefs.fontScale}%</span>
            </div>
            <label>
              <span>{t("a11y.contrast")}</span>
              <select
                className="vj-select"
                value={prefs.contrastMode}
                onChange={(event) => patch({ contrastMode: event.target.value as ContrastMode })}
              >
                <option value="default">{t("a11y.contrast.normal")}</option>
                <option value="high">{t("a11y.contrast.high")}</option>
                <option value="extra_high">{t("a11y.contrast.extra_high")}</option>
                <option value="dark_high_contrast">{t("a11y.contrast.dark_high")}</option>
                <option value="inverted">{t("a11y.contrast.inverted")}</option>
              </select>
            </label>
            <label>
              <span>{t("a11y.theme")}</span>
              <select
                className="vj-select"
                value={prefs.colorTheme ?? "system"}
                onChange={(event) => patch({ colorTheme: event.target.value as ColorTheme })}
              >
                <option value="system">{t("a11y.themeSystem")}</option>
                <option value="light">{t("a11y.themeLight")}</option>
                <option value="dark">{t("a11y.themeDark")}</option>
                <option value="black">{t("a11y.themeBlack")}</option>
              </select>
            </label>
            <Toggle
              checked={Boolean(prefs.highVisibilityCursor)}
              label={t("a11y.cursor")}
              onChange={(value) => patch({ highVisibilityCursor: value })}
            />
            <Toggle
              checked={Boolean(prefs.underlineLinks)}
              label={t("a11y.underlineLinks")}
              onChange={(value) => patch({ underlineLinks: value })}
            />
            <Toggle
              checked={Boolean(prefs.highlightInteractive)}
              label={t("a11y.highlightInteractive")}
              onChange={(value) => patch({ highlightInteractive: value })}
            />
          </section>

          <section className="vj-a11y-category" aria-labelledby={`${panelId}-reading`}>
            <h3 id={`${panelId}-reading`} className="vj-section-title">
              {t("a11y.category.reading")}
            </h3>
            <label>
              <span>{t("a11y.letterSpacing")}</span>
              <select
                className="vj-select"
                value={prefs.letterSpacing ?? "normal"}
                onChange={(event) =>
                  patch({ letterSpacing: event.target.value as LetterSpacingMode })
                }
              >
                <option value="normal">{t("a11y.contrast.normal")}</option>
                <option value="wide">Wide</option>
                <option value="wider">Wider</option>
              </select>
            </label>
            <label>
              <span>{t("a11y.lineSpacing")}</span>
              <select
                className="vj-select"
                value={prefs.lineSpacing}
                onChange={(event) => patch({ lineSpacing: event.target.value })}
              >
                <option value="normal">{t("a11y.contrast.normal")}</option>
                <option value="relaxed">Relaxed</option>
                <option value="loose">Loose</option>
              </select>
            </label>
            <Toggle
              checked={prefs.dyslexiaFriendlyMode}
              label={t("a11y.dyslexia")}
              onChange={(value) => patch({ dyslexiaFriendlyMode: value })}
            />
            <Toggle
              checked={prefs.simplifiedLanguage}
              label={t("a11y.simplified")}
              onChange={(value) => patch({ simplifiedLanguage: value })}
            />
            <Toggle
              checked={prefs.readingGuide}
              label={t("a11y.readingGuide")}
              onChange={(value) => patch({ readingGuide: value })}
            />
            <Toggle
              checked={Boolean(prefs.reduceDistractions)}
              label={t("a11y.reduceDistractions")}
              onChange={(value) => patch({ reduceDistractions: value })}
            />
          </section>

          <section className="vj-a11y-category" aria-labelledby={`${panelId}-nav`}>
            <h3 id={`${panelId}-nav`} className="vj-section-title">
              {t("a11y.category.navigation")}
            </h3>
            <Toggle
              checked={prefs.focusEnhancement}
              label={t("a11y.focusEnhancement")}
              onChange={(value) => patch({ focusEnhancement: value })}
            />
            <Toggle
              checked={prefs.keyboardOnly}
              label={t("a11y.keyboardOnly")}
              onChange={(value) => patch({ keyboardOnly: value })}
            />
            <Toggle
              checked={Boolean(prefs.simplifiedUi)}
              label={t("a11y.simplifiedUi")}
              onChange={(value) => patch({ simplifiedUi: value })}
            />
            <Toggle
              checked={prefs.reducedMotion}
              label={t("a11y.reducedMotion")}
              onChange={(value) => patch({ reducedMotion: value })}
            />
            <label>
              <span>{t("a11y.uiZoom")}</span>
              <select
                className="vj-select"
                value={prefs.uiZoom ?? "100"}
                onChange={(event) => patch({ uiZoom: event.target.value as UiZoomMode })}
              >
                <option value="100">100%</option>
                <option value="110">110%</option>
                <option value="125">125%</option>
                <option value="150">150%</option>
              </select>
            </label>
            <p className="vj-hint">{t("a11y.shortcuts")}: Esc {t("common.close").toLowerCase()}</p>
          </section>

          <section className="vj-a11y-category" aria-labelledby={`${panelId}-assist`}>
            <h3 id={`${panelId}-assist`} className="vj-section-title">
              {t("a11y.category.assistive")}
            </h3>
            <Toggle
              checked={prefs.screenReaderOptimized}
              label={t("a11y.profile.screen_reader", "Leitor de tela")}
              onChange={(value) => patch({ screenReaderOptimized: value })}
            />
            <Toggle
              checked={prefs.signLanguagePreferred}
              label={t("a11y.vlibras")}
              onChange={(value) => patch({ signLanguagePreferred: value })}
            />
            <p className="vj-meta" role="status" aria-live="polite" data-vlibras-status={vlibrasStatus}>
              {vlibrasLabel}
              {prefs.signLanguagePreferred && vlibrasStatus !== "ready"
                ? ` · ${t("a11y.vlibras")} ${t("a11y.off").toLowerCase()}`
                : ""}
            </p>
            <label>
              <span>{t("a11y.colorVision")}</span>
              <select
                className="vj-select"
                value={prefs.colorVisionMode}
                onChange={(event) =>
                  patch({ colorVisionMode: event.target.value as ColorVisionMode })
                }
              >
                <option value="none">{t("a11y.vision.none")}</option>
                <option value="protanopia">{t("a11y.vision.protanopia")}</option>
                <option value="deuteranopia">{t("a11y.vision.deuteranopia")}</option>
                <option value="tritanopia">{t("a11y.vision.tritanopia")}</option>
                <option value="achromatopsia">{t("a11y.vision.achromatopsia")}</option>
              </select>
            </label>
          </section>

          <button
            type="button"
            className="vj-button"
            onClick={() => void commit({ ...DEFAULT_A11Y }, t("a11y.reset"))}
          >
            {t("a11y.reset")}
          </button>
        </div>
      ) : null}
      {prefs.readingGuide ? <div className="vj-reading-guide" aria-hidden="true" /> : null}
    </>
  );
}
