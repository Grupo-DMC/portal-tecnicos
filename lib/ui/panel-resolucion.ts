// Tiempo promedio de resolución de problemas, semana a semana. Cálculo puro.

import { inicioSemana, sumarDias } from "@/lib/ui/fecha";

export const SEMANAS_RESOLUCION = 12;

export interface SemanaResolucion {
  /** El lunes de la semana, 'YYYY-MM-DD'. */
  desde: string;
  /** Horas promedio de lo resuelto esa semana; null si no se resolvió nada. */
  horas: number | null;
  resueltos: number;
}

/** El lunes de la primera de las semanas que se muestran. */
export function inicioResolucion(hoy: string): string {
  return sumarDias(inicioSemana(hoy), -7 * (SEMANAS_RESOLUCION - 1));
}

/** Agrupa por la semana en que se resolvió cada problema. */
export function resolucionSemanal(filas: { fecha: string; minutos: number }[], hoy: string): SemanaResolucion[] {
  const primera = inicioResolucion(hoy);
  const semanas = Array.from({ length: SEMANAS_RESOLUCION }, (_, i) => ({
    desde: sumarDias(primera, 7 * i),
    minutos: 0,
    resueltos: 0,
  }));
  const porLunes = new Map(semanas.map((s) => [s.desde, s]));
  for (const f of filas) {
    const s = porLunes.get(inicioSemana(f.fecha));
    if (!s) continue;
    s.minutos += Math.max(0, f.minutos);
    s.resueltos += 1;
  }
  return semanas.map((s) => ({
    desde: s.desde,
    horas: s.resueltos ? Math.round(s.minutos / s.resueltos / 60) : null,
    resueltos: s.resueltos,
  }));
}

/** Visitas completadas por semana, en las mismas semanas del gráfico de resolución. */
export function realizadasSemanales(filas: { fecha: string; n: number }[], hoy: string): { desde: string; n: number }[] {
  const primera = inicioResolucion(hoy);
  const semanas = Array.from({ length: SEMANAS_RESOLUCION }, (_, i) => ({ desde: sumarDias(primera, 7 * i), n: 0 }));
  const porLunes = new Map(semanas.map((s) => [s.desde, s]));
  for (const f of filas) {
    const s = porLunes.get(inicioSemana(f.fecha));
    if (s) s.n += f.n;
  }
  return semanas;
}
