// Esquema de SQL Server donde viven los objetos de la aplicación.
//
// Ninguna consulta escribe el nombre del esquema: arma el nombre de cada tabla
// con `T`:
//
//     `SELECT id FROM ${T.visita} WHERE …`      →  FROM tecnico.visita
//
// Así cambiar de esquema (dmc → tecnico) o mover un grupo de tablas a otro
// (clientes) se resuelve acá y no con buscar y reemplazar en 700 consultas.
//
// Este módulo no importa nada de Next ni de `server-only` a propósito: lo usan
// también los tests E2E y los scripts de consola, que corren fuera de Next.
//
// Variables de entorno (todas opcionales):
//
//   DB_SCHEMA           Esquema de las tablas propias de la app. Por defecto
//                       `dmc`, que es el de DMC_Contingencia (producción hoy).
//                       En DMC_Core es `tecnico`.
//   DB_SCHEMA_CLIENTES  Esquema de las tablas de clientes (ver GRUPO_CLIENTES).
//                       Si falta, usan DB_SCHEMA: hoy están todas juntas.
//   DB_SCHEMA_SEGURIDAD Esquema de cuentas y roles (ver GRUPO_SEGURIDAD).
//                       Si falta, usan DB_SCHEMA.
//
// En DMC_Core: DB_SCHEMA=tecnico, DB_SCHEMA_CLIENTES=clientes,
// DB_SCHEMA_SEGURIDAD=seguridad. Cada objeto se consulta por el esquema donde
// vive de verdad; la app no depende de los sinónimos que `tecnico` conserva
// para las vistas y los triggers.
//
// El valor por defecto sigue siendo `dmc` para que un despliegue de este código
// funcione contra la base actual sin tocar el entorno. El corte a DMC_Core
// define DB_SCHEMA=tecnico junto con la base y las credenciales.

export type GrupoEsquema = "tecnico" | "clientes" | "seguridad";

/** Esquema de DB_SCHEMA cuando la variable falta (el de DMC_Contingencia). */
const ESQUEMA_POR_DEFECTO = "dmc";

/** Todo nombre de esquema entra en el texto SQL: solo un identificador simple. */
const IDENTIFICADOR = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

/**
 * Cuentas, roles y rastro de seguridad: el esquema `seguridad` de DMC_Core.
 * Los triggers viven en el esquema de su tabla. La lista real de la base la da
 * `npm run verificar-ubicacion`; si una migración mueve otro objeto, se agrega acá.
 */
export const GRUPO_SEGURIDAD = [
  "usuario",
  "usuario_rol",
  "usuario_foto",
  "rol",
  "rol_permiso",
  "intento_login",
  "solicitud_password",
  "auditoria",
  "cambio_estado",
  "tg_usuario_actualizado",
  "tg_usuario_rol_coherente",
  "tg_usuario_roles_coherentes",
] as const;

/**
 * Tablas del esquema de clientes (`clientes` en DMC_Core). Mientras
 * DB_SCHEMA_CLIENTES no esté definida siguen en DB_SCHEMA, que es lo que
 * necesita DMC_Contingencia.
 */
export const GRUPO_CLIENTES = [
  "cliente",
  "marca",
  "sucursal",
  "mall",
  "contacto",
  "contacto_cargo",
  "persona_local",
  "catalogo_cargo",
  "sucursal_nombre_anterior",
  "tg_cat_cargo_actualizado",
  "tg_cliente_actualizado",
  "tg_contacto_actualizado",
  "tg_mall_actualizado",
  "tg_marca_actualizado",
  "tg_sucursal_actualizado",
] as const;

/**
 * Todos los objetos con nombre de esquema que la app usa: tablas, vistas, la
 * secuencia de folios y los triggers. Si una migración crea uno nuevo, se
 * agrega acá; el test tests/unidad/esquema-objetos.test.ts avisa si falta.
 */
export const OBJETOS = [
  // Tablas
  "acta_envio", "acta_envio_adjunto", "acta_seccion_config", "actividad", "auditoria", "cambio_estado",
  "catalogo_cargo", "catalogo_interno", "catalogo_motivo", "catalogo_motivo_trabajo", "catalogo_pendiente",
  "catalogo_problema", "catalogo_problema_estado", "catalogo_problema_gestion", "catalogo_problema_opcion",
  "catalogo_seccion", "catalogo_trabajo", "catalogo_trabajo_subtrabajo", "checklist_plantilla", "cliente",
  "contacto", "contacto_cargo", "correo_aviso", "correo_aviso_lote", "intento_login", "mall", "marca",
  "notificacion_canal", "notificacion_correo", "notificacion_preferencia", "notificacion_usuario",
  "persona_local", "problema", "problema_gestion", "problema_historial", "problema_item",
  "problema_visita_resolucion", "push_suscripcion", "reagendamiento", "rol", "rol_permiso", "schema_version",
  "sincronizacion_cola", "solicitud_password", "sucursal", "sucursal_nombre_anterior", "tecnico", "usuario",
  "usuario_foto", "usuario_rol", "visita", "visita_adjunto", "visita_aviso_problema",
  "visita_aviso_problema_detalle", "visita_borrador", "visita_edicion", "visita_ejecucion",
  "visita_eliminacion", "visita_estado_historial", "visita_firma", "visita_foto", "visita_interno",
  "visita_motivo", "visita_pendiente_gestion", "visita_reserva", "visita_trabajo",
  "visita_trabajo_subtrabajo", "visita_video",
  // Vistas
  "v_carga_tecnico", "v_cumplimiento_dia", "v_problema_abierto", "v_sucursal_fallas", "v_visita_cancelada_admin",
  "v_visita_realizada",
  // Secuencia
  "seq_folio_visita",
  // Triggers
  "tg_cat_cargo_actualizado", "tg_cat_interno_actualizado", "tg_cat_motivo_actualizado",
  "tg_cat_pendiente_actualizado", "tg_cat_prob_gestion_actualizado", "tg_cat_problema_actualizado",
  "tg_cat_trabajo_actualizado", "tg_cliente_actualizado", "tg_contacto_actualizado", "tg_ejecucion_actualizado",
  "tg_mall_actualizado", "tg_marca_actualizado", "tg_problema_cambio", "tg_sucursal_actualizado",
  "tg_tecnico_actualizado", "tg_usuario_actualizado", "tg_usuario_rol_coherente",
  "tg_usuario_roles_coherentes", "tg_visita_cambio",
] as const;

export type Objeto = (typeof OBJETOS)[number];

const CONOCIDOS: ReadonlySet<string> = new Set(OBJETOS);
const DEL_GRUPO_CLIENTES: ReadonlySet<string> = new Set(GRUPO_CLIENTES);
const DEL_GRUPO_SEGURIDAD: ReadonlySet<string> = new Set(GRUPO_SEGURIDAD);

function leer(nombre: string): string | undefined {
  const valor = process.env[nombre]?.trim();
  return valor ? valor : undefined;
}

function validar(variable: string, valor: string): string {
  if (!IDENTIFICADOR.test(valor)) {
    throw new Error(
      `${variable}="${valor}" no es un nombre de esquema válido: usa letras, números y guion bajo, sin espacios ni puntos.`
    );
  }
  return valor;
}

/** El esquema de un grupo de tablas, según el entorno. */
export function esquema(grupo: GrupoEsquema = "tecnico"): string {
  const base = validar("DB_SCHEMA", leer("DB_SCHEMA") ?? ESQUEMA_POR_DEFECTO);
  if (grupo === "tecnico") return base;
  const variable = grupo === "clientes" ? "DB_SCHEMA_CLIENTES" : "DB_SCHEMA_SEGURIDAD";
  const propio = leer(variable);
  return propio ? validar(variable, propio) : base;
}

/** El grupo al que pertenece un objeto. */
export function grupoDe(objeto: string): GrupoEsquema {
  if (DEL_GRUPO_SEGURIDAD.has(objeto)) return "seguridad";
  return DEL_GRUPO_CLIENTES.has(objeto) ? "clientes" : "tecnico";
}

/** `esquema.objeto`, listo para ir en el texto de una consulta. */
export function calificado(objeto: Objeto): string {
  if (!CONOCIDOS.has(objeto)) {
    // Solo se llega acá con un nombre armado en tiempo de ejecución (T[tabla]).
    throw new Error(`"${String(objeto)}" no es un objeto conocido del esquema; agrégalo a OBJETOS en lib/db/esquema.ts.`);
  }
  return `${esquema(grupoDe(objeto))}.${objeto}`;
}

/**
 * Nombres calificados con el esquema vigente. Se resuelve en cada acceso, no al
 * importar, así que un cambio de entorno (los tests lo hacen) se respeta.
 *
 *   `FROM ${T.visita}`  /  `NEXT VALUE FOR ${T.seq_folio_visita}`
 *   `FROM ${T[tabla]}`  (con `tabla` de un tipo cerrado, nunca entrada del usuario)
 */
export const T = new Proxy({} as Readonly<Record<Objeto, string>>, {
  get(_destino, nombre) {
    return typeof nombre === "string" ? calificado(nombre as Objeto) : undefined;
  },
});
