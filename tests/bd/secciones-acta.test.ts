import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { consulta } from "@/lib/data/sql";
import { guardarSeccionesObligatorias, leerSeccionesObligatorias } from "@/lib/data/secciones-acta";
import { crearVisita, getVisitaCompletaPorFolio } from "@/lib/data/visitas";
import { OBLIGATORIAS_POR_DEFECTO } from "@/lib/contratos/secciones-acta";
import { hayBd, limpiarDatos, mensajeDeError, sembrarMundo, uno, type Mundo } from "./_ayuda";
import { T } from "@/lib/db/esquema";

// Migración 042: qué secciones del acta son obligatorias, contra una base real.
describe.skipIf(!hayBd)("BD · secciones obligatorias del acta", () => {
  let m: Mundo;

  beforeEach(async () => {
    await limpiarDatos();
    m = await sembrarMundo();
    // El DDL siembra las tres filas; cada test parte de ellas.
    await consulta(`DELETE FROM ${T.acta_seccion_config}`);
    await consulta(`INSERT INTO ${T.acta_seccion_config} (clave, obligatoria) VALUES ('problemas', 0), ('interno', 0), ('fotos', 1)`);
  });
  afterAll(async () => {
    await consulta(`DELETE FROM ${T.acta_seccion_config}`);
    await consulta(`INSERT INTO ${T.acta_seccion_config} (clave, obligatoria) VALUES ('problemas', 0), ('interno', 0), ('fotos', 1)`);
    await limpiarDatos();
  });

  it("la base nueva trae las fotos obligatorias y lo demás opcional", async () => {
    expect(await leerSeccionesObligatorias()).toEqual({ problemas: false, interno: false, fotos: true });
  });

  it("si faltan filas, valen los valores por defecto", async () => {
    await consulta(`DELETE FROM ${T.acta_seccion_config}`);
    expect(await leerSeccionesObligatorias()).toEqual(OBLIGATORIAS_POR_DEFECTO);
    await consulta(`INSERT INTO ${T.acta_seccion_config} (clave, obligatoria) VALUES ('interno', 1)`);
    expect(await leerSeccionesObligatorias()).toEqual({ ...OBLIGATORIAS_POR_DEFECTO, interno: true });
  });

  it("guarda las tres juntas, deja quién las cambió y las vuelve a leer", async () => {
    const r = await guardarSeccionesObligatorias({ problemas: true, interno: true, fotos: false }, m.adminId);
    expect(r).toEqual({ problemas: true, interno: true, fotos: false });
    expect(await leerSeccionesObligatorias()).toEqual(r);
    const filas = await consulta<{ clave: string; actualizado_por: number }>(
      `SELECT clave, actualizado_por FROM ${T.acta_seccion_config} ORDER BY clave`
    );
    expect(filas.map((f) => Number(f.actualizado_por))).toEqual([m.adminId, m.adminId, m.adminId]);
  });

  it("guardar de nuevo repone una fila que se hubiera borrado, sin duplicar", async () => {
    await consulta(`DELETE FROM ${T.acta_seccion_config} WHERE clave = 'interno'`);
    await guardarSeccionesObligatorias({ problemas: false, interno: true, fotos: true }, m.adminId);
    const [{ n }] = await consulta<{ n: number }>(`SELECT COUNT(*) AS n FROM ${T.acta_seccion_config}`);
    expect(Number(n)).toBe(3);
    expect((await leerSeccionesObligatorias()).interno).toBe(true);
  });

  it("la base no acepta una sección que no existe en el acta ni un usuario inexistente", async () => {
    expect(await mensajeDeError(`INSERT INTO ${T.acta_seccion_config} (clave, obligatoria) VALUES ('firmas', 1)`)).toMatch(
      /ck_acta_seccion_clave/
    );
    expect(
      await mensajeDeError(`UPDATE ${T.acta_seccion_config} SET actualizado_por = 999999 WHERE clave = 'fotos'`)
    ).toMatch(/fk_acta_seccion_usuario/);
  });

  it("si una escritura falla, no queda ninguna a medias", async () => {
    await expect(guardarSeccionesObligatorias({ problemas: true, interno: true, fotos: false }, 999999)).rejects.toThrow();
    expect(await leerSeccionesObligatorias()).toEqual({ problemas: false, interno: false, fotos: true });
  });
});

// El autor de la visita (tecnico.visita.creada_por) que muestra el detalle: «Trabajo solicitado por {id} {nombre}».
describe.skipIf(!hayBd)("BD · quién creó la visita", () => {
  let m: Mundo;

  beforeEach(async () => {
    await limpiarDatos();
    m = await sembrarMundo();
  });
  afterAll(() => limpiarDatos());

  const datos = (extra: Record<string, unknown> = {}) =>
    ({
      clienteId: m.clienteId,
      sucursalId: m.sucursalId,
      tecnicoId: m.tecnicoId,
      tecnicoAyudanteId: null,
      motivoCodigo: "VISITA",
      motivosCodigos: ["VISITA"],
      fechaProgramada: "2030-03-04",
      horaProgramada: null,
      trabajoSolicitado: "Calibrar antenas",
      indicacionesAcceso: null,
      responsableNombre: null,
      responsableRut: null,
      responsableTelefono: null,
      creadaEnTerreno: false,
      ...extra,
    }) as never;

  async function visita(creadaPor: number | null) {
    await consulta(`IF NOT EXISTS (SELECT 1 FROM ${T.catalogo_motivo} WHERE codigo = 'VISITA')
                      INSERT INTO ${T.catalogo_motivo} (codigo, nombre, orden) VALUES ('VISITA', N'Visita', 1)`);
    const creada = await crearVisita(datos(), creadaPor);
    return (await getVisitaCompletaPorFolio(creada.folio))!;
  }

  it("trae el id y el nombre de quien la agendó", async () => {
    await consulta(`UPDATE ${T.usuario} SET nombre = N'Ana Pérez' WHERE id = ${m.adminId}`);
    expect((await visita(m.adminId)).creadaPor).toEqual({ id: m.adminId, nombre: "Ana Pérez" });
  });

  it("sin nombre cargado, cae al correo del usuario", async () => {
    const [{ email }] = await consulta<{ email: string }>(`SELECT email FROM ${T.usuario} WHERE id = ${m.adminId}`);
    expect((await visita(m.adminId)).creadaPor).toEqual({ id: m.adminId, nombre: email });
  });

  it("una visita sin autor guardado no inventa uno", async () => {
    expect((await visita(null)).creadaPor).toBeNull();
    expect(await uno(`SELECT 1 AS x FROM ${T.visita} WHERE creada_por IS NULL`)).toBeTruthy();
  });
});
