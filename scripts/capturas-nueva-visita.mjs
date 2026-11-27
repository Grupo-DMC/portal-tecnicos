// «Nueva visita»: la demo (panel-operacion.html) y React lado a lado, en cuatro estados
// —recién abierto, con «Contacto en tienda» abierto, con errores y con 3 archivos— a 1440 y 390 px.
// Uso: node scripts/capturas-nueva-visita.mjs [ruta-a-la-demo]
// React tiene que estar arriba en el puerto 3200 (scripts/demo-local.mjs).
// Guarda en docs/capturas/nueva-visita/<estado>-{demo,react}-<ancho>.png.
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { deflateSync } from "node:zlib";

const DEMO = process.argv[2] ?? "C:/Users/EQUIPO/Downloads/panel-operacion.html";
const SALIDA = resolve("docs/capturas/nueva-visita");
mkdirSync(SALIDA, { recursive: true });

// Tres PNG chicos de verdad, para que React los pueda recomprimir.
function png(color) {
  const crc = (b) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1; } return ~c >>> 0; };
  const trozo = (tipo, datos) => { const t = Buffer.from(tipo); const l = Buffer.alloc(4); l.writeUInt32BE(datos.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([t, datos]))); return Buffer.concat([l, t, datos, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(8, 0); ihdr.writeUInt32BE(8, 4); ihdr[8] = 8; ihdr[9] = 2;
  const filas = Buffer.concat(Array.from({ length: 8 }, () => Buffer.concat([Buffer.from([0]), ...Array.from({ length: 8 }, () => Buffer.from(color))])));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), trozo("IHDR", ihdr), trozo("IDAT", deflateSync(filas)), trozo("IEND", Buffer.alloc(0))]);
}
const FOTOS = ["portico-acceso.png", "antena-izquierda.png", "tablero.png"].map((n, i) => {
  const ruta = resolve("test-results", n);
  mkdirSync(resolve("test-results"), { recursive: true });
  writeFileSync(ruta, png([[124, 45, 146], [40, 160, 90], [200, 120, 30]][i]));
  return ruta;
});

const ALTO = { 1440: 1500, 390: 2300 };

async function demo(p) {
  await p.goto("about:blank");
  await p.goto(pathToFileURL(DEMO).href + "#visitas");
  await p.waitForTimeout(400);
  await p.click("#vNewBtn");
  await p.waitForTimeout(400);
}
async function react(p) {
  await p.goto("http://localhost:3200/admin/visitas");
  await p.getByRole("button", { name: "Nueva visita" }).first().click();
  await p.locator("#mNew").waitFor();
  await p.waitForTimeout(500);
}

/** Lo mismo en las dos: sin motivo, ayudante = técnico, RUT y teléfono malos, y enviar. */
async function conErrores(p, esDemo) {
  await p.locator("#nvMot .mot-opt:has(input:checked)").first().click();
  const tec = await p.locator("#nvTec").inputValue();
  await p.locator("#nvAyu").selectOption(tec);
  await p.locator("#nvContacto summary").click();
  await p.locator("#nvRut").fill("12.345.678-0");
  await p.locator("#nvTel").fill("123");
  await p.locator("#nvContacto summary").click(); // se cierra: el envío la abre sola
  await p.locator("#nvForm button[type=submit]").click();
  await p.waitForTimeout(400);
  // Para la foto, desde arriba del panel.
  await p.locator(esDemo ? "#mNew .m-body" : "#mNew .m-body").evaluate((b) => b.scrollTo(0, 0));
}

const ESTADOS = {
  abierto: async () => {},
  contacto: async (p) => { await p.locator("#nvContacto summary").click(); await p.waitForTimeout(200); },
  margen: async (p) => { await p.locator("#nvMargen").check(); await p.waitForTimeout(200); },
  errores: conErrores,
  archivos: async (p) => { await p.locator("#nvFiles").setInputFiles(FOTOS); await p.waitForTimeout(800); },
};

const navegador = await chromium.launch();
for (const ancho of [1440, 390]) {
  const ctxDemo = await navegador.newContext({ viewport: { width: ancho, height: ALTO[ancho] }, locale: "es-CL" });
  const ctxReact = await navegador.newContext({ viewport: { width: ancho, height: ALTO[ancho] }, locale: "es-CL", timezoneId: "America/Santiago" });
  const pr = await ctxReact.newPage();
  await pr.goto("http://localhost:3200/login");
  await pr.getByLabel("Correo").fill("doble.e2e@example.com");
  await pr.getByLabel("Contraseña", { exact: true }).fill("E2e-Clave-Segura-123");
  await pr.getByRole("button", { name: /Iniciar sesión/ }).click();
  await pr.waitForURL(/\/admin/);
  const pd = await ctxDemo.newPage();
  for (const [nombre, hacer] of Object.entries(ESTADOS)) {
    await demo(pd);
    await hacer(pd, true);
    await pd.screenshot({ path: `${SALIDA}/${nombre}-demo-${ancho}.png` });
    await react(pr);
    await hacer(pr, false);
    await pr.screenshot({ path: `${SALIDA}/${nombre}-react-${ancho}.png` });
  }
  await ctxDemo.close();
  await ctxReact.close();
}
await navegador.close();
console.log("Capturas en", SALIDA);
