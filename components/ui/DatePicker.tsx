"use client";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { dmyAIso, hoyISO, isoADmy, sumarDias } from "@/lib/ui/fecha";

/*
 * Selector de fechas del sistema (porta RangoFechas.jsx de sys_clientes, con la forma pedida para técnicos):
 * ventana de dos columnas, atajos a la izquierda (solo en modo `range`) y calendario a la derecha;
 * extremos en cuadrados morados, franja lila entre ellos, hoy con borde, días fuera de rango
 * desactivados y un punto bajo los días con visitas. Pie con el período en texto, Limpiar y Aplicar.
 * En el celular (≤640 px) se abre como panel inferior. Recibe y devuelve fechas 'dd-mm-aaaa'.
 */

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS = ["L", "M", "M", "J", "V", "S", "D"];

interface Comun {
  id?: string;
  /** Nombre accesible del campo (si no hay <label htmlFor>). */
  etiqueta?: string;
  placeholder?: string;
  /** Primer día elegible, 'dd-mm-aaaa'. Ej.: hoy para Reagendar o Nueva visita. */
  minimo?: string;
  /** Último día elegible, 'dd-mm-aaaa'. En modo `range` vale hoy si no se indica; `null` lo quita. */
  maximo?: string | null;
  invalido?: boolean;
  deshabilitado?: boolean;
  /** Marca los días con visitas (consulta /api/visitas/actividad, una vez por mes). */
  actividad?: boolean;
  className?: string;
  "aria-describedby"?: string;
}
export type DatePickerProps =
  | (Comun & { modo: "range"; desde: string; hasta: string; onChange: (desde: string, hasta: string) => void })
  | (Comun & { modo: "single"; valor: string; onChange: (valor: string) => void });

/* ---------- fechas en ISO ---------- */
const partes = (iso: string) => iso.split("-").map(Number) as [number, number, number];
const isoDe = (a: number, m: number, d: number) => `${a}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const diasDelMes = (a: number, m: number) => new Date(Date.UTC(a, m + 1, 0)).getUTCDate();
const finDeMes = (a: number, m: number) => isoDe(a, m, diasDelMes(a, m));
const corta = (iso: string, conAnio: boolean) => {
  const [a, m, d] = partes(iso);
  return `${d} ${MESES[m - 1].slice(0, 3)}${conAnio ? ` ${a}` : ""}`;
};
const larga = (iso: string) => {
  const [a, m, d] = partes(iso);
  return `${d} de ${MESES[m - 1]} de ${a}`;
};

/** «12 nov – 19 nov 2026», «19 nov 2026», o «» si no hay fechas. */
export function textoPeriodo(desdeIso: string, hastaIso: string): string {
  if (!desdeIso && !hastaIso) return "";
  if (desdeIso && hastaIso) {
    if (desdeIso === hastaIso) return corta(desdeIso, true);
    return `${corta(desdeIso, desdeIso.slice(0, 4) !== hastaIso.slice(0, 4))} – ${corta(hastaIso, true)}`;
  }
  return desdeIso ? `Desde ${corta(desdeIso, true)}` : `Hasta ${corta(hastaIso, true)}`;
}

interface Atajo {
  id: string;
  label: string;
  rango: (hoy: string) => [string, string];
}
export const ATAJOS: Atajo[] = [
  { id: "hoy", label: "Hoy", rango: (h) => [h, h] },
  { id: "7d", label: "Últimos 7 días", rango: (h) => [sumarDias(h, -6), h] },
  { id: "30d", label: "Últimos 30 días", rango: (h) => [sumarDias(h, -29), h] },
  { id: "mes", label: "Este mes", rango: (h) => [`${h.slice(0, 7)}-01`, h] },
  {
    id: "mes-anterior",
    label: "Mes anterior",
    rango: (h) => {
      const [a, m] = partes(h);
      const pa = m === 1 ? a - 1 : a, pm = m === 1 ? 11 : m - 2;
      return [isoDe(pa, pm, 1), finDeMes(pa, pm)];
    },
  },
  { id: "anio", label: "Este año", rango: (h) => [`${h.slice(0, 4)}-01-01`, h] },
  { id: "anio-anterior", label: "Año anterior", rango: (h) => [`${Number(h.slice(0, 4)) - 1}-01-01`, `${Number(h.slice(0, 4)) - 1}-12-31`] },
];

/* Días con visitas: uno por mes y por sesión de la página. */
const cacheActividad = new Map<string, Promise<Record<string, number>>>();
/** Olvida los días con visitas ya leídos (tras agendar, o entre pruebas). */
export function olvidarActividad(): void {
  cacheActividad.clear();
}
function actividadDe(mes: string): Promise<Record<string, number>> {
  let p = cacheActividad.get(mes);
  if (!p) {
    p = fetch(`/api/visitas/actividad?mes=${mes}`, { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : { dias: {} }))
      .then((j: { dias?: Record<string, number> }) => j.dias ?? {})
      .catch(() => ({}));
    cacheActividad.set(mes, p);
  }
  return p;
}

function Icono({ d }: { d: string }) {
  return (
    <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export default function DatePicker(props: DatePickerProps) {
  const { modo, etiqueta, placeholder, invalido, deshabilitado, actividad = true, className } = props;
  const rango = modo === "range";
  const hoy = hoyISO();
  const min = props.minimo ? dmyAIso(props.minimo) : "";
  const max = props.maximo === null ? "" : props.maximo ? dmyAIso(props.maximo) : rango ? hoy : "";
  const valorDesde = rango ? dmyAIso(props.desde) : dmyAIso(props.valor);
  const valorHasta = rango ? dmyAIso(props.hasta) : "";

  const idBase = useId();
  const idCampo = props.id ?? `dp-${idBase}`;
  const campo = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [celular, setCelular] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [borrador, setBorrador] = useState<{ desde: string; hasta: string }>({ desde: "", hasta: "" });
  const [hover, setHover] = useState("");
  const [foco, setFoco] = useState(hoy);
  const [vista, setVista] = useState(() => {
    const [a, m] = partes(valorDesde || hoy);
    return { a, m: m - 1 };
  });
  const [dias, setDias] = useState<Record<string, number>>({});

  const fuera = useCallback((iso: string) => (min && iso < min) || (max && iso > max), [min, max]);

  const abrir = () => {
    if (deshabilitado) return;
    const base = valorDesde || (max && hoy > max ? max : min && hoy < min ? min : hoy);
    const [a, m] = partes(base);
    setVista({ a, m: m - 1 });
    setBorrador({ desde: valorDesde, hasta: valorHasta });
    setFoco(base);
    setHover("");
    setAbierto(true);
  };
  const cerrar = useCallback((devolverFoco = true) => {
    setAbierto(false);
    if (devolverFoco) campo.current?.focus();
  }, []);

  // Posición: bajo el campo (o encima si no cabe); en el celular, panel inferior.
  useLayoutEffect(() => {
    if (!abierto) return;
    const ubicar = () => {
      const esCelular = window.matchMedia("(max-width: 640px)").matches;
      setCelular(esCelular);
      const c = campo.current?.getBoundingClientRect();
      const p = pop.current?.getBoundingClientRect();
      if (!c || !p || esCelular) return setPos(null);
      let top = c.bottom + 6;
      if (top + p.height > window.innerHeight - 8 && c.top - 6 - p.height > 8) top = c.top - 6 - p.height;
      const left = Math.max(8, Math.min(c.left, window.innerWidth - p.width - 8));
      setPos({ top, left });
    };
    ubicar();
    window.addEventListener("resize", ubicar);
    window.addEventListener("scroll", ubicar, true);
    return () => {
      window.removeEventListener("resize", ubicar);
      window.removeEventListener("scroll", ubicar, true);
    };
  }, [abierto]);

  // Clic fuera cierra (sin aplicar).
  useEffect(() => {
    if (!abierto) return;
    const alPulsar = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!pop.current?.contains(t) && !campo.current?.contains(t)) cerrar(false);
    };
    document.addEventListener("pointerdown", alPulsar);
    return () => document.removeEventListener("pointerdown", alPulsar);
  }, [abierto, cerrar]);

  // Puntos de actividad del mes visible.
  const mesVisible = `${vista.a}-${String(vista.m + 1).padStart(2, "0")}`;
  useEffect(() => {
    if (!abierto || !actividad) return;
    let vivo = true;
    void actividadDe(mesVisible).then((d) => vivo && setDias(d));
    return () => {
      vivo = false;
    };
  }, [abierto, actividad, mesVisible]);

  // El foco sigue al día activo dentro de la grilla (también cuando la ventana termina de ubicarse).
  useEffect(() => {
    if (!abierto) return;
    const b = pop.current?.querySelector<HTMLButtonElement>(`[data-dia="${foco}"]`);
    b?.focus({ preventScroll: true });
  }, [abierto, foco, vista, pos, celular]);

  // Esc cierra aunque el foco no haya entrado todavía a la ventana.
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      e.preventDefault();
      e.stopPropagation();
      cerrar();
    };
    document.addEventListener("keydown", alTeclear, true);
    return () => document.removeEventListener("keydown", alTeclear, true);
  }, [abierto, cerrar]);

  const elegir = (iso: string) => {
    if (fuera(iso)) return;
    setFoco(iso);
    if (!rango) return setBorrador({ desde: iso, hasta: "" });
    setBorrador((b) => (!b.desde || b.hasta || iso < b.desde ? { desde: iso, hasta: "" } : { desde: b.desde, hasta: iso }));
  };
  const aplicar = () => {
    if (rango) {
      const d = borrador.desde, h = borrador.hasta || borrador.desde;
      props.onChange(isoADmy(d), isoADmy(h));
    } else props.onChange(isoADmy(borrador.desde));
    cerrar();
  };
  const usarAtajo = (a: Atajo) => {
    let [d, h] = a.rango(hoy);
    if (max && h > max) h = max;
    if (min && d < min) d = min;
    setBorrador({ desde: d, hasta: h });
    const [y, m] = partes(d);
    setVista({ a: y, m: m - 1 });
    setFoco(d);
  };
  const mover = (n: number) =>
    setVista(({ a, m }) => {
      const t = m + n;
      return { a: a + Math.floor(t / 12), m: ((t % 12) + 12) % 12 };
    });

  const alTeclear = (e: KeyboardEvent<HTMLDivElement>) => {
    const paso = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    const enGrilla = (e.target as HTMLElement).dataset?.dia;
    if (paso && enGrilla) {
      e.preventDefault();
      const n = sumarDias(foco, paso);
      setFoco(n);
      const [a, m] = partes(n);
      if (a !== vista.a || m - 1 !== vista.m) setVista({ a, m: m - 1 });
      if (rango && borrador.desde && !borrador.hasta) setHover(n);
    }
    if ((e.key === "PageUp" || e.key === "PageDown") && enGrilla) {
      e.preventDefault();
      mover(e.key === "PageUp" ? -1 : 1);
    }
  };

  const celdas = useMemo(() => {
    const primero = new Date(Date.UTC(vista.a, vista.m, 1)).getUTCDay();
    const hueco = (primero + 6) % 7;
    return [...Array<null>(hueco).fill(null), ...Array.from({ length: diasDelMes(vista.a, vista.m) }, (_, i) => isoDe(vista.a, vista.m, i + 1))];
  }, [vista]);

  const eligiendoFin = rango && !!borrador.desde && !borrador.hasta;
  const finVisible = borrador.hasta || (eligiendoFin && hover && hover >= borrador.desde ? hover : "");
  const atajoActivo = rango ? ATAJOS.find((a) => {
    const [d, h] = a.rango(hoy);
    return d === borrador.desde && (max && h > max ? max : h) === borrador.hasta;
  })?.id : undefined;
  const sigDesactivado = !!max && isoDe(vista.m === 11 ? vista.a + 1 : vista.a, (vista.m + 1) % 12, 1) > max;
  const antDesactivado = !!min && finDeMes(vista.m === 0 ? vista.a - 1 : vista.a, (vista.m + 11) % 12) < min;
  const texto = rango ? textoPeriodo(valorDesde, valorHasta) : valorDesde ? corta(valorDesde, true) : "";
  const textoBorrador = rango ? textoPeriodo(borrador.desde, borrador.hasta) : borrador.desde ? corta(borrador.desde, true) : "";

  // Si cambia el foco a un día que el borrador no tiene, la grilla igual debe mostrarlo.
  useEffect(() => {
    if (!abierto) setHover("");
  }, [abierto]);

  return (
    <>
      <button
        ref={campo}
        id={idCampo}
        type="button"
        className={`input dp-campo${texto ? "" : " vacio"}${className ? ` ${className}` : ""}`}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        data-invalido={invalido || undefined}
        aria-label={etiqueta ? `${etiqueta}${texto ? `: ${texto}` : ""}` : undefined}
        aria-describedby={props["aria-describedby"]}
        disabled={deshabilitado}
        onClick={() => (abierto ? cerrar(false) : abrir())}
      >
        <span>{texto || placeholder || (rango ? "Todas las fechas" : "dd-mm-aaaa")}</span>
        <Icono d="M7 3v4M17 3v4M4 9h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
      </button>
      {abierto && typeof document !== "undefined"
        ? createPortal(
            <div className="dmc dp-capa">
              {celular ? <div className="dp-scrim" onClick={() => cerrar(false)} /> : null}
              <div
                ref={pop}
                role="dialog"
                aria-modal={celular || undefined}
                aria-label={etiqueta ?? (rango ? "Elegir período" : "Elegir fecha")}
                className={`dp-pop${rango ? " con-atajos" : ""}${celular ? " celular" : ""}`}
                style={pos ? { top: pos.top, left: pos.left } : celular ? undefined : { visibility: "hidden", top: 0, left: 0 }}
                onKeyDown={alTeclear}
              >
                {rango ? (
                  <div className="dp-atajos" role="group" aria-label="Atajos">
                    {ATAJOS.map((a) => (
                      <button key={a.id} type="button" className={a.id === "mes" || a.id === "anio" ? "dp-grupo" : undefined} aria-pressed={atajoActivo === a.id} onClick={() => usarAtajo(a)}>
                        {a.label}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="dp-cal" onMouseLeave={() => setHover("")}>
                  <div className="dp-head">
                    <button type="button" className="dp-nav" aria-label="Ver mes anterior" disabled={antDesactivado} onClick={() => mover(-1)}>
                      <Icono d="m15 6-6 6 6 6" />
                    </button>
                    <span className="dp-mes" aria-live="polite">
                      {MESES[vista.m][0].toUpperCase() + MESES[vista.m].slice(1)} {vista.a}
                    </span>
                    <button type="button" className="dp-nav" aria-label="Ver mes siguiente" disabled={sigDesactivado} onClick={() => mover(1)}>
                      <Icono d="m9 6 6 6-6 6" />
                    </button>
                  </div>
                  <div className={`dp-grid${borrador.desde && finVisible ? " con-rango" : ""}`} role="group" aria-label={rango ? "Días del período" : "Días"}>
                    {DIAS.map((d, i) => (
                      <span key={i} className="dp-dow" aria-hidden="true">
                        {d}
                      </span>
                    ))}
                    {celdas.map((iso, i) => {
                      if (!iso) return <span key={`h${i}`} />;
                      const ini = iso === borrador.desde;
                      const fin = !!finVisible && iso === finVisible;
                      const dentro = !!borrador.desde && !!finVisible && iso > borrador.desde && iso < finVisible;
                      const off = !!fuera(iso);
                      const n = dias[iso] ?? 0;
                      const cls = ["dp-dia", ini && "es-ini", fin && "es-fin", dentro && "es-dentro", ini && (fin || !finVisible) && "es-uno", iso === hoy && "es-hoy", n > 0 && "con-visitas"]
                        .filter(Boolean)
                        .join(" ");
                      return (
                        <button
                          key={iso}
                          type="button"
                          data-dia={iso}
                          className={cls}
                          disabled={off}
                          tabIndex={iso === foco ? 0 : -1}
                          aria-pressed={ini || fin}
                          aria-current={iso === hoy ? "date" : undefined}
                          aria-label={`${larga(iso)}${n ? `, ${n} ${n === 1 ? "visita" : "visitas"}` : ""}${ini && rango ? ", inicio" : fin ? ", término" : ""}`}
                          onMouseEnter={() => eligiendoFin && setHover(iso)}
                          onClick={() => elegir(iso)}
                        >
                          {Number(iso.slice(8))}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="dp-pie">
                  <span className="dp-sel" aria-live="polite">
                    {textoBorrador || (rango ? "Todas las fechas" : "Sin fecha")}
                  </span>
                  <span className="dp-botones">
                    <button type="button" className="btn-out sm" onClick={() => setBorrador({ desde: "", hasta: "" })}>
                      Limpiar
                    </button>
                    <button type="button" className="btn-pri sm" onClick={aplicar}>
                      Aplicar
                    </button>
                  </span>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
