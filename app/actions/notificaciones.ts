"use server";

import { z } from "zod";
import { getSesion } from "@/lib/auth";
import { log } from "@/lib/log";
import { bandejaDe, guardarConfiguracion, leerConfiguracion, marcarLeidas } from "@/lib/data/actividad";
import { guardarCanales } from "@/lib/data/preferencias-canal";
import { avisosCorreoActivos } from "@/lib/correo/avisos-config";
import { validar, idPositivo } from "@/lib/validacion/comun";
import {
  MODOS_CORREO,
  NIVELES,
  canalesParaGuardar,
  preferenciasParaGuardar,
  type AjustesCorreo,
  type BandejaNotificaciones,
  type ConfiguracionAvisos,
  type PreferenciasAviso,
  type PreferenciasCanal,
} from "@/lib/notificaciones";
import { enPanel } from "@/lib/roles";

// La campanita del panel. Leer la bandeja va por GET /api/notificaciones (es
// lo que se consulta cada medio minuto); acá están las dos escrituras: marcar
// como visto y guardar qué quiere ver cada uno.

export interface ResultadoNotificaciones {
  ok: boolean;
  error?: string;
  bandeja?: BandejaNotificaciones;
}

/** La campanita es del panel: el técnico no tiene. */
async function sesionDelPanel() {
  const sesion = await getSesion();
  return sesion && enPanel(sesion) ? sesion : null;
}

/** Deja como vistas las notificaciones hasta la más nueva que se mostró. */
export async function marcarNotificacionesLeidasAction(hastaPedido: number): Promise<ResultadoNotificaciones> {
  const sesion = await sesionDelPanel();
  if (!sesion) return { ok: false, error: "Tu sesión terminó." };
  const entrada = validar(idPositivo, hastaPedido, "marcarNotificacionesLeidas");
  if (!entrada.ok) return { ok: false, error: entrada.error };
  try {
    await marcarLeidas(sesion.usuario.id, entrada.datos);
    return { ok: true };
  } catch (err) {
    log.error("marcarNotificacionesLeidas", { err });
    return { ok: false, error: "No se pudo guardar. Inténtalo otra vez." };
  }
}

const entradaConfiguracion = z.object({
  verPropios: z.boolean(),
  niveles: z.record(z.string().max(40), z.enum(NIVELES as [string, ...string[]])),
});

/** Guarda qué quiere ver y de qué quiere enterarse, y devuelve la bandeja como queda. */
export async function guardarConfiguracionAvisosAction(pedido: ConfiguracionAvisos): Promise<ResultadoNotificaciones> {
  const sesion = await sesionDelPanel();
  if (!sesion) return { ok: false, error: "Tu sesión terminó." };
  const entrada = validar(entradaConfiguracion, pedido, "guardarConfiguracionAvisos");
  if (!entrada.ok) return { ok: false, error: entrada.error };
  const niveles = preferenciasParaGuardar(sesion.permisos, entrada.datos.niveles as ConfiguracionAvisos["niveles"]);
  try {
    await guardarConfiguracion(sesion.usuario.id, { verPropios: entrada.datos.verPropios, niveles });
    return { ok: true, bandeja: await bandejaDe(sesion.usuario.id, sesion.permisos) };
  } catch (err) {
    log.error("guardarConfiguracionAvisos", { err });
    return { ok: false, error: "No se pudo guardar la configuración. Inténtalo otra vez." };
  }
}

const entradaCanales = z.object({
  niveles: z.record(z.string().max(40), z.enum(NIVELES as [string, ...string[]])),
  canales: z.record(
    z.string().max(40),
    z.object({
      push: z.boolean().nullable(),
      correo: z.enum(MODOS_CORREO as [string, ...string[]]).nullable(),
    })
  ),
  ajustes: z.object({ activo: z.boolean(), horaResumen: z.number().int().min(0).max(23) }),
});

export interface PedidoAvisosCuenta {
  niveles: PreferenciasAviso;
  canales: PreferenciasCanal;
  ajustes: AjustesCorreo;
}

/**
 * «Mi cuenta» → Avisos: qué llega por campanita, push y correo, tipo por tipo.
 * Solo existe con los avisos por correo activos en el servidor.
 */
export async function guardarAvisosCuentaAction(pedido: PedidoAvisosCuenta): Promise<{ ok: boolean; error?: string }> {
  const sesion = await sesionDelPanel();
  if (!sesion) return { ok: false, error: "Tu sesión terminó." };
  if (!avisosCorreoActivos()) return { ok: false, error: "Los avisos por correo todavía no están activos." };
  const entrada = validar(entradaCanales, pedido, "guardarAvisosCuenta");
  if (!entrada.ok) return { ok: false, error: entrada.error };
  const niveles = preferenciasParaGuardar(sesion.permisos, entrada.datos.niveles as PreferenciasAviso);
  const canales = canalesParaGuardar(sesion.permisos, niveles, entrada.datos.canales as PreferenciasCanal);
  try {
    // El nivel de la campanita se guarda con el «ver mis cambios» que ya tenía.
    const actual = await leerConfiguracion(sesion.usuario.id);
    await guardarConfiguracion(sesion.usuario.id, { verPropios: actual.verPropios, niveles });
    await guardarCanales(sesion.usuario.id, { canales, ajustes: entrada.datos.ajustes });
    return { ok: true };
  } catch (err) {
    log.error("guardarAvisosCuenta", { err });
    return { ok: false, error: "No se pudo guardar. Inténtalo otra vez." };
  }
}
