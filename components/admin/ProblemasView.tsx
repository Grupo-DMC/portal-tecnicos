"use client";

// «Tiendas con problemas»: la franja de lo que sigue sin cerrar, las tiendas a
// la izquierda y, a la derecha, los problemas de la elegida con su antigüedad,
// su estado, los pasos de gestión y la bitácora.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { OrigenProblema } from "@/components/admin/VisitaDialogos";
import NuevaVisitaHoja, { precargaDeProblema } from "@/components/admin/NuevaVisitaHoja";
import Bitacora from "@/components/admin/problemas/Bitacora";
import CambiarProblema from "@/components/admin/problemas/CambiarProblema";
import Desplegable from "@/components/ui/Desplegable";
import Icono from "@/components/ui/Icono";
import PanelLateral from "@/components/ui/PanelLateral";
import { Toast, useToast } from "@/components/ui/Toast";
import { marcarGestionProblemaAction } from "@/app/actions/admin";
import { useFiltroRecordado } from "@/lib/ui/filtro-recordado";
import { ESTADO_VISITA_LABEL, etiquetaEstadoProblema } from "@/lib/ui/estado";
import { PILL_VISITA } from "@/lib/ui/lista-visitas";
import { fechaCL, fechaHoraLegible } from "@/lib/ui/fecha";
import { iniciales } from "@/lib/ui/cuenta";
import { plural } from "@/lib/ui/plural";
import { esDatoDePrueba } from "@/lib/ui/pruebas";
import { ocultarCredenciales } from "@/lib/ui/reservado";
import { puede, useReferencias } from "@/lib/ui/referencias";
import {
  abierto,
  claseEstado,
  filtrarProblemas,
  masAntiguo,
  resumenProblemas,
  SIN_FILTROS_PROBLEMAS,
  TRAMOS,
  tramoDe,
  type FiltrosProblemas,
} from "@/lib/ui/problemas-panel";
import type { DatosProblemas, GestionMarca, GrupoProblemas, ProblemaPanel } from "@/lib/contratos/panel";

const AVANCE: Record<string, string> = { SIN: "Sin empezar", PARCIAL: "A medias", LISTA: "Completa" };

const marcasIniciales = (grupos: GrupoProblemas[]): Record<number, GestionMarca[]> =>
  Object.fromEntries(grupos.flatMap((g) => g.items.map((p) => [p.id, p.gestion])));

export default function ProblemasView({ datos, tipoInicial = "" }: { datos: DatosProblemas; tipoInicial?: string }) {
  const router = useRouter();
  const ref = useReferencias();
  const { clientes, problemas: catalogo, estadosProblema } = ref;
  const { grupos, pasos, hoy } = datos;
  const nombreTipo = (codigo: string) => catalogo.find((t) => t.codigo === codigo)?.nombre ?? codigo;
  const nombreEstado = (codigo: string) => etiquetaEstadoProblema(codigo, estadosProblema);
  // Para elegir, solo los estados activos del Checklist; para nombrar, todos.
  const estados = estadosProblema.filter((e) => e.activo);
  const puedeEditar = puede(ref, "problemas.editar");

  const { toast, aviso } = useToast();
  const [busqueda, setBusqueda] = useFiltroRecordado("busqueda");
  const inicial = { ...SIN_FILTROS_PROBLEMAS, tipo: tipoInicial };
  const [f, setF] = useState<FiltrosProblemas>(inicial);
  const [borrador, setBorrador] = useState<FiltrosProblemas>(inicial);
  const [verFiltros, setVerFiltros] = useState(false);
  const [elegida, setElegida] = useState<number | null>(null);
  /** El problema que se acaba de pedir desde la franja: se destaca. */
  const [destacado, setDestacado] = useState<number | null>(null);
  const [agendar, setAgendar] = useState<OrigenProblema | null>(null);
  const [checklist, setChecklist] = useState(false);
  /** Lo marcado de los pasos, por id de problema. Se adelanta al servidor. */
  const [marcas, setMarcas] = useState(() => marcasIniciales(grupos));
  const [ocupados, setOcupados] = useState<string[]>([]);
  const lista = useRef<HTMLDivElement>(null);

  // Tras cada guardado el servidor manda la lista de nuevo, ya con quién marcó cada paso y cuándo.
  useEffect(() => setMarcas(marcasIniciales(grupos)), [grupos]);

  const resumen = useMemo(() => resumenProblemas(grupos, hoy), [grupos, hoy]);
  const filtradas = filtrarProblemas(grupos, f, busqueda, nombreTipo, (p) => (marcas[p.id] ?? []).length, pasos.length);
  const total = filtradas.reduce((n, g) => n + g.items.length, 0);
  const actual = filtradas.find((g) => g.sucursalId === elegida) ?? filtradas[0] ?? null;
  const original = actual ? (grupos.find((g) => g.sucursalId === actual.sucursalId) ?? actual) : null;

  useEffect(() => {
    if (destacado === null) return;
    document.getElementById(`problema-${destacado}`)?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    const espera = setTimeout(() => setDestacado(null), 1600);
    return () => clearTimeout(espera);
  }, [destacado]);

  /** Pone filtros desde la franja o el checklist y baja a la lista. */
  function filtrarPor(cambio: Partial<FiltrosProblemas>) {
    const nuevo = { ...SIN_FILTROS_PROBLEMAS, ...cambio };
    setF(nuevo);
    setBorrador(nuevo);
    requestAnimationFrame(() => lista.current?.scrollIntoView?.({ behavior: "smooth", block: "start" }));
  }

  function irATienda(sucursalId: number, problemaId?: number) {
    // Si los filtros la esconden, se quitan.
    const visible = filtradas.some((g) => g.sucursalId === sucursalId && (!problemaId || g.items.some((p) => p.id === problemaId)));
    if (!visible) {
      setF(SIN_FILTROS_PROBLEMAS);
      setBorrador(SIN_FILTROS_PROBLEMAS);
      setBusqueda("");
    }
    setElegida(sucursalId);
    if (problemaId) setDestacado(problemaId);
    else requestAnimationFrame(() => lista.current?.scrollIntoView?.({ behavior: "smooth", block: "start" }));
  }

  function limpiar() {
    setF(SIN_FILTROS_PROBLEMAS);
    setBorrador(SIN_FILTROS_PROBLEMAS);
    setBusqueda("");
  }

  async function alternarPaso(p: ProblemaPanel, codigo: string) {
    const clave = `${p.id}:${codigo}`;
    if (ocupados.includes(clave)) return;
    const estaba = (marcas[p.id] ?? []).some((m) => m.codigo === codigo);
    const poner = (marcado: boolean) =>
      setMarcas((prev) => {
        const sin = (prev[p.id] ?? []).filter((m) => m.codigo !== codigo);
        return { ...prev, [p.id]: marcado ? [...sin, { codigo, por: null, en: "" }] : sin };
      });
    setOcupados((prev) => [...prev, clave]);
    poner(!estaba);
    const res = await marcarGestionProblemaAction({ problemaId: p.id, codigo, marcado: !estaba });
    setOcupados((prev) => prev.filter((k) => k !== clave));
    if (!res.ok) {
      poner(estaba);
      return aviso(res.error ?? "No se pudo guardar la marca.");
    }
    router.refresh();
  }

  const chips: { clave: keyof FiltrosProblemas; texto: string }[] = [];
  if (f.clienteId) chips.push({ clave: "clienteId", texto: `Cliente: ${clientes.find((c) => String(c.id) === f.clienteId)?.nombreFantasia ?? ""}` });
  if (f.tipo) chips.push({ clave: "tipo", texto: `Falla: ${nombreTipo(f.tipo)}` });
  if (f.estado) chips.push({ clave: "estado", texto: `Estado: ${f.estado === "TODOS" ? "todos" : nombreEstado(f.estado)}` });
  if (f.tramo) chips.push({ clave: "tramo", texto: `Antigüedad: ${TRAMOS.find((t) => t.clave === f.tramo)?.label ?? f.tramo}` });
  if (f.agenda) chips.push({ clave: "agenda", texto: f.agenda === "SIN" ? "Sin visita agendada" : "Con visita agendada" });
  if (f.avance) chips.push({ clave: "avance", texto: `Gestión: ${AVANCE[f.avance].toLowerCase()}` });

  const selectores: { k: keyof FiltrosProblemas; label: string; opciones: [string, string][] }[] = [
    { k: "clienteId", label: "Cliente", opciones: [["", "Todos los clientes"], ...clientes.map((c): [string, string] => [String(c.id), c.nombreFantasia])] },
    { k: "tipo", label: "Tipo de falla", opciones: [["", "Todas las fallas"], ...catalogo.map((t): [string, string] => [t.codigo, t.nombre])] },
    {
      k: "estado",
      label: "Estado del problema",
      opciones: [["", "Sin cerrar (por defecto)"], ...estados.map((e): [string, string] => [e.codigo, e.nombre]), ["TODOS", "Todos, incluidos los resueltos"]],
    },
    { k: "tramo", label: "Antigüedad (sin cerrar)", opciones: [["", "Cualquier antigüedad"], ...TRAMOS.map((t): [string, string] => [t.clave, t.label])] },
    { k: "agenda", label: "Visita para resolverlo", opciones: [["", "Con o sin visita"], ["CON", "Con visita agendada"], ["SIN", "Sin visita agendada"]] },
    ...(pasos.length
      ? [{ k: "avance" as const, label: "Avance de la gestión", opciones: [["", "Cualquier avance"], ...Object.entries(AVANCE)] as [string, string][] }]
      : []),
  ];

  const delta = (ahora: number, antes: number, subirEsMalo: boolean) => (
    <>
      <span className={`pb-delta ${ahora === antes ? "" : ahora > antes === subirEsMalo ? "malo" : "bueno"}`}>
        {ahora > antes ? "+" : ""}
        {ahora - antes}
      </span>{" "}
      vs. 30 días anteriores
    </>
  );

  const abiertos = resumen.sinCerrar.length;
  const iniciales_ = resumen.sinCerrar.filter((p) => claseEstado(p.estado) === "open").length;

  return (
    <div className="dmc pagina">
      <div className="wrap pb">
        <header className="top">
          <div>
            <h1>Tiendas con problemas</h1>
            <p>
              {plural(abiertos, "problema sin cerrar", "problemas sin cerrar")} en {plural(resumen.tiendas, "tienda", "tiendas")}.
            </p>
          </div>
          <div className="v-actions">
            <button type="button" className="btn-out" onClick={() => setChecklist(true)}>
              <Icono nombre="checklist" />
              Checklist de gestión
            </button>
          </div>
        </header>

        {abiertos > 0 || resumen.totalResueltos > 0 ? (
          <section className="pb-hero" aria-labelledby="pb-franja">
            <div className="pb-hero-top">
              <div className="pb-hero-n">
                <h2 id="pb-franja">Sin cerrar</h2>
                <b>{abiertos}</b>
                <span>
                  {iniciales_} recién levantados, {abiertos - iniciales_} en gestión
                </span>
              </div>
              <div className="pb-hero-w">
                <p className="pb-hero-wl">
                  Cada cuadro es un problema, por días desde que se levantó. Toca uno para ir a su tienda, o un tramo para filtrar.
                </p>
                <div className="pb-waffle">
                  {resumen.tramos.map((t) => (
                    <div key={t.clave} className="pb-wf-g" style={{ flexGrow: Math.max(t.items.length, 1) }}>
                      <div className="pb-wf-cells">
                        {t.items.map((p) => {
                          const texto = `${p.grupo.cliente}, ${p.grupo.nombre}: ${nombreTipo(p.tipoCodigo)}, ${plural(p.dias, "día", "días")}`;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              className={`pb-cell edad-${t.i}`}
                              title={texto}
                              aria-label={texto}
                              onClick={() => irATienda(p.grupo.sucursalId, p.id)}
                            />
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        className="pb-wf-l"
                        aria-pressed={f.tramo === t.clave}
                        onClick={() => filtrarPor(f.tramo === t.clave ? {} : { tramo: t.clave })}
                      >
                        <i className={`edad-${t.i}`} aria-hidden="true" />
                        {t.label}
                        <b>{t.items.length}</b>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <dl className="pb-mets">
              <Metrica titulo="Levantados, 30 días" valor={resumen.levantados}>
                {delta(resumen.levantados, resumen.levantadosAntes, true)}
              </Metrica>
              <Metrica titulo="Resueltos, 30 días" valor={resumen.resueltos}>
                {delta(resumen.resueltos, resumen.resueltosAntes, false)}
              </Metrica>
              <Metrica
                titulo="Tiempo medio de resolución"
                valor={resumen.diasResolver === null ? "—" : resumen.diasResolver.toFixed(1).replace(".", ",")}
                unidad={resumen.diasResolver === null ? undefined : "días"}
              >
                {plural(resumen.totalResueltos, "resuelto", "resueltos")}
              </Metrica>
              <Metrica titulo="El más antiguo" valor={resumen.masViejo?.dias ?? "—"} unidad={resumen.masViejo ? "días" : undefined}>
                {resumen.masViejo ? (
                  <>
                    {resumen.masViejo.grupo.cliente}, {resumen.masViejo.grupo.nombre}.{" "}
                    <button type="button" className="enlace" onClick={() => irATienda(resumen.masViejo!.grupo.sucursalId, resumen.masViejo!.id)}>
                      Ver tienda
                    </button>
                  </>
                ) : (
                  "No queda ninguno abierto"
                )}
              </Metrica>
              <Metrica titulo="Sin visita agendada" valor={resumen.sinVisita} unidad={`de ${abiertos}`}>
                <button type="button" className="enlace" onClick={() => filtrarPor({ agenda: "SIN" })}>
                  Ver cuáles
                </button>
              </Metrica>
            </dl>
          </section>
        ) : null}

        <section className="v-card" aria-label="Búsqueda y filtros" ref={lista}>
          <div className="v-bar">
            <label className="v-search">
              <Icono nombre="buscar" />
              <span className="sr">Buscar tienda, cliente, folio o detalle</span>
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar tienda, cliente, folio, detalle…"
                autoComplete="off"
              />
            </label>
            <div className="v-tools">
              <span className="pb-count">
                {plural(total, "problema", "problemas")} en {plural(filtradas.length, "tienda", "tiendas")}
              </span>
              <button
                type="button"
                className={chips.length ? "v-fbtn on" : "v-fbtn"}
                aria-expanded={verFiltros}
                aria-label={chips.length ? `Filtros, ${plural(chips.length, "puesto", "puestos")}` : "Filtros"}
                onClick={() => {
                  setBorrador(f);
                  setVerFiltros((x) => !x);
                }}
              >
                <Icono nombre="filtros" />
                Filtros
                {chips.length ? <span className="v-fbadge">{chips.length}</span> : null}
              </button>
            </div>
          </div>
          {verFiltros ? (
            <form
              className="v-filters"
              onSubmit={(e) => {
                e.preventDefault();
                setF(borrador);
                setVerFiltros(false);
              }}
            >
              <div className="v-fgrid">
                {selectores.map((s) => (
                  <div className="fr" key={s.k}>
                    <label htmlFor={`fp-${s.k}`}>{s.label}</label>
                    <select id={`fp-${s.k}`} className="input" value={borrador[s.k]} onChange={(e) => setBorrador({ ...borrador, [s.k]: e.target.value })}>
                      {s.opciones.map(([v, t]) => (
                        <option key={v} value={v}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div className="v-fbtns">
                <button
                  type="button"
                  className="btn-out sm"
                  onClick={() => {
                    limpiar();
                    setVerFiltros(false);
                  }}
                >
                  Limpiar
                </button>
                <button type="submit" className="btn-pri sm">
                  Ver resultados
                </button>
              </div>
            </form>
          ) : null}
          {chips.length ? (
            <div className="v-active">
              {chips.map((c) => (
                <span className="fchip" key={c.clave}>
                  {c.texto}
                  <button
                    type="button"
                    aria-label={`Quitar ${c.texto}`}
                    onClick={() => {
                      setF({ ...f, [c.clave]: "" });
                      setBorrador({ ...f, [c.clave]: "" });
                    }}
                  >
                    ✕
                  </button>
                </span>
              ))}
              <button type="button" className="enlace" onClick={limpiar}>
                Quitar todos
              </button>
            </div>
          ) : null}
        </section>

        {pasos.length === 0 && puedeEditar ? (
          <p className="nota">
            Todavía no hay pasos de gestión. Agrégalos en Checklist, en la lista «Gestión de problemas», y aparecen en cada problema.
          </p>
        ) : null}

        {!actual || !original ? (
          <div className="pb-empty">
            <b>{grupos.length === 0 ? "Todavía no hay problemas" : "No hay problemas con esos filtros"}</b>
            <span>
              {grupos.length === 0
                ? "Cuando un técnico levante uno en terreno, aparece aquí."
                : "Quita algún filtro o cambia el estado a «Todos». Por defecto solo se ven los que siguen sin cerrar."}
            </span>
            {chips.length || busqueda ? (
              <button type="button" className="btn-out sm" onClick={limpiar}>
                Quitar filtros
              </button>
            ) : null}
          </div>
        ) : (
          <div className="pb-md">
            <nav className="pb-slist" aria-label="Tiendas con problemas">
              <p className="pb-sl-h">
                <span>Tienda</span>
                <span>Sin cerrar</span>
              </p>
              {filtradas.map((g) => (
                <button
                  key={g.sucursalId}
                  type="button"
                  className="pb-srow"
                  aria-pressed={g.sucursalId === actual.sucursalId}
                  onClick={() => setElegida(g.sucursalId)}
                >
                  <span className="pb-sn">
                    <b>{g.cliente}</b>
                    <span>{g.nombre}</span>
                  </span>
                  <span className="pb-sdots" aria-hidden="true">
                    {g.items.map((p) => (
                      <i key={p.id} className={abierto(p) ? `edad-${tramoDe(p.dias)}` : "edad-ok"} />
                    ))}
                  </span>
                  <span className="pb-sc">{g.abiertos}</span>
                </button>
              ))}
            </nav>

            <section className="pb-detail" aria-labelledby="pb-tienda">
              <header className="pb-dh">
                <div>
                  <p className="pb-dh-c">
                    {original.cliente}, {original.comuna}{" "}
                    {esDatoDePrueba(original.cliente, original.nombre) ? <span className="flag test">Prueba</span> : null}
                  </p>
                  <h2 id="pb-tienda">{original.nombre}</h2>
                </div>
                <Desplegable
                  key={original.sucursalId}
                  claseBoton="btn-out sm"
                  clasePanel="pb-hist"
                  boton={
                    <>
                      Historial del local, {plural(original.visitas.length, "visita", "visitas")}
                      <Icono nombre="abajo" />
                    </>
                  }
                >
                  {() => (
                    <ul>
                      {original.visitas.map((v) => (
                        <li key={v.folio}>
                          <Link href={`/admin/visitas/${v.folio}`}>
                            <span className={`pill ${PILL_VISITA[v.estado]}`}>{ESTADO_VISITA_LABEL[v.estado]}</span>
                            <b>{v.folio}</b>
                            <span>
                              {fechaCL(v.fecha)}. {[v.motivo, v.tecnico].filter(Boolean).join(", ")}
                              {v.trabajos ? `. Trabajo: ${v.trabajos}` : ""}
                              {v.observaciones ? `. ${ocultarCredenciales(v.observaciones)}` : ""}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Desplegable>
                <dl className="pb-dh-s">
                  <div>
                    <dt>Sin cerrar</dt>
                    <dd className={original.abiertos ? "red" : undefined}>{original.abiertos}</dd>
                  </div>
                  <div>
                    <dt>En total</dt>
                    <dd>{original.total}</dd>
                  </div>
                  <div>
                    <dt>El más antiguo</dt>
                    <dd>
                      {original.abiertos ? (
                        <>
                          {masAntiguo(original)} <small>días</small>
                        </>
                      ) : (
                        "—"
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Con visita</dt>
                    <dd>
                      {original.items.filter((p) => abierto(p) && p.agenda).length} <small>de {original.abiertos}</small>
                    </dd>
                  </div>
                </dl>
              </header>

              <ol className="pb-tickets">
                {actual.items.map((p) => {
                  const sinCerrar = abierto(p);
                  const hechas = marcas[p.id] ?? [];
                  return (
                    <li
                      key={p.id}
                      id={`problema-${p.id}`}
                      className={`pb-tk${sinCerrar ? "" : " st-resuelto"}${destacado === p.id ? " flash" : ""}`}
                    >
                      <div
                        className={`pb-age-b ${sinCerrar ? `edad-${tramoDe(p.dias)}` : "edad-ok"}`}
                        title={sinCerrar ? `Abierto hace ${plural(p.dias, "día", "días")}` : `Resuelto en ${plural(p.dias, "día", "días")}`}
                      >
                        {sinCerrar ? (
                          <>
                            <b>{p.dias}</b>
                            <span>{p.dias === 1 ? "día" : "días"}</span>
                          </>
                        ) : (
                          <>
                            <Icono nombre="listo" />
                            <span>{p.dias} d</span>
                          </>
                        )}
                      </div>
                      <div className="pb-tk-b">
                        <div className="pb-tk-top">
                          <h3>{nombreTipo(p.tipoCodigo)}</h3>
                          <span className={`pb-st ${claseEstado(p.estado)}`}>{nombreEstado(p.estado)}</span>
                          <Link className="pb-folio" href={`/admin/visitas/${p.visita.folio}`} title="Abrir el acta donde se levantó">
                            {p.visita.folio}
                          </Link>
                        </div>
                        {p.descripcion ? <blockquote className="pb-quote">{ocultarCredenciales(p.descripcion)}</blockquote> : null}
                        {p.solucion ? (
                          <p className="pb-solucion">
                            <b>{sinCerrar ? "Sugerencia:" : "Se realizó:"}</b> {ocultarCredenciales(p.solucion)}
                          </p>
                        ) : null}
                        <div className="pb-tk-meta">
                          <span className="pb-eq">
                            {p.items.map((it) => (
                              <span key={it.id}>
                                {it.etiqueta}
                                <b>{it.cantidad}</b>
                              </span>
                            ))}
                          </span>
                          <span className="pb-by">
                            <span className="mini-av" aria-hidden="true">
                              {iniciales(p.visita.tecnico)}
                            </span>
                            {p.visita.tecnico}, {fechaHoraLegible(p.creadoEn)}
                          </span>
                        </div>
                        {p.agenda ? (
                          <p className="pb-agenda">
                            <Icono nombre="visitas" />
                            <span>
                              Visita para resolverlo:{" "}
                              <Link href={`/admin/visitas/${p.agenda.folio}`}>{p.agenda.folio}</Link>, {fechaCL(p.agenda.fecha)},{" "}
                              {p.agenda.tecnico}
                            </span>
                            <span className={`pill ${PILL_VISITA[p.agenda.estado]}`}>{ESTADO_VISITA_LABEL[p.agenda.estado]}</span>
                          </p>
                        ) : null}
                        <div className="pb-tk-act">
                          {sinCerrar && puede(ref, "visitas.crear") ? (
                            <button
                              type="button"
                              className="pb-cta"
                              onClick={() =>
                                setAgendar({
                                  problemaId: p.id,
                                  folio: p.visita.folio,
                                  clienteId: actual.clienteId,
                                  sucursalId: actual.sucursalId,
                                  tipoCodigo: p.tipoCodigo,
                                  tipoNombre: nombreTipo(p.tipoCodigo),
                                  descripcion: p.descripcion,
                                  solucion: p.solucion,
                                  // La fila trae el nombre del técnico, no su id.
                                  tecnicoId: ref.tecnicos.find((t) => t.nombreCompleto === p.visita.tecnico)?.id ?? null,
                                })
                              }
                            >
                              <Icono nombre="visitas" />
                              {p.agenda ? "Agendar otra visita" : "Agendar visita"}
                            </button>
                          ) : (
                            <span className="pb-done">{sinCerrar ? "" : "Cerrado"}</span>
                          )}
                          <span className="pb-tools">
                            {pasos.length ? (
                              <Desplegable
                                claseBoton="pb-tool"
                                clasePanel="pb-pop"
                                boton={
                                  <>
                                    <Icono nombre="checklist" />
                                    Pasos{" "}
                                    <span>
                                      {hechas.length}/{pasos.length}
                                    </span>
                                  </>
                                }
                              >
                                {() => (
                                  <>
                                    <p className="pb-steps-h">Pasos de gestión</p>
                                    <ul className="pb-steps">
                                      {pasos.map((paso) => {
                                        const marca = hechas.find((m) => m.codigo === paso.codigo);
                                        return (
                                          <li key={paso.codigo}>
                                            <label title={marca?.en ? `${marca.por ?? "Sin autor"} · ${fechaHoraLegible(marca.en)}` : undefined}>
                                              <input
                                                type="checkbox"
                                                checked={Boolean(marca)}
                                                disabled={!puedeEditar || !sinCerrar || ocupados.includes(`${p.id}:${paso.codigo}`)}
                                                onChange={() => alternarPaso(p, paso.codigo)}
                                              />
                                              {paso.nombre}
                                            </label>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  </>
                                )}
                              </Desplegable>
                            ) : null}
                            <Desplegable
                              claseBoton="pb-tool"
                              clasePanel="pb-pop"
                              boton={
                                <>
                                  <Icono nombre="bitacora" />
                                  Bitácora <span>{p.cambios.length + hechas.filter((m) => m.en).length + (p.agenda ? 1 : 0) + 1}</span>
                                </>
                              }
                            >
                              {() => <Bitacora problema={p} marcas={hechas} pasos={pasos} nombreTipo={nombreTipo} nombreEstado={nombreEstado} />}
                            </Desplegable>
                            {/* También resuelto o con visita agendada: si hay que reabrirlo, se puede. */}
                            {puedeEditar ? (
                              <Desplegable
                                claseBoton="pb-tool"
                                clasePanel="pb-pop"
                                boton={
                                  <>
                                    <Icono nombre="editar" />
                                    Estado o tipo
                                  </>
                                }
                              >
                                {(cerrar) => (
                                  <CambiarProblema
                                    problema={p}
                                    visitas={actual.visitas}
                                    estados={estados}
                                    onAviso={aviso}
                                    onHecho={() => {
                                      cerrar();
                                      router.refresh();
                                    }}
                                  />
                                )}
                              </Desplegable>
                            ) : null}
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          </div>
        )}
      </div>

      {checklist ? (
        <PanelLateral
          titulo="Checklist de gestión"
          onCerrar={() => setChecklist(false)}
        >
          <ul className="pb-check">
            {[
              { t: "Agendar visita a los que no tienen", n: resumen.sinVisita, f: { agenda: "SIN" } },
              { t: "Revisar los de más de 60 días", n: resumen.tramos[4].items.length, f: { tramo: "60+" } },
              ...estados
                .filter((e) => claseEstado(e.codigo) === "warn")
                .map((e) => ({ t: `Seguir los que están en «${e.nombre}»`, n: resumen.sinCerrar.filter((p) => p.estado === e.codigo).length, f: { estado: e.codigo } })),
              ...catalogo
                .filter((t) => /^otro/i.test(t.nombre))
                .map((t) => ({ t: `Clasificar los «${t.nombre}»`, n: resumen.sinCerrar.filter((p) => p.tipoCodigo === t.codigo).length, f: { tipo: t.codigo } })),
            ].map((x) => (
              <li key={x.t}>
                <span>
                  <b>{x.t}</b>
                  <small>{plural(x.n, "problema", "problemas")}</small>
                </span>
                <button
                  type="button"
                  className="btn-out sm"
                  disabled={x.n === 0}
                  onClick={() => {
                    setChecklist(false);
                    filtrarPor(x.f);
                  }}
                >
                  Ver
                </button>
              </li>
            ))}
          </ul>
          {puede(ref, "checklist.ver") ? (
            <Link href="/admin/checklist" className="enlace">
              Editar los pasos en Checklist
            </Link>
          ) : null}
        </PanelLateral>
      ) : null}

      {agendar ? (
        <NuevaVisitaHoja
          precarga={precargaDeProblema(agendar, ref.motivos, agendar.tecnicoId)}
          onCerrar={() => setAgendar(null)}
          onAviso={aviso}
          onHecho={(m) => {
            aviso(m);
            router.refresh();
          }}
        />
      ) : null}

      <Toast texto={toast} variante="panel" />
    </div>
  );
}

function Metrica({ titulo, valor, unidad, children }: { titulo: string; valor: number | string; unidad?: string; children: React.ReactNode }) {
  return (
    <div className="pb-m">
      <dt>{titulo}</dt>
      <dd>
        <b>{valor}</b>
        {unidad ? <small>{unidad}</small> : null}
      </dd>
      <dd className="pb-m-n">{children}</dd>
    </div>
  );
}
