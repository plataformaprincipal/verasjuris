import { defineConfig, configDefaults } from "vitest/config";

export default defineConfig({
  test: {
    // Escopo do monorepo — evita refs locais (.ecopet-ref, etc.).
    include: ["apps/**/*.{test,spec}.?(c|m)[jt]s?(x)", "packages/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
    // Unitários não dependem de dist/; artefatos compilados rodam em `pnpm test:artifacts`.
    exclude: [...configDefaults.exclude, "**/*.artifact.test.ts"],
    // Suites da API com PGlite/seed precisam de mais que o default (10s) sob carga paralela.
    hookTimeout: 120_000,
    testTimeout: 60_000,
  },
});
