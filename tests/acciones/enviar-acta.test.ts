import { beforeEach, describe, expect, it, vi } from "vitest";
import { unzipSync } from "fflate";

vi.mock("@/lib/data/visitas");
vi.mock("@/lib/data/videos");
vi.mock("@/lib/pdf/acta-de-visita");
vi.mock("@/lib/correo/proveedor", async (importar) => {
  const real = await importar<typeof import("@/lib/correo/proveedor")>();
  return { ...real, configCorreo: vi.fn(), enviarCorreo: vi.fn() };
});

import { enviarActaPorCorreo, MAX_BYTES_ADJUNTOS } from "@/lib/correo/enviar-acta";
import { cerrarEnvioActa, crearEnvioActa, getFotoBinaria, getVisitaCompletaPorFolio } from "@/lib/data/visitas";
import { getVideoMeta, getVideoTramo } from "@/lib/data/videos";
import { pdfDeVisita } from "@/lib/pdf/acta-de-visita";
import { configCorreo, enviarCorreo } from "@/lib/correo/proveedor";

const visita = {
  id: 9,
  folio: "V-1",
  estado: "COMPLETADA",
  fechaProgramada: "2026-11-02",
  sucursal: { nombre: "Centro" },
  cliente: { nombreFantasia: "Tiendas Sur" },
  fotos: [
    { id: 7, etiqueta: "Antes", interno: false, archivoUrl: "/api/visita/foto/7" },
    { id: 8, etiqueta: "Interna", interno: true, archivoUrl: "/api/visita/foto/8" },
  ],
  videos: [
    { id: 21, interno: false, mime: "video/mp4", archivoUrl: "/api/visita/video/21" },
    { id: 22, interno: true, mime: "video/mp4", archivoUrl: "/api/visita/video/22" },
  ],
  firmas: [{ id: 3, nombre: "Carla", rol: "TIENDA" }],
};

const pedido = (extra: Record<string, unknown> = {}) => ({
  folio: "V-1",
  para: ["a@x.cl"],
  cc: ["b@x.cl"],
  cco: ["oculto@x.cl"],
  asunto: "Acta V-1",
  cuerpo: "Hola",
  adjuntos: ["pdf", "zip"] as ("pdf" | "zip")[],
  usuarioId: 1,
  usuarioEmail: "coordina@dmc.cl",
  ...extra,
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(configCorreo).mockReturnValue({ clave: "re_x", remitente: "Grupo dMC <actas@dmc.cl>", dominios: ["dmc.cl"] });
  vi.mocked(getVisitaCompletaPorFolio).mockResolvedValue(visita as never);
  vi.mocked(pdfDeVisita).mockResolvedValue(new Uint8Array([1, 2, 3]));
  vi.mocked(getFotoBinaria).mockResolvedValue({ bytes: Buffer.from("foto"), mime: "image/jpeg" });
  vi.mocked(getVideoMeta).mockResolvedValue({ mime: "video/mp4", total: 5 });
  vi.mocked(getVideoTramo).mockResolvedValue(Buffer.from("video"));
  vi.mocked(crearEnvioActa).mockResolvedValue(55);
  vi.mocked(enviarCorreo).mockResolvedValue({ ok: true, id: "msg_1" });
});

describe("enviarActaPorCorreo", () => {
  it("adjunta el PDF y el zip de fotos y videos del cliente, con la cuenta de quien envía", async () => {
    expect(await enviarActaPorCorreo(pedido())).toEqual({ ok: true, adjuntos: 2, para: ["a@x.cl"] });

    const enviado = vi.mocked(enviarCorreo).mock.calls[0][0];
    expect(enviado.de).toBe('"Grupo dMC" <coordina@dmc.cl>');
    expect(enviado.responderA).toBe("coordina@dmc.cl");
    expect(enviado.cco).toEqual(["oculto@x.cl"]);
    expect(enviado.idempotencia).toBe("acta-envio-55");
    expect(enviado.adjuntos.map((a) => a.tipo)).toEqual(["application/pdf", "application/zip"]);

    // El zip trae lo mismo que la descarga del panel, sin lo interno.
    const zip = unzipSync(new Uint8Array(enviado.adjuntos[1].contenido));
    expect(Object.keys(zip)).toEqual(["V-1 - foto 1.jpeg", "V-1 - video 1.mp4"]);
    expect(getVideoTramo).toHaveBeenCalledWith(21, 0, 4);
    expect(getVideoMeta).not.toHaveBeenCalledWith(22);

    expect(crearEnvioActa).toHaveBeenCalledWith(
      expect.objectContaining({
        visitaId: 9,
        para: "a@x.cl",
        cc: "b@x.cl",
        cco: "oculto@x.cl",
        usuarioId: 1,
        adjuntos: [
          expect.objectContaining({ tipo: "PDF_ACTA" }),
          { tipo: "FOTO", fotoId: 7, nombre: "V-1 - foto 1.jpeg" },
          { tipo: "VIDEO", videoId: 21, nombre: "V-1 - video 1.mp4" },
        ],
      })
    );
    expect(cerrarEnvioActa).toHaveBeenCalledWith(55, { ok: true });
  });

  it("sin Para, va dirigido a quien lo envía y el resto en copia", async () => {
    const res = await enviarActaPorCorreo(pedido({ para: [] }));
    expect(res).toMatchObject({ ok: true, para: ["coordina@dmc.cl"] });
    expect(vi.mocked(enviarCorreo).mock.calls[0][0].para).toEqual(["coordina@dmc.cl"]);
  });

  it("con un dominio no verificado sale con el remitente de respaldo y responde a quien envía", async () => {
    await enviarActaPorCorreo(pedido({ usuarioEmail: "alguien@gmail.com" }));
    const enviado = vi.mocked(enviarCorreo).mock.calls[0][0];
    expect(enviado.de).toBe("Grupo dMC <actas@dmc.cl>");
    expect(enviado.responderA).toBe("alguien@gmail.com");
  });

  it("si el proveedor falla, el envío queda en ERROR con el motivo", async () => {
    vi.mocked(enviarCorreo).mockResolvedValue({ ok: false, error: "El proveedor de correo respondió 500." });
    expect(await enviarActaPorCorreo(pedido())).toEqual({ ok: false, error: "El proveedor de correo respondió 500." });
    expect(cerrarEnvioActa).toHaveBeenCalledWith(55, { ok: false, error: "El proveedor de correo respondió 500." });
  });

  it("si no se puede anotar el cierre, igual responde según el proveedor", async () => {
    vi.mocked(cerrarEnvioActa).mockRejectedValue(new Error("se cayó la base"));
    expect((await enviarActaPorCorreo(pedido())).ok).toBe(true);
  });

  it("sin configuración no toca la base ni el proveedor", async () => {
    vi.mocked(configCorreo).mockReturnValue(null);
    expect((await enviarActaPorCorreo(pedido())) as { error: string }).toMatchObject({ error: expect.stringMatching(/RESEND_API_KEY/) });
    expect(getVisitaCompletaPorFolio).not.toHaveBeenCalled();
    expect(crearEnvioActa).not.toHaveBeenCalled();
  });

  it("solo una visita completada", async () => {
    vi.mocked(getVisitaCompletaPorFolio).mockResolvedValue({ ...visita, estado: "EN_CURSO" } as never);
    expect((await enviarActaPorCorreo(pedido())).ok).toBe(false);
    vi.mocked(getVisitaCompletaPorFolio).mockResolvedValue(undefined as never);
    expect(await enviarActaPorCorreo(pedido())).toEqual({ ok: false, error: "No encontramos esa visita." });
    expect(crearEnvioActa).not.toHaveBeenCalled();
  });

  it("si los videos pasan el tope, avisa antes de leerlos y no manda nada", async () => {
    vi.mocked(getVideoMeta).mockResolvedValue({ mime: "video/mp4", total: MAX_BYTES_ADJUNTOS });
    expect((await enviarActaPorCorreo(pedido())) as { error: string }).toMatchObject({
      error: expect.stringMatching(/Desmarca el zip/),
    });
    expect(getVideoTramo).not.toHaveBeenCalled();
    expect(crearEnvioActa).not.toHaveBeenCalled();
    expect(enviarCorreo).not.toHaveBeenCalled();
  });
});
