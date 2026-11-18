"use server";

import { revalidatePath } from "next/cache";
import { sesionCon } from "@/lib/auth";
import { AlcanceInexistente, guardarContacto, quitarCargoDeContacto, type DatosContacto } from "@/lib/data/contactos";
import { log } from "@/lib/log";
import { registrarActividad } from "@/lib/data/actividad";
import { problemaDeCargos } from "@/lib/ui/contactos";
import { problemaDeBaja } from "@/lib/ui/estado-activo";
import { mensajeCorreo } from "@/lib/ui/formato";
import { validar } from "@/lib/validacion/comun";
import { entradaContacto, entradaQuitarCargo } from "@/lib/validacion/contactos";

// Altas y ediciones de contactos. Los cargos viajan dentro del mismo objeto
// (son pocos y chicos): un argumento suelto grande reventaría el tope de 1 MB.

export interface ResultadoContacto {
  ok: boolean;
  error?: string;
  id?: number;
}

export async function guardarContactoAction(idPedido: number | null, datosPedidos: DatosContacto): Promise<ResultadoContacto> {
  const sesion = await sesionCon(`contactos.${idPedido === null ? "crear" : "editar"}`);
  if (!sesion) {
    return { ok: false, error: "No tienes permiso para editar contactos." };
  }
  const entrada = validar(entradaContacto, { id: idPedido, datos: datosPedidos }, "guardarContacto");
  if (!entrada.ok) return { ok: false, error: entrada.error };
  const { id, datos } = entrada.datos;
  if (!datos.nombre.trim()) return { ok: false, error: "El nombre del contacto es obligatorio." };
  const errorEmail = mensajeCorreo(datos.email);
  if (errorEmail) return { ok: false, error: errorEmail };
  const fallo = problemaDeCargos(datos.cargos);
  if (fallo) return { ok: false, error: fallo };
  // Un contacto no queda inactivo sin que conste por qué (la base lo exige igual).
  const sinMotivo = problemaDeBaja(datos.activo, datos.motivoInactivo, "el contacto");
  if (sinMotivo) return { ok: false, error: sinMotivo };

  try {
    const guardado = await guardarContacto(
      id,
      {
        ...datos,
        nombre: datos.nombre.trim(),
        email: datos.email?.trim() || null,
        telefono: datos.telefono?.trim() || null,
      },
      { id: sesion.usuario.id, email: sesion.usuario.email }
    );
    await registrarActividad(sesion, {
      tipo: "maestro.contactos",
      texto: `${id === null ? "creó" : "editó"} el contacto`,
      detalle: datos.nombre.trim(),
      enlace: "/admin/contactos",
    });
    revalidatePath("/admin", "layout");
    return { ok: true, id: guardado };
  } catch (err) {
    if (err instanceof AlcanceInexistente) {
      return { ok: false, error: `Un ${err.cual} elegido ya no existe. Recarga la página.` };
    }
    log.error("guardarContacto", { err });
    return { ok: false, error: "No se pudo guardar. Revisa los datos e inténtalo otra vez." };
  }
}

/**
 * Quita a un contacto de una ficha (cliente, marca o sucursal) borrando ese
 * cargo. El contacto no se borra: sigue en Contactos con sus otros cargos, y
 * si ya no se lo necesita se desactiva allí, con su motivo.
 */
export async function quitarCargoContactoAction(contactoPedido: number, cargoPedido: number): Promise<ResultadoContacto> {
  const sesion = await sesionCon("contactos.editar");
  if (!sesion) return { ok: false, error: "No tienes permiso para editar contactos." };
  const entrada = validar(entradaQuitarCargo, { contactoId: contactoPedido, cargoId: cargoPedido }, "quitarCargoContacto");
  if (!entrada.ok) return { ok: false, error: entrada.error };
  const { contactoId, cargoId } = entrada.datos;
  try {
    const quitado = await quitarCargoDeContacto(contactoId, cargoId);
    if (!quitado) return { ok: false, error: "Ese contacto ya no estaba en esta ficha. Recarga la página." };
    await registrarActividad(sesion, {
      tipo: "maestro.contactos",
      texto: "quitó un cargo del contacto",
      detalle: `Contacto ${contactoId}`,
      enlace: "/admin/contactos",
    });
    revalidatePath("/admin", "layout");
    return { ok: true, id: contactoId };
  } catch (err) {
    log.error("quitarCargoContacto", { err });
    return { ok: false, error: "No se pudo quitar. Inténtalo otra vez." };
  }
}
