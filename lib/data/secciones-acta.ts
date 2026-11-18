import "server-only";
import { consulta, enTransaccion, sql } from "@/lib/data/sql";
import {
  OBLIGATORIAS_POR_DEFECTO,
  SECCIONES_CONFIGURABLES,
  type SeccionesObligatorias,
} from "@/lib/contratos/secciones-acta";

// Qué secciones del acta del técnico son obligatorias (dmc.acta_seccion_config,
// migración 042). Una fila por sección; si falta, vale el valor por defecto.

interface FilaConfig {
  clave: string;
  obligatoria: boolean;
}

/** Las secciones configurables y si cada una es obligatoria. */
export async function leerSeccionesObligatorias(): Promise<SeccionesObligatorias> {
  const filas = await consulta<FilaConfig>(`SELECT clave, obligatoria FROM dmc.acta_seccion_config`);
  const resultado = { ...OBLIGATORIAS_POR_DEFECTO };
  for (const f of filas) {
    if (f.clave in resultado) resultado[f.clave as keyof SeccionesObligatorias] = Boolean(f.obligatoria);
  }
  return resultado;
}

/** Deja la configuración tal como llegó, y quién la cambió. Una sola transacción: o quedan las tres o ninguna. */
export async function guardarSeccionesObligatorias(
  nuevas: SeccionesObligatorias,
  usuarioId: number
): Promise<SeccionesObligatorias> {
  await enTransaccion(async (ej) => {
    for (const { clave } of SECCIONES_CONFIGURABLES) {
      await ej.ejecutar(
        `MERGE dmc.acta_seccion_config AS d
           USING (SELECT @clave AS clave) AS o ON d.clave = o.clave
           WHEN MATCHED THEN UPDATE SET obligatoria = @oblig, actualizado_en = SYSDATETIME(), actualizado_por = @usuario
           WHEN NOT MATCHED THEN INSERT (clave, obligatoria, actualizado_por) VALUES (@clave, @oblig, @usuario);`,
        [
          ["clave", sql.VarChar(12), clave],
          ["oblig", sql.Bit, nuevas[clave]],
          ["usuario", sql.BigInt, usuarioId],
        ]
      );
    }
  });
  return leerSeccionesObligatorias();
}
