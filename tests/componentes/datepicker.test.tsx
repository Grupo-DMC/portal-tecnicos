import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DatePicker, { olvidarActividad, textoPeriodo } from "@/components/ui/DatePicker";

// Hoy fijo: jueves 26 de noviembre de 2026, a mediodía en Chile.
beforeEach(() => {
  olvidarActividad();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-26T15:00:00Z"));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({ ok: true, json: async () => ({ mes: url.slice(-7), dias: { "2026-11-12": 3 } }) }))
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function Rango() {
  const [v, setV] = useState({ d: "", h: "" });
  return (
    <>
      <DatePicker modo="range" etiqueta="Período" desde={v.d} hasta={v.h} onChange={(d, h) => setV({ d, h })} />
      <output data-testid="valor">{`${v.d}|${v.h}`}</output>
    </>
  );
}
function Uno({ minimo }: { minimo?: string }) {
  const [v, setV] = useState("");
  return (
    <>
      <DatePicker modo="single" etiqueta="Fecha" valor={v} minimo={minimo} onChange={setV} />
      <output data-testid="valor">{v}</output>
    </>
  );
}
const valor = () => screen.getByTestId("valor").textContent;
const dia = (n: number, mes = "noviembre") => screen.getByRole("button", { name: new RegExp(`^${n} de ${mes} de 2026`) });

describe("DatePicker · modo range", () => {
  it("abre con atajos, calendario y pie; el atajo marca el rango y Aplicar devuelve dd-mm-aaaa", async () => {
    const u = userEvent.setup();
    render(<Rango />);
    await u.click(screen.getByRole("button", { name: "Período" }));
    const dlg = screen.getByRole("dialog", { name: "Período" });
    expect(within(dlg).getByText("Noviembre 2026")).toBeInTheDocument();
    expect(within(dlg).getAllByText(/^[LMJVSD]$/).map((n) => n.textContent).join("")).toBe("LMMJVSD");
    for (const a of ["Hoy", "Últimos 7 días", "Últimos 30 días", "Este mes", "Mes anterior", "Este año", "Año anterior"])
      expect(within(dlg).getByRole("button", { name: a })).toBeInTheDocument();
    await u.click(within(dlg).getByRole("button", { name: "Últimos 7 días" }));
    expect(within(dlg).getByRole("button", { name: "Últimos 7 días" })).toHaveAttribute("aria-pressed", "true");
    expect(within(dlg).getByText("20 nov – 26 nov 2026")).toBeInTheDocument();
    expect(dia(20)).toHaveClass("es-ini");
    expect(dia(23)).toHaveClass("es-dentro");
    expect(dia(26)).toHaveClass("es-fin");
    await u.click(within(dlg).getByRole("button", { name: "Aplicar" }));
    expect(valor()).toBe("20-11-2026|26-11-2026");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Período: 20 nov – 26 nov 2026" })).toBeInTheDocument();
  });

  it("los días futuros y el mes siguiente quedan desactivados; hoy lleva su marca", async () => {
    const u = userEvent.setup();
    render(<Rango />);
    await u.click(screen.getByRole("button", { name: "Período" }));
    expect(dia(27)).toBeDisabled();
    expect(dia(26)).toHaveAttribute("aria-current", "date");
    expect(screen.getByRole("button", { name: "Ver mes siguiente" })).toBeDisabled();
    await u.click(screen.getByRole("button", { name: "Ver mes anterior" }));
    expect(screen.getByText("Octubre 2026")).toBeInTheDocument();
  });

  it("dos clics eligen el rango, en cualquier orden; Limpiar lo vacía", async () => {
    const u = userEvent.setup();
    render(<Rango />);
    await u.click(screen.getByRole("button", { name: "Período" }));
    await u.click(dia(19));
    await u.click(dia(12));
    expect(screen.getByText("Desde 12 nov 2026")).toBeInTheDocument();
    await u.click(dia(19));
    expect(screen.getByText("12 nov – 19 nov 2026")).toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: "Limpiar" }));
    expect(dia(12)).not.toHaveClass("es-ini");
    await u.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(valor()).toBe("|");
  });

  it("marca con un punto los días con visitas, con una consulta por mes", async () => {
    const u = userEvent.setup();
    render(<Rango />);
    await u.click(screen.getByRole("button", { name: "Período" }));
    await act(async () => {});
    expect(dia(12)).toHaveClass("con-visitas");
    expect(dia(12)).toHaveAccessibleName(/3 visitas/);
    expect(dia(13)).not.toHaveClass("con-visitas");
    expect(fetch).toHaveBeenCalledWith("/api/visitas/actividad?mes=2026-11", expect.anything());
  });
});

describe("DatePicker · modo single", () => {
  it("sin atajos; respeta el mínimo (no permite fechas pasadas) y deja elegir futuras", async () => {
    const u = userEvent.setup();
    render(<Uno minimo="26-11-2026" />);
    await u.click(screen.getByRole("button", { name: "Fecha" }));
    expect(screen.queryByRole("button", { name: "Últimos 7 días" })).not.toBeInTheDocument();
    expect(dia(25)).toBeDisabled();
    expect(screen.getByRole("button", { name: "Ver mes siguiente" })).toBeEnabled();
    await u.click(dia(28));
    await u.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(valor()).toBe("28-11-2026");
  });

  it("teclado: flechas mueven el foco, Enter elige y Esc cierra devolviendo el foco", async () => {
    const u = userEvent.setup();
    render(<Uno />);
    const campo = screen.getByRole("button", { name: "Fecha" });
    await u.click(campo);
    expect(dia(26)).toHaveFocus();
    await u.keyboard("{ArrowRight}{ArrowDown}");
    expect(dia(4, "diciembre")).toHaveFocus();
    expect(screen.getByText("Diciembre 2026")).toBeInTheDocument();
    await u.keyboard("{ArrowUp}{Enter}");
    expect(screen.getByText("27 nov 2026")).toBeInTheDocument();
    await u.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(campo).toHaveFocus();
    expect(valor()).toBe("");
  });
});

describe("textoPeriodo", () => {
  it("da el rango en el formato del sistema", () => {
    expect(textoPeriodo("2026-11-12", "2026-11-19")).toBe("12 nov – 19 nov 2026");
    expect(textoPeriodo("2025-12-20", "2026-01-05")).toBe("20 dic 2025 – 5 ene 2026");
    expect(textoPeriodo("2026-11-12", "2026-11-12")).toBe("12 nov 2026");
    expect(textoPeriodo("", "")).toBe("");
  });
});
