import "server-only";
import { ejecutar, sql } from "@/lib/data/sql";
import { log } from "@/lib/log";

/**
 * Da de baja todos los navegadores suscritos a los avisos push de la cuenta.
 * Se llama al cerrar sesión y al cambiar o restablecer la contraseña: el aviso
 * no debe seguir llegando a un navegador que ya no tiene la sesión. Va aparte
 * de push.ts para que usuarios.ts pueda usarlo sin importaciones circulares.
 * Si falla, no tumba la operación que lo llama.
 */
export async function borrarSuscripcionesDeUsuario(usuarioId: number): Promise<void> {
  try {
    await ejecutar(`DELETE FROM dmc.push_suscripcion WHERE usuario_id = @u`, [["u", sql.BigInt, usuarioId]]);
  } catch (err) {
    log.error("push.baja-usuario", { err, usuarioId });
  }
}
