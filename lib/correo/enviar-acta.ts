import "server-only";
import { zipSync } from "fflate";
import { log } from "@/lib/log";
import {
  cerrarEnvioActa,
  crearEnvioActa,
  getFotoBinaria,
  getVisitaCompletaPorFolio,
  type AdjuntoRegistrado,
} from "@/lib/data/visitas";
import { getVideoMeta, getVideoTramo } from "@/lib/data/videos";
import { pdfDeVisita } from "@/lib/pdf/acta-de-visita";
import { armarCorreoActa } from "@/lib/correo/plantilla-acta";
import { configCorreo, enviarCorreo, remitenteDe, type AdjuntoCorreo } from "@/lib/correo/proveedor";
import { nombreArchivoActa, nombreZipMultimedia } from "@/lib/ui/nombre-acta";
import { archivosMultimedia } from "@/lib/ui/descarga";
import { unirCorreos, type ClaveAdjunto } from "@/lib/ui/correo";
import type { Visita } from "@/lib/types";

// Manda el acta de una visita por correo y deja el registro en tecnico.acta_envio.
//
//   1. Comprueba que el correo esté configurado y que la visita esté cerrada.
//   2. Junta los adjuntos elegidos: el PDF del acta y el mismo .zip de fotos y
//      videos que se descarga en el panel (solo lo del cliente, nunca lo interno).
//   3. Anota el envío ENCOLADO, con cada archivo que sale.
//   4. Llama al proveedor con la cuenta de quien lo envía y deja el envío
//      ENVIADO o en ERROR con el motivo.

/**
 * Tope de lo que se adjunta, antes de pasarlo a base64 (que infla un tercio).
 * Resend acepta hasta 40 MB por correo ya codificado: 28 MB en bruto quedan
 * justo por debajo, con margen para el cuerpo del mensaje.
 */
export const MAX_BYTES_ADJUNTOS = 28 * 1024 * 1024;

export type ResultadoEnvioActa = { ok: true; adjuntos: number; para: string[] } | { ok: false; error: string };

function mb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

interface AdjuntosListos {
  archivos: AdjuntoCorreo[];
  registro: AdjuntoRegistrado[];
}

type Preparacion = { ok: true; listos: AdjuntosListos } | { ok: false; error: string };

async function prepararAdjuntos(visita: Visita, claves: readonly ClaveAdjunto[]): Promise<Preparacion> {
  const pedidas = new Set(claves);
  const archivos: AdjuntoCorreo[] = [];
  const registro: AdjuntoRegistrado[] = [];

  let pdf: Uint8Array | null = null;
  if (pedidas.has("pdf")) pdf = await pdfDeVisita(visita);

  const multimedia = pedidas.has("zip") ? archivosMultimedia(visita) : [];
  // El peso de los videos se mira antes de leerlos: un clip llega a 25 MB y no
  // tiene sentido traerlo a memoria si el correo igual no va a poder salir.
  const metas = await Promise.all(multimedia.map((a) => (a.tipo === "VIDEO" ? getVideoMeta(a.id) : null)));
  const pesoVideos = metas.reduce((s, m) => s + (m?.total ?? 0), 0);
  if ((pdf?.length ?? 0) + pesoVideos > MAX_BYTES_ADJUNTOS) {
    return {
      ok: false,
      error:
        `Los videos pesan ${mb(pesoVideos)} y un correo admite hasta ${mb(MAX_BYTES_ADJUNTOS)} en adjuntos. ` +
        `Desmarca el zip y compártelo por otro medio (se descarga desde «Descargar»).`,
    };
  }

  if (pdf) {
    const nombre = nombreArchivoActa(visita);
    archivos.push({ nombre, contenido: Buffer.from(pdf), tipo: "application/pdf" });
    registro.push({ tipo: "PDF_ACTA", nombre });
  }

  if (multimedia.length) {
    const entradas: Record<string, Uint8Array> = {};
    for (const [i, a] of multimedia.entries()) {
      const bytes =
        a.tipo === "FOTO"
          ? (await getFotoBinaria(a.id))?.bytes
          : metas[i]
            ? await getVideoTramo(a.id, 0, metas[i]!.total - 1)
            : null;
      if (!bytes) continue;
      entradas[a.nombre] = new Uint8Array(bytes);
      registro.push(a.tipo === "FOTO" ? { tipo: "FOTO", fotoId: a.id, nombre: a.nombre } : { tipo: "VIDEO", videoId: a.id, nombre: a.nombre });
    }
    if (Object.keys(entradas).length) {
      // Igual que la descarga del panel: sin comprimir, porque fotos y videos ya
      // vienen comprimidos y recomprimirlos no ahorra nada.
      const zip = zipSync(entradas, { level: 0 });
      archivos.push({ nombre: nombreZipMultimedia(visita), contenido: Buffer.from(zip), tipo: "application/zip" });
    }
  }

  const peso = archivos.reduce((s, a) => s + a.contenido.length, 0);
  if (peso > MAX_BYTES_ADJUNTOS) {
    return {
      ok: false,
      error: `Los adjuntos pesan ${mb(peso)} y un correo admite hasta ${mb(MAX_BYTES_ADJUNTOS)}. Desmarca el zip y compártelo por otro medio.`,
    };
  }
  return { ok: true, listos: { archivos, registro } };
}

export async function enviarActaPorCorreo(input: {
  folio: string;
  /** Si va vacío, el correo va dirigido a quien lo envía y el resto en CC y CCO. */
  para: string[];
  cc: string[];
  cco: string[];
  asunto: string;
  cuerpo: string;
  adjuntos: ClaveAdjunto[];
  usuarioId: number;
  /** El correo con que inició sesión: el remitente y a quien le llegan las respuestas. */
  usuarioEmail: string;
}): Promise<ResultadoEnvioActa> {
  const config = configCorreo();
  if (!config) {
    return {
      ok: false,
      error: "El envío de correo no está configurado en el servidor. Pide que definan RESEND_API_KEY y CORREO_REMITENTE.",
    };
  }

  const visita = await getVisitaCompletaPorFolio(input.folio);
  if (!visita) return { ok: false, error: "No encontramos esa visita." };
  if (visita.estado !== "COMPLETADA") return { ok: false, error: "Solo se envía el acta de una visita completada." };

  let preparacion: Preparacion;
  try {
    preparacion = await prepararAdjuntos(visita, input.adjuntos);
  } catch (err) {
    log.error("correo del acta: no se pudieron preparar los adjuntos", { err, usuarioId: input.usuarioId, folio: input.folio });
    return { ok: false, error: "No se pudo preparar el PDF o el zip. Prueba de nuevo." };
  }
  if (!preparacion.ok) return preparacion;
  const { archivos, registro } = preparacion.listos;

  const remitente = remitenteDe(input.usuarioEmail, config);
  const para = input.para.length ? input.para : [remitente.responderA];
  const correo = armarCorreoActa(
    visita,
    input.cuerpo,
    archivos.map((a) => a.nombre)
  );
  const envioId = await crearEnvioActa({
    visitaId: visita.id,
    para: unirCorreos(para),
    cc: unirCorreos(input.cc),
    cco: unirCorreos(input.cco),
    asunto: input.asunto,
    cuerpo: input.cuerpo,
    adjuntos: registro,
    usuarioId: input.usuarioId,
  });

  const resultado = await enviarCorreo(
    {
      de: remitente.de,
      responderA: remitente.responderA,
      para,
      cc: input.cc,
      cco: input.cco,
      asunto: input.asunto,
      html: correo.html,
      texto: correo.texto,
      adjuntos: archivos,
      idempotencia: `acta-envio-${envioId}`,
    },
    config
  );

  // Si esto falla el correo ya salió (o no): se avisa en el log y no se le dice
  // al usuario que algo falló cuando el cliente sí recibió el acta.
  try {
    await cerrarEnvioActa(envioId, resultado.ok ? { ok: true } : { ok: false, error: resultado.error });
  } catch (err) {
    log.error("correo del acta: no se pudo anotar cómo terminó el envío", { err, envioId, ok: resultado.ok });
  }

  if (!resultado.ok) {
    log.warn("correo del acta: el proveedor no lo aceptó", { envioId, usuarioId: input.usuarioId, error: resultado.error });
    return { ok: false, error: resultado.error };
  }
  log.info("correo del acta enviado", {
    envioId,
    proveedorId: resultado.id,
    usuarioId: input.usuarioId,
    conSuCorreo: remitente.conSuCorreo,
    adjuntos: archivos.length,
  });
  return { ok: true, adjuntos: archivos.length, para };
}
