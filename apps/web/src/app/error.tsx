"use client";

import { LocalizedGlobalError } from "../components/i18n-states";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <LocalizedGlobalError error={error} reset={reset} />;
}
