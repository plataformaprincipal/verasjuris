"use client";

import { LocalizedAppError } from "../../components/i18n-states";

export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <LocalizedAppError reset={reset} />;
}
