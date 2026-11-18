import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { contactosDeCliente, contactosPropiosDeSucursal, guardarContacto, quitarCargoDeContacto, getContacto } from "@/lib/data/contactos";
import { listarPersonasLocal, registrarPersonaLocal } from "@/lib/data/personas-local";
import { hayBd, limpiarDatos, mensajeDeError, sembrarMundo, uno, type Mundo } from "./_ayuda";

// Migración 041: contactos del cliente y de cada tienda, y el correo del
// responsable de tienda (acta y personas del local), contra una base real.
describe.skipIf(!hayBd)("BD · contactos por ficha y correo del responsable", () => {
  let m: Mundo;

  beforeEach(async () => {
    await limpiarDatos();
    m = await sembrarMundo();
  });
  afterAll(() => limpiarDatos());

  const datos = (nombre: string, cargos: { tipo: "CLIENTE" | "MARCA" | "SUCURSAL"; id: number }[]) => ({
    nombre,
    email: null,
    telefono: null,
    activo: true,
    cargos: cargos.map((c) => ({ cargo: "Jefe", alcanceTipo: c.tipo, alcanceId: c.id, alcanceTexto: null })),
  });

  it("el cliente ve los suyos y los de sus marcas; la tienda, solo los propios", async () => {
    const delCliente = await guardarContacto(null, datos("Del cliente", [{ tipo: "CLIENTE", id: m.clienteId }]));
    const deMarca = await guardarContacto(null, datos("De la marca", [{ tipo: "MARCA", id: m.marcaId }]));
    const deTienda = await guardarContacto(null, datos("De la tienda", [{ tipo: "SUCURSAL", id: m.sucursalId }]));

    expect((await contactosDeCliente(m.clienteId)).map((c) => c.id).sort()).toEqual([delCliente, deMarca].sort());
    expect((await contactosPropiosDeSucursal(m.sucursalId)).map((c) => c.id)).toEqual([deTienda]);
  });

  it("la tienda no sugiere contactos inactivos", async () => {
    await guardarContacto(null, {
      ...datos("Se fue", [{ tipo: "SUCURSAL", id: m.sucursalId }]),
      activo: false,
      motivoInactivo: "Ya no trabaja ahí",
    });
    expect(await contactosPropiosDeSucursal(m.sucursalId)).toEqual([]);
  });

  it("quitar un cargo saca al contacto de la ficha sin borrarlo", async () => {
    const id = await guardarContacto(
      null,
      datos("Ana", [
        { tipo: "SUCURSAL", id: m.sucursalId },
        { tipo: "CLIENTE", id: m.clienteId },
      ])
    );
    const antes = await getContacto(id);
    const deTienda = antes!.cargos.find((c) => c.alcanceTipo === "SUCURSAL")!;
    expect(await quitarCargoDeContacto(id, deTienda.id!)).toBe(true);
    expect(await quitarCargoDeContacto(id, deTienda.id!)).toBe(false);
    expect(await contactosPropiosDeSucursal(m.sucursalId)).toEqual([]);
    expect((await getContacto(id))!.cargos.map((c) => c.alcanceTipo)).toEqual(["CLIENTE"]);
  });

  it("un cargo de otro contacto no se quita", async () => {
    const a = await guardarContacto(null, datos("A", [{ tipo: "SUCURSAL", id: m.sucursalId }]));
    const b = await guardarContacto(null, datos("B", [{ tipo: "SUCURSAL", id: m.sucursalId }]));
    const cargoDeB = (await getContacto(b))!.cargos[0].id!;
    expect(await quitarCargoDeContacto(a, cargoDeB)).toBe(false);
    expect((await getContacto(b))!.cargos).toHaveLength(1);
  });

  it("la persona del local guarda el correo, y uno vacío no borra el que había", async () => {
    await registrarPersonaLocal(m.sucursalId, { nombre: "María", email: "maria@tienda.cl" });
    await registrarPersonaLocal(m.sucursalId, { nombre: "María", telefono: "+56 9 1234 5678" });
    const [maria] = await listarPersonasLocal(m.sucursalId);
    expect(maria).toMatchObject({ nombre: "María", email: "maria@tienda.cl", telefono: "+56 9 1234 5678" });
  });

  it("la base no acepta un correo sin forma de correo", async () => {
    expect(
      await mensajeDeError(`INSERT INTO dmc.persona_local (sucursal_id, nombre, email) VALUES (${m.sucursalId}, N'X', N'sin-arroba')`)
    ).toMatch(/ck_persona_local_email/);
    const col = await uno<{ n: number }>(
      `SELECT COUNT(*) AS n FROM sys.columns WHERE object_id = OBJECT_ID('dmc.visita_ejecucion') AND name = 'responsable_email'`
    );
    expect(Number(col?.n)).toBe(1);
  });
});
