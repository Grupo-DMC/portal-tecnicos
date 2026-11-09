"use client";

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

interface NavItem {
  href: string;
  label: string;
  n: number | string;
  /** Cuántas cosas están esperando dentro de esa sección. Se pinta en rojo. */
  pendientes?: number;
}

export default function AdminSidebar({
  operacion,
  maestros,
  nombre,
  foto = null,
  rol,
  usuarioId,
  permisos,
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
}) {
  const pathname = usePathname();
  const { toast, aviso } = useToast();
  const [saliendo, setSaliendo] = useState(false);
  const uid = useUsuarioLocal();
  // Solo cuenta en el celular: ahí el menú es un cajón que se abre y se cierra.
  const [abierto, setAbierto] = useState(false);
  const pendientes = [...operacion, ...maestros].reduce((n, item) => n + (item.pendientes ?? 0), 0);
  // La campanita es una sola (una sola consulta periódica): en el celular va en
  // la barra de arriba y desde lg en la cabecera del menú.
  const [escritorio, setEscritorio] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const ver = () => setEscritorio(mq.matches);
    ver();
    mq.addEventListener("change", ver);
    return () => mq.removeEventListener("change", ver);
  }, []);

  // Al elegir una sección el cajón se cierra solo.
  useEffect(() => {
    setAbierto(false);
  }, [pathname]);

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

  function NavButton({ item }: { item: NavItem }) {
    // "/admin" es la raíz de todo: solo cuenta cuando se está exactamente en el panel.
    const activo = item.href === "/admin" ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
    return (
      <Link
        href={item.href}
        aria-current={activo ? "page" : undefined}
        className={`w-full flex items-center gap-2.5 min-h-11 px-5 font-extrabold text-ui ${
          activo
            ? "bg-[var(--color-accent-200)] text-[var(--color-accent-800)]"
            : "text-[var(--color-neutral-800)] hover:bg-[rgba(31,28,33,.05)] hover:text-[var(--color-text)]"
        }`}
      >
        <span>{item.label}</span>
        {item.pendientes ? (
          <span
            className="ml-auto min-w-[20px] h-5 px-1.5 grid place-items-center bg-[var(--color-danger)] text-white text-cap num"
            title={`${item.pendientes} sin atender`}
          >
            {item.pendientes}
          </span>
        ) : null}
        <span className={`${item.pendientes ? "" : "ml-auto"} num text-cap tabular-nums opacity-66`}>{item.n}</span>
      </Link>
    );
  }

  return (
    <>
      {/* Barra de arriba: solo en el celular. */}
      <div className="lg:hidden sticky top-0 z-30 flex items-center gap-3 h-14 px-4 bg-[var(--color-bg)] border-b-2 border-[var(--color-divider)]">
        <button
          type="button"
          onClick={() => setAbierto(true)}
          aria-label="Abrir el menú"
          aria-expanded={abierto}
          className="btn btn-icon relative w-10 h-10 border border-black/[.3]"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
          {pendientes ? (
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 grid place-items-center bg-[var(--color-accent)] text-[var(--color-bg)] text-cap tabular-nums">
              {pendientes}
            </span>
          ) : null}
        </button>
        <Image src="/DMC-logo.png" alt="Grupo dMC" width={75} height={32} />
        <div className="ml-auto text-cap opacity-62 truncate">{rol}</div>
        {!escritorio ? <Campanita usuarioId={usuarioId} permisos={permisos} variante="barra" /> : null}
      </div>

      {abierto ? (
        <div onClick={() => setAbierto(false)} className="lg:hidden fixed inset-0 z-40 bg-[rgba(31,28,33,.5)]" />
      ) : null}

      <div
        className={`flex flex-col bg-[var(--color-bg)] border-r-2 border-[var(--color-divider)] fixed top-0 bottom-0 left-0 z-50 w-[min(290px,86vw)] transition-transform duration-200 ${
          abierto ? "translate-x-0" : "-translate-x-full"
        } lg:sticky lg:z-auto lg:w-auto lg:h-screen lg:translate-x-0 lg:transition-none`}
      >
      <div className="relative px-5 pt-[22px] pb-[18px] border-b-2 border-[var(--color-divider)]">
        <button
          type="button"
          onClick={() => setAbierto(false)}
          aria-label="Cerrar el menú"
          className="btn btn-icon lg:hidden absolute top-3 right-3"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        {escritorio ? (
          <div className="absolute top-4 right-4">
            <Campanita usuarioId={usuarioId} permisos={permisos} variante="menu" />
          </div>
        ) : null}
        <Image src="/DMC-logo.png" alt="Grupo dMC" width={124} height={53} />
        <div className="text-cap opacity-62 mt-3">
          Sistema de técnicos · Coordinación
        </div>
      </div>

      <div className="pt-[18px] flex-1 overflow-y-auto">
        <div className="text-cap opacity-60 px-5 pb-2">Operación</div>
        {operacion.map((item) => (
          <NavButton key={item.href} item={item} />
        ))}

        <div className="text-cap opacity-60 px-5 pt-[22px] pb-2">Maestros</div>
        {maestros.map((item) => (
          <NavButton key={item.href} item={item} />
        ))}
      </div>

      {/* Quién está en el panel; lleva a Mi cuenta. */}
      <Link
        href="/admin/cuenta"
        aria-current={enCuenta ? "page" : undefined}
        title="Mi cuenta"
        className={`border-t-2 border-[var(--color-divider)] px-5 pt-3.5 pb-3 flex items-center gap-2.5 ${
          enCuenta ? "bg-[var(--color-accent-200)] text-[var(--color-accent-800)]" : "hover:bg-[rgba(31,28,33,.05)]"
        }`}
      >
        <div className="w-[34px] h-[34px] shrink-0 bg-[var(--color-text)] text-[var(--color-bg)] grid place-items-center font-extrabold text-meta overflow-hidden">
          {foto ? (
            // eslint-disable-next-line @next/next/no-img-element -- ruta propia con sesión; next/image no aporta acá
            <img src={foto} alt="" width={34} height={34} className="w-full h-full object-cover" />
          ) : (
            iniciales(nombre)
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-extrabold text-meta whitespace-nowrap overflow-hidden text-ellipsis">{nombre}</div>
          <div className="text-cap opacity-62">{rol} · Mi cuenta</div>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="shrink-0 opacity-50" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </Link>
      <div className="px-4 pb-4">
        <button
          type="button"
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
          className="w-full min-h-[42px] flex items-center gap-2.5 px-3 bg-transparent border border-[var(--color-accent)] text-[var(--color-accent-active)] font-extrabold text-meta cursor-pointer text-left hover:bg-[var(--color-accent-100)] disabled:opacity-60"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M15 17l5-5-5-5M20 12H9M12 4H5v16h7" />
          </svg>
          <span>{saliendo ? "Cerrando sesión…" : "Cerrar sesión"}</span>
        </button>
      </div>

      </div>

      <Toast texto={toast} variante="panel" />
    </>
  );
}
