"use client";
import Espera from "@/components/ui/Espera";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { prepararSalida } from "@/lib/ui/salir";
import { useUsuarioLocal } from "@/lib/ui/usuario-local";
import { Toast, useToast } from "@/components/ui/Toast";
import { iniciales } from "@/lib/ui/cuenta";
import Campanita from "@/components/admin/Campanita";
import CambiarPanel from "@/components/ui/CambiarPanel";
import Icono, { type NombreIcono } from "@/components/ui/Icono";
import { ETIQUETA_MODO, type Modo } from "@/lib/roles";

export interface NavItem {
  href: string;
  label: string;
  icono: NombreIcono;
  n: number | string;
  /** El número señala algo por resolver: se pinta en rojo. */
  alerta?: boolean;
}

export default function AdminSidebar({
  operacion,
  maestros,
  nombre,
  foto = null,
  rol,
  usuarioId,
  permisos,
  modos = ["panel"],
}: {
  operacion: NavItem[];
  maestros: NavItem[];
  nombre: string;
  /** URL de la foto de perfil (Mi cuenta), o null para mostrar las iniciales. */
  foto?: string | null;
  rol: string;
  usuarioId: number;
  /** Para la campanita: qué notificaciones puede recibir. */
  permisos: string[];
  /** Los paneles que puede usar. Con el de técnico, aparece el botón para pasar a él. */
  modos?: Modo[];
}) {
  const puedeTecnico = modos.includes("tecnico");
  const pathname = usePathname();
  const { toast, aviso } = useToast();
  const [saliendo, setSaliendo] = useState(false);
  const uid = useUsuarioLocal();
  // Solo cuenta en el celular: ahí el menú es un cajón que se abre y se cierra.
  const [abierto, setAbierto] = useState(false);
  // La campanita es una sola (una sola consulta periódica): en el celular va en
  // la barra de arriba y desde lg en la cabecera del menú.
  const [escritorio, setEscritorio] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1025px)");
    const ver = () => setEscritorio(mq.matches);
    ver();
    mq.addEventListener("change", ver);
    return () => mq.removeEventListener("change", ver);
  }, []);

  // Al elegir una sección el cajón se cierra solo.
  useEffect(() => {
    setAbierto(false);
  }, [pathname]);

  // Esc cierra el cajón.
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [abierto]);

  // Con el cajón abierto no se desplaza la página de atrás.
  useEffect(() => {
    if (!abierto) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previo;
    };
  }, [abierto]);
  const enCuenta = pathname === "/admin/cuenta";

  function NavItemLink({ item }: { item: NavItem }) {
    // "/admin" es la raíz de todo: solo cuenta cuando se está exactamente en el panel.
    const activo = item.href === "/admin" ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
    const n = typeof item.n === "number" ? item.n.toLocaleString("es-CL") : item.n;
    return (
      <li>
        <Link href={item.href} aria-current={activo ? "page" : undefined}>
          <Icono nombre={item.icono} />
          <span>{item.label}</span>
          {n !== "" ? <span className={item.alerta && item.n ? "cnt alert" : "cnt"}>{n}</span> : null}
        </Link>
      </li>
    );
  }

  return (
    <div className="dmc dmc-caja">
      {/* Barra de arriba: solo en el celular. */}
      <header className="mbar">
        <button type="button" onClick={() => setAbierto(true)} aria-label="Abrir el menú" aria-expanded={abierto} className="icon-btn">
          <Icono nombre="menu" />
        </button>
        <Image src="/dmc-logo-menu.png" alt="Grupo DMC" width={79} height={28} loading="eager" style={{ width: 79, height: 28 }} />
        <div className="mbar-fin">{!escritorio ? <Campanita usuarioId={usuarioId} permisos={permisos} variante="barra" /> : null}</div>
      </header>

      {abierto ? <div onClick={() => setAbierto(false)} className="scrim" /> : null}

      <aside className={abierto ? "side open" : "side"} aria-label="Menú del sistema de técnicos">
        <div className="side-head">
          <Image src="/dmc-logo-menu.png" alt="Grupo DMC" width={101} height={36} loading="eager" style={{ width: 101, height: 36 }} />
          <div className="side-actions">
            {escritorio ? <Campanita usuarioId={usuarioId} permisos={permisos} variante="menu" /> : null}
            <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar el menú" className="icon-btn side-close">
              <Icono nombre="cerrar" />
            </button>
          </div>
        </div>
        <p className="side-sys">Sistema de técnicos, Coordinación</p>
        {puedeTecnico ? (
          <div className="side-mode">
            <p>Estás en el {ETIQUETA_MODO.panel.toLowerCase()}</p>
            <CambiarPanel desde="panel" destino="tecnico" variante="menu" />
          </div>
        ) : null}

        <nav className="nav">
          <span className="nav-label" id="nav-operacion">
            Operación
          </span>
          <ul aria-labelledby="nav-operacion">
            {operacion.map((item) => (
              <NavItemLink key={item.href} item={item} />
            ))}
          </ul>
          <span className="nav-label" id="nav-maestros">
            Maestros
          </span>
          <ul aria-labelledby="nav-maestros">
            {maestros.map((item) => (
              <NavItemLink key={item.href} item={item} />
            ))}
          </ul>
        </nav>

        <div className="side-user">
          {/* Quién está en el panel; lleva a Mi cuenta. */}
          <Link href="/admin/cuenta" aria-current={enCuenta ? "page" : undefined} title="Mi cuenta" className="me">
            <span className="av" aria-hidden="true">
              {foto ? (
                // eslint-disable-next-line @next/next/no-img-element -- ruta propia con sesión; next/image no aporta acá
                <img src={foto} alt="" width={36} height={36} />
              ) : (
                iniciales(nombre)
              )}
            </span>
            <span>
              <strong>{nombre}</strong>
              <small>{rol}, Mi cuenta</small>
            </span>
            <Icono nombre="adelante" />
          </Link>
          <button
            type="button"
            className="logout"
            disabled={saliendo}
            onClick={() => {
              prepararSalida(uid);
              // El aviso alcanza a leerse antes de que el redirect cambie de página.
              setSaliendo(true);
              aviso(`Sesión cerrada · ${nombre}`);
              setTimeout(() => {
                void logoutAction();
              }, 700);
            }}
          >
            <Icono nombre="salir" />
            <Espera activo={saliendo} accion="Cerrando sesión">Cerrar sesión</Espera>
          </button>
        </div>
      </aside>

      <Toast texto={toast} variante="panel" />
    </div>
  );
}
