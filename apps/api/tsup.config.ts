import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/main.ts"],
    format: ["esm"],
    target: "node24",
    outDir: "dist",
    clean: true,
    sourcemap: true,
    noExternal: [/^@verasjuris\//],
    splitting: false,
  },
  {
    // @vercel/node consome CJS de forma mais previsível que ESM puro.
    entry: { vercel: "src/vercel.ts" },
    format: ["cjs"],
    target: "node24",
    outDir: "dist",
    clean: false,
    sourcemap: true,
    noExternal: [/^@verasjuris\//],
    splitting: false,
    outExtension: () => ({ js: ".cjs" }),
  },
]);
