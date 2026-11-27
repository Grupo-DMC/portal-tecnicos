"use client";

// «Agendar visita» de la ficha de sucursal (#sdVisit de la demo): abre «Nueva
// visita a <sucursal>» con la tienda, el motivo según su plan de calibración y
// el primer contacto de la tienda en «Contacto en tienda».

import { useState } from "react";
import { useRouter } from "next/navigation";
import NuevaVisitaHoja, { motivoDeSucursal } from "@/components/admin/NuevaVisitaHoja";
import { Toast, useToast } from "@/components/ui/Toast";
import { useReferencias } from "@/lib/ui/referencias";

export default function AgendarVisitaSucursal({
  sucursalId,
  nombre,
  conPlan,
  contacto,
}: {
  sucursalId: number;
  nombre: string;
  /** Tiene plan de calibración (propio o del cliente). */
  conPlan: boolean;
  contacto: { nombre: string; cargo: string | null } | null;
}) {
  const ref = useReferencias();
  const router = useRouter();
  const { toast, aviso } = useToast();
  const [abierta, setAbierta] = useState(false);

  return (
    <>
      <button className="btn-pri" type="button" onClick={() => setAbierta(true)}>
        <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="5" width="16" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M4 10h16" />
        </svg>
        Agendar visita
      </button>
      {abierta ? (
        <NuevaVisitaHoja
          precarga={{
            sucursalId,
            motivos: motivoDeSucursal(ref.motivos.filter((m) => m.activo !== false), conPlan),
            titulo: `Nueva visita a ${nombre}`,
            contacto,
          }}
          onCerrar={() => setAbierta(false)}
          onAviso={aviso}
          onHecho={(m) => {
            aviso(m);
            router.refresh();
          }}
        />
      ) : null}
      <Toast texto={toast} variante="panel" />
    </>
  );
}
