"use client";

import { useFiltroRecordado } from "@/lib/ui/filtro-recordado";
import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import MaestroTable from "@/components/admin/MaestroTable";
import { useSucursalForm } from "@/components/admin/maestros/useSucursalForm";
import SucursalesLoteDialogo from "@/components/admin/maestros/SucursalesLoteDialogo";
import { Toast, useToast } from "@/components/ui/Toast";
import Tag from "@/components/Tag";
import { useReferencias } from "@/lib/ui/referencias";
import { REGIONES } from "@/lib/ui/regiones";
import { calibracionDeSucursal, siNoAForm } from "@/lib/ui/sino";
import { ETIQUETA_GARANTIA, enGarantia, garantiaDe, type EstadoGarantia } from "@/lib/ui/garantia";
import { hoyISO, fechaCL } from "@/lib/ui/fecha";
import { nombreLocal } from "@/lib/ui/nombre-local";
import type { Cliente, Mall, Sucursal } from "@/lib/types";

/** El filtro de una marca opcional: "" = todas, y si no, sí / no / sin indicar. */
const OPCIONES_FILTRO_SI_NO = [
  { v: "", t: "Todas" },
  { v: "si", t: "Sí" },
  { v: "no", t: "No" },
  { v: "nd", t: "Sin indicar" },
];
const pasaSiNo = (filtro: string, v: boolean | null | undefined) =>
  !filtro || (filtro === "nd" ? v === null || v === undefined : siNoAForm(v) === filtro);
const textoSiNo = (filtro: string) => OPCIONES_FILTRO_SI_NO.find((o) => o.v === filtro)?.t ?? "";

/** Para el filtro: cubierta, vencida o sin plazo definido (= «sin indicar»). */
function garantiaParaFiltro(s: Sucursal, cliente: Cliente | undefined, hoy: string): boolean | null {
  const g = garantiaDe(s, cliente, hoy);
  return enGarantia(g) ? true : g.estado === "VENCIDA" ? false : null;
}

const VARIANTE_GARANTIA: Record<EstadoGarantia, "accent" | "outline" | "dark" | "neutral"> = {
  VIGENTE: "accent",
  POR_VENCER: "dark",
  VENCIDA: "outline",
  SIN_FECHA: "neutral",
  SIN_GARANTIA: "neutral",
};

export default function SucursalesTable({
  sucursales,
  clientes,
  malls,
  clienteInicial = "",
}: {
  sucursales: Sucursal[];
  clientes: Cliente[];
  malls: Mall[];
  /** Llega con «Ver locales» desde Clientes: la lista abre filtrada a ese cliente. */
  clienteInicial?: string;
}) {
  const router = useRouter();
  const { toast, aviso } = useToast();
  const { marcas } = useReferencias();
  const [lote, setLote] = useState(false);
  const form = useSucursalForm({ sucursales, clientes, malls });
  const nombreCliente = (id: number) => clientes.find((c) => c.id === id)?.nombreFantasia ?? "—";
  const calibracion = (s: Sucursal) => calibracionDeSucursal(s, clientes.find((c) => c.id === s.clienteId));
  const nombreMarca = (id: number) => marcas.find((m) => m.id === id)?.nombre ?? null;
  const nombreMall = (id?: number | null) => malls.find((m) => m.id === id)?.nombre ?? "";
  const hoy = hoyISO();
  const garantia = (s: Sucursal) => garantiaDe(s, clientes.find((c) => c.id === s.clienteId), hoy);

  const [fCliente, setFCliente] = useFiltroRecordado("cliente", clientes.some((c) => String(c.id) === clienteInicial) ? (clienteInicial ?? "") : "");
  const [fGarantia, setFGarantia] = useFiltroRecordado("garantia");
  const [fRemota, setFRemota] = useFiltroRecordado("remota");
  const [fCalibracion, setFCalibracion] = useFiltroRecordado("calibracion");
  const [fMall, setFMall] = useFiltroRecordado("mall");
  const [fRegion, setFRegion] = useFiltroRecordado("region");
  const [fComuna, setFComuna] = useFiltroRecordado("comuna");
  const regiones = useMemo(
    () => [...new Set(sucursales.map((s) => s.region).filter(Boolean))].sort((a, b) => REGIONES.indexOf(a) - REGIONES.indexOf(b)),
    [sucursales]
  );
  const comunas = useMemo(
    () =>
      [...new Set(sucursales.filter((s) => !fRegion || s.region === fRegion).map((s) => s.comuna).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "es")
      ),
    [sucursales, fRegion]
  );
  const mallsConLocales = useMemo(() => {
    const usados = new Set(sucursales.map((s) => s.mallId).filter(Boolean));
    return malls.filter((m) => usados.has(m.id));
  }, [sucursales, malls]);
  const pasa = useCallback(
    (s: Sucursal) =>
      (!fCliente || String(s.clienteId) === fCliente) &&
      (!fMall || (fMall === "sin" ? !s.mallId : String(s.mallId) === fMall)) &&
      (!fRegion || s.region === fRegion) &&
      (!fComuna || s.comuna === fComuna) &&
      pasaSiNo(fGarantia, garantiaParaFiltro(s, clientes.find((c) => c.id === s.clienteId), hoy)) &&
      pasaSiNo(fRemota, s.remota) &&
      pasaSiNo(fCalibracion, calibracionDeSucursal(s, clientes.find((c) => c.id === s.clienteId)).valor),
    [fCliente, fMall, fRegion, fComuna, fGarantia, fRemota, fCalibracion, clientes, hoy]
  );

  const tabla = (
    <MaestroTable<Sucursal>
      accionesCabecera={
        <button onClick={() => setLote(true)} className="btn btn-secondary">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M4 6h16M4 12h16M4 18h10M18 16v6M15 19h6" />
          </svg>
          <span>Alta masiva</span>
        </button>
      }
      title="Sucursales"
      modulo="sucursales"
      addLabel="Nueva sucursal"
      editLabel="Editar sucursal"
      nota="La sucursal siempre pertenece a un cliente y no se puede dejar sin él. El mall es opcional: elegirlo le pone a la sucursal la ubicación del mall y, si es nueva, también su nombre: «Cliente · Marca · Mall»."
      phBusqueda="Buscar sucursal, comuna, mall, código…"
      rows={sucursales}
      filtros={{
        campos: [
          {
            id: "f-cliente",
            label: "Cliente",
            valor: fCliente,
            opciones: [{ v: "", t: "Todos" }, ...clientes.map((c) => ({ v: String(c.id), t: c.nombreFantasia }))],
            onChange: setFCliente,
          },
          {
            id: "f-mall",
            label: "Mall",
            valor: fMall,
            opciones: [
              { v: "", t: "Todos" },
              { v: "sin", t: "Sin mall (a la calle)" },
              ...mallsConLocales.map((m) => ({ v: String(m.id), t: m.nombre })),
            ],
            onChange: setFMall,
          },
          {
            id: "f-region",
            label: "Región",
            valor: fRegion,
            opciones: [{ v: "", t: "Todas" }, ...regiones.map((r) => ({ v: r, t: r }))],
            // Al cambiar de región, una comuna que no es de ella ya no aplica.
            onChange: (v) => {
              setFRegion(v);
              setFComuna("");
            },
          },
          {
            id: "f-comuna",
            label: "Comuna",
            valor: fComuna,
            opciones: [{ v: "", t: "Todas" }, ...comunas.map((c) => ({ v: c, t: c }))],
            onChange: setFComuna,
          },
          { id: "f-garantia", label: "En garantía", valor: fGarantia, opciones: OPCIONES_FILTRO_SI_NO, onChange: setFGarantia },
          { id: "f-remota", label: "Remota", valor: fRemota, opciones: OPCIONES_FILTRO_SI_NO, onChange: setFRemota },
          {
            id: "f-calibracion",
            label: "Plan de calibración",
            valor: fCalibracion,
            opciones: OPCIONES_FILTRO_SI_NO,
            onChange: setFCalibracion,
          },
        ],
        chips: [
          ...(fCliente ? [{ label: `Cliente: ${nombreCliente(Number(fCliente))}`, onQuitar: () => setFCliente("") }] : []),
          ...(fMall
            ? [{ label: `Mall: ${fMall === "sin" ? "sin mall" : nombreMall(Number(fMall))}`, onQuitar: () => setFMall("") }]
            : []),
          ...(fRegion ? [{ label: `Región: ${fRegion}`, onQuitar: () => { setFRegion(""); setFComuna(""); } }] : []),
          ...(fComuna ? [{ label: `Comuna: ${fComuna}`, onQuitar: () => setFComuna("") }] : []),
          ...(fGarantia ? [{ label: `Garantía: ${textoSiNo(fGarantia)}`, onQuitar: () => setFGarantia("") }] : []),
          ...(fRemota ? [{ label: `Remota: ${textoSiNo(fRemota)}`, onQuitar: () => setFRemota("") }] : []),
          ...(fCalibracion
            ? [{ label: `Calibración: ${textoSiNo(fCalibracion)}`, onQuitar: () => setFCalibracion("") }]
            : []),
        ],
        pasa,
        limpiar: () => {
          setFCliente("");
          setFMall("");
          setFRegion("");
          setFComuna("");
          setFGarantia("");
          setFRemota("");
          setFCalibracion("");
        },
      }}
      accionFila={(s) => (
        <Link
          href={`/admin/sucursales/${s.id}`}
          className="btn btn-icon w-8 h-8 border border-black/[.3]"
          aria-label={`Ficha de ${s.nombre}`}
          title="Ver ficha y visitas"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7" />
          </svg>
        </Link>
      )}
      searchKeys={(s) => `${s.nombre} ${s.codigo ?? ""} ${s.comuna} ${s.direccion} ${nombreCliente(s.clienteId)} ${nombreMarca(s.marcaId) ?? ""} ${s.region} ${nombreMall(s.mallId)}`}
      columns={[
        {
          key: "nombre",
          label: "Sucursal",
          render: (s) =>
            nombreLocal({ cliente: nombreCliente(s.clienteId), marca: nombreMarca(s.marcaId), sucursal: s.nombre, mall: nombreMall(s.mallId) }),
        },
        { key: "cliente", label: "Cliente", render: (s) => nombreCliente(s.clienteId) },
        { key: "mall", label: "Mall", render: (s) => nombreMall(s.mallId) || "—" },
        { key: "codigo", label: "Código", render: (s) => s.codigo ?? "—" },
        { key: "direccion", label: "Dirección" },
        { key: "comuna", label: "Comuna" },
        {
          key: "detalle",
          label: "Detalle",
          render: (s) => {
            const cal = calibracion(s);
            const g = garantia(s);
            return s.fechaInstalacion || (s.remota ?? null) !== null || g.origen !== null || cal.valor !== null ? (
              <div className="flex flex-wrap gap-1 max-w-[240px]">
                {g.origen !== null ? <Tag variant={VARIANTE_GARANTIA[g.estado]}>{ETIQUETA_GARANTIA[g.estado]}</Tag> : null}
                {s.remota === true ? <Tag variant="dark">Remota</Tag> : null}
                {s.remota === false ? <Tag variant="outline">Presencial</Tag> : null}
                {cal.valor === true ? (
                  <span title={cal.porCliente ? "Su cliente está en plan de calibración" : "En plan de calibración por su cuenta"}>
                    <Tag variant="accent">{cal.porCliente ? "Calibración · cliente" : "Calibración"}</Tag>
                  </span>
                ) : null}
                {cal.valor === false ? <Tag variant="outline">Sin calibración</Tag> : null}
                {s.fechaInstalacion ? (
                  <div className="basis-full text-cap opacity-66 tabular-nums">Instalada el {fechaCL(s.fechaInstalacion)}</div>
                ) : null}
              </div>
            ) : (
              <span className="opacity-50">—</span>
            );
          },
        },
        {
          key: "activo",
          label: "Estado",
          render: (s) => (
            <>
              <Tag variant={s.activo ? "accent" : "neutral"}>{s.activo ? "Activa" : "Inactiva"}</Tag>
              {!s.activo && s.motivoInactivo ? (
                <div className="text-cap leading-[1.4] opacity-66 mt-1 max-w-[260px]">{s.motivoInactivo}</div>
              ) : null}
            </>
          ),
        },
      ]}
      {...form}
    />
  );

  return (
    <>
      {tabla}
      {lote ? (
        <SucursalesLoteDialogo
          sucursales={sucursales}
          clientes={clientes}
          malls={malls}
          clienteInicial={fCliente}
          onCerrar={() => setLote(false)}
          onHecho={(mensaje, guardado) => {
            aviso(mensaje);
            if (guardado) router.refresh();
          }}
        />
      ) : null}
      <Toast texto={toast} variante="panel" />
    </>
  );
}
