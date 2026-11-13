import { describe, expect, it } from "vitest";
import { visitaParaPanel, visitaParaTecnico } from "@/lib/data/visita-reducida";

const visita = {
  tecnicoId: 7,
  tecnico: { id: 7, nombreCompleto: "Ana", rut: "1-9", email: "ana@x.cl", telefono: "+569", activo: true },
  ediciones: [
    { id: 1, origen: "WEB", por: "coord@dmc.cl" },
    { id: 2, origen: "MOVIL", por: "Ana" },
  ],
} as never;

describe("visitaParaTecnico", () => {
  it("el titular conserva sus datos", () => {
    expect((visitaParaTecnico(visita, 7) as never as { tecnico: { rut: string } }).tecnico.rut).toBe("1-9");
  });
  it("el ayudante no recibe RUT ni correo del titular", () => {
    const v = visitaParaTecnico(visita, 8);
    expect(v.tecnico?.rut).toBe("");
    expect(v.tecnico?.email).toBe("");
    expect(v.tecnico?.nombreCompleto).toBe("Ana");
  });
  it("las ediciones del panel no muestran el correo de la cuenta", () => {
    const v = visitaParaTecnico(visita, 7);
    expect(v.ediciones?.map((e) => e.por)).toEqual(["Coordinación", "Ana"]);
  });
});

describe("visitaParaPanel", () => {
  it("vacía los datos del técnico sin tecnicos.ver", () => {
    const v = visitaParaPanel(visita, ["visitas.ver"]);
    expect(v.tecnico).toMatchObject({ rut: "", email: "", telefono: null });
  });
  it("con tecnicos.ver no toca nada", () => {
    expect(visitaParaPanel(visita, ["tecnicos.ver"]).tecnico?.rut).toBe("1-9");
  });

  const conLocal = {
    ...(visita as object),
    cliente: { id: 1, nombre: "Tienda", rut: "76.000.000-0" },
    sucursal: { id: 2, nombre: "Mall", telefono: "+5622" },
  } as never;

  it("el RUT del cliente y el teléfono del local bajan solo con su permiso", () => {
    const sin = visitaParaPanel(conLocal, ["visitas.ver"]);
    expect(sin.cliente?.rut).toBe("");
    expect(sin.sucursal?.telefono).toBeNull();
    const con = visitaParaPanel(conLocal, ["visitas.ver", "clientes.ver", "sucursales.ver"]);
    expect(con.cliente?.rut).toBe("76.000.000-0");
    expect(con.sucursal?.telefono).toBe("+5622");
  });

  it("al celular no baja el RUT del cliente, sí el teléfono del local", () => {
    const v = visitaParaTecnico(conLocal, 7);
    expect(v.cliente?.rut).toBe("");
    expect(v.sucursal?.telefono).toBe("+5622");
  });
});
