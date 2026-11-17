import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/data/problemas-visita");
vi.mock("@/lib/data/auditoria");
vi.mock("@/lib/data/actividad");

import { revalidatePath } from "next/cache";
import { registrarProblemasVisitaAction } from "@/app/actions/problemas-visita";
import { guardarProblemasDeVisita } from "@/lib/data/problemas-visita";
import { auditar } from "@/lib/data/auditoria";
import { registrarActividad } from "@/lib/data/actividad";
import { entrarComo, salir } from "../helpers/sesion";

const pedido = (extra: Record<string, unknown> = {}) => ({
  folio: "V-2026-00001",
  problemas: [{ id: null, tipoCodigo: "ANTENA_NO_DETECTA", descripcion: null, items: [{ etiqueta: "Antena 2", cantidad: 3 }] }],
  ...extra,
});

beforeEach(() => {
  vi.resetAllMocks();
  salir();
});

describe("registrarProblemasVisitaAction", () => {
  describe("quién puede", () => {
    it("sin sesión no", async () => {
      expect((await registrarProblemasVisitaAction(pedido() as never)).ok).toBe(false);
      expect(guardarProblemasDeVisita).not.toHaveBeenCalled();
    });

    it("un técnico no, aunque tenga permisos de celular", async () => {
      entrarComo("tecnico");
      expect((await registrarProblemasVisitaAction(pedido() as never)).error).toMatch(/No tienes permiso/);
      expect(guardarProblemasDeVisita).not.toHaveBeenCalled();
    });

    it("sin «Corregir visitas» no, aunque pueda editar actas cerradas", async () => {
      entrarComo("coordinador", { permisos: ["visitas.ver", "visitas.editarActa"] });
      expect((await registrarProblemasVisitaAction(pedido() as never)).error).toMatch(/No tienes permiso/);
      expect(guardarProblemasDeVisita).not.toHaveBeenCalled();
    });

    it("el administrador sí", async () => {
      entrarComo("admin");
      vi.mocked(guardarProblemasDeVisita).mockResolvedValue({ ok: true, agregados: 1, modificados: 0, quitados: 0 });
      expect((await registrarProblemasVisitaAction(pedido() as never)).ok).toBe(true);
    });
  });

  describe("con el permiso", () => {
    beforeEach(() => entrarComo("coordinador", { permisos: ["visitas.ver", "visitas.editar"] }));

    it("guarda, lo deja en la auditoría y en la campanita, y refresca el panel", async () => {
      vi.mocked(guardarProblemasDeVisita).mockResolvedValue({ ok: true, agregados: 2, modificados: 1, quitados: 0 });
      const r = await registrarProblemasVisitaAction(pedido() as never);
      expect(r).toEqual({ ok: true, resumen: "agregó 2 problemas, corrigió 1 problema" });
      expect(guardarProblemasDeVisita).toHaveBeenCalledWith("V-2026-00001", expect.any(Array));
      expect(auditar).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ accion: "visita.problemas", entidadId: "V-2026-00001" }));
      expect(registrarActividad).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ tipo: "visita.cambio", folio: "V-2026-00001" }));
      expect(revalidatePath).toHaveBeenCalledWith("/admin/visitas/V-2026-00001");
    });

    it("un problema «Otro» sin descripción se rechaza antes de guardar", async () => {
      const r = await registrarProblemasVisitaAction(
        pedido({ problemas: [{ id: null, tipoCodigo: "OTRO", descripcion: "  ", items: [] }] }) as never
      );
      expect(r.error).toMatch(/«Otro»/);
      expect(guardarProblemasDeVisita).not.toHaveBeenCalled();
    });

    it("un folio o una lista mal formados se rechazan", async () => {
      expect((await registrarProblemasVisitaAction(pedido({ folio: "x".repeat(40) }) as never)).ok).toBe(false);
      expect((await registrarProblemasVisitaAction(pedido({ problemas: "no" }) as never)).ok).toBe(false);
      expect(guardarProblemasDeVisita).not.toHaveBeenCalled();
    });

    it("lo que la capa de datos rechaza llega tal cual y no deja rastro", async () => {
      vi.mocked(guardarProblemasDeVisita).mockResolvedValue({ ok: false, error: "Esta visita ya tiene el acta cerrada: agrega los problemas desde «Editar el acta»." });
      const r = await registrarProblemasVisitaAction(pedido() as never);
      expect(r).toEqual({ ok: false, error: "Esta visita ya tiene el acta cerrada: agrega los problemas desde «Editar el acta»." });
      expect(auditar).not.toHaveBeenCalled();
      expect(registrarActividad).not.toHaveBeenCalled();
    });

    it("si el tipo ya no está en el checklist, lo explica; si cae la base, no filtra el error", async () => {
      vi.mocked(guardarProblemasDeVisita).mockRejectedValueOnce(new Error("FOREIGN KEY constraint fk_problema_tipo"));
      expect((await registrarProblemasVisitaAction(pedido() as never)).error).toMatch(/ya no está en el checklist/);
      vi.mocked(guardarProblemasDeVisita).mockRejectedValueOnce(new Error("Login failed for user 'sa'"));
      const r = await registrarProblemasVisitaAction(pedido() as never);
      expect(r.error).toMatch(/No se pudo guardar en el servidor/);
      expect(r.error).not.toMatch(/Login failed/);
    });
  });
});
