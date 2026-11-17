"use client";

import { useRef, type Dispatch, type SetStateAction } from "react";
import { girarFoto, type Giro } from "@/lib/ui/imagen";
import type { FotoForm } from "@/lib/ui/borrador";

/**
 * El giro de las fotos de un acta, para el panel y el celular.
 *
 * Gira la imagen de verdad (ver girarFoto): `src` pasa a ser la imagen girada,
 * que es la que se sube al guardar. Una foto que ya estaba guardada se marca
 * `girada` para que el guardado reemplace a la del servidor en vez de duplicarla.
 *
 * Una foto se gira de a una vez: si se toca dos veces seguidas, la segunda
 * espera, porque partiría de la imagen vieja y se perdería un giro.
 */
export function useGirarFotos(
  fotos: FotoForm[],
  setFotos: Dispatch<SetStateAction<FotoForm[]>>,
  opciones: { alGirar?: (foto: FotoForm) => void; alFallar: () => void }
) {
  const girando = useRef(new Set<number>());

  return async function girar(id: number, sentido: Giro) {
    const foto = fotos.find((f) => f.id === id);
    if (!foto || girando.current.has(id)) return;
    girando.current.add(id);
    try {
      const src = await girarFoto(foto.src, sentido);
      setFotos((prev) => prev.map((f) => (f.id === id ? { ...f, src, girada: f.dbId ? true : undefined } : f)));
      opciones.alGirar?.(foto);
    } catch (err) {
      console.error("[dmc] no se pudo girar la foto:", err);
      opciones.alFallar();
    } finally {
      girando.current.delete(id);
    }
  };
}
