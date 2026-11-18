import { redirect } from "next/navigation";
import VisitasTable from "@/components/admin/VisitasTable";
import { buscarVisitas, contarVisitasEliminadas, lugaresConVisitas } from "@/lib/data/visitas-lista";
import SinAcceso from "@/components/admin/SinAcceso";
import { sesionCon } from "@/lib/auth";
import { visitaParaPanel } from "@/lib/data/visita-reducida";
import { acotarFiltros, ELIMINADAS, leerFiltrosVisitas, urlFiltrosVisitas } from "@/lib/ui/filtros-visitas";
import { esAdmin } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function VisitasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sesion = await sesionCon("visitas.ver");
  if (!sesion) return <SinAcceso />;
  // Las eliminadas solo se le muestran al administrador: a los demás roles ni
  // siquiera se les ofrece la opción, y la URL no las abre.
  const verEliminadas = esAdmin(sesion);
  const pedidos = leerFiltrosVisitas(await searchParams, { verEliminadas });
  const [lugares, eliminadas] = await Promise.all([
    lugaresConVisitas(pedidos.estados.includes(ELIMINADAS)),
    verEliminadas ? contarVisitasEliminadas() : undefined,
  ]);
  // Lo elegido abajo en la cadena que ya no cabe en lo de arriba se descarta, y
  // la URL lo refleja.
  const { opciones, filtros } = acotarFiltros(lugares, pedidos);
  if (urlFiltrosVisitas(filtros) !== urlFiltrosVisitas(pedidos)) redirect(urlFiltrosVisitas(filtros));
  const cruda = await buscarVisitas(filtros);
  const pagina = { ...cruda, visitas: cruda.visitas.map((v) => visitaParaPanel(v, sesion.permisos)) };
  return (
    <VisitasTable
      title="Visitas"
      filtros={{ ...filtros, pagina: pagina.pagina }}
      pagina={pagina}
      opciones={opciones}
      eliminadas={eliminadas}
    />
  );
}
