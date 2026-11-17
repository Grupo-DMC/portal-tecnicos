"use client";

import type { Dispatch, SetStateAction } from "react";
import Tag from "@/components/Tag";
import SelectBuscable from "@/components/ui/SelectBuscable";
import EstadoProblemaTag from "@/components/EstadoProblemaTag";
import { BotonAgregar, BotonQuitar, ListaMarcable } from "@/components/admin/editar-acta/piezas";
import type { ProblemaForm } from "@/lib/ui/borrador";
import type { CatalogoProblema } from "@/lib/types";

/**
 * Los problemas de una visita puestos en campos: agregar, cambiar el tipo, marcar
 * qué equipos y cuántos, anotar qué se encontró, y quitar.
 *
 * Lo usan la edición del acta cerrada y el registro de problemas de una visita
 * que todavía no se cierra. No guarda nada: cada uno arma su envío con la lista
 * que este componente deja en `problemas`.
 */
export default function EditorProblemas({
  catalogoProblema,
  problemas,
  setProblemas,
  nuevoId,
  vacio,
  prefijo = "ea",
}: {
  catalogoProblema: CatalogoProblema[];
  problemas: ProblemaForm[];
  setProblemas: Dispatch<SetStateAction<ProblemaForm[]>>;
  /** Un id nuevo para la fila que se agrega (solo identifica la fila en pantalla). */
  nuevoId: () => number;
  /** Lo que se dice cuando no hay ninguno. */
  vacio: string;
  /** Para que los `id` de los campos no choquen si hay dos editores en la página. */
  prefijo?: string;
}) {
  const nombreProblema = (codigo: string) => catalogoProblema.find((p) => p.codigo === codigo)?.nombre ?? codigo;
  const cambiarProblema = (id: number, cambio: Partial<ProblemaForm>) =>
    setProblemas((prev) => prev.map((p) => (p.id === id ? { ...p, ...cambio } : p)));

  return (
    <div className="flex flex-col gap-3.5">
      {problemas.map((p, i) => {
        const cat = catalogoProblema.find((c) => c.codigo === p.codigo);
        const opciones = [
          ...(cat?.opciones ?? []).map((o) => ({ etiqueta: o.etiqueta, conCantidad: o.permiteCantidad })),
          ...p.items
            .filter((it) => !(cat?.opciones ?? []).some((o) => o.etiqueta === it.etiqueta))
            .map((it) => ({ etiqueta: it.etiqueta, conCantidad: true })),
        ];
        return (
          <div key={p.id} className="border border-[var(--color-divider-soft)] bg-white">
            <div className="flex items-center gap-2.5 pl-4 pr-2 py-2 border-b border-[var(--color-divider-faint)]">
              <span className="w-6 h-6 flex-none grid place-items-center bg-[var(--color-text)] text-[var(--color-bg)] font-extrabold text-cap tabular-nums">
                {i + 1}
              </span>
              <div className="font-extrabold text-body leading-[1.3] flex-1 min-w-0 truncate">
                {nombreProblema(p.codigo)}
              </div>
              {p.dbId ? <EstadoProblemaTag estado={p.estado} /> : <Tag variant="accent">Nuevo</Tag>}
              <BotonQuitar
                etiqueta={`Quitar el problema ${i + 1}`}
                onClick={() => setProblemas((prev) => prev.filter((x) => x.id !== p.id))}
              />
            </div>
            <div className="px-4 py-4 flex flex-col gap-4">
              <div className="field max-w-[440px]">
                <label htmlFor={`${prefijo}-tipo-${p.id}`}>Tipo de problema</label>
                <SelectBuscable
                  id={`${prefijo}-tipo-${p.id}`}
                  valor={p.codigo}
                  opciones={[
                    ...(cat ? [] : [{ v: p.codigo, t: p.codigo }]),
                    ...catalogoProblema.map((c) => ({ v: c.codigo, t: c.nombre })),
                  ]}
                  // Cada tipo tiene sus propias opciones: al cambiarlo, lo marcado del anterior no aplica.
                  onChange={(v) => {
                    if (v && v !== p.codigo) cambiarProblema(p.id, { codigo: v, items: [] });
                  }}
                  ariaLabel="Tipo de problema"
                />
              </div>
              {opciones.length > 0 ? (
                <div>
                  <div className="text-cap opacity-62 mb-2">{cat?.grupoLabel ?? "Detalle"}</div>
                  <ListaMarcable
                    opciones={opciones}
                    marcados={p.items}
                    onCambiar={(fn) => cambiarProblema(p.id, { items: fn(p.items) })}
                  />
                </div>
              ) : null}
              <div className="field">
                <label htmlFor={`${prefijo}-desc-${p.id}`}>{opciones.length > 0 ? "Nota · opcional" : "Qué se encontró"}</label>
                <textarea
                  id={`${prefijo}-desc-${p.id}`}
                  className="input leading-[1.5]"
                  style={{ minHeight: 68 }}
                  rows={2}
                  value={p.desc}
                  onChange={(e) => cambiarProblema(p.id, { desc: e.target.value })}
                />
              </div>
            </div>
          </div>
        );
      })}
      {problemas.length === 0 ? <div className="text-meta opacity-66">{vacio}</div> : null}
      {catalogoProblema.length > 0 ? (
        <BotonAgregar
          texto="Agregar un problema"
          onClick={() => {
            const id = nuevoId();
            setProblemas((prev) => [
              ...prev,
              { id, codigo: catalogoProblema[0].codigo, items: [], desc: "", sol: "", estado: "ABIERTO" },
            ]);
          }}
        />
      ) : null}
    </div>
  );
}
