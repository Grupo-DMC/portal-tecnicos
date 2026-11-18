import { escaparHtml } from "@/lib/correo/plantilla-acta";
import { tipoNotificacion, type ModoCorreo } from "@/lib/notificaciones";

// Plantilla del correo de avisos. Pura: recibe las novedades ya filtradas y
// devuelve asunto, HTML y texto plano. Las novedades se agrupan por el grupo
// del tipo, en el orden en que pasaron.

export interface NovedadCorreo {
  id: number;
  tipo: string;
  /** 'YYYY-MM-DDTHH:mm:ss'. */
  creadoEn: string;
  actor: string | null;
  texto: string;
  detalle: string | null;
  enlace: string | null;
}

export interface CorreoAvisos {
  asunto: string;
  html: string;
  texto: string;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];

/** «18 nov 14:05» sin pasar por Date (la hora ya viene del servidor). */
export function cuandoCorto(creadoEn: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(creadoEn);
  if (!m) return "";
  return `${Number(m[3])} ${MESES[Number(m[2]) - 1] ?? ""} ${m[4]}:${m[5]}`;
}

export function fraseDe(n: Pick<NovedadCorreo, "actor" | "texto">): string {
  return n.actor ? `${n.actor} ${n.texto}` : n.texto;
}

/** Solo enlaces internos de la app: el texto de la actividad no decide a dónde lleva. */
export function enlaceAbsoluto(urlBase: string, enlace: string | null): string | null {
  if (!enlace || !enlace.startsWith("/") || enlace.startsWith("//")) return null;
  return `${urlBase}${enlace}`;
}

function recortar(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export function armarCorreoAvisos(input: {
  modo: ModoCorreo;
  novedades: NovedadCorreo[];
  /** Cuántas había en total (pueden venir menos listadas). */
  total: number;
  urlBase: string;
}): CorreoAvisos {
  const { modo, novedades, total, urlBase } = input;
  const resumen = modo === "RESUMEN";
  const asunto =
    total === 1 && novedades[0]
      ? recortar(fraseDe(novedades[0]), 120)
      : resumen
        ? `Resumen del día: ${total} novedades en visitas técnicas`
        : `${total} novedades en visitas técnicas`;

  const grupos = new Map<string, NovedadCorreo[]>();
  for (const n of novedades) {
    const etiqueta = tipoNotificacion(n.tipo)?.label ?? "Otros";
    const lista = grupos.get(etiqueta);
    if (lista) lista.push(n);
    else grupos.set(etiqueta, [n]);
  }

  const filaHtml = (n: NovedadCorreo) => {
    const url = enlaceAbsoluto(urlBase, n.enlace);
    const frase = escaparHtml(fraseDe(n));
    return (
      `<tr><td style="padding:8px 0;border-bottom:1px solid #eee9ef">` +
      `<div style="font-size:15px;color:#1f1c21">${url ? `<a href="${escaparHtml(url)}" style="color:#1f1c21;text-decoration:underline">${frase}</a>` : frase}</div>` +
      (n.detalle ? `<div style="font-size:13px;color:#6b6570">${escaparHtml(n.detalle)}</div>` : "") +
      `<div style="font-size:12px;color:#8a838e">${escaparHtml(cuandoCorto(n.creadoEn))}</div>` +
      `</td></tr>`
    );
  };

  const cuerpoHtml = [...grupos.entries()]
    .map(
      ([etiqueta, lista]) =>
        `<div style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#6b6570;margin:18px 0 4px">${escaparHtml(etiqueta)}</div>` +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${lista.map(filaHtml).join("")}</table>`
    )
    .join("");
  const faltan = total - novedades.length;
  const masHtml = faltan > 0 ? `<p style="margin:16px 0 0;color:#6b6570;font-size:13px">Y ${faltan} más en la campanita del panel.</p>` : "";
  const ajustes = `${urlBase}/admin/cuenta#avisos`;

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escaparHtml(asunto)}</title></head>
<body style="margin:0;padding:0;background:#f4f2f5">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2f5"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #d9d4dc;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1f1c21">
<tr><td style="padding:20px 24px;border-bottom:2px solid #1f1c21">
<div style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#6b6570">${resumen ? "Resumen del día" : "Aviso"}</div>
<div style="font-size:20px;font-weight:800;margin-top:4px">${total === 1 ? "Una novedad" : `${total} novedades`} en visitas técnicas</div>
</td></tr>
<tr><td style="padding:4px 24px 22px">${cuerpoHtml}${masHtml}</td></tr>
</table>
<div style="max-width:600px;padding:12px 4px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8a838e">Lo recibes porque lo pediste en tu cuenta del sistema de visitas técnicas de Grupo dMC. <a href="${escaparHtml(ajustes)}" style="color:#8a838e">Elegir qué avisos llegan por correo</a>.</div>
</td></tr></table>
</body></html>`;

  const texto =
    `${resumen ? "RESUMEN DEL DÍA" : "AVISO"} · ${total === 1 ? "una novedad" : `${total} novedades`}\n` +
    [...grupos.entries()]
      .map(
        ([etiqueta, lista]) =>
          `\n${etiqueta.toUpperCase()}\n` +
          lista
            .map((n) => {
              const url = enlaceAbsoluto(urlBase, n.enlace);
              return `- ${fraseDe(n)}${n.detalle ? ` (${n.detalle})` : ""} · ${cuandoCorto(n.creadoEn)}${url ? `\n  ${url}` : ""}`;
            })
            .join("\n")
      )
      .join("\n") +
    (faltan > 0 ? `\n\nY ${faltan} más en la campanita del panel.` : "") +
    `\n\n--\nElegir qué avisos llegan por correo: ${ajustes}\n`;

  return { asunto, html, texto };
}
