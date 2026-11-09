import "server-only";
import { consultaCon, num, sql } from "@/lib/data/sql";
import type { ConflictoAgenda } from "@/lib/contratos/visitas";

// Alertas al agendar: dos visitas del mismo día que se pisan. No bloquean nada;
// el panel las muestra para que coordinación decida.

/** Visitas que todavía cuentan para el día: ni reagendadas ni canceladas. */
const ESTADOS_QUE_CUENTAN = `('PROGRAMADA','EN_CURSO','PENDIENTE','COMPLETADA')`;

export interface PedidoConflictos {
  sucursalId: number;
  fecha: string;
  tecnicoId: number | null;
  ayudanteId: number | null;
  /** Al corregir o reprogramar, la visita que se está tocando: no choca consigo misma. */
  folio?: string | null;
}

export async function conflictosDeAgenda(p: PedidoConflictos): Promise<ConflictoAgenda[]> {
  const mios = [p.tecnicoId, p.ayudanteId].filter((x): x is number => Boolean(x));
  if (!p.fecha) return [];

  const filas = await consultaCon<{
    folio: string;
    estado: string;
    tecnico_id: number;
    tecnico_ayudante_id: number | null;
    tecnico: string;
    ayudante: string | null;
    cliente: string;
    sucursal_id: number;
    sucursal: string;
    mall: string | null;
  }>(
    `DECLARE @mall bigint = (SELECT mall_id FROM dmc.sucursal WHERE id = @sucursal);

     SELECT v.folio, v.estado, v.tecnico_id, v.tecnico_ayudante_id,
            t.nombre_completo AS tecnico, ta.nombre_completo AS ayudante,
            c.nombre_fantasia AS cliente, v.sucursal_id, s.nombre AS sucursal, m.nombre AS mall
       FROM dmc.visita v
       JOIN dmc.sucursal s ON s.id = v.sucursal_id
       JOIN dmc.cliente  c ON c.id = v.cliente_id
       JOIN dmc.tecnico  t ON t.id = v.tecnico_id
       LEFT JOIN dmc.tecnico ta ON ta.id = v.tecnico_ayudante_id
       LEFT JOIN dmc.mall m ON m.id = s.mall_id
      WHERE v.activo = 1 AND v.estado IN ${ESTADOS_QUE_CUENTAN}
        AND v.fecha_programada = @fecha
        AND (@folio IS NULL OR v.folio <> @folio)
        AND (v.sucursal_id = @sucursal OR (@mall IS NOT NULL AND s.mall_id = @mall))
      ORDER BY v.hora_programada, v.id`,
    [
      ["sucursal", sql.BigInt, p.sucursalId],
      ["fecha", sql.VarChar(10), p.fecha],
      ["folio", sql.VarChar(16), p.folio ?? null],
    ]
  );

  const nombreDe = new Map<number, string>();
  const conflictos: ConflictoAgenda[] = [];
  for (const f of filas) {
    const suyos = [num(f.tecnico_id), f.tecnico_ayudante_id === null ? null : num(f.tecnico_ayudante_id)].filter(
      (x): x is number => x !== null
    );
    nombreDe.set(num(f.tecnico_id), f.tecnico);
    if (f.tecnico_ayudante_id !== null && f.ayudante) nombreDe.set(num(f.tecnico_ayudante_id), f.ayudante);
    const comunes = suyos.filter((id) => mios.includes(id));
    const mismoLocal = num(f.sucursal_id) === p.sucursalId;
    const base = {
      folio: f.folio,
      estado: f.estado,
      tecnico: f.tecnico,
      ayudante: f.ayudante,
      cliente: f.cliente,
      sucursal: f.sucursal,
      mall: f.mall,
    };
    if (comunes.length > 0) {
      // Un técnico repetido en otro mall, en otro local, no es problema; en el mismo local sí.
      if (mismoLocal) {
        conflictos.push({
          ...base,
          tipo: "MISMO_TECNICO",
          alcance: "LOCAL",
          repetidos: comunes.map((id) => nombreDe.get(id) ?? ""),
        });
      }
      continue;
    }
    // Nadie en común: otro equipo en el mismo local o mall. Si no hay técnico
    // elegido todavía no hay con quién comparar.
    if (mios.length === 0) continue;
    conflictos.push({ ...base, tipo: "OTRO_TECNICO", alcance: mismoLocal ? "LOCAL" : "MALL", repetidos: [] });
  }
  return conflictos;
}
