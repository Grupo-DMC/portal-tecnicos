import { describe, expect, it } from "vitest";
import {
  cargosDeCliente,
  cargosEnSucursal,
  sugerenciasDelLocal,
  type CargoContacto,
  type Contacto,
} from "@/lib/ui/contactos";
import { mensajeCorreo } from "@/lib/ui/formato";
import { actaEntrada } from "@/lib/validacion/actas";
import type { PersonaLocal } from "@/lib/types";

// Migración 041: contactos del cliente separados de los de cada tienda, y los
// de la tienda sugeridos en el acta junto a quienes ya firmaron.

const cargo = (c: Partial<CargoContacto> & Pick<CargoContacto, "alcanceTipo">): CargoContacto => ({
  id: null,
  cargo: "Jefe de tienda",
  alcanceId: null,
  alcanceTexto: null,
  ...c,
});

const contacto = (id: number, nombre: string, cargos: CargoContacto[], extra: Partial<Contacto> = {}): Contacto => ({
  id,
  nombre,
  email: null,
  telefono: null,
  activo: true,
  cargos,
  ...extra,
});

const persona = (id: number, nombre: string, extra: Partial<PersonaLocal> = {}): PersonaLocal => ({
  id,
  nombre,
  rut: null,
  telefono: null,
  cargo: null,
  email: null,
  ultimaVez: "2026-11-01T10:00:00",
  ...extra,
});

describe("cargosEnSucursal y cargosDeCliente — quién es de qué ficha", () => {
  const ana = contacto(1, "Ana", [
    cargo({ id: 1, alcanceTipo: "SUCURSAL", alcanceId: 100 }),
    cargo({ id: 2, alcanceTipo: "MARCA", alcanceId: 20, cargo: "Gerente de marca" }),
    cargo({ id: 3, alcanceTipo: "CLIENTE", alcanceId: 1, cargo: "Compras" }),
    cargo({ id: 4, alcanceTipo: "MARCA", alcanceId: 99, cargo: "Otra marca" }),
  ]);

  it("la sucursal solo ve los cargos con su id", () => {
    expect(cargosEnSucursal(ana, 100).map((c) => c.id)).toEqual([1]);
    expect(cargosEnSucursal(ana, 101)).toEqual([]);
  });

  it("el cliente ve los suyos y los de sus marcas, nunca los de una tienda", () => {
    expect(cargosDeCliente(ana, 1, new Set([20])).map((c) => c.id)).toEqual([2, 3]);
  });
});

describe("sugerenciasDelLocal — lo que se ofrece al llenar el acta", () => {
  it("suma los contactos propios de la tienda, primero y con id negativo", () => {
    const lista = sugerenciasDelLocal(
      [persona(7, "Pedro", { rut: "11.111.111-1" })],
      [contacto(5, "Marta", [cargo({ alcanceTipo: "SUCURSAL", alcanceId: 100 })], { email: "marta@tienda.cl" })],
      100
    );
    expect(lista.map((p) => [p.id, p.nombre, p.origen])).toEqual([
      [-5, "Marta", "CONTACTO"],
      [7, "Pedro", "HISTORIAL"],
    ]);
    expect(lista[0]).toMatchObject({ email: "marta@tienda.cl", cargo: "Jefe de tienda", rut: null });
  });

  it("deja fuera los contactos heredados, los de otra tienda y los inactivos", () => {
    const lista = sugerenciasDelLocal(
      [],
      [
        contacto(1, "Del cliente", [cargo({ alcanceTipo: "CLIENTE", alcanceId: 1 })]),
        contacto(2, "De otra tienda", [cargo({ alcanceTipo: "SUCURSAL", alcanceId: 101 })]),
        contacto(3, "Inactiva", [cargo({ alcanceTipo: "SUCURSAL", alcanceId: 100 })], { activo: false }),
      ],
      100
    );
    expect(lista).toEqual([]);
  });

  it("si el contacto ya firmó, sale una vez: la del historial, completada con sus datos", () => {
    const lista = sugerenciasDelLocal(
      [persona(7, "María José Soto", { rut: "12.345.678-5", telefono: "+56 9 1111 2222" })],
      [
        contacto(5, "maria  jose soto", [cargo({ alcanceTipo: "SUCURSAL", alcanceId: 100 })], {
          email: "mj@tienda.cl",
          telefono: "+56 9 9999 9999",
        }),
      ],
      100
    );
    expect(lista).toHaveLength(1);
    // El teléfono del historial manda; el correo, que faltaba, sale del contacto.
    expect(lista[0]).toMatchObject({
      id: 7,
      rut: "12.345.678-5",
      telefono: "+56 9 1111 2222",
      email: "mj@tienda.cl",
      cargo: "Jefe de tienda",
    });
  });

  it("no cambia las personas que recibe", () => {
    const original = persona(7, "Ana");
    sugerenciasDelLocal([original], [contacto(5, "Ana", [cargo({ alcanceTipo: "SUCURSAL", alcanceId: 100 })], { email: "a@b.cl" })], 100);
    expect(original.email).toBeNull();
  });
});

describe("correo del responsable — opcional, pero bien escrito", () => {
  it("mensajeCorreo acepta vacío y correos con forma, rechaza el resto", () => {
    expect(mensajeCorreo("")).toBeNull();
    expect(mensajeCorreo(null)).toBeNull();
    expect(mensajeCorreo(" ana@tienda.cl ")).toBeNull();
    expect(mensajeCorreo("ana@tienda")).not.toBeNull();
    expect(mensajeCorreo("ana tienda.cl")).not.toBeNull();
    expect(mensajeCorreo(`${"a".repeat(160)}@x.cl`)).not.toBeNull();
  });

  const acta = {
    folio: "DMC-000001",
    responsableNombre: "Ana",
    responsableRut: null,
    responsableTelefono: null,
    motivosCodigos: [],
    observaciones: null,
    comentarioInterno: null,
    trabajos: [],
    problemas: [],
    fotos: [],
    firma: null,
    dispositivo: null,
  };

  it("el acta se acepta sin teléfono ni correo", () => {
    expect(actaEntrada.safeParse(acta).success).toBe(true);
    expect(actaEntrada.safeParse({ ...acta, responsableEmail: null }).success).toBe(true);
  });

  it("el acta rechaza un correo mal escrito", () => {
    expect(actaEntrada.safeParse({ ...acta, responsableEmail: "ana@tienda.cl" }).success).toBe(true);
    expect(actaEntrada.safeParse({ ...acta, responsableEmail: "no-es-correo" }).success).toBe(false);
  });
});
