import type { ReactNode } from "react";

// Marco común de las pantallas de error, «no encontrado» y carga.

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
    <main className={`dmc estado-pantalla${compacta ? " compacta" : ""}`}>
      <div>
        <h1>{titulo}</h1>
        {children ? <div className="estado-texto">{children}</div> : null}
        {acciones ? <div className="estado-acciones">{acciones}</div> : null}
      </div>
    </main>
  );
}

export const CLASE_BOTON = "btn-pri";
export const CLASE_BOTON_SECUNDARIO = "btn-out";
