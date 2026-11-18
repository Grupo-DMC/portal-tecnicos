import "server-only";
import { env, envBooleana } from "@/lib/env";
import { configCorreo, type ConfigCorreo } from "@/lib/correo/proveedor";

// El interruptor de los avisos por correo.
//
// Todo lo del correo de avisos (encolar, mandar, el cron, la sección de «Mi
// cuenta» y las preferencias de push por tipo) depende de avisosCorreo(): si
// devuelve null, la app se comporta exactamente como antes de la migración 043
// y no toca ninguna de sus tablas.
//
// Para encenderlo hacen falta las cuatro cosas:
//   AVISOS_CORREO_ACTIVO=true
//   RESEND_API_KEY (la misma del acta)
//   CORREO_AVISOS_REMITENTE (o, si no, CORREO_REMITENTE), de un dominio verificado
//   APP_URL, para los enlaces del correo

/** Minutos que se juntan los avisos «al momento» después de mandar uno. */
export const VENTANA_MINUTOS = 10;
/** Correos «al momento» por cuenta y hora; pasado el tope, lo demás va al resumen. */
export const TOPE_POR_HORA = 6;
/** Novedades que se listan en un correo; las demás se cuentan. */
export const MAX_EN_CORREO = 40;
/** Veces que se reintenta una novedad cuyo correo falló. */
export const MAX_INTENTOS = 3;

export interface ConfigAvisosCorreo {
  proveedor: ConfigCorreo;
  /** "Nombre <correo>" con que salen los avisos. */
  remitente: string;
  /** https://… sin barra final. */
  urlBase: string;
}

export function urlBaseValida(valor: string | undefined): string | null {
  if (!valor) return null;
  try {
    const u = new URL(valor);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.origin;
  } catch {
    return null;
  }
}

/** La configuración, o null si los avisos por correo están apagados o les falta algo. */
export function avisosCorreo(): ConfigAvisosCorreo | null {
  if (!envBooleana("AVISOS_CORREO_ACTIVO", false)) return null;
  const clave = env("RESEND_API_KEY");
  const remitente = env("CORREO_AVISOS_REMITENTE") ?? env("CORREO_REMITENTE");
  const urlBase = urlBaseValida(env("APP_URL"));
  if (!clave || !remitente || !urlBase) return null;
  // Los avisos no necesitan el remitente del acta: basta la clave de Resend.
  const proveedor = configCorreo() ?? { clave, remitente, dominios: [] };
  return { proveedor, remitente, urlBase };
}

export function avisosCorreoActivos(): boolean {
  return avisosCorreo() !== null;
}
