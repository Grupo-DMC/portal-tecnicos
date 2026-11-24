import { NextResponse } from "next/server";
import { getSesion } from "@/lib/auth";
import { cabecerasEvidencia, sinPermisoDeVer, mimeSeguro } from "@/lib/evidencia-http";
import { esEvidenciaDeEliminada, getDuenosDeImagen, getFotoBinaria } from "@/lib/data/visitas";
import { enModoTecnico, esAdmin } from "@/lib/roles";

// Sirve la foto que el técnico tomó en terreno. Los bytes viven en
// tecnico.visita_foto.contenido: no hay almacenamiento de archivos contratado.
//
// Requiere sesión. Coordinación y administración ven cualquier foto; el técnico
// solo las de sus propias visitas.

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await getSesion();
  if (!sesion) return new NextResponse("No autorizado", { status: 401 });
  if (sinPermisoDeVer(sesion)) return new NextResponse("Sin permiso", { status: 403 });

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) return new NextResponse("No encontrada", { status: 404 });

  if (enModoTecnico(sesion)) {
    const duenos = await getDuenosDeImagen("foto", id);
    if (!sesion.tecnico || !duenos.includes(sesion.tecnico.id)) {
      return new NextResponse("No encontrada", { status: 404 });
    }
  }

  // La evidencia de una visita eliminada solo la ve el administrador.
  if (!esAdmin(sesion) && (await esEvidenciaDeEliminada("foto", id))) {
    return new NextResponse("No encontrada", { status: 404 });
  }

  const imagen = await getFotoBinaria(id);
  if (!imagen) return new NextResponse("No encontrada", { status: 404 });

  return new NextResponse(new Uint8Array(imagen.bytes), {
    headers: {
      ...cabecerasEvidencia(mimeSeguro(imagen.mime, "imagen")),
      "Content-Length": String(imagen.bytes.length),
    },
  });
}
