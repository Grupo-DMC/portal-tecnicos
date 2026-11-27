import { redirect } from "next/navigation";
import { getSesion, inicioDeSesion, rutaSinSesion } from "@/lib/auth";
import { enPanel } from "@/lib/roles";
import { cargarReferencias } from "@/lib/data/referencias";
import { contarMenu } from "@/lib/data/queries";
import { getPerfil } from "@/lib/data/cuenta";
import { nombreVisible, urlFotoUsuario } from "@/lib/ui/cuenta";
import { UsuarioLocalProvider } from "@/lib/ui/usuario-local";
import { ReferenciasProvider } from "@/lib/ui/referencias";
import AdminSidebar, { type NavItem } from "@/components/admin/AdminSidebar";
import VigilanteSesion from "@/components/ui/VigilanteSesion";
import { tiene } from "@/lib/permisos";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sesion = await getSesion();
  if (!sesion) redirect(await rutaSinSesion());
  // Un técnico puro, o quien está trabajando como técnico, va a su panel.
  if (!enPanel(sesion)) redirect(inicioDeSesion(sesion));

  const [referencias, conteos, perfil] = await Promise.all([
    cargarReferencias(sesion.permisos),
    contarMenu(),
    getPerfil(sesion.usuario.id),
  ]);

  // El nombre y la foto que la persona puso en Mi cuenta; sin nombre, el del correo.
  const nombreCoordinador = nombreVisible(perfil?.nombre, sesion.usuario.email);
  const fotoCoordinador = urlFotoUsuario(sesion.usuario.id, perfil?.fotoVersion ?? null);

  // El menú solo ofrece los módulos que el rol puede abrir.
  // Usuarios aloja también la pestaña Técnicos: se ofrece con cualquiera de los dos permisos.
  const visible = (item: { href: string }) =>
    item.href === "/admin/usuarios"
      ? tiene(sesion.permisos, "usuarios.ver") || tiene(sesion.permisos, "tecnicos.ver")
      : tiene(sesion.permisos, `${item.href === "/admin" ? "panel" : item.href.split("/")[2]}.ver`);

  return (
    <UsuarioLocalProvider usuarioId={sesion.usuario.id}>
    <ReferenciasProvider valor={referencias}>
      <VigilanteSesion />
      {/* Como `.app` de la demo: hasta 1024 px el menú es un cajón que se abre desde la
          barra de arriba (ver AdminSidebar); desde ahí es la columna fija de 272 px. */}
      <div className="dmc-marco">
        <AdminSidebar
          nombre={nombreCoordinador}
          foto={fotoCoordinador}
          rol={sesion.rolNombre}
          usuarioId={sesion.usuario.id}
          permisos={sesion.permisos}
          modos={sesion.modos}
          operacion={([
            { href: "/admin", label: "Panel", icono: "panel", n: "" },
            { href: "/admin/visitas", label: "Visitas", icono: "visitas", n: conteos.visitas },
            { href: "/admin/problemas", label: "Problemas", icono: "problemas", n: conteos.problemasAbiertos, alerta: true },
          ] satisfies NavItem[]).filter(visible)}
          maestros={([
            // "Técnicos" y "Contraseñas pedidas" viven dentro de Usuarios; lo pendiente se avisa ahí y en la campanita.
            { href: "/admin/usuarios", label: "Usuarios", icono: "usuarios", n: conteos.usuarios },
            { href: "/admin/clientes", label: "Clientes", icono: "clientes", n: referencias.clientes.length },
            { href: "/admin/malls", label: "Malls", icono: "malls", n: referencias.malls.length },
            { href: "/admin/sucursales", label: "Sucursales", icono: "sucursales", n: referencias.sucursales.length },
            {
              href: "/admin/checklist",
              label: "Checklist",
              icono: "checklist",
              n: referencias.motivos.length + referencias.problemas.length + referencias.trabajos.length,
            },
          ] satisfies NavItem[]).filter(visible)}
        />
        <div className="dmc contenido">
          {children}
          <p className="foot">Grupo DMC, Ideas Tecnológicas de Seguridad.</p>
        </div>
      </div>
    </ReferenciasProvider>
    </UsuarioLocalProvider>
  );
}
