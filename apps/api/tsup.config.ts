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
    // Função Vercel (Build Output API): o .func não inclui node_modules do monorepo.
    // Por isso o entry serverless precisa embutir dependências npm (exceto built-ins do Node).
    entry: { vercel: "src/vercel.ts" },
    format: ["cjs"],
    target: "node24",
    outDir: "dist",
    clean: false,
    sourcemap: true,
    noExternal: [/.*/],
    splitting: false,
    outExtension: () => ({ js: ".cjs" }),
  },
]);
