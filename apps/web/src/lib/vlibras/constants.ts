/** rootPath e script oficiais (gov.br) */
export const VLIBRAS_WIDGET_URL = "https://vlibras.gov.br/app";
export const VLIBRAS_SCRIPT_URL = "https://vlibras.gov.br/app/vlibras-plugin.js";
/** URLs oficiais + ordem de tentativa (fallback). */
export const VLIBRAS_SCRIPT_URLS = [
  VLIBRAS_SCRIPT_URL,
  "https://www.vlibras.gov.br/app/vlibras-plugin.js",
] as const;
export const VLIBRAS_SCRIPT_LOAD_TIMEOUT_MS = 20_000;

export const VW_HIDDEN_CLASS = "vj-vlibras-hidden";
export const VW_DISABLED_CLASS = "vj-vlibras-disabled";
export const VW_BODY_INACTIVE_CLASS = "vj-vlibras-inactive";

export type VLibrasStatus = "idle" | "loading" | "ready" | "error" | "unavailable";
