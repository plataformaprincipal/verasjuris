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
  type InterfaceDensity,
  type LetterSpacingMode,
  type UiZoomMode,
} from "../lib/accessibility";
import { isApiFailure } from "../lib/ai";
import {
  getVLibrasUiStatus,
  subscribeVLibrasUiStatus,
  type VLibrasUiStatus,
} from "../lib/vlibras/vlibras-status";
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
    return t(`a11y.profile.${partial.activeProfile}`, t("a11y.profiles", "Perfis rápidos"));
  }
  const keys = Object.keys(partial);
  if (keys.length === 0) return t("a11y.reset", "Restaurar padrões");
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
    lineSpacing: "a11y.lineSpacing",
    highlightInteractive: "a11y.highlightInteractive",
    highVisibilityCursor: "a11y.largeCursor",
    uiZoom: "a11y.uiZoom",
    reduceDistractions: "a11y.reduceDistractions",
    simplifiedUi: "a11y.simplifiedUi",
    interfaceDensity: "a11y.density",
    screenReaderOptimized: "a11y.screenReader",
    signLanguagePreferred: "a11y.vlibras",
  };
  const label = t(labelMap[first] ?? "a11y.title", "Acessibilidade");
  const value = partial[first as keyof AccessibilityPreferences];
  if (typeof value === "boolean") {
    return `${label}: ${value ? t("a11y.on", "ativado") : t("a11y.off", "desativado")}`;
  }
  return `${label}: ${String(value)}`;
}

function vlibrasStatusLabel(
  t: (key: string, fallback?: string) => string,
  status: VLibrasUiStatus,
): string {
  switch (status) {
    case "idle":
      return t("a11y.vlibras.idle", "VLibras desligado");
    case "loading":
      return t("a11y.vlibras.loading", "Carregando VLibras…");
    case "ready":
      return t("a11y.vlibras.ready", "VLibras pronto");
    case "error":
      return t("a11y.vlibras.error", "Falha ao carregar VLibras");
    case "unavailable":
      return t("a11y.vlibras.unavailable", "VLibras indisponível neste momento");
  }
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
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

function pickLocalExtras(prefs: AccessibilityPreferences) {
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

export function AccessibilityPanel() {
  const { t } = useLocale();
  const { announce } = useAnnouncer();
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<AccessibilityPreferences>(DEFAULT_A11Y);
  const [vlibrasStatus, setVlibrasStatus] = useState<VLibrasUiStatus>(() => getVLibrasUiStatus());
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
    announce(announcement ?? t("a11y.prefsUpdated", "Preferências de acessibilidade atualizadas"));
    const remote = await updateAccessibilityPreferences(next);
    if (!isApiFailure(remote)) {
      const merged: AccessibilityPreferences = {
        ...remote,
        ...pickLocalExtras(next),
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

  function bumpFont(delta: number) {
    const current = Number.parseInt(prefs.fontScale, 10) || 100;
    const next = Math.min(250, Math.max(100, current + delta));
    patch({ fontScale: String(next) });
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
        aria-label={t("a11y.open", "Abrir painel de acessibilidade")}
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
              {t("a11y.title", "Acessibilidade")}
            </h2>
            <button type="button" className="vj-button vj-button-secondary" onClick={closePanel}>
              {t("common.close", "Fechar")}
            </button>
          </div>
          <p className="vj-meta">
            <a href="/acessibilidade">{t("a11y.title", "Acessibilidade")}</a>
            {" · "}
            <a href="/acessibilidade/declaracao">{t("a11y.statement", "Declaração")}</a>
          </p>

          <fieldset className="vj-stack">
            <legend>{t("a11y.profiles", "Perfis rápidos")}</legend>
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
                        ...pickLocalExtras({
                          ...prefs,
                          ...profile.patch,
                        }),
                      },
                      t(profile.labelKey, profile.id),
                    )
                  }
                >
                  {t(profile.labelKey, profile.id)}
                </button>
              ))}
            </div>
          </fieldset>

          <section className="vj-a11y-category" aria-labelledby={`${panelId}-vision`}>
            <h3 id={`${panelId}-vision`} className="vj-section-title">
              {t("a11y.section.vision", "Visão")}
            </h3>
            <div className="vj-a11y-inline-actions">
              <button
                type="button"
                className="vj-button vj-button-secondary"
                onClick={() => bumpFont(-10)}
              >
                {t("a11y.fontDecrease", "Diminuir fonte")}
              </button>
              <button
                type="button"
                className="vj-button vj-button-secondary"
                onClick={() => bumpFont(10)}
              >
                {t("a11y.fontIncrease", "Aumentar fonte")}
              </button>
              <span className="vj-meta">{prefs.fontScale}%</span>
            </div>
            <label>
              <span>{t("a11y.contrast", "Contraste")}</span>
              <select
                className="vj-select"
                value={prefs.contrastMode}
                onChange={(event) => patch({ contrastMode: event.target.value as ContrastMode })}
              >
                <option value="default">{t("a11y.contrast.normal", "Normal")}</option>
                <option value="high">{t("a11y.contrast.high", "Alto")}</option>
                <option value="extra_high">{t("a11y.contrast.extra_high", "Extra alto")}</option>
                <option value="dark_high_contrast">
                  {t("a11y.contrast.dark_high", "Escuro alto contraste")}
                </option>
                <option value="inverted">
                  {t("a11y.contrast.inverted", "Invertido (tema preto)")}
                </option>
              </select>
            </label>
            <label>
              <span>{t("a11y.theme", "Tema")}</span>
              <select
                className="vj-select"
                value={prefs.colorTheme ?? "system"}
                onChange={(event) => patch({ colorTheme: event.target.value as ColorTheme })}
              >
                <option value="system">{t("a11y.themeSystem", "Sistema")}</option>
                <option value="light">{t("a11y.themeLight", "Claro")}</option>
                <option value="dark">{t("a11y.themeDark", "Escuro")}</option>
                <option value="black">{t("a11y.themeBlack", "Preto")}</option>
              </select>
            </label>
            <label>
              <span>{t("a11y.colorVision", "Visão de cores")}</span>
              <select
                className="vj-select"
                value={prefs.colorVisionMode}
                onChange={(event) =>
                  patch({ colorVisionMode: event.target.value as ColorVisionMode })
                }
              >
                <option value="none">{t("a11y.vision.none", "Nenhum")}</option>
                <option value="protanopia">{t("a11y.vision.protanopia", "Protanopia")}</option>
                <option value="deuteranopia">
                  {t("a11y.vision.deuteranopia", "Deuteranopia")}
                </option>
                <option value="tritanopia">{t("a11y.vision.tritanopia", "Tritanopia")}</option>
                <option value="achromatopsia">
                  {t("a11y.vision.achromatopsia", "Acromatopsia")}
                </option>
              </select>
            </label>
            <Toggle
              checked={Boolean(prefs.highVisibilityCursor)}
              label={t("a11y.largeCursor", "Cursor ampliado")}
              onChange={(value) => patch({ highVisibilityCursor: value })}
            />
            <Toggle
              checked={Boolean(prefs.underlineLinks)}
              label={t("a11y.underlineLinks", "Sublinhar links")}
              onChange={(value) => patch({ underlineLinks: value })}
            />
            <Toggle
              checked={Boolean(prefs.highlightInteractive)}
              label={t("a11y.highlightInteractive", "Destacar elementos interativos")}
              onChange={(value) => patch({ highlightInteractive: value })}
            />
          </section>

          <section className="vj-a11y-category" aria-labelledby={`${panelId}-reading`}>
            <h3 id={`${panelId}-reading`} className="vj-section-title">
              {t("a11y.section.reading", "Leitura")}
            </h3>
            <label>
              <span>{t("a11y.letterSpacing", "Espaçamento entre letras")}</span>
              <select
                className="vj-select"
                value={prefs.letterSpacing ?? "normal"}
                onChange={(event) =>
                  patch({ letterSpacing: event.target.value as LetterSpacingMode })
                }
              >
                <option value="normal">{t("a11y.spacing.normal", "Normal")}</option>
                <option value="wide">{t("a11y.spacing.wide", "Amplo")}</option>
                <option value="wider">{t("a11y.spacing.wider", "Mais amplo")}</option>
              </select>
            </label>
            <label>
              <span>{t("a11y.lineSpacing", "Espaçamento entre linhas")}</span>
              <select
                className="vj-select"
                value={prefs.lineSpacing}
                onChange={(event) => patch({ lineSpacing: event.target.value })}
              >
                <option value="normal">{t("a11y.spacing.normal", "Normal")}</option>
                <option value="relaxed">{t("a11y.spacing.relaxed", "Relaxado")}</option>
                <option value="loose">{t("a11y.spacing.loose", "Folgado")}</option>
              </select>
            </label>
            <Toggle
              checked={prefs.dyslexiaFriendlyMode}
              label={t("a11y.dyslexia", "Fonte amigável à dislexia")}
              onChange={(value) => patch({ dyslexiaFriendlyMode: value })}
            />
            <Toggle
              checked={prefs.simplifiedLanguage}
              label={t("a11y.simplified", "Linguagem simplificada")}
              onChange={(value) => patch({ simplifiedLanguage: value })}
            />
            <Toggle
              checked={prefs.readingGuide}
              label={t("a11y.readingGuide", "Guia de leitura")}
              onChange={(value) => patch({ readingGuide: value })}
            />
            <Toggle
              checked={Boolean(prefs.reduceDistractions)}
              label={t("a11y.reduceDistractions", "Reduzir distrações")}
              onChange={(value) => patch({ reduceDistractions: value })}
            />
          </section>

          <section className="vj-a11y-category" aria-labelledby={`${panelId}-nav`}>
            <h3 id={`${panelId}-nav`} className="vj-section-title">
              {t("a11y.section.navigation", "Navegação")}
            </h3>
            <Toggle
              checked={prefs.focusEnhancement}
              label={t("a11y.focusEnhancement", "Foco de teclado reforçado")}
              onChange={(value) => patch({ focusEnhancement: value })}
            />
            <Toggle
              checked={prefs.reducedMotion}
              label={t("a11y.reducedMotion", "Reduzir animações")}
              onChange={(value) => patch({ reducedMotion: value })}
            />
            <Toggle
              checked={prefs.keyboardOnly}
              label={t("a11y.keyboardOnly", "Navegação por teclado")}
              onChange={(value) => patch({ keyboardOnly: value })}
            />
            <Toggle
              checked={Boolean(prefs.largeControls)}
              label={t("a11y.largeControls", "Controles ampliados")}
              onChange={(value) =>
                patch({
                  largeControls: value,
                  interfaceDensity: value ? "spacious" : prefs.interfaceDensity,
                })
              }
            />
            <label>
              <span>{t("a11y.uiZoom", "Zoom da interface")}</span>
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
            <label>
              <span>{t("a11y.density", "Densidade da interface")}</span>
              <select
                className="vj-select"
                value={prefs.interfaceDensity}
                onChange={(event) =>
                  patch({ interfaceDensity: event.target.value as InterfaceDensity })
                }
              >
                <option value="comfortable">{t("a11y.density.comfortable", "Confortável")}</option>
                <option value="compact">{t("a11y.density.compact", "Compacta")}</option>
                <option value="spacious">{t("a11y.density.spacious", "Espaçosa")}</option>
              </select>
            </label>
            <Toggle
              checked={Boolean(prefs.simplifiedUi)}
              label={t("a11y.simplifiedUi", "Interface simplificada")}
              onChange={(value) => patch({ simplifiedUi: value, cognitiveSupportMode: value })}
            />
            <Toggle
              checked={prefs.cognitiveSupportMode}
              label={t("a11y.cognitive", "Suporte cognitivo")}
              onChange={(value) => patch({ cognitiveSupportMode: value })}
            />
          </section>

          <section className="vj-a11y-category" aria-labelledby={`${panelId}-assist`}>
            <h3 id={`${panelId}-assist`} className="vj-section-title">
              {t("a11y.section.assistive", "Tecnologias assistivas")}
            </h3>
            <Toggle
              checked={prefs.screenReaderOptimized}
              label={t("a11y.screenReader", "Otimizar para leitor de tela")}
              onChange={(value) => patch({ screenReaderOptimized: value })}
            />
            <p className="vj-meta">{t("a11y.screenReader.hint")}</p>
            <Toggle
              checked={prefs.signLanguagePreferred}
              label={t("a11y.vlibras", "VLibras (Libras)")}
              onChange={(value) => patch({ signLanguagePreferred: value })}
            />
            <p
              className="vj-meta"
              role="status"
              aria-live="polite"
              data-vlibras-status={vlibrasStatus}
            >
              {vlibrasStatusLabel(t, vlibrasStatus)}
            </p>
            <p className="vj-meta">
              {t(
                "a11y.vlibras.note",
                "Plugin oficial do governo (vlibras.gov.br). O widget permanece montado; o script carrega sob demanda.",
              )}
            </p>
          </section>

          <button
            type="button"
            className="vj-button"
            onClick={() => void commit({ ...DEFAULT_A11Y }, t("a11y.reset", "Restaurar padrões"))}
          >
            {t("a11y.reset", "Restaurar padrões")}
          </button>
        </div>
      ) : null}
      {prefs.readingGuide ? <div className="vj-reading-guide" aria-hidden="true" /> : null}
    </>
  );
}
