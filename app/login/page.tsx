import { redirect } from "next/navigation";
import { getSesion, getSesionPorCambiarPassword, inicioDeSesion } from "@/lib/auth";
import { version } from "@/package.json";
import BrandPanel from "./BrandPanel";
import LoginForm from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ expirada?: string }> }) {
  const { expirada } = await searchParams;
  const sesion = await getSesion();
  if (sesion) {
    redirect(inicioDeSesion(sesion));
  }
  // Entró con una clave que le puso otra persona: primero tiene que cambiarla.
  if (await getSesionPorCambiarPassword()) redirect("/cambiar-password");

  return (
    <div className="lg">
      <BrandPanel />
      <main className="panel">
        <div className="stage">
          <LoginForm version={version} expirada={!!expirada} />
        </div>
        <footer className="panel-foot">
          <span>© {new Date().getFullYear()} Grupo DMC · Ideas Tecnológicas de Seguridad</span>
        </footer>
      </main>
    </div>
  );
}
