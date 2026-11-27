import { expect, test, type Page } from "@playwright/test";
import sql from "mssql";
import { entrarComo } from "./ayuda";
import { BASE_E2E, CUENTAS, configBd } from "./base";
import { T } from "@/lib/db/esquema";
import { hoyISO, sumarDias } from "@/lib/ui/fecha";

// La sección Visitas a lo ancho de un celular y de un escritorio: lista con sus
// pestañas y filtros, los paneles de programar y el detalle del acta. Las
// visitas sembradas son de la técnica «Zoe» y quedan fuera de circulación al terminar.

const ANCHOS = [320, 390, 1440];
const sembradas: { id: number; folio: string }[] = [];

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
    for (const [estado, dias] of [["COMPLETADA", 0], ["PROGRAMADA", 0], ["PROGRAMADA", 1], ["REAGENDADA", -1]] as const) {
      const r = await pool
        .request()
        .input("fecha", sql.Date, sumarDias(hoy, dias))
        .input("estado", sql.VarChar, estado)
        .query<{ id: string }>(`
          INSERT INTO ${T.visita} (cliente_id, sucursal_id, tecnico_id, motivo_codigo, estado, fecha_programada, trabajo_solicitado, indicaciones_acceso)
            SELECT TOP 1 s.cliente_id, s.id, t.id, 'VISITA', @estado, @fecha,
                   N'Calibrar las antenas del pórtico principal; falsa alarma desde el lunes.', N'Entrar por servicio. Clave: 4821'
              FROM ${T.sucursal} s CROSS JOIN ${T.tecnico} t WHERE t.email = '${CUENTAS.doble.email}';
          SELECT SCOPE_IDENTITY() AS id;`);
      const id = Number(r.recordset[0].id);
      const f = await pool.request().input("id", sql.BigInt, id).query<{ folio: string }>(`SELECT folio FROM ${T.visita} WHERE id = @id`);
      sembradas.push({ id, folio: f.recordset[0].folio });
    }
    await pool.request().input("id", sql.BigInt, sembradas[0].id).query(`
      INSERT INTO ${T.visita_ejecucion} (visita_id, hora_inicio, hora_termino, responsable_nombre, responsable_rut, motivo_real_codigo, observaciones, comentario_interno)
      VALUES (@id, DATEADD(minute, -47, SYSDATETIME()), SYSDATETIME(), N'Persona Ficticia', '12.345.678-5', 'VISITA', N'Quedó operativo.', N'Cambiar la fuente en la próxima.');
      INSERT INTO ${T.visita_trabajo} (visita_id, trabajo_codigo, detalle) VALUES (@id, 'REVISION_ANTENAS', N'Se revisaron las tres antenas.');
      INSERT INTO ${T.problema} (visita_id, tipo_codigo, descripcion, orden) VALUES (@id, 'ANTENA_NO_DETECTA', N'La antena del lado izquierdo no detecta etiquetas duras.', 1);`);
  });
});

test.afterAll(async () => {
  const ids = sembradas.map((v) => v.id).join(",") || "0";
  await conBase((pool) => pool.request().query(`UPDATE ${T.visita} SET activo = 0 WHERE id IN (${ids});`));
  sembradas.length = 0;
});

/** Errores y advertencias de la consola. En local los scripts de Vercel no existen y el proxy los manda a /login. */
function vigilarConsola(page: Page): string[] {
  const avisos: string[] = [];
  page.on("console", (m) => {
    const deVercel = /Refused to execute script from .*\/login/.test(m.text()) || `${m.location().url} ${m.text()}`.includes("/_vercel/");
    if ((m.type() === "error" || m.type() === "warning") && !deVercel) avisos.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => avisos.push(e.message));
  return avisos;
}

const desborde = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const ancho of ANCHOS) {
  test(`visitas se usa completa y sin desborde a ${ancho} px`, async ({ page }, info) => {
    const foto = (nombre: string, entera = false) =>
      page.screenshot({ path: `${process.env.CAPTURAS ?? info.outputDir}/${nombre}-${ancho}.png`, fullPage: entera });
    await page.setViewportSize({ width: ancho, height: 860 });
    const avisos = vigilarConsola(page);
    await entrarComo(page, "admin");
    await expect(page.getByRole("heading", { name: "Panel de operación" })).toBeVisible();

    await page.goto("/admin/visitas");
    await expect(page.getByRole("heading", { name: "Visitas", level: 1 })).toBeVisible();
    await expect(page.getByText(sembradas[0].folio)).toBeVisible();
    await foto("visitas-lista", true);
    expect(await desborde(page)).toBe(0);

    // Pestañas y filtros viven en la URL.
    await page.getByRole("tab", { name: /Reagendadas/ }).click();
    await expect(page).toHaveURL(/estado=REAGENDADA/);
    await expect(page.getByText(sembradas[0].folio)).toBeHidden();
    await page.getByRole("tab", { name: /Todas/ }).click();
    await page.getByRole("button", { name: /^Filtros/ }).click();
    await page.getByRole("combobox", { name: "Técnico" }).click();
    await foto("visitas-filtros");
    expect(await desborde(page)).toBe(0);
    await page.getByRole("button", { name: "Aplicar" }).click();
    await page.getByRole("button", { name: /^Filtros/ }).click();

    await page.getByRole("button", { name: "Acciones múltiples" }).click();
    await page.getByRole("checkbox", { name: `Marcar ${sembradas[1].folio}` }).check();
    await expect(page.getByText("1 visita marcada")).toBeVisible();
    await foto("visitas-lote");
    expect(await desborde(page)).toBe(0);
    await page.getByRole("button", { name: "Salir de acciones múltiples" }).click();

    // Los dos paneles de programar miden lo mismo.
    // «Nueva visita» es la hoja .sheet de la demo; «Visitas masivas» sigue en .sd-sheet.
    const panel = page.locator(".sheet.nv, .sd-sheet");
    await page.getByRole("button", { name: "Nueva visita" }).click();
    await expect(panel).toBeVisible();
    await page.waitForTimeout(300);
    const anchoNueva = (await panel.boundingBox())!.width;
    await foto("visitas-nueva");
    expect(await desborde(page)).toBe(0);
    await page.getByRole("button", { name: "Cerrar", exact: true }).click();
    await page.getByRole("button", { name: "Visitas masivas" }).click();
    await page.waitForTimeout(300);
    expect((await panel.boundingBox())!.width).toBe(anchoNueva);
    await foto("visitas-masivas");
    await page.getByRole("button", { name: "Cerrar", exact: true }).click();

    await page.getByText(sembradas[0].folio).click();
    await expect(page.getByRole("heading", { name: sembradas[0].folio })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recepción conforme" })).toBeVisible();
    await expect(page.getByText("Clave: ••••")).toBeVisible();
    await expect(page.getByText("RUT 12.345.***-5")).toBeVisible();
    await foto("visitas-detalle", true);
    expect(await desborde(page)).toBe(0);
    if (ancho >= 1101) {
      const firma = (await page.getByRole("heading", { name: "Recepción conforme" }).boundingBox())!;
      const trabajo = (await page.getByRole("heading", { name: "Trabajo solicitado" }).boundingBox())!;
      expect(firma.x).toBeGreaterThan(trabajo.x);
    }
    await page.getByRole("button", { name: "Trazabilidad", exact: true }).click();
    await expect(page.getByRole("button", { name: "Cerrar trazabilidad" })).toBeVisible();
    await page.waitForTimeout(300);
    await foto("visitas-traza");
    expect(await desborde(page)).toBe(0);
    expect(avisos).toEqual([]);
  });
}
