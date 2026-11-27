import { expect, test, type Page } from "@playwright/test";
import sql from "mssql";
import { entrarComo } from "./ayuda";
import { BASE_E2E, CLAVE_E2E, CUENTAS, PUERTO, configBd } from "./base";
import { RUTAS_ADMIN, desbordesConBarras } from "./barras";
import { T } from "@/lib/db/esquema";

// Layout general y menú lateral, igual que `.app` de la demo panel-operacion.html:
// - desde 1025 px el menú es una columna fija de 272 px, de alto completo, pegada al borde,
//   y el contenido ocupa todo el resto (sin columna angosta centrada);
// - hasta 1024 px es un cajón que se abre desde la barra de arriba y se cierra con Esc;
// - nada se desborda a lo ancho entre 320 y 1920 px, tampoco con el zoom del navegador.

/** Ventana × zoom → ancho CSS que ve la página. */
const ESCRITORIO = [1200, 1280, 1366, 1440, 1920].flatMap((v) => [1, 1.1, 1.25].map((z) => Math.round(v / z))).filter((w) => w > 1024);
const CAJON = [320, 390, 768, 960, 1024];
const RUTAS = ["/admin", "/admin/visitas", "/admin/problemas", "/admin/clientes", "/admin/sucursales", "/admin/malls", "/admin/usuarios", "/admin/checklist", "/admin/cuenta"];

function vigilarConsola(page: Page): string[] {
  const avisos: string[] = [];
  page.on("console", (m) => {
    const texto = `${m.location().url} ${m.text()}`;
    const ajeno = /Refused to execute script from .*\/login/.test(m.text()) || texto.includes("/_vercel/");
    if ((m.type() === "error" || m.type() === "warning") && !ajeno) avisos.push(`${page.url()} → ${m.type()}: ${m.text().slice(0, 300)}`);
  });
  page.on("pageerror", (e) => avisos.push(`${page.url()} → ${e.message}`));
  return avisos;
}

test("el menú es una columna de alto completo y el contenido usa todo el ancho", async ({ page }) => {
  test.setTimeout(240_000);
  const avisos = vigilarConsola(page);
  await entrarComo(page, "admin");
  for (const ruta of ["/admin", "/admin/visitas", "/admin/checklist"]) {
    await page.goto(ruta);
    for (const ancho of ESCRITORIO) {
      await page.setViewportSize({ width: ancho, height: 720 });
      await expect(page.locator(".side")).toBeVisible();
      const m = await page.evaluate(() => {
        const side = document.querySelector(".side")!.getBoundingClientRect();
        const cont = document.querySelector(".contenido")!.getBoundingClientRect();
        const nav = getComputedStyle(document.querySelector(".nav")!).overflowY;
        return { vw: document.documentElement.clientWidth, vh: innerHeight, side, cont, nav, sobra: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      });
      const donde = `${ruta} a ${ancho}px`;
      expect.soft(m.side.left, `${donde}: el menú no está pegado al borde`).toBe(0);
      expect.soft(Math.round(m.side.width), `${donde}: ancho del menú`).toBe(272);
      expect.soft(Math.round(m.side.height), `${donde}: el menú no ocupa todo el alto`).toBe(m.vh);
      expect.soft(m.nav, `${donde}: el desplazamiento debe ocurrir dentro de la navegación`).toBe("auto");
      expect.soft(Math.round(m.cont.left), `${donde}: el contenido no empieza tras el menú`).toBe(272);
      expect.soft(Math.round(m.cont.right), `${donde}: el contenido no llega al borde derecho`).toBe(m.vw);
      expect.soft(m.sobra, `${donde}: desborde horizontal`).toBe(0);
    }
  }
  // Los ítems: ícono, texto y contador alineado a la derecha.
  await page.setViewportSize({ width: 1440, height: 900 });
  const item = page.locator(".nav a", { hasText: "Visitas" });
  const [a, cnt] = await Promise.all([item.boundingBox(), item.locator(".cnt").boundingBox()]);
  expect(Math.round(a!.x + a!.width - (cnt!.x + cnt!.width))).toBeLessThanOrEqual(12);
  await expect(page.locator(".contenido > .foot")).toHaveText("Grupo DMC, Ideas Tecnológicas de Seguridad.");
  expect(avisos).toEqual([]);
});

test("hasta 1024 px el menú es un cajón que se cierra con Esc", async ({ page }) => {
  const avisos = vigilarConsola(page);
  await entrarComo(page, "admin");
  for (const ancho of CAJON) {
    await page.setViewportSize({ width: ancho, height: 800 });
    await page.goto("/admin/visitas");
    const abrir = page.getByRole("button", { name: "Abrir el menú" });
    await expect(abrir).toBeVisible();
    await expect(page.locator(".mbar").getByRole("button", { name: /^Notificaciones/ })).toBeVisible();
    await expect(page.locator(".side")).not.toBeInViewport();
    await abrir.click();
    await expect(page.locator(".side")).toBeInViewport();
    await page.keyboard.press("Escape");
    await expect(page.locator(".side")).not.toBeInViewport();
    await abrir.click();
    await page.locator(".scrim").click({ position: { x: ancho - 10, y: 400 } });
    await expect(page.locator(".side")).not.toBeInViewport();
  }
  expect(avisos).toEqual([]);
});

test("ninguna pantalla se desborda a lo ancho entre 320 y 1920 px", async ({ page }) => {
  test.setTimeout(240_000);
  const avisos = vigilarConsola(page);
  await entrarComo(page, "admin");
  for (const ruta of RUTAS) {
    await page.goto(ruta);
    for (const ancho of [320, 390, 768, 1024, 1025, 1280, 1440, 1920]) {
      await page.setViewportSize({ width: ancho, height: 800 });
      const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect.soft(sobra, `${ruta} a ${ancho}px se desborda`).toBe(0);
    }
  }
  expect(avisos).toEqual([]);
});

/* ---------- Barras clásicas de Windows y textos al límite ---------- */

async function conBase<R>(hacer: (pool: sql.ConnectionPool) => Promise<R>): Promise<R> {
  const pool = await new sql.ConnectionPool({ ...configBd()!, database: BASE_E2E, options: { encrypt: true, trustServerCertificate: true } }).connect();
  try {
    return await hacer(pool);
  } finally {
    await pool.close();
  }
}

test.describe("con barras clásicas de Windows y textos al límite", () => {
  // Nombres largos, correo largo y más de mil visitas (contador de 4 dígitos en el menú).
  // Todo se apaga al terminar para no tocar las demás pruebas.
  test.beforeAll(async () => {
    await conBase((pool) =>
      pool.request().batch(`
        INSERT INTO ${T.cliente} (rut, razon_social, nombre_fantasia) VALUES ('77.777.777-7', N'Comercializadora Internacional de Artículos Deportivos, Calzado y Vestuario Limitada', N'Comercializadora Internacional de Calzado');
        INSERT INTO ${T.marca} (cliente_id, nombre) SELECT id, N'Distribuidora Sudamericana de Ropa Outdoor y Accesorios' FROM ${T.cliente} WHERE rut = '77.777.777-7';
        INSERT INTO ${T.sucursal} (cliente_id, marca_id, nombre, direccion, comuna, region)
          SELECT c.id, m.id, N'Centro Comercial Paseo Costanera Premium Outlet Puerto Montt, Local 214-B', N'Avenida Diego Portales Esquina Calle Urmeneta 1130', N'Puerto Montt', N'Los Lagos'
            FROM ${T.cliente} c JOIN ${T.marca} m ON m.cliente_id = c.id WHERE c.rut = '77.777.777-7';
        INSERT INTO ${T.tecnico} (rut, nombres, apellido_paterno, email) VALUES ('19.876.543-K', N'Maximiliano Alejandro', N'Valenzuela-Echeverría', 'maximiliano.valenzuela.echeverria.santibanez@contratistas-externos.example.com');
        INSERT INTO ${T.visita} (cliente_id, sucursal_id, tecnico_id, motivo_codigo, estado, fecha_programada, trabajo_solicitado)
          SELECT TOP 1010 s.cliente_id, s.id, t.id, 'VISITA', 'COMPLETADA', DATEADD(day, -(ROW_NUMBER() OVER (ORDER BY (SELECT 1)) % 300), CAST(SYSDATETIME() AS date)), N'Prueba de volumen del layout'
            FROM sys.all_objects a CROSS JOIN ${T.sucursal} s CROSS JOIN ${T.tecnico} t
           WHERE s.nombre LIKE N'Centro Comercial Paseo%' AND t.email LIKE 'maximiliano.%';`)
    );
  });
  test.afterAll(async () => {
    await conBase((pool) =>
      pool.request().batch(`
        UPDATE ${T.visita} SET activo = 0 WHERE trabajo_solicitado = N'Prueba de volumen del layout';
        UPDATE ${T.sucursal} SET activo = 0, motivo_inactivo = N'Prueba de layout' WHERE nombre LIKE N'Centro Comercial Paseo%';
        UPDATE ${T.tecnico} SET activo = 0, motivo_inactivo = N'Prueba de layout' WHERE email LIKE 'maximiliano.%';
        UPDATE ${T.cliente} SET activo = 0, motivo_inactivo = N'Prueba de layout' WHERE rut = '77.777.777-7';`)
    );
  });

  test("el Panel a 1196 px no se desborda (la ventana de la captura del recorte)", async () => {
    const r = await desbordesConBarras({ baseURL: `http://localhost:${PUERTO}`, email: CUENTAS.doble.email, clave: CLAVE_E2E, rutas: ["/admin"], ventanas: [1196], zooms: [1] });
    expect(r.barra, "las barras clásicas tienen que ocupar espacio").toBeGreaterThan(10);
    expect(r.fallas).toEqual([]);
  });

  test("ninguna pantalla se desborda a 1196, 1200, 1280 y 1366 px con zoom 100, 110 y 125 %", async () => {
    test.setTimeout(600_000);
    const r = await desbordesConBarras({
      baseURL: `http://localhost:${PUERTO}`,
      email: CUENTAS.doble.email,
      clave: CLAVE_E2E,
      rutas: RUTAS_ADMIN,
      ventanas: [1196, 1200, 1280, 1366],
      zooms: [1, 1.1, 1.25],
    });
    expect(r.barra).toBeGreaterThan(10);
    expect(r.fallas).toEqual([]);
  });
});
