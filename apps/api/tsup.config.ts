import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/main.ts", "src/vercel.ts"],
  format: ["esm"],
  target: "node24",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  noExternal: [/^@verasjuris\//],
  splitting: false,
});
