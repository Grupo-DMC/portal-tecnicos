"use client";

import { useState } from "react";
import Dialogo from "@/components/admin/Dialogo";
import EditorProblemas from "@/components/admin/EditorProblemas";
import { registrarProblemasVisitaAction } from "@/app/actions/problemas-visita";
import { faltaEnProblemas, problemaEnFormulario } from "@/lib/ui/edicion";
import { useReferencias } from "@/lib/ui/referencias";
import type { ProblemaForm } from "@/lib/ui/borrador";
import type { Visita } from "@/lib/types";

/**
 * Registrar los problemas encontrados en una visita que todavía no tiene el acta
 * cerrada: los mismos campos que el acta (tipo, qué equipos y cuántos, qué se
 * encontró), y lo mismo de agregar, corregir y quitar.
 *
 * Parte de lo que la visita ya tiene y no escribe nada hasta «Guardar
 * problemas». Una visita con el acta cerrada se corrige desde «Editar el acta».
 */
export default function ProblemasVisitaDialogo({
  visita,
  onCerrar,
  onHecho,
}: {
  visita: Visita;
  onCerrar: () => void;
  onHecho: (mensaje: string) => void;
}) {
  const catalogoProblema = useReferencias().problemas;
  const [problemas, setProblemas] = useState<ProblemaForm[]>(() =>
    (visita.problemas ?? []).map((p, i) => problemaEnFormulario(p, i + 1))
  );
  const [sigId, setSigId] = useState(() => (visita.problemas?.length ?? 0) + 1);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nuevoId = () => {
    setSigId((n) => n + 1);
    return sigId;
  };

  async function guardar() {
    const falta = faltaEnProblemas(problemas, catalogoProblema);
    if (falta) return setError(falta);
    setGuardando(true);
    setError(null);
    try {
      const res = await registrarProblemasVisitaAction({
        folio: visita.folio,
        problemas: problemas.map((p) => ({
          id: p.dbId ?? null,
          tipoCodigo: p.codigo,
          descripcion: p.desc.trim() || null,
          items: p.items.map((it) => ({ etiqueta: it.etiqueta, cantidad: it.cantidad })),
        })),
      });
      if (!res.ok) return setError(res.error ?? "No se pudieron guardar los problemas.");
      onHecho(`Problemas de la visita ${visita.folio} guardados`);
      onCerrar();
    } catch (err) {
      console.error("[dmc] no se pudieron guardar los problemas de la visita:", err);
      setError("No se pudo llegar al servidor. No se guardó nada: inténtalo otra vez.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialogo
      titulo={`Problemas de la visita ${visita.folio}`}
      cta="Guardar problemas"
      nota="Anota lo que se encontró en esta visita, con la cantidad que corresponda. Cuando el técnico cierre el acta, estos problemas se mantienen y se suman a los que él levante. Uno que coordinación ya gestionó se puede corregir, pero no quitar."
      campos={[]}
      form={{}}
      onCampo={() => {}}
      onCerrar={onCerrar}
      onGuardar={() => void guardar()}
      guardando={guardando}
    >
      <div className="flex flex-col gap-4">
        <EditorProblemas
          prefijo="pv"
          catalogoProblema={catalogoProblema}
          problemas={problemas}
          setProblemas={setProblemas}
          nuevoId={nuevoId}
          vacio="Esta visita no tiene problemas registrados."
        />
        {error ? (
          <div
            role="alert"
            className="px-3.5 py-3 bg-[var(--color-danger-100)] border border-[var(--color-danger-400)] text-meta leading-[1.45] text-[var(--color-danger-800)]"
          >
            {error}
          </div>
        ) : null}
      </div>
    </Dialogo>
  );
}
