import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { BandejaNotificaciones, Notificacion } from "@/lib/notificaciones";

// La campanita con el diseño de la demo: hoja lateral .sheet.ntf, pestañas,
// grupos Hoy/Ayer/Antes, «Nuevo», leídas por aviso y «Qué quiero ver».

const acciones = vi.hoisted(() => ({
  marcarNotificacionesLeidasAction: vi.fn(async () => ({ ok: true })),
  guardarConfiguracionAvisosAction: vi.fn(),
}));
vi.mock("@/app/actions/notificaciones", () => acciones);

import Campanita from "@/components/admin/Campanita";

const AHORA = new Date(2026, 10, 26, 12, 0, 0);
const hace = (min: number) => {
  const d = new Date(AHORA.getTime() - min * 60000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`;
};
const nota = (o: Partial<Notificacion> & { id: number }): Notificacion => ({
  creadoEn: hace(10),
  tipo: "tecnico.cierre",
  actor: "Manuel Zambrano",
  propia: false,
  deTecnico: true,
  texto: "cerró el acta de V-2026-01080",
  detalle: "Ripley, Mall Plaza Vespucio",
  enlace: "/admin/visitas/V-2026-01080",
  nueva: false,
  ...o,
});

function bandeja(): BandejaNotificaciones {
  return {
    noLeidas: 2,
    configuracion: { niveles: {}, verPropios: true },
    items: [
      nota({ id: 5, nueva: true }),
      nota({ id: 4, tipo: "cuenta.password", actor: null, deTecnico: false, texto: "Se pidió una contraseña nueva", detalle: "rdiaz@grupodmc.cl", enlace: "/admin/usuarios?vista=contrasenas", nueva: true, creadoEn: hace(60) }),
      nota({ id: 3, tipo: "tecnico.inicio", texto: "inició la visita V-2026-01080", creadoEn: hace(26 * 60) }),
      nota({ id: 2, propia: true, actor: "Harold", deTecnico: false, tipo: "visita.alta", texto: "agendó la visita V-2026-01084", detalle: null, creadoEn: hace(30 * 60) }),
    ],
  };
}

let datos: BandejaNotificaciones;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AHORA);
  window.localStorage.clear();
  datos = bandeja();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(datos), { status: 200 })));
  acciones.marcarNotificacionesLeidasAction.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function abrir() {
  const u = userEvent.setup();
  render(<Campanita usuarioId={7} permisos={["visitas.ver", "usuarios.ver", "usuarios.contrasenas"]} variante="menu" />);
  const campana = await screen.findByRole("button", { name: "Notificaciones, 2 avisos nuevos" });
  expect(within(campana).getByText("2")).toHaveClass("ntf-badge");
  await u.click(campana);
  const hoja = await screen.findByRole("dialog", { name: "Notificaciones" });
  return { u, hoja, campana };
}

describe("Campanita", () => {
  it("abre la hoja lateral de la demo con encabezado, pestañas y grupos por día", async () => {
    const { hoja } = await abrir();
    expect(hoja).toHaveClass("sheet", "ntf");
    expect(hoja.parentElement?.querySelector(".ov")).not.toBeNull();
    expect(within(hoja).getByText("2 avisos sin leer")).toBeInTheDocument();
    expect(within(hoja).getByRole("button", { name: "Marcar todo como leído" })).toBeInTheDocument();
    expect(within(hoja).getByRole("button", { name: "Qué quiero ver" })).toBeInTheDocument();
    expect(within(hoja).getByRole("button", { name: "Cerrar" })).toHaveFocus();

    const tabs = within(hoja).getAllByRole("tab").map((t) => t.textContent);
    expect(tabs).toEqual(["Todo4", "Avisos2", "Mis cambios"]);

    const dias = [...hoja.querySelectorAll(".ntf-day")].map((d) => d.textContent);
    expect(dias).toEqual(["Hoy", "Ayer"]);

    const primero = hoja.querySelector(".ntf-it")!;
    expect(primero).toHaveClass("unread", "lv-a", "c-tec");
    expect(primero.querySelector(".ntf-ic")?.textContent).toBe("MZ");
    expect(primero.querySelector(".ntf-t b.num")?.textContent).toBe("V-2026-01080");
    expect(primero.querySelector(".ntf-m")?.textContent).toBe("hace 10 min, desde el celularTerrenoNuevo");

    // La solicitud de contraseña: quien pide es el correo, y se atiende en Usuarios.
    const pass = hoja.querySelectorAll(".ntf-it")[1];
    expect(pass.querySelector(".ntf-t")?.textContent).toBe("rdiaz@grupodmc.cl pidió una contraseña nueva");
    expect(pass.getAttribute("href")).toBe("/admin/usuarios?vista=contrasenas");
    expect(pass.querySelector(".ntf-cat")?.textContent).toBe("Maestros");

    // Lo propio: «TÚ», sin etiqueta de origen.
    const mio = hoja.querySelector(".ntf-it.c-mine")!;
    expect(mio.querySelector(".ntf-ic")?.textContent).toBe("TÚ");
    expect(mio.querySelector(".ntf-cat")).toBeNull();
    expect(mio.querySelector(".ntf-t")?.textContent).toBe("Tú agendaste la visita V-2026-01084");
    expect(screen.queryByText(/Cargando/)).toBeNull();
  });

  it("filtra por pestaña y muestra el vacío de la demo", async () => {
    datos.items = datos.items.filter((n) => n.tipo !== "tecnico.cierre" && n.tipo !== "cuenta.password");
    datos.noLeidas = 0;
    const u = userEvent.setup();
    render(<Campanita usuarioId={7} permisos={["visitas.ver"]} variante="menu" />);
    await u.click(await screen.findByRole("button", { name: "Notificaciones" }));
    const hoja = await screen.findByRole("dialog", { name: "Notificaciones" });
    expect(within(hoja).getByText("Estás al día")).toBeInTheDocument();
    await u.click(within(hoja).getByRole("tab", { name: /Avisos/ }));
    expect(within(hoja).getByText("Sin avisos pendientes")).toBeInTheDocument();
    await u.click(within(hoja).getByRole("tab", { name: "Mis cambios" }));
    expect(hoja.querySelectorAll(".ntf-it")).toHaveLength(1);
  });

  it("marca leído al tocar un aviso y «Marcar todo» avanza en el servidor", async () => {
    const { u, hoja, campana } = await abrir();
    const sinEnlace = hoja.querySelectorAll(".ntf-it")[0] as HTMLElement;
    expect(sinEnlace).toHaveClass("unread");
    await u.click(sinEnlace);
    expect(campana).toHaveAccessibleName("Notificaciones, 1 aviso nuevo");
    expect(JSON.parse(window.localStorage.getItem("dmc:ntf-leidas:7")!)).toEqual([5]);
    expect(acciones.marcarNotificacionesLeidasAction).not.toHaveBeenCalled();

    // Reabrir (el enlace cerró la hoja) y marcar todo.
    await u.click(campana);
    const otra = await screen.findByRole("dialog", { name: "Notificaciones" });
    await u.click(within(otra).getByRole("button", { name: "Marcar todo como leído" }));
    expect(acciones.marcarNotificacionesLeidasAction).toHaveBeenCalledWith(5);
    expect(campana).toHaveAccessibleName("Notificaciones");
    expect(within(otra).getByText("Estás al día")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Todo marcado como leído.");
  });

  it("Esc cierra y devuelve el foco a la campana", async () => {
    const { u, campana } = await abrir();
    await u.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(campana).toHaveFocus();
  });

  it("«Qué quiero ver»: segmentado Avisar/Mostrar/Ocultar con flechas, recomendado y guardar", async () => {
    acciones.guardarConfiguracionAvisosAction.mockImplementation(async (c: { niveles: Record<string, string>; verPropios: boolean }) => ({
      ok: true,
      bandeja: { ...datos, configuracion: c },
    }));
    const { u, hoja } = await abrir();
    await u.click(within(hoja).getByRole("button", { name: "Qué quiero ver" }));
    const cfg = await screen.findByRole("dialog", { name: "Qué quiero ver" });
    expect(within(cfg).getByRole("button", { name: "Volver a las notificaciones" })).toHaveFocus();
    expect(cfg.querySelector(".ntf-legend")).not.toBeNull();

    const grupo = within(cfg).getByRole("radiogroup", { name: "Inicia una visita" });
    expect(within(grupo).getByRole("radio", { name: "Mostrar" })).toHaveAttribute("aria-checked", "true");
    within(grupo).getByRole("radio", { name: "Mostrar" }).focus();
    await u.keyboard("{ArrowRight}");
    expect(within(grupo).getByRole("radio", { name: "Ocultar" })).toHaveAttribute("aria-checked", "true");
    await act(async () => new Promise<void>((r) => requestAnimationFrame(() => r())));
    expect(within(grupo).getByRole("radio", { name: "Ocultar" })).toHaveFocus();

    await u.click(within(cfg).getByRole("button", { name: "Volver a lo recomendado" }));
    expect(within(grupo).getByRole("radio", { name: "Mostrar" })).toHaveAttribute("aria-checked", "true");

    await u.click(within(grupo).getByRole("radio", { name: "Avisar" }));
    await u.click(within(cfg).getByRole("button", { name: "Guardar" }));
    expect(acciones.guardarConfiguracionAvisosAction).toHaveBeenCalledWith(
      expect.objectContaining({ verPropios: true, niveles: expect.objectContaining({ "tecnico.inicio": "AVISAR" }) })
    );
    expect(await screen.findByRole("dialog", { name: "Notificaciones" })).toBeInTheDocument();
    expect(screen.getByText("Preferencias de notificaciones guardadas.")).toBeInTheDocument();
  });

  it("mientras carga muestra la silueta, sin «Cargando…»", async () => {
    let soltar: (r: Response) => void = () => {};
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((r) => (soltar = r))));
    const u = userEvent.setup();
    render(<Campanita usuarioId={7} permisos={["visitas.ver"]} variante="menu" />);
    await u.click(screen.getByRole("button", { name: "Notificaciones" }));
    const hoja = screen.getByRole("dialog", { name: "Notificaciones" });
    expect(within(hoja).getByRole("status", { name: "Cargando notificaciones" })).toHaveAttribute("aria-busy", "true");
    expect(hoja.querySelectorAll(".sk").length).toBeGreaterThan(5);
    expect(hoja.textContent).not.toMatch(/Cargando/);
    await act(async () => soltar(new Response(JSON.stringify(datos), { status: 200 })));
  });
});
