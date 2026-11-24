// Contrato compartido entre el servidor y el navegador: solo tipos y reglas
// puras, nada que toque la base. Qué secciones del acta del técnico el panel
// marcó como obligatorias (tecnico.acta_seccion_config, migración 042) y qué le
// exige cada una al acta.
//
// Responsable, motivo y trabajo, y firma son obligatorias siempre y no se
// configuran. Las tres de acá eran opcionales.

import type { ActaEntrada } from "@/lib/contratos/acta";

export type SeccionConfigurable = "problemas" | "interno" | "fotos";

/** Qué secciones configurables son obligatorias. */
export type SeccionesObligatorias = Record<SeccionConfigurable, boolean>;

/** Lo que vale si la base todavía no tiene la tabla o le falta una fila: el valor de la migración 042. */
export const OBLIGATORIAS_POR_DEFECTO: SeccionesObligatorias = {
  problemas: false,
  interno: false,
  fotos: true,
};

/** Las secciones configurables, en el orden del formulario, con lo que se les pide. */
export const SECCIONES_CONFIGURABLES: ReadonlyArray<{
  clave: SeccionConfigurable;
  n: number;
  titulo: string;
  exige: string;
}> = [
  { clave: "problemas", n: 3, titulo: "Problemas detectados", exige: "Revisarla y guardarla, aunque sea sin problemas." },
  { clave: "interno", n: 4, titulo: "Comentario interno", exige: "Escribir un comentario o marcar al menos un ítem." },
  { clave: "fotos", n: 5, titulo: "Fotos y video del trabajo", exige: "Al menos una foto y un video del trabajo." },
];

/** Lo que falta en «Fotos y video del trabajo», dicho para seguir a «Falta…»: «una foto y un video del trabajo». */
export function queFaltaEnFotos(fotosTrabajo: number, videosTrabajo: number, exigeVideo = true): string | null {
  const foto = fotosTrabajo < 1;
  const video = exigeVideo && videosTrabajo < 1;
  if (foto && video) return "una foto y un video del trabajo";
  if (foto) return "una foto del trabajo";
  if (video) return "un video del trabajo";
  return null;
}

/** Lo que le falta a «Fotos y video del trabajo» para estar completa, o null. */
export function faltaEnFotos(fotosTrabajo: number, videosTrabajo: number, exigeVideo = true): string | null {
  const que = queFaltaEnFotos(fotosTrabajo, videosTrabajo, exigeVideo);
  return que ? `Falta al menos ${que}` : null;
}

export const FALTA_INTERNO = "Escribe un comentario interno o marca al menos un ítem";

/** Lo que le falta al «Comentario interno» para estar completo, o null. */
export function faltaEnInterno(comentario: string | null | undefined, itemsMarcados: number): string | null {
  return String(comentario ?? "").trim() || itemsMarcados > 0 ? null : FALTA_INTERNO;
}

/**
 * Lo que le falta a un acta que se cierra según las secciones obligatorias, o
 * null si cumple. El servidor lo aplica con lo que de verdad llegó (fotos,
 * videos ya subidos, comentario). «Problemas detectados» solo se puede pedir
 * revisada en el celular: un acta sin problemas es un acta válida.
 *
 * `exigeVideo`: false si el rol no tiene el permiso de grabar video.
 */
export function errorDeSeccionesObligatorias(
  acta: Pick<ActaEntrada, "fotos" | "videosIds" | "comentarioInterno" | "internosCodigos">,
  obligatorias: SeccionesObligatorias,
  exigeVideo = true
): string | null {
  if (obligatorias.fotos) {
    const falta = faltaEnFotos(
      acta.fotos.filter((f) => !f.interno).length,
      acta.videosIds?.length ?? 0,
      exigeVideo
    );
    if (falta) return `${falta}. El panel exige fotos y video del trabajo para cerrar el acta.`;
  }
  if (obligatorias.interno) {
    const falta = faltaEnInterno(acta.comentarioInterno, acta.internosCodigos?.length ?? 0);
    if (falta) return `${falta}. El panel exige el comentario interno para cerrar el acta.`;
  }
  return null;
}
