// Preparación de las fotos antes de mandarlas al servidor.
//
// Una foto de la cámara de un celular actual pesa entre 2 y 5 MB. El acta viaja
// entera en una sola Server Action, así que tres fotos sin tocar ya se comen el
// presupuesto del request y el técnico ve un "no se pudo guardar" sin más
// explicación. Acá se reduce el lado mayor y se recomprime a JPEG.
//
// Se conserva el color: antes las fotos se mostraban con un filtro `grayscale`
// que hacía creer que se guardaban en blanco y negro.

// Niveles de compresión. El primero es el de siempre; los siguientes solo se
// usan cuando las fotos del acta, juntas, no caben en el request (ver
// ajustarFotos).
const NIVELES = [
  { lado: 1600, calidad: 0.72 },
  { lado: 1280, calidad: 0.62 },
  { lado: 1024, calidad: 0.55 },
  { lado: 800, calidad: 0.5 },
];

/**
 * Lo que pueden pesar, juntas, las fotos nuevas del acta (en bytes ya
 * decodificados). En base64 son un tercio más, y el request completo se corta
 * en 4,5 MB (ver next.config.ts): el resto del presupuesto es la firma y el texto.
 */
export const PRESUPUESTO_FOTOS_BYTES = 2.5 * 1024 * 1024;

/**
 * Orientación EXIF (1 a 8) de un JPEG en data URL; 1 si no trae o no es JPEG.
 *
 * El celular guarda la foto "acostada" y anota en el EXIF cómo girarla. El
 * navegador la muestra derecha, pero un lector que ignora el EXIF (el PDF del
 * acta, por ejemplo) la dibuja de costado. Por eso, al reducirla, la imagen se
 * redibuja ya derecha y sin EXIF (ver comprimirFoto).
 */
export function orientacionExif(dataUrl: string): number {
  if (!/^data:image\/jpe?g;base64,/i.test(dataUrl)) return 1;
  try {
    const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
    // El EXIF va en los primeros KB: no hace falta decodificar la foto entera.
    const bytes = Uint8Array.from(atob(base64.slice(0, 87380)), (c) => c.charCodeAt(0));
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return 1;
    let i = 2;
    while (i + 4 <= bytes.length) {
      if (bytes[i] !== 0xff) return 1;
      const marcador = bytes[i + 1];
      if (marcador === 0xff) {
        i += 1;
        continue;
      }
      // Desde el inicio de la imagen (SOS) o el fin (EOI) ya no hay metadatos.
      if (marcador === 0xda || marcador === 0xd9) return 1;
      const largo = (bytes[i + 2] << 8) | bytes[i + 3];
      if (marcador === 0xe1 && String.fromCharCode(...bytes.subarray(i + 4, i + 8)) === "Exif") {
        const tiff = i + 10;
        const little = bytes[tiff] === 0x49;
        const u16 = (o: number) => (little ? bytes[o] | (bytes[o + 1] << 8) : (bytes[o] << 8) | bytes[o + 1]);
        const u32 = (o: number) =>
          little
            ? (bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24)) >>> 0
            : ((bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]) >>> 0;
        if (u16(tiff + 2) !== 0x002a) return 1;
        const ifd = tiff + u32(tiff + 4);
        const entradas = u16(ifd);
        for (let k = 0; k < entradas; k++) {
          const e = ifd + 2 + k * 12;
          if (e + 12 > bytes.length) return 1;
          if (u16(e) === 0x0112) {
            const o = u16(e + 8);
            return o >= 1 && o <= 8 ? o : 1;
          }
        }
        return 1;
      }
      i += 2 + largo;
    }
  } catch {
    // Un EXIF roto no impide usar la foto.
  }
  return 1;
}

/** Cuánto se gira una foto: 90 es a la derecha (horario), -90 a la izquierda. */
export type Giro = 90 | -90;

/**
 * Dibuja la imagen reducida y, si se pide, girada 90° en un canvas, y la
 * devuelve como JPEG. `img.width/height` ya vienen derechos (el navegador aplica
 * el EXIF al cargarla), así que lo que sale no necesita EXIF.
 */
function dibujar(img: HTMLImageElement, lado: number, calidad: number, giro: Giro | 0): string | null {
  const escala = Math.min(1, lado / Math.max(img.width, img.height));
  const ancho = Math.round(img.width * escala);
  const alto = Math.round(img.height * escala);

  const canvas = document.createElement("canvas");
  canvas.width = giro ? alto : ancho;
  canvas.height = giro ? ancho : alto;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Fondo blanco: un PNG con transparencia recomprimido a JPEG deja los
  // pixeles transparentes en negro, y la foto sale con manchas oscuras.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  if (giro) ctx.rotate((giro * Math.PI) / 180);
  ctx.drawImage(img, -ancho / 2, -alto / 2, ancho, alto);
  return canvas.toDataURL("image/jpeg", calidad);
}

/**
 * Reduce y recomprime una data URL. Si algo falla, devuelve la original.
 *
 * Al redibujar queda aplicada la orientación EXIF: la foto sale derecha aunque
 * el celular la haya guardado de costado. Por eso, si trae una orientación
 * distinta de la normal, se devuelve la redibujada aunque pese más que la
 * original: la original sola saldría girada en el PDF.
 */
export async function comprimirFoto(dataUrl: string, nivel = 0): Promise<string> {
  const { lado: LADO_MAXIMO, calidad: CALIDAD } = NIVELES[Math.min(nivel, NIVELES.length - 1)];
  try {
    const img = await cargarImagen(dataUrl);
    const reducida = dibujar(img, LADO_MAXIMO, CALIDAD, 0);
    if (!reducida) return dataUrl;
    return reducida.length < dataUrl.length || orientacionExif(dataUrl) > 1 ? reducida : dataUrl;
  } catch {
    return dataUrl;
  }
}

/** Calidad al girar: la foto se vuelve a codificar, así que se cuida algo más que al reducirla. */
const CALIDAD_GIRO = 0.85;

/**
 * Gira una foto 90° y devuelve la imagen ya girada (una data URL nueva), no un
 * estilo: es la que se guarda y la que sale en el detalle y en el PDF.
 *
 * `src` puede ser una data URL (foto recién tomada) o la ruta de una foto ya
 * guardada. Lanza si no se puede leer o dibujar: quien llama avisa y deja la
 * foto como estaba.
 */
export async function girarFoto(src: string, giro: Giro): Promise<string> {
  const img = await cargarImagen(src);
  const girada = dibujar(img, NIVELES[0].lado, CALIDAD_GIRO, giro);
  if (!girada) throw new Error("No se pudo dibujar la imagen");
  return girada;
}

function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo leer la imagen"));
    img.src = src;
  });
}

/** Peso aproximado en bytes de una data URL base64. */
export function pesoAproximado(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return Math.floor((base64.length * 3) / 4);
}

/** Lo que pesan las fotos que viajan en el request (las que todavía son data URL). */
export function pesoDeFotos(fotos: { src: string }[]): number {
  return fotos.reduce((t, f) => (f.src.startsWith("data:") ? t + pesoAproximado(f.src) : t), 0);
}

/**
 * Si las fotos nuevas juntas pasan el presupuesto, las vuelve a comprimir con
 * niveles cada vez más fuertes hasta que quepan. No se limita cuántas fotos se
 * toman: se les baja la calidad. Devuelve la misma lista si no hay nada que
 * hacer o ya no se puede reducir más.
 */
export async function ajustarFotos<T extends { src: string }>(fotos: T[]): Promise<T[]> {
  let actual = fotos;
  for (let nivel = 1; nivel < NIVELES.length && pesoDeFotos(actual) > PRESUPUESTO_FOTOS_BYTES; nivel++) {
    actual = await Promise.all(
      actual.map(async (f) => (f.src.startsWith("data:") ? { ...f, src: await comprimirFoto(f.src, nivel) } : f))
    );
  }
  return pesoDeFotos(actual) < pesoDeFotos(fotos) ? actual : fotos;
}
