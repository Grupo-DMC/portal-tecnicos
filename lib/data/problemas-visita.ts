import "server-only";
import { enTransaccion, num, sql, type Ejecutor, type Parametro } from "@/lib/data/sql";
import { insertarItemsDeProblema, insertarProblema } from "@/lib/data/visitas-acta";
import { listarProblemas } from "@/lib/data/catalogos";
import type { ProblemaEdicion, SubtrabajoActa } from "@/lib/contratos/acta";
import { T } from "@/lib/db/esquema";

// Problemas de una visita que todavía no tiene el acta cerrada.
//
// Un problema suele nacer en el acta que el técnico cierra en terreno. Pero
// coordinación también se entera de problemas por su cuenta (una llamada de la
// tienda, el técnico que avisa antes de cerrar) y los tiene que poder anotar en
// la visita, con cuántos equipos son, igual que en el acta. En una visita ya
// cerrada se hace desde «Editar el acta» (lib/data/ediciones), que además deja
// el registro de qué cambió; acá es para el resto de los estados.
//
// Lo anotado desde el panel queda marcado (registrado_en_panel): cuando el
// técnico cierra el acta, sus propios problemas se reescriben pero estos no se
// tocan, y se suman a los del acta.

export interface ResultadoProblemasVisita {
  ok: boolean;
  error?: string;
  agregados?: number;
  modificados?: number;
  quitados?: number;
}

/** Un rechazo a mitad de la transacción: deshace lo escrito y llega como mensaje. */
class Rechazo extends Error {}

const cantidad = (n: number) => Math.min(99, Math.max(1, Math.round(Number(n)) || 1));
const txt = (s: string | null | undefined) => String(s ?? "").trim();

/** Los items sin etiquetas vacías ni repetidas, con la cantidad dentro de lo permitido. */
function limpiarItems(items: SubtrabajoActa[]): SubtrabajoActa[] {
  const vistas = new Set<string>();
  const salida: SubtrabajoActa[] = [];
  for (const it of items ?? []) {
    const etiqueta = txt(it.etiqueta);
    if (!etiqueta || vistas.has(etiqueta)) continue;
    vistas.add(etiqueta);
    salida.push({ etiqueta, cantidad: cantidad(it.cantidad) });
  }
  return salida;
}

const huella = (items: SubtrabajoActa[]) =>
  items
    .map((s) => `${s.etiqueta}×${s.cantidad}`)
    .sort()
    .join("|");

/**
 * ¿Coordinación ya gestionó este problema? Si cambió de estado, tiene una visita
 * agendada para resolverlo, historial o fotos y videos colgando de él, quitarlo
 * se llevaría todo eso: no se quita, solo se corrige.
 */
export async function problemaGestionado(ej: Ejecutor, visitaId: number, problemaId: number): Promise<boolean> {
  const [fila] = await ej.consulta<{ id: number }>(
    `SELECT p.id FROM ${T.problema} p
      WHERE p.id = @p AND p.visita_id = @id
        AND (p.estado <> 'ABIERTO'
             OR EXISTS (SELECT 1 FROM ${T.problema_visita_resolucion} r WHERE r.problema_id = p.id)
             OR EXISTS (SELECT 1 FROM ${T.visita} v2 WHERE v2.problema_origen_id = p.id)
             OR EXISTS (SELECT 1 FROM ${T.problema_historial} h WHERE h.problema_id = p.id)
             OR EXISTS (SELECT 1 FROM ${T.visita_foto} f WHERE f.problema_id = p.id)
             OR EXISTS (SELECT 1 FROM ${T.visita_video} w WHERE w.problema_id = p.id))`,
    [
      ["p", sql.BigInt, problemaId],
      ["id", sql.BigInt, visitaId],
    ]
  );
  return !!fila;
}

/** El mensaje cuando se intenta quitar un problema que coordinación ya gestionó. */
export function textoGestionado(nombre: string, dondeSeQuita: string): string {
  return `El problema «${nombre}» ya lo gestionó coordinación (cambió su estado o tiene una visita agendada): no se puede quitar ${dondeSeQuita}. Su estado se cambia en Problemas.`;
}

interface FilaProblema {
  id: number;
  tipo_codigo: string;
  descripcion: string | null;
}

/**
 * Deja los problemas de la visita como vienen: los que traen id se corrigen en
 * su misma fila (conservan su estado y su historial), los que no, se agregan, y
 * los que ya no vienen se quitan, salvo los que coordinación ya gestionó.
 *
 * Solo en una visita que no tenga el acta cerrada. Va todo en una transacción.
 */
export async function guardarProblemasDeVisita(
  folio: string,
  problemas: ProblemaEdicion[]
): Promise<ResultadoProblemasVisita> {
  const nombres = new Map((await listarProblemas()).map((p) => [p.codigo, p.nombre]));
  const nombre = (codigo: string) => nombres.get(codigo) ?? codigo;

  try {
    return await enTransaccion(async (ej) => {
      const [visita] = await ej.consulta<{ id: number; estado: string }>(
        `SELECT id, estado FROM ${T.visita} WITH (UPDLOCK, ROWLOCK) WHERE folio = @folio AND activo = 1`,
        [["folio", sql.VarChar(16), folio]]
      );
      if (!visita) throw new Rechazo("No encontramos esa visita.");
      if (visita.estado === "COMPLETADA") {
        throw new Rechazo("Esta visita ya tiene el acta cerrada: agrega los problemas desde «Editar el acta».");
      }
      const id = num(visita.id);
      const p = (extra: Parametro[] = []): Parametro[] => [["id", sql.BigInt, id], ...extra];

      const filas = await ej.consulta<FilaProblema>(
        `SELECT id, tipo_codigo, descripcion FROM ${T.problema} WHERE visita_id = @id ORDER BY orden, id`,
        p()
      );
      const itemsAntes = await ej.consulta<{ problema_id: number; etiqueta: string; cantidad: number }>(
        `SELECT i.problema_id, i.etiqueta, i.cantidad
           FROM ${T.problema_item} i JOIN ${T.problema} pr ON pr.id = i.problema_id
          WHERE pr.visita_id = @id`,
        p()
      );
      const antes = new Map(
        filas.map((f) => [
          num(f.id),
          {
            tipo: f.tipo_codigo,
            desc: txt(f.descripcion),
            items: itemsAntes
              .filter((i) => num(i.problema_id) === num(f.id))
              .map((i) => ({ etiqueta: i.etiqueta, cantidad: num(i.cantidad) })),
          },
        ])
      );

      // Cada uno que viene: o se corrige el que ya estaba, o es nuevo. Un id que
      // no es de esta visita (o repetido) se toma como nuevo, nunca como el de otra.
      const vistos = new Set<number>();
      const orden: { id: number | null; tipo: string; desc: string; items: SubtrabajoActa[] }[] = [];
      let modificados = 0;
      let agregados = 0;
      for (const pr of problemas) {
        const existente = pr.id && antes.has(pr.id) && !vistos.has(pr.id) ? pr.id : null;
        const ahora = { id: existente, tipo: pr.tipoCodigo, desc: txt(pr.descripcion), items: limpiarItems(pr.items) };
        orden.push(ahora);
        if (existente === null) {
          agregados += 1;
          continue;
        }
        vistos.add(existente);
        const previo = antes.get(existente)!;
        if (previo.tipo !== ahora.tipo || previo.desc !== ahora.desc || huella(previo.items) !== huella(ahora.items)) {
          modificados += 1;
          await ej.ejecutar(
            `UPDATE ${T.problema} SET tipo_codigo = @tipo, descripcion = @desc WHERE id = @pr AND visita_id = @id;
             DELETE FROM ${T.problema_item} WHERE problema_id = @pr;`,
            p([
              ["pr", sql.BigInt, existente],
              ["tipo", sql.VarChar(40), ahora.tipo],
              ["desc", sql.NVarChar(sql.MAX), ahora.desc || null],
            ])
          );
          await insertarItemsDeProblema(ej, existente, ahora.items);
        }
      }

      const quitados = [...antes.keys()].filter((k) => !vistos.has(k));
      for (const quitado of quitados) {
        if (await problemaGestionado(ej, id, quitado)) {
          throw new Rechazo(textoGestionado(nombre(antes.get(quitado)!.tipo), "de la visita"));
        }
        await ej.ejecutar(`DELETE FROM ${T.problema} WHERE id = @pr AND visita_id = @id`, p([["pr", sql.BigInt, quitado]]));
      }

      if (!agregados && !modificados && !quitados.length) {
        throw new Rechazo("No cambiaste nada: los problemas quedaron como estaban.");
      }

      // El orden de la lista es el orden de la visita.
      for (const [i, pr] of orden.entries()) {
        if (pr.id === null) {
          await insertarProblema(
            ej,
            id,
            { tipoCodigo: pr.tipo, estado: "ABIERTO", descripcion: pr.desc || null, solucion: null, items: pr.items },
            i + 1,
            true
          );
        } else {
          await ej.ejecutar(
            `UPDATE ${T.problema} SET orden = @orden WHERE id = @pr AND visita_id = @id AND orden <> @orden`,
            p([
              ["pr", sql.BigInt, pr.id],
              ["orden", sql.SmallInt, i + 1],
            ])
          );
        }
      }

      return { ok: true, agregados, modificados, quitados: quitados.length };
    });
  } catch (err) {
    if (err instanceof Rechazo) return { ok: false, error: err.message };
    throw err;
  }
}
