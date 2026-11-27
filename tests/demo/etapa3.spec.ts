import { test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sql from "mssql";
import { CLAVE_E2E, CUENTAS, configBd } from "../e2e/base";
import { BASE_DEMO } from "./base";
import { T } from "@/lib/db/esquema";

// Etapa 3 (campanita): la demo y React lado a lado, lista y «Qué quiero ver», a 1440 y 390 px.
//   npx playwright test -c playwright.demo.config.ts etapa3
// Siembra en la base LOCAL de comparación (dmc_test_demo0001) la misma actividad que trae la
// demo, con folios reales de esa base, y deja como nuevas las cuatro primeras de los demás.
// Lo sembrado se reconoce por quién y qué (SEMBRADO) y se reemplaza en cada corrida.

const SALIDA = resolve(__dirname, "../../docs/capturas/etapa3");
const DEMO = pathToFileURL(process.env.DEMO_HTML ?? "C:/Users/EQUIPO/Downloads/panel-operacion.html").href;
/** Quiénes y qué textos fijos siembra esta prueba: con eso se borra lo sembrado antes de volver a sembrar. */
const SEMBRADO = `actor_nombre IN (N'Manuel Zambrano', N'Richard Diaz')
   OR (actor_nombre IN (N'Doble E2e', N'Zoe Doble') AND (texto LIKE N'agendó la visita %' OR texto IN (N'eliminó 5 visitas a la vez', N'reprogramó 3 visitas a la vez')))
   OR (actor_nombre IS NULL AND (texto = N'Se pidió una contraseña nueva' OR texto LIKE N'canceló por plazo la visita %'))`;

async function conPool<R>(f: (p: sql.ConnectionPool) => Promise<R>): Promise<R> {
  const pool = await new sql.ConnectionPool({ ...configBd(BASE_DEMO)!, database: BASE_DEMO, options: { encrypt: true, trustServerCertificate: true } }).connect();
  try {
    return await f(pool);
  } finally {
    await pool.close();
  }
}

test.beforeAll(async () => {
  mkdirSync(SALIDA, { recursive: true });
  await conPool(async (pool) => {
    const folios = (await pool.request().query<{ folio: string }>(`SELECT TOP 6 folio FROM ${T.visita} ORDER BY fecha_programada DESC`)).recordset.map((r) => r.folio);
    const [uid] = (await pool.request().query<{ id: number }>(`SELECT id FROM ${T.usuario} WHERE email = '${CUENTAS.doble.email}'`)).recordset;
    const f = (i: number) => folios[i % folios.length];
    // [minutos atrás o «d:hh:mm» (días atrás y hora), tipo, actor (null = sin cuenta), de técnico, texto, detalle, propia]
    const filas: [string, string, string | null, boolean, string, string | null, boolean][] = [
      ["2:18:14", "tecnico.cierre", "Manuel Zambrano", true, `completó la visita ${f(4)} y cerró el acta`, null, false],
      ["1:12:35", "visita.eliminacion", null, false, "eliminó 5 visitas a la vez", "registros de prueba", true],
      ["1:12:40", "tecnico.cierre", "Manuel Zambrano", true, `completó la visita ${f(3)} y cerró el acta`, null, false],
      ["1:15:56", "tecnico.inicio", "Manuel Zambrano", true, `inició la visita ${f(2)}`, null, false],
      ["1:16:01", "problema.alta", "Manuel Zambrano", true, `levantó 1 problema en ${f(2)}`, "Cableado con problemas: Cable UTP (Sincronización) × 1", false],
      ["1:16:02", "tecnico.cierre", "Manuel Zambrano", true, `completó la visita ${f(2)} y cerró el acta`, null, false],
      ["50", "visita.alta", null, true, `agendó la visita ${f(5)}`, null, true],
      ["42", "visita.cambio", null, true, "reprogramó 3 visitas a la vez", `${f(0)}, ${f(1)}, ${f(3)}`, true],
      ["40", "tecnico.estado", null, false, `canceló por plazo la visita ${f(1)}`, null, false],
      ["30", "tecnico.pedido", "Manuel Zambrano", true, `pidió permiso para corregir el acta de la visita ${f(3)}`, null, false],
      ["20", "cuenta.password", null, false, "Se pidió una contraseña nueva", "richard.diaz@grupodmc.cl", false],
      ["12", "tecnico.inicio", "Richard Diaz", true, `inició la visita ${f(0)}`, null, false],
    ];
    await pool.request().query(`DELETE FROM ${T.actividad} WHERE ${SEMBRADO}`);
    const ids: number[] = [];
    for (const [cuando, tipo, actor, deTecnico, texto, detalle, propia] of filas) {
      const momento = cuando.includes(":")
        ? (() => {
            const [d, h, m] = cuando.split(":").map(Number);
            return `DATEADD(minute, ${h * 60 + m}, CAST(DATEADD(day, -${d}, CAST(SYSDATETIME() AS date)) AS datetime2))`;
          })()
        : `DATEADD(minute, -${cuando}, SYSDATETIME())`;
      const r = await pool
        .request()
        .input("tipo", tipo)
        .input("actorId", sql.BigInt, propia ? uid.id : null)
        .input("actor", propia ? "Doble E2e" : actor)
        .input("tec", sql.Bit, deTecnico && !propia ? 1 : 0)
        .input("texto", texto)
        .input("detalle", detalle)
        .input("folio", texto.match(/V-\d{4}-\d+/)?.[0] ?? null)
        .input("enlace", tipo === "cuenta.password" ? "/admin/usuarios?vista=contrasenas" : texto.match(/V-\d{4}-\d+/) ? `/admin/visitas/${texto.match(/V-\d{4}-\d+/)![0]}` : null)
        .query<{ id: number }>(
          `INSERT INTO ${T.actividad} (tipo, actor_usuario_id, actor_nombre, de_tecnico, texto, detalle, enlace, creado_en)
           OUTPUT INSERTED.id AS id
           VALUES (@tipo, @actorId, @actor, @tec, @texto,
                   COALESCE(@detalle, (SELECT TOP (1) s.nombre FROM ${T.visita} v JOIN ${T.sucursal} s ON s.id = v.sucursal_id WHERE v.folio = @folio)),
                   @enlace, ${momento})`
        );
      ids.push(Number(r.recordset[0].id));
    }
    // Nuevas: las cuatro más recientes de los demás (como la demo).
    const nuevasDesde = ids[ids.length - 4] - 1;
    await pool.request().query(`
      MERGE ${T.notificacion_usuario} AS d USING (SELECT ${uid.id} AS usuario_id) AS o ON d.usuario_id = o.usuario_id
       WHEN MATCHED THEN UPDATE SET leido_hasta = ${nuevasDesde}
       WHEN NOT MATCHED THEN INSERT (usuario_id, leido_hasta) VALUES (o.usuario_id, ${nuevasDesde});`);
  });
});

async function entrar(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(CUENTAS.doble.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(CLAVE_E2E);
  await page.getByRole("button", { name: /Iniciar sesión/ }).click();
  await page.waitForURL(/\/admin/);
}

for (const ancho of [1440, 390]) {
  test(`campanita demo y React a ${ancho} px`, async ({ browser }) => {
    const alto = ancho < 900 ? 844 : 900;
    const opciones = { viewport: { width: ancho, height: alto }, locale: "es-CL", timezoneId: "America/Santiago", reducedMotion: "reduce" as const };

    const demo = await (await browser.newContext(opciones)).newPage();
    await demo.goto(DEMO);
    await demo.waitForTimeout(500);
    await demo.locator("button[aria-label^='Notificaciones']:visible").first().click();
    await demo.waitForTimeout(400);
    await demo.screenshot({ path: `${SALIDA}/campanita-demo-${ancho}.png` });
    await demo.click("#ntCfgBtn");
    await demo.waitForTimeout(300);
    await demo.screenshot({ path: `${SALIDA}/campanita-ajustes-demo-${ancho}.png` });
    await demo.context().close();

    const ctx = await browser.newContext({ ...opciones, baseURL: test.info().project.use.baseURL });
    const page = await ctx.newPage();
    await page.addInitScript(() => window.localStorage.clear());
    await entrar(page);
    await page.goto("/admin");
    await page.getByRole("button", { name: /^Notificaciones/ }).locator("visible=true").first().click();
    await page.locator(".sheet.ntf a.ntf-it").first().waitFor();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SALIDA}/campanita-react-${ancho}.png` });
    await page.getByRole("button", { name: "Qué quiero ver" }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SALIDA}/campanita-ajustes-react-${ancho}.png` });
    await ctx.close();
  });
}
