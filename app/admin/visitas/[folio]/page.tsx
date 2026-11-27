import { notFound } from "next/navigation";
import {
  correosConocidos,
  getActaEnviada,
  getVisitaCompletaPorFolio,
  getVisitaEliminadaPorFolio,
} from "@/lib/data/visitas";
import { contactosCandidatos } from "@/lib/data/contactos";
import { configCorreo, partesRemitente, remitenteDe } from "@/lib/correo/proveedor";
import ActaView, { type DatosCorreo } from "@/components/admin/ActaView";
import SinAcceso from "@/components/admin/SinAcceso";
import { sesionCon } from "@/lib/auth";
import { tiene } from "@/lib/permisos";
import { visitaParaPanel } from "@/lib/data/visita-reducida";
import { contactosDeTienda } from "@/lib/ui/contactos";
import { sugerenciasDeCorreo } from "@/lib/ui/correo";
import { esAdmin } from "@/lib/roles";

export const dynamic = "force-dynamic";
// Enviar el acta con el zip de videos lee hasta 28 MB de la base y los sube al
// proveedor de correo: la acción corre en esta página y necesita más que los
// 10 s por defecto.
export const maxDuration = 60;

export default async function ActaPage({ params }: { params: Promise<{ folio: string }> }) {
  const sesion = await sesionCon("visitas.ver");
  if (!sesion) return <SinAcceso />;
  const { folio: folioParam } = await params;
  const folio = decodeURIComponent(folioParam);
  // Una eliminada solo la abre el administrador; para el resto, no existe.
  const visita =
    (await getVisitaCompletaPorFolio(folio)) ??
    (esAdmin(sesion) ? await getVisitaEliminadaPorFolio(folio) : undefined);
  if (!visita) notFound();
  const paraPanel = visitaParaPanel(visita, sesion.permisos);

  // Lo del correo solo se busca para quien puede enviarlo.
  let correo: DatosCorreo | undefined;
  const s = visita.sucursal;
  if (visita.estado === "COMPLETADA" && !visita.eliminacion && tiene(sesion.permisos, "visitas.enviar")) {
    const tienda = s ? { id: s.id, clienteId: s.clienteId, marcaId: s.marcaId, region: s.region } : null;
    const [candidatos, conocidos] = await Promise.all([
      tienda ? contactosCandidatos(tienda) : Promise.resolve([]),
      correosConocidos(visita.sucursalId, visita.clienteId),
    ]);
    const aplicables = tienda ? contactosDeTienda(candidatos, tienda) : [];
    const config = configCorreo();
    const remitente = config ? remitenteDe(sesion.usuario.email, config) : null;
    correo = {
      listo: Boolean(config),
      de: remitente
        ? remitente.conSuCorreo
          ? sesion.usuario.email
          : partesRemitente(config!.remitente).correo
        : sesion.usuario.email,
      conSuCorreo: remitente?.conSuCorreo ?? true,
      responderA: sesion.usuario.email,
      sugeridos: sugerenciasDeCorreo(aplicables, conocidos, [sesion.usuario.email]),
    };
  }

  return (
    <ActaView visita={paraPanel} enviada={await getActaEnviada(visita.folio)} correo={correo} puedeVerRut={esAdmin(sesion)} />
  );
}
