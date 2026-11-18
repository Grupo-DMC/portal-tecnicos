import Tag from "@/components/Tag";
import { autoriaDeBaja, type Baja } from "@/lib/ui/estado-activo";

/**
 * La etiqueta Activo / Inactivo de un maestro. Si está inactivo muestra por
 * qué, y al pasar el cursor (o con el lector de pantalla) quién lo desactivó y
 * cuándo (migración 039). Es la misma pieza en todas las tablas del panel.
 */
export default function EstadoActivo({
  activo,
  baja,
  motivo,
  femenino = false,
  conMotivo = true,
}: {
  activo: boolean;
  /** La última baja, como viene de la lectura del maestro. */
  baja?: Baja | null;
  /** El motivo, si la fila no trae `baja` (quien la arma a mano). */
  motivo?: string | null;
  /** «Activa / Inactiva» para sucursales y marcas. */
  femenino?: boolean;
  /** false = solo la etiqueta (el motivo queda en el tooltip), para filas apretadas. */
  conMotivo?: boolean;
}) {
  if (activo) return <Tag variant="accent">{femenino ? "Activa" : "Activo"}</Tag>;

  const porque = (baja?.motivo || motivo || "").trim();
  const autoria = autoriaDeBaja(baja ?? { por: null, en: null }, femenino);
  const detalle = porque ? `${autoria}: ${porque}` : autoria;
  return (
    <span className="inline-flex flex-col items-start gap-1 max-w-[280px] align-top">
      <Tag variant="neutral" className="cursor-help">
        <span title={detalle} aria-label={`${femenino ? "Inactiva" : "Inactivo"}. ${detalle}`}>
          {femenino ? "Inactiva" : "Inactivo"}
        </span>
      </Tag>
      {conMotivo && porque ? (
        <span className="text-cap leading-[1.4] opacity-66 line-clamp-2" title={detalle}>
          {porque}
        </span>
      ) : null}
    </span>
  );
}
