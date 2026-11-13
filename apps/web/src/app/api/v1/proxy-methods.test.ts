import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

describe("BFF /api/v1 proxy methods", () => {
  it("exports PUT and other verbs required by authenticated modules", () => {
    const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "[...path]/route.ts");
    const source = readFileSync(file, "utf8");
    for (const method of ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
      expect(source, method).toContain(`export const ${method} = proxy`);
    }
  });
});
