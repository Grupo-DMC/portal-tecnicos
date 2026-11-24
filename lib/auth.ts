import "server-only";
import { log } from "@/lib/log";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { COOKIE_EXPIRA, COOKIE_SESION, VIGENCIA_SESION, firmarToken, opcionesCookie, verificarToken } from "@/lib/session";
import { gastarTiempoDeVerificacion, verificarPassword } from "@/lib/password";
import {
  getUsuarioPorEmail,
  getUsuarioPorId,
  registrarAcceso,
  type UsuarioConHash,
} from "@/lib/data/usuarios";
import { intentoBloqueado, registrarIntento } from "@/lib/data/intentos-login";
import { accesoDeUsuario } from "@/lib/data/roles";
import { tiene } from "@/lib/permisos";
import { enPanel, inicioDelModo, modosDisponibles, resolverModo, type Modo } from "@/lib/roles";
import type { Tecnico, Usuario } from "@/lib/types";

export interface Sesion {
  usuario: Usuario;
  /**
   * En qué trabaja ahora: el panel o el de técnico. Lo resuelve el servidor en
   * cada petición con los roles de la base (ver lib/roles.resolverModo): el
   * token solo dice cuál pidió.
   */
  modo: Modo;
  /** Los modos que la cuenta puede usar. Más de uno = puede cambiar de panel. */
  modos: Modo[];
  /**
   * Su técnico, solo en modo técnico. En el panel es null aunque la cuenta
   * tenga técnico vinculado: las acciones de técnico se abren con él, y desde
   * el panel no se hacen.
   */
  tecnico: Tecnico | null;
  /** Lo que puede hacer en el panel: "<módulo>.<acción>". Ver lib/permisos.ts. */
  permisos: string[];
  /** El nombre de su rol, para mostrarlo en el panel. */
  rolNombre: string;
}

/** Los modos en que puede trabajar la cuenta leída de la base. */
function modosDelRegistro(registro: Pick<UsuarioConHash, "usuario" | "tecnico">): Modo[] {
  return modosDisponibles(registro.usuario.roles, !!registro.tecnico?.activo);
}

/**
 * La IP de quien hace la petición. En Vercel x-forwarded-for la pone la propia
 * plataforma (descarta la que mande el cliente) y su primer valor es el origen.
 */
export async function ipDeLaPeticion(): Promise<string | null> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim();
  return ip ? ip.slice(0, 45) : null;
}

export type ResultadoAutenticacion =
  | { ok: true; registro: UsuarioConHash }
  /** `bloqueado`: demasiados intentos; no se miró la contraseña. */
  | { ok: false; bloqueado: boolean };

/**
 * Valida credenciales contra tecnico.usuario. Ante cualquier fallo —correo
 * desconocido, contraseña mala, usuario inactivo— responde lo mismo sin
 * distinguir cuál: quien intenta entrar no tiene por qué saber qué correos
 * existen. Cada intento queda anotado para frenar los repetidos (ver
 * lib/data/intentos-login).
 */
export async function autenticar(email: string, password: string, ip: string | null): Promise<ResultadoAutenticacion> {
  const normalizado = email.trim().toLowerCase();

  // El freno vale igual para correos que existen y que no: la espera no delata
  // nada. Se gasta el tiempo de un bcrypt para que tampoco lo delate la demora.
  if (await intentoBloqueado(normalizado, ip)) {
    await gastarTiempoDeVerificacion();
    return { ok: false, bloqueado: true };
  }

  const registro = await getUsuarioPorEmail(normalizado);
  let valido = false;
  if (!registro) {
    await gastarTiempoDeVerificacion();
  } else {
    valido = await verificarPassword(password, registro.passwordHash);
    // El chequeo de "activo" va después de verificar la contraseña, para que
    // una cuenta desactivada no se delate respondiendo más rápido que una activa.
    if (!registro.usuario.activo) valido = false;
    // Sin ningún modo disponible —solo técnico y con el técnico desactivado—
    // no hay a dónde entrar.
    if (modosDelRegistro(registro).length === 0) valido = false;
  }

  await registrarIntento(normalizado, ip, valido);
  if (!registro || !valido) return { ok: false, bloqueado: false };

  await registrarAcceso(registro.usuario.id);
  return { ok: true, registro };
}

/**
 * Firma la cookie de sesión. Sin `modo`, la cuenta entra al que le toca por
 * defecto (el panel, si tiene uno).
 */
export async function crearSesion(usuarioId: number, sesionVersion: number, modo?: Modo): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_SESION, await firmarToken(usuarioId, sesionVersion, Date.now(), modo), opcionesCookie(VIGENCIA_SESION));
  store.set(
    COOKIE_EXPIRA,
    String(Math.floor(Date.now() / 1000) + VIGENCIA_SESION),
    opcionesCookie(VIGENCIA_SESION, false)
  );
}

export async function cerrarSesion(): Promise<void> {
  const store = await cookies();
  // Se sobrescribe con maxAge 0 además de borrar, para que el navegador
  // descarte también la cookie si quedó fijada con otros atributos.
  store.set(COOKIE_SESION, "", opcionesCookie(0));
  store.delete(COOKIE_SESION);
  store.set(COOKIE_EXPIRA, "", opcionesCookie(0, false));
  store.delete(COOKIE_EXPIRA);
}

/**
 * Sesión del usuario actual, sin mirar si le falta cambiar la clave. Verifica
 * la firma del token y vuelve a leer el usuario en cada petición: si lo
 * desactivan, o si su versión de sesión subió (cambio de clave, de rol o de
 * permisos), la sesión muere sin esperar a que expire la cookie. Los permisos
 * también se leen del rol en cada petición.
 *
 * Va con `cache` para que el layout, la página y sus consultas compartan una
 * sola lectura por petición.
 */
interface SesionLeida {
  sesion: Sesion;
  debeCambiarPassword: boolean;
  /** La versión del token, para volver a firmarlo al cambiar de modo. */
  sesionVersion: number;
}

const leerSesion = cache(async function leerSesion(): Promise<SesionLeida | null> {
  const store = await cookies();
  const token = await verificarToken(store.get(COOKIE_SESION)?.value);
  if (!token) return null;

  try {
    const registro = await getUsuarioPorId(token.uid);
    if (!registro || !registro.usuario.activo) return null;
    if (registro.sesionVersion !== token.sv) return null;
    // El modo del token es solo lo que pidió: si ya no tiene ese rol (o su
    // técnico se desactivó), queda en el que sí tenga; si no tiene ninguno,
    // no hay sesión.
    const modos = modosDelRegistro(registro);
    const modo = resolverModo(token.modo, modos);
    if (!modo) return null;
    const acceso = await accesoDeUsuario(registro.usuario, modo);
    return {
      sesion: {
        usuario: registro.usuario,
        modo,
        modos,
        tecnico: modo === "tecnico" ? registro.tecnico : null,
        ...acceso,
      },
      debeCambiarPassword: registro.debeCambiarPassword,
      sesionVersion: registro.sesionVersion,
    };
  } catch (err) {
    // Base de datos caída: mejor tratar la sesión como ausente (el usuario cae
    // en /login) que reventar la página con un error sin explicación.
    log.error("no se pudo leer la sesión desde SQL Server", { err });
    return null;
  }
});

/**
 * Sesión del usuario actual, o null. Quien tiene pendiente cambiar una clave
 * que le puso otra persona no tiene sesión para nada más que eso: ni pantallas,
 * ni acciones, ni rutas de la API. Ver getSesionPorCambiarPassword.
 */
export async function getSesion(): Promise<Sesion | null> {
  const leida = await leerSesion();
  return leida && !leida.debeCambiarPassword ? leida.sesion : null;
}

/** La sesión de quien tiene que cambiar la clave antes de seguir, o null. */
export async function getSesionPorCambiarPassword(): Promise<Sesion | null> {
  const leida = await leerSesion();
  return leida?.debeCambiarPassword ? leida.sesion : null;
}

/** La pantalla de inicio del modo en que trabaja la sesión. */
export function inicioDeSesion(sesion: Pick<Sesion, "modo">): "/admin" | "/tecnico" {
  return inicioDelModo(sesion.modo);
}

/**
 * Pasa la sesión actual a otro modo sin pedir la clave. El servidor decide: si
 * la cuenta no tiene ese modo —lo vuelve a mirar en la base—, no cambia nada
 * y devuelve false. El cambio vale desde la petición siguiente: quien lo llama
 * redirige.
 */
export async function cambiarModoDeSesion(modo: Modo): Promise<boolean> {
  const leida = await leerSesion();
  if (!leida || leida.debeCambiarPassword) return false;
  if (!leida.sesion.modos.includes(modo)) return false;
  await crearSesion(leida.sesion.usuario.id, leida.sesionVersion, modo);
  return true;
}

/** A dónde mandar a quien no tiene sesión: al login, o a cambiar la clave. */
export async function rutaSinSesion(): Promise<string> {
  return (await getSesionPorCambiarPassword()) ? "/cambiar-password" : "/login";
}

/**
 * La sesión de alguien del panel que tiene ese permiso, o null. Es la puerta
 * de cada acción del servidor: que el botón no se muestre no impide llamarla.
 */
export async function sesionCon(permiso: string): Promise<Sesion | null> {
  const sesion = await getSesion();
  // En modo técnico no se usa el panel, aunque la cuenta tenga rol en él.
  if (!sesion || !enPanel(sesion)) return null;
  return tiene(sesion.permisos, permiso) ? sesion : null;
}
