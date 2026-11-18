import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { log } from "@/lib/log";
import { avisosCorreo } from "@/lib/correo/avisos-config";
import { despacharCorreos, limpiarCorreos } from "@/lib/data/correo-avisos";

// Despacha los avisos por correo que ya pueden salir: los agrupados «al
// momento» cuya ventana terminó y los resúmenes del día. Lo llama el cron de
// Vercel (o cualquier programador) con la cabecera que Vercel manda sola:
//
//   Authorization: Bearer $CRON_SECRET
//
// Sin CRON_SECRET la ruta no existe (404). Con los avisos por correo apagados
// responde que no hay nada que hacer y no toca la base.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function autorizado(req: NextRequest, esperado: string): boolean {
  const cabecera = req.headers.get("authorization") ?? "";
  const recibido = cabecera.startsWith("Bearer ") ? cabecera.slice(7) : "";
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  const esperado = env("CRON_SECRET");
  if (!esperado) return new NextResponse(null, { status: 404 });
  if (!autorizado(req, esperado)) return new NextResponse(null, { status: 401 });

  const config = avisosCorreo();
  if (!config) return NextResponse.json({ ok: true, activo: false });

  try {
    const resultado = await despacharCorreos(config);
    // Una vez por hora basta para la limpieza.
    if (new Date().getMinutes() < 10) await limpiarCorreos().catch((err) => log.error("correoAvisos.limpiar", { err }));
    return NextResponse.json({ ok: true, activo: true, ...resultado });
  } catch (err) {
    log.error("cron.correos", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
