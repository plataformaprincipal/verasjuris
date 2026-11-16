"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  A11Y_CHANGE_EVENT,
  loadLocalAccessibility,
  type AccessibilityPreferences,
} from "../lib/accessibility";
import {
  VLIBRAS_SCRIPT_LOAD_TIMEOUT_MS,
  VLIBRAS_SCRIPT_URLS,
} from "../lib/vlibras/constants";
import {
  activateVLibras,
  deactivateVLibras,
  syncVLibrasBodyClass,
  VW_DISABLED_CLASS,
  VW_HIDDEN_CLASS,
} from "../lib/vlibras/vlibras-loader";
import {
  handleScriptOnError,
  nextScriptUrl,
  toVLibrasUiStatus,
  vlibrasFromScriptEvent,
  vlibrasReady,
} from "../lib/vlibras/vlibras-load-outcome";
import { setVLibrasUiStatus } from "../lib/vlibras/vlibras-status";

/** DOM oficial gov.br — um único container [vw], sempre montado. */
function VLibrasOfficialDom({ visible }: { visible: boolean }) {
  return (
    <div
      {...({ vw: "" } as Record<string, string>)}
      className={`enabled${visible ? "" : ` ${VW_HIDDEN_CLASS} ${VW_DISABLED_CLASS}`}`}
      aria-hidden={visible ? "false" : "true"}
      suppressHydrationWarning
    >
      <div {...({ "vw-access-button": "" } as Record<string, string>)} className="active" />
      <div {...({ "vw-plugin-wrapper": "" } as Record<string, string>)}>
        <div className="vw-plugin-top-wrapper" />
      </div>
    </div>
  );
}

function loadVLibrasScript(urls: readonly string[]): Promise<"ready" | "error" | "unavailable"> {
  if (typeof window === "undefined") return Promise.resolve("unavailable");
  if (window.VLibras) return Promise.resolve("ready");

  const attempted: string[] = [];

  function tryNext(): Promise<"ready" | "error" | "unavailable"> {
    const url = nextScriptUrl(urls, attempted);
    if (!url) {
      return Promise.resolve(toVLibrasUiStatus(vlibrasFromScriptEvent("onerror")));
    }
    attempted.push(url);

    return new Promise((resolve) => {
      const existing = document.querySelector<HTMLScriptElement>(`script[data-vj-vlibras-src="${url}"]`);
      if (existing) {
        if (window.VLibras) {
          resolve("ready");
          return;
        }
        existing.addEventListener("load", () => resolve(window.VLibras ? "ready" : "unavailable"), {
          once: true,
        });
        existing.addEventListener(
          "error",
          () => {
            void tryNext().then(resolve);
          },
          { once: true },
        );
        return;
      }

      const script = document.createElement("script");
      script.src = url;
      script.async = true;
      script.dataset.vjVlibrasSrc = url;

      const timeout = window.setTimeout(() => {
        script.onload = null;
        script.onerror = null;
        const outcome = vlibrasFromScriptEvent("timeout");
        void tryNext().then((fallback) => {
          resolve(fallback === "ready" ? "ready" : toVLibrasUiStatus(outcome));
        });
      }, VLIBRAS_SCRIPT_LOAD_TIMEOUT_MS);

      script.onload = () => {
        window.clearTimeout(timeout);
        if (!window.VLibras) {
          resolve(toVLibrasUiStatus(vlibrasFromScriptEvent("global-missing")));
          return;
        }
        resolve(toVLibrasUiStatus(vlibrasReady()));
      };
      script.onerror = () => {
        window.clearTimeout(timeout);
        handleScriptOnError();
        void tryNext().then(resolve);
      };

      document.head.appendChild(script);
    });
  }

  return tryNext();
}

/**
 * Monta VLibras uma vez no chrome da plataforma.
 * Script sob demanda; show/hide sem remount; nunca re-onload em mudança de rota.
 */
export function VLibrasWidget() {
  const [mounted, setMounted] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  const lastSyncedRef = useRef<boolean | null>(null);
  const loadPromiseRef = useRef<Promise<"ready" | "error" | "unavailable"> | null>(null);

  useLayoutEffect(() => {
    setMounted(true);
    const local = loadLocalAccessibility();
    setEnabled(Boolean(local.signLanguagePreferred));
    if (typeof window !== "undefined" && window.VLibras) {
      setScriptReady(true);
    }
  }, []);

  useLayoutEffect(() => {
    function onChange(event: Event) {
      const detail = (event as CustomEvent<AccessibilityPreferences>).detail;
      const next = Boolean(detail?.signLanguagePreferred);
      setEnabled(next);
    }
    window.addEventListener(A11Y_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(A11Y_CHANGE_EVENT, onChange);
  }, []);

  useLayoutEffect(() => {
    if (!mounted) return;
    syncVLibrasBodyClass(enabled);

    if (!enabled) {
      if (lastSyncedRef.current !== false) {
        deactivateVLibras();
        setVLibrasUiStatus("idle");
        lastSyncedRef.current = false;
      }
      return;
    }

    if (!scriptReady && !(typeof window !== "undefined" && window.VLibras)) {
      setVLibrasUiStatus("loading");
      if (!loadPromiseRef.current) {
        loadPromiseRef.current = loadVLibrasScript(VLIBRAS_SCRIPT_URLS).then((status) => {
          if (status === "ready") {
            setScriptReady(true);
          } else {
            setVLibrasUiStatus(status);
          }
          return status;
        });
      }
      return;
    }

    if (lastSyncedRef.current !== true) {
      const ok = activateVLibras();
      if (!ok) {
        setVLibrasUiStatus(
          toVLibrasUiStatus(
            vlibrasFromScriptEvent(window.VLibras ? "button-missing" : "init-failed"),
          ),
        );
      } else {
        setVLibrasUiStatus("ready");
      }
      lastSyncedRef.current = true;
    }
  }, [mounted, enabled, scriptReady]);

  if (!mounted) return null;

  return createPortal(<VLibrasOfficialDom visible={enabled} />, document.body);
}
