// El motivo obligatorio al desactivar (migración 039). Lo puro, que comparten
// el navegador y el servidor: qué se puede desactivar, cuánto mide el motivo y
// cómo se cuenta una baja en pantalla.

/** Lo que se activa y desactiva desde el panel. Es el valor de dmc.cambio_estado.entidad. */
export const ENTIDADES_CON_ESTADO = ["cliente", "marca", "mall", "sucursal", "tecnico", "usuario", "contacto"] as const;
export type EntidadEstado = (typeof ENTIDADES_CON_ESTADO)[number];

/** El motivo es nvarchar(400) en todas las tablas. */
export const MOTIVO_MAXIMO = 400;
/** Menos que esto no explica nada («x», «ok»). La base solo exige que no esté vacío. */
export const MOTIVO_MINIMO = 5;

/** La última vez que algo quedó inactivo: por qué, quién y cuándo. */
export interface Baja {
  motivo: string;
  /** El correo de quien lo desactivó. Null = antes del historial (migración 039). */
  por: string | null;
  /** YYYY-MM-DDTHH:mm:ss. Null = antes del historial. */
  en: string | null;
}

/**
 * Qué impide guardar el estado, o null si nada. Vale igual en el formulario y
 * en la acción del servidor: activo no pide nada; inactivo pide un motivo de
 * al menos MOTIVO_MINIMO letras.
 */
export function problemaDeBaja(activo: boolean, motivo: string | null | undefined, que: string): string | null {
  if (activo) return null;
  const texto = motivo?.trim() ?? "";
  if (!texto) return `Explica por qué se desactiva ${que}.`;
  if (texto.length < MOTIVO_MINIMO) return `El motivo para desactivar ${que} es muy corto: cuenta qué pasó.`;
  if (texto.length > MOTIVO_MAXIMO) return `El motivo no puede pasar de ${MOTIVO_MAXIMO} caracteres.`;
  return null;
}

/** El motivo tal como se guarda: recortado, y nada si queda activo (al reactivar se borra). */
export function motivoParaGuardar(activo: boolean, motivo: string | null | undefined): string | null {
  return activo ? null : motivo?.trim() || null;
}

/** «12-11-2026» desde «2026-11-12T10:30:00». */
function fechaCorta(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return a && m && d ? `${d}-${m}-${a}` : iso;
}

/** Quién y cuándo, en una línea: «Desactivado por ana@x.cl el 12-11-2026». */
export function autoriaDeBaja(baja: Pick<Baja, "por" | "en">, femenino = false): string {
  const verbo = femenino ? "Desactivada" : "Desactivado";
  if (!baja.por && !baja.en) return `${verbo} antes de que el sistema registrara quién y cuándo`;
  return [verbo, baja.por ? `por ${baja.por}` : "", baja.en ? `el ${fechaCorta(baja.en)}` : ""].filter(Boolean).join(" ");
}
