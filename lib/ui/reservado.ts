// Lo que no se muestra entero en pantalla: RUT de terceros y claves anotadas en las notas.

/** «16.842.317-1» → «16.842.***-1». */
export function ocultarRut(rut: string): string {
  const limpio = rut.trim();
  const oculto = limpio.replace(/\d{3}(?=-?[\dkK]$)/, "***");
  return oculto === limpio ? "***" : oculto;
}

const CLAVE = /\b(clave|contraseña|contrasena|password|pass|pin)(\s*(?:[:=]|es\b)\s*)(\S+)/gi;

/** Tapa lo que sigue a «clave:», «contraseña:», «PIN =»… en un texto libre. */
export function ocultarCredenciales(texto: string): string {
  return texto.replace(CLAVE, "$1$2••••");
}
