import { describe, expect, it } from "vitest";
import { orientacionExif } from "@/lib/ui/imagen";

// Un JPEG mínimo (solo cabeceras) con un EXIF que trae la orientación pedida.
function jpegConOrientacion(orientacion: number, little = true): string {
  const u16 = (n: number) => (little ? [n & 0xff, n >> 8] : [n >> 8, n & 0xff]);
  const u32 = (n: number) =>
    little ? [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, n >>> 24] : [n >>> 24, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  const tiff = [
    ...(little ? [0x49, 0x49] : [0x4d, 0x4d]),
    ...u16(0x002a),
    ...u32(8), // la IFD0 empieza a 8 bytes del inicio del TIFF
    ...u16(1), // una entrada
    ...u16(0x0112), ...u16(3), ...u32(1), ...u16(orientacion), 0, 0, // Orientation, SHORT, 1 valor
    ...u32(0),
  ];
  const exif = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const largo = exif.length + 2;
  const bytes = [0xff, 0xd8, 0xff, 0xe1, largo >> 8, largo & 0xff, ...exif, 0xff, 0xda, 0, 2];
  return `data:image/jpeg;base64,${Buffer.from(bytes).toString("base64")}`;
}

describe("orientacionExif", () => {
  it("lee la orientación de un JPEG de celular, en little y big endian", () => {
    expect(orientacionExif(jpegConOrientacion(6))).toBe(6);
    expect(orientacionExif(jpegConOrientacion(8))).toBe(8);
    expect(orientacionExif(jpegConOrientacion(3, false))).toBe(3);
    expect(orientacionExif(jpegConOrientacion(6, false))).toBe(6);
  });

  it("sin EXIF, con un valor fuera de rango o que no es JPEG, la foto se toma como derecha", () => {
    expect(orientacionExif("data:image/jpeg;base64," + Buffer.from([0xff, 0xd8, 0xff, 0xda, 0, 2]).toString("base64"))).toBe(1);
    expect(orientacionExif(jpegConOrientacion(9))).toBe(1);
    expect(orientacionExif("data:image/png;base64,iVBORw0KGgo=")).toBe(1);
    expect(orientacionExif("/api/visita/foto/12")).toBe(1);
  });

  it("un JPEG cortado o con basura no rompe", () => {
    expect(orientacionExif("data:image/jpeg;base64,/9j/4AAQ")).toBe(1);
    expect(orientacionExif("data:image/jpeg;base64,@@@@")).toBe(1);
  });
});
