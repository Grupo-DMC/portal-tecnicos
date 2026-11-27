"use client";

import { useFiltroRecordado } from "@/lib/ui/filtro-recordado";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icono from "@/components/ui/Icono";
import { PILL_VISITA } from "@/lib/ui/lista-visitas";
import { plural } from "@/lib/ui/plural";
import { esDatoDePrueba } from "@/lib/ui/pruebas";
import { ocultarCredenciales } from "@/lib/ui/reservado";
import FiltrosBar from "@/components/admin/FiltrosBar";
import { ESTADO_VISITA_LABEL } from "@/lib/ui/estado";
import { textoFechaVisita, fechaCL } from "@/lib/ui/fecha";
import { sinTildes } from "@/lib/ui/formato";
import type { DatoFicha, FilaFicha } from "@/components/admin/maestros/FichaPartes";
import type { EstadoVisita } from "@/lib/types";

const ESTADOS: EstadoVisita[] = [
  "COMPLETADA",
  "EN_CURSO",
  "PROGRAMADA",
  "PENDIENTE",
  "REAGENDADA",
  "CANCELADA",
  "CANCELADA_ADMIN",
];
const EN_ESPERA: EstadoVisita[] = ["PROGRAMADA", "EN_CURSO", "PENDIENTE", "REAGENDADA"];
const COLOR_ESTADO: Record<EstadoVisita, string> = {
  PROGRAMADA: "var(--lilac)",
  EN_CURSO: "var(--purple)",
  COMPLETADA: "var(--green)",
  PENDIENTE: "var(--red)",
  REAGENDADA: "var(--amber-bar)",
  CANCELADA: "var(--grey)",
  CANCELADA_ADMIN: "var(--muted)",
};

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export interface TiendaFicha {
  id: number;
  nombre: string;
  mall: string | null;
  cliente: string;
  comuna: string;
  activo: boolean;
}

const pct = (n: number, de: number) => (de ? Math.round((n / de) * 100) : 0);

/** Días entre dos fechas YYYY-MM-DD. */
const diasEntre = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

export default function FichaVisitas({
  modo,
  titulo,
  subtitulo,
  activo,
  volver,
  acciones,
  accionExtra,
  datos,
  notas,
  filas,
  tiendas,
  verVisitas,
  hoy,
  secciones,
}: {
  /** De qué es la ficha: cambia un gráfico y las columnas de las tablas. */
  modo: "sucursal" | "cliente" | "mall";
  titulo: string;
  subtitulo: string;
  activo: boolean;
  volver: { href: string; label: string };
  acciones?: { href: string; label: string }[];
  /** Un botón propio al final de las acciones («Agendar visita» en la sucursal). */
  accionExtra?: React.ReactNode;
  datos: DatoFicha[];
  notas: string | null;
  filas: FilaFicha[];
  /** En la ficha del cliente o del mall: sus tiendas, para la tabla y el filtro. */
  tiendas?: TiendaFicha[];
  verVisitas: boolean;
  hoy: string;
  /** Bloques propios de la ficha (marcas, contactos), entre los datos y las visitas. */
  secciones?: React.ReactNode;
}) {
  const router = useRouter();
  const historial = useRef<HTMLDivElement>(null);
  const esCliente = modo === "cliente";
  const esMall = modo === "mall";
  const conTiendas = Boolean(tiendas);

  const [busqueda, setBusqueda] = useFiltroRecordado("busqueda");
  const [fEstado, setFEstado] = useFiltroRecordado("estado");
  const [fAnio, setFAnio] = useFiltroRecordado("anio");
  const [fTienda, setFTienda] = useFiltroRecordado("tienda");

  // ── Cifras ────────────────────────────────────────────────────────────────
  const total = filas.length;
  const completadas = filas.filter((f) => f.estado === "COMPLETADA").length;
  const enEspera = filas.filter((f) => EN_ESPERA.includes(f.estado)).length;
  const problemas = filas.reduce((n, f) => n + f.problemas, 0);
  const problemasAbiertos = filas.reduce((n, f) => n + f.problemasAbiertos, 0);
  // Vienen de la más reciente a la más antigua.
  const ultima = filas.find((f) => f.estado === "COMPLETADA" && f.fecha <= hoy) ?? null;
  const proxima = [...filas].reverse().find((f) => EN_ESPERA.includes(f.estado) && f.fecha >= hoy) ?? null;
  const conTiempo = filas.filter((f) => f.minutos !== null);
  const minutosProm = conTiempo.length
    ? Math.round(conTiempo.reduce((n, f) => n + (f.minutos ?? 0), 0) / conTiempo.length)
    : null;

  // ── Gráficos ──────────────────────────────────────────────────────────────
  const porEstado = ESTADOS.map((e) => {
    const n = filas.filter((f) => f.estado === e).length;
    return { estado: e, label: ESTADO_VISITA_LABEL[e], n, pct: pct(n, total), color: COLOR_ESTADO[e] };
  }).filter((e) => e.n > 0);

  const meses = useMemo(() => {
    const [a, m] = hoy.split("-").map(Number);
    const lista: { clave: string; label: string; anio: number; total: number; completadas: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(a, m - 1 - i, 1);
      const clave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      lista.push({ clave, label: MESES[d.getMonth()], anio: d.getFullYear(), total: 0, completadas: 0 });
    }
    for (const f of filas) {
      const mes = lista.find((x) => x.clave === f.fecha.slice(0, 7));
      if (!mes) continue;
      mes.total++;
      if (f.estado === "COMPLETADA") mes.completadas++;
    }
    return lista;
  }, [filas, hoy]);
  const maxMes = Math.max(1, ...meses.map((m) => m.total));
  const enElAnio = meses.reduce((n, m) => n + m.total, 0);

  const ranking = (claves: string[]) => {
    const cuenta = new Map<string, number>();
    for (const c of claves) cuenta.set(c, (cuenta.get(c) ?? 0) + 1);
    const lista = [...cuenta.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"));
    const max = Math.max(1, ...lista.map(([, n]) => n));
    return lista.slice(0, 7).map(([nombre, n]) => ({ nombre, n, pct: pct(n, max) }));
  };
  const motivos = ranking(filas.flatMap((f) => f.motivosLista));
  const tecnicos = ranking(filas.flatMap((f) => (f.ayudante ? [f.tecnico, f.ayudante] : [f.tecnico])));
  const malls = ranking(filas.map((f) => f.mall ?? "Sin mall"));
  const clientes = ranking(filas.map((f) => f.cliente));

  const visitasPorTienda = useMemo(() => {
    const m = new Map<number, { n: number; ultima: string | null }>();
    for (const f of filas) {
      const t = m.get(f.tiendaId) ?? { n: 0, ultima: null };
      t.n++;
      if (f.estado === "COMPLETADA" && (!t.ultima || f.fecha > t.ultima)) t.ultima = f.fecha;
      m.set(f.tiendaId, t);
    }
    return m;
  }, [filas]);
  const tiendasOrdenadas = useMemo(
    () =>
      [...(tiendas ?? [])].sort(
        (a, b) =>
          Number(b.activo) - Number(a.activo) ||
          (visitasPorTienda.get(b.id)?.n ?? 0) - (visitasPorTienda.get(a.id)?.n ?? 0) ||
          a.nombre.localeCompare(b.nombre, "es")
      ),
    [tiendas, visitasPorTienda]
  );
  const maxTienda = Math.max(1, ...tiendasOrdenadas.map((t) => visitasPorTienda.get(t.id)?.n ?? 0));

  // ── Historial ─────────────────────────────────────────────────────────────
  const anios = [...new Set(filas.map((f) => f.fecha.slice(0, 4)))].sort().reverse();
  const filtradas = useMemo(() => {
    const q = sinTildes(busqueda.trim().toLowerCase());
    return filas.filter(
      (f) =>
        (!fEstado || f.estado === fEstado) &&
        (!fAnio || f.fecha.startsWith(fAnio)) &&
        (!fTienda || String(f.tiendaId) === fTienda) &&
        (!q || sinTildes(`${f.folio} ${f.tienda} ${f.cliente} ${f.mall ?? ""} ${f.tecnico} ${f.ayudante ?? ""} ${f.motivos}`.toLowerCase()).includes(q))
    );
  }, [filas, busqueda, fEstado, fAnio, fTienda]);

  function verEstado(estado: string) {
    setFEstado(estado);
    historial.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="dmc pagina">
      <div className="wrap cd">
        <header className="vd-head">
          <Link href={volver.href} className="back">
            <Icono nombre="atras" />
            {volver.label}
          </Link>
          <div className="vd-bar">
            <div>
              <div className="vd-title">
                <h1>{titulo}</h1>
                <span className={`pill ${activo ? "ok" : "off"}`}>
                  {activo ? (modo === "sucursal" ? "Activa" : "Activo") : modo === "sucursal" ? "Inactiva" : "Inactivo"}
                </span>
                {esDatoDePrueba(titulo, subtitulo) ? <span className="flag test">Prueba</span> : null}
              </div>
              <p className="vd-meta">{subtitulo}</p>
            </div>
            <div className="vd-ops">
              {acciones?.map((a) => (
                <Link key={a.href} href={a.href} className="btn-out">
                  {a.label}
                </Link>
              ))}
              {accionExtra}
            </div>
          </div>
        </header>

        <section className="pv-strip cinco" aria-label="Resumen">
          <Kpi label="Visitas" n={verVisitas ? total : "—"} sub={verVisitas ? `${enElAnio} en los últimos 12 meses` : "Sin permiso para verlas"} />
          <Kpi label="Completadas" n={verVisitas ? `${pct(completadas, total)}%` : "—"} sub={`${completadas} de ${total}`} />
          <Kpi label="En espera" n={verVisitas ? enEspera : "—"} sub={proxima ? `Próxima: ${fechaCL(proxima.fecha)} · ${proxima.folio}` : "Nada agendado"} />
          <Kpi label="Problemas sin resolver" n={verVisitas ? problemasAbiertos : "—"} sub={`de ${problemas} registrados`} rojo={problemasAbiertos > 0} />
          <Kpi
            label="Última visita hecha"
            n={ultima ? fechaCL(ultima.fecha) : "—"}
            sub={ultima ? `hace ${diasEntre(ultima.fecha, hoy)} días · ${ultima.folio}` : "Todavía ninguna"}
          />
        </section>

        <div className="pv-grid">
          <GraficoMeses meses={meses} max={maxMes} />

          <Panel titulo="Visitas por estado" extra={plural(total, "visita", "visitas")} clase="s4">
            {porEstado.length ? (
              <>
                <div className="pv-stack" role="img" aria-label={porEstado.map((e) => `${e.label}: ${e.n}`).join(", ")}>
                  {porEstado.map((e) => (
                    <span key={e.estado} style={{ flexGrow: e.n, background: e.color }} />
                  ))}
                </div>
                <ul className="pv-states">
                  {porEstado.map((e) => (
                    <li key={e.estado}>
                      <button type="button" onClick={() => verEstado(e.estado)} title="Ver esas visitas abajo">
                        <span className="dot" style={{ background: e.color }} aria-hidden="true" />
                        <span>{e.label}</span>
                        <b>{e.n}</b>
                        <small>{e.pct}%</small>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <Vacio texto="Todavía no hay visitas." />
            )}
          </Panel>

          <Panel titulo={esCliente ? "Datos del cliente" : esMall ? "Datos del mall" : "Datos de la tienda"} clase="s4">
            <dl className="facts">
              {datos.map((d) => (
                <div key={d.label}>
                  <dt>{d.label}</dt>
                  <dd>
                    {d.href ? (
                      <Link href={d.href} className="enlace">
                        {d.valor}
                      </Link>
                    ) : (
                      d.valor
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            {notas ? <p className="cd-notas">{ocultarCredenciales(notas)}</p> : null}
          </Panel>

          <Panel titulo="Motivos más frecuentes" extra="Histórico" clase="s4">
            <Barras filas={motivos} vacio="Sin motivos registrados." />
          </Panel>

          {esCliente ? (
            <Panel titulo="Visitas por mall" extra={plural(malls.length, "lugar", "lugares")} clase="s4">
              <Barras filas={malls} vacio="Sin visitas todavía." />
            </Panel>
          ) : esMall ? (
            <Panel titulo="Visitas por cliente" extra={plural(clientes.length, "cliente", "clientes")} clase="s4">
              <Barras filas={clientes} vacio="Sin visitas todavía." />
            </Panel>
          ) : (
            <Panel titulo="Técnicos que han ido" extra="Histórico" clase="s4">
              <Barras filas={tecnicos} vacio="Sin visitas todavía." />
            </Panel>
          )}

          <Panel titulo="Problemas y tiempo en sitio" clase="s12">
            <dl className="cd-dos">
              <div>
                <dt>Problemas registrados</dt>
                <dd>
                  <b>{problemas}</b> en {plural(filas.filter((f) => f.problemas).length, "visita", "visitas")}
                </dd>
                <dd>{problemas ? `${pct(problemas - problemasAbiertos, problemas)}% resueltos · ${problemasAbiertos} sin resolver` : "Ninguno"}</dd>
              </div>
              <div>
                <dt>Tiempo en sitio</dt>
                <dd>
                  <b>{minutosProm ?? "—"}</b> min promedio
                </dd>
                <dd>{conTiempo.length ? `Según ${conTiempo.length} actas con hora de inicio y término.` : "Sin actas con hora de término."}</dd>
              </div>
            </dl>
          </Panel>
        </div>

        {secciones ? <div className="cd-secciones">{secciones}</div> : null}

        {tiendas ? (
          <section className="v-card" aria-labelledby="cd-tiendas">
            <div className="cd-cab">
              <h2 id="cd-tiendas">Sus tiendas</h2>
              <span className="pv-tag">
                {tiendas.filter((t) => t.activo).length} activas de {tiendas.length}
              </span>
            </div>
            {tiendasOrdenadas.length ? (
              <div className="tabla-caja">
                <table className="vt fichas">
                  <thead>
                    <tr>
                      <th scope="col">Tienda</th>
                      <th scope="col">{esMall ? "Cliente" : "Mall"}</th>
                      <th scope="col">Comuna</th>
                      <th scope="col">Visitas</th>
                      <th scope="col">Última hecha</th>
                      <th scope="col">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tiendasOrdenadas.map((t) => {
                      const v = visitasPorTienda.get(t.id);
                      return (
                        <tr key={t.id} className="v-row" onClick={() => router.push(`/admin/sucursales/${t.id}`)}>
                          <td className="celda">
                            <Link href={`/admin/sucursales/${t.id}`} onClick={(e) => e.stopPropagation()}>
                              <b>{t.nombre}</b>
                            </Link>
                            {esDatoDePrueba(t.nombre, t.cliente) ? <span className="flag test">Prueba</span> : null}
                          </td>
                          <td data-label={esMall ? "Cliente" : "Mall"}>{esMall ? t.cliente : (t.mall ?? "—")}</td>
                          <td data-label="Comuna">{t.comuna}</td>
                          <td data-label="Visitas">
                            <span className="cd-barra">
                              <span aria-hidden="true">
                                <i style={{ width: `${pct(v?.n ?? 0, maxTienda)}%` }} />
                              </span>
                              <b>{v?.n ?? 0}</b>
                            </span>
                          </td>
                          <td data-label="Última hecha">{v?.ultima ? fechaCL(v.ultima) : "—"}</td>
                          <td data-label="Estado">
                            <span className={`pill ${t.activo ? "ok" : "off"}`}>{t.activo ? "Activa" : "Inactiva"}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <Vacio texto={esMall ? "Este mall no tiene tiendas." : "Este cliente no tiene tiendas."} />
            )}
          </section>
        ) : null}

        <section ref={historial} className="v-card cd-historial" aria-labelledby="cd-historial">
          <div className="cd-cab">
            <h2 id="cd-historial">Historial de visitas</h2>
            {verVisitas ? <span className="pv-tag">{total} en total</span> : null}
          </div>
          {verVisitas ? (
            <>
              <FiltrosBar
                busqueda={busqueda}
                phBusqueda={conTiendas ? "Buscar folio, tienda, cliente, técnico…" : "Buscar folio, técnico, motivo…"}
                onBusqueda={setBusqueda}
                campos={[
                  {
                    id: "ff-estado",
                    label: "Estado",
                    valor: fEstado,
                    opciones: [{ v: "", t: "Todos" }, ...ESTADOS.map((e) => ({ v: e, t: ESTADO_VISITA_LABEL[e] }))],
                    onChange: setFEstado,
                  },
                  { id: "ff-anio", label: "Año", valor: fAnio, opciones: [{ v: "", t: "Todos" }, ...anios.map((a) => ({ v: a, t: a }))], onChange: setFAnio },
                  ...(tiendas
                    ? [
                        {
                          id: "ff-tienda",
                          label: "Tienda",
                          valor: fTienda,
                          opciones: [{ v: "", t: "Todas" }, ...tiendasOrdenadas.map((t) => ({ v: String(t.id), t: t.nombre }))],
                          onChange: setFTienda,
                        },
                      ]
                    : []),
                ]}
                chips={[
                  ...(fEstado ? [{ label: ESTADO_VISITA_LABEL[fEstado as EstadoVisita], onQuitar: () => setFEstado("") }] : []),
                  ...(fAnio ? [{ label: `Año ${fAnio}`, onQuitar: () => setFAnio("") }] : []),
                  ...(fTienda
                    ? [{ label: tiendas?.find((t) => String(t.id) === fTienda)?.nombre ?? "Tienda", onQuitar: () => setFTienda("") }]
                    : []),
                ]}
                onLimpiar={() => {
                  setBusqueda("");
                  setFEstado("");
                  setFAnio("");
                  setFTienda("");
                }}
                conteo={plural(filtradas.length, "visita", "visitas")}
              />
              <div className="tabla-caja">
                <table className="vt fichas">
                  <thead>
                    <tr>
                      <th scope="col">Folio</th>
                      <th scope="col">Fecha</th>
                      <th scope="col">Hora</th>
                      {conTiendas ? <th scope="col">Tienda</th> : null}
                      <th scope="col">{esMall ? "Cliente" : "Mall"}</th>
                      <th scope="col">Técnico</th>
                      <th scope="col">Motivo</th>
                      <th scope="col">Problemas</th>
                      <th scope="col">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtradas.map((f) => (
                      <tr key={f.id} className="v-row" onClick={() => router.push(`/admin/visitas/${encodeURIComponent(f.folio)}`)}>
                        <td className="celda">
                          <Link href={`/admin/visitas/${encodeURIComponent(f.folio)}`} onClick={(e) => e.stopPropagation()}>
                            <b>{f.folio}</b>
                          </Link>
                        </td>
                        <td data-label="Fecha">{textoFechaVisita({ fechaProgramada: f.fecha, fechaHasta: f.fechaHasta })}</td>
                        <td data-label="Hora">{f.hora ?? "Sin hora"}</td>
                        {conTiendas ? <td data-label="Tienda">{f.tienda}</td> : null}
                        <td data-label={esMall ? "Cliente" : "Mall"}>{esMall ? f.cliente : (f.mall ?? "—")}</td>
                        <td data-label="Técnico">{f.ayudante ? `${f.tecnico} + ${f.ayudante}` : f.tecnico}</td>
                        <td data-label="Motivo">{f.motivos}</td>
                        <td data-label="Problemas">
                          {f.problemas ? (
                            <span className={`pill ${f.problemasAbiertos ? "open" : "ok"}`}>
                              {f.problemasAbiertos ? `${f.problemasAbiertos} sin resolver` : `${f.problemas} resueltos`}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td data-label="Estado">
                          <span className={`pill ${PILL_VISITA[f.estado]}`}>{ESTADO_VISITA_LABEL[f.estado]}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filtradas.length === 0 ? (
                <div className="v-empty">
                  <b>Nada que mostrar</b>
                  <span>{total ? "Ajusta la búsqueda o los filtros." : "Todavía no hay visitas registradas."}</span>
                </div>
              ) : null}
            </>
          ) : (
            <Vacio texto="Tu rol no tiene acceso a las visitas." />
          )}
        </section>
      </div>
    </div>
  );
}

function Kpi({ label, n, sub, rojo }: { label: string; n: React.ReactNode; sub: string; rojo?: boolean }) {
  return (
    <div className={rojo ? "pv-kpi red" : "pv-kpi"}>
      <span className="pv-k-l">{label}</span>
      <span className="pv-k-v">{n}</span>
      <span className="pv-k-n">{sub}</span>
    </div>
  );
}

function Panel({ titulo, extra, clase, children }: { titulo: string; extra?: string; clase: string; children: React.ReactNode }) {
  return (
    <section className={`pv-card ${clase}`}>
      <header className="pv-head">
        <h2>{titulo}</h2>
        {extra ? <span className="pv-tag">{extra}</span> : null}
      </header>
      {children}
    </section>
  );
}

function Barras({ filas, vacio }: { filas: { nombre: string; n: number; pct: number }[]; vacio: string }) {
  if (!filas.length) return <Vacio texto={vacio} />;
  return (
    <ul className="cd-barras">
      {filas.map((f) => (
        <li key={f.nombre}>
          <span>{f.nombre}</span>
          <b>{f.n}</b>
          <span className="cd-linea" aria-hidden="true">
            <i style={{ width: `${f.pct}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function Vacio({ texto }: { texto: string }) {
  return <p className="pv-vacio cd-vacio">{texto}</p>;
}

/** Una barra por mes de los últimos 12: el total, y en oscuro lo completado. */
function GraficoMeses({
  meses,
  max,
}: {
  meses: { clave: string; label: string; anio: number; total: number; completadas: number }[];
  max: number;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const mes = meses.find((m) => m.clave === hover) ?? null;

  return (
    <section className="pv-card s8">
      <header className="pv-head">
        <div>
          <h2>Actividad</h2>
          <p aria-live="polite">
            {mes
              ? `${mes.label} ${mes.anio}: ${plural(mes.total, "visita", "visitas")}, ${mes.completadas} completadas.`
              : "Visitas por mes, últimos 12 meses. Toca un mes para ver su detalle."}
          </p>
        </div>
      </header>
      <ol className="cd-meses">
        {meses.map((m) => (
          <li key={m.clave}>
            <button
              type="button"
              className={hover === m.clave ? "activo" : undefined}
              aria-label={`${m.label} ${m.anio}: ${m.total} visitas, ${m.completadas} completadas`}
              onMouseEnter={() => setHover(m.clave)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(m.clave)}
              onClick={() => setHover(m.clave)}
            >
              <b>{m.total || ""}</b>
              <span className="cd-col" style={{ height: `${(m.total / max) * 100}%` }}>
                <i className="otras" style={{ flex: m.total - m.completadas }} />
                <i className="hechas" style={{ flex: m.completadas }} />
              </span>
              <small>{m.label}</small>
            </button>
          </li>
        ))}
      </ol>
      <div className="t-legend" aria-hidden="true">
        <span>
          <i className="lg-dot" />
          Completadas
        </span>
        <span>
          <i className="lg-dot otras" />
          Otras
        </span>
      </div>
    </section>
  );
}
