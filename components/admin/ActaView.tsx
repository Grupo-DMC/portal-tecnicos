"use client";
import Espera from "@/components/ui/Espera";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Tag from "@/components/Tag";
import Icono from "@/components/ui/Icono";
import { PILL_VISITA } from "@/lib/ui/lista-visitas";
import { plural } from "@/lib/ui/plural";
import { esDatoDePrueba } from "@/lib/ui/pruebas";
import { ocultarCredenciales, ocultarRut } from "@/lib/ui/reservado";
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
import NuevaVisitaHoja, { precargaDeProblema } from "@/components/admin/NuevaVisitaHoja";
import VisorFotos, { useVisorFotos } from "@/components/ui/VisorFotos";
import { Toast, useToast } from "@/components/ui/Toast";
import { enviarActaAction } from "@/app/actions/admin";
import { permitirEditarTecnicoAction } from "@/app/actions/ediciones";
import EstadoProblemaTag from "@/components/EstadoProblemaTag";
import { ESTADO_VISITA_LABEL, nombreDeQuienLaTomo, textoMotivos, textoMotivosReales } from "@/lib/ui/estado";
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
import Desplegable from "@/components/ui/Desplegable";
import CambiarProblema from "@/components/admin/problemas/CambiarProblema";

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
  puedeVerRut = false,
}: {
  visita: Visita;
  enviada: ActaEnviada | null;
  /** Solo llega para quien puede enviar el acta. */
  correo?: DatosCorreo;
  /** El administrador puede mostrar los RUT completos. */
  puedeVerRut?: boolean;
}) {
  const router = useRouter();
  const ref = useReferencias();
  const { problemas: catalogoProblema, trabajos: catalogoTrabajo } = ref;
  const { toast, aviso } = useToast();
  // «Visitas» vuelve a la lista tal como se dejó, con sus filtros.
  const [volverA, setVolverA] = useState("/admin/visitas");
  useEffect(() => setVolverA(urlVisitasRecordada()), []);
  const [trazaAbierta, setTrazaAbierta] = useState(false);
  /** Los RUT de terceros van ocultos; solo el administrador puede destaparlos. */
  const [rutCompleto, setRutCompleto] = useState(false);
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

  const reagenda = visita.reagendamientos?.[0];
  const problemas = visita.problemas ?? [];
  const abiertos = problemas.filter((p) => p.estado !== "RESUELTO").length;
  const botonProblemas = registraProblemas ? (
    <button type="button" className="btn-out sm" onClick={() => setDialogo("problemas")}>
      <Icono nombre="mas" />
      {problemas.length ? "Agregar o corregir problemas" : "Registrar problemas"}
    </button>
  ) : editableActa ? (
    <Link className="btn-out sm" href={`/admin/visitas/${encodeURIComponent(visita.folio)}/editar#ea-sec-problemas`}>
      <Icono nombre="mas" />
      Agregar o corregir problemas
    </Link>
  ) : null;

  const tarjetaProblemas = (
    <section className={editada(SECCION_EDICION.problemas) ? "vd-card cambiada" : "vd-card"}>
      <div className="vd-ch">
        <h2 className="vd-h">
          Problemas levantados<span className={abiertos ? "cc warn" : "cc"}>{problemas.length}</span>
          <MarcaEdicion edicion={editada(SECCION_EDICION.problemas)} />
        </h2>
        {botonProblemas}
      </div>
      {problemas.length === 0 ? (
        <p className="vd-nada">Sin problemas registrados en esta visita.</p>
      ) : (
        <div className="probs">
          {problemas.map((p, i) => (
            <article className="prob" key={p.id} aria-label={`Problema ${i + 1}`}>
              <div className="prob-top">
                <span className="n">{i + 1}</span>
                Problema {i + 1} de {problemas.length}
                <EstadoProblemaTag estado={p.estado} className="ml-auto" />
              </div>
              <dl className="prob-body">
                <div>
                  <dt>Tipo de problema</dt>
                  <dd className="big">{nombreProblema(catalogoProblema, p.tipoCodigo)}</dd>
                </div>
                {p.items.length > 0 ? (
                  <div>
                    <dt>{p.tipoCodigo === "PLACAS_DANADAS" ? "Modelos de placa y cantidad" : "Equipos afectados"}</dt>
                    <dd className="eqs">
                      {p.items.map((it) => (
                        <span className="eq" key={it.id}>
                          {it.etiqueta} <span>× {it.cantidad}</span>
                        </span>
                      ))}
                    </dd>
                  </div>
                ) : null}
                {p.descripcion ? (
                  <div>
                    <dt>{ejecutada ? "Qué encontró el técnico" : "Qué pasa"}</dt>
                    <dd>{p.descripcion}</dd>
                  </div>
                ) : null}
                {/* El celular ya no pide solución: solo las actas anteriores la traen. */}
                {p.solucion ? (
                  <div>
                    <dt>{p.estado === "RESUELTO" ? "Qué se realizó en terreno" : "Solución sugerida por el técnico"}</dt>
                    <dd>{p.solucion}</dd>
                  </div>
                ) : null}
                {permite("problemas.editar") ? (
                  <div>
                    <Desplegable
                      claseBoton="btn-out sm"
                      clasePanel="pb-pop izquierda"
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
                          visitas={[]}
                          estados={ref.estadosProblema.filter((e) => e.activo)}
                          onAviso={aviso}
                          onHecho={() => {
                            cerrar();
                            router.refresh();
                          }}
                        />
                      )}
                    </Desplegable>
                  </div>
                ) : null}
                {p.estado !== "RESUELTO" && permite("visitas.crear") ? (
                  <div>
                    <button
                      type="button"
                      className="btn-pri sm"
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
                    >
                      <Icono nombre="visitas" />
                      Agendar visita para resolver
                    </button>
                  </div>
                ) : null}
              </dl>
            </article>
          ))}
        </div>
      )}
    </section>
  );

  const galeria = (fotos: typeof fotosCliente, desde: number) => (
    <div className="photos">
      {fotos.map((f, i) => (
        // La foto se agranda encima del acta, no en otra pestaña.
        <button key={f.id} type="button" className="thumb" onClick={() => visor.abrir(desde + i)} title="Ver la foto en grande">
          {/* eslint-disable-next-line @next/next/no-img-element -- ruta propia con sesión */}
          <img src={f.archivoUrl} alt={f.interno ? "Foto interna" : (f.etiqueta ?? "Foto del trabajo")} loading="lazy" />
          <span className="thumb-cap">
            <b>{f.etiqueta ?? "Foto"}</b>
            <span>{hhmm(f.tomadaEn)}</span>
          </span>
        </button>
      ))}
    </div>
  );

  const rutVisible = (rut: string | null | undefined) => (rut ? (rutCompleto ? rut : ocultarRut(rut)) : "");
  const rutResponsable = ejec?.responsableRut ?? visita.responsableRut;
  const cargoResponsable = ejec ? ejec.responsableCargo : visita.responsableCargo;
  const direccion = textoDireccion(visita.mall, visita.sucursal);
  const ultimoMovimiento = papel
    ? "Informe en papel cargado"
    : cerrada
      ? "Acta cerrada por el técnico"
      : ejecutada
        ? "Formulario en edición en el móvil"
        : "Programada, sin registro en terreno";

  return (
    <div className="dmc pagina">
      <div className="wrap">
        <header className="vd-head">
          <Link href={volverA} className="back">
            <Icono nombre="atras" />
            Visitas
          </Link>
          <div className="vd-bar">
            <div>
              <div className="vd-title">
                <h1>{visita.folio}</h1>
                {eliminada ? <span className="pill off">Eliminada</span> : null}
                <span className={`pill ${PILL_VISITA[visita.estado]}`}>{ESTADO_VISITA_LABEL[visita.estado]}</span>
                {ediciones.length > 0 ? <span className="flag test">Acta editada</span> : null}
                {esDatoDePrueba(visita.cliente?.nombreFantasia, visita.sucursal?.nombre) ? <span className="flag test">Prueba</span> : null}
              </div>
              <p className="vd-meta">
                {[
                  visita.cliente?.nombreFantasia,
                  visita.marca && visita.marca.nombre !== visita.cliente?.nombreFantasia ? visita.marca.nombre : null,
                  visita.sucursal?.nombre,
                ]
                  .filter(Boolean)
                  .join(" · ")}{" "}
                · {textoMotivos(visita)}
              </p>
              <p className="vd-meta">
                {sello}
                {enviada ? <EstadoEnvio enviada={enviada} /> : null}
              </p>
            </div>

            <div className="vd-ops">
              <button type="button" className="btn-out" onClick={() => setTrazaAbierta(true)}>
                <Icono nombre="reagendas" />
                Trazabilidad
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
                            fotosCliente.length ? plural(fotosCliente.length, "foto", "fotos") : "",
                            videosCliente.length ? plural(videosCliente.length, "video", "videos") : "",
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
                <button type="button" className="btn-pri" onClick={() => setDialogo("reprogramar")}>
                  <Icono nombre="visitas" />
                  Cambiar fecha y técnico
                </button>
              ) : null}
              {liberable ? (
                <button type="button" className="btn-pri" onClick={() => setDialogo("liberar")}>
                  Liberar
                </button>
              ) : null}
              {cerrada && correo && permite("visitas.enviar") ? (
                <button type="button" className="btn-pri" onClick={() => setDialogo("correo")}>
                  <Icono nombre="correo" />
                  Enviar por correo
                </button>
              ) : null}
            </div>
          </div>

          {eliminada ? (
            <div className="vd-aviso">
              Esta visita está eliminada
              {eliminada.en ? ` desde el ${fechaCL(eliminada.en)} a las ${hhmm(eliminada.en)}` : ""} · la eliminó{" "}
              {eliminada.por}. Solo la ve el administrador: para los demás roles y para el técnico no existe, y no cuenta en
              el panel, los gráficos ni los problemas.
            </div>
          ) : null}

          {/* El técnico pidió poder corregir su acta: se atiende con «Permitir que el técnico la corrija». */}
          {ejec?.edicionSolicitadaEn && cerrada ? (
            <div className="vd-aviso">
              <b>
                El técnico pidió editar esta acta · {fechaCL(ejec.edicionSolicitadaEn)} a las {hhmm(ejec.edicionSolicitadaEn)}
              </b>
              {ejec.edicionSolicitadaMotivo ? <div>«{ejec.edicionSolicitadaMotivo}»</div> : null}
              {editableActa ? <div>Atiéndelo desde Editar › Permitir que el técnico la corrija, o corrige el acta tú mismo.</div> : null}
            </div>
          ) : null}

          {sinCerrar ? (
            <div className="vd-aviso">
              {AVISO_ESTADO[visita.estado]}
              {tomadaPor
                ? ` La inició ${tomadaPor} y solo esa persona puede terminarla${liberable ? "; con «Liberar» vuelve a quedar programada." : "."}`
                : ""}
            </div>
          ) : null}
        </header>

        <div className="vd-grid">
          <div className="vd-main">
            {/* El registro de cada corrección al acta: qué parte, por qué, quién y
                cuándo. Es interno: el PDF no lo menciona. */}
            {ediciones.length > 0 ? (
              <section className="vd-card cambiada">
                <h2 className="vd-h">
                  Esta acta fue editada · {ediciones.length} {ediciones.length === 1 ? "vez" : "veces"}
                </h2>
                {ediciones.map((e) => (
                  <div key={e.id} className="vd-edicion">
                    <div className="eqs">
                      {e.secciones.map((sec) => (
                        <span key={sec} className="eq">
                          {sec}
                        </span>
                      ))}
                    </div>
                    <p>Por qué se cambió · {e.motivo}</p>
                    <p className="vd-nada">{resumenEdicion(e)}</p>
                    <details>
                      <summary>Ver qué cambió ({e.detalle.length})</summary>
                      <ul>
                        {e.detalle.map((linea, i) => (
                          <li key={i}>{linea}</li>
                        ))}
                      </ul>
                    </details>
                  </div>
                ))}
              </section>
            ) : null}

            {!ejecutada ? (
              <section className="vd-card">
                <h2 className="vd-h">El técnico aún no registra el formulario</h2>
                <p className="vd-nada">
                  La visita está en estado {ESTADO_VISITA_LABEL[visita.estado]}. Cuando el técnico la cierre en terreno vas a
                  ver aquí problemas, fotos, horarios y la firma de la tienda.
                </p>
              </section>
            ) : null}

            {visita.trabajoSolicitado ? (
              <section className="vd-card">
                <div className="vd-ch">
                  <h2 className="vd-h">Trabajo solicitado</h2>
                  {autorDeVisita(visita) ? <span className="vd-nada">por {autorDeVisita(visita)}</span> : null}
                </div>
                <p className="req">{ocultarCredenciales(visita.trabajoSolicitado)}</p>
                {visita.adjuntos?.length ? <AdjuntosVista adjuntos={visita.adjuntos} /> : null}
                {visita.indicacionesAcceso ? (
                  <>
                    <p className="sub-h">Indicaciones de acceso</p>
                    <p className="req">{ocultarCredenciales(visita.indicacionesAcceso)}</p>
                  </>
                ) : null}
              </section>
            ) : null}

            {ejecutada && visita.trabajos && visita.trabajos.length > 0 ? (
              <section className={editada(SECCION_EDICION.trabajo) ? "vd-card cambiada" : "vd-card"}>
                <div className="vd-ch">
                  <h2 className="vd-h">
                    Trabajo realizado<span className="cc">{visita.trabajos.length}</span>
                    <MarcaEdicion edicion={editada(SECCION_EDICION.trabajo)} />
                  </h2>
                </div>
                <div className="works">
                  {visita.trabajos.map((t) => (
                    <article className="work" key={t.id}>
                      {t.motivoCodigo ? <span className="vd-nada">{nombreMotivo(t.motivoCodigo)}</span> : null}
                      <h3>{nombreTrabajo(catalogoTrabajo, t.trabajoCodigo)}</h3>
                      {t.subtrabajos.length > 0 ? (
                        <ul className="qty">
                          {t.subtrabajos.map((s) => (
                            <li key={s.id}>
                              <span>{s.etiqueta}</span>
                              <b>× {s.cantidad}</b>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {t.detalle ? <p>{t.detalle}</p> : null}
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {ejec?.observaciones ? (
              <section className={editada(SECCION_EDICION.trabajo) ? "vd-card cambiada" : "vd-card"}>
                <div className="vd-ch">
                  <h2 className="vd-h">
                    Observaciones del técnico
                    <MarcaEdicion edicion={editada(SECCION_EDICION.trabajo)} />
                  </h2>
                </div>
                <p className="req">{ocultarCredenciales(ejec.observaciones)}</p>
              </section>
            ) : null}

            {/* Una visita sin iniciar no muestra el acta, pero coordinación puede
                haberse enterado de problemas y tiene que poder anotarlos. */}
            {ejecutada || registraProblemas || problemas.length > 0 ? tarjetaProblemas : null}

            {ejecutada ? (
              <section className={editada(SECCION_EDICION.media) ? "vd-card cambiada" : "vd-card"}>
                <div className="vd-ch">
                  <h2 className="vd-h">
                    Evidencia
                    <MarcaEdicion edicion={editada(SECCION_EDICION.media)} />
                  </h2>
                </div>
                <div className="vd-ch">
                  <p className="sub-h">Fotos del trabajo ({fotosCliente.length})</p>
                  {fotosCliente.length > 0 ? (
                    <button type="button" className="btn-out sm" disabled={bajando !== null} onClick={() => bajarTodo("fotos")}>
                      <Icono nombre="descargar" />
                      <Espera activo={bajando === "fotos"} accion="Descargando">Descargar todas las fotos</Espera>
                    </button>
                  ) : null}
                </div>
                {fotosCliente.length ? galeria(fotosCliente, 0) : <p className="vd-nada">Sin fotos registradas.</p>}
                {/* Los clips salen de /api/visita/video/<id>, que responde por rangos:
                    se pueden adelantar sin bajar el video completo. */}
                <div className="vd-ch">
                  <p className="sub-h">Videos del trabajo ({videosCliente.length})</p>
                  {videosCliente.length > 0 ? (
                    <button type="button" className="btn-out sm" disabled={bajando !== null} onClick={() => bajarTodo("videos")}>
                      <Icono nombre="descargar" />
                      <Espera activo={bajando === "videos"} accion="Descargando">Descargar todos los videos</Espera>
                    </button>
                  ) : null}
                </div>
                {videosCliente.length ? (
                  <div className="videos">
                    {videosCliente.map((v) => (
                      <figure key={v.id}>
                        <video src={v.archivoUrl} controls preload="metadata" playsInline />
                        <figcaption>
                          <b>{v.etiqueta ?? "Video del trabajo"}</b>
                          <span>
                            {v.duracionSeg ? reloj(v.duracionSeg) : "—"}
                            {v.ancho && v.alto ? ` · ${v.ancho}x${v.alto}` : ""}
                          </span>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                ) : (
                  <p className="vd-nada">Sin videos registrados.</p>
                )}
              </section>
            ) : null}

            {hayInterno ? (
              <section className={editada(SECCION_EDICION.interno) ? "vd-card interno cambiada" : "vd-card interno"}>
                <div className="vd-ch">
                  <h2 className="vd-h">
                    Comentario interno del técnico
                    <MarcaEdicion edicion={editada(SECCION_EDICION.interno)} />
                  </h2>
                  <span className="flag warn">No va en el acta al cliente</span>
                </div>
                {internos.length > 0 ? (
                  <div className="eqs">
                    {internos.map((x) => (
                      <span key={x.codigo} className="eq">
                        {x.nombre}
                      </span>
                    ))}
                  </div>
                ) : null}
                {ejec?.comentarioInterno ? <p>{ocultarCredenciales(ejec.comentarioInterno)}</p> : null}
                {fotosInternas.length > 0 ? galeria(fotosInternas, fotosCliente.length) : null}
                {videosInternos.length > 0 ? (
                  <div className="videos">
                    {videosInternos.map((v) => (
                      <video key={v.id} src={v.archivoUrl} controls preload="metadata" playsInline />
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}

            {cerrablePorAdmin || eliminable ? (
              // Plegada: cancelar y eliminar no se aprietan de pasada.
              <details className="danger">
                <summary>
                  Zona de peligro
                  <span>
                    {[cerrablePorAdmin ? "Cancelar por admin" : "", eliminable ? "Eliminar visita" : ""].filter(Boolean).join(" o ")}
                  </span>
                </summary>
                {cerrablePorAdmin ? (
                  <div className="danger-body">
                    <p>
                      Cierra esta visita sin que llegue a hacerse. Queda «Cancelada por admin», deja de aparecerle al técnico y
                      el motivo se guarda en la bitácora.
                    </p>
                    <button type="button" className="btn-danger" onClick={() => setDialogo("cancelarAdmin")}>
                      Cancelar por admin
                    </button>
                  </div>
                ) : null}
                {eliminable ? (
                  <div className="danger-body">
                    <p>
                      Elimina esta visita del panel, del celular del técnico y de los gráficos de coordinación. No borra el acta
                      de la base: pide escribir el folio para confirmar y queda registrada en la auditoría de eliminaciones.
                    </p>
                    <button type="button" className="btn-danger" onClick={() => setDialogo("eliminar")}>
                      Eliminar visita
                    </button>
                  </div>
                ) : null}
              </details>
            ) : null}
          </div>

          <aside className="vd-side" aria-label="Resumen de la visita">
            <section className="vd-card">
              <h2 className="vd-h">Detalle de la visita</h2>
              <dl className="facts">
                <Dato k={visita.fechaHasta ? "Margen de días" : "Fecha"}>{textoFechaVisita(visita)}</Dato>
                <Dato k="Llegada">{visita.horaProgramada ?? "Sin hora, durante el día"}</Dato>
                {papel ? (
                  <Dato k="Registro">Informe en papel, cargado desde el panel</Dato>
                ) : ejecutada && ejec ? (
                  <Dato k="En terreno">
                    {hhmm(ejec.horaInicio)}
                    {duracion ? `, ${duracion} min en la tienda` : ""}
                  </Dato>
                ) : null}
                <Dato k="Cliente">
                  {visita.cliente?.nombreFantasia ?? "—"}
                  {visita.marca && visita.marca.nombre !== visita.cliente?.nombreFantasia ? <small>{visita.marca.nombre}</small> : null}
                </Dato>
                <Dato k="Sucursal">
                  {visita.sucursal?.nombre ?? "—"}
                  <small>{direccion}</small>
                </Dato>
                <Dato k="Técnico">
                  {visita.tecnico?.nombreCompleto ?? "—"}
                  <small>
                    {visita.tecnicoAyudante ? `Ayudante: ${visita.tecnicoAyudante.nombreCompleto}` : "Sin ayudante"}
                  </small>
                  {tomadaPor ? <small>En curso, la inició {tomadaPor}</small> : null}
                </Dato>
                <Dato k="Contacto">
                  {visita.responsableNombre ?? "Sin definir"}
                  {cargoResponsable ? <small>{cargoResponsable}</small> : null}
                  <small>{visita.responsableTelefono ?? "Sin teléfono"}</small>
                  {rutResponsable ? <small>RUT {rutVisible(rutResponsable)}</small> : null}
                  {ejec?.responsableEmail ? <small>{ejec.responsableEmail}</small> : null}
                </Dato>
                {visita.motivoPendiente ? <Dato k="Motivo del técnico">{visita.motivoPendiente}</Dato> : null}
                {reagenda ? <Dato k="Reagendada por">{reagenda.motivo}</Dato> : null}
              </dl>
              {permite("visitas.editar") ? (
                <div className="vd-corregir">
                  <button type="button" className={reprogramable ? "btn-out sm" : "btn-pri sm"} onClick={() => setDialogo("editar")}>
                    <Icono nombre="editar" />
                    Corregir visita
                  </button>
                  {cerrada ? <p>El acta ya está cerrada: la corrección queda registrada en la trazabilidad.</p> : null}
                </div>
              ) : null}
            </section>

            <section className="vd-card">
              <div className="last-move">
                <span>Último movimiento</span>
                <b>{ultimoMovimiento}</b>
              </div>
              <button type="button" className="enlace" onClick={() => setTrazaAbierta(true)}>
                Ver trazabilidad completa
              </button>
            </section>

            {ejecutada ? (
              <section className={editada(SECCION_EDICION.responsable) ? "vd-card sig-card cambiada" : "vd-card sig-card"}>
                <h2 className="vd-h">
                  Recepción conforme
                  <MarcaEdicion edicion={editada(SECCION_EDICION.responsable)} />
                </h2>
                {firma?.imagenUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- ruta propia con sesión
                  <img className="sig" src={firma.imagenUrl} alt={`Firma de ${firma.nombre}`} />
                ) : (
                  <div className="sig-vacia">
                    {cerrada ? (papel ? "Firmado en papel" : "Firma capturada en terreno") : "Sin firma todavía"}
                  </div>
                )}
                <div className="sig-line" />
                <p className="sig-name">{cerrada ? (firma?.nombre ?? "—") : "—"}</p>
                <p className="vd-nada">
                  Responsable de tienda · {cerrada ? rutVisible(firma?.rut) || "—" : "sin firmar"}
                  {puedeVerRut && ((cerrada && firma?.rut) || rutResponsable) ? (
                    <button type="button" className="enlace rut-btn" aria-pressed={rutCompleto} onClick={() => setRutCompleto((x) => !x)}>
                      {rutCompleto ? "Ocultar RUT" : "Mostrar RUT completos"}
                    </button>
                  ) : null}
                </p>
              </section>
            ) : null}
          </aside>
        </div>
      </div>

      {/* Trazabilidad */}
      <div className={trazaAbierta ? "traza-fondo abierta" : "traza-fondo"} onClick={() => setTrazaAbierta(false)} />
      <div className={trazaAbierta ? "traza abierta" : "traza"} aria-hidden={!trazaAbierta}>
        <div className="sd-head">
          <div>
            <h2>Trazabilidad</h2>
            <p className="vd-nada">{visita.folio}</p>
          </div>
          <button type="button" className="icon-btn" aria-label="Cerrar trazabilidad" onClick={() => setTrazaAbierta(false)}>
            <Icono nombre="cerrar" />
          </button>
        </div>
        <div className="sd-body">
          <div className="last-move">
            <span>Último movimiento</span>
            <b>{ultimoMovimiento}</b>
            <span>
              {fechaCL(visita.fechaProgramada)} · {ejec ? (papel ? "en papel" : hhmm(cerrada ? ejec.horaTermino : ejec.horaInicio)) : "creada"} ·{" "}
              {visita.tecnico?.nombreCompleto}
            </span>
          </div>

          <p className="sub-h">Línea de tiempo</p>
          <ul className="trace">
            {[
              { estado: "Programada", hora: `${fechaCL(visita.fechaProgramada)} · creada`, quien: autorDeVisita(visita) ?? "—", punto: "s-programada" },
              ...(ejecutada && ejec
                ? [
                    {
                      estado: "En curso",
                      hora: `${fechaCL(visita.fechaProgramada)} ${papel ? "· en papel" : hhmm(ejec.horaInicio)}`,
                      quien: visita.tecnico?.nombreCompleto ?? "—",
                      punto: "s-en-curso",
                    },
                  ]
                : []),
              ...(ejecutada && ejec?.horaTermino
                ? [
                    {
                      estado: ESTADO_VISITA_LABEL[visita.estado],
                      hora: `${fechaCL(visita.fechaProgramada)} ${papel ? "· en papel" : hhmm(ejec.horaTermino)}`,
                      quien: visita.tecnico?.nombreCompleto ?? "—",
                      punto: cerrada ? "s-completada" : "s-en-curso",
                    },
                  ]
                : []),
            ].map((h) => (
              <li key={h.estado} className={h.punto}>
                <b>{h.estado}</b>
                <span>
                  {h.hora} · {h.quien}
                </span>
              </li>
            ))}
          </ul>

          {ediciones.length > 0 ? (
            <>
              <p className="sub-h">Ediciones del acta</p>
              <ul className="trace">
                {[...ediciones].reverse().map((e) => (
                  <li key={e.id} className="s-log">
                    <b>Acta editada · {e.secciones.join(", ")}</b>
                    <span>{resumenEdicion(e)}</span>
                    <span>{e.motivo}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <p className="sub-h">Datos del registro</p>
          <dl className="reg">
            {[
              { k: "Creada", v: visita.creadoEn.slice(0, 16).replace("T", " · ") },
              { k: "Sincronizada", v: ejec?.sincronizadoEn ? ejec.sincronizadoEn.slice(0, 16).replace("T", " · ") : "pendiente" },
              // Un acta registrada offline se cerró en terreno antes de llegar
              // acá: la hora de término es la de la tienda, no la de la subida.
              { k: "Captura", v: ejec?.registradoOffline ? "Sin señal · se envió al recuperar cobertura" : "En línea" },
              { k: "Dispositivo", v: ejec?.dispositivo ?? "—" },
              { k: "Folio", v: visita.folio },
            ].map((t) => (
              <div key={t.k}>
                <dt>{t.k}</dt>
                <dd>{t.v}</dd>
              </div>
            ))}
          </dl>
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
        <NuevaVisitaHoja
          precarga={precargaDeProblema(agendarProblema, ref.motivos, visita.tecnicoId)}
          onCerrar={() => setAgendarProblema(null)}
          onAviso={aviso}
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

function Dato({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div>
      <dt>{k}</dt>
      <dd>{children}</dd>
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
            <div role="radiogroup" aria-label="Agregar sugerencias a" className="inline-flex border border-[var(--color-line)] rounded-[10px]">
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
