import bcrypt from "bcryptjs";
import { inject } from "vitest";
import { consulta } from "@/lib/data/sql";

/** true cuando hay una base de pruebas local lista (ver tests/setup/bd-global.ts). */
export const hayBd = inject("bdPrueba").disponible;

/** Tablas que el DDL siembra y que los tests no deben vaciar. */
const CONSERVAR = ["catalogo_problema_estado", "rol", "rol_permiso", "schema_version", "acta_seccion_config"];

/**
 * Vacía todos los datos de prueba (visitas, maestros, catálogos…) sin tocar lo
 * que trae el DDL. Se desactivan las FK mientras se borra y se vuelven a validar.
 */
export async function limpiarDatos() {
  // La configuración de secciones del acta se conserva, pero apunta al usuario que la cambió:
  // si ese usuario se borra, las FK no se pueden volver a validar.
  await consulta(`UPDATE dmc.acta_seccion_config SET actualizado_por = NULL`);
  // Se borra en cualquier orden: el trigger que exige al menos un rol por
  // cuenta rechazaría vaciar dmc.usuario_rol antes que dmc.usuario.
  await consulta(`
    DISABLE TRIGGER dmc.tg_usuario_rol_coherente ON dmc.usuario_rol;
    DECLARE @t nvarchar(max) = N'';
    SELECT @t += N'ALTER TABLE dmc.' + QUOTENAME(name) + N' NOCHECK CONSTRAINT ALL;'
      FROM sys.tables WHERE SCHEMA_NAME(schema_id) = 'dmc';
    SELECT @t += N'DELETE FROM dmc.' + QUOTENAME(name) + N';'
      FROM sys.tables WHERE SCHEMA_NAME(schema_id) = 'dmc' AND name NOT IN (${CONSERVAR.map((n) => `'${n}'`).join(",")});
    SELECT @t += N'ALTER TABLE dmc.' + QUOTENAME(name) + N' WITH CHECK CHECK CONSTRAINT ALL;'
      FROM sys.tables WHERE SCHEMA_NAME(schema_id) = 'dmc';
    EXEC (@t);
    ENABLE TRIGGER dmc.tg_usuario_rol_coherente ON dmc.usuario_rol;`);
  await consulta(`ALTER SEQUENCE dmc.seq_folio_visita RESTART WITH 1`);
}

/** Primera fila de una consulta (o undefined). */
export async function uno<T>(texto: string): Promise<T | undefined> {
  return (await consulta<T>(texto))[0];
}

/** Ejecuta algo que debe fallar y devuelve el mensaje del error de SQL Server. */
export async function mensajeDeError(texto: string): Promise<string> {
  try {
    await consulta(texto);
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
  throw new Error(`Se esperaba un error de SQL Server y no lo hubo: ${texto.slice(0, 120)}`);
}

export interface Mundo {
  clienteId: number;
  marcaId: number;
  sucursalId: number;
  tecnicoId: number;
  tecnico2Id: number;
  adminId: number;
  usuarioTecnicoId: number;
  usuarioTecnico2Id: number;
}

/** Datos ficticios mínimos para agendar y cerrar una visita. */
export async function sembrarMundo(): Promise<Mundo> {
  const hash = await bcrypt.hash("Clave-De-Prueba-123", 4);
  await consulta(`
    INSERT INTO dmc.catalogo_motivo (codigo, nombre, orden) VALUES
      ('VISITA', N'Visita preventiva', 1), ('CALIBRACION', N'Calibración de las antenas', 2);
    INSERT INTO dmc.catalogo_problema (codigo, nombre, orden) VALUES
      ('ANTENA_NO_DETECTA', N'Antena no detecta etiquetas', 1), ('OTRO', N'Otro', 2);
    INSERT INTO dmc.catalogo_trabajo (codigo, nombre, orden) VALUES ('REVISION_ANTENAS', N'Revisión de antenas', 1);
    INSERT INTO dmc.cliente (rut, razon_social, nombre_fantasia) VALUES ('76.000.001-0', N'Cliente Uno SpA', N'Cliente Uno');
  `);
  const cliente = (await uno<{ id: number }>(`SELECT id FROM dmc.cliente WHERE rut = '76.000.001-0'`))!.id;
  await consulta(`INSERT INTO dmc.marca (cliente_id, nombre) VALUES (${cliente}, N'Marca Uno')`);
  const marca = (await uno<{ id: number }>(`SELECT id FROM dmc.marca WHERE cliente_id = ${cliente}`))!.id;
  await consulta(`
    INSERT INTO dmc.sucursal (cliente_id, marca_id, nombre, direccion, comuna, region)
    VALUES (${cliente}, ${marca}, N'Tienda Centro', N'Av. Principal 100', N'Santiago', N'Metropolitana');
    INSERT INTO dmc.tecnico (rut, nombres, apellido_paterno, email) VALUES
      ('11.111.111-1', N'Ana', N'Pérez', 'ana@example.com'), ('22.222.222-2', N'Beto', N'Soto', 'beto@example.com');
  `);
  const sucursal = (await uno<{ id: number }>(`SELECT id FROM dmc.sucursal WHERE marca_id = ${marca}`))!.id;
  const tecnicos = await consulta<{ id: number; rut: string }>(`SELECT id, rut FROM dmc.tecnico ORDER BY id`);
  await consulta(`
    INSERT INTO dmc.usuario (email, password_hash) VALUES ('admin@example.com', N'${hash}');
    INSERT INTO dmc.usuario (email, password_hash, tecnico_id) VALUES
      ('ana@example.com', N'${hash}', ${tecnicos[0].id}),
      ('beto@example.com', N'${hash}', ${tecnicos[1].id});
    INSERT INTO dmc.usuario_rol (usuario_id, rol)
      SELECT id, CASE WHEN email = 'admin@example.com' THEN 'ADMIN' ELSE 'TECNICO' END FROM dmc.usuario;
  `);
  const usuarios = await consulta<{ id: number; email: string }>(`SELECT id, email FROM dmc.usuario`);
  const idDe = (email: string) => Number(usuarios.find((u) => u.email === email)!.id);
  return {
    clienteId: Number(cliente),
    marcaId: Number(marca),
    sucursalId: Number(sucursal),
    tecnicoId: Number(tecnicos[0].id),
    tecnico2Id: Number(tecnicos[1].id),
    adminId: idDe("admin@example.com"),
    usuarioTecnicoId: idDe("ana@example.com"),
    usuarioTecnico2Id: idDe("beto@example.com"),
  };
}

/** Inserta una visita directa por SQL (para probar restricciones y triggers sin pasar por la app). */
export async function insertarVisita(m: Mundo, extra: { estado?: string; fecha?: string; ayudante?: number | null; hasta?: string | null } = {}) {
  await consulta(`
    INSERT INTO dmc.visita (cliente_id, sucursal_id, tecnico_id, tecnico_ayudante_id, motivo_codigo, estado, fecha_programada, fecha_hasta, trabajo_solicitado)
    VALUES (${m.clienteId}, ${m.sucursalId}, ${m.tecnicoId}, ${extra.ayudante ?? "NULL"}, 'VISITA', '${extra.estado ?? "PROGRAMADA"}',
            '${extra.fecha ?? "2026-10-26"}', ${extra.hasta ? `'${extra.hasta}'` : "NULL"}, N'Revisar antenas')`);
  const fila = await uno<{ id: number; folio: string }>(`SELECT TOP 1 id, folio FROM dmc.visita ORDER BY id DESC`);
  return { id: Number(fila!.id), folio: fila!.folio };
}
