import { notFound } from "next/navigation";
import { getActaEnviada, getVisitaCompletaPorFolio, getVisitaEliminadaPorFolio } from "@/lib/data/visitas";
import ActaView from "@/components/admin/ActaView";
import SinAcceso from "@/components/admin/SinAcceso";
import { sesionCon } from "@/lib/auth";
import { visitaParaPanel } from "@/lib/data/visita-reducida";

export const dynamic = "force-dynamic";

export default async function ActaPage({ params }: { params: Promise<{ folio: string }> }) {
  const sesion = await sesionCon("visitas.ver");
  if (!sesion) return <SinAcceso />;
  const { folio: folioParam } = await params;
  const folio = decodeURIComponent(folioParam);
  // Una eliminada solo la abre el administrador; para el resto, no existe.
  const visita =
    (await getVisitaCompletaPorFolio(folio)) ??
    (sesion.usuario.rol === "ADMIN" ? await getVisitaEliminadaPorFolio(folio) : undefined);
  if (!visita) notFound();
  const paraPanel = visitaParaPanel(visita, sesion.permisos);

  return (
    <ActaView visita={paraPanel} enviada={await getActaEnviada(visita.folio)}
    />
  );
}
