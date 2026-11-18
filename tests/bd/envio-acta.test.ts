import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { cerrarEnvioActa, correosConocidos, crearEnvioActa, getActaEnviada } from "@/lib/data/visitas";
import { registrarPersonaLocal } from "@/lib/data/personas-local";
import { consulta } from "@/lib/data/sql";
import { hayBd, insertarVisita, limpiarDatos, sembrarMundo, uno, type Mundo } from "./_ayuda";

// El envío del acta por correo contra una base real: el registro con CCO y los
// videos del zip, y los correos que se sugieren por tienda y por cliente.
describe.skipIf(!hayBd)("BD · envío del acta por correo", () => {
  let m: Mundo;

  beforeEach(async () => {
    await limpiarDatos();
    m = await sembrarMundo();
  });
  afterAll(() => limpiarDatos());

  async function videoDe(visitaId: number): Promise<number> {
    await consulta(`
      INSERT INTO dmc.visita_video (visita_id, archivo_url, contenido, mime, bytes, bytes_recibidos, duracion_seg, orden, subida_completa)
      VALUES (${visitaId}, '', 0x00000018667479706D703432, 'video/mp4', 12, 12, 3, 1, 1)`);
    return Number((await uno<{ id: number }>(`SELECT TOP 1 id FROM dmc.visita_video ORDER BY id DESC`))!.id);
  }

  it("registra Para, CC, CCO, el PDF y cada video del zip, y quién lo envió", async () => {
    const v = await insertarVisita(m, { estado: "COMPLETADA" });
    const videoId = await videoDe(v.id);
    const id = await crearEnvioActa({
      visitaId: v.id,
      para: "a@x.cl",
      cc: "b@x.cl",
      cco: "oculto@x.cl",
      asunto: "Acta",
      cuerpo: "Hola",
      adjuntos: [
        { tipo: "PDF_ACTA", nombre: "acta.pdf" },
        { tipo: "VIDEO", videoId, nombre: `${v.folio} - video 1.mp4` },
      ],
      usuarioId: m.adminId,
    });
    expect(await getActaEnviada(v.folio)).toMatchObject({ estado: "ENCOLADO", cco: "oculto@x.cl", adjuntos: 2 });

    await cerrarEnvioActa(id, { ok: true });
    const enviada = await getActaEnviada(v.folio);
    expect(enviada).toMatchObject({ para: "a@x.cl", cc: "b@x.cl", cco: "oculto@x.cl", estado: "ENVIADO", error: null });
    expect(enviada!.enviadoPor).toMatch(/@/);
    expect(enviada!.en).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
  });

  it("un envío fallido guarda el motivo", async () => {
    const v = await insertarVisita(m, { estado: "COMPLETADA" });
    const id = await crearEnvioActa({ visitaId: v.id, para: "a@x.cl", cc: "", cco: "", asunto: "Acta", cuerpo: "Hola", adjuntos: [], usuarioId: m.adminId });
    await cerrarEnvioActa(id, { ok: false, error: "El proveedor de correo respondió 500." });
    expect(await getActaEnviada(v.folio)).toMatchObject({ estado: "ERROR", error: "El proveedor de correo respondió 500.", cc: "", cco: "" });
  });

  it("sugiere quienes firmaron en la tienda y a quienes ya se les mandó (tienda primero, después el cliente)", async () => {
    await registrarPersonaLocal(m.sucursalId, { nombre: "María", email: "maria@tienda.cl", cargo: "Jefa de tienda" });
    const v = await insertarVisita(m, { estado: "COMPLETADA" });
    await consulta(`
      INSERT INTO dmc.visita_ejecucion (visita_id, hora_inicio, hora_termino, responsable_nombre, responsable_email)
      VALUES (${v.id}, '2026-10-26T09:00:00', '2026-10-26T10:00:00', N'Carla', N'carla@tienda.cl')`);

    const enviado = await crearEnvioActa({
      visitaId: v.id, para: "gerente@cliente.cl", cc: "maria@tienda.cl", cco: "auditor@cliente.cl",
      asunto: "Acta", cuerpo: "Hola", adjuntos: [], usuarioId: m.adminId,
    });
    await cerrarEnvioActa(enviado, { ok: true });
    // Los fallidos no se sugieren: puede que el correo estuviera mal escrito.
    const fallido = await crearEnvioActa({
      visitaId: v.id, para: "mal@escrito.cl", cc: "", cco: "", asunto: "Acta", cuerpo: "Hola", adjuntos: [], usuarioId: m.adminId,
    });
    await cerrarEnvioActa(fallido, { ok: false, error: "x" });

    const conocidos = await correosConocidos(m.sucursalId, m.clienteId);
    const emails = conocidos.map((c) => c.email);
    expect(emails).toEqual(expect.arrayContaining(["maria@tienda.cl", "carla@tienda.cl", "gerente@cliente.cl", "auditor@cliente.cl"]));
    expect(emails).not.toContain("mal@escrito.cl");
    expect(conocidos.find((c) => c.email === "maria@tienda.cl")!.detalle).toBe("Jefa de tienda · firmó en la tienda");
    expect(conocidos.find((c) => c.email === "gerente@cliente.cl")!.detalle).toBe("Envío anterior · esta tienda");
  });
});
