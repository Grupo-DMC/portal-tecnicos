"use client";
import Espera from "@/components/ui/Espera";

import { useState, useTransition } from "react";
import { guardarAvisosCuentaAction } from "@/app/actions/notificaciones";
import {
  correoDe,
  gruposVisibles,
  nivelDe,
  pushDe,
  type AjustesCorreo,
  type ModoCorreo,
  type NivelAviso,
  type PreferenciasAviso,
  type PreferenciasCanal,
} from "@/lib/notificaciones";

// «Mi cuenta» → Avisos: por cada tipo, qué hace la campanita, si llega push y
// cómo llega por correo. Solo se muestra con los avisos por correo activos en
// el servidor (lib/correo/avisos-config.ts).

export interface DatosAvisosCuenta {
  permisos: string[];
  niveles: PreferenciasAviso;
  canales: PreferenciasCanal;
  ajustes: AjustesCorreo;
  email: string;
}

const NIVEL: Record<NivelAviso, string> = { AVISAR: "Avisar", MOSTRAR: "Mostrar", OCULTAR: "Ocultar" };
const CORREO: Record<ModoCorreo, string> = { NUNCA: "No", MOMENTO: "Al momento", RESUMEN: "En el resumen" };

interface Fila {
  nivel: NivelAviso;
  push: boolean;
  correo: ModoCorreo;
}

export default function AvisosCuenta({ datos, aviso }: { datos: DatosAvisosCuenta; aviso: (t: string) => void }) {
  const grupos = gruposVisibles(datos.permisos);
  const [filas, setFilas] = useState<Record<string, Fila>>(() => {
    const todas: Record<string, Fila> = {};
    for (const g of grupos)
      for (const t of g.tipos)
        todas[t.clave] = {
          nivel: nivelDe(datos.niveles, t.clave),
          push: pushDe(datos.niveles, datos.canales, t.clave),
          correo: correoDe(datos.canales, t.clave),
        };
    return todas;
  });
  const [ajustes, setAjustes] = useState(datos.ajustes);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const cambiar = (clave: string, parte: Partial<Fila>) => setFilas((prev) => ({ ...prev, [clave]: { ...prev[clave], ...parte } }));

  function guardar() {
    setError(null);
    const niveles: PreferenciasAviso = {};
    const canales: PreferenciasCanal = {};
    for (const [clave, f] of Object.entries(filas)) {
      niveles[clave] = f.nivel;
      canales[clave] = { push: f.push, correo: f.correo };
    }
    iniciar(async () => {
      const r = await guardarAvisosCuentaAction({ niveles, canales, ajustes });
      if (!r.ok) return setError(r.error ?? "No se pudo guardar.");
      aviso("Avisos guardados");
    });
  }

  return (
    <section id="avisos" className="bg-[var(--color-surface-3)] border border-[var(--color-line-soft)] scroll-mt-6">
      <header className="px-5 md:px-6 pt-5 md:pt-6">
        <h2 className="font-semibold text-lead tracking-[-.01em]">Avisos</h2>
        <p className="text-meta text-[var(--color-muted)] mt-1 max-w-[65ch]">
          De lo que hacen los demás, qué te llega y por dónde. El push llega a los navegadores donde activaste los avisos desde
          la campanita. Los correos van a <strong>{datos.email}</strong>.
        </p>
      </header>

      <div className="px-5 md:px-6 py-5 md:py-6 min-w-0 flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1"
              checked={ajustes.activo}
              onChange={(e) => setAjustes((a) => ({ ...a, activo: e.target.checked }))}
            />
            <span>
              <span className="block text-ui font-semibold">Recibir avisos por correo</span>
              <span className="block text-meta text-[var(--color-muted)]">
                Apagado, no te llega ningún correo de avisos, elijas lo que elijas abajo.
              </span>
            </span>
          </label>
          <div className="field">
            <label htmlFor="av-hora">Hora del resumen diario</label>
            <select
              id="av-hora"
              className="input"
              value={ajustes.horaResumen}
              disabled={!ajustes.activo}
              onChange={(e) => setAjustes((a) => ({ ...a, horaResumen: Number(e.target.value) }))}
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")}:00
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-meta text-[var(--color-muted)] max-w-[65ch]">
          <strong>Al momento</strong>: sale enseguida; lo que pase en los 10 minutos siguientes llega junto en un solo correo, y
          con más de 6 correos en una hora el resto pasa al resumen. <strong>En el resumen</strong>: un correo al día con todo,
          sin lo que ya viste en la campanita.
        </p>

        {grupos.map((g) => (
          <fieldset key={g.clave} className="min-w-0">
            <legend className="text-cap text-[var(--color-muted)] pb-1.5">{g.label}</legend>
            <div className="overflow-x-auto">
              <table className="w-full text-ui border-collapse min-w-[560px]">
                <thead>
                  <tr className="text-cap text-[var(--color-muted)] text-left">
                    <th className="font-normal py-1.5 pr-3">Cuando alguien…</th>
                    <th className="font-normal py-1.5 pr-3 w-[130px]">Campanita</th>
                    <th className="font-normal py-1.5 pr-3 w-[60px] text-center">Push</th>
                    <th className="font-normal py-1.5 w-[150px]">Correo</th>
                  </tr>
                </thead>
                <tbody>
                  {g.tipos.map((t) => {
                    const f = filas[t.clave];
                    return (
                      <tr key={t.clave} className="border-t border-[var(--color-divider-faint)]">
                        <td className="py-2 pr-3">{t.label}</td>
                        <td className="py-2 pr-3">
                          <select
                            className="input min-h-8 py-1"
                            aria-label={`Campanita: ${t.label}`}
                            value={f.nivel}
                            onChange={(e) => cambiar(t.clave, { nivel: e.target.value as NivelAviso })}
                          >
                            {(Object.keys(NIVEL) as NivelAviso[]).map((n) => (
                              <option key={n} value={n}>
                                {NIVEL[n]}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 pr-3 text-center">
                          <input
                            type="checkbox"
                            aria-label={`Push: ${t.label}`}
                            checked={f.push}
                            onChange={(e) => cambiar(t.clave, { push: e.target.checked })}
                          />
                        </td>
                        <td className="py-2">
                          <select
                            className="input min-h-8 py-1"
                            aria-label={`Correo: ${t.label}`}
                            value={f.correo}
                            disabled={!ajustes.activo}
                            onChange={(e) => cambiar(t.clave, { correo: e.target.value as ModoCorreo })}
                          >
                            {(Object.keys(CORREO) as ModoCorreo[]).map((m) => (
                              <option key={m} value={m}>
                                {CORREO[m]}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </fieldset>
        ))}

        <div className="flex flex-col gap-3 pt-5 border-t border-[var(--color-line-soft)]">
          {error ? (
            <div
              role="alert"
              className="px-3.5 py-2.5 bg-[var(--color-danger-100)] border border-[var(--color-danger-400)] text-[var(--color-danger-800)] text-meta"
            >
              {error}
            </div>
          ) : null}
          <div className="flex sm:justify-end">
            <button type="button" className="btn btn-primary" disabled={pendiente} onClick={guardar}>
              <Espera activo={pendiente} accion="Guardando">Guardar avisos</Espera>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
