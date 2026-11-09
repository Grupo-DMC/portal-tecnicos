import { describe, expect, it } from "vitest";
import { iniciales, nombreVisible, urlFotoUsuario } from "@/lib/ui/cuenta";

describe("Mi cuenta · cómo se muestra la cuenta", () => {
  it("usa el nombre que escribió la persona", () => {
    expect(nombreVisible("  Ana Pérez ", "ana.perez@example.com")).toBe("Ana Pérez");
  });

  it("sin nombre, lo arma con el correo", () => {
    expect(nombreVisible(null, "ana.perez@example.com")).toBe("Ana Perez");
    expect(nombreVisible("", "juan_soto-r@example.com")).toBe("Juan Soto R");
  });

  it("iniciales: hasta dos, en mayúscula", () => {
    expect(iniciales("ana maría pérez")).toBe("AM");
    expect(iniciales("")).toBe("?");
  });

  it("la URL de la foto lleva la versión, y sin foto no hay URL", () => {
    expect(urlFotoUsuario(7, "2026-11-09T14:00:00")).toBe("/api/usuario/foto/7?v=2026-11-09T14%3A00%3A00");
    expect(urlFotoUsuario(7, null)).toBeNull();
  });
});
