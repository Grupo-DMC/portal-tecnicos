"use client";
import Espera from "@/components/ui/Espera";

// «Estado o tipo» de un problema. Al resolverlo se pregunta en qué visita se resolvió.

import { useState } from "react";
import { actualizarProblemaAction } from "@/app/actions/admin";
import { ESTADO_PROBLEMA_CIERRE, etiquetaEstadoProblema } from "@/lib/ui/estado";
import { fechaCL } from "@/lib/ui/fecha";
import { useReferencias } from "@/lib/ui/referencias";
import type { ProblemaPanel, VisitaDeLocal } from "@/lib/contratos/panel";
import type { CatalogoEstadoProblema, EstadoProblema } from "@/lib/types";

export default function CambiarProblema({
  problema: p,
  visitas,
  estados,
  onAviso,
  onHecho,
}: {
  problema: Pick<ProblemaPanel, "id" | "estado" | "tipoCodigo"> & { agenda?: { folio: string } | null };
  visitas: VisitaDeLocal[];
  /** Los estados que hoy se pueden elegir. */
  estados: CatalogoEstadoProblema[];
  onAviso: (texto: string) => void;
  onHecho: () => void;
}) {
  const { problemas: catalogo, estadosProblema } = useReferencias();
  const [estado, setEstado] = useState<EstadoProblema>(p.estado);
  const [tipo, setTipo] = useState(p.tipoCodigo);
  const [nota, setNota] = useState("");
  const [preguntando, setPreguntando] = useState(false);
  // Si ya tiene una visita agendada para resolverlo, parte elegida esa.
  const [visita, setVisita] = useState(p.agenda?.folio ?? "");
  const [guardando, setGuardando] = useState(false);

  const nombreEstado = (c: string) => etiquetaEstadoProblema(c, estadosProblema);
  const nombreTipo = (c: string) => catalogo.find((t) => t.codigo === c)?.nombre ?? c;
  // El estado y el tipo actuales van siempre, aunque ya no estén en el Checklist.
  const opcionesEstado = estados.some((e) => e.codigo === p.estado)
    ? estados
    : [...estadosProblema.filter((e) => e.codigo === p.estado), ...estados];
  const opcionesTipo = catalogo.some((t) => t.codigo === p.tipoCodigo)
    ? catalogo
    : [{ codigo: p.tipoCodigo, nombre: nombreTipo(p.tipoCodigo) }, ...catalogo];

  async function confirmar(visitaFolio: string) {
    setGuardando(true);
    const res = await actualizarProblemaAction({
      problemaId: p.id,
      estado,
      tipoCodigo: tipo,
      nota,
      ...(visitaFolio ? { visitaFolio } : {}),
    });
    setGuardando(false);
    if (!res.ok) return onAviso(res.error ?? "No se pudo guardar el cambio.");
    const partes: string[] = [];
    if (estado !== p.estado) partes.push(`estado: ${nombreEstado(p.estado)} → ${nombreEstado(estado)}`);
    if (tipo !== p.tipoCodigo) partes.push(`reclasificado como «${nombreTipo(tipo)}»`);
    if (visitaFolio) partes.push(`asociado a la visita ${visitaFolio}`);
    onAviso(`Cambio guardado: ${partes.join("; ")}.`);
    onHecho();
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (estado === p.estado && tipo === p.tipoCodigo) return onAviso("No hay cambios para guardar.");
    if (estado === ESTADO_PROBLEMA_CIERRE && p.estado !== ESTADO_PROBLEMA_CIERRE && visitas.length > 0 && !preguntando) {
      return setPreguntando(true);
    }
    void confirmar(preguntando ? visita : "");
  }

  return (
    <form className="pb-cs" onSubmit={enviar}>
      <div className="fr">
        <label htmlFor={`ce-${p.id}`}>Estado</label>
        <select
          id={`ce-${p.id}`}
          className="input"
          value={estado}
          onChange={(e) => {
            setEstado(e.target.value as EstadoProblema);
            setPreguntando(false);
          }}
        >
          {opcionesEstado.map((e) => (
            <option key={e.codigo} value={e.codigo}>
              {e.nombre}
            </option>
          ))}
        </select>
      </div>
      <div className="fr">
        <label htmlFor={`ct-${p.id}`}>Tipo de falla</label>
        <select id={`ct-${p.id}`} className="input" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          {opcionesTipo.map((t) => (
            <option key={t.codigo} value={t.codigo}>
              {t.nombre}
            </option>
          ))}
        </select>
      </div>
      <div className="fr">
        <label htmlFor={`cn-${p.id}`}>Nota del cambio (opcional)</label>
        <textarea
          id={`cn-${p.id}`}
          className="input"
          rows={2}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Ej.: el repuesto llega el viernes."
        />
      </div>
      {preguntando ? (
        <div className="fr">
          <label htmlFor={`cv-${p.id}`}>¿En qué visita se resolvió?</label>
          <select id={`cv-${p.id}`} className="input" value={visita} onChange={(e) => setVisita(e.target.value)}>
            <option value="">Ninguna en particular</option>
            {visitas.map((v) => (
              <option key={v.folio} value={v.folio}>
                {v.folio} · {fechaCL(v.fecha)} · {v.tecnico}
                {p.agenda?.folio === v.folio ? " · agendada para resolverlo" : ""}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <button type="submit" className="btn-pri sm" disabled={guardando}>
        <Espera activo={guardando} accion="Guardando">{preguntando ? (visita ? "Resolver y asociar" : "Resolver sin asociar") : "Guardar cambio"}</Espera>
      </button>
    </form>
  );
}
