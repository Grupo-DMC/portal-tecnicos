import "server-only";
import {
  contarPorReagendar,
  contarProblemasAbiertos,
  getCargaTecnico,
  getProblemasPorTipo,
  getProblemasResueltos,
  getReagendas,
  getSucursalFallas,
  getTiempoEnSitio,
  getVisitasRango,
  getVisitasRealizadas,
  rangoFechas,
  type Rango,
} from "@/lib/data/queries";
import { hoyISO } from "@/lib/ui/fecha";
import { inicioResolucion, realizadasSemanales, resolucionSemanal } from "@/lib/ui/panel-resolucion";
import { ESTADO_VISITA_LABEL } from "@/lib/ui/estado";
import type { EstadoVisita } from "@/lib/types";

export type { Rango };

/** Meta interna de visitas cerradas dentro de la fecha programada. */
export const META_CUMPLIMIENTO = 92;

// Los cuatro primeros se muestran siempre; el resto, solo si tienen visitas.
const ESTADOS: { estado: EstadoVisita; fijo?: boolean }[] = [
  { estado: "PROGRAMADA", fijo: true },
  { estado: "EN_CURSO", fijo: true },
  { estado: "COMPLETADA", fijo: true },
  { estado: "CANCELADA", fijo: true },
  { estado: "PENDIENTE" },
  { estado: "REAGENDADA" },
  { estado: "CANCELADA_ADMIN" },
];

const porciento = (n: number, total: number) => (total ? Math.round((100 * n) / total) : 0);

export async function buildPanelData(rango: Rango, hoy: string = hoyISO()) {
  const { desde, hasta } = rangoFechas(rango, hoy);

  const [visitas, problemasAbiertosTotal, porReagendar, problemasTipo, carga, sucursalesFallas, tiempo, reagendas, resueltos, realizadas] =
    await Promise.all([
      getVisitasRango(rango, hoy),
      contarProblemasAbiertos(),
      contarPorReagendar(),
      getProblemasPorTipo(),
      getCargaTecnico(desde, hasta),
      getSucursalFallas(5),
      getTiempoEnSitio(),
      getReagendas(6),
      getProblemasResueltos(inicioResolucion(hoy)),
      getVisitasRealizadas(inicioResolucion(hoy)),
    ]);

  const programadas = visitas.length;
  const cerradas = visitas.filter((v) => v.estado === "COMPLETADA").length;
  const porEstado = (estado: EstadoVisita) => visitas.filter((v) => v.estado === estado).length;

  return {
    rango,
    hoy,
    meta: META_CUMPLIMIENTO,
    kpis: {
      programadas,
      cerradas,
      pctCumpl: porciento(cerradas, programadas),
      /** Visitas del período que quedaron sin fecha. */
      reagendas: porEstado("REAGENDADA") + porEstado("PENDIENTE"),
      porReagendar,
      tecnicos: new Set(visitas.map((v) => v.tecnicoId)).size,
      problemasAbiertosTotal,
    },
    estados: ESTADOS.map(({ estado, fijo }) => {
      const n = porEstado(estado);
      return { estado, fijo: !!fijo, label: ESTADO_VISITA_LABEL[estado], n, pct: porciento(n, programadas) };
    }).filter((e) => e.fijo || e.n > 0),
    // Primero quien va más atrás.
    tecnicos: carga
      .map((c) => ({ ...c, pct: porciento(c.realizadas, c.programadas) }))
      .sort((a, b) => a.pct - b.pct || b.programadas - a.programadas),
    problemasTipo,
    resolucion: resolucionSemanal(resueltos, hoy),
    realizadas: realizadasSemanales(realizadas, hoy),
    sucursalesFallas,
    tiempo,
    reagendasLista: reagendas,
  };
}

export type PanelData = Awaited<ReturnType<typeof buildPanelData>>;

/** El rango se usa para la ventana de fechas del panel. */
export { rangoFechas };
