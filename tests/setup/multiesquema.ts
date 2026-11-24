import sql from "mssql";
import { GRUPO_CLIENTES, GRUPO_SEGURIDAD } from "../../lib/db/esquema";

// Reproduce en la base de pruebas la forma de DMC_Core: las tablas de clientes
// y de seguridad viven en su esquema y `tecnico` conserva un sinónimo de cada
// una, que es lo que usan las vistas y los triggers. Los triggers viajan con
// su tabla (ALTER SCHEMA … TRANSFER lo hace solo).
//
// La app NO usa esos sinónimos: arma cada nombre con lib/db/esquema.ts.
// TEST_DB_MULTIESQUEMA=0 deja todo en un solo esquema.

export const MULTIESQUEMA_DE_PRUEBA = process.env.TEST_DB_MULTIESQUEMA?.trim() !== "0";
// TEST_DB_SIN_SINONIMOS=1 no crea los sinónimos: sirve para ver qué vistas o triggers todavía dependen de ellos.
const CON_SINONIMOS = process.env.TEST_DB_SIN_SINONIMOS?.trim() !== "1";

export const ESQUEMA_CLIENTES_DE_PRUEBA = "clientes";
export const ESQUEMA_SEGURIDAD_DE_PRUEBA = "seguridad";

const esTabla = (n: string) => !n.startsWith("tg_");

export async function repartirEsquemas(pool: sql.ConnectionPool, esquemaTecnico: string): Promise<void> {
  if (!MULTIESQUEMA_DE_PRUEBA) return;
  const grupos: [string, readonly string[]][] = [
    [ESQUEMA_CLIENTES_DE_PRUEBA, GRUPO_CLIENTES],
    [ESQUEMA_SEGURIDAD_DE_PRUEBA, GRUPO_SEGURIDAD],
  ];
  for (const [destino, nombres] of grupos) {
    await pool.request().batch(`IF SCHEMA_ID('${destino}') IS NULL EXEC ('CREATE SCHEMA ${destino}')`);
    for (const tabla of nombres.filter(esTabla)) {
      // Hay tablas del grupo que el DDL base no trae (sucursal_nombre_anterior, de la migración 033).
      await pool.request().batch(`
        IF OBJECT_ID('${esquemaTecnico}.${tabla}', 'U') IS NOT NULL
        BEGIN
          ALTER SCHEMA ${destino} TRANSFER ${esquemaTecnico}.${tabla};
          ${CON_SINONIMOS ? `EXEC ('CREATE SYNONYM ${esquemaTecnico}.${tabla} FOR ${destino}.${tabla}');` : ""}
        END`);
    }
  }
}

/** Las variables de entorno con que la app encuentra cada grupo. */
export function entornoDeEsquemas(): Record<string, string> {
  return MULTIESQUEMA_DE_PRUEBA
    ? { DB_SCHEMA_CLIENTES: ESQUEMA_CLIENTES_DE_PRUEBA, DB_SCHEMA_SEGURIDAD: ESQUEMA_SEGURIDAD_DE_PRUEBA }
    : {};
}
