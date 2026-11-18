import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/data/secciones-acta");
vi.mock("@/lib/data/auditoria");
vi.mock("@/lib/data/actividad");

import { revalidatePath } from "next/cache";
import { guardarSeccionesActaAction } from "@/app/actions/admin";
import { guardarSeccionesObligatorias } from "@/lib/data/secciones-acta";
import { auditar } from "@/lib/data/auditoria";
import { registrarActividad } from "@/lib/data/actividad";
import { entrarComo, salir } from "../helpers/sesion";

const config = { problemas: false, interno: true, fotos: true };

beforeEach(() => {
  vi.resetAllMocks();
  salir();
});

describe("guardarSeccionesActaAction (secciones obligatorias del acta)", () => {
  it("sin sesión, o con un rol que no edita el checklist, no guarda nada", async () => {
    expect((await guardarSeccionesActaAction(config)).ok).toBe(false);
    entrarComo("coordinador", { permisos: ["checklist.ver"] });
    expect(await guardarSeccionesActaAction(config)).toMatchObject({ ok: false, error: expect.stringMatching(/No tienes permiso/) });
    expect(guardarSeccionesObligatorias).not.toHaveBeenCalled();
  });

  it("un técnico no, aunque tenga permisos de celular", async () => {
    entrarComo("tecnico");
    expect((await guardarSeccionesActaAction(config)).ok).toBe(false);
    expect(guardarSeccionesObligatorias).not.toHaveBeenCalled();
  });

  it.each([
    ["faltan secciones", { fotos: true }],
    ["un valor que no es booleano", { problemas: "sí", interno: false, fotos: true }],
    ["nada", null],
  ])("rechaza un pedido mal formado (%s) sin tocar la base", async (_n, pedido) => {
    entrarComo("admin");
    expect((await guardarSeccionesActaAction(pedido as never)).ok).toBe(false);
    expect(guardarSeccionesObligatorias).not.toHaveBeenCalled();
  });

  it("guarda con quien lo hizo, audita, deja un aviso y revalida el panel y el celular", async () => {
    entrarComo("admin");
    vi.mocked(guardarSeccionesObligatorias).mockResolvedValue(config);
    const r = await guardarSeccionesActaAction(config);
    expect(r).toEqual({ ok: true, secciones: config });
    expect(guardarSeccionesObligatorias).toHaveBeenCalledWith(config, 1);
    expect(auditar).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ accion: "checklist.editar", entidad: "checklist" })
    );
    expect(registrarActividad).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/tecnico", "layout");
  });

  it("si la base falla responde un mensaje genérico, sin detalles internos, y no audita", async () => {
    entrarComo("admin");
    vi.mocked(guardarSeccionesObligatorias).mockRejectedValue(new Error("Login failed for user 'sa' en 10.0.0.5"));
    const r = await guardarSeccionesActaAction(config);
    expect(r.ok).toBe(false);
    expect((r as { error: string }).error).not.toMatch(/Login failed|10\.0\.0\.5/);
    expect(auditar).not.toHaveBeenCalled();
  });
});
