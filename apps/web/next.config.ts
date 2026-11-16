import type { NextConfig } from "next";

/** Hosts oficiais do plugin VLibras (gov.br) — necessários para Libras funcional. */
const VLIBRAS_HOSTS =
  "https://vlibras.gov.br https://www.vlibras.gov.br https://*.vlibras.gov.br https://cdn.jsdelivr.net";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  `img-src 'self' data: blob: ${VLIBRAS_HOSTS}`,
  "font-src 'self' data:",
  `style-src 'self' 'unsafe-inline' ${VLIBRAS_HOSTS}`,
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob: ${VLIBRAS_HOSTS}`,
  `connect-src 'self' ${VLIBRAS_HOSTS}`,
  `frame-src 'self' ${VLIBRAS_HOSTS}`,
  `worker-src 'self' blob: ${VLIBRAS_HOSTS}`,
  `child-src 'self' blob: ${VLIBRAS_HOSTS}`,
  `media-src 'self' blob: ${VLIBRAS_HOSTS}`,
].join("; ");

const nextConfig: NextConfig = {
  transpilePackages: [
    "@verasjuris/ui",
    "@verasjuris/security",
    "@verasjuris/validation",
    "@verasjuris/types",
  ],
  // Workspace packages use TypeScript ESM (import './x.js' → x.ts).
  // Não aliasar react/react-dom: Next 16 usa react vendored em dist/compiled;
  // forçar o pacote do app quebra o prerender de /_global-error (dispatcher null).
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
  poweredByHeader: false,
  agentRules: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
