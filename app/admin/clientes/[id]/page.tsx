import { autoriaDeBaja } from "@/lib/ui/estado-activo";
import { notFound } from "next/navigation";
import SinAcceso from "@/components/admin/SinAcceso";
import FichaVisitas from "@/components/admin/maestros/FichaVisitas";
import ContactosSeccion from "@/components/admin/contactos/ContactosSeccion";
import MarcasSeccion from "@/components/admin/maestros/MarcasSeccion";
import type { DatoFicha } from "@/components/admin/maestros/FichaPartes";
import { contactosDeCliente } from "@/lib/data/contactos";
import { getCliente, listarMalls, listarMarcas, listarSucursales } from "@/lib/data/maestros";
import { getFilasFicha } from "@/lib/data/visitas-lista";
import { sesionCon } from "@/lib/auth";
import { hoyISO } from "@/lib/ui/fecha";
import { enGarantia as cubre, garantiaDe } from "@/lib/ui/garantia";
import { cargosDeCliente, describirAlcance } from "@/lib/ui/contactos";

export const dynamic = "force-dynamic";

export default async function ClienteFichaPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await sesionCon("clientes.ver"))) return <SinAcceso />;
  const { id } = await params;
  const clienteId = Number(id);
  if (!Number.isInteger(clienteId)) notFound();

  const verVisitas = Boolean(await sesionCon("visitas.ver"));
  const verTiendas = Boolean(await sesionCon("sucursales.ver"));
  const verMarcas = Boolean(await sesionCon("marcas.ver"));
  const verContactos = Boolean(await sesionCon("contactos.ver"));
  const [c, tiendas, marcas, contactos, filas] = await Promise.all([
    getCliente(clienteId),
    listarSucursales({ clienteId }),
    listarMarcas({ clienteId }),
    verContactos ? contactosDeCliente(clienteId) : Promise.resolve([]),
    verVisitas ? getFilasFicha({ clienteId }) : Promise.resolve([]),
  ]);
  if (!c) notFound();
  // Solo los malls de sus tiendas: para nombrarlos en la lista.
  const malls = await listarMalls({ ids: [...new Set(tiendas.map((s) => s.mallId).filter((x): x is number => x !== null))] });
  const activas = tiendas.filter((s) => s.activo);
  const nMalls = new Set(activas.map((s) => s.mallId).filter(Boolean)).size;
  const hoy = hoyISO();
  const enGarantia = activas.filter((s) => cubre(garantiaDe(s, c, hoy))).length;

  const tiendasPorMarca: Record<number, number> = {};
  for (const s of activas) tiendasPorMarca[s.marcaId] = (tiendasPorMarca[s.marcaId] ?? 0) + 1;
  const nombres = {
    cliente: (i: number) => (i === c.id ? c.nombreFantasia : undefined),
    marca: (i: number) => marcas.find((m) => m.id === i)?.nombre,
    sucursal: (i: number) => tiendas.find((s) => s.id === i)?.nombre,
  };
  // Los contactos del cliente: los de la empresa y los de sus marcas. Los de
  // cada tienda viven en la ficha de la sucursal.
  const idsMarcas = new Set(marcas.map((m) => m.id));
  const filasContactos = contactos.flatMap((ct) =>
    cargosDeCliente(ct, c.id, idsMarcas).map((cg) => ({
      contactoId: ct.id,
      cargoId: cg.id,
      cargo: cg.cargo,
      origen: describirAlcance(cg, nombres),
      heredado: cg.alcanceTipo !== "CLIENTE",
      quitable: true,
    }))
  );

  const datos: DatoFicha[] = [
    { label: "Razón social", valor: c.razonSocial },
    { label: "RUT", valor: c.rut },
    { label: "Locales activos", valor: `${activas.length} en ${nMalls} ${nMalls === 1 ? "mall" : "malls"}` },
    { label: "Locales inactivos", valor: tiendas.length - activas.length ? String(tiendas.length - activas.length) : "" },
    { label: "Plan de garantía", valor: c.garantiaMeses ? `${c.garantiaMeses} ${c.garantiaMeses === 1 ? "mes" : "meses"}` : "" },
    { label: "En garantía", valor: enGarantia ? `${enGarantia} ${enGarantia === 1 ? "local" : "locales"}` : "" },
    { label: "Plan de calibración", valor: c.planCalibracion === true ? "En plan" : c.planCalibracion === false ? "Sin plan" : "" },
    { label: "Por qué está inactivo", valor: c.activo ? "" : (c.motivoInactivo ?? "") },
    { label: "Quién lo desactivó", valor: c.baja ? autoriaDeBaja(c.baja) : "" },
  ].filter((d) => d.valor);

  return (
    <FichaVisitas
      modo="cliente"
      titulo={c.nombreFantasia}
      subtitulo={`${c.razonSocial !== c.nombreFantasia ? `${c.razonSocial} · ` : ""}RUT ${c.rut}`}
      activo={c.activo}
      volver={{ href: "/admin/clientes", label: "Clientes" }}
      acciones={verTiendas ? [{ href: `/admin/sucursales?cliente=${c.id}`, label: "Editar sus locales" }] : undefined}
      datos={datos}
      notas={c.notas ?? null}
      filas={filas}
      tiendas={
        verTiendas
          ? tiendas.map((s) => ({
              id: s.id,
              nombre: s.nombre,
              mall: malls.find((m) => m.id === s.mallId)?.nombre ?? null,
              cliente: c.nombreFantasia,
              comuna: s.comuna,
              activo: s.activo,
            }))
          : undefined
      }
      verVisitas={verVisitas}
      hoy={hoyISO()}
      secciones={
        verMarcas || verContactos ? (
          <>
            {verMarcas ? <MarcasSeccion clienteId={c.id} marcas={marcas} tiendasPorMarca={tiendasPorMarca} /> : null}
            {verContactos ? (
              <ContactosSeccion
                titulo="Contactos del cliente"
                nota="De la empresa y de sus marcas. Los de cada tienda están en la ficha de la sucursal."
                vacio="Este cliente todavía no tiene contactos, ni de la empresa ni de sus marcas."
                filas={filasContactos}
                contactos={contactos}
                cargoInicial={{ alcanceTipo: "CLIENTE", alcanceId: c.id, alcanceTexto: null }}
              />
            ) : null}
          </>
        ) : undefined
      }
    />
  );
}
