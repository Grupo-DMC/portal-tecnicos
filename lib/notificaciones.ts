// Catálogo de la campanita de notificaciones.
//
// Cada cosa que se hace en el sistema deja una fila en dmc.actividad con uno de
// estos tipos (ver lib/data/actividad.ts). Cada usuario decide, por tipo, qué
// hacer con lo que hacen los demás:
//
//   AVISAR  ... aparece en la lista y suma al número rojo de la campanita
//               (y, si lo activó en ese equipo, sale un aviso del navegador).
//   MOSTRAR ... aparece en la lista, sin número ni aviso.
//   OCULTAR ... no aparece.
//
// Lo que hace uno mismo no avisa nunca: aparece en la lista, marcado como
// «tú», si tiene encendido «Mostrar mis propios cambios».
//
// Cada tipo pide un permiso para verse: quien no puede abrir Visitas no se
// entera de lo que pasa en ellas. Este archivo lo importan el servidor y los
// componentes de cliente.

import { tiene } from "@/lib/permisos";

export type NivelAviso = "AVISAR" | "MOSTRAR" | "OCULTAR";
export const NIVELES: readonly NivelAviso[] = ["AVISAR", "MOSTRAR", "OCULTAR"];

export interface TipoNotificacion {
  clave: string;
  /** Qué pasó, dicho para la pantalla de configuración. */
  label: string;
  /** El permiso que hace falta para enterarse. */
  permiso: string;
  /** Lo que vale mientras el usuario no lo cambie. */
  defecto: NivelAviso;
}

export interface GrupoNotificacion {
  clave: string;
  label: string;
  tipos: TipoNotificacion[];
}

export const GRUPOS_NOTIFICACION: GrupoNotificacion[] = [
  {
    clave: "tecnicos",
    label: "Técnicos en terreno",
    tipos: [
      { clave: "tecnico.cierre", label: "Completa una visita (cierra el acta)", permiso: "visitas.ver", defecto: "AVISAR" },
      { clave: "tecnico.estado", label: "Reagenda, deja pendiente o cancela una visita", permiso: "visitas.ver", defecto: "AVISAR" },
      { clave: "tecnico.alta", label: "Agrega una visita en terreno", permiso: "visitas.ver", defecto: "AVISAR" },
      { clave: "tecnico.pedido", label: "Pide permiso para corregir su acta", permiso: "visitas.ver", defecto: "AVISAR" },
      { clave: "tecnico.correccion", label: "Corrige su acta ya cerrada", permiso: "visitas.ver", defecto: "AVISAR" },
      { clave: "tecnico.inicio", label: "Inicia una visita", permiso: "visitas.ver", defecto: "MOSTRAR" },
    ],
  },
  {
    clave: "visitas",
    label: "Visitas desde el panel",
    tipos: [
      { clave: "visita.alta", label: "Agenda visitas", permiso: "visitas.ver", defecto: "MOSTRAR" },
      { clave: "visita.cambio", label: "Corrige, reprograma o libera visitas", permiso: "visitas.ver", defecto: "MOSTRAR" },
      { clave: "visita.cancelacion", label: "Cancela visitas por admin", permiso: "visitas.ver", defecto: "MOSTRAR" },
      { clave: "visita.eliminacion", label: "Elimina visitas", permiso: "visitas.ver", defecto: "AVISAR" },
      { clave: "acta.cambio", label: "Edita, envía o abre a corrección un acta", permiso: "visitas.ver", defecto: "MOSTRAR" },
    ],
  },
  {
    clave: "seguimiento",
    label: "Seguimiento",
    tipos: [
      { clave: "problema.cambio", label: "Cambia el estado de un problema", permiso: "problemas.ver", defecto: "MOSTRAR" },
      { clave: "gestion.pendiente", label: "Marca la gestión de un pendiente", permiso: "reagendas.ver", defecto: "OCULTAR" },
      { clave: "gestion.problema", label: "Marca la gestión de un problema", permiso: "problemas.ver", defecto: "OCULTAR" },
    ],
  },
  {
    clave: "maestros",
    label: "Maestros y cuentas",
    tipos: [
      { clave: "maestro.clientes", label: "Crea o edita clientes y marcas", permiso: "clientes.ver", defecto: "MOSTRAR" },
      { clave: "maestro.sucursales", label: "Crea o edita sucursales y malls", permiso: "sucursales.ver", defecto: "MOSTRAR" },
      { clave: "maestro.contactos", label: "Crea o edita contactos", permiso: "contactos.ver", defecto: "MOSTRAR" },
      { clave: "maestro.tecnicos", label: "Crea o edita técnicos", permiso: "tecnicos.ver", defecto: "MOSTRAR" },
      { clave: "maestro.checklist", label: "Cambia el checklist", permiso: "checklist.ver", defecto: "MOSTRAR" },
      { clave: "cuenta.cambio", label: "Crea o edita usuarios, roles y permisos", permiso: "usuarios.ver", defecto: "MOSTRAR" },
      { clave: "cuenta.password", label: "Alguien pide una contraseña nueva", permiso: "usuarios.contrasenas", defecto: "AVISAR" },
    ],
  },
];

export const TIPOS_NOTIFICACION: TipoNotificacion[] = GRUPOS_NOTIFICACION.flatMap((g) => g.tipos);

const POR_CLAVE = new Map(TIPOS_NOTIFICACION.map((t) => [t.clave, t]));

export function tipoNotificacion(clave: string): TipoNotificacion | undefined {
  return POR_CLAVE.get(clave);
}

/** Lo que el usuario eligió por tipo. Lo que falta vale su `defecto`. */
export type PreferenciasAviso = Record<string, NivelAviso>;

export interface ConfiguracionAvisos {
  niveles: PreferenciasAviso;
  /** Mostrar en la lista lo que hace uno mismo. */
  verPropios: boolean;
}

export const CONFIGURACION_POR_DEFECTO: ConfiguracionAvisos = { niveles: {}, verPropios: true };

export function nivelDe(niveles: PreferenciasAviso, clave: string): NivelAviso {
  const elegido = niveles[clave];
  if (elegido && NIVELES.includes(elegido)) return elegido;
  return POR_CLAVE.get(clave)?.defecto ?? "OCULTAR";
}

/** Los grupos con solo los tipos que estos permisos dejan ver. Los grupos vacíos no salen. */
export function gruposVisibles(permisos: readonly string[]): GrupoNotificacion[] {
  return GRUPOS_NOTIFICACION.map((g) => ({ ...g, tipos: g.tipos.filter((t) => tiene(permisos, t.permiso)) })).filter(
    (g) => g.tipos.length > 0
  );
}

/**
 * Qué tipos de lo que hacen los demás llegan a la lista (`mostrar`) y cuáles
 * además suman al número de la campanita (`avisar`), según permisos y
 * preferencias.
 */
export function tiposPara(permisos: readonly string[], niveles: PreferenciasAviso): { mostrar: string[]; avisar: string[] } {
  const mostrar: string[] = [];
  const avisar: string[] = [];
  for (const t of TIPOS_NOTIFICACION) {
    if (!tiene(permisos, t.permiso)) continue;
    const nivel = nivelDe(niveles, t.clave);
    if (nivel === "OCULTAR") continue;
    mostrar.push(t.clave);
    if (nivel === "AVISAR") avisar.push(t.clave);
  }
  return { mostrar, avisar };
}

/**
 * Las preferencias que vale la pena guardar: solo tipos que existen, que estos
 * permisos dejan ver, y con un nivel distinto de su defecto.
 */
export function preferenciasParaGuardar(permisos: readonly string[], niveles: PreferenciasAviso): PreferenciasAviso {
  const limpio: PreferenciasAviso = {};
  for (const [clave, nivel] of Object.entries(niveles)) {
    const tipo = POR_CLAVE.get(clave);
    if (!tipo || !tiene(permisos, tipo.permiso) || !NIVELES.includes(nivel)) continue;
    if (nivel !== tipo.defecto) limpio[clave] = nivel;
  }
  return limpio;
}

/** Una notificación tal como la recibe la campanita. */
export interface Notificacion {
  id: number;
  /** 'YYYY-MM-DDTHH:mm:ss', hora del servidor. */
  creadoEn: string;
  tipo: string;
  /** Quién lo hizo; null cuando no hay cuenta detrás (pedir contraseña). */
  actor: string | null;
  /** Lo hizo quien está mirando. */
  propia: boolean;
  /** Lo hizo un técnico desde el celular. */
  deTecnico: boolean;
  /** La frase sin el sujeto: «cerró el acta de V-2026-00012». */
  texto: string;
  /** Lo que ayuda a ubicarlo: la sucursal, el nombre del registro… */
  detalle: string | null;
  enlace: string | null;
  /** Llegó después de la última vez que abrió la campanita y es de un tipo que avisa. */
  nueva: boolean;
}

export interface BandejaNotificaciones {
  items: Notificacion[];
  /** Cuántas nuevas que avisan hay (tope 99). */
  noLeidas: number;
  configuracion: ConfiguracionAvisos;
}

/** «hace 5 min», «ayer 14:20», «3 nov 09:15» respecto de `ahora`. */
export function cuandoFue(creadoEn: string, ahora: Date = new Date()): string {
  const fecha = new Date(creadoEn);
  if (Number.isNaN(fecha.getTime())) return "";
  const seg = Math.round((ahora.getTime() - fecha.getTime()) / 1000);
  if (seg < 60) return "recién";
  if (seg < 3600) return `hace ${Math.floor(seg / 60)} min`;
  const hora = `${String(fecha.getHours()).padStart(2, "0")}:${String(fecha.getMinutes()).padStart(2, "0")}`;
  const mismoDia = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (mismoDia(fecha, ahora)) return `hoy ${hora}`;
  const ayer = new Date(ahora);
  ayer.setDate(ayer.getDate() - 1);
  if (mismoDia(fecha, ayer)) return `ayer ${hora}`;
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
  return `${fecha.getDate()} ${meses[fecha.getMonth()]} ${hora}`;
}
