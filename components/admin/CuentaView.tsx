"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cambiarPasswordCuentaAction,
  guardarDatosCuentaAction,
  quitarFotoCuentaAction,
  subirFotoCuentaAction,
  type CuentaState,
} from "@/app/actions/cuenta";
import type { PerfilCuenta } from "@/lib/data/cuenta";
import { iniciales, nombreVisible, prepararFotoPerfil, urlFotoUsuario } from "@/lib/ui/cuenta";
import { fechaHoraLegible } from "@/lib/ui/fecha";
import { fmtTel } from "@/lib/ui/formato";
import { Toast, useToast } from "@/components/ui/Toast";

const INICIAL: CuentaState = { ok: false, error: null };

export default function CuentaView({
  perfil,
  rol,
  largoMinimo,
}: {
  perfil: PerfilCuenta;
  rol: string;
  largoMinimo: number;
}) {
  const { toast, aviso } = useToast();

  return (
    // Grilla: 320 + 24 + 1fr. La identidad queda a la vista mientras se editan los formularios.
    <div className="px-4 md:px-7 py-6 md:py-8 max-w-[1120px] grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
      <SeccionFoto perfil={perfil} rol={rol} aviso={aviso} />
      <div className="flex flex-col gap-6 min-w-0">
        <SeccionDatos perfil={perfil} aviso={aviso} />
        <SeccionPassword largoMinimo={largoMinimo} aviso={aviso} />
      </div>
      <Toast texto={toast} variante="panel" />
    </div>
  );
}

const PANEL = "bg-[var(--color-surface-3)] border border-[var(--color-line-soft)]";

/** Panel de formulario: título y bajada arriba, campos con aire y la acción al pie. */
function Seccion({ titulo, bajada, children }: { titulo: string; bajada?: string; children: React.ReactNode }) {
  return (
    <section className={PANEL}>
      <header className="px-5 md:px-6 pt-5 md:pt-6">
        <h2 className="font-extrabold text-lead tracking-[-.01em]">{titulo}</h2>
        {bajada ? <p className="text-meta text-[var(--color-muted)] mt-1 max-w-[60ch]">{bajada}</p> : null}
      </header>
      <div className="px-5 md:px-6 py-5 md:py-6 min-w-0">{children}</div>
    </section>
  );
}

/** Pie del formulario: el error a la vista y el botón a la derecha. */
function PieForm({ error, children }: { error: string | null; children: React.ReactNode }) {
  return (
    <div className="sm:col-span-2 flex flex-col gap-3 mt-2 pt-5 border-t border-[var(--color-line-soft)]">
      <AvisoError texto={error} />
      <div className="flex sm:justify-end">{children}</div>
    </div>
  );
}

function AvisoError({ texto }: { texto: string | null }) {
  if (!texto) return null;
  return (
    <div
      role="alert"
      className="px-3.5 py-2.5 bg-[var(--color-danger-100)] border border-[var(--color-danger-400)] text-[var(--color-danger-800)] text-meta"
    >
      {texto}
    </div>
  );
}

// ── Foto ─────────────────────────────────────────────────────────────────────

function SeccionFoto({ perfil, rol, aviso }: { perfil: PerfilCuenta; rol: string; aviso: (t: string) => void }) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const nombre = nombreVisible(perfil.nombre, perfil.email);
  const foto = urlFotoUsuario(perfil.id, perfil.fotoVersion);

  function elegido(archivo: File | undefined) {
    if (!archivo) return;
    setError(null);
    if (!/^image\/(jpeg|png|webp)$/.test(archivo.type)) {
      setError("Elige una imagen JPG, PNG o WebP.");
      return;
    }
    iniciar(async () => {
      try {
        const dataUrl = await prepararFotoPerfil(archivo);
        const r = await subirFotoCuentaAction(dataUrl);
        if (!r.ok) return setError(r.error);
        aviso("Foto actualizada");
        router.refresh();
      } catch {
        setError("No se pudo leer la imagen. Prueba con otra.");
      }
    });
  }

  function quitar() {
    setError(null);
    iniciar(async () => {
      const r = await quitarFotoCuentaAction();
      if (!r.ok) return setError(r.error);
      aviso("Foto quitada");
      router.refresh();
    });
  }

  return (
    <section className={`${PANEL} lg:sticky lg:top-6`}>
      {/* Foto cuadrada a todo el ancho de la tarjeta: es lo primero que se ve. */}
      <div className="aspect-square max-h-[320px] w-full bg-[var(--color-accent-100)] text-[var(--color-accent-800)] grid place-items-center font-extrabold text-hero overflow-hidden">
        {foto ? (
          // eslint-disable-next-line @next/next/no-img-element -- ruta propia con sesión; next/image no aporta acá
          <img src={foto} alt={`Foto de ${nombre}`} width={320} height={320} className="w-full h-full object-cover" />
        ) : (
          iniciales(nombre)
        )}
      </div>
      <div className="p-5 md:p-6 flex flex-col gap-5">
        <div className="min-w-0">
          <h2 className="font-extrabold text-h3 tracking-[-.01em] truncate">{nombre}</h2>
          <p className="text-ui text-[var(--color-muted)] truncate">{perfil.email}</p>
          <span className="tag tag-accent mt-3">{rol}</span>
        </div>
        <dl className="grid gap-1 text-meta">
          <dt className="text-[var(--color-muted)]">Último acceso</dt>
          <dd className="font-semibold tabular-nums">{fechaHoraLegible(perfil.ultimoAccesoEn)}</dd>
        </dl>
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" className="btn btn-secondary" disabled={pendiente} onClick={() => entrada.current?.click()}>
            {pendiente ? "Guardando…" : foto ? "Cambiar foto" : "Subir foto"}
          </button>
          {foto ? (
            <button type="button" className="btn btn-ghost" disabled={pendiente} onClick={quitar}>
              Quitar
            </button>
          ) : null}
        </div>
        <p className="text-meta text-[var(--color-muted)]">La foto y el nombre se ven en el menú del panel.</p>
        <input
          ref={entrada}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            elegido(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <AvisoError texto={error} />
      </div>
    </section>
  );
}

// ── Datos ────────────────────────────────────────────────────────────────────

function SeccionDatos({ perfil, aviso }: { perfil: PerfilCuenta; aviso: (t: string) => void }) {
  const router = useRouter();
  const [state, accion, pendiente] = useActionState(guardarDatosCuentaAction, INICIAL);
  const [email, setEmail] = useState(perfil.email);
  const [telefono, setTelefono] = useState(perfil.telefono ?? "");
  const cambiaCorreo = email.trim().toLowerCase() !== perfil.email;

  useEffect(() => {
    if (state.ok) {
      aviso("Datos guardados");
      router.refresh();
    }
  }, [state, aviso, router]);

  return (
    <Seccion titulo="Datos" bajada="El correo es con el que entras al sistema.">
      <form action={accion} className="grid gap-4 sm:grid-cols-2">
        <div className="field sm:col-span-2">
          <label htmlFor="cu-nombre">Nombre</label>
          <input
            id="cu-nombre"
            name="nombre"
            className="input"
            maxLength={120}
            autoComplete="name"
            defaultValue={perfil.nombre ?? ""}
            placeholder={nombreVisible(null, perfil.email)}
          />
        </div>
        <div className="field">
          <label htmlFor="cu-email">Correo</label>
          <input
            id="cu-email"
            name="email"
            type="email"
            className="input"
            maxLength={160}
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="cu-telefono">Teléfono</label>
          <input
            id="cu-telefono"
            name="telefono"
            type="tel"
            className="input tabular-nums"
            maxLength={30}
            autoComplete="tel"
            placeholder="+56 9 1234 5678"
            value={telefono}
            onChange={(e) => setTelefono(fmtTel(e.target.value))}
          />
        </div>
        {cambiaCorreo ? (
          <div className="field sm:col-span-2">
            <label htmlFor="cu-actual-correo">Contraseña actual (para cambiar el correo)</label>
            <input id="cu-actual-correo" name="actual" type="password" className="input" autoComplete="current-password" required />
          </div>
        ) : null}
        <PieForm error={state.error}>
          <button type="submit" className="btn btn-primary" disabled={pendiente}>
            {pendiente ? "Guardando…" : "Guardar datos"}
          </button>
        </PieForm>
      </form>
    </Seccion>
  );
}

// ── Contraseña ───────────────────────────────────────────────────────────────

function SeccionPassword({ largoMinimo, aviso }: { largoMinimo: number; aviso: (t: string) => void }) {
  const [state, accion, pendiente] = useActionState(cambiarPasswordCuentaAction, INICIAL);
  const [ver, setVer] = useState(false);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      form.current?.reset();
      aviso("Contraseña cambiada · se cerraron tus otras sesiones");
    }
  }, [state, aviso]);

  const tipo = ver ? "text" : "password";
  return (
    <Seccion
      titulo="Contraseña"
      bajada={`Mínimo ${largoMinimo} caracteres y distinta de tu correo. Al cambiarla se cierran tus sesiones en otros equipos.`}
    >
      <form ref={form} action={accion} className="grid gap-4 sm:grid-cols-2" autoComplete="off">
        <div className="field sm:col-span-2 sm:max-w-[calc(50%-8px)]">
          <label htmlFor="cu-actual">Contraseña actual</label>
          <input id="cu-actual" name="actual" type={tipo} className="input" autoComplete="current-password" required />
        </div>
        <div className="field">
          <label htmlFor="cu-nueva">Contraseña nueva</label>
          <input
            id="cu-nueva"
            name="nueva"
            type={tipo}
            className="input"
            autoComplete="new-password"
            minLength={largoMinimo}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="cu-repetida">Repite la nueva</label>
          <input id="cu-repetida" name="repetida" type={tipo} className="input" autoComplete="new-password" required />
        </div>
        <label className="sm:col-span-2 flex items-center gap-2 text-meta opacity-75 cursor-pointer w-fit">
          <input type="checkbox" checked={ver} onChange={(e) => setVer(e.target.checked)} />
          Mostrar las contraseñas
        </label>
        <PieForm error={state.error}>
          <button type="submit" className="btn btn-primary" disabled={pendiente}>
            {pendiente ? "Cambiando…" : "Cambiar contraseña"}
          </button>
        </PieForm>
      </form>
    </Seccion>
  );
}
