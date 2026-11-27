import { describe, expect, it } from "vitest";
import { ocultarCredenciales, ocultarRut } from "@/lib/ui/reservado";

describe("datos reservados en pantalla", () => {
  it("oculta los tres últimos dígitos del RUT y conserva el verificador", () => {
    expect(ocultarRut("16.842.317-1")).toBe("16.842.***-1");
    expect(ocultarRut("9876543-K")).toBe("9876***-K");
  });

  it("un RUT sin la forma esperada no se muestra", () => {
    expect(ocultarRut("12")).toBe("***");
  });

  it("tapa las claves anotadas en una nota y deja el resto", () => {
    expect(ocultarCredenciales("Entrar por atrás. Clave: 4821 y avisar.")).toBe("Entrar por atrás. Clave: •••• y avisar.");
    expect(ocultarCredenciales("usuario admin, contraseña=Abc123")).toBe("usuario admin, contraseña=••••");
    expect(ocultarCredenciales("Revisar la clave del candado")).toBe("Revisar la clave del candado");
  });
});
