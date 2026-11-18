"use server";

import { revalidatePath } from "next/cache";
import { crearSesion, sesionCon } from "@/lib/auth";
import {
  guardarCliente,
  guardarMall,
  guardarMarca,
  guardarSucursal,
  crearSucursalesLote,
  guardarTecnico,
  guardarUsuario,
  ponerTiendasDeMall,
  CuentaNoPermitida,
  RutRepetido,
  TiendaEnOtroMall,
  type DatosCliente,
  type DatosMall,
  type DatosMarca,
  type DatosSucursal,
  type DatosSucursalLote,
  type DatosTecnico,
  type DatosUsuario,
} from "@/lib/data/maestros";
import { auditar, diferencia } from "@/lib/data/auditoria";
import { registrarActividad, type ActorActividad } from "@/lib/data/actividad";
import { log } from "@/lib/log";
import { eliminarRol, guardarPermisosCelular, guardarRol, leerRol, type Cuenta, type DatosRol } from "@/lib/data/roles";
import { motivoParaNoGuardarCuenta, normalizarPermisos, puedeAdministrarCuenta, tiene } from "@/lib/permisos";
import { validarPasswordNueva } from "@/lib/password";
import { mensajeRut, rutCompleto } from "@/lib/ui/formato";
import { problemaDeBaja } from "@/lib/ui/estado-activo";
import { idPositivo, validar } from "@/lib/validacion/comun";
import {
  entradaCliente,
  entradaMall,
  entradaMarca,
  entradaPermisosCelular,
  entradaRol,
  entradaSucursal,
  entradaSucursalesLote,
  entradaTecnico,
  entradaTiendasMall,
  entradaUsuario,
} from "@/lib/validacion/maestros";
import { esAdmin, mismosRoles, ordenarRoles, problemaDeRoles, tieneRolTecnico } from "@/lib/roles";

// Altas y ediciones de los maestros del panel. Todo escribe en SQL Server.

export interface ResultadoMaestro {
  ok: boolean;
  error?: string;
  /** El id del registro guardado: lo que necesita un alta hecha desde otro formulario. */
  id?: number;
}

/** Agregar y editar son permisos distintos: `id` null es un alta. */
function sesionMaestro(modulo: string, id: number | null) {
  return sesionCon(`${modulo}.${id === null ? "crear" : "editar"}`);
}

/**
 * Traduce el error de SQL Server a algo que el coordinador entienda. Los
 * choques de unicidad son el caso normal (RUT o correo repetido) y no deben
 * llegar a pantalla como un volcado del driver.
 */
function mensajeDeError(err: unknown, contexto: string): string {
  if (err instanceof CuentaNoPermitida) return err.message;
  if (err instanceof RutRepetido) {
    return err.donde === "cliente"
      ? `El RUT ${err.rut} ya está registrado en otra empresa. El RUT es único: busca esa empresa y edítala.`
      : `El RUT ${err.rut} ya está registrado en otra persona. El RUT es único: busca a esa persona y edítala.`;
  }
  if (err instanceof TiendaEnOtroMall) {
    return `Ya está en otro mall: ${err.tiendas.join(", ")}. Una sucursal está en un solo mall: quítala de ese primero.`;
  }
  const texto = err instanceof Error ? err.message : String(err);
  if (/uq_mall_nombre/i.test(texto)) return "Ya existe un mall con ese nombre.";
  if (/fk_sucursal_mall/i.test(texto)) return "Ese mall ya no existe. Recarga la página.";
  if (/uq_\w*rut/i.test(texto)) return "Ya existe un registro con ese RUT.";
  if (/uq_\w*email|uq_usuario_email/i.test(texto)) return "Ya existe un registro con ese correo.";
  if (/uq_sucursal_codigo/i.test(texto)) return "Ya existe una sucursal con ese código.";
  if (/uq_sucursal_marca_nombre/i.test(texto)) return "Esa marca ya tiene una sucursal con ese nombre.";
  if (/uq_marca_cliente_nombre/i.test(texto)) return "Ese cliente ya tiene una marca con ese nombre.";
  if (/fk_sucursal_marca/i.test(texto)) return "La marca elegida no es de ese cliente. Elígela de nuevo.";
  if (/uq_usuario_tecnico/i.test(texto)) return "Ese técnico ya está vinculado a otro usuario.";
  if (/ck_usuario_roles_tecnico/i.test(texto)) return "Para el rol de técnico hay que vincular un técnico.";
  if (/ck_usuario_roles_panel/i.test(texto)) return "Una cuenta no puede ser administradora y coordinadora a la vez.";
  if (/ck_usuario_roles_alguno/i.test(texto)) return "Marca al menos un rol para la cuenta.";
  if (/ck_usuario_roles_rol_id/i.test(texto)) return "Solo una cuenta coordinadora lleva un rol del panel.";
  if (/uq_rol_nombre/i.test(texto)) return "Ya existe un rol con ese nombre.";
  if (/fk_usuario_rol\b/i.test(texto)) return "Ese rol ya no existe. Recarga la página y elige otro.";
  if (/duplicate|unique/i.test(texto)) return "Ya existe un registro con esos datos.";
  log.error(contexto, { err });
  return "No se pudo guardar. Revisa los datos e inténtalo otra vez.";
}

function revalidar() {
  revalidatePath("/admin", "layout");
}

/** Quien guarda, para el historial de cambios de estado (dmc.cambio_estado). */
function actorDe(sesion: { usuario: { id: number; email: string } }) {
  return { id: sesion.usuario.id, email: sesion.usuario.email };
}

/** «creó el cliente» / «editó el cliente», con el nombre del registro de detalle. */
function anotar(sesion: ActorActividad, tipo: string, alta: boolean, que: string, detalle: string, enlace: string) {
  return registrarActividad(sesion, { tipo, texto: `${alta ? "creó" : "editó"} ${que}`, detalle: detalle.trim() || null, enlace });
}

export async function guardarClienteAction(idPedido: number | null, datosPedidos: DatosCliente): Promise<ResultadoMaestro> {
  const sesion = await sesionMaestro("clientes", idPedido);
  if (!sesion) return { ok: false, error: "No tienes permiso para editar clientes." };
  const entrada = validar(entradaCliente, { id: idPedido, datos: datosPedidos }, "guardarCliente");
  if (!entrada.ok) return { ok: false, error: entrada.error };
  const { id, datos } = entrada.datos;
  if (!datos.razonSocial.trim() || !datos.rut.trim()) {
    return { ok: false, error: "Razón social y RUT son obligatorios." };
  }
  if (!rutCompleto(datos.rut)) return { ok: false, error: mensajeRut(datos.rut) ?? "El RUT está incompleto." };
  // Un cliente no queda inactivo sin que conste por qué (la base lo exige igual).
  const sinMotivo = problemaDeBaja(datos.activo, datos.motivoInactivo, "el cliente");
  if (sinMotivo) return { ok: false, error: sinMotivo };
  let guardadoId: number;
  try {
    guardadoId = await guardarCliente(id, datos, actorDe(sesion));
  } catch (err) {
    return { ok: false, error: mensajeDeError(err, "guardarCliente") };
  }
  await anotar(sesion, "maestro.clientes", id === null, "el cliente", datos.nombreFantasia || datos.razonSocial, "/admin/clientes");
  revalidar();
  return { ok: true, id: guardadoId };
}

export async function guardarMarcaAction(idPedido: number | null, datosPedidos: DatosMarca): Promise<ResultadoMaestro> {
  const sesion = await sesionMaestro("marcas", idPedido);
  if (!sesion) return { ok: false, error: "No tienes permiso para editar marcas." };
  const entrada = validar(entradaMarca, { id: idPedido, datos: datosPedidos }, "guardarMarca");
  if (!entrada.ok) return { ok: false, error: entrada.error };
  const { id, datos } = entrada.datos;
  if (!datos.nombre.trim()) return { ok: false, error: "El nombre de la marca es obligatorio." };
  const sinMotivo = problemaDeBaja(datos.activo, datos.motivoInactivo, "la marca");
  if (sinMotivo) return { ok: false, error: sinMotivo };
  let guardadoId: number;
  try {
    guardadoId = await guardarMarca(id, datos, actorDe(sesion));
  } catch (err) {
    return { ok: false, error: mensajeDeError(err, "guardarMarca") };
  }
  await anotar(sesion, "maestro.clientes", id === null, "la marca", datos.nombre, "/admin/clientes");
  revalidar();
  return { ok: true, id: guardadoId };
}

export async function guardarMallAction(idPedido: number | null, datosPedidos: DatosMall): Promise<ResultadoMaestro> {
  const sesion = await sesionMaestro("malls", idPedido);
  if (!sesion) return { ok: false, error: "No tienes permiso para editar malls." };
  const entrada = validar(entradaMall, { id: idPedido, datos: datosPedidos }, "guardarMall");
  if (!entrada.ok) return { ok: false, error: entrada.error };
  const { id, datos } = entrada.datos;
  if (!datos.nombre.trim() || !datos.direccion.trim() || !datos.comuna?.trim() || !datos.region?.trim()) {
    return { ok: false, error: "Nombre, dirección, comuna y región son obligatorios." };
  }
  const sinMotivo = problemaDeBaja(datos.activo, datos.motivoInactivo, "el mall");
  if (sinMotivo) return { ok: false, error: sinMotivo };
  let guardadoId: number;
  try {
    guardadoId = await guardarMall(id, datos, actorDe(sesion));
  } catch (err) {
    return { ok: false, error: mensajeDeError(err, "guardarMall") };
  }
  await anotar(sesion, "maestro.sucursales", id === null, "el mall", datos.nombre, "/admin/malls");
  revalidar();
  return { ok: true, id: guardadoId };
}

/** Las tiendas del mall: la lista completa, tal como quedó en el diálogo. */
export async function guardarTiendasMallAction(mallIdPedido: number, sucursalIdsPedidos: number[]): Promise<ResultadoMaestro> {
  const sesion = await sesionCon("malls.editar");
  if (!sesion) return { ok: false, error: "No tienes permiso para editar malls." };
  const entrada = validar(
    entradaTiendasMall,
    { mallId: mallIdPedido, sucursalIds: sucursalIdsPedidos },
    "guardarTiendasMall"
  );
  if (!entrada.ok) return { ok: false, error: "La lista de tiendas no es válida." };
  const { mallId, sucursalIds } = entrada.datos;
  const ids = [...new Set(sucursalIds)].filter((x) => Number.isInteger(x) && x > 0);
  if (!mallId || ids.length !== sucursalIds.length) return { ok: false, error: "La lista de tiendas no es válida." };
  try {
    await ponerTiendasDeMall(mallId, ids);
  } catch (err) {
    return { ok: false, error: mensajeDeError(err, "ponerTiendasDeMall") };
  }
  await registrarActividad(sesion, {
    tipo: "maestro.sucursales",
    texto: `cambió las tiendas de un mall (quedó con ${ids.length})`,
    enlace: "/admin/malls",
  });
  revalidar();
  return { ok: true };
}

export async function guardarSucursalAction(idPedido: number | null, datosPedidos: DatosSucursal): Promise<ResultadoMaestro> {
  const sesion = await sesionMaestro("sucursales", idPedido);
  if (!sesion) return { ok: false, error: "No tienes permiso para editar sucursales." };
  const entrada = validar(entradaSucursal, { id: idPedido, datos: datosPedidos }, "guardarSucursal");
  if (!entrada.ok) return { ok: false, error: entrada.error };
  const { id, datos } = entrada.datos;
  if (!datos.nombre.trim() || !datos.clienteId || !datos.marcaId) {
    return { ok: false, error: "Nombre, cliente y marca son obligatorios." };
  }
  // Sin mall, la tienda está a la calle y su dirección es lo único que la ubica.
  if (!datos.mallId && !datos.direccion.trim()) {
    return { ok: false, error: "Una sucursal sin mall necesita su dirección de calle." };
  }
  // Una sucursal no queda inactiva sin que conste por qué (la base lo exige igual).
  const sinMotivo = problemaDeBaja(datos.activo, datos.motivoInactivo, "la sucursal");
  if (sinMotivo) return { ok: false, error: sinMotivo };
  if (datos.fechaInstalacion && !/^\d{4}-\d{2}-\d{2}$/.test(datos.fechaInstalacion)) {
    return { ok: false, error: "La fecha de instalación no es válida." };
  }
  let guardadoId: number;
  try {
    guardadoId = await guardarSucursal(id, datos, actorDe(sesion));
  } catch (err) {
    return { ok: false, error: mensajeDeError(err, "guardarSucursal") };
  }
  await anotar(sesion, "maestro.sucursales", id === null, "la sucursal", datos.nombre, "/admin/sucursales");
  revalidar();
  return { ok: true, id: guardadoId };
}

/** Alta masiva: las sucursales nuevas, cada una con su cliente y marca, en un solo INSERT. */
export async function crearSucursalesLoteAction(
  filasPedidas: DatosSucursalLote[]
): Promise<ResultadoMaestro & { creadas?: number }> {
  const sesion = await sesionCon("sucursales.crear");
  if (!sesion) return { ok: false, error: "No tienes permiso para crear sucursales." };
  const entrada = validar(entradaSucursalesLote, { filas: filasPedidas }, "crearSucursalesLote");
  if (!entrada.ok) return { ok: false, error: entrada.error };
  const { filas } = entrada.datos;
  if (filas.length === 0) return { ok: false, error: "No hay sucursales por crear." };
  if (filas.some((f) => !f.nombre.trim() || !f.direccion.trim() || !f.comuna.trim() || !f.region.trim())) {
    return { ok: false, error: "Cada sucursal necesita nombre, dirección, comuna y región." };
  }
  try {
    const creadas = await crearSucursalesLote(filas);
    await registrarActividad(sesion, {
      tipo: "maestro.sucursales",
      texto: creadas === 1 ? "creó una sucursal" : `creó ${creadas} sucursales de una vez`,
      detalle: filas.slice(0, 3).map((f) => f.nombre.trim()).join(", ") + (filas.length > 3 ? ` y ${filas.length - 3} más` : ""),
      enlace: "/admin/sucursales",
    });
    revalidar();
    return { ok: true, creadas };
  } catch (err) {
    return { ok: false, error: mensajeDeError(err, "crearSucursalesLote") };
  }
}

export async function guardarTecnicoAction(idPedido: number | null, datosPedidos: DatosTecnico): Promise<ResultadoMaestro> {
  const sesion = await sesionMaestro("tecnicos", idPedido);
  if (!sesion) return { ok: false, error: "No tienes permiso para editar técnicos." };
  const entrada = validar(entradaTecnico, { id: idPedido, datos: datosPedidos }, "guardarTecnico");
  if (!entrada.ok) return { ok: false, error: entrada.error };
  const { id, datos } = entrada.datos;
  if (!datos.nombres.trim() || !datos.rut.trim() || !datos.email.trim()) {
    return { ok: false, error: "Nombre, RUT y correo son obligatorios." };
  }
  if (!rutCompleto(datos.rut)) return { ok: false, error: mensajeRut(datos.rut) ?? "El RUT está incompleto." };
  const sinMotivo = problemaDeBaja(datos.activo, datos.motivoInactivo, "el técnico");
  if (sinMotivo) return { ok: false, error: sinMotivo };
  try {
    await guardarTecnico(id, datos, actorDe(sesion));
  } catch (err) {
    return { ok: false, error: mensajeDeError(err, "guardarTecnico") };
  }
  await anotar(
    sesion,
    "maestro.tecnicos",
    id === null,
    "el técnico",
    `${datos.nombres} ${datos.apellidoPaterno}`,
    "/admin/usuarios?vista=tecnicos"
  );
  revalidar();
  return { ok: true };
}

export async function guardarUsuarioAction(
  idPedido: number | null,
  datosPedidos: DatosUsuario
): Promise<ResultadoMaestro> {
  const sesion = await sesionMaestro("usuarios", idPedido);
  if (!sesion) return { ok: false, error: "No tienes permiso para editar usuarios." };
  const entrada = validar(entradaUsuario, { id: idPedido, datos: datosPedidos }, "guardarUsuario");
  if (!entrada.ok) return { ok: false, error: entrada.error };
  const { id } = entrada.datos;
  // Un select vacío manda 0: es «sin técnico».
  const datos: DatosUsuario = {
    ...entrada.datos.datos,
    roles: ordenarRoles(entrada.datos.datos.roles),
    tecnicoId: entrada.datos.datos.tecnicoId || null,
  };
  if (!datos.email.includes("@")) return { ok: false, error: "Escribe un correo válido." };
  const combinacion = problemaDeRoles(datos.roles, datos.tecnicoId);
  if (combinacion) return { ok: false, error: combinacion };
  const sinMotivo = problemaDeBaja(datos.activo, datos.motivoInactivo, "la cuenta");
  if (sinMotivo) return { ok: false, error: sinMotivo };
  // Al crear, la contraseña es obligatoria: dmc.usuario.password_hash es NOT
  // NULL y un usuario sin clave no podría entrar nunca. Al editar, vacía = no
  // se cambia. No se recorta: se guarda tal como se escribió.
  if (id === null || datos.password !== "") {
    const fallo = validarPasswordNueva(datos.password, datos.email);
    if (fallo) return { ok: false, error: fallo };
  }

  let previa: Cuenta | null = null;
  try {
    const guardado = await guardarUsuario(id, datos, {
      actorId: sesion.usuario.id,
      actorEmail: sesion.usuario.email,
      autorizar: (actual, nueva) => {
        previa = actual;
        return motivoParaNoGuardarCuenta(sesion, id, actual, nueva);
      },
    });
    // Si se cambió la clave o los roles propios, la versión de sesión subió:
    // esta sesión sigue con un token nuevo, en el mismo modo si todavía lo
    // tiene, y las demás quedan cerradas.
    if (guardado.id === sesion.usuario.id) await crearSesion(guardado.id, guardado.sesionVersion, sesion.modo);
    await auditarUsuario(sesion, guardado.id, previa as Cuenta | null, datos);
    await anotar(sesion, "cuenta.cambio", id === null, "la cuenta", datos.email, "/admin/usuarios");
  } catch (err) {
    return { ok: false, error: mensajeDeError(err, "guardarUsuario") };
  }
  revalidar();
  return { ok: true };
}

/** Anota lo sensible de haber guardado una cuenta: alta, baja, roles, técnico y clave. */
async function auditarUsuario(
  sesion: { usuario: { id: number; email: string } },
  id: number,
  previa: Cuenta | null,
  datos: DatosUsuario
) {
  const base = { entidad: "usuario", entidadId: id } as const;
  const roles = ordenarRoles(datos.roles);
  const rolId = roles.includes("COORDINADOR") ? datos.rolId ?? null : null;
  const tecnicoId = tieneRolTecnico(roles) ? datos.tecnicoId : null;
  if (!previa) {
    await auditar(sesion, { ...base, accion: "usuario.alta", detalle: { roles, rolId, tecnicoId } });
    return;
  }
  if (previa.activo && !datos.activo) {
    await auditar(sesion, { ...base, accion: "usuario.desactivar", detalle: { motivo: datos.motivoInactivo?.trim() } });
  }
  if (!previa.activo && datos.activo) await auditar(sesion, { ...base, accion: "usuario.reactivar" });
  if (!mismosRoles(previa.roles, roles) || previa.rolId !== rolId) {
    await auditar(sesion, {
      ...base,
      accion: "usuario.rol",
      detalle: { de: { roles: previa.roles, rolId: previa.rolId }, a: { roles, rolId } },
    });
  }
  if (previa.tecnicoId !== tecnicoId) {
    await auditar(sesion, { ...base, accion: "usuario.tecnico", detalle: { de: previa.tecnicoId, a: tecnicoId } });
  }
  if (datos.password !== "") {
    await auditar(sesion, { ...base, accion: id === sesion.usuario.id ? "password.cambio" : "password.reseteo" });
  }
}

// ── Roles y permisos ────────────────────────────────────────────────────────

/** Crea un rol o cambia su nombre y lo que puede hacer. */
export async function guardarRolAction(idPedido: number | null, datosPedidos: DatosRol): Promise<ResultadoMaestro> {
  const sesion = await sesionCon("usuarios.roles");
  if (!sesion) return { ok: false, error: "No tienes permiso para administrar roles." };
  const entrada = validar(entradaRol, { id: idPedido, datos: datosPedidos }, "guardarRol");
  if (!entrada.ok) return { ok: false, error: entrada.error };
  const { id, datos } = entrada.datos;
  const nombre = datos.nombre.trim();
  if (!nombre) return { ok: false, error: "El rol necesita un nombre." };
  if (/^(administrador|t[eé]cnico)$/i.test(nombre)) {
    return { ok: false, error: "Ese nombre es de un rol fijo del sistema. Elige otro." };
  }
  const permisos = normalizarPermisos(datos.permisos);
  if (permisos.length === 0) return { ok: false, error: "Marca al menos un permiso: un rol vacío no puede ver nada." };

  try {
    // Quien no es administrador no toca roles que pueden más que él, y solo da
    // o quita los permisos que él tiene.
    if (!esAdmin(sesion)) {
      const previo = id === null ? null : await leerRol(id);
      if (id !== null && !previo) return { ok: false, error: "Ese rol ya no existe. Recarga la página." };
      const previos = previo?.permisos ?? [];
      if (!puedeAdministrarCuenta(sesion, { permisos: previos })) {
        return { ok: false, error: `El rol «${previo?.nombre}» tiene permisos que tú no tienes: no lo puedes editar.` };
      }
      const tocados = [...permisos.filter((p) => !previos.includes(p)), ...previos.filter((p) => !permisos.includes(p))];
      if (tocados.some((p) => !tiene(sesion.permisos, p))) {
        return { ok: false, error: "Solo puedes dar o quitar permisos que tú también tienes." };
      }
    }
    const antes = id === null ? null : await leerRol(id);
    const guardadoId = await guardarRol(id, { nombre, descripcion: datos.descripcion, permisos });
    await anotar(sesion, "cuenta.cambio", id === null, "el rol", nombre, "/admin/usuarios?vista=roles");
    await auditar(sesion, {
      accion: id === null ? "rol.alta" : "rol.editar",
      entidad: "rol",
      entidadId: id ?? guardadoId,
      detalle: { nombre, ...diferencia(antes?.permisos ?? [], permisos) },
    });
  } catch (err) {
    return { ok: false, error: mensajeDeError(err, "guardarRol") };
  }
  revalidar();
  return { ok: true };
}

export async function eliminarRolAction(idPedido: number): Promise<ResultadoMaestro> {
  const sesion = await sesionCon("usuarios.roles");
  if (!sesion) return { ok: false, error: "No tienes permiso para administrar roles." };
  const entrada = validar(idPositivo, idPedido, "eliminarRol");
  if (!entrada.ok) return { ok: false, error: "Ese rol no existe." };
  const id = entrada.datos;
  try {
    // Borrar un rol que puede más que uno es quitarles acceso a otros por
    // encima de lo que uno mismo tiene.
    const rol = await leerRol(id);
    if (rol && !puedeAdministrarCuenta(sesion, rol)) {
      return { ok: false, error: `El rol «${rol.nombre}» tiene permisos que tú no tienes: no lo puedes eliminar.` };
    }
    const fallo = await eliminarRol(id);
    if (fallo) return { ok: false, error: fallo };
    await auditar(sesion, { accion: "rol.eliminar", entidad: "rol", entidadId: id, detalle: { nombre: rol?.nombre } });
    await registrarActividad(sesion, {
      tipo: "cuenta.cambio",
      texto: "eliminó el rol",
      detalle: rol?.nombre ?? null,
      enlace: "/admin/usuarios?vista=roles",
    });
  } catch (err) {
    return { ok: false, error: mensajeDeError(err, "eliminarRol") };
  }
  revalidar();
  return { ok: true };
}

/** Los permisos de celular de todos los técnicos (apartado «Permisos del celular»). */
export async function guardarPermisosCelularAction(permisosPedidos: string[]): Promise<ResultadoMaestro> {
  const sesion = await sesionCon("usuarios.roles");
  if (!sesion) return { ok: false, error: "No tienes permiso para administrar roles." };
  const entrada = validar(entradaPermisosCelular, permisosPedidos, "guardarPermisosCelular");
  if (!entrada.ok) return { ok: false, error: entrada.error };
  const permisos = entrada.datos;
  try {
    await guardarPermisosCelular(permisos);
    await auditar(sesion, { accion: "permisos_celular.editar", entidad: "permisos_celular", detalle: { permisos } });
    await registrarActividad(sesion, {
      tipo: "cuenta.cambio",
      texto: "cambió los permisos del celular de los técnicos",
      enlace: "/admin/usuarios?vista=roles",
    });
  } catch (err) {
    return { ok: false, error: mensajeDeError(err, "guardarPermisosCelular") };
  }
  revalidar();
  return { ok: true };
}
