"use client";

// Panel de operación: indicadores, técnicos frente a la meta, estados y fallas.

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import type { PanelData, Rango } from "@/lib/ui/panel-data";
import type { EstadoVisita } from "@/lib/types";
import { fechaCL } from "@/lib/ui/fecha";
import { iniciales } from "@/lib/ui/cuenta";
import { plural } from "@/lib/ui/plural";
import { esDatoDePrueba } from "@/lib/ui/pruebas";
import ProblemasAnillo from "@/components/admin/panel/ProblemasAnillo";
import LineaSemanal from "@/components/admin/panel/LineaSemanal";

const RANGOS: Rango[] = ["Hoy", "Semana", "Mes"];

const PERIODO: Record<Rango, string> = { Hoy: "hoy", Semana: "de la semana", Mes: "del mes" };
const CUANDO: Record<Rango, string> = { Hoy: "para hoy", Semana: "de esta semana", Mes: "de este mes" };

const COLOR_ESTADO: Record<EstadoVisita, string> = {
  PROGRAMADA: "var(--lilac)",
  EN_CURSO: "var(--purple)",
  COMPLETADA: "var(--green)",
  CANCELADA: "var(--grey)",
  PENDIENTE: "var(--red)",
  REAGENDADA: "var(--amber-bar)",
  CANCELADA_ADMIN: "var(--muted)",
};

export default function PanelDashboard({ data }: { data: Record<Rango, PanelData> }) {
  const [rango, setRango] = useState<Rango>("Hoy");
  const d = data[rango];
  const k = d.kpis;
  const sobreMeta = k.programadas > 0 && k.pctCumpl >= d.meta;
  const promedio = d.tiempo.prom;
  const maximoTiempo = Math.max(10, Math.ceil(Math.max(0, ...d.tiempo.porMotivo.map((t) => t.min)) / 10) * 10);
  // A lo sumo unas 8 marcas en el eje, siempre en múltiplos de 10.
  const marcaTiempo = Math.max(10, Math.ceil(maximoTiempo / 80) * 10);
  const topeTiempo = Math.ceil(maximoTiempo / marcaTiempo) * marcaTiempo;

  return (
    <div className="dmc pv">
      <div className="pv-wrap">
        <header className="pv-top">
          <div>
            <h1>Panel de operación</h1>
            <p>{fechaLarga(d.hoy)}</p>
          </div>
          <div className="pv-seg" role="group" aria-label="Período">
            {RANGOS.map((r) => (
              <button key={r} type="button" aria-pressed={rango === r} onClick={() => setRango(r)}>
                {r}
              </button>
            ))}
          </div>
        </header>

        <section className="pv-strip" aria-label="Indicadores">
          <Indicador
            href="/admin/visitas"
            titulo={`Visitas ${PERIODO[rango]}`}
            valor={k.programadas}
            unidad={k.programadas === 1 ? "programada" : "programadas"}
            nota={plural(k.tecnicos, "técnico en terreno", "técnicos en terreno")}
          />
          <Indicador
            href="#tecnicos"
            titulo="Cerradas a tiempo"
            valor={k.cerradas}
            unidad={`de ${k.programadas}`}
            nota={
              k.programadas === 0
                ? "Sin visitas en el período"
                : sobreMeta
                  ? "Sobre la meta"
                  : `${plural(d.meta - k.pctCumpl, "punto", "puntos")} bajo la meta`
            }
            tono={sobreMeta ? "ok" : undefined}
          />
          <Indicador
            href="/admin/problemas"
            titulo="Problemas abiertos"
            valor={k.problemasAbiertosTotal}
            unidad="sin resolver"
            nota="Abiertos y pendientes, en total"
            tono={k.problemasAbiertosTotal > 0 ? "red" : undefined}
          />
          <Indicador
            href="#reagendamientos"
            titulo="Esperan nueva fecha"
            valor={k.porReagendar}
            unidad={k.porReagendar === 1 ? "visita" : "visitas"}
            nota={`${k.reagendas} ${k.reagendas === 1 ? "era" : "eran"} ${CUANDO[rango]}`}
          />
        </section>

        <div className="pv-grid">
          <section className="pv-card s8" id="tecnicos" aria-labelledby="pvTecnicos">
            <Cabecera
              id="pvTecnicos"
              titulo="Técnicos"
              bajada={`Cerradas dentro de la fecha programada, frente a la meta de ${d.meta}%.`}
              etiqueta={
                rango === "Hoy" ? `Hoy, ${fechaCL(d.hoy).slice(0, 5)}` : rango === "Semana" ? "Esta semana" : "Este mes"
              }
            />
            {d.tecnicos.length === 0 ? (
              <p className="pv-vacio">Nadie tiene visitas programadas en este período.</p>
            ) : (
              <ul className="pv-techs">
                {d.tecnicos.map((t) => {
                  const ok = t.pct >= d.meta;
                  const falta = d.meta - t.pct;
                  return (
                    <li key={t.tecnicoId}>
                      <Link
                        className="pv-tech"
                        href={`/admin/visitas?${rango === "Hoy" ? `fecha=${d.hoy}&` : ""}tecnico=${t.tecnicoId}`}
                      >
                        <span className="av" aria-hidden="true">
                          {iniciales(t.nombre)}
                        </span>
                        <span className="pv-t-name">
                          <b>{t.nombre}</b>
                          <small>
                            {t.realizadas} de {t.programadas} a tiempo
                          </small>
                        </span>
                        <span className="pv-t-bar" aria-hidden="true">
                          <i className={ok ? "ok" : undefined} style={{ width: `${t.pct}%` }} />
                          <span className="mark" style={{ left: `${d.meta}%` }} />
                        </span>
                        <b className="pv-t-pct">{t.pct}%</b>
                        {t.realizadas === 0 && rango === "Hoy" ? (
                          <span className="pv-chip">Sin cierres aún</span>
                        ) : ok ? (
                          <span className="pv-chip ok">Sobre la meta</span>
                        ) : (
                          <span className="pv-chip warn">
                            {falta} {falta === 1 ? "pt" : "pts"} bajo
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="pv-card s4" aria-labelledby="pvEstados">
            <Cabecera id="pvEstados" titulo="Estado de las visitas" etiqueta={plural(k.programadas, "visita", "visitas")} />
            <div className="pv-stack" role="img" aria-label={d.estados.map((e) => `${e.label}: ${e.n}`).join(", ")}>
              {d.estados
                .filter((e) => e.n > 0)
                .map((e) => (
                  <span key={e.estado} style={{ flexGrow: e.n, background: COLOR_ESTADO[e.estado] }} title={`${e.label}: ${e.n}`} />
                ))}
            </div>
            <ul className="pv-states">
              {d.estados.map((e) => (
                <li key={e.estado} className={e.n ? undefined : "zero"}>
                  <Link href={`/admin/visitas?estado=${e.estado}`}>
                    <span className="dot" style={{ background: COLOR_ESTADO[e.estado] }} aria-hidden="true" />
                    <span>{e.label}</span>
                    <b>{e.n}</b>
                    <small>{e.pct}%</small>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="pv-card s6" aria-labelledby="pvTipos">
            <Cabecera
              id="pvTipos"
              titulo="Problemas abiertos por tipo"
              etiqueta={plural(k.problemasAbiertosTotal, "abierto", "abiertos")}
              alerta={k.problemasAbiertosTotal > 0}
            />
            <ProblemasAnillo problemas={d.problemasTipo} total={k.problemasAbiertosTotal} />
          </section>

          <section className="pv-card s6" aria-labelledby="pvResolucion">
            <Cabecera
              id="pvResolucion"
              titulo="Tiempo promedio de resolución"
              bajada={`Horas desde que se levanta el problema hasta que se cierra. Semanal, últimas ${d.resolucion.length} semanas.`}
            />
            <LineaSemanal
              semanas={d.resolucion.map((s) => ({
                desde: s.desde,
                valor: s.horas,
                detalle: plural(s.resueltos, "problema resuelto", "problemas resueltos"),
              }))}
              unidad=" h"
              nombre="Tiempo promedio de resolución"
              vacio={`Todavía no se resuelve ningún problema en las últimas ${d.resolucion.length} semanas.`}
            />
          </section>

          <section className="pv-card s12" aria-labelledby="pvRealizadas">
            <Cabecera
              id="pvRealizadas"
              titulo="Visitas realizadas"
              bajada={`Completadas por semana, últimas ${d.realizadas.length} semanas.`}
              etiqueta={plural(d.realizadas.reduce((n, s) => n + s.n, 0), "visita", "visitas")}
            />
            <LineaSemanal
              semanas={d.realizadas.map((s) => ({ desde: s.desde, valor: s.n, detalle: plural(s.n, "visita completada", "visitas completadas") }))}
              unidad=""
              nombre="Visitas completadas"
              vacio="Todavía no hay visitas completadas."
            />
          </section>

          <section className="pv-card s4" aria-labelledby="pvFallas">
            <Cabecera id="pvFallas" titulo="Sucursales con más fallas" />
            {d.sucursalesFallas.length === 0 ? (
              <p className="pv-vacio">Sin fallas registradas.</p>
            ) : (
              <ol className="rank">
                {d.sucursalesFallas.map((s) => (
                  <li key={s.sucursalId}>
                    <span className="rk-name">
                      <span className="rk-client">{s.sucursal.cliente}, </span>
                      {s.sucursal.nombre}{" "}
                      {esDatoDePrueba(s.sucursal.cliente, s.sucursal.nombre) ? <span className="flag test">Prueba</span> : null}
                    </span>
                    <span className="rk-area">{s.sucursal.comuna}</span>
                    <span className="rk-count">
                      <b>{s.total}</b>
                      {s.sinCerrar ? <span className="open-tag">{s.sinCerrar} sin cerrar</span> : null}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="pv-card s8" aria-labelledby="pvTiempo">
            <Cabecera
              id="pvTiempo"
              titulo="Tiempo en sitio por tipo de trabajo"
              etiqueta={
                <>
                  <b>{promedio}</b> min promedio
                </>
              }
            />
            {d.tiempo.porMotivo.length === 0 ? (
              <p className="pv-vacio">Todavía no hay visitas cerradas con hora de inicio y término.</p>
            ) : (
              <>
                <ul className="pv-dots" style={{ "--avg": `${Math.min(100, (100 * promedio) / topeTiempo)}%` } as CSSProperties}>
                  {d.tiempo.porMotivo.map((t) => {
                    const ancho = `${(100 * t.min) / topeTiempo}%`;
                    return (
                      <li key={t.label} className={t.min <= 5 ? "short" : undefined}>
                        <span className="pv-d-name" title={t.label}>
                          {t.label}
                        </span>
                        <span className="pv-d-track" aria-hidden="true">
                          <i style={{ width: ancho }} />
                          <b style={{ left: ancho }} />
                        </span>
                        <span className="pv-d-val">{t.min} min</span>
                      </li>
                    );
                  })}
                  <li className="pv-d-axis" aria-hidden="true">
                    <span />
                    <span className="pv-d-track">
                      {Array.from({ length: topeTiempo / marcaTiempo + 1 }, (_, i) => (
                        <em key={i} style={{ left: `${(100 * i * marcaTiempo) / topeTiempo}%` }}>
                          {i * marcaTiempo}
                        </em>
                      ))}
                    </span>
                    <span />
                  </li>
                </ul>
                <div className="t-legend" aria-hidden="true">
                  <span>
                    <i className="lg-dot" />
                    Duración promedio
                  </span>
                  <span>
                    <i className="lg-dot short" />5 min o menos: revisar el registro
                  </span>
                  <span>
                    <i className="lg-line" />
                    Promedio general
                  </span>
                </div>
              </>
            )}
          </section>

          <section className="pv-card s12" id="reagendamientos" aria-labelledby="pvReagendas">
            <Cabecera
              id="pvReagendas"
              titulo="Reagendamientos"
              bajada={`${plural(d.reagendasLista.length, "registro", "registros")}.`}
            />
            {d.reagendasLista.length === 0 ? (
              <p className="pv-vacio">No hay reagendamientos.</p>
            ) : (
              <ul className="resched">
                {d.reagendasLista.map((r) => (
                  <li key={r.reagendamiento.id}>
                    <Link href={`/admin/visitas/${r.visita.folio}`}>
                      <span className="rs-name">{r.visita.sucursal.nombre}</span>
                      <span className="rs-folio">{r.visita.folio}</span>
                      <span className="rs-why">
                        {/autom[aá]tic/i.test(r.reagendamiento.motivo) ? (
                          <span className="flag auto">Cancelada automáticamente</span>
                        ) : null}
                        {esDatoDePrueba(r.visita.sucursal.nombre, r.reagendamiento.motivo) ? (
                          <span className="flag test">Prueba</span>
                        ) : null}
                        <span>{r.reagendamiento.motivo}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

/** «Miércoles, 25 de noviembre de 2026». */
function fechaLarga(iso: string): string {
  const texto = new Date(`${iso}T00:00:00Z`).toLocaleDateString("es-CL", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function Indicador({
  href,
  titulo,
  valor,
  unidad,
  nota,
  tono,
}: {
  href: string;
  titulo: string;
  valor: number;
  unidad: string;
  nota: string;
  tono?: "ok" | "red";
}) {
  return (
    <Link href={href} className={tono ? `pv-kpi ${tono}` : "pv-kpi"}>
      <span className="pv-k-l">{titulo}</span>
      <span className="pv-k-v">
        {valor.toLocaleString("es-CL")}
        <small>{unidad}</small>
      </span>
      <span className="pv-k-n">{nota}</span>
    </Link>
  );
}

function Cabecera({
  id,
  titulo,
  bajada,
  etiqueta,
  alerta,
}: {
  id: string;
  titulo: string;
  bajada?: string;
  etiqueta?: React.ReactNode;
  alerta?: boolean;
}) {
  return (
    <header className="pv-head">
      <div>
        <h2 id={id}>{titulo}</h2>
        {bajada ? <p>{bajada}</p> : null}
      </div>
      {etiqueta ? <span className={alerta ? "pv-tag red" : "pv-tag"}>{etiqueta}</span> : null}
    </header>
  );
}
