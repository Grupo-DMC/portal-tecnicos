// «agendó la visita» → «agendaste la visita», para lo propio en la campanita
// («Tú agendaste…», como en la demo). La actividad se guarda en tercera persona.

const IRREGULARES: Record<string, string> = {
  abrió: "abriste",
  cambió: "cambiaste",
  corrigió: "corregiste",
  envió: "enviaste",
  inició: "iniciaste",
  pidió: "pediste",
  volvió: "volviste",
};

/** Conjuga el primer verbo en pretérito (en las dos primeras palabras); si no hay, deja el texto igual. */
export function enSegundaPersona(texto: string): string {
  return texto.replace(/^((?:\S+\s)?)([a-záéíúñ]+ó)(?=\s|$|[:,.])/i, (_, antes: string, verbo: string) => {
    const bajo = verbo.toLowerCase();
    const nuevo = IRREGULARES[bajo] ?? (bajo.endsWith("ió") ? `${bajo.slice(0, -2)}iste` : `${bajo.slice(0, -1)}aste`);
    return antes + (verbo[0] === verbo[0].toUpperCase() ? nuevo[0].toUpperCase() + nuevo.slice(1) : nuevo);
  });
}
