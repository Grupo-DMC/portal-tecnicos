// Reconoce los registros de prueba que quedaron en producción. No se esconden:
// se marcan con una etiqueta visible.

const PRUEBA = /(^|\s)zz(\s|[-_])|sucursal falsa|cliente de pruebas?|prueba funcional|prueba-core/i;

export function esDatoDePrueba(...textos: (string | null | undefined)[]): boolean {
  return textos.some((t) => !!t && PRUEBA.test(t));
}
