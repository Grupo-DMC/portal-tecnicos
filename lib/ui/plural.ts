// «1 visita», «2 visitas», «1.034 visitas».

export function plural(n: number, uno: string, varios: string): string {
  return `${n.toLocaleString("es-CL")} ${n === 1 ? uno : varios}`;
}
