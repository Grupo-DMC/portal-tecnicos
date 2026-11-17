"use server";

import { revalidatePath } from "next/cache";
import { log } from "@/lib/log";
import { sesionCon } from "@/lib/auth";
import { auditar } from "@/lib/data/auditoria";
import { registrarActividad } from "@/lib/data/actividad";
import { guardarProblemasDeVisita } from "@/lib/data/problemas-visita";
import type { ProblemaEdicion } from "@/lib/contratos/acta";
import { validar } from "@/lib/validacion/comun";
import { entradaProblemasVisita } from "@/lib/validacion/actas";
import { errorDeProblemasVisita } from "@/lib/validacion/reglas-acta";

// Registrar los problemas encontrados en una visita que todavía no tiene el
// acta cerrada. La visita con el acta cerrada se corrige desde «Editar el
// acta» (app/actions/ediciones), que además pide el motivo y deja el registro.
//
// Permiso: «Corregir visitas» (visitas.editar), el mismo que corrige el resto
// de los datos de una visita. Quien edita actas cerradas es otro permiso.

export interface ResultadoProblemasVisitaAccion {
  ok: boolean;
  error?: string;
  /** Lo que se hizo, dicho en una frase para el aviso. */
  resumen?: string;
}

function plural(n: number, uno: string, varios: string) {
  return `${n} ${n === 1 ? uno : varios}`;
}

export async function registrarProblemasVisitaAction(pedido: {
  folio: string;
  problemas: ProblemaEdicion[];
}): Promise<ResultadoProblemasVisitaAccion> {
  const sesion = await sesionCon("visitas.editar");
  if (!sesion) return { ok: false, error: "No tienes permiso para corregir visitas." };
  const entrada = validar(entradaProblemasVisita, pedido, "registrarProblemasVisita");
  if (!entrada.ok) return { ok: false, error: entrada.error };
  const { folio, problemas } = entrada.datos;
  const falta = errorDeProblemasVisita(problemas);
  if (falta) return { ok: false, error: falta };

  try {
    const res = await guardarProblemasDeVisita(folio, problemas);
    if (!res.ok) return { ok: false, error: res.error };

    const partes = [
      res.agregados ? `agregó ${plural(res.agregados, "problema", "problemas")}` : "",
      res.modificados ? `corrigió ${plural(res.modificados, "problema", "problemas")}` : "",
      res.quitados ? `quitó ${plural(res.quitados, "problema", "problemas")}` : "",
    ].filter(Boolean);
    await auditar(sesion, {
      accion: "visita.problemas",
      entidad: "visita",
      entidadId: folio,
      detalle: { agregados: res.agregados, modificados: res.modificados, quitados: res.quitados },
    });
    await registrarActividad(sesion, {
      tipo: "visita.cambio",
      texto: `registró problemas en la visita ${folio} (${partes.join(", ")})`,
      folio,
    });
    revalidatePath("/tecnico", "layout");
    revalidatePath("/admin", "layout");
    revalidatePath(`/admin/visitas/${folio}`);
    return { ok: true, resumen: partes.join(", ") };
  } catch (err) {
    const texto = err instanceof Error ? err.message : String(err);
    if (/fk_problema_tipo/i.test(texto)) {
      return { ok: false, error: "Ese tipo de problema ya no está en el checklist. Elige otro." };
    }
    log.error("registrarProblemasVisita", { err });
    return { ok: false, error: "No se pudo guardar en el servidor. Revisa la conexión e inténtalo otra vez." };
  }
}
