"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export type AccionMenu = {
  clave: string;
  texto: string;
  icono?: ReactNode;
  /** Explicación corta bajo el texto (opcional). */
  detalle?: string;
  onSelect?: () => void;
  href?: string;
  /** Con `href`: descarga el archivo con este nombre en vez de navegar. */
  download?: string;
  disabled?: boolean;
};

/**
 * Botón secundario que abre una lista de acciones relacionadas (Editar,
 * Descargar). Se cierra al elegir, con Escape o al tocar fuera. Si queda una
 * sola acción, se muestra como un botón normal: un menú de una opción es un
 * paso de más.
 */
export default function MenuAcciones({
  texto,
  icono,
  acciones,
}: {
  texto: string;
  icono?: ReactNode;
  acciones: AccionMenu[];
}) {
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAbierto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [abierto]);

  if (acciones.length === 0) return null;
  if (acciones.length === 1) return <Item accion={acciones[0]} suelto />;

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        className="btn btn-secondary min-h-10 px-3.5"
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-controls={id}
        onClick={() => setAbierto((v) => !v)}
      >
        {icono}
        <span>{texto}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          aria-hidden="true"
          className={`transition-transform ${abierto ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {abierto ? (
        <div
          id={id}
          role="menu"
          className="absolute right-0 top-[calc(100%+4px)] z-30 min-w-[260px] bg-[var(--color-bg)] border-2 border-[var(--color-text)] shadow-[0_8px_24px_rgba(31,28,33,.14)] animate-up-dlg"
        >
          {acciones.map((a) => (
            <Item key={a.clave} accion={a} onElegir={() => setAbierto(false)} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Item({ accion, suelto = false, onElegir }: { accion: AccionMenu; suelto?: boolean; onElegir?: () => void }) {
  const clase = suelto
    ? "btn btn-secondary min-h-10 px-3.5"
    : "w-full flex items-start gap-2.5 px-3.5 py-3 text-left bg-transparent border-0 border-b border-[var(--color-line)] last:border-b-0 cursor-pointer text-[var(--color-text)] hover:bg-[var(--color-accent-100)] disabled:opacity-55 disabled:cursor-not-allowed";
  const cuerpo = (
    <>
      {accion.icono ? <span className={suelto ? "contents" : "mt-0.5 flex-none"}>{accion.icono}</span> : null}
      <span className={suelto ? "" : "min-w-0"}>
        <span className={suelto ? "" : "block text-ui font-semibold"}>{accion.texto}</span>
        {!suelto && accion.detalle ? (
          <span className="block text-cap text-[var(--color-muted)] mt-0.5">{accion.detalle}</span>
        ) : null}
      </span>
    </>
  );
  const rol = suelto ? undefined : "menuitem";
  if (accion.href) {
    const props = { className: clase, role: rol, onClick: onElegir, title: suelto ? accion.detalle : undefined };
    return accion.download !== undefined ? (
      <a href={accion.href} download={accion.download} {...props}>
        {cuerpo}
      </a>
    ) : (
      <Link href={accion.href} {...props}>
        {cuerpo}
      </Link>
    );
  }
  return (
    <button
      type="button"
      role={rol}
      className={clase}
      disabled={accion.disabled}
      title={suelto ? accion.detalle : undefined}
      onClick={() => {
        onElegir?.();
        accion.onSelect?.();
      }}
    >
      {cuerpo}
    </button>
  );
}
