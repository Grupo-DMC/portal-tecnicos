"use client";

import { useState } from "react";
import MaestroTable from "@/components/admin/MaestroTable";
import EstadoActivo from "@/components/ui/EstadoActivo";
import { guardarTecnicoAction } from "@/app/actions/maestros";
import { mensajeRut, mensajeTel, rutLimpio } from "@/lib/ui/formato";
import { puede, useReferencias } from "@/lib/ui/referencias";
import { ocultarRut } from "@/lib/ui/reservado";
import type { Tecnico } from "@/lib/types";

export default function TecnicosTable({
  tecnicos,
  pestanas,
}: {
  tecnicos: Tecnico[];
  pestanas?: React.ReactNode;
}) {
  // Los RUT van ocultos; quien administra roles puede destaparlos mientras mira.
  const puedeVerRut = puede(useReferencias(), "usuarios.roles");
  const [rutCompleto, setRutCompleto] = useState(false);
  return (
    <MaestroTable<Tecnico>
      accionesCabecera={
        puedeVerRut ? (
          <button type="button" className="btn-out" aria-pressed={rutCompleto} onClick={() => setRutCompleto((x) => !x)}>
            Mostrar RUT completos
          </button>
        ) : null
      }
      title="Usuarios"
      pestanas={pestanas}
      modulo="tecnicos"
      addLabel="Nuevo técnico"
      editLabel="Editar técnico"
      nota="El RUT y el correo no se pueden repetir. Todos los técnicos salen desde la oficina central, así que no se asigna zona."
      phBusqueda="Buscar técnico, RUT, correo…"
      rows={tecnicos}
      searchKeys={(t) => `${t.nombreCompleto} ${t.rut} ${t.email} ${t.telefono ?? ""}`}
      columns={[
        { key: "nombreCompleto", label: "Nombre" },
        { key: "rut", label: "RUT", render: (t) => (rutCompleto ? t.rut : ocultarRut(t.rut)) },
        { key: "email", label: "Correo" },
        { key: "telefono", label: "Teléfono" },
        {
          key: "activo",
          label: "Estado",
          render: (t) => <EstadoActivo activo={t.activo} baja={t.baja} motivo={t.motivoInactivo} />,
        },
      ]}
      fields={[
        { k: "nombres", label: "Nombres" },
        { k: "rut", label: "RUT", tipo: "rut", ph: "11.111.111-1" },
        { k: "apellidoPaterno", label: "Apellido paterno" },
        { k: "apellidoMaterno", label: "Apellido materno" },
        { k: "email", label: "Correo", tipo: "email" },
        { k: "telefono", label: "Teléfono", tipo: "tel" },
        { k: "activo", label: "Estado", span: 2, tipo: "toggle", desactiva: "el técnico" },
      ]}
      validar={(f, id) => {
        if (!String(f.nombres).trim() || !String(f.rut).trim() || !String(f.email).trim()) {
          return "Nombre, RUT y correo son obligatorios";
        }
        if (!String(f.email).includes("@")) return "Escribe un correo válido";
        const error = mensajeRut(String(f.rut));
        if (error) return error;
        const errorTel = mensajeTel(String(f.telefono ?? ""));
        if (errorTel) return errorTel;
        // El RUT es único entre personas: si ya está, hay que editar esa ficha.
        const limpio = rutLimpio(String(f.rut));
        const repetido = tecnicos.find((t) => t.id !== id && rutLimpio(t.rut) === limpio);
        if (repetido) return `Ese RUT ya es de ${repetido.nombreCompleto}. El RUT es único entre personas.`;
        const correo = String(f.email).trim().toLowerCase();
        const mismoCorreo = tecnicos.find((t) => t.id !== id && t.email.toLowerCase() === correo);
        return mismoCorreo ? `Ese correo ya es de ${mismoCorreo.nombreCompleto}.` : null;
      }}
      toFormValues={(t) => ({
        nombres: t.nombres,
        apellidoPaterno: t.apellidoPaterno,
        apellidoMaterno: t.apellidoMaterno ?? "",
        rut: t.rut,
        email: t.email,
        telefono: t.telefono ?? "",
        activo: t.activo,
        motivoInactivo: t.motivoInactivo ?? "",
      })}
      guardarAction={(id, f) =>
        guardarTecnicoAction(id, {
          nombres: String(f.nombres).trim(),
          apellidoPaterno: String(f.apellidoPaterno).trim(),
          apellidoMaterno: String(f.apellidoMaterno).trim() || null,
          rut: String(f.rut).trim(),
          email: String(f.email).trim().toLowerCase(),
          telefono: String(f.telefono).trim() || null,
          activo: f.activo !== false,
          motivoInactivo: String(f.motivoInactivo ?? "").trim() || null,
        })
      }
      emptyRow={{
        nombres: "",
        apellidoPaterno: "",
        apellidoMaterno: "",
        rut: "",
        email: "",
        telefono: "",
        activo: true,
        motivoInactivo: "",
      }}
    />
  );
}
