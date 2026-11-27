"use client";

// Botón con un panel flotante debajo: se cierra con Esc o al hacer clic fuera.

import { useEffect, useId, useRef, useState } from "react";

export default function Desplegable({
  boton,
  claseBoton,
  clasePanel,
  children,
}: {
  boton: React.ReactNode;
  claseBoton: string;
  clasePanel?: string;
  /** Recibe `cerrar` para que una acción de adentro pueda cerrar el panel. */
  children: (cerrar: () => void) => React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const disparador = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAbierto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setAbierto(false);
      disparador.current?.focus();
    };
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [abierto]);

  return (
    <div className="menu" ref={raiz}>
      <button
        ref={disparador}
        type="button"
        className={claseBoton}
        aria-expanded={abierto}
        aria-controls={abierto ? id : undefined}
        onClick={() => setAbierto((x) => !x)}
      >
        {boton}
      </button>
      {abierto ? (
        <div className={clasePanel ? `menu-list ${clasePanel}` : "menu-list"} id={id}>
          {children(() => setAbierto(false))}
        </div>
      ) : null}
    </div>
  );
}
