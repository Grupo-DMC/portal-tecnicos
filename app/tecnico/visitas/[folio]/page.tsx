import { notFound, redirect } from "next/navigation";
import { getSesion } from "@/lib/auth";
import { getVisitaCompletaPorFolio } from "@/lib/data/visitas";
import { visitaParaTecnico } from "@/lib/data/visita-reducida";
import { getHistorialLocal } from "@/lib/data/historial";
import MobileShell from "@/components/mobile/MobileShell";
import DetalleVisita from "@/components/mobile/DetalleVisita";
import { participaEnVisita } from "@/lib/ui/estado";
import { estadoDeReserva, plazoReservaSeg } from "@/lib/data/reservas";

export const dynamic = "force-dynamic";

export default async function DetalleVisitaPage({ params }: { params: Promise<{ folio: string }> }) {
  const { folio: folioParam } = await params;
  const folio = decodeURIComponent(folioParam);
  const sesion = await getSesion();
  if (!sesion?.tecnico) redirect("/login");

  const completa = await getVisitaCompletaPorFolio(folio);
  if (!completa || !participaEnVisita(completa, sesion.tecnico.id)) notFound();
  const visita = visitaParaTecnico(completa, sesion.tecnico.id);
  const esAyudante = visita.tecnicoAyudanteId === sesion.tecnico.id;

  const historial = await getHistorialLocal(visita.sucursalId, visita.id);
  // El otro técnico tiene el acta reservada: acá se mira, no se abre.
  const reserva =
    visita.estado === "PROGRAMADA" || visita.estado === "EN_CURSO"
      ? await estadoDeReserva(visita.id, sesion.tecnico.id)
      : null;

  return (
    <MobileShell titulo="Visita" volverHref="/tecnico/visitas">
      <DetalleVisita
        visita={visita}
        historial={historial}
        esAyudante={esAyudante}
        tecnicoId={sesion.tecnico.id}
        reservaAjena={reserva?.estado === "ajena" ? reserva : null}
        reservaPlazoSeg={plazoReservaSeg()}
      />
    </MobileShell>
  );
}
