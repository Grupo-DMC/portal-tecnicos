// La tarjeta de una visita en el celular: hora a la izquierda; estado, folio y local a la derecha.

import Link from "next/link";
import { ESTADO_VISITA_LABEL, textoMotivos } from "@/lib/ui/estado";
import { esDatoDePrueba } from "@/lib/ui/pruebas";
import type { EstadoVisita, Visita } from "@/lib/types";

const ETIQUETA: Record<EstadoVisita, string> = {
  PROGRAMADA: "",
  EN_CURSO: "run",
  COMPLETADA: "done",
  PENDIENTE: "warn",
  REAGENDADA: "warn",
  CANCELADA: "off",
  CANCELADA_ADMIN: "off",
};

/** '2026-10-05' → "5 oct". */
const diaCorto = (fecha: string) => new Date(`${fecha}T00:00:00`).toLocaleDateString("es-CL", { day: "numeric", month: "short" });

export default function TarjetaVisita({
  visita: v,
  tecnicoId,
  atrasada = false,
}: {
  visita: Visita;
  /** Quien mira: si no es el asignado, va de ayudante. */
  tecnicoId: number;
  /** Sigue abierta y su fecha ya pasó. */
  atrasada?: boolean;
}) {
  const clase = atrasada ? "late" : v.estado === "EN_CURSO" ? "run" : v.estado === "COMPLETADA" ? "done" : "";
  const detalle = [
    textoMotivos(v),
    v.fechaHasta ? `hasta el ${diaCorto(v.fechaHasta)}` : null,
    v.tecnicoId === tecnicoId && v.tecnicoAyudante ? `con ${v.tecnicoAyudante.nombreCompleto}` : null,
    v.responsableNombre ? `recibe ${v.responsableNombre}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link href={`/tecnico/visitas/${v.folio}`} className={`tp-card ${clase}`}>
      <span className="tp-when">
        <b>{v.horaProgramada ?? "—"}</b>
        <small>{v.horaProgramada ? "hrs" : "sin hora"}</small>
      </span>
      <span className="tp-cb">
        <span className="tp-ct">
          {atrasada ? <span className="tp-bd late">Atrasada</span> : null}
          <span className={`tp-bd ${ETIQUETA[v.estado]}`}>{ESTADO_VISITA_LABEL[v.estado]}</span>
          {v.tecnicoId !== tecnicoId ? <span className="tp-bd help">Ayudante</span> : null}
          {esDatoDePrueba(v.cliente?.nombreFantasia, v.sucursal?.nombre) ? <span className="tp-bd off">Prueba</span> : null}
          <span className="tp-folio">{v.folio}</span>
        </span>
        <h3>{v.sucursal?.nombre}</h3>
        <p>
          {v.cliente?.nombreFantasia}
          {v.sucursal?.direccion ? ` · ${v.sucursal.direccion}` : ""}
        </p>
        <p>{detalle}</p>
      </span>
    </Link>
  );
}
