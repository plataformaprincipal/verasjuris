import {
  VLIBRAS_WIDGET_URL,
  VW_BODY_INACTIVE_CLASS,
  VW_DISABLED_CLASS,
  VW_HIDDEN_CLASS,
} from "./constants";

export { VW_BODY_INACTIVE_CLASS, VW_DISABLED_CLASS, VW_HIDDEN_CLASS };

declare global {
  interface Window {
    VLibras?: {
      Widget: new (rootPath?: string) => unknown;
    };
  }
}

let widgetCreated = false;
let onloadFired = false;
let openPanelTimer: ReturnType<typeof setTimeout> | null = null;

export function isVLibrasWidgetCreated(): boolean {
  return widgetCreated;
}

/** Test-only: reset module flags between unit tests. */
export function __resetVLibrasLoaderForTests(): void {
  widgetCreated = false;
  onloadFired = false;
  clearOpenPanelTimer();
  stopInteractObserver();
}

export function getVLibrasRoot(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.querySelector("[vw]") as HTMLElement | null;
}

function setBodyInactive(inactive: boolean): void {
  if (typeof document === "undefined") return;
  document.body.classList.toggle(VW_BODY_INACTIVE_CLASS, inactive);
}

let interactObserver: MutationObserver | null = null;
let interactHideTimer: ReturnType<typeof setTimeout> | null = null;

function neutralizeElement(el: HTMLElement): void {
  el.style.setProperty("pointer-events", "none", "important");
  el.style.setProperty("visibility", "hidden", "important");
  el.style.setProperty("opacity", "0", "important");
  el.style.setProperty("z-index", "-1", "important");
  el.setAttribute("aria-hidden", "true");
  el.setAttribute("data-vj-vlibras-suppressed", "1");
}

function hideInteractOverlays(): void {
  if (typeof document === "undefined") return;

  document
    .querySelectorAll<HTMLElement>("#gameContainer, #unity-container, #unity-footer, [vw] canvas")
    .forEach((el) => neutralizeElement(el));

  document.querySelectorAll<HTMLElement>("div, span, button, p, label, a").forEach((el) => {
    const text = el.textContent?.trim();
    if (!text || text.length > 24 || !/^interagir$/i.test(text)) return;
    const host =
      (el.closest("#gameContainer, [vw], [vw-plugin-wrapper], [vw-access-button]") as HTMLElement | null) ??
      el;
    neutralizeElement(host);
  });
}

function startInteractObserver(): void {
  if (typeof document === "undefined" || interactObserver) return;
  interactObserver = new MutationObserver(() => {
    if (!document.body.classList.contains(VW_BODY_INACTIVE_CLASS)) return;
    if (interactHideTimer) clearTimeout(interactHideTimer);
    interactHideTimer = setTimeout(() => {
      interactHideTimer = null;
      hideInteractOverlays();
    }, 50);
  });
  interactObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
}

function stopInteractObserver(): void {
  interactObserver?.disconnect();
  interactObserver = null;
  if (interactHideTimer) {
    clearTimeout(interactHideTimer);
    interactHideTimer = null;
  }
}

function clearInteractOverlayStyles(): void {
  if (typeof document === "undefined") return;
  const root = getVLibrasRoot();
  if (!root) return;

  root.querySelectorAll<HTMLElement>("[style]").forEach((el) => {
    if (el.style.pointerEvents === "none" && el.style.visibility === "hidden") {
      el.style.removeProperty("pointer-events");
      el.style.removeProperty("visibility");
      el.style.removeProperty("opacity");
      el.style.removeProperty("z-index");
    }
  });
}

export function setVLibrasVisible(visible: boolean): void {
  const el = getVLibrasRoot();
  if (!el) return;

  el.classList.toggle(VW_HIDDEN_CLASS, !visible);
  el.classList.toggle(VW_DISABLED_CLASS, !visible);
  el.classList.toggle("enabled", visible);

  el.setAttribute("aria-hidden", visible ? "false" : "true");
  setBodyInactive(!visible);

  if (visible) {
    clearInteractOverlayStyles();
  } else {
    hideInteractOverlays();
  }
}

export function hideVLibras(): void {
  setVLibrasVisible(false);
}

export function showVLibras(): void {
  setVLibrasVisible(true);
}

function clearOpenPanelTimer(): void {
  if (openPanelTimer !== null) {
    clearTimeout(openPanelTimer);
    openPanelTimer = null;
  }
}

function isVLibrasPanelOpen(): boolean {
  const wrapper = getVLibrasRoot()?.querySelector("[vw-plugin-wrapper]");
  if (!wrapper) return false;
  return Boolean(
    wrapper.querySelector("#gameContainer, .vpw-plugin-wrapper, .vp-plugin-wrapper, .vp-side-menu"),
  );
}

export function openVLibrasPanel(): void {
  const root = getVLibrasRoot();
  if (!root || root.classList.contains(VW_HIDDEN_CLASS) || root.classList.contains(VW_DISABLED_CLASS)) {
    return;
  }
  if (isVLibrasPanelOpen()) return;

  const officialBtn = root.querySelector(
    "[vw-access-button] .vp-access-button, [vw-access-button] img",
  ) as HTMLElement | null;
  const accessHost = root.querySelector("[vw-access-button]") as HTMLElement | null;
  (officialBtn ?? accessHost)?.click();
}

export function closeVLibrasPanel(): void {
  if (!isVLibrasPanelOpen()) return;

  const closeBtn = document.querySelector(
    ".vp-side-menu-close, .vp-close-button, [vp-close], .vpw-close",
  ) as HTMLElement | null;
  if (closeBtn) {
    closeBtn.click();
    return;
  }

  const accessHost = getVLibrasRoot()?.querySelector("[vw-access-button]") as HTMLElement | null;
  accessHost?.click();
}

/**
 * Integração oficial gov.br:
 * new window.VLibras.Widget('https://vlibras.gov.br/app')
 * Não redispara window.onload em navegações SPA subsequentes.
 */
export function initVLibras(): void {
  if (typeof window === "undefined" || !window.VLibras || widgetCreated) return;
  if (!getVLibrasRoot()?.querySelector("[vw-access-button]")) return;

  new window.VLibras.Widget(VLIBRAS_WIDGET_URL);
  widgetCreated = true;

  if (!onloadFired) {
    const handler = window.onload;
    if (typeof handler === "function") {
      onloadFired = true;
      handler.call(window, new Event("load"));
    }
  }
}

function scheduleOpenPanel(): void {
  clearOpenPanelTimer();
  openPanelTimer = setTimeout(() => {
    openPanelTimer = null;
    openVLibrasPanel();
  }, 120);
}

export function activateVLibras(): boolean {
  if (typeof window === "undefined" || !window.VLibras) return false;

  stopInteractObserver();
  initVLibras();
  showVLibras();

  const accessHost = getVLibrasRoot()?.querySelector("[vw-access-button]");
  accessHost?.classList.add("active");
  scheduleOpenPanel();
  return widgetCreated || Boolean(window.VLibras);
}

export function deactivateVLibras(): void {
  clearOpenPanelTimer();
  closeVLibrasPanel();
  hideVLibras();

  const accessHost = getVLibrasRoot()?.querySelector("[vw-access-button]");
  accessHost?.classList.remove("active");
  hideInteractOverlays();
  startInteractObserver();
  setTimeout(hideInteractOverlays, 120);
  setTimeout(hideInteractOverlays, 400);
}

export function syncVLibrasEnabled(enabled: boolean): void {
  if (enabled) {
    activateVLibras();
  } else {
    deactivateVLibras();
  }
}

export function syncVLibrasBodyClass(enabled: boolean): void {
  setBodyInactive(!enabled);
}

/** Utilitário de teste / diagnóstico — não altera o DOM. */
export function vlibrasLoadOutcome(input: {
  scriptLoaded: boolean;
  widgetAvailable: boolean;
  enabled: boolean;
}): "idle" | "loading" | "ready" | "error" | "unavailable" {
  if (!input.enabled) return "idle";
  if (!input.scriptLoaded) return "loading";
  if (input.widgetAvailable) return "ready";
  return "unavailable";
}
