// Capturas de la demo panel-operacion.html (fuente de verdad del rediseño) a 1440 y 390 px.
// Uso: node scripts/capturas-demo.mjs [ruta-a-la-demo] [seccion...]
// Guarda en docs/capturas/<seccion>-demo-<ancho>.png. Ver docs/auditoria-demo.md.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const DEMO = process.argv[2] ?? "C:/Users/EQUIPO/Downloads/panel-operacion.html";
const SOLO = process.argv.slice(3);
const SALIDA = resolve("docs/capturas");
mkdirSync(SALIDA, { recursive: true });
const URL_DEMO = pathToFileURL(DEMO).href;

const ir = async (p, hash) => {
  await p.evaluate((h) => { location.hash = h; }, hash);
  await p.waitForTimeout(350);
};
const primerHref = (p, sel) => p.$eval(sel, (a) => a.getAttribute("href"));

/** Cada sección: cómo llegar al estado que se captura. */
const SECCIONES = {
  panel: (p) => ir(p, "panel"),
  visitas: (p) => ir(p, "visitas"),
  // V-2026-01080 es la que trae el acta completa en la demo.
  "detalle-visita": (p) => ir(p, "visita-v-2026-01080"),
  "nueva-visita": async (p) => { await ir(p, "visitas"); await p.click("#vNewBtn"); await p.waitForTimeout(400); },
  "visitas-masivas": async (p) => { await ir(p, "visitas"); await p.click("#vMassBtn"); await p.waitForTimeout(400); },
  problemas: (p) => ir(p, "problemas"),
  clientes: (p) => ir(p, "clientes"),
  "detalle-cliente": async (p) => { await ir(p, "clientes"); await ir(p, (await primerHref(p, 'a[href^="#cliente-"]')).slice(1)); },
  sucursales: (p) => ir(p, "sucursales"),
  "detalle-sucursal": async (p) => { await ir(p, "sucursales"); await ir(p, (await primerHref(p, 'a[href^="#sucursal-"]')).slice(1)); },
  malls: (p) => ir(p, "malls"),
  "detalle-mall": async (p) => { await ir(p, "malls"); await ir(p, (await primerHref(p, 'a[href^="#mall-"]')).slice(1)); },
  campanita: async (p) => {
    await ir(p, "panel");
    await p.locator("button[aria-label^='Notificaciones']:visible").first().click();
    await p.waitForTimeout(400);
  },
  "mi-cuenta": (p) => ir(p, "mi-cuenta"),
  usuarios: (p) => ir(p, "usuarios"),
  checklist: (p) => ir(p, "checklist"),
  "panel-tecnico": (p) => ir(p, "panel-tecnico"),
  // V-2026-01086 es la que el técnico de la demo tiene en curso.
  "formulario-acta": (p) => ir(p, "tec-f-v-2026-01086"),

};

const navegador = await chromium.launch();
for (const ancho of [1440, 390]) {
  const ctx = await navegador.newContext({ viewport: { width: ancho, height: ancho < 900 ? 844 : 900 }, locale: "es-CL", timezoneId: "America/Santiago", reducedMotion: "reduce" });
  const p = await ctx.newPage();
  await p.goto(URL_DEMO);
  await p.waitForTimeout(500);
  for (const [nombre, llegar] of Object.entries(SECCIONES)) {
    if (SOLO.length && !SOLO.includes(nombre)) continue;
    try {
      await p.keyboard.press("Escape");
      await llegar(p, ancho);
      await p.screenshot({ path: `${SALIDA}/${nombre}-demo-${ancho}.png`, fullPage: true });
      console.log("ok", nombre, ancho);
    } catch (e) {
      console.log("FALLA", nombre, ancho, e.message.split("\n")[0]);
    }
  }
  await ctx.close();
}
await navegador.close();

// El menú y el layout a varios anchos de ventana y zoom del navegador (MENU=1).
if (process.env.MENU === "1") {
  const nav = await chromium.launch();
  mkdirSync(`${SALIDA}/menu`, { recursive: true });
  for (const v of [1200, 1280, 1366, 1440, 1920]) for (const z of [1, 1.1, 1.25]) {
    const ctx = await nav.newContext({ viewport: { width: Math.round(v / z), height: Math.round(860 / z) }, deviceScaleFactor: z, reducedMotion: "reduce" });
    const p = await ctx.newPage();
    await p.goto(URL_DEMO + "#visitas");
    await p.waitForTimeout(500);
    await p.screenshot({ path: `${SALIDA}/menu/menu-${v}-z${Math.round(z * 100)}-demo.png` });
    await ctx.close();
  }
  await nav.close();
}
