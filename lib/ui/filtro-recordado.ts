"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

// Un filtro (o una búsqueda) que sobrevive a salir de la pantalla y volver.
//
// Abrir una ficha o un acta desmonta la lista, y su estado local se pierde:
// al volver, el filtro estaba en blanco. Acá el valor se guarda en la pestaña
// (sessionStorage), por pantalla, y se recupera al volver a montarla. Al cerrar
// la pestaña se olvida, así nadie arranca el día con un filtro de ayer.

const PREFIJO = "filtro:";

function leer(clave: string): string | null {
  try {
    return window.sessionStorage.getItem(clave);
  } catch {
    return null;
  }
}

function escribir(clave: string, valor: string, vacio: string) {
  try {
    if (valor === vacio) window.sessionStorage.removeItem(clave);
    else window.sessionStorage.setItem(clave, valor);
  } catch {
    // Sin almacenamiento (modo privado): el filtro funciona igual, sin recordarse.
  }
}

/**
 * Como `useState<string>`, pero recordado por pantalla. `inicial` es el valor
 * por defecto; si viene distinto de `vacio` (ej. «Ver locales» desde Clientes
 * abre filtrado) manda sobre lo guardado.
 */
export function useFiltroRecordado(
  nombre: string,
  inicial = ""
): [string, (v: string | ((prev: string) => string)) => void] {
  const pantalla = usePathname();
  const clave = `${PREFIJO}${pantalla}:${nombre}`;
  const [valor, setValor] = useState(inicial);
  const vistoClave = useRef<string | null>(null);

  // Se lee tras montar (no en el render) para que servidor y cliente coincidan.
  useEffect(() => {
    if (vistoClave.current === clave) return;
    vistoClave.current = clave;
    if (inicial !== "") return;
    const guardado = leer(clave);
    if (guardado !== null) setValor(guardado);
    // `inicial` solo cuenta al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  const cambiar = useCallback(
    (v: string | ((prev: string) => string)) => {
      setValor((prev) => {
        const nuevo = typeof v === "function" ? v(prev) : v;
        escribir(clave, nuevo, "");
        return nuevo;
      });
    },
    [clave]
  );

  return [valor, cambiar];
}

/** La última dirección de la lista de visitas del panel, con sus filtros en la URL. */
const CLAVE_URL_VISITAS = "ultima-url:/admin/visitas";

export function recordarUrlVisitas(url: string) {
  escribir(CLAVE_URL_VISITAS, url, "/admin/visitas");
}

export function urlVisitasRecordada(): string {
  const url = leer(CLAVE_URL_VISITAS);
  return url && url.startsWith("/admin/visitas") ? url : "/admin/visitas";
}
