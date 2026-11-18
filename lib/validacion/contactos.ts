import { z } from "zod";
import { ALCANCES } from "@/lib/ui/contactos";
import { arreglo, correo, idPositivo, telefono, texto } from "./comun";

// Contactos: su ficha y sus cargos con alcance.

const cargo = z.object({
  cargo: texto(80),
  alcanceTipo: z.enum(ALCANCES),
  alcanceId: idPositivo.nullable(),
  alcanceTexto: texto(80).nullable(),
});

export const entradaContacto = z.object({
  id: idPositivo.nullable(),
  datos: z.object({
    nombre: texto(120),
    email: correo.nullable(),
    telefono: telefono.nullable(),
    activo: z.boolean(),
    // El motivo de una baja (migración 039). Lo que falte lo dice `problemaDeBaja`.
    motivoInactivo: texto(400).nullable().default(null),
    // Un contacto con más de 50 cargos ya sería un error de carga.
    cargos: arreglo(cargo, 50),
  }),
});

/** Quitar un cargo (la presencia del contacto en una ficha), sin borrar al contacto. */
export const entradaQuitarCargo = z.object({ contactoId: idPositivo, cargoId: idPositivo });
