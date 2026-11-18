import "server-only";
import { consultaCon, ejecutar, num, sql } from "@/lib/data/sql";
import { leerConfiguracion } from "@/lib/data/actividad";
import { accesoDeUsuario } from "@/lib/data/roles";
import { getUsuarioPorId } from "@/lib/data/usuarios";
import {
  AJUSTES_CORREO_POR_DEFECTO,
  MODOS_CORREO,
  horaResumenValida,
  type AjustesCorreo,
  type ModoCorreo,
  type PreferenciasAviso,
  type PreferenciasCanal,
} from "@/lib/notificaciones";
import { rolDelPanel } from "@/lib/roles";

// Quién quiere enterarse de qué, y por dónde. Es la única puerta para decidir
// el destinatario de un aviso: la usan el push (lib/data/push.ts) y el correo
// (lib/data/correo-avisos.ts), así los dos aplican las mismas reglas.
//
// Las preferencias por canal viven en dmc.notificacion_canal y
// dmc.notificacion_correo (migración 043). Solo se leen con los avisos por
// correo activos: mientras no, el push sigue al nivel «Avisar» como siempre.

export interface CanalesCuenta {
  canales: PreferenciasCanal;
  ajustes: AjustesCorreo;
}

export const CANALES_VACIOS: CanalesCuenta = { canales: {}, ajustes: AJUSTES_CORREO_POR_DEFECTO };

export async function leerCanales(usuarioId: number): Promise<CanalesCuenta> {
  const [filas, cuenta] = await Promise.all([
    consultaCon<{ tipo: string; push: boolean | null; correo: string | null }>(
      `SELECT tipo, push, correo FROM dmc.notificacion_canal WHERE usuario_id = @u`,
      [["u", sql.BigInt, usuarioId]]
    ),
    consultaCon<{ activo: boolean; horaResumen: unknown }>(
      `SELECT activo, hora_resumen AS horaResumen FROM dmc.notificacion_correo WHERE usuario_id = @u`,
      [["u", sql.BigInt, usuarioId]]
    ),
  ]);
  const canales: PreferenciasCanal = {};
  for (const f of filas) {
    canales[f.tipo] = {
      push: f.push === null ? null : Boolean(f.push),
      correo: f.correo && MODOS_CORREO.includes(f.correo as ModoCorreo) ? (f.correo as ModoCorreo) : null,
    };
  }
  const c = cuenta[0];
  return {
    canales,
    ajustes: c ? { activo: Boolean(c.activo), horaResumen: horaResumenValida(num(c.horaResumen)) } : AJUSTES_CORREO_POR_DEFECTO,
  };
}

/** Reemplaza las preferencias de push y correo. `canales` ya viene limpio (ver canalesParaGuardar). */
export async function guardarCanales(usuarioId: number, datos: CanalesCuenta): Promise<void> {
  const filas = Object.entries(datos.canales).map(([tipo, p]) => ({
    tipo,
    push: p.push === null ? null : p.push ? 1 : 0,
    correo: p.correo,
  }));
  await ejecutar(
    `SET XACT_ABORT ON;
     BEGIN TRANSACTION;
       MERGE dmc.notificacion_correo AS d
       USING (SELECT @u AS usuario_id) AS o ON d.usuario_id = o.usuario_id
        WHEN MATCHED THEN UPDATE SET activo = @activo, hora_resumen = @hora, actualizado_en = SYSDATETIME()
        WHEN NOT MATCHED THEN INSERT (usuario_id, activo, hora_resumen) VALUES (o.usuario_id, @activo, @hora);
       DELETE FROM dmc.notificacion_canal WHERE usuario_id = @u;
       INSERT INTO dmc.notificacion_canal (usuario_id, tipo, push, correo)
       SELECT @u, j.tipo, j.push, j.correo
         FROM OPENJSON(@filas) WITH (tipo varchar(40) '$.tipo', push bit '$.push', correo varchar(8) '$.correo') j;
     COMMIT TRANSACTION;`,
    [
      ["u", sql.BigInt, usuarioId],
      ["activo", sql.Bit, datos.ajustes.activo ? 1 : 0],
      ["hora", sql.TinyInt, horaResumenValida(datos.ajustes.horaResumen)],
      ["filas", sql.NVarChar(sql.MAX), JSON.stringify(filas)],
    ]
  );
}

/** Todo lo que hace falta para decidir si a una cuenta le llega un aviso. */
export interface PerfilAvisos {
  usuarioId: number;
  email: string;
  permisos: readonly string[];
  niveles: PreferenciasAviso;
  canales: PreferenciasCanal;
  ajustes: AjustesCorreo;
  /** Hasta qué actividad ya vio en la campanita (0 si nunca la abrió). */
  leidoHasta: number;
}

/**
 * El perfil de avisos de una cuenta del panel, o null si no recibe avisos
 * (no existe, está inactiva o es solo técnico). Quien tiene panel y técnico
 * los recibe según su rol del panel, esté trabajando en el modo que esté.
 * `conCanales` en false no lee las
 * tablas de la migración 043.
 */
export async function perfilAvisos(usuarioId: number, conCanales: boolean): Promise<PerfilAvisos | null> {
  const reg = await getUsuarioPorId(usuarioId);
  if (!reg || !reg.usuario.activo || !rolDelPanel(reg.usuario.roles)) return null;
  const [acceso, config, canales] = await Promise.all([
    accesoDeUsuario(reg.usuario, "panel"),
    leerConfiguracion(usuarioId),
    conCanales ? leerCanales(usuarioId) : Promise.resolve(CANALES_VACIOS),
  ]);
  return {
    usuarioId,
    email: reg.usuario.email,
    permisos: acceso.permisos,
    niveles: config.niveles,
    canales: canales.canales,
    ajustes: canales.ajustes,
    leidoHasta: config.leidoHasta ?? 0,
  };
}

/** Un caché por evento: varias suscripciones o filas de la misma cuenta leen el perfil una vez. */
export function cachePerfiles(conCanales: boolean): (usuarioId: number) => Promise<PerfilAvisos | null> {
  const mapa = new Map<number, Promise<PerfilAvisos | null>>();
  return (usuarioId) => {
    let p = mapa.get(usuarioId);
    if (!p) {
      p = perfilAvisos(usuarioId, conCanales);
      mapa.set(usuarioId, p);
    }
    return p;
  };
}
