import { describe, expect, it } from "vitest";
import { gruposDeSubtrabajos } from "@/lib/ui/subtrabajos";
import {
  aGruposTrabajo,
  problemaDeSubgrupos,
  subtrabajosDelBorrador,
  type Grupo,
} from "@/components/admin/checklist/modelo";
import { borradorChecklist } from "@/lib/validacion/checklist";
import type { CatalogoTrabajo, CatalogoTrabajoSubtrabajo } from "@/lib/types";

let id = 0;
const sub = (etiqueta: string, grupo: string | null = null): CatalogoTrabajoSubtrabajo => ({
  id: (id += 1),
  trabajoId: 1,
  etiqueta,
  grupo,
  orden: id,
  permiteCantidad: false,
  activo: true,
});

const trabajo = (subtrabajos: CatalogoTrabajoSubtrabajo[], grupoLabel: string | null = "Antenas"): CatalogoTrabajo => ({
  id: 1,
  codigo: "CAMBIO",
  nombre: "Cambio de equipos",
  grupoLabel,
  singular: null,
  orden: 1,
  activo: true,
  subtrabajos,
  motivosCodigos: [],
  ordenEnMotivo: {},
});

describe("gruposDeSubtrabajos", () => {
  it("sin grupos adicionales devuelve uno solo, titulado con grupoLabel", () => {
    const g = gruposDeSubtrabajos(trabajo([sub("Pórtico 1"), sub("Pórtico 2")]));
    expect(g).toHaveLength(1);
    expect(g[0].titulo).toBe("Antenas");
    expect(g[0].subtrabajos.map((s) => s.etiqueta)).toEqual(["Pórtico 1", "Pórtico 2"]);
  });

  it("reparte por grupo, con el primero siempre arriba", () => {
    const g = gruposDeSubtrabajos(
      trabajo([sub("Cable UTP", "Cables"), sub("Pórtico 1"), sub("Fuente", "Energía"), sub("Cable coaxial", "cables ")])
    );
    expect(g.map((x) => x.titulo)).toEqual(["Antenas", "Cables", "Energía"]);
    expect(g[1].subtrabajos.map((s) => s.etiqueta)).toEqual(["Cable UTP", "Cable coaxial"]);
  });

  it("sin grupoLabel usa el título por defecto", () => {
    expect(gruposDeSubtrabajos(trabajo([sub("A")], null))[0].titulo).toBe("Subtrabajos");
  });
});

describe("editor del checklist: grupos de subtrabajos", () => {
  it("ida y vuelta: lo que se lee se vuelve a mandar con el mismo grupo y en bloque", () => {
    const [g] = aGruposTrabajo(
      [trabajo([sub("Pórtico 1"), sub("Cable UTP", "Cables"), sub("Pórtico 2"), sub("Fuente", "Energía")])],
      []
    );
    expect(g.subgrupos?.map((s) => s.nombre)).toEqual(["Cables", "Energía"]);
    expect(subtrabajosDelBorrador(g).map((s) => [s.etiqueta, s.grupo])).toEqual([
      ["Pórtico 1", null],
      ["Pórtico 2", null],
      ["Cable UTP", "Cables"],
      ["Fuente", "Energía"],
    ]);
  });

  it("un subtrabajo de un grupo que ya no existe cae en el primero", () => {
    const g: Grupo = {
      key: "t",
      id: null,
      codigo: null,
      nombre: "X",
      grupoLabel: "",
      subgrupos: [],
      items: [{ key: "a", id: null, etiqueta: "A", permiteCantidad: false, subgrupo: "borrado" }],
    };
    expect(subtrabajosDelBorrador(g)[0].grupo).toBeNull();
  });

  it("no deja guardar un grupo con subtrabajos y sin nombre, ni dos grupos con el mismo nombre", () => {
    const base = (nombres: string[]): Grupo => ({
      key: "t",
      id: null,
      codigo: null,
      nombre: "Cambio",
      grupoLabel: "Antenas",
      subgrupos: nombres.map((nombre, i) => ({ key: `g${i}`, nombre })),
      items: nombres.map((_, i) => ({ key: `i${i}`, id: null, etiqueta: `Op ${i}`, permiteCantidad: false, subgrupo: `g${i}` })),
    });
    expect(problemaDeSubgrupos(base(["Cables", "Energía"]))).toBeNull();
    expect(problemaDeSubgrupos(base([" "]))).toMatch(/sin nombre/);
    expect(problemaDeSubgrupos(base(["Cables", "cables"]))).toMatch(/dos grupos/);
    expect(problemaDeSubgrupos(base(["antenas"]))).toMatch(/dos grupos/);
    // Un grupo vacío se ignora: no se guarda.
    const vacio = base(["Cables"]);
    vacio.subgrupos!.push({ key: "vacio", nombre: "" });
    expect(problemaDeSubgrupos(vacio)).toBeNull();
  });

  it("la validación del servidor acepta el grupo y lo limita a 60 caracteres", () => {
    const borrador = (grupo: string | null) => ({
      motivos: [],
      problemas: [],
      trabajos: [
        { id: null, nombre: "T", grupoLabel: null, subtrabajos: [{ id: null, etiqueta: "A", permiteCantidad: false, grupo }] },
      ],
    });
    expect(borradorChecklist.safeParse(borrador("Cables")).success).toBe(true);
    expect(borradorChecklist.safeParse(borrador(null)).success).toBe(true);
    expect(borradorChecklist.safeParse(borrador("x".repeat(61))).success).toBe(false);
  });
});
