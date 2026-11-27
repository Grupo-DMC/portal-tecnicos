import { expect, test, type Page } from "@playwright/test";
import sql from "mssql";
import { deflateSync } from "node:zlib";
import { entrarComo } from "./ayuda";
import { BASE_E2E, configBd } from "./base";
import { T } from "@/lib/db/esquema";
import { hoyISO, sumarDias } from "@/lib/ui/fecha";

// «Nueva visita» del panel (#mNew de panel-operacion.html) en la app de verdad:
// plegables, «Buscar por mall», «Con margen», la hora de las instalaciones, el
// ayudante, el contacto en tienda, los adjuntos, guardar y cerrar con Esc.
// Lo que se siembra acá se borra al terminar, y la visita creada queda inactiva.

const creadas: string[] = [];
const MOTIVO_INSTALACION = "INSTALACION_E2E";

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
  await conBase((pool) =>
    pool.request().batch(`
      INSERT INTO ${T.mall} (nombre, direccion, comuna, region) VALUES (N'Mall E2E Plaza', N'Av. Ficticia 900', N'Maipú', N'Metropolitana');
      INSERT INTO ${T.sucursal} (cliente_id, marca_id, mall_id, nombre, direccion, comuna, region)
        SELECT TOP 1 c.id, m.id, (SELECT id FROM ${T.mall} WHERE nombre = N'Mall E2E Plaza'), N'Tienda E2E Plaza', N'Av. Ficticia 900', N'Maipú', N'Metropolitana'
          FROM ${T.cliente} c JOIN ${T.marca} m ON m.cliente_id = c.id;
      INSERT INTO ${T.catalogo_motivo} (codigo, nombre, orden) VALUES ('${MOTIVO_INSTALACION}', N'Instalación de antenas', 3);
      INSERT INTO ${T.catalogo_cargo} (codigo, nombre, orden) VALUES ('JEFE_E2E', N'Jefe de tienda', 1);
      INSERT INTO ${T.persona_local} (sucursal_id, nombre, rut, telefono, cargo)
        SELECT id, N'Marta Firmante', '12.345.678-5', '+56 9 8765 4321', N'Jefe de tienda' FROM ${T.sucursal} WHERE nombre = N'Tienda E2E Centro';
    `)
  );
});

test.afterAll(async () => {
  await conBase(async (pool) => {
    const folios = creadas.map((f) => `'${f}'`).join(",") || "''";
    await pool.request().batch(`
      UPDATE ${T.visita} SET activo = 0 WHERE folio IN (${folios});
      DELETE FROM ${T.persona_local} WHERE nombre = N'Marta Firmante';
      DELETE FROM ${T.catalogo_cargo} WHERE codigo = 'JEFE_E2E';
      DELETE FROM ${T.catalogo_motivo} WHERE codigo = '${MOTIVO_INSTALACION}';
      DELETE FROM ${T.sucursal} WHERE nombre = N'Tienda E2E Plaza';
      DELETE FROM ${T.mall} WHERE nombre = N'Mall E2E Plaza';
    `);
  });
  creadas.length = 0;
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

/** Un PNG de 8×8 de verdad, para que el navegador lo pueda recomprimir. */
function png(): Buffer {
  const crc = (b: Buffer) => {
    let c = ~0;
    for (const x of b) {
      c ^= x;
      for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    }
    return ~c >>> 0;
  };
  const trozo = (tipo: string, datos: Buffer) => {
    const t = Buffer.from(tipo);
    const l = Buffer.alloc(4);
    l.writeUInt32BE(datos.length);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(Buffer.concat([t, datos])));
    return Buffer.concat([l, t, datos, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(8, 0);
  ihdr.writeUInt32BE(8, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const filas = Buffer.concat(Array.from({ length: 8 }, () => Buffer.from([0, ...Array(24).fill(120)])));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), trozo("IHDR", ihdr), trozo("IDAT", deflateSync(filas)), trozo("IEND", Buffer.alloc(0))]);
}

/** Elige en el DatePicker que abre `campo` el día `iso` (con `etiqueta`, la ventana toma ese nombre). */
async function elegirDia(page: Page, campo: string, iso: string, nombre = "Elegir fecha") {
  await page.locator(campo).click();
  const cal = page.getByRole("dialog", { name: nombre });
  await expect(cal).toBeVisible();
  if (!(await cal.locator(`[data-dia="${iso}"]`).count())) await cal.getByRole("button", { name: "Ver mes siguiente" }).click();
  await cal.locator(`[data-dia="${iso}"]`).click();
  await cal.getByRole("button", { name: "Aplicar" }).click();
  await expect(cal).toHaveCount(0);
}

const msg = (page: Page, id: string) => page.locator(`#${id}`);

test("Nueva visita: igual a la demo, valida en línea y programa la visita", async ({ page }) => {
  test.setTimeout(150_000);
  const avisos = vigilarConsola(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await entrarComo(page, "admin");
  await page.goto("/admin/visitas");
  const abrir = page.getByRole("button", { name: "Nueva visita" }).first();
  await abrir.click();

  const panel = page.getByRole("dialog", { name: "Nueva visita" });
  const enviar = panel.getByRole("button", { name: "Programar visita" });
  await test.step("abre con los plegables cerrados y los valores de partida", async () => {
    await expect(panel).toBeVisible();
    await expect(panel.locator("details.opt")).toHaveCount(2);
    for (const d of await panel.locator("details.opt").all()) await expect(d).not.toHaveAttribute("open", "");
    await expect(panel.locator("#nvContactoSum")).toHaveText("Opcional");
    await expect(panel.getByText("El folio se genera solo")).toHaveCount(0);
    await expect(panel.getByText("Vacía: el técnico va cuando pueda")).toHaveCount(0);
    await expect(panel.getByRole("button", { name: "Cerrar" })).toBeFocused();
    await expect(panel.getByRole("checkbox", { name: "Calibración de las antenas" })).toBeChecked();
    await expect(panel.locator(".mot-opt .first")).toHaveText("Principal");
    await expect(panel.locator("#nvTec option:checked")).toHaveText("Tecnica Ficticia");
    await expect(panel.locator("#nvAyu option:checked")).toHaveText("Sin ayudante, va solo");
    await expect(panel.locator("#nvByMall")).not.toBeChecked();
    await expect(panel.locator("#nvMargen")).not.toBeChecked();
    await expect(panel.locator("#nvHastaWrap")).toBeHidden();
    await expect(panel.locator(".phone span")).toHaveText("+56");
    await expect(panel.locator("#nvHoraLbl")).toHaveText("Hora de llegada (opcional)");
  });

  await test.step("«Buscar por mall» cambia la etiqueta y lista malls", async () => {
    await panel.locator("#nvByMall").check();
    await expect(panel.locator("#nvClienteLbl")).toHaveText("Mall");
    await expect(panel.locator("#nvCliente option:checked")).toHaveText("Mall E2E Plaza");
    await expect(panel.locator("#nvSuc option:checked")).toHaveText("Cliente E2E, Tienda E2E Plaza");
    await panel.locator("#nvByMall").uncheck();
    await expect(panel.locator("#nvClienteLbl")).toHaveText("Cliente");
    await expect(panel.locator("#nvSuc option:checked")).toHaveText("Cliente E2E, Tienda E2E Centro");
  });

  await test.step("«Con margen»: la fecha límite parte igual y no puede quedar antes", async () => {
    await panel.locator("#nvMargen").check();
    await expect(panel.locator("#nvHastaWrap")).toBeVisible();
    await expect(panel.locator("#nvHasta")).toHaveText(await panel.locator("#nvFecha").innerText());
    // La programada pasa a mañana; la límite sigue en hoy.
    await elegirDia(page, "#nvFecha", sumarDias(hoyISO(), 1));
    await enviar.click();
    await expect(msg(page, "nvFechaMsg")).toHaveText("La fecha límite debe ser igual o posterior a la programada.");
    // El selector de fechas es un botón: el error va con data-invalido y aria-describedby.
    await expect(panel.locator("#nvFecha")).toHaveAttribute("data-invalido", "true");
    await expect(panel.locator("#nvFecha")).toHaveAttribute("aria-describedby", "nvFechaMsg");
    await elegirDia(page, "#nvHasta", sumarDias(hoyISO(), 2), "Fecha límite");
    await expect(msg(page, "nvFechaMsg")).toBeHidden();
    await panel.locator("#nvMargen").uncheck();
  });

  await test.step("una instalación pide la hora", async () => {
    await panel.locator(".mot-opt", { hasText: "Instalación de antenas" }).click();
    await expect(panel.locator("#nvHoraLbl")).toHaveText("Hora de llegada");
    await enviar.click();
    await expect(msg(page, "nvHoraMsg")).toHaveText("En instalaciones la hora de llegada es obligatoria.");
    await expect(panel.locator("#nvHora")).toHaveAttribute("aria-invalid", "true");
    await panel.locator("#nvHora").fill("10:30");
    await expect(msg(page, "nvHoraMsg")).toBeHidden();
    await panel.locator(".mot-opt", { hasText: "Instalación de antenas" }).click();
    await expect(panel.locator("#nvHoraLbl")).toHaveText("Hora de llegada (opcional)");
  });

  await test.step("el ayudante tiene que ser otro técnico", async () => {
    await panel.locator("#nvAyu").selectOption({ label: "Tecnica Ficticia" });
    await enviar.click();
    await expect(msg(page, "nvAyuMsg")).toHaveText("El ayudante debe ser otro técnico.");
    await panel.locator("#nvAyu").selectOption({ label: "Sin ayudante, va solo" });
    await expect(msg(page, "nvAyuMsg")).toBeHidden();
  });

  await test.step("RUT y teléfono malos: la fila de contacto se abre sola", async () => {
    await panel.locator("#nvContacto summary").click();
    await panel.locator("#nvRut").fill("12.345.678-0");
    await panel.locator("#nvTel").fill("123");
    await panel.locator("#nvContacto summary").click();
    await expect(panel.locator("#nvContacto")).not.toHaveAttribute("open", "");
    await enviar.click();
    await expect(panel.locator("#nvContacto")).toHaveAttribute("open", "");
    await expect(msg(page, "nvRutMsg")).toHaveText("El RUT no es válido. Revisa el dígito verificador.");
    await expect(msg(page, "nvTelMsg")).toHaveText("Escribe los 9 dígitos que van después de +56 (ej.: 9 1234 5678 o 2 2345 6789).");
    await expect(panel.locator("#nvRut")).toHaveAttribute("aria-invalid", "true");
    await expect(panel.locator("#nvTel")).toHaveAttribute("aria-invalid", "true");
    // «Qué hay que hacer» vacío: el servidor lo exige, así que se avisa acá.
    await expect(msg(page, "nvNecesitaMsg")).toHaveText("Escribe qué hay que hacer.");
  });

  await test.step("elegir a alguien que ya firmó llena sus datos y el resumen", async () => {
    await expect(panel.locator("#nvPersona option:checked")).toHaveText("Escribir otra persona");
    await panel.locator("#nvPersona").selectOption({ label: "Marta Firmante, Jefe de tienda" });
    await expect(panel.locator("#nvResp")).toHaveValue("Marta Firmante");
    await expect(panel.locator("#nvRut")).toHaveValue("12.345.678-5");
    await expect(panel.locator("#nvTel")).toHaveValue("9 8765 4321");
    await expect(panel.locator("#nvCargo option:checked")).toHaveText("Jefe de tienda");
    await expect(panel.locator("#nvContactoSum")).toHaveText("Marta Firmante");
    await expect(msg(page, "nvRutMsg")).toBeHidden();
  });

  await test.step("13 archivos: quedan 12 con su aviso, y se puede quitar uno", async () => {
    const foto = png();
    await panel.locator("#nvFiles").setInputFiles(
      Array.from({ length: 13 }, (_, i) => ({ name: `foto-${String(i + 1).padStart(2, "0")}.png`, mimeType: "image/png", buffer: foto }))
    );
    await expect(page.getByRole("status")).toContainText("Solo caben 12 archivos. Se agregaron 12.");
    await expect(panel.locator("#nvFileList li")).toHaveCount(12);
    await panel.getByRole("button", { name: "Quitar foto-01.png" }).click();
    await expect(panel.locator("#nvFileList li")).toHaveCount(11);
  });

  let folio = "";
  await test.step("guarda: cierra, avisa y resalta la fila", async () => {
    await panel.locator("#nvNecesita").fill("Calibrar las antenas del acceso principal.");
    // Guardar espera a que termine la revisión de problemas de la sucursal y la preparación de los archivos.
    const fecha = sumarDias(hoyISO(), 1).split("-").reverse().join("/");
    await expect(async () => {
      await enviar.click({ timeout: 2_000 });
      await expect(page.getByRole("status")).toContainText(
        new RegExp(`Visita V-\\d{4}-\\d{5} programada para Tecnica Ficticia el ${fecha}\\.`),
        { timeout: 3_500 }
      );
    }).toPass({ timeout: 40_000 });
    folio = ((await page.getByRole("status").textContent()) ?? "").match(/V-\d{4}-\d{5}/)![0];
    creadas.push(folio);
    await expect(panel).toHaveCount(0);
    await expect(page.locator("tr.new-row")).toContainText(folio);
  });

  await test.step("queda en «Mis cambios» de la campanita", async () => {
    await page.getByRole("button", { name: /^Notificaciones/ }).locator("visible=true").first().click();
    const hoja = page.getByRole("dialog", { name: "Notificaciones" });
    await hoja.getByRole("tab", { name: /Mis cambios/ }).click();
    await expect(hoja).toContainText(folio);
    await page.keyboard.press("Escape");
    await expect(hoja).toHaveCount(0);
  });

  await test.step("Esc cierra el panel y el foco vuelve a «Nueva visita»", async () => {
    await abrir.click();
    await expect(panel).toBeVisible();
    // Al abrir de nuevo todo vuelve a partir de cero.
    await expect(panel.locator("#nvContacto")).not.toHaveAttribute("open", "");
    await expect(panel.locator("#nvFileList li")).toHaveCount(0);
    await expect(panel.locator(".msg:not([hidden])")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(abrir).toBeFocused();
  });

  expect(avisos).toEqual([]);
});

test("Nueva visita: clic fuera cierra y no hay desborde de 320 a 1920 px", async ({ page }) => {
  const avisos = vigilarConsola(page);
  await entrarComo(page, "admin");
  await page.goto("/admin/visitas");
  const abrir = page.getByRole("button", { name: "Nueva visita" }).first();
  for (const ancho of [320, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width: ancho, height: 900 });
    await abrir.click();
    const panel = page.getByRole("dialog", { name: "Nueva visita" });
    await expect(panel).toBeVisible();
    await panel.locator("#nvContacto summary").click();
    // Con margen, las dos fechas caben en su columna sin pisar la hora.
    await panel.locator("#nvMargen").check();
    const columna = (await panel.locator(".fr:has(#nvFecha)").boundingBox())!;
    const hasta = (await panel.locator("#nvHasta").boundingBox())!;
    expect(hasta.x + hasta.width, `fecha límite a ${ancho} px`).toBeLessThanOrEqual(columna.x + columna.width + 0.5);
    // Nada se sale del panel ni de la página.
    const fuera = await panel.evaluate((hoja) => {
      const caja = hoja.getBoundingClientRect();
      return [...hoja.querySelectorAll<HTMLElement>("*")]
        .filter((el) => el.getBoundingClientRect().width > 0)
        .filter((el) => el.getBoundingClientRect().right > caja.right + 0.5 || el.getBoundingClientRect().left < caja.left - 0.5)
        .map((el) => {
          const r = el.getBoundingClientRect();
          const camino: string[] = [];
          for (let x: Element | null = el; x && x !== hoja; x = x.parentElement) camino.push(x.tagName.toLowerCase() + (x.id ? "#" + x.id : "") + (typeof x.className === "string" && x.className ? "." + x.className.split(" ")[0] : ""));
          return `${camino.reverse().join(" > ")} [${Math.round(r.left)}–${Math.round(r.right)} en ${Math.round(caja.left)}–${Math.round(caja.right)}]`;
        });
    });
    expect(fuera, `a ${ancho} px`).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    // Hasta 580 px el panel ocupa todo el ancho: no hay «fuera» donde tocar.
    if (ancho > 580) await page.mouse.click(5, 450);
    else await panel.getByRole("button", { name: "Cancelar" }).click();
    await expect(panel).toHaveCount(0);
  }
  expect(avisos).toEqual([]);
});
