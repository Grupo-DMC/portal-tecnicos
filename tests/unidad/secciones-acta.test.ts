import { describe, expect, it } from "vitest";
import {
  OBLIGATORIAS_POR_DEFECTO,
  SECCIONES_CONFIGURABLES,
  errorDeSeccionesObligatorias,
  faltaEnFotos,
  faltaEnInterno,
  queFaltaEnFotos,
} from "@/lib/contratos/secciones-acta";

const ninguna = { problemas: false, interno: false, fotos: false };
const foto = (interno = false) => ({ dataUrl: "data:image/jpeg;base64,AAAA", etiqueta: null, interno });
const acta = (extra: Record<string, unknown> = {}) =>
  ({ fotos: [], videosIds: [], comentarioInterno: null, internosCodigos: [], ...extra }) as never;

describe("secciones obligatorias del acta · reglas puras", () => {
  it("por defecto solo las fotos y el video del trabajo son obligatorios (la migración 042)", () => {
    expect(OBLIGATORIAS_POR_DEFECTO).toEqual({ problemas: false, interno: false, fotos: true });
  });

  it("el panel puede configurar exactamente las tres secciones opcionales, en el orden del formulario", () => {
    expect(SECCIONES_CONFIGURABLES.map((s) => [s.n, s.clave])).toEqual([
      [3, "problemas"],
      [4, "interno"],
      [5, "fotos"],
    ]);
  });

  describe("faltaEnFotos / queFaltaEnFotos", () => {
    it.each([
      [0, 0, true, "una foto y un video del trabajo"],
      [0, 2, true, "una foto del trabajo"],
      [3, 0, true, "un video del trabajo"],
      [3, 1, true, null],
      // El rol sin permiso de video solo necesita la foto.
      [0, 0, false, "una foto del trabajo"],
      [1, 0, false, null],
    ])("%i fotos, %i videos, exige video=%s → %s", (f, v, exige, esperado) => {
      expect(queFaltaEnFotos(f, v, exige)).toBe(esperado);
      expect(faltaEnFotos(f, v, exige)).toBe(esperado ? `Falta al menos ${esperado}` : null);
    });
  });

  describe("faltaEnInterno", () => {
    it("pide texto o al menos un ítem; el texto en blanco no cuenta", () => {
      expect(faltaEnInterno(null, 0)).toMatch(/comentario interno/);
      expect(faltaEnInterno("   ", 0)).toMatch(/comentario interno/);
      expect(faltaEnInterno("Puerta trasera", 0)).toBeNull();
      expect(faltaEnInterno("", 2)).toBeNull();
    });
  });

  describe("errorDeSeccionesObligatorias", () => {
    it("sin secciones obligatorias no pide nada", () => {
      expect(errorDeSeccionesObligatorias(acta(), ninguna)).toBeNull();
    });

    it("fotos obligatorias: sin nada, falta todo; foto + video, cumple", () => {
      expect(errorDeSeccionesObligatorias(acta(), { ...ninguna, fotos: true })).toMatch(/una foto y un video del trabajo/);
      expect(errorDeSeccionesObligatorias(acta({ fotos: [foto()], videosIds: [4] }), { ...ninguna, fotos: true })).toBeNull();
    });

    it("lo interno no se cuenta como lo del trabajo", () => {
      const interno = acta({ fotos: [foto(true)], videosIds: [] });
      expect(errorDeSeccionesObligatorias(interno, { ...ninguna, fotos: true })).toMatch(/una foto y un video/);
    });

    it("sin permiso de video, la foto sola cumple", () => {
      expect(errorDeSeccionesObligatorias(acta({ fotos: [foto()] }), { ...ninguna, fotos: true }, false)).toBeNull();
    });

    it("comentario interno obligatorio", () => {
      expect(errorDeSeccionesObligatorias(acta(), { ...ninguna, interno: true })).toMatch(/comentario interno/);
      expect(errorDeSeccionesObligatorias(acta({ comentarioInterno: "x" }), { ...ninguna, interno: true })).toBeNull();
    });

    it("problemas obligatorio no se puede comprobar con el contenido: un acta sin problemas es válida", () => {
      expect(errorDeSeccionesObligatorias(acta(), { ...ninguna, problemas: true })).toBeNull();
    });
  });
});
