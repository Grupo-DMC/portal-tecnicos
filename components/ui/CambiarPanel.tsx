"use client";

import { useFormStatus } from "react-dom";
import { cambiarModoAction } from "@/app/actions/auth";
import { pendientesAlSalir } from "@/lib/ui/borrador";
import { useUsuarioLocal } from "@/lib/ui/usuario-local";
import type { Modo } from "@/lib/roles";

// «Ir al panel de técnico» / «Volver al panel de admin», para quien tiene los
// dos roles. Es un formulario que llama a una acción del servidor: funciona sin
// JavaScript y lo que decide si se puede es el servidor, nunca este botón.

const TEXTO: Record<Modo, { largo: string; corto: string }> = {
  tecnico: { largo: "Ir al panel de técnico", corto: "Técnico" },
  panel: { largo: "Volver al panel de admin", corto: "Admin" },
};

function Icono() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true" className="shrink-0">
      <path d="M7 4l-4 4 4 4M3 8h14M17 20l4-4-4-4M21 16H7" />
    </svg>
  );
}

function Boton({ destino, variante }: { destino: Modo; variante: "menu" | "barra" | "franja" }) {
  const { pending } = useFormStatus();
  const texto = pending ? "Cambiando…" : TEXTO[destino].largo;
  if (variante === "barra") {
    return (
      <button
        type="submit"
        disabled={pending}
        aria-label={TEXTO[destino].largo}
        title={TEXTO[destino].largo}
        className="shrink-0 min-h-10 px-2.5 inline-flex items-center gap-1.5 border border-[var(--color-accent)] text-[var(--color-accent-active)] font-extrabold text-cap hover:bg-[var(--color-accent-100)] disabled:opacity-60"
      >
        <Icono />
        <span>{pending ? "…" : TEXTO[destino].corto}</span>
      </button>
    );
  }
  if (variante === "franja") {
    return (
      <button
        type="submit"
        disabled={pending}
        className="shrink-0 min-h-10 px-3 inline-flex items-center gap-1.5 bg-[var(--color-bg)] border border-[var(--color-accent)] text-[var(--color-accent-active)] font-extrabold text-cap hover:bg-[var(--color-accent-100)] disabled:opacity-60"
      >
        <Icono />
        <span>{texto}</span>
      </button>
    );
  }
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full min-h-11 flex items-center gap-2.5 px-3 bg-[var(--color-accent)] text-[var(--color-bg)] font-extrabold text-meta text-left hover:bg-[var(--color-accent-active)] disabled:opacity-60"
    >
      <Icono />
      <span>{texto}</span>
    </button>
  );
}

export default function CambiarPanel({
  desde,
  destino,
  variante,
}: {
  /** El panel en que está ahora. */
  desde: Modo;
  /** El panel al que pasa. */
  destino: Modo;
  variante: "menu" | "barra" | "franja";
}) {
  const uid = useUsuarioLocal();
  return (
    <form
      action={cambiarModoAction}
      onSubmit={(e) => {
        // Las actas en cola quedan en el equipo, a su nombre, y se envían al
        // volver al panel de técnico. Se avisa para que no lo sorprenda.
        if (desde !== "tecnico") return;
        const n = pendientesAlSalir(uid);
        if (n === 0) return;
        const texto = n === 1 ? "Tienes 1 acta sin enviar" : `Tienes ${n} actas sin enviar`;
        const seguir = window.confirm(
          `${texto} por falta de señal.\n\nNo se pierden: quedan en este equipo y se envían cuando vuelvas ` +
            "al panel de técnico con señal.\n\n¿Ir al panel de admin igual?"
        );
        if (!seguir) e.preventDefault();
      }}
      className={variante === "menu" ? "w-full" : undefined}
    >
      <input type="hidden" name="modo" value={destino} />
      <Boton destino={destino} variante={variante} />
    </form>
  );
}
