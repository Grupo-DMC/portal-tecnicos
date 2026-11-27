"use client";
import Espera from "@/components/ui/Espera";

import { useState } from "react";
import { guardarSeccionesActaAction } from "@/app/actions/admin";
import {
  SECCIONES_CONFIGURABLES,
  type SeccionConfigurable,
  type SeccionesObligatorias,
} from "@/lib/contratos/secciones-acta";

// «Secciones obligatorias del acta»: qué tiene que llenar sí o sí el técnico
// antes de poder cerrar la visita. Se guarda aparte del borrador de las listas
// (no son entradas del checklist), con su propio botón.

/** Las tres de siempre: no se configuran, se muestran para que se vea el cuadro completo. */
const SIEMPRE = [
  { n: 1, titulo: "Responsable de tienda" },
  { n: 2, titulo: "Motivo y trabajo realizado" },
  { n: 6, titulo: "Firma de la tienda" },
];

export function SeccionesObligatoriasActa({
  iniciales,
  soloLectura,
  aviso,
}: {
  iniciales: SeccionesObligatorias;
  soloLectura: boolean;
  aviso: (texto: string) => void;
}) {
  const [guardadas, setGuardadas] = useState<SeccionesObligatorias>(iniciales);
  const [borrador, setBorrador] = useState<SeccionesObligatorias>(iniciales);
  const [guardando, setGuardando] = useState(false);
  const sucio = SECCIONES_CONFIGURABLES.some((s) => borrador[s.clave] !== guardadas[s.clave]);

  async function guardar() {
    setGuardando(true);
    try {
      const res = await guardarSeccionesActaAction(borrador);
      if (!res.ok) return aviso(res.error);
      setGuardadas(res.secciones);
      setBorrador(res.secciones);
      aviso("Listo: el cambio vale para las actas que se cierren desde ahora");
    } catch {
      aviso("No se pudo guardar. Inténtalo otra vez.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="border-t border-[var(--color-line)] pt-4 mb-11">
      <h2 className="font-semibold text-h3 leading-[1.15] tracking-[-.02em] mb-1">Secciones obligatorias del acta</h2>
      <p className="m-0 mb-4 text-meta opacity-68 max-w-[74ch]">
        El técnico no puede cerrar la visita hasta llenar las secciones que marques acá. Las tres primeras son
        obligatorias siempre. Vale para las actas que se cierren desde ahora; las ya cerradas y su corrección no se
        tocan.
      </p>

      <div className="border border-[var(--color-line)] rounded-[14px] bg-[var(--color-surface-3)]">
        <ul className="m-0 p-0 list-none">
          {SIEMPRE.map((s) => (
            <li
              key={s.n}
              className="flex items-center gap-3 px-3.5 py-3 border-b border-[var(--color-divider)] opacity-70"
            >
              <span className="tabular-nums font-semibold w-5">{s.n}</span>
              <span className="flex-1 min-w-0 font-semibold text-ui">{s.titulo}</span>
              <span className="tag tag-neutral">Siempre obligatoria</span>
            </li>
          ))}
          {SECCIONES_CONFIGURABLES.map((s) => {
            const activa = borrador[s.clave];
            return (
              <li key={s.clave} className="border-b border-[var(--color-divider)] last:border-b-0">
                <label
                  className={`flex items-center gap-3 px-3.5 py-3 ${soloLectura ? "cursor-default" : "cursor-pointer"}`}
                >
                  <span className="tabular-nums font-semibold w-5">{s.n}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold text-ui">{s.titulo}</span>
                    <span className="block text-meta opacity-66">
                      {activa ? `Para cerrar: ${s.exige.charAt(0).toLowerCase()}${s.exige.slice(1)}` : "Opcional."}
                    </span>
                  </span>
                  <span className="text-cap font-semibold">Hacer obligatorio completar</span>
                  <input
                    type="checkbox"
                    checked={activa}
                    disabled={soloLectura || guardando}
                    onChange={(e) =>
                      setBorrador((b) => ({ ...b, [s.clave satisfies SeccionConfigurable]: e.target.checked }))
                    }
                    className="w-[22px] h-[22px] flex-none accent-[var(--color-accent)]"
                  />
                </label>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex items-center gap-3 mt-3">
        <button className="btn btn-primary min-h-10 px-4" onClick={guardar} disabled={soloLectura || guardando || !sucio}>
          {soloLectura ? "Solo lectura" : <Espera activo={guardando} accion="Guardando">{sucio ? "Guardar secciones" : "Sin cambios"}</Espera>}
        </button>
        {sucio && !guardando ? <span className="text-cap opacity-62">Cambios sin guardar</span> : null}
      </div>
    </div>
  );
}
