import "server-only";
import { consulta, consultaCon, ejecutorSuelto, enTransaccion, num, numONull, sql, type Ejecutor } from "@/lib/data/sql";
import {
  normalizarPermisos,
  normalizarPermisosCelular,
  PERMISOS_COORDINADOR,
  TODOS_LOS_PERMISOS,
  TODOS_LOS_PERMISOS_CELULAR,
} from "@/lib/permisos";
import { ordenarRoles, rolDelPanel, type Modo } from "@/lib/roles";
import type { Rol, RolUsuario, Usuario } from "@/lib/types";
import { T } from "@/lib/db/esquema";

// Roles del panel y sus permisos: tecnico.rol, tecnico.rol_permiso y tecnico.usuario.rol_id.

export interface Acceso {
  permisos: string[];
  /** El nombre del rol, para mostrarlo bajo el nombre en el panel. */
  rolNombre: string;
}

/**
 * Qué puede hacer un usuario en el modo en que trabaja. En modo técnico, los
 * permisos del celular, tenga el rol del panel que tenga. En el panel, el
 * administrador puede todo y no depende de ninguna tabla: nadie lo deja afuera
 * quitándole permisos a un rol.
 */
export async function accesoDeUsuario(usuario: Usuario, modo: Modo): Promise<Acceso> {
  if (modo === "tecnico") return { permisos: await permisosCelular(), rolNombre: "Técnico" };
  const panel = rolDelPanel(usuario.roles);
  if (panel === "ADMIN") return { permisos: TODOS_LOS_PERMISOS, rolNombre: "Administrador" };
  // Sin rol del panel no hay nada que hacer en él (lib/auth no deja llegar aquí).
  if (panel === null) return { permisos: [], rolNombre: "Técnico" };

  const filas = await consultaCon<{ nombre: string | null; permiso: string | null }>(
    `SELECT r.nombre, rp.permiso
       FROM ${T.usuario} u
       LEFT JOIN ${T.rol} r          ON r.id = u.rol_id
       LEFT JOIN ${T.rol_permiso} rp ON rp.rol_id = r.id
      WHERE u.id = @id`,
    [["id", sql.BigInt, usuario.id]]
  );
  const nombre = filas[0]?.nombre;
  // Un coordinador sin rol asignado conserva lo que podía hacer siempre.
  if (!nombre) return { permisos: PERMISOS_COORDINADOR, rolNombre: "Coordinador" };
  return {
    permisos: normalizarPermisos(filas.map((f) => f.permiso ?? "")),
    rolNombre: nombre,
  };
}

/**
 * El rol «Técnico»: sus permisos de celular viven en tecnico.rol_permiso como los de
 * cualquier rol, pero la fila se crea al guardarlos por primera vez (la app no
 * tiene DDL). Mientras no exista, el técnico conserva todo lo que ya podía hacer.
 */
export const ROL_TECNICO = "Técnico";

/** Los permisos de celular de los técnicos. */
export async function permisosCelular(): Promise<string[]> {
  const filas = await consultaCon<{ permiso: string | null }>(
    `SELECT rp.permiso
       FROM ${T.rol} r
       LEFT JOIN ${T.rol_permiso} rp ON rp.rol_id = r.id
      WHERE r.nombre = @nombre`,
    [["nombre", sql.NVarChar(60), ROL_TECNICO]]
  );
  if (filas.length === 0) return TODOS_LOS_PERMISOS_CELULAR;
  return normalizarPermisosCelular(filas.map((f) => f.permiso ?? ""));
}

/** Deja los permisos de celular exactamente como vienen (pueden ser ninguno). */
export async function guardarPermisosCelular(permisos: string[]): Promise<void> {
  const limpios = normalizarPermisosCelular(permisos);
  await enTransaccion(async (ej) => {
    let [fila] = await ej.consulta<{ id: number }>(
      `SELECT id FROM ${T.rol} WITH (UPDLOCK) WHERE nombre = @nombre`,
      [["nombre", sql.NVarChar(60), ROL_TECNICO]]
    );
    // Mientras la fila no exista, los técnicos lo pueden todo (ver permisosCelular).
    const creado = !fila;
    if (!fila) {
      [fila] = await ej.consulta<{ id: number }>(
        `INSERT INTO ${T.rol} (nombre, descripcion, es_sistema) VALUES (@nombre, @descripcion, 1);
         SELECT CAST(SCOPE_IDENTITY() AS bigint) AS id;`,
        [
          ["nombre", sql.NVarChar(60), ROL_TECNICO],
          ["descripcion", sql.NVarChar(240), "Permisos del celular de los técnicos."],
        ]
      );
    }
    const rolId = num(fila.id);
    const previos = creado
      ? TODOS_LOS_PERMISOS_CELULAR
      : (
          await ej.consulta<{ permiso: string }>(`SELECT permiso FROM ${T.rol_permiso} WHERE rol_id = @id`, [
            ["id", sql.BigInt, rolId],
          ])
        ).map((p) => p.permiso);
    // Quitarles algo a los técnicos cierra sus sesiones abiertas.
    if (previos.some((p) => !limpios.includes(p))) {
      await ej.ejecutar(
        `UPDATE ${T.usuario} SET sesion_version = sesion_version + 1
          WHERE id IN (SELECT usuario_id FROM ${T.usuario_rol} WHERE rol = 'TECNICO')`
      );
    }
    await ej.ejecutar(`DELETE FROM ${T.rol_permiso} WHERE rol_id = @id`, [["id", sql.BigInt, rolId]]);
    for (const permiso of limpios) {
      await ej.ejecutar(`INSERT INTO ${T.rol_permiso} (rol_id, permiso) VALUES (@id, @permiso)`, [
        ["id", sql.BigInt, rolId],
        ["permiso", sql.VarChar(60), permiso],
      ]);
    }
  });
}

/** Los roles del panel. */
export async function listarRoles(): Promise<Rol[]> {
  const [roles, permisos] = await Promise.all([
    consultaCon<{ id: number; nombre: string; descripcion: string | null; es_sistema: boolean; usuarios: number }>(
      `SELECT r.id, r.nombre, r.descripcion, r.es_sistema,
              (SELECT COUNT(*) FROM ${T.usuario} u WHERE u.rol_id = r.id) AS usuarios
         FROM ${T.rol} r
        WHERE r.nombre <> @tecnico
        ORDER BY r.es_sistema DESC, r.nombre`,
      [["tecnico", sql.NVarChar(60), ROL_TECNICO]]
    ),
    consulta<{ rol_id: number; permiso: string }>(`SELECT rol_id, permiso FROM ${T.rol_permiso}`),
  ]);
  return roles.map((r) => ({
    id: num(r.id),
    nombre: r.nombre,
    descripcion: r.descripcion,
    esSistema: Boolean(r.es_sistema),
    usuarios: num(r.usuarios),
    permisos: normalizarPermisos(permisos.filter((p) => num(p.rol_id) === num(r.id)).map((p) => p.permiso)),
  }));
}

export interface DatosRol {
  nombre: string;
  descripcion: string | null;
  permisos: string[];
}

/** Crea o edita un rol y deja sus permisos exactamente como vienen. */
export async function guardarRol(id: number | null, d: DatosRol): Promise<number> {
  const permisos = normalizarPermisos(d.permisos);
  return enTransaccion(async (ej) => {
    let rolId = id;
    if (rolId === null) {
      // Sin OUTPUT: se relee por SCOPE_IDENTITY, igual que al crear una visita.
      const [fila] = await ej.consulta<{ id: number }>(
        `INSERT INTO ${T.rol} (nombre, descripcion) VALUES (@nombre, @descripcion);
         SELECT CAST(SCOPE_IDENTITY() AS bigint) AS id;`,
        [
          ["nombre", sql.NVarChar(60), d.nombre.trim()],
          ["descripcion", sql.NVarChar(240), d.descripcion?.trim() || null],
        ]
      );
      rolId = num(fila.id);
    } else {
      await ej.ejecutar(
        `UPDATE ${T.rol}
            SET nombre = @nombre, descripcion = @descripcion, actualizado_en = SYSDATETIME()
          WHERE id = @id`,
        [
          ["nombre", sql.NVarChar(60), d.nombre.trim()],
          ["descripcion", sql.NVarChar(240), d.descripcion?.trim() || null],
          ["id", sql.BigInt, rolId],
        ]
      );
      const previos = await ej.consulta<{ permiso: string }>(
        `SELECT permiso FROM ${T.rol_permiso} WITH (UPDLOCK) WHERE rol_id = @id`,
        [["id", sql.BigInt, rolId]]
      );
      // Quitarle algo al rol cierra las sesiones abiertas de quienes lo tienen.
      if (previos.some((p) => !permisos.includes(p.permiso))) {
        await ej.ejecutar(`UPDATE ${T.usuario} SET sesion_version = sesion_version + 1 WHERE rol_id = @id`, [
          ["id", sql.BigInt, rolId],
        ]);
      }
      await ej.ejecutar(`DELETE FROM ${T.rol_permiso} WHERE rol_id = @id`, [["id", sql.BigInt, rolId]]);
    }
    for (const permiso of permisos) {
      await ej.ejecutar(`INSERT INTO ${T.rol_permiso} (rol_id, permiso) VALUES (@id, @permiso)`, [
        ["id", sql.BigInt, rolId],
        ["permiso", sql.VarChar(60), permiso],
      ]);
    }
    return rolId;
  });
}

/**
 * Borra un rol. No se puede con uno de sistema ni con uno que todavía tenga
 * usuarios: primero hay que pasarlos a otro rol. Devuelve el motivo si no se
 * pudo, o null si quedó borrado.
 */
export async function eliminarRol(id: number): Promise<string | null> {
  return enTransaccion(async (ej) => {
    const [rol] = await ej.consulta<{ es_sistema: boolean; usuarios: number }>(
      `SELECT r.es_sistema, (SELECT COUNT(*) FROM ${T.usuario} u WHERE u.rol_id = r.id) AS usuarios
         FROM ${T.rol} r WITH (UPDLOCK) WHERE r.id = @id`,
      [["id", sql.BigInt, id]]
    );
    if (!rol) return "Ese rol ya no existe.";
    if (rol.es_sistema) return "Ese rol es del sistema y no se puede eliminar.";
    if (num(rol.usuarios) > 0) {
      return `Ese rol todavía lo tienen ${num(rol.usuarios)} usuarios. Pásalos a otro rol antes de eliminarlo.`;
    }
    // tecnico.rol_permiso se va con el ON DELETE CASCADE.
    await ej.ejecutar(`DELETE FROM ${T.rol} WHERE id = @id`, [["id", sql.BigInt, id]]);
    return null;
  });
}

// ── Cuentas vistas desde quien las administra ───────────────────────────────

/** Una cuenta con lo que puede hacer en el panel. Ver puedeAdministrarCuenta. */
export interface Cuenta {
  id: number;
  email: string;
  roles: RolUsuario[];
  rolId: number | null;
  /** El técnico vinculado (solo si tiene el rol TECNICO). */
  tecnicoId: number | null;
  activo: boolean;
  /** Permisos del panel: todos para ADMIN, ninguno si solo es técnico. */
  permisos: string[];
}

/** Lo que puede en el panel una cuenta con esos roles y ese rol del panel. */
export function permisosDelPanel(roles: readonly RolUsuario[], rolId: number | null, permisosRol: readonly string[]): string[] {
  const panel = rolDelPanel(roles);
  if (panel === "ADMIN") return TODOS_LOS_PERMISOS;
  if (panel === null) return [];
  // Un coordinador sin rol asignado conserva lo que podía hacer siempre.
  if (rolId === null) return PERMISOS_COORDINADOR;
  return normalizarPermisos(permisosRol);
}

/**
 * Varias cuentas por id. Con `bloquear`, dentro de una transacción, las filas
 * de tecnico.usuario quedan tomadas hasta el final: nadie les cambia el rol entre
 * el control y la escritura.
 */
export async function leerCuentas(
  ids: number[],
  ej: Ejecutor = ejecutorSuelto,
  bloquear = false
): Promise<Map<number, Cuenta>> {
  const cuentas = new Map<number, Cuenta>();
  if (ids.length === 0) return cuentas;
  const filas = await ej.consulta<{
    id: number;
    email: string;
    roles: string | null;
    rol_id: number | null;
    tecnico_id: number | null;
    activo: boolean;
    permiso: string | null;
  }>(
    `SELECT u.id, u.email, u.rol_id, u.tecnico_id, u.activo, rp.permiso,
            (SELECT STRING_AGG(r.rol, ',') FROM ${T.usuario_rol} r WHERE r.usuario_id = u.id) AS roles
       FROM ${T.usuario} u ${bloquear ? "WITH (UPDLOCK, HOLDLOCK)" : ""}
       LEFT JOIN ${T.rol_permiso} rp ON rp.rol_id = u.rol_id
      WHERE u.id IN (SELECT CAST(value AS bigint) FROM OPENJSON(@ids))`,
    [["ids", sql.NVarChar(sql.MAX), JSON.stringify([...new Set(ids)])]]
  );
  const permisosRol = new Map<number, string[]>();
  for (const f of filas) {
    const id = num(f.id);
    if (!permisosRol.has(id)) permisosRol.set(id, []);
    if (f.permiso) permisosRol.get(id)!.push(f.permiso);
  }
  for (const f of filas) {
    const id = num(f.id);
    if (cuentas.has(id)) continue;
    const rolId = numONull(f.rol_id);
    const roles = ordenarRoles((f.roles ?? "").split(","));
    cuentas.set(id, {
      id,
      email: f.email,
      roles,
      rolId,
      tecnicoId: numONull(f.tecnico_id),
      activo: Boolean(f.activo),
      permisos: permisosDelPanel(roles, rolId, permisosRol.get(id) ?? []),
    });
  }
  return cuentas;
}

export async function leerCuenta(id: number, ej: Ejecutor = ejecutorSuelto, bloquear = false): Promise<Cuenta | null> {
  return (await leerCuentas([id], ej, bloquear)).get(id) ?? null;
}

/** Un rol del panel por id, con sus permisos; null si no existe. */
export async function leerRol(
  id: number,
  ej: Ejecutor = ejecutorSuelto
): Promise<{ id: number; nombre: string; permisos: string[] } | null> {
  const filas = await ej.consulta<{ nombre: string; permiso: string | null }>(
    `SELECT r.nombre, rp.permiso
       FROM ${T.rol} r
       LEFT JOIN ${T.rol_permiso} rp ON rp.rol_id = r.id
      WHERE r.id = @id AND r.nombre <> @tecnico`,
    [
      ["id", sql.BigInt, id],
      ["tecnico", sql.NVarChar(60), ROL_TECNICO],
    ]
  );
  if (filas.length === 0) return null;
  return { id, nombre: filas[0].nombre, permisos: normalizarPermisos(filas.map((f) => f.permiso ?? "")) };
}
