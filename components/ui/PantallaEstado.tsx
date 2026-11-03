import type { ReactNode } from "react";

// Marco común de las pantallas de error, "no encontrado" y carga: la misma
// cabecera del login (regla negra y título grande).

export default function PantallaEstado({
  titulo,
  children,
  acciones,
  compacta = false,
}: {
  titulo: ReactNode;
  children?: ReactNode;
  acciones?: ReactNode;
  /** Dentro del panel: sin altura de pantalla completa. */
  compacta?: boolean;
}) {
  return (
    <main
      className={`${compacta ? "min-h-[60vh]" : "min-h-screen"} flex items-center justify-center bg-[var(--color-bg)] px-[22px] py-10 text-[var(--color-text)]`}
    >
      <div className="w-full max-w-[460px]">
        <div className="h-0.5 bg-[var(--color-text)]" />
        <h1 className="font-extrabold text-display leading-[1.06] tracking-[-.03em] mt-[22px] mb-2.5">{titulo}</h1>
        {children ? <div className="text-ui opacity-70 max-w-[38ch]">{children}</div> : null}
        {acciones ? <div className="mt-6 flex flex-wrap gap-3">{acciones}</div> : null}
      </div>
    </main>
  );
}

export const CLASE_BOTON =
  "inline-flex items-center justify-center px-5 py-3 text-meta font-semibold bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] active:bg-[var(--color-accent-active)]";
export const CLASE_BOTON_SECUNDARIO =
  "inline-flex items-center justify-center px-5 py-3 text-meta font-semibold border border-[var(--color-text)] hover:bg-[var(--color-surface)]";
