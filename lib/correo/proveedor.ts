import "server-only";
import { env } from "@/lib/env";

// Envío de correo por Resend (https://resend.com), con su API HTTP y fetch:
// sin SDK ni dependencias nuevas, y funciona igual en Vercel que en local.
//
// La clave vive solo en el servidor (RESEND_API_KEY). Nada de este archivo
// llega al navegador: lo importa la acción de envío, que corre en el servidor.

const URL_RESEND = "https://api.resend.com/emails";
/** Lo que se espera a Resend antes de darse por vencido. */
const ESPERA_MS = 25_000;

export interface AdjuntoCorreo {
  nombre: string;
  contenido: Buffer;
  tipo: string;
}

export interface Correo {
  /** "Nombre <correo>" del remitente: lo arma `remitenteDe`. */
  de: string;
  /** A dónde llegan las respuestas: quien lo envió. */
  responderA: string;
  para: string[];
  cc: string[];
  cco: string[];
  asunto: string;
  html: string;
  texto: string;
  adjuntos: AdjuntoCorreo[];
  /**
   * Si la misma clave llega dos veces (un reintento tras un corte de red),
   * Resend no manda el correo de nuevo. Se usa el id de dmc.acta_envio.
   */
  idempotencia: string;
}

export type ResultadoEnvio = { ok: true; id: string } | { ok: false; error: string };

export interface ConfigCorreo {
  clave: string;
  /** "Grupo dMC · Actas <actas@dominio.cl>": nombre visible y correo de respaldo. */
  remitente: string;
  /** Dominios verificados en Resend, en minúsculas. */
  dominios: string[];
}

/** "Nombre <correo@dominio>" → sus partes. Sin ángulos, todo es el correo. */
export function partesRemitente(remitente: string): { nombre: string; correo: string } {
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(remitente);
  return m ? { nombre: m[1].trim(), correo: m[2].trim() } : { nombre: "", correo: remitente.trim() };
}

const dominioDe = (correo: string) => correo.split("@")[1]?.trim().toLowerCase() ?? "";

/** La configuración, o null si falta algo para poder mandar. */
export function configCorreo(): ConfigCorreo | null {
  const clave = env("RESEND_API_KEY");
  const remitente = env("CORREO_REMITENTE");
  if (!clave || !remitente) return null;
  const extra = (env("CORREO_DOMINIOS") ?? "").split(",").map((d) => d.trim().toLowerCase().replace(/^@/, ""));
  const dominios = [...new Set([dominioDe(partesRemitente(remitente).correo), ...extra].filter(Boolean))];
  return { clave, remitente, dominios };
}

/**
 * Con qué correo sale el acta: el de la cuenta de quien la envía, siempre que
 * su dominio esté verificado en Resend (si no, Resend lo rechaza). Si no lo
 * está, sale con CORREO_REMITENTE; en los dos casos las respuestas le llegan a
 * quien lo envió.
 */
export function remitenteDe(
  usuarioEmail: string,
  config: ConfigCorreo
): { de: string; responderA: string; conSuCorreo: boolean } {
  const { nombre } = partesRemitente(config.remitente);
  const propio = usuarioEmail.trim();
  const conSuCorreo = Boolean(propio) && config.dominios.includes(dominioDe(propio));
  const nombreSeguro = nombre.replace(/["<>\s]+/g, " ").trim();
  return {
    de: conSuCorreo ? (nombreSeguro ? `"${nombreSeguro}" <${propio}>` : propio) : config.remitente,
    responderA: propio,
    conSuCorreo,
  };
}

export function correoConfigurado(): boolean {
  return configCorreo() !== null;
}

/** El mensaje de error de Resend, en algo que se pueda mostrar y guardar. */
function errorDeResend(status: number, cuerpo: unknown): string {
  const msg =
    cuerpo && typeof cuerpo === "object" && "message" in cuerpo && typeof cuerpo.message === "string"
      ? cuerpo.message
      : "";
  switch (status) {
    case 401:
    case 403:
      return `El proveedor de correo rechazó la clave o el remitente (${status})${msg ? `: ${msg}` : ""}.`;
    case 413:
      return "Los adjuntos pesan demasiado para un correo.";
    case 422:
      return `El proveedor no aceptó el correo${msg ? `: ${msg}` : "."}`;
    case 429:
      return "Se alcanzó el límite de envíos del proveedor de correo. Prueba de nuevo en unos minutos.";
    default:
      return `El proveedor de correo respondió ${status}${msg ? `: ${msg}` : "."}`;
  }
}

export async function enviarCorreo(c: Correo, config = configCorreo()): Promise<ResultadoEnvio> {
  if (!config) return { ok: false, error: "El envío de correo no está configurado en el servidor." };

  let res: Response;
  try {
    res = await fetch(URL_RESEND, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.clave}`,
        "Content-Type": "application/json",
        "Idempotency-Key": c.idempotencia,
      },
      body: JSON.stringify({
        from: c.de,
        to: c.para,
        ...(c.cc.length ? { cc: c.cc } : {}),
        ...(c.cco.length ? { bcc: c.cco } : {}),
        ...(c.responderA ? { reply_to: c.responderA } : {}),
        subject: c.asunto,
        html: c.html,
        text: c.texto,
        attachments: c.adjuntos.map((a) => ({
          filename: a.nombre,
          content: a.contenido.toString("base64"),
          content_type: a.tipo,
        })),
      }),
      signal: AbortSignal.timeout(ESPERA_MS),
      cache: "no-store",
    });
  } catch (err) {
    const vencio = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    return {
      ok: false,
      error: vencio
        ? "El proveedor de correo no respondió a tiempo. Revisa el registro antes de reintentar: puede haber salido."
        : "No se pudo conectar con el proveedor de correo.",
    };
  }

  const cuerpo: unknown = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, error: errorDeResend(res.status, cuerpo) };
  const id = cuerpo && typeof cuerpo === "object" && "id" in cuerpo ? String(cuerpo.id) : "";
  return { ok: true, id };
}
