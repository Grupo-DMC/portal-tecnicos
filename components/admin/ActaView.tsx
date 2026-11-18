"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Tag from "@/components/Tag";
import MenuAcciones from "@/components/ui/MenuAcciones";
import Dialogo, { type Adjunto } from "@/components/admin/Dialogo";
import VisitaDialogo, {
  CancelarAdminDialogo,
  EliminarVisitaDialogo,
  LiberarDialogo,
  ReprogramarDialogo,
  type OrigenProblema,
} from "@/components/admin/VisitaDialogos";
import ProblemasVisitaDialogo from "@/components/admin/ProblemasVisitaDialogo";
import VisorFotos, { useVisorFotos } from "@/components/ui/VisorFotos";
import { Toast, useToast } from "@/components/ui/Toast";
import { enviarActaAction } from "@/app/actions/admin";
import { permitirEditarTecnicoAction } from "@/app/actions/ediciones";
import EstadoProblemaTag from "@/components/EstadoProblemaTag";
import { ESTADO_VISITA_LABEL, ESTADO_VISITA_TAG, nombreDeQuienLaTomo, textoMotivos, textoMotivosReales } from "@/lib/ui/estado";
import { textoFechaVisita, fechaCL } from "@/lib/ui/fecha";
import { autorDeVisita } from "@/lib/ui/formato";
import { nombreProblema, nombreTrabajo, puede, useReferencias } from "@/lib/ui/referencias";
import { reloj } from "@/lib/ui/video";
import { archivosMultimedia, descargarZip } from "@/lib/ui/descarga";
import { SECCION_EDICION, quienModifico, resumenEdicion } from "@/lib/ui/edicion";
import { esInformePapel } from "@/lib/ui/papel";
import { nombreArchivoActa, nombreZipMultimedia } from "@/lib/ui/nombre-acta";
import { textoDireccion } from "@/lib/ui/ubicacion";
import { urlVisitasRecordada } from "@/lib/ui/filtro-recordado";
import type { Visita, VisitaEdicion } from "@/lib/types";
import {
  agregarCorreo,
  MAX_DESTINATARIOS,
  repartirDestinatarios,
  yaIncluido,
  type ActaEnviada,
  type CampoDestinatario,
  type ClaveAdjunto,
  type DestinatarioSugerido,
} from "@/lib/ui/correo";

/** Lo que el diálogo de correo necesita saber del servidor. */
export interface DatosCorreo {
  /** Si el servidor tiene con qué mandar correo. */
  listo: boolean;
  /** Con qué correo sale: el de la sesión, o el de respaldo si su dominio no está verificado. */
  de: string;
  conSuCorreo: boolean;
  /** A quién le llegan las respuestas: siempre quien lo envía. */
  responderA: string;
  sugeridos: DestinatarioSugerido[];
}
import { AdjuntosVista } from "@/components/ui/AdjuntosTrabajo";

const AVISO_ESTADO: Record<string, string> = {
  PROGRAMADA: "Esta visita todavía no se ejecuta: cuando el técnico la cierre vas a ver aquí problemas, fotos y firma.",
  EN_CURSO: "El técnico está en terreno: lo que ves puede cambiar hasta que cierre el acta.",
  PENDIENTE: "La visita quedó pendiente: el técnico no pudo cerrarla en terreno.",
  REAGENDADA: "La visita se reagendó antes de cerrarse; el motivo del técnico está en el detalle.",
  CANCELADA_ADMIN:
    "Administración cerró esta visita sin que llegara a hacerse. El motivo está en el detalle y en la trazabilidad.",
};

/** "2026-08-13T08:30:00" → "08:30". */
function hhmm(iso: string | null | undefined): string {
  return iso ? iso.slice(11, 16) : "—";
}

function minutosEntre(a: string, b: string | null): number | null {
  if (!b) return null;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
}

const ICONO_DESCARGA = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
    <path d="M12 4v11M7 11l5 5 5-5M4 20h16" />
  </svg>
);
const ICONO_EDITAR = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
    <path d="M4 20h4l10-10-4-4L4 16v4z" />
    <path d="M14 6l4 4" />
  </svg>
);
const ICONO_CELULAR = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
    <rect x="7" y="2.5" width="10" height="19" rx="1.5" />
    <path d="M11 18.5h2" />
  </svg>
);

export default function ActaView({
  visita,
  enviada,
  correo,
}: {
  visita: Visita;
  enviada: ActaEnviada | null;
  /** Solo llega para quien puede enviar el acta. */
  correo?: DatosCorreo;
}) {
  const router = useRouter();
  const ref = useReferencias();
  const { problemas: catalogoProblema, trabajos: catalogoTrabajo } = ref;
  const { toast, aviso } = useToast();
  // «Visitas» vuelve a la lista tal como se dejó, con sus filtros.
  const [volverA, setVolverA] = useState("/admin/visitas");
  useEffect(() => setVolverA(urlVisitasRecordada()), []);
  const [resumenAbierto, setResumenAbierto] = useState(false);
  const [trazaAbierta, setTrazaAbierta] = useState(false);
  const [zonaAbierta, setZonaAbierta] = useState(false);
  const [dialogo, setDialogo] = useState<
    "correo" | "editar" | "problemas" | "reprogramar" | "liberar" | "cancelarAdmin" | "eliminar" | null
  >(null);
  const [agendarProblema, setAgendarProblema] = useState<OrigenProblema | null>(null);
  const visor = useVisorFotos();
  const [bajando, setBajando] = useState<"fotos" | "videos" | "multimedia" | null>(null);

  const ejec = visita.ejecucion;
  const ejecutada = visita.estado !== "PROGRAMADA";
  const cerrada = visita.estado === "COMPLETADA";
  const reprogramable = ["REAGENDADA", "PENDIENTE", "CANCELADA"].includes(visita.estado);
  // Una visita eliminada solo la abre el administrador, y solo para mirarla:
  // no se corrige, no se envía ni se agenda nada desde ella.
  const eliminada = visita.eliminacion;
  const permite = (permiso: string) => !eliminada && puede(ref, permiso);
  const sinCerrar = !eliminada && !cerrada && visita.estado !== "CANCELADA";
  // El cierre administrativo: solo con el permiso, y solo sobre una visita
  // que está en curso o que todavía no se inicia. Una completada ya tiene acta
  // firmada y una cancelada no hay nada que cerrar.
  const cerrablePorAdmin =
    permite("visitas.cancelar") && (visita.estado === "PROGRAMADA" || visita.estado === "EN_CURSO");
  const eliminable = permite("visitas.eliminar");
  // En curso la tiene tomada un técnico: liberarla la devuelve a programada.
  const liberable = permite("visitas.liberar") && visita.estado === "EN_CURSO";
  const tomadaPor = nombreDeQuienLaTomo(visita);
  // Un informe en papel no trae horas: llegada y salida quedaron a las 00:00.
  const papel = esInformePapel(ejec);
  const duracion = ejec && !papel ? minutosEntre(ejec.horaInicio, ejec.horaTermino) : null;
  const firma = visita.firmas?.[0];
  const ediciones = visita.ediciones ?? [];
  // La última edición que tocó cada parte del acta: esa parte se resalta y dice quién la cambió.
  const ultimaPorSeccion = new Map<string, VisitaEdicion>();
  for (const e of ediciones) for (const sec of e.secciones) ultimaPorSeccion.set(sec, e);
  const editada = (sec: string) => ultimaPorSeccion.get(sec);
  /** Marco de una parte editada: una barra de color al costado. */
  const resalte = (sec: string) =>
    editada(sec) ? "border-l-4 border-l-[var(--color-accent)] bg-[var(--color-accent-100)]" : "";
  // Editar el acta ya cerrada: solo con el permiso, y sin plazo.
  const editableActa = cerrada && permite("visitas.editarActa");
  // Anotar problemas en una visita que todavía no se cierra: con el permiso de
  // corregir visitas. En una cerrada se hace desde «Editar el acta».
  const registraProblemas = !cerrada && visita.estado !== "CANCELADA_ADMIN" && permite("visitas.editar");
  const [habilitando, setHabilitando] = useState(false);
  async function permitirEditarTecnico() {
    setHabilitando(true);
    try {
      const res = await permitirEditarTecnicoAction(visita.folio);
      aviso(res.ok ? "El técnico puede editar el acta durante 5 minutos" : (res.error ?? "No se pudo habilitar."));
      if (res.ok) router.refresh();
    } catch {
      aviso("No se pudo llegar al servidor. Inténtalo otra vez.");
    } finally {
      setHabilitando(false);
    }
  }

  // Lo del comentario interno va aparte: coordinación lo ve, el cliente no.
  const fotosCliente = (visita.fotos ?? []).filter((f) => !f.interno);
  const fotosInternas = (visita.fotos ?? []).filter((f) => f.interno);
  const videosCliente = (visita.videos ?? []).filter((v) => !v.interno);
  const videosInternos = (visita.videos ?? []).filter((v) => v.interno);
  const internos = visita.internos ?? [];
  const hayInterno =
    Boolean(ejec?.comentarioInterno) || internos.length > 0 || fotosInternas.length > 0 || videosInternos.length > 0;
  // El visor recorre primero las fotos del trabajo y después las internas.
  const fotosVisor = [...fotosCliente, ...fotosInternas];
  async function bajarTodo(tipo: "fotos" | "videos" | "multimedia") {
    const archivos = archivosMultimedia(visita, tipo);
    setBajando(tipo);
    const n = await descargarZip(archivos, nombreZipMultimedia(visita));
    setBajando(null);
    aviso(n === archivos.length ? `Se descargaron ${n} archivos` : `Se descargaron ${n} de ${archivos.length} archivos`);
  }
  const nombreMotivo = (codigo: string | null) =>
    codigo ? ref.motivos.find((m) => m.codigo === codigo)?.nombre ?? codigo : null;

  const sello = ejecutada && ejec
    ? `${fechaCL(visita.fechaProgramada)} · ${papel ? "informe en papel" : `${hhmm(ejec.horaInicio)}–${hhmm(ejec.horaTermino)}`}`
    : `${fechaCL(visita.fechaProgramada)} · sin ejecutar`;

  const resumen: { k: string; v: string; span?: 2; chip?: string }[] = [
    { k: visita.fechaHasta ? "Margen de días" : "Fecha programada", v: textoFechaVisita(visita) },
    { k: "Hora de llegada", v: visita.horaProgramada ?? "Sin hora · durante el día" },
    { k: "Cliente", v: visita.cliente?.nombreFantasia ?? "—" },
    { k: "Marca", v: visita.marca?.nombre ?? "—" },
    { k: "Sucursal", v: visita.sucursal?.nombre ?? "—" },
    { k: "Dirección", v: textoDireccion(visita.mall, visita.sucursal), span: 2 },
    { k: visita.motivosCodigos.length > 1 ? "Motivos de la visita" : "Motivo de la visita", v: textoMotivos(visita) },
    { k: "Técnico", v: visita.tecnico?.nombreCompleto ?? "—" },
    { k: "Técnico ayudante", v: visita.tecnicoAyudante?.nombreCompleto ?? "Sin ayudante" },
    {
      k: "Responsable de tienda",
      v: visita.responsableNombre
        ? `${visita.responsableNombre}${ejec?.responsableRut ? ` · ${ejec.responsableRut}` : ""}`
        : "Sin definir",
      // El cargo que tenía en esta visita: el del acta si ya se cerró, si no el de la agenda.
      chip: (ejec ? ejec.responsableCargo : visita.responsableCargo) || undefined,
    },
    { k: "Teléfono", v: visita.responsableTelefono ?? "Sin teléfono" },
    ...(ejec?.responsableEmail ? [{ k: "Correo", v: ejec.responsableEmail }] : []),
    papel
      ? { k: "Registro", v: "Informe en papel · cargado desde el panel" }
      : ejecutada && ejec
      ? { k: "Hora de inicio en terreno", v: `${hhmm(ejec.horaInicio)}${duracion ? ` · ${duracion} min en la tienda` : ""}` }
      : { k: "Ejecución", v: "Pendiente · sin registro en terreno" },
    { k: "Estado", v: ESTADO_VISITA_LABEL[visita.estado], span: 2 },
  ];
  if (tomadaPor) resumen.push({ k: "En curso · la inició", v: tomadaPor, span: 2 });
  if (visita.indicacionesAcceso) resumen.push({ k: "Indicaciones de acceso", v: visita.indicacionesAcceso, span: 2 });
  if (visita.motivoPendiente) resumen.push({ k: "Motivo del técnico", v: visita.motivoPendiente, span: 2 });
  const reagenda = visita.reagendamientos?.[0];
  if (reagenda) resumen.push({ k: "Motivo del reagendamiento (técnico)", v: reagenda.motivo, span: 2 });

  return (
    <div className="pb-12 animate-fade-in">
      {/* Barra de acciones: volver a la izquierda; a la derecha la acción
          principal del estado, y lo demás agrupado en Editar y Descargar. */}
      <div className="flex items-center gap-2 flex-wrap px-4 md:px-7 py-3 border-b border-[var(--color-divider-soft)]">
        <Link href={volverA} className="btn btn-ghost min-h-10 no-underline">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
          <span>Visitas</span>
        </Link>

        <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
          <button onClick={() => setTrazaAbierta(true)} className="btn btn-secondary min-h-10 px-3.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              <circle cx="12" cy="12" r="8.5" />
              <path d="M12 7.5V12l3 2" />
            </svg>
            <span>Trazabilidad</span>
          </button>
          <MenuAcciones
            texto="Descargar"
            icono={ICONO_DESCARGA}
            acciones={[
              // El PDF es el acta que va al cliente: sin comentario interno.
              ...(cerrada && !eliminada
                ? [
                    {
                      clave: "pdf",
                      texto: "Acta en PDF",
                      detalle: "La que recibe el cliente, sin comentarios internos",
                      icono: ICONO_DESCARGA,
                      href: `/api/visita/acta/${encodeURIComponent(visita.folio)}`,
                      download: nombreArchivoActa(visita),
                    },
                  ]
                : []),
              ...(fotosCliente.length + videosCliente.length > 0
                ? [
                    {
                      clave: "multimedia",
                      texto: bajando === "multimedia" ? "Descargando…" : "Fotos y videos (.zip)",
                      detalle: `${[
                        fotosCliente.length ? `${fotosCliente.length} ${fotosCliente.length === 1 ? "foto" : "fotos"}` : "",
                        videosCliente.length ? `${videosCliente.length} ${videosCliente.length === 1 ? "video" : "videos"}` : "",
                      ]
                        .filter(Boolean)
                        .join(" y ")} para el cliente`,
                      icono: ICONO_DESCARGA,
                      disabled: bajando !== null,
                      onSelect: () => void bajarTodo("multimedia"),
                    },
                  ]
                : []),
            ]}
          />
          {editableActa ? (
            <MenuAcciones
              texto="Editar"
              icono={ICONO_EDITAR}
              acciones={[
                {
                  clave: "acta",
                  texto: "Editar el acta",
                  detalle: "Corrige lo registrado; queda en la bitácora",
                  icono: ICONO_EDITAR,
                  href: `/admin/visitas/${encodeURIComponent(visita.folio)}/editar`,
                },
                {
                  clave: "tecnico",
                  texto: habilitando ? "Habilitando…" : "Permitir que el técnico la corrija",
                  detalle: "Desde su celular, durante 5 minutos",
                  icono: ICONO_CELULAR,
                  disabled: habilitando,
                  onSelect: () => void permitirEditarTecnico(),
                },
              ]}
            />
          ) : null}
          {reprogramable && permite("visitas.reprogramar") ? (
            <button onClick={() => setDialogo("reprogramar")} className="btn btn-primary min-h-10 px-3.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                <rect x="3" y="5" width="18" height="16" />
                <path d="M8 3v4M16 3v4M3 11h18M12 15l2 2-2 2" />
              </svg>
              <span>Cambiar fecha y técnico</span>
            </button>
          ) : null}
          {liberable ? (
            <button onClick={() => setDialogo("liberar")} className="btn btn-primary min-h-10 px-3.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                <rect x="5" y="11" width="14" height="10" />
                <path d="M8 11V7a4 4 0 017.5-2" />
              </svg>
              <span>Liberar</span>
            </button>
          ) : null}
          {cerrada && correo && permite("visitas.enviar") ? (
            <button onClick={() => setDialogo("correo")} className="btn btn-primary min-h-10 px-3.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" />
                <path d="M3 6l9 7 9-7" />
              </svg>
              <span>Enviar por correo</span>
            </button>
          ) : null}
        </div>
      </div>

      {eliminada ? (
        <div className="mx-4 md:mx-7 mt-5 px-4 py-3.5 bg-[var(--color-accent-200)] border border-[var(--color-accent-300)] text-meta text-[var(--color-accent-800)]">
          Esta visita está eliminada
          {eliminada.en ? ` desde el ${fechaCL(eliminada.en)} a las ${hhmm(eliminada.en)}` : ""} · la eliminó{" "}
          {eliminada.por}. Solo la ve el administrador: para los demás roles y para el técnico no existe, y no cuenta en
          el panel, los gráficos ni los problemas.
        </div>
      ) : null}

      {/* El técnico pidió poder corregir su acta: se atiende con «Permitir que el técnico la corrija». */}
      {ejec?.edicionSolicitadaEn && cerrada ? (
        <div className="mx-4 md:mx-7 mt-5 max-w-[900px] px-4 py-3.5 bg-[var(--color-accent-200)] border border-[var(--color-accent-300)] text-meta text-[var(--color-accent-800)]">
          <div className="font-extrabold">
            El técnico pidió editar esta acta · {fechaCL(ejec.edicionSolicitadaEn)} a las {hhmm(ejec.edicionSolicitadaEn)}
          </div>
          {ejec.edicionSolicitadaMotivo ? <div className="mt-1">«{ejec.edicionSolicitadaMotivo}»</div> : null}
          {editableActa ? (
            <div className="mt-1.5 opacity-80">
              Atiéndelo desde Editar › Permitir que el técnico la corrija, o corrige el acta tú mismo.
            </div>
          ) : null}
        </div>
      ) : null}

      {/* El registro de cada corrección al acta: qué parte, por qué, quién y
          cuándo. Es interno: el PDF no lo menciona. */}
      {ediciones.length > 0 ? (
        <div className="mx-4 md:mx-7 mt-5 max-w-[900px] border border-[var(--color-accent-300)] bg-[var(--color-accent-100)]">
          <div className="px-4 py-3 font-extrabold text-meta text-[var(--color-accent-800)]">
            Esta acta fue editada · {ediciones.length} {ediciones.length === 1 ? "vez" : "veces"}
          </div>
          {ediciones.map((e) => (
            <div key={e.id} className="px-4 py-3.5 border-t border-[var(--color-accent-300)]">
              <div className="flex flex-wrap gap-1.5">
                {e.secciones.map((sec) => (
                  <span key={sec} className="tag tag-dark font-extrabold">
                    {sec}
                  </span>
                ))}
              </div>
              <div className="text-body leading-[1.45] mt-2.5">
                <span className="text-cap opacity-62">Por qué se cambió · </span>
                {e.motivo}
              </div>
              <div className="text-cap opacity-66 mt-1 tabular-nums">{resumenEdicion(e)}</div>
              <details className="mt-2">
                <summary className="cursor-pointer text-meta underline underline-offset-[3px]">
                  Ver qué cambió ({e.detalle.length})
                </summary>
                <ul className="m-0 mt-2 pl-4.5 text-meta leading-[1.5] list-disc">
                  {e.detalle.map((linea, i) => (
                    <li key={i}>{linea}</li>
                  ))}
                </ul>
              </details>
            </div>
          ))}
        </div>
      ) : null}

      {sinCerrar ? (
        <div className="mx-4 md:mx-7 mt-5 px-4 py-3.5 bg-[var(--color-accent-200)] border border-[var(--color-accent-300)] text-meta text-[var(--color-accent-800)]">
          {AVISO_ESTADO[visita.estado]}
          {tomadaPor
            ? ` La inició ${tomadaPor} y solo esa persona puede terminarla${liberable ? "; con «Liberar» vuelve a quedar programada." : "."}`
            : ""}
        </div>
      ) : null}

      <div className="px-4 md:px-7 pt-7 pb-10 max-w-[900px]">
        <div className="flex items-center gap-x-3 gap-y-2 flex-wrap mb-1.5">
          <h1 className="m-0 font-extrabold text-h1 md:text-display leading-[1.04] tracking-[-.035em] tabular-nums">
            {visita.folio}
          </h1>
          {eliminada ? <Tag variant="dark">Eliminada</Tag> : null}
          <Tag variant={ESTADO_VISITA_TAG[visita.estado]}>{ESTADO_VISITA_LABEL[visita.estado]}</Tag>
          {ediciones.length > 0 ? <Tag variant="outline">Acta editada</Tag> : null}
        </div>
        <p className="m-0 text-body text-[var(--color-muted)]">
          {[
            visita.cliente?.nombreFantasia,
            visita.marca && visita.marca.nombre !== visita.cliente?.nombreFantasia ? visita.marca.nombre : null,
            visita.sucursal?.nombre,
          ]
            .filter(Boolean)
            .join(" · ")}{" "}
          · {textoMotivos(visita)}
        </p>
        <p className="m-0 mt-1 mb-6 text-meta text-[var(--color-muted)] tabular-nums">
          {sello}
          {enviada ? <EstadoEnvio enviada={enviada} /> : null}
        </p>

        <div className="border border-[var(--color-divider)] bg-[var(--color-surface-3)]">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b-2 border-[var(--color-divider)]">
            <div className="font-extrabold text-meta ">
              {ejecutada ? "Lo que registró el técnico" : "Lo que se programó"}
            </div>
            <span className="ml-auto text-cap text-[var(--color-muted)]">Vista completa</span>
          </div>

          <button
            onClick={() => setResumenAbierto((v) => !v)}
            className="w-full flex items-center gap-2.5 px-5 py-3.5 bg-transparent border-0 border-b border-black/[.2] cursor-pointer text-[var(--color-text)] text-left hover:bg-[var(--color-surface-2)]"
          >
            <span className="text-cap opacity-66">Detalle de la visita</span>
            <span className="text-meta opacity-62 ml-auto">
              {resumenAbierto ? "" : "Fecha, cliente, sucursal y contacto"}
            </span>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              className="flex-none transition-transform"
              style={{ transform: `rotate(${resumenAbierto ? 180 : 0}deg)` }}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {resumenAbierto ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2">
                {resumen.map((r) => (
                  <div
                    key={r.k}
                    className={`px-4 sm:px-5 py-3.5 border-b border-black/[.2] border-r border-r-black/[.2] min-w-0 ${r.span === 2 ? "sm:col-span-2" : ""}`}
                  >
                    <div className="text-cap opacity-72">{r.k}</div>
                    <div className="text-lead leading-[1.35] mt-1.5">
                      {r.v}
                      {r.chip ? <Tag variant="accent" className="ml-2 align-middle">{r.chip}</Tag> : null}
                    </div>
                  </div>
                ))}
              </div>
              {permite("visitas.editar") ? (
              <div className="px-5 py-4 border-b border-black/[.2] flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => setDialogo("editar")}
                  className={`btn ${reprogramable ? "btn-secondary" : "btn-primary"} min-h-10 px-4`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M4 20h4l10-10-4-4L4 16v4z" />
                    <path d="M14 6l4 4" />
                  </svg>
                  <span>Corregir visita</span>
                </button>
                <span className="text-meta opacity-66">
                  {cerrada
                    ? "El acta ya está cerrada: la corrección queda registrada en la trazabilidad."
                    : "Corrige los datos de arriba: cliente, sucursal, técnico, fecha, hora o el trabajo solicitado."}
                </span>
              </div>
              ) : null}
            </>
          ) : null}

          {hayInterno ? (
            <div className={`px-5 py-5 border-b border-black/[.2] bg-[var(--color-accent-100)] ${editada(SECCION_EDICION.interno) ? "border-l-4 border-l-[var(--color-accent)]" : ""}`}>
              <div className="text-cap text-[var(--color-accent-active)] mb-2">
                Comentario interno del técnico · no va en el acta al cliente
                <MarcaEdicion edicion={editada(SECCION_EDICION.interno)} />
              </div>
              {internos.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  {internos.map((x) => (
                    <span key={x.codigo} className="tag tag-dark font-extrabold">
                      {x.nombre}
                    </span>
                  ))}
                </div>
              ) : null}
              {ejec?.comentarioInterno ? (
                <div className="text-body leading-[1.5] max-w-[74ch]">{ejec.comentarioInterno}</div>
              ) : null}
              {fotosInternas.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-3">
                  {fotosInternas.map((f, i) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => visor.abrir(fotosCliente.length + i)}
                      className="border border-black/[.35] aspect-square block overflow-hidden p-0 cursor-zoom-in hover:border-[var(--color-accent)]"
                      title="Ver la foto en grande"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={f.archivoUrl} alt="Foto interna" className="w-full h-full object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              ) : null}
              {videosInternos.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3">
                  {videosInternos.map((v) => (
                    <video
                      key={v.id}
                      src={v.archivoUrl}
                      controls
                      preload="metadata"
                      playsInline
                      className="w-full aspect-video bg-black object-contain border border-black/[.35]"
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {visita.trabajoSolicitado ? (
            <div className="px-5 py-5 border-b border-black/[.2] bg-[var(--color-surface)]">
              <div className="text-cap opacity-62 mb-2">
                {autorDeVisita(visita) ? `Trabajo solicitado por ${autorDeVisita(visita)}` : "Trabajo solicitado"}
              </div>
              <div className="text-body leading-[1.5] max-w-[74ch]">{visita.trabajoSolicitado}</div>
              {visita.adjuntos?.length ? (
                <div className="mt-3 max-w-[74ch]">
                  <AdjuntosVista adjuntos={visita.adjuntos} />
                </div>
              ) : null}
              {visita.indicacionesAcceso ? (
                <div className="text-meta leading-[1.5] opacity-60 mt-2.5 max-w-[74ch]">
                  Acceso: {visita.indicacionesAcceso}
                </div>
              ) : null}
            </div>
          ) : null}

          {!ejecutada ? (
            <div className="px-5 pt-8.5 pb-9.5 text-center">
              <div className="font-extrabold text-h3 leading-[1.25] mb-1.5">
                El técnico aún no registra el formulario
              </div>
              <div className="text-ui opacity-66 max-w-[52ch] mx-auto">
                La visita está en estado {ESTADO_VISITA_LABEL[visita.estado]}. Cuando el técnico la cierre en terreno
                vas a ver aquí problemas, fotos, horarios y la firma de la tienda.
              </div>
            </div>
          ) : null}

          {/* Una visita sin iniciar no muestra el acta, pero coordinación puede
              haberse enterado de problemas y tiene que poder anotarlos. */}
          {!ejecutada && (registraProblemas || (visita.problemas?.length ?? 0) > 0) ? (
            <div className="px-5 py-5 border-t border-black/[.2]">
              <div className="flex items-center gap-3 flex-wrap mb-3">
                <div className="text-cap opacity-66">Problemas registrados ({visita.problemas?.length ?? 0})</div>
                {registraProblemas ? (
                  <button onClick={() => setDialogo("problemas")} className="btn btn-secondary min-h-[34px] px-3 gap-2 text-meta ml-auto">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    <span>{visita.problemas?.length ? "Agregar o corregir problemas" : "Registrar problemas"}</span>
                  </button>
                ) : null}
              </div>
              {visita.problemas && visita.problemas.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {visita.problemas.map((p) => (
                    <div key={p.id} className="border border-black/[.35] bg-white px-4 py-3">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <div className="font-extrabold text-body">{nombreProblema(catalogoProblema, p.tipoCodigo)}</div>
                        <EstadoProblemaTag estado={p.estado} className="ml-auto" />
                      </div>
                      {p.items.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {p.items.map((it) => (
                            <span key={it.id} className="tag tag-dark font-extrabold">
                              {it.etiqueta}
                              {it.cantidad > 1 ? ` × ${it.cantidad}` : ""}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {p.descripcion ? <div className="text-body leading-[1.4] mt-2 max-w-[70ch]">{p.descripcion}</div> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-body opacity-66">Sin problemas registrados en esta visita.</div>
              )}
            </div>
          ) : null}

          {ejec?.observaciones ? (
            <div className={`px-5 py-5 border-b border-black/[.2] ${resalte(SECCION_EDICION.trabajo)}`}>
              <div className="text-cap opacity-66">
                Observaciones del técnico
                <MarcaEdicion edicion={editada(SECCION_EDICION.trabajo)} />
              </div>
              <div className="text-lead leading-[1.45] mt-1.5 max-w-[74ch]">{ejec.observaciones}</div>
            </div>
          ) : null}

          {ejecutada ? (
            <div className="px-5 pt-5.5 pb-6">
              {visita.trabajos && visita.trabajos.length > 0 ? (
                <>
                  <div className="text-cap opacity-66 mb-3">
                    Trabajo realizado ({visita.trabajos.length})
                    <MarcaEdicion edicion={editada(SECCION_EDICION.trabajo)} />
                  </div>
                  <div className={`flex flex-col gap-2.5 mb-6.5 ${editada(SECCION_EDICION.trabajo) ? "border-l-4 border-l-[var(--color-accent)] pl-3" : ""}`}>
                    {visita.trabajos.map((t) => (
                      <div key={t.id} className="border border-black/[.35] bg-white px-4.5 py-3.5">
                        {t.motivoCodigo ? (
                          <div className="text-cap opacity-62 mb-1">
                            {nombreMotivo(t.motivoCodigo)}
                          </div>
                        ) : null}
                        <div className="font-extrabold text-lead">
                          {nombreTrabajo(catalogoTrabajo, t.trabajoCodigo)}
                        </div>
                        {t.subtrabajos.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {t.subtrabajos.map((s) => (
                              <span key={s.id} className="tag tag-dark font-extrabold">
                                {s.etiqueta}
                                {s.cantidad > 1 ? ` × ${s.cantidad}` : ""}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {t.detalle ? <div className="text-body leading-[1.45] mt-2.5 max-w-[70ch]">{t.detalle}</div> : null}
                      </div>
                    ))}
                  </div>
                </>
              ) : null}

              <div className="flex items-center gap-3 flex-wrap mb-3">
                <div className="text-cap opacity-66">
                  Problemas levantados ({visita.problemas?.length ?? 0})
                  <MarcaEdicion edicion={editada(SECCION_EDICION.problemas)} />
                </div>
                {registraProblemas ? (
                  <button onClick={() => setDialogo("problemas")} className="btn btn-secondary min-h-[34px] px-3 gap-2 text-meta ml-auto">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    <span>Agregar o corregir problemas</span>
                  </button>
                ) : editableActa ? (
                  <Link
                    href={`/admin/visitas/${encodeURIComponent(visita.folio)}/editar#ea-sec-problemas`}
                    className="btn btn-secondary min-h-[34px] px-3 gap-2 text-meta ml-auto no-underline"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    <span>Agregar o corregir problemas</span>
                  </Link>
                ) : null}
              </div>
              {visita.problemas && visita.problemas.length > 0 ? (
                <div className="flex flex-col gap-3.5">
                  {visita.problemas.map((p, i) => (
                    <div key={p.id} className="border border-black/[.35] bg-white">
                      <div className="flex items-center gap-2.5 flex-wrap px-4.5 py-3.5 border-b border-black/[.2] bg-[var(--color-surface)]">
                        <span className="w-6.5 h-6.5 flex-none grid place-items-center bg-[var(--color-text)] text-[var(--color-bg)] font-extrabold text-cap tabular-nums">
                          {i + 1}
                        </span>
                        <div className="font-extrabold text-cap ">
                          Problema {i + 1} de {visita.problemas!.length}
                        </div>
                        <EstadoProblemaTag estado={p.estado} className="ml-auto" />
                      </div>
                      <div className="px-4.5 pt-4 pb-1.5">
                        <div className="pb-3.5 border-b border-black/[.18]">
                          <div className="text-cap opacity-60">Tipo de problema</div>
                          <div className="font-extrabold text-h3 leading-[1.3] mt-1.5">
                            {nombreProblema(catalogoProblema, p.tipoCodigo)}
                          </div>
                        </div>
                        {p.items.length > 0 ? (
                          <div className="py-3.5 border-b border-black/[.18]">
                            <div className="text-cap opacity-60">
                              {p.tipoCodigo === "PLACAS_DANADAS" ? "Modelos de placa y cantidad" : "Equipos afectados"}
                            </div>
                            <div className="flex flex-wrap gap-1.5 mt-2.5">
                              {p.items.map((it) => (
                                <span
                                  key={it.id}
                                  className="inline-flex items-baseline gap-2 px-2.5 py-1.5 bg-[var(--color-text)] text-[var(--color-bg)] font-extrabold text-meta leading-[1.2]"
                                >
                                  <span>{it.etiqueta}</span>
                                  <span className="tabular-nums opacity-75">× {it.cantidad}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {p.descripcion ? (
                          <div className="py-3.5 border-b border-black/[.18]">
                            <div className="text-cap opacity-60">
                              Qué encontró el técnico
                            </div>
                            <div className="text-lead leading-[1.4] mt-1.5 max-w-[70ch]">{p.descripcion}</div>
                          </div>
                        ) : null}
                        {/* El celular ya no pide solución: solo las actas
                            anteriores la traen. */}
                        {p.solucion ? (
                          <div className="pt-3.5 pb-4">
                            <div className="text-cap opacity-60">
                              {p.estado === "RESUELTO" ? "Qué se realizó en terreno" : "Solución sugerida por el técnico"}
                            </div>
                            <div className="text-lead leading-[1.4] mt-1.5 max-w-[70ch]">{p.solucion}</div>
                          </div>
                        ) : (
                          <div className="pb-4" />
                        )}
                        {p.estado !== "RESUELTO" && permite("visitas.crear") ? (
                          <div className="pb-4 -mt-1">
                            <button
                              onClick={() =>
                                setAgendarProblema({
                                  problemaId: p.id,
                                  folio: visita.folio,
                                  clienteId: visita.clienteId,
                                  sucursalId: visita.sucursalId,
                                  tipoCodigo: p.tipoCodigo,
                                  tipoNombre: nombreProblema(catalogoProblema, p.tipoCodigo),
                                  descripcion: p.descripcion,
                                  solucion: p.solucion,
                                })
                              }
                              className="btn btn-primary min-h-[34px] px-3 gap-2 text-meta"
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                <rect x="3" y="5" width="18" height="16" />
                                <path d="M8 3v4M16 3v4M3 11h18M12 15h4" />
                              </svg>
                              <span>Agendar visita para resolver</span>
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-body opacity-66">Sin problemas registrados en esta visita.</div>
              )}

              <div className="flex items-center gap-3 flex-wrap mt-6.5 mb-3">
                <div className="text-cap opacity-66">
                  Fotos del trabajo ({fotosCliente.length})
                  <MarcaEdicion edicion={editada(SECCION_EDICION.media)} />
                </div>
                {fotosCliente.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => bajarTodo("fotos")}
                    disabled={bajando !== null}
                    className="btn btn-secondary min-h-[34px] px-3 gap-2 text-meta ml-auto"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M12 4v11M7 11l5 5 5-5M4 20h16" />
                    </svg>
                    <span>{bajando === "fotos" ? "Descargando…" : "Descargar todas las fotos"}</span>
                  </button>
                ) : null}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {fotosCliente.map((f, i) => (
                  // La foto se agranda encima del acta, no en otra pestaña.
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => visor.abrir(i)}
                    className="border border-black/[.35] bg-[var(--color-surface)] aspect-[4/3] block relative overflow-hidden p-0 cursor-zoom-in hover:border-[var(--color-accent)]"
                    title="Ver la foto en grande"
                  >
                    {/* Las fotos van en color: los bytes vienen de
                        dmc.visita_foto.contenido vía /api/visita/foto/<id>. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={f.archivoUrl}
                      alt={f.etiqueta ?? "Foto del trabajo"}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute left-0 right-0 bottom-0 px-2 py-1 bg-[rgba(31,28,33,.72)] text-[var(--color-bg)] text-left">
                      <div className="font-extrabold text-cap leading-[1.2] truncate">{f.etiqueta ?? "Foto"}</div>
                      <div className="text-cap leading-[1.3] opacity-80 tabular-nums">{hhmm(f.tomadaEn)}</div>
                    </div>
                  </button>
                ))}
                {fotosCliente.length === 0 ? (
                  <div className="col-span-full text-meta opacity-66">Sin fotos registradas.</div>
                ) : null}
              </div>

              {/* Los clips salen de dmc.visita_video vía /api/visita/video/<id>,
                  que responde por rangos: por eso se pueden adelantar sin que
                  el navegador se baje los 11 MB completos. */}
              <div className="flex items-center gap-3 flex-wrap mt-6.5 mb-3">
                <div className="text-cap opacity-66">
                  Videos del trabajo ({videosCliente.length})
                  <MarcaEdicion edicion={editada(SECCION_EDICION.media)} />
                </div>
                {videosCliente.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => bajarTodo("videos")}
                    disabled={bajando !== null}
                    className="btn btn-secondary min-h-[34px] px-3 gap-2 text-meta ml-auto"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M12 4v11M7 11l5 5 5-5M4 20h16" />
                    </svg>
                    <span>{bajando === "videos" ? "Descargando…" : "Descargar todos los videos"}</span>
                  </button>
                ) : null}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {videosCliente.map((v) => (
                  <figure key={v.id} className="m-0 border border-black/[.35] bg-[var(--color-surface)]">
                    <video
                      src={v.archivoUrl}
                      controls
                      preload="metadata"
                      playsInline
                      className="w-full aspect-video bg-black object-contain"
                    />
                    <figcaption className="flex items-center gap-2 px-2.5 py-1.5 text-cap tabular-nums opacity-70">
                      <span className="font-extrabold truncate">{v.etiqueta ?? "Video del trabajo"}</span>
                      <span className="ml-auto flex-none">
                        {v.duracionSeg ? reloj(v.duracionSeg) : "—"}
                        {v.ancho && v.alto ? ` · ${v.ancho}x${v.alto}` : ""}
                      </span>
                    </figcaption>
                  </figure>
                ))}
                {videosCliente.length === 0 ? (
                  <div className="col-span-full text-meta opacity-66">Sin videos registrados.</div>
                ) : null}
              </div>

              <div className="flex gap-5 items-end mt-7.5 flex-wrap">
                <div className="flex-[0_1_300px] min-w-0">
                  {firma?.imagenUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={firma.imagenUrl}
                      alt={`Firma de ${firma.nombre}`}
                      className="h-[78px] w-full object-contain object-left-bottom"
                    />
                  ) : (
                    <div className="h-[78px] border border-dashed border-[var(--color-divider)] bg-[var(--color-surface)] grid place-items-center text-cap leading-[1.3] opacity-60">
                      {cerrada ? (papel ? "Firmado en papel" : "Firma capturada en terreno") : "Sin firma todavía"}
                    </div>
                  )}
                  <div className="h-px bg-[var(--color-text)] mt-1.5" />
                  <div className="text-ui mt-1.5">{cerrada ? firma?.nombre ?? "—" : "—"}</div>
                  <div className="text-cap opacity-62">
                    Responsable de tienda · {cerrada ? firma?.rut ?? "—" : "sin firmar"}
                  </div>
                  {editada(SECCION_EDICION.responsable) ? (
                    <div className="mt-1.5">
                      <MarcaEdicion edicion={editada(SECCION_EDICION.responsable)} />
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {cerrablePorAdmin || eliminable ? (
          <div className="mt-8 border border-[var(--color-accent-300)] bg-[var(--color-accent-100)]">
            {/* Plegada: cancelar y eliminar no se aprietan de pasada. */}
            <button
              type="button"
              aria-expanded={zonaAbierta}
              onClick={() => setZonaAbierta((v) => !v)}
              className="w-full flex items-center gap-2.5 px-5 py-3.5 bg-transparent border-0 cursor-pointer text-left text-[var(--color-accent-800)]"
            >
              <span className="font-extrabold text-meta ">Zona de peligro</span>
              <span className="text-meta opacity-70 ml-auto">
                {zonaAbierta
                  ? ""
                  : [cerrablePorAdmin ? "Cancelar por admin" : "", eliminable ? "Eliminar visita" : ""]
                      .filter(Boolean)
                      .join(" o ")}
              </span>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                className="flex-none transition-transform"
                style={{ transform: `rotate(${zonaAbierta ? 180 : 0}deg)` }}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {zonaAbierta && cerrablePorAdmin ? (
              <div className="px-5 py-4 flex items-center gap-4 flex-wrap border-t border-[var(--color-accent-300)]">
                <p className="m-0 flex-1 min-w-[240px] text-meta opacity-70">
                  Cierra esta visita sin que llegue a hacerse. Queda «Cancelada por admin», deja de
                  aparecerle al técnico y el motivo se guarda en la bitácora.
                </p>
                <button
                  type="button"
                  onClick={() => setDialogo("cancelarAdmin")}
                  className="btn btn-secondary min-h-10 px-4 flex-none"
                  style={{ borderColor: "var(--color-accent-800)", color: "var(--color-accent-800)" }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <circle cx="12" cy="12" r="8.5" />
                    <path d="M6 6l12 12" />
                  </svg>
                  <span>Cancelar por admin</span>
                </button>
              </div>
            ) : null}
            {zonaAbierta && eliminable ? (
            <div className="px-5 py-4 flex items-center gap-4 flex-wrap border-t border-[var(--color-accent-300)]">
              <p className="m-0 flex-1 min-w-[240px] text-meta opacity-70">
                Elimina esta visita del panel, del celular del técnico y de los gráficos de
                coordinación. No borra el acta de la base: pide escribir el folio para confirmar y
                queda registrada en la auditoría de eliminaciones.
              </p>
              <button
                type="button"
                onClick={() => setDialogo("eliminar")}
                className="btn btn-secondary min-h-10 px-4 flex-none"
                style={{ borderColor: "var(--color-accent-800)", color: "var(--color-accent-800)" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
                  <path d="M10 11v6M14 11v6" />
                </svg>
                <span>Eliminar visita</span>
              </button>
            </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Trazabilidad */}
      <div
        onClick={() => setTrazaAbierta(false)}
        className="fixed inset-0 z-40 bg-[rgba(31,28,33,.35)] transition-opacity duration-200"
        style={{ opacity: trazaAbierta ? 1 : 0, pointerEvents: trazaAbierta ? "auto" : "none" }}
      />
      <div
        className="fixed top-0 right-0 bottom-0 w-[min(380px,88vw)] z-41 bg-[var(--color-bg)] border-l-2 border-[var(--color-text)] flex flex-col transition-transform duration-200"
        style={{ transform: `translateX(${trazaAbierta ? "0%" : "100%"})`, zIndex: 41 }}
        aria-hidden={!trazaAbierta}
      >
        <div className="flex-none flex items-center gap-2.5 px-4.5 py-4 border-b-2 border-[var(--color-divider)]">
          <div className="min-w-0">
            <div className="font-extrabold text-lead leading-[1.15]">Trazabilidad</div>
            <div className="num text-meta text-[var(--color-muted)] mt-1">{visita.folio}</div>
          </div>
          <button
            onClick={() => setTrazaAbierta(false)}
            aria-label="Cerrar trazabilidad"
            className="btn btn-icon ml-auto"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-4.5">
          <div className="px-3.5 py-3 bg-[var(--color-surface)] border border-[var(--color-accent-300)]">
            <div className="text-cap opacity-66">Último movimiento</div>
            <div className="font-extrabold text-body leading-[1.3] mt-1.5">
              {papel
                ? "Informe en papel cargado"
                : cerrada
                ? "Acta cerrada por el técnico"
                : ejecutada
                  ? "Formulario en edición en el móvil"
                  : "Programada, sin registro en terreno"}
            </div>
            <div className="text-cap leading-[1.4] opacity-60 mt-1 tabular-nums">
              {fechaCL(visita.fechaProgramada)} · {ejec ? (papel ? "en papel" : hhmm(cerrada ? ejec.horaTermino : ejec.horaInicio)) : "creada"} ·{" "}
              {visita.tecnico?.nombreCompleto}
            </div>
          </div>

          <div className="text-cap opacity-66 mt-5 mb-2.5">Línea de tiempo</div>
          {[
            { estado: "Programada", hora: `${fechaCL(visita.fechaProgramada)} · creada`, quien: autorDeVisita(visita) ?? "—", color: "var(--color-neutral-300)" },
            ...(ejecutada && ejec
              ? [
                  {
                    estado: "En curso",
                    hora: `${fechaCL(visita.fechaProgramada)} ${papel ? "· en papel" : hhmm(ejec.horaInicio)}`,
                    quien: visita.tecnico?.nombreCompleto ?? "—",
                    color: "var(--color-accent)",
                  },
                ]
              : []),
            ...(ejecutada && ejec?.horaTermino
              ? [
                  {
                    estado: ESTADO_VISITA_LABEL[visita.estado],
                    hora: `${fechaCL(visita.fechaProgramada)} ${papel ? "· en papel" : hhmm(ejec.horaTermino)}`,
                    quien: visita.tecnico?.nombreCompleto ?? "—",
                    color: cerrada ? "var(--color-text)" : "var(--color-accent)",
                  },
                ]
              : []),
          ].map((h) => (
            <div key={h.estado} className="flex gap-3 pb-3.5">
              <div className="w-2.5 flex-none flex flex-col items-center pt-1.5">
                <span className="w-2.5 h-2.5 border border-black/[.45]" style={{ background: h.color }} />
                <span className="flex-1 w-px bg-black/[.25] mt-1" />
              </div>
              <div className="min-w-0">
                <div className="font-extrabold text-ui leading-[1.3]">{h.estado}</div>
                <div className="text-cap leading-[1.4] opacity-60 tabular-nums">
                  {h.hora} · {h.quien}
                </div>
              </div>
            </div>
          ))}

          {ediciones.length > 0 ? (
            <>
              <div className="text-cap opacity-66 mt-1.5 mb-2.5">Ediciones del acta</div>
              {[...ediciones].reverse().map((e) => (
                <div key={e.id} className="pb-3.5">
                  <div className="font-extrabold text-ui leading-[1.3]">Acta editada · {e.secciones.join(", ")}</div>
                  <div className="text-cap leading-[1.4] opacity-60 tabular-nums">{resumenEdicion(e)}</div>
                  <div className="text-meta leading-[1.4] mt-1">{e.motivo}</div>
                </div>
              ))}
            </>
          ) : null}

          <div className="text-cap opacity-66 mt-3.5 mb-1">Datos del registro</div>
          {[
            { k: "Creada", v: visita.creadoEn.slice(0, 16).replace("T", " · ") },
            { k: "Sincronizada", v: ejec?.sincronizadoEn ? ejec.sincronizadoEn.slice(0, 16).replace("T", " · ") : "pendiente" },
            // Un acta registrada offline se cerró en terreno antes de llegar
            // acá: la hora de término es la de la tienda, no la de la subida.
            { k: "Captura", v: ejec?.registradoOffline ? "Sin señal · se envió al recuperar cobertura" : "En línea" },
            { k: "Dispositivo", v: ejec?.dispositivo ?? "—" },
            { k: "Folio", v: visita.folio },
          ].map((t) => (
            <div key={t.k} className="flex gap-3 py-2.5 border-b border-black/[.18]">
              <div className="text-cap leading-[1.5] opacity-62 min-w-[92px] flex-none">
                {t.k}
              </div>
              <div className="text-meta min-w-0 tabular-nums text-right ml-auto">{t.v}</div>
            </div>
          ))}
        </div>
      </div>

      {dialogo === "correo" && correo ? (
        <CorreoDialogo visita={visita} correo={correo} onCerrar={() => setDialogo(null)} onHecho={aviso} />
      ) : null}
      {dialogo === "editar" ? (
        <VisitaDialogo
          visita={visita}
          onCerrar={() => setDialogo(null)}
          onHecho={(m) => {
            aviso(m);
            router.refresh();
          }}
        />
      ) : null}
      {dialogo === "problemas" ? (
        <ProblemasVisitaDialogo
          visita={visita}
          onCerrar={() => setDialogo(null)}
          onHecho={(m) => {
            aviso(m);
            router.refresh();
          }}
        />
      ) : null}
      {dialogo === "reprogramar" ? (
        <ReprogramarDialogo
          visita={visita}
          onCerrar={() => setDialogo(null)}
          onHecho={(m) => {
            aviso(m);
            router.refresh();
          }}
        />
      ) : null}

      {dialogo === "liberar" ? (
        <LiberarDialogo
          visita={visita}
          onCerrar={() => setDialogo(null)}
          onHecho={(m) => {
            aviso(m);
            router.refresh();
          }}
        />
      ) : null}
      {dialogo === "cancelarAdmin" ? (
        <CancelarAdminDialogo
          visita={visita}
          onCerrar={() => setDialogo(null)}
          onHecho={(m) => {
            aviso(m);
            router.refresh();
          }}
        />
      ) : null}
      {dialogo === "eliminar" ? (
        <EliminarVisitaDialogo
          visita={visita}
          onCerrar={() => setDialogo(null)}
          onError={aviso}
          onEliminada={() => router.push("/admin/visitas")}
        />
      ) : null}
      {agendarProblema ? (
        <VisitaDialogo
          origen={agendarProblema}
          onCerrar={() => setAgendarProblema(null)}
          onHecho={(m) => {
            aviso(m);
            setAgendarProblema(null);
            router.refresh();
          }}
        />
      ) : null}

      {visor.abierto ? (
        <VisorFotos
          fotos={fotosVisor.map((f) => ({
            src: f.archivoUrl,
            titulo: f.interno ? "Foto interna" : f.etiqueta ?? "Foto del trabajo",
            subtitulo: `${visita.folio} · ${visita.sucursal?.nombre ?? ""} · ${hhmm(f.tomadaEn)}`,
          }))}
          indice={visor.indice ?? 0}
          onIndice={visor.mover}
          onCerrar={visor.cerrar}
        />
      ) : null}

      <Toast texto={toast} variante="panel" />
    </div>
  );
}

/** Cómo quedó el último envío del acta, junto al sello de la visita. */
function EstadoEnvio({ enviada }: { enviada: ActaEnviada }) {
  const cuando = `${fechaCL(enviada.en)} ${hhmm(enviada.en)}`;
  const por = enviada.enviadoPor ? ` · por ${enviada.enviadoPor}` : "";
  if (enviada.estado === "ERROR") {
    return (
      <span className="ml-2 inline-flex items-center gap-1.5 flex-wrap text-[var(--color-accent-800)] font-semibold">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7.5v5.5M12 16.5v.5" />
        </svg>
        No se pudo enviar a {enviada.para} · {cuando}
        {por}
        {enviada.error ? <span className="font-normal">· {enviada.error}</span> : null}
      </span>
    );
  }
  if (enviada.estado === "ENCOLADO") {
    return (
      <span className="ml-2 inline-flex items-center gap-1.5 text-[var(--color-muted)] font-semibold">
        Envío sin confirmar a {enviada.para} · {cuando}
        {por}
      </span>
    );
  }
  const copias = [enviada.cc && `CC ${enviada.cc}`, enviada.cco && `CCO ${enviada.cco}`].filter(Boolean).join(" · ");
  return (
    <span className="ml-2 inline-flex items-center gap-1.5 flex-wrap text-[var(--color-text)] font-semibold">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
        <path d="M4 12l5 5L20 6" />
      </svg>
      Enviada a {enviada.para}
      {copias ? ` (${copias})` : ""} · {cuando}
      {por} · {enviada.adjuntos} {enviada.adjuntos === 1 ? "archivo" : "archivos"}
    </span>
  );
}

const CAMPOS_DESTINO: { k: CampoDestinatario; t: string }[] = [
  { k: "para", t: "Para" },
  { k: "cc", t: "CC" },
  { k: "cco", t: "CCO" },
];

/** "Enviar por correo" — remitente fijo, destinatarios, mensaje editable y qué se adjunta. */
function CorreoDialogo({
  visita,
  correo,
  onCerrar,
  onHecho,
}: {
  visita: Visita;
  correo: DatosCorreo;
  onCerrar: () => void;
  onHecho: (mensaje: string) => void;
}) {
  const router = useRouter();
  const ejec = visita.ejecucion;
  const firmante = visita.firmas?.[0]?.nombre ?? "la tienda";
  const fotos = (visita.fotos ?? []).filter((f) => !f.interno).length;
  const videos = (visita.videos ?? []).filter((v) => !v.interno).length;

  // Para, CC y CCO los escribe quien envía: nada viene marcado. Folio, tienda,
  // fecha, horario, motivo y técnicos ya van arriba del correo, en la tabla de
  // datos clave: el mensaje no los repite.
  const [form, setForm] = useState<Record<string, string | boolean>>(() => ({
    para: "",
    cc: "",
    cco: "",
    asunto: `${visita.sucursal?.nombre} · ${textoMotivosReales(visita)} · ${fechaCL(visita.fechaProgramada)}`,
    cuerpo:
      `Estimados,\n\n` +
      `Informamos que la visita técnica en ${visita.sucursal?.nombre} (${visita.cliente?.nombreFantasia}) fue realizada el ${fechaCL(visita.fechaProgramada)}.\n\n` +
      (ejec?.observaciones ? `Trabajo realizado:\n${ejec.observaciones}\n\n` : "") +
      ((visita.problemas ?? []).length
        ? `Quedaron ${visita.problemas!.length} puntos por resolver; van detallados en el acta adjunta.\n\n`
        : "La visita se cerró sin problemas pendientes en la tienda.\n\n") +
      `Adjuntamos el acta en PDF, con la firma de ${firmante}, responsable de la tienda` +
      (fotos + videos > 0 ? `, y las fotos y videos del trabajo en un archivo .zip.\n\n` : ".\n\n") +
      `Saludos cordiales,\nCoordinación\nGrupo dMC`,
  }));
  // A qué campo van las sugerencias que se tocan.
  const [destino, setDestino] = useState<CampoDestinatario>("para");

  // El PDF del acta y el mismo .zip que se baja en «Descargar»: fotos y videos
  // del cliente, nunca los internos.
  const [opciones] = useState(() => [
    { clave: "pdf" as ClaveAdjunto, label: nombreArchivoActa(visita) },
    ...(fotos + videos > 0
      ? [
          {
            clave: "zip" as ClaveAdjunto,
            label: `${nombreZipMultimedia(visita)} · ${[
              fotos ? `${fotos} ${fotos === 1 ? "foto" : "fotos"}` : "",
              videos ? `${videos} ${videos === 1 ? "video" : "videos"}` : "",
            ]
              .filter(Boolean)
              .join(" y ")}`,
          },
        ]
      : []),
  ]);
  const [adjuntos, setAdjuntos] = useState<Adjunto[]>(() => opciones.map(({ label }) => ({ label, incluido: true })));

  const [guardando, setGuardando] = useState(false);

  async function enviar() {
    const d = repartirDestinatarios({ para: String(form.para), cc: String(form.cc), cco: String(form.cco) });
    if (d.invalidos.length) {
      onHecho(`Revisa ${d.invalidos.length === 1 ? "este correo" : "estos correos"}: ${d.invalidos.slice(0, 3).join(", ")}`);
      return;
    }
    if (!d.para.length && !d.cc.length && !d.cco.length) {
      onHecho("Escribe al menos un destinatario en Para, CC o CCO.");
      return;
    }
    setGuardando(true);
    const res = await enviarActaAction({
      folio: visita.folio,
      para: String(form.para),
      cc: String(form.cc),
      cco: String(form.cco),
      asunto: String(form.asunto),
      cuerpo: String(form.cuerpo),
      adjuntos: opciones.filter((_, i) => adjuntos[i]?.incluido).map((o) => o.clave),
    });
    setGuardando(false);
    // Salga bien o mal queda un registro nuevo: el sello de la visita lo muestra.
    router.refresh();
    if (!res.ok) {
      onHecho(res.error ?? "No se pudo enviar.");
      return;
    }
    const n = d.para.length + d.cc.length + d.cco.length;
    onHecho(`Acta enviada a ${n} ${n === 1 ? "destinatario" : "destinatarios"}`);
    onCerrar();
  }

  const disponibles = correo.sugeridos.filter(
    (s) => !yaIncluido(s.email, String(form.para), String(form.cc), String(form.cco))
  );

  return (
    <Dialogo
      titulo={`Enviar acta ${visita.folio}`}
      cta="Enviar correo"
      nota={`Sale desde el servidor y queda registrado quién lo envió, a quién y cuándo. Separa varios correos con coma (máximo ${MAX_DESTINATARIOS} en total). Si dejas Para vacío, el correo va a tu cuenta y los demás en copia.`}
      campos={[
        { k: "para", label: "Para", ph: "encargado@tienda.cl" },
        { k: "cc", label: "CC", ph: "separa varios correos con coma" },
        { k: "cco", label: "CCO (copia oculta)", span: 2, ph: "no se ven entre ellos ni los ve el resto" },
        { k: "asunto", label: "Asunto", span: 2 },
        { k: "cuerpo", label: "Mensaje", span: 2, tipo: "cuerpo" },
      ]}
      form={form}
      onCampo={(k, v) => setForm((prev) => ({ ...prev, [k]: v }))}
      onCerrar={onCerrar}
      onGuardar={enviar}
      guardando={guardando}
      adjuntos={adjuntos}
      onToggleAdjunto={(i) =>
        setAdjuntos((prev) => prev.map((a, j) => (j === i ? { ...a, incluido: !a.incluido } : a)))
      }
    >
      <div className="mt-4 text-meta">
        <span className="text-[var(--color-muted)]">De: </span>
        <span className="font-semibold">{correo.de}</span>
        {!correo.conSuCorreo ? (
          <span className="text-[var(--color-muted)]">
            {" "}
            · tu dominio no está verificado en el proveedor de correo; las respuestas te llegan a {correo.responderA}
          </span>
        ) : null}
      </div>
      {!correo.listo ? (
        <div className="mt-4 px-3.5 py-3 bg-[var(--color-accent-200)] border border-[var(--color-accent-300)] text-meta text-[var(--color-accent-800)]">
          El envío de correo todavía no está configurado en el servidor. Hasta que se definan RESEND_API_KEY y
          CORREO_REMITENTE el correo no sale.
        </div>
      ) : null}
      {disponibles.length > 0 ? (
        <div className="mt-4">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="text-cap text-[var(--color-muted)]">Correos ya usados con esta tienda y su cliente · agregar a</span>
            <div role="radiogroup" aria-label="Agregar sugerencias a" className="inline-flex border border-[var(--color-divider)]">
              {CAMPOS_DESTINO.map((c) => (
                <button
                  key={c.k}
                  type="button"
                  role="radio"
                  aria-checked={destino === c.k}
                  onClick={() => setDestino(c.k)}
                  className={`px-2.5 min-h-[30px] text-meta font-semibold ${
                    destino === c.k
                      ? "bg-[var(--color-text)] text-[var(--color-bg)]"
                      : "bg-transparent text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
                  }`}
                >
                  {c.t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {disponibles.map((s) => (
              <button
                key={s.email}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, [destino]: agregarCorreo(String(prev[destino]), s.email) }))}
                className="btn btn-secondary min-h-[34px] px-3 gap-1.5 text-meta"
                title={s.email}
              >
                <span className="font-semibold">+ {s.nombre ?? s.email}</span>
                <span className="text-[var(--color-muted)]">{s.nombre ? `${s.email} · ${s.detalle}` : s.detalle}</span>
              </button>
            ))}
          </div>
        </div>
      ) : correo.sugeridos.length === 0 ? (
        <p className="mt-4 mb-0 text-meta text-[var(--color-muted)]">
          Todavía no hay correos conocidos para esta tienda ni su cliente. Los que escribas aquí aparecerán como
          sugerencia la próxima vez.
        </p>
      ) : null}
    </Dialogo>
  );
}

/** «Modificado por el técnico · Ana · 13/08/2026 a las 08:30», junto al título de la parte editada. */
function MarcaEdicion({ edicion }: { edicion: VisitaEdicion | undefined }) {
  if (!edicion) return null;
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap ml-2 align-middle">
      <Tag variant="accent">{quienModifico(edicion)}</Tag>
      <span className="text-cap opacity-66 normal-case tabular-nums">{resumenEdicion(edicion)}</span>
    </span>
  );
}
