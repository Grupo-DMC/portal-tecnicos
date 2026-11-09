"use server";

import { revalidatePath } from "next/cache";
import { crearSesion, getSesion, ipDeLaPeticion, type Sesion } from "@/lib/auth";
import { auditar } from "@/lib/data/auditoria";
import { correoEnUso, guardarDatosPropios, guardarFotoPropia, quitarFotoPropia } from "@/lib/data/cuenta";
import { intentoBloqueado, registrarIntento } from "@/lib/data/intentos-login";
import { cambiarPasswordPropia, getUsuarioPorId } from "@/lib/data/usuarios";
import { decodificarImagen } from "@/lib/imagen";
import { log } from "@/lib/log";
import { validarPasswordNueva, verificarPassword } from "@/lib/password";
import { validar } from "@/lib/validacion/comun";
import { entradaDatosCuenta, entradaFotoCuenta, entradaPasswordCuenta } from "@/lib/validacion/cuenta";

// «Mi cuenta» del panel. Cada acción toca solo la cuenta de la sesión: no
// recibe ningún id. El técnico no pasa por acá (su ficha la lleva coordinación).

export interface CuentaState {
  ok: boolean;
  error: string | null;
}

const SIN_SESION: CuentaState = { ok: false, error: "Tu sesión terminó. Vuelve a entrar." };
const FOTO_MAX_BYTES = 1024 * 1024;

async function sesionDelPanel(): Promise<Sesion | null> {
  const sesion = await getSesion();
  return sesion && sesion.usuario.rol !== "TECNICO" ? sesion : null;
}

/**
 * Comprueba la clave actual con el mismo freno que el login: con una sesión
 * abierta en un equipo ajeno no se puede probar claves sin límite.
 */
async function claveActualCorrecta(sesion: Sesion, actual: string): Promise<"ok" | "mala" | "bloqueada"> {
  const ip = await ipDeLaPeticion();
  const email = sesion.usuario.email;
  if (await intentoBloqueado(email, ip)) return "bloqueada";
  const registro = await getUsuarioPorId(sesion.usuario.id);
  const valida = !!registro && (await verificarPassword(actual, registro.passwordHash));
  await registrarIntento(email, ip, valida);
  return valida ? "ok" : "mala";
}

const MENSAJE_CLAVE = {
  mala: "La contraseña actual no es correcta.",
  bloqueada: "Demasiados intentos seguidos. Espera 15 minutos y vuelve a intentarlo.",
} as const;

export async function guardarDatosCuentaAction(_prev: CuentaState, formData: FormData): Promise<CuentaState> {
  const sesion = await sesionDelPanel();
  if (!sesion) return SIN_SESION;

  const valida = validar(
    entradaDatosCuenta,
    {
      nombre: String(formData?.get?.("nombre") ?? "").trim(),
      telefono: String(formData?.get?.("telefono") ?? "").trim(),
      email: String(formData?.get?.("email") ?? "").trim().toLowerCase(),
      actual: String(formData?.get?.("actual") ?? ""),
    },
    "cuenta.datos"
  );
  if (!valida.ok) return { ok: false, error: valida.error };
  const { nombre, telefono, email, actual } = valida.datos;

  const cambiaCorreo = email !== sesion.usuario.email;
  try {
    if (cambiaCorreo) {
      if (!actual) return { ok: false, error: "Para cambiar el correo escribe tu contraseña actual." };
      const clave = await claveActualCorrecta(sesion, actual);
      if (clave !== "ok") return { ok: false, error: MENSAJE_CLAVE[clave] };
      if (await correoEnUso(email, sesion.usuario.id)) {
        return { ok: false, error: "Ese correo ya lo usa otra cuenta." };
      }
    }
    await guardarDatosPropios(sesion.usuario.id, { nombre: nombre || null, telefono: telefono || null, email });
    await auditar(sesion, {
      accion: "cuenta.editar",
      entidad: "usuario",
      entidadId: sesion.usuario.id,
      ...(cambiaCorreo ? { detalle: { correoAnterior: sesion.usuario.email } } : {}),
    });
  } catch (err) {
    log.error("cuenta.datos", { err, usuarioId: sesion.usuario.id });
    return { ok: false, error: "No se pudieron guardar los datos. Inténtalo otra vez en un momento." };
  }

  revalidatePath("/admin", "layout");
  return { ok: true, error: null };
}

/**
 * Cambio de clave a voluntad. Pide la actual, cierra las demás sesiones de la
 * cuenta y le firma a esta una con la versión nueva para no echarla.
 */
export async function cambiarPasswordCuentaAction(_prev: CuentaState, formData: FormData): Promise<CuentaState> {
  const sesion = await sesionDelPanel();
  if (!sesion) return SIN_SESION;

  // Las contraseñas no se recortan: se guardan tal como se escribieron.
  const actual = String(formData?.get?.("actual") ?? "");
  const nueva = String(formData?.get?.("nueva") ?? "");
  const repetida = String(formData?.get?.("repetida") ?? "");
  const valida = validar(entradaPasswordCuenta, { actual, nueva, repetida }, "cuenta.password");
  if (!valida.ok) return { ok: false, error: valida.error };
  if (!actual) return { ok: false, error: "Escribe tu contraseña actual." };
  if (nueva !== repetida) return { ok: false, error: "Las dos contraseñas nuevas no coinciden." };
  const fallo = validarPasswordNueva(nueva, sesion.usuario.email);
  if (fallo) return { ok: false, error: fallo };

  try {
    const clave = await claveActualCorrecta(sesion, actual);
    if (clave !== "ok") return { ok: false, error: MENSAJE_CLAVE[clave] };
    const version = await cambiarPasswordPropia(sesion.usuario.id, nueva);
    if (version === null) return { ok: false, error: "La contraseña nueva tiene que ser distinta de la actual." };
    await crearSesion(sesion.usuario.id, version);
    await auditar(sesion, { accion: "password.cambio", entidad: "usuario", entidadId: sesion.usuario.id });
  } catch (err) {
    log.error("cuenta.password", { err, usuarioId: sesion.usuario.id });
    return { ok: false, error: "No se pudo cambiar la contraseña. Inténtalo otra vez en un momento." };
  }
  return { ok: true, error: null };
}

/** La foto llega ya recortada y comprimida por el navegador, como data URL. */
export async function subirFotoCuentaAction(dataUrl: string): Promise<CuentaState> {
  const sesion = await sesionDelPanel();
  if (!sesion) return SIN_SESION;

  const valida = validar(entradaFotoCuenta, dataUrl, "cuenta.foto");
  if (!valida.ok) return { ok: false, error: valida.error };
  const imagen = decodificarImagen(valida.datos);
  if (!imagen) return { ok: false, error: "La foto tiene que ser JPG, PNG o WebP." };
  if (imagen.bytes.length > FOTO_MAX_BYTES) return { ok: false, error: "La foto pesa más de 1 MB." };

  try {
    await guardarFotoPropia(sesion.usuario.id, imagen.mime, imagen.bytes);
    await auditar(sesion, { accion: "cuenta.foto", entidad: "usuario", entidadId: sesion.usuario.id });
  } catch (err) {
    log.error("cuenta.foto", { err, usuarioId: sesion.usuario.id });
    return { ok: false, error: "No se pudo guardar la foto. Inténtalo otra vez en un momento." };
  }
  revalidatePath("/admin", "layout");
  return { ok: true, error: null };
}

export async function quitarFotoCuentaAction(): Promise<CuentaState> {
  const sesion = await sesionDelPanel();
  if (!sesion) return SIN_SESION;
  try {
    await quitarFotoPropia(sesion.usuario.id);
    await auditar(sesion, {
      accion: "cuenta.foto",
      entidad: "usuario",
      entidadId: sesion.usuario.id,
      detalle: { quitada: true },
    });
  } catch (err) {
    log.error("cuenta.foto.quitar", { err, usuarioId: sesion.usuario.id });
    return { ok: false, error: "No se pudo quitar la foto. Inténtalo otra vez en un momento." };
  }
  revalidatePath("/admin", "layout");
  return { ok: true, error: null };
}
