import { test } from "@playwright/test";

// Vacío a propósito: `RESEMBRAR=1 npx playwright test -c playwright.demo.config.ts resembrar`
// solo corre el global setup, que vuelve a crear la base de comparación con el volumen.
test("base de comparación lista", () => {});
