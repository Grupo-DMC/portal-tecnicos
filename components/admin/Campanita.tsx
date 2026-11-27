"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as KeyboardEventReact,
  type ReactNode,
} from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import Espera from "@/components/ui/Espera";
import { Sk } from "@/components/ui/Skeleton";
import { Toast, useToast } from "@/components/ui/Toast";
import {
  guardarConfiguracionAvisosAction,
  marcarNotificacionesLeidasAction,
} from "@/app/actions/notificaciones";
import {
  cuandoFue,
  gruposVisibles,
  nivelDe,
  tipoNotificacion,
  type BandejaNotificaciones,
  type NivelAviso,
  type Notificacion,
} from "@/lib/notificaciones";
import { plural } from "@/lib/ui/plural";
import { enSegundaPersona } from "@/lib/ui/segunda-persona";

// La campanita del panel: lo que pasa en el sistema, con número rojo para lo
// que cada uno pidió que le avise (ver lib/notificaciones.ts). El panel es la
// hoja lateral `.sheet.ntf` de la demo (panel-operacion.html).
//
// Leídas: como en la demo, cada aviso se marca leído al tocarlo y eso se guarda
// en este navegador. En el servidor se guarda «leído hasta» (un solo número):
// avanza con «Marcar todo como leído» o cuando ya se leyeron todos uno a uno.
//
// Pregunta cada 30 s con la pestaña a la vista y cada 2 min escondida. La
// consulta no renueva la sesión (proxy.ts): el panel abierto no la mantiene viva.

const CADA_VISIBLE = 30_000;
const CADA_OCULTA = 120_000;

/** Los avisos del navegador se encienden por equipo: viven en este navegador. */
const claveNavegador = (uid: number) => `dmc:avisos-navegador:${uid}`;

/** El sonido también se enciende por equipo. */
const claveSonido = (uid: number) => `dmc:sonido:${uid}`;

let audio: AudioContext | null = null;

/** Un «ding» corto generado por código (sin archivo). Falla en silencio si el navegador lo bloquea. */
function sonar() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    audio ??= new Ctx();
    const ctx = audio;
    void ctx.resume();
    const t = ctx.currentTime;
    const ganancia = ctx.createGain();
    ganancia.connect(ctx.destination);
    ganancia.gain.setValueAtTime(0.0001, t);
    ganancia.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    ganancia.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    for (const [freq, inicio] of [
      [880, 0],
      [1320, 0.12],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(ganancia);
      osc.start(t + inicio);
      osc.stop(t + 0.45);
    }
  } catch {
    // Sin audio disponible: no pasa nada.
  }
}

function claveAServidor(base64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const bin = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const salida = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) salida[i] = bin.charCodeAt(i);
  return salida;
}

/**
 * Suscribe este navegador a los avisos push, para recibirlos con el navegador
 * cerrado. Sin soporte o sin claves en el servidor no hace nada: los avisos
 * con el panel abierto siguen funcionando.
 */
async function suscribirPush(): Promise<void> {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    const r = await fetch("/api/push", { cache: "no-store" });
    if (!r.ok) return;
    const { clave } = (await r.json()) as { clave: string | null };
    if (!clave) return;
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: claveAServidor(clave),
      }));
    await fetch("/api/push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    });
  } catch {
    // Sin push: queda el aviso con el panel abierto.
  }
}

async function darDeBajaPush(): Promise<void> {
  try {
    if (!("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await fetch("/api/push", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
    await sub.unsubscribe();
  } catch {
    // Si no se pudo, el servidor la borra solo cuando el navegador la da por muerta.
  }
}

function leerLocal(clave: string): string | null {
  try {
    return window.localStorage.getItem(clave);
  } catch {
    return null;
  }
}
function escribirLocal(clave: string, valor: string | null) {
  try {
    if (valor === null) window.localStorage.removeItem(clave);
    else window.localStorage.setItem(clave, valor);
  } catch {
    // Sin almacenamiento (modo privado): el ajuste dura lo que la pestaña.
  }
}

type Pestana = "todo" | "avisos" | "mias";

/** Avisos leídos uno a uno en este navegador (los ids). */
const claveLeidas = (uid: number) => `dmc:ntf-leidas:${uid}`;

function leerLeidas(uid: number): Set<number> {
  try {
    const crudo = JSON.parse(leerLocal(claveLeidas(uid)) ?? "[]") as unknown;
    return new Set(
      Array.isArray(crudo)
        ? crudo.filter((x): x is number => typeof x === "number")
        : [],
    );
  } catch {
    return new Set();
  }
}

const NIVELES_SEG: [NivelAviso, string, string][] = [
  ["AVISAR", "Avisar", "lv-a"],
  ["MOSTRAR", "Mostrar", "lv-m"],
  ["OCULTAR", "Ocultar", "lv-o"],
];

/** Origen del aviso, como la etiqueta de la demo (Terreno, Panel, Seguimiento, Maestros). */
function categoria(tipo: string): {
  c: "tec" | "pan" | "seg" | "mae";
  label: string;
} {
  if (tipo.startsWith("tecnico.")) return { c: "tec", label: "Terreno" };
  if (tipo.startsWith("visita.") || tipo.startsWith("acta."))
    return { c: "pan", label: "Panel" };
  if (tipo.startsWith("problema.") || tipo.startsWith("gestion."))
    return { c: "seg", label: "Seguimiento" };
  return { c: "mae", label: "Maestros" };
}

function iniciales(nombre: string): string {
  const base = nombre.includes("@")
    ? nombre.split("@")[0].replace(/[._-]+/g, " ")
    : nombre;
  const partes = base.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const dos =
    partes.length === 1
      ? partes[0].slice(0, 2)
      : partes[0][0] + partes[partes.length - 1][0];
  return dos.toUpperCase();
}

/** Hoy, Ayer o Antes, para los separadores de la lista. */
function diaDe(creadoEn: string, ahora = new Date()): string {
  const f = new Date(creadoEn);
  const cero = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dias = Math.round((cero(ahora) - cero(f)) / 864e5);
  return dias <= 0 ? "Hoy" : dias === 1 ? "Ayer" : "Antes";
}

/** El folio va en negrita, como en la demo. */
function conFolios(texto: string): ReactNode[] {
  return texto.split(/(V-\d{4}-\d{3,})/).map((parte, i) =>
    i % 2 ? (
      <b key={i} className="num">
        {parte}
      </b>
    ) : (
      parte
    ),
  );
}

/** Quién, qué y la línea de abajo; la solicitud de contraseña no tiene cuenta detrás. */
function partesDe(n: Notificacion): {
  quien: string;
  ic: string;
  texto: string;
  sub: string | null;
  sub2: string | null;
} {
  if (n.propia)
    return {
      quien: "Tú",
      ic: "TÚ",
      texto: enSegundaPersona(n.texto),
      sub: n.detalle,
      sub2: null,
    };
  if (!n.actor && n.tipo === "cuenta.password" && n.detalle) {
    return {
      quien: n.detalle,
      ic: iniciales(n.detalle),
      texto: "pidió una contraseña nueva",
      sub: "Se atiende en Usuarios, Contraseñas pedidas.",
      sub2: null,
    };
  }
  const quien = n.actor ?? "El sistema";
  return {
    quien,
    ic: n.actor ? iniciales(n.actor) : "ST",
    texto: n.texto,
    sub: n.detalle,
    sub2: null,
  };
}

/** Lleva el foco con Tab dentro de la hoja abierta. */
function atraparFoco(e: KeyboardEvent, hoja: HTMLElement) {
  const f = [
    ...hoja.querySelectorAll<HTMLElement>(
      "button, input, select, textarea, a[href]",
    ),
  ].filter(
    (x) =>
      !(x as HTMLButtonElement).disabled &&
      x.offsetParent !== null &&
      x.tabIndex !== -1,
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

function IconoCampana({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      aria-hidden
    >
      <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

const IcoAjustes = () => (
  <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </svg>
);
const IcoVolver = () => (
  <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
    <path d="m15 6-6 6 6 6" />
  </svg>
);

export default function Campanita({
  usuarioId,
  permisos,
}: {
  usuarioId: number;
  permisos: string[];
  /** «barra»: la del celular, arriba. «menu»: la cabecera del menú de escritorio. Se ven igual (`.icon-btn`). */
  variante: "barra" | "menu";
}) {
  const [bandeja, setBandeja] = useState<BandejaNotificaciones | null>(null);
  const [abierta, setAbierta] = useState(false);
  const [vista, setVista] = useState<"lista" | "ajustes">("lista");
  const [pestana, setPestana] = useState<Pestana>("todo");
  const [falla, setFalla] = useState(false);
  const [leidas, setLeidas] = useState<Set<number>>(() => new Set());
  const { toast, aviso } = useToast();
  const avisadas = useRef<number>(0);
  const hoja = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const botonAjustes = useRef<HTMLButtonElement>(null);
  const devolverFoco = useRef(true);

  useEffect(() => setLeidas(leerLeidas(usuarioId)), [usuarioId]);

  const guardarLeidas = useCallback(
    (s: Set<number>) => {
      setLeidas(s);
      escribirLocal(
        claveLeidas(usuarioId),
        s.size ? JSON.stringify([...s]) : null,
      );
    },
    [usuarioId],
  );

  const cargar = useCallback(async () => {
    try {
      const r = await fetch("/api/notificaciones", {
        cache: "no-store",
        headers: { accept: "application/json" },
      });
      if (!r.ok) {
        setFalla(true);
        return null;
      }
      const datos = (await r.json()) as BandejaNotificaciones;
      setBandeja(datos);
      setFalla(false);
      return datos;
    } catch {
      setFalla(true);
      return null;
    }
  }, []);

  // Aviso del navegador para lo nuevo que avisa, si se encendió en este equipo.
  const avisarNavegador = useCallback(
    (datos: BandejaNotificaciones) => {
      const nuevas = datos.items.filter(
        (n) => n.nueva && n.id > avisadas.current,
      );
      const mayor = datos.items.reduce(
        (m, n) => Math.max(m, n.id),
        avisadas.current,
      );
      // La primera carga solo fija desde dónde contar: no se avisa lo que ya estaba.
      const primera = avisadas.current === 0;
      avisadas.current = mayor;
      if (primera || nuevas.length === 0) return;
      if (leerLocal(claveSonido(usuarioId)) === "1") sonar();
      if (leerLocal(claveNavegador(usuarioId)) !== "1") return;
      if (
        typeof Notification === "undefined" ||
        Notification.permission !== "granted"
      )
        return;
      for (const n of nuevas.slice(0, 3).reverse()) {
        try {
          const aviso = new Notification(
            n.actor ? `${n.actor} ${n.texto}` : n.texto,
            {
              body: n.detalle ?? undefined,
              tag: `dmc-${n.id}`,
              icon: "/DMC-logo.png",
            },
          );
          aviso.onclick = () => {
            window.focus();
            if (n.enlace) window.location.assign(n.enlace);
          };
        } catch {
          // Algunos navegadores solo permiten avisos desde un service worker.
        }
      }
    },
    [usuarioId],
  );

  // Si los avisos están encendidos en este equipo, deja la suscripción push al
  // día (por ejemplo tras entrar con otra cuenta en el mismo navegador).
  useEffect(() => {
    if (leerLocal(claveNavegador(usuarioId)) !== "1") return;
    if (
      typeof Notification === "undefined" ||
      Notification.permission !== "granted"
    )
      return;
    void suscribirPush();
  }, [usuarioId]);

  // Consulta periódica, más espaciada con la pestaña escondida.
  useEffect(() => {
    let vivo = true;
    let timer: ReturnType<typeof setTimeout>;
    const ciclo = async () => {
      const datos = await cargar();
      if (!vivo) return;
      if (datos) avisarNavegador(datos);
      timer = setTimeout(ciclo, document.hidden ? CADA_OCULTA : CADA_VISIBLE);
    };
    void ciclo();
    const alVolver = () => {
      if (document.hidden) return;
      clearTimeout(timer);
      void ciclo();
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      vivo = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [cargar, avisarNavegador]);

  const items = useMemo(() => bandeja?.items ?? [], [bandeja]);
  const niveles = bandeja?.configuracion.niveles ?? {};
  const verPropios = bandeja?.configuracion.verPropios ?? true;
  const avisa = (n: Notificacion) =>
    !n.propia && nivelDe(niveles, n.tipo) === "AVISAR";
  const sinLeer = (n: Notificacion) => n.nueva && !leidas.has(n.id);
  // El servidor cuenta hasta 99 nuevas; se descuentan las que ya se leyeron aquí.
  const noLeidas = Math.max(
    0,
    (bandeja?.noLeidas ?? 0) -
      items.filter((n) => n.nueva && leidas.has(n.id)).length,
  );
  const mayorId = items.reduce((m, n) => Math.max(m, n.id), 0);

  async function marcarTodo(silencioso = false) {
    if (!bandeja) return;
    setBandeja({
      ...bandeja,
      noLeidas: 0,
      items: bandeja.items.map((n) => ({ ...n, nueva: false })),
    });
    guardarLeidas(new Set());
    if (mayorId > 0) await marcarNotificacionesLeidasAction(mayorId);
    if (!silencioso) aviso("Todo marcado como leído.");
  }

  function leer(n: Notificacion) {
    if (!sinLeer(n)) return;
    const s = new Set(leidas).add(n.id);
    // Leídas todas una a una: se avanza también en el servidor.
    if (items.every((x) => !x.nueva || s.has(x.id))) void marcarTodo(true);
    else guardarLeidas(s);
  }

  function abrir() {
    devolverFoco.current = true;
    setAbierta(true);
    setVista("lista");
    void cargar();
  }

  const cerrar = useCallback((restaurar = true) => {
    devolverFoco.current = restaurar;
    setAbierta(false);
  }, []);

  // Al abrir: foco en la X (como openDialog de la demo), sin desplazar la página,
  // Esc cierra y Tab no sale de la hoja. Al cerrar, el foco vuelve a la campana.
  useEffect(() => {
    if (!abierta) return;
    const desplazamiento = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    hoja.current?.querySelector<HTMLElement>("[data-close]")?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
      else if (e.key === "Tab" && hoja.current) atraparFoco(e, hoja.current);
    };
    document.addEventListener("keydown", tecla);
    const btn = boton.current;
    return () => {
      document.removeEventListener("keydown", tecla);
      document.body.style.overflow = desplazamiento;
      if (devolverFoco.current) btn?.focus();
    };
  }, [abierta, cerrar]);

  const lista = items.filter((n) =>
    pestana === "mias" ? n.propia : pestana === "avisos" ? avisa(n) : true,
  );
  const pestanas: [Pestana, string, number][] = [
    ["todo", "Todo", items.length],
    ["avisos", "Avisos", noLeidas],
    ...(verPropios
      ? ([["mias", "Mis cambios", 0]] as [Pestana, string, number][])
      : []),
  ];
  const pestanaActual = pestanas.some((t) => t[0] === pestana)
    ? pestana
    : "todo";

  function teclaPestanas(e: KeyboardEventReact<HTMLDivElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const i = pestanas.findIndex((t) => t[0] === pestanaActual);
    const sig =
      pestanas[
        (i + (e.key === "ArrowRight" ? 1 : pestanas.length - 1)) %
          pestanas.length
      ][0];
    setPestana(sig);
    e.currentTarget.querySelector<HTMLElement>(`[data-ntab="${sig}"]`)?.focus();
  }

  const dias = lista.map((n) => diaDe(n.creadoEn));

  return (
    <>
      <button
        ref={boton}
        type="button"
        onClick={() => (abierta ? cerrar() : abrir())}
        aria-label={
          noLeidas
            ? `Notificaciones, ${plural(noLeidas, "aviso nuevo", "avisos nuevos")}`
            : "Notificaciones"
        }
        aria-expanded={abierta}
        aria-haspopup="dialog"
        className="icon-btn"
      >
        <IconoCampana />
        {noLeidas ? (
          <span className="ntf-badge num">
            {noLeidas > 9 ? "9+" : noLeidas}
          </span>
        ) : null}
      </button>

      {abierta && typeof document !== "undefined"
        ? createPortal(
            // Va colgada del body: lleva su propio `.dmc` para tomar el estilo.
            <div className="dmc">
              <div className="ov" onClick={() => cerrar()} />
              <div
                ref={hoja}
                className="sheet ntf"
                role="dialog"
                aria-modal="true"
                aria-labelledby={vista === "lista" ? "ntTitle" : "ntCfgTitle"}
              >
                <div className="m-form">
                  {vista === "ajustes" && bandeja ? (
                    <Ajustes
                      usuarioId={usuarioId}
                      permisos={permisos}
                      bandeja={bandeja}
                      aviso={aviso}
                      alVolver={() => {
                        setVista("lista");
                        requestAnimationFrame(() =>
                          botonAjustes.current?.focus(),
                        );
                      }}
                      alGuardar={(nueva) => {
                        setBandeja(nueva);
                        setVista("lista");
                        requestAnimationFrame(() =>
                          botonAjustes.current?.focus(),
                        );
                      }}
                      alCerrar={() => cerrar()}
                    />
                  ) : (
                    <>
                      <header className="m-head ntf-head">
                        <div>
                          <h2 id="ntTitle">Notificaciones</h2>
                          <p className="m-sub ntf-subl">
                            {bandeja ? (
                              <span>
                                {noLeidas
                                  ? plural(
                                      noLeidas,
                                      "aviso sin leer",
                                      "avisos sin leer",
                                    )
                                  : "Estás al día"}
                              </span>
                            ) : null}
                            {items.some(sinLeer) ? (
                              <button
                                className="link"
                                type="button"
                                onClick={() => void marcarTodo()}
                              >
                                Marcar todo como leído
                              </button>
                            ) : null}
                          </p>
                        </div>
                        <span className="ntf-hb">
                          <button
                            ref={botonAjustes}
                            className="icon-btn"
                            type="button"
                            aria-label="Qué quiero ver"
                            title="Qué quiero ver"
                            disabled={!bandeja}
                            onClick={() => setVista("ajustes")}
                          >
                            <IcoAjustes />
                          </button>
                          <button
                            className="icon-btn"
                            type="button"
                            data-close
                            aria-label="Cerrar"
                            onClick={() => cerrar()}
                          >
                            ✕
                          </button>
                        </span>
                      </header>
                      <div className="ntf-bar">
                        <div
                          className="v-tabs"
                          role="tablist"
                          aria-label="Qué mostrar"
                          onKeyDown={teclaPestanas}
                        >
                          {pestanas.map(([k, l, c]) => (
                            <button
                              key={k}
                              type="button"
                              role="tab"
                              data-ntab={k}
                              aria-selected={pestanaActual === k}
                              tabIndex={pestanaActual === k ? 0 : -1}
                              onClick={() => setPestana(k)}
                            >
                              {l}
                              {k !== "mias" && c ? (
                                <span className="num">{c}</span>
                              ) : null}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div
                        className="m-body ntf-body"
                        role="tabpanel"
                        aria-label="Notificaciones"
                      >
                        {!bandeja ? (
                          falla ? (
                            <div className="ntf-empty">
                              <b>No se pudo cargar</b>
                              <span>Se reintenta solo.</span>
                            </div>
                          ) : (
                            <SiluetaLista />
                          )
                        ) : lista.length === 0 ? (
                          <div className="ntf-empty">
                            <b>
                              {pestanaActual === "avisos"
                                ? "Sin avisos pendientes"
                                : "Nada por aquí"}
                            </b>
                            <span>
                              {pestanaActual === "avisos"
                                ? "Cuando un técnico cierre un acta o pida algo, aparecerá aquí."
                                : "Todavía no hay movimientos."}
                            </span>
                          </div>
                        ) : (
                          <ol className="ntf-list">
                            {lista.map((n, i) => {
                              const d = dias[i];
                              const cabecera = i === 0 || d !== dias[i - 1] ? <li className="ntf-day">{d}</li> : null;
                              const lv = n.propia
                                ? "mine"
                                : nivelDe(niveles, n.tipo) === "AVISAR"
                                  ? "a"
                                  : "m";
                              const cat = categoria(n.tipo);
                              const p = partesDe(n);
                              const nuevo = sinLeer(n) && lv === "a";
                              const clases = `ntf-it${nuevo ? " unread" : ""} lv-${lv} c-${n.propia ? "mine" : cat.c}`;
                              const contenido = (
                                <>
                                  <span className="ntf-ic" aria-hidden="true">
                                    {p.ic}
                                  </span>
                                  <span className="ntf-tx">
                                    <span className="ntf-t">
                                      <b>{p.quien}</b> {conFolios(p.texto)}
                                    </span>
                                    {p.sub ? (
                                      <span className="ntf-s">{p.sub}</span>
                                    ) : null}
                                    {p.sub2 ? (
                                      <span className="ntf-s2">{p.sub2}</span>
                                    ) : null}
                                    <span className="ntf-m num">
                                      {cuandoFue(n.creadoEn)}
                                      {n.deTecnico ? ", desde el celular" : ""}
                                      {!n.propia ? (
                                        <span className="ntf-cat">
                                          {cat.label}
                                        </span>
                                      ) : null}
                                      {nuevo ? (
                                        <span className="ntf-new">Nuevo</span>
                                      ) : null}
                                    </span>
                                  </span>
                                </>
                              );
                              return (
                                <Fragment key={n.id}>
                                  {cabecera}
                                  <li>
                                    {n.enlace ? (
                                      <Link
                                        className={clases}
                                        href={n.enlace}
                                        onClick={() => {
                                          leer(n);
                                          cerrar(false);
                                        }}
                                      >
                                        {contenido}
                                      </Link>
                                    ) : (
                                      <a
                                        className={clases}
                                        href="#"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          leer(n);
                                        }}
                                      >
                                        {contenido}
                                      </a>
                                    )}
                                  </li>
                                </Fragment>
                              );
                            })}
                          </ol>
                        )}
                        {falla && bandeja ? (
                          <p className="msg ntf-falla" role="status">
                            <span>
                              Sin conexión con el servidor: lo que ves puede
                              estar atrasado.
                            </span>
                          </p>
                        ) : null}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      <Toast texto={toast} variante="panel" />
    </>
  );
}

/** Silueta de la lista mientras llega la primera carga (sin «Cargando…»). */
function SiluetaLista() {
  return (
    <div role="status" aria-busy="true" aria-label="Cargando notificaciones">
      <div className="ntf-day">
        <Sk w={34} h={10} />
      </div>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="ntf-it" aria-hidden="true">
          <Sk w={34} h={34} r={10} />
          <span className="ntf-tx">
            <Sk w={`${88 - i * 9}%`} h={13} />
            <Sk w="55%" h={11} />
            <Sk w={110} h={10} />
          </span>
        </div>
      ))}
    </div>
  );
}

function Ajustes({
  usuarioId,
  permisos,
  bandeja,
  aviso,
  alVolver,
  alGuardar,
  alCerrar,
}: {
  usuarioId: number;
  permisos: string[];
  bandeja: BandejaNotificaciones;
  aviso: (t: string) => void;
  alVolver: () => void;
  alGuardar: (b: BandejaNotificaciones) => void;
  alCerrar: () => void;
}) {
  const grupos = gruposVisibles(permisos);
  const recomendados = () => {
    const todos: Record<string, NivelAviso> = {};
    for (const g of grupos)
      for (const t of g.tipos)
        todos[t.clave] = tipoNotificacion(t.clave)?.defecto ?? "MOSTRAR";
    return todos;
  };
  const [niveles, setNiveles] = useState(() => {
    const todos: Record<string, NivelAviso> = {};
    for (const g of grupos)
      for (const t of g.tipos)
        todos[t.clave] = nivelDe(bandeja.configuracion.niveles, t.clave);
    return todos;
  });
  const [verPropios, setVerPropios] = useState(
    bandeja.configuracion.verPropios,
  );
  const [navegador, setNavegador] = useState(
    () => leerLocal(claveNavegador(usuarioId)) === "1",
  );
  const [sonido, setSonido] = useState(
    () => leerLocal(claveSonido(usuarioId)) === "1",
  );
  const [msgNavegador, setMsgNavegador] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const volver = useRef<HTMLButtonElement>(null);

  useEffect(() => volver.current?.focus(), []);

  async function cambiarNavegador(encender: boolean) {
    setMsgNavegador("");
    setNavegador(encender);
    if (!encender) return;
    if (typeof Notification === "undefined") {
      setMsgNavegador("Este navegador no permite avisos.");
      setNavegador(false);
      return;
    }
    try {
      const permiso =
        Notification.permission === "default"
          ? await Notification.requestPermission()
          : Notification.permission;
      if (permiso !== "granted") {
        setMsgNavegador(
          "El navegador no dio permiso. Puedes activarlo en el candado de la barra de direcciones.",
        );
        setNavegador(false);
      }
    } catch {
      setMsgNavegador("No se pudo pedir permiso desde aquí.");
      setNavegador(false);
    }
  }

  function elegir(clave: string, nivel: NivelAviso, enfocar = false) {
    setNiveles((prev) => ({ ...prev, [clave]: nivel }));
    if (enfocar)
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLElement>(
            `[data-rk="${clave}"][data-rv="${nivel}"]`,
          )
          ?.focus(),
      );
  }

  function teclaSeg(e: KeyboardEventReact<HTMLButtonElement>, clave: string) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const i = NIVELES_SEG.findIndex((x) => x[0] === niveles[clave]);
    elegir(
      clave,
      NIVELES_SEG[(i + (e.key === "ArrowRight" ? 1 : 2)) % 3][0],
      true,
    );
  }

  async function guardar() {
    setGuardando(true);
    setError("");
    const r = await guardarConfiguracionAvisosAction({ verPropios, niveles });
    setGuardando(false);
    if (!r.ok || !r.bandeja) {
      setError(r.error ?? "No se pudo guardar.");
      return;
    }
    // Sonido y avisos del navegador son de este equipo: se guardan aquí.
    const teniaSonido = leerLocal(claveSonido(usuarioId)) === "1";
    escribirLocal(claveSonido(usuarioId), sonido ? "1" : null);
    if (sonido && !teniaSonido) sonar();
    const teniaNavegador = leerLocal(claveNavegador(usuarioId)) === "1";
    escribirLocal(claveNavegador(usuarioId), navegador ? "1" : null);
    if (navegador && !teniaNavegador) void suscribirPush();
    if (!navegador && teniaNavegador) void darDeBajaPush();
    aviso("Preferencias de notificaciones guardadas.");
    alGuardar(r.bandeja);
  }

  return (
    <>
      <header className="m-head ntf-head">
        <button
          ref={volver}
          className="icon-btn"
          type="button"
          aria-label="Volver a las notificaciones"
          onClick={alVolver}
        >
          <IcoVolver />
        </button>
        <div className="ntf-ct">
          <h2 id="ntCfgTitle">Qué quiero ver</h2>
        </div>
        <button
          className="icon-btn"
          type="button"
          data-close
          aria-label="Cerrar"
          onClick={alCerrar}
        >
          ✕
        </button>
      </header>
      <div className="m-body ntf-body">
        <p className="ntf-legend">
          <b className="lv-a">Avisar</b> suma al número rojo.{" "}
          <b className="lv-m">Mostrar</b> lo deja en la lista sin avisar.{" "}
          <b className="lv-o">Ocultar</b> no lo muestra. Vale para lo que hacen
          los demás.
        </p>
        <div className="ntf-sw">
          <label className="check-row">
            <input
              type="checkbox"
              checked={verPropios}
              onChange={(e) => setVerPropios(e.target.checked)}
            />
            <span>
              <b>Mostrar mis propios cambios</b>
              <small>
                Lo que creas, editas o eliminas, en «Mis cambios». Nunca suma al
                número.
              </small>
            </span>
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={navegador}
              onChange={(e) => void cambiarNavegador(e.target.checked)}
            />
            <span>
              <b>Avisos del navegador en este equipo</b>
              <small>
                Un aviso en pantalla con lo que es «Avisar», aunque estés en
                otra pestaña.
              </small>
            </span>
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={sonido}
              onChange={(e) => {
                setSonido(e.target.checked);
                if (e.target.checked) sonar(); // el clic desbloquea el audio y sirve de prueba
              }}
            />
            <span>
              <b>Sonido al llegar un aviso</b>
              <small>Un «ding» corto con lo que es «Avisar».</small>
            </span>
          </label>
          {msgNavegador ? (
            <p className="msg" role="alert">
              <span>{msgNavegador}</span>
            </p>
          ) : null}
        </div>
        <div>
          {grupos.map((g) => (
            <section key={g.clave} className="ntf-g">
              <h3>{g.label}</h3>
              {g.tipos.map((t) => (
                <div key={t.clave} className="ntf-r">
                  <span id={`ntl-${t.clave}`}>{t.label}</span>
                  <span
                    className="ntf-seg"
                    role="radiogroup"
                    aria-labelledby={`ntl-${t.clave}`}
                  >
                    {NIVELES_SEG.map(([v, label, clase]) => (
                      <button
                        key={v}
                        type="button"
                        role="radio"
                        aria-checked={niveles[t.clave] === v}
                        className={clase}
                        data-rk={t.clave}
                        data-rv={v}
                        tabIndex={niveles[t.clave] === v ? 0 : -1}
                        onClick={() => elegir(t.clave, v)}
                        onKeyDown={(e) => teclaSeg(e, t.clave)}
                      >
                        {label}
                      </button>
                    ))}
                  </span>
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
      <footer className="m-foot">
        {error ? (
          <p
            className="msg"
            role="alert"
            style={{ marginRight: "auto", alignSelf: "center" }}
          >
            <span>{error}</span>
          </p>
        ) : null}
        <button
          className="btn-out"
          type="button"
          onClick={() => {
            setNiveles(recomendados());
            setVerPropios(true);
            aviso("Volviste a lo recomendado. Falta guardar.");
          }}
        >
          Volver a lo recomendado
        </button>
        <button
          className="btn-pri"
          type="button"
          disabled={guardando}
          onClick={() => void guardar()}
        >
          <Espera activo={guardando} accion="Guardando">
            Guardar
          </Espera>
        </button>
      </footer>
    </>
  );
}
