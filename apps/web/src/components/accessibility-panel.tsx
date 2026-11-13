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
} from "../lib/accessibility";
import { isApiFailure } from "../lib/ai";
import { useLocale } from "./locale-provider";
import { useAnnouncer } from "./live-announcer";

const TOGGLE_KEYS = [
  ["reducedMotion", "a11y.reducedMotion"],
  ["cognitiveSupportMode", "a11y.cognitive"],
  ["readingGuide", "a11y.readingGuide"],
  ["dyslexiaFriendlyMode", "a11y.dyslexia"],
  ["simplifiedLanguage", "a11y.simplified"],
  ["focusEnhancement", "a11y.focusEnhancement"],
  ["largeControls", "a11y.largeControls"],
  ["keyboardOnly", "a11y.keyboardOnly"],
  ["underlineLinks", "a11y.underlineLinks"],
] as const;

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
  };
  const label = t(labelMap[first] ?? "a11y.title");
  const value = partial[first as keyof AccessibilityPreferences];
  if (typeof value === "boolean") {
    return `${label}: ${value ? t("a11y.on") : t("a11y.off")}`;
  }
  return `${label}: ${String(value)}`;
}

export function AccessibilityPanel() {
  const { t } = useLocale();
  const { announce } = useAnnouncer();
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<AccessibilityPreferences>(DEFAULT_A11Y);
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
      const merged = {
        ...remote,
        underlineLinks: next.underlineLinks,
        colorTheme: next.colorTheme,
      };
      setPrefs(merged);
      saveLocalAccessibility(merged);
      applyAccessibilityToDocument(merged);
    }
  }

  function patch(partial: Partial<AccessibilityPreferences>) {
    void commit(
      { ...prefs, ...partial, activeProfile: partial.activeProfile ?? null },
      describeChange(t, partial),
    );
  }

  function closePanel() {
    setOpen(false);
    requestAnimationFrame(() => fabRef.current?.focus());
  }

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
            <button type="button" className="vj-button vj-button-secondary" onClick={closePanel}>
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

          <label className="vj-stack">
            <span>{t("a11y.fontScale")}</span>
            <input
              type="range"
              min={100}
              max={250}
              step={10}
              value={Number.parseInt(prefs.fontScale, 10) || 100}
              onChange={(event) => patch({ fontScale: event.target.value })}
            />
            <span className="vj-meta">{prefs.fontScale}%</span>
          </label>

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
            </select>
          </label>

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

          {TOGGLE_KEYS.map(([key, labelKey]) => (
            <label key={key} className="vj-check-row">
              <input
                type="checkbox"
                checked={Boolean(prefs[key as keyof AccessibilityPreferences])}
                onChange={(event) => patch({ [key]: event.target.checked })}
              />
              <span>{t(labelKey)}</span>
            </label>
          ))}

          <button
            type="button"
            className="vj-button"
            onClick={() =>
              void commit(
                { ...DEFAULT_A11Y, underlineLinks: false, colorTheme: "system" },
                t("a11y.reset"),
              )
            }
          >
            {t("a11y.reset")}
          </button>
        </div>
      ) : null}
      {prefs.readingGuide ? <div className="vj-reading-guide" aria-hidden="true" /> : null}
    </>
  );
}
