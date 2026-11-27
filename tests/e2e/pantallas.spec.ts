import { expect, test, type Page } from "@playwright/test";
import sql from "mssql";
import { entrarComo } from "./ayuda";
import { BASE_E2E, CUENTAS, configBd } from "./base";
import { T } from "@/lib/db/esquema";
import { hoyISO } from "@/lib/ui/fecha";

// Recorre todas las pantallas con datos, a lo ancho de un celular y de un
// escritorio: que cargue su título, que no se desborde y que la consola quede limpia.

const ANCHOS = [390, 1440];
const ids: number[] = [];
let mallId = 0;
let clienteId = 0;
let sucursalId = 0;
const folios: Record<string, string> = {};

async function conBase<R>(hacer: (pool: sql.ConnectionPool) => Promise<R>): Promise<R> {
  const pool = await new sql.ConnectionPool({
    ...configBd()!,
    database: BASE_E2E,
    options: { encrypt: true, trustServerCertificate: true },
  }).connect();
  try {
    return await hacer(pool);
  } finally {
    await pool.close();
  }
}

test.beforeAll(async () => {
  const hoy = hoyISO();
  await conBase(async (pool) => {
    const s = await pool.request().query<{ id: string; cliente_id: string }>(`SELECT TOP 1 id, cliente_id FROM ${T.sucursal} ORDER BY id`);
    sucursalId = Number(s.recordset[0].id);
    clienteId = Number(s.recordset[0].cliente_id);
    const m = await pool.request().query<{ id: string }>(`
      IF NOT EXISTS (SELECT 1 FROM ${T.mall} WHERE nombre = N'Mall Ficticio Pantallas')
        INSERT INTO ${T.mall} (nombre, direccion, comuna, region) VALUES (N'Mall Ficticio Pantallas', N'Av. Larga de Nombre Extenso 12345', N'Santiago', N'Metropolitana');
      SELECT id FROM ${T.mall} WHERE nombre = N'Mall Ficticio Pantallas';`);
    mallId = Number(m.recordset[0].id);
    for (const [clave, estado, quien] of [
      ["cerrada", "COMPLETADA", CUENTAS.tecnico.email],
      ["abierta", "PROGRAMADA", CUENTAS.tecnico.email],
      ["otra", "REAGENDADA", CUENTAS.doble.email],
    ] as const) {
      const r = await pool
        .request()
        .input("fecha", sql.Date, hoy)
        .input("estado", sql.VarChar, estado)
        .query<{ id: string }>(`
          INSERT INTO ${T.visita} (cliente_id, sucursal_id, tecnico_id, motivo_codigo, estado, fecha_programada, trabajo_solicitado, responsable_nombre, responsable_rut)
            SELECT TOP 1 s.cliente_id, s.id, t.id, 'VISITA', @estado, @fecha,
                   N'Revisar las antenas del acceso principal y el contador de personas de la entrada secundaria.', N'Persona Ficticia', '12.345.678-5'
              FROM ${T.sucursal} s CROSS JOIN ${T.tecnico} t WHERE t.email = '${quien}' ORDER BY s.id;
          SELECT SCOPE_IDENTITY() AS id;`);
      const id = Number(r.recordset[0].id);
      ids.push(id);
      const f = await pool.request().input("id", sql.BigInt, id).query<{ folio: string }>(`SELECT folio FROM ${T.visita} WHERE id = @id`);
      folios[clave] = f.recordset[0].folio;
    }
    await pool.request().input("id", sql.BigInt, ids[0]).query(`
      INSERT INTO ${T.visita_ejecucion} (visita_id, hora_inicio, hora_termino, responsable_nombre, responsable_rut, motivo_real_codigo, observaciones)
      VALUES (@id, DATEADD(minute, -35, SYSDATETIME()), SYSDATETIME(), N'Persona Ficticia', '12.345.678-5', 'VISITA', N'Operativo.');
      INSERT INTO ${T.visita_trabajo} (visita_id, trabajo_codigo, detalle) VALUES (@id, 'REVISION_ANTENAS', N'Revisión completa.');
      INSERT INTO ${T.problema} (visita_id, tipo_codigo, descripcion, orden) VALUES
        (@id, 'ANTENA_NO_DETECTA', N'La antena izquierda no detecta etiquetas duras desde la semana pasada.', 1),
        (@id, 'OTRO', N'Cable_suelto_sin_espacios_para_forzar_el_corte_de_una_palabra_muy_larga_en_pantalla', 2);`);
  });
});

test.afterAll(async () => {
  const lista = ids.join(",") || "0";
  await conBase((pool) => pool.request().query(`UPDATE ${T.visita} SET activo = 0 WHERE id IN (${lista});`));
  ids.length = 0;
});

/** Errores y advertencias de la consola. En local los scripts de Vercel no existen y el proxy los manda a /login. */
function vigilarConsola(page: Page): string[] {
  const avisos: string[] = [];
  page.on("console", (m) => {
    const texto = `${m.location().url} ${m.text()}`;
    const ajeno = /Refused to execute script from .*\/login/.test(m.text()) || texto.includes("/_vercel/") || /status of 404.*no-existe/.test(texto) || m.location().url.endsWith("/no-existe");
    if ((m.type() === "error" || m.type() === "warning") && !ajeno) avisos.push(`${page.url()} → ${m.type()}: ${m.text().slice(0, 400)}`);
  });
  page.on("pageerror", (e) => avisos.push(`${page.url()} → ${e.message}`));
  return avisos;
}

async function revisar(page: Page, nombre: string, ancho: number, carpeta: string) {
  await page.waitForLoadState("load");
  await page.waitForTimeout(350);
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect.soft(sobra, `${nombre} a ${ancho}px se desborda`).toBe(0);
  await expect.soft(page.getByText(/Algo salió mal|Application error/), `${nombre} a ${ancho}px muestra un error`).toHaveCount(0);
  await page.screenshot({ path: `${carpeta}/p-${nombre}-${ancho}.png`, fullPage: true });
}

for (const ancho of ANCHOS) {
  test(`panel de administración, todas las pantallas a ${ancho} px`, async ({ page }, info) => {
    test.setTimeout(240_000);
    const carpeta = process.env.CAPTURAS ?? info.outputDir;
    await page.setViewportSize({ width: ancho, height: 860 });
    const avisos = vigilarConsola(page);
    await entrarComo(page, "admin");

    const rutas: [string, string][] = [
      ["panel", "/admin"],
      ["visitas", "/admin/visitas"],
      ["visita", `/admin/visitas/${folios.cerrada}`],
      ["editar-acta", `/admin/visitas/${folios.cerrada}/editar`],
      ["papel", "/admin/visitas/papel"],
      ["problemas", "/admin/problemas"],
      ["clientes", "/admin/clientes"],
      ["cliente", `/admin/clientes/${clienteId}`],
      ["sucursales", "/admin/sucursales"],
      ["sucursal", `/admin/sucursales/${sucursalId}`],
      ["malls", "/admin/malls"],
      ["mall", `/admin/malls/${mallId}`],
      ["usuarios", "/admin/usuarios"],
      ["accesos", "/admin/accesos"],
      ["tecnicos", "/admin/tecnicos"],
      ["checklist", "/admin/checklist"],
      ["cuenta", "/admin/cuenta"],
      ["contactos", "/admin/contactos"],
      ["reagendas", "/admin/reagendas"],
      ["clave", "/cambiar-password"],
      ["no-existe", "/admin/no-existe"],
    ];
    for (const [nombre, ruta] of rutas) {
      await page.goto(ruta);
      await expect.soft(page.getByRole("heading").first(), `${nombre} sin título`).toBeVisible();
      await revisar(page, nombre, ancho, carpeta);
    }

    // Paneles y desplegables.
    await page.goto("/admin/clientes");
    await page.getByRole("button", { name: "Nuevo cliente" }).click();
    await revisar(page, "dlg-cliente", ancho, carpeta);
    await page.keyboard.press("Escape");
    await expect.soft(page.getByRole("dialog"), "Esc no cierra un panel sin cambios").toHaveCount(0);
    await page.getByRole("button", { name: "Nuevo cliente" }).click();
    await page.getByLabel("Razón social").fill("Algo");
    await page.keyboard.press("Escape");
    await expect.soft(page.getByText("¿Descartar lo escrito?"), "Esc con cambios no pregunta").toBeVisible();

    await page.goto("/admin/sucursales");
    await page.getByRole("button", { name: "Nueva sucursal" }).click();
    await revisar(page, "dlg-sucursal", ancho, carpeta);
    await page.goto("/admin/malls");
    await page.getByRole("button", { name: "Tiendas de Mall Ficticio Pantallas" }).click();
    await revisar(page, "dlg-tiendas", ancho, carpeta);

    await page.goto("/admin/problemas");
    await page.getByRole("button", { name: /^Estado o tipo/ }).first().click();
    await revisar(page, "problemas-estado", ancho, carpeta);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /Bitácora/ }).first().click();
    await revisar(page, "problemas-bitacora", ancho, carpeta);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /Historial del local/ }).click();
    await revisar(page, "problemas-historial", ancho, carpeta);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Checklist de gestión" }).click();
    await revisar(page, "problemas-checklist", ancho, carpeta);

    await page.goto("/admin/checklist");
    for (const pestana of ["Tipos de problema", "Trabajos", "Estados", "Acta"]) {
      await page.getByRole("tab", { name: pestana, exact: true }).click();
      await revisar(page, `checklist-${pestana.split(" ")[0].toLowerCase()}`, ancho, carpeta);
    }
    await page.getByRole("button", { name: "Así lo ve el técnico" }).click();
    await revisar(page, "checklist-vista", ancho, carpeta);

    await page.goto("/admin/usuarios");
    for (const pestana of await page.getByRole("tab").allInnerTexts()) {
      const nombre = pestana.replace(/\s*\d+$/, "").trim();
      await page.getByRole("tab", { name: new RegExp(`^${nombre}`) }).click();
      await revisar(page, `usuarios-${nombre.split(" ")[0].toLowerCase()}`, ancho, carpeta);
    }

    await page.goto("/admin");
    await page.getByRole("button", { name: /otificaciones/ }).first().click();
    await expect.soft(page.getByRole("dialog", { name: "Notificaciones" })).toBeVisible();
    await revisar(page, "campanita", ancho, carpeta);

    expect(avisos).toEqual([]);
  });

  test(`panel de técnico, todas las pantallas a ${ancho} px`, async ({ page }, info) => {
    test.setTimeout(180_000);
    const carpeta = process.env.CAPTURAS ?? info.outputDir;
    await page.setViewportSize({ width: ancho, height: 860 });
    const avisos = vigilarConsola(page);
    await entrarComo(page, "tecnico");
    for (const [nombre, ruta] of [
      ["t-inicio", "/tecnico"],
      ["t-visitas", "/tecnico/visitas"],
      ["t-cuenta", "/tecnico/perfil"],
      ["t-cerrada", `/tecnico/visitas/${folios.cerrada}`],
      ["t-abierta", `/tecnico/visitas/${folios.abierta}`],
    ]) {
      await page.goto(ruta);
      await revisar(page, nombre, ancho, carpeta);
    }
    await page.goto("/tecnico/visitas");
    await page.getByRole("button", { name: "Agregar visita" }).click();
    await revisar(page, "t-agregar", ancho, carpeta);

    // El formulario del acta, con la visita recién iniciada. Solo una vez: queda en curso.
    if (ancho === ANCHOS[0]) {
      await page.goto(`/tecnico/visitas/${folios.abierta}`);
      await page.getByRole("button", { name: "Iniciar visita" }).click();
      await page.getByRole("button", { name: /^Iniciar|Sí, iniciar|Confirmar/ }).last().click({ timeout: 3000 }).catch(() => {});
      await expect.soft(page).toHaveURL(/formulario/);
      await revisar(page, "t-formulario", ancho, carpeta);
    }
    expect(avisos).toEqual([]);
  });
}
