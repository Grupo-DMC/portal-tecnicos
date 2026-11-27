"use client";

// Línea semanal del Panel. Se dibuja al ancho real de su tarjeta para que los
// textos no se achiquen en el celular.

import { useEffect, useRef, useState } from "react";
import { fechaCL } from "@/lib/ui/fecha";

export interface PuntoSemanal {
  /** El lunes de la semana. */
  desde: string;
  /** Null: no hay dato esa semana. */
  valor: number | null;
  detalle: string;
}

const ALTO = 210;
const M = { arriba: 18, derecha: 14, abajo: 26, izquierda: 38 };

export default function LineaSemanal({
  semanas,
  unidad,
  nombre,
  vacio,
}: {
  semanas: PuntoSemanal[];
  /** Lo que sigue a cada cifra: " h", "". */
  unidad: string;
  /** Qué se mide, para quien no ve el gráfico. */
  nombre: string;
  vacio: string;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(520);
  const [sobre, setSobre] = useState<number | null>(null);

  useEffect(() => {
    const el = caja.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const medir = () => el.clientWidth > 0 && setAncho(el.clientWidth);
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  const conDatos = semanas.flatMap((s, i) => (s.valor === null ? [] : [{ i, horas: s.valor }]));
  if (conDatos.length === 0) {
    return <p className="pv-vacio">{vacio}</p>;
  }

  const paso = escalon(Math.max(...conDatos.map((d) => d.horas)));
  const tope = paso * 4;
  const anchoUtil = ancho - M.izquierda - M.derecha;
  const altoUtil = ALTO - M.arriba - M.abajo;
  const x = (i: number) => M.izquierda + (anchoUtil * i) / (semanas.length - 1);
  const y = (v: number) => M.arriba + altoUtil * (1 - v / tope);
  const puntos = conDatos.map((d) => `${x(d.i)},${y(d.horas)}`).join(" ");
  const primero = conDatos[0];
  const ultimo = conDatos[conDatos.length - 1];
  const bajando = conDatos.length > 1 && conDatos[conDatos.length - 2].horas > ultimo.horas;
  const detalle = sobre === null ? null : semanas[sobre];

  return (
    <div className="pv-line" ref={caja}>
      <svg
        width={ancho}
        height={ALTO}
        viewBox={`0 0 ${ancho} ${ALTO}`}
        role="img"
        aria-label={`${nombre} por semana: de ${primero.horas}${unidad} a ${ultimo.horas}${unidad}.`}
      >
        {[0, 1, 2, 3, 4].map((n) => (
          <g key={n}>
            <line className="pv-grid-l" x1={M.izquierda} x2={ancho - M.derecha} y1={y(paso * n)} y2={y(paso * n)} />
            <text className="pv-ax" x={M.izquierda - 8} y={y(paso * n) + 4} textAnchor="end">
              {paso * n}
            </text>
          </g>
        ))}
        {semanas.map((s, i) =>
          i % 2 === 0 ? (
            <text key={s.desde} className="pv-ax" x={x(i)} y={ALTO - 6} textAnchor="middle">
              S{i + 1}
            </text>
          ) : null
        )}
        <polygon className="pv-area" points={`${x(primero.i)},${y(0)} ${puntos} ${x(ultimo.i)},${y(0)}`} />
        <polyline className="pv-ln" points={puntos} />
        <circle className="pv-end" cx={x(ultimo.i)} cy={y(ultimo.horas)} r="4.5" />
        {/* Si la línea viene bajando, la cifra va debajo para no quedar encima. */}
        <text className="pv-end-t" x={x(ultimo.i)} y={y(ultimo.horas) + (bajando && y(ultimo.horas) + 20 < y(0) ? 20 : -10)} textAnchor="end">
          {ultimo.horas}
          {unidad}
        </text>
        {detalle && sobre !== null ? (
          <g>
            <line className="pv-cross" x1={x(sobre)} x2={x(sobre)} y1={M.arriba} y2={M.arriba + altoUtil} />
            {detalle.valor !== null ? <circle className="pv-hov-d" cx={x(sobre)} cy={y(detalle.valor)} r="5" /> : null}
          </g>
        ) : null}
        <rect
          className="pv-hit"
          x={M.izquierda}
          y={M.arriba}
          width={anchoUtil}
          height={altoUtil}
          onPointerMove={(e) => {
            const izq = e.currentTarget.getBoundingClientRect().left;
            const i = Math.round(((e.clientX - izq) / anchoUtil) * (semanas.length - 1));
            setSobre(Math.min(semanas.length - 1, Math.max(0, i)));
          }}
          onPointerLeave={() => setSobre(null)}
        />
      </svg>
      {detalle && sobre !== null ? (
        <div className="pv-tip" style={{ left: Math.min(Math.max(0, x(sobre) - 60), ancho - 140), top: 0 }}>
          <b>Semana del {fechaCL(detalle.desde)}</b>
          <span>{detalle.valor === null ? "—" : `${detalle.valor}${unidad}`}</span>
          <small>{detalle.detalle}</small>
        </div>
      ) : null}
    </div>
  );
}

/** El salto entre líneas de la escala: múltiplos de un día cuando son muchas horas. */
function escalon(maximo: number): number {
  const posibles = [1, 2, 5, 6, 12, 24, 48, 72, 120, 168, 336, 720];
  return posibles.find((p) => p * 4 >= maximo) ?? Math.ceil(maximo / 4);
}
