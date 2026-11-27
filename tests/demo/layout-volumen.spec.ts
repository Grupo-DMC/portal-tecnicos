import { expect, test } from "@playwright/test";
import { CLAVE_E2E, CUENTAS } from "../e2e/base";
import { RUTAS_ADMIN, desbordesConBarras } from "../e2e/barras";
import { PUERTO_DEMO } from "./base";

// Lo mismo que tests/e2e/layout.spec.ts, sobre el seed de volumen (tests/demo/volumen.ts):
// 23 clientes, más de 1.100 visitas, nombres y correos al límite, con barras clásicas de Windows.
test("con el seed de volumen y barras clásicas nada se desborda a lo ancho", async () => {
  test.setTimeout(600_000);
  const r = await desbordesConBarras({
    baseURL: `http://localhost:${PUERTO_DEMO}`,
    email: CUENTAS.doble.email,
    clave: CLAVE_E2E,
    rutas: RUTAS_ADMIN,
    ventanas: [1196, 1200, 1280, 1366],
    zooms: [1, 1.1, 1.25],
  });
  expect(r.barra).toBeGreaterThan(10);
  expect(r.fallas).toEqual([]);
});
