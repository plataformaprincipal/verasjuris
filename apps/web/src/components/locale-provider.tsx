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
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  browserPreferredLocale,
  resolveLocale,
  translate,
  type Locale,
} from "../lib/i18n";
import { isApiFailure, updateAccountLocale } from "../lib/platform";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale, options?: { persist?: boolean }) => Promise<void>;
  t: (key: string, fallback?: string) => string;
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
      t: (key, fallback) => translate(locale, key, fallback),
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
      t: (key, fallback) => translate(DEFAULT_LOCALE, key, fallback),
      labels: LOCALE_LABELS,
      supported: SUPPORTED_LOCALES,
    };
  }
  return ctx;
}

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale, labels, supported, t } = useLocale();
  return (
    <label className={className ?? "vj-language-switcher"}>
      <span className="vj-visually-hidden">{t("nav.language")}</span>
      <select
        className="vj-select"
        aria-label={t("nav.language")}
        value={locale}
        onChange={(event) => void setLocale(event.target.value as Locale)}
      >
        {supported.map((code) => (
          <option key={code} value={code}>
            {labels[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
