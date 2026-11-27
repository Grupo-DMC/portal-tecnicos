import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Todas las fechas usan el DatePicker compartido (components/ui/DatePicker.tsx):
// no puede quedar ningún <input type="date"> en la app.
const RAIZ = join(__dirname, "../..");
function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? archivos(p) : /\.(tsx?|jsx?)$/.test(n) ? [p] : [];
  });
}
const NATIVO = /type\s*=\s*\{?\s*["']date["']|\.type\s*=\s*["']date["']/;

describe("sin campos de fecha nativos", () => {
  it("no hay type=\"date\" en app/, components/ ni lib/", () => {
    const hallados = ["app", "components", "lib"]
      .flatMap((d) => archivos(join(RAIZ, d)))
      .filter((f) => NATIVO.test(readFileSync(f, "utf8")))
      .map((f) => f.slice(RAIZ.length + 1));
    expect(hallados).toEqual([]);
  });
});
