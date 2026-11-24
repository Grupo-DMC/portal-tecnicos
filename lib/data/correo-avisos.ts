import "server-only";
import { consulta, consultaCon, ejecutar, enTransaccion, F_TS, num, sql } from "@/lib/data/sql";
import { cachePerfiles } from "@/lib/data/preferencias-canal";
import {
  MAX_EN_CORREO,
  MAX_INTENTOS,
  TOPE_POR_HORA,
  VENTANA_MINUTOS,
  avisosCorreo,
  type ConfigAvisosCorreo,
} from "@/lib/correo/avisos-config";
import { armarCorreoAvisos, type NovedadCorreo } from "@/lib/correo/plantilla-avisos";
import { enviarCorreo } from "@/lib/correo/proveedor";
import { log } from "@/lib/log";
import { modoCorreoPara, type ModoCorreo } from "@/lib/notificaciones";
import { T } from "@/lib/db/esquema";

// Avisos por correo: la cola tecnico.correo_aviso y los lotes tecnico.correo_aviso_lote
// (migración 043). Se alimenta del mismo origen que la campanita y el push:
// registrarActividad (lib/data/actividad.ts) llama a avisarPorCorreo después de
// responder.
//
//   1. encolar ... por cada cuenta que quiere ese tipo por correo, una fila con
//                  desde cuándo puede salir: ya (MOMENTO), al terminar la
//                  ventana del último correo (MOMENTO agrupado) o a la hora de
//                  su resumen (RESUMEN). Pasado el tope por hora, va al resumen.
//   2. despachar . por cuenta y modo, junta lo que ya puede salir en un lote y
//                  manda un solo correo. Antes vuelve a mirar permisos y
//                  preferencias; el resumen salta lo ya visto en la campanita.
//
// Lo despacha el mismo evento (lo que ya venció) y el cron /api/cron/correos
// (lo agrupado y los resúmenes). Todo es de mejor esfuerzo: si falla, queda en
// el log y la campanita sigue igual. Apagado (ver lib/correo/avisos-config.ts)
// no toca ninguna tabla.

export interface AvisoCorreo {
  /** Id de la actividad. */
  id: number;
  tipo: string;
  actorId: number | null;
}

/** Cuántas cuentas se evalúan a la vez al encolar. */
const EN_PARALELO = 10;
/** Cuentas que atiende una pasada del despacho. */
const CUENTAS_POR_PASADA = 100;
/** Minutos tras los que un lote que quedó «enviando» se da por caído. */
const LOTE_COLGADO_MIN = 30;
/** Minutos antes de reintentar lo que falló. */
const REINTENTO_MIN = 15;

/** El evento recién registrado: lo encola y manda lo que ya venció. Nunca lanza. */
export async function avisarPorCorreo(aviso: AvisoCorreo): Promise<void> {
  const config = avisosCorreo();
  if (!config) return;
  try {
    await encolarCorreos(aviso);
  } catch (err) {
    log.error("correoAvisos.encolar", { err, tipo: aviso.tipo });
  }
  try {
    await despacharCorreos(config);
  } catch (err) {
    log.error("correoAvisos.despachar", { err });
  }
}

export async function encolarCorreos(aviso: AvisoCorreo): Promise<number> {
  const cuentas = await consultaCon<{ id: unknown }>(
    // Las cuentas con un rol del panel, aunque además sean técnicas.
    `SELECT u.id FROM ${T.usuario} u
      WHERE u.activo = 1 AND u.id <> COALESCE(@actor, 0)
        AND EXISTS (SELECT 1 FROM ${T.usuario_rol} r WHERE r.usuario_id = u.id AND r.rol IN ('ADMIN', 'COORDINADOR'))`,
    [["actor", sql.BigInt, aviso.actorId]]
  );
  const perfil = cachePerfiles(true);
  let encolados = 0;

  const encolar = async (uid: number) => {
    try {
      const p = await perfil(uid);
      if (!p) return;
      const modo = modoCorreoPara(p.permisos, p.canales, p.ajustes, aviso.tipo);
      if (modo === "NUNCA") return;
      const insertadas = await consultaCon<{ id: unknown }>(
        `DECLARE @ahora datetime2(0) = SYSDATETIME();
         DECLARE @ultimo datetime2(0) = (
           SELECT MAX(creado_en) FROM ${T.correo_aviso_lote}
            WHERE usuario_id = @u AND modo = 'MOMENTO' AND estado IN ('ENVIANDO', 'ENVIADO'));
         DECLARE @enHora int = (
           SELECT COUNT(*) FROM ${T.correo_aviso_lote}
            WHERE usuario_id = @u AND modo = 'MOMENTO' AND estado IN ('ENVIANDO', 'ENVIADO')
              AND creado_en > DATEADD(hour, -1, @ahora));
         DECLARE @modo varchar(8) = CASE WHEN @pedido = 'MOMENTO' AND @enHora >= @tope THEN 'RESUMEN' ELSE @pedido END;
         DECLARE @resumen datetime2(0) = DATEADD(hour, @hora, CAST(CAST(@ahora AS date) AS datetime2(0)));
         IF @resumen <= @ahora SET @resumen = DATEADD(day, 1, @resumen);
         INSERT INTO ${T.correo_aviso} (usuario_id, actividad_id, modo, enviar_desde)
         OUTPUT INSERTED.id AS id
         SELECT @u, @actividad, @modo,
                CASE WHEN @modo = 'RESUMEN' THEN @resumen
                     WHEN @ultimo IS NOT NULL AND DATEADD(minute, @ventana, @ultimo) > @ahora THEN DATEADD(minute, @ventana, @ultimo)
                     ELSE @ahora END
          WHERE NOT EXISTS (SELECT 1 FROM ${T.correo_aviso} WHERE usuario_id = @u AND actividad_id = @actividad);`,
        [
          ["u", sql.BigInt, uid],
          ["actividad", sql.BigInt, aviso.id],
          ["pedido", sql.VarChar(8), modo],
          ["tope", sql.Int, TOPE_POR_HORA],
          ["ventana", sql.Int, VENTANA_MINUTOS],
          ["hora", sql.Int, p.ajustes.horaResumen],
        ]
      );
      encolados += insertadas.length;
    } catch (err) {
      log.error("correoAvisos.encolarCuenta", { err, usuarioId: uid, tipo: aviso.tipo });
    }
  };

  const ids = cuentas.map((c) => num(c.id));
  for (let i = 0; i < ids.length; i += EN_PARALELO) {
    await Promise.all(ids.slice(i, i + EN_PARALELO).map(encolar));
  }
  return encolados;
}

export interface ResultadoDespacho {
  enviados: number;
  errores: number;
  descartados: number;
}

/** Manda lo que ya puede salir, un correo por cuenta y modo. */
export async function despacharCorreos(config: ConfigAvisosCorreo): Promise<ResultadoDespacho> {
  const resultado: ResultadoDespacho = { enviados: 0, errores: 0, descartados: 0 };
  await rescatarLotesColgados();

  const pendientes = await consultaCon<{ usuarioId: unknown; modo: ModoCorreo }>(
    `SELECT DISTINCT TOP (${CUENTAS_POR_PASADA}) usuario_id AS usuarioId, modo
       FROM ${T.correo_aviso}
      WHERE lote_id IS NULL AND enviar_desde <= SYSDATETIME()`,
    []
  );
  if (pendientes.length === 0) return resultado;

  const perfil = cachePerfiles(true);
  for (const p of pendientes) {
    try {
      const r = await despacharCuenta(num(p.usuarioId), p.modo, config, perfil);
      if (r) resultado[r]++;
    } catch (err) {
      log.error("correoAvisos.despacharCuenta", { err, usuarioId: num(p.usuarioId), modo: p.modo });
      resultado.errores++;
    }
  }
  return resultado;
}

/**
 * Toma lo que ya puede salir de esta cuenta y modo en un lote nuevo. Un candado
 * por cuenta (sp_getapplock) evita que el cron y un evento manden lo mismo a
 * la vez. Null si no hay nada que tomar o la ventana del último correo sigue
 * abierta.
 */
async function tomarLote(usuarioId: number, modo: ModoCorreo): Promise<number | null> {
  return enTransaccion(async (ej) => {
    const [candado] = await ej.consulta<{ r: number }>(
      `DECLARE @r int;
       EXEC @r = sp_getapplock @Resource = @recurso, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 0;
       SELECT @r AS r;`,
      [["recurso", sql.NVarChar(255), `${T.correo_aviso}.${usuarioId}`]]
    );
    if (!candado || num(candado.r) < 0) return null;

    if (modo === "MOMENTO") {
      const reciente = await ej.consulta(
        `SELECT TOP (1) 1 AS x FROM ${T.correo_aviso_lote}
          WHERE usuario_id = @u AND modo = 'MOMENTO' AND estado IN ('ENVIANDO', 'ENVIADO')
            AND creado_en > DATEADD(minute, -@ventana, SYSDATETIME())`,
        [
          ["u", sql.BigInt, usuarioId],
          ["ventana", sql.Int, VENTANA_MINUTOS],
        ]
      );
      if (reciente.length) return null;
    }

    const [lote] = await ej.consulta<{ id: unknown }>(
      `INSERT INTO ${T.correo_aviso_lote} (usuario_id, modo) OUTPUT INSERTED.id AS id VALUES (@u, @modo)`,
      [
        ["u", sql.BigInt, usuarioId],
        ["modo", sql.VarChar(8), modo],
      ]
    );
    const loteId = num(lote.id);
    const tomadas = await ej.ejecutar(
      `UPDATE ${T.correo_aviso} SET lote_id = @lote
        WHERE usuario_id = @u AND modo = @modo AND lote_id IS NULL AND enviar_desde <= SYSDATETIME()`,
      [
        ["lote", sql.BigInt, loteId],
        ["u", sql.BigInt, usuarioId],
        ["modo", sql.VarChar(8), modo],
      ]
    );
    if (tomadas === 0) {
      await ej.ejecutar(`DELETE FROM ${T.correo_aviso_lote} WHERE id = @lote`, [["lote", sql.BigInt, loteId]]);
      return null;
    }
    return loteId;
  });
}

async function despacharCuenta(
  usuarioId: number,
  modo: ModoCorreo,
  config: ConfigAvisosCorreo,
  perfil: ReturnType<typeof cachePerfiles>
): Promise<keyof ResultadoDespacho | null> {
  const loteId = await tomarLote(usuarioId, modo);
  if (loteId === null) return null;

  const filas = await consultaCon<Omit<NovedadCorreo, "id"> & { id: unknown }>(
    `SELECT a.id, ${F_TS("a.creado_en")} AS creadoEn, a.tipo, a.actor_nombre AS actor, a.texto, a.detalle, a.enlace
       FROM ${T.correo_aviso} c
       JOIN ${T.actividad} a ON a.id = c.actividad_id
      WHERE c.lote_id = @lote
      ORDER BY a.id`,
    [["lote", sql.BigInt, loteId]]
  );

  // Se vuelve a mirar al salir: pudo cambiar el rol, las preferencias, o ya
  // haberlo visto en la campanita (eso solo cuenta para el resumen).
  const p = await perfil(usuarioId);
  const novedades = p
    ? filas
        .map((f) => ({ ...f, id: num(f.id) }))
        .filter((n) => modoCorreoPara(p.permisos, p.canales, p.ajustes, n.tipo) !== "NUNCA")
        .filter((n) => modo !== "RESUMEN" || n.id > p.leidoHasta)
    : [];

  if (!p || !p.email.includes("@") || novedades.length === 0) {
    await cerrarLote(loteId, { estado: "DESCARTADO", cantidad: 0 });
    return "descartados";
  }

  const correo = armarCorreoAvisos({
    modo,
    novedades: novedades.slice(-MAX_EN_CORREO),
    total: novedades.length,
    urlBase: config.urlBase,
  });
  const envio = await enviarCorreo(
    {
      de: config.remitente,
      responderA: "",
      para: [p.email],
      cc: [],
      cco: [],
      asunto: correo.asunto,
      html: correo.html,
      texto: correo.texto,
      adjuntos: [],
      idempotencia: `aviso-lote-${loteId}`,
    },
    config.proveedor
  );

  if (envio.ok) {
    await cerrarLote(loteId, { estado: "ENVIADO", cantidad: novedades.length, proveedorId: envio.id });
    return "enviados";
  }
  log.warn("correoAvisos: el proveedor no lo aceptó", { loteId, usuarioId, error: envio.error });
  await cerrarLote(loteId, { estado: "ERROR", cantidad: novedades.length, error: envio.error });
  await liberarParaReintento(loteId);
  return "errores";
}

async function cerrarLote(
  loteId: number,
  fin: { estado: "ENVIADO" | "ERROR" | "DESCARTADO"; cantidad: number; proveedorId?: string; error?: string }
): Promise<void> {
  await ejecutar(
    `UPDATE ${T.correo_aviso_lote}
        SET estado = @estado, cantidad = @cantidad, proveedor_id = @prov, error = @error, cerrado_en = SYSDATETIME()
      WHERE id = @lote`,
    [
      ["lote", sql.BigInt, loteId],
      ["estado", sql.VarChar(10), fin.estado],
      ["cantidad", sql.Int, fin.cantidad],
      ["prov", sql.VarChar(100), fin.proveedorId?.slice(0, 100) || null],
      ["error", sql.NVarChar(400), fin.error?.slice(0, 400) ?? null],
    ]
  );
}

/** Lo que falló vuelve a la cola en unos minutos, hasta MAX_INTENTOS. */
async function liberarParaReintento(loteId: number): Promise<void> {
  await ejecutar(
    `UPDATE ${T.correo_aviso}
        SET lote_id = NULL, intentos = intentos + 1, enviar_desde = DATEADD(minute, @espera, SYSDATETIME())
      WHERE lote_id = @lote AND intentos + 1 < @max`,
    [
      ["lote", sql.BigInt, loteId],
      ["espera", sql.Int, REINTENTO_MIN],
      ["max", sql.Int, MAX_INTENTOS],
    ]
  );
}

/** Un lote que quedó «enviando» (la función se cortó a mitad) vuelve a la cola. */
async function rescatarLotesColgados(): Promise<void> {
  await ejecutar(
    `SET XACT_ABORT ON;
     BEGIN TRANSACTION;
       DECLARE @colgados TABLE (id bigint PRIMARY KEY);
       UPDATE ${T.correo_aviso_lote}
          SET estado = 'ERROR', error = N'No terminó de enviarse: se reintenta.', cerrado_en = SYSDATETIME()
       OUTPUT INSERTED.id INTO @colgados
        WHERE estado = 'ENVIANDO' AND creado_en < DATEADD(minute, -@min, SYSDATETIME());
       UPDATE ${T.correo_aviso}
          SET lote_id = NULL, intentos = intentos + 1, enviar_desde = SYSDATETIME()
        WHERE lote_id IN (SELECT id FROM @colgados) AND intentos + 1 < @max;
     COMMIT TRANSACTION;`,
    [
      ["min", sql.Int, LOTE_COLGADO_MIN],
      ["max", sql.Int, MAX_INTENTOS],
    ]
  );
}

/** Borra la cola ya resuelta de hace más de 30 días y los lotes de hace más de 90. */
export async function limpiarCorreos(): Promise<void> {
  await consulta(
    `DELETE FROM ${T.correo_aviso}
      WHERE creado_en < DATEADD(day, -30, SYSDATETIME())
        AND (lote_id IS NOT NULL OR enviar_desde < DATEADD(day, -30, SYSDATETIME()));
     DELETE FROM ${T.correo_aviso_lote}
      WHERE creado_en < DATEADD(day, -90, SYSDATETIME()) AND estado <> 'ENVIANDO';`
  );
}
