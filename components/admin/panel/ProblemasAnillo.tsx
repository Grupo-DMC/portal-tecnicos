"use client";

// Problemas abiertos por tipo: anillo y leyenda. Elegir un tipo lo destaca en
// los dos y ofrece ir a Problemas.

import { useState } from "react";
import Link from "next/link";
import type { PanelData } from "@/lib/ui/panel-data";
import { plural } from "@/lib/ui/plural";

const SERIES = 7;
const RADIO = 70;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO;
const SEPARACION = 2.5;

const esOtro = (nombre: string) => /^otro/i.test(nombre);

export default function ProblemasAnillo({ problemas, total }: { problemas: PanelData["problemasTipo"]; total: number }) {
  const [elegido, setElegido] = useState<string | null>(null);
  // «Otro» va al final y en gris: es lo que quedó sin clasificar.
  const orden = [...problemas.filter((p) => !esOtro(p.nombre)), ...problemas.filter((p) => esOtro(p.nombre))].map((p, i) => ({
    ...p,
    color: esOtro(p.nombre) ? "var(--grey)" : `var(--serie-${(i % SERIES) + 1})`,
  }));
  const suma = orden.reduce((n, p) => n + p.n, 0);
  const seleccion = orden.find((p) => p.codigo === elegido) ?? null;
  const alternar = (codigo: string) => setElegido((actual) => (actual === codigo ? null : codigo));

  if (suma === 0) return <p className="pv-vacio">No hay problemas abiertos. Cuando un técnico levante uno, aparece aquí.</p>;

  const arcos = orden.map((p, i) => {
    const antes = orden.slice(0, i).reduce((n, x) => n + x.n, 0);
    return { ...p, largo: Math.max((p.n / suma) * CIRCUNFERENCIA - SEPARACION, 1), inicio: (antes / suma) * CIRCUNFERENCIA };
  });

  return (
    <>
      <div className="pv-donut-wrap">
        <div className="pv-donut">
          <svg viewBox="0 0 180 180" aria-hidden="true">
            {arcos.map((p) => (
              <circle
                key={p.codigo}
                className={`pv-arc${seleccion && seleccion.codigo !== p.codigo ? " dim" : ""}`}
                r={RADIO}
                cx="90"
                cy="90"
                fill="none"
                stroke={p.color}
                strokeWidth="22"
                strokeDasharray={`${p.largo} ${CIRCUNFERENCIA - p.largo}`}
                strokeDashoffset={-p.inicio}
                transform="rotate(-90 90 90)"
                onClick={() => alternar(p.codigo)}
              >
                <title>{`${p.nombre}: ${p.n}`}</title>
              </circle>
            ))}
          </svg>
          <div className="pv-donut-c">
            <b>{seleccion ? seleccion.n : total}</b>
            <span>{seleccion ? seleccion.nombre : "abiertos"}</span>
          </div>
        </div>
        <ul className="pv-legend">
          {orden.map((p) => (
            <li key={p.codigo}>
              <button type="button" aria-pressed={elegido === p.codigo} onClick={() => alternar(p.codigo)}>
                <i style={{ background: p.color }} aria-hidden="true" />
                <span className="pv-lg-name">
                  <span>{p.nombre}</span>
                  {esOtro(p.nombre) ? <span className="flag warn">Sin clasificar</span> : null}
                </span>
                <b>{p.n}</b>
                <small>{p.pct}%</small>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div aria-live="polite">
        {seleccion ? (
          <div className="pv-pick">
            <span>
              {plural(seleccion.n, "problema abierto", "problemas abiertos")} de tipo «{seleccion.nombre}».
            </span>
            <Link href={`/admin/problemas?tipo=${encodeURIComponent(seleccion.codigo)}`}>Ver problemas</Link>
          </div>
        ) : null}
      </div>
    </>
  );
}
