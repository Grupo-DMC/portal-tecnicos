import { z } from "zod";
import { correo, telefono, texto } from "./comun";

// «Mi cuenta». Llegan como FormData: los esquemas miran los strings ya extraídos.

const PASSWORD_MAX = 256;

export const entradaDatosCuenta = z.object({
  nombre: texto(120),
  telefono,
  email: correo.regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "El correo no es válido."),
  /** Solo se pide si cambia el correo, que es con lo que se entra. */
  actual: z.string().max(PASSWORD_MAX),
});

export const entradaPasswordCuenta = z.object({
  actual: z.string().max(PASSWORD_MAX),
  nueva: z.string().max(PASSWORD_MAX, "La contraseña es demasiado larga (máximo 72 caracteres)."),
  repetida: z.string().max(PASSWORD_MAX),
});

/** La foto ya recortada por el navegador, como data URL. ~1 MB en base64 sobra. */
export const entradaFotoCuenta = z.string().max(1_500_000, "La foto pesa demasiado.");
