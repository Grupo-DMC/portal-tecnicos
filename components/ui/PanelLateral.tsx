"use client";

// Panel lateral para mirar algo sin salir de la página. Se cierra con Esc, con la X o tocando fuera.

import { useEffect, useRef } from "react";
import Icono from "@/components/ui/Icono";

export default function PanelLateral({
  titulo,
  bajada,
  onCerrar,
  children,
}: {
  titulo: string;
  bajada?: string;
  onCerrar: () => void;
  children: React.ReactNode;
}) {
  const cerrar = useRef<HTMLButtonElement>(null);
  const alCerrar = useRef(onCerrar);
  alCerrar.current = onCerrar;

  useEffect(() => {
    const antes = document.activeElement as HTMLElement | null;
    const desplazamiento = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cerrar.current?.focus();
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && alCerrar.current();
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("keydown", tecla);
      document.body.style.overflow = desplazamiento;
      antes?.focus?.();
    };
  }, []);

  return (
    <div role="dialog" aria-modal="true" aria-label={titulo} className="dmc sd-ov" onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="sd-sheet">
        <div className="sd-head">
          <div>
            <h2>{titulo}</h2>
            {bajada ? <p>{bajada}</p> : null}
          </div>
          <button ref={cerrar} type="button" className="icon-btn" aria-label="Cerrar" onClick={onCerrar}>
            <Icono nombre="cerrar" />
          </button>
        </div>
        <div className="sd-body sd-pila">{children}</div>
      </div>
    </div>
  );
}
