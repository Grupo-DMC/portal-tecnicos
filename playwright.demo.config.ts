import { defineConfig, devices } from "@playwright/test";
import { PUERTO_DEMO, entornoDemo } from "./tests/demo/base";

// Comparación con la demo panel-operacion.html sobre la base local con volumen
// (tests/demo). `RESEMBRAR=1` la crea de nuevo. La app corre con build de producción
// (next build + next start, en .next-demo) y Node limitado a 2 GB, para no ahogar el
// equipo; se reutiliza si ya está arriba en el puerto 3200 (scripts/demo-local.mjs).
export default defineConfig({
  testDir: "tests/demo",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  reporter: [["list"]],
  outputDir: "test-results/demo",
  globalSetup: "./tests/demo/global-setup.ts",
  use: { baseURL: `http://localhost:${PUERTO_DEMO}`, locale: "es-CL", timezoneId: "America/Santiago", ...devices["Desktop Chrome"] },
  webServer: {
    command: `npx next build && npx next start -p ${PUERTO_DEMO}`,
    url: `http://localhost:${PUERTO_DEMO}/login`,
    timeout: 300_000,
    reuseExistingServer: true,
    env: { ...(process.env as Record<string, string>), ...entornoDemo(), NODE_OPTIONS: "--max-old-space-size=2048" },
    stdout: "ignore",
    stderr: "pipe",
  },
});
