"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MOTIVO_MAXIMO, problemaDeBaja } from "@/lib/ui/estado-activo";

/**
 * El paso obligatorio antes de dejar algo inactivo (migración 039): un diálogo
 * con el motivo por escrito. Sin motivo no se puede confirmar, y cancelar deja
 * todo como estaba.
 *
 * Lo abre el campo «Estado» del Dialogo del panel al pinchar «Inactivo», así
 * que vale igual para clientes, marcas, malls, sucursales, técnicos, usuarios y
 * contactos. El servidor y la base vuelven a exigir el motivo: esto es solo la
 * primera barrera.
 */
export default function MotivoDesactivacion({
  que,
  inicial = "",
  onConfirmar,
  onCancelar,
}: {
  /** Lo que se desactiva, con su artículo: «la marca», «el técnico». */
  que: string;
  /** Al corregir un motivo ya escrito. */
  inicial?: string;
  onConfirmar: (motivo: string) => void;
  onCancelar: () => void;
}) {
  const id = useId();
  const [motivo, setMotivo] = useState(inicial);
  const [intentado, setIntentado] = useState(false);
  const campo = useRef<HTMLTextAreaElement>(null);
  const error = problemaDeBaja(false, motivo, que);

  // El último onCancelar, sin volver a montar el listener en cada render del padre.
  const cancelar = useRef(onCancelar);
  useEffect(() => {
    cancelar.current = onCancelar;
  }, [onCancelar]);

  useEffect(() => {
    campo.current?.focus();
    // Escape cancela; no se cierra con un clic fuera para no perder lo escrito.
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        cancelar.current();
      }
    };
    window.addEventListener("keydown", onEsc, true);
    return () => window.removeEventListener("keydown", onEsc, true);
  }, []);

  function confirmar() {
    setIntentado(true);
    if (error) return campo.current?.focus();
    onConfirmar(motivo.trim());
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-titulo`}
      className="fixed inset-0 z-[80] bg-[rgba(31,28,33,.55)] grid place-items-center p-3 sm:p-6"
    >
      <div className="w-full max-w-[480px] bg-[var(--color-bg)] border-2 border-[var(--color-text)] animate-up-dlg">
        <div className="px-5 py-4.5 border-b border-[var(--color-divider-soft)]">
          <div id={`${id}-titulo`} className="font-extrabold text-h3 leading-[1.2]">
            ¿Por qué se desactiva {que}?
          </div>
        </div>
        <div className="px-5 pt-4.5 pb-5">
          <div className="field">
            <label htmlFor={`${id}-motivo`}>Motivo · obligatorio</label>
            <textarea
              ref={campo}
              id={`${id}-motivo`}
              rows={4}
              maxLength={MOTIVO_MAXIMO}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) confirmar();
              }}
              placeholder="Término de contrato, cierre del local, dejó la empresa…"
              aria-invalid={intentado && !!error}
              aria-describedby={`${id}-ayuda`}
              className="input min-h-[104px] px-3.5 py-3 resize-y leading-[1.5]"
            />
            <div id={`${id}-ayuda`} className="flex gap-3 mt-1.5 text-cap leading-[1.4]">
              {intentado && error ? (
                <span role="alert" className="font-extrabold text-[var(--color-danger-800)]">
                  {error}
                </span>
              ) : (
                <span className="opacity-66">Queda en el historial con tu nombre y la fecha. Se ve al pasar sobre «Inactivo».</span>
              )}
              <span className="ml-auto opacity-55 tabular-nums flex-none">
                {motivo.trim().length}/{MOTIVO_MAXIMO}
              </span>
            </div>
          </div>
          <div className="flex gap-2.5 justify-end flex-wrap mt-5">
            <button type="button" className="btn btn-secondary min-h-11 px-4.5" onClick={onCancelar}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary min-h-11 px-4.5" onClick={confirmar}>
              <span>Desactivar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
