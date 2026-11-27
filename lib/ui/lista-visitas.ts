// Cómo se lee cada fila de la lista de visitas: día, hora de llegada y color del estado.

import type { EstadoVisita, Visita } from "@/lib/types";
import { sumarDias, fechaCL } from "@/lib/ui/fecha";

export const PILL_VISITA: Record<EstadoVisita, string> = {
  PROGRAMADA: "prog",
  EN_CURSO: "curso",
  COMPLETADA: "ok",
  PENDIENTE: "open",
  REAGENDADA: "warn",
  CANCELADA: "off",
  CANCELADA_ADMIN: "off",
};

/** «Hoy, miércoles 25 de noviembre»; con año solo cuando no es el actual. */
export function diaDeLista(fecha: string, hoy: string): string {
  const largo = new Date(`${fecha}T00:00:00Z`)
    .toLocaleDateString("es-CL", {
      timeZone: "UTC",
      weekday: "long",
      day: "numeric",
      month: "long",
      ...(fecha.slice(0, 4) === hoy.slice(0, 4) ? {} : { year: "numeric" }),
    })
    .replace(",", "");
  const cerca = fecha === hoy ? "Hoy" : fecha === sumarDias(hoy, -1) ? "Ayer" : fecha === sumarDias(hoy, 1) ? "Mañana" : null;
  return cerca ? `${cerca}, ${largo}` : largo.charAt(0).toUpperCase() + largo.slice(1);
}

const hora = (marca: string) => /(\d{2}:\d{2})(:\d{2})?(\.\d+)?Z?$/.exec(marca)?.[1] ?? "";

/**
 * La columna «Llegada»: las horas reales si el acta ya se cerró (o se inició),
 * la hora acordada, el último día del margen o «Todo el día».
 */
export function llegada(v: Pick<Visita, "ejecucion" | "horaProgramada" | "fechaHasta">): { texto: string; fija: boolean } {
  const inicio = v.ejecucion?.horaInicio ? hora(v.ejecucion.horaInicio) : "";
  if (inicio) {
    const fin = v.ejecucion?.horaTermino ? hora(v.ejecucion.horaTermino) : "";
    return { texto: fin ? `${inicio} a ${fin}` : `Desde ${inicio}`, fija: true };
  }
  const margen = v.fechaHasta ? `Hasta ${fechaCL(v.fechaHasta).slice(0, 5)}` : "";
  if (v.horaProgramada) return { texto: margen ? `${v.horaProgramada} · ${margen.toLowerCase()}` : v.horaProgramada, fija: true };
  return { texto: margen || "Todo el día", fija: false };
}
