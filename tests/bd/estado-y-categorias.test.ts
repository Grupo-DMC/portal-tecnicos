import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { consulta } from "@/lib/data/sql";
import { guardarMarca, guardarTecnico, listarMarcas } from "@/lib/data/maestros";
import { guardarChecklist, listarProblemas, listarSecciones } from "@/lib/data/catalogos";
import { hayBd, limpiarDatos, mensajeDeError, sembrarMundo, type Mundo } from "./_ayuda";

// Migración 039 (motivo obligatorio al desactivar, con su historial) y 040
// (categorías de los tipos de problema), contra una base real.
describe.skipIf(!hayBd)("BD · motivo al desactivar y categorías de problema", () => {
  let m: Mundo;
  const actor = { id: 1, email: "coordinacion@example.com" };

  beforeEach(async () => {
    await limpiarDatos();
    m = await sembrarMundo();
  });
  afterAll(() => limpiarDatos());

  describe("la base no deja nada inactivo sin motivo", () => {
    it("en las siete tablas, al actualizar y al insertar", async () => {
      expect(await mensajeDeError(`UPDATE dmc.cliente SET activo = 0 WHERE id = ${m.clienteId}`)).toMatch(/ck_cliente_motivo_inactivo/);
      expect(await mensajeDeError(`UPDATE dmc.marca SET activo = 0, motivo_inactivo = N'   ' WHERE id = ${m.marcaId}`)).toMatch(
        /ck_marca_motivo_inactivo/
      );
      expect(await mensajeDeError(`UPDATE dmc.sucursal SET activo = 0 WHERE id = ${m.sucursalId}`)).toMatch(/ck_sucursal_motivo_inactivo/);
      expect(await mensajeDeError(`UPDATE dmc.tecnico SET activo = 0 WHERE id = ${m.tecnicoId}`)).toMatch(/ck_tecnico_motivo_inactivo/);
      expect(await mensajeDeError(`UPDATE dmc.usuario SET activo = 0 WHERE id = ${m.adminId}`)).toMatch(/ck_usuario_motivo_inactivo/);
      expect(await mensajeDeError(`INSERT INTO dmc.mall (nombre, direccion, activo) VALUES (N'Mall X', N'Calle 1', 0)`)).toMatch(
        /ck_mall_motivo_inactivo/
      );
      expect(await mensajeDeError(`INSERT INTO dmc.contacto (nombre, activo) VALUES (N'Pedro', 0)`)).toMatch(/ck_contacto_motivo_inactivo/);
    });

    it("el historial tampoco acepta una baja sin motivo", async () => {
      expect(
        await mensajeDeError(`INSERT INTO dmc.cambio_estado (entidad, entidad_id, activo) VALUES ('marca', ${m.marcaId}, 0)`)
      ).toMatch(/ck_cambio_estado_motivo/);
    });
  });

  describe("guardar anota quién, cuándo y por qué", () => {
    it("desactivar y reactivar una marca deja dos filas en el historial y borra el motivo vigente", async () => {
      await guardarMarca(m.marcaId, { clienteId: m.clienteId, nombre: "Marca Uno", activo: false, motivoInactivo: "  Cerró la cadena " }, actor);
      const [inactiva] = await listarMarcas({ clienteId: m.clienteId });
      expect(inactiva).toMatchObject({ activo: false, motivoInactivo: "Cerró la cadena" });
      expect(inactiva.baja).toMatchObject({ motivo: "Cerró la cadena", por: actor.email });
      expect(inactiva.baja?.en).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      // Guardar de nuevo sin cambiar el estado no anota nada.
      await guardarMarca(m.marcaId, { clienteId: m.clienteId, nombre: "Marca Uno bis", activo: false, motivoInactivo: "Cerró la cadena" }, actor);

      await guardarMarca(m.marcaId, { clienteId: m.clienteId, nombre: "Marca Uno", activo: true }, actor);
      const [activa] = await listarMarcas({ clienteId: m.clienteId });
      expect(activa).toMatchObject({ activo: true, motivoInactivo: null, baja: null });

      const historial = await consulta<{ activo: boolean; motivo: string | null; usuario_email: string }>(
        `SELECT activo, motivo, usuario_email FROM dmc.cambio_estado WHERE entidad = 'marca' AND entidad_id = ${m.marcaId} ORDER BY id`
      );
      expect(historial).toEqual([
        { activo: false, motivo: "Cerró la cadena", usuario_email: actor.email },
        { activo: true, motivo: null, usuario_email: actor.email },
      ]);
    });

    it("si la base rechaza la baja, no queda ni el cambio ni la fila del historial", async () => {
      await expect(
        guardarTecnico(
          m.tecnicoId,
          { rut: "11.111.111-1", nombres: "Ana", apellidoPaterno: "Pérez", apellidoMaterno: null, email: "ana@example.com", telefono: null, activo: false, motivoInactivo: "  " },
          actor
        )
      ).rejects.toThrow(/ck_tecnico_motivo_inactivo/);
      const [fila] = await consulta<{ activo: boolean; n: number }>(
        `SELECT t.activo, (SELECT COUNT(*) FROM dmc.cambio_estado WHERE entidad = 'tecnico') AS n FROM dmc.tecnico t WHERE t.id = ${m.tecnicoId}`
      );
      expect(fila).toEqual({ activo: true, n: 0 });
    });
  });

  describe("categorías de los tipos de problema", () => {
    it("el guardado del checklist las crea, ordena y reparte, y quitarla deja el tipo sin categoría", async () => {
      const problemas = await listarProblemas();
      const base = {
        motivos: [],
        trabajos: [],
        problemas: problemas.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          grupoLabel: p.grupoLabel,
          opciones: [],
          seccion: p.codigo === "OTRO" ? "Otros" : "Antenas",
        })),
      };
      await guardarChecklist({ ...base, seccionesProblema: ["Antenas", "Otros"] });
      expect((await listarSecciones("PROBLEMA")).map((s) => s.nombre)).toEqual(["Antenas", "Otros"]);
      const porCodigo = Object.fromEntries((await listarProblemas()).map((p) => [p.codigo, p.seccion]));
      expect(porCodigo).toEqual({ ANTENA_NO_DETECTA: "Antenas", OTRO: "Otros" });

      // Sin «Otros» en la lista: la categoría se desactiva y su tipo queda suelto, sin borrarse.
      await guardarChecklist({
        ...base,
        problemas: base.problemas.map((p) => ({ ...p, seccion: p.seccion === "Otros" ? null : p.seccion })),
        seccionesProblema: ["Antenas"],
      });
      const despues = await listarProblemas();
      expect(despues.find((p) => p.codigo === "OTRO")?.seccion).toBeNull();
      expect(despues).toHaveLength(2);
    });

    it("una sección de tipo desconocido sigue sin entrar", async () => {
      expect(await mensajeDeError(`INSERT INTO dmc.catalogo_seccion (tipo, nombre) VALUES ('OTRA_COSA', N'X')`)).toMatch(
        /ck_catalogo_seccion_tipo/
      );
    });
  });
});
