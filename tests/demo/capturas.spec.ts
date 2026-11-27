import { test, type Browser, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import sql from "mssql";
import { CLAVE_E2E, CUENTAS, configBd } from "../e2e/base";
import { BASE_DEMO } from "./base";
import { T } from "@/lib/db/esquema";

// Capturas de React para comparar lado a lado con la demo (scripts/capturas-demo.mjs),
// sobre la base local con volumen. Mismos nombres: docs/capturas/<seccion>-react-<ancho>.png.
//   npx playwright test -c playwright.demo.config.ts capturas            → todas las secciones
//   SECCIONES=panel,usuarios npx playwright test -c playwright.demo.config.ts capturas
//   npx playwright test -c playwright.demo.config.ts capturas -g menú    → el menú a varios anchos y zoom
// Entra con la cuenta «doble» (administradora que también es técnica), como Hperalta en la demo.

const SALIDA = resolve(__dirname, "../../docs/capturas");
const SOLO = process.env.SECCIONES?.split(",").filter(Boolean) ?? [];
const quiero = (s: string) => !SOLO.length || SOLO.includes(s);
const ids: Record<string, string> = {};
/** El indicador de `next dev` no es parte de la app. */
const SIN_DEV = "nextjs-portal { display: none !important; }";

async function consulta<R>(texto: string): Promise<R[]> {
  const pool = await new sql.ConnectionPool({ ...configBd(BASE_DEMO)!, database: BASE_DEMO, options: { encrypt: true, trustServerCertificate: true } }).connect();
  try {
    return (await pool.request().query<R>(texto)).recordset;
  } finally {
    await pool.close();
  }
}

test.beforeAll(async () => {
  mkdirSync(SALIDA, { recursive: true });
  const [v] = await consulta<{ folio: string }>(`
    SELECT TOP 1 v.folio FROM ${T.visita} v
     WHERE v.estado = 'COMPLETADA' AND EXISTS (SELECT 1 FROM ${T.problema} p WHERE p.visita_id = v.id)
       AND EXISTS (SELECT 1 FROM ${T.visita_foto} f WHERE f.visita_id = v.id)
     ORDER BY v.fecha_programada DESC`);
  const [c] = await consulta<{ id: string }>(`SELECT TOP 1 cliente_id AS id FROM ${T.sucursal} GROUP BY cliente_id ORDER BY COUNT(*) DESC`);
  const [s] = await consulta<{ id: string }>(`SELECT TOP 1 sucursal_id AS id FROM ${T.visita} GROUP BY sucursal_id ORDER BY COUNT(*) DESC`);
  const [m] = await consulta<{ id: string }>(`SELECT TOP 1 mall_id AS id FROM ${T.sucursal} WHERE mall_id IS NOT NULL GROUP BY mall_id ORDER BY COUNT(*) DESC`);
  const [a] = await consulta<{ folio: string }>(`
    SELECT TOP 1 v.folio FROM ${T.visita} v JOIN ${T.tecnico} t ON t.id = v.tecnico_id
     WHERE t.email = '${CUENTAS.doble.email}' AND v.estado IN ('PROGRAMADA', 'EN_CURSO') ORDER BY v.estado DESC, v.fecha_programada`);
  Object.assign(ids, { visita: v?.folio, cliente: c?.id, sucursal: s?.id, mall: m?.id, abierta: a?.folio });
});

async function entrar(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(CUENTAS.doble.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(CLAVE_E2E);
  await page.getByRole("button", { name: /Iniciar sesión/ }).click();
  await page.waitForURL(/\/admin/);
}

async function capturar(page: Page, nombre: string) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SALIDA}/${nombre}.png`, fullPage: true, style: SIN_DEV });
}

for (const ancho of [1440, 390]) {
  test(`capturas React a ${ancho} px`, async ({ page }) => {
    test.setTimeout(400_000);
    await page.setViewportSize({ width: ancho, height: ancho < 900 ? 844 : 900 });
    await entrar(page);
    const rutas: [string, string][] = [
      ["panel", "/admin"],
      ["visitas", "/admin/visitas"],
      ["detalle-visita", `/admin/visitas/${ids.visita}`],
      ["problemas", "/admin/problemas"],
      ["clientes", "/admin/clientes"],
      ["detalle-cliente", `/admin/clientes/${ids.cliente}`],
      ["sucursales", "/admin/sucursales"],
      ["detalle-sucursal", `/admin/sucursales/${ids.sucursal}`],
      ["malls", "/admin/malls"],
      ["detalle-mall", `/admin/malls/${ids.mall}`],
      ["mi-cuenta", "/admin/cuenta"],
      ["usuarios", "/admin/usuarios"],
      ["checklist", "/admin/checklist"],
    ];
    for (const [seccion, ruta] of rutas) {
      if (!quiero(seccion)) continue;
      await page.goto(ruta);
      await capturar(page, `${seccion}-react-${ancho}`);
    }
    if (quiero("nueva-visita")) {
      await page.goto("/admin/visitas");
      await page.getByRole("button", { name: "Nueva visita" }).first().click();
      await capturar(page, `nueva-visita-react-${ancho}`);
    }
    if (quiero("visitas-masivas")) {
      await page.goto("/admin/visitas");
      await page.getByRole("button", { name: "Visitas masivas" }).first().click();
      await capturar(page, `visitas-masivas-react-${ancho}`);
    }
    if (quiero("campanita")) {
      await page.goto("/admin");
      await page.getByRole("button", { name: /^Notificaciones/ }).locator("visible=true").first().click();
      await capturar(page, `campanita-react-${ancho}`);
    }
    if (quiero("panel-tecnico")) {
      await page.goto("/tecnico");
      await capturar(page, `panel-tecnico-react-${ancho}`);
    }
    if (quiero("formulario-acta") && ids.abierta) {
      await page.goto(`/tecnico/visitas/${ids.abierta}/formulario`);
      await capturar(page, `formulario-acta-react-${ancho}`);
    }
  });
}

/** Ancho de ventana × zoom del navegador: el zoom achica el viewport CSS y sube la densidad. */
const TAMANOS = [1200, 1280, 1366, 1440, 1920];
const ZOOMS = [1, 1.1, 1.25];

async function menu(browser: Browser, ventana: number, zoom: number, carpeta: string) {
  const ctx = await browser.newContext({ viewport: { width: Math.round(ventana / zoom), height: Math.round(860 / zoom) }, deviceScaleFactor: zoom });
  const page = await ctx.newPage();
  await entrar(page);
  await page.goto("/admin/visitas");
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${carpeta}/menu-${ventana}-z${Math.round(zoom * 100)}.png`, style: SIN_DEV });
  await ctx.close();
}

test("capturas del menú a varios anchos y zoom", async ({ browser }, info) => {
  test.setTimeout(400_000);
  const carpeta = process.env.CARPETA_MENU ?? resolve(SALIDA, "menu");
  mkdirSync(carpeta, { recursive: true });
  void info;
  for (const v of TAMANOS) for (const z of ZOOMS) await menu(browser, v, z, carpeta);
});
