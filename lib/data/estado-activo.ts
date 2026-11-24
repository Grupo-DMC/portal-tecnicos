import "server-only";
import { F_TS, sql, type Ejecutor } from "@/lib/data/sql";
import type { EntidadEstado } from "@/lib/ui/estado-activo";
import { T } from "@/lib/db/esquema";

// El historial de activaciones y desactivaciones de los maestros
// (tecnico.cambio_estado, migración 039). La base exige el motivo de dos formas:
// un CHECK en cada tabla (activo = 0 pide motivo_inactivo) y otro en el
// historial. Acá solo se escribe y se lee.
//
// Sin triggers a propósito: estas tablas se insertan con OUTPUT sin INTO, que
// SQL Server no permite en una tabla con trigger de INSERT. Por eso quien
// guarda lee el estado previo y anota el cambio en la misma transacción.

/** Quien cambia el estado. Null = un proceso sin sesión (no debería pasar). */
export interface ActorEstado {
  id: number;
  email: string;
}

/** La tabla de cada entidad. Se interpola en el texto: sale de este literal, nunca de la entrada. */
const TABLA: Record<EntidadEstado, string> = {
  cliente: `${T.cliente}`,
  marca: `${T.marca}`,
  mall: `${T.mall}`,
  sucursal: `${T.sucursal}`,
  tecnico: `${T.tecnico}`,
  usuario: `${T.usuario}`,
  contacto: `${T.contacto}`,
};

/**
 * El estado que tiene ahora la fila, tomándola hasta el fin de la transacción
 * para que nadie la cambie entre la lectura y el UPDATE. Null = no existe.
 */
export async function estadoActual(ej: Ejecutor, entidad: EntidadEstado, id: number): Promise<boolean | null> {
  const [fila] = await ej.consulta<{ activo: boolean }>(
    `SELECT activo FROM ${TABLA[entidad]} WITH (UPDLOCK, HOLDLOCK) WHERE id = @id`,
    [["id", sql.BigInt, id]]
  );
  return fila ? Boolean(fila.activo) : null;
}

/**
 * Anota el cambio si lo hubo: `antes` null es un alta, que solo se anota si
 * nace inactiva. Va dentro de la misma transacción que el UPDATE.
 */
export async function anotarCambioDeEstado(
  ej: Ejecutor,
  cambio: {
    entidad: EntidadEstado;
    id: number;
    antes: boolean | null;
    despues: boolean;
    motivo: string | null;
    actor: ActorEstado | null;
  }
): Promise<void> {
  const cambia = cambio.antes === null ? !cambio.despues : cambio.antes !== cambio.despues;
  if (!cambia) return;
  await ej.ejecutar(
    `INSERT INTO ${T.cambio_estado} (entidad, entidad_id, activo, motivo, usuario_id, usuario_email)
     VALUES (@entidad, @id, @activo, @motivo, @usuario, @email)`,
    [
      ["entidad", sql.VarChar(20), cambio.entidad],
      ["id", sql.BigInt, cambio.id],
      ["activo", sql.Bit, cambio.despues],
      ["motivo", sql.NVarChar(400), cambio.despues ? null : cambio.motivo],
      ["usuario", sql.BigInt, cambio.actor?.id ?? null],
      ["email", sql.NVarChar(160), cambio.actor?.email ?? null],
    ]
  );
}

/**
 * Las columnas de la última baja de cada fila, para sumar a un SELECT sobre la
 * tabla de la entidad: `baja_por` y `baja_en`. Va con OUTER APPLY y solo mira
 * las filas inactivas. `alias` es el alias de la tabla en la consulta (un
 * literal del código).
 */
export function columnasDeBaja(entidad: EntidadEstado, alias: string): { columnas: string; apply: string } {
  return {
    columnas: `baja.usuario_email AS baja_por, ${F_TS("baja.creado_en")} AS baja_en`,
    apply: `OUTER APPLY (
              SELECT TOP 1 ce.usuario_email, ce.creado_en
                FROM ${T.cambio_estado} ce
               WHERE ${alias}.activo = 0 AND ce.entidad = '${entidad}' AND ce.entidad_id = ${alias}.id AND ce.activo = 0
               ORDER BY ce.id DESC
            ) baja`,
  };
}

/** Arma la baja de una fila leída con `columnasDeBaja`. Null si está activa. */
export function bajaDeFila(f: {
  activo: boolean;
  motivo_inactivo: string | null;
  baja_por: string | null;
  baja_en: string | null;
}): { motivo: string; por: string | null; en: string | null } | null {
  if (f.activo) return null;
  return { motivo: f.motivo_inactivo ?? "", por: f.baja_por, en: f.baja_en };
}
