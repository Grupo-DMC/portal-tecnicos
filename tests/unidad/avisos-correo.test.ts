import { describe, expect, it } from "vitest";
import {
  AJUSTES_CORREO_POR_DEFECTO,
  TIPOS_NOTIFICACION,
  canalesParaGuardar,
  correoDe,
  horaResumenValida,
  modoCorreoPara,
  pushDe,
  quierePush,
  tiposPara,
} from "@/lib/notificaciones";
import { armarCorreoAvisos, cuandoCorto, enlaceAbsoluto, type NovedadCorreo } from "@/lib/correo/plantilla-avisos";
import { MODULOS } from "@/lib/permisos";

const TODOS = MODULOS.flatMap((m) => m.acciones.map((a) => `${m.clave}.${a.clave}`));
const ON = AJUSTES_CORREO_POR_DEFECTO;

describe("push por tipo", () => {
  it("sin preferencias, es exactamente lo que avisa la campanita (como antes de la 043)", () => {
    const niveles = { "tecnico.inicio": "AVISAR", "tecnico.cierre": "MOSTRAR" } as const;
    const { avisar } = tiposPara(TODOS, niveles);
    for (const t of TIPOS_NOTIFICACION) {
      expect(quierePush(TODOS, niveles, {}, t.clave), t.clave).toBe(avisar.includes(t.clave));
    }
  });

  it("lo elegido manda sobre el nivel, pero nunca sin permiso", () => {
    expect(pushDe({}, { "visita.alta": { push: true, correo: null } }, "visita.alta")).toBe(true);
    expect(pushDe({}, { "tecnico.cierre": { push: false, correo: null } }, "tecnico.cierre")).toBe(false);
    expect(quierePush(["clientes.ver"], {}, { "visita.alta": { push: true, correo: null } }, "visita.alta")).toBe(false);
  });
});

describe("correo por tipo", () => {
  it("los importantes salen por defecto; el resto no", () => {
    expect(correoDe({}, "tecnico.pedido")).toBe("MOMENTO");
    expect(correoDe({}, "cuenta.password")).toBe("MOMENTO");
    expect(correoDe({}, "tecnico.cierre")).toBe("RESUMEN");
    expect(correoDe({}, "visita.alta")).toBe("NUNCA");
    expect(correoDe({}, "no.existe")).toBe("NUNCA");
  });

  it("el interruptor general y el permiso cortan todo", () => {
    expect(modoCorreoPara(TODOS, {}, ON, "tecnico.pedido")).toBe("MOMENTO");
    expect(modoCorreoPara(TODOS, {}, { ...ON, activo: false }, "tecnico.pedido")).toBe("NUNCA");
    expect(modoCorreoPara(["clientes.ver"], {}, ON, "tecnico.pedido")).toBe("NUNCA");
    expect(modoCorreoPara(TODOS, { "visita.alta": { push: null, correo: "RESUMEN" } }, ON, "visita.alta")).toBe("RESUMEN");
  });
});

describe("canalesParaGuardar", () => {
  it("guarda solo lo distinto del defecto, de tipos que existen y puede ver", () => {
    const limpio = canalesParaGuardar(["visitas.ver"], { "visita.alta": "AVISAR" }, {
      "tecnico.cierre": { push: true, correo: "RESUMEN" }, // igual al defecto
      "visita.alta": { push: false, correo: "MOMENTO" }, // push difiere del nivel AVISAR
      "maestro.clientes": { push: true, correo: "MOMENTO" }, // sin permiso
      "inventado.algo": { push: true, correo: "MOMENTO" },
      "tecnico.inicio": { push: null, correo: "RARO" as never },
    });
    expect(limpio).toEqual({ "visita.alta": { push: false, correo: "MOMENTO" } });
  });
});

describe("horaResumenValida", () => {
  it("acepta 0-23 y lo demás vale la de por defecto", () => {
    expect(horaResumenValida(0)).toBe(0);
    expect(horaResumenValida(23)).toBe(23);
    expect(horaResumenValida(24)).toBe(18);
    expect(horaResumenValida("x")).toBe(18);
    expect(horaResumenValida(7.5)).toBe(18);
  });
});

describe("plantilla del correo de avisos", () => {
  const base = "https://visitas.ejemplo.cl";
  const n = (id: number, extra: Partial<NovedadCorreo> = {}): NovedadCorreo => ({
    id,
    tipo: "tecnico.pedido",
    creadoEn: "2026-11-18T14:05:00",
    actor: "Ana <b>",
    texto: `pidió permiso para corregir el acta de la visita V-${id}`,
    detalle: "Tienda Centro",
    enlace: `/admin/visitas/V-${id}`,
    ...extra,
  });

  it("una sola novedad va en el asunto", () => {
    const c = armarCorreoAvisos({ modo: "MOMENTO", novedades: [n(1)], total: 1, urlBase: base });
    expect(c.asunto).toBe("Ana <b> pidió permiso para corregir el acta de la visita V-1");
    expect(c.html).toContain("Ana &lt;b&gt;");
    expect(c.html).not.toContain("Ana <b>");
    expect(c.html).toContain(`${base}/admin/visitas/V-1`);
    expect(c.texto).toContain(`${base}/admin/visitas/V-1`);
    expect(c.texto).toContain(`${base}/admin/cuenta#avisos`);
  });

  it("varias se cuentan, y el resumen lo dice", () => {
    const c = armarCorreoAvisos({ modo: "RESUMEN", novedades: [n(1), n(2)], total: 5, urlBase: base });
    expect(c.asunto).toBe("Resumen del día: 5 novedades en visitas técnicas");
    expect(c.texto).toContain("Y 3 más");
  });

  it("solo enlaza rutas internas", () => {
    expect(enlaceAbsoluto(base, "/admin/x")).toBe(`${base}/admin/x`);
    expect(enlaceAbsoluto(base, "//evil.com/x")).toBeNull();
    expect(enlaceAbsoluto(base, "https://evil.com")).toBeNull();
    expect(enlaceAbsoluto(base, null)).toBeNull();
  });

  it("la hora sale tal cual la dio el servidor", () => {
    expect(cuandoCorto("2026-11-18T09:07:00")).toBe("18 nov 09:07");
    expect(cuandoCorto("basura")).toBe("");
  });
});
