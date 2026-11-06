import type { CatalogoTrabajo, CatalogoTrabajoSubtrabajo } from "@/lib/types";

// Un trabajo puede repartir sus subtrabajos en varios grupos, cada uno con su
// nombre (migración 031). El primero se titula con `grupoLabel` del trabajo y
// sus subtrabajos traen `grupo` en null; los demás traen el nombre de su grupo.

export interface GrupoSubtrabajos {
  /** Clave estable para React: "" el primero, el nombre en minúsculas los demás. */
  clave: string;
  titulo: string;
  subtrabajos: CatalogoTrabajoSubtrabajo[];
}

/**
 * Los subtrabajos del trabajo repartidos en sus grupos, en el orden en que
 * aparece cada grupo. `tituloPorDefecto` titula el primero si el trabajo no
 * tiene `grupoLabel`. Los grupos sin subtrabajos no aparecen.
 */
export function gruposDeSubtrabajos(
  trabajo: Pick<CatalogoTrabajo, "grupoLabel" | "subtrabajos">,
  subtrabajos: CatalogoTrabajoSubtrabajo[] = trabajo.subtrabajos,
  tituloPorDefecto = "Subtrabajos"
): GrupoSubtrabajos[] {
  const grupos = new Map<string, GrupoSubtrabajos>();
  for (const s of subtrabajos) {
    const nombre = s.grupo?.trim() || "";
    const clave = nombre.toLowerCase();
    let g = grupos.get(clave);
    if (!g) {
      g = {
        clave,
        titulo: nombre || trabajo.grupoLabel?.trim() || tituloPorDefecto,
        subtrabajos: [],
      };
      grupos.set(clave, g);
    }
    g.subtrabajos.push(s);
  }
  // El primer grupo va siempre arriba, aunque el orden guardado diga otra cosa.
  return [...grupos.values()].sort((a, b) => (a.clave === "" ? -1 : b.clave === "" ? 1 : 0));
}
