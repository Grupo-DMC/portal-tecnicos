import { describe, expect, it } from "vitest";
import { autoriaDeBaja, motivoParaGuardar, MOTIVO_MAXIMO, problemaDeBaja } from "@/lib/ui/estado-activo";

// El motivo obligatorio al desactivar (migración 039): la misma regla vale en
// el formulario y en la acción del servidor.

describe("problemaDeBaja", () => {
  it("activo no pide nada", () => {
    expect(problemaDeBaja(true, null, "la marca")).toBeNull();
    expect(problemaDeBaja(true, "", "la marca")).toBeNull();
  });

  it("inactivo sin motivo, o solo con espacios, se rechaza nombrando qué se desactiva", () => {
    expect(problemaDeBaja(false, null, "la marca")).toBe("Explica por qué se desactiva la marca.");
    expect(problemaDeBaja(false, "   ", "el técnico")).toBe("Explica por qué se desactiva el técnico.");
  });

  it("un motivo que no explica nada tampoco sirve", () => {
    expect(problemaDeBaja(false, " ok ", "el mall")).toMatch(/muy corto/);
  });

  it("acepta un motivo de verdad y rechaza uno más largo que la columna", () => {
    expect(problemaDeBaja(false, "Cerró el local", "la sucursal")).toBeNull();
    expect(problemaDeBaja(false, "x".repeat(MOTIVO_MAXIMO + 1), "la sucursal")).toMatch(/400/);
  });
});

describe("motivoParaGuardar", () => {
  it("recorta el motivo de un inactivo y lo borra al reactivar", () => {
    expect(motivoParaGuardar(false, "  Cerró el local ")).toBe("Cerró el local");
    expect(motivoParaGuardar(true, "Cerró el local")).toBeNull();
    expect(motivoParaGuardar(false, "  ")).toBeNull();
  });
});

describe("autoriaDeBaja", () => {
  it("dice quién y cuándo, con el género de lo que se desactivó", () => {
    expect(autoriaDeBaja({ por: "ana@example.com", en: "2026-11-12T10:30:00" })).toBe(
      "Desactivado por ana@example.com el 12-11-2026"
    );
    expect(autoriaDeBaja({ por: null, en: "2026-11-12T10:30:00" }, true)).toBe("Desactivada el 12-11-2026");
  });

  it("lo desactivado antes del historial lo dice en vez de inventar", () => {
    expect(autoriaDeBaja({ por: null, en: null })).toMatch(/antes de que el sistema registrara/);
  });
});
