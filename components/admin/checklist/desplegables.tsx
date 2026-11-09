"use client";

import { useState } from "react";
import SelectBuscable, { type OpcionSelect } from "@/components/ui/SelectBuscable";
import type { ConfirmarCfg } from "@/components/ui/Confirmar";
import {
  type Grupo,
  type Item,
  type MotivoConTrabajos,
  type Seccion,
  type Subgrupo,
  listaCorta,
  mover,
  moverEn,
  nombreDeCopia,
  nuevaClave,
  reubicar,
  reubicarEn,
} from "@/components/admin/checklist/modelo";
import {
  Arrastrable,
  Codigo,
  IconoBasura,
  IconoClonar,
  ModoItem,
  Numero,
  Vacio,
} from "@/components/admin/checklist/piezas";

// Las filas que se despliegan del editor del checklist: un tipo de problema o
// un trabajo con sus subdetalles, y un motivo con los trabajos que lleva.

/** Fila de un tipo/trabajo con sus subdetalles escondidos tras "Ver…". */
export function Desplegable({
  agarre,
  n,
  grupo,
  phNombre,
  abierto,
  onToggle,
  resumen,
  etiquetaSingular,
  etiquetaPlural,
  tituloSub,
  phSub,
  phNueva,
  vacioSub,
  onCambiar,
  onClonar,
  onQuitar,
  onConfirmarQuitarItem,
  onAviso,
  enMotivos,
  seccion,
  alerta,
  quitarLabel = "Quitar de la lista",
  nota,
  conSubgrupos = false,
}: {
  /** La manilla de arrastre, que pone el contenedor Arrastrable. Null = no se reordena. */
  agarre: React.ReactNode;
  n: number;
  grupo: Grupo;
  phNombre: string;
  abierto: boolean;
  onToggle: () => void;
  resumen: string;
  etiquetaSingular: string;
  etiquetaPlural: string;
  tituloSub: string;
  phSub: string;
  phNueva: string;
  vacioSub: string;
  onCambiar: (fn: (g: Grupo) => Grupo) => void;
  onClonar: () => void;
  onQuitar: () => void;
  onConfirmarQuitarItem: (cfg: ConfirmarCfg) => void;
  onAviso: (texto: string) => void;
  /** Solo en «Todos los trabajos»: los motivos entre los que se elige dónde se ofrece. */
  enMotivos?: { lista: MotivoConTrabajos[]; onAlternar: (motivoKey: string) => void };
  /** Solo en «Todos los trabajos»: en qué sección está el trabajo y las que hay para elegir. */
  seccion?: { valor: string | null; opciones: Seccion[]; onCambiar: (key: string | null) => void };
  /** Resalta el resumen: algo falta (un trabajo sin motivo). */
  alerta?: boolean;
  quitarLabel?: string;
  /** Una línea arriba de los subdetalles, al desplegar. */
  nota?: React.ReactNode;
  /** Solo trabajos: permite repartir los subtrabajos en varios grupos con nombre. */
  conSubgrupos?: boolean;
}) {
  // El texto de "nuevo subdetalle" de cada grupo: "" el primero, la clave del
  // grupo adicional los demás.
  const [nuevas, setNuevas] = useState<Record<string, string>>({});
  const subgrupos = conSubgrupos ? (grupo.subgrupos ?? []) : [];
  const enGrupo = (sub: string | null) => (o: Item) => (o.subgrupo ?? null) === sub;

  function agregarItem(sub: string | null) {
    const etiqueta = (nuevas[sub ?? ""] ?? "").trim();
    if (!etiqueta) return onAviso(`Escribe el ${etiquetaSingular} antes de agregarlo`);
    // La etiqueta es única en todo el trabajo, no solo en su grupo: el acta
    // guarda el subtrabajo marcado por su etiqueta.
    if (grupo.items.some((o) => o.etiqueta.trim().toLowerCase() === etiqueta.toLowerCase())) {
      return onAviso(
        subgrupos.length
          ? `Ese ${etiquetaSingular} ya está en este trabajo (en este u otro grupo)`
          : `Ese ${etiquetaSingular} ya está en la lista`
      );
    }
    onCambiar((g) => ({
      ...g,
      // El técnico necesita un título para el grupo: si no lo pusieron, se deja
      // uno genérico al aparecer el primer subdetalle.
      grupoLabel: sub ? g.grupoLabel : g.grupoLabel || (etiquetaSingular === "subtrabajo" ? "Subtrabajo" : "Detalle"),
      items: [...g.items, { key: nuevaClave(), id: null, etiqueta, permiteCantidad: false, subgrupo: sub }],
    }));
    setNuevas((prev) => ({ ...prev, [sub ?? ""]: "" }));
  }

  /** Copia el subdetalle justo debajo, en su mismo grupo, para editarle el nombre. */
  function copiarItem(o: Item) {
    onCambiar((g) => {
      const copia: Item = {
        key: nuevaClave(),
        id: null,
        etiqueta: nombreDeCopia(o.etiqueta.trim() || "Sin nombre", g.items.map((x) => x.etiqueta)),
        permiteCantidad: o.permiteCantidad,
        subgrupo: o.subgrupo ?? null,
      };
      const i = g.items.findIndex((x) => x.key === o.key);
      return { ...g, items: [...g.items.slice(0, i + 1), copia, ...g.items.slice(i + 1)] };
    });
  }

  function agregarSubgrupo() {
    const key = nuevaClave();
    onCambiar((g) => ({ ...g, subgrupos: [...(g.subgrupos ?? []), { key, nombre: "" }] }));
  }

  function quitarSubgrupo(sub: Subgrupo) {
    const cuantos = grupo.items.filter(enGrupo(sub.key)).length;
    const quitar = () =>
      onCambiar((g) => ({
        ...g,
        subgrupos: (g.subgrupos ?? []).filter((x) => x.key !== sub.key),
        items: g.items.filter((o) => o.subgrupo !== sub.key),
      }));
    if (cuantos === 0) return quitar();
    onConfirmarQuitarItem({
      titulo: "¿Quitar este grupo?",
      texto: `«${sub.nombre.trim() || "Sin nombre"}» y sus ${cuantos} ${cuantos === 1 ? etiquetaSingular : etiquetaPlural} dejan de aparecer dentro de «${grupo.nombre}». No se borran: las actas ya firmadas los siguen mostrando. El cambio se aplica al guardar.`,
      cta: "Quitar grupo",
      accion: quitar,
    });
  }

  /** La lista de un grupo con su fila para agregar. `sub` null = el primer grupo. */
  const listaDe = (sub: string | null) => {
    const propios = grupo.items.filter(enGrupo(sub));
    const clave = sub ?? "";
    return (
      <>
        <div className="flex flex-col gap-2 mt-4 max-w-[640px]">
          {propios.map((o, j) => (
            // Cada grupo es su propio corral: un subdetalle no se puede
            // arrastrar desde acá hasta otro grupo, tipo o trabajo.
            <Arrastrable
              key={o.key}
              grupo={`sub-${grupo.key}-${clave}`}
              indice={j}
              total={propios.length}
              bloqueado={false}
              onReordenar={(desde, ranura) =>
                onCambiar((g) => ({ ...g, items: reubicarEn(g.items, enGrupo(sub), desde, ranura) }))
              }
              onMover={(d) => onCambiar((g) => ({ ...g, items: moverEn(g.items, enGrupo(sub), j, d) }))}
              className="flex gap-2 items-center"
            >
              {(agarreItem) => (
                <>
                  {agarreItem}
                  <input
                    value={o.etiqueta}
                    onChange={(e) =>
                      onCambiar((g) => ({
                        ...g,
                        items: g.items.map((x) => (x.key === o.key ? { ...x, etiqueta: e.target.value } : x)),
                      }))
                    }
                    placeholder={phNueva}
                    className="input flex-1 min-w-0 min-h-10 bg-[var(--color-bg)]"
                    aria-label={etiquetaSingular}
                    autoComplete="off"
                  />
                  <ModoItem
                    permiteCantidad={o.permiteCantidad}
                    onCambiar={(v) =>
                      onCambiar((g) => ({
                        ...g,
                        items: g.items.map((x) => (x.key === o.key ? { ...x, permiteCantidad: v } : x)),
                      }))
                    }
                  />
                  <button
                    onClick={() => copiarItem(o)}
                    className="btn btn-icon w-10 h-10 flex-none border border-black/[.3]"
                    aria-label={`Copiar ${etiquetaSingular}`}
                    title={`Copiar este ${etiquetaSingular} (con su modo y en su mismo grupo)`}
                  >
                    <IconoClonar />
                  </button>
                  <button
                    onClick={() =>
                      onConfirmarQuitarItem({
                        titulo: `¿Quitar este ${etiquetaSingular}?`,
                        texto: `«${o.etiqueta || "Sin nombre"}» deja de aparecer dentro de «${grupo.nombre}». No se borra: las actas ya firmadas lo siguen mostrando. El cambio se aplica al guardar.`,
                        cta: `Quitar ${etiquetaSingular}`,
                        accion: () => onCambiar((g) => ({ ...g, items: g.items.filter((x) => x.key !== o.key) })),
                      })
                    }
                    className="btn btn-icon w-10 h-10 flex-none border border-black/[.3]"
                    aria-label={`Quitar ${etiquetaSingular}`}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </>
              )}
            </Arrastrable>
          ))}
          {propios.length === 0 ? (
            <div className="px-3.5 py-2.5 border border-dashed border-black/[.35] text-meta opacity-68">
              {sub ? `Grupo sin ${etiquetaPlural}: agrega al menos uno o quita el grupo.` : vacioSub}
            </div>
          ) : null}
        </div>

        <div className="flex gap-2 mt-3 max-w-[640px]">
          <input
            value={nuevas[clave] ?? ""}
            onChange={(e) => setNuevas((prev) => ({ ...prev, [clave]: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              agregarItem(sub);
            }}
            placeholder={phNueva}
            className="input flex-1 min-w-0 bg-[var(--color-bg)]"
            aria-label={`Nuevo ${etiquetaSingular}`}
            autoComplete="off"
          />
          <button onClick={() => agregarItem(sub)} className="btn btn-secondary shrink-0">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span>Agregar</span>
          </button>
        </div>
      </>
    );
  };

  return (
    <div className="border border-black/[.35] bg-[var(--color-surface-3)]">
      <div
        className="flex items-center gap-2.5 flex-wrap px-3 py-2.5"
        style={{ background: abierto ? "#e3e1e5" : "var(--color-surface)" }}
      >
        {agarre}
        <Numero n={n} />
        <input
          value={grupo.nombre}
          onChange={(e) => onCambiar((g) => ({ ...g, nombre: e.target.value }))}
          placeholder={phNombre}
          className="input flex-1 min-w-[200px] min-h-10 font-extrabold text-body bg-[var(--color-bg)]"
          aria-label={phNombre}
          autoComplete="off"
        />
        <Codigo codigo={grupo.codigo} />
        <span
          className={`text-cap leading-[1.2] ${alerta ? "font-extrabold text-[var(--color-danger-800)]" : "opacity-62"}`}
        >
          {resumen}
        </span>
        <button
          onClick={onToggle}
          aria-label={abierto ? `Ocultar ${etiquetaPlural}` : `Ver ${etiquetaPlural}`}
          className="min-h-[34px] flex items-center gap-2 px-2.5 flex-none bg-transparent border border-black/[.3] cursor-pointer text-[var(--color-text)] text-cap leading-none hover:bg-black/[.07]"
        >
          <span>{abierto ? `Ocultar ${etiquetaPlural}` : `Ver ${etiquetaPlural}`}</span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            className="transition-transform duration-150"
            style={{ transform: `rotate(${abierto ? 180 : 0}deg)` }}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        <button
          onClick={onClonar}
          className="btn btn-icon w-8.5 h-8.5 flex-none border border-black/[.3]"
          aria-label={`Clonar ${etiquetaSingular === "subtrabajo" ? "trabajo" : "tipo de problema"}`}
          title="Clonar con todos sus subdetalles"
        >
          <IconoClonar />
        </button>
        <button
          onClick={onQuitar}
          className="btn btn-icon w-8.5 h-8.5 flex-none border border-black/[.3]"
          aria-label={quitarLabel}
          title={quitarLabel}
        >
          <IconoBasura />
        </button>
      </div>

      {abierto ? (
        <div className="px-3.5 pt-3.5 pb-4 border-t border-black/[.25]">
          {nota ? <p className="m-0 mb-3.5 text-cap opacity-72 max-w-[72ch]">{nota}</p> : null}
          {seccion && seccion.opciones.some((o) => o.nombre.trim()) ? (
            <div className="mb-4.5">
              <label className="block text-cap opacity-62 mb-1.5">Sección</label>
              <select
                value={seccion.valor ?? ""}
                onChange={(e) => seccion.onCambiar(e.target.value || null)}
                className="input min-h-10 max-w-[320px] bg-[var(--color-bg)]"
                aria-label="Sección del trabajo"
              >
                <option value="">Sin sección</option>
                {seccion.opciones
                  .filter((o) => o.nombre.trim())
                  .map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.nombre}
                    </option>
                  ))}
              </select>
            </div>
          ) : null}
          {enMotivos ? (
            <div className="mb-4.5">
              <div className="block text-cap opacity-62 mb-1.5">
                Aparece bajo estos motivos
              </div>
              <div className="flex flex-wrap gap-1.5 max-w-[720px]">
                {enMotivos.lista
                  .filter((m) => m.nombre.trim())
                  .map((m) => {
                    const activo = m.trabajos.includes(grupo.key);
                    return (
                      <button
                        key={m.key}
                        type="button"
                        role="checkbox"
                        aria-checked={activo}
                        onClick={() => enMotivos.onAlternar(m.key)}
                        className="min-h-[34px] px-3 border cursor-pointer text-cap leading-[1.2]"
                        style={{
                          background: activo ? "var(--color-accent)" : "transparent",
                          color: activo ? "#fff" : "var(--color-text)",
                          borderColor: activo ? "var(--color-accent)" : "rgba(31,28,33,.3)",
                          fontWeight: activo ? 800 : 400,
                        }}
                      >
                        {m.nombre}
                      </button>
                    );
                  })}
              </div>
              <p className="m-0 mt-1.5 text-cap opacity-62">
                {enMotivos.lista.some((m) => m.trabajos.includes(grupo.key))
                  ? "El técnico solo ve este trabajo bajo los motivos marcados. Al marcar uno, el trabajo entra al final de ese motivo."
                  : "Sin ningún motivo marcado, el técnico no ve este trabajo."}
              </p>
            </div>
          ) : null}
          {conSubgrupos ? (
            <div className="flex flex-col gap-3.5">
              <div className="border border-black/[.25] bg-[var(--color-surface)] px-3 pt-3 pb-3.5">
                <label className="block text-cap opacity-62 mb-1.5">
                  {subgrupos.length ? "Grupo 1 · nombre" : tituloSub}
                </label>
                <input
                  value={grupo.grupoLabel}
                  onChange={(e) => onCambiar((g) => ({ ...g, grupoLabel: e.target.value }))}
                  placeholder={phSub}
                  className="input max-w-[420px] min-h-10 bg-[var(--color-bg)]"
                  aria-label={subgrupos.length ? "Nombre del grupo 1" : tituloSub}
                  autoComplete="off"
                />
                {listaDe(null)}
              </div>
              {subgrupos.map((sg, k) => (
                <div key={sg.key} className="border border-black/[.25] bg-[var(--color-surface)] px-3 pt-3 pb-3.5">
                  <label className="block text-cap opacity-62 mb-1.5">Grupo {k + 2} · nombre</label>
                  <div className="flex gap-2 items-center max-w-[640px]">
                    <input
                      value={sg.nombre}
                      onChange={(e) =>
                        onCambiar((g) => ({
                          ...g,
                          subgrupos: (g.subgrupos ?? []).map((x) =>
                            x.key === sg.key ? { ...x, nombre: e.target.value } : x
                          ),
                        }))
                      }
                      placeholder="Ej: Cables cambiados"
                      className="input flex-1 min-w-0 max-w-[420px] min-h-10 bg-[var(--color-bg)]"
                      aria-label={`Nombre del grupo ${k + 2}`}
                      autoComplete="off"
                    />
                    <button
                      onClick={() => quitarSubgrupo(sg)}
                      className="btn btn-icon w-10 h-10 flex-none border border-black/[.3] ml-auto"
                      aria-label={`Quitar el grupo ${k + 2}`}
                      title="Quitar este grupo con sus subtrabajos"
                    >
                      <IconoBasura />
                    </button>
                  </div>
                  {listaDe(sg.key)}
                </div>
              ))}
              <div>
                <button onClick={agregarSubgrupo} className="btn btn-secondary">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  <span>Agregar otro grupo de {etiquetaPlural}</span>
                </button>
                <p className="m-0 mt-1.5 text-cap opacity-62 max-w-[72ch]">
                  Cada grupo sale en el celular con su nombre y sus propias opciones. Un mismo {etiquetaSingular} no
                  puede repetirse en dos grupos del trabajo.
                </p>
              </div>
            </div>
          ) : (
            <>
              <label className="block text-cap opacity-62 mb-1.5">{tituloSub}</label>
              <input
                value={grupo.grupoLabel}
                onChange={(e) => onCambiar((g) => ({ ...g, grupoLabel: e.target.value }))}
                placeholder={phSub}
                className="input max-w-[420px] min-h-10 bg-[var(--color-bg)]"
                autoComplete="off"
              />
              {listaDe(null)}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Un motivo de la Lista 1, con sus trabajos adentro.
 *
 * Plegado es una fila con el nombre y cuántos trabajos tiene. Desplegado
 * muestra esos trabajos en el orden en que los ve el técnico (se reordenan
 * arrastrando), cada uno con sus subtrabajos editables ahí mismo, y abajo las
 * tres formas de sumar trabajos: uno que ya existe, uno nuevo, o todos los de
 * otro motivo parecido.
 */
export function MotivoDesplegable({
  agarre,
  n,
  motivo,
  motivos,
  secciones,
  onCambiarSeccion,
  trabajos,
  motivosDeTrabajo,
  abierto,
  onToggle,
  abiertoEnMotivo,
  setAbiertoEnMotivo,
  onRenombrar,
  onOrdenar,
  onAlternar,
  onCrearTrabajo,
  onCopiarDe,
  onCambiarTrabajo,
  onClonarTrabajo,
  onClonar,
  onQuitar,
  onConfirmar,
  onAviso,
}: {
  agarre: React.ReactNode;
  n: number;
  motivo: MotivoConTrabajos;
  motivos: MotivoConTrabajos[];
  /** Las secciones de la Lista 1, para moverlo de una a otra. */
  secciones: Seccion[];
  onCambiarSeccion: (key: string | null) => void;
  trabajos: Grupo[];
  motivosDeTrabajo: Map<string, MotivoConTrabajos[]>;
  abierto: boolean;
  onToggle: () => void;
  abiertoEnMotivo: string | null;
  setAbiertoEnMotivo: (v: string | null) => void;
  onRenombrar: (nombre: string) => void;
  /** Cambia la lista de claves de trabajo del motivo (para reordenar). */
  onOrdenar: (fn: (claves: string[]) => string[]) => void;
  /** Pone o saca un trabajo de este motivo. */
  onAlternar: (trabajoKey: string) => void;
  onCrearTrabajo: () => void;
  onCopiarDe: (motivoKey: string) => void;
  onCambiarTrabajo: (trabajoKey: string, fn: (g: Grupo) => Grupo) => void;
  onClonarTrabajo: (t: Grupo) => void;
  onClonar: () => void;
  onQuitar: () => void;
  onConfirmar: (cfg: ConfirmarCfg) => void;
  onAviso: (texto: string) => void;
}) {
  const porClave = new Map(trabajos.map((t) => [t.key, t]));
  const suyos = motivo.trabajos.map((k) => porClave.get(k)).filter((t): t is Grupo => Boolean(t));
  const disponibles: OpcionSelect[] = trabajos
    .filter((t) => !motivo.trabajos.includes(t.key) && t.nombre.trim())
    .map((t) => ({ v: t.key, t: t.nombre }));
  const parecidos = motivos.filter((m) => m.key !== motivo.key && m.trabajos.length > 0 && m.nombre.trim());
  const sinTrabajos = suyos.length === 0;

  return (
    <div className="border border-black/[.35] bg-[var(--color-surface-3)]">
      <div
        className="flex items-center gap-2.5 flex-wrap px-3 py-2.5"
        style={{ background: abierto ? "#e3e1e5" : "var(--color-surface)" }}
      >
        {agarre}
        <Numero n={n} />
        <input
          value={motivo.nombre}
          onChange={(e) => onRenombrar(e.target.value)}
          placeholder="Ej: Calibración de las antenas"
          className="input flex-1 min-w-[200px] min-h-10 font-extrabold text-body bg-[var(--color-bg)]"
          aria-label="Nombre del motivo"
          autoComplete="off"
        />
        <Codigo codigo={motivo.codigo} />
        {secciones.some((x) => x.nombre.trim()) ? (
          <select
            value={motivo.seccion ?? ""}
            onChange={(e) => onCambiarSeccion(e.target.value || null)}
            className="input min-h-[34px] max-w-[160px] flex-none text-cap bg-[var(--color-bg)]"
            aria-label="Sección del motivo"
            title="Cambiar el motivo de sección"
          >
            <option value="">Sin sección</option>
            {secciones
              .filter((x) => x.nombre.trim())
              .map((x) => (
                <option key={x.key} value={x.key}>
                  {x.nombre}
                </option>
              ))}
          </select>
        ) : null}
        <span
          className={`text-cap leading-[1.2] ${sinTrabajos ? "font-extrabold text-[var(--color-accent-800)]" : "opacity-62"}`}
          title={sinTrabajos ? "Una visita con solo este motivo no se puede cerrar: el técnico no tiene qué registrar." : undefined}
        >
          {sinTrabajos ? "Sin trabajos" : `${suyos.length} ${suyos.length === 1 ? "trabajo" : "trabajos"}`}
        </span>
        <button
          onClick={onToggle}
          aria-expanded={abierto}
          className="min-h-[34px] flex items-center gap-2 px-2.5 flex-none bg-transparent border border-black/[.3] cursor-pointer text-[var(--color-text)] text-cap leading-none hover:bg-black/[.07]"
        >
          <span>{abierto ? "Ocultar trabajos" : "Ver trabajos"}</span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            className="transition-transform duration-150"
            style={{ transform: `rotate(${abierto ? 180 : 0}deg)` }}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        <button
          onClick={onClonar}
          className="btn btn-icon w-8.5 h-8.5 flex-none border border-black/[.3]"
          aria-label="Clonar motivo"
          title="Clonar con todos sus trabajos"
        >
          <IconoClonar />
        </button>
        <button
          onClick={onQuitar}
          className="btn btn-icon w-8.5 h-8.5 flex-none border border-black/[.3]"
          aria-label="Quitar motivo"
          title="Quitar motivo"
        >
          <IconoBasura />
        </button>
      </div>

      {abierto ? (
        <div className="px-3.5 pt-3.5 pb-4 border-t border-black/[.25]">
          <div className="text-cap opacity-62 mb-2">
            Trabajos que el técnico puede registrar bajo este motivo
          </div>
          <div className="flex flex-col gap-2">
            {suyos.map((t, j) => {
              const otros = (motivosDeTrabajo.get(t.key) ?? []).filter((m) => m.key !== motivo.key);
              const clave = `${motivo.key}:${t.key}`;
              return (
                <Arrastrable
                  key={t.key}
                  grupo={`mt-${motivo.key}`}
                  indice={j}
                  total={suyos.length}
                  bloqueado={false}
                  onReordenar={(desde, ranura) => onOrdenar((claves) => reubicar(claves, desde, ranura))}
                  onMover={(d) => onOrdenar((claves) => mover(claves, j, d))}
                >
                  {(agarreT) => (
                    <Desplegable
                      agarre={agarreT}
                      n={j + 1}
                      grupo={t}
                      phNombre="Ej: Calibración de antenas"
                      abierto={abiertoEnMotivo === clave}
                      onToggle={() => setAbiertoEnMotivo(abiertoEnMotivo === clave ? null : clave)}
                      resumen={
                        (t.items.length
                          ? `${t.items.length} ${t.items.length === 1 ? "subtrabajo" : "subtrabajos"}`
                          : "Sin subtrabajo") +
                        (otros.length ? ` · también en ${otros.length} ${otros.length === 1 ? "motivo" : "motivos"}` : "")
                      }
                      nota={
                        otros.length
                          ? `Este trabajo también está en ${listaCorta(otros.map((m) => m.nombre))}. El nombre y los subtrabajos que cambies acá cambian allá también; si este motivo necesita una versión distinta, clónalo.`
                          : undefined
                      }
                      conSubgrupos
                      etiquetaSingular="subtrabajo"
                      etiquetaPlural="subtrabajos"
                      tituloSub="Título del subtrabajo"
                      phSub="Ej: Repuesto cambiado"
                      phNueva="Ej: Tarjeta electrónica"
                      vacioSub="Sin subtrabajos: en el celular este trabajo se agrega directo, con un toque."
                      onCambiar={(fn) => onCambiarTrabajo(t.key, fn)}
                      onClonar={() => onClonarTrabajo(t)}
                      quitarLabel="Sacar de este motivo"
                      onQuitar={() => {
                        onAlternar(t.key);
                        onAviso(
                          otros.length
                            ? `«${t.nombre}» salió de este motivo; sigue en ${otros.length} ${otros.length === 1 ? "otro" : "otros"}`
                            : `«${t.nombre || "Sin nombre"}» salió de este motivo y no queda en ninguno: el técnico no lo verá`
                        );
                      }}
                      onConfirmarQuitarItem={onConfirmar}
                      onAviso={onAviso}
                    />
                  )}
                </Arrastrable>
              );
            })}
            {sinTrabajos ? (
              <Vacio>
                Sin trabajos: el técnico no tendría qué registrar bajo este motivo y una visita con solo este motivo no
                se podría cerrar. Agrega al menos uno.
              </Vacio>
            ) : null}
          </div>

          <div className="flex items-end gap-2.5 flex-wrap mt-3.5 max-w-[860px]">
            <div className="flex-1 min-w-[240px]">
              <div className="text-cap opacity-62 mb-1.5">Agregar un trabajo que ya existe</div>
              {disponibles.length ? (
                <SelectBuscable
                  valor=""
                  opciones={disponibles}
                  onChange={(k) => k && onAlternar(k)}
                  placeholder="Escribe para buscar el trabajo…"
                  ariaLabel="Agregar un trabajo que ya existe"
                />
              ) : (
                <div className="text-cap opacity-62 min-h-10 flex items-center">Ya tiene todos los trabajos del checklist.</div>
              )}
            </div>
            <button onClick={onCrearTrabajo} className="btn btn-secondary shrink-0 min-h-10">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span>Crear trabajo nuevo</span>
            </button>
            {parecidos.length ? (
              <select
                value=""
                onChange={(e) => {
                  const origen = e.target.value;
                  if (!origen) return;
                  const desde = motivos.find((m) => m.key === origen);
                  onConfirmar({
                    titulo: "¿Copiar los trabajos de otro motivo?",
                    texto: `Se suman a «${motivo.nombre || "este motivo"}» los trabajos de «${desde?.nombre}» que todavía no tiene, al final de la lista. Son los mismos trabajos, no copias: después puedes sacar los que sobren. El cambio se aplica al guardar.`,
                    cta: "Copiar trabajos",
                    accion: () => onCopiarDe(origen),
                  });
                }}
                className="input min-h-10 max-w-[280px] bg-[var(--color-bg)]"
                aria-label="Copiar los trabajos de otro motivo"
              >
                <option value="">Copiar los de otro motivo…</option>
                {parecidos.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.nombre} ({m.trabajos.length})
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
