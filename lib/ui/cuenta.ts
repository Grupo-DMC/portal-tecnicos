// Cómo se muestra una cuenta del panel (Mi cuenta, menú lateral). Lógica pura.

/** El nombre que escribió la persona o, si no hay, el que se arma con su correo. */
export function nombreVisible(nombre: string | null | undefined, email: string): string {
  const propio = String(nombre ?? "").trim();
  if (propio) return propio;
  return email
    .split("@")[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(" ");
}

/** Hasta dos iniciales para el avatar sin foto. */
export function iniciales(nombre: string): string {
  return (
    nombre
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

/** URL de la foto de perfil; la versión cambia al subir otra y evita ver la vieja. */
export function urlFotoUsuario(usuarioId: number, version: string | null): string | null {
  return version ? `/api/usuario/foto/${usuarioId}?v=${encodeURIComponent(version)}` : null;
}

/** Recorta al centro en cuadrado y reduce a `lado` px, en JPEG. Solo en el navegador. */
export async function prepararFotoPerfil(archivo: File, lado = 512): Promise<string> {
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("No se pudo leer la imagen."));
      i.src = url;
    });
    const corte = Math.min(img.naturalWidth, img.naturalHeight);
    const salida = Math.min(lado, corte);
    const canvas = document.createElement("canvas");
    canvas.width = salida;
    canvas.height = salida;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo preparar la imagen.");
    // Fondo blanco: un PNG transparente pasado a JPEG quedaría con negro.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, salida, salida);
    ctx.drawImage(
      img,
      (img.naturalWidth - corte) / 2,
      (img.naturalHeight - corte) / 2,
      corte,
      corte,
      0,
      0,
      salida,
      salida
    );
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
