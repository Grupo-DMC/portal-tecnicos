"use client";

import { useEffect, useState } from "react";
import { conflictosAgendaAction } from "@/app/actions/admin";
import { fechaCL } from "@/lib/ui/fecha";
import { ESTADO_VISITA_LABEL } from "@/lib/ui/estado";
import type { ConflictoAgenda } from "@/lib/contratos/visitas";
import type { EstadoVisita } from "@/lib/types";

// Alerta al agendar: otra visita del mismo día se pisa con esta. Solo avisa,
// no impide guardar.

/** Lee los choques del día cada vez que cambia el local, la fecha o el equipo. */
export function useConflictosAgenda(p: {
  sucursalId: number | null;
  fecha: string;
  tecnicoId: number | null;
  ayudanteId: number | null;
  folio?: string;
}) {
  const { sucursalId, fecha, tecnicoId, ayudanteId, folio } = p;
  const [conflictos, setConflictos] = useState<ConflictoAgenda[]>([]);

  useEffect(() => {
    let vigente = true;
    if (!sucursalId || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      setConflictos([]);
      return;
    }
    conflictosAgendaAction({ sucursalId, fecha, tecnicoId, ayudanteId, folio })
      .then((r) => vigente && setConflictos(r.conflictos))
      .catch(() => vigente && setConflictos([]));
    return () => {
      vigente = false;
    };
  }, [sucursalId, fecha, tecnicoId, ayudanteId, folio]);

  return conflictos;
}

function lineaEquipo(c: ConflictoAgenda) {
  return c.ayudante ? `${c.tecnico} (con ${c.ayudante} de ayudante)` : c.tecnico;
}

export default function AvisoAgenda({ conflictos, fecha }: { conflictos: ConflictoAgenda[]; fecha: string }) {
  if (conflictos.length === 0) return null;
  const duplicados = conflictos.filter((c) => c.tipo === "MISMO_TECNICO");
  const otros = conflictos.filter((c) => c.tipo === "OTRO_TECNICO");
  const dia = fechaCL(fecha);

  return (
    <section role="alert" className="mt-4 border-2 border-[var(--color-danger)] bg-[var(--color-surface)] px-4 py-3.5">
      <div className="text-cap font-extrabold text-[var(--color-danger)]">Atención · posible trabajo duplicado</div>

      {duplicados.length > 0 ? (
        <div className="mt-2">
          <p className="m-0 font-extrabold text-body leading-[1.3]">
            {duplicados[0].repetidos.join(" y ")} ya tiene{duplicados[0].repetidos.length > 1 ? "n" : ""} agendado este
            local el {dia}
          </p>
          <ul className="list-none m-0 mt-2 p-0 flex flex-col gap-1.5">
            {duplicados.map((c) => (
              <li key={c.folio} className="text-meta leading-[1.4]">
                <b className="tabular-nums">{c.folio}</b> · {c.cliente} · {c.sucursal} · {lineaEquipo(c)} ·{" "}
                {ESTADO_VISITA_LABEL[c.estado as EstadoVisita] ?? c.estado}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {otros.length > 0 ? (
        <div className={duplicados.length > 0 ? "mt-3" : "mt-2"}>
          <p className="m-0 font-extrabold text-body leading-[1.3]">
            Otros técnicos van al mismo {otros.every((c) => c.alcance === "LOCAL") ? "local" : "local o mall"} el {dia}
          </p>
          <ul className="list-none m-0 mt-2 p-0 flex flex-col gap-1.5">
            {otros.map((c) => (
              <li key={c.folio} className="text-meta leading-[1.4]">
                <b className="tabular-nums">{c.folio}</b> · {lineaEquipo(c)} ·{" "}
                {c.alcance === "LOCAL" ? `el mismo local (${c.sucursal})` : `mismo mall (${c.mall}) · ${c.sucursal}`} ·{" "}
                {ESTADO_VISITA_LABEL[c.estado as EstadoVisita] ?? c.estado}
              </li>
            ))}
          </ul>
          <p className="m-0 mt-1.5 text-cap opacity-66">
            Ninguno va de ayudante del otro. Si es a propósito, puedes guardar igual.
          </p>
        </div>
      ) : null}
    </section>
  );
}
