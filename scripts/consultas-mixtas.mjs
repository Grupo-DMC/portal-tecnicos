// Lista las consultas del código que tocan objetos de MÁS DE UN esquema.
//
//   node scripts/consultas-mixtas.mjs            (o: npm run consultas-mixtas)
//   node scripts/consultas-mixtas.mjs --todas    incluye también las de un solo esquema distinto de `tecnico`
//
// Recorre lib/, app/ y components/ y mira cada plantilla de texto que usa `T.<objeto>`
// (lib/db/esquema.ts). El grupo de cada objeto sale de grupoDe(), así que el
// resultado sigue a GRUPO_CLIENTES y GRUPO_SEGURIDAD. Una consulta mixta cruza
// esquemas en un mismo JOIN / subconsulta: necesita que el login de la app
// tenga permisos en todos, y es la que más duele si los esquemas pasan a tener
// logins distintos.
//
// Límite: mira una plantilla por vez. Una sentencia armada con varias
// plantillas pegadas (`${base} JOIN …`) se ve por partes.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { OBJETOS, grupoDe } from "../lib/db/esquema.ts";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const todas = process.argv.includes("--todas");
const conocidos = new Set(OBJETOS);

function* fuentes(dir) {
  for (const nombre of readdirSync(dir)) {
    if (nombre === "node_modules" || nombre === ".next") continue;
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) yield* fuentes(ruta);
    else if (/\.(ts|tsx)$/.test(nombre) && !nombre.endsWith(".d.ts")) yield ruta;
  }
}

const hallazgos = [];
let plantillas = 0;
for (const carpeta of ["lib", "app", "components"]) {
  for (const ruta of fuentes(join(RAIZ, carpeta))) {
    const texto = readFileSync(ruta, "utf8");
    if (!texto.includes("T.") && !texto.includes("T[")) continue;
    const sf = ts.createSourceFile(ruta, texto, ts.ScriptTarget.Latest, true, ruta.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const visita = (n) => {
      if (ts.isTemplateExpression(n)) {
        const objetos = new Set();
        let dinamica = false;
        for (const span of n.templateSpans) {
          const e = span.expression;
          if (ts.isPropertyAccessExpression(e) && ts.isIdentifier(e.expression) && e.expression.text === "T" && conocidos.has(e.name.text)) objetos.add(e.name.text);
          else if (ts.isElementAccessExpression(e) && ts.isIdentifier(e.expression) && e.expression.text === "T") dinamica = true;
        }
        if (objetos.size || dinamica) {
          plantillas++;
          const grupos = new Set([...objetos].map(grupoDe));
          if (grupos.size > 1 || (todas && [...grupos].some((g) => g !== "tecnico")) || dinamica) {
            hallazgos.push({
              donde: `${relative(RAIZ, ruta).replaceAll("\\", "/")}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`,
              grupos: [...grupos].sort(),
              objetos: [...objetos].sort(),
              dinamica,
              mixta: grupos.size > 1,
            });
          }
        }
      }
      ts.forEachChild(n, visita);
    };
    visita(sf);
  }
}

const mixtas = hallazgos.filter((h) => h.mixta);
console.log(`Plantillas con objetos del esquema: ${plantillas}`);
console.log(`Mezclan esquemas: ${mixtas.length}\n`);
for (const h of mixtas) {
  console.log(`${h.donde}`);
  console.log(`    esquemas: ${h.grupos.join(" + ")}`);
  console.log(`    objetos : ${h.objetos.map((o) => `${grupoDe(o)}.${o}`).join(", ")}${h.dinamica ? "  (+ tabla dinámica T[...])" : ""}`);
}
const dinamicas = hallazgos.filter((h) => h.dinamica && !h.mixta);
if (dinamicas.length) {
  console.log(`\nConsultas con tabla elegida en tiempo de ejecución (T[...]): revisar a qué esquema apuntan sus opciones`);
  for (const h of dinamicas) console.log(`  ${h.donde}  ${h.objetos.join(", ")}`);
}
if (todas) {
  console.log("\nSolo fuera de `tecnico` (un único esquema):");
  for (const h of hallazgos.filter((x) => !x.mixta && !x.dinamica)) console.log(`  ${h.donde}  ${h.grupos[0]}: ${h.objetos.join(", ")}`);
}
