import { trabajosDelMotivo } from "@/lib/ui/motivos";
import type {
  CatalogoEstadoProblema,
  CatalogoInterno,
  CatalogoMotivo,
  CatalogoCargo,
  CatalogoPendiente,
  CatalogoProblema,
  CatalogoSeccion,
  CatalogoTrabajo,
} from "@/lib/types";

// El modelo del editor del checklist: las filas del borrador local, cómo se
// arman desde lo que viene de la base y cómo se reordenan.

export interface Item {
  /** Clave estable de React. No viaja al servidor. */
  key: string;
  id: number | null;
  etiqueta: string;
  permiteCantidad: boolean;
  /**
   * Solo subtrabajos: la `key` del grupo adicional donde va. Null o ausente =
   * el primer grupo, el que titula `grupoLabel`.
   */
  subgrupo?: string | null;
}

/** Un grupo adicional de subtrabajos de un trabajo, con su propio nombre. */
export interface Subgrupo {
  key: string;
  nombre: string;
}

export interface Motivo {
  key: string;
  id: number | null;
  codigo: string | null;
  nombre: string;
}

/**
 * Un motivo de la Lista 1 con sus trabajos. La relación vive acá y solo acá:
 * el trabajo no sabe en qué motivos está, se calcula mirando los motivos.
 */
export interface MotivoConTrabajos extends Motivo {
  /** La `key` de su sección en la Lista 1. Null = sin sección. */
  seccion: string | null;
  /**
   * Las claves (`key`) de sus trabajos, en el orden en que el técnico los ve.
   * Por clave y no por nombre para que renombrar un trabajo no suelte el enlace.
   */
  trabajos: string[];
}

export interface Grupo {
  key: string;
  id: number | null;
  codigo: string | null;
  nombre: string;
  grupoLabel: string;
  /** Todos sus subdetalles o subtrabajos; los de un grupo adicional llevan `subgrupo`. */
  items: Item[];
  /** Solo los trabajos: los grupos de subtrabajos después del primero, en orden. */
  subgrupos?: Subgrupo[];
  /** Solo los trabajos: la `key` de su sección en la Lista 3. Null = sin sección. */
  seccion?: string | null;
}

/**
 * Una sección de la Lista 1 (agrupa motivos) o de la Lista 3 (agrupa trabajos).
 * Quien está en ella la nombra por su `key`, así renombrarla no suelta a nadie.
 */
export interface Seccion {
  key: string;
  nombre: string;
}

let contadorClave = 0;
export const nuevaClave = () => `k${(contadorClave += 1)}`;

export function aMotivos(lista: (CatalogoMotivo | CatalogoInterno | CatalogoPendiente | CatalogoEstadoProblema | CatalogoCargo)[]): Motivo[] {
  return lista.map((m) => ({ key: nuevaClave(), id: m.id, codigo: m.codigo, nombre: m.nombre }));
}

export function aSecciones(lista: CatalogoSeccion[]): Seccion[] {
  return lista.map((s) => ({ key: nuevaClave(), nombre: s.nombre }));
}

/** La `key` de la sección que tiene ese nombre, o null si no hay (o no se nombró). */
export function claveDeSeccion(secciones: Seccion[], nombre: string | null | undefined): string | null {
  const buscado = nombre?.trim().toLowerCase();
  if (!buscado) return null;
  return secciones.find((s) => s.nombre.trim().toLowerCase() === buscado)?.key ?? null;
}

/** Los motivos con sus trabajos ya ordenados, enlazados por la clave de cada trabajo. */
export function aMotivosConTrabajos(
  lista: CatalogoMotivo[],
  catalogo: CatalogoTrabajo[],
  grupos: Grupo[],
  secciones: Seccion[]
): MotivoConTrabajos[] {
  const clavePorCodigo = new Map(grupos.map((g) => [g.codigo, g.key]));
  return lista.map((m) => ({
    key: nuevaClave(),
    id: m.id,
    codigo: m.codigo,
    nombre: m.nombre,
    seccion: claveDeSeccion(secciones, m.seccion),
    trabajos: trabajosDelMotivo(catalogo, m.codigo)
      .map((t) => clavePorCodigo.get(t.codigo))
      .filter((k): k is string => Boolean(k)),
  }));
}

export function aGruposProblema(lista: CatalogoProblema[]): Grupo[] {
  return lista.map((p) => ({
    key: nuevaClave(),
    id: p.id,
    codigo: p.codigo,
    nombre: p.nombre,
    grupoLabel: p.grupoLabel ?? "",
    items: p.opciones.map((o) => ({
      key: nuevaClave(),
      id: o.id,
      etiqueta: o.etiqueta,
      permiteCantidad: o.permiteCantidad,
    })),
  }));
}

export function aGruposTrabajo(lista: CatalogoTrabajo[], secciones: Seccion[]): Grupo[] {
  return lista.map((t) => {
    // Los grupos adicionales salen de los nombres que traen sus subtrabajos.
    const subgrupos: Subgrupo[] = [];
    const clavePorNombre = new Map<string, string>();
    for (const s of t.subtrabajos) {
      const nombre = s.grupo?.trim();
      if (!nombre || clavePorNombre.has(nombre.toLowerCase())) continue;
      const key = nuevaClave();
      clavePorNombre.set(nombre.toLowerCase(), key);
      subgrupos.push({ key, nombre });
    }
    return {
      key: nuevaClave(),
      id: t.id,
      codigo: t.codigo,
      nombre: t.nombre,
      grupoLabel: t.grupoLabel ?? "",
      seccion: claveDeSeccion(secciones, t.seccion),
      subgrupos,
      items: t.subtrabajos.map((s) => ({
        key: nuevaClave(),
        id: s.id,
        etiqueta: s.etiqueta,
        permiteCantidad: s.permiteCantidad,
        subgrupo: s.grupo?.trim() ? (clavePorNombre.get(s.grupo.trim().toLowerCase()) ?? null) : null,
      })),
    };
  });
}

/**
 * Los subtrabajos del trabajo como viajan al servidor: primero los del primer
 * grupo y después los de cada grupo adicional, cada uno con el nombre de su
 * grupo. Un subtrabajo de un grupo que ya no existe cae en el primero.
 */
export function subtrabajosDelBorrador(t: Grupo) {
  const subgrupos = t.subgrupos ?? [];
  const existe = new Set(subgrupos.map((g) => g.key));
  const delGrupo = (key: string | null) =>
    t.items.filter((o) => (o.subgrupo && existe.has(o.subgrupo) ? o.subgrupo : null) === key);
  const nombreDe = new Map(subgrupos.map((g) => [g.key, g.nombre.trim() || null]));
  return [null, ...subgrupos.map((g) => g.key)].flatMap((key) =>
    delGrupo(key).map((o) => ({
      id: o.id,
      etiqueta: o.etiqueta,
      permiteCantidad: o.permiteCantidad,
      grupo: key ? (nombreDe.get(key) ?? null) : null,
    }))
  );
}

/**
 * Qué impide guardar los grupos de subtrabajos de un trabajo, o null si nada:
 * un grupo adicional con subtrabajos y sin nombre, o dos grupos con el mismo.
 */
export function problemaDeSubgrupos(t: Grupo): string | null {
  const usados = new Set<string>();
  const primero = t.grupoLabel.trim().toLowerCase();
  if (primero) usados.add(primero);
  for (const g of t.subgrupos ?? []) {
    const conItems = t.items.some((o) => o.subgrupo === g.key && o.etiqueta.trim());
    if (!conItems) continue;
    const nombre = g.nombre.trim().toLowerCase();
    if (!nombre) return `En «${t.nombre || "Sin nombre"}» hay un grupo de subtrabajos sin nombre.`;
    if (usados.has(nombre)) {
      return `En «${t.nombre || "Sin nombre"}» hay dos grupos de subtrabajos llamados «${g.nombre.trim()}».`;
    }
    usados.add(nombre);
  }
  return null;
}

/**
 * Motivos, trabajos y secciones nacen juntos: los motivos y los trabajos
 * apuntan a su sección, y los motivos a sus trabajos, por las claves que se
 * les acaban de dar.
 */
export function armarListas(
  motivos: CatalogoMotivo[],
  trabajos: CatalogoTrabajo[],
  seccionesMotivo: CatalogoSeccion[],
  seccionesTrabajo: CatalogoSeccion[]
) {
  const secMotivo = aSecciones(seccionesMotivo);
  const secTrabajo = aSecciones(seccionesTrabajo);
  const t = aGruposTrabajo(trabajos, secTrabajo);
  return {
    seccionesMotivo: secMotivo,
    seccionesTrabajo: secTrabajo,
    trabajos: t,
    motivos: aMotivosConTrabajos(motivos, trabajos, t, secMotivo),
  };
}

/** Mueve un elemento del arreglo `delta` posiciones sin salirse de los bordes. */
export function mover<T>(lista: T[], indice: number, delta: number): T[] {
  const destino = indice + delta;
  if (destino < 0 || destino >= lista.length) return lista;
  const copia = [...lista];
  const [fuera] = copia.splice(indice, 1);
  copia.splice(destino, 0, fuera);
  return copia;
}

/**
 * Saca el elemento de `desde` y lo mete justo antes de `ranura`.
 *
 * `ranura` es un hueco entre filas, no una fila: con 3 filas hay 4 huecos (0 a
 * 3). Por eso al arrastrar hacia abajo hay que descontar el que se sacó.
 */
export function reubicar<T>(lista: T[], desde: number, ranura: number): T[] {
  if (desde < 0 || desde >= lista.length) return lista;
  if (ranura === desde || ranura === desde + 1) return lista;
  const copia = [...lista];
  const [fuera] = copia.splice(desde, 1);
  copia.splice(desde < ranura ? ranura - 1 : ranura, 0, fuera);
  return copia;
}

/**
 * Lo mismo que `reubicar`, pero solo entre los elementos que cumplen `enGrupo`
 * (los de una sección): los demás no se mueven de su sitio. `desde` y `ranura`
 * cuentan dentro del grupo, no en la lista entera.
 */
export function reubicarEn<T>(lista: T[], enGrupo: (x: T) => boolean, desde: number, ranura: number): T[] {
  const sitios = lista.map((x, i) => (enGrupo(x) ? i : -1)).filter((i) => i >= 0);
  const del = sitios.map((i) => lista[i]);
  const nuevo = reubicar(del, desde, ranura);
  if (nuevo === del) return lista;
  const copia = [...lista];
  sitios.forEach((sitio, k) => {
    copia[sitio] = nuevo[k];
  });
  return copia;
}

/** `mover` dentro de una sección: ver `reubicarEn`. */
export function moverEn<T>(lista: T[], enGrupo: (x: T) => boolean, indice: number, delta: number): T[] {
  const sitios = lista.map((x, i) => (enGrupo(x) ? i : -1)).filter((i) => i >= 0);
  const del = sitios.map((i) => lista[i]);
  const nuevo = mover(del, indice, delta);
  if (nuevo === del) return lista;
  const copia = [...lista];
  sitios.forEach((sitio, k) => {
    copia[sitio] = nuevo[k];
  });
  return copia;
}

/** "Calibración" → "Calibración (copia)", "Calibración (copia 2)"… */
export function nombreDeCopia(nombre: string, usados: string[]): string {
  const base = `${nombre} (copia)`;
  const set = new Set(usados.map((n) => n.trim().toLowerCase()));
  if (!set.has(base.toLowerCase())) return base;
  let n = 2;
  while (set.has(`${nombre} (copia ${n})`.toLowerCase())) n += 1;
  return `${nombre} (copia ${n})`;
}

/** «A, B, C y 4 más»: para nombrar varias entradas en un aviso sin alargarlo. */
export function listaCorta(nombres: string[], max = 3): string {
  const limpios = nombres.map((n) => n.trim() || "Sin nombre");
  if (limpios.length <= max) return limpios.join(", ");
  return `${limpios.slice(0, max).join(", ")} y ${limpios.length - max} más`;
}
