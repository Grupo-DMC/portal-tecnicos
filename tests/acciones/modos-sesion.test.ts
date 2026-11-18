import { beforeEach, describe, expect, it, vi } from "vitest";

// Varios roles por cuenta (migración 044): la autorización de punta a punta
// para cada perfil en cada modo. La sesión es la real (lib/auth); lo falso es
// la base (tests/helpers/sesion).

vi.mock("@/lib/data/reservas");
vi.mock("@/lib/data/visitas");
vi.mock("@/lib/data/auditoria");
vi.mock("@/lib/data/push-baja");

import { getSesion, sesionCon } from "@/lib/auth";
import { cambiarModoAction } from "@/app/actions/auth";
import { renovarReservaAction } from "@/app/actions/reservas";
import { GET as getMedios } from "@/app/api/visita/medios/[folio]/route";
import { GET as getNotificaciones } from "@/app/api/notificaciones/route";
import { liberarReservasDelUsuario, tomarReserva } from "@/lib/data/reservas";
import { getVisitaCompletaPorFolio } from "@/lib/data/visitas";
import { auditar } from "@/lib/data/auditoria";
import { TODOS_LOS_PERMISOS, TODOS_LOS_PERMISOS_CELULAR } from "@/lib/permisos";
import {
  TECNICO_PRUEBA,
  cookiesEscritas,
  destinoDeRedirect,
  entrarComo,
  formulario,
  salir,
  type Perfil,
} from "../helpers/sesion";
import type { Modo } from "@/lib/roles";

beforeEach(() => {
  vi.resetAllMocks();
  salir();
});

const AJENO = 999;
const visita = (tecnicoId: number) => ({
  folio: "V-1",
  tecnicoId,
  tecnicoAyudanteId: null,
  sucursal: { nombre: "Tienda" },
  cliente: { razonSocial: "Cliente SpA", nombreFantasia: "Cliente" },
  fotos: [],
  videos: [],
  adjuntos: [],
});
const params = { params: Promise.resolve({ folio: "V-1" }) };
const peticion = () => new Request("http://localhost/api/visita/medios/V-1");

describe("la sesión resuelve el modo con los roles de la base", () => {
  it.each<[Perfil, Modo | undefined, Modo, Modo[]]>([
    ["tecnico", undefined, "tecnico", ["tecnico"]],
    ["admin", undefined, "panel", ["panel"]],
    ["coordinador", undefined, "panel", ["panel"]],
    ["admin+tecnico", undefined, "panel", ["panel", "tecnico"]],
    ["admin+tecnico", "tecnico", "tecnico", ["panel", "tecnico"]],
    ["coordinador+tecnico", "tecnico", "tecnico", ["panel", "tecnico"]],
    // Lo que diga el token no da un modo que la cuenta no tiene.
    ["tecnico", "panel", "tecnico", ["tecnico"]],
    ["admin", "tecnico", "panel", ["panel"]],
  ])("%s con el token en %s → %s", async (perfil, pedido, modo, modos) => {
    entrarComo(perfil, pedido ? { modo: pedido } : {});
    const s = await getSesion();
    expect(s?.modo).toBe(modo);
    expect(s?.modos).toEqual(modos);
  });

  it("el técnico vinculado solo aparece en modo técnico", async () => {
    entrarComo("admin+tecnico");
    expect((await getSesion())?.tecnico).toBeNull();
    entrarComo("admin+tecnico", { modo: "tecnico" });
    expect((await getSesion())?.tecnico?.id).toBe(TECNICO_PRUEBA.id);
  });

  it("los permisos son los del modo: todos en el panel, los del celular como técnico", async () => {
    entrarComo("admin+tecnico");
    expect((await getSesion())?.permisos).toEqual(TODOS_LOS_PERMISOS);
    entrarComo("admin+tecnico", { modo: "tecnico" });
    expect((await getSesion())?.permisos).toEqual(TODOS_LOS_PERMISOS_CELULAR);
  });

  it("si el técnico vinculado se desactiva, la cuenta doble sigue en el panel y el técnico puro pierde la sesión", async () => {
    entrarComo("admin+tecnico", { modo: "tecnico", tecnicoInactivo: true });
    const s = await getSesion();
    expect(s?.modo).toBe("panel");
    expect(s?.modos).toEqual(["panel"]);
    entrarComo("tecnico", { tecnicoInactivo: true });
    expect(await getSesion()).toBeNull();
  });
});

describe("sesionCon: la puerta de las acciones del panel", () => {
  it.each<[Perfil, Modo | undefined, boolean]>([
    ["tecnico", undefined, false],
    ["admin", undefined, true],
    ["coordinador", undefined, true],
    ["admin+tecnico", "panel", true],
    ["admin+tecnico", "tecnico", false],
    ["coordinador+tecnico", "panel", true],
    ["coordinador+tecnico", "tecnico", false],
  ])("%s en modo %s → %s", async (perfil, modo, abre) => {
    entrarComo(perfil, modo ? { modo } : {});
    expect(!!(await sesionCon("visitas.ver"))).toBe(abre);
  });
});

describe("acciones de técnico (reserva del acta)", () => {
  beforeEach(() => vi.mocked(tomarReserva).mockResolvedValue({ ok: true } as never));

  it.each<[Perfil, Modo | undefined, boolean]>([
    ["tecnico", undefined, true],
    ["admin", undefined, false],
    ["coordinador", undefined, false],
    ["admin+tecnico", "panel", false],
    ["admin+tecnico", "tecnico", true],
    ["coordinador+tecnico", "panel", false],
    ["coordinador+tecnico", "tecnico", true],
  ])("%s en modo %s → %s", async (perfil, modo, puede) => {
    entrarComo(perfil, modo ? { modo } : {});
    const r = await renovarReservaAction("V-1");
    expect(r.ok).toBe(puede);
    if (puede) {
      // Siempre con SU técnico vinculado.
      expect(tomarReserva).toHaveBeenCalledWith("V-1", expect.objectContaining({ tecnicoId: TECNICO_PRUEBA.id }));
    } else {
      expect(tomarReserva).not.toHaveBeenCalled();
    }
  });
});

describe("evidencia de un acta (/api/visita/medios)", () => {
  it.each<[Perfil, Modo | undefined, number, number]>([
    // propia → 200; ajena → 404 en modo técnico, 200 en el panel
    ["tecnico", undefined, TECNICO_PRUEBA.id, 200],
    ["tecnico", undefined, AJENO, 404],
    ["admin+tecnico", "tecnico", TECNICO_PRUEBA.id, 200],
    ["admin+tecnico", "tecnico", AJENO, 404],
    ["coordinador+tecnico", "tecnico", AJENO, 404],
    ["admin+tecnico", "panel", AJENO, 200],
    ["coordinador+tecnico", "panel", AJENO, 200],
    ["admin", undefined, AJENO, 200],
  ])("%s en modo %s, visita del técnico %s → %s", async (perfil, modo, tecnicoId, status) => {
    entrarComo(perfil, modo ? { modo } : {});
    vi.mocked(getVisitaCompletaPorFolio).mockResolvedValue(visita(tecnicoId) as never);
    expect((await getMedios(peticion(), params)).status).toBe(status);
  });
});

describe("la campanita es del panel", () => {
  it.each<[Perfil, Modo | undefined, number]>([
    ["tecnico", undefined, 404],
    ["admin+tecnico", "tecnico", 404],
  ])("%s en modo %s → %s", async (perfil, modo, status) => {
    entrarComo(perfil, modo ? { modo } : {});
    expect((await getNotificaciones()).status).toBe(status);
  });
});

describe("cambiarModoAction («Ir al panel de técnico» / «Volver al panel de admin»)", () => {
  const pedir = (modo: string) => destinoDeRedirect(() => cambiarModoAction(formulario({ modo })));
  const tokenFirmado = () => cookiesEscritas.find((c) => c.nombre === "dmc_session")?.valor;

  it("sin sesión va al login", async () => {
    expect(await pedir("tecnico")).toBe("/login");
  });

  it("admin + técnico pasa al panel de técnico sin pedir la clave, y queda anotado", async () => {
    entrarComo("admin+tecnico");
    expect(await pedir("tecnico")).toBe("/tecnico");
    expect(tokenFirmado()).toBe("token-firmado-falso:tecnico");
    expect(auditar).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ accion: "sesion.modo", detalle: { de: "panel", a: "tecnico" } })
    );
    // Entrando al panel de técnico no hay reservas que soltar.
    expect(liberarReservasDelUsuario).not.toHaveBeenCalled();
  });

  it("coordinador + técnico vuelve al panel y suelta sus actas tomadas", async () => {
    entrarComo("coordinador+tecnico", { modo: "tecnico" });
    expect(await pedir("panel")).toBe("/admin");
    expect(tokenFirmado()).toBe("token-firmado-falso:panel");
    expect(liberarReservasDelUsuario).toHaveBeenCalledWith(6);
  });

  it("un técnico puro que pide el panel se queda en el suyo, sin token nuevo", async () => {
    entrarComo("tecnico");
    expect(await pedir("panel")).toBe("/tecnico");
    expect(tokenFirmado()).toBeUndefined();
    expect(auditar).not.toHaveBeenCalled();
  });

  it("un admin puro que pide el modo técnico se queda en el panel", async () => {
    entrarComo("admin");
    expect(await pedir("tecnico")).toBe("/admin");
    expect(tokenFirmado()).toBeUndefined();
  });

  it("con el técnico vinculado desactivado no se puede pasar a técnico", async () => {
    entrarComo("admin+tecnico", { tecnicoInactivo: true });
    expect(await pedir("tecnico")).toBe("/admin");
    expect(tokenFirmado()).toBeUndefined();
  });

  it("un modo inventado no cambia nada", async () => {
    entrarComo("admin+tecnico");
    expect(await pedir("root")).toBe("/admin");
    expect(tokenFirmado()).toBeUndefined();
  });

  it("pedir el modo en que ya está no re-firma nada", async () => {
    entrarComo("admin+tecnico", { modo: "tecnico" });
    expect(await pedir("tecnico")).toBe("/tecnico");
    expect(tokenFirmado()).toBeUndefined();
  });

  it("quien tiene la clave pendiente de cambiar no cambia de modo", async () => {
    entrarComo("admin+tecnico", { debeCambiarPassword: true });
    expect(await pedir("tecnico")).toBe("/cambiar-password");
    expect(tokenFirmado()).toBeUndefined();
  });
});
