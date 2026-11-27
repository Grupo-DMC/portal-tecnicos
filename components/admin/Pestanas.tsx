"use client";

/**
 * Pestañas de una sección del panel — lo que separa "Cuentas" de "Contraseñas
 * pedidas" dentro de Usuarios.
 */

export interface Pestana {
  clave: string;
  label: string;
  /** Número al costado (cuántos registros, cuántos pendientes…). */
  n?: number;
  /** Pinta el número en rojo: hay algo esperando. */
  urgente?: boolean;
}

export default function Pestanas({
  pestanas,
  activa,
  onCambiar,
}: {
  pestanas: Pestana[];
  activa: string;
  onCambiar: (clave: string) => void;
}) {
  return (
    <div role="tablist" aria-label="Vistas de la sección" className="v-tabs">
      {pestanas.map((p) => (
        <button key={p.clave} role="tab" type="button" aria-selected={p.clave === activa} onClick={() => onCambiar(p.clave)}>
          {p.label}{" "}
          {p.n !== undefined ? <span className={p.urgente && p.n > 0 ? "urgente" : undefined}>{p.n}</span> : null}
        </button>
      ))}
    </div>
  );
}
