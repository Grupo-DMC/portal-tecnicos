"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
import { Desplegable } from "@/components/admin/checklist/desplegables";
import { type Grupo, type Seccion, listaCorta, mover, moverEn, reubicarEn } from "@/components/admin/checklist/modelo";
import { Arrastrable, Bloque, CajaSeccion, Vacio } from "@/components/admin/checklist/piezas";
import type { ChecklistEditorApi } from "@/components/admin/checklist/useChecklistEditor";

// Las listas 1 a 3 del checklist: motivos con sus trabajos, tipos de problema
// (con sus categorías) y todos los trabajos (con sus secciones).

/** Lista 1 · Motivos y sus trabajos. */
export function ListaMotivos({ fv }: { fv: ChecklistEditorApi }) {
  const {
    motivos,
    seccionesMotivo,
    setSeccionesMotivo,
    plegadas,
    busqueda,
    editar,
    filtro,
    motivosVisibles,
    agregarMotivo,
    alternarSeccion,
    agregarSeccion,
    quitarSeccion,
    filaMotivo,
  } = fv;
  return (
    <>
      {/* Lista 1 · Motivos y sus trabajos */}
      <Bloque
        numero="Lista 1"
        clave="motivos"
        titulo="Motivos y sus trabajos"
        cta="Nuevo motivo de visita"
        onAgregar={() => agregarMotivo()}
        ctaExtra={{ label: "Nueva sección", onClick: () => agregarSeccion(setSeccionesMotivo) }}
      >
        {seccionesMotivo.length === 0 ? (
          <div className="flex flex-col gap-2.5">
            {motivosVisibles.map(({ m, i }) => filaMotivo(m, i, motivos.length, () => true, "todos"))}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {seccionesMotivo.map((sec, si) => {
              const miembros = motivos.filter((m) => m.seccion === sec.key);
              const visibles = motivosVisibles.filter(({ m }) => m.seccion === sec.key);
              if (filtro && visibles.length === 0) return null;
              return (
                <CajaSeccion
                  key={sec.key}
                  nombre={sec.nombre}
                  phNombre="Ej: Visitas"
                  cuenta={`${miembros.length} ${miembros.length === 1 ? "motivo" : "motivos"}`}
                  abierta={!plegadas.has(sec.key) || !!filtro}
                  onToggle={() => alternarSeccion(sec.key)}
                  onRenombrar={(nombre) =>
                    editar(setSeccionesMotivo, (prev) => prev.map((x) => (x.key === sec.key ? { ...x, nombre } : x)))
                  }
                  onSubir={si > 0 && !filtro ? () => editar(setSeccionesMotivo, (prev) => mover(prev, si, -1)) : undefined}
                  onBajar={
                    si < seccionesMotivo.length - 1 && !filtro
                      ? () => editar(setSeccionesMotivo, (prev) => mover(prev, si, 1))
                      : undefined
                  }
                  onQuitar={() => quitarSeccion(sec, "motivos")}
                  cta="Nuevo motivo de visita aquí"
                  onNuevo={() => agregarMotivo(sec.key)}
                >
                  {visibles.map(({ m }) =>
                    filaMotivo(
                      m,
                      miembros.findIndex((x) => x.key === m.key),
                      miembros.length,
                      (x) => x.seccion === sec.key,
                      sec.key
                    )
                  )}
                  {miembros.length === 0 ? (
                    <Vacio>Sección vacía: agrégale un motivo, o cámbialo de sección desde su fila.</Vacio>
                  ) : null}
                </CajaSeccion>
              );
            })}
            {(() => {
              const sueltos = motivos.filter((m) => !m.seccion);
              const visibles = motivosVisibles.filter(({ m }) => !m.seccion);
              if (sueltos.length === 0 || (filtro && visibles.length === 0)) return null;
              return (
                <CajaSeccion
                  fija
                  nombre="Sin sección"
                  cuenta={`${sueltos.length} ${sueltos.length === 1 ? "motivo" : "motivos"}`}
                  abierta={!plegadas.has("sin-motivo") || !!filtro}
                  onToggle={() => alternarSeccion("sin-motivo")}
                  cta="Nuevo motivo de visita aquí"
                  onNuevo={() => agregarMotivo(null)}
                >
                  {visibles.map(({ m }) =>
                    filaMotivo(
                      m,
                      sueltos.findIndex((x) => x.key === m.key),
                      sueltos.length,
                      (x) => !x.seccion,
                      "sin"
                    )
                  )}
                </CajaSeccion>
              );
            })()}
          </div>
        )}
        {motivos.length === 0 ? (
          <Vacio>Sin motivos: el técnico no podría clasificar la visita, y coordinación no puede agendarla.</Vacio>
        ) : null}
        {motivos.length > 0 && motivosVisibles.length === 0 ? (
          <Vacio>Ningún motivo ni trabajo coincide con «{busqueda}».</Vacio>
        ) : null}
      </Bloque>
    </>
  );
}

/**
 * Una lista partida en sus secciones (trabajos) o categorías (tipos de
 * problema): cada una en su caja plegable, con su nombre editable, su lugar
 * entre las demás y un atajo para crear dentro. Al final va lo que no está en
 * ninguna. Sin secciones la lista se ve plana, como siempre.
 *
 * Es la misma pieza para la Lista 2 y la Lista 3: la fila de cada entrada la
 * pone quien la usa. `fila` recibe el lugar de la entrada dentro de su caja
 * (para numerar y arrastrar sin salirse de ella).
 */
function PorSecciones<T extends { key: string; seccion?: string | null }>({
  fv,
  de,
  que,
  secciones,
  setSecciones,
  items,
  visibles,
  phSeccion,
  unidad,
  cta,
  onNuevo,
  fila,
}: {
  fv: ChecklistEditorApi;
  de: "trabajos" | "problemas";
  /** «sección» o «categoría». */
  que: string;
  secciones: Seccion[];
  setSecciones: Dispatch<SetStateAction<Seccion[]>>;
  items: T[];
  /** Lo que pasa el filtro de búsqueda, con su posición en `items`. */
  visibles: { t: T; i: number }[];
  phSeccion: string;
  /** Singular y plural de lo que agrupa: «trabajo», «trabajos». */
  unidad: [string, string];
  cta: string;
  onNuevo: (seccion: string | null) => void;
  fila: (t: T, local: number, totalLocal: number, enGrupo: (x: T) => boolean, claveGrupo: string) => ReactNode;
}) {
  const { plegadas, editar, filtro, alternarSeccion, quitarSeccion } = fv;
  const cuenta = (n: number) => `${n} ${n === 1 ? unidad[0] : unidad[1]}`;
  const Que = que.charAt(0).toUpperCase() + que.slice(1);

  if (secciones.length === 0) {
    return <>{visibles.map(({ t, i }) => fila(t, i, items.length, () => true, "todos"))}</>;
  }

  const sueltos = items.filter((t) => !t.seccion);
  const sueltosVisibles = visibles.filter(({ t }) => !t.seccion);
  const claveSin = `sin-${de}`;
  return (
    <div className="flex flex-col gap-6">
      {secciones.map((sec, si) => {
        const miembros = items.filter((t) => t.seccion === sec.key);
        const visiblesAca = visibles.filter(({ t }) => t.seccion === sec.key);
        if (filtro && visiblesAca.length === 0) return null;
        const enGrupo = (x: T) => x.seccion === sec.key;
        return (
          <CajaSeccion
            key={sec.key}
            nombre={sec.nombre}
            phNombre={phSeccion}
            cuenta={cuenta(miembros.length)}
            abierta={!plegadas.has(sec.key) || !!filtro}
            onToggle={() => alternarSeccion(sec.key)}
            onRenombrar={(nombre) =>
              editar(setSecciones, (prev) => prev.map((x) => (x.key === sec.key ? { ...x, nombre } : x)))
            }
            onSubir={si > 0 && !filtro ? () => editar(setSecciones, (prev) => mover(prev, si, -1)) : undefined}
            onBajar={
              si < secciones.length - 1 && !filtro ? () => editar(setSecciones, (prev) => mover(prev, si, 1)) : undefined
            }
            onQuitar={() => quitarSeccion(sec, de)}
            cta={`${cta} aquí`}
            onNuevo={() => onNuevo(sec.key)}
          >
            {visiblesAca.map(({ t }) =>
              fila(
                t,
                miembros.findIndex((x) => x.key === t.key),
                miembros.length,
                enGrupo,
                sec.key
              )
            )}
            {miembros.length === 0 ? (
              <Vacio>
                {Que} vacía: agrégale un {unidad[0]}, o cámbialo de {que} desde su fila.
              </Vacio>
            ) : null}
          </CajaSeccion>
        );
      })}
      {sueltos.length === 0 || (filtro && sueltosVisibles.length === 0) ? null : (
        <CajaSeccion
          fija
          nombre={`Sin ${que}`}
          cuenta={cuenta(sueltos.length)}
          abierta={!plegadas.has(claveSin) || !!filtro}
          onToggle={() => alternarSeccion(claveSin)}
          cta={`${cta} aquí`}
          onNuevo={() => onNuevo(null)}
        >
          {sueltosVisibles.map(({ t }) =>
            fila(
              t,
              sueltos.findIndex((x) => x.key === t.key),
              sueltos.length,
              (x) => !x.seccion,
              "sin"
            )
          )}
        </CajaSeccion>
      )}
    </div>
  );
}

/** Lista 2 · Tipos de problema, agrupados en categorías (migración 040). */
export function ListaTiposProblema({ fv }: { fv: ChecklistEditorApi }) {
  const {
    aviso,
    tipos,
    setTipos,
    seccionesProblema,
    setSeccionesProblema,
    abiertoTipo,
    setAbiertoTipo,
    setConfirmar,
    busqueda,
    editar,
    filtro,
    tiposVisibles,
    agregarGrupo,
    agregarSeccion,
    clonarGrupo,
    quitarGrupo,
  } = fv;

  const fila = (t: Grupo, local: number, totalLocal: number, enGrupo: (x: Grupo) => boolean, claveGrupo: string) => (
    <Arrastrable
      key={t.key}
      grupo={`tipo-${claveGrupo}`}
      indice={local}
      total={totalLocal}
      bloqueado={!!filtro}
      onReordenar={(desde, ranura) => editar(setTipos, (prev) => reubicarEn(prev, enGrupo, desde, ranura))}
      onMover={(d) => editar(setTipos, (prev) => moverEn(prev, enGrupo, local, d))}
      className="mb-2.5"
    >
      {(agarre) => (
        <Desplegable
          agarre={agarre}
          n={local + 1}
          grupo={t}
          phNombre="Ej: Antena no detecta etiquetas"
          abierto={abiertoTipo === t.key}
          onToggle={() => setAbiertoTipo(abiertoTipo === t.key ? null : t.key)}
          resumen={
            t.items.length
              ? `${t.items.length} ${t.items.length === 1 ? "subdetalle" : "subdetalles"}`
              : "Sin subdetalle · el técnico escribe qué encontró"
          }
          seccion={{
            etiqueta: "Categoría",
            valor: t.seccion ?? null,
            opciones: seccionesProblema,
            onCambiar: (k) => editar(setTipos, (prev) => prev.map((x) => (x.key === t.key ? { ...x, seccion: k } : x))),
          }}
          etiquetaSingular="subdetalle"
          etiquetaPlural="subdetalles"
          tituloSub="Título del subdetalle"
          phSub="Ej: Antena afectada"
          phNueva="Ej: Cable de slave a master"
          vacioSub="Sin subdetalles: en el celular este tipo pide directamente una descripción escrita."
          onCambiar={(fn) => editar(setTipos, (prev) => prev.map((x) => (x.key === t.key ? fn(x) : x)))}
          onClonar={() => clonarGrupo(t, tipos, setTipos, setAbiertoTipo)}
          onQuitar={() => quitarGrupo(t, setTipos, "tipo de problema")}
          onConfirmarQuitarItem={setConfirmar}
          onAviso={aviso}
        />
      )}
    </Arrastrable>
  );

  return (
    <Bloque
      numero="Lista 2"
      clave="problemas"
      titulo="Tipos de problema"
      cta="Nuevo tipo"
      onAgregar={() => agregarGrupo(setTipos, setAbiertoTipo)}
      ctaExtra={{ label: "Nueva categoría", onClick: () => agregarSeccion(setSeccionesProblema, "Categoría") }}
    >
      <PorSecciones<Grupo>
        fv={fv}
        de="problemas"
        que="categoría"
        secciones={seccionesProblema}
        setSecciones={setSeccionesProblema}
        items={tipos}
        visibles={tiposVisibles}
        phSeccion="Ej: Antenas"
        unidad={["tipo", "tipos"]}
        cta="Nuevo tipo"
        onNuevo={(sec) => agregarGrupo(setTipos, setAbiertoTipo, sec)}
        fila={fila}
      />
      {tipos.length === 0 ? (
        <Vacio grande>
          No hay tipos de problema. El técnico no podrá clasificar lo que encuentre hasta que agregues al menos uno.
        </Vacio>
      ) : null}
      {tipos.length > 0 && tiposVisibles.length === 0 ? (
        <Vacio>Ningún tipo de problema coincide con «{busqueda}».</Vacio>
      ) : null}
    </Bloque>
  );
}

/** Lista 3 · Todos los trabajos: la relación de la Lista 1, vista desde el trabajo. */
export function ListaTrabajos({ fv }: { fv: ChecklistEditorApi }) {
  const {
    seccionesTrabajo,
    setSeccionesTrabajo,
    trabajos,
    setTrabajos,
    setAbiertoTrabajo,
    busqueda,
    trabajosSinMotivo,
    trabajosVisibles,
    agregarGrupo,
    agregarSeccion,
    filaTrabajoL3,
  } = fv;
  return (
    <>
      {/* Lista 3 · Todos los trabajos (la misma relación de la Lista 1, vista desde el trabajo) */}
      <Bloque
        numero="Lista 3"
        clave="trabajos"
        titulo="Todos los trabajos"
        cta="Nuevo trabajo"
        onAgregar={() => agregarGrupo(setTrabajos, setAbiertoTrabajo)}
        ctaExtra={{ label: "Nueva sección", onClick: () => agregarSeccion(setSeccionesTrabajo) }}
      >
        {trabajosSinMotivo.length > 0 ? (
          <div className="mb-3 px-3.5 py-3 bg-[var(--color-accent-200)] border border-[var(--color-accent-300)] text-meta text-[var(--color-accent-800)] max-w-[720px]">
            {trabajosSinMotivo.length === 1 ? "1 trabajo no está" : `${trabajosSinMotivo.length} trabajos no están`} en
            ningún motivo y el técnico no {trabajosSinMotivo.length === 1 ? "lo" : "los"} ve:{" "}
            {listaCorta(trabajosSinMotivo.map((t) => t.nombre), 5)}. Despliégalo y marca sus motivos, o quítalo.
          </div>
        ) : null}
        <PorSecciones<Grupo>
          fv={fv}
          de="trabajos"
          que="sección"
          secciones={seccionesTrabajo}
          setSecciones={setSeccionesTrabajo}
          items={trabajos}
          visibles={trabajosVisibles}
          phSeccion="Ej: Trabajos de antenas"
          unidad={["trabajo", "trabajos"]}
          cta="Nuevo trabajo"
          onNuevo={(sec) => agregarGrupo(setTrabajos, setAbiertoTrabajo, sec)}
          // El orden de los trabajos lo da cada motivo: acá no se arrastran y
          // se numeran por su lugar en la lista entera.
          fila={(t) => filaTrabajoL3(t, trabajos.findIndex((x) => x.key === t.key))}
        />
        {trabajos.length === 0 ? (
          <Vacio grande>
            No hay trabajos. Créalos desde un motivo de la Lista 1: el técnico no podrá registrar qué hizo hasta que
            cada motivo tenga los suyos.
          </Vacio>
        ) : null}
        {trabajos.length > 0 && trabajosVisibles.length === 0 ? (
          <Vacio>Ningún trabajo coincide con «{busqueda}».</Vacio>
        ) : null}
      </Bloque>
    </>
  );
}
