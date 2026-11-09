import { NextResponse } from "next/server";
import { getSesion } from "@/lib/auth";
import { getFotoDeUsuario } from "@/lib/data/cuenta";
import { cabecerasEvidencia, mimeSeguro } from "@/lib/evidencia-http";

// Foto de perfil de una cuenta (Mi cuenta, migración 034). Los bytes viven en
// dmc.usuario_foto. Quien está en el panel ve la de cualquiera; el técnico,
// solo la suya.

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await getSesion();
  if (!sesion) return new NextResponse("No autorizado", { status: 401 });

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) return new NextResponse("No encontrada", { status: 404 });
  if (sesion.usuario.rol === "TECNICO" && sesion.usuario.id !== id) {
    return new NextResponse("No encontrada", { status: 404 });
  }

  const foto = await getFotoDeUsuario(id);
  if (!foto) return new NextResponse("No encontrada", { status: 404 });

  return new NextResponse(new Uint8Array(foto.bytes), {
    headers: {
      ...cabecerasEvidencia(mimeSeguro(foto.mime, "imagen")),
      "Content-Length": String(foto.bytes.length),
    },
  });
}
