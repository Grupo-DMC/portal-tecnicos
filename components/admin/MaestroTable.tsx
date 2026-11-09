"use client";

import { useMemo, useState } from "react";
import { sinTildes } from "@/lib/ui/formato";
import { useRouter } from "next/navigation";
import AdminHeader from "@/components/admin/AdminHeader";
import FiltrosBar, { type CampoFiltro, type ChipFiltro } from "@/components/admin/FiltrosBar";
import Dialogo, { type CampoDef, type FormValores } from "@/components/admin/Dialogo";
import Confirmar, { type ConfirmarCfg } from "@/components/ui/Confirmar";
import { Toast, useToast } from "@/components/ui/Toast";
import { puede, useReferencias } from "@/lib/ui/referencias";

export interface Column<T> {
  key: string;
  label: string;
  align?: "left" | "right";
  render?: (row: T) => React.ReactNode;
  /**
   * Hace la columna ordenable: el encabezado alterna entre «más primero»,
   * «menos primero» y el orden de siempre. Devuelve un número, de menor a mayor.
   */
  valorOrden?: (row: T) => number | string;
}

/** Filtros propios del maestro, además de la búsqueda (sucursales de un cliente). */
export interface FiltrosMaestro<T> {
  campos: CampoFiltro[];
  chips: ChipFiltro[];
  /** ¿La fila pasa los filtros? */
  pasa: (row: T) => boolean;
  limpiar: () => void;
}

export interface FieldConfig extends CampoDef {
  /** Oculta el campo según lo que se haya elegido en otro (rol, por ejemplo). */
  visible?: (form: FormValores) => boolean;
}

/**
 * Tabla de un maestro con su diálogo de alta y edición — el mismo patrón del
 * mockup para Técnicos, Usuarios, Clientes y Sucursales. La fila no abre nada:
 * el diálogo se abre solo desde el lápiz.
 *
 * Las filas llegan ya consultadas desde el servidor y no se guardan en estado
 * local: al grabar se escribe en SQL Server y se pide un refresh, para que lo
 * que se ve sea siempre lo que quedó en la base y no una copia optimista.
 */
export default function MaestroTable<T extends { id: number }>({
  title,
  modulo,
  pestanas,
  addLabel,
  editLabel,
  nota,
  columns,
  rows,
  fields,
  searchKeys,
  phBusqueda,
  toFormValues,
  guardarAction,
  emptyRow,
  validar,
  advertir,
  alCambiar,
  accionFila,
  filtros,
  resumen,
  accionesCabecera,
}: {
  title: string;
  /** El módulo de permisos: decide si se ofrecen "agregar" y "editar". */
  modulo: string;
  /** Pestañas de la sección, si el maestro comparte pantalla con otra vista. */
  pestanas?: React.ReactNode;
  addLabel: string;
  editLabel: string;
  nota?: string;
  columns: Column<T>[];
  rows: T[];
  fields: FieldConfig[];
  searchKeys: (row: T) => string;
  phBusqueda: string;
  toFormValues: (row: T) => FormValores;
  /** Persiste el formulario. `id` es null en un alta. */
  guardarAction: (id: number | null, form: FormValores) => Promise<{ ok: boolean; error?: string }>;
  emptyRow: FormValores;
  /**
   * Devuelve el texto del error, o null si el formulario está correcto.
   * `id` es null en un alta: sirve para no compararse consigo mismo al buscar
   * repetidos (un RUT que ya está en la fila que se está editando).
   */
  validar?: (form: FormValores, id: number | null) => string | null;
  /**
   * Un aviso que no impide guardar (una dirección que ya existe). Si devuelve
   * texto, se pide confirmación antes de guardar; null = nada que avisar.
   */
  advertir?: (form: FormValores, id: number | null) => string | null;
  /**
   * Lo que un campo arrastra al cambiar: devuelve los otros campos que hay que
   * pisar (elegir el mall llena el nombre de la sucursal). `id` es null en un alta.
   */
  alCambiar?: (k: string, valor: string | boolean, form: FormValores, id: number | null) => FormValores | null;
  /** Un botón propio del maestro en cada fila, antes del lápiz. */
  accionFila?: (row: T) => React.ReactNode;
  filtros?: FiltrosMaestro<T>;
  /** Cifras del maestro, entre la cabecera y la barra de búsqueda. */
  resumen?: React.ReactNode;
  /** Botones propios del maestro en la cabecera, antes del de agregar. */
  accionesCabecera?: React.ReactNode;
}) {
  const router = useRouter();
  const { toast, aviso } = useToast();
  const ref = useReferencias();
  const puedeCrear = puede(ref, `${modulo}.crear`);
  const puedeEditar = puede(ref, `${modulo}.editar`);
  const [busqueda, setBusqueda] = useState("");
  const [dialogo, setDialogo] = useState<{ id: number | null; form: FormValores } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [confirmar, setConfirmar] = useState<ConfirmarCfg | null>(null);
  /** Columna por la que se ordena y hacia dónde. Sin columna = el orden en que llegan. */
  const [orden, setOrden] = useState<{ key: string; dir: "desc" | "asc" } | null>(null);

  const filtradas = useMemo(() => {
    const q = sinTildes(busqueda.trim());
    const pasa = filtros?.pasa;
    const vistas = rows.filter((r) => (!pasa || pasa(r)) && (!q || sinTildes(searchKeys(r)).includes(q)));
    const col = orden ? columns.find((c) => c.key === orden.key) : undefined;
    if (!orden || !col?.valorOrden) return vistas;
    const valor = col.valorOrden;
    const signo = orden.dir === "desc" ? -1 : 1;
    return [...vistas].sort((a, b) => {
      const x = valor(a);
      const y = valor(b);
      return signo * (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "es"));
    });
  }, [rows, busqueda, searchKeys, filtros?.pasa, orden, columns]);

  /** Primer clic: los más primero; segundo: los menos primero; tercero: orden original. */
  const alternarOrden = (key: string) =>
    setOrden((prev) => (prev?.key !== key ? { key, dir: "desc" } : prev.dir === "desc" ? { key, dir: "asc" } : null));

  async function guardar(confirmado = false): Promise<void> {
    if (!dialogo) return;
    const error = validar?.(dialogo.form, dialogo.id);
    if (error) return aviso(error);

    const advertencia = confirmado ? null : advertir?.(dialogo.form, dialogo.id);
    if (advertencia) {
      return setConfirmar({
        titulo: "Ya existe esa dirección",
        texto: `${advertencia} ¿Quieres guardarlo de todas formas?`,
        cta: "Guardar de todas formas",
        accion: () => guardar(true),
      });
    }

    setGuardando(true);
    const res = await guardarAction(dialogo.id, dialogo.form);
    setGuardando(false);

    if (!res.ok) return aviso(res.error ?? "No se pudo guardar.");

    aviso(dialogo.id === null ? "Registro creado" : "Cambios guardados");
    setDialogo(null);
    router.refresh();
  }

  const camposVisibles = dialogo ? fields.filter((f) => !f.visible || f.visible(dialogo.form)) : [];

  return (
    <>
      <AdminHeader title={title} pestanas={pestanas}>
        {puedeCrear ? accionesCabecera : null}
        {puedeCrear ? (
          <button onClick={() => setDialogo({ id: null, form: emptyRow })} className="btn btn-primary">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span>{addLabel}</span>
          </button>
        ) : null}
      </AdminHeader>

      <div className="pb-10 animate-fade-in">
        {resumen}
        <FiltrosBar
          busqueda={busqueda}
          phBusqueda={phBusqueda}
          onBusqueda={setBusqueda}
          campos={filtros?.campos ?? []}
          chips={filtros?.chips ?? []}
          onLimpiar={() => {
            setBusqueda("");
            filtros?.limpiar();
          }}
          conteo={`${filtradas.length} ${filtradas.length === 1 ? "registro" : "registros"}`}
        />

        <div className="px-4 md:px-7 overflow-x-auto">
          <table className="table min-w-[640px]">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    style={{ textAlign: c.align ?? "left" }}
                    aria-sort={
                      orden?.key === c.key ? (orden.dir === "desc" ? "descending" : "ascending") : c.valorOrden ? "none" : undefined
                    }
                  >
                    {c.valorOrden ? (
                      <button
                        type="button"
                        onClick={() => alternarOrden(c.key)}
                        title={
                          orden?.key !== c.key
                            ? "Poner arriba los que tienen más"
                            : orden.dir === "desc"
                              ? "Ahora arriba los que tienen más · clic para poner arriba los que tienen menos"
                              : "Ahora arriba los que tienen menos · clic para quitar el orden"
                        }
                        className="inline-flex items-center gap-1.5 bg-transparent border-0 p-0 cursor-pointer font-[inherit] text-[inherit] uppercase tracking-[inherit] hover:opacity-70"
                      >
                        <span>{c.label}</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true">
                          {orden?.key === c.key ? (
                            <path d={orden.dir === "desc" ? "M12 5v14M6 13l6 6 6-6" : "M12 19V5M6 11l6-6 6 6"} />
                          ) : (
                            <path d="M8 9l4-4 4 4M8 15l4 4 4-4" opacity="0.45" />
                          )}
                        </svg>
                      </button>
                    ) : (
                      c.label
                    )}
                  </th>
                ))}
                <th style={{ width: accionFila ? 88 : 44 }} />
              </tr>
            </thead>
            <tbody>
              {filtradas.map((row) => (
                <tr key={row.id}>
                  {columns.map((c) => (
                    <td key={c.key} style={{ textAlign: c.align ?? "left" }}>
                      {c.render ? c.render(row) : String((row as unknown as Record<string, unknown>)[c.key] ?? "")}
                    </td>
                  ))}
                  <td className="text-right whitespace-nowrap max-lg:sticky max-lg:right-0 max-lg:bg-[var(--color-bg)]">
                    {accionFila ? <span className="inline-block mr-1.5 align-top">{accionFila(row)}</span> : null}
                    {puedeEditar ? (
                      <button
                        onClick={() => setDialogo({ id: row.id, form: toFormValues(row) })}
                        className="btn btn-icon w-8 h-8 border border-black/[.3]"
                        aria-label={`Editar ${title.toLowerCase()}`}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 20h4l10-10-4-4L4 16v4z" />
                          <path d="M14 6l4 4" />
                        </svg>
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtradas.length === 0 ? (
            <div className="py-14 text-center">
              <div className="font-extrabold text-lead mb-1.5">Nada que mostrar</div>
              <div className="text-meta opacity-66">Ajusta la búsqueda.</div>
            </div>
          ) : null}
        </div>
      </div>

      {dialogo ? (
        <Dialogo
          titulo={dialogo.id === null ? addLabel : editLabel}
          cta={dialogo.id === null ? addLabel.replace(/^Nuev[oa]/, "Crear") : "Guardar cambios"}
          nota={nota}
          campos={camposVisibles}
          form={dialogo.form}
          onCampo={(k, v) =>
            setDialogo({
              ...dialogo,
              form: { ...dialogo.form, [k]: v, ...alCambiar?.(k, v, dialogo.form, dialogo.id) },
            })
          }
          onCerrar={() => setDialogo(null)}
          onGuardar={() => guardar()}
          guardando={guardando}
        />
      ) : null}

      {confirmar ? <Confirmar cfg={confirmar} onCerrar={() => setConfirmar(null)} /> : null}
      <Toast texto={toast} variante="panel" />
    </>
  );
}
