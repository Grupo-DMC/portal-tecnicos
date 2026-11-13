import "server-only";
import { listarCargos, listarEstadosProblema, listarMotivos, listarProblemas, listarTrabajos } from "@/lib/data/catalogos";
import { listarClientes, listarMalls, listarMarcas, listarSucursales, listarTecnicos } from "@/lib/data/maestros";
import { tiene } from "@/lib/permisos";
import type { Cliente, RolUsuario, Sucursal, Tecnico } from "@/lib/types";
import type { Referencias } from "@/lib/ui/referencias";

/**
 * Lo que el contexto del panel necesita de un técnico: el nombre, para
 * elegirlo o mostrarlo. RUT, correo y teléfono se quedan en el servidor; la
 * pestaña Técnicos los lee por su cuenta, con su propio permiso.
 */
function tecnicoReducido(t: Tecnico): Tecnico {
  return {
    id: t.id,
    nombreCompleto: t.nombreCompleto,
    nombres: t.nombres,
    apellidoPaterno: t.apellidoPaterno,
    apellidoMaterno: null,
    rut: "",
    email: "",
    telefono: null,
    activo: t.activo,
  };
}

/**
 * Las notas internas no bajan por el contexto: cada ficha las lee con su
 * permiso. El RUT del cliente, el teléfono del local y el motivo de baja de ambos bajan solo a quien puede
 * abrir esos módulos; las tablas de Clientes y Sucursales los leen por su cuenta.
 */
const reducirCliente = (permisos: string[]) => (c: Cliente): Cliente => ({
  ...c,
  notas: null,
  rut: tiene(permisos, "clientes.ver") ? c.rut : "",
  motivoInactivo: tiene(permisos, "clientes.ver") ? c.motivoInactivo : null,
});
const reducirSucursal = (permisos: string[]) => (s: Sucursal): Sucursal => ({
  ...s,
  notas: null,
  telefono: tiene(permisos, "sucursales.ver") ? s.telefono : null,
  motivoInactivo: tiene(permisos, "sucursales.ver") ? s.motivoInactivo : null,
});

/**
 * Maestros y catálogos que los diálogos y tablas del panel necesitan tener
 * completos. Se carga una vez por petición en el layout y baja por contexto.
 */
export async function cargarReferencias(rol: RolUsuario, permisos: string[]): Promise<Referencias> {
  const [clientes, marcas, malls, sucursales, tecnicos, motivos, problemas, trabajos, estadosProblema, cargos] = await Promise.all([
    listarClientes(),
    listarMarcas(),
    listarMalls(),
    listarSucursales(),
    listarTecnicos(),
    listarMotivos(),
    listarProblemas(),
    listarTrabajos(),
    listarEstadosProblema(),
    listarCargos(),
  ]);
  return {
    rol,
    permisos,
    clientes: clientes.map(reducirCliente(permisos)),
    marcas,
    malls,
    sucursales: sucursales.map(reducirSucursal(permisos)),
    tecnicos: tecnicos.map(tecnicoReducido),
    motivos,
    problemas,
    trabajos,
    estadosProblema,
    cargos,
  };
}

/**
 * Versión reducida para el móvil. El técnico no ve el maestro de técnicos: de
 * sus compañeros baja solo el nombre, para elegir al ayudante en "Agregar
 * visita". RUT, correo y teléfono se quedan en el servidor.
 */
export async function cargarReferenciasTecnico(permisos: string[]): Promise<Referencias> {
  const [clientes, marcas, malls, sucursales, tecnicos, motivos, problemas, trabajos, estadosProblema, cargos] = await Promise.all([
    listarClientes(),
    listarMarcas(),
    listarMalls(),
    listarSucursales(),
    listarTecnicos(),
    listarMotivos(),
    listarProblemas(),
    listarTrabajos(),
    listarEstadosProblema(),
    listarCargos(),
  ]);
  const companeros = tecnicos.filter((t) => t.activo).map(tecnicoReducido);
  return {
    rol: "TECNICO",
    permisos,
    clientes: clientes.map(reducirCliente(permisos)),
    marcas,
    malls,
    sucursales: sucursales.map(reducirSucursal(permisos)),
    tecnicos: companeros,
    motivos,
    problemas,
    trabajos,
    estadosProblema,
    cargos,
  };
}
