import Link from "next/link";
import { redirect } from "next/navigation";
import { getSesion } from "@/lib/auth";
import { getVisitasPorTecnico } from "@/lib/data/visitas";
import { visitaParaTecnico } from "@/lib/data/visita-reducida";
import { listarMalls, listarSucursales } from "@/lib/data/maestros";
import { diaDeVisita, hoyISO, sumarDias } from "@/lib/ui/fecha";
import MobileShell from "@/components/mobile/MobileShell";
import TarjetaVisita from "@/components/mobile/TarjetaVisita";
import Icono from "@/components/ui/Icono";
import { ocultarRut } from "@/lib/ui/reservado";
import type { Visita } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function InicioPage() {
  const sesion = await getSesion();
  if (!sesion?.tecnico) redirect("/login");

  const HOY = hoyISO();
  const [crudas, malls, sucursales] = await Promise.all([
    getVisitasPorTecnico(sesion.tecnico.id),
    listarMalls(),
    listarSucursales(),
  ]);
  const visitas = crudas.map((v) => visitaParaTecnico(v, sesion.tecnico!.id));
  // Las que tienen margen de días cuentan como de hoy mientras sigan abiertas.
  const deHoy = visitas.filter((v) => diaDeVisita(v, HOY) === HOY);
  const nHoy = deHoy.length;
  const nCurso = deHoy.filter((v) => v.estado === "EN_CURSO").length;
  const nPend = deHoy.filter((v) => v.estado === "PROGRAMADA" || v.estado === "PENDIENTE").length;

  // La agenda: arriba las que el técnico ya empezó, que son las que necesita
  // abrir cuanto antes, y después las programadas de cualquier día, de la
  // fecha más lejana a la más próxima a vencer. Las cerradas no salen.
  const porHora = (a: Visita, b: Visita) => (a.horaProgramada ?? "99:99").localeCompare(b.horaProgramada ?? "99:99");
  const mallDe = new Map(sucursales.map((s) => [s.id, s.mallId ?? null]));

  const fechaLarga = (fecha: string) =>
    new Date(`${fecha}T00:00:00`).toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });
  const tituloDia = (fecha: string) => {
    if (fecha === HOY) return "Hoy";
    if (fecha === sumarDias(HOY, -1)) return `Ayer · ${fechaLarga(fecha)}`;
    if (fecha === sumarDias(HOY, 1)) return `Mañana · ${fechaLarga(fecha)}`;
    return fechaLarga(fecha);
  };

  // Clave de la sección de las en curso: ordena por encima de cualquier fecha.
  const EN_CURSO = "~";
  const porDia = new Map<string, Visita[]>();
  for (const v of visitas) {
    if (v.estado !== "PROGRAMADA" && v.estado !== "EN_CURSO") continue;
    const dia = v.estado === "EN_CURSO" ? EN_CURSO : diaDeVisita(v, HOY);
    porDia.set(dia, [...(porDia.get(dia) ?? []), v]);
  }
  // Dentro de cada día, agrupadas por el mall de su tienda. Las que no están
  // en ningún mall van juntas al final, en «Otras visitas».
  const dias = [...porDia.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([fecha, delDia]) => {
      const grupos = malls
        .map((m) => ({
          clave: String(m.id),
          nombre: m.nombre,
          direccion: [m.direccion, m.comuna].filter(Boolean).join(", ") as string | null,
          visitas: delDia.filter((v) => mallDe.get(v.sucursalId) === m.id).sort(porHora),
        }))
        .filter((g) => g.visitas.length > 0);
      const sinMall = delDia.filter((v) => !grupos.some((g) => g.visitas.includes(v))).sort(porHora);
      if (sinMall.length > 0) {
        grupos.push({
          clave: "otras",
          nombre: "Otras visitas",
          direccion: null,
          visitas: sinMall,
        });
      }
      return {
        fecha,
        titulo: fecha === EN_CURSO ? "En curso" : tituloDia(fecha),
        enCurso: fecha === EN_CURSO,
        atrasado: fecha !== EN_CURSO && fecha < HOY,
        total: grupos.reduce((n, g) => n + g.visitas.length, 0),
        grupos,
      };
    });

  const fechaHoy = fechaLarga(HOY);

  const tarjetas = (lista: Visita[]) => (
    <div className="tp-list">
      {lista.map((v) => (
        <TarjetaVisita
          key={v.id}
          visita={v}
          tecnicoId={sesion.tecnico!.id}
          atrasada={v.estado === "PROGRAMADA" && diaDeVisita(v, HOY) < HOY}
        />
      ))}
    </div>
  );

  return (
    <MobileShell titulo="Inicio">
      <div className="tp-main">
        <div className="tp-hello">
          <h1>
            Hola, <b>{sesion.tecnico.nombres}</b>
          </h1>
          <p>
            <b className="primera">{fechaHoy}</b>
            <br />
            {ocultarRut(sesion.tecnico.rut)} · Técnico de terreno · {sesion.tecnico.email}
          </p>
        </div>

        <div className="tp-kpis">
          <Link href="/tecnico/visitas">
            <b>{nHoy}</b>
            <span>Visitas hoy</span>
          </Link>
          <Link href="/tecnico/visitas">
            <b>{nCurso}</b>
            <span>En curso</span>
          </Link>
          <Link href="/tecnico/visitas" className={nPend > 0 ? "warn" : undefined}>
            <b>{nPend}</b>
            <span>Por cerrar</span>
          </Link>
        </div>

        {dias.length === 0 ? (
          <div className="tp-empty">
            <b>No tienes visitas por hacer</b>
            <span>Cuando coordinación te asigne una, aparece aquí.</span>
          </div>
        ) : null}
        {dias.map((d) => (
          <section className="tp-sec" key={d.fecha}>
            <div className="tp-h2">
              <h2 className={d.atrasado ? "atrasado" : undefined}>{d.titulo}</h2>
              <small>
                {d.total} {d.total === 1 ? "visita" : "visitas"}
              </small>
            </div>
            {d.grupos.length === 1 && d.grupos[0].clave === "otras" ? (
              // Sin malls que agrupar: las visitas van directo bajo el día.
              tarjetas(d.grupos[0].visitas)
            ) : (
              d.grupos.map((g) => (
                <details key={g.clave} open={d.grupos.length === 1} className="tp-mall">
                  <summary>
                    <span>
                      <b>{g.nombre}</b>
                      {g.direccion ? <small>{g.direccion}</small> : null}
                      <small>
                        {g.visitas.length} {g.visitas.length === 1 ? "visita" : "visitas"}
                      </small>
                    </span>
                    <Icono nombre="abajo" />
                  </summary>
                  {tarjetas(g.visitas)}
                </details>
              ))
            )}
          </section>
        ))}

        <Link href="/tecnico/visitas" className="tp-more">
          Ver todas mis visitas
          <span>{visitas.length}</span>
        </Link>
      </div>
    </MobileShell>
  );
}
