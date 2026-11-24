// Compara el esquema REAL de una base con el que describe el repo.
//
//   node scripts/comparar-esquema.mjs [--env .env.development]
//
// Lado "repo": crea una base desechable en el SQL Server LOCAL de los tests
// (.env.test), le aplica sql/dmc_contingencia_sqlserver.sql adaptado al esquema
// de la base real, extrae su catálogo y la borra.
// Lado "base real": se conecta con DB_SERVER/DB_NAME/DB_USER/DB_PASSWORD del
// archivo de entorno (solo lee el catálogo del sistema y schema_version; no
// escribe nada).
//
// Informa, por objeto: lo que hay solo en el repo, lo que hay solo en la base y
// lo que difiere (columnas, índices, claves foráneas, checks, triggers, vistas,
// secuencias). Y qué migraciones de sql/ faltan en schema_version o al revés.
//
// Nunca imprime contraseñas.

import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sql from "mssql";
import { adaptarEsquema, dividirLotes } from "./adaptar-esquema.mjs";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function leerEnv(texto) {
  const salida = {};
  for (const linea of texto.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(linea);
    if (!m || linea.trim().startsWith("#")) continue;
    let valor = m[2];
    if (/^'.*'$/.test(valor) || /^".*"$/.test(valor)) valor = valor.slice(1, -1);
    salida[m[1]] = valor;
  }
  return salida;
}
const cargar = (ruta) => (existsSync(ruta) ? leerEnv(readFileSync(ruta, "utf8")) : {});

const args = process.argv.slice(2);
const i = args.indexOf("--env");
const archivoEnv = resolve(i >= 0 ? args[i + 1] : ".env.development");
const real = cargar(archivoEnv);
const test = { ...cargar(resolve(RAIZ, ".env.test")), ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith("TEST_DB_"))) };

for (const n of ["DB_SERVER", "DB_NAME", "DB_USER", "DB_PASSWORD"]) if (!real[n]) throw new Error(`Falta ${n} en ${archivoEnv}.`);
for (const n of ["TEST_DB_SERVER", "TEST_DB_USER", "TEST_DB_PASSWORD"]) if (!test[n]) throw new Error(`Falta ${n} (.env.test): hace falta un SQL Server local para armar la referencia.`);
if (!["localhost", "127.0.0.1"].includes(test.TEST_DB_SERVER.toLowerCase())) throw new Error("TEST_DB_SERVER debe ser localhost.");

const esquema = real.DB_SCHEMA || "dmc";
const opciones = (c) => ({ encrypt: true, trustServerCertificate: true, ...c });
const confReal = {
  server: real.DB_SERVER,
  port: Number(real.DB_PORT ?? 1433),
  database: real.DB_NAME,
  user: real.DB_USER,
  password: real.DB_PASSWORD,
  options: opciones({ trustServerCertificate: (real.DB_TRUST_SERVER_CERT ?? "true") !== "false" }),
  connectionTimeout: 15000,
  requestTimeout: 120000,
};
const confLocal = (database) => ({
  server: test.TEST_DB_SERVER,
  port: Number(test.TEST_DB_PORT ?? 1433),
  database,
  user: test.TEST_DB_USER,
  password: test.TEST_DB_PASSWORD,
  options: opciones(),
  requestTimeout: 120000,
});

// --- Catálogo -------------------------------------------------------------

const norm = (texto) =>
  (texto ?? "")
    .replace(new RegExp(`\\[?${esquema}\\]?\\.`, "gi"), "<S>.")
    .replace(/\s+/g, " ")
    .replace(/\s*([(),=<>+\-*/])\s*/g, "$1")
    .trim()
    .toLowerCase();

async function catalogo(pool) {
  const q = async (texto) => (await pool.request().input("s", sql.NVarChar, esquema).query(texto)).recordset;
  const c = {};
  c.tablas = new Map((await q(`SELECT t.name FROM sys.tables t WHERE SCHEMA_NAME(t.schema_id) = @s`)).map((r) => [r.name, "tabla"]));
  c.columnas = new Map(
    (
      await q(`SELECT t.name AS t, c.name AS c, ty.name AS tipo, c.max_length, c.precision, c.scale, c.is_nullable, c.is_identity, c.is_computed, cc.definition AS calculada
                 FROM sys.columns c JOIN sys.tables t ON t.object_id = c.object_id JOIN sys.types ty ON ty.user_type_id = c.user_type_id
                 LEFT JOIN sys.computed_columns cc ON cc.object_id = c.object_id AND cc.column_id = c.column_id
                WHERE SCHEMA_NAME(t.schema_id) = @s`)
    ).map((r) => [`${r.t}.${r.c}`, `${r.tipo}(${r.max_length},${r.precision},${r.scale}) ${r.is_nullable ? "NULL" : "NOT NULL"}${r.is_identity ? " IDENTITY" : ""}${r.is_computed ? ` =${norm(r.calculada)}` : ""}`])
  );
  c.defaults = new Map(
    (
      await q(`SELECT t.name AS t, c.name AS c, d.definition FROM sys.default_constraints d JOIN sys.tables t ON t.object_id = d.parent_object_id
                 JOIN sys.columns c ON c.object_id = d.parent_object_id AND c.column_id = d.parent_column_id WHERE SCHEMA_NAME(t.schema_id) = @s`)
    ).map((r) => [`${r.t}.${r.c}`, norm(r.definition)])
  );
  c.indices = new Map(
    (
      await q(`SELECT t.name AS t, i.name AS i, i.is_unique, i.is_primary_key, i.type_desc, i.filter_definition,
                      STRING_AGG(CONCAT(c.name, CASE WHEN ic.is_descending_key = 1 THEN ' DESC' ELSE '' END, CASE WHEN ic.is_included_column = 1 THEN ' INCL' ELSE '' END), ',')
                        WITHIN GROUP (ORDER BY ic.is_included_column, ic.key_ordinal, c.name) AS cols
                 FROM sys.indexes i JOIN sys.tables t ON t.object_id = i.object_id
                 JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
                WHERE SCHEMA_NAME(t.schema_id) = @s AND i.name IS NOT NULL GROUP BY t.name, i.name, i.is_unique, i.is_primary_key, i.type_desc, i.filter_definition`)
    ).map((r) => [`${r.t}.${r.i}`, `${r.type_desc}${r.is_primary_key ? " PK" : ""}${r.is_unique ? " UNIQUE" : ""} (${r.cols})${r.filter_definition ? ` WHERE ${norm(r.filter_definition)}` : ""}`])
  );
  c.fks = new Map(
    (
      await q(`SELECT t.name AS t, f.name AS f, rt.name AS rt, f.delete_referential_action_desc AS d, f.update_referential_action_desc AS u, f.is_disabled,
                      STRING_AGG(c.name, ',') WITHIN GROUP (ORDER BY fc.constraint_column_id) AS cols, STRING_AGG(rc.name, ',') WITHIN GROUP (ORDER BY fc.constraint_column_id) AS rcols
                 FROM sys.foreign_keys f JOIN sys.tables t ON t.object_id = f.parent_object_id JOIN sys.tables rt ON rt.object_id = f.referenced_object_id
                 JOIN sys.foreign_key_columns fc ON fc.constraint_object_id = f.object_id
                 JOIN sys.columns c ON c.object_id = fc.parent_object_id AND c.column_id = fc.parent_column_id
                 JOIN sys.columns rc ON rc.object_id = fc.referenced_object_id AND rc.column_id = fc.referenced_column_id
                WHERE SCHEMA_NAME(t.schema_id) = @s GROUP BY t.name, f.name, rt.name, f.delete_referential_action_desc, f.update_referential_action_desc, f.is_disabled`)
    ).map((r) => [`${r.t}.${r.f}`, `(${r.cols}) -> ${r.rt}(${r.rcols}) del=${r.d} upd=${r.u}${r.is_disabled ? " DESHABILITADA" : ""}`])
  );
  c.checks = new Map(
    (
      await q(`SELECT t.name AS t, k.name AS k, k.definition, k.is_disabled FROM sys.check_constraints k JOIN sys.tables t ON t.object_id = k.parent_object_id WHERE SCHEMA_NAME(t.schema_id) = @s`)
    ).map((r) => [`${r.t}.${r.k}`, `${norm(r.definition)}${r.is_disabled ? " DESHABILITADO" : ""}`])
  );
  c.triggers = new Map(
    (
      await q(`SELECT tr.name, OBJECT_NAME(tr.parent_id) AS tabla, tr.is_disabled, m.definition,
                      (SELECT STRING_AGG(e.type_desc, ',') WITHIN GROUP (ORDER BY e.type_desc) FROM sys.trigger_events e WHERE e.object_id = tr.object_id) AS eventos
                 FROM sys.triggers tr JOIN sys.sql_modules m ON m.object_id = tr.object_id WHERE SCHEMA_NAME(OBJECTPROPERTY(tr.object_id, 'SchemaId')) = @s`)
    ).map((r) => [r.name, `${r.tabla} [${r.eventos}]${r.is_disabled ? " DESHABILITADO" : ""} ${norm(r.definition)}`])
  );
  c.vistas = new Map(
    (await q(`SELECT v.name, m.definition FROM sys.views v JOIN sys.sql_modules m ON m.object_id = v.object_id WHERE SCHEMA_NAME(v.schema_id) = @s`)).map((r) => [r.name, norm(r.definition)])
  );
  c.secuencias = new Map(
    (
      await q(`SELECT s.name, ty.name AS tipo, CAST(s.start_value AS nvarchar(40)) AS ini, CAST(s.increment AS nvarchar(40)) AS inc, CAST(s.minimum_value AS nvarchar(40)) AS mn, CAST(s.maximum_value AS nvarchar(40)) AS mx, s.is_cycling
                 FROM sys.sequences s JOIN sys.types ty ON ty.user_type_id = s.user_type_id WHERE SCHEMA_NAME(s.schema_id) = @s`)
    ).map((r) => [r.name, `${r.tipo} inicio=${r.ini} paso=${r.inc} min=${r.mn} max=${r.mx} ciclo=${r.is_cycling}`])
  );
  return c;
}

// --- Ejecución ------------------------------------------------------------

const nombreLocal = `dmc_test_cmp${randomBytes(4).toString("hex")}`;
const admin = await new sql.ConnectionPool(confLocal("master")).connect();
let referencia;
try {
  await admin.request().batch(`CREATE DATABASE [${nombreLocal}]`);
  const p = await new sql.ConnectionPool(confLocal(nombreLocal)).connect();
  try {
    const ddl = adaptarEsquema(readFileSync(resolve(RAIZ, "sql/dmc_contingencia_sqlserver.sql"), "utf8"), esquema);
    for (const lote of dividirLotes(ddl)) await p.request().batch(lote);
    referencia = await catalogo(p);
  } finally {
    await p.close();
  }
} finally {
  await admin.request().batch(`ALTER DATABASE [${nombreLocal}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [${nombreLocal}];`).catch(() => {});
  await admin.close();
}

const pr = await new sql.ConnectionPool(confReal).connect();
let actual, versiones;
try {
  actual = await catalogo(pr);
  versiones = (await pr.request().query(`SELECT version, descripcion FROM ${esquema}.schema_version ORDER BY version`)).recordset;
} finally {
  await pr.close();
}

console.log(`Base real : ${confReal.server}:${confReal.port}/${confReal.database}  esquema ${esquema}  (login ${confReal.user})`);
console.log(`Referencia: sql/dmc_contingencia_sqlserver.sql adaptado a ${esquema}\n`);

let diferencias = 0;
for (const clave of Object.keys(referencia)) {
  const a = referencia[clave], b = actual[clave];
  const soloRepo = [...a.keys()].filter((k) => !b.has(k));
  const soloBd = [...b.keys()].filter((k) => !a.has(k));
  const distintos = [...a.keys()].filter((k) => b.has(k) && a.get(k) !== b.get(k));
  console.log(`== ${clave}: repo ${a.size} · base ${b.size}`);
  const lista = (titulo, items) => {
    if (!items.length) return;
    diferencias += items.length;
    console.log(`  ${titulo} (${items.length}):`);
    for (const x of items) console.log(`    - ${x}`);
  };
  lista("solo en el repo (falta en la base)", soloRepo);
  lista("solo en la base (no está en el repo)", soloBd);
  lista("distintos", distintos.map((k) => `${k}\n        repo: ${String(a.get(k)).slice(0, 160)}\n        base: ${String(b.get(k)).slice(0, 160)}`));
}

const registradas = new Set(versiones.map((r) => Number(r.version)));
const enRepo = readdirSync(resolve(RAIZ, "sql"))
  .map((n) => /^migracion-(\d+)-/.exec(n)?.[1] && !n.includes("revertir") ? Number(/^migracion-(\d+)-/.exec(n)[1]) : null)
  // schema_version existe desde la 025: las anteriores no se registran.
  .filter((n) => n !== null && n >= 25);
console.log(`\n== schema_version: base ${registradas.size} filas (${Math.min(...registradas)}…${Math.max(...registradas)})`);
const sinRegistro = enRepo.filter((n) => !registradas.has(n));
const sinArchivo = [...registradas].filter((n) => !enRepo.includes(n));
console.log(`  migraciones del repo sin registro en la base: ${sinRegistro.length ? sinRegistro.join(", ") : "ninguna"}`);
console.log(`  versiones de la base sin archivo de migración: ${sinArchivo.length ? sinArchivo.join(", ") : "ninguna"}`);

console.log(`\n${diferencias === 0 ? "✓ El catálogo de la base coincide con el repo." : `✗ ${diferencias} diferencia(s) de catálogo.`}`);
