// Catálogo de permisos del panel.
//
// Un permiso es "<módulo>.<acción>". La lista vive acá, en el código, porque
// cada permiso es una comprobación escrita en una acción del servidor: agregar
// uno a mano en la base no haría nada. Lo que sí vive en la base es qué
// permisos tiene cada rol (tecnico.rol_permiso).
//
// Este archivo lo importan el servidor y los componentes de cliente.

import { enPanel, esAdmin, mismosRoles, rolDelPanel, tieneRolTecnico, type ConModo } from "@/lib/roles";
import type { RolUsuario } from "@/lib/types";

export interface AccionPermiso {
  clave: string;
  label: string;
}

export interface ModuloPermiso {
  clave: string;
  label: string;
  acciones: AccionPermiso[];
}

/** La acción que abre el módulo: sin ella, las demás no sirven de nada. */
export const VER = "ver";

export const MODULOS: ModuloPermiso[] = [
  { clave: "panel", label: "Panel", acciones: [{ clave: "ver", label: "Ver el panel y sus gráficos" }] },
  {
    clave: "visitas",
    label: "Visitas",
    acciones: [
      { clave: "ver", label: "Ver visitas y actas" },
      { clave: "crear", label: "Agregar visitas (una o masivas)" },
      { clave: "editar", label: "Corregir visitas" },
      { clave: "editarActa", label: "Editar el acta ya cerrada" },
      { clave: "reprogramar", label: "Cambiar fecha y técnico" },
      { clave: "enviar", label: "Enviar el acta por correo" },
      { clave: "liberar", label: "Liberar visitas en curso" },
      { clave: "cancelar", label: "Cancelar por admin" },
      { clave: "eliminar", label: "Eliminar visitas" },
      // Solo abre la selección: cada acción en lote pide además su permiso de
      // arriba (corregir, cancelar por admin o eliminar).
      { clave: "masivo", label: "Acciones para múltiples visitas" },
    ],
  },
  {
    clave: "reagendas",
    label: "Reagendas y pendientes",
    acciones: [
      { clave: "ver", label: "Ver reagendas y pendientes" },
      { clave: "gestionar", label: "Marcar el checklist de gestión" },
    ],
  },
  {
    clave: "problemas",
    label: "Problemas",
    acciones: [
      { clave: "ver", label: "Ver problemas" },
      { clave: "editar", label: "Cambiar estado y tipo" },
    ],
  },
  {
    clave: "tecnicos",
    label: "Técnicos",
    acciones: [
      { clave: "ver", label: "Ver técnicos" },
      { clave: "crear", label: "Agregar técnicos" },
      { clave: "editar", label: "Editar técnicos" },
    ],
  },
  {
    clave: "usuarios",
    label: "Usuarios",
    acciones: [
      { clave: "ver", label: "Ver usuarios" },
      { clave: "crear", label: "Agregar usuarios" },
      { clave: "editar", label: "Editar usuarios" },
      { clave: "contrasenas", label: "Atender contraseñas pedidas" },
      { clave: "roles", label: "Administrar roles y permisos" },
    ],
  },
  {
    clave: "clientes",
    label: "Clientes",
    acciones: [
      { clave: "ver", label: "Ver clientes" },
      { clave: "crear", label: "Agregar clientes" },
      { clave: "editar", label: "Editar clientes" },
    ],
  },
  {
    clave: "marcas",
    label: "Marcas",
    acciones: [
      { clave: "ver", label: "Ver marcas" },
      { clave: "crear", label: "Agregar marcas" },
      { clave: "editar", label: "Editar marcas" },
    ],
  },
  {
    clave: "contactos",
    label: "Contactos",
    acciones: [
      { clave: "ver", label: "Ver contactos" },
      { clave: "crear", label: "Agregar contactos" },
      { clave: "editar", label: "Editar contactos y sus cargos" },
    ],
  },
  {
    clave: "malls",
    label: "Malls",
    acciones: [
      { clave: "ver", label: "Ver malls" },
      { clave: "crear", label: "Agregar malls" },
      { clave: "editar", label: "Editar malls y sus tiendas" },
    ],
  },
  {
    clave: "sucursales",
    label: "Sucursales",
    acciones: [
      { clave: "ver", label: "Ver sucursales" },
      { clave: "crear", label: "Agregar sucursales" },
      { clave: "editar", label: "Editar sucursales" },
    ],
  },
  {
    clave: "checklist",
    label: "Checklist",
    acciones: [
      { clave: "ver", label: "Ver el checklist" },
      { clave: "editar", label: "Editar el checklist" },
    ],
  },
];

/**
 * Lo que puede hacer el técnico desde el celular. Es el mismo formato
 * "<módulo>.<acción>", pero vive aparte: no abre ninguna pantalla del panel y
 * no tiene "ver". Se edita en Usuarios › Roles y permisos, en el apartado
 * «Permisos del celular», y lo heredan todas las cuentas de técnico.
 */
export const MODULOS_CELULAR: ModuloPermiso[] = [
  {
    clave: "celular",
    label: "Celular",
    acciones: [
      { clave: "crearVisita", label: "Agregar visitas en terreno" },
      { clave: "estado", label: "Reagendar, dejar pendiente o cancelar" },
      { clave: "video", label: "Grabar y subir videos" },
      { clave: "editarActa", label: "Corregir su acta ya cerrada (dentro del plazo)" },
    ],
  },
];

export const TODOS_LOS_PERMISOS_CELULAR: string[] = MODULOS_CELULAR.flatMap((m) =>
  m.acciones.map((a) => `${m.clave}.${a.clave}`)
);

/** Deja solo permisos de celular que existen, en el orden del catálogo. */
export function normalizarPermisosCelular(permisos: readonly string[]): string[] {
  const validos = new Set(permisos);
  return TODOS_LOS_PERMISOS_CELULAR.filter((p) => validos.has(p));
}

/** Todos los permisos que existen: lo que tiene el administrador. */
export const TODOS_LOS_PERMISOS: string[] = MODULOS.flatMap((m) => m.acciones.map((a) => `${m.clave}.${a.clave}`));

/**
 * Lo que podía hacer un coordinador antes de que existieran los roles: todo
 * menos lo que era solo del administrador. Es el permiso de un coordinador sin
 * rol asignado y la semilla del rol «Coordinador» de la migración 008.
 */
export const PERMISOS_COORDINADOR: string[] = TODOS_LOS_PERMISOS.filter(
  (p) =>
    ![
      "visitas.editarActa",
      "visitas.liberar",
      "visitas.cancelar",
      "visitas.eliminar",
      "visitas.masivo",
      "usuarios.roles",
    ].includes(p)
);

export function tiene(permisos: readonly string[], permiso: string): boolean {
  return permisos.includes(permiso);
}

/**
 * Deja solo permisos que existen y agrega el "ver" de cada módulo que tenga
 * alguna otra acción marcada: poder editar algo que no se puede abrir no
 * significa nada.
 */
export function normalizarPermisos(permisos: readonly string[]): string[] {
  const validos = new Set(permisos.filter((p) => TODOS_LOS_PERMISOS.includes(p)));
  for (const p of [...validos]) validos.add(`${p.split(".")[0]}.${VER}`);
  return TODOS_LOS_PERMISOS.filter((p) => validos.has(p));
}

/**
 * ¿Puede `actor` modificar la cuenta `destino` (datos, clave, rol)?
 *
 * El administrador puede con todas. Los demás nunca con una de administrador,
 * y solo con cuentas que no puedan más que ellos: si la cuenta tiene algún
 * permiso que el actor no tiene, cambiarle la clave sería quedarse con ese
 * permiso. Las cuentas de técnico no tienen permisos del panel, así que caen
 * dentro de lo que cualquiera con el permiso del módulo puede tocar.
 *
 * Es la misma regla para un rol (eliminarlo, editarlo): `destino` puede ser
 * cualquier cosa con permisos.
 */
export function puedeAdministrarCuenta(
  actor: ConModo & { permisos: readonly string[] },
  destino: { roles?: readonly RolUsuario[]; permisos: readonly string[] }
): boolean {
  if (esAdmin(actor)) return true;
  // En modo técnico no se administra nada, aunque la cuenta sea del panel.
  if (!enPanel(actor) || destino.roles?.includes("ADMIN")) return false;
  return destino.permisos.every((p) => tiene(actor.permisos, p));
}

/** Por qué no: el texto que acompaña a un `puedeAdministrarCuenta` negativo. */
export function motivoCuentaAjena(destino: { roles?: readonly RolUsuario[] }): string {
  return destino.roles?.includes("ADMIN")
    ? "Solo un administrador puede modificar cuentas de administrador."
    : "Esa cuenta tiene permisos que tú no tienes: solo la puede modificar un administrador o alguien con al menos esos permisos.";
}

/** Una cuenta tal como la miran las reglas de abajo: cómo está o cómo quedaría. */
export interface CuentaAdministrada {
  roles: readonly RolUsuario[];
  rolId: number | null;
  tecnicoId: number | null;
  permisos: readonly string[];
}

/**
 * Quien no es administrador no puede fabricarse más acceso del que tiene: ni
 * tocar cuentas que pueden más que él, ni cambiarse los roles, ni dar un rol
 * que pueda más que él. Y vincular un técnico a una cuenta del panel es cosa
 * del administrador: con ese vínculo se llenan y firman actas a nombre de ese
 * técnico. Devuelve el motivo, o null si se puede.
 */
export function motivoParaNoGuardarCuenta(
  sesion: ConModo & { usuario: { id: number }; permisos: readonly string[] },
  id: number | null,
  actual: CuentaAdministrada | null,
  nueva: CuentaAdministrada
): string | null {
  if (actual && !puedeAdministrarCuenta(sesion, actual)) return motivoCuentaAjena(actual);
  if (!puedeAdministrarCuenta(sesion, nueva)) {
    return nueva.roles.includes("ADMIN")
      ? "Solo un administrador puede crear o editar cuentas de administrador."
      : "El rol elegido tiene permisos que tú no tienes: no lo puedes asignar.";
  }
  if (esAdmin(sesion)) return null;
  const cambiaRoles = !actual || !mismosRoles(actual.roles, nueva.roles) || actual.rolId !== nueva.rolId;
  if (id === sesion.usuario.id && cambiaRoles) return "No puedes cambiar tu propio rol.";
  const combinada = rolDelPanel(nueva.roles) !== null && tieneRolTecnico(nueva.roles);
  const tocaTecnico = !actual || !tieneRolTecnico(actual.roles) || actual.tecnicoId !== nueva.tecnicoId;
  if (combinada && tocaTecnico) {
    return "Solo un administrador puede dar el rol de técnico a una cuenta del panel o cambiarle el técnico.";
  }
  return null;
}
