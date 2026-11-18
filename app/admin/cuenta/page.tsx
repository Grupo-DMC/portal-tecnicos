import { redirect } from "next/navigation";
import AdminHeader from "@/components/admin/AdminHeader";
import CuentaView from "@/components/admin/CuentaView";
import type { DatosAvisosCuenta } from "@/components/admin/AvisosCuenta";
import { getSesion } from "@/lib/auth";
import { getPerfil } from "@/lib/data/cuenta";
import { leerConfiguracion } from "@/lib/data/actividad";
import { leerCanales } from "@/lib/data/preferencias-canal";
import { avisosCorreoActivos } from "@/lib/correo/avisos-config";
import { LARGO_MINIMO_PASSWORD } from "@/lib/password";
import { enPanel } from "@/lib/roles";

export const dynamic = "force-dynamic";

/** Mi cuenta: lo que cada persona del panel edita de sí misma. No pide permiso de rol. */
export default async function CuentaPage() {
  const sesion = await getSesion();
  if (!sesion) redirect("/login");
  const perfil = await getPerfil(sesion.usuario.id);
  if (!perfil) redirect("/login");

  // La sección «Avisos» existe solo con los avisos por correo encendidos.
  let avisos: DatosAvisosCuenta | null = null;
  if (enPanel(sesion) && avisosCorreoActivos()) {
    const [config, canales] = await Promise.all([leerConfiguracion(sesion.usuario.id), leerCanales(sesion.usuario.id)]);
    avisos = {
      permisos: sesion.permisos,
      niveles: config.niveles,
      canales: canales.canales,
      ajustes: canales.ajustes,
      email: perfil.email,
    };
  }

  return (
    <>
      <AdminHeader title="Mi cuenta" />
      <CuentaView perfil={perfil} rol={sesion.rolNombre} largoMinimo={LARGO_MINIMO_PASSWORD} avisos={avisos} />
    </>
  );
}
