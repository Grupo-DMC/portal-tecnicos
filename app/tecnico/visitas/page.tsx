import { redirect } from "next/navigation";
import { getSesion } from "@/lib/auth";
import { getVisitasPorTecnico } from "@/lib/data/visitas";
import { visitaParaTecnico } from "@/lib/data/visita-reducida";
import { hoyISO } from "@/lib/ui/fecha";
import MobileShell from "@/components/mobile/MobileShell";
import VisitasList from "@/components/mobile/VisitasList";

export const dynamic = "force-dynamic";

export default async function VisitasTecnicoPage() {
  const sesion = await getSesion();
  if (!sesion?.tecnico) redirect("/login");

  const tecnicoId = sesion.tecnico.id;
  const visitas = (await getVisitasPorTecnico(tecnicoId)).map((v) => visitaParaTecnico(v, tecnicoId));

  return (
    <MobileShell titulo="Mis visitas" atrasHref="/tecnico">
      <VisitasList visitas={visitas} hoy={hoyISO()} tecnicoId={sesion.tecnico.id} />
    </MobileShell>
  );
}
