"use client";

import { useFiltroRecordado } from "@/lib/ui/filtro-recordado";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Icono from "@/components/ui/Icono";
import TarjetaVisita from "@/components/mobile/TarjetaVisita";
import NuevaVisitaSheet from "@/components/mobile/NuevaVisitaSheet";
import { Toast, useToast } from "@/components/ui/Toast";
import { ESTADO_VISITA_LABEL } from "@/lib/ui/estado";
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
    <TarjetaVisita
      key={v.id}
      visita={v}
      tecnicoId={tecnicoId}
      atrasada={v.estado === "PROGRAMADA" && diaDeVisita(v, hoy) < hoy}
    />
  );

  return (
    <div className="tp-main">
      <div>
        <h1 className="tp-h1">Mis visitas</h1>
        <p className="tp-sub">Asignadas a ti y en las que vas de ayudante</p>
      </div>

      {/* Actas que se llenaron sin señal: hay que entrar a la visita para que se
          manden. Se avisa acá porque en la lista la visita se ve "en curso" y
          nada delataba que el acta ya estaba lista y guardada en el equipo. */}
      {pendientes.length > 0 ? (
        <div className="tp-espera">
          <b>{pendientes.length === 1 ? "Un acta espera señal" : `${pendientes.length} actas esperan señal`}</b>
          <p>Están completas y guardadas en este celular. Abre la visita y se manda sola; no hay que llenarla de nuevo.</p>
          {pendientes.map((a) => (
            <button
              key={a.folio}
              type="button"
              className="btn-out"
              onClick={() =>
                router.push(
                  // Si el otro técnico ya cerró la visita no hay formulario: el aviso está en su ficha.
                  visitas.find((v) => v.folio === a.folio)?.estado === "COMPLETADA"
                    ? `/tecnico/visitas/${a.folio}`
                    : `/tecnico/visitas/${a.folio}/formulario`
                )
              }
            >
              <span>{a.folio}</span>
              <span>
                · cerrada {haceCuanto(a.capturadaEn)}
                {visitas.find((v) => v.folio === a.folio)?.estado === "COMPLETADA" ? " · ya la cerró el otro técnico" : ""}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="tp-tools">
        <div className="tp-chips" role="group" aria-label="Filtrar por estado">
          <button type="button" aria-pressed={estado === ""} onClick={() => setEstado("")}>
            Todas
          </button>
          {ESTADOS.filter((e) => e === estado || visitas.some((v) => v.estado === e)).map((e) => (
            <button key={e} type="button" aria-pressed={estado === e} onClick={() => setEstado(estado === e ? "" : e)}>
              {ESTADO_VISITA_LABEL[e]} <span>{visitas.filter((v) => v.estado === e).length}</span>
            </button>
          ))}
        </div>
        {puede(ref, "celular.crearVisita") ? (
          <button type="button" className="tp-add" onClick={() => setNueva(true)} aria-label="Agregar visita">
            <Icono nombre="mas" />
          </button>
        ) : null}
      </div>

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
            className="w-full min-h-[44px] flex items-center gap-2 pb-2 pt-2 bg-transparent border-0 border-b border-[var(--color-line)] cursor-pointer text-[var(--color-text)] text-left"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-cap capitalize">{g.titulo}</span>
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
                  className="border border-[var(--color-line)] rounded-[10px] bg-[var(--color-surface)]"
                >
                  <button
                    type="button"
                    aria-expanded={abierto}
                    onClick={() => setAbiertos((prev) => (abierto ? prev.filter((k) => k !== claveMall) : [...prev, claveMall]))}
                    className="w-full min-h-[64px] flex items-center gap-3 px-3.5 py-3 bg-transparent border-0 cursor-pointer text-[var(--color-text)] text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-lead leading-[1.2] truncate">{b.mall.nombre}</div>
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
                <h2 className="font-semibold text-lead m-0 mb-2">Por hacer</h2>
                {porHacer.map((g) => dia(g, "p", g.fecha === diaAbierto))}
              </>
            ) : estado === "" ? (
              <div className="py-6 text-center text-ui opacity-62">No tienes visitas por hacer.</div>
            ) : null}

            <div className="flex items-baseline gap-2 mt-7 mb-2.5">
              <h2 className="font-semibold text-lead m-0">Historial</h2>
              <span className="text-cap opacity-62">solo los días en que hubo visitas</span>
            </div>
            <div className="tp-seg mb-4">
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
                >
                  {label}
                </button>
              ))}
            </div>
            {historial.slice(0, diasVisibles).map((g) => dia(g, "h", false))}
            {historial.length > diasVisibles ? (
              <button
                onClick={() => setDiasVisibles((n) => n + 7)}
                className="w-full min-h-[48px] mb-4 bg-transparent border border-[var(--color-line)] rounded-[10px] text-[var(--color-text)] font-semibold text-ui cursor-pointer hover:bg-black/[.07]"
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
