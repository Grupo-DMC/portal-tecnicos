import { beforeEach, describe, expect, it, vi } from "vitest";

// Datos del panel con la capa de consultas simulada: solo se prueba el cálculo
// de KPIs y gráficos, no el SQL.
const q = vi.hoisted(() => ({
  contarProblemasAbiertos: vi.fn(),
  contarPorReagendar: vi.fn(),
  getCargaTecnico: vi.fn(),
  getProblemasPorTipo: vi.fn(),
  getProblemasResueltos: vi.fn(),
  getReagendas: vi.fn(),
  getSucursalFallas: vi.fn(),
  getTiempoEnSitio: vi.fn(),
  getVisitasRango: vi.fn(),
  getVisitasRealizadas: vi.fn(),
  rangoFechas: vi.fn(),
}));
vi.mock("@/lib/data/queries", () => q);

import { buildPanelData } from "@/lib/ui/panel-data";

const visita = (estado: string, tecnicoId: number) => ({ estado, tecnicoId });

beforeEach(() => {
  vi.clearAllMocks();
  q.contarProblemasAbiertos.mockResolvedValue(7);
  q.contarPorReagendar.mockResolvedValue(4);
  q.getProblemasPorTipo.mockResolvedValue([]);
  q.getCargaTecnico.mockResolvedValue([
    { nombre: "Ana", tecnicoId: 1, programadas: 4, realizadas: 3 },
    { nombre: "Beto", tecnicoId: 2, programadas: 0, realizadas: 0 },
  ]);
  q.getSucursalFallas.mockResolvedValue([]);
  q.getTiempoEnSitio.mockResolvedValue([]);
  q.getReagendas.mockResolvedValue([]);
  q.getProblemasResueltos.mockResolvedValue([]);
  q.getVisitasRealizadas.mockResolvedValue([]);
  q.rangoFechas.mockImplementation((rango: string, hoy: string) =>
    rango === "Hoy"
      ? { desde: hoy, hasta: hoy }
      : rango === "Semana"
        ? { desde: "2026-10-26", hasta: "2026-11-01" }
        : { desde: "2026-10-01", hasta: "2026-10-31" }
  );
});

describe("buildPanelData", () => {
  it("calcula los KPIs del rango", async () => {
    q.getVisitasRango.mockResolvedValue([
      visita("COMPLETADA", 1),
      visita("COMPLETADA", 1),
      visita("REAGENDADA", 2),
      visita("PENDIENTE", 3),
    ]);
    const d = await buildPanelData("Hoy", "2026-10-28");

    expect(d.kpis).toEqual({ programadas: 4, cerradas: 2, pctCumpl: 50, reagendas: 2, porReagendar: 4, tecnicos: 3, problemasAbiertosTotal: 7 });
    expect(d.meta).toBe(92);
    // Una sola consulta de visitas: la del período elegido.
    expect(q.getVisitasRango).toHaveBeenCalledTimes(1);
  });

  it("sin visitas el cumplimiento es 0 y no divide por cero", async () => {
    q.getVisitasRango.mockResolvedValue([]);
    const d = await buildPanelData("Hoy", "2026-10-28");
    expect(d.kpis.pctCumpl).toBe(0);
    expect(d.estados.map((e) => e.pct)).toEqual([0, 0, 0, 0]);
  });

  it("en Semana y Mes los técnicos y su carga son los del período completo", async () => {
    q.getVisitasRango.mockResolvedValue([visita("COMPLETADA", 1), visita("COMPLETADA", 2)]);
    const d = await buildPanelData("Semana", "2026-10-28");
    expect(d.kpis.tecnicos).toBe(2);
    expect(q.getCargaTecnico).toHaveBeenLastCalledWith("2026-10-26", "2026-11-01");

    await buildPanelData("Mes", "2026-10-28");
    expect(q.getCargaTecnico).toHaveBeenLastCalledWith("2026-10-01", "2026-10-31");
  });

  it("la carga por técnico trae su porcentaje y parte por quien va más atrás", async () => {
    q.getVisitasRango.mockResolvedValue([]);
    const d = await buildPanelData("Hoy", "2026-10-28");
    expect(d.tecnicos.map((c) => [c.nombre, c.pct])).toEqual([["Beto", 0], ["Ana", 75]]);
  });

  it("los cuatro estados base salen siempre; los demás, solo si tienen visitas", async () => {
    q.getVisitasRango.mockResolvedValue([visita("PENDIENTE", 1), visita("COMPLETADA", 1)]);
    const d = await buildPanelData("Hoy", "2026-10-28");
    expect(d.estados.map((e) => e.estado)).toEqual(["PROGRAMADA", "EN_CURSO", "COMPLETADA", "CANCELADA", "PENDIENTE"]);
    expect(d.estados.find((e) => e.estado === "PENDIENTE")).toMatchObject({ label: "Pendiente", n: 1, pct: 50 });
  });

  it("la resolución cubre 12 semanas y promedia las horas de cada una", async () => {
    q.getVisitasRango.mockResolvedValue([]);
    q.getProblemasResueltos.mockResolvedValue([
      { fecha: "2026-10-26", minutos: 60 },
      { fecha: "2026-10-28", minutos: 180 },
      { fecha: "2026-01-01", minutos: 600 },
    ]);
    const d = await buildPanelData("Hoy", "2026-10-28");
    expect(q.getProblemasResueltos).toHaveBeenCalledWith("2026-08-10");
    expect(d.resolucion).toHaveLength(12);
    expect(d.resolucion[11]).toEqual({ desde: "2026-10-26", horas: 2, resueltos: 2 });
    expect(d.resolucion[0]).toEqual({ desde: "2026-08-10", horas: null, resueltos: 0 });
  });
});
