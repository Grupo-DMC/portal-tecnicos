import { notFound, redirect } from "next/navigation";
import { getSesion } from "@/lib/auth";
import { getVisitaCompletaPorFolio } from "@/lib/data/visitas";
import { visitaParaTecnico } from "@/lib/data/visita-reducida";
import { listarProblemas, listarTrabajos } from "@/lib/data/catalogos";
import MobileShell from "@/components/mobile/MobileShell";
import ActaGuardada from "@/components/mobile/ActaGuardada";
import { participaEnVisita } from "@/lib/ui/estado";

export const dynamic = "force-dynamic";

export default async function RevisarActaPage({ params }: { params: Promise<{ folio: string }> }) {
  const { folio: folioParam } = await params;
  const folio = decodeURIComponent(folioParam);
  const sesion = await getSesion();
  if (!sesion?.tecnico) redirect("/login");

  const completa = await getVisitaCompletaPorFolio(folio);
  if (!completa || !participaEnVisita(completa, sesion.tecnico.id)) notFound();
  const visita = visitaParaTecnico(completa, sesion.tecnico.id);

  const [catalogoTrabajos, catalogoProblemas] = await Promise.all([listarTrabajos(), listarProblemas()]);

  return (
    <MobileShell titulo="Acta guardada" volverHref={`/tecnico/visitas/${visita.folio}`}>
      <ActaGuardada visita={visita} catalogoTrabajos={catalogoTrabajos} catalogoProblemas={catalogoProblemas} />
    </MobileShell>
  );
}
