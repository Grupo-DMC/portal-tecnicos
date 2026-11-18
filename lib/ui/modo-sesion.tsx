"use client";

import { createContext, useContext } from "react";
import type { Modo } from "@/lib/roles";

// En qué panel está trabajando la sesión y a cuáles puede pasar (ver
// lib/roles). Lo pone el layout con lo que resolvió el servidor; los
// componentes solo lo usan para mostrar el botón de cambiar de panel. Que el
// cambio valga lo decide siempre el servidor (cambiarModoAction).

export interface ModoSesion {
  modo: Modo;
  modos: Modo[];
}

const Contexto = createContext<ModoSesion>({ modo: "tecnico", modos: ["tecnico"] });

export function ModoSesionProvider({ valor, children }: { valor: ModoSesion; children: React.ReactNode }) {
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useModoSesion(): ModoSesion {
  return useContext(Contexto);
}

/** El otro panel al que puede pasar, o null si tiene uno solo. */
export function otroModo({ modo, modos }: ModoSesion): Modo | null {
  return modos.find((m) => m !== modo) ?? null;
}
