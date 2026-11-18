import type { RolUsuario } from "@/lib/types";

// Roles de una cuenta y modos de trabajo (migración 044).
//
// Una cuenta tiene uno o más roles en dmc.usuario_rol: ADMIN o COORDINADOR (a
// lo más uno de los dos: son dos formas de entrar al mismo panel) y, aparte,
// TECNICO. Quien tiene un rol del panel y además TECNICO trabaja en uno de dos
// modos a la vez —el panel de administración o el panel de técnico— y lo
// cambia sin volver a escribir la clave.
//
// El modo viaja dentro del token firmado, pero nunca se le cree a ciegas: en
// cada petición lib/auth vuelve a leer los roles de la base y resolverModo()
// solo deja uno que la cuenta tenga de verdad.
//
// Este módulo es puro (sin "server-only" ni base de datos) para que la regla
// se pueda probar sola y la usen igual el servidor y los componentes.

export type Modo = "panel" | "tecnico";

export const MODOS: readonly Modo[] = ["panel", "tecnico"];

/** Los roles, en el orden en que se muestran y se guardan. */
export const ROLES: readonly RolUsuario[] = ["ADMIN", "COORDINADOR", "TECNICO"];

export type RolPanel = Extract<RolUsuario, "ADMIN" | "COORDINADOR">;

export const ETIQUETA_ROL: Record<RolUsuario, string> = {
  ADMIN: "Administrador",
  COORDINADOR: "Coordinador",
  TECNICO: "Técnico",
};

export const ETIQUETA_MODO: Record<Modo, string> = {
  panel: "Panel de administración",
  tecnico: "Panel de técnico",
};

export function esRol(valor: unknown): valor is RolUsuario {
  return typeof valor === "string" && (ROLES as readonly string[]).includes(valor);
}

export function esModo(valor: unknown): valor is Modo {
  return typeof valor === "string" && (MODOS as readonly string[]).includes(valor);
}

/** Sin repetidos, sin valores desconocidos y en el orden de ROLES. */
export function ordenarRoles(roles: readonly unknown[]): RolUsuario[] {
  return ROLES.filter((r) => roles.includes(r));
}

/** El rol con que entra al panel, o null si solo es técnico. */
export function rolDelPanel(roles: readonly RolUsuario[]): RolPanel | null {
  if (roles.includes("ADMIN")) return "ADMIN";
  if (roles.includes("COORDINADOR")) return "COORDINADOR";
  return null;
}

export function tieneRolTecnico(roles: readonly RolUsuario[]): boolean {
  return roles.includes("TECNICO");
}

/**
 * Por qué esa combinación de roles no vale, o null si vale. Es la misma regla
 * que exige la base (tg_usuario_rol_coherente); aquí se dice en palabras antes
 * de llegar a ella.
 */
export function problemaDeRoles(roles: readonly RolUsuario[], tecnicoId: number | null | undefined): string | null {
  if (roles.length === 0) return "Marca al menos un rol para la cuenta.";
  if (roles.includes("ADMIN") && roles.includes("COORDINADOR")) {
    return "Una cuenta no puede ser administradora y coordinadora a la vez: elige una.";
  }
  if (roles.includes("TECNICO") && !tecnicoId) return "Para el rol de técnico hay que vincular un técnico.";
  return null;
}

/**
 * En qué modos puede trabajar la cuenta. El panel, si tiene un rol del panel;
 * el de técnico, si tiene el rol TECNICO y su técnico está activo. El panel va
 * primero: es donde entra quien tiene los dos.
 */
export function modosDisponibles(roles: readonly RolUsuario[], tecnicoActivo: boolean): Modo[] {
  const modos: Modo[] = [];
  if (rolDelPanel(roles)) modos.push("panel");
  if (tieneRolTecnico(roles) && tecnicoActivo) modos.push("tecnico");
  return modos;
}

/**
 * El modo en que queda la sesión: el pedido, si la cuenta lo tiene; si no, el
 * primero que tenga. null = no puede trabajar en ninguno (por ejemplo, solo es
 * técnico y su técnico está desactivado).
 */
export function resolverModo(pedido: Modo | undefined, disponibles: readonly Modo[]): Modo | null {
  if (pedido && disponibles.includes(pedido)) return pedido;
  return disponibles[0] ?? null;
}

/** La pantalla de inicio de cada modo. */
export function inicioDelModo(modo: Modo): "/admin" | "/tecnico" {
  return modo === "tecnico" ? "/tecnico" : "/admin";
}

/** Lo mínimo de una sesión para decidir según el modo. */
export interface ConModo {
  modo: Modo;
  usuario: { roles: readonly RolUsuario[] };
}

/** Trabaja como técnico: sus visitas, sus actas, su celular. */
export function enModoTecnico(s: ConModo): boolean {
  return s.modo === "tecnico";
}

/** Trabaja en el panel de administración (como ADMIN o COORDINADOR). */
export function enPanel(s: ConModo): boolean {
  return s.modo === "panel" && rolDelPanel(s.usuario.roles) !== null;
}

/** Administrador y en el panel. En modo técnico no lo es, aunque tenga el rol. */
export function esAdmin(s: ConModo): boolean {
  return s.modo === "panel" && s.usuario.roles.includes("ADMIN");
}

/** true si las dos listas tienen los mismos roles, en cualquier orden. */
export function mismosRoles(a: readonly RolUsuario[], b: readonly RolUsuario[]): boolean {
  return a.length === b.length && a.every((r) => b.includes(r));
}

/** "Administrador + Técnico", para listas y etiquetas. */
export function textoRoles(roles: readonly RolUsuario[]): string {
  return ordenarRoles(roles).map((r) => ETIQUETA_ROL[r]).join(" + ");
}
