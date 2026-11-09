import { redirect } from "next/navigation";
import AdminHeader from "@/components/admin/AdminHeader";
import CuentaView from "@/components/admin/CuentaView";
import { getSesion } from "@/lib/auth";
import { getPerfil } from "@/lib/data/cuenta";
import { LARGO_MINIMO_PASSWORD } from "@/lib/password";

export const dynamic = "force-dynamic";

/** Mi cuenta: lo que cada persona del panel edita de sí misma. No pide permiso de rol. */
export default async function CuentaPage() {
  const sesion = await getSesion();
  if (!sesion) redirect("/login");
  const perfil = await getPerfil(sesion.usuario.id);
  if (!perfil) redirect("/login");

  return (
    <>
      <AdminHeader title="Mi cuenta" />
      <CuentaView perfil={perfil} rol={sesion.rolNombre} largoMinimo={LARGO_MINIMO_PASSWORD} />
    </>
  );
}
