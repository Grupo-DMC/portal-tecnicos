// Verifica que cada objeto que la app consulta exista, de verdad, en el esquema
// que la configuración le asigna, y no a través de un sinónimo.
//
//   node scripts/verificar-ubicacion.mjs [--env .env.development]
//
// Para cada objeto de lib/db/esquema.ts (OBJETOS) dice:
//   ok          existe como tabla/vista/secuencia/trigger en el esquema esperado
//   SINÓNIMO    el esquema esperado solo tiene un sinónimo hacia otro lado: la
//               app dependería de él (corregir GRUPO_* o las variables DB_SCHEMA_*)
//   OTRO        existe en otro esquema y no en el esperado
//   FALTA       no existe en ningún esquema
// Además lista los sinónimos que hay y qué vistas, triggers o procedimientos
// todavía los usan: mientras alguno los use, NO se pueden borrar.
//
// Solo lee el catálogo; no escribe nada ni imprime contraseñas. Las variables
// DB_SCHEMA, DB_SCHEMA_CLIENTES y DB_SCHEMA_SEGURIDAD se toman del archivo.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import sql from "mssql";

function leerEnv(texto) {
  const salida = {};
  for (const linea of texto.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(linea);
    if (!m || linea.trim().startsWith("#")) continue;
    let v = m[2];
    if (/^'.*'$/.test(v) || /^".*"$/.test(v)) v = v.slice(1, -1);
    salida[m[1]] = v;
  }
  return salida;
}

const args = process.argv.slice(2);
const i = args.indexOf("--env");
const archivo = resolve(i >= 0 ? args[i + 1] : ".env.development");
if (!existsSync(archivo)) throw new Error(`No existe ${archivo}.`);
const e = leerEnv(readFileSync(archivo, "utf8"));
for (const n of ["DB_SERVER", "DB_NAME", "DB_USER", "DB_PASSWORD"]) if (!e[n]) throw new Error(`Falta ${n} en ${archivo}.`);
for (const n of ["DB_SCHEMA", "DB_SCHEMA_CLIENTES", "DB_SCHEMA_SEGURIDAD"]) {
  if (e[n]) process.env[n] = e[n];
  else delete process.env[n];
}

// Node 24 lee TypeScript sin compilar mientras el archivo use solo sintaxis borrable.
const { OBJETOS, grupoDe, esquema } = await import("../lib/db/esquema.ts");

const pool = await new sql.ConnectionPool({
  server: e.DB_SERVER,
  port: Number(e.DB_PORT ?? 1433),
  database: e.DB_NAME,
  user: e.DB_USER,
  password: e.DB_PASSWORD,
  options: { encrypt: (e.DB_ENCRYPT ?? "true") !== "false", trustServerCertificate: (e.DB_TRUST_SERVER_CERT ?? "true") !== "false" },
  connectionTimeout: 15000,
}).connect();

try {
  const objetos = (
    await pool.request().query(`SELECT SCHEMA_NAME(o.schema_id) AS esq, o.name, o.type_desc FROM sys.objects o WHERE o.type IN ('U','V','SO','TR') AND o.is_ms_shipped = 0
                                 UNION ALL SELECT SCHEMA_NAME(schema_id), name, 'SYNONYM' FROM sys.synonyms`)
  ).recordset;
  const sinonimos = (await pool.request().query(`SELECT SCHEMA_NAME(schema_id) AS esq, name, base_object_name FROM sys.synonyms`)).recordset;

  console.log(`Base: ${e.DB_SERVER}:${e.DB_PORT ?? 1433}/${e.DB_NAME}  (login ${e.DB_USER})`);
  console.log(`Esquemas esperados: tecnico→${esquema("tecnico")}  clientes→${esquema("clientes")}  seguridad→${esquema("seguridad")}\n`);

  const estados = { ok: 0, sinonimo: 0, otro: 0, falta: 0 };
  const lineas = [];
  for (const nombre of OBJETOS) {
    const grupo = grupoDe(nombre);
    const esperado = esquema(grupo);
    const donde = objetos.filter((o) => o.name === nombre);
    const real = donde.find((o) => o.esq === esperado && o.type_desc !== "SYNONYM");
    if (real) { estados.ok++; continue; }
    const sin = donde.find((o) => o.esq === esperado && o.type_desc === "SYNONYM");
    if (sin) {
      estados.sinonimo++;
      const base = sinonimos.find((s) => s.esq === esperado && s.name === nombre)?.base_object_name;
      lineas.push(`  SINÓNIMO  ${esperado}.${nombre} → ${base}   (grupo ${grupo}: el objeto real vive en otro esquema)`);
    } else if (donde.length) {
      estados.otro++;
      lineas.push(`  OTRO      ${esperado}.${nombre} no existe; sí en: ${donde.map((o) => `${o.esq}.${nombre}`).join(", ")}`);
    } else {
      estados.falta++;
      lineas.push(`  FALTA     ${esperado}.${nombre}`);
    }
  }
  console.log(`Objetos de la app: ${OBJETOS.length} · en su esquema ${estados.ok} · vía sinónimo ${estados.sinonimo} · en otro esquema ${estados.otro} · faltan ${estados.falta}`);
  if (lineas.length) console.log(lineas.join("\n"));

  const registrados = new Set(OBJETOS);
  const ajenos = objetos.filter((o) => o.type_desc === "USER_TABLE" && ["tecnico", "clientes", "seguridad", esquema("tecnico")].includes(o.esq) && !registrados.has(o.name));
  if (ajenos.length) console.log(`\nTablas de la base que la app no conoce (no están en OBJETOS): ${ajenos.map((o) => `${o.esq}.${o.name}`).join(", ")}`);

  console.log(`\nSinónimos en la base: ${sinonimos.length}`);
  // Primero el catálogo de dependencias; si el login no puede leerlo, se busca el
  // nombre en el texto de las vistas, triggers y procedimientos (sql_modules).
  let modulos = null;
  const dependientes = async (s) => {
    try {
      return (
        await pool
          .request()
          .input("esq", sql.NVarChar, s.esq)
          .input("nombre", sql.NVarChar, s.name)
          .query(`SELECT DISTINCT SCHEMA_NAME(o.schema_id) AS esq, o.name, o.type_desc
                    FROM sys.sql_expression_dependencies d JOIN sys.objects o ON o.object_id = d.referencing_id
                   WHERE d.referenced_entity_name = @nombre AND ISNULL(d.referenced_schema_name, '') = @esq`)
      ).recordset;
    } catch {
      modulos ??= (
        await pool.request().query(`SELECT SCHEMA_NAME(o.schema_id) AS esq, o.name, o.type_desc, m.definition
                                       FROM sys.sql_modules m JOIN sys.objects o ON o.object_id = m.object_id WHERE o.is_ms_shipped = 0`)
      ).recordset;
      // Sin VIEW DEFINITION el texto llega NULL: no se puede afirmar que nadie lo use.
      if (modulos.length && modulos.every((m) => m.definition == null)) return null;
      const patron = new RegExp(`(?<![\\w.\\]])\\[?${s.esq}\\]?\\.\\[?${s.name}\\]?(?![\\w])`, "i");
      return modulos.filter((m) => patron.test(m.definition ?? "") && !(m.esq === s.esq && m.name === s.name));
    }
  };
  let conUso = 0;
  let indeterminados = 0;
  for (const s of sinonimos) {
    const deps = await dependientes(s);
    if (deps === null) {
      indeterminados++;
      console.log(`  ${s.esq}.${s.name} → ${s.base_object_name}   usado por: NO SE PUEDE DETERMINAR (el login no ve el texto de las vistas y triggers)`);
      continue;
    }
    if (deps.length) conUso++;
    const usos = deps.length ? deps.map((d) => `${d.type_desc.toLowerCase()} ${d.esq}.${d.name}`).join(", ") : "nadie lo usa";
    console.log(`  ${s.esq}.${s.name} → ${s.base_object_name}   usado por: ${usos}`);
  }
  if (indeterminados) {
    console.log(
      `\nNo se pudo saber quién usa ${indeterminados} sinónimo(s): este login no tiene VIEW DEFINITION. Mientras no se compruebe con un login que sí lo tenga ` +
        "(el de migraciones o un administrador), NO borres ninguno. Consulta para ese login:\n" +
        "  SELECT SCHEMA_NAME(o.schema_id) AS esq, o.name, o.type_desc FROM sys.sql_modules m JOIN sys.objects o ON o.object_id = m.object_id\n" +
        "   WHERE m.definition LIKE '%tecnico.%';   -- lo que salga ahí aún usa nombres de tecnico (sinónimos si el objeto se movió)"
    );
  } else {
    console.log(`\nSinónimos con al menos una vista, trigger o procedimiento que los usa: ${conUso} de ${sinonimos.length}.`);
  }
  console.log(
    "Nota: la búsqueda en el texto de los módulos no ve SQL armado en tiempo de ejecución ni lo que la app envíe desde fuera de la base."
  );
} finally {
  await pool.close();
}
