// Junta las capturas de docs/capturas/nueva-visita en una imagen demo | React por estado y ancho,
// recortadas al panel (los 580 px de la derecha en escritorio, todo el ancho en el celular).
// Uso: node scripts/lado-a-lado.mjs
import { chromium } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const DIR = resolve("docs/capturas/nueva-visita");
const estados = [...new Set(readdirSync(DIR).filter((f) => /-demo-\d+\.png$/.test(f)).map((f) => f.replace(/-demo-(\d+)\.png$/, "|$1")))];
const navegador = await chromium.launch();
const p = await navegador.newPage();
for (const e of estados) {
  const [estado, ancho] = e.split("|");
  const w = Number(ancho) > 600 ? 580 : Number(ancho);
  const img = (lado) => `data:image/png;base64,${readFileSync(`${DIR}/${estado}-${lado}-${ancho}.png`).toString("base64")}`;
  await p.setContent(`<body style="margin:0;display:flex;gap:16px;background:#222;font:14px sans-serif;color:#fff">
    ${["demo", "react"].map((l) => `<figure style="margin:0"><figcaption style="padding:6px">${l} · ${estado} · ${ancho}px</figcaption>
      <div style="width:${w}px;overflow:hidden"><img src="${img(l)}" style="display:block;margin-left:-${Number(ancho) - w}px"></div></figure>`).join("")}
  </body>`);
  await p.waitForTimeout(100);
  await p.screenshot({ path: `${DIR}/lado-${estado}-${ancho}.png`, fullPage: true });
}
await navegador.close();
console.log("Listo:", estados.length);
