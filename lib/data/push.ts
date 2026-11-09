import "server-only";
import { sendNotification, setVapidDetails } from "web-push";
import { env } from "@/lib/env";
import { consultaCon, ejecutar, num, sql } from "@/lib/data/sql";
import { leerConfiguracion } from "@/lib/data/actividad";
import { accesoDeUsuario } from "@/lib/data/roles";
import { getUsuarioPorId } from "@/lib/data/usuarios";
import { log } from "@/lib/log";
import { tiposPara } from "@/lib/notificaciones";

// Avisos push: llegan al navegador aunque no haya ninguna pestaña abierta.
// Las suscripciones viven en dmc.push_suscripcion (migración 036). Todo es de
// mejor esfuerzo: si falla, la campanita sigue igual. Sin las claves VAPID
// (ver .env.example) esto no hace nada.

export interface SuscripcionPush {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface AvisoPush {
  /** Id de la actividad: es el `tag`, así la campanita abierta no repite el aviso. */
  id: number;
  tipo: string;
  actorId: number | null;
  titulo: string;
  cuerpo: string | null;
  enlace: string | null;
}

export function clavePublicaPush(): string | null {
  return pushConfigurado() ? env("VAPID_PUBLIC_KEY")! : null;
}

function pushConfigurado(): boolean {
  return Boolean(env("VAPID_PUBLIC_KEY") && env("VAPID_PRIVATE_KEY"));
}

let listo = false;
function prepararVapid() {
  if (listo) return;
  setVapidDetails(env("VAPID_SUBJECT") ?? "mailto:soporte@example.com", env("VAPID_PUBLIC_KEY")!, env("VAPID_PRIVATE_KEY")!);
  listo = true;
}

/** Un navegador solo pertenece a una cuenta: si otra la activa ahí, se la queda. */
export async function guardarSuscripcion(usuarioId: number, s: SuscripcionPush): Promise<void> {
  await ejecutar(
    `MERGE dmc.push_suscripcion AS d
     USING (SELECT @endpoint AS endpoint) AS o ON d.endpoint = o.endpoint
     WHEN MATCHED THEN UPDATE SET usuario_id = @u, p256dh = @p256dh, auth = @auth
     WHEN NOT MATCHED THEN INSERT (usuario_id, endpoint, p256dh, auth) VALUES (@u, @endpoint, @p256dh, @auth);`,
    [
      ["u", sql.BigInt, usuarioId],
      ["endpoint", sql.NVarChar(450), s.endpoint],
      ["p256dh", sql.VarChar(200), s.p256dh],
      ["auth", sql.VarChar(100), s.auth],
    ]
  );
}

export async function borrarSuscripcion(usuarioId: number, endpoint: string): Promise<void> {
  await ejecutar(`DELETE FROM dmc.push_suscripcion WHERE endpoint = @endpoint AND usuario_id = @u`, [
    ["endpoint", sql.NVarChar(450), endpoint],
    ["u", sql.BigInt, usuarioId],
  ]);
}

interface FilaSuscripcion {
  id: unknown;
  usuarioId: unknown;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Manda el aviso a quien lo pidió: tiene el navegador suscrito, no lo hizo él,
 * y ese tipo está en «Avisar» para su rol y sus preferencias.
 */
export async function enviarPush(aviso: AvisoPush): Promise<void> {
  if (!pushConfigurado()) return;
  try {
    const filas = await consultaCon<FilaSuscripcion>(
      `SELECT id, usuario_id AS usuarioId, endpoint, p256dh, auth FROM dmc.push_suscripcion
        WHERE usuario_id <> COALESCE(@actor, 0)`,
      [["actor", sql.BigInt, aviso.actorId]]
    );
    if (filas.length === 0) return;
    prepararVapid();

    const permitido = new Map<number, boolean>();
    const puede = async (uid: number) => {
      const antes = permitido.get(uid);
      if (antes !== undefined) return antes;
      let ok = false;
      try {
        const reg = await getUsuarioPorId(uid);
        if (reg && reg.usuario.activo && reg.usuario.rol !== "TECNICO") {
          const [acceso, config] = await Promise.all([accesoDeUsuario(reg.usuario), leerConfiguracion(uid)]);
          ok = tiposPara(acceso.permisos, config.niveles).avisar.includes(aviso.tipo);
        }
      } catch (err) {
        log.error("push.destinatario", { err, usuarioId: uid });
      }
      permitido.set(uid, ok);
      return ok;
    };

    const carga = JSON.stringify({
      titulo: aviso.titulo,
      cuerpo: aviso.cuerpo,
      enlace: aviso.enlace,
      tag: `dmc-${aviso.id}`,
    });

    await Promise.all(
      filas.map(async (f) => {
        if (!(await puede(num(f.usuarioId)))) return;
        try {
          await sendNotification({ endpoint: f.endpoint, keys: { p256dh: f.p256dh, auth: f.auth } }, carga, {
            TTL: 3600,
            urgency: "normal",
          });
        } catch (err) {
          const estado = (err as { statusCode?: number }).statusCode;
          // 404/410: el navegador ya no existe o revocó el permiso.
          if (estado === 404 || estado === 410) {
            await ejecutar(`DELETE FROM dmc.push_suscripcion WHERE id = @id`, [["id", sql.BigInt, num(f.id)]]);
          } else {
            log.error("push.envio", { err, estado });
          }
        }
      })
    );
  } catch (err) {
    log.error("push.enviar", { err, tipo: aviso.tipo });
  }
}
