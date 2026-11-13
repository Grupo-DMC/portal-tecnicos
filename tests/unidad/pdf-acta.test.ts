import { PDFDocument, PDFPage } from "pdf-lib";
import { afterEach, describe, expect, it, vi } from "vitest";
import { generarPdfActa, type DatosPdfActa } from "@/lib/pdf/acta";

// PNG de 1×1 píxel (rojo): suficiente para que pdf-lib lo incruste de verdad.
const PNG_1X1 = Uint8Array.from(
  Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64")
);

const visita = (extra: Record<string, unknown> = {}) =>
  ({
    id: 1,
    folio: "V-0123",
    estado: "COMPLETADA",
    fechaProgramada: "2026-10-13",
    fechaHasta: null,
    horaProgramada: null,
    trabajoSolicitado: "Revisión general de antenas",
    indicacionesAcceso: null,
    motivoCodigo: "VISITA",
    motivosCodigos: ["VISITA"],
    motivosNombres: ["Visita preventiva"],
    cliente: { nombreFantasia: "Cliente Uno", razonSocial: "Cliente Uno SpA" },
    marca: { nombre: "Marca Uno" },
    sucursal: { nombre: "Tienda Centro", codigo: "T-01", direccion: "Av. Principal 100", comuna: "Santiago", region: "Metropolitana" },
    mall: null,
    tecnico: { nombreCompleto: "Ana Pérez" },
    tecnicoAyudante: undefined,
    responsableNombre: "María Soto",
    responsableCargo: null,
    ejecucion: {
      horaInicio: "2026-10-13T10:00:00",
      horaTermino: "2026-10-13T11:20:00",
      responsableNombre: "María Soto",
      responsableCargo: "Jefa de tienda",
      responsableRut: "11.111.111-1",
      responsableTelefono: "+56911111111",
      observaciones: "Todo funcionando. Observación visible al cliente.",
      comentarioInterno: "COMENTARIO_SECRETO_INTERNO",
      motivosRealesCodigos: ["VISITA"],
      dispositivo: "Pixel",
    },
    trabajos: [],
    problemas: [],
    internos: [{ codigo: "INT", etiqueta: "ITEM_INTERNO_SECRETO" }],
    fotos: [],
    firmas: [{ id: 1, rol: "TIENDA", nombre: "María Soto", rut: "11.111.111-1", firmadoEn: "2026-10-13T11:19:00", imagenUrl: "/x" }],
    ...extra,
  }) as never;

const datos = (extra: Partial<DatosPdfActa> = {}): DatosPdfActa => ({
  visita: visita(),
  motivos: [{ codigo: "VISITA", nombre: "Visita preventiva" } as never],
  trabajos: [],
  problemas: [],
  fotos: [],
  firma: { bytes: PNG_1X1, mime: "image/png" },
  ...extra,
});

/** Todo el texto que el generador dibujó, página por página. */
function espiarTexto() {
  const dibujado: string[] = [];
  const original = PDFPage.prototype.drawText;
  const espia = vi.spyOn(PDFPage.prototype, "drawText").mockImplementation(function (this: PDFPage, texto, opciones) {
    dibujado.push(String(texto));
    return original.call(this, texto, opciones);
  });
  return { dibujado, restaurar: () => espia.mockRestore() };
}

afterEach(() => vi.restoreAllMocks());

// Armar PDF reales (con fotos) es lento, y más aún con la instrumentación de cobertura.
describe("generarPdfActa", { timeout: 30_000 }, () => {
  it("genera un PDF válido de al menos una página con el título y el folio", async () => {
    const pdf = await generarPdfActa(datos());
    expect(Buffer.from(pdf.slice(0, 5)).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(doc.getTitle()).toBe("Acta V-0123");
  });

  it("escribe lo que el cliente debe ver: tienda, técnico, responsable y observaciones", async () => {
    const { dibujado } = espiarTexto();
    await generarPdfActa(datos());
    const todo = dibujado.join(" | ");
    expect(todo).toContain("V-0123");
    expect(todo).toContain("Tienda Centro");
    expect(todo).toContain("Ana Pérez");
    expect(todo).toContain("María Soto");
    expect(todo).toContain("Observación visible al cliente");
  });

  it("el comentario interno y su checklist NO llegan al PDF que se manda al cliente", async () => {
    const { dibujado } = espiarTexto();
    await generarPdfActa(datos());
    const todo = dibujado.join(" | ");
    expect(todo).not.toContain("COMENTARIO_SECRETO_INTERNO");
    expect(todo).not.toContain("ITEM_INTERNO_SECRETO");
  });

  it("no se cae con emojis o caracteres que la fuente no tiene (los omite)", async () => {
    const { dibujado } = espiarTexto();
    const v = visita({ trabajoSolicitado: "Revisar 😀 antenas ✅" });
    (v as { ejecucion: { observaciones: string } }).ejecucion.observaciones = "Listo 🚀 ñandú — “ok”";
    const pdf = await generarPdfActa(datos({ visita: v }));
    expect(pdf.length).toBeGreaterThan(500);
    const todo = dibujado.join(" ");
    expect(todo).not.toMatch(/😀|🚀|✅/);
    expect(todo).toContain("ñandú");
  });

  it("incrusta fotos y firma sin fallar, y con muchas fotos agrega páginas", async () => {
    const una = await PDFDocument.load(await generarPdfActa(datos({ fotos: [{ bytes: PNG_1X1, mime: "image/png", etiqueta: "Antes" }] })));
    const muchas = await PDFDocument.load(
      await generarPdfActa(datos({ fotos: Array.from({ length: 30 }, (_, i) => ({ bytes: PNG_1X1, mime: "image/png", etiqueta: `Foto ${i}` })) }))
    );
    expect(muchas.getPageCount()).toBeGreaterThan(una.getPageCount());
  });

  it("un texto larguísimo no se sale del documento (pagina)", async () => {
    const largo = "palabra ".repeat(3000);
    const v = visita({ trabajoSolicitado: largo });
    const doc = await PDFDocument.load(await generarPdfActa(datos({ visita: v })));
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });

  it("una visita sin ejecución, firma ni fotos (informe mínimo) también se genera", async () => {
    const v = visita({ ejecucion: undefined, firmas: [] });
    const pdf = await generarPdfActa(datos({ visita: v, firma: null }));
    expect(Buffer.from(pdf.slice(0, 5)).toString()).toBe("%PDF-");
  });

  describe("PNG hostil", () => {
    const crc = (b: Buffer) => {
      let c = ~0;
      for (const x of b) {
        c ^= x;
        for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
      }
      return ~c >>> 0;
    };
    const chunk = (tipo: string, datos: Buffer) => {
      const cuerpo = Buffer.concat([Buffer.from(tipo, "latin1"), datos]);
      const largo = Buffer.alloc(4);
      largo.writeUInt32BE(datos.length);
      const suma = Buffer.alloc(4);
      suma.writeUInt32BE(crc(cuerpo));
      return Buffer.concat([largo, cuerpo, suma]);
    };
    const ihdr = (w: number, h: number) => {
      const d = Buffer.alloc(13);
      d.writeUInt32BE(w, 0);
      d.writeUInt32BE(h, 4);
      d[8] = 8;
      d[9] = 6;
      return chunk("IHDR", d);
    };
    const original = Buffer.from(PNG_1X1);
    const firma = original.subarray(0, 8);
    const idat = original.subarray(original.indexOf("IDAT") - 4, original.indexOf("IEND") - 4);
    const iend = chunk("IEND", Buffer.alloc(0));
    const armar = (...partes: Buffer[]) => new Uint8Array(Buffer.concat([firma, ...partes]));

    const contar = async (fotos: DatosPdfActa["fotos"]) => {
      const pdf = await generarPdfActa(datos({ firma: null, fotos }));
      return Buffer.from(pdf).toString("latin1").split("/Subtype /Image").length - 1;
    };
    // Lo que ya trae el acta sin fotos (el logo): se descuenta.
    async function imagenes(bytes: Uint8Array) {
      return (await contar([{ bytes, mime: "image/png", etiqueta: "x" }])) - (await contar([]));
    }

    it("acepta un PNG normal", async () => {
      expect(await imagenes(PNG_1X1)).toBeGreaterThan(0);
    });

    it("descarta un segundo IHDR que declara dimensiones enormes", async () => {
      expect(await imagenes(armar(ihdr(1, 1), ihdr(20000, 20000), idat, iend))).toBe(0);
    });

    it("descarta un PNG animado (acTL)", async () => {
      expect(await imagenes(armar(ihdr(1, 1), chunk("acTL", Buffer.alloc(8)), idat, iend))).toBe(0);
    });

    it("descarta un IDAT que descomprime mucho más de lo declarado", async () => {
      const { deflateSync } = await import("node:zlib");
      const bomba = chunk("IDAT", deflateSync(Buffer.alloc(50_000_000)));
      expect(await imagenes(armar(ihdr(1, 1), bomba, iend))).toBe(0);
    });
  });
});
