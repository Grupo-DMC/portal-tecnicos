import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const acciones = vi.hoisted(() => ({
  crearVisitaAction: vi.fn(),
  problemasSinResolverAction: vi.fn(),
  conflictosAgendaAction: vi.fn(),
  personasDelLocalAction: vi.fn(),
}));
vi.mock("@/app/actions/admin", () => acciones);
vi.mock("@/app/actions/personas-local", () => ({ personasDelLocalAction: acciones.personasDelLocalAction }));
vi.mock("@/app/actions/adjuntos", () => ({
  abrirAdjuntoAction: vi.fn(),
  subirTrozoAdjuntoAction: vi.fn(),
  cerrarAdjuntoAction: vi.fn(),
}));

import NuevaVisitaHoja, { esInstalacion, motivoDeSucursal, motivoPorDefecto, precargaDeProblema } from "@/components/admin/NuevaVisitaHoja";
import { hoyISO } from "@/lib/ui/fecha";
import { pintar } from "../helpers/componentes";
import type { CatalogoMotivo } from "@/lib/types";

const MOTIVOS = [
  { id: 1, codigo: "VISITA", nombre: "Visita preventiva", orden: 1, activo: true, seccion: "Antenas de seguridad", seccionOrden: 1 },
  { id: 2, codigo: "CAL", nombre: "Visita de calibración", orden: 2, activo: true, seccion: "Antenas de seguridad", seccionOrden: 1 },
  { id: 3, codigo: "INST", nombre: "Instalacion de antenas", orden: 3, activo: true, seccion: "Antenas de seguridad", seccionOrden: 1 },
  { id: 4, codigo: "REV", nombre: "Revisión de condiciones local", orden: 4, activo: true, seccion: "Antenas de seguridad", seccionOrden: 1 },
  { id: 5, codigo: "CONT", nombre: "Calibración de contadores de personas", orden: 5, activo: true, seccion: "Contadores de personas", seccionOrden: 2 },
] satisfies CatalogoMotivo[];

const REF = {
  permisos: ["visitas.ver", "visitas.crear"],
  clientes: [{ id: 1, nombreFantasia: "Cliente Uno", activo: true }],
  malls: [{ id: 7, nombre: "Mall Siete", activo: true }],
  sucursales: [
    { id: 10, clienteId: 1, mallId: null, nombre: "Tienda Centro", activo: true },
    { id: 11, clienteId: 1, mallId: 7, nombre: "Tienda Mall", activo: true },
  ],
  tecnicos: [
    { id: 100, nombreCompleto: "Ana Pérez", activo: true },
    { id: 101, nombreCompleto: "Beto Soto", activo: true },
  ],
  motivos: MOTIVOS,
  cargos: [{ id: 1, nombre: "Jefe de tienda" }],
};

const onHecho = vi.fn();
const onCerrar = vi.fn();
const onAviso = vi.fn();

beforeEach(() => {
  for (const f of [...Object.values(acciones), onHecho, onCerrar, onAviso]) f.mockReset();
  acciones.problemasSinResolverAction.mockResolvedValue({ ok: true, problemas: [] });
  acciones.conflictosAgendaAction.mockResolvedValue({ ok: true, conflictos: [] });
  acciones.personasDelLocalAction.mockResolvedValue([]);
  acciones.crearVisitaAction.mockResolvedValue({ ok: true, folio: "V-2026-00009" });
});

function abrir(props: Partial<React.ComponentProps<typeof NuevaVisitaHoja>> = {}) {
  const u = userEvent.setup();
  pintar(<NuevaVisitaHoja onCerrar={onCerrar} onAviso={onAviso} onHecho={onHecho} {...props} />, REF as never);
  return u;
}
const $ = (sel: string) => document.querySelector(sel) as HTMLElement;
const listo = () => waitFor(() => expect(acciones.problemasSinResolverAction).toHaveBeenCalled());

describe("reglas de la demo", () => {
  it("isInstall: «instal» cuenta, salvo «des instal», «re instal» y «reinstal»", () => {
    expect(esInstalacion(["Instalacion de antenas"])).toBe(true);
    expect(esInstalacion(["Instalación de contadores de personas"])).toBe(true);
    expect(esInstalacion(["Des Instalacion de antenas"])).toBe(false);
    expect(esInstalacion(["Re Instalacion de antenas"])).toBe(false);
    expect(esInstalacion(["Reinstalación de contadores"])).toBe(false);
    expect(esInstalacion(["Visita preventiva"])).toBe(false);
  });

  it("parte con «Visita de calibración»; desde una sucursal sin plan, con «Revisión de condiciones local»", () => {
    expect(motivoPorDefecto(MOTIVOS)).toEqual(["CAL"]);
    expect(motivoDeSucursal(MOTIVOS, true)).toEqual(["CAL"]);
    expect(motivoDeSucursal(MOTIVOS, false)).toEqual(["REV"]);
  });

  it("desde un problema: «Visita para resolver», con la sucursal, el técnico y el problema vinculado", () => {
    const p = precargaDeProblema(
      { problemaId: 5, folio: "V-1", clienteId: 1, sucursalId: 10, tipoCodigo: "X", tipoNombre: "Antena no detecta", descripcion: "Lado izquierdo", solucion: null },
      MOTIVOS,
      101
    );
    expect(p).toMatchObject({ sucursalId: 10, tecnicoId: 101, motivos: ["REV"], titulo: "Visita para resolver", problemaOrigenId: 5 });
    expect(p.trabajo).toBe('Resolver problema levantado en V-1: Antena no detecta. El técnico anotó: "Lado izquierdo".');
  });
});

describe("Nueva visita (hoja de la demo)", () => {
  it("abre sin subtítulo, sin números y con las filas plegables cerradas", () => {
    abrir();
    expect(screen.getByRole("heading", { name: "Nueva visita" })).toBeInTheDocument();
    expect(document.querySelector(".m-sub")).toBeNull();
    expect(($("#nvContacto") as HTMLDetailsElement).open).toBe(false);
    expect(screen.getByRole("checkbox", { name: /Visita de calibración/ })).toBeChecked();
    expect(screen.getByText("Principal")).toBeInTheDocument();
    expect($("#nvHoraLbl").textContent).toBe("Hora de llegada (opcional)");
    expect(screen.getByText("Contadores de personas").closest("button")).toHaveAttribute("aria-expanded", "false");
  });

  it("un grupo con motivos marcados no se pliega y lo avisa", async () => {
    const u = abrir();
    await u.click(screen.getByText("Antenas de seguridad"));
    expect(onAviso).toHaveBeenCalledWith("Este grupo tiene motivos marcados; se mantiene abierto.");
    expect(screen.getByText("Antenas de seguridad").closest("button")).toHaveAttribute("aria-expanded", "true");
  });

  it("la hora se vuelve obligatoria en vivo al marcar una instalación", async () => {
    const u = abrir();
    await u.click(screen.getByRole("checkbox", { name: /Instalacion de antenas/ }));
    expect($("#nvHoraLbl").textContent).toBe("Hora de llegada");
    await u.click(screen.getByRole("checkbox", { name: /Instalacion de antenas/ }));
    expect($("#nvHoraLbl").textContent).toBe("Hora de llegada (opcional)");
  });

  it("envía el RUT formateado, el teléfono con +56 y, con margen del mismo día, sin fecha límite", async () => {
    const u = abrir();
    await listo();
    await u.type($("#nvNecesita"), "Calibrar");
    await u.click($("#nvMargen"));
    await u.click($("#nvContacto summary"));
    await u.type($("#nvResp"), "María Soto");
    await u.selectOptions($("#nvCargo"), "Jefe de tienda");
    await u.type($("#nvRut"), "123456785");
    await u.tab();
    expect(($("#nvRut") as HTMLInputElement).value).toBe("12.345.678-5");
    await u.type($("#nvTel"), "2 2345 6789");
    await u.click(screen.getByRole("button", { name: "Programar visita" }));
    await waitFor(() => expect(acciones.crearVisitaAction).toHaveBeenCalledTimes(1));
    expect(acciones.crearVisitaAction).toHaveBeenCalledWith(
      expect.objectContaining({
        clienteId: 1,
        sucursalId: 10,
        tecnicoId: 100,
        motivoCodigo: "CAL",
        motivosCodigos: ["CAL"],
        fechaProgramada: hoyISO(),
        fechaHasta: null,
        trabajoSolicitado: "Calibrar",
        responsableNombre: "María Soto",
        responsableRut: "12.345.678-5",
        responsableTelefono: "+56 2 2345 6789",
        responsableCargo: "Jefe de tienda",
        problemaOrigenId: null,
      })
    );
    const [d, m, a] = hoyISO().split("-").reverse();
    await waitFor(() => expect(onHecho).toHaveBeenCalledWith(`Visita V-2026-00009 programada para Ana Pérez el ${d}/${m}/${a}.`, "V-2026-00009"));
    expect(onCerrar).toHaveBeenCalled();
  }, 15_000);

  it("con errores no envía, marca cada campo y abre el contacto si el error está adentro", async () => {
    const u = abrir();
    await u.click(screen.getByRole("checkbox", { name: /Visita de calibración/ }));
    await u.selectOptions($("#nvAyu"), "100");
    await u.click($("#nvContacto summary"));
    await u.type($("#nvTel"), "123");
    await u.click($("#nvContacto summary"));
    await u.click(screen.getByRole("button", { name: "Programar visita" }));
    expect(acciones.crearVisitaAction).not.toHaveBeenCalled();
    expect(($("#nvContacto") as HTMLDetailsElement).open).toBe(true);
    expect($("#nvMotMsg").textContent).toBe("Marca al menos un motivo.");
    expect($("#nvAyuMsg").textContent).toBe("El ayudante debe ser otro técnico.");
    expect($("#nvNecesitaMsg").textContent).toBe("Escribe qué hay que hacer.");
    expect($("#nvTelMsg").textContent).toBe("Escribe los 9 dígitos que van después de +56 (ej.: 9 1234 5678 o 2 2345 6789).");
    expect($("#nvAyu")).toHaveAttribute("aria-invalid", "true");
    expect($("#nvTel")).toHaveAttribute("aria-invalid", "true");
  });

  it("«Buscar por mall» lista malls y las tiendas de ese mall", async () => {
    const u = abrir();
    await u.click($("#nvByMall"));
    expect($("#nvClienteLbl").textContent).toBe("Mall");
    expect(($("#nvCliente") as HTMLSelectElement).selectedOptions[0].textContent).toBe("Mall Siete");
    expect(($("#nvSuc") as HTMLSelectElement).selectedOptions[0].textContent).toBe("Cliente Uno, Tienda Mall");
  });

  it("precarga desde una sucursal: título, motivo y el contacto abierto con su nombre", () => {
    abrir({ precarga: { sucursalId: 11, motivos: ["REV"], titulo: "Nueva visita a Tienda Mall", contacto: { nombre: "Rosa Díaz", cargo: "Jefe de tienda" } } });
    expect(screen.getByRole("heading", { name: "Nueva visita a Tienda Mall" })).toBeInTheDocument();
    expect(($("#nvSuc") as HTMLSelectElement).value).toBe("11");
    expect(screen.getByRole("checkbox", { name: /Revisión de condiciones local/ })).toBeChecked();
    expect(($("#nvContacto") as HTMLDetailsElement).open).toBe(true);
    expect($("#nvContactoSum").textContent).toBe("Rosa Díaz");
    expect(($("#nvCargo") as HTMLSelectElement).value).toBe("Jefe de tienda");
  });

  it("Esc cierra el panel", async () => {
    const u = abrir();
    await u.keyboard("{Escape}");
    expect(onCerrar).toHaveBeenCalled();
  });
});
