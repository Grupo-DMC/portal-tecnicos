import PendientesView from "@/components/admin/PendientesView";
import { getPendientes } from "@/lib/data/pendientes";
import SinAcceso from "@/components/admin/SinAcceso";
import { sesionCon } from "@/lib/auth";
import { visitaParaPanel } from "@/lib/data/visita-reducida";

export const dynamic = "force-dynamic";

export default async function ReagendasPage() {
  const sesion = await sesionCon("reagendas.ver");
  if (!sesion) return <SinAcceso />;
  const datos = await getPendientes();
  const pendientes = datos.pendientes.map((p) => ({ ...p, visita: visitaParaPanel(p.visita, sesion.permisos) }));
  return <PendientesView datos={{ ...datos, pendientes }} />;
}
