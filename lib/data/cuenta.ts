import "server-only";
import { consultaCon, ejecutar, F_TS, sql } from "@/lib/data/sql";

// «Mi cuenta» — lo que cada persona ve y edita de sí misma (migración 034).
//
// Solo persiste: quién puede tocar qué cuenta lo decide app/actions/cuenta, y
// siempre es la de la sesión.

export interface PerfilCuenta {
  id: number;
  email: string;
  nombre: string | null;
  telefono: string | null;
  /** Marca de tiempo de la foto, para romper la caché del <img>; null si no tiene. */
  fotoVersion: string | null;
  ultimoAccesoEn: string | null;
  creadoEn: string;
}

interface FilaPerfil {
  id: number | string;
  email: string;
  nombre: string | null;
  telefono: string | null;
  foto_en: string | null;
  ultimo_acceso_en: string | null;
  creado_en: string;
}

export async function getPerfil(usuarioId: number): Promise<PerfilCuenta | null> {
  const [f] = await consultaCon<FilaPerfil>(
    `SELECT u.id, u.email, u.nombre, u.telefono,
            ${F_TS("f.actualizado_en")} AS foto_en,
            ${F_TS("u.ultimo_acceso_en")} AS ultimo_acceso_en,
            ${F_TS("u.creado_en")} AS creado_en
       FROM dmc.usuario u
       LEFT JOIN dmc.usuario_foto f ON f.usuario_id = u.id
      WHERE u.id = @id`,
    [["id", sql.BigInt, usuarioId]]
  );
  if (!f) return null;
  return {
    id: Number(f.id),
    email: f.email,
    nombre: f.nombre,
    telefono: f.telefono,
    fotoVersion: f.foto_en,
    ultimoAccesoEn: f.ultimo_acceso_en,
    creadoEn: f.creado_en,
  };
}

/** true si otra cuenta ya entra con ese correo. */
export async function correoEnUso(email: string, salvoId: number): Promise<boolean> {
  const filas = await consultaCon<{ id: number }>(
    "SELECT TOP 1 id FROM dmc.usuario WHERE email = @email AND id <> @id",
    [
      ["email", sql.NVarChar(160), email],
      ["id", sql.BigInt, salvoId],
    ]
  );
  return filas.length > 0;
}

export async function guardarDatosPropios(
  usuarioId: number,
  datos: { nombre: string | null; telefono: string | null; email: string }
): Promise<void> {
  await ejecutar(
    `UPDATE dmc.usuario
        SET nombre = @nombre, telefono = @telefono, email = @email, actualizado_en = SYSDATETIME()
      WHERE id = @id`,
    [
      ["id", sql.BigInt, usuarioId],
      ["nombre", sql.NVarChar(120), datos.nombre],
      ["telefono", sql.NVarChar(30), datos.telefono],
      ["email", sql.NVarChar(160), datos.email],
    ]
  );
}

export async function guardarFotoPropia(usuarioId: number, mime: string, bytes: Buffer): Promise<void> {
  await ejecutar(
    `UPDATE dmc.usuario_foto
        SET mime = @mime, contenido = @contenido, actualizado_en = SYSDATETIME()
      WHERE usuario_id = @id;
     IF @@ROWCOUNT = 0
       INSERT INTO dmc.usuario_foto (usuario_id, mime, contenido) VALUES (@id, @mime, @contenido);`,
    [
      ["id", sql.BigInt, usuarioId],
      ["mime", sql.VarChar(40), mime],
      ["contenido", sql.VarBinary(sql.MAX), bytes],
    ]
  );
}

export async function quitarFotoPropia(usuarioId: number): Promise<void> {
  await ejecutar("DELETE FROM dmc.usuario_foto WHERE usuario_id = @id", [["id", sql.BigInt, usuarioId]]);
}

export async function getFotoDeUsuario(usuarioId: number): Promise<{ mime: string; bytes: Buffer } | null> {
  const [f] = await consultaCon<{ mime: string; contenido: Buffer }>(
    "SELECT mime, contenido FROM dmc.usuario_foto WHERE usuario_id = @id",
    [["id", sql.BigInt, usuarioId]]
  );
  return f ? { mime: f.mime, bytes: f.contenido } : null;
}
