import { describe, expect, it } from "vitest";
import {
  GRUPOS_NOTIFICACION,
  TIPOS_NOTIFICACION,
  cuandoFue,
  gruposVisibles,
  nivelDe,
  preferenciasParaGuardar,
  tiposPara,
} from "@/lib/notificaciones";
import { MODULOS } from "@/lib/permisos";

const TODOS = MODULOS.flatMap((m) => m.acciones.map((a) => `${m.clave}.${a.clave}`));

describe("catálogo de notificaciones", () => {
  it("las claves no se repiten y cada tipo pide un permiso que existe", () => {
    const claves = TIPOS_NOTIFICACION.map((t) => t.clave);
    expect(new Set(claves).size).toBe(claves.length);
    for (const t of TIPOS_NOTIFICACION) {
      expect(TODOS, t.clave).toContain(t.permiso);
      expect(t.clave.length).toBeLessThanOrEqual(40); // dmc.actividad.tipo varchar(40)
    }
  });

  it("por defecto avisa cuando un técnico completa una visita", () => {
    expect(nivelDe({}, "tecnico.cierre")).toBe("AVISAR");
    expect(nivelDe({ "tecnico.cierre": "OCULTAR" }, "tecnico.cierre")).toBe("OCULTAR");
    // Un nivel que no existe vale el defecto; un tipo desconocido, oculto.
    expect(nivelDe({ "tecnico.cierre": "OTRO" as never }, "tecnico.cierre")).toBe("AVISAR");
    expect(nivelDe({}, "no.existe")).toBe("OCULTAR");
  });
});

describe("tiposPara", () => {
  it("sin el permiso del módulo no llega nada de ese módulo", () => {
    const { mostrar, avisar } = tiposPara(["clientes.ver"], {});
    expect(mostrar).toEqual(["maestro.clientes"]);
    expect(avisar).toEqual([]);
  });

  it("separa lo que se muestra de lo que además avisa, según las preferencias", () => {
    const { mostrar, avisar } = tiposPara(TODOS, { "tecnico.inicio": "AVISAR", "visita.alta": "OCULTAR" });
    expect(avisar).toContain("tecnico.cierre");
    expect(avisar).toContain("tecnico.inicio");
    expect(mostrar).not.toContain("visita.alta");
    expect(mostrar).not.toContain("gestion.pendiente"); // oculto por defecto
    for (const a of avisar) expect(mostrar).toContain(a);
  });
});

describe("preferenciasParaGuardar", () => {
  it("guarda solo lo que difiere del defecto, de tipos que existen y que puede ver", () => {
    expect(
      preferenciasParaGuardar(["visitas.ver"], {
        "tecnico.cierre": "AVISAR", // igual al defecto
        "tecnico.inicio": "OCULTAR",
        "maestro.clientes": "OCULTAR", // sin permiso
        "inventado.algo": "AVISAR",
        "visita.alta": "RARO" as never,
      })
    ).toEqual({ "tecnico.inicio": "OCULTAR" });
  });
});

describe("gruposVisibles", () => {
  it("deja fuera los grupos sin ningún tipo visible", () => {
    const grupos = gruposVisibles(["usuarios.ver"]);
    expect(grupos.map((g) => g.clave)).toEqual(["maestros"]);
    expect(grupos[0].tipos.map((t) => t.clave)).toEqual(["cuenta.cambio"]);
    expect(gruposVisibles(TODOS)).toHaveLength(GRUPOS_NOTIFICACION.length);
  });
});

describe("cuandoFue", () => {
  const ahora = new Date(2026, 10, 9, 15, 30, 0);
  it("dice cuánto hace, con palabras", () => {
    expect(cuandoFue("2026-11-09T15:29:40", ahora)).toBe("recién");
    expect(cuandoFue("2026-11-09T15:05:00", ahora)).toBe("hace 25 min");
    expect(cuandoFue("2026-11-09T09:07:00", ahora)).toBe("hoy 09:07");
    expect(cuandoFue("2026-11-08T22:00:00", ahora)).toBe("ayer 22:00");
    expect(cuandoFue("2026-11-03T08:15:00", ahora)).toBe("3 nov 08:15");
    expect(cuandoFue("no-es-fecha", ahora)).toBe("");
  });
});
