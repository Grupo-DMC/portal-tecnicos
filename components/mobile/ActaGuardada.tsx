"use client";

import { useState } from "react";
import Link from "next/link";
import { descargarZip, extensionDe } from "@/lib/ui/descarga";
import { pedirEdicionActaAction } from "@/app/actions/ediciones";
import VisorFotos, { useVisorFotos } from "@/components/ui/VisorFotos";
import EstadoProblemaTag from "@/components/EstadoProblemaTag";
import { textoMotivosReales } from "@/lib/ui/estado";
import { nombreProblema, nombreTrabajo, puede, useReferencias } from "@/lib/ui/referencias";
import { fechaHoraCorta, resumenEdicion } from "@/lib/ui/edicion";
import { nombreArchivoActa, nombreZipMultimedia } from "@/lib/ui/nombre-acta";
import type { CatalogoProblema, CatalogoTrabajo, Visita } from "@/lib/types";
import { fechaCL } from "@/lib/ui/fecha";

/**
 * El acta ya guardada, vista desde el celular del técnico.
 *
 * Es lo que se abre con "Ver acta guardada": lo que quedó escrito en la base,
 * no un borrador ni la pantalla previa a guardar. Muestra el acta completa
 * —horarios, responsable, trabajos, problemas, fotos y firma—, porque antes se
 * quedaba en cuatro datos y no servía para revisar lo que se firmó.
 */

/** "2026-08-13T08:30:00" → "08:30". */
function hhmm(iso: string | null | undefined): string {
  return iso ? iso.slice(11, 16) : "—";
}

export default function ActaGuardada({
  visita,
  catalogoTrabajos,
  catalogoProblemas,
}: {
  visita: Visita;
  catalogoTrabajos: CatalogoTrabajo[];
  catalogoProblemas: CatalogoProblema[];
}) {
  const visor = useVisorFotos();
  const referencias = useReferencias();
  const { motivos } = referencias;
  const puedeEditar = puede(referencias, "celular.editarActa");
  const ejec = visita.ejecucion;
  // Primero las fotos del trabajo y después las del comentario interno: el
  // visor las recorre en ese orden.
  const fotosTrabajo = (visita.fotos ?? []).filter((f) => !f.interno);
  const fotosInternas = (visita.fotos ?? []).filter((f) => f.interno);
  const fotos = [...fotosTrabajo, ...fotosInternas];
  const videosInternos = (visita.videos ?? []).filter((v) => v.interno);
  const videosTrabajo = (visita.videos ?? []).filter((v) => !v.interno);
  const [bajando, setBajando] = useState<"fotos" | "videos" | "multimedia" | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pidiendo, setPidiendo] = useState(false);
  const [pedidoEn, setPedidoEn] = useState<string | null>(visita.ejecucion?.edicionSolicitadaEn ?? null);

  async function pedirEdicion() {
    setPidiendo(true);
    try {
      const res = await pedirEdicionActaAction(visita.folio);
      if (res.ok) setPedidoEn(new Date().toISOString());
      setAviso(res.ok ? "Listo: le avisamos a coordinación" : (res.error ?? "No se pudo enviar el pedido."));
    } catch {
      setAviso("Sin señal: no se pudo enviar el pedido. Inténtalo otra vez.");
    } finally {
      setPidiendo(false);
    }
  }

  async function bajarTodo(tipo: "fotos" | "videos" | "multimedia") {
    const fotosZip = fotosTrabajo.map((f, i) => ({ url: f.archivoUrl, nombre: `${visita.folio} - foto ${i + 1}.jpeg` }));
    const videosZip = videosTrabajo.map((v, i) => ({
      url: v.archivoUrl,
      nombre: `${visita.folio} - video ${i + 1}.${extensionDe(v.mime, "mp4")}`,
    }));
    const archivos = tipo === "fotos" ? fotosZip : tipo === "videos" ? videosZip : [...fotosZip, ...videosZip];
    setBajando(tipo);
    setAviso(null);
    const n = await descargarZip(archivos, nombreZipMultimedia(visita));
    setBajando(null);
    setAviso(n === archivos.length ? `Se descargaron ${n} archivos` : `Se descargaron ${n} de ${archivos.length} archivos`);
  }
  const internos = visita.internos ?? [];
  const firma = visita.firmas?.[0];
  const nombreMotivo = (codigo: string) => motivos.find((m) => m.codigo === codigo)?.nombre ?? codigo;
  const ediciones = visita.ediciones ?? [];
  const cerrada = visita.estado === "COMPLETADA";
  // El técnico puede corregir su acta hasta un día después de cerrarla.
  const editable = cerrada && puedeEditar && Boolean(ejec?.editablePorTecnico);

  const filas: { k: string; v: string; chip?: string }[] = [
    { k: "Motivo", v: textoMotivosReales(visita) },
    { k: "Técnico", v: visita.tecnico?.nombreCompleto ?? "—" },
    ...(visita.tecnicoAyudante ? [{ k: "Ayudante", v: visita.tecnicoAyudante.nombreCompleto }] : []),
    { k: "Fecha", v: fechaCL(visita.fechaProgramada) },
    { k: "Horario", v: ejec ? `${hhmm(ejec.horaInicio)} – ${hhmm(ejec.horaTermino)}` : "Sin registro de horas" },
    {
      k: "Responsable",
      v: ejec?.responsableNombre
        ? `${ejec.responsableNombre}${ejec.responsableRut ? ` · ${ejec.responsableRut}` : ""}`
        : visita.responsableNombre ?? "—",
      chip: ejec?.responsableCargo || undefined,
    },
  ];
  if (ejec?.observaciones) filas.push({ k: "Observación", v: ejec.observaciones });

  return (
    <div className="animate-fade-in">
      <div className="px-4 pt-5">
        <h1 className="font-extrabold text-h2 leading-[1.1] tracking-[-.02em] mb-0.5">
          {visita.sucursal?.nombre}
        </h1>
        <div className="text-ui opacity-60">
          {[visita.cliente?.nombreFantasia, visita.marca?.nombre, visita.folio].filter(Boolean).join(" · ")}
        </div>
        {visita.estado === "COMPLETADA" ? (
          <a
            href={`/api/visita/acta/${encodeURIComponent(visita.folio)}`}
            download={nombreArchivoActa(visita)}
            className="w-full min-h-[50px] flex items-center justify-between px-4 mt-3.5 bg-[var(--color-accent)] text-[var(--color-bg)] font-extrabold text-ui hover:bg-[var(--color-accent-hover)]"
          >
            <span>Descargar acta en PDF</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M12 4v11M7 11l5 5 5-5M4 20h16" />
            </svg>
          </a>
        ) : null}
        {editable ? (
          <>
            <Link
              href={`/tecnico/visitas/${encodeURIComponent(visita.folio)}/editar`}
              className="w-full min-h-[50px] flex items-center justify-between px-4 mt-2.5 border border-[var(--color-divider)] text-[var(--color-text)] font-extrabold text-ui hover:bg-black/[.07]"
            >
              <span>Editar el acta</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M4 20h4l10-10-4-4L4 16v4z" />
                <path d="M14 6l4 4" />
              </svg>
            </Link>
            <div className="mt-1.5 text-cap opacity-66">
              Puedes corregirla hasta el {fechaHoraCorta(ejec?.editableHasta)}. La firma de la tienda se conserva.
            </div>
          </>
        ) : cerrada ? (
          // Sin permiso o fuera de plazo: en vez de explicar, un solo botón.
          pedidoEn ? (
            <div className="mt-2.5 px-3.5 py-3 bg-[var(--color-surface)] border border-[var(--color-line-control)] text-meta leading-[1.45]">
              Pediste editar esta acta. Coordinación te la habilita y te avisamos aquí: vuelve a abrir la visita en unos
              minutos.
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void pedirEdicion()}
                disabled={pidiendo}
                className="w-full min-h-[50px] flex items-center justify-between px-4 mt-2.5 border border-[var(--color-divider)] bg-transparent text-[var(--color-text)] font-extrabold text-ui cursor-pointer text-left hover:bg-black/[.07] disabled:opacity-60"
              >
                <span>{pidiendo ? "Enviando…" : "Pedir edición a coordinación"}</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M4 20h4l10-10-4-4L4 16v4z" />
                  <path d="M14 6l4 4" />
                </svg>
              </button>
              <div className="mt-1.5 text-cap opacity-66">
                {puedeEditar
                  ? "Ya pasó el plazo de un día para editarla tú."
                  : "Tu rol no puede editar actas cerradas."}{" "}
                Coordinación recibe el pedido y te abre la edición.
              </div>
            </>
          )
        ) : null}
        {ediciones.length > 0 ? (
          <div className="mt-3 px-3.5 py-3 bg-[var(--color-accent-100)] border border-[var(--color-accent-300)]">
            <div className="text-cap text-[var(--color-accent-800)]">
              Acta editada · {ediciones.length} {ediciones.length === 1 ? "vez" : "veces"}
            </div>
            {ediciones.map((e) => (
              <div key={e.id} className="mt-2.5 pt-2.5 border-t border-black/[.15] first:border-t-0 first:pt-0 text-meta leading-[1.45]">
                <div className="font-extrabold">{e.secciones.join(" · ")}</div>
                <div className="mt-0.5">Motivo: {e.motivo}</div>
                <div className="text-cap opacity-66 mt-0.5">{resumenEdicion(e)}</div>
              </div>
            ))}
          </div>
        ) : null}
        {ejec?.registradoOffline ? (
          <div className="mt-3 px-3.5 py-2.5 bg-[var(--color-surface)] border border-[var(--color-line-control)] text-meta leading-[1.45]">
            Se llenó sin señal y se sincronizó
            {ejec.sincronizadoEn ? ` el ${ejec.sincronizadoEn.slice(0, 16).replace("T", " a las ")}` : " al recuperar cobertura"}.
          </div>
        ) : null}
      </div>

      <div className="mx-4 mt-4 border border-[var(--color-divider)] bg-[var(--color-surface-3)] px-4 pt-1 pb-4">
        {filas.map((f) => (
          <div key={f.k} className="py-2.5 border-b border-black/[.2]">
            <div className="text-cap opacity-66">{f.k}</div>
            <div className="text-ui mt-1">
              {f.v || "—"}
              {f.chip ? <span className="tag tag-accent ml-2 align-middle">{f.chip}</span> : null}
            </div>
          </div>
        ))}

        {visita.trabajos && visita.trabajos.length > 0 ? (
          <div className="pt-3.5">
            <div className="text-cap opacity-66 mb-2">Trabajo realizado</div>
            {visita.trabajos.map((t) => (
              <div key={t.id} className="border-l border-[var(--color-line-control)] pl-3 mb-2.5">
                {t.motivoCodigo ? (
                  <div className="text-cap opacity-62">{nombreMotivo(t.motivoCodigo)}</div>
                ) : null}
                <div className="font-extrabold text-body leading-[1.25]">
                  {nombreTrabajo(catalogoTrabajos, t.trabajoCodigo)}
                </div>
                {t.subtrabajos.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {t.subtrabajos.map((s) => (
                      <span
                        key={s.id}
                        className="px-2 py-1 bg-[var(--color-text)] text-[var(--color-bg)] font-extrabold text-cap leading-[1.2] tabular-nums"
                      >
                        {s.etiqueta}
                        {s.cantidad > 1 ? ` × ${s.cantidad}` : ""}
                      </span>
                    ))}
                  </div>
                ) : null}
                {t.detalle ? <div className="text-ui opacity-72 mt-1.5">{t.detalle}</div> : null}
              </div>
            ))}
          </div>
        ) : null}

        {visita.problemas && visita.problemas.length > 0 ? (
          <div className="pt-3.5">
            <div className="text-cap opacity-66 mb-2">Problemas</div>
            {visita.problemas.map((p) => (
              <div key={p.id} className="px-3 py-3 mb-2 bg-[var(--color-accent-200)] border border-[var(--color-accent-300)]">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <div className="font-extrabold text-ui leading-[1.25] text-[var(--color-accent-800)]">
                    {nombreProblema(catalogoProblemas, p.tipoCodigo)}
                  </div>
                  <EstadoProblemaTag estado={p.estado} className="ml-auto" />
                </div>
                {p.items.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {p.items.map((it) => (
                      <span
                        key={it.id}
                        className="px-2 py-1 bg-[var(--color-text)] text-[var(--color-bg)] font-extrabold text-cap leading-[1.2] tabular-nums"
                      >
                        {it.etiqueta} × {it.cantidad}
                      </span>
                    ))}
                  </div>
                ) : null}
                {p.descripcion ? (
                  <div className="text-meta leading-[1.5] text-[var(--color-accent-800)] mt-1.5">{p.descripcion}</div>
                ) : null}
                {p.solucion ? (
                  <div className="text-meta leading-[1.5] text-[var(--color-accent-800)] mt-1.5 pt-1.5 border-t border-black/[.15]">
                    {p.estado === "RESUELTO" ? "Se realizó: " : "Sugerido: "}
                    {p.solucion}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {/* Fotos: se agrandan acá mismo, sin salir del acta. */}
        <div className="pt-3.5">
          <div className="text-cap opacity-66 mb-2">Fotos ({fotosTrabajo.length})</div>
          {fotosTrabajo.length > 0 ? (
            <div className="grid grid-cols-3 gap-1.5">
              {fotosTrabajo.map((f, i) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => visor.abrir(i)}
                  aria-label={`Ver la foto ${i + 1} en grande`}
                  className="relative aspect-square p-0 border border-black/[.3] overflow-hidden bg-[var(--color-neutral-300)] cursor-zoom-in"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.archivoUrl}
                    alt={f.etiqueta ?? "Foto del trabajo"}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          ) : (
            <div className="text-meta opacity-66">No se tomaron fotos en esta visita.</div>
          )}
          {fotosTrabajo.length > 0 || videosTrabajo.length > 0 ? (
            <div className="flex flex-col gap-2 mt-3">
              <button
                type="button"
                onClick={() => bajarTodo("multimedia")}
                disabled={bajando !== null}
                className="btn btn-secondary min-h-11 px-3.5 gap-2 text-ui"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M12 4v11M7 11l5 5 5-5M4 20h16" />
                </svg>
                <span>{bajando ? "Descargando…" : "Descargar fotos y videos"}</span>
              </button>
              {aviso ? <div className="text-meta opacity-66">{aviso}</div> : null}
            </div>
          ) : null}
        </div>

        {/* Comentario interno: lo ve coordinación, no el cliente ni el PDF. */}
        {ejec?.comentarioInterno || internos.length || fotosInternas.length || videosInternos.length ? (
          <div className="mt-4 px-3 py-3 bg-[var(--color-surface)] border border-[var(--color-line-control)]">
            <div className="text-cap opacity-66">Comentario interno · no lo ve el cliente</div>
            {internos.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {internos.map((x) => (
                  <span
                    key={x.codigo}
                    className="px-2 py-1 bg-[var(--color-text)] text-[var(--color-bg)] font-extrabold text-cap leading-[1.2]"
                  >
                    {x.nombre}
                  </span>
                ))}
              </div>
            ) : null}
            {ejec?.comentarioInterno ? <div className="text-ui mt-2">{ejec.comentarioInterno}</div> : null}
            {fotosInternas.length > 0 ? (
              <div className="grid grid-cols-4 gap-1.5 mt-2.5">
                {fotosInternas.map((f, i) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => visor.abrir(fotosTrabajo.length + i)}
                    aria-label="Ver la foto interna en grande"
                    className="relative aspect-square p-0 border border-black/[.3] overflow-hidden cursor-zoom-in"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.archivoUrl} alt="Foto interna" className="w-full h-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            ) : null}
            {videosInternos.map((v) => (
              <video
                key={v.id}
                src={v.archivoUrl}
                controls
                preload="metadata"
                playsInline
                className="w-full aspect-video bg-black object-contain mt-2.5"
              />
            ))}
          </div>
        ) : null}

        {firma ? (
          <div className="pt-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={firma.imagenUrl}
              alt={`Firma de ${firma.nombre}`}
              className="w-full max-w-[260px] h-[70px] object-contain object-left-bottom"
            />
            <div className="h-px bg-[var(--color-text)] mt-1" />
            <div className="text-cap mt-1.5">
              {firma.nombre}
              {firma.rut ? ` · ${firma.rut}` : ""}
            </div>
            <div className="text-cap opacity-62">Responsable de tienda</div>
          </div>
        ) : (
          <div className="pt-5 text-meta opacity-66">Esta visita no quedó firmada.</div>
        )}
      </div>

      <div className="h-6" />

      {visor.abierto ? (
        <VisorFotos
          fotos={fotos.map((f, i) => ({
            src: f.archivoUrl,
            titulo: f.interno ? "Foto interna" : f.etiqueta ?? `Foto ${i + 1}`,
            subtitulo: `${visita.folio} · ${hhmm(f.tomadaEn)}`,
          }))}
          indice={visor.indice ?? 0}
          onIndice={visor.mover}
          onCerrar={visor.cerrar}
        />
      ) : null}
    </div>
  );
}
