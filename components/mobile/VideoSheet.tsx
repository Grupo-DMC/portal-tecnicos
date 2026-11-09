"use client";

import { useEffect, useState } from "react";
import { VIDEO_MAX_SEG, ajustarVideo, mb, reloj, repararDuracionPreview, type ClipListo } from "@/lib/ui/video";

type Estado =
  | "lista"
  /** Recortando y reescalando lo que se pasó de los límites. */
  | "ajustando"
  | "revisando";

export type ClipGrabado = ClipListo;

/**
 * El video del trabajo: 720p y hasta 1 minuto.
 *
 * Se graba con la app de cámara del propio celular (input con `capture`), no
 * con un visor dentro de la página: el técnico tiene su enfoque, estabilización
 * y micrófono de siempre, y no hay que autorizar nada al navegador. Esa cámara
 * no conoce los topes de la base (ck_video_duracion y ck_video_resolucion en
 * dmc.visita_video), así que lo que entrega se mide de verdad y, si se pasó del
 * minuto o de 720p, se recorta y se reescala antes de aceptarlo — igual que un
 * video traído de la galería.
 *
 * Antes de aceptarlo el técnico lo ve reproducido: en terreno se graba el
 * pórtico equivocado más seguido de lo que uno cree, y descubrirlo en la
 * oficina ya no sirve de nada.
 */
export default function VideoSheet({
  onGrabado,
  onCerrar,
}: {
  onGrabado: (clip: ClipGrabado) => void;
  onCerrar: () => void;
}) {
  const [estado, setEstado] = useState<Estado>("lista");
  const [error, setError] = useState("");
  const [ajuste, setAjuste] = useState(0);
  const [clip, setClip] = useState<(ClipListo & { url: string }) | null>(null);

  useEffect(() => {
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previo;
    };
  }, []);

  // La previsualización del clip vive en un object URL: si no se suelta, el
  // celular se queda con el archivo en memoria hasta recargar la página.
  useEffect(() => {
    return () => {
      if (clip) URL.revokeObjectURL(clip.url);
    };
  }, [clip]);

  function cerrar() {
    onCerrar();
  }

  /**
   * Deja el clip listo para aceptar o repetir.
   *
   * Nada se rechaza: si se pasó del minuto o de 720p, `ajustarVideo` lo recorta
   * y lo reescala. Eso toma tiempo real, así que mientras tanto se muestra la
   * barra en vez de dejar la pantalla como colgada.
   */
  async function revisar(blob: Blob) {
    setError("");
    setAjuste(0);
    setEstado("ajustando");
    try {
      const listo = await ajustarVideo(blob, setAjuste, {});
      setClip({ ...listo, url: URL.createObjectURL(listo.blob) });
      setEstado("revisando");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo preparar el video. Inténtalo otra vez.");
      setEstado("lista");
    }
  }

  function repetir() {
    if (clip) URL.revokeObjectURL(clip.url);
    setClip(null);
    setEstado("lista");
  }

  function aceptar() {
    if (!clip) return;
    URL.revokeObjectURL(clip.url);
    onGrabado({ blob: clip.blob, mime: clip.mime, medida: clip.medida, ajustes: clip.ajustes });
  }

  /** Lo que devuelve la cámara del celular o la galería: pasa por lo mismo. */
  async function desdeArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await revisar(file);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Grabar video"
      className="fixed inset-0 z-50 bg-[rgba(31,28,33,.7)] flex flex-col justify-end items-center"
    >
      <div className="w-full max-w-[460px] max-h-[94vh] overflow-y-auto bg-[var(--color-bg)] border-t-2 border-[var(--color-text)] animate-up-sheet">
        <div className="flex items-center gap-2.5 px-4 py-3.5 border-b-2 border-[var(--color-divider)]">
          <div className="font-extrabold text-lead leading-[1.2]">
            {estado === "revisando" ? "Revisa el video" : estado === "ajustando" ? "Ajustando el video" : "Grabar video"}
          </div>
          <button
            type="button"
            onClick={cerrar}
            aria-label="Cerrar"
            className="ml-auto w-[38px] h-[38px] grid place-items-center bg-transparent border-0 cursor-pointer text-[var(--color-text)] hover:bg-black/[.08]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="p-4">
          {estado === "revisando" && clip ? (
            <div className="relative w-full aspect-[16/9] bg-black overflow-hidden border border-[var(--color-divider)]">
              <video
                src={clip.url}
                controls
                playsInline
                onLoadedMetadata={(e) => repararDuracionPreview(e.currentTarget)}
                className="w-full h-full object-contain bg-black"
              />
            </div>
          ) : null}

          {estado === "ajustando" ? (
            <>
              <div className="px-4 py-8 text-center bg-[var(--color-text)] text-[var(--color-bg)]">
                <div className="font-extrabold text-lead">Recortando y bajando a 720p…</div>
                <div className="mt-1 opacity-80 tabular-nums">{ajuste}%</div>
              </div>
              <div className="h-1 mt-2 bg-[var(--color-divider)] overflow-hidden">
                <div
                  className="h-full bg-[var(--color-accent)] transition-[width] duration-300"
                  style={{ width: `${ajuste}%` }}
                />
              </div>
              <p className="mt-2.5 mb-0 text-cap opacity-66">
                El video venía más largo o con más calidad de la que se puede guardar. Se está
                reajustando y demora lo mismo que dura el clip: no cierres esta ventana.
              </p>
            </>
          ) : null}

          {estado === "lista" ? (
            <>
              <label className="relative w-full min-h-[64px] flex items-center justify-between px-4.5 bg-[var(--color-accent)] text-[var(--color-bg)] font-extrabold text-lead cursor-pointer hover:bg-[var(--color-accent-hover)]">
                <span>Grabar con la cámara</span>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                  <path d="M3 7h11v10H3z" />
                  <path d="M14 11l7-4v10l-7-4z" />
                </svg>
                {/* capture: en el celular abre la app de cámara (trasera) en modo video. */}
                <input
                  type="file"
                  accept="video/*"
                  capture="environment"
                  onChange={desdeArchivo}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  aria-label="Grabar un video con la cámara del celular"
                />
              </label>
              <p className="mt-2.5 mb-0 text-cap opacity-66">
                Se abre la cámara de tu celular. Graba hasta {reloj(VIDEO_MAX_SEG)}: si dura más, se recorta solo.
              </p>
            </>
          ) : null}

          {estado === "revisando" && clip ? (
            <>
              <div className="mt-3 flex items-center gap-2 text-cap opacity-66 tabular-nums">
                <span>
                  {reloj(clip.medida.duracionSeg)} · {clip.medida.ancho}x{clip.medida.alto}
                </span>
                <span className="ml-auto">{mb(clip.blob.size)}</span>
              </div>
              {clip.ajustes.length ? (
                <div className="mt-2 px-3 py-2.5 bg-[var(--color-surface-3)] border border-[var(--color-accent-300)] text-cap leading-[1.45]">
                  <span className="font-extrabold">Se ajustó para poder guardarlo: </span>
                  {clip.ajustes.join("; ")}. Revísalo antes de aceptarlo.
                </div>
              ) : null}
              <button
                type="button"
                onClick={aceptar}
                className="w-full min-h-[58px] flex items-center justify-between px-4.5 mt-2.5 bg-[var(--color-accent)] text-[var(--color-bg)] border-0 font-extrabold text-lead cursor-pointer text-left hover:bg-[var(--color-accent-hover)]"
              >
                <span>Usar este video</span>
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M4 12l5 5L20 6" />
                </svg>
              </button>
              <button
                type="button"
                onClick={repetir}
                className="w-full min-h-[50px] mt-2.5 px-4 bg-transparent border border-[var(--color-divider)] text-[var(--color-text)] font-extrabold text-ui cursor-pointer text-left hover:bg-black/[.07]"
              >
                Grabar otro
              </button>
            </>
          ) : null}

          {error ? <p className="mt-2.5 mb-0 text-cap text-[var(--color-danger-800)]">{error}</p> : null}

          {estado === "lista" ? (
            <label className="relative w-full min-h-[52px] flex items-center gap-2.5 px-4 mt-2.5 bg-transparent border border-dashed border-black/[.5] text-[var(--color-text)] font-extrabold text-ui cursor-pointer hover:bg-black/[.06]">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 5h16v14H4z" />
                <path d="M10 9l5 3-5 3z" />
              </svg>
              <span>Subir un video desde la galería</span>
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                onChange={desdeArchivo}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                aria-label="Subir un video desde la galería"
              />
            </label>
          ) : null}

          {estado !== "ajustando" ? (
            <button
              type="button"
              onClick={cerrar}
              className="w-full min-h-[50px] mt-2.5 px-4 bg-transparent border border-[var(--color-divider)] text-[var(--color-text)] font-extrabold text-ui cursor-pointer text-left hover:bg-black/[.07]"
            >
              Cancelar
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
