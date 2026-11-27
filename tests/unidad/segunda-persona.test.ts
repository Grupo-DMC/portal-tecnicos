import { describe, expect, it } from "vitest";
import { enSegundaPersona } from "@/lib/ui/segunda-persona";

describe("enSegundaPersona", () => {
  it.each([
    ["agendó la visita V-2026-00001", "agendaste la visita V-2026-00001"],
    ["agendó 3 visitas de una vez", "agendaste 3 visitas de una vez"],
    ["reprogramó la visita V-2026-00001 para el 02-12-2026", "reprogramaste la visita V-2026-00001 para el 02-12-2026"],
    ["eliminó 5 visitas a la vez", "eliminaste 5 visitas a la vez"],
    ["corrigió el acta de la visita V-1", "corregiste el acta de la visita V-1"],
    ["pidió permiso para corregir", "pediste permiso para corregir"],
    ["inició la visita V-1", "iniciaste la visita V-1"],
    ["cambió el checklist", "cambiaste el checklist"],
    ["envió el acta", "enviaste el acta"],
    ["creó una sucursal", "creaste una sucursal"],
    ["le abrió al técnico la corrección", "le abriste al técnico la corrección"],
    ["dejó pendiente la visita V-1: «sin acceso»", "dejaste pendiente la visita V-1: «sin acceso»"],
  ])("%s", (de, a) => {
    expect(enSegundaPersona(de)).toBe(a);
  });

  it("deja igual lo que no empieza con un verbo en pretérito", () => {
    expect(enSegundaPersona("visita V-1 actualizada")).toBe("visita V-1 actualizada");
  });
});
