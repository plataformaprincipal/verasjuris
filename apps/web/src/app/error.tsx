"use client";

import { LocalizedGlobalError } from "../components/i18n-states";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <LocalizedGlobalError error={error} reset={reset} />;
}
