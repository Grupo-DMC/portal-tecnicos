import { redirect } from "next/navigation";
import { getSesion, inicioDeSesion, rutaSinSesion } from "@/lib/auth";
import { enModoTecnico } from "@/lib/roles";
import { cargarReferenciasTecnico } from "@/lib/data/referencias";
import { ReferenciasProvider } from "@/lib/ui/referencias";
import { UsuarioLocalProvider } from "@/lib/ui/usuario-local";
import { ModoSesionProvider } from "@/lib/ui/modo-sesion";
import VigilanteSesion from "@/components/ui/VigilanteSesion";

export const dynamic = "force-dynamic";

export default async function TecnicoLayout({ children }: { children: React.ReactNode }) {
  const sesion = await getSesion();
  if (!sesion) redirect(await rutaSinSesion());
  // Solo en modo técnico. Quien tiene los dos roles y está en el panel entra
  // aquí con «Ir al panel de técnico», no escribiendo la dirección.
  if (!enModoTecnico(sesion)) redirect(inicioDeSesion(sesion));

  // Clientes, sucursales y catálogos: los usa "Agregar visita" desde el celular.
  const referencias = await cargarReferenciasTecnico(sesion.permisos);

  return (
    <UsuarioLocalProvider usuarioId={sesion.usuario.id}>
      <ModoSesionProvider valor={{ modo: sesion.modo, modos: sesion.modos }}>
        <ReferenciasProvider valor={referencias}>
          <VigilanteSesion />
          {children}
        </ReferenciasProvider>
      </ModoSesionProvider>
    </UsuarioLocalProvider>
  );
}
