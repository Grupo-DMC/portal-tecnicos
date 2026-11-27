"use client";

import Image from "next/image";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  loginAction,
  solicitarPasswordAction,
  type LoginState,
  type SolicitudState,
} from "@/app/actions/auth";
import Icono, { type NombreIcono } from "./Iconos";

const initialState: LoginState = { error: null };
const initialSolicitud: SolicitudState = { ok: false, error: null };

/** Estilo de campo de la app. El login ya no lo usa (tiene el suyo en login.css); lo sigue usando /cambiar-password. */
export const CAMPO =
  "w-full min-h-[54px] px-3.5 py-3 text-lead bg-[var(--color-surface)] border border-[var(--color-divider)] text-[var(--color-text)] caret-[var(--color-accent)] focus-visible:border-[var(--color-accent)] focus-visible:outline-none";

/** Sacude el bloque del formulario cada vez que llega un error nuevo. */
function useSacudida(señal: unknown) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !señal) return;
    el.classList.remove("shake");
    void el.offsetWidth; // reinicia la animación
    el.classList.add("shake");
  }, [señal]);
  return ref;
}

function Campo({
  id,
  label,
  icon,
  conBoton = false,
  children,
}: {
  id: string;
  label: React.ReactNode;
  icon: NombreIcono;
  conBoton?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className={`control${conBoton ? " has-action" : ""}`}>
        <Icono name={icon} className="ico" />
        {children}
      </div>
    </div>
  );
}

function Boton({
  cargando,
  children,
  flecha = false,
}: {
  cargando: boolean;
  children: React.ReactNode;
  flecha?: boolean;
}) {
  return (
    <button
      className="btn"
      type="submit"
      disabled={cargando}
      data-state={cargando ? "loading" : undefined}
      aria-busy={cargando}
    >
      <span>{children}</span>
      {flecha ? <Icono name="arrow" className="arrow" /> : null}
      <span className="spinner" aria-hidden="true" />
    </button>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <div className="alert" role="alert">
      <Icono name="alert" />
      <span>{children}</span>
    </div>
  );
}

export default function LoginForm({ version, expirada = false }: { version: string; expirada?: boolean }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const [verPass, setVerPass] = useState(false);
  const [olvide, setOlvide] = useState(false);
  const sacudida = useSacudida(state.error ? state : null);

  return (
    <section className="form-wrap" ref={sacudida}>
      <Image
        className="logo"
        src="/login/logo-dmc.png"
        alt="Grupo DMC, Ideas Tecnológicas de Seguridad"
        width={561}
        height={199}
        priority
      />
      {expirada && !olvide ? (
        <div className="notice" role="status">
          <Icono name="alert" />
          <span>Tu sesión venció por inactividad. Vuelve a entrar.</span>
        </div>
      ) : null}
      {olvide ? (
        <OlvideMiPassword onVolver={() => setOlvide(false)} />
      ) : (
        <div>
          <h1>Iniciar sesión</h1>
          <p className="sub">
            Ingresa tus credenciales para continuar. Funciona sin señal: lo que guardes se envía solo.
          </p>

          {state.error ? <Aviso>{state.error}</Aviso> : null}

          {/* Nada se autocompleta en el sistema: los equipos de terreno son
              compartidos y el navegador ofrecía el correo del turno anterior. */}
          <form action={formAction} autoComplete="off">
            <Campo id="lg-mail" label="Correo" icon="mail">
              <input
                id="lg-mail"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                placeholder="nombre@empresa.cl"
                required
              />
            </Campo>

            <Campo id="lg-pass" label="Contraseña" icon="lock" conBoton>
              <input
                id="lg-pass"
                name="password"
                type={verPass ? "text" : "password"}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                placeholder="Tu contraseña"
                required
              />
              <button
                type="button"
                className="reveal"
                onClick={() => setVerPass((v) => !v)}
                aria-label={verPass ? "Ocultar contraseña" : "Ver contraseña"}
                aria-pressed={verPass}
                title={verPass ? "Ocultar contraseña" : "Ver contraseña"}
              >
                <Icono name={verPass ? "eyeOff" : "eye"} />
              </button>
            </Campo>

            <div className="row">
              <button type="button" className="link" onClick={() => setOlvide(true)}>
                Olvidé mi contraseña
              </button>
            </div>

            <Boton cargando={pending} flecha>
              Iniciar sesión
            </Boton>
          </form>

          <p className="help">¿Problemas para ingresar? Contacta al administrador del sistema. · v{version}</p>
        </div>
      )}
    </section>
  );
}

/**
 * Recuperación de contraseña.
 *
 * No hay servidor de correo: en vez de mandar un enlace, se registra la
 * solicitud y el administrador la ve en el panel, donde asigna una clave
 * temporal. La pantalla dice exactamente eso para que nadie se quede esperando
 * un correo que no va a llegar.
 */
function OlvideMiPassword({ onVolver }: { onVolver: () => void }) {
  const [state, formAction, pending] = useActionState(solicitarPasswordAction, initialSolicitud);

  const volver = (
    <button className="btn-ghost" type="button" onClick={onVolver}>
      <Icono name="arrowLeft" />
      Volver a iniciar sesión
    </button>
  );

  if (state.ok) {
    return (
      <div>
        <h1>Solicitud enviada</h1>
        <p className="sub">Ahora toca esperar al administrador.</p>
        <div className="notice" role="status">
          <Icono name="check" />
          <span>
            Si ese correo tiene una cuenta, el administrador va a ver la solicitud en el panel y te va a entregar una
            contraseña temporal. No te llega ningún correo: te la pasan por el canal de siempre.
          </span>
        </div>
        {volver}
      </div>
    );
  }

  return (
    <div>
      <h1>Recuperar contraseña</h1>
      <p className="sub">
        Déjanos tu correo y el administrador te asigna una contraseña temporal. No se envía ningún correo automático.
      </p>

      {state.error ? <Aviso>{state.error}</Aviso> : null}

      <form action={formAction} autoComplete="off">
        <Campo id="rec-mail" label="Correo con el que entras" icon="mail">
          <input
            id="rec-mail"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            required
          />
        </Campo>

        <div className="field">
          <label htmlFor="rec-msg">
            Mensaje para el administrador <span className="opt">(opcional)</span>
          </label>
          <textarea
            id="rec-msg"
            name="mensaje"
            className="area"
            rows={3}
            maxLength={400}
            autoComplete="off"
            placeholder="Por ejemplo: en qué turno estás o a qué número llamarte"
          />
        </div>

        <Boton cargando={pending}>Pedir contraseña nueva</Boton>
      </form>

      {volver}
    </div>
  );
}

/** Caja de error con el estilo de la app. La usa /cambiar-password. */
export function Alerta({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="flex gap-2.5 items-start px-3.5 py-2.5 bg-[var(--color-danger-100)] border border-[var(--color-danger-400)] text-[var(--color-danger-800)] text-meta leading-[1.45]"
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        className="shrink-0 mt-0.5"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16.5v.01" />
      </svg>
      <span>{children}</span>
    </div>
  );
}
