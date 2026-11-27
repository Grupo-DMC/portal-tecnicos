"use client";

// «Nueva visita» del panel: el #mNew / #nvForm de panel-operacion.html, armado
// desde su markup (clases .sec, .lbl-row, .mini-check, .date-pair, .phone, .opts,
// .opt, .opt-row, .opt-body y .files; el CSS va en rediseno-secciones.css bajo .nv).
// Se monta al abrir y se desmonta al cerrar: cada apertura parte de cero.
//
// Lo que la demo no tiene y el servidor sí pide: «Qué hay que hacer» es
// obligatorio, y si la sucursal tiene problemas sin resolver hay que responder
// el aviso. Los avisos de problemas y de choque de agenda solo aparecen cuando
// aplican.

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import DatePicker from "@/components/ui/DatePicker";
import AvisoProblemas, { useAvisoProblemas } from "@/components/admin/AvisoProblemas";
import AvisoAgenda, { useConflictosAgenda } from "@/components/admin/AvisoAgenda";
import { crearVisitaAction } from "@/app/actions/admin";
import { useReferencias } from "@/lib/ui/referencias";
import { usePersonasLocal } from "@/lib/ui/personas-local";
import { useAdjuntosPendientes, ADJUNTOS_MAX } from "@/lib/ui/adjuntos";
import { agruparPorSeccion } from "@/lib/ui/secciones";
import { cargoVigente } from "@/lib/ui/cargos";
import { fmtRut, rutDvCorrecto, rutLimpio } from "@/lib/ui/formato";
import { dmyAIso, fechaCL, hoyISO, isoADmy } from "@/lib/ui/fecha";
import { plural } from "@/lib/ui/plural";
import type { CatalogoMotivo } from "@/lib/types";
import type { OrigenProblema } from "@/components/admin/VisitaDialogos";

/** Lo que llega ya escrito cuando se agenda desde una sucursal o un problema. */
export interface PrecargaVisita {
  sucursalId: number;
  tecnicoId?: number | null;
  /** Códigos de motivo, en orden: el primero es el principal. */
  motivos?: string[];
  trabajo?: string;
  /** Título del panel en vez de «Nueva visita». */
  titulo?: string;
  /** El problema que la visita va a resolver: queda vinculado y anotado en su bitácora. */
  problemaOrigenId?: number | null;
  /** El primer contacto de la tienda: abre «Contacto en tienda» con su nombre y cargo. */
  contacto?: { nombre: string; cargo?: string | null } | null;
}

/** La regla `isInstall` de la demo: hay una instalación entre los motivos marcados. */
export function esInstalacion(nombres: string[]): boolean {
  return nombres.some((m) => /instal/i.test(m) && !/des instal|re instal|reinstal/i.test(m));
}

/** `rutValid` de la demo: cuerpo de 7 u 8 dígitos y dígito verificador correcto. */
function rutValido(v: string): boolean {
  return /^\d{7,8}$/.test(rutLimpio(v).slice(0, -1)) && rutDvCorrecto(v);
}

/** `telFmt` de la demo: 9 dígitos → «9 1234 5678». */
function telFmt(d: string): string {
  d = d.replace(/\D/g, "");
  return d.length === 9 ? `${d[0]} ${d.slice(1, 5)} ${d.slice(5)}` : d;
}

/** Un teléfono guardado («+56 9 1234 5678», «56912345678»…) → lo que va después de «+56». */
function telSinPrefijo(v: string | null | undefined): string {
  const d = String(v ?? "").replace(/\D/g, "");
  return telFmt(d.length === 11 && d.startsWith("56") ? d.slice(2) : d);
}

const sinTilde = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** El motivo del checklist que mejor calza con un nombre de la demo («Visita de calibración»…). */
function motivoParecido(motivos: CatalogoMotivo[], nombre: string, raiz: string): string | undefined {
  return (
    motivos.find((m) => sinTilde(m.nombre) === sinTilde(nombre)) ??
    motivos.find((m) => sinTilde(m.nombre).includes(raiz))
  )?.codigo;
}

export function motivoPorDefecto(motivos: CatalogoMotivo[]): string[] {
  const c = motivoParecido(motivos, "Visita de calibración", "calibracion") ?? motivos[0]?.codigo;
  return c ? [c] : [];
}

/** Para agendar desde una sucursal: calibración si tiene plan, si no «Revisión de condiciones local». */
export function motivoDeSucursal(motivos: CatalogoMotivo[], conPlan: boolean): string[] {
  if (conPlan) return motivoPorDefecto(motivos);
  const c = motivoParecido(motivos, "Revisión de condiciones local", "revision") ?? motivos[0]?.codigo;
  return c ? [c] : [];
}

type Errores = Partial<Record<"suc" | "tec" | "ayu" | "mot" | "fecha" | "hora" | "trabajo" | "rut" | "tel", string>>;

function Msg({ id, texto }: { id: string; texto?: string }) {
  return (
    <p className="msg" id={id} hidden={!texto}>
      <span>{texto ?? ""}</span>
    </p>
  );
}

/* ---------- Motivos: el motivoPicker de la demo ---------- */

interface GrupoMotivos {
  grupo: string;
  items: { codigo: string; nombre: string }[];
}

function SelectorMotivos({
  grupos,
  marcados,
  onCambio,
  onAviso,
}: {
  grupos: GrupoMotivos[];
  marcados: string[];
  onCambio: (codigos: string[]) => void;
  onAviso: (texto: string) => void;
}) {
  const [abiertos, setAbiertos] = useState<Set<string>>(() => new Set(grupos[0] ? [grupos[0].grupo] : []));
  const nombre = (c: string) => grupos.flatMap((g) => g.items).find((i) => i.codigo === c)?.nombre ?? c;

  function alternarGrupo(g: GrupoMotivos) {
    const abierto = abiertos.has(g.grupo) || g.items.some((i) => marcados.includes(i.codigo));
    const sig = new Set(abiertos);
    if (!abierto) sig.add(g.grupo);
    else if (g.items.some((i) => marcados.includes(i.codigo))) {
      onAviso("Este grupo tiene motivos marcados; se mantiene abierto.");
      sig.add(g.grupo);
    } else sig.delete(g.grupo);
    setAbiertos(sig);
  }

  return (
    <div className="mot" id="nvMot">
      {grupos.map((g) => {
        const n = g.items.filter((i) => marcados.includes(i.codigo)).length;
        const abierto = abiertos.has(g.grupo) || n > 0;
        return (
          <div className="mot-group" key={g.grupo}>
            <button type="button" className="mot-head" aria-expanded={abierto} onClick={() => alternarGrupo(g)}>
              <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
              {g.grupo}
              <span className="mot-n">{n ? plural(n, "marcado", "marcados") : ""}</span>
              <span className="mot-t num">{g.items.length}</span>
            </button>
            <div className="mot-opts" hidden={!abierto}>
              {g.items.map((i) => (
                <label className="mot-opt" key={i.codigo}>
                  <input
                    type="checkbox"
                    value={i.codigo}
                    checked={marcados.includes(i.codigo)}
                    onChange={(e) =>
                      onCambio(e.target.checked ? [...marcados, i.codigo] : marcados.filter((x) => x !== i.codigo))
                    }
                  />
                  {i.nombre}
                  {marcados[0] === i.codigo ? <span className="first">Principal</span> : null}
                </label>
              ))}
            </div>
          </div>
        );
      })}
      <span className="mot-sum">
        {marcados.length
          ? `${plural(marcados.length, "marcado", "marcados")}. Principal: ${nombre(marcados[0])}`
          : "Ninguno marcado"}
      </span>
    </div>
  );
}

/* ---------- El panel ---------- */

export default function NuevaVisitaHoja({
  precarga,
  onCerrar,
  onAviso,
  onHecho,
}: {
  precarga?: PrecargaVisita;
  onCerrar: () => void;
  /** Avisos de paso (archivos de más, grupo con motivos marcados…). */
  onAviso: (texto: string) => void;
  /** La visita quedó creada. */
  onHecho: (mensaje: string, folio: string) => void;
}) {
  const ref = useReferencias();

  const clientes = useMemo(() => ref.clientes.filter((c) => c.activo), [ref.clientes]);
  const malls = useMemo(() => ref.malls.filter((m) => m.activo), [ref.malls]);
  const sucursales = useMemo(() => ref.sucursales.filter((s) => s.activo), [ref.sucursales]);
  const tecnicos = useMemo(() => ref.tecnicos.filter((t) => t.activo), [ref.tecnicos]);
  const motivosActivos = useMemo(
    () => ref.motivos.filter((m) => m.activo !== false).sort((a, b) => a.orden - b.orden),
    [ref.motivos]
  );
  const grupos = useMemo<GrupoMotivos[]>(() => {
    const gs = agruparPorSeccion(motivosActivos);
    return gs.map((g) => ({
      grupo: g.nombre ?? (gs.length > 1 ? "Otros motivos" : "Motivos"),
      items: g.items.map((m) => ({ codigo: m.codigo, nombre: m.nombre })),
    }));
  }, [motivosActivos]);
  const nombreCliente = (id: number) => ref.clientes.find((c) => c.id === id)?.nombreFantasia ?? "";

  const sucInicial = precarga ? ref.sucursales.find((s) => s.id === precarga.sucursalId) : undefined;
  const clienteInicial = String(sucInicial?.clienteId ?? clientes[0]?.id ?? "");
  const tecInicial =
    precarga?.tecnicoId && tecnicos.some((t) => t.id === precarga.tecnicoId)
      ? String(precarga.tecnicoId)
      : String(tecnicos[0]?.id ?? "");
  const contacto = precarga?.contacto ?? null;

  const [porMall, setPorMall] = useState(false);
  const [primero, setPrimero] = useState(clienteInicial);
  const listaSuc = useMemo(
    () => sucursales.filter((s) => (porMall ? String(s.mallId ?? "") === primero : String(s.clienteId) === primero)),
    [sucursales, porMall, primero]
  );
  const [sucursalId, setSucursalId] = useState(() =>
    sucInicial ? String(sucInicial.id) : String(sucursales.find((s) => String(s.clienteId) === clienteInicial)?.id ?? "")
  );
  const [tecnicoId, setTecnicoId] = useState(tecInicial);
  const [ayudanteId, setAyudanteId] = useState("");
  const [motivos, setMotivos] = useState<string[]>(() =>
    precarga?.motivos?.length ? precarga.motivos : motivoPorDefecto(motivosActivos)
  );
  const [fecha, setFecha] = useState(hoyISO());
  const [margen, setMargen] = useState(false);
  const [hasta, setHasta] = useState("");
  const [hora, setHora] = useState("");
  const [trabajo, setTrabajo] = useState(precarga?.trabajo ?? "");
  const [contactoAbierto, setContactoAbierto] = useState(Boolean(contacto?.nombre));
  const [accesoAbierto, setAccesoAbierto] = useState(false);
  const [persona, setPersona] = useState("otra");
  const [resp, setResp] = useState(contacto?.nombre ?? "");
  const [cargo, setCargo] = useState(() =>
    contacto?.cargo && ref.cargos.some((c) => c.nombre === contacto.cargo) ? contacto.cargo : ""
  );
  const [rut, setRut] = useState("");
  const [tel, setTel] = useState("");
  const [acceso, setAcceso] = useState("");
  const [errores, setErrores] = useState<Errores>({});
  const [intento, setIntento] = useState(0);
  const [guardando, setGuardando] = useState(false);

  const personas = usePersonasLocal(sucursalId);
  const adjuntos = useAdjuntosPendientes();
  const archivos = useRef<HTMLInputElement>(null);
  const hoja = useRef<HTMLDivElement>(null);
  const cerrarBtn = useRef<HTMLButtonElement>(null);
  const alCerrar = useRef(onCerrar);
  alCerrar.current = onCerrar;

  const avisoProblemas = useAvisoProblemas(Number(sucursalId) || null, {
    origenId: precarga?.problemaOrigenId ?? undefined,
  });
  const conflictos = useConflictosAgenda({
    sucursalId: Number(sucursalId) || null,
    fecha,
    tecnicoId: Number(tecnicoId) || null,
    ayudanteId: Number(ayudanteId) || null,
  });

  const nombresMarcados = motivos.map((c) => motivosActivos.find((m) => m.codigo === c)?.nombre ?? c);
  const horaObligatoria = esInstalacion(nombresMarcados);
  const quitarError = (...ks: (keyof Errores)[]) =>
    setErrores((prev) => {
      if (!ks.some((k) => prev[k])) return prev;
      const sig = { ...prev };
      for (const k of ks) delete sig[k];
      return sig;
    });

  // openDialog / closeDialog de la demo: foco al primer campo, sin scroll detrás,
  // Esc cierra (salvo que el calendario lo haya tomado) y el foco vuelve a quien abrió.
  useEffect(() => {
    const antes = document.activeElement as HTMLElement | null;
    const desplazamiento = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Como openDialog de la demo: su selector toma la ✕ del encabezado, que va antes que los campos.
    cerrarBtn.current?.focus();
    const tecla = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) alCerrar.current();
    };
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("keydown", tecla);
      document.body.style.overflow = desplazamiento;
      if (antes && document.contains(antes)) antes.focus();
    };
  }, []);

  // Tras un envío con errores, al primero de ellos.
  useEffect(() => {
    if (!intento) return;
    hoja.current?.querySelector(".msg:not([hidden])")?.scrollIntoView({ block: "center" });
  }, [intento]);

  function atraparTab(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Tab" || !hoja.current) return;
    const f = [...hoja.current.querySelectorAll<HTMLElement>("button, input, select, textarea, summary, a[href]")].filter(
      (x) => !(x as HTMLButtonElement).disabled && x.offsetParent !== null
    );
    if (!f.length) return;
    const i = f.indexOf(document.activeElement as HTMLElement);
    if (e.shiftKey && i <= 0) {
      e.preventDefault();
      f[f.length - 1].focus();
    } else if (!e.shiftKey && i === f.length - 1) {
      e.preventDefault();
      f[0].focus();
    }
  }

  function cambiarPorMall(valor: boolean) {
    setPorMall(valor);
    const p = String((valor ? malls[0]?.id : clientes[0]?.id) ?? "");
    setPrimero(p);
    elegirSucursal(String(sucursales.find((s) => (valor ? String(s.mallId ?? "") === p : String(s.clienteId) === p))?.id ?? ""));
  }

  function cambiarPrimero(p: string) {
    setPrimero(p);
    elegirSucursal(String(sucursales.find((s) => (porMall ? String(s.mallId ?? "") === p : String(s.clienteId) === p))?.id ?? ""));
  }

  function elegirSucursal(id: string) {
    setSucursalId(id);
    setPersona("otra");
    quitarError("suc");
  }

  function elegirPersona(v: string) {
    setPersona(v);
    const p = personas.find((x) => String(x.id) === v);
    setResp(p ? p.nombre : "");
    setRut(p ? (p.rut ?? "") : "");
    setTel(p ? telSinPrefijo(p.telefono) : "");
    setCargo(p ? cargoVigente(ref.cargos, p.cargo) : "");
    quitarError("rut");
  }

  function agregarArchivos(lista: FileList | null) {
    const add = Array.from(lista ?? []);
    if (archivos.current) archivos.current.value = "";
    const cupo = ADJUNTOS_MAX - adjuntos.pendientes.length;
    if (add.length > cupo) onAviso(`Solo caben ${ADJUNTOS_MAX} archivos. Se agregaron ${Math.max(0, cupo)}.`);
    adjuntos.agregar(add, cupo);
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (guardando) return;
    const telD = tel.replace(/\s/g, "");
    const r = rut.trim();
    const errs: Errores = {};
    if (!sucursalId) errs.suc = "Elige la sucursal.";
    if (ayudanteId && ayudanteId === tecnicoId) errs.ayu = "El ayudante debe ser otro técnico.";
    if (!motivos.length) errs.mot = "Marca al menos un motivo.";
    if (!fecha) errs.fecha = "Elige la fecha programada.";
    else if (margen && (!hasta || hasta < fecha)) errs.fecha = "La fecha límite debe ser igual o posterior a la programada.";
    if (horaObligatoria && !hora) errs.hora = "En instalaciones la hora de llegada es obligatoria.";
    if (!trabajo.trim()) errs.trabajo = "Escribe qué hay que hacer.";
    if (r && !rutValido(r)) errs.rut = "El RUT no es válido. Revisa el dígito verificador.";
    if (telD && !/^\d{9}$/.test(telD))
      errs.tel = "Escribe los 9 dígitos que van después de +56 (ej.: 9 1234 5678 o 2 2345 6789).";
    setErrores(errs);
    if (Object.keys(errs).length) {
      if (errs.rut || errs.tel) setContactoAbierto(true);
      setIntento((n) => n + 1);
      return;
    }
    const falta = avisoProblemas.falta();
    if (falta) {
      onAviso(falta);
      return;
    }
    if (adjuntos.preparando) {
      onAviso("Espera a que terminen de prepararse los adjuntos.");
      return;
    }

    const suc = ref.sucursales.find((s) => String(s.id) === sucursalId)!;
    setGuardando(true);
    const res = await crearVisitaAction({
      clienteId: suc.clienteId,
      sucursalId: suc.id,
      tecnicoId: Number(tecnicoId),
      tecnicoAyudanteId: ayudanteId ? Number(ayudanteId) : null,
      motivoCodigo: motivos[0],
      motivosCodigos: motivos,
      fechaProgramada: fecha,
      // Un margen que termina el mismo día es un solo día: en la base va sin «hasta».
      fechaHasta: margen && hasta > fecha ? hasta : null,
      horaProgramada: hora || null,
      trabajoSolicitado: trabajo.trim(),
      indicacionesAcceso: acceso.trim() || null,
      responsableNombre: resp.trim() || null,
      responsableRut: resp.trim() && r ? fmtRut(r) : null,
      responsableTelefono: resp.trim() && telD ? `+56 ${telFmt(telD)}` : null,
      responsableCargo: resp.trim() && cargo ? cargo : null,
      problemaOrigenId: precarga?.problemaOrigenId ?? null,
      avisoProblemas: avisoProblemas.respuestaAviso(),
    });
    if (!res.ok || !res.folio) {
      setGuardando(false);
      onAviso(res.error ?? "No se pudo guardar.");
      return;
    }
    // Los adjuntos se suben con la visita ya creada; si alguno falla, la visita queda igual.
    const fallidos = await adjuntos.subirTodos(res.folio);
    setGuardando(false);
    const tecnico = tecnicos.find((t) => String(t.id) === tecnicoId)?.nombreCompleto ?? "";
    onHecho(
      `Visita ${res.folio} programada para ${tecnico} el ${fechaCL(fecha)}.` +
        (fallidos ? ` No se pudo subir ${plural(fallidos, "adjunto", "adjuntos")}: agrégalos desde Editar.` : ""),
      res.folio
    );
    onCerrar();
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    // Va colgado del body: lleva su propio `.dmc` para tomar el estilo.
    <div className="dmc">
      <div className="ov" onClick={() => onCerrar()} />
      <div ref={hoja} className="sheet nv" id="mNew" role="dialog" aria-modal="true" aria-labelledby="mNewT" onKeyDown={atraparTab}>
        <form className="m-form" id="nvForm" noValidate onSubmit={enviar}>
          <header className="m-head">
            <div>
              <h2 id="mNewT">{precarga?.titulo || "Nueva visita"}</h2>
            </div>
            <button ref={cerrarBtn} className="icon-btn" type="button" aria-label="Cerrar" onClick={() => onCerrar()}>
              ✕
            </button>
          </header>
          <div className="m-body">
            <section className="sec">
              <h3>Local</h3>
              <div className="g2">
                <div className="fr">
                  <div className="lbl-row">
                    <label htmlFor="nvCliente" id="nvClienteLbl">
                      {porMall ? "Mall" : "Cliente"}
                    </label>
                    <label className="mini-check">
                      <input type="checkbox" id="nvByMall" checked={porMall} onChange={(e) => cambiarPorMall(e.target.checked)} />{" "}
                      Buscar por mall
                    </label>
                  </div>
                  <select className="input" id="nvCliente" value={primero} onChange={(e) => cambiarPrimero(e.target.value)}>
                    {(porMall ? malls.map((m) => ({ v: m.id, t: m.nombre })) : clientes.map((c) => ({ v: c.id, t: c.nombreFantasia }))).map((o) => (
                      <option key={o.v} value={String(o.v)}>
                        {o.t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="fr">
                  <label htmlFor="nvSuc">Sucursal</label>
                  <select
                    className="input"
                    id="nvSuc"
                    value={sucursalId}
                    aria-invalid={errores.suc ? true : undefined}
                    aria-describedby="nvSucMsg"
                    onChange={(e) => elegirSucursal(e.target.value)}
                  >
                    {listaSuc.map((s) => (
                      <option key={s.id} value={String(s.id)}>
                        {`${nombreCliente(s.clienteId)}, ${s.nombre}`}
                      </option>
                    ))}
                  </select>
                  <Msg id="nvSucMsg" texto={errores.suc} />
                </div>
              </div>
            </section>

            <section className="sec">
              <h3>Quién va</h3>
              <div className="g2">
                <div className="fr">
                  <label htmlFor="nvTec">Técnico</label>
                  <select
                    className="input"
                    id="nvTec"
                    value={tecnicoId}
                    onChange={(e) => {
                      setTecnicoId(e.target.value);
                      quitarError("ayu");
                    }}
                  >
                    {tecnicos.map((t) => (
                      <option key={t.id} value={String(t.id)}>
                        {t.nombreCompleto}
                      </option>
                    ))}
                  </select>
                  <Msg id="nvTecMsg" texto={errores.tec} />
                </div>
                <div className="fr">
                  <label htmlFor="nvAyu" title="Si van dos al local. Lo ve en su celular; el acta la llena el asignado.">
                    Ayudante <span className="opt">opcional</span>
                  </label>
                  <select
                    className="input"
                    id="nvAyu"
                    value={ayudanteId}
                    aria-invalid={errores.ayu ? true : undefined}
                    aria-describedby="nvAyuMsg"
                    onChange={(e) => {
                      setAyudanteId(e.target.value);
                      quitarError("ayu");
                    }}
                  >
                    <option value="">Sin ayudante, va solo</option>
                    {tecnicos.map((t) => (
                      <option key={t.id} value={String(t.id)}>
                        {t.nombreCompleto}
                      </option>
                    ))}
                  </select>
                  <Msg id="nvAyuMsg" texto={errores.ayu} />
                </div>
              </div>
            </section>

            <fieldset className="sec">
              <legend>
                <h3>Motivo</h3>
              </legend>
              <SelectorMotivos
                grupos={grupos}
                marcados={motivos}
                onAviso={onAviso}
                onCambio={(c) => {
                  setMotivos(c);
                  quitarError("mot", "hora");
                }}
              />
              <Msg id="nvMotMsg" texto={errores.mot} />
            </fieldset>

            <section className="sec">
              <h3>Cuándo</h3>
              <div className="g2">
                <div className="fr">
                  <div className="lbl-row">
                    <label htmlFor="nvFecha">Fecha</label>
                    <label className="mini-check">
                      <input
                        type="checkbox"
                        id="nvMargen"
                        checked={margen}
                        onChange={(e) => {
                          setMargen(e.target.checked);
                          if (e.target.checked && !hasta) setHasta(fecha);
                        }}
                      />{" "}
                      Con margen
                    </label>
                  </div>
                  <div className="date-pair">
                    <DatePicker
                      modo="single"
                      id="nvFecha"
                      valor={isoADmy(fecha)}
                      minimo={isoADmy(hoyISO())}
                      maximo={null}
                      invalido={Boolean(errores.fecha)}
                      aria-describedby="nvFechaMsg"
                      onChange={(v) => {
                        setFecha(dmyAIso(v));
                        quitarError("fecha");
                      }}
                    />
                    <span id="nvHastaWrap" hidden={!margen}>
                      <span className="muted">a</span>
                      <DatePicker
                        modo="single"
                        id="nvHasta"
                        etiqueta="Fecha límite"
                        valor={isoADmy(hasta)}
                        minimo={isoADmy(fecha || hoyISO())}
                        maximo={null}
                        invalido={Boolean(errores.fecha) && margen}
                        onChange={(v) => {
                          setHasta(dmyAIso(v));
                          quitarError("fecha");
                        }}
                      />
                    </span>
                  </div>
                  <Msg id="nvFechaMsg" texto={errores.fecha} />
                </div>
                <div className="fr">
                  <label htmlFor="nvHora" id="nvHoraLbl">
                    {horaObligatoria ? "Hora de llegada" : "Hora de llegada (opcional)"}
                  </label>
                  <input
                    className="input"
                    type="time"
                    id="nvHora"
                    value={hora}
                    aria-invalid={errores.hora ? true : undefined}
                    aria-describedby="nvHoraMsg"
                    onChange={(e) => {
                      setHora(e.target.value);
                      quitarError("hora");
                    }}
                  />
                  <Msg id="nvHoraMsg" texto={errores.hora} />
                </div>
              </div>
            </section>

            <section className="sec">
              <h3>
                <label htmlFor="nvNecesita">Qué hay que hacer</label>
              </h3>
              <div className="fr">
                <textarea
                  className="input ta"
                  id="nvNecesita"
                  rows={3}
                  placeholder="Ej.: calibrar las 3 antenas del pórtico principal; falsa alarma cada 10 min desde el lunes."
                  value={trabajo}
                  aria-invalid={errores.trabajo ? true : undefined}
                  aria-describedby="nvNecesitaMsg"
                  onChange={(e) => {
                    setTrabajo(e.target.value);
                    quitarError("trabajo");
                  }}
                />
                <Msg id="nvNecesitaMsg" texto={errores.trabajo} />
              </div>
            </section>

            {conflictos.length || avisoProblemas.problemas.length ? (
              <div>
                <AvisoAgenda conflictos={conflictos} fecha={fecha} />
                <AvisoProblemas aviso={avisoProblemas} deshabilitado={guardando} />
              </div>
            ) : null}

            <div className="opts">
              <details className="opt" id="nvContacto" open={contactoAbierto} onToggle={(e) => setContactoAbierto(e.currentTarget.open)}>
                <summary>
                  <span>Contacto en tienda</span>
                  <small id="nvContactoSum">{resp.trim() || "Opcional"}</small>
                </summary>
                <div className="opt-body">
                  <div className="fr">
                    <label htmlFor="nvPersona">Elegir de quienes ya firmaron</label>
                    <select className="input" id="nvPersona" value={persona} onChange={(e) => elegirPersona(e.target.value)}>
                      {personas.map((p) => (
                        <option key={p.id} value={String(p.id)}>
                          {p.nombre}
                          {p.cargo ? `, ${p.cargo}` : ""}
                        </option>
                      ))}
                      <option value="otra">Escribir otra persona</option>
                    </select>
                  </div>
                  <div className="g2">
                    <div className="fr">
                      <label htmlFor="nvResp">Nombre</label>
                      <input
                        className="input"
                        id="nvResp"
                        placeholder="Quién recibe"
                        autoComplete="off"
                        value={resp}
                        onChange={(e) => setResp(e.target.value)}
                      />
                    </div>
                    <div className="fr">
                      <label htmlFor="nvCargo">Cargo</label>
                      <select className="input" id="nvCargo" value={cargo} onChange={(e) => setCargo(e.target.value)}>
                        <option value="">Sin cargo</option>
                        {ref.cargos.map((c) => (
                          <option key={c.id} value={c.nombre}>
                            {c.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="fr">
                      <label htmlFor="nvRut">RUT</label>
                      <input
                        className="input"
                        id="nvRut"
                        placeholder="12.345.678-9"
                        autoComplete="off"
                        value={rut}
                        aria-invalid={errores.rut ? true : undefined}
                        aria-describedby="nvRutMsg"
                        onChange={(e) => {
                          setRut(e.target.value);
                          quitarError("rut");
                        }}
                        onBlur={(e) => {
                          if (rutValido(e.target.value)) setRut(fmtRut(e.target.value));
                        }}
                      />
                      <Msg id="nvRutMsg" texto={errores.rut} />
                    </div>
                    <div className="fr">
                      <label htmlFor="nvTel">Teléfono</label>
                      <div className="phone">
                        <span>+56</span>
                        <input
                          className="input"
                          id="nvTel"
                          inputMode="numeric"
                          placeholder="9 1234 5678"
                          autoComplete="off"
                          value={tel}
                          aria-invalid={errores.tel ? true : undefined}
                          aria-describedby="nvTelMsg"
                          onChange={(e) => {
                            setTel(e.target.value);
                            quitarError("tel");
                          }}
                        />
                      </div>
                      <Msg id="nvTelMsg" texto={errores.tel} />
                    </div>
                  </div>
                </div>
              </details>
              <details className="opt" open={accesoAbierto} onToggle={(e) => setAccesoAbierto(e.currentTarget.open)}>
                <summary>
                  <span>Indicaciones de acceso</span>
                  <small>Opcional</small>
                </summary>
                <div className="opt-body">
                  <textarea
                    className="input ta"
                    id="nvAcceso"
                    rows={2}
                    aria-label="Indicaciones de acceso"
                    placeholder="Ej.: entrar por la puerta de servicio del nivel -1; pedir la llave al guardia."
                    value={acceso}
                    onChange={(e) => setAcceso(e.target.value)}
                  />
                </div>
              </details>
              <div className="opt opt-files">
                <button className="opt-row" type="button" id="nvAttachBtn" onClick={() => archivos.current?.click()}>
                  <span>Adjuntar fotos o videos</span>
                  <small>Hasta 12, videos a 720p y 1 min</small>
                </button>
                <input
                  ref={archivos}
                  className="sr"
                  type="file"
                  id="nvFiles"
                  accept="image/*,video/*"
                  multiple
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={(e) => agregarArchivos(e.target.files)}
                />
                <ul className="files" id="nvFileList">
                  {adjuntos.pendientes.map((p) => (
                    <li key={p.clave} title={p.error ?? undefined}>
                      {p.nombre}
                      <button type="button" aria-label={`Quitar ${p.nombre}`} onClick={() => adjuntos.quitar(p.clave)}>
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          <footer className="m-foot">
            <button className="btn-out" type="button" onClick={() => onCerrar()}>
              Cancelar
            </button>
            <button className="btn-pri" type="submit" disabled={guardando}>
              Programar visita
            </button>
          </footer>
        </form>
      </div>
    </div>,
    document.body
  );
}

/**
 * Agendar desde un problema («Visita para resolver» de la demo): la sucursal y
 * el técnico de la visita donde se levantó, el motivo según el tipo de falla y
 * el «qué hay que hacer» ya escrito. El problema queda vinculado a la visita.
 */
export function precargaDeProblema(
  origen: OrigenProblema,
  motivos: CatalogoMotivo[],
  tecnicoId?: number | null
): PrecargaVisita {
  const revision = /antena|placa|cable|sincron|energ|fuente|red|otro/i.test(origen.tipoNombre);
  return {
    sucursalId: origen.sucursalId,
    tecnicoId: tecnicoId ?? null,
    motivos: motivoDeSucursal(motivos.filter((m) => m.activo !== false), !revision),
    trabajo:
      `Resolver problema levantado en ${origen.folio}: ${origen.tipoNombre}.` +
      (origen.descripcion ? ` El técnico anotó: "${origen.descripcion}".` : "") +
      (origen.solucion ? ` Indicación del técnico: ${origen.solucion}` : ""),
    titulo: "Visita para resolver",
    problemaOrigenId: origen.problemaId,
  };
}
