import { notFound, redirect } from "next/navigation";
import { getVisitaCompletaPorFolio } from "@/lib/data/visitas";
import { listarInternos, listarMotivos, listarProblemas, listarTrabajos } from "@/lib/data/catalogos";
import EditarActa from "@/components/admin/EditarActa";
import SinAcceso from "@/components/admin/SinAcceso";
import { sesionCon } from "@/lib/auth";
import { visitaParaPanel } from "@/lib/data/visita-reducida";

export const dynamic = "force-dynamic";

/** Editar un acta ya cerrada desde el panel: sin plazo, con el permiso. */
export default async function EditarActaPage({ params }: { params: Promise<{ folio: string }> }) {
  const sesion = await sesionCon("visitas.editarActa");
  if (!sesion) return <SinAcceso />;
  const { folio: folioParam } = await params;
  const completa = await getVisitaCompletaPorFolio(decodeURIComponent(folioParam));
  if (!completa) notFound();
  const visita = visitaParaPanel(completa, sesion.permisos);
  // Solo hay acta que editar cuando la visita está completada.
  if (visita.estado !== "COMPLETADA" || !visita.ejecucion) {
    redirect(`/admin/visitas/${encodeURIComponent(visita.folio)}`);
  }

  const [motivos, trabajos, problemas, internos] = await Promise.all([
    listarMotivos(),
    listarTrabajos(),
    listarProblemas(),
    listarInternos(),
  ]);

  return (
    <EditarActa
      visita={visita}
      motivos={motivos}
      catalogoTrabajo={trabajos}
      catalogoProblema={problemas}
      catalogoInterno={internos}
    />
  );
}
