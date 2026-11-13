import { tiene } from "@/lib/permisos";
import type { Tecnico, Visita } from "@/lib/types";

/**
 * Lo que la visita lleva al navegador. La visita completa trae los datos
 * personales del técnico (RUT, correo, teléfono): se vacían para quien no
 * tiene por qué verlos, igual que hace el contexto del panel con la lista de
 * técnicos (ver tecnicoReducido en referencias.ts).
 */
function sinContacto(t: Tecnico, conTelefono = false): Tecnico {
  return { ...t, rut: "", email: "", telefono: conTelefono ? t.telefono : null, apellidoMaterno: t.apellidoMaterno };
}

/**
 * Para el celular. El titular ve lo suyo; el ayudante no recibe el RUT ni el
 * correo del titular (el teléfono sí: es para coordinarse en terreno). Las
 * ediciones hechas desde el panel dicen "Coordinación" en vez del correo de la
 * cuenta que las hizo.
 */
export function visitaParaTecnico(visita: Visita, tecnicoId: number): Visita {
  const propia = visita.tecnicoId === tecnicoId;
  return {
    ...visita,
    tecnico: visita.tecnico && !propia ? sinContacto(visita.tecnico, true) : visita.tecnico,
    // El RUT del cliente no lo usa el celular (el teléfono del local sí: es para llamar a la tienda).
    cliente: visita.cliente ? { ...visita.cliente, rut: "" } : visita.cliente,
    ediciones: visita.ediciones?.map((e) => (e.origen === "WEB" ? { ...e, por: "Coordinación" } : e)),
  };
}

/**
 * Para el panel, con el mismo criterio que el contexto de referencias: los
 * datos del técnico bajan con el permiso de Técnicos, el RUT del cliente con
 * el de Clientes y el teléfono del local con el de Sucursales.
 */
export function visitaParaPanel(visita: Visita, permisos: string[]): Visita {
  const verTecnicos = tiene(permisos, "tecnicos.ver");
  const verClientes = tiene(permisos, "clientes.ver");
  const verSucursales = tiene(permisos, "sucursales.ver");
  if (verTecnicos && verClientes && verSucursales) return visita;
  return {
    ...visita,
    tecnico: visita.tecnico && !verTecnicos ? sinContacto(visita.tecnico) : visita.tecnico,
    cliente: visita.cliente && !verClientes ? { ...visita.cliente, rut: "" } : visita.cliente,
    sucursal: visita.sucursal && !verSucursales ? { ...visita.sucursal, telefono: null } : visita.sucursal,
  };
}
