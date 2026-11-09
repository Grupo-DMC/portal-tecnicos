"use client";

import { useFiltroRecordado } from "@/lib/ui/filtro-recordado";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Tag from "@/components/Tag";
import NuevaVisitaSheet from "@/components/mobile/NuevaVisitaSheet";
import { Toast, useToast } from "@/components/ui/Toast";
import { ESTADO_VISITA_BARRA, ESTADO_VISITA_LABEL, ESTADO_VISITA_TAG, textoMotivos } from "@/lib/ui/estado";
import { actasEnCola, haceCuanto, migrarClavesViejas, sacarDeCola, type ActaEnCola } from "@/lib/ui/borrador";
import { useUsuarioLocal } from "@/lib/ui/usuario-local";
import { estaCancelada } from "@/lib/ui/estado";
import { diaDeVisita, sumarDias } from "@/lib/ui/fecha";
import { puede, useReferencias } from "@/lib/ui/referencias";
import type { EstadoVisita, Mall, Visita } from "@/lib/types";

const ESTADOS: EstadoVisita[] = [
  "PROGRAMADA",
  "EN_CURSO",
  "COMPLETADA",
  "PENDIENTE",
  "REAGENDADA",
  "CANCELADA",
  "CANCELADA_ADMIN",
];

const PENDIENTES: EstadoVisita[] = ["PROGRAMADA", "EN_CURSO", "PENDIENTE"];

/** '2026-10-05' → "5 oct". */
function diaCorto(fecha: string): string {
  return new Date(`${fecha}T00:00:00`).toLocaleDateString("es-CL", { day: "numeric", month: "short" });
}

export default function VisitasList({
  visitas,
  hoy,
  tecnicoId,
}: {
  visitas: Visita[];
  hoy: string;
  /** Quien mira: las visitas donde no es el asignado las tiene de ayudante. */
  tecnicoId: number;
}) {
  const router = useRouter();
  const { toast, aviso } = useToast();
  const [filtroAbierto, setFiltroAbierto] = useState(false);
  const [estado, setEstado] = useFiltroRecordado("estado");
  const [nueva, setNueva] = useState(false);
  const ref = useReferencias();
  /** Los malls desplegados, como "<fecha>-<mall>": nacen plegados. */
  const [abiertos, setAbiertos] = useState<string[]>([]);
  /** Período del historial y cuántos días de él se muestran. */
  const [periodo, setPeriodo] = useState<"semana" | "mes" | "todo">("semana");
  const [diasVisibles, setDiasVisibles] = useState(7);
  /** Los días que el técnico abrió o cerró a mano; el resto sigue la regla de `diaAbierto`. */
  const [diasTocados, setDiasTocados] = useState<Record<string, boolean>>({});
  /** Actas terminadas que quedaron esperando señal en este celular. */
  const uid = useUsuarioLocal();
  const [pendientes, setPendientes] = useState<ActaEnCola[]>([]);

  // Solo en el navegador: la cola vive en el almacenamiento del equipo.
  //
  // De paso se descarta la de las visitas que el servidor ya da por cerradas:
  // pasa cuando el acta llegó pero la respuesta se perdió en el camino, y sin
  // esto el aviso quedaría para siempre pidiendo enviar algo ya enviado.
  useEffect(() => {
    const cerradas = new Set(
      // Una visita que administración cerró desde el panel también da por
      // cerrada el acta que este celular tenía en cola: ya no hay dónde
      // guardarla y el aviso quedaría pidiendo enviar algo que no se acepta.
      // Salvo la que cerró el otro técnico: esa acta es distinta de la de este
      // celular, y la que está en cola no se descarta en silencio.
      visitas
        .filter(
          (v) =>
            (v.estado === "COMPLETADA" && !(v.cerradaPorTecnicoId !== null && v.cerradaPorTecnicoId !== tecnicoId)) ||
            estaCancelada(v.estado)
        )
        .map((v) => v.folio)
    );
    // Las actas en cola del formato anterior (sin usuario) que corresponden a
    // las visitas de este técnico pasan a su nombre.
    migrarClavesViejas(
      uid,
      visitas.map((v) => v.folio)
    );
    const cola = actasEnCola(uid);
    for (const acta of cola) {
      if (cerradas.has(acta.folio)) sacarDeCola(uid, acta.folio);
    }
    setPendientes(cola.filter((a) => !cerradas.has(a.folio)));
  }, [visitas, uid, tecnicoId]);

  const filtradas = useMemo(() => (estado ? visitas.filter((v) => v.estado === estado) : visitas), [visitas, estado]);

  // Lo que falta por hacer y lo que ya pasó van por separado: lo primero se
  // mira todos los días; lo segundo es historial y se acota por período.
  /** Agrupa por día —solo salen los días que tienen visitas— y las tiendas de un mismo mall en un bloque. */
  const armar = useCallback((items: Visita[], ascendente: boolean) => {
    const porFecha = new Map<string, Visita[]>();
    for (const v of items) {
      // Con margen de días y sin cerrar, la visita se va corriendo a «Hoy».
      const dia = diaDeVisita(v, hoy);
      porFecha.set(dia, [...(porFecha.get(dia) ?? []), v]);
    }
    return [...porFecha.entries()]
      .sort((x, y) => (ascendente ? x[0].localeCompare(y[0]) : y[0].localeCompare(x[0])))
      .map(([fecha, delDia]) => {
        const ordenadas = [...delDia].sort((x, y) => (x.horaProgramada ?? "99:99").localeCompare(y.horaProgramada ?? "99:99"));
        return {
          fecha,
          titulo:
            fecha === hoy
              ? "Hoy"
              : new Date(`${fecha}T00:00:00`).toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "short" }),
          n: ordenadas.length,
          // Las tiendas del día en una línea: se sabe qué hubo sin abrir el día.
          resumen: [...new Set(ordenadas.map((v) => v.sucursal?.nombre).filter(Boolean))].join(" · "),
          bloques: enBloques(ordenadas),
        };
      });

    // Las tiendas de un mismo mall van juntas en un bloque desplegable, puesto
    // donde cae su primera visita del día; las demás quedan sueltas.
    function enBloques(items: Visita[]): { mall: Mall | null; visitas: Visita[] }[] {
      const bloques: { mall: Mall | null; visitas: Visita[] }[] = [];
      for (const v of items) {
        const mallId = ref.sucursales.find((x) => x.id === v.sucursalId)?.mallId;
        const mall = (mallId && ref.malls.find((m) => m.id === mallId)) || null;
        const bloque = mall ? bloques.find((x) => x.mall?.id === mall.id) : undefined;
        if (bloque) bloque.visitas.push(v);
        else bloques.push({ mall, visitas: [v] });
      }
      return bloques;
    }
  }, [hoy, ref.sucursales, ref.malls]);

  // Por hacer: lo atrasado y lo de hoy primero, después lo que viene.
  const porHacer = useMemo(
    () => armar(filtradas.filter((v) => PENDIENTES.includes(v.estado)), true),
    [filtradas, armar]
  );

  // Historial: solo los días en que hubo algo, del más reciente al más viejo y
  // dentro del período elegido.
  const historial = useMemo(
    () => {
      const hasta = periodo === "todo" ? null : sumarDias(hoy, periodo === "semana" ? -6 : -29);
      return armar(
        filtradas.filter((v) => !PENDIENTES.includes(v.estado) && (!hasta || diaDeVisita(v, hoy) >= hasta)),
        false
      );
    },
    [filtradas, hoy, periodo, armar]
  );

  // El único día de «Por hacer» que nace desplegado: hoy si tiene visitas y, si
  // no, el primero que las tenga. El historial nace plegado.
  const diaAbierto = useMemo(
    () => (porHacer.some((g) => g.fecha === hoy) ? hoy : (porHacer[0]?.fecha ?? null)),
    [porHacer, hoy]
  );

  const tarjeta = (v: Visita) => (
    <button
      key={v.id}
      onClick={() => router.push(`/tecnico/visitas/${v.folio}`)}
      className="block w-full min-w-0 text-left bg-[var(--color-surface)] border border-[var(--color-divider)] px-3.5 pt-3.5 pb-3 hover:bg-[rgba(31,28,33,.05)]"
      style={{ borderLeft: `4px solid ${ESTADO_VISITA_BARRA[v.estado]}` }}
    >
      <div className="flex items-baseline gap-2.5">
        <span className="font-extrabold text-h3 tabular-nums">{v.horaProgramada ?? "—"}</span>
        <span className="text-cap tabular-nums tracking-[.06em] opacity-62">{v.folio}</span>
        <Tag variant={ESTADO_VISITA_TAG[v.estado]} className="ml-auto">
          {ESTADO_VISITA_LABEL[v.estado]}
        </Tag>
      </div>
      <div className="font-extrabold text-lead leading-[1.2] mt-2.5 truncate">{v.sucursal?.nombre}</div>
      <div className="text-meta opacity-60 mt-0.5 truncate">{v.cliente?.nombreFantasia}</div>
      <div className="text-meta opacity-60 truncate">{v.sucursal?.direccion}</div>
      {/* Los datos de la visita en una línea de texto, cortada con "…": un
          motivo largo no agranda la tarjeta y nada se confunde con un botón. */}
      <div className="flex items-center gap-2 mt-2 min-w-0 text-meta">
        <span className="min-w-0 truncate">
          {[
            textoMotivos(v),
            v.fechaHasta ? `hasta el ${diaCorto(v.fechaHasta)}` : null,
            v.tecnicoId === tecnicoId && v.tecnicoAyudante ? `con ${v.tecnicoAyudante.nombreCompleto}` : null,
            v.responsableNombre ? `recibe ${v.responsableNombre}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
        {v.tecnicoId !== tecnicoId ? <span className="tag tag-dark flex-none">Ayudante</span> : null}
      </div>
    </button>
  );

  return (
    <div className="px-4 pt-5 pb-[26px] animate-fade-in">
      <h1 className="font-extrabold text-h1 leading-[1.06] tracking-[-.03em] m-0 mb-1">Mis visitas</h1>
      <p className="m-0 mb-3.5 text-meta opacity-66">asignadas a ti y en las que vas de ayudante</p>

      {/* Actas que se llenaron sin señal: hay que entrar a la visita para que se
          manden. Se avisa acá porque en la lista la visita se ve "en curso" y
          nada delataba que el acta ya estaba lista y guardada en el equipo. */}
      {pendientes.length > 0 ? (
        <div className="mb-4 px-3.5 py-3 bg-[var(--color-accent-200)] border border-[var(--color-accent-300)]">
          <div className="text-cap text-[var(--color-accent-800)]">
            {pendientes.length === 1 ? "Un acta espera señal" : `${pendientes.length} actas esperan señal`}
          </div>
          <div className="text-meta leading-[1.45] text-[var(--color-accent-800)] mt-1.5">
            Están completas y guardadas en este celular. Abre la visita y se manda sola; no hay que llenarla de nuevo.
          </div>
          <div className="flex flex-col gap-1.5 mt-2.5">
            {pendientes.map((a) => (
              <button
                key={a.folio}
                onClick={() =>
                  router.push(
                    // Si el otro técnico ya cerró la visita no hay formulario: el aviso está en su ficha.
                    visitas.find((v) => v.folio === a.folio)?.estado === "COMPLETADA"
                      ? `/tecnico/visitas/${a.folio}`
                      : `/tecnico/visitas/${a.folio}/formulario`
                  )
                }
                className="w-full min-h-[44px] flex items-center gap-2 px-3 bg-[var(--color-bg)] border border-[var(--color-accent)] text-[var(--color-accent-800)] font-extrabold text-meta cursor-pointer text-left"
              >
                <span className="tabular-nums">{a.folio}</span>
                <span className="font-normal opacity-70">
                  · cerrada {haceCuanto(a.capturadaEn)}
                  {visitas.find((v) => v.folio === a.folio)?.estado === "COMPLETADA" ? " · ya la cerró el otro técnico" : ""}
                </span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  className="ml-auto flex-none"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex gap-2 items-center mb-3.5">
        <button onClick={() => setFiltroAbierto((v) => !v)} className={`tag ${estado ? "tag-accent" : "tag-neutral"} min-h-[34px] border border-[var(--color-divider)] cursor-pointer gap-1.5 px-3 text-cap `}>
          <span>Filtrar por estado</span>
        </button>
        {estado ? (
          <button onClick={() => setEstado("")} className="tag tag-accent min-h-[34px] border-0 cursor-pointer gap-1.5 px-2.5 text-cap tracking-[.06em]">
            <span>{ESTADO_VISITA_LABEL[estado as EstadoVisita]}</span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        ) : null}
        {puede(ref, "celular.crearVisita") ? (
        <button
          onClick={() => setNueva(true)}
          aria-label="Agregar visita"
          className="ml-auto w-[34px] h-[34px] flex-none grid place-items-center bg-[var(--color-accent)] text-[var(--color-bg)] border-0 cursor-pointer hover:bg-[var(--color-accent-hover)]"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
        ) : null}
      </div>

      {filtroAbierto ? (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 mb-4.5">
          {ESTADOS.map((e) => (
            <button
              key={e}
              onClick={() => {
                setEstado(e);
                setFiltroAbierto(false);
              }}
              className={`tag ${estado === e ? "tag-accent" : "tag-neutral"} flex-none min-h-[34px] border border-[var(--color-divider)] cursor-pointer text-cap px-3`}
            >
              {ESTADO_VISITA_LABEL[e]}
            </button>
          ))}
        </div>
      ) : null}

      {(() => {
        const dia = (g: (typeof porHacer)[number], claveSeccion: string, abiertoPorDefecto: boolean) => {
          const clave = `${claveSeccion}-${g.fecha}`;
          const diaDesplegado = diasTocados[clave] ?? abiertoPorDefecto;
          return (
        <div key={clave} className={diaDesplegado ? "mb-6" : "mb-3"}>
          <button
            type="button"
            aria-expanded={diaDesplegado}
            onClick={() => setDiasTocados((prev) => ({ ...prev, [clave]: !diaDesplegado }))}
            className="w-full min-h-[44px] flex items-center gap-2 pb-2 pt-2 bg-transparent border-0 border-b-2 border-[var(--color-divider)] cursor-pointer text-[var(--color-text)] text-left"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-cap capitalize">{g.titulo}</span>
                <span className="text-cap tabular-nums opacity-60">
                  {g.n} {g.n === 1 ? "visita" : "visitas"}
                </span>
              </div>
              {!diaDesplegado && g.resumen ? <div className="text-meta opacity-60 truncate mt-0.5">{g.resumen}</div> : null}
            </div>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              className="ml-auto flex-none transition-transform"
              style={{ transform: `rotate(${diaDesplegado ? 180 : 0}deg)` }}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {diaDesplegado ? (
          <div className="flex flex-col gap-3 mt-3">
            {g.bloques.map((b) => {
              if (!b.mall) return tarjeta(b.visitas[0]);
              const claveMall = `${clave}-${b.mall.id}`;
              const abierto = abiertos.includes(claveMall);
              const porHacer = b.visitas.filter(
                (v) => v.estado === "PROGRAMADA" || v.estado === "EN_CURSO" || v.estado === "PENDIENTE"
              ).length;
              return (
                <div
                  key={claveMall}
                  className="border border-[var(--color-divider)] bg-[var(--color-surface)]"
                >
                  <button
                    type="button"
                    aria-expanded={abierto}
                    onClick={() => setAbiertos((prev) => (abierto ? prev.filter((k) => k !== claveMall) : [...prev, claveMall]))}
                    className="w-full min-h-[64px] flex items-center gap-3 px-3.5 py-3 bg-transparent border-0 cursor-pointer text-[var(--color-text)] text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-extrabold text-lead leading-[1.2] truncate">{b.mall.nombre}</div>
                      <div className="text-meta opacity-60 mt-0.5 truncate">
                        {[b.mall.direccion, b.mall.comuna].filter(Boolean).join(", ")}
                      </div>
                      <div className="text-cap opacity-66 mt-1.5 tabular-nums">
                        {b.visitas.length} {b.visitas.length === 1 ? "visita" : "visitas"}
                        {porHacer > 0 ? ` · ${porHacer} por hacer` : " · todas cerradas"}
                      </div>
                    </div>
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      className="flex-none transition-transform"
                      style={{ transform: `rotate(${abierto ? 180 : 0}deg)` }}
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  {abierto ? (
                    <div className="flex flex-col gap-2.5 px-2.5 pb-2.5 pt-2.5 border-t border-[var(--color-divider-soft)] bg-[var(--color-bg)]">
                      {b.visitas.map(tarjeta)}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          ) : null}
        </div>
          );
        };
        return (
          <>
            {porHacer.length > 0 ? (
              <>
                <h2 className="font-extrabold text-lead m-0 mb-2">Por hacer</h2>
                {porHacer.map((g) => dia(g, "p", g.fecha === diaAbierto))}
              </>
            ) : estado === "" ? (
              <div className="py-6 text-center text-ui opacity-62">No tienes visitas por hacer.</div>
            ) : null}

            <div className="flex items-baseline gap-2 mt-7 mb-2.5">
              <h2 className="font-extrabold text-lead m-0">Historial</h2>
              <span className="text-cap opacity-62">solo los días en que hubo visitas</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 mb-4">
              {(
                [
                  ["semana", "7 días"],
                  ["mes", "30 días"],
                  ["todo", "Todo"],
                ] as const
              ).map(([c, label]) => (
                <button
                  key={c}
                  onClick={() => {
                    setPeriodo(c);
                    setDiasVisibles(7);
                  }}
                  aria-pressed={periodo === c}
                  className="min-h-11 px-2.5 font-extrabold text-cap leading-none cursor-pointer"
                  style={{
                    background: periodo === c ? "var(--color-accent)" : "transparent",
                    color: periodo === c ? "#fff" : "var(--color-text)",
                    border: `1px solid ${periodo === c ? "var(--color-accent)" : "rgba(31,28,33,.35)"}`,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {historial.slice(0, diasVisibles).map((g) => dia(g, "h", false))}
            {historial.length > diasVisibles ? (
              <button
                onClick={() => setDiasVisibles((n) => n + 7)}
                className="w-full min-h-[48px] mb-4 bg-transparent border border-[var(--color-divider)] text-[var(--color-text)] font-extrabold text-ui cursor-pointer hover:bg-black/[.07]"
              >
                Ver más días ({historial.length - diasVisibles})
              </button>
            ) : null}
            {historial.length === 0 ? (
              <div className="py-6 text-center text-ui opacity-62">
                {estado ? "No hay visitas con ese estado." : "No hay visitas en este período."}
              </div>
            ) : null}
          </>
        );
      })()}

      {nueva ? <NuevaVisitaSheet hoy={hoy} tecnicoId={tecnicoId} onCerrar={() => setNueva(false)} onError={aviso} /> : null}
      <Toast texto={toast} />
    </div>
  );
}
