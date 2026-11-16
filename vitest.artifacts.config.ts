import { defineConfig, configDefaults } from "vitest/config";

/** Suite pós-build: exige artefatos em dist/ (ex.: apps/api/dist/vercel.cjs). */
export default defineConfig({
  test: {
    include: ["apps/**/*.artifact.test.ts", "packages/**/*.artifact.test.ts"],
    exclude: [...configDefaults.exclude],
  },
});
