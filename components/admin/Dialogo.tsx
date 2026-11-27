"use client";
import Espera from "@/components/ui/Espera";

import DatePicker from "@/components/ui/DatePicker";
import { dmyAIso, isoADmy } from "@/lib/ui/fecha";
import { Fragment, useEffect, useRef, useState } from "react";
import SelectBuscable from "@/components/ui/SelectBuscable";
import SelectConAlta, { type TipoAlta } from "@/components/ui/SelectConAlta";
import SeccionPlegable from "@/components/ui/SeccionPlegable";
import { agruparPorSeccion, hayAlgunaSeccion } from "@/lib/ui/secciones";
import { fmtRut, mensajeRut, sinTildes } from "@/lib/ui/formato";
import CampoTelefono from "@/components/ui/CampoTelefono";
import MotivoDesactivacion from "@/components/ui/MotivoDesactivacion";
import Icono from "@/components/ui/Icono";
import Confirmar from "@/components/ui/Confirmar";

export type CampoTipo =
  | "text"
  | "email"
  | "date"
  | "time"
  | "tel"
  | "rut"
  | "select"
  /** Varias opciones a la vez. El valor es un string con los códigos separados
   *  por coma, para que siga entrando en FormValores sin cambiar el resto. */
  | "checks"
  | "password"
  | "area"
  | "cuerpo"
  | "toggle";

/** Desde cuántas opciones conviene el selector con búsqueda en vez del nativo. */
const MINIMO_PARA_BUSCAR = 7;

/** "A,B" ⇄ ["A","B"] — el ida y vuelta del tipo "checks". */
export function leerChecks(valor: string | boolean | undefined): string[] {
  return String(valor ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export function escribirChecks(codigos: string[]): string {
  return [...new Set(codigos.filter(Boolean))].join(",");
}

/**
 * Una opción de un select o de unas casillas. `seccion` solo la mira el tipo
 * «checks»: agrupa las opciones en secciones que se despliegan.
 */
export interface OpcionCampo {
  v: string;
  t: string;
  seccion?: string | null;
  seccionOrden?: number;
}

export interface CampoDef {
  k: string;
  label: string;
  /** 1 = media fila, 2 = fila completa. Por defecto 1. */
  span?: 1 | 2;
  tipo?: CampoTipo;
  ph?: string;
  ayuda?: string;
  opciones?: OpcionCampo[];
  /**
   * Opciones que dependen de lo escrito en otros campos (las marcas del cliente
   * elegido). Si está, manda sobre `opciones`.
   */
  opcionesSegun?: (form: FormValores) => OpcionCampo[];
  /**
   * Fuerza el selector con búsqueda aunque la lista sea corta. Se usa donde el
   * catálogo crece con el tiempo —clientes, sucursales, técnicos— para que el
   * campo no cambie de forma el día que pasa de seis a siete opciones.
   */
  buscable?: boolean;
  /**
   * Agrega la opción «Agregar nuevo» a la lista: crea ese registro sin salir
   * del formulario y lo deja elegido. Implica el selector con búsqueda.
   */
  alta?: TipoAlta;
  /** Con `alta: "sucursal"`: el cliente al que se le crea la sucursal. */
  altaClienteId?: string;
  /**
   * El campo nace plegado: solo se ve su título y se abre al pincharlo. Para
   * lo que casi nunca se llena y ocupaba una caja entera. Si ya trae un valor
   * (al corregir una visita) aparece abierto.
   */
  plegable?: boolean;
  /**
   * Casilla pequeña en la fila del título, a la derecha. Guarda true/false en
   * `form[k]`: sirve para que otro campo aparezca solo cuando se marca.
   */
  casilla?: { k: string; label: string };
  /**
   * Solo «toggle»: lo que se desactiva, con su artículo («la marca»). Pasar a
   * «Inactivo» siempre pide el motivo por escrito (migración 039); esto solo
   * pone el nombre en la pregunta.
   */
  desactiva?: string;
  /** Solo «toggle»: el campo del formulario donde queda el motivo. Por defecto «motivoInactivo». */
  motivoK?: string;
  /** Abre una sección numerada del panel («Local», «Cuándo»…) antes de este campo. */
  grupo?: string;
  /** El valor lo pone otro campo: se muestra, pero no se puede escribir. */
  bloqueado?: (form: FormValores) => boolean;
  /** Solo «date»: primer día elegible, en ISO (ej. hoy: no se agenda en el pasado). */
  minimo?: string;
}

/** El campo del motivo de un «toggle». */
const claveMotivo = (c: CampoDef) => c.motivoK ?? "motivoInactivo";

export interface Adjunto {
  label: string;
  incluido: boolean;
}

export type FormValores = Record<string, string | boolean>;

/**
 * Panel lateral de formulario: cabecera con el título, secciones con los campos
 * en dos columnas y, siempre a la vista abajo, Cancelar y la acción principal.
 */
export default function Dialogo({
  titulo,
  cta,
  nota,
  campos,
  form,
  onCampo,
  onCerrar,
  onGuardar,
  guardando = false,
  adjuntos,
  onToggleAdjunto,
  children,
}: {
  titulo: string;
  cta: string;
  nota?: string;
  campos: CampoDef[];
  form: FormValores;
  onCampo: (k: string, valor: string | boolean) => void;
  onCerrar: () => void;
  onGuardar: () => void;
  guardando?: boolean;
  adjuntos?: Adjunto[];
  onToggleAdjunto?: (i: number) => void;
  /** Contenido propio del diálogo, debajo de los campos. */
  children?: React.ReactNode;
}) {
  const [verPass, setVerPass] = useState(false);
  /** El «toggle» que está pidiendo el motivo para quedar inactivo. */
  const [motivoDe, setMotivoDe] = useState<CampoDef | null>(null);
  // Los plegables que ya traen algo escrito nacen abiertos.
  const [desplegados, setDesplegados] = useState<string[]>(() =>
    campos.filter((c) => c.plegable && String(form[c.k] ?? "")).map((c) => c.k)
  );

  /** Se escribió o se marcó algo: cerrar ya no puede ser sin querer. */
  const tocado = useRef(false);
  const [descartar, setDescartar] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const alCerrar = useRef(onCerrar);
  alCerrar.current = onCerrar;

  // Esc cierra el panel de más arriba. Con algo escrito, pregunta antes.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || !panel.current) return;
      // Una lista desplegada o un diálogo encima se llevan el Esc.
      if (panel.current.querySelector('[role="listbox"], [role="dialog"]')) return;
      const abiertos = document.querySelectorAll('[role="dialog"]');
      if (abiertos[abiertos.length - 1] !== panel.current) return;
      // La tecla termina aquí: si no, cierra al tiro la confirmación que se abre.
      e.preventDefault();
      e.stopPropagation();
      if (tocado.current) setDescartar(true);
      else alCerrar.current();
    };
    // En captura: se mira qué hay abierto antes de que se cierre solo.
    document.addEventListener("keydown", tecla, true);
    return () => document.removeEventListener("keydown", tecla, true);
  }, []);

  useEffect(() => {
    // Un clic fuera no cierra: descartaba el formulario sin querer.
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previo;
    };
  }, []);

  const nIncluidos = adjuntos?.filter((a) => a.incluido).length ?? 0;

  return (
    <div ref={panel} role="dialog" aria-modal="true" aria-label={titulo} className="dmc sd-ov">
      <div className="sd-sheet">
        <div className="sd-head">
          <h2>{titulo}</h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="icon-btn">
            <Icono nombre="cerrar" />
          </button>
        </div>

        <div className="sd-body" onInputCapture={() => (tocado.current = true)} onClickCapture={() => (tocado.current = true)}>
          <div className="sd-campos">
            {campos.map((def) => {
              const c = def.opcionesSegun ? { ...def, opciones: def.opcionesSegun(form) } : def;
              const valor = form[c.k];
              const texto = typeof valor === "boolean" ? "" : String(valor ?? "");
              const abierto = !c.plegable || desplegados.includes(c.k);
              const plegador = c.plegable ? (
                <button
                  type="button"
                  aria-expanded={abierto}
                  onClick={() =>
                    setDesplegados((prev) => (abierto ? prev.filter((k) => k !== c.k) : [...prev, c.k]))
                  }
                  className="sd-plegar"
                >
                  <span>{c.label}</span>
                  <Icono nombre="abajo" />
                </button>
              ) : null;
              if (!abierto) {
                return (
                  <Fragment key={c.k}>
                    {c.grupo ? <h3 className="sd-sec">{c.grupo}</h3> : null}
                    <div className={`min-w-0 ${c.span === 2 ? "sm:col-span-2" : ""}`}>{plegador}</div>
                  </Fragment>
                );
              }
              return (
                <Fragment key={c.k}>
                {c.grupo ? <h3 className="sd-sec">{c.grupo}</h3> : null}
                <div className={`field min-w-0 ${c.span === 2 ? "sm:col-span-2" : ""}`}>
                  {plegador ? (
                    <div className="mb-2">{plegador}</div>
                  ) : c.casilla ? (
                    <div className="flex items-start gap-2">
                      <label htmlFor={`dlg-${c.k}`}>{c.label}</label>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={form[c.casilla.k] === true}
                        onClick={() => onCampo(c.casilla!.k, form[c.casilla!.k] !== true)}
                        className="ml-auto flex-none flex items-center gap-1.5 p-0 bg-transparent border-0 cursor-pointer text-[var(--color-text)] text-cap "
                        style={{ opacity: form[c.casilla.k] === true ? 1 : 0.72 }}
                      >
                        <span className="w-3.5 h-3.5 flex-none border-2 border-current grid place-items-center">
                          {form[c.casilla.k] === true ? (
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                              <path d="M4 12l5 5L20 6" />
                            </svg>
                          ) : null}
                        </span>
                        <span>{c.casilla.label}</span>
                      </button>
                    </div>
                  ) : (
                    <label htmlFor={`dlg-${c.k}`}>{c.label}</label>
                  )}

                  {c.bloqueado?.(form) ? (
                    <input
                      id={`dlg-${c.k}`}
                      className="input"
                      value={c.opciones?.find((o) => o.v === texto)?.t ?? texto}
                      disabled
                      readOnly
                    />
                  ) : c.tipo === "select" ? (
                    c.alta ? (
                      <SelectConAlta
                        id={`dlg-${c.k}`}
                        valor={texto}
                        opciones={c.opciones ?? []}
                        onChange={(v) => onCampo(c.k, v)}
                        ariaLabel={c.label}
                        alta={c.alta}
                        clienteId={c.altaClienteId ?? (c.alta === "marca" ? String(form.clienteId ?? "") : undefined)}
                      />
                    ) : c.buscable || (c.opciones?.length ?? 0) >= MINIMO_PARA_BUSCAR ? (
                      // Lista larga: se escribe y filtra al momento.
                      <SelectBuscable
                        id={`dlg-${c.k}`}
                        valor={texto}
                        opciones={c.opciones ?? []}
                        onChange={(v) => onCampo(c.k, v)}
                        ariaLabel={c.label}
                      />
                    ) : (
                      <div className="relative">
                        <select
                          id={`dlg-${c.k}`}
                          value={texto}
                          onChange={(e) => onCampo(c.k, e.target.value)}
                          className="input pr-9.5 appearance-none"
                        >
                          {c.opciones?.map((o) => (
                            <option key={o.v} value={o.v}>
                              {o.t}
                            </option>
                          ))}
                        </select>
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="var(--color-text)"
                          strokeWidth="2.2"
                          className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                        >
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </div>
                    )
                  ) : c.tipo === "checks" ? (
                    <CasillasMultiples
                      valor={texto}
                      opciones={c.opciones ?? []}
                      onCambiar={(v) => onCampo(c.k, v)}
                    />
                  ) : c.tipo === "password" ? (
                    // El ojo va dentro del campo: un solo control, sin casilla
                    // ni caja suelta al lado del input.
                    <div className="relative">
                      <input
                        id={`dlg-${c.k}`}
                        type={verPass ? "text" : "password"}
                        value={texto}
                        onChange={(e) => onCampo(c.k, e.target.value)}
                        placeholder={c.ph}
                        autoComplete="off"
                        spellCheck={false}
                        className="input pr-11 tracking-[.08em]"
                      />
                      <button
                        type="button"
                        onClick={() => setVerPass((v) => !v)}
                        aria-label={verPass ? "Ocultar contraseña" : "Ver contraseña"}
                        aria-pressed={verPass}
                        title={verPass ? "Ocultar contraseña" : "Ver contraseña"}
                        className="absolute right-0 top-0 bottom-0 w-10 grid place-items-center bg-transparent border-0 cursor-pointer text-[var(--color-text)] opacity-60 hover:opacity-100"
                      >
                        {verPass ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" />
                            <path d="M4 4l16 16" />
                          </svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" />
                            <circle cx="12" cy="12" r="2.6" />
                          </svg>
                        )}
                      </button>
                    </div>
                  ) : c.tipo === "toggle" ? (
                    <>
                      <div className="flex gap-2" role="radiogroup" aria-label={c.label}>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={valor !== false}
                          onClick={() => {
                            if (valor !== false) return;
                            // Al reactivar el motivo se borra: es del estado inactivo.
                            onCampo(claveMotivo(c), "");
                            onCampo(c.k, true);
                          }}
                          className={`tag ${valor === false ? "tag-neutral" : "tag-accent"} min-h-[42px] flex-1 border border-[var(--color-line)] rounded-[10px] cursor-pointer font-semibold text-meta justify-center`}
                        >
                          Activo
                        </button>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={valor === false}
                          // Quedar inactivo pasa siempre por el motivo escrito.
                          onClick={() => (valor === false ? undefined : setMotivoDe(c))}
                          className={`tag ${valor === false ? "tag-accent" : "tag-neutral"} min-h-[42px] flex-1 border border-[var(--color-line)] rounded-[10px] cursor-pointer font-semibold text-meta justify-center`}
                        >
                          Inactivo
                        </button>
                      </div>
                      {valor === false ? (
                        <div className="mt-2 px-3 py-2.5 border border-[var(--color-line)] rounded-[10px] bg-[var(--color-surface-3)] flex items-start gap-2.5">
                          <div className="min-w-0 flex-1">
                            <div className="text-cap opacity-62">Por qué está inactivo</div>
                            <div className="text-meta leading-[1.45] mt-0.5 break-words">
                              {String(form[claveMotivo(c)] ?? "").trim() || (
                                <span className="font-semibold text-[var(--color-danger-800)]">Falta el motivo</span>
                              )}
                            </div>
                          </div>
                          <button type="button" className="btn btn-ghost flex-none" onClick={() => setMotivoDe(c)}>
                            {String(form[claveMotivo(c)] ?? "").trim() ? "Cambiar" : "Escribir motivo"}
                          </button>
                        </div>
                      ) : null}
                    </>
                  ) : c.tipo === "area" ? (
                    <textarea
                      id={`dlg-${c.k}`}
                      rows={3}
                      value={texto}
                      onChange={(e) => onCampo(c.k, e.target.value)}
                      placeholder={c.ph}
                      autoComplete="off"
                      className="input min-h-[84px] px-3.5 py-3 resize-y leading-[1.5]"
                    />
                  ) : c.tipo === "cuerpo" ? (
                    <textarea
                      id={`dlg-${c.k}`}
                      rows={12}
                      value={texto}
                      onChange={(e) => onCampo(c.k, e.target.value)}
                      placeholder={c.ph}
                      autoComplete="off"
                      className="input min-h-[260px] p-3.5 resize-y text-ui leading-[1.6] bg-[var(--color-surface-3)]"
                    />
                  ) : c.tipo === "date" ? (
                    <DatePicker
                      modo="single"
                      id={`dlg-${c.k}`}
                      valor={isoADmy(texto)}
                      minimo={c.minimo ? isoADmy(c.minimo) : undefined}
                      maximo={null}
                      onChange={(v) => onCampo(c.k, dmyAIso(v))}
                    />
                  ) : c.tipo === "tel" ? (
                    // El «+56 9» es un adorno fijo: se escriben solo los 8 dígitos.
                    <CampoTelefono id={`dlg-${c.k}`} value={texto} onChange={(v) => onCampo(c.k, v)} />
                  ) : (
                    <input
                      id={`dlg-${c.k}`}
                      type={c.tipo === "rut" ? "text" : c.tipo ?? "text"}
                      autoCapitalize={c.tipo === "rut" ? "characters" : undefined}
                      value={texto}
                      // El RUT se formatea en cada pulsación: nadie tiene que
                      // escribir los puntos ni el guion.
                      onChange={(e) => onCampo(c.k, c.tipo === "rut" ? fmtRut(e.target.value) : e.target.value)}
                      placeholder={c.ph}
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      className={`input ${c.tipo === "rut" ? "tabular-nums" : ""}`}
                    />
                  )}

                  {c.tipo === "rut" && mensajeRut(texto) ? (
                    <div className="text-cap leading-[1.4] mt-1.5 text-[var(--color-danger-800)]">
                      {mensajeRut(texto)}
                    </div>
                  ) : null}
                  {c.ayuda ? <div className="text-cap leading-[1.4] opacity-66 mt-1.5">{c.ayuda}</div> : null}
                </div>
                </Fragment>
              );
            })}
          </div>

          {children}

          {adjuntos && adjuntos.length > 0 ? (
            <div className="mt-5 border border-[var(--color-line)] rounded-[10px]">
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-[var(--color-surface)] border-b border-[var(--color-divider-soft)]">
                <div className="font-semibold text-cap ">Adjuntos</div>
                <div className="ml-auto text-cap opacity-66 tabular-nums">
                  {nIncluidos} de {adjuntos.length} seleccionados
                </div>
              </div>
              <div className="flex flex-wrap gap-2 px-3.5 py-3.5">
                {adjuntos.map((a, i) => (
                  <button
                    key={a.label}
                    type="button"
                    onClick={() => onToggleAdjunto?.(i)}
                    className="flex items-center gap-2.5 min-h-[38px] px-3 border border-[var(--color-line)] rounded-[10px] text-meta leading-[1.2] cursor-pointer text-left"
                    style={{
                      background: a.incluido ? "var(--color-text)" : "transparent",
                      color: a.incluido ? "var(--color-bg)" : "var(--color-text)",
                    }}
                  >
                    <span className="w-4 h-4 flex-none border-2 border-current grid place-items-center">
                      {a.incluido ? (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                          <path d="M4 12l5 5L20 6" />
                        </svg>
                      ) : null}
                    </span>
                    <span>{a.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {motivoDe ? (
            <MotivoDesactivacion
              que={motivoDe.desactiva ?? "este registro"}
              inicial={String(form[claveMotivo(motivoDe)] ?? "")}
              onConfirmar={(motivo) => {
                // Primero el motivo y después el estado: quien escucha recibe
                // el formulario completo en el segundo cambio.
                onCampo(claveMotivo(motivoDe), motivo);
                onCampo(motivoDe.k, false);
                setMotivoDe(null);
              }}
              onCancelar={() => setMotivoDe(null)}
            />
          ) : null}

          {nota ? <p className="mt-4.5 mb-0 text-cap opacity-66">{nota}</p> : null}

        </div>

        <div className="sd-foot">
          <button type="button" className="btn-out" onClick={onCerrar}>
            Cancelar
          </button>
          <button type="button" className="btn-pri" onClick={onGuardar} disabled={guardando}>
            <Espera activo={guardando} accion="Guardando">{cta}</Espera>
          </button>
        </div>
      </div>
      {descartar ? (
        <Confirmar
          cfg={{
            titulo: "¿Descartar lo escrito?",
            texto: "El panel se cierra y lo que no guardaste se pierde.",
            cta: "Descartar",
            accion: () => alCerrar.current(),
          }}
          onCerrar={() => setDescartar(false)}
        />
      ) : null}
    </div>
  );
}

/**
 * Varias opciones marcables a la vez, con filtro al escribir cuando la lista es
 * larga. Es lo que usa "Motivo de la visita": una visita puede venir por más de
 * una cosa y antes obligaba a elegir una sola.
 */
export function CasillasMultiples({
  valor,
  opciones,
  onCambiar,
}: {
  valor: string;
  opciones: OpcionCampo[];
  onCambiar: (v: string) => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const marcados = leerChecks(valor);
  const q = sinTildes(busqueda.trim());
  const visibles = q ? opciones.filter((o) => sinTildes(o.t).includes(q)) : opciones;
  // Con secciones, cada una se despliega por separado; sin ellas, la lista de siempre.
  const grupos = hayAlgunaSeccion(opciones) ? agruparPorSeccion(visibles) : null;

  function alternar(codigo: string) {
    onCambiar(
      escribirChecks(marcados.includes(codigo) ? marcados.filter((c) => c !== codigo) : [...marcados, codigo])
    );
  }

  const casilla = (o: OpcionCampo) => {
    const activo = marcados.includes(o.v);
    return (
      <button key={o.v} type="button" role="checkbox" aria-checked={activo} onClick={() => alternar(o.v)} className="mot-opt">
        {o.t}
      </button>
    );
  };

  return (
    <div className="mot-caja">
      {opciones.length >= MINIMO_PARA_BUSCAR ? (
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Filtrar…"
          aria-label="Filtrar opciones"
          autoComplete="off"
          className="input mot-filtro"
        />
      ) : null}
      {grupos ? (
        <div className="max-h-[300px] overflow-y-auto p-2 flex flex-col gap-3.5">
          {grupos.map((g) => {
            const marcadosAca = g.items.filter((o) => marcados.includes(o.v)).length;
            return (
              <SeccionPlegable
                key={g.nombre ?? "__sin"}
                titulo={g.nombre ?? "Sin sección"}
                total={g.items.length}
                marcados={marcadosAca}
                abiertaInicial={marcadosAca > 0}
                forzarAbierta={Boolean(q)}
              >
                <div className="flex flex-wrap gap-1.5">{g.items.map(casilla)}</div>
              </SeccionPlegable>
            );
          })}
          {visibles.length === 0 ? (
            <div className="px-1 py-1.5 text-meta opacity-66">Nada coincide con «{busqueda}».</div>
          ) : null}
        </div>
      ) : (
        <div className="max-h-[190px] overflow-y-auto p-2 flex flex-wrap gap-1.5">
          {visibles.map(casilla)}
          {visibles.length === 0 ? (
            <div className="px-1 py-1.5 text-meta opacity-66">Nada coincide con «{busqueda}».</div>
          ) : null}
        </div>
      )}
      <div className="px-3 py-1.5 border-t border-[var(--color-divider)] text-cap opacity-62 tabular-nums">
        {marcados.length} {marcados.length === 1 ? "marcado" : "marcados"}
      </div>
    </div>
  );
}
