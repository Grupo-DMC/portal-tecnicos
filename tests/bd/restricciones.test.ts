import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { consulta } from "@/lib/data/sql";
import { hayBd, insertarVisita, limpiarDatos, mensajeDeError, sembrarMundo, uno, type Mundo } from "./_ayuda";
import { T } from "@/lib/db/esquema";

// Las restricciones de la base son la última línea de defensa: aunque la app
// falle, ninguna combinación inválida debe poder guardarse.
describe.skipIf(!hayBd)("BD · restricciones del esquema", () => {
  let m: Mundo;

  beforeAll(async () => {
    await limpiarDatos();
  });
  beforeEach(async () => {
    await limpiarDatos();
    m = await sembrarMundo();
  });
  afterAll(() => limpiarDatos());

  /** Los roles de una cuenta, en orden. */
  const roles = async (id: number) =>
    (await consulta<{ rol: string }>(`SELECT rol FROM ${T.usuario_rol} WHERE usuario_id = ${id} ORDER BY rol`)).map((f) => f.rol);
  /** Una cuenta recién creada, todavía sin roles. */
  const cuenta = async (email: string, tecnicoId: number | null = null) =>
    Number(
      (await uno<{ id: number }>(
        `INSERT INTO ${T.usuario} (email, password_hash, tecnico_id) VALUES ('${email}', N'x', ${tecnicoId ?? "NULL"});
         SELECT CAST(SCOPE_IDENTITY() AS bigint) AS id`
      ))!.id
    );

  describe("unicidad", () => {
    it("el RUT de un cliente no se repite", async () => {
      const e = await mensajeDeError(`INSERT INTO ${T.cliente} (rut, razon_social, nombre_fantasia) VALUES ('76.000.001-0', N'Otra', N'Otra')`);
      expect(e).toMatch(/uq_cliente_rut/);
    });

    it("el correo del usuario y el del técnico no se repiten", async () => {
      expect(await mensajeDeError(`INSERT INTO ${T.usuario} (email, password_hash) VALUES ('admin@example.com', N'x')`)).toMatch(/uq_usuario_email/);
      expect(await mensajeDeError(`INSERT INTO ${T.tecnico} (rut, nombres, apellido_paterno, email) VALUES ('33.333.333-3', N'X', N'Y', 'ana@example.com')`)).toMatch(/uq_tecnico_email/);
      expect(await mensajeDeError(`INSERT INTO ${T.tecnico} (rut, nombres, apellido_paterno, email) VALUES ('11.111.111-1', N'X', N'Y', 'otro@example.com')`)).toMatch(/uq_tecnico_rut/);
    });

    it("un técnico solo puede estar vinculado a una cuenta activa", async () => {
      const e = await mensajeDeError(`INSERT INTO ${T.usuario} (email, password_hash, tecnico_id) VALUES ('copia@example.com', N'x', ${m.tecnicoId})`);
      expect(e).toMatch(/uq_usuario_tecnico/);
    });

    it("con la cuenta vieja del técnico desactivada, su técnico se puede vincular a otra cuenta", async () => {
      await consulta(`UPDATE ${T.usuario} SET activo = 0, motivo_inactivo = N'Ahora entra con su cuenta de admin' WHERE id = ${m.usuarioTecnicoId}`);
      await consulta(`
        UPDATE ${T.usuario} SET tecnico_id = ${m.tecnicoId} WHERE id = ${m.adminId};
        INSERT INTO ${T.usuario_rol} (usuario_id, rol) VALUES (${m.adminId}, 'TECNICO');`);
      expect(await roles(m.adminId)).toEqual(["ADMIN", "TECNICO"]);
      // Reactivar la vieja choca: dos cuentas activas con el mismo técnico.
      expect(await mensajeDeError(`UPDATE ${T.usuario} SET activo = 1, motivo_inactivo = NULL WHERE id = ${m.usuarioTecnicoId}`)).toMatch(/uq_usuario_tecnico/);
    });

    it("una marca no puede tener dos sucursales con el mismo nombre", async () => {
      const e = await mensajeDeError(`INSERT INTO ${T.sucursal} (cliente_id, marca_id, nombre, direccion, comuna, region)
        VALUES (${m.clienteId}, ${m.marcaId}, N'Tienda Centro', N'Otra', N'X', N'Y')`);
      expect(e).toMatch(/uq_sucursal_marca_nombre/);
    });

    it("el folio de la visita es único y sale de la secuencia, creciente", async () => {
      const a = await insertarVisita(m);
      const b = await insertarVisita(m);
      expect(a.folio).toMatch(/^V-\d{4}-00001$/);
      expect(b.folio).toMatch(/^V-\d{4}-00002$/);
    });
  });

  describe("reglas de negocio (CHECK)", () => {
    it("el rol TECNICO necesita técnico vinculado, y no se le puede soltar mientras lo tenga", async () => {
      const id = await cuenta("t@example.com");
      expect(await mensajeDeError(`INSERT INTO ${T.usuario_rol} (usuario_id, rol) VALUES (${id}, 'TECNICO')`)).toMatch(/ck_usuario_roles_tecnico/);
      expect(await mensajeDeError(`UPDATE ${T.usuario} SET tecnico_id = NULL WHERE id = ${m.usuarioTecnicoId}`)).toMatch(/ck_usuario_roles_tecnico/);
    });

    it("una cuenta puede ser ADMIN + TECNICO o COORDINADOR + TECNICO, pero no ADMIN + COORDINADOR", async () => {
      const libre = await uno<{ id: number }>(`INSERT INTO ${T.tecnico} (rut, nombres, apellido_paterno, email) VALUES ('44.444.444-4', N'C', N'D', 'c@example.com'); SELECT SCOPE_IDENTITY() AS id`);
      const a = await cuenta("a2@example.com", libre!.id);
      await consulta(`INSERT INTO ${T.usuario_rol} (usuario_id, rol) VALUES (${a}, 'ADMIN'), (${a}, 'TECNICO')`);
      expect(await roles(a)).toEqual(["ADMIN", "TECNICO"]);
      expect(await mensajeDeError(`INSERT INTO ${T.usuario_rol} (usuario_id, rol) VALUES (${a}, 'COORDINADOR')`)).toMatch(/ck_usuario_roles_panel/);
      // Un mismo rol dos veces no.
      expect(await mensajeDeError(`INSERT INTO ${T.usuario_rol} (usuario_id, rol) VALUES (${a}, 'ADMIN')`)).toMatch(/pk_usuario_rol/);
    });

    it("toda cuenta conserva al menos un rol", async () => {
      expect(await mensajeDeError(`DELETE FROM ${T.usuario_rol} WHERE usuario_id = ${m.adminId}`)).toMatch(/ck_usuario_roles_alguno/);
      // Cambiar el único rol en una sola sentencia sí se puede.
      await consulta(`UPDATE ${T.usuario_rol} SET rol = 'COORDINADOR' WHERE usuario_id = ${m.adminId}`);
      expect(await roles(m.adminId)).toEqual(["COORDINADOR"]);
    });

    it("el rol del panel (rol_id) solo lo lleva una cuenta COORDINADOR", async () => {
      const rolId = (await uno<{ id: number }>(`SELECT TOP 1 id FROM ${T.rol}`))!.id;
      expect(await mensajeDeError(`UPDATE ${T.usuario} SET rol_id = ${rolId} WHERE id = ${m.adminId}`)).toMatch(/ck_usuario_roles_rol_id/);
    });

    it("el rol solo puede ser ADMIN, COORDINADOR o TECNICO", async () => {
      expect(await mensajeDeError(`INSERT INTO ${T.usuario_rol} (usuario_id, rol) VALUES (${m.adminId}, 'SUPERUSUARIO')`)).toMatch(/ck_usuario_rol_valor/);
    });

    it("borrar una cuenta se lleva sus roles", async () => {
      const id = await cuenta("borrar@example.com");
      await consulta(`INSERT INTO ${T.usuario_rol} (usuario_id, rol) VALUES (${id}, 'ADMIN')`);
      await consulta(`DELETE FROM ${T.usuario} WHERE id = ${id}`);
      expect(await roles(id)).toEqual([]);
    });

    it("el estado de la visita está acotado", async () => {
      expect(await mensajeDeError(`UPDATE ${T.visita} SET estado = 'INVENTADO' WHERE id = ${(await insertarVisita(m)).id}`)).toMatch(/ck_visita_estado/);
    });

    it("el margen de días debe terminar después de empezar", async () => {
      expect(await mensajeDeError(`INSERT INTO ${T.visita} (cliente_id, sucursal_id, tecnico_id, motivo_codigo, fecha_programada, fecha_hasta, trabajo_solicitado)
        VALUES (${m.clienteId}, ${m.sucursalId}, ${m.tecnicoId}, 'VISITA', '2026-10-26', '2026-10-26', N'x')`)).toMatch(/ck_visita_fecha_hasta/);
      await insertarVisita(m, { hasta: "2026-10-30" });
    });

    it("el ayudante no puede ser el mismo técnico asignado", async () => {
      expect(await mensajeDeError(`INSERT INTO ${T.visita} (cliente_id, sucursal_id, tecnico_id, tecnico_ayudante_id, motivo_codigo, fecha_programada, trabajo_solicitado)
        VALUES (${m.clienteId}, ${m.sucursalId}, ${m.tecnicoId}, ${m.tecnicoId}, 'VISITA', '2026-10-26', N'x')`)).toMatch(/ck_visita_ayudante/);
      await insertarVisita(m, { ayudante: m.tecnico2Id });
    });

    it("un problema de tipo «Otro» exige una descripción escrita", async () => {
      const v = await insertarVisita(m);
      for (const descripcion of ["NULL", "N''", "N'    '"]) {
        expect(await mensajeDeError(`INSERT INTO ${T.problema} (visita_id, tipo_codigo, descripcion) VALUES (${v.id}, 'OTRO', ${descripcion})`)).toMatch(/ck_problema_otro_desc/);
      }
      await consulta(`INSERT INTO ${T.problema} (visita_id, tipo_codigo, descripcion) VALUES (${v.id}, 'OTRO', N'Se encontró humedad')`);
    });

    it("un problema RESUELTO debe llevar su fecha de resolución, y uno abierto no", async () => {
      const v = await insertarVisita(m);
      expect(await mensajeDeError(`INSERT INTO ${T.problema} (visita_id, tipo_codigo, estado) VALUES (${v.id}, 'ANTENA_NO_DETECTA', 'RESUELTO')`)).toMatch(/ck_problema_resuelto/);
      expect(await mensajeDeError(`INSERT INTO ${T.problema} (visita_id, tipo_codigo, estado, resuelto_en) VALUES (${v.id}, 'ANTENA_NO_DETECTA', 'ABIERTO', SYSDATETIME())`)).toMatch(/ck_problema_resuelto/);
    });

    it("la garantía en meses va de 1 a 240", async () => {
      for (const meses of [0, 241, -5]) {
        expect(await mensajeDeError(`UPDATE ${T.cliente} SET garantia_meses = ${meses} WHERE id = ${m.clienteId}`)).toMatch(/ck_cliente_garantia_meses/);
        expect(await mensajeDeError(`UPDATE ${T.sucursal} SET garantia_meses = ${meses} WHERE id = ${m.sucursalId}`)).toMatch(/ck_sucursal_garantia_meses/);
      }
      await consulta(`UPDATE ${T.cliente} SET garantia_meses = 12 WHERE id = ${m.clienteId}`);
    });
  });

  describe("claves foráneas", () => {
    it("una visita necesita cliente, sucursal, técnico y motivo que existan", async () => {
      const base = (campo: string, valor: string) =>
        `INSERT INTO ${T.visita} (cliente_id, sucursal_id, tecnico_id, motivo_codigo, fecha_programada, trabajo_solicitado)
         VALUES (${campo === "cliente" ? valor : m.clienteId}, ${campo === "sucursal" ? valor : m.sucursalId},
                 ${campo === "tecnico" ? valor : m.tecnicoId}, ${campo === "motivo" ? valor : "'VISITA'"}, '2026-10-26', N'x')`;
      expect(await mensajeDeError(base("cliente", "99999"))).toMatch(/fk_visita_cliente/);
      expect(await mensajeDeError(base("sucursal", "99999"))).toMatch(/fk_visita_sucursal/);
      expect(await mensajeDeError(base("tecnico", "99999"))).toMatch(/fk_visita_tecnico/);
      expect(await mensajeDeError(base("motivo", "'NO_EXISTE'"))).toMatch(/fk_visita_motivo/);
    });

    it("una sucursal solo puede usar una marca de su mismo cliente (FK compuesta)", async () => {
      await consulta(`INSERT INTO ${T.cliente} (rut, razon_social, nombre_fantasia) VALUES ('76.000.002-0', N'Dos SpA', N'Dos')`);
      const otro = (await uno<{ id: number }>(`SELECT id FROM ${T.cliente} WHERE rut = '76.000.002-0'`))!.id;
      const e = await mensajeDeError(`INSERT INTO ${T.sucursal} (cliente_id, marca_id, nombre, direccion, comuna, region)
        VALUES (${otro}, ${m.marcaId}, N'Cruzada', N'X', N'Y', N'Z')`);
      expect(e).toMatch(/fk_sucursal_marca/);
    });

    it("no se puede borrar un cliente que tiene sucursales o visitas (NO ACTION en maestros)", async () => {
      await insertarVisita(m);
      expect(await mensajeDeError(`DELETE FROM ${T.cliente} WHERE id = ${m.clienteId}`)).toMatch(/REFERENCE constraint/i);
      expect(await mensajeDeError(`DELETE FROM ${T.tecnico} WHERE id = ${m.tecnicoId}`)).toMatch(/REFERENCE constraint/i);
    });

    it("borrar una visita arrastra sus tablas hijas (CASCADE), nunca deja huérfanos", async () => {
      const v = await insertarVisita(m);
      await consulta(`
        INSERT INTO ${T.problema} (visita_id, tipo_codigo) VALUES (${v.id}, 'ANTENA_NO_DETECTA');
        INSERT INTO ${T.visita_ejecucion} (visita_id, hora_inicio, responsable_nombre) VALUES (${v.id}, SYSDATETIME(), N'María');
        INSERT INTO ${T.visita_motivo} (visita_id, motivo_codigo, ambito) VALUES (${v.id}, 'VISITA', 'PLAN');`);
      await consulta(`DELETE FROM ${T.visita} WHERE id = ${v.id}`);
      for (const tabla of ["problema", "visita_ejecucion", "visita_motivo", "visita_estado_historial"] as const) {
        const n = await uno<{ n: number }>(`SELECT COUNT(*) AS n FROM ${T[tabla]} WHERE visita_id = ${v.id}`);
        expect(Number(n!.n), tabla).toBe(0);
      }
    });
  });

  describe("valores por defecto", () => {
    it("una visita nace PROGRAMADA, activa y con sus marcas de tiempo", async () => {
      const v = await insertarVisita(m);
      const f = await uno<{ estado: string; activo: boolean; creado_en: Date | null; creada_en_terreno: boolean }>(
        `SELECT estado, activo, creado_en, creada_en_terreno FROM ${T.visita} WHERE id = ${v.id}`
      );
      expect(f).toMatchObject({ estado: "PROGRAMADA", activo: true, creada_en_terreno: false });
      expect(f!.creado_en).toBeTruthy();
    });

    it("el DDL trae los cuatro estados de problema de siempre", async () => {
      const filas = await consulta<{ codigo: string }>(`SELECT codigo FROM ${T.catalogo_problema_estado} ORDER BY orden`);
      expect(filas.map((f) => f.codigo)).toEqual(["ABIERTO", "AGENDADO", "PENDIENTE", "RESUELTO"]);
    });
  });
});
