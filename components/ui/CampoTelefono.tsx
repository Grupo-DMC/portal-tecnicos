"use client";

import { DIGITOS_TEL, mensajeTel, telDesdeLocal, telLocal } from "@/lib/ui/formato";

/**
 * El campo de teléfono de todo el sistema.
 *
 * El «+56 9» es un adorno fijo a la izquierda del campo, no parte del texto: no se
 * puede borrar ni cambiar, y quien escribe solo pone los 8 dígitos que siguen.
 * Hacia afuera el valor sigue siendo el de siempre —«+56 9 1234 5678», o "" si
 * está vacío—, así que lo guardado y lo que ya hay en la base no cambian.
 *
 * - Pegar un número entero («+56 9 1234 5678», «56912345678», «912345678»)
 *   deja los 8 dígitos de verdad, sin duplicar el prefijo.
 * - Con menos de 8 dígitos muestra el aviso debajo; vacío es válido (si el campo
 *   es obligatorio, lo decide el formulario).
 * - Un valor de antes que no tiene la forma «+56 9» + 8 dígitos (un fijo, por
 *   ejemplo) no se toca ni se deforma: se muestra aparte y se conserva hasta que
 *   alguien escriba uno nuevo.
 */
export default function CampoTelefono({
  id,
  value,
  onChange,
  variante = "panel",
  className = "input",
  name,
  placeholder = "1234 5678",
  autoComplete = "off",
  ariaLabel,
}: {
  id: string;
  /** El teléfono tal como se guarda: «+56 9 1234 5678» o "". */
  value: string;
  onChange: (valor: string) => void;
  /** «panel» = escritorio; «movil» = campos altos para el dedo. */
  variante?: "panel" | "movil";
  /** Las clases del <input>: cada formulario trae las suyas. */
  className?: string;
  /** Si se pone, el valor completo viaja en un campo oculto con este nombre (formularios nativos). */
  name?: string;
  placeholder?: string;
  autoComplete?: string;
  ariaLabel?: string;
}) {
  const local = telLocal(value);
  // Un valor de antes con otra forma: se muestra aparte, el campo queda vacío.
  const heredado = local === null ? String(value).trim() : null;
  const digitos = local ?? "";
  const visible = digitos.slice(0, 4) + (digitos.length > 4 ? " " + digitos.slice(4) : "");
  const error = mensajeTel(value);
  const movil = variante === "movil";

  /** Lo tecleado: solo cuentan los dígitos (hasta 8). Si trae un «+», es un número entero con su prefijo. */
  function alEscribir(texto: string) {
    if (texto.includes("+")) {
      const entero = telLocal(texto);
      return onChange(telDesdeLocal(entero ?? texto.replace(/\D/g, "").replace(/^569?/, "")));
    }
    onChange(telDesdeLocal(texto));
  }

  /** Lo pegado: puede venir con el prefijo, que se descarta. */
  function alPegar(e: React.ClipboardEvent<HTMLInputElement>) {
    const texto = e.clipboardData.getData("text");
    e.preventDefault();
    let d = texto.replace(/\D/g, "");
    if (d.length > DIGITOS_TEL && d.startsWith("569")) d = d.slice(3);
    else if (d.length > DIGITOS_TEL && d.startsWith("56")) d = d.slice(2);
    else if (d.length === DIGITOS_TEL + 1 && d.startsWith("9")) d = d.slice(1);
    onChange(telDesdeLocal(d));
  }

  return (
    <div>
      <div className="flex items-stretch">
        <span
          aria-hidden="true"
          className={`flex-none flex items-center px-3 select-none tabular-nums font-extrabold text-[var(--color-muted)] bg-[var(--color-surface)] border border-r-0 ${
            movil ? "text-lead border-[var(--color-divider)]" : "text-ui border-[var(--color-line-control)]"
          }`}
        >
          +56 9
        </span>
        <input
          id={id}
          type="tel"
          inputMode="numeric"
          value={visible}
          onChange={(e) => alEscribir(e.target.value)}
          onPaste={alPegar}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoCorrect="off"
          spellCheck={false}
          aria-label={ariaLabel}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : heredado ? `${id}-previo` : undefined}
          className={`${className} min-w-0 flex-1 tabular-nums`}
        />
        {name ? <input type="hidden" name={name} value={value} /> : null}
      </div>
      {error ? (
        <div id={`${id}-error`} className="text-cap leading-[1.4] mt-1.5 text-[var(--color-danger-800)]">
          {error}
        </div>
      ) : heredado ? (
        <div id={`${id}-previo`} className="text-cap leading-[1.4] mt-1.5 text-[var(--color-muted)]">
          Número guardado: {heredado}. Escribe 8 dígitos para reemplazarlo.
        </div>
      ) : null}
    </div>
  );
}
