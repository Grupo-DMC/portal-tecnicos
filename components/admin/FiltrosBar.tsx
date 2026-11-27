"use client";

import DatePicker from "@/components/ui/DatePicker";
import { dmyAIso, isoADmy } from "@/lib/ui/fecha";
import { useState } from "react";
import SelectBuscable from "@/components/ui/SelectBuscable";
import SelectMultiple from "@/components/ui/SelectMultiple";
import Icono from "@/components/ui/Icono";

export interface CampoFiltro {
  id: string;
  label: string;
  valor: string;
  opciones: { v: string; t: string }[];
  onChange: (valor: string) => void;
  /**
   * "fecha" pinta un selector de día en vez de la lista; `opciones` va vacío.
   * "multi" deja marcar varias opciones: usa `valores` y `onChangeMulti`.
   */
  tipo?: "fecha" | "multi";
  valores?: string[];
  onChangeMulti?: (valores: string[]) => void;
  /** Lo que se lee en un campo "multi" con nada marcado. */
  textoVacio?: string;
}

export interface ChipFiltro {
  label: string;
  onQuitar: () => void;
}

/**
 * Barra de filtros del panel: búsqueda, botón que despliega los selectores,
 * chips con lo que está filtrado y el conteo. Los selectores viven escondidos
 * hasta que se aprieta "Colocar filtro", igual que en el mockup.
 */
export default function FiltrosBar({
  busqueda,
  phBusqueda,
  onBusqueda,
  campos,
  chips,
  onLimpiar,
  conteo,
  acciones,
}: {
  /** Si se omite, la barra va sin caja de búsqueda (vista de problemas). */
  busqueda?: string;
  phBusqueda?: string;
  onBusqueda?: (valor: string) => void;
  campos: CampoFiltro[];
  chips: ChipFiltro[];
  onLimpiar: () => void;
  conteo: string;
  /** Botones extra a la derecha de los chips (por ejemplo "Nueva visita"). */
  acciones?: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="barra">
      <div className="v-bar">
        {onBusqueda ? (
          <label className="v-search">
            <Icono nombre="buscar" />
            <input
              type="search"
              value={busqueda ?? ""}
              onChange={(e) => onBusqueda(e.target.value)}
              placeholder={phBusqueda}
              aria-label={phBusqueda}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </label>
        ) : (
          <span />
        )}
        <div className="v-tools">
          <span className="pb-count">{conteo}</span>
          {campos.length > 0 ? (
            <button
              type="button"
              className={chips.length ? "v-fbtn on" : "v-fbtn"}
              aria-expanded={abierto}
              aria-label={chips.length ? `Filtros, ${chips.length} ${chips.length === 1 ? "puesto" : "puestos"}` : "Filtros"}
              onClick={() => setAbierto((v) => !v)}
            >
              <Icono nombre="filtros" />
              Filtros
              {chips.length ? <span className="v-fbadge">{chips.length}</span> : null}
            </button>
          ) : null}
          {acciones}
        </div>
      </div>

      {abierto && campos.length > 0 ? (
        <div className="v-filters">
          <div className="v-fgrid">
            {campos.map((c) => (
              <div key={c.id} className="fr">
                <label htmlFor={c.id}>{c.label}</label>
                {/* Con muchas opciones (sucursales, tecnicos) se escribe y
                    la lista filtra al momento; con pocas basta el nativo. */}
                {c.tipo === "fecha" ? (
                  <DatePicker modo="single" id={c.id} valor={isoADmy(c.valor)} maximo={null} onChange={(v) => c.onChange(dmyAIso(v))} />
                ) : c.tipo === "multi" ? (
                  <SelectMultiple
                    id={c.id}
                    valores={c.valores ?? []}
                    opciones={c.opciones}
                    onChange={(v) => c.onChangeMulti?.(v)}
                    textoVacio={c.textoVacio ?? "Todos"}
                    ariaLabel={c.label}
                  />
                ) : c.opciones.length >= 7 ? (
                  <SelectBuscable
                    id={c.id}
                    valor={c.valor}
                    opciones={c.opciones}
                    onChange={c.onChange}
                    ariaLabel={c.label}
                    placeholder="Escribe para filtrar..."
                  />
                ) : (
                  <select id={c.id} value={c.valor} onChange={(e) => c.onChange(e.target.value)} className="input">
                    {c.opciones.map((o) => (
                      <option key={o.v} value={o.v}>
                        {o.t}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>
          <div className="v-fbtns">
            <button type="button" onClick={onLimpiar} className="btn-out sm">
              Limpiar
            </button>
            <button type="button" onClick={() => setAbierto(false)} className="btn-pri sm">
              Ver resultados
            </button>
          </div>
        </div>
      ) : null}

      {chips.length > 0 ? (
        <div className="v-active">
          {chips.map((c) => (
            <span key={c.label} className="fchip">
              {c.label}
              <button type="button" onClick={c.onQuitar} aria-label={`Quitar ${c.label}`}>
                ✕
              </button>
            </span>
          ))}
          <button type="button" onClick={onLimpiar} className="enlace">
            Quitar todos
          </button>
        </div>
      ) : null}
    </div>
  );
}
