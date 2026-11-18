import "server-only";
import { getFirmaBinaria, getFotoBinaria } from "@/lib/data/visitas";
import { listarMotivos, listarProblemas, listarTrabajos } from "@/lib/data/catalogos";
import { generarPdfActa } from "@/lib/pdf/acta";
import type { Visita } from "@/lib/types";

// El PDF del acta de una visita ya leída: lo descarga el panel
// (/api/visita/acta/[folio]) y lo adjunta el correo. Una sola función para que
// los dos entreguen exactamente el mismo documento.
//
// Sin comentario interno: ni el texto, ni su checklist, ni las fotos marcadas
// como internas.

export async function pdfDeVisita(visita: Visita): Promise<Uint8Array> {
  const firmaTienda = visita.firmas?.find((f) => f.rol === "TIENDA") ?? visita.firmas?.[0];
  const fotosAbiertas = (visita.fotos ?? []).filter((f) => !f.interno);
  const [motivos, trabajos, problemas, fotos, firma] = await Promise.all([
    listarMotivos(),
    listarTrabajos(),
    listarProblemas(),
    Promise.all(
      fotosAbiertas.map(async (f) => {
        const bin = await getFotoBinaria(f.id);
        return bin ? { ...bin, etiqueta: f.etiqueta } : null;
      })
    ),
    firmaTienda ? getFirmaBinaria(firmaTienda.id) : Promise.resolve(null),
  ]);

  return generarPdfActa({
    visita,
    motivos,
    trabajos,
    problemas,
    fotos: fotos
      .filter((f) => f !== null)
      .map((f) => ({ bytes: new Uint8Array(f.bytes), mime: f.mime, etiqueta: f.etiqueta })),
    firma: firma ? { bytes: new Uint8Array(firma.bytes), mime: firma.mime } : null,
  });
}
