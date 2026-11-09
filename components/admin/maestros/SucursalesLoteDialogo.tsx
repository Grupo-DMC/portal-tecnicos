"use client";

import { useRef, useState } from "react";
import Dialogo from "@/components/admin/Dialogo";
import Confirmar, { type ConfirmarCfg } from "@/components/ui/Confirmar";
import SelectBuscable from "@/components/ui/SelectBuscable";
import SelectConAlta from "@/components/ui/SelectConAlta";
import { crearSucursalesLoteAction } from "@/app/actions/maestros";
import { conMismaDireccion } from "@/lib/ui/direcciones";
import { sinTildes } from "@/lib/ui/formato";
import { nombreLocal } from "@/lib/ui/nombre-local";
import { useReferencias } from "@/lib/ui/referencias";
import { REGIONES } from "@/lib/ui/regiones";
import type { Cliente, Mall, Sucursal } from "@/lib/types";

/** Una sucursal por crear, todavía en pantalla. `mallId` "" = sin mall. */
interface Nueva {
  key: number;
  /** Cada sucursal lleva su cliente y su marca: en una misma carga pueden ser varios. */
  clienteId: string;
  marcaId: string;
  mallId: string;
  nombre: string;
  codigo: string;
  direccion: string;
  comuna: string;
  region: string;
}

/**
 * Alta masiva de sucursales de un cliente. Mismos campos y misma forma que el
 * formulario de una sucursal, repetidos en una tarjeta por tienda, cada una con
 * su cliente y su marca. Nada se guarda hasta confirmar: ahí entran todas juntas.
 */
export default function SucursalesLoteDialogo({
  sucursales,
  clientes,
  malls,
  clienteInicial,
  onCerrar,
  onHecho,
}: {
  sucursales: Sucursal[];
  clientes: Cliente[];
  malls: Mall[];
  clienteInicial: string;
  onCerrar: () => void;
  onHecho: (mensaje: string, guardado: boolean) => void;
}) {
  const { marcas } = useReferencias();
  const contador = useRef(0);

  const opcClientes = clientes
    .filter((c) => c.activo)
    .map((c) => ({ v: String(c.id), t: c.nombreFantasia }));
  const opcMalls = [
    { v: "", t: "Sin mall (a la calle)" },
    ...malls.filter((m) => m.activo).map((m) => ({ v: String(m.id), t: m.nombre })),
  ];
  const opcRegiones = REGIONES.map((r) => ({ v: r, t: r }));

  const marcasDe = (cliente: string) => marcas.filter((m) => m.activo && String(m.clienteId) === cliente);
  const clienteDeInicio = opcClientes.some((o) => o.v === clienteInicial) ? clienteInicial : (opcClientes[0]?.v ?? "");
  /** Una tarjeta nueva repite el cliente y la marca de la anterior: lo común es cargar varias del mismo. */
  const vacia = (clienteId: string, marcaId: string): Nueva => ({
    key: ++contador.current,
    clienteId,
    marcaId,
    mallId: "",
    nombre: "",
    codigo: "",
    direccion: "",
    comuna: "",
    region: REGIONES[0],
  });

  const [nuevas, setNuevas] = useState<Nueva[]>(() => [
    vacia(clienteDeInicio, String(marcasDe(clienteDeInicio)[0]?.id ?? "")),
  ]);
  const [guardando, setGuardando] = useState(false);
  /** Los bloques plegados, por `key`: solo se ve el título del mall. */
  const [plegadas, setPlegadas] = useState<Set<number>>(() => new Set());
  /** Los grupos de mall plegados (por id de mall; "" = sin mall): solo se ve su título. */
  const [gruposPlegados, setGruposPlegados] = useState<Set<string>>(() => new Set());
  const [confirmar, setConfirmar] = useState<ConfirmarCfg | null>(null);

  /** Las sucursales nuevas agrupadas por mall, en el orden en que aparece cada mall. */
  const grupos = nuevas.reduce<{ id: string; filas: { n: Nueva; i: number }[] }[]>((acc, n, i) => {
    const grupo = acc.find((g) => g.id === n.mallId);
    if (grupo) grupo.filas.push({ n, i });
    else acc.push({ id: n.mallId, filas: [{ n, i }] });
    return acc;
  }, []);

  function alternarGrupo(id: string) {
    setGruposPlegados((prev) => {
      const sig = new Set(prev);
      if (!sig.delete(id)) sig.add(id);
      return sig;
    });
  }

  /** Con mall y marca, el nombre es «Cliente · Marca · Mall» y no se pide; sin mall lo escribe la persona. */
  function nombreDe(n: Nueva): string {
    const mall = malls.find((m) => String(m.id) === n.mallId);
    if (!mall || !n.marcaId) return n.nombre;
    return nombreLocal({
      cliente: clientes.find((c) => String(c.id) === n.clienteId)?.nombreFantasia,
      marca: marcas.find((m) => String(m.id) === n.marcaId)?.nombre,
      sucursal: "",
      mall: mall.nombre,
    });
  }

  const delCliente = (cliente: string) => sucursales.filter((s) => String(s.clienteId) === cliente);

  function cambiar(key: number, campo: keyof Nueva, valor: string) {
    setNuevas((prev) =>
      prev.map((n) => {
        if (n.key !== key) return n;
        // Otro cliente, otras marcas: la elegida ya no vale.
        if (campo === "clienteId") return { ...n, clienteId: valor, marcaId: String(marcasDe(valor)[0]?.id ?? "") };
        if (campo !== "mallId") return { ...n, [campo]: valor };
        // Como en el alta de una sucursal: el mall le pone ubicación (y nombre, si hay marca).
        const mall = malls.find((m) => String(m.id) === valor);
        if (!mall) return { ...n, mallId: valor };
        return {
          ...n,
          mallId: valor,
          direccion: mall.direccion,
          ...(mall.comuna ? { comuna: mall.comuna } : null),
          ...(mall.region ? { region: mall.region } : null),
        };
      })
    );
  }

  /** El texto del primer problema, o null si todo está listo para guardar. */
  function problema(): string | null {
    if (nuevas.length === 0) return "Agrega al menos una sucursal.";
    // Los nombres no se repiten dentro de un cliente y marca; los códigos, dentro de un cliente.
    const nombres = new Set(sucursales.map((s) => `${s.clienteId}|${s.marcaId}|${sinTildes(s.nombre.trim())}`));
    const codigos = new Set(
      sucursales.filter((s) => s.codigo?.trim()).map((s) => `${s.clienteId}|${(s.codigo ?? "").trim().toLowerCase()}`)
    );
    for (const [i, n] of nuevas.entries()) {
      const cual = `Sucursal ${i + 1}`;
      if (!n.clienteId) return `${cual}: elige el cliente.`;
      if (!n.marcaId) return `${cual}: elige la marca.`;
      const nombreFinal = nombreDe(n).trim();
      if (!nombreFinal) return `${cual}: falta el nombre.`;
      if (!n.direccion.trim() || !n.comuna.trim()) return `${cual}: faltan la dirección o la comuna.`;
      const nombre = `${n.clienteId}|${n.marcaId}|${sinTildes(nombreFinal)}`;
      if (nombres.has(nombre)) return `${cual}: el cliente ya tiene (o repites) «${nombreFinal}».`;
      nombres.add(nombre);
      const codigo = n.codigo.trim().toLowerCase();
      if (codigo) {
        const clave = `${n.clienteId}|${codigo}`;
        if (codigos.has(clave)) return `${cual}: el código ${n.codigo.trim()} ya existe (o está repetido).`;
        codigos.add(clave);
      }
    }
    return null;
  }

  /** Avisa de una dirección que el cliente ya tiene (o que se repite en esta carga). */
  function advertencia(): string | null {
    const vistas: { clienteId: string; nombre: string; direccion: string; comuna: string }[] = sucursales.map((s) => ({
      clienteId: String(s.clienteId),
      nombre: s.nombre,
      direccion: s.direccion,
      comuna: s.comuna,
    }));
    for (const [i, n] of nuevas.entries()) {
      const otra = conMismaDireccion(
        vistas.filter((v) => v.clienteId === n.clienteId),
        n.direccion,
        n.comuna
      );
      if (otra) return `Sucursal ${i + 1} («${nombreDe(n).trim()}»): «${otra.nombre}» ya está en «${otra.direccion}».`;
      vistas.push({ clienteId: n.clienteId, nombre: nombreDe(n), direccion: n.direccion, comuna: n.comuna });
    }
    return null;
  }

  function intentar() {
    const error = problema();
    if (error) return onHecho(error, false);
    const aviso = advertencia();
    if (!aviso) return void guardar();
    setConfirmar({
      titulo: "Ya existe esa dirección",
      texto: `${aviso} ¿Quieres crearlas de todas formas?`,
      cta: "Crear de todas formas",
      accion: guardar,
    });
  }

  function alternar(key: number) {
    setPlegadas((prev) => {
      const sig = new Set(prev);
      if (!sig.delete(key)) sig.add(key);
      return sig;
    });
  }

  async function guardar() {
    const error = problema();
    if (error) return onHecho(error, false);
    setGuardando(true);
    const res = await crearSucursalesLoteAction(
      nuevas.map((n) => ({
        clienteId: Number(n.clienteId),
        marcaId: Number(n.marcaId),
        mallId: Number(n.mallId) || null,
        nombre: nombreDe(n).trim(),
        codigo: n.codigo.trim() || null,
        direccion: n.direccion.trim(),
        comuna: n.comuna.trim(),
        region: n.region,
      }))
    );
    setGuardando(false);
    if (!res.ok) return onHecho(res.error ?? "No se pudo guardar.", false);
    onHecho(`${nuevas.length} ${nuevas.length === 1 ? "sucursal creada" : "sucursales creadas"}`, true);
    onCerrar();
  }

  return (
    <>
    <Dialogo
      titulo="Nuevas sucursales"
      cta={
        nuevas.length > 1
          ? `Crear ${nuevas.length} sucursales`
          : "Crear sucursal"
      }
      nota="Cada sucursal lleva su cliente y su marca: puedes cargar de varios clientes a la vez. Al elegir un mall, la sucursal se llama «Cliente · Marca · Mall» y toma su dirección, comuna y región. Nada se guarda hasta confirmar: entonces se crean todas juntas."
      campos={[]}
      form={{}}
      onCampo={() => {}}
      onCerrar={onCerrar}
      onGuardar={intentar}
      guardando={guardando}
    >
      {grupos.map((g) => {
        const mallDelGrupo = malls.find((m) => String(m.id) === g.id);
        const grupoPlegado = gruposPlegados.has(g.id);
        return (
      <div key={g.id || "sin-mall"} className="mt-5">
        <button
          type="button"
          aria-expanded={!grupoPlegado}
          onClick={() => alternarGrupo(g.id)}
          className="w-full flex items-center gap-3 min-h-12 px-3.5 py-2 bg-[var(--color-accent)] text-white border-0 cursor-pointer text-left"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            className="flex-none transition-transform"
            style={{ transform: `rotate(${grupoPlegado ? -90 : 0}deg)` }}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
          <span className="min-w-0">
            <span className="block text-cap uppercase tracking-wider opacity-66">
              {mallDelGrupo ? "Mall" : "A la calle"}
            </span>
            <span className="block font-extrabold text-ui truncate">
              {mallDelGrupo ? mallDelGrupo.nombre : "Sin mall"}
            </span>
          </span>
          <span className="ml-auto flex-none text-cap font-bold tabular-nums border border-current px-2 py-0.5">
            {g.filas.length} {g.filas.length === 1 ? "sucursal" : "sucursales"}
          </span>
        </button>
        <div className={grupoPlegado ? "hidden" : "block"}>
      {g.filas.map(({ n, i }) => {
        const plegada = plegadas.has(n.key);
        const titulo = nombreDe(n).trim() || `Sucursal ${i + 1}`;
        // Plegado no se ve el formulario: la ubicación ayuda a ubicar el bloque.
        const subtitulo = [n.direccion.trim(), n.comuna.trim()].filter(Boolean).join(", ");
        const incompleta = !nombreDe(n).trim() || !n.direccion.trim() || !n.comuna.trim();
        return (
        <div key={n.key} className="mt-3 border border-black/[.3] border-l-4 border-l-[var(--color-accent)]">
          <div className="flex items-center gap-2.5 pr-3.5 bg-[var(--color-surface)] border-b border-[var(--color-divider-soft)]">
            <button
              type="button"
              aria-expanded={!plegada}
              aria-controls={`sl-bloque-${n.key}`}
              onClick={() => alternar(n.key)}
              className="flex-1 min-w-0 flex items-center gap-2.5 min-h-11 pl-3.5 py-2 bg-transparent border-0 cursor-pointer text-left text-[var(--color-text)]"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                className="flex-none transition-transform"
                style={{ transform: `rotate(${plegada ? -90 : 0}deg)` }}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
              <span className="w-6 h-6 flex-none grid place-items-center bg-[var(--color-accent)] text-white font-extrabold text-cap tabular-nums">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-extrabold text-ui truncate">{titulo}</span>
                <span className="block text-cap opacity-66 truncate">{subtitulo || "Falta la dirección"}</span>
              </span>
              {incompleta ? <span className="tag tag-outline flex-none">Falta completar</span> : null}
            </button>
            {nuevas.length > 1 ? (
              <button
                type="button"
                onClick={() => setNuevas((prev) => prev.filter((x) => x.key !== n.key))}
                className="flex-none flex items-center gap-1.5 min-h-8 px-2 bg-transparent border-0 cursor-pointer text-[var(--color-text)] text-cap opacity-72 hover:opacity-100"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
                <span>Quitar</span>
              </button>
            ) : null}
          </div>

          <div
            id={`sl-bloque-${n.key}`}
            className={`${plegada ? "hidden" : "grid"} grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 sm:p-4`}
          >
            <div className="field min-w-0">
              <label htmlFor={`sl-cli-${n.key}`}>Cliente</label>
              <SelectConAlta
                alta="cliente"
                id={`sl-cli-${n.key}`}
                valor={n.clienteId}
                opciones={opcClientes}
                onChange={(v) => cambiar(n.key, "clienteId", v)}
                ariaLabel="Cliente"
              />
              {n.clienteId ? (
                <div className="text-cap leading-[1.4] opacity-66 mt-1.5">
                  {delCliente(n.clienteId).length === 0
                    ? "Todavía no tiene sucursales."
                    : `Ya tiene ${delCliente(n.clienteId).length} ${delCliente(n.clienteId).length === 1 ? "sucursal" : "sucursales"}.`}
                </div>
              ) : null}
            </div>
            <div className="field min-w-0">
              <label htmlFor={`sl-mar-${n.key}`}>Marca</label>
              <SelectConAlta
                alta="marca"
                clienteId={n.clienteId}
                id={`sl-mar-${n.key}`}
                valor={n.marcaId}
                opciones={marcasDe(n.clienteId).map((m) => ({ v: String(m.id), t: m.nombre }))}
                onChange={(v) => cambiar(n.key, "marcaId", v)}
                ariaLabel="Marca"
              />
            </div>
            {malls.length > 0 ? (
              <div className="field min-w-0 sm:col-span-2">
                <label htmlFor={`sl-mall-${n.key}`}>Mall (opcional)</label>
                <SelectConAlta
                  alta="mall"
                  id={`sl-mall-${n.key}`}
                  valor={n.mallId}
                  opciones={opcMalls}
                  onChange={(v) => cambiar(n.key, "mallId", v)}
                  ariaLabel="Mall"
                />
              </div>
            ) : null}
            {n.mallId && n.marcaId ? null : (
              <div className="field min-w-0">
                <label htmlFor={`sl-n-${n.key}`}>Nombre de la sucursal</label>
                <input
                  id={`sl-n-${n.key}`}
                  className="input"
                  value={n.nombre}
                  onChange={(e) => cambiar(n.key, "nombre", e.target.value)}
                  autoComplete="off"
                />
              </div>
            )}
            <div className="field min-w-0">
              <label htmlFor={`sl-c-${n.key}`}>Código interno (opcional)</label>
              <input
                id={`sl-c-${n.key}`}
                className="input"
                value={n.codigo}
                onChange={(e) => cambiar(n.key, "codigo", e.target.value)}
                placeholder="MS-118"
                autoComplete="off"
              />
            </div>
            <div className="field min-w-0 sm:col-span-2">
              <label htmlFor={`sl-d-${n.key}`}>Dirección</label>
              <input
                id={`sl-d-${n.key}`}
                className="input"
                value={n.direccion}
                onChange={(e) => cambiar(n.key, "direccion", e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="field min-w-0">
              <label htmlFor={`sl-m-${n.key}`}>Comuna</label>
              <input
                id={`sl-m-${n.key}`}
                className="input"
                value={n.comuna}
                onChange={(e) => cambiar(n.key, "comuna", e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="field min-w-0">
              <label htmlFor={`sl-r-${n.key}`}>Región</label>
              <SelectBuscable
                id={`sl-r-${n.key}`}
                valor={n.region}
                opciones={opcRegiones}
                onChange={(v) => cambiar(n.key, "region", v)}
                ariaLabel="Región"
              />
            </div>
          </div>
        </div>
        );
      })}
        </div>
      </div>
        );
      })}

      <button
        type="button"
        onClick={() =>
          setNuevas((prev) => {
            const ultima = prev[prev.length - 1];
            return [...prev, vacia(ultima?.clienteId ?? clienteDeInicio, ultima?.marcaId ?? "")];
          })
        }
        className="btn btn-secondary w-full min-h-11 mt-4 justify-center"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M12 5v14M5 12h14" />
        </svg>
        <span>Agregar otra sucursal</span>
      </button>
    </Dialogo>
      {confirmar ? <Confirmar cfg={confirmar} onCerrar={() => setConfirmar(null)} /> : null}
    </>
  );
}
