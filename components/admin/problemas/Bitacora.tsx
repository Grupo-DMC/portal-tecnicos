// La bitácora de un problema: cuándo se levantó, cada cambio, cada paso marcado
// y la visita agendada para resolverlo. De lo más viejo a lo más nuevo.

import { ESTADO_VISITA_LABEL } from "@/lib/ui/estado";
import { fechaCL, fechaHoraLegible } from "@/lib/ui/fecha";
import { plural } from "@/lib/ui/plural";
import { abierto } from "@/lib/ui/problemas-panel";
import type { GestionMarca, ProblemaPanel } from "@/lib/contratos/panel";
import type { CatalogoGestionProblema } from "@/lib/types";

export default function Bitacora({
  problema: p,
  marcas,
  pasos,
  nombreTipo,
  nombreEstado,
}: {
  problema: ProblemaPanel;
  marcas: GestionMarca[];
  pasos: CatalogoGestionProblema[];
  nombreTipo: (codigo: string) => string;
  nombreEstado: (codigo: string) => string;
}) {
  const filas: { en: string; titulo: string; detalle: string; nota?: string | null }[] = [
    { en: p.creadoEn, titulo: "Levantado en terreno", detalle: `${p.visita.tecnico} · visita ${p.visita.folio}` },
    ...p.cambios.map((c) => ({
      en: c.en,
      titulo:
        c.campo === "ESTADO"
          ? `${nombreEstado(c.antes)} → ${nombreEstado(c.ahora)}`
          : `Reclasificado: ${nombreTipo(c.antes)} → ${nombreTipo(c.ahora)}`,
      detalle: c.por ?? "Sin autor registrado",
      nota: c.nota,
    })),
    // Una marca recién hecha todavía no trae su fecha: aparece al refrescar.
    ...marcas
      .filter((m) => m.en)
      .map((m) => ({
        en: m.en,
        titulo: `Gestión: ${pasos.find((x) => x.codigo === m.codigo)?.nombre ?? m.codigo}`,
        detalle: m.por ?? "Sin autor registrado",
      })),
  ].sort((a, b) => a.en.localeCompare(b.en));

  return (
    <>
      <p className="pb-steps-h">Bitácora del problema</p>
      <ol className="pb-log">
        {filas.map((f, i) => (
          <li key={`${f.en}-${i}`}>
            <b>{f.titulo}</b>
            <span>
              {fechaHoraLegible(f.en)} · {f.detalle}
            </span>
            {f.nota ? <span>«{f.nota}»</span> : null}
          </li>
        ))}
        {p.agenda ? (
          <li>
            <b>Visita agendada para resolverlo</b>
            <span>
              {p.agenda.folio} · {fechaCL(p.agenda.fecha)} · {p.agenda.tecnico} · {ESTADO_VISITA_LABEL[p.agenda.estado].toLowerCase()}
            </span>
          </li>
        ) : null}
      </ol>
      {abierto(p) ? <p className="pb-sigue">Sigue sin cerrar: lleva {plural(p.dias, "día", "días")} abierto.</p> : null}
    </>
  );
}
