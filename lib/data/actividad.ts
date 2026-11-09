import "server-only";
import { after } from "next/server";
import { consultaCon, ejecutar, F_TS, num, sql } from "@/lib/data/sql";
import { log } from "@/lib/log";
import { enviarPush } from "@/lib/data/push";
import {
  CONFIGURACION_POR_DEFECTO,
  NIVELES,
  tiposPara,
  type BandejaNotificaciones,
  type ConfiguracionAvisos,
  type NivelAviso,
  type Notificacion,
  type PreferenciasAviso,
} from "@/lib/notificaciones";
import { nombreVisible } from "@/lib/ui/cuenta";

// Lo que pasa en el sistema y la campanita que lo muestra — dmc.actividad,
// dmc.notificacion_usuario y dmc.notificacion_preferencia (migración 034).
//
// Anotar es de mejor esfuerzo, igual que la auditoría: si falla, lo que ya se
// hizo no se deshace; queda el error en el log del servidor.

/** Quién hizo algo: la sesión de quien llama a la acción. */
export interface ActorActividad {
  usuario: { id: number; email: string };
  tecnico?: { nombreCompleto: string } | null;
}

export interface EventoActividad {
  tipo: string;
  /** La frase sin el sujeto: «cerró el acta de V-2026-00012». */
  texto: string;
  detalle?: string | null;
  enlace?: string | null;
  /**
   * Folio de la visita. Si no viene `detalle`, se completa con el nombre de su
   * sucursal en la misma sentencia, y el enlace lleva a la visita.
   */
  folio?: string | null;
}

/** Cuántos días hacia atrás mira la campanita. */
const DIAS = 30;
/** Cuántas filas trae la lista. */
const MAXIMO = 60;

const corta = (texto: string | null | undefined, max: number) => (texto ? texto.slice(0, max) : null);

export async function registrarActividad(actor: ActorActividad | null, evento: EventoActividad): Promise<void> {
  try {
    // El técnico se muestra con su nombre de técnico; las cuentas del panel, con el
    // que se pusieron en «Mi cuenta» (se lee en la misma sentencia) o, si no, el del correo.
    const nombre = actor ? actor.tecnico?.nombreCompleto || nombreVisible(null, actor.usuario.email) : null;
    const enlace = evento.enlace ?? (evento.folio ? `/admin/visitas/${evento.folio}` : null);
    const [fila] = await consultaCon<{ id: unknown; actor: string | null; detalle: string | null; enlace: string | null }>(
      `INSERT INTO dmc.actividad (tipo, actor_usuario_id, actor_nombre, de_tecnico, texto, detalle, enlace)
       OUTPUT INSERTED.id AS id, INSERTED.actor_nombre AS actor, INSERTED.detalle AS detalle, INSERTED.enlace AS enlace
       VALUES (@tipo, @actor,
               CASE WHEN @tecnico = 1 THEN @nombre
                    ELSE COALESCE(NULLIF(LTRIM(RTRIM((SELECT nombre FROM dmc.usuario WHERE id = @actor))), N''), @nombre) END,
               @tecnico, @texto,
               COALESCE(@detalle, (SELECT TOP (1) s.nombre FROM dmc.visita v
                                     JOIN dmc.sucursal s ON s.id = v.sucursal_id
                                    WHERE v.folio = @folio)),
               @enlace)`,
      [
        ["tipo", sql.VarChar(40), evento.tipo],
        ["actor", sql.BigInt, actor?.usuario.id ?? null],
        ["nombre", sql.NVarChar(160), corta(nombre, 160)],
        ["tecnico", sql.Bit, actor?.tecnico ? 1 : 0],
        ["texto", sql.NVarChar(300), evento.texto.slice(0, 300)],
        ["detalle", sql.NVarChar(300), corta(evento.detalle, 300)],
        ["folio", sql.VarChar(16), evento.folio ?? null],
        ["enlace", sql.NVarChar(200), corta(enlace, 200)],
      ]
    );
    if (fila) {
      const aviso = {
        id: num(fila.id),
        tipo: evento.tipo,
        actorId: actor?.usuario.id ?? null,
        titulo: fila.actor ? `${fila.actor} ${evento.texto}` : evento.texto,
        cuerpo: fila.detalle,
        enlace: fila.enlace,
      };
      // Después de responder, para no hacer esperar a quien hizo el cambio.
      try {
        after(() => enviarPush(aviso));
      } catch {
        void enviarPush(aviso);
      }
    }
  } catch (err) {
    log.error("actividad.registrar", { err, tipo: evento.tipo, usuarioId: actor?.usuario.id });
  }
}

interface FilaConfiguracion {
  leidoHasta: unknown;
  verPropios: boolean | null;
}

interface FilaPreferencia {
  tipo: string;
  nivel: string;
}

export async function leerConfiguracion(usuarioId: number): Promise<ConfiguracionAvisos & { leidoHasta: number | null }> {
  const [cuenta, prefs] = await Promise.all([
    consultaCon<FilaConfiguracion>(
      `SELECT leido_hasta AS leidoHasta, ver_propios AS verPropios FROM dmc.notificacion_usuario WHERE usuario_id = @u`,
      [["u", sql.BigInt, usuarioId]]
    ),
    consultaCon<FilaPreferencia>(`SELECT tipo, nivel FROM dmc.notificacion_preferencia WHERE usuario_id = @u`, [
      ["u", sql.BigInt, usuarioId],
    ]),
  ]);
  const niveles: PreferenciasAviso = {};
  for (const p of prefs) if (NIVELES.includes(p.nivel as NivelAviso)) niveles[p.tipo] = p.nivel as NivelAviso;
  const fila = cuenta[0];
  return {
    niveles,
    verPropios: fila ? Boolean(fila.verPropios) : CONFIGURACION_POR_DEFECTO.verPropios,
    leidoHasta: fila ? num(fila.leidoHasta) : null,
  };
}

interface FilaActividad {
  id: unknown;
  creadoEn: string;
  tipo: string;
  actorId: unknown;
  actor: string | null;
  deTecnico: boolean;
  texto: string;
  detalle: string | null;
  enlace: string | null;
}

/**
 * La bandeja de la campanita: lo de los demás que estos permisos y
 * preferencias dejan ver, más lo propio si lo pidió, de los últimos días.
 *
 * Una cuenta que abre la campanita por primera vez arranca con todo leído:
 * no tiene sentido recibirla con treinta días de avisos atrasados.
 */
export async function bandejaDe(usuarioId: number, permisos: readonly string[]): Promise<BandejaNotificaciones> {
  const config = await leerConfiguracion(usuarioId);
  let leidoHasta = config.leidoHasta;
  if (leidoHasta === null) {
    const filas = await consultaCon<{ ultimo: unknown }>(
      `MERGE dmc.notificacion_usuario AS d
       USING (SELECT @u AS usuario_id, ISNULL((SELECT MAX(id) FROM dmc.actividad), 0) AS ultimo) AS o
          ON d.usuario_id = o.usuario_id
        WHEN NOT MATCHED THEN INSERT (usuario_id, leido_hasta) VALUES (o.usuario_id, o.ultimo)
       OUTPUT inserted.leido_hasta AS ultimo;`,
      [["u", sql.BigInt, usuarioId]]
    );
    // Si otra pestaña la creó en el mismo instante no sale nada: se relee.
    leidoHasta = filas[0] ? num(filas[0].ultimo) : ((await leerConfiguracion(usuarioId)).leidoHasta ?? 0);
  }

  const { mostrar, avisar } = tiposPara(permisos, config.niveles);
  const filas = await consultaCon<FilaActividad>(
    `SELECT TOP (${MAXIMO})
            a.id, ${F_TS("a.creado_en")} AS creadoEn, a.tipo, a.actor_usuario_id AS actorId,
            a.actor_nombre AS actor, a.de_tecnico AS deTecnico, a.texto, a.detalle, a.enlace
       FROM dmc.actividad a
      WHERE a.creado_en >= DATEADD(day, -${DIAS}, SYSDATETIME())
        AND (
              (a.actor_usuario_id = @u AND @propios = 1)
           OR ((a.actor_usuario_id IS NULL OR a.actor_usuario_id <> @u)
               AND a.tipo IN (SELECT value FROM OPENJSON(@mostrar)))
            )
      ORDER BY a.id DESC`,
    [
      ["u", sql.BigInt, usuarioId],
      ["propios", sql.Bit, config.verPropios ? 1 : 0],
      ["mostrar", sql.NVarChar(sql.MAX), JSON.stringify(mostrar)],
    ]
  );

  const [conteo] = await consultaCon<{ n: number }>(
    `SELECT COUNT(*) AS n FROM (
       SELECT TOP (100) 1 AS x FROM dmc.actividad a
        WHERE a.id > @leido
          AND a.creado_en >= DATEADD(day, -${DIAS}, SYSDATETIME())
          AND (a.actor_usuario_id IS NULL OR a.actor_usuario_id <> @u)
          AND a.tipo IN (SELECT value FROM OPENJSON(@avisar))
     ) t`,
    [
      ["u", sql.BigInt, usuarioId],
      ["leido", sql.BigInt, leidoHasta],
      ["avisar", sql.NVarChar(sql.MAX), JSON.stringify(avisar)],
    ]
  );

  const avisan = new Set(avisar);
  const items: Notificacion[] = filas.map((f) => {
    const id = num(f.id);
    const propia = f.actorId !== null && num(f.actorId) === usuarioId;
    return {
      id,
      creadoEn: f.creadoEn,
      tipo: f.tipo,
      actor: f.actor,
      propia,
      deTecnico: Boolean(f.deTecnico),
      texto: f.texto,
      detalle: f.detalle,
      enlace: f.enlace,
      nueva: !propia && id > (leidoHasta ?? 0) && avisan.has(f.tipo),
    };
  });

  return {
    items,
    noLeidas: Math.min(99, num(conteo?.n ?? 0)),
    configuracion: { niveles: config.niveles, verPropios: config.verPropios },
  };
}

/** Deja como vistas todas las actividades hasta `hasta` (nunca retrocede). */
export async function marcarLeidas(usuarioId: number, hasta: number): Promise<void> {
  await ejecutar(
    `MERGE dmc.notificacion_usuario AS d
     USING (SELECT @u AS usuario_id, @hasta AS hasta) AS o ON d.usuario_id = o.usuario_id
      WHEN MATCHED AND d.leido_hasta < o.hasta THEN
           UPDATE SET leido_hasta = o.hasta, actualizado_en = SYSDATETIME()
      WHEN NOT MATCHED THEN INSERT (usuario_id, leido_hasta) VALUES (o.usuario_id, o.hasta);`,
    [
      ["u", sql.BigInt, usuarioId],
      ["hasta", sql.BigInt, hasta],
    ]
  );
}

/** Reemplaza las preferencias de la cuenta. `niveles` ya viene limpio (ver preferenciasParaGuardar). */
export async function guardarConfiguracion(usuarioId: number, config: ConfiguracionAvisos): Promise<void> {
  const filas = Object.entries(config.niveles).map(([tipo, nivel]) => ({ tipo, nivel }));
  await ejecutar(
    `SET XACT_ABORT ON;
     BEGIN TRANSACTION;
       MERGE dmc.notificacion_usuario AS d
       USING (SELECT @u AS usuario_id) AS o ON d.usuario_id = o.usuario_id
        WHEN MATCHED THEN UPDATE SET ver_propios = @propios, actualizado_en = SYSDATETIME()
        WHEN NOT MATCHED THEN INSERT (usuario_id, leido_hasta, ver_propios)
             VALUES (o.usuario_id, ISNULL((SELECT MAX(id) FROM dmc.actividad), 0), @propios);
       DELETE FROM dmc.notificacion_preferencia WHERE usuario_id = @u;
       INSERT INTO dmc.notificacion_preferencia (usuario_id, tipo, nivel)
       SELECT @u, j.tipo, j.nivel
         FROM OPENJSON(@filas) WITH (tipo varchar(40) '$.tipo', nivel varchar(8) '$.nivel') j;
     COMMIT TRANSACTION;`,
    [
      ["u", sql.BigInt, usuarioId],
      ["propios", sql.Bit, config.verPropios ? 1 : 0],
      ["filas", sql.NVarChar(sql.MAX), JSON.stringify(filas)],
    ]
  );
}
