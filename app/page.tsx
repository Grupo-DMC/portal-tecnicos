import { redirect } from "next/navigation";
import { getSesion, inicioDeSesion, rutaSinSesion } from "@/lib/auth";

export default async function Home() {
  const sesion = await getSesion();
  if (!sesion) redirect(await rutaSinSesion());
  redirect(inicioDeSesion(sesion));
}
