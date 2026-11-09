"use client";

import { useEffect, useState } from "react";

/**
 * Fotos con la cámara del celular.
 *
 * Abre la app de cámara del propio teléfono (input con `capture`), no un visor
 * dentro de la página: así el técnico tiene el enfoque, el flash, el zoom y los
 * permisos que ya conoce, y no hay que autorizar la cámara al navegador. Cada
 * foto tomada vuelve como data URL y se agrega a la visita al instante; para
 * otra, se aprieta de nuevo. La galería queda como segunda opción.
 */
export default function CamaraSheet({
  onCapturar,
  onCerrar,
}: {
  onCapturar: (dataUrl: string) => void;
  onCerrar: () => void;
}) {
  const [tomadas, setTomadas] = useState(0);

  useEffect(() => {
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previo;
    };
  }, []);

  function leer(e: React.ChangeEvent<HTMLInputElement>, desdeCamara: boolean) {
    const files = Array.from(e.target.files ?? []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        onCapturar(String(reader.result));
        if (desdeCamara) setTomadas((n) => n + 1);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
    // De la galería se eligen todas de una vez: no hay nada más que esperar.
    if (!desdeCamara && files.length) onCerrar();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tomar foto"
      className="fixed inset-0 z-50 bg-[rgba(31,28,33,.7)] flex flex-col justify-end items-center"
    >
      <div className="w-full max-w-[460px] max-h-[94vh] overflow-y-auto bg-[var(--color-bg)] border-t-2 border-[var(--color-text)] animate-up-sheet">
        <div className="flex items-center gap-2.5 px-4 py-3.5 border-b-2 border-[var(--color-divider)]">
          <div className="font-extrabold text-lead leading-[1.2]">Tomar foto</div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="ml-auto w-[38px] h-[38px] grid place-items-center bg-transparent border-0 cursor-pointer text-[var(--color-text)] hover:bg-black/[.08]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="p-4">
          <label className="relative w-full min-h-[64px] flex items-center justify-between px-4.5 bg-[var(--color-accent)] text-[var(--color-bg)] font-extrabold text-lead cursor-pointer hover:bg-[var(--color-accent-hover)]">
            <span>{tomadas > 0 ? "Tomar otra foto" : "Abrir la cámara"}</span>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
              <path d="M3 8h3l2-3h8l2 3h3v12H3z" />
              <circle cx="12" cy="13" r="3.4" />
            </svg>
            {/* capture: en el celular abre la app de cámara (trasera) en vez del selector de archivos. */}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => leer(e, true)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              aria-label="Abrir la cámara del celular"
            />
          </label>
          <p className="mt-2.5 mb-0 text-cap opacity-66">
            {tomadas > 0
              ? `${tomadas} foto${tomadas > 1 ? "s" : ""} agregada${tomadas > 1 ? "s" : ""} a la visita. Puedes tomar otra.`
              : "Se abre la cámara de tu celular. Cada foto se agrega a la visita al instante."}
          </p>

          <label className="relative w-full min-h-[52px] flex items-center gap-2.5 px-4 mt-3.5 bg-transparent border border-dashed border-black/[.5] text-[var(--color-text)] font-extrabold text-ui cursor-pointer hover:bg-black/[.06]">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 5h16v14H4z" />
              <path d="M4 16l5-5 4 4 3-3 4 4" />
              <circle cx="9" cy="9" r="1.4" />
            </svg>
            <span>Subir desde la galería</span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => leer(e, false)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              aria-label="Subir fotos desde la galería"
            />
          </label>

          <button
            type="button"
            onClick={onCerrar}
            className="w-full min-h-[50px] mt-2.5 px-4 bg-transparent border border-[var(--color-divider)] text-[var(--color-text)] font-extrabold text-ui cursor-pointer text-left hover:bg-black/[.07]"
          >
            {tomadas > 0 ? "Listo" : "Cancelar"}
          </button>
        </div>
      </div>
    </div>
  );
}
