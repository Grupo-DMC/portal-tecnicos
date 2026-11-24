// Adapta un script SQL escrito para el esquema `dmc` a otro esquema.
//
// Lo usan el corredor de migraciones (scripts/migrar.mjs) y los tests, que
// crean la base desechable desde sql/dmc_contingencia_sqlserver.sql en el
// esquema que toque (por defecto `tecnico`, como DMC_Core).
//
// Qué cambia:
//   dmc.tabla                       →  <esquema>.tabla
//   SCHEMA_ID('dmc'), = 'dmc', …    →  el mismo texto con <esquema>
//   CREATE SCHEMA dmc               →  CREATE SCHEMA <esquema>
//   USE DMC_Contingencia;           →  USE [<base>];  (solo si se da `base`)
//
// Qué NO cambia: correos y dominios (`x@dmc.cl`), ni nada que no sea un
// identificador `dmc.` suelto. Las migraciones nuevas ya no deberían escribir
// el esquema: usan `$(ESQUEMA)` (ver sql/README.md) y se reemplaza igual acá.

const IDENTIFICADOR = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

/**
 * @param {string} script
 * @param {string} esquema  esquema destino
 * @param {{ base?: string }} [opciones]
 */
export function adaptarEsquema(script, esquema, opciones = {}) {
  if (!IDENTIFICADOR.test(esquema)) {
    throw new Error(`Esquema inválido: "${esquema}".`);
  }
  let salida = script
    // Marcador de las migraciones nuevas. Acepta $(ESQUEMA) como en sqlcmd.
    .replace(/\$\(ESQUEMA\)/g, esquema)
    // Identificadores calificados. El lookbehind deja fuera `@dmc.cl`, `x.dmc.y` y `[dmc].`.
    .replace(/(?<![\w@.\-[])dmc\.(?=[A-Za-z_[])/g, `${esquema}.`)
    .replace(/(?<![\w@.\-[])CREATE\s+SCHEMA\s+dmc\b/gi, (m) => m.replace(/dmc$/i, esquema))
    .replace(/SCHEMA_ID\(\s*'dmc'\s*\)/gi, `SCHEMA_ID('${esquema}')`)
    .replace(/(SCHEMA_NAME\([^)]*\)\s*=\s*)'dmc'/gi, `$1'${esquema}'`)
    .replace(/(TABLE_SCHEMA\s*=\s*)'dmc'/gi, `$1'${esquema}'`);

  if (opciones.base) {
    if (!/^[A-Za-z0-9_]{1,128}$/.test(opciones.base)) throw new Error(`Base inválida: "${opciones.base}".`);
    salida = salida.replace(/^\s*USE\s+\[?[A-Za-z0-9_]+\]?\s*;?\s*$/gim, `USE [${opciones.base}];`);
  }
  return salida;
}

/** Divide un script de SSMS/sqlcmd en lotes por las líneas `GO`. */
export function dividirLotes(script) {
  return script
    .split(/^\s*GO\s*(?:--.*)?$/gim)
    .map((l) => l.trim())
    .filter(Boolean);
}
