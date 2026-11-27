import { expect, test, type Page } from "@playwright/test";
import sql from "mssql";
import { entrarComo } from "./ayuda";
import { BASE_E2E, CUENTAS, configBd } from "./base";
import { T } from "@/lib/db/esquema";
import { hoyISO, sumarDias } from "@/lib/ui/fecha";

// El Panel de operación y el menú lateral, con datos, a lo ancho de un celular y
// de un escritorio. Las visitas sembradas son de la técnica «Zoe» (no la del
// flujo completo) y quedan fuera de circulación al terminar.

const ANCHOS = [320, 390, 1440];
let ids: number[] = [];

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
  const visitas = [
    { estado: "COMPLETADA", minutos: 55 },
    { estado: "COMPLETADA", minutos: 4 },
    { estado: "EN_CURSO" },
    { estado: "PROGRAMADA" },
    { estado: "REAGENDADA" },
  ];
  await conBase(async (pool) => {
    for (const v of visitas) {
      const r = await pool
        .request()
        .input("fecha", sql.Date, hoy)
        .input("estado", sql.VarChar, v.estado)
        .query<{ id: string }>(`
          INSERT INTO ${T.visita} (cliente_id, sucursal_id, tecnico_id, motivo_codigo, estado, fecha_programada, trabajo_solicitado)
            SELECT TOP 1 s.cliente_id, s.id, t.id, 'VISITA', @estado, @fecha, N'Trabajo ficticio del panel'
              FROM ${T.sucursal} s CROSS JOIN ${T.tecnico} t WHERE t.email = '${CUENTAS.doble.email}';
          SELECT SCOPE_IDENTITY() AS id;`);
      const id = Number(r.recordset[0].id);
      ids.push(id);
      if (v.minutos) {
        await pool.request().input("id", sql.BigInt, id).input("min", sql.Int, v.minutos).query(`
          INSERT INTO ${T.visita_ejecucion} (visita_id, hora_inicio, hora_termino, responsable_nombre, motivo_real_codigo)
          VALUES (@id, DATEADD(minute, -@min, SYSDATETIME()), SYSDATETIME(), N'Persona Ficticia', 'VISITA');`);
      }
    }
    // Un problema abierto, dos resueltos en semanas distintas y un reagendamiento.
    await pool.request().input("id", sql.BigInt, ids[0]).query(`
      INSERT INTO ${T.problema} (visita_id, tipo_codigo, descripcion, orden) VALUES (@id, 'ANTENA_NO_DETECTA', N'No detecta', 1);
      INSERT INTO ${T.problema} (visita_id, tipo_codigo, descripcion, orden, estado, creado_en, resuelto_en) VALUES
        (@id, 'OTRO', N'Cable suelto', 2, 'RESUELTO', DATEADD(day, -30, SYSDATETIME()), DATEADD(day, -28, SYSDATETIME())),
        (@id, 'OTRO', N'Fuente dañada', 3, 'RESUELTO', DATEADD(day, -3, SYSDATETIME()), DATEADD(day, -2, SYSDATETIME()));`);
    await pool.request().input("id", sql.BigInt, ids[4]).input("fecha", sql.Date, hoy).input("nueva", sql.Date, sumarDias(hoy, 3)).query(`
      INSERT INTO ${T.reagendamiento} (visita_id, fecha_anterior, fecha_nueva, motivo, origen, usuario_id)
        SELECT @id, @fecha, @nueva, N'prueba funcional del panel', 'WEB', id FROM ${T.usuario} WHERE email = '${CUENTAS.admin.email}';`);
  });
});

test.afterAll(async () => {
  await conBase((pool) => pool.request().query(`UPDATE ${T.visita} SET activo = 0 WHERE id IN (${ids.join(",") || "0"});`));
  ids = [];
});

/** Errores y advertencias de la consola. En local los scripts de Vercel no existen y el proxy los manda a /login. */
function vigilarConsola(page: Page): string[] {
  const avisos: string[] = [];
  page.on("console", (m) => {
    const deVercel = /Refused to execute script from .*\/login/.test(m.text()) || `${m.location().url} ${m.text()}`.includes("/_vercel/");
    if ((m.type() === "error" || m.type() === "warning") && !deVercel) {
      avisos.push(`${m.type()}: ${m.text()}`);
    }
  });
  page.on("pageerror", (e) => avisos.push(e.message));
  return avisos;
}

const desborde = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const ancho of ANCHOS) {
  test(`el panel se ve completo y sin desborde a ${ancho} px`, async ({ page }, info) => {
    await page.setViewportSize({ width: ancho, height: 900 });
    const avisos = vigilarConsola(page);
    await entrarComo(page, "admin");
    await expect(page.getByRole("heading", { name: "Panel de operación" })).toBeVisible();
    for (const titulo of ["Técnicos", "Estado de las visitas", "Tiempo promedio de resolución", "Reagendamientos"]) {
      await expect(page.getByRole("heading", { name: titulo })).toBeVisible();
    }
    expect(await desborde(page)).toBe(0);
    await page.screenshot({ path: `${process.env.CAPTURAS ?? info.outputDir}/panel-${ancho}.png`, fullPage: true });

    await page.getByRole("button", { name: "Mes" }).click();
    await expect(page.getByRole("link", { name: /Visitas del mes/ })).toBeVisible();
    await page.getByRole("button", { name: /Antena no detecta/ }).click();
    await expect(page.getByRole("link", { name: "Ver problemas" })).toBeVisible();
    expect(await desborde(page)).toBe(0);
    expect(avisos).toEqual([]);
  });
}

test("en el celular el menú es un cajón: abre, navega y cierra con Esc", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await entrarComo(page, "admin");
  const menu = page.getByRole("complementary", { name: "Menú del sistema de técnicos" });
  await expect(menu).toBeHidden();
  await page.getByRole("button", { name: "Abrir el menú" }).click();
  await expect(menu).toBeVisible();
  await page.screenshot({ path: `${process.env.CAPTURAS ?? info.outputDir}/menu-390.png` });
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await page.getByRole("button", { name: "Abrir el menú" }).click();
  await menu.getByRole("link", { name: /Visitas/ }).click();
  await expect(page).toHaveURL(/\/admin\/visitas/);
  await expect(menu).toBeHidden();
});
