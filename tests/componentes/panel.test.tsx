import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// El panel se pinta con lo que arma buildPanelData: se usa la función real con
// las consultas simuladas, así el componente y el cálculo se prueban juntos.
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

import PanelDashboard from "@/components/admin/PanelDashboard";
import { buildPanelData, type PanelData, type Rango } from "@/lib/ui/panel-data";

const HOY = "2026-10-28";

async function datos(): Promise<Record<Rango, PanelData>> {
  return {
    Hoy: await buildPanelData("Hoy", HOY),
    Semana: await buildPanelData("Semana", HOY),
    Mes: await buildPanelData("Mes", HOY),
  };
}

const v = (estado: string, tecnicoId: number) => ({ estado, tecnicoId });

beforeEach(() => {
  vi.resetAllMocks();
  q.contarProblemasAbiertos.mockResolvedValue(7);
  q.contarPorReagendar.mockResolvedValue(4);
  q.getProblemasPorTipo.mockResolvedValue([{ codigo: "OTRO", nombre: "Otro problema", n: 4, pct: 100 }]);
  q.getCargaTecnico.mockResolvedValue([{ nombre: "Ana Pérez", tecnicoId: 1, programadas: 4, realizadas: 3 }]);
  q.getSucursalFallas.mockResolvedValue([]);
  q.getTiempoEnSitio.mockResolvedValue({ prom: 42, porMotivo: [{ label: "Calibración", min: 55, pct: 100 }] });
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
  q.getVisitasRango.mockImplementation(async (rango: string) =>
    rango === "Hoy"
      ? [v("COMPLETADA", 1), v("COMPLETADA", 1), v("COMPLETADA", 2), v("EN_CURSO", 3)]
      : rango === "Semana"
        ? Array.from({ length: 10 }, (_, i) => v(i < 6 ? "COMPLETADA" : "PROGRAMADA", 1 + (i % 3)))
        : Array.from({ length: 20 }, (_, i) => v(i < 5 ? "COMPLETADA" : "REAGENDADA", 1 + (i % 4)))
  );
});

const indicador = (titulo: string) => screen.getByText(titulo).closest("a")!;

describe("panel de operación", () => {
  it("parte en «Hoy» con los indicadores del día", async () => {
    render(<PanelDashboard data={await datos()} />);
    expect(screen.getByRole("heading", { name: "Panel de operación" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hoy" })).toHaveAttribute("aria-pressed", "true");
    expect(indicador("Visitas hoy")).toHaveTextContent("4programadas3 técnicos en terreno");
    expect(indicador("Cerradas a tiempo")).toHaveTextContent("3de 417 puntos bajo la meta");
  });

  it("cambiar de período recalcula con sus datos", async () => {
    const u = userEvent.setup();
    render(<PanelDashboard data={await datos()} />);
    await u.click(screen.getByRole("button", { name: "Semana" }));
    expect(indicador("Visitas de la semana")).toHaveTextContent("10programadas");
    expect(indicador("Cerradas a tiempo")).toHaveTextContent("6de 10");

    await u.click(screen.getByRole("button", { name: "Mes" }));
    expect(indicador("Visitas del mes")).toHaveTextContent("20programadas");
    expect(indicador("Esperan nueva fecha")).toHaveTextContent("4visitas15 eran de este mes");
  });

  it("los indicadores llevan a su sección", async () => {
    render(<PanelDashboard data={await datos()} />);
    expect(indicador("Visitas hoy")).toHaveAttribute("href", "/admin/visitas");
    expect(indicador("Cerradas a tiempo")).toHaveAttribute("href", "#tecnicos");
    expect(indicador("Problemas abiertos")).toHaveAttribute("href", "/admin/problemas");
    expect(indicador("Esperan nueva fecha")).toHaveAttribute("href", "#reagendamientos");
  });

  it("elegir un tipo de problema lo destaca y ofrece ir a Problemas", async () => {
    const u = userEvent.setup();
    render(<PanelDashboard data={await datos()} />);
    expect(screen.getByText("7 abiertos")).toBeInTheDocument();
    expect(screen.getByText("Sin clasificar")).toBeInTheDocument();
    const tipo = screen.getByRole("button", { name: /Otro problema/ });
    await u.click(tipo);
    expect(tipo).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("link", { name: "Ver problemas" })).toHaveAttribute("href", "/admin/problemas?tipo=OTRO");
    await u.click(tipo);
    expect(screen.queryByRole("link", { name: "Ver problemas" })).toBeNull();
  });

  it("muestra el tiempo en sitio promedio y por motivo", async () => {
    render(<PanelDashboard data={await datos()} />);
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Calibración")).toBeInTheDocument();
    expect(screen.getByText("55 min")).toBeInTheDocument();
  });

  it("los vacíos explican qué falta", async () => {
    q.getProblemasPorTipo.mockResolvedValue([]);
    render(<PanelDashboard data={await datos()} />);
    expect(screen.getByText(/No hay problemas abiertos/)).toBeInTheDocument();
    expect(screen.getByText(/Todavía no se resuelve ningún problema/)).toBeInTheDocument();
    expect(screen.getByText("No hay reagendamientos.")).toBeInTheDocument();
  });

  it("cada estado enlaza al listado filtrado", async () => {
    render(<PanelDashboard data={await datos()} />);
    const enlace = screen.getByRole("link", { name: /Completada/ });
    expect(enlace).toHaveAttribute("href", "/admin/visitas?estado=COMPLETADA");
    expect(within(enlace).getByText("75%")).toBeInTheDocument();
  });

  it("cada técnico abre sus visitas; solo en «Hoy» se filtra además por fecha", async () => {
    const u = userEvent.setup();
    render(<PanelDashboard data={await datos()} />);
    const fila = () => screen.getByText("Ana Pérez").closest("a")!;
    expect(fila()).toHaveAttribute("href", `/admin/visitas?fecha=${HOY}&tecnico=1`);
    expect(fila()).toHaveTextContent("3 de 4 a tiempo");
    await u.click(screen.getByRole("button", { name: "Semana" }));
    expect(fila()).toHaveAttribute("href", "/admin/visitas?tecnico=1");
  });

  it("marca los registros de prueba sin esconderlos", async () => {
    q.getSucursalFallas.mockResolvedValue([
      { sucursalId: 9, total: 2, sinCerrar: 1, sucursal: { nombre: "ZZ Sucursal", comuna: "Maipú", cliente: "Cliente de Pruebas" } },
    ]);
    q.getReagendas.mockResolvedValue([
      { reagendamiento: { id: 1, motivo: "prueba funcional" }, visita: { folio: "V-1", sucursal: { nombre: "Centro" } } },
    ]);
    render(<PanelDashboard data={await datos()} />);
    expect(screen.getAllByText("Prueba")).toHaveLength(2);
    expect(screen.getByText("ZZ Sucursal", { exact: false })).toBeInTheDocument();
  });

  it("con cero visitas no se rompe", async () => {
    q.getVisitasRango.mockResolvedValue([]);
    q.getCargaTecnico.mockResolvedValue([]);
    render(<PanelDashboard data={await datos()} />);
    expect(indicador("Cerradas a tiempo")).toHaveTextContent("Sin visitas en el período");
    expect(screen.getByText(/Nadie tiene visitas programadas/)).toBeInTheDocument();
    expect(screen.getAllByText("0 visitas").length).toBeGreaterThan(0);
  });
});
