import { NextResponse } from "next/server";
import { getSesion } from "@/lib/auth";
import { bandejaDe } from "@/lib/data/actividad";
import { log } from "@/lib/log";

// La bandeja de la campanita del panel. La consulta el navegador cada medio
// minuto; por eso el proxy no renueva la sesión con esta ruta (ver
// RUTAS_SIN_RENOVAR en proxy.ts): tener el panel abierto no es estar usándolo.

export const dynamic = "force-dynamic";

export async function GET() {
  const sesion = await getSesion();
  if (!sesion) return new NextResponse("No autorizado", { status: 401 });
  if (sesion.usuario.rol === "TECNICO") return new NextResponse("No encontrada", { status: 404 });
  try {
    const bandeja = await bandejaDe(sesion.usuario.id, sesion.permisos);
    return NextResponse.json(bandeja, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    log.error("notificaciones.bandeja", { err });
    return NextResponse.json({ error: "No se pudo leer las notificaciones." }, { status: 503 });
  }
}
