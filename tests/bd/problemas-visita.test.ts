import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { consulta } from "@/lib/data/sql";
import { crearVisita, getVisitaCompletaPorFolio, guardarActa, iniciarVisita } from "@/lib/data/visitas";
import { guardarProblemasDeVisita } from "@/lib/data/problemas-visita";
import { editarActa } from "@/lib/data/ediciones";
import type { ActaEntrada, EdicionActaEntrada, ProblemaEdicion } from "@/lib/contratos/acta";
import type { DatosVisita } from "@/lib/contratos/visitas";
import { hoyISO, sumarDias } from "@/lib/ui/fecha";
import { hayBd, limpiarDatos, sembrarMundo, uno, type Mundo } from "./_ayuda";
import { T, type Objeto } from "@/lib/db/esquema";

// PNG de 1×1 píxel y un JPEG mínimo (solo importan los primeros bytes: así se reconoce el formato).
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const JPEG = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]).toString("base64")}`;

const cuenta = async (tabla: Objeto, donde = "1=1") =>
  Number((await uno<{ n: number }>(`SELECT COUNT(*) AS n FROM ${T[tabla]} WHERE ${donde}`))!.n);

describe.skipIf(!hayBd)("BD · problemas anotados desde el panel y edición del acta", () => {
  let m: Mundo;
  const datos = (): DatosVisita => ({
    clienteId: m.clienteId,
    sucursalId: m.sucursalId,
    tecnicoId: m.tecnicoId,
    tecnicoAyudanteId: null,
    motivoCodigo: "VISITA",
    motivosCodigos: ["VISITA"],
    fechaProgramada: sumarDias(hoyISO(), 7),
    horaProgramada: null,
    trabajoSolicitado: "Revisar antenas",
    indicacionesAcceso: null,
    responsableNombre: "María Soto",
    responsableRut: "11.111.111-1",
    responsableTelefono: "+56911111111",
  });
  const ctxA = () => ({ tecnicoId: m.tecnicoId, usuarioId: m.usuarioTecnicoId });
  const acta = (folio: string, extra: Partial<ActaEntrada> = {}): ActaEntrada => ({
    folio,
    responsableNombre: "María Soto",
    responsableRut: "11.111.111-1",
    responsableTelefono: "+56911111111",
    responsableCargo: null,
    motivosCodigos: ["VISITA"],
    observaciones: "Todo en orden",
    comentarioInterno: null,
    internosCodigos: [],
    trabajos: [{ codigo: "REVISION_ANTENAS", motivoCodigo: "VISITA", detalle: null, subtrabajos: [] }],
    problemas: [],
    fotos: [],
    firma: { nombre: "María Soto", rut: "11.111.111-1", dataUrl: PNG },
    dispositivo: "Pixel de prueba",
    ...extra,
  });
  const problema = (extra: Partial<ProblemaEdicion> = {}): ProblemaEdicion => ({
    id: null,
    tipoCodigo: "ANTENA_NO_DETECTA",
    descripcion: "Sin lectura",
    items: [{ etiqueta: "Antena 2", cantidad: 3 }],
    ...extra,
  });

  beforeEach(async () => {
    await limpiarDatos();
    m = await sembrarMundo();
  });
  afterAll(() => limpiarDatos());

  const filas = () =>
    consulta<{ id: number; tipo_codigo: string; descripcion: string | null; orden: number; registrado_en_panel: boolean }>(
      `SELECT id, tipo_codigo, descripcion, orden, registrado_en_panel FROM ${T.problema} ORDER BY orden, id`
    );

  describe("guardarProblemasDeVisita (visita sin cerrar)", () => {
    it("agrega uno o varios problemas con su cantidad, marcados como anotados desde el panel", async () => {
      const v = await crearVisita(datos(), m.adminId);
      const r = await guardarProblemasDeVisita(v.folio, [
        problema(),
        problema({ tipoCodigo: "OTRO", descripcion: "Humedad en la bodega", items: [] }),
      ]);
      expect(r).toMatchObject({ ok: true, agregados: 2, modificados: 0, quitados: 0 });

      const lista = await filas();
      expect(lista.map((f) => [f.tipo_codigo, Number(f.orden), f.registrado_en_panel])).toEqual([
        ["ANTENA_NO_DETECTA", 1, true],
        ["OTRO", 2, true],
      ]);
      expect((await uno<{ cantidad: number }>(`SELECT cantidad FROM ${T.problema_item}`))!.cantidad).toBe(3);
      // La visita sigue PROGRAMADA: anotar problemas no la mueve de estado.
      expect((await getVisitaCompletaPorFolio(v.folio))!.estado).toBe("PROGRAMADA");
    });

    it("también en una visita en curso", async () => {
      const v = await crearVisita(datos(), m.adminId);
      expect(await iniciarVisita(v.folio, null, ctxA())).toBeNull();
      expect((await guardarProblemasDeVisita(v.folio, [problema()])).ok).toBe(true);
    });

    it("corrige, quita y agrega en la misma llamada, conservando la fila del que se corrige", async () => {
      const v = await crearVisita(datos(), m.adminId);
      await guardarProblemasDeVisita(v.folio, [problema(), problema({ tipoCodigo: "OTRO", descripcion: "Humedad", items: [] })]);
      const [primero] = await filas();

      const r = await guardarProblemasDeVisita(v.folio, [
        // El primero se corrige (más equipos); el «Otro» se quita; entra uno nuevo.
        problema({ id: Number(primero.id), items: [{ etiqueta: "Antena 2", cantidad: 5 }, { etiqueta: "Antena 3", cantidad: 1 }] }),
        problema({ descripcion: "Otra antena", items: [{ etiqueta: "Antena 9", cantidad: 1 }] }),
      ]);
      expect(r).toMatchObject({ ok: true, agregados: 1, modificados: 1, quitados: 1 });

      const lista = await filas();
      expect(lista).toHaveLength(2);
      expect(Number(lista[0].id)).toBe(Number(primero.id));
      expect(lista.some((f) => f.tipo_codigo === "OTRO")).toBe(false);
      const items = await consulta<{ etiqueta: string; cantidad: number }>(
        `SELECT etiqueta, cantidad FROM ${T.problema_item} WHERE problema_id = ${primero.id} ORDER BY etiqueta`
      );
      expect(items.map((i) => [i.etiqueta, Number(i.cantidad)])).toEqual([["Antena 2", 5], ["Antena 3", 1]]);
    });

    it("si no cambió nada, lo dice y no escribe", async () => {
      const v = await crearVisita(datos(), m.adminId);
      await guardarProblemasDeVisita(v.folio, [problema()]);
      const [p] = await filas();
      const r = await guardarProblemasDeVisita(v.folio, [problema({ id: Number(p.id) })]);
      expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/No cambiaste nada/) });
    });

    it("un id de otra visita no se toma como suyo: entra como uno nuevo", async () => {
      const a = await crearVisita(datos(), m.adminId);
      const b = await crearVisita(datos(), m.adminId);
      await guardarProblemasDeVisita(a.folio, [problema()]);
      const [deA] = await filas();
      const r = await guardarProblemasDeVisita(b.folio, [problema({ id: Number(deA.id), descripcion: "Otra cosa" })]);
      expect(r).toMatchObject({ ok: true, agregados: 1 });
      expect(await cuenta("problema")).toBe(2);
      expect((await uno<{ d: string }>(`SELECT descripcion AS d FROM ${T.problema} WHERE id = ${deA.id}`))!.d).toBe("Sin lectura");
    });

    it("no quita un problema que coordinación ya gestionó, y no deja nada a medias", async () => {
      const v = await crearVisita(datos(), m.adminId);
      await guardarProblemasDeVisita(v.folio, [problema(), problema({ descripcion: "Otro" })]);
      const [primero, segundo] = await filas();
      await consulta(`UPDATE ${T.problema} SET estado = 'RESUELTO', resuelto_en = SYSDATETIME() WHERE id = ${primero.id}`);

      const r = await guardarProblemasDeVisita(v.folio, [problema({ id: Number(segundo.id), descripcion: "Cambiado" })]);
      expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/ya lo gestionó coordinación/) });
      expect(await cuenta("problema")).toBe(2);
      expect((await uno<{ d: string }>(`SELECT descripcion AS d FROM ${T.problema} WHERE id = ${segundo.id}`))!.d).toBe("Otro");
    });

    it("una visita con el acta cerrada se corrige desde «Editar el acta»", async () => {
      const v = await crearVisita(datos(), m.adminId);
      await iniciarVisita(v.folio, null, ctxA());
      expect((await guardarActa(acta(v.folio), ctxA())).ok).toBe(true);
      const r = await guardarProblemasDeVisita(v.folio, [problema()]);
      expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/Editar el acta/) });
      expect(await cuenta("problema")).toBe(0);
    });

    it("una visita que no existe se rechaza", async () => {
      expect((await guardarProblemasDeVisita("V-0000-99999", [problema()])).error).toMatch(/No encontramos esa visita/);
    });
  });

  describe("cuando el técnico cierra el acta", () => {
    it("los problemas anotados desde el panel se quedan y se suman a los que levanta el técnico", async () => {
      const v = await crearVisita(datos(), m.adminId);
      await guardarProblemasDeVisita(v.folio, [problema({ descripcion: "Lo anotó coordinación" })]);
      expect(await iniciarVisita(v.folio, null, ctxA())).toBeNull();

      const cierre = await guardarActa(
        acta(v.folio, {
          problemas: [{ tipoCodigo: "OTRO", estado: "ABIERTO", descripcion: "Lo levantó el técnico", solucion: null, items: [] }],
        }),
        ctxA()
      );
      expect(cierre.ok).toBe(true);
      const lista = await filas();
      expect(lista.map((f) => [f.descripcion, f.registrado_en_panel])).toEqual([
        ["Lo anotó coordinación", true],
        ["Lo levantó el técnico", false],
      ]);
    });
  });

  describe("editarActa (acta cerrada, desde el panel)", () => {
    const ctxAdmin = () => ({ usuarioId: m.adminId, tecnicoId: null, origen: "WEB" as const, sinPlazo: true });

    /** Cierra el acta con una foto y devuelve la edición tal como la manda el editor del panel. */
    async function cerradaConFoto() {
      const v = await crearVisita(datos(), m.adminId);
      await iniciarVisita(v.folio, null, ctxA());
      expect((await guardarActa(acta(v.folio, { fotos: [{ dataUrl: PNG, etiqueta: null }] }), ctxA())).ok).toBe(true);
      const completa = (await getVisitaCompletaPorFolio(v.folio))!;
      const base: EdicionActaEntrada = {
        folio: v.folio,
        motivoEdicion: "Corrección de prueba",
        edicionesVistas: 0,
        responsableNombre: "María Soto",
        responsableRut: "11.111.111-1",
        responsableTelefono: "+56911111111",
        motivosCodigos: ["VISITA"],
        observaciones: "Todo en orden",
        comentarioInterno: null,
        internosCodigos: [],
        trabajos: [{ codigo: "REVISION_ANTENAS", motivoCodigo: "VISITA", detalle: null, subtrabajos: [] }],
        problemas: [],
        fotosConservadas: completa.fotos!.map((f) => f.id),
        fotosNuevas: [],
        videosIds: [],
        videosInternosIds: [],
      };
      return { v, completa, base };
    }

    it("agrega, corrige y quita problemas de un acta que no tenía ninguno", async () => {
      const { v, base } = await cerradaConFoto();
      const r1 = await editarActa({ ...base, problemas: [problema(), problema({ tipoCodigo: "OTRO", descripcion: "Humedad", items: [] })] }, ctxAdmin());
      expect(r1).toMatchObject({ ok: true });
      expect(await cuenta("problema", `visita_id = ${v.id}`)).toBe(2);
      // Los de una acta cerrada no llevan la marca del panel: el cierre ya pasó.
      expect((await filas()).every((f) => !f.registrado_en_panel)).toBe(true);

      const [uno1] = await filas();
      const r2 = await editarActa(
        { ...base, edicionesVistas: 1, problemas: [problema({ id: Number(uno1.id), items: [{ etiqueta: "Antena 2", cantidad: 7 }] })] },
        ctxAdmin()
      );
      expect(r2.ok).toBe(true);
      expect(await cuenta("problema", `visita_id = ${v.id}`)).toBe(1);
      expect((await uno<{ c: number }>(`SELECT cantidad AS c FROM ${T.problema_item}`))!.c).toBe(7);
      const detalle = (await uno<{ d: string }>(`SELECT TOP 1 detalle AS d FROM ${T.visita_edicion} ORDER BY id DESC`))!.d;
      expect(detalle).toMatch(/Problema modificado/);
      expect(detalle).toMatch(/Problema quitado/);
    });

    it("una foto girada reemplaza la imagen de su misma fila: mismo id, misma ruta, bytes nuevos", async () => {
      const { v, completa, base } = await cerradaConFoto();
      const foto = completa.fotos![0];
      const antes = (await uno<{ b: number; mime: string }>(`SELECT bytes AS b, mime FROM ${T.visita_foto} WHERE id = ${foto.id}`))!;
      expect(antes.mime).toBe("image/png");

      const r = await editarActa({ ...base, fotosGiradas: [{ id: foto.id, dataUrl: JPEG }] }, ctxAdmin());
      expect(r).toMatchObject({ ok: true, secciones: ["Fotos y video"] });

      const despues = (await uno<{ b: number; mime: string; url: string; activo: boolean }>(
        `SELECT bytes AS b, mime, archivo_url AS url, activo FROM ${T.visita_foto} WHERE id = ${foto.id}`
      ))!;
      expect(despues.mime).toBe("image/jpeg");
      expect(despues.b).not.toBe(antes.b);
      expect(despues.url).toBe(foto.archivoUrl);
      expect(despues.activo).toBe(true);
      // No se duplicó ni se desactivó ninguna.
      expect(await cuenta("visita_foto", `visita_id = ${v.id}`)).toBe(1);
      const detalle = (await uno<{ d: string }>(`SELECT TOP 1 detalle AS d FROM ${T.visita_edicion} ORDER BY id DESC`))!.d;
      expect(detalle).toMatch(/Fotos del trabajo giradas: 1 \(n\.º \d+\)/);
    });

    it("solo giran las fotos que siguen en el acta: una quitada o ajena se ignora", async () => {
      const { v, completa, base } = await cerradaConFoto();
      const foto = completa.fotos![0];
      const bytes = (await uno<{ b: number }>(`SELECT bytes AS b FROM ${T.visita_foto} WHERE id = ${foto.id}`))!.b;
      // Girada pero quitada en la misma edición, y otra de un id que no es del acta.
      const r = await editarActa(
        { ...base, fotosConservadas: [], fotosGiradas: [{ id: foto.id, dataUrl: JPEG }, { id: 999999, dataUrl: JPEG }] },
        ctxAdmin()
      );
      expect(r.ok).toBe(true);
      const f = (await uno<{ b: number; activo: boolean }>(`SELECT bytes AS b, activo FROM ${T.visita_foto} WHERE id = ${foto.id}`))!;
      expect(f.activo).toBe(false);
      expect(f.b).toBe(bytes);
      expect(v.folio).toBeTruthy();
    });

    it("una foto girada que no es una imagen se rechaza y no escribe nada", async () => {
      const { completa, base } = await cerradaConFoto();
      const foto = completa.fotos![0];
      const r = await editarActa({ ...base, fotosGiradas: [{ id: foto.id, dataUrl: "data:image/png;base64,AAAA" }] }, ctxAdmin());
      expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/giradas llegó dañada/) });
      expect(await cuenta("visita_edicion")).toBe(0);
    });
  });
});
