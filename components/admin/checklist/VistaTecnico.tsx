"use client";

// «Así lo ve el técnico»: el borrador del checklist como lo mostrará el celular,
// antes de guardarlo.

import { useState } from "react";
import PanelLateral from "@/components/ui/PanelLateral";
import type { ChecklistEditorApi } from "@/components/admin/checklist/useChecklistEditor";

export default function VistaTecnico({ fv, onCerrar }: { fv: ChecklistEditorApi; onCerrar: () => void }) {
  const [motivo, setMotivo] = useState<string | null>(null);
  const elegido = fv.motivos.find((m) => m.key === motivo) ?? fv.motivos[0] ?? null;
  const trabajos = elegido ? elegido.trabajos.flatMap((k) => fv.trabajos.filter((t) => t.key === k)) : [];
  const conNombre = <T extends { nombre: string }>(lista: T[]) => lista.filter((x) => x.nombre.trim());

  return (
    <PanelLateral titulo="Así lo ve el técnico" onCerrar={onCerrar}>
      <div className="ck-vista">
        <h3>Motivo de la visita</h3>
        <div className="ck-chips">
          {conNombre(fv.motivos).map((m) => (
            <button key={m.key} type="button" className="mot-opt" role="radio" aria-checked={m.key === elegido?.key} onClick={() => setMotivo(m.key)}>
              {m.nombre}
            </button>
          ))}
          {fv.motivos.length === 0 ? <p>Todavía no hay motivos.</p> : null}
        </div>

        <h3>Trabajo realizado</h3>
        {trabajos.length === 0 ? <p>Este motivo no tiene trabajos asociados.</p> : null}
        {trabajos.map((t) => (
          <article key={t.key} className="ck-trabajo">
            <b>{t.nombre || "Sin nombre"}</b>
            {t.items.length ? (
              <>
                {t.grupoLabel ? <span>{t.grupoLabel}</span> : null}
                <ul>
                  {t.items.map((i) => (
                    <li key={i.key}>
                      <span>{i.etiqueta || "Sin nombre"}</span>
                      <small>{i.permiteCantidad ? "Cantidad" : "Marcar"}</small>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </article>
        ))}

        <h3>Comentario interno</h3>
        <div className="ck-chips">
          {conNombre(fv.internos).map((x) => (
            <span key={x.key} className="eq">
              {x.nombre}
            </span>
          ))}
          {fv.internos.length === 0 ? <p>Sin ítems: se escribe libre.</p> : null}
        </div>

        <h3>Cargo del responsable</h3>
        <div className="ck-chips">
          {conNombre(fv.cargos).map((x) => (
            <span key={x.key} className="eq">
              {x.nombre}
            </span>
          ))}
          {fv.cargos.length === 0 ? <p>Sin cargos: no se pregunta.</p> : null}
        </div>
      </div>
    </PanelLateral>
  );
}
