import type React from "react";
import { Esqueleto, Sk, SkBarras, SkCabecera, SkDatos, SkKpis, SkListado, SkTop } from "@/components/ui/Skeleton";

// Una silueta por pantalla, con su forma real (ver components/ui/Skeleton.tsx).
// Las usan los loading.tsx de cada ruta.

const fila = (gap = 12) => ({ display: "flex", alignItems: "center", gap });

/* ---------- Panel de operación ---------- */
export function EsqueletoPanel() {
  return (
    <div className="dmc pv" role="status" aria-busy="true" aria-label="Panel de operación">
      <div className="pv-wrap">
        <header className="pv-top">
          <div style={{ display: "grid", gap: 10 }}>
            <Sk w={330} h={36} r={10} />
            <Sk w={220} h={14} />
          </div>
          <Sk w={200} h={44} r={12} />
        </header>
        <SkKpis n={4} />
        <div className="pv-grid">
          <section className="pv-card s8">
            <SkCabecera />
            <div style={{ display: "grid", gap: 18, marginTop: 18 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={fila(16)}>
                  <Sk w={38} h={38} redondo />
                  <span style={{ display: "grid", gap: 7, width: 150 }}>
                    <Sk w="80%" h={13} />
                    <Sk w="55%" h={10} />
                  </span>
                  <Sk h={10} r={999} style={{ flex: 1 }} />
                  <Sk w={44} h={20} />
                  <Sk w={96} h={24} r={999} />
                </div>
              ))}
            </div>
          </section>
          <section className="pv-card s4">
            <SkCabecera />
            <Sk h={12} r={999} style={{ marginTop: 18 }} />
            <div style={{ display: "grid", gap: 16, marginTop: 18 }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={fila(10)}>
                  <Sk w={10} h={10} r={3} />
                  <Sk w="45%" h={12} />
                  <Sk w={20} h={14} style={{ marginLeft: "auto" }} />
                  <Sk w={30} h={10} />
                </div>
              ))}
            </div>
          </section>
          <section className="pv-card s6">
            <SkCabecera />
            <div style={{ ...fila(28), marginTop: 18 }}>
              <Sk w={170} h={170} redondo style={{ flex: "none" }} />
              <div style={{ display: "grid", gap: 14, flex: 1 }}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i} style={fila(10)}>
                    <Sk w={10} h={10} r={3} />
                    <Sk w={`${50 + ((i * 13) % 35)}%`} h={11} />
                    <Sk w={16} h={12} style={{ marginLeft: "auto" }} />
                  </div>
                ))}
              </div>
            </div>
          </section>
          <section className="pv-card s6">
            <SkCabecera etiqueta={false} />
            <Sk h={200} r={12} style={{ marginTop: 18 }} />
          </section>
          <section className="pv-card s4">
            <SkCabecera etiqueta={false} />
            <div style={{ display: "grid", gap: 18, marginTop: 18 }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} style={fila(14)}>
                  <Sk w={26} h={26} r={8} />
                  <span style={{ display: "grid", gap: 7, flex: 1 }}>
                    <Sk w="75%" h={13} />
                    <Sk w="35%" h={10} />
                  </span>
                  <Sk w={24} h={22} />
                </div>
              ))}
            </div>
          </section>
          <section className="pv-card s8">
            <SkCabecera />
            <div style={{ display: "grid", gap: 16, marginTop: 18 }}>
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} style={fila(16)}>
                  <Sk w={220} h={11} />
                  <Sk h={4} r={999} style={{ flex: 1 }} />
                  <Sk w={46} h={12} />
                </div>
              ))}
            </div>
          </section>
          <section className="pv-card s12">
            <SkCabecera etiqueta={false} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(260px,100%),1fr))", gap: 18, marginTop: 18 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ display: "grid", gap: 9 }}>
                  <Sk w="70%" h={14} />
                  <Sk w={150} h={18} r={6} />
                  <Sk w="95%" h={11} />
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ---------- Visitas ---------- */
export function EsqueletoVisitas() {
  return (
    <Esqueleto etiqueta="Visitas">
      <SkTop botones={3} />
      <SkListado pestanas={5} filas={10} columnas={[22, 28, 20, 12, 12, 6]} grupos />
    </Esqueleto>
  );
}

export function EsqueletoDetalleVisita() {
  return (
    <Esqueleto etiqueta="Detalle de la visita">
      <div style={{ display: "grid", gap: 14 }}>
        <Sk w={70} h={14} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 10 }}>
            <div style={fila(12)}>
              <Sk w={250} h={38} r={10} />
              <Sk w={90} h={22} r={999} />
            </div>
            <Sk w={320} h={13} />
            <Sk w={180} h={13} />
          </div>
          <div style={fila(10)}>
            <Sk w={130} h={40} r={10} />
            <Sk w={130} h={40} r={10} />
            <Sk w={100} h={40} r={10} />
            <Sk w={160} h={40} r={10} />
          </div>
        </div>
      </div>
      <div className="vd-grid">
        <div className="vd-main">
          {[90, 170, 230, 170].map((alto, i) => (
            <section key={i} className="vd-card">
              <Sk w="35%" h={18} r={6} />
              <Sk h={alto - 50} r={10} style={{ marginTop: 16 }} />
            </section>
          ))}
        </div>
        <aside className="vd-side">
          <section className="vd-card">
            <Sk w="55%" h={18} r={6} />
            <SkDatos n={6} />
          </section>
          <section className="vd-card">
            <Sk h={70} r={12} />
          </section>
          <section className="vd-card">
            <Sk w="50%" h={18} r={6} />
            <Sk w="40%" h={11} style={{ marginTop: 10 }} />
            <Sk w={180} h={56} r={8} style={{ marginTop: 14 }} />
            <Sk w="60%" h={13} style={{ marginTop: 14 }} />
          </section>
        </aside>
      </div>
    </Esqueleto>
  );
}

/* ---------- Problemas ---------- */
export function EsqueletoProblemas() {
  return (
    <Esqueleto etiqueta="Tiendas con problemas">
      <SkTop botones={1} />
      <section className="sk-tarjeta" style={{ padding: 22, display: "grid", gap: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "200px minmax(0,1fr)", gap: 28 }}>
          <div style={{ display: "grid", gap: 10 }}>
            <Sk w={70} h={12} />
            <Sk w={90} h={56} r={10} />
            <Sk w={160} h={11} />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignContent: "flex-start" }}>
            {Array.from({ length: 34 }, (_, i) => (
              <Sk key={i} w={20} h={20} r={4} />
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(160px,100%),1fr))", gap: 16 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} style={{ display: "grid", gap: 8 }}>
              <Sk w="70%" h={11} />
              <Sk w={50} h={22} r={6} />
              <Sk w="60%" h={10} />
            </div>
          ))}
        </div>
      </section>
      <Sk h={58} r={14} />
      <div className="pb-md">
        <div className="sk-tarjeta" style={{ padding: 10, display: "grid", gap: 8 }}>
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} style={{ ...fila(10), padding: "10px 8px" }}>
              <span style={{ display: "grid", gap: 7, flex: 1 }}>
                <Sk w="35%" h={10} />
                <Sk w="75%" h={13} />
              </span>
              <Sk w={24} h={24} r={8} />
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gap: 14 }}>
          <Sk h={140} r={16} />
          {[0, 1, 2].map((i) => (
            <Sk key={i} h={170} r={16} />
          ))}
        </div>
      </div>
    </Esqueleto>
  );
}

/* ---------- Clientes, Sucursales, Malls ---------- */
export function EsqueletoListaMaestro({ etiqueta, pestanas = 5, avatar = true }: { etiqueta: string; pestanas?: number; avatar?: boolean }) {
  return (
    <Esqueleto etiqueta={etiqueta}>
      <SkTop botones={1} />
      <SkKpis n={4} />
      <SkListado pestanas={pestanas} filas={10} columnas={[34, 22, 14, 12, 10, 8]} avatar={avatar} />
    </Esqueleto>
  );
}

export function EsqueletoFicha({ etiqueta, tipo }: { etiqueta: string; tipo: "cliente" | "sucursal" | "mall" }) {
  return (
    <Esqueleto etiqueta={etiqueta}>
      <Sk w={80} h={14} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={fila(16)}>
          <Sk w={64} h={64} r={16} />
          <div style={{ display: "grid", gap: 10 }}>
            <Sk w={300} h={36} r={10} />
            <Sk w={360} h={13} />
          </div>
        </div>
        <div style={fila(10)}>
          <Sk w={130} h={40} r={10} />
          <Sk w={150} h={40} r={10} />
        </div>
      </div>
      <SkKpis n={5} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(320px,100%),1fr))", gap: 18 }}>
        {(tipo === "mall" ? [420, 420] : tipo === "sucursal" ? [380, 380, 380] : [330, 330]).map((alto, i) => (
          <section key={i} className="sk-tarjeta" style={{ padding: 20, minHeight: alto / 1.4 }}>
            <Sk w="45%" h={18} r={6} />
            {i === 0 && tipo !== "mall" ? <SkDatos n={6} /> : <SkBarras />}
          </section>
        ))}
      </div>
      <section className="v-card">
        <div className="v-bar">
          <Sk w={160} h={18} r={6} />
        </div>
        <SkListado pestanas={0} filas={8} columnas={[14, 14, 26, 16, 18, 12]} />
      </section>
    </Esqueleto>
  );
}

/* ---------- Usuarios, Checklist, Mi cuenta ---------- */
export function EsqueletoUsuarios() {
  return (
    <Esqueleto etiqueta="Usuarios">
      <SkTop botones={1} />
      <div style={fila(8)}>
        {[110, 120, 190, 170].map((w, i) => (
          <Sk key={i} w={w} h={40} r={12} />
        ))}
      </div>
      <SkListado pestanas={0} filas={9} columnas={[30, 16, 18, 14, 14, 8]} avatar />
    </Esqueleto>
  );
}

export function EsqueletoChecklist() {
  return (
    <Esqueleto etiqueta="Checklist">
      <SkTop botones={1} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {[150, 170, 160, 170, 180, 170, 160, 180].map((w, i) => (
          <Sk key={i} w={w} h={40} r={12} />
        ))}
      </div>
      <div className="ck-grid">
        <section className="sk-tarjeta" style={{ padding: 20, display: "grid", gap: 12 }}>
          <Sk w="40%" h={20} r={6} />
          <Sk w="80%" h={12} />
          {[0, 1].map((s) => (
            <div key={s} style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <Sk h={48} r={12} />
              {[0, 1, 2, 3].map((i) => (
                <Sk key={i} h={60} r={12} />
              ))}
            </div>
          ))}
        </section>
        <Sk h={560} r={36} />
      </div>
    </Esqueleto>
  );
}

export function EsqueletoCuenta() {
  return (
    <Esqueleto etiqueta="Mi cuenta">
      <SkTop botones={0} />
      <section className="sk-tarjeta" style={{ padding: 24, ...fila(20) }}>
        <Sk w={112} h={112} r={28} />
        <div style={{ display: "grid", gap: 10, flex: 1 }}>
          <Sk w={220} h={30} r={8} />
          <Sk w={200} h={13} />
          <Sk w={110} h={32} r={10} />
        </div>
        <Sk w={200} h={150} r={14} />
      </section>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(380px,100%),1fr))", gap: 18 }}>
        {[0, 1].map((i) => (
          <section key={i} className="sk-tarjeta" style={{ padding: 22, display: "grid", gap: 14 }}>
            <Sk w="30%" h={18} r={6} />
            {[0, 1, 2].map((j) => (
              <span key={j} style={{ display: "grid", gap: 8 }}>
                <Sk w={90} h={11} />
                <Sk h={42} r={10} />
              </span>
            ))}
            <Sk w={150} h={40} r={10} style={{ justifySelf: "end" }} />
          </section>
        ))}
      </div>
    </Esqueleto>
  );
}

/* ---------- Panel de técnico ---------- */
/** La barra de arriba del celular, mientras carga la pantalla (cada página arma la suya). */
export function MarcoTecnico({ children }: { children: React.ReactNode }) {
  return (
    <div className="dmc dmc-caja">
      <div className="tp">
        <div className="tp-top">
          <div className="tp-top-in">
            <span className="tp-brand">
              <Sk w={56} h={24} r={6} />
              <Sk w={70} h={14} />
            </span>
          </div>
        </div>
        <div className="tp-contenido">{children}</div>
      </div>
    </div>
  );
}

function SkVisitaTecnico() {
  return (
    <div className="sk-tarjeta" style={{ display: "grid", gridTemplateColumns: "62px minmax(0,1fr)", overflow: "hidden" }}>
      <span style={{ display: "grid", placeItems: "center", background: "var(--canvas)", padding: 10 }}>
        <Sk w={42} h={16} />
      </span>
      <span style={{ display: "grid", gap: 8, padding: 14 }}>
        <Sk w={150} h={18} r={999} />
        <Sk w="80%" h={15} />
        <Sk w="60%" h={11} />
        <Sk w="70%" h={11} />
      </span>
    </div>
  );
}

export function EsqueletoTecnicoInicio() {
  return (
    <div className="tp-main" role="status" aria-busy="true" aria-label="Inicio">
      <div style={{ display: "grid", gap: 10 }}>
        <Sk w={120} h={34} r={8} />
        <Sk w={160} h={34} r={8} />
        <Sk w={190} h={13} />
        <Sk w="85%" h={12} />
      </div>
      <Sk h={76} r={16} />
      <Sk h={230} r={20} style={{ background: "#2a0a36", opacity: 0.18 }} />
      <Sk w={150} h={20} r={6} />
      {[0, 1, 2].map((i) => (
        <SkVisitaTecnico key={i} />
      ))}
    </div>
  );
}

export function EsqueletoTecnicoVisitas() {
  return (
    <div className="tp-main" role="status" aria-busy="true" aria-label="Mis visitas">
      <Sk w={170} h={30} r={8} />
      <Sk h={44} r={12} />
      {[0, 1, 2, 3, 4].map((i) => (
        <SkVisitaTecnico key={i} />
      ))}
    </div>
  );
}

export function EsqueletoTecnicoVisita() {
  return (
    <div className="tp-main" role="status" aria-busy="true" aria-label="Visita">
      <div style={{ display: "grid", gap: 10 }}>
        <Sk w={160} h={14} />
        <Sk w="75%" h={30} r={8} />
        <Sk w="40%" h={13} />
      </div>
      <Sk h={58} r={16} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Sk h={50} r={16} />
        <Sk h={50} r={16} />
      </div>
      <Sk h={90} r={16} />
      <Sk h={58} r={16} />
      <Sk h={58} r={18} />
    </div>
  );
}

export function EsqueletoFormulario() {
  return (
    <div className="tp-main" role="status" aria-busy="true" aria-label="Formulario del acta">
      <div style={{ display: "grid", gap: 10 }}>
        <Sk w={180} h={14} />
        <Sk w="70%" h={28} r={8} />
        <Sk w="55%" h={13} />
        <Sk h={6} r={999} />
      </div>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="sk-tarjeta" style={{ ...fila(14), padding: 16 }}>
          <Sk w={36} h={36} r={10} />
          <span style={{ display: "grid", gap: 7, flex: 1 }}>
            <Sk w="65%" h={15} />
            <Sk w={80} h={10} />
          </span>
          <Sk w={70} h={22} r={999} />
        </div>
      ))}
      <Sk h={56} r={16} />
    </div>
  );
}
