"use client";

import { guardarSucursalAction } from "@/app/actions/maestros";
import type { FieldConfig } from "@/components/admin/MaestroTable";
import type { FormValores } from "@/components/admin/Dialogo";
import { conMismaDireccion } from "@/lib/ui/direcciones";
import { useReferencias } from "@/lib/ui/referencias";
import { REGIONES } from "@/lib/ui/regiones";
import { OPCIONES_SI_NO, formASiNo, mesesDeForm, siNoAForm } from "@/lib/ui/sino";
import { nombreLocal } from "@/lib/ui/nombre-local";
import type { Cliente, Mall, Sucursal } from "@/lib/types";

export interface SucursalForm {
  fields: FieldConfig[];
  validar: (f: FormValores, id: number | null) => string | null;
  advertir: (f: FormValores, id: number | null) => string | null;
  alCambiar: (k: string, v: string | boolean, f: FormValores, id: number | null) => FormValores | null;
  toFormValues: (s: Sucursal) => FormValores;
  guardarAction: (id: number | null, f: FormValores) => Promise<{ ok: boolean; error?: string; id?: number }>;
  emptyRow: FormValores;
}

/**
 * El formulario de una sucursal —campos, validación, aviso de dirección repetida,
 * lo que arrastra el mall y el guardado—. Lo usan Maestros › Sucursales y el
 * «Crear uno nuevo en este mall» de Malls: es el mismo formulario en los dos.
 */
export function useSucursalForm({
  sucursales,
  clientes,
  malls,
}: {
  sucursales: Sucursal[];
  clientes: Cliente[];
  malls: Mall[];
}) {
  const { marcas } = useReferencias();
  /** La primera marca activa del cliente: lo que queda elegido al cambiar de cliente. */
  const marcaInicial = (clienteId: string | number) =>
    String(marcas.find((m) => m.activo && String(m.clienteId) === String(clienteId))?.id ?? "");
  /** ¿El cliente elegido en el formulario está en plan? Entonces la tienda también, sin preguntar. */
  const clienteEnPlan = (clienteId: string | boolean | undefined) =>
    clientes.find((c) => String(c.id) === String(clienteId))?.planCalibracion === true;
  const formulario: SucursalForm = {
    fields: [
          {
            k: "clienteId",
            label: "Cliente",
            tipo: "select",
            alta: "cliente",
            opciones: clientes.map((c) => ({ v: String(c.id), t: c.nombreFantasia })),
          },
          {
            k: "marcaId",
            label: "Marca",
            tipo: "select",
            buscable: true,
            alta: "marca",
            opcionesSegun: (f) =>
              marcas
                .filter((m) => String(m.clienteId) === String(f.clienteId))
                .map((m) => ({ v: String(m.id), t: m.activo ? m.nombre : `${m.nombre} · inactiva` })),
          },
          {
            k: "mallId",
            label: "Mall (opcional)",
            tipo: "select",
            buscable: true,
            alta: "mall",
            opciones: [
              { v: "", t: "Sin mall (a la calle)" },
              ...malls.map((m) => ({ v: String(m.id), t: m.activo ? m.nombre : `${m.nombre} · inactivo` })),
            ],
            ayuda: "Al elegirlo, la sucursal toma la dirección, la comuna y la región del mall. Sin mall, escribe la dirección de la calle.",
          },
          {
            // Con mall y marca el nombre es «Cliente · Marca · Mall»: pedirlo sobra.
            k: "nombre",
            label: "Nombre de la sucursal",
            visible: (f) => !(f.mallId && f.marcaId),
          },
          { k: "codigo", label: "Código interno (opcional)", ph: "MS-118" },
          { k: "telefono", label: "Teléfono", tipo: "tel", ph: "+56 2 2299 4100" },
          { k: "direccion", label: "Dirección", span: 2 },
          { k: "comuna", label: "Comuna" },
          { k: "region", label: "Región", tipo: "select", opciones: REGIONES.map((r) => ({ v: r, t: r })) },
          { k: "fechaInstalacion", label: "Fecha de instalación (opcional)", tipo: "date" },
          { k: "remota", label: "¿Es remota? (opcional)", tipo: "select", opciones: OPCIONES_SI_NO },
          {
            k: "garantiaMeses",
            label: "Garantía propia, en meses (opcional)",
            ph: "12",
            ayuda: "Cuenta desde la fecha de instalación. Si la dejas vacía rige el plan de garantía de su cliente, si lo tiene.",
          },
          {
            k: "planCalibracion",
            label: "¿En plan de calibración? (opcional)",
            tipo: "select",
            opciones: OPCIONES_SI_NO,
            ayuda: "Su cliente no está en plan, pero esta tienda puede estarlo por su cuenta.",
            visible: (f) => !clienteEnPlan(f.clienteId),
          },
          {
            // Solo informa: no se guarda. Lo que manda es el plan del cliente.
            k: "calibracionPorCliente",
            label: "¿En plan de calibración?",
            tipo: "select",
            opciones: [{ v: "", t: "Sí, por el plan de su cliente" }],
            ayuda: "Todas las tiendas de un cliente en plan de calibración lo están. Se cambia en el cliente.",
            visible: (f) => clienteEnPlan(f.clienteId),
          },
          { k: "activo", label: "Estado", tipo: "toggle" },
          {
            k: "motivoInactivo",
            label: "¿Por qué se desactiva?",
            tipo: "area",
            span: 2,
            ph: "Cierre de la tienda, cambio de local, término de contrato…",
            ayuda: "Obligatorio para dejar la sucursal inactiva. Se borra si se reactiva.",
            visible: (f) => f.activo === false,
          },
          { k: "notas", label: "Notas", tipo: "area", span: 2, ph: "Lo que conviene saber de esta tienda" },
        ],
    validar: (f) => {
          if (!String(f.nombre).trim() || !f.clienteId) return "Nombre y cliente son obligatorios";
          if (!f.marcaId) return "Elige la marca";
          if (mesesDeForm(f.garantiaMeses) === undefined) return "La garantía va en meses, entre 1 y 240";
          if (!f.mallId && !String(f.direccion).trim()) return "Sin mall, la sucursal necesita su dirección de calle";
          if (f.activo === false && !String(f.motivoInactivo ?? "").trim()) {
            return "Explica por qué se desactiva la sucursal";
          }
          return null;
        },
    advertir: (f, id) => {
          if (id !== null) return null;
          const delCliente = sucursales.filter((s) => String(s.clienteId) === String(f.clienteId));
          const otra = conMismaDireccion(delCliente, String(f.direccion), String(f.comuna));
          return otra ? `El cliente ya tiene la sucursal «${otra.nombre}» en «${otra.direccion}».` : null;
        },
    alCambiar: (k, v, f, id): Record<string, string | boolean> | null => {
          const sig = { ...f, [k]: v };
          // Otro cliente, otras marcas: la elegida ya no vale.
          const marcaId = k === "clienteId" ? marcaInicial(String(v)) : String(sig.marcaId ?? "");
          const mall = malls.find((m) => String(m.id) === String(sig.mallId));
          const nombre =
            id === null && mall
              ? nombreLocal({
                  cliente: clientes.find((c) => String(c.id) === String(sig.clienteId))?.nombreFantasia,
                  marca: marcas.find((m) => String(m.id) === marcaId)?.nombre,
                  sucursal: "",
                  mall: mall.nombre,
                })
              : null;
          if (k === "clienteId") return { marcaId, ...(nombre ? { nombre } : null) };
          if (k === "marcaId") return nombre ? { nombre } : null;
          if (k !== "mallId" || !mall) return null;
          // Los malls de antes de la migración 012 no tienen comuna ni región: ahí se deja lo escrito.
          return {
            ...(nombre ? { nombre } : null),
            direccion: mall.direccion,
            ...(mall.comuna ? { comuna: mall.comuna } : null),
            ...(mall.region ? { region: mall.region } : null),
          };
        },
    toFormValues: (s) => ({
          clienteId: String(s.clienteId),
          marcaId: String(s.marcaId),
          mallId: s.mallId ? String(s.mallId) : "",
          nombre: s.nombre,
          codigo: s.codigo ?? "",
          direccion: s.direccion,
          comuna: s.comuna,
          region: s.region,
          telefono: s.telefono ?? "",
          activo: s.activo,
          motivoInactivo: s.motivoInactivo ?? "",
          notas: s.notas ?? "",
          fechaInstalacion: s.fechaInstalacion ?? "",
          remota: siNoAForm(s.remota),
          garantiaMeses: s.garantiaMeses ? String(s.garantiaMeses) : "",
          planCalibracion: siNoAForm(s.planCalibracion),
          calibracionPorCliente: "",
        }),
    guardarAction: (id, f) =>
          guardarSucursalAction(id, {
            clienteId: Number(f.clienteId),
            marcaId: Number(f.marcaId),
            mallId: Number(f.mallId) || null,
            nombre: String(f.nombre).trim(),
            codigo: String(f.codigo ?? "").trim() || null,
            direccion: String(f.direccion).trim(),
            comuna: String(f.comuna).trim(),
            region: String(f.region),
            telefono: String(f.telefono).trim() || null,
            activo: f.activo !== false,
            motivoInactivo: String(f.motivoInactivo ?? "").trim() || null,
            notas: String(f.notas ?? "").trim() || null,
            fechaInstalacion: String(f.fechaInstalacion ?? "") || null,
            remota: formASiNo(f.remota),
            garantiaMeses: mesesDeForm(f.garantiaMeses) ?? null,
            // Con el cliente en plan el campo no se ve, pero lo que la tienda
            // tenía se conserva: vuelve a mandar si el cliente sale del plan.
            planCalibracion: formASiNo(f.planCalibracion),
          }),
    emptyRow: {
          clienteId: String(clientes[0]?.id ?? ""),
          marcaId: marcaInicial(clientes[0]?.id ?? ""),
          mallId: "",
          nombre: "",
          codigo: "",
          direccion: "",
          comuna: "",
          region: REGIONES[0],
          telefono: "",
          activo: true,
          motivoInactivo: "",
          notas: "",
          fechaInstalacion: "",
          remota: "",
          garantiaMeses: "",
          planCalibracion: "",
          calibracionPorCliente: "",
        },
  };
  return formulario;
}
