import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { consulta } from "@/lib/data/sql";
import { guardarCliente, guardarMall, guardarMarca, ponerTiendasDeMall, sincronizarNombresDeSucursales } from "@/lib/data/maestros";
import { hayBd, limpiarDatos, sembrarMundo, uno, type Mundo } from "./_ayuda";
import { T } from "@/lib/db/esquema";

// «Agendar visita», las visitas, los filtros y las actas leen tecnico.sucursal.nombre
// tal cual. Ese texto es «Cliente · Marca · Mall»: si cambia cualquiera de las
// tres partes tiene que cambiar con ellas, no quedarse con el valor de cuando
// se creó la sucursal.
describe.skipIf(!hayBd)("BD · el nombre de la sucursal sigue a su cliente, marca y mall", () => {
  let m: Mundo;
  let mallId: number;
  let mall2Id: number;
  const nombreDe = async (id: number) => (await uno<{ nombre: string }>(`SELECT nombre FROM ${T.sucursal} WHERE id = ${id}`))!.nombre;

  beforeEach(async () => {
    await limpiarDatos();
    m = await sembrarMundo();
    await consulta(`
      INSERT INTO ${T.mall} (nombre, direccion, comuna, region) VALUES (N'Mall Uno', N'Av. 1', N'Santiago', N'Metropolitana');
      INSERT INTO ${T.mall} (nombre, direccion, comuna, region) VALUES (N'Mall Dos', N'Av. 2', N'Santiago', N'Metropolitana');`);
    mallId = Number((await uno<{ id: number }>(`SELECT id FROM ${T.mall} WHERE nombre = N'Mall Uno'`))!.id);
    mall2Id = Number((await uno<{ id: number }>(`SELECT id FROM ${T.mall} WHERE nombre = N'Mall Dos'`))!.id);
    await consulta(`UPDATE ${T.sucursal} SET mall_id = ${mallId}, nombre = N'viejo' WHERE id = ${m.sucursalId}`);
    await sincronizarNombresDeSucursales();
  });
  afterAll(() => limpiarDatos());

  it("una sucursal en mall se llama «Cliente · Marca · Mall»", async () => {
    const c = await uno<{ cliente: string; marca: string }>(
      `SELECT c.nombre_fantasia AS cliente, mc.nombre AS marca FROM ${T.sucursal} s
         JOIN ${T.cliente} c ON c.id = s.cliente_id JOIN ${T.marca} mc ON mc.id = s.marca_id WHERE s.id = ${m.sucursalId}`
    );
    const marca = c!.marca === c!.cliente ? "" : ` · ${c!.marca}`;
    expect(await nombreDe(m.sucursalId)).toBe(`${c!.cliente}${marca} · Mall Uno`);
  });

  it("al renombrar el mall, la sucursal toma el nombre nuevo", async () => {
    await guardarMall(mallId, { nombre: "Mall Renovado", direccion: "Av. 1", comuna: "Santiago", region: "Metropolitana", activo: true });
    expect(await nombreDe(m.sucursalId)).toMatch(/ · Mall Renovado$/);
  });

  it("al renombrar la marca, la sucursal toma el nombre nuevo", async () => {
    await guardarMarca(m.marcaId, { clienteId: m.clienteId, nombre: "Marca Nueva", activo: true });
    expect(await nombreDe(m.sucursalId)).toMatch(/ · Marca Nueva · Mall Uno$/);
  });

  it("al renombrar el cliente, la sucursal toma el nombre nuevo", async () => {
    const c = (await uno<Record<string, string>>(`SELECT rut, razon_social, nombre_fantasia FROM ${T.cliente} WHERE id = ${m.clienteId}`))!;
    await guardarCliente(m.clienteId, {
      rut: c.rut,
      razonSocial: c.razon_social,
      nombreFantasia: "Cliente Renombrado",
      activo: true,
      motivoInactivo: null,
      notas: null,
      planCalibracion: null,
      garantiaMeses: null,
    });
    expect(await nombreDe(m.sucursalId)).toMatch(/^Cliente Renombrado · /);
  });

  it("al mover la tienda a otro mall, el nombre cambia con él", async () => {
    await ponerTiendasDeMall(mallId, []);
    await ponerTiendasDeMall(mall2Id, [m.sucursalId]);
    expect(await nombreDe(m.sucursalId)).toMatch(/ · Mall Dos$/);
  });

  it("una sucursal a la calle conserva el nombre que se le escribió", async () => {
    await consulta(`UPDATE ${T.sucursal} SET mall_id = NULL, nombre = N'Tienda Calle' WHERE id = ${m.sucursalId}`);
    await guardarMall(mallId, { nombre: "Otro Nombre", direccion: "Av. 1", comuna: "Santiago", region: "Metropolitana", activo: true });
    expect(await nombreDe(m.sucursalId)).toBe("Tienda Calle");
  });
});
