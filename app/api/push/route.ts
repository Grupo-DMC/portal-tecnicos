import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSesion } from "@/lib/auth";
import { borrarSuscripcion, clavePublicaPush, guardarSuscripcion } from "@/lib/data/push";
import { log } from "@/lib/log";

// Suscripciones a los avisos push de la campanita. GET devuelve la clave
// pública (null si el servidor no tiene VAPID); POST suscribe este navegador;
// DELETE lo da de baja.

export const dynamic = "force-dynamic";

const Suscripcion = z.object({
  endpoint: z.string().url().max(450),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

async function panel() {
  const sesion = await getSesion();
  if (!sesion) return { error: new NextResponse("No autorizado", { status: 401 }) } as const;
  if (sesion.usuario.rol === "TECNICO") return { error: new NextResponse("No encontrada", { status: 404 }) } as const;
  return { sesion } as const;
}

export async function GET() {
  const r = await panel();
  if ("error" in r) return r.error;
  return NextResponse.json({ clave: clavePublicaPush() }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: NextRequest) {
  const r = await panel();
  if ("error" in r) return r.error;
  const dato = Suscripcion.safeParse(await req.json().catch(() => null));
  if (!dato.success) return NextResponse.json({ error: "Suscripción inválida." }, { status: 400 });
  try {
    await guardarSuscripcion(r.sesion.usuario.id, {
      endpoint: dato.data.endpoint,
      p256dh: dato.data.keys.p256dh,
      auth: dato.data.keys.auth,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error("push.suscribir", { err });
    return NextResponse.json({ error: "No se pudo guardar." }, { status: 503 });
  }
}

export async function DELETE(req: NextRequest) {
  const r = await panel();
  if ("error" in r) return r.error;
  const dato = z.object({ endpoint: z.string().max(450) }).safeParse(await req.json().catch(() => null));
  if (!dato.success) return NextResponse.json({ error: "Falta el endpoint." }, { status: 400 });
  try {
    await borrarSuscripcion(r.sesion.usuario.id, dato.data.endpoint);
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error("push.baja", { err });
    return NextResponse.json({ error: "No se pudo dar de baja." }, { status: 503 });
  }
}
