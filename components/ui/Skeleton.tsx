import type { CSSProperties, ReactNode } from "react";

/*
 * Siluetas de carga con la forma del contenido real (en gris claro, --track/--canvas, con el
 * brillo suave que se apaga con prefers-reduced-motion). Cada pantalla tiene la suya y usa las
 * mismas clases de tarjeta, tabla e indicadores que la pantalla de verdad (.pv-strip, .pv-card,
 * .v-card, .vt…), así que al cargar no salta nada. Prohibido el texto «Cargando…».
 */

export function Sk({ w = "100%", h = 12, r, redondo, className, style }: { w?: number | string; h?: number | string; r?: number; redondo?: boolean; className?: string; style?: CSSProperties }) {
  return <span aria-hidden="true" className={`sk${redondo ? " redondo" : ""}${className ? ` ${className}` : ""}`} style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

/** Contenedor de una silueta: avisa a los lectores de pantalla una sola vez. */
export function Esqueleto({ children, etiqueta, className = "wrap" }: { children: ReactNode; etiqueta: string; className?: string }) {
  return (
    <div className={`dmc pagina sk-pagina`} role="status" aria-busy="true" aria-label={etiqueta}>
      <div className={className}>{children}</div>
    </div>
  );
}

/** Título de sección (h1 + línea de dato) y botones a la derecha, como `.top`. */
export function SkTop({ botones = 1, sub = true }: { botones?: number; sub?: boolean }) {
  return (
    <header className="top">
      <div style={{ display: "grid", gap: 10 }}>
        <Sk w={260} h={34} r={10} />
        {sub ? <Sk w={180} h={14} /> : null}
      </div>
      {botones ? (
        <div style={{ display: "flex", gap: 10 }}>
          {Array.from({ length: botones }, (_, i) => (
            <Sk key={i} w={i === botones - 1 ? 132 : 150} h={40} r={10} />
          ))}
        </div>
      ) : null}
    </header>
  );
}

/** Banda de indicadores (`.pv-strip`). */
export function SkKpis({ n = 4 }: { n?: number }) {
  return (
    <section className="pv-strip" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="pv-kpi" style={{ display: "grid", gap: 10 }}>
          <Sk w="55%" h={12} />
          <Sk w={70} h={30} r={8} />
          <Sk w="70%" h={11} />
        </div>
      ))}
    </section>
  );
}

/** Cabecera de tarjeta: título, bajada y etiqueta a la derecha (`.pv-head`). */
export function SkCabecera({ etiqueta = true }: { etiqueta?: boolean }) {
  return (
    <header className="pv-head">
      <div style={{ display: "grid", gap: 8, flex: 1 }}>
        <Sk w="40%" h={18} r={6} />
      </div>
      {etiqueta ? <Sk w={70} h={22} r={999} /> : null}
    </header>
  );
}

/** Filas de una tabla de listado (`.vt`), con su encabezado. */
export function SkTabla({ filas = 8, columnas = [28, 30, 18, 12, 12], grupos = false, avatar = false }: { filas?: number; columnas?: number[]; grupos?: boolean; avatar?: boolean }) {
  return (
    <div className="v-table-wrap">
      <table className="vt" aria-hidden="true">
        <thead>
          <tr>
            {columnas.map((w, i) => (
              <th key={i} style={{ width: `${w}%` }}>
                <Sk w={i === 0 ? 50 : 70} h={10} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: filas }, (_, f) => (
            <FilaSk key={f} f={f} columnas={columnas} grupo={grupos && f % 4 === 0} avatar={avatar} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
function FilaSk({ f, columnas, grupo, avatar }: { f: number; columnas: number[]; grupo: boolean; avatar: boolean }) {
  return (
    <>
      {grupo ? (
        <tr className="v-day">
          <th colSpan={columnas.length}>
            <Sk w={190} h={12} />
          </th>
        </tr>
      ) : null}
      <tr>
        {columnas.map((_, c) => (
          <td key={c}>
            {c === 0 && avatar ? (
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Sk w={36} h={36} r={10} />
                <span style={{ display: "grid", gap: 7, flex: 1 }}>
                  <Sk w={`${60 + ((f * 7) % 30)}%`} h={12} />
                  <Sk w="45%" h={10} />
                </span>
              </span>
            ) : c === columnas.length - 1 ? (
              <Sk w={84} h={22} r={999} />
            ) : (
              <span style={{ display: "grid", gap: 7 }}>
                <Sk w={`${55 + ((f * 13 + c * 11) % 40)}%`} h={12} />
                {c < 2 ? <Sk w={`${35 + ((f * 5 + c * 3) % 30)}%`} h={10} /> : null}
              </span>
            )}
          </td>
        ))}
      </tr>
    </>
  );
}

/** Tarjeta de listado (`.v-card`) con pestañas, buscador y tabla. */
export function SkListado({ pestanas = 5, filas = 8, columnas, grupos, avatar }: { pestanas?: number; filas?: number; columnas?: number[]; grupos?: boolean; avatar?: boolean }) {
  return (
    <section className="v-card">
      <div className="v-bar">
        {pestanas ? (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {Array.from({ length: pestanas }, (_, i) => (
              <Sk key={i} w={i === 0 ? 88 : 110} h={36} r={10} />
            ))}
          </div>
        ) : null}
        <div style={{ display: "flex", gap: 10, marginLeft: "auto", minWidth: 0, flex: "1 1 260px", justifyContent: "flex-end" }}>
          <Sk w="100%" h={36} r={10} style={{ maxWidth: 320 }} />
          <Sk w={96} h={36} r={10} />
        </div>
      </div>
      <SkTabla filas={filas} columnas={columnas} grupos={grupos} avatar={avatar} />
    </section>
  );
}

/** Lista de pares dato/valor (`.facts`). */
export function SkDatos({ n = 6 }: { n?: number }) {
  return (
    <div style={{ display: "grid", gap: 14, marginTop: 14 }}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "100px minmax(0,1fr)", gap: 12 }}>
          <Sk w="70%" h={11} />
          <Sk w={`${50 + ((i * 17) % 45)}%`} h={13} />
        </div>
      ))}
    </div>
  );
}

/** Barras de una actividad mensual. */
export function SkBarras({ n = 12, alto = 150 }: { n?: number; alto?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${n}, minmax(0,1fr))`, gap: 8, alignItems: "end", height: alto, marginTop: 16 }}>
      {Array.from({ length: n }, (_, i) => (
        <Sk key={i} h={`${30 + ((i * 37) % 65)}%`} r={6} />
      ))}
    </div>
  );
}
