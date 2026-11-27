import type { ReactNode } from "react";

/**
 * Contenido de un botón que espera una respuesta. Con `activo`, el texto queda en su lugar pero
 * invisible (el botón no cambia de ancho) y encima gira un spinner; al lector de pantalla le
 * llega `accion` («Guardando»). Desactiva el botón aparte (`disabled`). Prohibido «Guardando…».
 */
export default function Espera({ activo, accion = "Guardando", children }: { activo: boolean; accion?: string; children: ReactNode }) {
  return (
    <>
      <span className="espera-txt">{children}</span>
      {activo ? (
        <>
          <span className="spin" aria-hidden="true" />
          <span className="sr">{accion}</span>
        </>
      ) : null}
    </>
  );
}
