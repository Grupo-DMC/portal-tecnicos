"use client";

import { useEffect, useRef, useState } from "react";

/** Lo que dura la salida (--duration-base); tras eso el padre la desmonta. */
const SALIDA_MS = 200;

/**
 * Hoja inferior del móvil — el patrón que usa el mockup para "Agregar trabajo
 * realizado", "Agregar un problema", la firma y los cambios de estado.
 * Ocupa el ancho de la columna (máx. 460px), entra desde abajo y bloquea el
 * scroll del documento mientras está abierta.
 *
 * Solo se cierra con la X: un toque fuera de la hoja o un Escape descartaban
 * lo que se estaba llenando.
 */
export default function Sheet({
  titulo,
  onClose,
  children,
}: {
  titulo: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  // Al tocar la X la hoja baja y se desvanece antes de desmontarse. Si el
  // padre la cierra por su cuenta (al guardar) se va sin animación.
  const [saliendo, setSaliendo] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (temporizador.current) clearTimeout(temporizador.current);
  }, []);
  function cerrar() {
    if (saliendo) return;
    // Sin matchMedia (jsdom) o con movimiento reducido, se cierra al instante.
    const sinMovimiento = !window.matchMedia || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (sinMovimiento) return onClose();
    setSaliendo(true);
    temporizador.current = setTimeout(onClose, SALIDA_MS);
  }

  useEffect(() => {
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previo;
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      className={`fixed inset-0 z-40 bg-[rgba(31,28,33,.5)] flex flex-col justify-end items-center ${saliendo ? "animate-fade-out" : "animate-fade-in"}`}
    >
      <div
        className={`w-full max-w-[460px] max-h-[94vh] overflow-y-auto bg-[var(--color-bg)] border-t-2 border-[var(--color-text)] ${saliendo ? "animate-down-sheet" : "animate-up-sheet"}`}
      >
        <div className="sticky top-0 z-10 bg-[var(--color-bg)] flex items-center gap-2.5 px-4 py-3.5 border-b-2 border-[var(--color-divider)]">
          <div className="min-w-0">
            <div className="font-extrabold text-lead leading-[1.2]">{titulo}</div>
          </div>
          <button
            type="button"
            onClick={cerrar}
            aria-label="Cerrar"
            className="ml-auto w-[38px] h-[38px] flex-none grid place-items-center bg-transparent border-0 cursor-pointer text-[var(--color-text)] hover:bg-black/[.08] active:scale-[0.96] transition-[background-color,scale]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
