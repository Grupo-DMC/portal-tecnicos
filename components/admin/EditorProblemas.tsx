"use client";

import type { Dispatch, SetStateAction } from "react";
import Tag from "@/components/Tag";
import SelectBuscable from "@/components/ui/SelectBuscable";
import EstadoProblemaTag from "@/components/EstadoProblemaTag";
import { BotonAgregar, BotonQuitar, ListaMarcable } from "@/components/admin/editar-acta/piezas";
import type { ProblemaForm } from "@/lib/ui/borrador";
import type { CatalogoProblema } from "@/lib/types";
import { agruparPorSeccion, hayAlgunaSeccion } from "@/lib/ui/secciones";

/** La clave de la categoría en el selector: «sin categoría» también se puede elegir. */
const SIN_CATEGORIA = "__sin";
const claveCategoria = (nombre: string | null | undefined) => nombre?.trim() || SIN_CATEGORIA;

/**
 * Los problemas de una visita puestos en campos: agregar, cambiar el tipo, marcar
 * qué equipos y cuántos, anotar qué se encontró, y quitar.
 *
 * Lo usan la edición del acta cerrada y el registro de problemas de una visita
 * que todavía no se cierra. No guarda nada: cada uno arma su envío con la lista
 * que este componente deja en `problemas`.
 *
 * Si el checklist tiene categorías (migración 040) el tipo se elige en dos
 * pasos, como en el celular: primero la categoría y después el tipo dentro de
 * ella. La categoría no se guarda: sale del tipo elegido.
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
  const conCategorias = hayAlgunaSeccion(catalogoProblema);
  const categorias = conCategorias ? agruparPorSeccion(catalogoProblema) : [];
  const tiposDe = (clave: string) => categorias.find((g) => claveCategoria(g.nombre) === clave)?.items ?? [];
  // El primero que se ofrece: el de la primera categoría, en el orden en que la ve el técnico.
  const primerTipo = conCategorias ? categorias[0]?.items[0] : catalogoProblema[0];
  const cambiarProblema = (id: number, cambio: Partial<ProblemaForm>) =>
    setProblemas((prev) => prev.map((p) => (p.id === id ? { ...p, ...cambio } : p)));

  return (
    <div className="flex flex-col gap-3.5">
      {problemas.map((p, i) => {
        const cat = catalogoProblema.find((c) => c.codigo === p.codigo);
        // Un tipo dado de baja no está en el catálogo: no tiene categoría que mostrar.
        const categoria = cat ? claveCategoria(cat.seccion) : "";
        const ofrecidos = conCategorias && cat ? tiposDe(categoria) : catalogoProblema;
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
              <div className={conCategorias ? "grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-[720px]" : "max-w-[440px]"}>
                {conCategorias ? (
                  <div className="field min-w-0">
                    <label htmlFor={`${prefijo}-cat-${p.id}`}>Categoría</label>
                    <SelectBuscable
                      id={`${prefijo}-cat-${p.id}`}
                      valor={categoria}
                      opciones={[
                        ...(cat ? [] : [{ v: "", t: "Tipo dado de baja" }]),
                        ...categorias.map((g) => ({ v: claveCategoria(g.nombre), t: g.nombre ?? "Sin categoría" })),
                      ]}
                      // Otra categoría trae sus propios tipos: queda elegido el primero de ella.
                      onChange={(v) => {
                        if (!v || v === categoria) return;
                        const primero = tiposDe(v)[0];
                        if (primero) cambiarProblema(p.id, { codigo: primero.codigo, items: [] });
                      }}
                      ariaLabel="Categoría del problema"
                    />
                  </div>
                ) : null}
                <div className="field min-w-0">
                  <label htmlFor={`${prefijo}-tipo-${p.id}`}>Tipo de problema</label>
                  <SelectBuscable
                    id={`${prefijo}-tipo-${p.id}`}
                    valor={p.codigo}
                    opciones={[
                      ...(cat ? [] : [{ v: p.codigo, t: p.codigo }]),
                      ...ofrecidos.map((c) => ({ v: c.codigo, t: c.nombre })),
                    ]}
                    // Cada tipo tiene sus propias opciones: al cambiarlo, lo marcado del anterior no aplica.
                    onChange={(v) => {
                      if (v && v !== p.codigo) cambiarProblema(p.id, { codigo: v, items: [] });
                    }}
                    ariaLabel="Tipo de problema"
                  />
                </div>
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
      {primerTipo ? (
        <BotonAgregar
          texto="Agregar un problema"
          onClick={() => {
            const id = nuevoId();
            setProblemas((prev) => [
              ...prev,
              { id, codigo: primerTipo.codigo, items: [], desc: "", sol: "", estado: "ABIERTO" },
            ]);
          }}
        />
      ) : null}
    </div>
  );
}
