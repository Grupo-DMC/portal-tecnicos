import type { Visita } from "@/lib/types";
import { fechaCL, textoFechaVisita } from "@/lib/ui/fecha";
import { textoMotivosReales } from "@/lib/ui/estado";

// Plantilla del correo con que sale el acta. Pura: recibe la visita ya leída y
// el texto que dejó coordinación en el diálogo, y devuelve el HTML y la versión
// en texto plano (la que leen los clientes de correo sin HTML y los filtros de
// spam). Arriba, los datos clave en una tabla; debajo, el mensaje tal cual.
//
// Nada de lo interno sale de aquí: ni el comentario interno ni su checklist.

export interface CorreoArmado {
  html: string;
  texto: string;
}

/** Escapa lo que va dentro del HTML: el texto viene de personas, no de nosotros. */
export function escaparHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function hhmm(iso: string | null | undefined): string | null {
  return iso && iso.length >= 16 ? iso.slice(11, 16) : null;
}

/** Los datos clave de la visita, en el orden en que se muestran. Sin filas vacías. */
export function datosClaveActa(v: Visita): [string, string][] {
  const ejec = v.ejecucion;
  const inicio = hhmm(ejec?.horaInicio);
  const termino = hhmm(ejec?.horaTermino);
  const tecnicos = [v.tecnico?.nombreCompleto, v.tecnicoAyudante?.nombreCompleto].filter(Boolean).join(" y ");
  const recibio = ejec?.responsableNombre
    ? [ejec.responsableNombre, ejec.responsableCargo].filter(Boolean).join(" · ")
    : null;
  const pendientes = (v.problemas ?? []).filter((p) => p.estado !== "RESUELTO").length;
  const filas: [string, string | null | undefined][] = [
    ["Folio", v.folio],
    ["Cliente", v.cliente?.nombreFantasia],
    ["Tienda", v.sucursal?.nombre],
    ["Fecha", textoFechaVisita(v)],
    ["Horario en tienda", inicio && termino ? `${inicio} a ${termino}` : inicio],
    ["Motivo", textoMotivosReales(v)],
    [tecnicos.includes(" y ") ? "Técnicos" : "Técnico", tecnicos],
    ["Recibió en tienda", recibio],
    ["Puntos pendientes", pendientes ? String(pendientes) : "Ninguno"],
  ];
  return filas.filter((f): f is [string, string] => Boolean(f[1] && String(f[1]).trim()));
}

/** El asunto por defecto: "<Tienda> · <Motivo> · <fecha>", como lo define el esquema. */
export function asuntoActa(v: Visita): string {
  return [v.sucursal?.nombre, textoMotivosReales(v), fechaCL(v.fechaProgramada)].filter(Boolean).join(" · ");
}

export function armarCorreoActa(v: Visita, cuerpo: string, adjuntos: string[]): CorreoArmado {
  const datos = datosClaveActa(v);
  const mensaje = cuerpo.trim();

  const filasHtml = datos
    .map(
      ([k, valor]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#6b6570;white-space:nowrap;vertical-align:top">${escaparHtml(k)}</td>` +
        `<td style="padding:6px 0;color:#1f1c21;font-weight:600">${escaparHtml(valor)}</td></tr>`
    )
    .join("");
  const mensajeHtml = mensaje
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${escaparHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const adjuntosHtml = adjuntos.length
    ? `<p style="margin:18px 0 0;color:#6b6570;font-size:13px">Adjuntos: ${adjuntos.map(escaparHtml).join(", ")}</p>`
    : "";

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escaparHtml(`Acta ${v.folio}`)}</title></head>
<body style="margin:0;padding:0;background:#f4f2f5">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2f5"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #d9d4dc;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1f1c21">
<tr><td style="padding:20px 24px;border-bottom:2px solid #1f1c21">
<div style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#6b6570">Acta de visita técnica</div>
<div style="font-size:20px;font-weight:800;margin-top:4px">${escaparHtml(v.sucursal?.nombre ?? `Visita ${v.folio}`)}</div>
</td></tr>
<tr><td style="padding:16px 24px 8px"><table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px">${filasHtml}</table></td></tr>
<tr><td style="padding:12px 24px 22px;border-top:1px solid #e6e1e8">${mensajeHtml}${adjuntosHtml}</td></tr>
</table>
<div style="max-width:600px;padding:12px 4px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8a838e">Enviado desde el sistema de visitas técnicas de Grupo dMC. Si tienes dudas sobre esta visita, responde a este correo.</div>
</td></tr></table>
</body></html>`;

  const ancho = Math.max(...datos.map(([k]) => k.length));
  const texto =
    `ACTA DE VISITA TÉCNICA\n\n` +
    datos.map(([k, valor]) => `${`${k}:`.padEnd(ancho + 2)}${valor}`).join("\n") +
    `\n\n${mensaje}\n` +
    (adjuntos.length ? `\nAdjuntos: ${adjuntos.join(", ")}\n` : "") +
    `\n--\nEnviado desde el sistema de visitas técnicas de Grupo dMC.\n`;

  return { html, texto };
}
