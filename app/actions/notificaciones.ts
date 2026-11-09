"use server";

import { z } from "zod";
import { getSesion } from "@/lib/auth";
import { log } from "@/lib/log";
import { bandejaDe, guardarConfiguracion, marcarLeidas } from "@/lib/data/actividad";
import { validar, idPositivo } from "@/lib/validacion/comun";
import { NIVELES, preferenciasParaGuardar, type BandejaNotificaciones, type ConfiguracionAvisos } from "@/lib/notificaciones";

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
  return sesion && sesion.usuario.rol !== "TECNICO" ? sesion : null;
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
