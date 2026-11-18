import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/problemas-visita", () => ({ registrarProblemasVisitaAction: vi.fn() }));

import ProblemasVisitaDialogo from "@/components/admin/ProblemasVisitaDialogo";
import { registrarProblemasVisitaAction } from "@/app/actions/problemas-visita";
import { pintar, visitaFalsa } from "../helpers/componentes";
import type { CatalogoProblema, Visita } from "@/lib/types";

const opcion = (id: number, etiqueta: string, permiteCantidad = true) => ({
  id,
  problemaId: 1,
  etiqueta,
  orden: id,
  permiteCantidad,
  activo: true,
});

const catalogo: CatalogoProblema[] = [
  {
    id: 1,
    codigo: "ANTENA_NO_DETECTA",
    nombre: "Antena no detecta",
    grupoLabel: "Equipos afectados",
    singular: "equipo",
    ayuda: null,
    orden: 1,
    activo: true,
    opciones: [opcion(1, "Antena 1"), opcion(2, "Antena 2")],
  },
  { id: 2, codigo: "OTRO", nombre: "Otro", grupoLabel: null, singular: null, ayuda: null, orden: 2, activo: true, opciones: [] },
];

function abrir(visita: Visita = visitaFalsa()) {
  const onCerrar = vi.fn();
  const onHecho = vi.fn();
  pintar(<ProblemasVisitaDialogo visita={visita} onCerrar={onCerrar} onHecho={onHecho} />, { problemas: catalogo });
  return { onCerrar, onHecho, visita };
}

beforeEach(() => {
  vi.mocked(registrarProblemasVisitaAction).mockResolvedValue({ ok: true });
});

describe("con categorías de problema (migración 040)", () => {
  // «Otros» va primero: el tipo que se ofrece al agregar sale de la primera categoría.
  const conCategorias: CatalogoProblema[] = [
    { ...catalogo[0], seccion: "Antenas", seccionOrden: 2 },
    { ...catalogo[1], seccion: "Otros", seccionOrden: 1 },
  ];

  it("se elige primero la categoría y después el tipo dentro de ella", async () => {
    const u = userEvent.setup();
    pintar(<ProblemasVisitaDialogo visita={visitaFalsa()} onCerrar={vi.fn()} onHecho={vi.fn()} />, { problemas: conCategorias });
    await u.click(screen.getByRole("button", { name: "Agregar un problema" }));

    const categoria = screen.getByRole("combobox", { name: "Categoría del problema" });
    const tipo = screen.getByRole("combobox", { name: "Tipo de problema" });
    expect(categoria).toHaveAttribute("placeholder", "Otros");
    expect(tipo).toHaveAttribute("placeholder", "Otro");

    // Otra categoría: queda elegido su primer tipo, y el tipo solo ofrece los de ella.
    await u.click(categoria);
    await u.click(screen.getByRole("option", { name: /Antenas/ }));
    expect(screen.getByRole("combobox", { name: "Tipo de problema" })).toHaveAttribute("placeholder", "Antena no detecta");
    await u.click(screen.getByRole("combobox", { name: "Tipo de problema" }));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Antena no detecta"]);
  });
});

describe("registrar problemas en una visita sin cerrar", () => {
  it("agrega un problema, marca el equipo, le pone la cantidad y lo guarda", async () => {
    const u = userEvent.setup();
    const { onCerrar, onHecho, visita } = abrir();
    expect(screen.getByText("Esta visita no tiene problemas registrados.")).toBeInTheDocument();

    await u.click(screen.getByRole("button", { name: "Agregar un problema" }));
    await u.click(screen.getByRole("checkbox", { name: /Antena 2/ }));
    await u.click(screen.getByRole("button", { name: "Uno más de Antena 2" }));
    await u.click(screen.getByRole("button", { name: "Uno más de Antena 2" }));
    await u.click(screen.getByRole("button", { name: "Guardar problemas" }));

    await waitFor(() => expect(onHecho).toHaveBeenCalledWith(`Problemas de la visita ${visita.folio} guardados`));
    expect(registrarProblemasVisitaAction).toHaveBeenCalledWith({
      folio: visita.folio,
      problemas: [{ id: null, tipoCodigo: "ANTENA_NO_DETECTA", descripcion: null, items: [{ etiqueta: "Antena 2", cantidad: 3 }] }],
    });
    expect(onCerrar).toHaveBeenCalled();
  });

  it("sin marcar ningún equipo no se guarda y dice qué falta", async () => {
    const u = userEvent.setup();
    abrir();
    await u.click(screen.getByRole("button", { name: "Agregar un problema" }));
    await u.click(screen.getByRole("button", { name: "Guardar problemas" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("En el problema «Antena no detecta» marca al menos un equipo.");
    expect(registrarProblemasVisitaAction).not.toHaveBeenCalled();
  });

  it("parte de los problemas que la visita ya tiene y los manda con su id al corregirlos o quitarlos", async () => {
    const u = userEvent.setup();
    const visita = visitaFalsa({
      problemas: [
        { id: 40, tipoCodigo: "ANTENA_NO_DETECTA", estado: "ABIERTO", descripcion: null, solucion: null, items: [{ id: 1, etiqueta: "Antena 1", cantidad: 2 }] },
        { id: 41, tipoCodigo: "OTRO", estado: "ABIERTO", descripcion: "Humedad", solucion: null, items: [] },
      ],
    });
    abrir(visita);
    // Se quita el segundo y se deja el primero.
    await u.click(screen.getByRole("button", { name: "Quitar el problema 2" }));
    await u.click(screen.getByRole("button", { name: "Guardar problemas" }));
    await waitFor(() => expect(registrarProblemasVisitaAction).toHaveBeenCalled());
    expect(registrarProblemasVisitaAction).toHaveBeenCalledWith({
      folio: visita.folio,
      problemas: [{ id: 40, tipoCodigo: "ANTENA_NO_DETECTA", descripcion: null, items: [{ etiqueta: "Antena 1", cantidad: 2 }] }],
    });
  });

  it("si el servidor lo rechaza, el motivo queda a la vista y el diálogo sigue abierto", async () => {
    const u = userEvent.setup();
    vi.mocked(registrarProblemasVisitaAction).mockResolvedValue({ ok: false, error: "Esta visita ya tiene el acta cerrada." });
    const { onCerrar, onHecho } = abrir();
    await u.click(screen.getByRole("button", { name: "Agregar un problema" }));
    await u.click(screen.getByRole("checkbox", { name: /Antena 1/ }));
    await u.click(screen.getByRole("button", { name: "Guardar problemas" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Esta visita ya tiene el acta cerrada.");
    expect(onHecho).not.toHaveBeenCalled();
    expect(onCerrar).not.toHaveBeenCalled();
  });
});
