// Corredor de migraciones: aplica sql/migracion-NNN-*.sql que la base aún no tenga.
//
//   node scripts/migrar.mjs                      muestra qué hay aplicado y qué falta (no cambia nada)
//   node scripts/migrar.mjs --aplicar            aplica las pendientes, en orden
//   node scripts/migrar.mjs --aplicar --hasta 46 se detiene en la 46
//   node scripts/migrar.mjs --env ruta/.env.x    lee las variables de ese archivo
//
// Usa SU PROPIO login, el de las migraciones, que sí puede hacer DDL. Nunca
// usa DB_USER / DB_PASSWORD: ese es el de la app y no tiene (ni debe tener)
// permisos de DDL.
//
//   DB_SERVER, DB_PORT, DB_NAME      destino (los mismos que la app)
//   DB_SCHEMA                        esquema donde está la base: OBLIGATORIA aquí,
//                                    para no migrar el esquema equivocado por omisión
//   DB_ENCRYPT, DB_TRUST_SERVER_CERT TLS (como la app)
//   DB_MIGRATIONS_USER               login con permisos de DDL (p. ej. dmc_migra_tecnicos)
//   DB_MIGRATIONS_PASSWORD           su contraseña
//
// Sin --env, lee `.env.migraciones` si existe (`.env*` está en .gitignore) y,
// si no, el entorno del proceso. Las variables ya definidas en el proceso
// ganan sobre las del archivo. Nunca imprime contraseñas.
//
// Las migraciones se escribieron para el esquema `dmc` y con `USE DMC_Contingencia`:
// aquí se adaptan al esquema y a la base destino (scripts/adaptar-esquema.mjs).
// Las nuevas deben escribir `$(ESQUEMA).tabla` y no llevar `USE`.
//
// Cada migración se registra sola en <esquema>.schema_version; el corredor lo
// comprueba y se detiene si no quedó el registro. No revierte nada: los
// archivos `*-revertir.sql` se corren a mano, deliberadamente.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sql from "mssql";
import { adaptarEsquema, dividirLotes } from "./adaptar-esquema.mjs";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function salir(mensaje) {
  console.error(`\n✗ ${mensaje}\n`);
  process.exit(1);
}

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

const args = process.argv.slice(2);
const aplicar = args.includes("--aplicar");
const opcion = (nombre) => {
  const i = args.indexOf(nombre);
  return i >= 0 ? args[i + 1] : undefined;
};
const hasta = opcion("--hasta") === undefined ? Infinity : Number(opcion("--hasta"));
if (!Number.isFinite(hasta) && opcion("--hasta") !== undefined) salir("--hasta necesita un número de migración.");

const archivoEnv = opcion("--env") ? resolve(opcion("--env")) : resolve(RAIZ, ".env.migraciones");
if (opcion("--env") && !existsSync(archivoEnv)) salir(`No existe el archivo de entorno ${archivoEnv}.`);
const delArchivo = existsSync(archivoEnv) ? leerEnv(readFileSync(archivoEnv, "utf8")) : {};
const v = (nombre) => (process.env[nombre] ?? delArchivo[nombre] ?? "").trim() || undefined;
const verdadero = (nombre, porDefecto) => {
  const x = v(nombre)?.toLowerCase();
  return x === undefined ? porDefecto : x === "true" || x === "1";
};

// --- Configuración -------------------------------------------------------

const falta = ["DB_SERVER", "DB_NAME", "DB_SCHEMA", "DB_MIGRATIONS_USER", "DB_MIGRATIONS_PASSWORD"].filter((n) => !v(n));
if (falta.length) {
  salir(
    `Faltan variables: ${falta.join(", ")}.\n  El corredor usa el login de las migraciones (DB_MIGRATIONS_USER / DB_MIGRATIONS_PASSWORD), ` +
      "nunca el de la app, y exige DB_SCHEMA explícito."
  );
}
if (v("DB_MIGRATIONS_USER") === v("DB_USER")) {
  salir("DB_MIGRATIONS_USER es el mismo login que DB_USER (el de la app). Deben ser cuentas distintas.");
}
if (!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(v("DB_SCHEMA"))) salir(`DB_SCHEMA="${v("DB_SCHEMA")}" no es un nombre de esquema válido.`);

const esquema = v("DB_SCHEMA");
const base = v("DB_NAME");
const config = {
  server: v("DB_SERVER"),
  port: Number(v("DB_PORT") ?? 1433),
  database: base,
  user: v("DB_MIGRATIONS_USER"),
  password: v("DB_MIGRATIONS_PASSWORD"),
  options: { encrypt: verdadero("DB_ENCRYPT", true), trustServerCertificate: verdadero("DB_TRUST_SERVER_CERT", false) },
  connectionTimeout: 15_000,
  requestTimeout: 300_000,
  // Una sola conexión: las migraciones llevan `USE` y SET, que valen por conexión.
  pool: { max: 1, min: 0 },
};

// --- Archivos ------------------------------------------------------------

const archivos = readdirSync(resolve(RAIZ, "sql"))
  .map((nombre) => ({ nombre, m: /^migracion-(\d+)-.*\.sql$/.exec(nombre) }))
  .filter((a) => a.m && !a.nombre.includes("revertir"))
  .map((a) => ({ numero: Number(a.m[1]), nombre: a.nombre }))
  .sort((a, b) => a.numero - b.numero);

const repetidas = archivos.filter((a, i) => archivos.findIndex((b) => b.numero === a.numero) !== i);
if (repetidas.length) salir(`Hay dos archivos para la misma migración: ${repetidas.map((a) => a.nombre).join(", ")}.`);

// --- Ejecución -----------------------------------------------------------

console.log(`Destino : ${config.server}:${config.port}/${base}  esquema ${esquema}`);
console.log(`Login   : ${config.user}  (migraciones)`);
console.log(`Modo    : ${aplicar ? "APLICAR" : "solo informar (sin --aplicar)"}\n`);

let pool;
try {
  pool = await new sql.ConnectionPool(config).connect();
} catch (err) {
  salir(`No se pudo conectar: ${err.message}`);
}

try {
  const existe = await pool.request().query(`SELECT OBJECT_ID('${esquema}.schema_version', 'U') AS id`);
  if (!existe.recordset[0].id) {
    salir(
      `No existe ${esquema}.schema_version en ${base}: no es una base con el esquema de la app (o el login no la ve). ` +
        "El corredor no crea el esquema desde cero; para una base nueva carga sql/dmc_contingencia_sqlserver.sql adaptado."
    );
  }
  const aplicadas = (await pool.request().query(`SELECT version, descripcion FROM ${esquema}.schema_version ORDER BY version`)).recordset;
  const registradas = new Set(aplicadas.map((r) => Number(r.version)));
  const maxima = aplicadas.length ? Math.max(...registradas) : 0;

  console.log(`Aplicadas en la base: ${registradas.size} (última: ${maxima || "ninguna"})`);
  const sinArchivo = [...registradas].filter((n) => !archivos.some((a) => a.numero === n) && n > 25);
  if (sinArchivo.length) console.log(`  · registradas sin archivo en sql/: ${sinArchivo.join(", ")}`);

  const pendientes = archivos.filter((a) => a.numero > maxima && a.numero <= hasta);
  const huecos = archivos.filter((a) => a.numero < maxima && a.numero > 25 && !registradas.has(a.numero));
  if (huecos.length) console.log(`  · con archivo pero sin registro, por debajo de la última: ${huecos.map((a) => a.numero).join(", ")} (no se aplican solas)`);

  if (!pendientes.length) {
    console.log("\n✓ No hay migraciones pendientes.");
  } else {
    console.log(`\nPendientes (${pendientes.length}): ${pendientes.map((a) => a.numero).join(", ")}`);
    if (!aplicar) console.log("\nNo se aplicó nada. Agrega --aplicar para correrlas.");
  }

  if (aplicar) {
    for (const mig of pendientes) {
      process.stdout.write(`\n→ ${mig.nombre} … `);
      const script = adaptarEsquema(readFileSync(resolve(RAIZ, "sql", mig.nombre), "utf8"), esquema, { base });
      const lotes = dividirLotes(script);
      let n = 0;
      for (const lote of lotes) {
        n++;
        try {
          await pool.request().batch(lote);
        } catch (err) {
          salir(`falló el lote ${n}/${lotes.length} de ${mig.nombre}: ${err.message}\n  Revisa la base antes de reintentar; las migraciones son idempotentes pero no se deshacen solas.`);
        }
      }
      const reg = await pool.request().query(`SELECT COUNT(*) AS n FROM ${esquema}.schema_version WHERE version = ${mig.numero}`);
      if (Number(reg.recordset[0].n) !== 1) {
        salir(`${mig.nombre} corrió pero no quedó registrada la versión ${mig.numero} en ${esquema}.schema_version. Me detengo.`);
      }
      console.log("ok");
    }
    if (pendientes.length) console.log(`\n✓ Listo: ${pendientes.length} migración(es) aplicada(s).`);
  }
} finally {
  await pool?.close();
}
