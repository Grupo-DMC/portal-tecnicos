// Cálculos del panel «Problemas»: antigüedad, resumen de la franja y filtros. Sin React.

import type { GrupoProblemas, ProblemaPanel } from "@/lib/contratos/panel";
import { ESTADO_PROBLEMA_CIERRE, ESTADO_PROBLEMA_INICIAL } from "@/lib/ui/estado";
import { sumarDias } from "@/lib/ui/fecha";
import { sinTildes } from "@/lib/ui/formato";

/** Tramos de antigüedad de un problema sin cerrar, en días. */
export const TRAMOS = [
  { clave: "0-7", label: "Hasta 7 días", min: 0, max: 7 },
  { clave: "8-15", label: "8 a 15 días", min: 8, max: 15 },
  { clave: "16-30", label: "16 a 30 días", min: 16, max: 30 },
  { clave: "31-60", label: "31 a 60 días", min: 31, max: 60 },
  { clave: "60+", label: "Más de 60 días", min: 61, max: Number.POSITIVE_INFINITY },
] as const;

/** El número (0 a 4) del tramo en que caen esos días: define su color. */
export function tramoDe(dias: number): number {
  const i = TRAMOS.findIndex((t) => dias >= t.min && dias <= t.max);
  return i < 0 ? 0 : i;
}

export const abierto = (p: Pick<ProblemaPanel, "estado">) => p.estado !== ESTADO_PROBLEMA_CIERRE;

/** Color de un estado: rojo lo recién levantado, ámbar lo que está a medio camino, verde lo cerrado. */
export function claseEstado(estado: string): "open" | "warn" | "ok" {
  if (estado === ESTADO_PROBLEMA_CIERRE) return "ok";
  return estado === ESTADO_PROBLEMA_INICIAL ? "open" : "warn";
}

export interface FiltrosProblemas {
  clienteId: string;
  tipo: string;
  /** "" = sin cerrar (por defecto), "TODOS" = incluidos los resueltos, o un código de estado. */
  estado: string;
  /** Clave de un tramo de antigüedad. Solo aplica a lo que sigue sin cerrar. */
  tramo: string;
  /** "" = cualquiera · SIN = sin visita agendada · CON = con visita agendada. */
  agenda: string;
  /** "" = cualquiera · SIN = nada marcado · PARCIAL = a medias · LISTA = todo marcado. */
  avance: string;
}

export const SIN_FILTROS_PROBLEMAS: FiltrosProblemas = { clienteId: "", tipo: "", estado: "", tramo: "", agenda: "", avance: "" };

/**
 * Las tiendas con los problemas que cumplen la búsqueda y los filtros, de la
 * que más tiene sin cerrar a la que menos. Dentro de cada una, primero lo
 * abierto de lo más viejo a lo más nuevo y después lo resuelto.
 */
export function filtrarProblemas(
  grupos: GrupoProblemas[],
  f: FiltrosProblemas,
  busqueda: string,
  nombreTipo: (codigo: string) => string,
  marcadas: (p: ProblemaPanel) => number,
  pasos: number
): GrupoProblemas[] {
  const q = sinTildes(busqueda.trim());
  return grupos
    .filter((g) => !f.clienteId || String(g.clienteId) === f.clienteId)
    .map((g) => {
      const tiendaCoincide = !q || sinTildes(`${g.nombre} ${g.cliente} ${g.comuna}`).includes(q);
      const items = g.items
        .filter((p) => {
          if (f.tipo && p.tipoCodigo !== f.tipo) return false;
          if (!tiendaCoincide) {
            const texto = [
              p.visita.folio,
              p.agenda?.folio,
              p.visita.tecnico,
              p.descripcion,
              p.solucion,
              nombreTipo(p.tipoCodigo),
              ...p.items.map((i) => i.etiqueta),
            ].join(" ");
            if (!sinTildes(texto).includes(q)) return false;
          }
          if (f.estado === "") {
            if (!abierto(p)) return false;
          } else if (f.estado !== "TODOS" && p.estado !== f.estado) return false;
          if (f.tramo && (!abierto(p) || TRAMOS[tramoDe(p.dias)].clave !== f.tramo)) return false;
          if (f.agenda === "SIN" && (!abierto(p) || p.agenda)) return false;
          if (f.agenda === "CON" && !p.agenda) return false;
          if (f.avance) {
            const n = marcadas(p);
            if ((n === 0 ? "SIN" : n >= pasos ? "LISTA" : "PARCIAL") !== f.avance) return false;
          }
          return true;
        })
        .sort((a, b) => {
          const ra = Number(!abierto(a));
          const rb = Number(!abierto(b));
          if (ra !== rb) return ra - rb;
          return ra ? (b.resueltoEn ?? "").localeCompare(a.resueltoEn ?? "") : a.creadoEn.localeCompare(b.creadoEn);
        });
      return { ...g, items };
    })
    .filter((g) => g.items.length > 0)
    .sort((a, b) => b.abiertos - a.abiertos || masAntiguo(b) - masAntiguo(a));
}

/** Días del problema sin cerrar más viejo de la tienda (0 si no queda ninguno). */
export function masAntiguo(g: Pick<GrupoProblemas, "items">): number {
  return g.items.reduce((m, p) => (abierto(p) ? Math.max(m, p.dias) : m), 0);
}

/** Los números de la franja de arriba, sobre todos los problemas. */
export function resumenProblemas(grupos: GrupoProblemas[], hoy: string) {
  const todos = grupos.flatMap((g) => g.items.map((p) => ({ ...p, grupo: g })));
  const sinCerrar = todos.filter(abierto);
  const resueltos = todos.filter((p) => !abierto(p));
  const hace30 = sumarDias(hoy, -30);
  const hace60 = sumarDias(hoy, -60);
  const entre = (fecha: string | null, desde: string, hasta: string) => {
    const d = (fecha ?? "").slice(0, 10);
    return d > desde && d <= hasta;
  };
  return {
    sinCerrar,
    tiendas: new Set(sinCerrar.map((p) => p.grupo.sucursalId)).size,
    tramos: TRAMOS.map((t, i) => ({
      ...t,
      i,
      items: sinCerrar.filter((p) => tramoDe(p.dias) === i).sort((a, b) => a.dias - b.dias),
    })),
    levantados: todos.filter((p) => entre(p.creadoEn, hace30, hoy)).length,
    levantadosAntes: todos.filter((p) => entre(p.creadoEn, hace60, hace30)).length,
    resueltos: resueltos.filter((p) => entre(p.resueltoEn, hace30, hoy)).length,
    resueltosAntes: resueltos.filter((p) => entre(p.resueltoEn, hace60, hace30)).length,
    diasResolver: resueltos.length ? resueltos.reduce((n, p) => n + p.dias, 0) / resueltos.length : null,
    totalResueltos: resueltos.length,
    masViejo: sinCerrar.reduce<(typeof sinCerrar)[number] | null>((m, p) => (!m || p.dias > m.dias ? p : m), null),
    sinVisita: sinCerrar.filter((p) => !p.agenda).length,
  };
}
