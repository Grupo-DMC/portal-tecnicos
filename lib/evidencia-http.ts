import "server-only";

// Cabeceras con que se sirve la evidencia (fotos, firmas y videos). Los bytes
// vienen de la base y se entregan desde el mismo origen que la app, así que se
// sirven como datos inertes: sin sniffing, sin scripts y sin caché del equipo.

import type { Sesion } from "@/lib/auth";
import { tiene } from "@/lib/permisos";

/**
 * El panel solo sirve evidencia a quien puede ver visitas, igual que las páginas
 * del módulo. El técnico entra por su propia regla (las visitas en que participa).
 */
export function sinPermisoDeVer(sesion: Sesion): boolean {
  return sesion.usuario.rol !== "TECNICO" && !tiene(sesion.permisos, "visitas.ver");
}

const MIMES_IMAGEN = ["image/jpeg", "image/png", "image/webp"];
const MIMES_VIDEO = ["video/mp4", "video/webm", "video/quicktime"];

/** El mime tal cual si está en la lista blanca; si no, un tipo que el navegador no ejecuta. */
export function mimeSeguro(mime: string, tipo: "imagen" | "video"): string {
  const m = String(mime ?? "").toLowerCase();
  return (tipo === "imagen" ? MIMES_IMAGEN : MIMES_VIDEO).includes(m) ? m : "application/octet-stream";
}

/** Cabeceras comunes de seguridad y caché. */
export function cabecerasEvidencia(mime: string): Record<string, string> {
  return {
    "Content-Type": mime,
    "Content-Security-Policy": "sandbox; default-src 'none'",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": "inline",
    // En equipos compartidos nada debe quedar en la caché al cerrar sesión.
    "Cache-Control": "private, no-store",
  };
}
