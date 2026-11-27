"use client";

import DatePicker from "@/components/ui/DatePicker";
import Espera from "@/components/ui/Espera";
import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { FormValores } from "@/components/admin/Dialogo";
import { usePathname, useRouter } from "next/navigation";
import { recordarUrlVisitas } from "@/lib/ui/filtro-recordado";
import Icono from "@/components/ui/Icono";
import SelectMultiple from "@/components/ui/SelectMultiple";
import NuevaVisitaHoja from "@/components/admin/NuevaVisitaHoja";
import VisitasMasivasDialogo from "@/components/admin/VisitasMasivasDialogo";
import VisitasLoteDialogo, { type AccionLote } from "@/components/admin/VisitasLoteDialogo";
import { Toast, useToast } from "@/components/ui/Toast";
import { ESTADO_VISITA_LABEL, textoMotivos } from "@/lib/ui/estado";
import { dmyAIso, fechaCL, hoyISO, isoADmy } from "@/lib/ui/fecha";
import { diaDeLista, llegada, PILL_VISITA } from "@/lib/ui/lista-visitas";
import { iniciales } from "@/lib/ui/cuenta";
import { plural } from "@/lib/ui/plural";
import { esDatoDePrueba } from "@/lib/ui/pruebas";
import {
  ELIMINADAS,
  LIMITES,
  SIN_FILTROS,
  urlFiltrosVisitas,
  type FiltrosVisitas,
  type OpcionesFiltroVisitas,
  type PaginaVisitas,
} from "@/lib/ui/filtros-visitas";
import { nombreArchivoActa, nombreZipActas } from "@/lib/ui/nombre-acta";
import { armarZip } from "@/lib/ui/zip";
import { NOMBRE_CONSTANCIA, armarArchivosZip, reunirActas } from "@/lib/ui/zip-actas";
import { puede, useReferencias } from "@/lib/ui/referencias";
import type { Visita, EstadoVisita } from "@/lib/types";

/**
 * La lista de Visitas del panel. Filtrar y paginar lo hace el servidor: los
 * filtros viven en la URL y cambiarlos es navegar (ver lib/ui/filtros-visitas).
 */
export default function VisitasTable({
  title,
  filtros: f,
  pagina,
  opciones,
  eliminadas,
  /** Reagendas y pendientes: siempre muestra la columna con el motivo del técnico. */
  conMotivoTecnico = false,
  /** La vista de reagendas no crea visitas nuevas. */
  permiteCrear = true,
}: {
  title: string;
  /** Los filtros de la URL, ya validados por el servidor. */
  filtros: FiltrosVisitas;
  pagina: PaginaVisitas;
  opciones: OpcionesFiltroVisitas;
  /** Cuántas eliminadas hay. Solo le llega al administrador; para el resto, undefined. */
  eliminadas?: number;
  conMotivoTecnico?: boolean;
  permiteCrear?: boolean;
}) {
  const router = useRouter();
  const pantalla = usePathname();
  const ref = useReferencias();
  const { tecnicos } = ref;
  const { toast, aviso } = useToast();
  const [cargando, iniciar] = useTransition();
  const visitas = pagina.visitas;

  /** Cambia filtros: es navegar a la URL nueva. Cualquier cambio vuelve a la primera página. */
  function ir(cambios: Partial<FiltrosVisitas>) {
    const destino = urlFiltrosVisitas({ ...f, pagina: 1, ...cambios });
    iniciar(() => router.replace(destino, { scroll: false }));
  }
  const setF = (fn: (p: FiltrosVisitas) => Partial<FiltrosVisitas>) => ir(fn(f));

  // La búsqueda se escribe aquí y viaja a la URL cuando se deja de teclear.
  const [busqueda, setBusqueda] = useState(f.q);
  useEffect(() => {
    if (busqueda.trim() === f.q) return;
    const espera = setTimeout(() => {
      iniciar(() => router.replace(urlFiltrosVisitas({ ...f, q: busqueda, pagina: 1 }), { scroll: false }));
    }, 350);
    return () => clearTimeout(espera);
  }, [busqueda, f, router]);

  // Con el acta abierta, «Visitas» vuelve a esta misma lista con sus filtros.
  const urlActual = urlFiltrosVisitas(f);
  useEffect(() => {
    if (pantalla === "/admin/visitas") recordarUrlVisitas(urlActual);
  }, [pantalla, urlActual]);

  const [nueva, setNueva] = useState(false);
  // Con `porMall` el diálogo de la ruta abre eligiendo tiendas de un mall, y
  // con `inicial` trae lo que ya se había escrito en "Nueva visita".
  const [masivas, setMasivas] = useState<{ porMall: boolean; inicial?: FormValores } | null>(null);
  // "Acciones múltiples": con el modo prendido, el clic en una fila la marca en
  // vez de abrir su acta. Lo marcado se guarda entero y sobrevive a los
  // filtros y a las páginas, para poder juntar visitas de varias búsquedas.
  const [seleccionando, setSeleccionando] = useState(false);
  const [marcadas, setMarcadas] = useState<Visita[]>([]);
  const [lote, setLote] = useState<AccionLote | null>(null);
  const [verFiltros, setVerFiltros] = useState(false);
  const [fechas, setFechas] = useState({ desde: f.desde, hasta: f.hasta });
  useEffect(() => {
    setFechas({ desde: f.desde, hasta: f.hasta });
  }, [f.desde, f.hasta]);
  /** La recién creada se destaca un momento en la lista. */
  const [nuevaFolio, setNuevaFolio] = useState<string | null>(null);

  // «/» lleva a la búsqueda, salvo que ya se esté escribiendo en otra parte.
  const cajaBusqueda = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      const en = e.target as HTMLElement;
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      if (en.closest("input, textarea, select, [contenteditable=true], [role=dialog]")) return;
      e.preventDefault();
      cajaBusqueda.current?.focus();
    };
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, []);

  // El permiso abre la selección; cada acción pide además el suyo.
  const accionesLote: { accion: AccionLote; label: string }[] = puede(ref, "visitas.masivo")
    ? [
        ...(puede(ref, "visitas.editar") ? [{ accion: "modificar" as const, label: "Editar o reagendar" }] : []),
        ...(puede(ref, "visitas.cancelar") ? [{ accion: "cancelar" as const, label: "Cancelar por admin" }] : []),
        ...(puede(ref, "visitas.eliminar") ? [{ accion: "eliminar" as const, label: "Eliminar" }] : []),
      ]
    : [];
  // Las eliminadas solo se miran: sobre ellas no hay nada que marcar.
  const verEliminadas = f.estados.includes(ELIMINADAS);
  const conCasillas = seleccionando && !verEliminadas;
  const esMarcada = (folio: string) => marcadas.some((m) => m.folio === folio);
  // Las de la página a la vista van con lo que acaba de traer el servidor.
  const seleccionadas = useMemo(
    () => marcadas.map((m) => visitas.find((v) => v.folio === m.folio) ?? m),
    [visitas, marcadas]
  );

  // Solo las actas cerradas tienen PDF.
  const cerradasMarcadas = seleccionadas.filter((v) => v.estado === "COMPLETADA");
  const [descargando, setDescargando] = useState(false);

  /** Baja el PDF de cada acta cerrada; si son varias, las junta en un .zip. */
  async function descargarActas() {
    if (cerradasMarcadas.length === 0) {
      aviso("Ninguna de las visitas marcadas tiene el acta cerrada.");
      return;
    }
    setDescargando(true);
    try {
      const { actas, fallidas, incidencias } = await reunirActas(cerradasMarcadas);
      if (actas.length === 0) {
        aviso("No se pudo descargar ninguna acta.");
        return;
      }
      // Una sola acta sin fotos ni videos baja como PDF suelto; el resto, en un .zip con una carpeta por local.
      const unica = actas.length === 1 && actas[0].medios.length === 0 && incidencias.length === 0;
      const blob = unica
        ? new Blob([actas[0].pdf as BlobPart], { type: "application/pdf" })
        : armarZip(armarArchivosZip(actas, incidencias));
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = unica ? nombreArchivoActa(actas[0].visita) : nombreZipActas(actas.map((x) => x.visita));
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      const omitidas = seleccionadas.length - cerradasMarcadas.length;
      const notas = [
        omitidas ? `${omitidas} sin acta cerrada` : "",
        fallidas.length ? `no se pudo: ${fallidas.join(", ")}` : "",
        incidencias.length ? `${incidencias.length} archivo${incidencias.length === 1 ? "" : "s"} sin incluir, ver ${NOMBRE_CONSTANCIA}` : "",
      ].filter(Boolean);
      aviso(`${actas.length} ${unica ? "acta descargada" : "actas descargadas"}${notas.length ? ` (${notas.join("; ")})` : ""}.`);
    } finally {
      setDescargando(false);
    }
  }

  function alternar(v: Visita) {
    setMarcadas((prev) => (prev.some((m) => m.folio === v.folio) ? prev.filter((m) => m.folio !== v.folio) : [...prev, v]));
  }

  function salirDeSeleccion() {
    setSeleccionando(false);
    setMarcadas([]);
  }

  const { regiones, malls, clientes, marcas, tiendas } = opciones;

  const todasMarcadas = visitas.length > 0 && visitas.every((v) => esMarcada(v.folio));

  /** La casilla del encabezado: marca o desmarca lo que se está viendo. */
  function alternarVisibles() {
    const visibles = new Set(visitas.map((v) => v.folio));
    setMarcadas((prev) =>
      todasMarcadas
        ? prev.filter((m) => !visibles.has(m.folio))
        : [...prev, ...visitas.filter((v) => !prev.some((m) => m.folio === v.folio))]
    );
  }

  const mostrarMotivo = conMotivoTecnico || f.estados.includes("REAGENDADA") || f.estados.includes("PENDIENTE");
  const sinEste = (lista: string[], v: string) => lista.filter((x) => x !== v);

  // Las pestañas son el filtro de estado. Si la URL trae una mezcla que no es
  // ninguna pestaña, cada estado aparece como filtro puesto, para poder quitarlo.
  const porEstado = pagina.porEstado;
  const cuantas = (estados: EstadoVisita[]) => estados.reduce((n, e) => n + (porEstado?.[e] ?? 0), 0);
  const todas = Object.values(porEstado ?? {}).reduce((n, x) => n + x, 0);
  const mismos = (a: readonly string[]) => a.length === f.estados.length && a.every((e) => f.estados.includes(e));
  const pestanas = [
    { id: "todas", label: "Todas", estados: [] as string[], n: porEstado ? todas : undefined },
    ...PESTANAS.filter((p) => !p.siHay || cuantas(p.estados) > 0 || mismos(p.estados)).map((p) => ({
      id: p.id,
      label: p.label,
      estados: p.estados as string[],
      n: porEstado ? cuantas(p.estados) : undefined,
    })),
    ...(eliminadas !== undefined ? [{ id: "eliminadas", label: "Eliminadas", estados: [ELIMINADAS], n: eliminadas }] : []),
  ];
  const pestana = pestanas.find((p) => mismos(p.estados));

  const chips: { label: string; quitar: () => void }[] = [];
  if (!pestana) {
    for (const e of f.estados) {
      chips.push({
        label: e === ELIMINADAS ? "Eliminadas" : `Estado: ${ESTADO_VISITA_LABEL[e as EstadoVisita]}`,
        quitar: () => setF((p) => ({ estados: sinEste(p.estados, e) })),
      });
    }
  }
  // Lo elegido más abajo en la cadena que deje de caber lo descarta el servidor.
  for (const r of f.regiones) {
    chips.push({ label: `Zona: ${r}`, quitar: () => setF((p) => ({ regiones: sinEste(p.regiones, r) })) });
  }
  for (const mid of f.mallIds) {
    const m = malls.find(([id]) => String(id) === mid);
    chips.push({ label: `Mall: ${m?.[1] ?? ""}`, quitar: () => setF((p) => ({ mallIds: sinEste(p.mallIds, mid) })) });
  }
  for (const cid of f.clienteIds) {
    const c = clientes.find(([id]) => String(id) === cid);
    chips.push({ label: `Cliente: ${c?.[1] ?? ""}`, quitar: () => setF((p) => ({ clienteIds: sinEste(p.clienteIds, cid) })) });
  }
  for (const mid of f.marcaIds) {
    const m = marcas.find(([id]) => String(id) === mid);
    chips.push({ label: `Marca: ${m?.[1] ?? ""}`, quitar: () => setF((p) => ({ marcaIds: sinEste(p.marcaIds, mid) })) });
  }
  for (const sid of f.sucursalIds) {
    const t = tiendas.find(([id]) => String(id) === sid);
    chips.push({ label: `Tienda: ${t?.[1] ?? ""}`, quitar: () => setF((p) => ({ sucursalIds: sinEste(p.sucursalIds, sid) })) });
  }
  if (f.desde) chips.push({ label: `Desde: ${fechaCL(f.desde)}`, quitar: () => setF(() => ({ desde: "" })) });
  if (f.hasta) chips.push({ label: `Hasta: ${fechaCL(f.hasta)}`, quitar: () => setF(() => ({ hasta: "" })) });
  for (const tid of f.tecnicoIds) {
    const t = tecnicos.find((x) => String(x.id) === tid);
    chips.push({ label: `Técnico: ${t?.nombreCompleto ?? ""}`, quitar: () => setF((p) => ({ tecnicoIds: sinEste(p.tecnicoIds, tid) })) });
  }
  const acotada = chips.length > 0 || Boolean(f.q);

  // Limpiar filtros no toca cuántas visitas se ven por página.
  function limpiar() {
    setBusqueda("");
    setFechas({ desde: "", hasta: "" });
    ir({ ...SIN_FILTROS, limite: f.limite });
  }

  // Las fechas se escriben y viajan juntas con «Ver resultados».
  function verResultados(e: React.FormEvent) {
    e.preventDefault();
    if (fechas.desde && fechas.hasta && fechas.desde > fechas.hasta) return;
    if (fechas.desde !== f.desde || fechas.hasta !== f.hasta) ir(fechas);
    setVerFiltros(false);
  }

  const selectores = [
    { id: "fv-region", label: "Zona", vacio: "Todas las zonas", valores: f.regiones, opciones: regiones.map((r) => ({ v: r, t: r })), campo: "regiones" },
    { id: "fv-mall", label: "Mall", vacio: "Todos los malls", valores: f.mallIds, opciones: malls.map(([id, n]) => ({ v: String(id), t: n })), campo: "mallIds" },
    { id: "fv-cliente", label: "Cliente", vacio: "Todos los clientes", valores: f.clienteIds, opciones: clientes.map(([id, n]) => ({ v: String(id), t: n })), campo: "clienteIds" },
    ...(f.clienteIds.length
      ? [
          { id: "fv-marca", label: "Marca", vacio: "Todas las marcas", valores: f.marcaIds, opciones: marcas.map(([id, n]) => ({ v: String(id), t: n })), campo: "marcaIds" },
          { id: "fv-tienda", label: "Sucursal", vacio: "Todas las sucursales", valores: f.sucursalIds, opciones: tiendas.map(([id, n]) => ({ v: String(id), t: n })), campo: "sucursalIds" },
        ]
      : []),
    { id: "fv-tecnico", label: "Técnico", vacio: "Todos los técnicos", valores: f.tecnicoIds, opciones: tecnicos.map((t) => ({ v: String(t.id), t: t.nombreCompleto })), campo: "tecnicoIds" },
  ];

  const hoy = hoyISO();
  const columnas = 6 + (conCasillas ? 1 : 0) + (mostrarMotivo ? 1 : 0);
  const primera = pagina.total === 0 ? 0 : (pagina.pagina - 1) * f.limite + 1;
  const ultima = primera === 0 ? 0 : primera + visitas.length - 1;
  const irAPagina = (n: number) => {
    ir({ pagina: n });
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="dmc pagina">
      <div className="wrap">
        <header className="top">
          <div>
            <h1>{title}</h1>
            <p>
              {porEstado
                ? acotada
                  ? `${plural(todas, "visita", "visitas")} con estos filtros`
                  : plural(todas, "visita registrada", "visitas registradas")
                : null}
            </p>
          </div>
          <div className="v-actions">
            {accionesLote.length ? (
              <button
                type="button"
                className="btn-out"
                aria-pressed={seleccionando}
                onClick={() => (seleccionando ? salirDeSeleccion() : setSeleccionando(true))}
              >
                <Icono nombre="multiple" />
                {seleccionando ? "Salir de acciones múltiples" : "Acciones múltiples"}
              </button>
            ) : null}
            {permiteCrear && puede(ref, "visitas.crear") ? (
              <>
                <button type="button" className="btn-out" onClick={() => setMasivas({ porMall: false })}>
                  <Icono nombre="lista" />
                  Visitas masivas
                </button>
                <button type="button" className="btn-pri" onClick={() => setNueva(true)}>
                  <Icono nombre="mas" />
                  Nueva visita
                </button>
              </>
            ) : null}
          </div>
        </header>

        <section className="v-card" aria-label="Listado de visitas">
          <div className="v-bar">
            <div className="v-tabs" role="tablist" aria-label="Estado de la visita">
              {pestanas.map((p) => (
                <button key={p.id} type="button" role="tab" aria-selected={pestana?.id === p.id} onClick={() => ir({ estados: p.estados })}>
                  {p.label}{" "}
                  {p.n !== undefined ? <span>{p.n.toLocaleString("es-CL")}</span> : null}
                </button>
              ))}
            </div>
            <div className="v-tools">
              <label className="v-search">
                <Icono nombre="buscar" />
                <span className="sr">Buscar folio, cliente, sucursal o técnico</span>
                <input
                  ref={cajaBusqueda}
                  type="search"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar folio, cliente, sucursal o técnico"
                  autoComplete="off"
                  spellCheck={false}
                />
                <kbd aria-hidden="true">/</kbd>
              </label>
              <button
                type="button"
                className={chips.length ? "v-fbtn on" : "v-fbtn"}
                aria-expanded={verFiltros}
                aria-controls="vi-filtros"
                aria-label={chips.length ? `Filtros, ${plural(chips.length, "puesto", "puestos")}` : "Filtros"}
                onClick={() => setVerFiltros((x) => !x)}
              >
                <Icono nombre="filtros" />
                Filtros
                {chips.length ? <span className="v-fbadge">{chips.length}</span> : null}
              </button>
            </div>
          </div>

          {verFiltros ? (
            <form className="v-filters" id="vi-filtros" onSubmit={verResultados} noValidate>
              <div className="v-fgrid">
                {selectores.map((c) => (
                  <div className="fr" key={c.id}>
                    <label htmlFor={c.id}>{c.label}</label>
                    <SelectMultiple
                      id={c.id}
                      valores={c.valores}
                      opciones={c.opciones}
                      onChange={(v) => ir({ [c.campo]: v })}
                      textoVacio={c.vacio}
                      ariaLabel={c.label}
                    />
                  </div>
                ))}
                <div className="fr">
                  <label htmlFor="fv-periodo">Período</label>
                  {/* Visitas tiene programadas hacia adelante: aquí los días futuros sí se eligen. */}
                  <DatePicker
                    modo="range"
                    id="fv-periodo"
                    desde={isoADmy(fechas.desde)}
                    hasta={isoADmy(fechas.hasta)}
                    maximo={null}
                    onChange={(d, h) => setFechas({ desde: dmyAIso(d), hasta: dmyAIso(h) })}
                  />
                </div>
              </div>
              <div className="v-fbtns">
                <button type="button" className="btn-out sm" onClick={limpiar}>
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
                <span className="fchip" key={c.label}>
                  {c.label}
                  <button type="button" onClick={c.quitar} aria-label={`Quitar ${c.label}`}>
                    ✕
                  </button>
                </span>
              ))}
              <button type="button" className="enlace" onClick={limpiar}>
                Quitar todos
              </button>
            </div>
          ) : null}

          {conCasillas ? (
            <div className="v-bulk">
              <div className="v-bulk-ops">
                <span className="v-bulk-n" aria-live="polite">
                  {marcadas.length === 0
                    ? "Marca las visitas en la tabla"
                    : plural(seleccionadas.length, "visita marcada", "visitas marcadas")}
                </span>
                {marcadas.length > 0 ? (
                  <button type="button" className="enlace" onClick={() => setMarcadas([])}>
                    Desmarcar todas
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn-out sm"
                  disabled={cerradasMarcadas.length === 0 || descargando}
                  onClick={descargarActas}
                  title={cerradasMarcadas.length === 0 ? "Solo las visitas con el acta cerrada tienen PDF" : undefined}
                >
                  <Icono nombre="descargar" />
                  <Espera activo={descargando} accion="Descargando">{`Descargar actas${cerradasMarcadas.length ? ` (${cerradasMarcadas.length})` : ""}`}</Espera>
                </button>
                {accionesLote.map((a) => (
                  <button
                    key={a.accion}
                    type="button"
                    disabled={seleccionadas.length === 0}
                    onClick={() => setLote(a.accion)}
                    className={`${a.accion === "modificar" ? "btn-pri" : "btn-danger"} sm`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className={cargando ? "v-table-wrap cargando" : "v-table-wrap"} aria-busy={cargando}>
            <table className="vt">
              <thead>
                <tr>
                  {conCasillas ? (
                    <th scope="col" className="c-sel">
                      <input
                        type="checkbox"
                        checked={todasMarcadas}
                        onChange={alternarVisibles}
                        aria-label={todasMarcadas ? "Desmarcar las que se ven" : "Marcar todas las que se ven"}
                      />
                    </th>
                  ) : null}
                  <th scope="col">Visita</th>
                  <th scope="col">Cliente y sucursal</th>
                  <th scope="col">Técnico</th>
                  <th scope="col">Llegada</th>
                  <th scope="col">Estado</th>
                  {mostrarMotivo ? <th scope="col">Motivo del técnico</th> : null}
                  <th scope="col">
                    <span className="sr">Abrir</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visitas.map((v, i) => {
                  const cliente =
                    v.marca && v.marca.nombre !== v.cliente?.nombreFantasia
                      ? `${v.cliente?.nombreFantasia ?? ""} · ${v.marca.nombre}`
                      : v.cliente?.nombreFantasia;
                  const motivos = v.motivosNombres ?? [];
                  const hora = llegada(v);
                  const cuantasDelDia = pagina.porDia?.[v.fechaProgramada];
                  return (
                    <Fragment key={v.id}>
                      {i === 0 || visitas[i - 1].fechaProgramada !== v.fechaProgramada ? (
                        <tr className="v-day">
                          <th colSpan={columnas} scope="rowgroup">
                            <span>{diaDeLista(v.fechaProgramada, hoy)}</span>
                            {cuantasDelDia ? <span>{plural(cuantasDelDia, "visita", "visitas")}</span> : null}
                          </th>
                        </tr>
                      ) : null}
                      <tr
                        className={`v-row${conCasillas && esMarcada(v.folio) ? " is-sel" : ""}${nuevaFolio === v.folio ? " new-row" : ""}`}
                        onClick={() => (conCasillas ? alternar(v) : router.push(`/admin/visitas/${v.folio}`))}
                      >
                        {conCasillas ? (
                          <td className="c-sel">
                            <input
                              type="checkbox"
                              checked={esMarcada(v.folio)}
                              onClick={(e) => e.stopPropagation()}
                              onChange={() => alternar(v)}
                              aria-label={`Marcar ${v.folio}`}
                            />
                          </td>
                        ) : null}
                        <td className="c-vis">
                          <span className="folio">{v.folio}</span>
                          <span className="sub" title={textoMotivos(v)}>
                            <span>{motivos[0] ?? textoMotivos(v)}</span>
                            {motivos.length > 1 ? <b> +{motivos.length - 1}</b> : null}
                          </span>
                        </td>
                        <td className="c-cli">
                          <span className="cli" title={cliente}>
                            {cliente}
                          </span>
                          <span className="sub" title={v.sucursal?.nombre}>
                            {v.sucursal?.nombre}
                          </span>
                          {esDatoDePrueba(v.cliente?.nombreFantasia, v.sucursal?.nombre) ? <span className="flag test">Prueba</span> : null}
                        </td>
                        <td className="c-tec">
                          <span className="mini-av" aria-hidden="true">
                            {iniciales(v.tecnico?.nombreCompleto ?? "")}
                          </span>
                          <span>
                            <span>{v.tecnico?.nombreCompleto}</span>
                            {v.tecnicoAyudante ? <span className="sub">+ {v.tecnicoAyudante.nombreCompleto}</span> : null}
                          </span>
                        </td>
                        <td className={hora.fija ? "c-hora" : "c-hora suave"}>{hora.texto}</td>
                        <td className="c-est">
                          {v.eliminacion ? (
                            <span className="pill off">Eliminada</span>
                          ) : (
                            <span className={`pill ${PILL_VISITA[v.estado]}`}>{ESTADO_VISITA_LABEL[v.estado]}</span>
                          )}
                          {/* El acta se corrigió después de cerrarla: qué parte y por qué, al pasar el mouse y en el acta. */}
                          {v.ediciones?.length ? (
                            <span
                              className="flag test editada"
                              title={`Editada · ${v.ediciones[0].secciones.join(", ")} · ${v.ediciones[0].motivo}`}
                            >
                              Editada
                            </span>
                          ) : null}
                        </td>
                        {mostrarMotivo ? (
                          <td className="c-motivo">{v.motivoPendiente ?? v.reagendamientos?.[0]?.motivo ?? "Sin motivo registrado"}</td>
                        ) : null}
                        <td className="c-go">
                          <button
                            type="button"
                            aria-label={`Ver acta ${v.folio}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/admin/visitas/${v.folio}`);
                            }}
                          >
                            <Icono nombre="adelante" />
                          </button>
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {visitas.length === 0 ? (
            <div className="v-empty">
              <b>{acotada || f.estados.length ? "No hay visitas con esa búsqueda" : "Todavía no hay visitas"}</b>
              <span>
                {acotada || f.estados.length ? "Prueba con otro estado o quita filtros." : "Cuando programes una, aparece aquí."}
              </span>
              {acotada || f.estados.length ? (
                <button type="button" className="btn-out sm" onClick={limpiar}>
                  Quitar filtros
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="v-pager">
            <span>
              {primera.toLocaleString("es-CL")}–{ultima.toLocaleString("es-CL")} de {plural(pagina.total, "registro", "registros")}
            </span>
            <span className="v-pager-r">
              <label className="v-per">
                Filas
                <select value={f.limite} onChange={(e) => ir({ limite: Number(e.target.value) })} aria-label="Visitas por página">
                  {LIMITES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <nav className="v-pager-btns" aria-label="Páginas">
                <button
                  type="button"
                  className="pg"
                  aria-label="Página anterior"
                  disabled={pagina.pagina <= 1 || cargando}
                  onClick={() => irAPagina(pagina.pagina - 1)}
                >
                  ‹
                </button>
                <span>
                  {pagina.pagina} / {pagina.paginas}
                </span>
                <button
                  type="button"
                  className="pg"
                  aria-label="Página siguiente"
                  disabled={pagina.pagina >= pagina.paginas || cargando}
                  onClick={() => irAPagina(pagina.pagina + 1)}
                >
                  ›
                </button>
              </nav>
            </span>
          </div>
        </section>
      </div>

      {lote ? (
        <VisitasLoteDialogo
          accion={lote}
          visitas={seleccionadas}
          onCerrar={() => setLote(null)}
          onHecho={(mensaje, hechas) => {
            aviso(mensaje);
            if (hechas.length === 0) return;
            // Las que ya quedaron salen de la selección; las que fallaron siguen marcadas.
            setMarcadas((prev) => prev.filter((m) => !hechas.includes(m.folio)));
            router.refresh();
          }}
        />
      ) : null}

      {nueva ? (
        <NuevaVisitaHoja
          onCerrar={() => setNueva(false)}
          onAviso={aviso}
          onHecho={(mensaje, folio) => {
            aviso(mensaje);
            setNuevaFolio(folio);
            router.refresh();
          }}
        />
      ) : null}

      {masivas ? (
        <VisitasMasivasDialogo
          porMall={masivas.porMall}
          inicial={masivas.inicial}
          onCerrar={() => setMasivas(null)}
          onHecho={(mensaje, creadas) => {
            aviso(mensaje);
            if (creadas > 0) router.refresh();
          }}
        />
      ) : null}

      <Toast texto={toast} variante="panel" />
    </div>
  );
}

/** Las pestañas de estado. Las de `siHay` solo aparecen cuando tienen visitas. */
const PESTANAS: { id: string; label: string; estados: EstadoVisita[]; siHay?: boolean }[] = [
  { id: "programadas", label: "Programadas", estados: ["PROGRAMADA"] },
  { id: "en-curso", label: "En curso", estados: ["EN_CURSO"] },
  { id: "completadas", label: "Completadas", estados: ["COMPLETADA"] },
  { id: "canceladas", label: "Canceladas", estados: ["CANCELADA", "CANCELADA_ADMIN"] },
  { id: "pendientes", label: "Pendientes", estados: ["PENDIENTE"], siHay: true },
  { id: "reagendadas", label: "Reagendadas", estados: ["REAGENDADA"], siHay: true },
];

/** La casilla cuadrada que todavía usa Reagendas. */
export function Casilla({ marcada, onAlternar, label }: { marcada: boolean; onAlternar: () => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={marcada}
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onAlternar();
      }}
      className="w-7 h-7 grid place-items-center p-0 bg-transparent border-0 cursor-pointer text-[var(--color-text)]"
    >
      <span
        className="w-4 h-4 border-2 border-current grid place-items-center"
        style={{ background: marcada ? "var(--color-text)" : "transparent" }}
      >
        {marcada ? (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--color-bg)" strokeWidth="4">
            <path d="M4 12l5 5L20 6" />
          </svg>
        ) : null}
      </span>
    </button>
  );
}
