import Image from "next/image";
import { redirect } from "next/navigation";
import { getSesion, getSesionPorCambiarPassword } from "@/lib/auth";
import { version } from "@/package.json";
import LoginForm from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ expirada?: string }> }) {
  const { expirada } = await searchParams;
  const sesion = await getSesion();
  if (sesion) {
    redirect(sesion.usuario.rol === "TECNICO" ? "/tecnico" : "/admin");
  }
  // Entró con una clave que le puso otra persona: primero tiene que cambiarla.
  if (await getSesionPorCambiarPassword()) redirect("/cambiar-password");

  return (
    <div className="h-screen overflow-hidden flex justify-center bg-[#cac7cd]">
      <div className="w-full max-w-[460px] min-w-0 bg-[var(--color-bg)] flex flex-col min-h-screen overflow-y-auto">
        <div className="flex flex-col min-h-screen px-[22px] pb-7">
          <div className="pt-[52px]">
            <Image src="/DMC-logo.png" alt="Grupo dMC — Ideas tecnológicas de seguridad" width={172} height={73} priority />
          </div>
          <div className="h-0.5 bg-[var(--color-text)] mt-[18px]" />
          <h1 className="font-extrabold text-display leading-[1.04] tracking-[-.03em] mt-[22px] mb-2.5">
            Visitas
            <br />
            en terreno
          </h1>
          <p className="mb-[30px] text-ui opacity-60 max-w-[30ch]">
            Registro de mantención e instalación en tienda. Funciona sin señal: lo que guardes se envía solo.
          </p>

          {expirada ? (
            <div
              role="status"
              className="mb-4 px-3.5 py-3 bg-[var(--color-accent-100)] border border-[var(--color-accent-300)] text-meta text-[var(--color-accent-800)]"
            >
              Tu sesión venció por inactividad. Vuelve a entrar.
            </div>
          ) : null}

          <LoginForm version={version} />

          <div className="mt-auto pt-[34px]">
            <div className="h-px bg-[var(--color-divider-soft)] mb-3" />
            <p className="m-0 text-cap opacity-60">
              En paralelo al formulario en papel hasta el traspaso a DMC_Core.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
