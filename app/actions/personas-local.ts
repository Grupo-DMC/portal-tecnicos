"use server";

import { getSesion } from "@/lib/auth";
import { contactosPropiosDeSucursal } from "@/lib/data/contactos";
import { listarPersonasLocal, tecnicoTieneVisitaEn } from "@/lib/data/personas-local";
import { log } from "@/lib/log";
import { sugerenciasDelLocal } from "@/lib/ui/contactos";
import { tiene } from "@/lib/permisos";
import type { PersonaLocal } from "@/lib/types";
import { validar } from "@/lib/validacion/comun";
import { entradaPersonasLocal } from "@/lib/validacion/visitas";
import { enModoTecnico } from "@/lib/roles";

/**
 * Las personas que ya recibieron o firmaron en una tienda, para elegirlas al
 * agendar una visita o llenar el acta. Son datos personales, así que no basta
 * con tener sesión:
 *
 * - Panel: coordinación que puede ver o agregar visitas. Los contactos de la
 *   sucursal, además, solo a quien tiene `contactos.ver`.
 * - Técnico: las tiendas donde tiene una visita (titular o ayudante). Con el
 *   permiso de agregar visitas en terreno también las que elige en esa hoja,
 *   porque ahí la sucursal todavía no tiene visita suya. En esas tiendas ve
 *   también los contactos propios de la sucursal (no los del cliente ni los de
 *   otras tiendas): es lo que necesita para no reescribirlos en el acta.
 */
export async function personasDelLocalAction(sucursalPedida: number): Promise<PersonaLocal[]> {
  const sesion = await getSesion();
  if (!sesion) return [];
  const entrada = validar(entradaPersonasLocal, sucursalPedida, "personasDelLocal");
  if (!entrada.ok) return [];
  const sucursalId = entrada.datos;

  if (enModoTecnico(sesion)) {
    if (!sesion.tecnico) return [];
    const permitido =
      tiene(sesion.permisos, "celular.crearVisita") || (await tecnicoTieneVisitaEn(sesion.tecnico.id, sucursalId));
    if (!permitido) return [];
  } else if (!tiene(sesion.permisos, "visitas.crear") && !tiene(sesion.permisos, "visitas.ver")) {
    return [];
  }
  const verContactos = enModoTecnico(sesion) || tiene(sesion.permisos, "contactos.ver");
  const [personas, contactos] = await Promise.all([
    listarPersonasLocal(sucursalId),
    // Es una ayuda: si la lectura de contactos falla, quedan las personas solas.
    verContactos
      ? contactosPropiosDeSucursal(sucursalId).catch((err) => {
          log.error("contactosPropiosDeSucursal", { err });
          return [];
        })
      : Promise.resolve([]),
  ]);
  return sugerenciasDelLocal(personas, contactos, sucursalId);
}
