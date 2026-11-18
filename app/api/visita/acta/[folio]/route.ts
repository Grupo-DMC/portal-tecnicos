import { NextResponse } from "next/server";
import { log } from "@/lib/log";
import { getSesion } from "@/lib/auth";
import { sinPermisoDeVer } from "@/lib/evidencia-http";
import { getVisitaCompletaPorFolio } from "@/lib/data/visitas";
import { pdfDeVisita } from "@/lib/pdf/acta-de-visita";
import { participaEnVisita } from "@/lib/ui/estado";
import { dispositionAdjunto, nombreArchivoActa } from "@/lib/ui/nombre-acta";
import { enModoTecnico } from "@/lib/roles";

// El acta en PDF para mandarle al cliente. Sin comentario interno: ni el texto,
// ni su checklist, ni las fotos o clips marcados como internos.
//
// Requiere sesión. Coordinación y administración bajan cualquier acta; el
// técnico solo las de sus propias visitas.

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ folio: string }> }) {
  const sesion = await getSesion();
  if (!sesion) return new NextResponse("No autorizado", { status: 401 });
  if (sinPermisoDeVer(sesion)) return new NextResponse("Sin permiso", { status: 403 });

  const { folio: folioParam } = await params;
  const folio = decodeURIComponent(folioParam);
  const visita = await getVisitaCompletaPorFolio(folio);
  if (!visita) return new NextResponse("No encontrada", { status: 404 });
  if (enModoTecnico(sesion) && !(sesion.tecnico && participaEnVisita(visita, sesion.tecnico.id))) {
    return new NextResponse("No encontrada", { status: 404 });
  }
  if (visita.estado !== "COMPLETADA") {
    return new NextResponse("El acta todavía no está cerrada.", { status: 409 });
  }

  try {
    const pdf = await pdfDeVisita(visita);

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(pdf.length),
        "Content-Disposition": dispositionAdjunto(nombreArchivoActa(visita)),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    log.error("no se pudo generar el PDF del acta", { err });
    return new NextResponse("No se pudo generar el PDF.", { status: 500 });
  }
}
