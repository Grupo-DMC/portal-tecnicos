"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { guardarConfiguracionAvisosAction, marcarNotificacionesLeidasAction } from "@/app/actions/notificaciones";
import {
  cuandoFue,
  gruposVisibles,
  nivelDe,
  type BandejaNotificaciones,
  type ConfiguracionAvisos,
  type NivelAviso,
  type Notificacion,
} from "@/lib/notificaciones";

// La campanita del panel: lo que pasa en el sistema, con número rojo para lo
// que cada uno pidió que le avise (ver lib/notificaciones.ts).
//
// Pregunta cada 30 s con la pestaña a la vista y cada 2 min escondida. La
// consulta no renueva la sesión (proxy.ts): el panel abierto no la mantiene viva.

const CADA_VISIBLE = 30_000;
const CADA_OCULTA = 120_000;

/** Los avisos del navegador se encienden por equipo: viven en este navegador. */
const claveNavegador = (uid: number) => `dmc:avisos-navegador:${uid}`;

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

type Filtro = "todo" | "avisos" | "mias";

const ETIQUETA_NIVEL: Record<NivelAviso, string> = { AVISAR: "Avisar", MOSTRAR: "Mostrar", OCULTAR: "Ocultar" };

function IconoCampana({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" aria-hidden>
      <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

export default function Campanita({
  usuarioId,
  permisos,
  /** «barra»: la del celular, arriba. «menu»: la cabecera del menú de escritorio. */
  variante,
}: {
  usuarioId: number;
  permisos: string[];
  variante: "barra" | "menu";
}) {
  const [bandeja, setBandeja] = useState<BandejaNotificaciones | null>(null);
  const [abierta, setAbierta] = useState(false);
  const [vista, setVista] = useState<"lista" | "ajustes">("lista");
  const [filtro, setFiltro] = useState<Filtro>("todo");
  const [falla, setFalla] = useState(false);
  // Las que eran nuevas al abrir siguen marcadas mientras el panel esté abierto,
  // aunque en el servidor ya queden vistas.
  const [resaltadas, setResaltadas] = useState<Set<number>>(new Set());
  const avisadas = useRef<number>(0);
  const panel = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch("/api/notificaciones", { cache: "no-store", headers: { accept: "application/json" } });
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
      const nuevas = datos.items.filter((n) => n.nueva && n.id > avisadas.current);
      const mayor = datos.items.reduce((m, n) => Math.max(m, n.id), avisadas.current);
      // La primera carga solo fija desde dónde contar: no se avisa lo que ya estaba.
      const primera = avisadas.current === 0;
      avisadas.current = mayor;
      if (primera || nuevas.length === 0) return;
      if (leerLocal(claveNavegador(usuarioId)) !== "1") return;
      if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
      for (const n of nuevas.slice(0, 3).reverse()) {
        try {
          const aviso = new Notification(n.actor ? `${n.actor} ${n.texto}` : n.texto, {
            body: n.detalle ?? undefined,
            tag: `dmc-${n.id}`,
            icon: "/DMC-logo.png",
          });
          aviso.onclick = () => {
            window.focus();
            if (n.enlace) window.location.assign(n.enlace);
          };
        } catch {
          // Algunos navegadores solo permiten avisos desde un service worker.
        }
      }
    },
    [usuarioId]
  );

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

  // Al abrir: se resalta lo nuevo y se marca como visto.
  async function abrir() {
    setAbierta(true);
    setVista("lista");
    const datos = (await cargar()) ?? bandeja;
    if (!datos) return;
    setResaltadas(new Set(datos.items.filter((n) => n.nueva).map((n) => n.id)));
    const mayor = datos.items.reduce((m, n) => Math.max(m, n.id), 0);
    if (mayor > 0 && datos.noLeidas > 0) {
      setBandeja({ ...datos, noLeidas: 0, items: datos.items.map((n) => ({ ...n, nueva: false })) });
      await marcarNotificacionesLeidasAction(mayor);
    }
  }

  function cerrar() {
    setAbierta(false);
    setResaltadas(new Set());
    boton.current?.focus();
  }

  // Escape y clic afuera cierran.
  useEffect(() => {
    if (!abierta) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
    };
    const fuera = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panel.current?.contains(t) || boton.current?.contains(t)) return;
      cerrar();
    };
    document.addEventListener("keydown", tecla);
    document.addEventListener("mousedown", fuera);
    return () => {
      document.removeEventListener("keydown", tecla);
      document.removeEventListener("mousedown", fuera);
    };
  }, [abierta]);

  const noLeidas = bandeja?.noLeidas ?? 0;
  const items = bandeja?.items ?? [];
  const visibles = items.filter((n) =>
    filtro === "mias" ? n.propia : filtro === "avisos" ? !n.propia && nivelDe(bandeja?.configuracion.niveles ?? {}, n.tipo) === "AVISAR" : true
  );

  return (
    <>
      <button
        ref={boton}
        type="button"
        onClick={() => (abierta ? cerrar() : void abrir())}
        aria-label={noLeidas ? `Notificaciones: ${noLeidas} sin ver` : "Notificaciones"}
        aria-expanded={abierta}
        aria-haspopup="dialog"
        className={`btn btn-icon relative ${variante === "barra" ? "w-10 h-10 border border-black/[.3]" : "w-9 h-9"} ${
          abierta ? "bg-[var(--color-accent-200)] text-[var(--color-accent-800)]" : ""
        }`}
      >
        <IconoCampana />
        {noLeidas ? (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 grid place-items-center bg-[var(--color-danger)] text-white text-cap tabular-nums">
            {noLeidas >= 99 ? "99+" : noLeidas}
          </span>
        ) : null}
      </button>

      {abierta ? (
        <div
          ref={panel}
          role="dialog"
          aria-label="Notificaciones"
          className="fixed z-[60] inset-x-0 top-14 bottom-0 lg:inset-x-auto lg:bottom-auto lg:top-4 lg:left-[256px] lg:w-[420px] lg:max-h-[calc(100vh-32px)] flex flex-col bg-[var(--color-bg)] border-2 border-[var(--color-text)] shadow-[0_18px_40px_-12px_rgba(31,28,33,.35)] animate-up-dlg"
        >
          <div className="flex items-center gap-2 px-4 pt-3.5 pb-3 border-b-2 border-[var(--color-divider)]">
            {vista === "ajustes" ? (
              <button type="button" onClick={() => setVista("lista")} className="btn btn-icon -ml-1.5" aria-label="Volver a la lista">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
                  <path d="M15 6l-6 6 6 6" />
                </svg>
              </button>
            ) : null}
            <div className="font-extrabold text-lead">{vista === "ajustes" ? "Qué quiero ver" : "Notificaciones"}</div>
            <div className="ml-auto flex items-center gap-1">
              {vista === "lista" ? (
                <button
                  type="button"
                  onClick={() => setVista("ajustes")}
                  className="btn btn-icon"
                  aria-label="Configurar notificaciones"
                  title="Configurar"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" aria-hidden>
                    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
                    <circle cx="16" cy="7" r="2" />
                    <circle cx="10" cy="17" r="2" />
                  </svg>
                </button>
              ) : null}
              <button type="button" onClick={cerrar} className="btn btn-icon" aria-label="Cerrar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          </div>

          {vista === "ajustes" && bandeja ? (
            <Ajustes
              usuarioId={usuarioId}
              permisos={permisos}
              configuracion={bandeja.configuracion}
              alGuardar={(nueva) => {
                setBandeja(nueva);
                setVista("lista");
              }}
            />
          ) : (
            <>
              <div className="flex gap-1.5 px-4 py-2.5 border-b border-[var(--color-divider-soft)]" role="tablist">
                {(
                  [
                    ["todo", "Todo"],
                    ["avisos", "Avisos"],
                    ["mias", "Mis cambios"],
                  ] as const
                ).map(([clave, label]) => (
                  <button
                    key={clave}
                    type="button"
                    role="tab"
                    aria-selected={filtro === clave}
                    onClick={() => setFiltro(clave)}
                    className={`min-h-8 px-3 text-meta font-extrabold border ${
                      filtro === clave
                        ? "bg-[var(--color-text)] text-[var(--color-bg)] border-[var(--color-text)]"
                        : "border-[var(--color-line-control)] hover:bg-[rgba(31,28,33,.05)]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto overscroll-contain">
                {!bandeja ? (
                  <div className="px-4 py-8 text-meta opacity-70">{falla ? "No se pudo cargar. Se reintenta solo." : "Cargando…"}</div>
                ) : visibles.length === 0 ? (
                  <Vacia filtro={filtro} verPropios={bandeja.configuracion.verPropios} />
                ) : (
                  <ul>
                    {visibles.map((n) => (
                      <Fila key={n.id} n={n} resaltada={resaltadas.has(n.id)} alElegir={cerrar} />
                    ))}
                  </ul>
                )}
              </div>
              {falla && bandeja ? (
                <div className="px-4 py-2 text-cap text-[var(--color-danger)] border-t border-[var(--color-divider-soft)]">
                  Sin conexión con el servidor: lo que ves puede estar atrasado.
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </>
  );
}

function Fila({ n, resaltada, alElegir }: { n: Notificacion; resaltada: boolean; alElegir: () => void }) {
  const contenido = (
    <>
      <span
        aria-hidden
        className={`mt-1.5 w-2 h-2 flex-none ${
          resaltada ? "bg-[var(--color-danger)]" : n.deTecnico ? "bg-[var(--color-accent)]" : "bg-[var(--color-neutral-400)]"
        }`}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-ui leading-snug">
          {n.actor ? <strong className="font-extrabold">{n.propia ? "Tú" : n.actor}</strong> : null}
          {n.actor ? " " : ""}
          {n.texto}
        </span>
        {n.detalle ? <span className="block text-meta opacity-75 truncate">{n.detalle}</span> : null}
        <span className="block text-cap opacity-60 mt-0.5">
          {cuandoFue(n.creadoEn)}
          {n.deTecnico ? " · desde el celular" : ""}
          {resaltada ? <span className="text-[var(--color-danger)]"> · nueva</span> : null}
        </span>
      </span>
    </>
  );
  const clases = `flex gap-3 px-4 py-3 border-b border-[var(--color-divider-faint)] ${
    resaltada ? "bg-[var(--color-danger-100)]" : ""
  }`;
  return (
    <li>
      {n.enlace ? (
        <Link href={n.enlace} onClick={alElegir} className={`${clases} hover:bg-[rgba(31,28,33,.05)]`}>
          {contenido}
        </Link>
      ) : (
        <div className={clases}>{contenido}</div>
      )}
    </li>
  );
}

function Vacia({ filtro, verPropios }: { filtro: Filtro; verPropios: boolean }) {
  const texto =
    filtro === "mias"
      ? verPropios
        ? "Todavía no hiciste cambios en los últimos 30 días."
        : "Tus propios cambios están ocultos. Actívalos en la configuración."
      : filtro === "avisos"
        ? "Nada nuevo de lo que pediste que te avise."
        : "No hay movimiento en los últimos 30 días.";
  return <div className="px-4 py-10 text-center text-meta opacity-70">{texto}</div>;
}

function Ajustes({
  usuarioId,
  permisos,
  configuracion,
  alGuardar,
}: {
  usuarioId: number;
  permisos: string[];
  configuracion: ConfiguracionAvisos;
  alGuardar: (b: BandejaNotificaciones) => void;
}) {
  const grupos = gruposVisibles(permisos);
  const [niveles, setNiveles] = useState(() => {
    const todos: Record<string, NivelAviso> = {};
    for (const g of grupos) for (const t of g.tipos) todos[t.clave] = nivelDe(configuracion.niveles, t.clave);
    return todos;
  });
  const [verPropios, setVerPropios] = useState(configuracion.verPropios);
  const [navegador, setNavegador] = useState(() => leerLocal(claveNavegador(usuarioId)) === "1");
  const [permisoNavegador, setPermisoNavegador] = useState<NotificationPermission | "no">(() =>
    typeof Notification === "undefined" ? "no" : Notification.permission
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  async function cambiarNavegador(encender: boolean) {
    if (!encender) {
      setNavegador(false);
      escribirLocal(claveNavegador(usuarioId), null);
      return;
    }
    if (typeof Notification === "undefined") return;
    const permiso = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    setPermisoNavegador(permiso);
    if (permiso === "granted") {
      setNavegador(true);
      escribirLocal(claveNavegador(usuarioId), "1");
    }
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
    alGuardar(r.bandeja);
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3">
        <p className="text-meta opacity-75 mb-3">
          <strong>Avisar</strong> suma al número rojo; <strong>Mostrar</strong> lo deja en la lista sin avisar;{" "}
          <strong>Ocultar</strong> no lo muestra. Vale solo para lo que hacen los demás.
        </p>

        <label className="flex items-start gap-3 py-2.5 border-b border-[var(--color-divider-faint)] cursor-pointer">
          <input type="checkbox" className="mt-1" checked={verPropios} onChange={(e) => setVerPropios(e.target.checked)} />
          <span>
            <span className="block text-ui font-extrabold">Mostrar mis propios cambios</span>
            <span className="block text-meta opacity-70">Lo que creas, editas o eliminas, en «Mis cambios». Nunca suma al número.</span>
          </span>
        </label>

        <label className="flex items-start gap-3 py-2.5 border-b border-[var(--color-divider-faint)] cursor-pointer">
          <input
            type="checkbox"
            className="mt-1"
            checked={navegador}
            disabled={permisoNavegador === "no" || permisoNavegador === "denied"}
            onChange={(e) => void cambiarNavegador(e.target.checked)}
          />
          <span>
            <span className="block text-ui font-extrabold">Avisos del navegador en este equipo</span>
            <span className="block text-meta opacity-70">
              {permisoNavegador === "no"
                ? "Este navegador no permite avisos."
                : permisoNavegador === "denied"
                  ? "El navegador los tiene bloqueados para este sitio: actívalos desde el candado de la barra de direcciones."
                  : "Un aviso en la pantalla con lo que es «Avisar», aunque estés en otra pestaña."}
            </span>
          </span>
        </label>

        {grupos.map((g) => (
          <fieldset key={g.clave} className="mt-4">
            <legend className="text-cap opacity-60 pb-1.5">{g.label}</legend>
            {g.tipos.map((t) => (
              <div key={t.clave} className="flex items-center gap-3 py-2 border-b border-[var(--color-divider-faint)] flex-wrap">
                <span id={`niv-${t.clave}`} className="text-ui flex-1 min-w-[150px]">
                  {t.label}
                </span>
                <div role="radiogroup" aria-labelledby={`niv-${t.clave}`} className="flex">
                  {(["AVISAR", "MOSTRAR", "OCULTAR"] as const).map((nivel) => {
                    const activo = niveles[t.clave] === nivel;
                    return (
                      <button
                        key={nivel}
                        type="button"
                        role="radio"
                        aria-checked={activo}
                        onClick={() => setNiveles((prev) => ({ ...prev, [t.clave]: nivel }))}
                        className={`min-h-8 px-2.5 text-cap font-extrabold border -ml-px first:ml-0 ${
                          activo
                            ? nivel === "AVISAR"
                              ? "relative z-[1] bg-[var(--color-accent)] text-white border-[var(--color-accent)]"
                              : nivel === "MOSTRAR"
                                ? "relative z-[1] bg-[var(--color-text)] text-[var(--color-bg)] border-[var(--color-text)]"
                                : "relative z-[1] bg-[var(--color-neutral-300)] border-[var(--color-neutral-600)]"
                            : "border-[var(--color-line-control)] hover:bg-[rgba(31,28,33,.05)]"
                        }`}
                      >
                        {ETIQUETA_NIVEL[nivel]}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </fieldset>
        ))}
      </div>
      <div className="flex items-center gap-3 px-4 py-3 border-t-2 border-[var(--color-divider)]">
        {error ? <span className="text-meta text-[var(--color-danger)] flex-1">{error}</span> : <span className="flex-1" />}
        <button type="button" onClick={() => void guardar()} disabled={guardando} className="btn btn-primary">
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </>
  );
}
