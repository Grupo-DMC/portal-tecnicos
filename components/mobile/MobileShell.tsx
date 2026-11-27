"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { Toast, useToast } from "@/components/ui/Toast";
import { prepararSalida } from "@/lib/ui/salir";
import { useUsuarioLocal } from "@/lib/ui/usuario-local";
import { useModoSesion } from "@/lib/ui/modo-sesion";
import CambiarPanel from "@/components/ui/CambiarPanel";
import Icono, { type NombreIcono } from "@/components/ui/Icono";

const TABS: { href: string; label: string; icono: NombreIcono }[] = [
  { href: "/tecnico", label: "Inicio", icono: "inicio" },
  { href: "/tecnico/visitas", label: "Visitas", icono: "visitas" },
  { href: "/tecnico/perfil", label: "Cuenta", icono: "cuenta" },
];

export default function MobileShell({
  titulo,
  children,
  volverHref,
  atrasHref,
}: {
  titulo: string;
  children: React.ReactNode;
  /** Si se define, muestra el botón volver apuntando a esta ruta y oculta los tabs. */
  volverHref?: string;
  /** Muestra el botón volver pero deja los tabs: para las secciones principales. */
  atrasHref?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast, aviso } = useToast();
  const uid = useUsuarioLocal();
  const [saliendo, setSaliendo] = useState(false);
  const mostrarTabs = !volverHref;
  // Quien también tiene el panel de admin ve siempre en qué panel está y cómo volver.
  const puedePanel = useModoSesion().modos.includes("panel");
  const flecha = volverHref ?? atrasHref;

  const enlaces = (clase: string) => (
    <nav className={`tp-tabs ${clase}`} aria-label="Panel de técnico">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} aria-current={pathname === t.href ? "page" : undefined}>
          <Icono nombre={t.icono} />
          <span>{t.label}</span>
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="dmc dmc-caja">
     <div className={mostrarTabs ? "tp con-tabs" : "tp"}>
      <div className="tp-top">
        <div className="tp-top-in">
          {flecha ? (
            <button type="button" className="tp-back" onClick={() => router.push(flecha)} aria-label="Volver">
              <Icono nombre="atras" />
            </button>
          ) : null}
          <span className="tp-brand">
            <Image src="/DMC-logo.png" alt="Grupo dMC" width={56} height={24} loading="eager" style={{ width: 56, height: 24 }} />
            <span>{titulo}</span>
          </span>
          {mostrarTabs ? enlaces("tp-tabs-top") : null}
          <div className="tp-top-act">
            {pathname !== "/tecnico" ? (
              <Link href="/tecnico" className="tp-ic" aria-label="Ir al inicio" title="Ir al inicio">
                <Icono nombre="inicio" />
              </Link>
            ) : null}
            <button
              type="button"
              className="tp-ic"
              disabled={saliendo}
              aria-label="Cerrar sesión"
              onClick={() => {
                if (!prepararSalida(uid)) return;
                setSaliendo(true);
                aviso("Sesión cerrada");
                setTimeout(() => {
                  void logoutAction();
                }, 700);
              }}
            >
              <Icono nombre="salir" />
            </button>
          </div>
        </div>
      </div>
      {puedePanel ? (
        <div className="tp-admin">
          <div className="tp-admin-in">
            <span>
              <i aria-hidden="true" />
              Panel de técnico
            </span>
            <CambiarPanel desde="tecnico" destino="panel" variante="franja" />
          </div>
        </div>
      ) : null}

      {/* overflow-wrap:anywhere — una palabra larga (un código, una URL) se
          salía por el costado: así se parte donde haga falta. */}
      <div className="tp-contenido">{children}</div>

      {mostrarTabs ? enlaces("tp-tabs-bot") : null}
      <Toast texto={toast} />
     </div>
    </div>
  );
}
