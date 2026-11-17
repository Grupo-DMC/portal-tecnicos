import { describe, expect, it } from "vitest";
import {
  fmtRut,
  fmtTel,
  hayDireccion,
  mensajeRut,
  mensajeTel,
  normalizarTel,
  rutCompleto,
  rutDvCorrecto,
  rutLimpio,
  sinTildes,
  telCompleto,
  telDesdeLocal,
  telLocal,
  urlMapa,
  urlTel,
} from "@/lib/ui/formato";

describe("RUT", () => {
  it("fmtRut agrega puntos y guion mientras se escribe", () => {
    expect(fmtRut("")).toBe("");
    expect(fmtRut("1234")).toBe("1.234");
    expect(fmtRut("12345678K")).toBe("12.345.678-K");
    expect(fmtRut("123456785")).toBe("12.345.678-5");
    expect(fmtRut("12.345.678-5")).toBe("12.345.678-5");
    expect(fmtRut("11111111-k")).toBe("11.111.111-K");
  });

  it("fmtRut descarta basura y una K en el cuerpo", () => {
    expect(fmtRut("ab1#2")).toBe("12");
    expect(fmtRut("1K2345678")).toBe("1.234.567-8");
    expect(fmtRut(undefined as unknown as string)).toBe("");
  });

  it("rutLimpio deja cuerpo y DV en mayúscula", () => {
    expect(rutLimpio("12.345.678-k")).toBe("12345678K");
  });

  it("rutCompleto pide 8 caracteres o más", () => {
    expect(rutCompleto("1.234.567")).toBe(false);
    expect(rutCompleto("1.234.567-4")).toBe(true);
  });

  it("rutDvCorrecto aplica módulo 11", () => {
    expect(rutDvCorrecto("12.345.678-5")).toBe(true);
    expect(rutDvCorrecto("12.345.678-4")).toBe(false);
    expect(rutDvCorrecto("11.111.111-1")).toBe(true);
    expect(rutDvCorrecto("1234")).toBe(false);
    expect(rutDvCorrecto("12K45678-5")).toBe(false);
  });

  it("rutDvCorrecto calcula también el DV 0 y el K", () => {
    // Se buscan cuerpos que den cada caso con la misma fórmula del módulo 11.
    const dv = (cuerpo: string) => {
      let suma = 0;
      let mul = 2;
      for (let i = cuerpo.length - 1; i >= 0; i--) {
        suma += Number(cuerpo[i]) * mul;
        mul = mul === 7 ? 2 : mul + 1;
      }
      const r = 11 - (suma % 11);
      return r === 11 ? "0" : r === 10 ? "K" : String(r);
    };
    const con0 = Array.from({ length: 400 }, (_, i) => String(10_000_000 + i)).find((c) => dv(c) === "0")!;
    const conK = Array.from({ length: 400 }, (_, i) => String(10_000_000 + i)).find((c) => dv(c) === "K")!;
    expect(rutDvCorrecto(`${con0}-0`)).toBe(true);
    expect(rutDvCorrecto(`${conK}-K`)).toBe(true);
    expect(rutDvCorrecto(`${conK}-0`)).toBe(false);
  });

  it("mensajeRut: vacío vale, incompleto y DV malo dan mensaje", () => {
    expect(mensajeRut("")).toBeNull();
    expect(mensajeRut("   ")).toBeNull();
    expect(mensajeRut("1.234")).toMatch(/incompleto/);
    expect(mensajeRut("12.345.678-4")).toMatch(/dígito verificador/);
    expect(mensajeRut("12.345.678-5")).toBeNull();
  });
});

describe("teléfono", () => {
  it("fmtTel normaliza distintas entradas", () => {
    expect(fmtTel("")).toBe("");
    expect(fmtTel("12345678")).toBe("+56 9 1234 5678");
    expect(fmtTel("912345678")).toBe("+56 9 1234 5678");
    expect(fmtTel("56912345678")).toBe("+56 9 1234 5678");
    expect(fmtTel("+56 9 1234 5678")).toBe("+56 9 1234 5678");
    expect(fmtTel("1234")).toBe("+56 9 1234");
  });

  it("fmtTel: un 9 tecleado tras el prefijo no se confunde con el prefijo", () => {
    expect(fmtTel("+56 9 9")).toBe("+56 9 9");
    expect(fmtTel("+56 9 9876 5432")).toBe("+56 9 9876 5432");
  });

  it("fmtTel corta a 8 dígitos", () => {
    expect(fmtTel("+56 9 123456789012")).toBe("+56 9 1234 5678");
  });

  it("telCompleto exige 8 dígitos tras el 9", () => {
    expect(telCompleto("+56 9 1234 5678")).toBe(true);
    expect(telCompleto("+56 9 1234")).toBe(false);
    expect(telCompleto("")).toBe(false);
  });

  it("urlTel deja solo + y dígitos", () => {
    expect(urlTel("+56 9 1234-5678")).toBe("tel:+56912345678");
    expect(urlTel(null)).toBe("tel:");
  });
});

describe("teléfono con «+56 9» fijo", () => {
  it("telLocal saca los dígitos que se escriben después del prefijo", () => {
    expect(telLocal("")).toBe("");
    expect(telLocal(null)).toBe("");
    expect(telLocal("+56 9 1234 5678")).toBe("12345678");
    expect(telLocal("+56 9 1234")).toBe("1234");
    expect(telLocal("+56 9 9")).toBe("9");
    expect(telLocal("+56 9")).toBe("");
    expect(telLocal("912345678")).toBe("12345678");
    expect(telLocal("56912345678")).toBe("12345678");
    expect(telLocal("12345678")).toBe("12345678");
  });

  it("telLocal no inventa un móvil con un valor de antes que no lo es", () => {
    expect(telLocal("+56 2 2299 4100")).toBeNull();
    expect(telLocal("22994100")).toBe("22994100");
    expect(telLocal("(2) 2299 4100")).toBeNull();
  });

  it("telDesdeLocal arma el valor que se guarda", () => {
    expect(telDesdeLocal("")).toBe("");
    expect(telDesdeLocal("1234")).toBe("+56 9 1234");
    expect(telDesdeLocal("12345")).toBe("+56 9 1234 5");
    expect(telDesdeLocal("1234 5678")).toBe("+56 9 1234 5678");
    expect(telDesdeLocal("123456789012")).toBe("+56 9 1234 5678");
    expect(telDesdeLocal("9a9b")).toBe("+56 9 99");
  });

  it("mensajeTel: vacío y completo valen; a medias no; lo de antes se conserva", () => {
    expect(mensajeTel("")).toBeNull();
    expect(mensajeTel("+56 9 1234 5678")).toBeNull();
    expect(mensajeTel("+56 9 1234 567")).toMatch(/8 dígitos/);
    expect(mensajeTel("+56 9 1")).toMatch(/8 dígitos/);
    expect(mensajeTel("+56 2 2299 4100")).toBeNull();
  });

  it("normalizarTel deja el formato de siempre y no toca lo que no es móvil", () => {
    expect(normalizarTel("56912345678")).toBe("+56 9 1234 5678");
    expect(normalizarTel("+56 9 12345678")).toBe("+56 9 1234 5678");
    expect(normalizarTel(null)).toBe("");
    expect(normalizarTel(" +56 2 2299 4100 ")).toBe("+56 2 2299 4100");
  });
});

describe("dirección y texto", () => {
  it("urlMapa junta las partes y escapa; sin dirección queda vacía", () => {
    expect(urlMapa("Av. Siempre Viva 123", "Ñuñoa", null, " ")).toBe(
      "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent("Av. Siempre Viva 123, Ñuñoa, Chile")
    );
    expect(urlMapa()).toBe("https://www.google.com/maps/search/?api=1&query=");
  });

  it("hayDireccion", () => {
    expect(hayDireccion(null, "  ", "Calle 1")).toBe(true);
    expect(hayDireccion(null, " ", undefined)).toBe(false);
  });

  it("sinTildes busca sin tildes ni mayúsculas", () => {
    expect(sinTildes("Egaña")).toBe("egana");
    expect(sinTildes(undefined as unknown as string)).toBe("");
  });
});
