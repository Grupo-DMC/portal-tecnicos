import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  agregarCorreo,
  esClaveAdjunto,
  leerCorreos,
  repartirDestinatarios,
  sugerenciasDeCorreo,
  yaIncluido,
} from "@/lib/ui/correo";
import { armarCorreoActa, datosClaveActa, escaparHtml } from "@/lib/correo/plantilla-acta";
import { configCorreo, enviarCorreo, partesRemitente, remitenteDe } from "@/lib/correo/proveedor";
import type { ContactoAplicable } from "@/lib/ui/contactos";
import type { Visita } from "@/lib/types";

const visita = {
  id: 9,
  folio: "V-1",
  estado: "COMPLETADA",
  fechaProgramada: "2026-11-02",
  cliente: { nombreFantasia: "Tiendas Sur" },
  sucursal: { nombre: "Mall Plaza <Norte>" },
  tecnico: { nombreCompleto: "Ana Rojas" },
  tecnicoAyudante: { nombreCompleto: "Luis Soto" },
  motivosNombres: ["Visita preventiva"],
  motivosCodigos: ["VISITA"],
  ejecucion: {
    horaInicio: "2026-11-02T09:15:00",
    horaTermino: "2026-11-02T10:40:00",
    responsableNombre: "Carla Díaz",
    responsableCargo: "Jefa de tienda",
    motivosRealesCodigos: ["VISITA"],
    comentarioInterno: "NO DEBE SALIR",
  },
  problemas: [{ estado: "ABIERTO" }, { estado: "RESUELTO" }],
} as unknown as Visita;

describe("leerCorreos", () => {
  it("separa por coma, punto y coma o espacio, sin repetidos y con los malos aparte", () => {
    expect(leerCorreos("a@x.cl; b@x.cl,  A@X.cl <c@x.cl> malo@")).toEqual({
      validos: ["a@x.cl", "b@x.cl", "c@x.cl"],
      invalidos: ["malo@"],
    });
    expect(leerCorreos("  ")).toEqual({ validos: [], invalidos: [] });
  });

  it("agregarCorreo no duplica y yaIncluido mira Para y CC", () => {
    expect(agregarCorreo("", "a@x.cl")).toBe("a@x.cl");
    expect(agregarCorreo("a@x.cl,", "b@x.cl")).toBe("a@x.cl, b@x.cl");
    expect(agregarCorreo("A@x.cl", "a@x.cl")).toBe("A@x.cl");
    expect(yaIncluido("b@x.cl", "a@x.cl", "B@x.cl")).toBe(true);
    expect(yaIncluido("c@x.cl", "a@x.cl", "b@x.cl")).toBe(false);
  });

  it("solo acepta claves de adjunto conocidas", () => {
    expect(["pdf", "zip"].every(esClaveAdjunto)).toBe(true);
    expect(["video:1", "foto:1", "ZIP", "pdf2", ""].some(esClaveAdjunto)).toBe(false);
  });
});

describe("destinatarios", () => {
  const aplicable = (nombre: string, email: string | null, origen: ContactoAplicable["origen"], cargo = "Jefe"): ContactoAplicable =>
    ({
      contacto: { id: 1, nombre, email, telefono: null, activo: true, cargos: [] },
      cargo: { id: 1, cargo, alcanceTipo: origen, alcanceId: 1, alcanceTexto: null },
      origen,
      heredado: origen !== "SUCURSAL",
    }) as ContactoAplicable;

  it("sugiere contactos y correos ya usados, sin repetidos ni el correo de quien envía", () => {
    const s = sugerenciasDeCorreo(
      [
        aplicable("Pedro", "pedro@tienda.cl", "SUCURSAL"),
        aplicable("Sin correo", null, "SUCURSAL"),
        aplicable("Gerente", "gerente@marca.cl", "MARCA", "Gerente zonal"),
      ],
      [
        { nombre: "Carla", email: "carla@tienda.cl", detalle: "Firmó en la tienda" },
        { nombre: null, email: "PEDRO@tienda.cl", detalle: "Envío anterior · esta tienda" },
        { nombre: null, email: "yo@dmc.cl", detalle: "Envío anterior · cliente" },
        { nombre: null, email: "malo@", detalle: "Envío anterior · cliente" },
      ],
      ["Yo@dmc.cl"]
    );
    expect(s.map((x) => x.email)).toEqual(["pedro@tienda.cl", "gerente@marca.cl", "carla@tienda.cl"]);
    expect(s[0].detalle).toBe("Jefe · esta tienda");
    expect(s[1].detalle).toBe("Gerente zonal · Marca");
  });

  it("reparte Para, CC y CCO sin repetir un correo entre campos", () => {
    expect(repartirDestinatarios({ para: "a@x.cl, b@x.cl", cc: "B@x.cl, c@x.cl", cco: "c@x.cl d@x.cl malo@" })).toEqual({
      para: ["a@x.cl", "b@x.cl"],
      cc: ["c@x.cl"],
      cco: ["d@x.cl"],
      invalidos: ["malo@"],
    });
  });
});

describe("plantilla del correo", () => {
  it("lleva los datos clave de la visita, sin filas vacías", () => {
    expect(datosClaveActa(visita)).toEqual([
      ["Folio", "V-1"],
      ["Cliente", "Tiendas Sur"],
      ["Tienda", "Mall Plaza <Norte>"],
      ["Fecha", "02/11/2026"],
      ["Horario en tienda", "09:15 a 10:40"],
      ["Motivo", "Visita preventiva"],
      ["Técnicos", "Ana Rojas y Luis Soto"],
      ["Recibió en tienda", "Carla Díaz · Jefa de tienda"],
      ["Puntos pendientes", "1"],
    ]);
  });

  it("escapa el HTML, respeta los saltos de línea y no incluye nada interno", () => {
    const { html, texto } = armarCorreoActa(visita, "Hola <b>equipo</b>\nlínea dos\n\nOtro párrafo", ["acta.pdf"]);
    expect(html).toContain("Mall Plaza &lt;Norte&gt;");
    expect(html).toContain("Hola &lt;b&gt;equipo&lt;/b&gt;<br>línea dos");
    expect(html).toContain("Adjuntos: acta.pdf");
    expect(html).not.toContain("<b>equipo");
    expect(html + texto).not.toContain("NO DEBE SALIR");
    expect(texto).toContain("Folio:");
    expect(texto).toContain("Hola <b>equipo</b>");
    expect(escaparHtml(`"'&`)).toBe("&quot;&#39;&amp;");
  });
});

describe("proveedor (Resend)", () => {
  const original = { ...process.env };
  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_prueba";
    process.env.CORREO_REMITENTE = "Actas <actas@ejemplo.cl>";
    delete process.env.CORREO_DOMINIOS;
  });
  afterEach(() => {
    process.env = { ...original };
    vi.unstubAllGlobals();
  });

  const correo = {
    de: '"Actas" <coordina@ejemplo.cl>',
    responderA: "coordina@ejemplo.cl",
    para: ["a@x.cl"],
    cc: [] as string[],
    cco: [] as string[],
    asunto: "Acta",
    html: "<p>hola</p>",
    texto: "hola",
    adjuntos: [{ nombre: "acta.pdf", contenido: Buffer.from("PDF"), tipo: "application/pdf" }],
    idempotencia: "acta-envio-5",
  };

  it("sin clave o sin remitente no está configurado y no llama a nadie", async () => {
    delete process.env.RESEND_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(configCorreo()).toBeNull();
    expect((await enviarCorreo(correo)).ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("manda la clave solo en la cabecera, el adjunto en base64 y la clave de idempotencia", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "msg_1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await enviarCorreo(correo)).toEqual({ ok: true, id: "msg_1" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers).toMatchObject({ Authorization: "Bearer re_prueba", "Idempotency-Key": "acta-envio-5" });
    const cuerpo = JSON.parse(init.body);
    expect(cuerpo).toMatchObject({ from: '"Actas" <coordina@ejemplo.cl>', reply_to: "coordina@ejemplo.cl", to: ["a@x.cl"], subject: "Acta" });
    expect(cuerpo.cc).toBeUndefined();
    expect(cuerpo.bcc).toBeUndefined();
    expect(cuerpo.attachments[0]).toEqual({ filename: "acta.pdf", content: Buffer.from("PDF").toString("base64"), content_type: "application/pdf" });
    expect(init.body).not.toContain("re_prueba");
  });

  it("manda la copia oculta como bcc", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "m" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await enviarCorreo({ ...correo, cc: ["c@x.cl"], cco: ["oculto@x.cl"] });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ cc: ["c@x.cl"], bcc: ["oculto@x.cl"] });
  });

  it("sale con el correo de la sesión si su dominio está verificado; si no, con el de respaldo", () => {
    const config = configCorreo()!;
    expect(config.dominios).toEqual(["ejemplo.cl"]);
    expect(partesRemitente("Actas <actas@ejemplo.cl>")).toEqual({ nombre: "Actas", correo: "actas@ejemplo.cl" });
    expect(remitenteDe("coordina@ejemplo.cl", config)).toEqual({
      de: '"Actas" <coordina@ejemplo.cl>',
      responderA: "coordina@ejemplo.cl",
      conSuCorreo: true,
    });
    expect(remitenteDe("alguien@gmail.com", config)).toEqual({
      de: "Actas <actas@ejemplo.cl>",
      responderA: "alguien@gmail.com",
      conSuCorreo: false,
    });
    process.env.CORREO_DOMINIOS = "@dmc.cl, otro.cl";
    expect(remitenteDe("ana@DMC.cl", configCorreo()!).conSuCorreo).toBe(true);
  });

  it("traduce los errores del proveedor y de la red", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "domain not verified" }), { status: 403 })));
    expect(await enviarCorreo(correo)).toEqual({
      ok: false,
      error: "El proveedor de correo rechazó la clave o el remitente (403): domain not verified.",
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 429 })));
    expect((await enviarCorreo(correo)) as { error: string }).toMatchObject({ error: expect.stringMatching(/límite de envíos/) });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    expect(await enviarCorreo(correo)).toEqual({ ok: false, error: "No se pudo conectar con el proveedor de correo." });
  });
});
