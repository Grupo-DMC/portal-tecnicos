// "Hoy" de la operación. Toda la app opera en Chile continental, así que la
// fecha se calcula siempre en America/Santiago y no en el huso del servidor:
// en Vercel el runtime corre en UTC y de noche mostraría el día siguiente.

export const ZONA = "America/Santiago";

const FORMATO_FECHA = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Fecha de hoy en Chile, como 'YYYY-MM-DD'. */
export function hoyISO(referencia: Date = new Date()): string {
  return FORMATO_FECHA.format(referencia);
}

/** Lunes de la semana de `fecha`, como 'YYYY-MM-DD'. */
export function inicioSemana(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  const dow = d.getUTCDay() === 0 ? 7 : d.getUTCDay(); // lunes=1 … domingo=7
  d.setUTCDate(d.getUTCDate() - (dow - 1));
  return d.toISOString().slice(0, 10);
}

/** Suma días a una fecha 'YYYY-MM-DD' sin salirse del calendario. */
export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * Fecha para mostrar, en el formato de Chile: 'YYYY-MM-DD' (o una marca con
 * hora) → "02/11/2026". Lo que no tenga forma de fecha se devuelve tal cual.
 * Solo para mostrar: en URLs, formularios y la base la fecha sigue en ISO.
 */
export function fechaCL(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/**
 * 'YYYY-MM-DDTHH:mm:ss' → "24/08/2026 · 14:35".
 *
 * La marca viene sin zona desde SQL Server (ya es hora de Chile), así que se
 * formatea a mano: dársela a Date la haría interpretar como UTC y correría las
 * horas según dónde esté corriendo el servidor.
 */

export function fechaHoraLegible(marca: string | null | undefined): string {
  if (!marca) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(marca);
  if (!m) return marca;
  const [, anio, mes, dia, hh, mm] = m;
  return `${dia}/${mes}/${anio} · ${hh}:${mm}`;
}

interface ConMargen {
  fechaProgramada: string;
  fechaHasta?: string | null;
  estado: string;
}

/**
 * Bajo qué día se muestra una visita.
 *
 * La de un solo día, el suyo. La que tiene margen de días y sigue abierta se
 * va corriendo: cada día del margen aparece en «Hoy», hasta que se cierre o
 * se acabe el margen.
 */
export function diaDeVisita(v: ConMargen, hoy: string): string {
  const abierta = v.estado === "PROGRAMADA" || v.estado === "EN_CURSO";
  if (!v.fechaHasta || !abierta || hoy <= v.fechaProgramada) return v.fechaProgramada;
  return hoy < v.fechaHasta ? hoy : v.fechaHasta;
}

/** '01/10/2026', o '01/10/2026 → 05/10/2026' si la visita tiene margen. */
export function textoFechaVisita(v: Pick<ConMargen, "fechaProgramada" | "fechaHasta">): string {
  return v.fechaHasta ? `${fechaCL(v.fechaProgramada)} → ${fechaCL(v.fechaHasta)}` : fechaCL(v.fechaProgramada);
}

/** Primer día del mes de `fecha`. */
export function inicioMes(fecha: string): string {
  return `${fecha.slice(0, 7)}-01`;
}
