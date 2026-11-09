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
    <div className="px-4 md:px-7 py-6 md:py-8 max-w-[860px] flex flex-col gap-8">
      <SeccionFoto perfil={perfil} rol={rol} aviso={aviso} />
      <SeccionDatos perfil={perfil} aviso={aviso} />
      <SeccionPassword largoMinimo={largoMinimo} aviso={aviso} />
      <Toast texto={toast} variante="panel" />
    </div>
  );
}

function Seccion({ titulo, bajada, children }: { titulo: string; bajada?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)] md:gap-8 border-t-2 border-[var(--color-divider)] pt-6 first:border-t-0 first:pt-0">
      <div>
        <h2 className="font-extrabold text-lead tracking-[-.01em]">{titulo}</h2>
        {bajada ? <p className="text-meta opacity-62 mt-1 max-w-[30ch]">{bajada}</p> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
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
    <Seccion titulo="Perfil" bajada="La foto y el nombre se ven en el menú del panel.">
      <div className="flex items-center gap-5 flex-wrap">
        <div className="w-24 h-24 shrink-0 bg-[var(--color-text)] text-[var(--color-bg)] grid place-items-center font-extrabold text-h2 overflow-hidden">
          {foto ? (
            // eslint-disable-next-line @next/next/no-img-element -- ruta propia con sesión; next/image no aporta acá
            <img src={foto} alt={`Foto de ${nombre}`} width={96} height={96} className="w-full h-full object-cover" />
          ) : (
            iniciales(nombre)
          )}
        </div>
        <div className="min-w-0 flex flex-col gap-2">
          <div>
            <div className="font-extrabold text-lead truncate">{nombre}</div>
            <div className="text-meta opacity-62">
              {rol} · último acceso {fechaHoraLegible(perfil.ultimoAccesoEn)}
            </div>
          </div>
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
        </div>
      </div>
      <div className="mt-3">
        <AvisoError texto={error} />
      </div>
    </Seccion>
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
        <div className="sm:col-span-2 flex flex-col gap-3">
          <AvisoError texto={state.error} />
          <div>
            <button type="submit" className="btn btn-primary" disabled={pendiente}>
              {pendiente ? "Guardando…" : "Guardar datos"}
            </button>
          </div>
        </div>
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
        <div className="sm:col-span-2 flex flex-col gap-3">
          <AvisoError texto={state.error} />
          <div>
            <button type="submit" className="btn btn-primary" disabled={pendiente}>
              {pendiente ? "Cambiando…" : "Cambiar contraseña"}
            </button>
          </div>
        </div>
      </form>
    </Seccion>
  );
}
