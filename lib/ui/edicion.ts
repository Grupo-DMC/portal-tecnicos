import { fmtRut, normalizarTel } from "@/lib/ui/formato";
import type { FirmaForm, FotoForm, ProblemaForm, TrabajoForm } from "@/lib/ui/borrador";
import type { CatalogoProblema, Visita, VisitaEdicion } from "@/lib/types";

// Edición del acta ya cerrada: lo que comparten el formulario del celular y el
// editor del panel. Los dos parten de lo que quedó guardado en la base, no de
// un borrador.

/**
 * Las partes del acta que se anotan en una edición. El servidor las escribe en
 * `visita_edicion.secciones` y el panel las lee para marcar cada parte editada.
 */
export const SECCION_EDICION = {
  responsable: "Responsable de tienda",
  trabajo: "Motivo y trabajo realizado",
  problemas: "Problemas detectados",
  interno: "Comentario interno",
  media: "Fotos y video",
} as const;

/** Quién tocó el acta, dicho como lo lee quien mira el panel. */
export function quienModifico(e: VisitaEdicion): string {
  return e.origen === "MOVIL" ? "Modificado por el técnico" : "Modificado desde el panel";
}

export interface ActaEnFormulario {
  respNombre: string;
  respRut: string;
  respTel: string;
  motivosCodigos: string[];
  obs: string;
  interno: string;
  internos: string[];
  trabajos: TrabajoForm[];
  problemas: ProblemaForm[];
  fotos: FotoForm[];
  firma: FirmaForm | null;
  /** El primer id libre para las filas que se agreguen después. */
  siguienteId: number;
}

/** El acta guardada, puesta en la forma en que la manejan los formularios. */
export function formularioDesdeActa(visita: Visita): ActaEnFormulario {
  const ejec = visita.ejecucion;
  let id = 1;
  const agendados = (visita.motivosCodigos?.length ? visita.motivosCodigos : [visita.motivoCodigo]).filter(Boolean);
  const firma = visita.firmas?.find((f) => f.rol === "TIENDA") ?? visita.firmas?.[0];

  return {
    respNombre: ejec?.responsableNombre ?? visita.responsableNombre ?? "",
    respRut: fmtRut(ejec?.responsableRut ?? ""),
    respTel: normalizarTel(ejec?.responsableTelefono),
    // Los que confirmó el técnico mandan: puede haber quitado alguno agendado.
    motivosCodigos: ejec?.motivosRealesCodigos?.filter(Boolean).length
      ? [...new Set(ejec.motivosRealesCodigos.filter(Boolean))]
      : agendados,
    obs: ejec?.observaciones ?? "",
    interno: ejec?.comentarioInterno ?? "",
    internos: (visita.internos ?? []).map((x) => x.codigo),
    trabajos: (visita.trabajos ?? []).map((t) => ({
      id: id++,
      codigo: t.trabajoCodigo,
      motivo: t.motivoCodigo ?? "",
      subs: t.subtrabajos.map((s) => ({ etiqueta: s.etiqueta, cantidad: s.cantidad })),
      detalle: t.detalle ?? "",
    })),
    problemas: (visita.problemas ?? []).map((p) => problemaEnFormulario(p, id++)),
    fotos: (visita.fotos ?? []).map((f) => ({ id: id++, dbId: f.id, src: f.archivoUrl, interno: f.interno })),
    firma: firma
      ? { imagen: firma.imagenUrl, nombre: firma.nombre, rut: firma.rut ?? "", hora: firma.firmadoEn.slice(11, 16) }
      : null,
    siguienteId: id,
  };
}

/** Un problema ya guardado, puesto en la forma en que lo maneja el editor de problemas. */
export function problemaEnFormulario(p: NonNullable<Visita["problemas"]>[number], id: number): ProblemaForm {
  return {
    id,
    dbId: p.id,
    codigo: p.tipoCodigo,
    items: p.items.map((it) => ({ etiqueta: it.etiqueta, cantidad: it.cantidad })),
    desc: p.descripcion ?? "",
    sol: p.solucion ?? "",
    estado: p.estado,
  };
}

/**
 * Qué le falta a la lista de problemas para poder guardarse, o null si está
 * completa: un tipo con opciones pide marcar al menos una; uno sin opciones
 * pide contar qué se encontró.
 */
export function faltaEnProblemas(problemas: ProblemaForm[], catalogo: CatalogoProblema[]): string | null {
  for (const p of problemas) {
    const cat = catalogo.find((c) => c.codigo === p.codigo);
    const nombre = cat?.nombre ?? p.codigo;
    if (cat && cat.opciones.length > 0) {
      if (p.items.length === 0) return `En el problema «${nombre}» marca al menos un ${cat.singular ?? "detalle"}.`;
    } else if (!p.desc.trim()) {
      return `Escribe qué se encontró en el problema «${nombre}».`;
    }
  }
  return null;
}

/** "2026-08-13T08:30:00" → "13/08/2026 a las 08:30". */
export function fechaHoraCorta(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [fecha, hora = ""] = iso.split("T");
  const [a, m, d] = fecha.split("-");
  return `${d}/${m}/${a} a las ${hora.slice(0, 5)}`;
}

/** "Editada por Ana desde el celular el 13/08/2026 a las 08:30". */
export function resumenEdicion(e: VisitaEdicion): string {
  return `${e.por} · desde ${e.origen === "MOVIL" ? "el celular" : "el panel"} · ${fechaHoraCorta(e.editadoEn)}`;
}
