"use client";

import { useState } from "react";
import Link from "next/link";
import type { PanelData, Rango } from "@/lib/ui/panel-data";

const RANGOS: Rango[] = ["Hoy", "Semana", "Mes"];

export default function PanelDashboard({ data }: { data: Record<Rango, PanelData> }) {
  const [rango, setRango] = useState<Rango>("Hoy");
  const d = data[rango];

  return (
    <>
      <div className="lg:sticky lg:top-0 z-10 bg-[var(--color-bg)] border-b-2 border-[var(--color-divider)] flex items-end gap-x-5 gap-y-3 px-4 md:px-7 pt-4 md:pt-[22px] pb-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="font-extrabold text-h2 md:text-h1 leading-[1.08] tracking-[-.03em]">Panel de operación</h1>
        </div>
        <div className="ml-auto seg">
          {RANGOS.map((r) => (
            <label
              key={r}
              className="seg-opt"
              style={{
                background: rango === r ? "var(--color-accent)" : "transparent",
                color: rango === r ? "#fff" : "var(--color-text)",
              }}
            >
              <input
                type="radio"
                name="rango"
                className="sr-only"
                checked={rango === r}
                onChange={() => setRango(r)}
              />
              <span>{r}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="pb-10 animate-fade-in">
        <div className="grid grid-cols-2 lg:grid-cols-4 border-b-2 border-[var(--color-divider)]">
          <KpiCard
            label={`Visitas · ${rango.toLowerCase()}`}
            n={d.kpis.programadas}
            unidad="programadas"
            sub={rango === "Hoy" ? `${d.kpis.tecnicosHoy} ${d.kpis.tecnicosHoy === 1 ? "técnico" : "técnicos"} en terreno` : `${d.kpis.programadas - d.kpis.cerradas} sin cerrar a tiempo`}
            accion="Ver visitas"
            href="/admin/visitas"
          />
          <KpiCard
            label={`Cumplimiento · ${rango.toLowerCase()}`}
            n={`${d.kpis.pctCumpl}%`}
            sub={`${d.kpis.cerradas} de ${d.kpis.programadas} cerradas a tiempo`}
            accion="Ver completadas"
            href="/admin/visitas?estado=COMPLETADA"
          />
          <KpiCard
            label="Problemas abiertos"
            n={d.kpis.problemasAbiertosTotal}
            unidad="sin resolver"
            sub="Abiertos + pendientes, en total"
            accion="Ver problemas"
            href="/admin/problemas"
            color={d.kpis.problemasAbiertosTotal > 0 ? "var(--color-danger)" : undefined}
          />
          <KpiCard
            label="Esperan nueva fecha"
            n={d.kpis.porReagendar}
            unidad={d.kpis.porReagendar === 1 ? "visita" : "visitas"}
            sub={`Reagendadas o pendientes, en total · ${d.kpis.reagendas} ${
              rango === "Hoy" ? "eran para hoy" : rango === "Semana" ? "de esta semana" : "de este mes"
            }`}
            accion="Ver reagendas"
            href="/admin/reagendas"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2">
          <div className="p-4 md:p-6 lg:border-r border-b border-black/[.12]">
            <div className="flex items-baseline gap-2.5">
              <h2 className="font-extrabold text-lead m-0">Visitas del día por estado</h2>
              <span className="ml-auto text-cap opacity-60">{d.totalHoy} visitas</span>
            </div>
            {d.totalHoy > 0 ? (
              <div className="flex h-3.5 mt-4 border border-[var(--color-divider)]">
                {d.estadoHoy.map((e) => (
                  <div key={e.estado} style={{ width: `${e.pct}%`, background: e.color }} className="border-r border-black/[.15]" />
                ))}
              </div>
            ) : (
              <div className="mt-4 h-3.5 bg-[var(--color-surface)]" aria-hidden="true" />
            )}
            <div className="mt-4">
              {d.estadoHoy.map((e) => (
                <Link
                  key={e.estado}
                  href={`/admin/visitas?estado=${e.estado}`}
                  className="w-full flex items-center gap-2.5 py-2.5 border-b border-black/[.1] hover:bg-black/5"
                >
                  <span className="w-2.5 h-2.5 shrink-0 border border-black/[.35]" style={{ background: e.color }} />
                  <span className="text-meta">{e.label}</span>
                  <span className="ml-auto font-extrabold text-ui tabular-nums">{e.n}</span>
                  <span className="w-11 text-right text-cap opacity-62 tabular-nums">{e.pct}%</span>
                </Link>
              ))}
            </div>
          </div>

          <CumplimientoPanel cumplimiento={d.cumplimiento} porTecnico={rango === "Hoy" ? d.carga : null} hoy={d.hoy} />

          <div className="p-4 md:p-6 lg:border-r border-b border-black/[.12]">
            <div className="flex items-baseline gap-2.5">
              <h2 className="font-extrabold text-lead m-0">Problemas abiertos por tipo</h2>
              <span className="ml-auto text-cap opacity-60">
                {d.kpis.problemasAbiertosTotal} abiertos
              </span>
            </div>
            <p className="mt-1.5 mb-0 text-cap opacity-62">Haz clic en un tipo para ver las visitas donde se registró.</p>
            <div className="mt-2.5">
              {d.problemasTipo.map((p) => (
                <div key={p.codigo} className="py-2.5 border-b border-black/[.1]">
                  <div className="flex items-baseline gap-2.5">
                    <span className="text-meta min-w-0">{p.nombre}</span>
                    <span className="ml-auto font-extrabold text-ui tabular-nums">{p.n}</span>
                  </div>
                  <div className="h-2 mt-1.5 bg-[var(--color-neutral-300)]">
                    <div className="h-2" style={{ width: `${p.pct}%`, background: "var(--color-accent)" }} />
                  </div>
                </div>
              ))}
              {d.problemasTipo.length === 0 ? (
                <div className="py-5 text-meta opacity-66">Sin problemas registrados en este período.</div>
              ) : null}
            </div>
          </div>

          {/* En «Hoy» el cumplimiento ya se lee por técnico: esta tabla repetiría lo mismo. */}
          {rango !== "Hoy" ? (
          <div className="p-4 md:p-6 border-b border-black/[.12]">
            <h2 className="font-extrabold text-lead m-0 mb-1">Carga por técnico</h2>
            <p className="m-0 mb-2 text-cap opacity-62">Programadas vs realizadas hoy.</p>
            <table className="table">
              <thead>
                <tr>
                  <th>Técnico</th>
                  <th className="text-right">Prog.</th>
                  <th className="text-right">Real.</th>
                  <th style={{ width: 140 }}>Avance</th>
                </tr>
              </thead>
              <tbody>
                {d.carga.map((c) => (
                  <tr key={c.tecnicoId}>
                    <td className="font-semibold">{c.nombre}</td>
                    <td className="text-right tabular-nums">{c.programadas}</td>
                    <td className="text-right tabular-nums">{c.realizadas}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-[var(--color-neutral-300)]">
                          <div className="h-2" style={{ width: `${c.pct}%`, background: "var(--color-text)" }} />
                        </div>
                        <span className="text-cap opacity-66 tabular-nums">{c.pct}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          ) : null}

          <div
            className={`p-4 md:p-6 max-lg:border-b border-black/[.12] ${rango === "Hoy" ? "border-b" : "lg:border-r"}`}
          >
            <h2 className="font-extrabold text-lead m-0 mb-1">Sucursales con más fallas</h2>
            <p className="m-0 mb-2 text-cap opacity-62">Total histórico de problemas registrados.</p>
            <div>
              {d.sucursalesFallas.map((s, i) => (
                <div key={s.sucursalId} className="w-full flex items-center gap-3 py-2.5 border-b border-black/[.1]">
                  <div className="font-extrabold text-meta tabular-nums opacity-52 w-5">{i + 1}</div>
                  <div className="min-w-0">
                    <div className="font-extrabold text-ui">{s.sucursal.nombre}</div>
                    <div className="text-cap opacity-62">
                      {s.sucursal.comuna}
                    </div>
                  </div>
                  <div className="ml-auto flex items-center gap-2.5">
                    <span className="tag tag-outline">{s.sinCerrar} sin cerrar</span>
                    <span className="font-extrabold text-lead tabular-nums">{s.total}</span>
                  </div>
                </div>
              ))}
              {d.sucursalesFallas.length === 0 ? (
                <div className="py-5 text-meta opacity-66">Sin fallas registradas.</div>
              ) : null}
            </div>
          </div>

          <div className="p-4 md:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <h2 className="font-extrabold text-lead m-0 mb-3">Tiempo en sitio</h2>
                <div className="flex items-baseline gap-1.5">
                  <div className="num font-bold text-display leading-none tracking-[-.03em] tabular-nums">{d.tiempo.prom}</div>
                  <div className="text-meta opacity-62">min prom.</div>
                </div>
                <div className="mt-3.5">
                  {d.tiempo.porMotivo.map((t) => (
                    <div key={t.label} className="py-2 border-b border-black/[.1]">
                      <div className="flex gap-2 text-cap">
                        <span className="min-w-0 opacity-75">{t.label}</span>
                        <span className="ml-auto tabular-nums font-semibold">{t.min} min</span>
                      </div>
                      <div className="h-1.5 mt-1.5 bg-[var(--color-neutral-300)]">
                        <div className="h-1.5" style={{ width: `${t.pct}%`, background: "var(--color-text)" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h2 className="font-extrabold text-lead m-0 mb-3">Reagendamientos</h2>
                <div className="flex items-baseline gap-2">
                  <div className="num font-bold text-display leading-none tracking-[-.03em] tabular-nums">
                    {d.reagendasLista.length}
                  </div>
                  <div className="text-meta opacity-62">últimos registrados</div>
                </div>
                <div className="mt-3.5">
                  {d.reagendasLista.map((r) => (
                    <Link
                      key={r.reagendamiento.id}
                      href={`/admin/visitas/${r.visita.folio}`}
                      className="w-full block text-left py-2.5 border-b border-black/[.1] hover:bg-black/5"
                    >
                      <div className="flex gap-2 items-baseline">
                        <span className="font-extrabold text-meta min-w-0">{r.visita.sucursal?.nombre}</span>
                        <span className="ml-auto text-cap tabular-nums opacity-62">{r.visita.folio}</span>
                      </div>
                      <div className="text-cap opacity-70 mt-1">{r.reagendamiento.motivo}</div>
                    </Link>
                  ))}
                  {d.reagendasLista.length === 0 ? (
                    <div className="py-3.5 text-meta opacity-66">Sin reagendamientos.</div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * "Cumplimiento vs programado": el porcentaje del rango y una barra por día
 * trabajado. Los días sin visitas programadas no aparecen. Al pasar el mouse
 * por una barra se explica ese día; al hacer clic se abren sus visitas.
 */
function CumplimientoPanel({
  cumplimiento,
  porTecnico,
  hoy,
}: {
  cumplimiento: PanelData["cumplimiento"];
  /** En «Hoy»: el avance de cada técnico en vez de una sola barra del día. */
  porTecnico: PanelData["carga"] | null;
  hoy: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const dia = cumplimiento.dias.find((x) => x.fecha === hover) ?? null;

  return (
    <div className="p-4 md:p-6 border-b border-black/[.12]">
      <div className="flex items-baseline gap-2.5">
        <h2 className="font-extrabold text-lead m-0">Cumplimiento vs programado</h2>
        <span className="ml-auto text-cap opacity-60">{cumplimiento.rangoTexto}</span>
      </div>

      <div className="flex items-end gap-3.5 mt-3.5">
        <div className="num font-bold text-hero leading-none tracking-[-.03em] tabular-nums">
          {cumplimiento.pct}%
        </div>
        <div className="text-cap opacity-66 pb-2">
          {cumplimiento.detalle}
          <br />
          Meta interna {cumplimiento.meta}%
        </div>
      </div>

      {porTecnico ? (
        <PorTecnico filas={porTecnico} meta={cumplimiento.meta} hoy={hoy} />
      ) : (
      <>
      <div
        className="mt-3.5 px-3 py-2.5 text-cap min-h-5 border"
        style={{
          background: dia ? "var(--color-accent-200)" : "var(--color-surface)",
          borderColor: dia ? "var(--color-accent)" : "var(--color-divider)",
        }}
      >
        {dia
          ? `${dia.label} · ${dia.pct}% · ${dia.cerradas} de ${dia.programadas} cerradas a tiempo · click para ver sus visitas`
          : "Toca o pasa el mouse por un día para ver su detalle; haz clic para abrir esas visitas."}
      </div>

      {cumplimiento.dias.length > 0 ? (
        <>
          <div className="flex items-end gap-2.5 h-[118px] mt-3.5 border-b-2 border-[var(--color-divider)]">
            {cumplimiento.dias.map((day) => {
              const activo = hover === day.fecha;
              return (
                <Link
                  key={day.fecha}
                  href={`/admin/visitas?fecha=${day.fecha}`}
                  onMouseEnter={() => setHover(day.fecha)}
                  onMouseLeave={() => setHover(null)}
                  aria-label={`${day.label} ${day.pct}%`}
                  className="flex-1 flex flex-col justify-end items-stretch h-full"
                  style={{ background: activo ? "rgba(31,28,33,.07)" : "transparent" }}
                >
                  <div
                    className="text-cap font-extrabold text-center tabular-nums mb-1.5"
                    style={{ opacity: activo ? 1 : 0.5 }}
                  >
                    {day.pctTxt}
                  </div>
                  <div
                    style={{
                      height: `${day.h}%`,
                      background: activo
                        ? "var(--color-accent-active)"
                        : day.esHoy
                          ? "var(--color-accent)"
                          : "var(--color-neutral-600)",
                    }}
                  />
                </Link>
              );
            })}
          </div>
          <div className="flex gap-2.5 mt-1.5">
            {cumplimiento.dias.map((day) => (
              <div
                key={day.fecha}
                className="flex-1 text-center text-cap "
                style={{
                  opacity: hover === day.fecha || day.esHoy ? 1 : 0.45,
                  fontWeight: hover === day.fecha || day.esHoy ? 800 : 400,
                }}
              >
                {day.label}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="py-8 text-meta opacity-66">Sin días trabajados en este período.</div>
      )}
      </>
      )}
    </div>
  );
}

/**
 * El cumplimiento del día leído por técnico: cuántas de sus visitas de hoy ya
 * cerró, con la meta interna marcada en cada barra. Cada fila abre sus visitas.
 */
function PorTecnico({ filas, meta, hoy }: { filas: PanelData["carga"]; meta: number; hoy: string }) {
  const orden = [...filas].sort((a, b) => a.pct - b.pct || b.programadas - a.programadas);
  if (orden.length === 0) {
    return <div className="py-8 text-meta opacity-66">Nadie tiene visitas programadas hoy.</div>;
  }
  return (
    <div className="mt-4">
      <div className="flex items-center gap-3 pb-2 border-b border-[var(--color-line-control)] text-cap font-semibold text-[var(--color-muted)]">
        <span className="flex-1">Técnico</span>
        <span className="w-[72px] text-right">Cerradas</span>
        <span className="w-[38%] min-w-[120px]">Avance · meta {meta}%</span>
      </div>
      {orden.map((t) => (
        <Link
          key={t.tecnicoId}
          href={`/admin/visitas?fecha=${hoy}&tecnico=${t.tecnicoId}`}
          className="flex items-center gap-3 py-2.5 border-b border-[var(--color-line)] hover:bg-[rgba(31,28,33,.04)]"
        >
          <span className="flex-1 min-w-0 truncate text-ui font-semibold">{t.nombre}</span>
          <span className="w-[72px] text-right text-meta text-[var(--color-muted)]">
            <span className="num text-[var(--color-text)]">{t.realizadas}</span> de <span className="num">{t.programadas}</span>
          </span>
          <span className="w-[38%] min-w-[120px] flex items-center gap-2">
            <span className="relative flex-1 h-2 bg-[var(--color-neutral-300)]">
              <span
                className="absolute inset-y-0 left-0"
                style={{ width: `${t.pct}%`, background: t.pct >= meta ? "var(--color-text)" : "var(--color-accent)" }}
              />
              <span
                className="absolute -top-1 -bottom-1 w-px bg-[var(--color-text)]"
                style={{ left: `${meta}%` }}
                aria-hidden="true"
              />
            </span>
            <span className="num w-9 text-right text-cap">{t.pct}%</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

function KpiCard({
  label,
  n,
  unidad,
  sub,
  accion,
  href,
  color = "var(--color-text)",
}: {
  label: string;
  n: number | string;
  unidad?: string;
  sub: string;
  accion: string;
  href: string;
  color?: string;
}) {
  return (
    <Link href={href} className="block text-left px-4 md:px-6 pt-4 md:pt-[22px] pb-4.5 border-r max-lg:border-b border-black/[.2] hover:bg-black/5">
      <div className="text-cap opacity-66">{label}</div>
      <div className="flex items-baseline gap-2 mt-3">
        <div className="num font-bold text-h1 md:text-display leading-none tracking-[-.03em] tabular-nums" style={{ color }}>
          {n}
        </div>
        {unidad ? <div className="text-cap opacity-62">{unidad}</div> : null}
      </div>
      <div className="text-cap opacity-66 mt-2.5">{sub}</div>
      <div className="flex items-center gap-1.5 mt-2.5 text-cap text-[var(--color-accent-active)]">
        <span>{accion}</span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </div>
    </Link>
  );
}
