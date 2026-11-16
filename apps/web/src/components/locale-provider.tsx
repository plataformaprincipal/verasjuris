"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_LOCALE,
  LOCALE_LABELS,
  LOCALE_META,
  LOCALE_SHORT_LABELS,
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  browserPreferredLocale,
  interpolate,
  resolveLocale,
  translate,
  type Locale,
} from "../lib/i18n";
import { isApiFailure, updateAccountLocale } from "../lib/platform";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale, options?: { persist?: boolean }) => Promise<void>;
  t: (key: string, fallback?: string, params?: Record<string, string | number>) => string;
  labels: typeof LOCALE_LABELS;
  supported: readonly Locale[];
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function readStoredLocale(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredLocale(locale: Locale): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // private mode / blocked storage
  }
}

function applyDocumentLocale(locale: Locale): void {
  document.documentElement.lang = locale;
  document.documentElement.dir = LOCALE_META[locale].dir;
}

export function LocaleProvider({
  children,
  userLocale,
  orgLocale,
  persist = true,
}: {
  children: ReactNode;
  userLocale?: string | null;
  orgLocale?: string | null;
  persist?: boolean;
}) {
  const [locale, setLocaleState] = useState<Locale>(() =>
    resolveLocale({
      userLocale,
      orgLocale,
      storedLocale: typeof window !== "undefined" ? readStoredLocale() : null,
      browserLocale: typeof navigator !== "undefined" ? browserPreferredLocale() : null,
    }),
  );

  useEffect(() => {
    setLocaleState(
      resolveLocale({
        userLocale,
        orgLocale,
        storedLocale: readStoredLocale(),
        browserLocale: browserPreferredLocale(),
      }),
    );
  }, [userLocale, orgLocale]);

  useEffect(() => {
    applyDocumentLocale(locale);
  }, [locale]);

  const setLocale = useCallback(
    async (next: Locale, options?: { persist?: boolean }) => {
      setLocaleState(next);
      applyDocumentLocale(next);
      writeStoredLocale(next);
      const shouldPersist = options?.persist ?? persist;
      if (!shouldPersist) return;
      try {
        const profileRes = await fetch("/api/v1/account/profile", { cache: "no-store" });
        if (!profileRes.ok) return;
        const body = (await profileRes.json()) as {
          profile: { displayName: string; locale: string; timeZone: string };
        };
        const updated = await updateAccountLocale({
          displayName: body.profile.displayName,
          locale: next,
          timeZone: body.profile.timeZone || "America/Sao_Paulo",
        });
        if (isApiFailure(updated)) {
          // Preferência local permanece mesmo se a API ainda não existir.
        }
      } catch {
        // offline / anonymous
      }
    },
    [persist],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key, fallback, params) => interpolate(translate(locale, key, fallback), params),
      labels: LOCALE_LABELS,
      supported: SUPPORTED_LOCALES,
    }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    return {
      locale: DEFAULT_LOCALE,
      setLocale: async () => undefined,
      t: (key, fallback, params) => interpolate(translate(DEFAULT_LOCALE, key, fallback), params),
      labels: LOCALE_LABELS,
      supported: SUPPORTED_LOCALES,
    };
  }
  return ctx;
}

export function LanguageSwitcher({
  className,
  compact = false,
}: {
  className?: string;
  /** Exibe códigos curtos (PT/EN/ES) — adequado ao cabeçalho. */
  compact?: boolean;
}) {
  const { locale, setLocale, labels, supported, t } = useLocale();
  return (
    <div className={className ?? "vj-language-switcher"} role="group" aria-label={t("nav.language")}>
      <span className="vj-visually-hidden" id="vj-language-switcher-label">
        {t("nav.language")}
      </span>
      <div className="vj-language-switcher-options" aria-labelledby="vj-language-switcher-label">
        {supported.map((code) => {
          const active = code === locale;
          return (
            <button
              key={code}
              type="button"
              className="vj-language-option"
              data-active={active ? "true" : "false"}
              aria-pressed={active}
              aria-label={labels[code]}
              title={labels[code]}
              onClick={() => void setLocale(code)}
            >
              {compact ? LOCALE_SHORT_LABELS[code] : labels[code]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
