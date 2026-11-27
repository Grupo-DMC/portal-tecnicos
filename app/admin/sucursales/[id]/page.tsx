import { autoriaDeBaja } from "@/lib/ui/estado-activo";
import { notFound } from "next/navigation";
import SinAcceso from "@/components/admin/SinAcceso";
import FichaVisitas from "@/components/admin/maestros/FichaVisitas";
import AgendarVisitaSucursal from "@/components/admin/maestros/AgendarVisitaSucursal";
import ContactosSeccion from "@/components/admin/contactos/ContactosSeccion";
import type { DatoFicha } from "@/components/admin/maestros/FichaPartes";
import { contactosCandidatos } from "@/lib/data/contactos";
import { getCliente, getMall, getSucursal, listarMarcas } from "@/lib/data/maestros";
import { getFilasFicha } from "@/lib/data/visitas-lista";
import { sesionCon } from "@/lib/auth";
import { hoyISO, fechaCL } from "@/lib/ui/fecha";
import { garantiaDe, ETIQUETA_GARANTIA, resumenGarantia } from "@/lib/ui/garantia";
import { calibracionDeSucursal } from "@/lib/ui/sino";
import { contactosDeTienda, origenDe } from "@/lib/ui/contactos";
import { textoMall } from "@/lib/ui/ubicacion";

export const dynamic = "force-dynamic";

const siNo = (v: boolean | null | undefined, si: string, no: string) => (v === true ? si : v === false ? no : "");

export default async function SucursalFichaPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await sesionCon("sucursales.ver"))) return <SinAcceso />;
  const { id } = await params;
  const sucursalId = Number(id);
  if (!Number.isInteger(sucursalId)) notFound();

  const verVisitas = Boolean(await sesionCon("visitas.ver"));
  const verClientes = Boolean(await sesionCon("clientes.ver"));
  const [s, filas] = await Promise.all([
    getSucursal(sucursalId),
    verVisitas ? getFilasFicha({ sucursalId }) : Promise.resolve([]),
  ]);
  if (!s) notFound();
  const verContactos = Boolean(await sesionCon("contactos.ver"));
  const crearVisitas = Boolean(await sesionCon("visitas.crear"));
  const [cliente, mall, marcas] = await Promise.all([
    getCliente(s.clienteId),
    s.mallId ? getMall(s.mallId) : undefined,
    listarMarcas({ clienteId: s.clienteId }),
  ]);
  const marca = marcas.find((m) => m.id === s.marcaId);
  // Los contactos de la tienda: los propios y los que hereda de su marca, región y cliente.
  const candidatos = verContactos
    ? await contactosCandidatos({ id: s.id, clienteId: s.clienteId, marcaId: s.marcaId, region: s.region })
    : [];
  const aplicables = contactosDeTienda(candidatos, { id: s.id, clienteId: s.clienteId, marcaId: s.marcaId, region: s.region });
  // Los propios de la tienda van aparte de los que vienen del cliente, la marca o la región.
  const filaDe = (a: (typeof aplicables)[number]) => ({
    contactoId: a.contacto.id,
    cargoId: a.cargo.id,
    cargo: a.cargo.cargo,
    origen: origenDe(a, nombres),
    heredado: a.heredado,
    quitable: !a.heredado,
  });
  const propios = aplicables.filter((a) => !a.heredado).map(filaDe);
  const heredados = aplicables.filter((a) => a.heredado).map(filaDe);
  const nombres = {
    cliente: (i: number) => (i === s.clienteId ? cliente?.nombreFantasia : undefined),
    marca: (i: number) => marcas.find((m) => m.id === i)?.nombre,
    sucursal: (i: number) => (i === s.id ? s.nombre : undefined),
  };
  const cal = calibracionDeSucursal(s, cliente);
  const garantia = garantiaDe(s, cliente, hoyISO());

  const datos: DatoFicha[] = [
    { label: "Cliente", valor: cliente?.nombreFantasia ?? "—", href: cliente && verClientes ? `/admin/clientes/${cliente.id}` : undefined },
    { label: "Marca", valor: marca?.nombre ?? "" },
    { label: "Mall", valor: textoMall(mall) },
    { label: "Código", valor: s.codigo ?? "" },
    { label: "Dirección", valor: s.direccion },
    { label: "Comuna · región", valor: [s.comuna, s.region].filter(Boolean).join(" · ") },
    { label: "Teléfono", valor: s.telefono ?? "" },
    { label: "Instalada el", valor: s.fechaInstalacion ? fechaCL(s.fechaInstalacion) : "" },
    { label: "Modalidad", valor: siNo(s.remota, "Remota", "Presencial") },
    // Estado calculado: la duración propia manda sobre el plan del cliente (lib/ui/garantia.ts).
    { label: "Garantía", valor: ETIQUETA_GARANTIA[garantia.estado] },
    { label: "Detalle de la garantía", valor: garantia.estado === "SIN_GARANTIA" ? "" : resumenGarantia(garantia) },
    {
      label: "Plan de calibración",
      valor: cal.valor === null ? "" : cal.valor ? (cal.porCliente ? "Sí, por su cliente" : "Sí") : "No",
    },
    { label: "Por qué está inactiva", valor: s.activo ? "" : (s.motivoInactivo ?? "") },
    { label: "Quién la desactivó", valor: s.baja ? autoriaDeBaja(s.baja, true) : "" },
  ].filter((d) => d.valor);

  return (
    <FichaVisitas
      modo="sucursal"
      titulo={s.nombre}
      subtitulo={[cliente?.nombreFantasia, marca?.nombre, textoMall(mall), s.comuna].filter(Boolean).join(" · ")}
      activo={s.activo}
      volver={{ href: "/admin/sucursales", label: "Sucursales" }}
      datos={datos}
      notas={s.notas ?? null}
      filas={filas}
      verVisitas={verVisitas}
      hoy={hoyISO()}
      accionExtra={
        crearVisitas && s.activo ? (
          <AgendarVisitaSucursal
            sucursalId={s.id}
            nombre={s.nombre}
            conPlan={cal.valor === true}
            contacto={
              propios[0]
                ? { nombre: candidatos.find((c) => c.id === propios[0].contactoId)?.nombre ?? "", cargo: propios[0].cargo }
                : null
            }
          />
        ) : undefined
      }
      secciones={
        verContactos ? (
          <>
            <ContactosSeccion
              titulo="Contactos de la tienda"
              nota="El personal del local: jefe de tienda, encargados. Se le sugieren al técnico al llenar el acta."
              vacio="Esta tienda todavía no tiene contactos propios."
              filas={propios}
              contactos={candidatos}
              cargoInicial={{ alcanceTipo: "SUCURSAL", alcanceId: s.id, alcanceTexto: null }}
            />
            <ContactosSeccion
              titulo="Contactos del cliente y la marca"
              nota="Vienen de la ficha del cliente, de su marca o de su región. Se agregan y se quitan allá."
              vacio="No hereda contactos de su cliente, marca ni región."
              filas={heredados}
              contactos={candidatos}
            />
          </>
        ) : undefined
      }
    />
  );
}
