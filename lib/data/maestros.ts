import "server-only";
import { consulta, consultaCon, ejecutar, enTransaccion, num, numONull, paramIds, sql, subIds, F_FECHA, F_TS } from "@/lib/data/sql";
import { hashearPassword } from "@/lib/password";
import { leerCuenta, leerRol, permisosDelPanel, type Cuenta } from "@/lib/data/roles";
import { fmtRut, rutLimpio } from "@/lib/ui/formato";
import { motivoParaGuardar } from "@/lib/ui/estado-activo";
import {
  anotarCambioDeEstado,
  bajaDeFila,
  columnasDeBaja,
  estadoActual,
  type ActorEstado,
} from "@/lib/data/estado-activo";
import type { Cliente, Mall, Marca, RolUsuario, Sucursal, Tecnico, Usuario } from "@/lib/types";
import { mismosRoles, ordenarRoles, problemaDeRoles, tieneRolTecnico } from "@/lib/roles";

// Maestros: dmc.cliente, dmc.mall, dmc.sucursal, dmc.tecnico y dmc.usuario.
// Lectura para las tablas del panel y escritura para sus diálogos de alta/edición.
//
// Desactivar exige un motivo (migración 039): lo valida la acción y lo vuelve a
// exigir la base con un CHECK. Cada cambio de estado se anota en
// dmc.cambio_estado en la misma transacción que el guardado.

/** Las columnas de la baja que traen las filas leídas con `columnasDeBaja`. */
interface ConBaja {
  activo: boolean;
  motivo_inactivo: string | null;
  baja_por: string | null;
  baja_en: string | null;
}

/** El RUT no distingue de quién es: una empresa o una persona, pero uno solo. */
export class RutRepetido extends Error {
  constructor(public readonly donde: "cliente" | "tecnico", public readonly rut: string) {
    super(`RUT repetido en ${donde}: ${rut}`);
    this.name = "RutRepetido";
  }
}

/**
 * ¿Ese RUT ya está tomado en la tabla?
 *
 * Se compara sin puntos ni guion y en mayúsculas: "12345678-9", "12.345.678-9"
 * y "123456789" son el mismo RUT, y la UNIQUE de la base los daba por
 * distintos, así que el mismo cliente entraba dos veces con solo escribirlo de
 * otra forma. Al guardar se normaliza además el formato, para que las filas
 * viejas y las nuevas se vean igual.
 */
// `tabla` se interpola en el texto: es una unión cerrada de literales, nunca entrada del usuario.
async function rutTomado(tabla: "cliente" | "tecnico", rut: string, idPropio: number | null): Promise<boolean> {
  const limpio = rutLimpio(rut);
  if (!limpio) return false;
  const filas = await consultaCon<{ id: number }>(
    `SELECT TOP 1 id FROM dmc.${tabla}
      WHERE REPLACE(REPLACE(UPPER(rut), '.', ''), '-', '') = @rut
        AND (@id IS NULL OR id <> @id)`,
    [
      ["rut", sql.VarChar(12), limpio],
      ["id", sql.BigInt, idPropio],
    ]
  );
  return filas.length > 0;
}

/**
 * Deja el nombre de toda sucursal en un mall como «Cliente · Marca · Mall»
 * (sin la marca si repite el cliente), con la misma regla de la migración 033.
 *
 * `dmc.sucursal.nombre` es un texto guardado y lo leen tal cual las visitas,
 * los filtros, las actas y el selector de «Agendar visita». Como se compone de
 * tres tablas, cada cambio en cualquiera de ellas —renombrar cliente, marca o
 * mall, cambiar la marca o el mall de una sucursal, mover tiendas entre malls—
 * lo deja viejo si nadie lo recalcula. Se llama al final de todas esas
 * operaciones; solo toca las filas cuyo nombre cambia, y las sucursales a la
 * calle (sin mall) conservan el nombre que se les escribió.
 *
 * Si dos quedarían con el mismo nombre en la misma marca, la segunda en
 * adelante lleva « (2)», « (3)»… Una que chocaría con una sucursal a la calle
 * se deja como está.
 */
export async function sincronizarNombresDeSucursales(): Promise<void> {
  await ejecutar(`
    SET XACT_ABORT ON;
    IF OBJECT_ID('tempdb..#cambios') IS NOT NULL DROP TABLE #cambios;
    BEGIN TRANSACTION;

    ;WITH base AS (
        SELECT s.id, s.marca_id, s.nombre AS actual,
               LEFT(c.nombre_fantasia
                    + CASE WHEN m.nombre <> c.nombre_fantasia THEN N' · ' + m.nombre ELSE N'' END
                    + N' · ' + ml.nombre, 120) AS fusionado
          FROM dmc.sucursal s
          JOIN dmc.cliente c  ON c.id  = s.cliente_id
          JOIN dmc.marca   m  ON m.id  = s.marca_id
          JOIN dmc.mall    ml ON ml.id = s.mall_id
    ),
    numerado AS (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY marca_id, fusionado ORDER BY id) AS n FROM base
    ),
    nuevo AS (
        SELECT id, actual,
               CASE WHEN n = 1 THEN fusionado
                    ELSE LEFT(fusionado, 120 - LEN(N' (' + CAST(n AS nvarchar(10)) + N')'))
                         + N' (' + CAST(n AS nvarchar(10)) + N')'
               END AS nombre
          FROM numerado
    )
    SELECT id, actual, nombre INTO #cambios FROM nuevo WHERE nombre COLLATE Latin1_General_BIN2 <> actual COLLATE Latin1_General_BIN2;

    DELETE c FROM #cambios c
     WHERE EXISTS (SELECT 1 FROM dmc.sucursal o
                    WHERE o.marca_id = (SELECT marca_id FROM dmc.sucursal WHERE id = c.id)
                      AND o.nombre = c.nombre AND o.id <> c.id
                      AND o.id NOT IN (SELECT id FROM #cambios));

    -- Dos pasos para no chocar con la restricción única mientras se renombra.
    UPDATE s SET nombre = N'~' + CAST(s.id AS nvarchar(20)) FROM dmc.sucursal s JOIN #cambios c ON c.id = s.id;
    UPDATE s SET nombre = c.nombre FROM dmc.sucursal s JOIN #cambios c ON c.id = s.id;

    DROP TABLE #cambios;
    COMMIT TRANSACTION;`);
}

// ── Clientes ────────────────────────────────────────────────────────────────

/** Un bit que admite «no se sabe»: null sigue siendo null. */
const bitONull = (v: boolean | number | null | undefined) => (v === null || v === undefined ? null : Boolean(v));

interface FilaCliente extends ConBaja {
  id: number;
  rut: string;
  razon_social: string;
  nombre_fantasia: string;
  notas: string | null;
  plan_calibracion: boolean | null;
  garantia_meses: number | null;
}

/** Todos los clientes, o solo los de `ids`. */
export async function listarClientes(filtro: { ids?: number[] } = {}): Promise<Cliente[]> {
  const baja = columnasDeBaja("cliente", "c");
  const filas = await consultaCon<FilaCliente>(
    `SELECT id, rut, razon_social, nombre_fantasia, activo, motivo_inactivo, notas, plan_calibracion, garantia_meses,
            ${baja.columnas}
       FROM dmc.cliente c
       ${baja.apply}
      ${filtro.ids ? `WHERE id IN ${subIds("ids")}` : ""}
      ORDER BY nombre_fantasia`,
    filtro.ids ? [paramIds("ids", filtro.ids)] : []
  );
  return filas.map((f) => ({
    id: num(f.id),
    rut: f.rut,
    razonSocial: f.razon_social,
    nombreFantasia: f.nombre_fantasia,
    activo: Boolean(f.activo),
    motivoInactivo: f.motivo_inactivo,
    baja: bajaDeFila(f),
    notas: f.notas,
    planCalibracion: bitONull(f.plan_calibracion),
    garantiaMeses: numONull(f.garantia_meses),
  }));
}

export async function getCliente(id: number): Promise<Cliente | undefined> {
  const [cliente] = await listarClientes({ ids: [id] });
  return cliente;
}

export interface DatosCliente {
  rut: string;
  razonSocial: string;
  nombreFantasia: string;
  activo: boolean;
  /** Obligatorio cuando `activo` es false. */
  motivoInactivo: string | null;
  notas: string | null;
  /** null = no se sabe. */
  planCalibracion: boolean | null;
  /** Plan de garantía de todos sus locales, en meses. null = ninguno. */
  garantiaMeses: number | null;
}

export async function guardarCliente(id: number | null, d: DatosCliente, actor: ActorEstado | null = null): Promise<number> {
  const rut = fmtRut(d.rut);
  if (await rutTomado("cliente", rut, id)) throw new RutRepetido("cliente", rut);

  const motivo = motivoParaGuardar(d.activo, d.motivoInactivo);
  const params: Parametros = [
    ["rut", sql.VarChar(12), rut],
    ["razon", sql.NVarChar(160), d.razonSocial],
    ["fantasia", sql.NVarChar(80), d.nombreFantasia],
    ["activo", sql.Bit, d.activo],
    // El motivo es del estado inactivo: al reactivar se borra.
    ["motivo", sql.NVarChar(400), motivo],
    ["notas", sql.NVarChar(sql.MAX), d.notas?.trim() || null],
    ["plan", sql.Bit, d.planCalibracion],
    ["garantia", sql.SmallInt, d.garantiaMeses],
  ];
  const guardado = await enTransaccion(async (ej) => {
    const antes = id === null ? null : await estadoActual(ej, "cliente", id);
    let filaId: number;
    if (id === null) {
      const [fila] = await ej.consulta<{ id: number }>(
        `INSERT INTO dmc.cliente (rut, razon_social, nombre_fantasia, activo, motivo_inactivo, notas, plan_calibracion, garantia_meses)
         OUTPUT INSERTED.id AS id
         VALUES (@rut, @razon, @fantasia, @activo, @motivo, @notas, @plan, @garantia)`,
        params
      );
      filaId = num(fila.id);
    } else {
      await ej.ejecutar(
        `UPDATE dmc.cliente
            SET rut = @rut, razon_social = @razon, nombre_fantasia = @fantasia, activo = @activo,
                motivo_inactivo = @motivo, notas = @notas, plan_calibracion = @plan, garantia_meses = @garantia
          WHERE id = @id`,
        [...params, ["id", sql.BigInt, id]]
      );
      filaId = id;
    }
    await anotarCambioDeEstado(ej, { entidad: "cliente", id: filaId, antes, despues: d.activo, motivo, actor });
    return filaId;
  });
  // El nombre del cliente es parte del de sus sucursales en mall.
  if (id !== null) await sincronizarNombresDeSucursales();
  return guardado;
}

// ── Marcas ──────────────────────────────────────────────────────────────────

interface FilaMarca extends ConBaja {
  id: number;
  cliente_id: number;
  nombre: string;
}

/** Todas las marcas, o solo las de un cliente. */
export async function listarMarcas(filtro: { clienteId?: number } = {}): Promise<Marca[]> {
  const baja = columnasDeBaja("marca", "m");
  const filas = await consultaCon<FilaMarca>(
    `SELECT id, cliente_id, nombre, activo, motivo_inactivo, ${baja.columnas}
       FROM dmc.marca m
       ${baja.apply}
      ${filtro.clienteId !== undefined ? "WHERE cliente_id = @cliente" : ""}
      ORDER BY nombre`,
    filtro.clienteId !== undefined ? [["cliente", sql.BigInt, filtro.clienteId]] : []
  );
  return filas.map((f) => ({
    id: num(f.id),
    clienteId: num(f.cliente_id),
    nombre: f.nombre,
    activo: Boolean(f.activo),
    motivoInactivo: f.motivo_inactivo,
    baja: bajaDeFila(f),
  }));
}

export interface DatosMarca {
  clienteId: number;
  nombre: string;
  activo: boolean;
  /** Obligatorio cuando `activo` es false. */
  motivoInactivo?: string | null;
}

export async function guardarMarca(id: number | null, d: DatosMarca, actor: ActorEstado | null = null): Promise<number> {
  const motivo = motivoParaGuardar(d.activo, d.motivoInactivo);
  const params: Parametros = [
    ["cliente", sql.BigInt, d.clienteId],
    ["nombre", sql.NVarChar(80), d.nombre],
    ["activo", sql.Bit, d.activo],
    ["motivo", sql.NVarChar(400), motivo],
  ];
  const guardado = await enTransaccion(async (ej) => {
    const antes = id === null ? null : await estadoActual(ej, "marca", id);
    let filaId: number;
    if (id === null) {
      const [fila] = await ej.consulta<{ id: number }>(
        `INSERT INTO dmc.marca (cliente_id, nombre, activo, motivo_inactivo)
         OUTPUT INSERTED.id AS id VALUES (@cliente, @nombre, @activo, @motivo)`,
        params
      );
      filaId = num(fila.id);
    } else {
      // El cliente de una marca no cambia: sus sucursales ya cuelgan de él (fk_sucursal_marca).
      await ej.ejecutar(
        `UPDATE dmc.marca SET nombre = @nombre, activo = @activo, motivo_inactivo = @motivo
          WHERE id = @id AND cliente_id = @cliente`,
        [...params, ["id", sql.BigInt, id]]
      );
      filaId = id;
    }
    await anotarCambioDeEstado(ej, { entidad: "marca", id: filaId, antes, despues: d.activo, motivo, actor });
    return filaId;
  });
  // El nombre de la marca es parte del de sus sucursales en mall.
  if (id !== null) await sincronizarNombresDeSucursales();
  return guardado;
}

// ── Malls ───────────────────────────────────────────────────────────────────

interface FilaMall extends ConBaja {
  id: number;
  nombre: string;
  direccion: string;
  comuna: string | null;
  region: string | null;
}

/** Todos los malls, o solo los de `ids`. */
export async function listarMalls(filtro: { ids?: number[] } = {}): Promise<Mall[]> {
  const baja = columnasDeBaja("mall", "ml");
  const filas = await consultaCon<FilaMall>(
    `SELECT id, nombre, direccion, comuna, region, activo, motivo_inactivo, ${baja.columnas}
       FROM dmc.mall ml
       ${baja.apply}
      ${filtro.ids ? `WHERE id IN ${subIds("ids")}` : ""}
      ORDER BY nombre`,
    filtro.ids ? [paramIds("ids", filtro.ids)] : []
  );
  return filas.map((f) => ({
    id: num(f.id),
    nombre: f.nombre,
    direccion: f.direccion,
    comuna: f.comuna ?? "",
    region: f.region ?? "",
    activo: Boolean(f.activo),
    motivoInactivo: f.motivo_inactivo,
    baja: bajaDeFila(f),
  }));
}

export async function getMall(id: number): Promise<Mall | undefined> {
  const [mall] = await listarMalls({ ids: [id] });
  return mall;
}

export interface DatosMall {
  nombre: string;
  direccion: string;
  comuna: string;
  region: string;
  activo: boolean;
  /** Obligatorio cuando `activo` es false. */
  motivoInactivo?: string | null;
}

export async function guardarMall(id: number | null, d: DatosMall, actor: ActorEstado | null = null): Promise<number> {
  const motivo = motivoParaGuardar(d.activo, d.motivoInactivo);
  const params: Parametros = [
    ["nombre", sql.NVarChar(120), d.nombre],
    ["direccion", sql.NVarChar(180), d.direccion],
    ["comuna", sql.NVarChar(80), d.comuna],
    ["region", sql.NVarChar(80), d.region],
    ["activo", sql.Bit, d.activo],
    ["motivo", sql.NVarChar(400), motivo],
  ];
  const guardado = await enTransaccion(async (ej) => {
    const antes = id === null ? null : await estadoActual(ej, "mall", id);
    let filaId: number;
    if (id === null) {
      const [fila] = await ej.consulta<{ id: number }>(
        `INSERT INTO dmc.mall (nombre, direccion, comuna, region, activo, motivo_inactivo)
         OUTPUT INSERTED.id AS id
         VALUES (@nombre, @direccion, @comuna, @region, @activo, @motivo)`,
        params
      );
      filaId = num(fila.id);
    } else {
      await ej.ejecutar(
        `UPDATE dmc.mall
            SET nombre = @nombre, direccion = @direccion, comuna = @comuna, region = @region, activo = @activo,
                motivo_inactivo = @motivo
          WHERE id = @id`,
        [...params, ["id", sql.BigInt, id]]
      );
      filaId = id;
    }
    await anotarCambioDeEstado(ej, { entidad: "mall", id: filaId, antes, despues: d.activo, motivo, actor });
    return filaId;
  });
  // El nombre del mall es parte del de sus tiendas.
  if (id !== null) await sincronizarNombresDeSucursales();
  return guardado;
}

/** Una sucursal está en un solo mall: no se saca de uno por agregarla a otro. */
export class TiendaEnOtroMall extends Error {
  constructor(public readonly tiendas: string[]) {
    super(`Sucursales que ya están en otro mall: ${tiendas.join(", ")}`);
    this.name = "TiendaEnOtroMall";
  }
}

/**
 * Deja en el mall exactamente esas tiendas: las que ya no vienen se sueltan y
 * las que vienen quedan en él. Si alguna ya está en otro mall no se guarda nada.
 */
export async function ponerTiendasDeMall(mallId: number, sucursalIds: number[]): Promise<void> {
  // Los ids van como JSON: la lista no tiene largo fijo y así sigue siendo un parámetro.
  const params: Parameters<typeof ejecutar>[1] = [
    ["mall", sql.BigInt, mallId],
    ["ids", sql.NVarChar(sql.MAX), JSON.stringify(sucursalIds)],
  ];
  const ajenas = await consultaCon<{ nombre: string; mall: string }>(
    `SELECT s.nombre, m.nombre AS mall
       FROM dmc.sucursal s
       JOIN (SELECT CAST([value] AS bigint) AS id FROM OPENJSON(@ids)) t ON t.id = s.id
       JOIN dmc.mall m ON m.id = s.mall_id
      WHERE s.mall_id <> @mall
      ORDER BY s.nombre`,
    params
  );
  if (ajenas.length) throw new TiendaEnOtroMall(ajenas.map((a) => `${a.nombre} (${a.mall})`));
  // Solo entran las que están sin mall: si otro la tomó entre medio, no se le quita.
  await ejecutar(
    `UPDATE s
        SET mall_id = CASE WHEN t.id IS NULL THEN NULL ELSE @mall END
       FROM dmc.sucursal s
       LEFT JOIN (SELECT CAST([value] AS bigint) AS id FROM OPENJSON(@ids)) t ON t.id = s.id
      WHERE (s.mall_id = @mall AND t.id IS NULL)
         OR (t.id IS NOT NULL AND s.mall_id IS NULL)`,
    params
  );
  // Cada tienda que entra o sale cambia de mall, y con él su nombre.
  await sincronizarNombresDeSucursales();
}

// ── Sucursales ──────────────────────────────────────────────────────────────

interface FilaSucursal extends ConBaja {
  id: number;
  cliente_id: number;
  marca_id: number;
  mall_id: number | null;
  nombre: string;
  codigo: string | null;
  direccion: string;
  comuna: string;
  region: string;
  telefono: string | null;
  notas: string | null;
  fecha_instalacion: string | null;
  remota: boolean | null;
  garantia_meses: number | null;
  plan_calibracion: boolean | null;
}

/** Todas las sucursales, o solo la de `id`, las de un cliente o las de un mall. */
export async function listarSucursales(
  filtro: { id?: number; clienteId?: number; mallId?: number } = {}
): Promise<Sucursal[]> {
  const donde: string[] = [];
  const params: Parametros = [];
  if (filtro.id !== undefined) {
    donde.push("id = @id");
    params.push(["id", sql.BigInt, filtro.id]);
  }
  if (filtro.clienteId !== undefined) {
    donde.push("cliente_id = @cliente");
    params.push(["cliente", sql.BigInt, filtro.clienteId]);
  }
  if (filtro.mallId !== undefined) {
    donde.push("mall_id = @mall");
    params.push(["mall", sql.BigInt, filtro.mallId]);
  }
  const baja = columnasDeBaja("sucursal", "s");
  const filas = await consultaCon<FilaSucursal>(
    `SELECT id, cliente_id, marca_id, mall_id, nombre, codigo, direccion, comuna, region, telefono, activo,
            motivo_inactivo, notas, ${F_FECHA("fecha_instalacion")} AS fecha_instalacion, remota, garantia_meses,
            plan_calibracion, ${baja.columnas}
       FROM dmc.sucursal s
       ${baja.apply}
      ${donde.length ? `WHERE ${donde.join(" AND ")}` : ""}
      ORDER BY nombre`,
    params
  );
  return filas.map((f) => ({
    id: num(f.id),
    clienteId: num(f.cliente_id),
    marcaId: num(f.marca_id),
    mallId: numONull(f.mall_id),
    nombre: f.nombre,
    codigo: f.codigo,
    direccion: f.direccion,
    comuna: f.comuna,
    region: f.region,
    telefono: f.telefono,
    activo: Boolean(f.activo),
    motivoInactivo: f.motivo_inactivo,
    baja: bajaDeFila(f),
    notas: f.notas,
    fechaInstalacion: f.fecha_instalacion,
    remota: bitONull(f.remota),
    garantiaMeses: numONull(f.garantia_meses),
    planCalibracion: bitONull(f.plan_calibracion),
  }));
}

export async function getSucursal(id: number): Promise<Sucursal | undefined> {
  const [sucursal] = await listarSucursales({ id });
  return sucursal;
}

export interface DatosSucursal {
  clienteId: number;
  /** Una marca de `clienteId`: la base lo exige con una FK compuesta. */
  marcaId: number;
  /** El mall en el que queda la tienda. null = a la calle: solo con su dirección. */
  mallId: number | null;
  nombre: string;
  /** Opcional: null o vacío se guarda como "sin código". */
  codigo: string | null;
  direccion: string;
  comuna: string;
  region: string;
  telefono: string | null;
  activo: boolean;
  /** Obligatorio cuando `activo` es false. */
  motivoInactivo: string | null;
  notas: string | null;
  /** YYYY-MM-DD. Este y los dos siguientes: null = no se sabe. */
  fechaInstalacion: string | null;
  remota: boolean | null;
  /** Duración propia de la garantía, en meses. null = aplica la del cliente, si la tiene. */
  garantiaMeses: number | null;
  /**
   * La de la tienda por su cuenta. Si el cliente está en plan,
   * la tienda lo está igual: esto solo cuenta cuando el cliente no lo está.
   */
  planCalibracion: boolean | null;
}

export async function guardarSucursal(id: number | null, d: DatosSucursal, actor: ActorEstado | null = null): Promise<number> {
  const motivo = motivoParaGuardar(d.activo, d.motivoInactivo);
  const params: Parametros = [
    ["cliente", sql.BigInt, d.clienteId],
    ["marca", sql.BigInt, d.marcaId],
    ["mall", sql.BigInt, d.mallId],
    ["nombre", sql.NVarChar(120), d.nombre],
    ["codigo", sql.VarChar(20), d.codigo?.trim() || null],
    ["direccion", sql.NVarChar(180), d.direccion],
    ["comuna", sql.NVarChar(80), d.comuna],
    ["region", sql.NVarChar(80), d.region],
    ["telefono", sql.VarChar(30), d.telefono],
    ["activo", sql.Bit, d.activo],
    // El motivo es del estado inactivo: al reactivar se borra.
    ["motivo", sql.NVarChar(400), motivo],
    ["notas", sql.NVarChar(sql.MAX), d.notas?.trim() || null],
    ["instalacion", sql.Date, d.fechaInstalacion || null],
    ["remota", sql.Bit, d.remota],
    ["garantia", sql.SmallInt, d.garantiaMeses],
    ["plan", sql.Bit, d.planCalibracion],
  ];
  const guardado = await enTransaccion(async (ej) => {
    const antes = id === null ? null : await estadoActual(ej, "sucursal", id);
    let filaId: number;
    if (id === null) {
      const [fila] = await ej.consulta<{ id: number }>(
        `INSERT INTO dmc.sucursal (cliente_id, marca_id, mall_id, nombre, codigo, direccion, comuna, region, telefono, activo,
                                   motivo_inactivo, notas, fecha_instalacion, remota, garantia_meses, plan_calibracion)
         OUTPUT INSERTED.id AS id
         VALUES (@cliente, @marca, @mall, @nombre, @codigo, @direccion, @comuna, @region, @telefono, @activo, @motivo, @notas,
                 @instalacion, @remota, @garantia, @plan)`,
        params
      );
      filaId = num(fila.id);
    } else {
      await ej.ejecutar(
        `UPDATE dmc.sucursal
            SET cliente_id = @cliente, marca_id = @marca, mall_id = @mall, nombre = @nombre, codigo = @codigo, direccion = @direccion,
                comuna = @comuna, region = @region, telefono = @telefono, activo = @activo,
                motivo_inactivo = @motivo, notas = @notas, fecha_instalacion = @instalacion, remota = @remota,
                garantia_meses = @garantia, plan_calibracion = @plan
          WHERE id = @id`,
        [...params, ["id", sql.BigInt, id]]
      );
      filaId = id;
    }
    await anotarCambioDeEstado(ej, { entidad: "sucursal", id: filaId, antes, despues: d.activo, motivo, actor });
    return filaId;
  });
  // Otra marca o mall cambia el nombre «Cliente · Marca · Mall».
  await sincronizarNombresDeSucursales();
  return guardado;
}

/** Una sucursal nueva dentro de un alta masiva. */
export interface DatosSucursalLote {
  clienteId: number;
  marcaId: number;
  mallId: number | null;
  nombre: string;
  codigo: string | null;
  direccion: string;
  comuna: string;
  region: string;
}

/**
 * Crea todas las sucursales nuevas, cada una con su cliente y su marca, en un
 * solo INSERT: o entran todas o ninguna. Las filas viajan como JSON, igual que en `ponerTiendasDeMall`.
 */
export async function crearSucursalesLote(filas: DatosSucursalLote[]): Promise<number> {
  const json = JSON.stringify(
    filas.map((f) => ({
      cliente: f.clienteId,
      marca: f.marcaId,
      mall: f.mallId,
      nombre: f.nombre,
      codigo: f.codigo?.trim() || null,
      direccion: f.direccion,
      comuna: f.comuna,
      region: f.region,
    }))
  );
  const creadas = await ejecutar(
    `INSERT INTO dmc.sucursal (cliente_id, marca_id, mall_id, nombre, codigo, direccion, comuna, region, activo)
     SELECT j.cliente, j.marca, j.mall, j.nombre, j.codigo, j.direccion, j.comuna, j.region, 1
       FROM OPENJSON(@filas)
            WITH (cliente bigint '$.cliente', marca bigint '$.marca', mall bigint '$.mall', nombre nvarchar(120) '$.nombre', codigo varchar(20) '$.codigo',
                  direccion nvarchar(180) '$.direccion', comuna nvarchar(80) '$.comuna', region nvarchar(80) '$.region') j`,
    [["filas", sql.NVarChar(sql.MAX), json]]
  );
  await sincronizarNombresDeSucursales();
  return creadas;
}

// ── Técnicos ────────────────────────────────────────────────────────────────

interface FilaTecnico {
  id: number;
  rut: string;
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string | null;
  nombre_completo: string;
  email: string;
  telefono: string | null;
  activo: boolean;
  /** Solo los trae listarTecnicos: quien lee un técnico suelto no los necesita. */
  motivo_inactivo?: string | null;
  baja_por?: string | null;
  baja_en?: string | null;
}

export function mapearTecnico(f: FilaTecnico): Tecnico {
  return {
    id: num(f.id),
    rut: f.rut,
    nombres: f.nombres,
    apellidoPaterno: f.apellido_paterno,
    apellidoMaterno: f.apellido_materno,
    nombreCompleto: f.nombre_completo,
    email: f.email,
    telefono: f.telefono,
    activo: Boolean(f.activo),
    motivoInactivo: f.motivo_inactivo ?? null,
    baja: bajaDeFila({
      activo: f.activo,
      motivo_inactivo: f.motivo_inactivo ?? null,
      baja_por: f.baja_por ?? null,
      baja_en: f.baja_en ?? null,
    }),
  };
}

export async function listarTecnicos(): Promise<Tecnico[]> {
  const baja = columnasDeBaja("tecnico", "t");
  const filas = await consulta<FilaTecnico>(
    `SELECT id, rut, nombres, apellido_paterno, apellido_materno, nombre_completo, email, telefono, activo,
            motivo_inactivo, ${baja.columnas}
       FROM dmc.tecnico t
       ${baja.apply}
      ORDER BY nombre_completo`
  );
  return filas.map(mapearTecnico);
}

export interface DatosTecnico {
  rut: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  email: string;
  telefono: string | null;
  activo: boolean;
  /** Obligatorio cuando `activo` es false. */
  motivoInactivo?: string | null;
}

export async function guardarTecnico(id: number | null, d: DatosTecnico, actor: ActorEstado | null = null): Promise<number> {
  const rut = fmtRut(d.rut);
  if (await rutTomado("tecnico", rut, id)) throw new RutRepetido("tecnico", rut);

  const motivo = motivoParaGuardar(d.activo, d.motivoInactivo);
  // nombre_completo es una columna calculada: no se inserta ni se actualiza.
  const params: Parametros = [
    ["rut", sql.VarChar(12), rut],
    ["nombres", sql.NVarChar(80), d.nombres],
    ["paterno", sql.NVarChar(80), d.apellidoPaterno],
    ["materno", sql.NVarChar(80), d.apellidoMaterno],
    ["email", sql.NVarChar(160), d.email],
    ["telefono", sql.VarChar(30), d.telefono],
    ["activo", sql.Bit, d.activo],
    ["motivo", sql.NVarChar(400), motivo],
  ];
  return enTransaccion(async (ej) => {
    const antes = id === null ? null : await estadoActual(ej, "tecnico", id);
    let filaId: number;
    if (id === null) {
      const [fila] = await ej.consulta<{ id: number }>(
        `INSERT INTO dmc.tecnico (rut, nombres, apellido_paterno, apellido_materno, email, telefono, activo, motivo_inactivo)
         OUTPUT INSERTED.id AS id
         VALUES (@rut, @nombres, @paterno, @materno, @email, @telefono, @activo, @motivo)`,
        params
      );
      filaId = num(fila.id);
    } else {
      await ej.ejecutar(
        `UPDATE dmc.tecnico
            SET rut = @rut, nombres = @nombres, apellido_paterno = @paterno, apellido_materno = @materno,
                email = @email, telefono = @telefono, activo = @activo, motivo_inactivo = @motivo
          WHERE id = @id`,
        [...params, ["id", sql.BigInt, id]]
      );
      filaId = id;
    }
    await anotarCambioDeEstado(ej, { entidad: "tecnico", id: filaId, antes, despues: d.activo, motivo, actor });
    return filaId;
  });
}

// ── Usuarios ────────────────────────────────────────────────────────────────

interface FilaUsuarioLista extends ConBaja {
  id: number;
  email: string;
  roles: string | null;
  rol_id: number | null;
  tecnico_id: number | null;
  ultimo_acceso_en: string | null;
}

export async function listarUsuarios(): Promise<Usuario[]> {
  const baja = columnasDeBaja("usuario", "u");
  const filas = await consulta<FilaUsuarioLista>(
    `SELECT id, email, rol_id, tecnico_id, activo, motivo_inactivo, ${F_TS("ultimo_acceso_en")} AS ultimo_acceso_en,
            (SELECT STRING_AGG(r.rol, ',') FROM dmc.usuario_rol r WHERE r.usuario_id = u.id) AS roles,
            ${baja.columnas}
       FROM dmc.usuario u
       ${baja.apply}
      ORDER BY email`
  );
  return filas.map((f) => ({
    id: num(f.id),
    email: f.email,
    roles: ordenarRoles((f.roles ?? "").split(",")),
    rolId: numONull(f.rol_id),
    tecnicoId: numONull(f.tecnico_id),
    activo: Boolean(f.activo),
    motivoInactivo: f.motivo_inactivo,
    baja: bajaDeFila(f),
    ultimoAccesoEn: f.ultimo_acceso_en,
  }));
}

export interface DatosUsuario {
  email: string;
  /** Sus roles (dmc.usuario_rol). Ver lib/roles.problemaDeRoles para las combinaciones. */
  roles: RolUsuario[];
  /** El rol del panel (dmc.rol). Solo cuenta si tiene el rol COORDINADOR. */
  rolId?: number | null;
  /** El técnico vinculado. Solo cuenta si tiene el rol TECNICO, y ahí es obligatorio. */
  tecnicoId: number | null;
  activo: boolean;
  /** Obligatorio cuando `activo` es false. */
  motivoInactivo?: string | null;
  /** Vacía al editar = deja la contraseña que ya tenía. */
  password: string;
}

/** La cuenta no se puede guardar así: el mensaje es para quien guarda. */
export class CuentaNoPermitida extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = "CuentaNoPermitida";
  }
}

/** Cómo quedaría la cuenta: lo que mira `autorizar`. */
export interface CuentaNueva {
  roles: RolUsuario[];
  rolId: number | null;
  tecnicoId: number | null;
  permisos: string[];
}

export interface ControlUsuario {
  /** Quien guarda. Si pone una clave en una cuenta ajena, el dueño tendrá que cambiarla al entrar. */
  actorId: number;
  /** Su correo, para el historial de cambios de estado. */
  actorEmail?: string;
  /**
   * El último control, ya con la fila de la cuenta tomada: recibe cómo está
   * (null en un alta) y cómo quedaría. Devuelve el motivo si no se puede.
   */
  autorizar: (actual: Cuenta | null, nueva: CuentaNueva) => string | null;
}

type EjecutorTx = Parameters<Parameters<typeof enTransaccion>[0]>[0];

/**
 * Deja los roles de la cuenta exactamente como vienen, en UNA sola sentencia:
 * tg_usuario_rol_coherente revisa el resultado final, y borrar e insertar por
 * separado lo haría pasar por estados inválidos (sin roles, o ADMIN y
 * COORDINADOR a la vez).
 */
async function fijarRoles(ej: EjecutorTx, usuarioId: number, roles: readonly RolUsuario[]): Promise<void> {
  await ej.ejecutar(
    `WITH actuales AS (SELECT usuario_id, rol FROM dmc.usuario_rol WHERE usuario_id = @id)
     MERGE actuales AS d
     USING (SELECT @id AS usuario_id, CAST(value AS varchar(12)) AS rol FROM STRING_SPLIT(@roles, ',')) AS o
        ON d.usuario_id = o.usuario_id AND d.rol = o.rol
      WHEN NOT MATCHED BY TARGET THEN INSERT (usuario_id, rol) VALUES (o.usuario_id, o.rol)
      WHEN NOT MATCHED BY SOURCE THEN DELETE;`,
    [
      ["id", sql.BigInt, usuarioId],
      ["roles", sql.VarChar(60), roles.join(",")],
    ]
  );
}

/**
 * Alta o edición de un usuario, con roles, datos y contraseña en una sola
 * transacción. Devuelve el id y su versión de sesión, que sube —y cierra sus
 * sesiones abiertas— si cambia la clave, los roles, el rol del panel o el
 * técnico vinculado, o si se desactiva.
 *
 * `d.password` vacía al editar = deja la que tenía. No se recorta nunca.
 */
export async function guardarUsuario(
  id: number | null,
  d: DatosUsuario,
  control: ControlUsuario
): Promise<{ id: number; sesionVersion: number }> {
  const email = d.email.trim().toLowerCase();
  const roles = ordenarRoles(d.roles);
  const problema = problemaDeRoles(roles, d.tecnicoId);
  if (problema) throw new CuentaNoPermitida(problema);
  // El técnico solo con el rol TECNICO; el rol del panel solo con COORDINADOR.
  const tecnicoId = tieneRolTecnico(roles) ? d.tecnicoId : null;
  const rolId = roles.includes("COORDINADOR") ? d.rolId ?? null : null;
  // bcrypt tarda: va antes de abrir la transacción, no con las filas tomadas.
  const hash = id === null || d.password !== "" ? await hashearPassword(d.password) : null;
  // La clave que pone otra persona es temporal: el dueño la cambia al entrar.
  const debeCambiar = id === null || id !== control.actorId;
  const motivoBaja = motivoParaGuardar(d.activo, d.motivoInactivo);
  const actor: ActorEstado = { id: control.actorId, email: control.actorEmail ?? "" };

  return enTransaccion(async (ej) => {
    const actual = id === null ? null : await leerCuenta(id, ej, true);
    if (id !== null && !actual) throw new CuentaNoPermitida("Esa cuenta ya no existe. Recarga la página.");

    const rol = rolId === null ? null : await leerRol(rolId, ej);
    if (rolId !== null && !rol) throw new CuentaNoPermitida("Ese rol ya no existe. Recarga la página y elige otro.");
    const motivo = control.autorizar(actual, {
      roles,
      rolId,
      tecnicoId,
      permisos: permisosDelPanel(roles, rolId, rol?.permisos ?? []),
    });
    if (motivo) throw new CuentaNoPermitida(motivo);

    if (actual === null) {
      // Sin roles todavía: es el alta de los roles la que dispara las reglas.
      const [fila] = await ej.consulta<{ id: number }>(
        `INSERT INTO dmc.usuario (email, password_hash, rol_id, tecnico_id, activo, motivo_inactivo, debe_cambiar_password)
         VALUES (@email, @hash, @rolId, @tecnico, @activo, @motivo, @debe);
         SELECT CAST(SCOPE_IDENTITY() AS bigint) AS id;`,
        [
          ["email", sql.NVarChar(160), email],
          ["hash", sql.NVarChar(200), hash],
          ["rolId", sql.BigInt, rolId],
          ["tecnico", sql.BigInt, tecnicoId],
          ["activo", sql.Bit, d.activo],
          ["motivo", sql.NVarChar(400), motivoBaja],
          ["debe", sql.Bit, debeCambiar],
        ]
      );
      const nuevoId = num(fila.id);
      await fijarRoles(ej, nuevoId, roles);
      await anotarCambioDeEstado(ej, {
        entidad: "usuario",
        id: nuevoId,
        antes: null,
        despues: d.activo,
        motivo: motivoBaja,
        actor,
      });
      return { id: nuevoId, sesionVersion: 0 };
    }

    const revoca =
      hash !== null ||
      !mismosRoles(actual.roles, roles) ||
      actual.rolId !== rolId ||
      actual.tecnicoId !== tecnicoId ||
      (actual.activo && !d.activo);

    // En tres pasos, para que cada sentencia deje la cuenta válida ante los
    // triggers de la migración 044:
    //   1. se suma el técnico nuevo y se suelta el rol del panel que se va;
    //   2. se fijan los roles;
    //   3. quedan el técnico y el rol del panel definitivos.
    await ej.ejecutar(
      `UPDATE dmc.usuario
          SET tecnico_id = COALESCE(@tecnico, tecnico_id),
              rol_id = CASE WHEN @rolId IS NULL THEN NULL ELSE rol_id END
        WHERE id = @id`,
      [
        ["tecnico", sql.BigInt, tecnicoId],
        ["rolId", sql.BigInt, rolId],
        ["id", sql.BigInt, actual.id],
      ]
    );
    await fijarRoles(ej, actual.id, roles);
    // Sin OUTPUT: dmc.usuario tiene trigger de actualización. La versión se
    // relee en el mismo lote.
    const [fila] = await ej.consulta<{ sesion_version: number }>(
      `UPDATE dmc.usuario
          SET email = @email, rol_id = @rolId, tecnico_id = @tecnico, activo = @activo,
              motivo_inactivo = @motivo,
              password_hash = COALESCE(@hash, password_hash),
              debe_cambiar_password = CASE WHEN @hash IS NULL THEN debe_cambiar_password ELSE @debe END,
              sesion_version = sesion_version + @revoca
        WHERE id = @id;
       SELECT sesion_version FROM dmc.usuario WHERE id = @id;`,
      [
        ["email", sql.NVarChar(160), email],
        ["rolId", sql.BigInt, rolId],
        ["tecnico", sql.BigInt, tecnicoId],
        ["activo", sql.Bit, d.activo],
        ["motivo", sql.NVarChar(400), motivoBaja],
        ["hash", sql.NVarChar(200), hash],
        ["debe", sql.Bit, debeCambiar],
        ["revoca", sql.Int, revoca ? 1 : 0],
        ["id", sql.BigInt, actual.id],
      ]
    );
    await anotarCambioDeEstado(ej, {
      entidad: "usuario",
      id: actual.id,
      antes: actual.activo,
      despues: d.activo,
      motivo: motivoBaja,
      actor,
    });
    // Cambia la clave, los roles o se desactiva: sus navegadores dejan de recibir avisos push.
    if (revoca) {
      await ej.ejecutar(`DELETE FROM dmc.push_suscripcion WHERE usuario_id = @id`, [["id", sql.BigInt, actual.id]]);
    }
    return { id: actual.id, sesionVersion: num(fila.sesion_version) };
  });
}

type Parametros = Parameters<typeof consultaCon>[1];
