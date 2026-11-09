import { redirect } from "next/navigation";
import { getSesion } from "@/lib/auth";
import { getVisitasPorTecnico } from "@/lib/data/visitas";
import { hoyISO } from "@/lib/ui/fecha";
import MobileShell from "@/components/mobile/MobileShell";
import PerfilHistorial from "@/components/mobile/PerfilHistorial";
import BotonCerrarSesion from "@/components/mobile/BotonCerrarSesion";

export const dynamic = "force-dynamic";

export default async function PerfilPage() {
  const sesion = await getSesion();
  if (!sesion?.tecnico) redirect("/login");

  const tecnico = sesion.tecnico;
  const visitas = await getVisitasPorTecnico(tecnico.id);
  const iniciales = `${tecnico.nombres.trim().charAt(0)}${tecnico.apellidoPaterno.trim().charAt(0)}`.toUpperCase();
  // Sin fila "Rol": el técnico solo tiene un rol posible y verlo no le aporta.
  const filas: { k: string; v: string }[] = [
    { k: "RUT", v: tecnico.rut },
    { k: "Correo", v: tecnico.email },
    { k: "Teléfono", v: tecnico.telefono ?? "—" },
  ];

  return (
    <MobileShell titulo="Mi cuenta" atrasHref="/tecnico">
      <div className="px-4 pt-[22px] pb-[26px] animate-fade-in">
        <div className="flex items-center gap-3.5">
          <div
            aria-hidden="true"
            className="w-16 h-16 flex-none grid place-items-center bg-[var(--color-text)] text-[var(--color-bg)] font-extrabold text-h2 leading-none tracking-[.02em]"
          >
            {iniciales || "—"}
          </div>
          <div className="min-w-0">
            <h1 className="font-extrabold text-h2 leading-[1.1] tracking-[-.03em] m-0">{tecnico.nombreCompleto}</h1>
            <div className="text-meta text-[var(--color-muted)] mt-1">Técnico en terreno</div>
          </div>
        </div>

        <div className="mt-4.5 border border-[var(--color-divider)] bg-[var(--color-surface-3)] px-3.5">
          {filas.map((f, i) => (
            <div
              key={f.k}
              className={`flex items-baseline gap-3 py-3 ${i > 0 ? "border-t border-black/[.15]" : ""}`}
            >
              <div className="text-cap opacity-62 w-[78px] flex-none">{f.k}</div>
              <div className="text-ui min-w-0 tabular-nums">{f.v}</div>
            </div>
          ))}
        </div>

        <PerfilHistorial visitas={visitas} hoy={hoyISO()} tecnicoId={tecnico.id} />

        <BotonCerrarSesion />
      </div>
    </MobileShell>
  );
}
