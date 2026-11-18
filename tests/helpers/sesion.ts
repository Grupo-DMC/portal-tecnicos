import type { RolUsuario, Tecnico, Usuario } from "@/lib/types";
import { PERMISOS_COORDINADOR, TODOS_LOS_PERMISOS, TODOS_LOS_PERMISOS_CELULAR } from "@/lib/permisos";
import type { Modo } from "@/lib/roles";

// Estado de la sesión simulada para los tests de Server Actions y rutas API.
// tests/setup/acciones.ts enchufa estas funciones en las capas bajas (cookie,
// token, lectura del usuario y de su rol), de modo que getSesion/sesionCon de
// lib/auth corren de verdad y lo único falso es la base de datos.

/** Con «+tecnico», la cuenta tiene además el rol TECNICO y un técnico vinculado. */
export type Perfil = "admin" | "coordinador" | "tecnico" | "admin+tecnico" | "coordinador+tecnico";

interface Acceso {
  permisos: string[];
  rolNombre: string;
}

interface Estado {
  token: { uid: number; sv: number; modo?: Modo } | null;
  registro: unknown;
  /** Lo que devuelve accesoDeUsuario en cada modo (ver tests/setup/acciones.ts). */
  acceso: Acceso;
  accesoTecnico: Acceso;
}

export const estado: Estado = {
  token: null,
  registro: null,
  acceso: { permisos: [], rolNombre: "" },
  accesoTecnico: { permisos: [], rolNombre: "" },
};

export const cookiesEscritas: { nombre: string; valor: string }[] = [];
export const cookiesBorradas: string[] = [];

export const TECNICO_PRUEBA: Tecnico = {
  id: 11,
  rut: "11.111.111-1",
  nombres: "Tecnica",
  apellidoPaterno: "Prueba",
  apellidoMaterno: null,
  nombreCompleto: "Tecnica Prueba",
  email: "tecnica@example.com",
  telefono: null,
  activo: true,
};

export interface OpcionesSesion {
  /** Permisos exactos; si no se pasan, los del perfil (en el modo en que entra). */
  permisos?: string[];
  id?: number;
  debeCambiarPassword?: boolean;
  sesionVersion?: number;
  /** El modo que dice el token. Sin él, el que le toca por defecto. */
  modo?: Modo;
  /** El técnico vinculado está desactivado. */
  tecnicoInactivo?: boolean;
}

const ROLES_DE: Record<Perfil, RolUsuario[]> = {
  admin: ["ADMIN"],
  coordinador: ["COORDINADOR"],
  tecnico: ["TECNICO"],
  "admin+tecnico": ["ADMIN", "TECNICO"],
  "coordinador+tecnico": ["COORDINADOR", "TECNICO"],
};

const ID_DE: Record<Perfil, number> = { admin: 1, coordinador: 2, tecnico: 3, "admin+tecnico": 4, "coordinador+tecnico": 6 };

/** Deja iniciada la sesión de un perfil ficticio. */
export function entrarComo(perfil: Perfil, opciones: OpcionesSesion = {}) {
  const id = opciones.id ?? ID_DE[perfil];
  const roles = ROLES_DE[perfil];
  const esTecnico = roles.includes("TECNICO");
  const usuario: Usuario = {
    id,
    email: `${perfil.replace("+", ".")}@example.com`,
    roles,
    rolId: roles.includes("COORDINADOR") ? 5 : null,
    tecnicoId: esTecnico ? TECNICO_PRUEBA.id : null,
    activo: true,
    ultimoAccesoEn: null,
  };
  const panel: Acceso | null = roles.includes("ADMIN")
    ? { permisos: TODOS_LOS_PERMISOS, rolNombre: "Administrador" }
    : roles.includes("COORDINADOR")
      ? { permisos: PERMISOS_COORDINADOR, rolNombre: "Coordinador" }
      : null;
  const celular: Acceso = { permisos: TODOS_LOS_PERMISOS_CELULAR, rolNombre: "Técnico" };
  // `permisos` manda en el modo en que entra: el del token o el de por defecto.
  const entraComoTecnico = opciones.modo === "tecnico" || !panel;
  estado.token = { uid: id, sv: opciones.sesionVersion ?? 0, ...(opciones.modo ? { modo: opciones.modo } : {}) };
  estado.registro = {
    usuario,
    tecnico: esTecnico ? { ...TECNICO_PRUEBA, activo: !opciones.tecnicoInactivo } : null,
    passwordHash: "",
    sesionVersion: opciones.sesionVersion ?? 0,
    debeCambiarPassword: opciones.debeCambiarPassword ?? false,
  };
  estado.acceso = panel ? { ...panel, permisos: (!entraComoTecnico && opciones.permisos) || panel.permisos } : celular;
  estado.accesoTecnico = { ...celular, permisos: (entraComoTecnico && opciones.permisos) || celular.permisos };
}

/** Nadie ha iniciado sesión (sin cookie válida). */
export function salir() {
  estado.token = null;
  estado.registro = null;
  estado.acceso = { permisos: [], rolNombre: "" };
  estado.accesoTecnico = { permisos: [], rolNombre: "" };
  cookiesEscritas.length = 0;
  cookiesBorradas.length = 0;
}

/** Un FormData a partir de un objeto plano. */
export function formulario(campos: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
}

/** Lo que lanza redirect() en los tests: se atrapa con `await expect(...).rejects`. */
export class RedirectFalso extends Error {
  constructor(public destino: string) {
    super(`NEXT_REDIRECT:${destino}`);
  }
}

/** Ejecuta una acción que termina en redirect() y devuelve el destino. */
export async function destinoDeRedirect(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (err) {
    if (err instanceof RedirectFalso) return err.destino;
    throw err;
  }
}
