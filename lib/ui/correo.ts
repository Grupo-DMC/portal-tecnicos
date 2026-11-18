import { mensajeCorreo } from "@/lib/ui/formato";
import { ETIQUETA_ALCANCE, type ContactoAplicable } from "@/lib/ui/contactos";

// Destinatarios del correo del acta. Puro y sin base de datos: lo usan el
// diálogo del panel (para sugerir y avisar) y la acción del servidor (que es la
// que manda de verdad y vuelve a validar todo).
//
// El correo sale con la cuenta de quien lo envía. Para, CC y CCO los escribe
// esa persona: nada viene marcado de entrada, solo se sugiere.

/** Tope de destinatarios entre Para, CC y CCO: un acta va a una tienda, no a una lista de difusión. */
export const MAX_DESTINATARIOS = 20;

export type CampoDestinatario = "para" | "cc" | "cco";

export interface CorreosLeidos {
  /** Sin repetidos (sin importar mayúsculas), en el orden en que se escribieron. */
  validos: string[];
  invalidos: string[];
}

/** "a@x.cl, b@y.cl; c@z.cl" → cada correo por separado, con los que no tienen forma de correo aparte. */
export function leerCorreos(texto: string): CorreosLeidos {
  const vistos = new Set<string>();
  const validos: string[] = [];
  const invalidos: string[] = [];
  for (const crudo of texto.split(/[,;\s]+/)) {
    const c = crudo.trim().replace(/^<|>$/g, "");
    if (!c) continue;
    if (mensajeCorreo(c) !== null) {
      invalidos.push(c);
      continue;
    }
    const clave = c.toLowerCase();
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    validos.push(c);
  }
  return { validos, invalidos };
}

/** Une correos en el formato del campo: "a@x.cl, b@y.cl". */
export function unirCorreos(correos: readonly string[]): string {
  return correos.join(", ");
}

/** Agrega un correo al texto de un campo si todavía no estaba. */
export function agregarCorreo(texto: string, correo: string): string {
  const { validos } = leerCorreos(texto);
  if (validos.some((c) => c.toLowerCase() === correo.toLowerCase())) return texto;
  const base = texto.trim().replace(/[,;]\s*$/, "");
  return base ? `${base}, ${correo}` : correo;
}

/** ¿El correo ya está en alguno de los campos? */
export function yaIncluido(correo: string, ...campos: string[]): boolean {
  const clave = correo.toLowerCase();
  return campos.some((t) => leerCorreos(t).validos.some((c) => c.toLowerCase() === clave));
}

/**
 * Para, CC y CCO ya leídos: cada correo una sola vez, en el primer campo en que
 * aparece (Para gana a CC y CC a CCO).
 */
export function repartirDestinatarios(campos: Record<CampoDestinatario, string>): {
  para: string[];
  cc: string[];
  cco: string[];
  invalidos: string[];
} {
  const vistos = new Set<string>();
  const invalidos: string[] = [];
  const tomar = (texto: string) => {
    const leidos = leerCorreos(texto);
    invalidos.push(...leidos.invalidos);
    return leidos.validos.filter((c) => {
      const k = c.toLowerCase();
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    });
  };
  const para = tomar(campos.para);
  const cc = tomar(campos.cc);
  const cco = tomar(campos.cco);
  return { para, cc, cco, invalidos };
}

/** Un correo que ya se conoce para esta tienda o su cliente, ofrecido en el diálogo. */
export interface DestinatarioSugerido {
  /** Puede faltar: de un envío anterior solo queda el correo. */
  nombre: string | null;
  email: string;
  /** De dónde sale: "Jefe de tienda · esta tienda", "Firmó en la tienda", "Envío anterior"… */
  detalle: string;
}

/** Un correo visto antes en la base: quien firmó, una persona del local o un envío anterior. */
export type CorreoConocido = DestinatarioSugerido;

/**
 * Las sugerencias del diálogo, sin repetidos y sin el correo de quien envía:
 * primero los contactos cargados (propios de la tienda y heredados de la marca,
 * la región y el cliente) y después lo que ya se usó en visitas y envíos.
 */
export function sugerenciasDeCorreo(
  aplicables: readonly ContactoAplicable[],
  conocidos: readonly CorreoConocido[],
  excluir: readonly string[] = []
): DestinatarioSugerido[] {
  const lista: DestinatarioSugerido[] = [];
  const vistos = new Set(excluir.map((e) => e.trim().toLowerCase()));
  const sumar = (s: DestinatarioSugerido) => {
    const email = s.email.trim();
    if (!email || mensajeCorreo(email) !== null) return;
    const clave = email.toLowerCase();
    if (vistos.has(clave)) return;
    vistos.add(clave);
    lista.push({ ...s, email });
  };
  for (const a of aplicables) {
    if (!a.contacto.email) continue;
    sumar({
      nombre: a.contacto.nombre,
      email: a.contacto.email,
      detalle: `${a.cargo.cargo} · ${a.heredado ? ETIQUETA_ALCANCE[a.origen] : "esta tienda"}`,
    });
  }
  for (const c of conocidos) sumar(c);
  return lista;
}

/** Lo que se puede adjuntar: el PDF del acta y el .zip con las fotos y los videos del cliente. */
export type ClaveAdjunto = "pdf" | "zip";

export function esClaveAdjunto(v: string): v is ClaveAdjunto {
  return v === "pdf" || v === "zip";
}

/** El último envío del acta, como lo muestra el panel (dmc.acta_envio). */
export interface ActaEnviada {
  para: string;
  cc: string;
  cco: string;
  /** Archivos que salieron, contando cada foto y video dentro del zip. */
  adjuntos: number;
  estado: "ENCOLADO" | "ENVIADO" | "ERROR";
  /** Cuándo salió (ENVIADO) o cuándo se intentó (los demás). 'YYYY-MM-DDTHH:mm:ss'. */
  en: string;
  /** Por qué no salió. Solo en ERROR. */
  error: string | null;
  /** El correo con que inició sesión quien lo envió. */
  enviadoPor: string | null;
}
