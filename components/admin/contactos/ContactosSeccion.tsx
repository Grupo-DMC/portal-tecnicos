"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ContactoDialogo from "@/components/admin/contactos/ContactoDialogo";
import Confirmar, { type ConfirmarCfg } from "@/components/ui/Confirmar";
import Tag from "@/components/Tag";
import { quitarCargoContactoAction } from "@/app/actions/contactos";
import { puede, useReferencias } from "@/lib/ui/referencias";
import type { CargoContacto, Contacto } from "@/lib/ui/contactos";

/** Una línea de la lista: un contacto, el cargo por el que figura y de dónde viene. */
export interface FilaContacto {
  contactoId: number;
  /** El cargo por el que figura. Con id, se puede quitar de esta ficha. */
  cargoId: number | null;
  cargo: string;
  /** «Propio de la sucursal», «Heredado de la marca Volcom», «Marca Volcom»… */
  origen: string;
  heredado: boolean;
  /** Si este cargo es de la ficha (y no heredado): se ofrece «Quitar». */
  quitable?: boolean;
}

/**
 * Los contactos de una ficha (sucursal o cliente), con el botón para agregar
 * uno nuevo, el de editarlo y el de quitarlo de la ficha. `contactos` trae a
 * cada contacto con todos sus cargos, para editarlo entero aunque aquí figure
 * por uno solo. Sin `cargoInicial` la sección es de solo consulta para altas
 * (los heredados se agregan en la ficha de donde vienen).
 */
export default function ContactosSeccion({
  titulo,
  vacio,
  nota,
  filas,
  contactos,
  cargoInicial,
}: {
  titulo: string;
  vacio: string;
  /** Una línea bajo el título que explica qué entra en esta lista. */
  nota?: string;
  filas: FilaContacto[];
  contactos: Contacto[];
  /** El alcance con que arranca un contacto nuevo: la sucursal o el cliente de la ficha. */
  cargoInicial?: Pick<CargoContacto, "alcanceTipo" | "alcanceId" | "alcanceTexto">;
}) {
  const ref = useReferencias();
  const router = useRouter();
  const [dialogo, setDialogo] = useState<{ contacto: Contacto | null } | null>(null);
  const [confirmar, setConfirmar] = useState<ConfirmarCfg | null>(null);
  const [error, setError] = useState<string | null>(null);
  const porId = new Map(contactos.map((c) => [c.id, c]));
  const puedeEditar = puede(ref, "contactos.editar");

  function pedirQuitar(c: Contacto, f: FilaContacto) {
    if (f.cargoId === null) return;
    const cargoId = f.cargoId;
    const otros = c.cargos.length - 1;
    setConfirmar({
      titulo: `¿Quitar a ${c.nombre} de esta ficha?`,
      texto:
        otros > 0
          ? `Deja de figurar aquí como «${f.cargo}». Sus otros ${otros === 1 ? "cargo sigue" : `${otros} cargos siguen`} como están.`
          : `Deja de figurar aquí como «${f.cargo}». El contacto no se borra: queda en Contactos, sin cargos, por si se lo vuelve a necesitar.`,
      cta: "Quitar",
      accion: async () => {
        setError(null);
        const res = await quitarCargoContactoAction(c.id, cargoId);
        if (!res.ok) return setError(res.error ?? "No se pudo quitar.");
        router.refresh();
      },
    });
  }

  return (
    <div className="p-4 md:p-6 border-b border-[var(--color-line)]">
      <div className="flex items-center gap-2.5 flex-wrap">
        <h2 className="font-semibold text-lead m-0">{titulo}</h2>
        <span className="text-cap opacity-60">{filas.length}</span>
        {cargoInicial && puede(ref, "contactos.crear") ? (
          <button type="button" className="btn btn-secondary ml-auto" onClick={() => setDialogo({ contacto: null })}>
            Agregar contacto
          </button>
        ) : null}
      </div>
      {nota ? <p className="mt-1 mb-0 text-cap opacity-62">{nota}</p> : null}

      {filas.length === 0 ? (
        <p className="mt-3 mb-0 text-meta opacity-62">{vacio}</p>
      ) : (
        <ul className="list-none m-0 mt-2 p-0">
          {filas.map((f, i) => {
            const c = porId.get(f.contactoId);
            if (!c) return null;
            return (
              <li key={`${f.contactoId}-${f.cargoId ?? i}`} className="flex items-start gap-3 py-2.5 border-b border-[var(--color-line)]">
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-ui">
                    {c.nombre} <span className="font-normal opacity-72">· {f.cargo}</span>
                  </div>
                  <div className="text-cap opacity-72 mt-0.5 break-words">
                    {[c.email, c.telefono].filter(Boolean).join(" · ") || "Sin datos de contacto"}
                  </div>
                  <div className="mt-1">
                    <Tag variant={f.heredado ? "outline" : "accent"}>{f.origen}</Tag>
                  </div>
                </div>
                {puedeEditar ? (
                  <div className="flex-none flex gap-1">
                    <button type="button" className="btn btn-ghost" onClick={() => setDialogo({ contacto: c })}>
                      Editar
                    </button>
                    {f.quitable && f.cargoId !== null ? (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        aria-label={`Quitar a ${c.nombre} de esta ficha`}
                        onClick={() => pedirQuitar(c, f)}
                      >
                        Quitar
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {error ? (
        <p role="alert" className="mt-3 mb-0 text-meta font-semibold text-[var(--color-danger-800)]">
          {error}
        </p>
      ) : null}

      {dialogo ? (
        <ContactoDialogo contacto={dialogo.contacto} cargoInicial={cargoInicial} onCerrar={() => setDialogo(null)} />
      ) : null}
      {confirmar ? <Confirmar cfg={confirmar} onCerrar={() => setConfirmar(null)} /> : null}
    </div>
  );
}
