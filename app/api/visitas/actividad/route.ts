import { NextResponse } from "next/server";
import sql from "mssql";
import { getSesion } from "@/lib/auth";
import { getPool } from "@/lib/db/pool";
import { T } from "@/lib/db/esquema";
import { log } from "@/lib/log";
import { enPanel } from "@/lib/roles";

// Días con visitas de un mes, para el punto morado del selector de fechas.
// Una consulta liviana por mes (cuenta agrupada por día), sin traer las visitas.
// El panel ve todas; el técnico, solo las suyas (como titular o ayudante).

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const sesion = await getSesion();
  if (!sesion) return new NextResponse("No autorizado", { status: 401 });
  const mes = new URL(req.url).searchParams.get("mes") ?? "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return NextResponse.json({ error: "Mes inválido (AAAA-MM)." }, { status: 400 });
  const tecnicoId = enPanel(sesion) ? null : (sesion.tecnico?.id ?? -1);
  try {
    const pool = await getPool();
    const r = await pool
      .request()
      .input("desde", sql.Date, `${mes}-01`)
      .input("tecnico", sql.BigInt, tecnicoId)
      .query<{ dia: string; n: number }>(`
        SELECT CONVERT(char(10), fecha_programada, 23) AS dia, COUNT(*) AS n
          FROM ${T.visita}
         WHERE activo = 1
           AND fecha_programada >= @desde AND fecha_programada < DATEADD(month, 1, @desde)
           AND (@tecnico IS NULL OR tecnico_id = @tecnico OR tecnico_ayudante_id = @tecnico)
         GROUP BY fecha_programada`);
    const dias = Object.fromEntries(r.recordset.map((f) => [f.dia, f.n]));
    return NextResponse.json({ mes, dias }, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch (err) {
    log.error("visitas.actividad", { err });
    return NextResponse.json({ error: "No se pudo leer la actividad." }, { status: 503 });
  }
}
