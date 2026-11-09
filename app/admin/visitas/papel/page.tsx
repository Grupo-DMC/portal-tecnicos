import { notFound } from "next/navigation";

/**
 * "Visitas en papel" está desactivada: no hay botón ni se entra por la dirección.
 * El código de la carga sigue en `components/admin/papel` por si se reactiva.
 */
export default function VisitasPapelPage() {
  notFound();
}
