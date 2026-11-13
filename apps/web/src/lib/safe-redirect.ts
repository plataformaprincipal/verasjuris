export const REDIRECT_PARAM = "redirect";

export const SAFE_REDIRECT_PREFIXES = [
  "/app",
  "/portal",
  "/marketplace",
  "/marketplace-juridico",
  "/checkout",
  "/planos",
  "/educacao",
  "/explorar",
  "/funcionalidades",
  "/ferramentas",
  "/juris-one",
  "/plataforma",
  "/solucoes",
] as const;

const MAX_REDIRECT_LENGTH = 2048;
const CONTROL_OR_SPACE = /[\u0000-\u0020\u007f]/;

type SearchParamsLike = { get(name: string): string | null };

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function hasUnsafeShape(path: string): boolean {
  if (CONTROL_OR_SPACE.test(path)) return true;
  if (path.includes("\\")) return true;
  if (path.startsWith("//")) return true;
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return true;
  return false;
}

function matchesPrefix(pathname: string): boolean {
  return SAFE_REDIRECT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isSafeRedirectPath(path: string): boolean {
  if (typeof path !== "string" || path.length === 0 || path.length > MAX_REDIRECT_LENGTH) {
    return false;
  }
  if (!path.startsWith("/") || hasUnsafeShape(path)) return false;

  const decoded = safeDecode(path);
  if (decoded === null || hasUnsafeShape(decoded)) return false;
  if (!decoded.startsWith("/")) return false;

  const pathname = path.split(/[?#]/, 1)[0] ?? "";
  const decodedPathname = decoded.split(/[?#]/, 1)[0] ?? "";
  const segments = decodedPathname.split("/");
  if (segments.some((segment) => segment === ".." || segment === ".")) return false;

  return matchesPrefix(pathname) && matchesPrefix(decodedPathname);
}

export function resolvePostAuthRedirect(
  source: SearchParamsLike | string | null | undefined,
  fallback = "/app",
): string {
  const candidate = typeof source === "string" ? source : (source?.get(REDIRECT_PARAM) ?? null);
  if (candidate && isSafeRedirectPath(candidate)) return candidate;
  return isSafeRedirectPath(fallback) ? fallback : "/app";
}

export function withRedirect(path: string, redirectTo: string | null | undefined): string {
  if (!redirectTo || !isSafeRedirectPath(redirectTo)) return path;
  return `${path}?${REDIRECT_PARAM}=${encodeURIComponent(redirectTo)}`;
}
