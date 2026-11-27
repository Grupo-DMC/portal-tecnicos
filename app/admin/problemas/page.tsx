import ProblemasView from "@/components/admin/ProblemasView";
import { getPanelProblemas } from "@/lib/data/problemas";
import SinAcceso from "@/components/admin/SinAcceso";
import { sesionCon } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ProblemasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await sesionCon("problemas.ver"))) return <SinAcceso />;
  // «Ver problemas» del Panel llega con el tipo elegido.
  const { tipo } = await searchParams;
  return <ProblemasView datos={await getPanelProblemas()} tipoInicial={typeof tipo === "string" ? tipo.slice(0, 40) : ""} />;
}
