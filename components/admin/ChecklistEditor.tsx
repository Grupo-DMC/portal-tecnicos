"use client";
import Espera from "@/components/ui/Espera";

import { useState } from "react";
import AdminHeader from "@/components/admin/AdminHeader";
import Pestanas from "@/components/admin/Pestanas";
import VistaTecnico from "@/components/admin/checklist/VistaTecnico";
import { PestanaChecklist } from "@/components/admin/checklist/piezas";
import Confirmar from "@/components/ui/Confirmar";
import { Toast } from "@/components/ui/Toast";
import { Introduccion, ListasSimples, PieGuardar, PlantillaPropia } from "@/components/admin/checklist/listas-simples";
import { ListaMotivos, ListaTiposProblema, ListaTrabajos } from "@/components/admin/checklist/listas";
import { useChecklistEditor } from "@/components/admin/checklist/useChecklistEditor";
import { SeccionesObligatoriasActa } from "@/components/admin/checklist/secciones-acta";
import type { SeccionesObligatorias } from "@/lib/contratos/secciones-acta";

/**
 * Editor de las listas del checklist.
 *
 * Trabaja sobre un borrador local: mover, renombrar, clonar y quitar solo tocan
 * la pantalla. Nada llega a SQL Server hasta que se aprieta "Guardar cambios" y
 * se confirma — antes esto guardaba en cada blur y era imposible saber qué
 * había quedado escrito y qué no.
 *
 * Quitar una entrada nunca borra la fila: la deja inactiva. Las visitas y las
 * actas ya registradas apuntan a ella por su código y tienen que seguir
 * mostrándose tal como se firmaron.
 *
 * El estado vive en useChecklistEditor; cada lista está en components/admin/checklist.
 */
export default function ChecklistEditor({
  seccionesActaIniciales,
  ...props
}: Parameters<typeof useChecklistEditor>[0] & { seccionesActaIniciales: SeccionesObligatorias }) {
  const fv = useChecklistEditor(props);
  const { toast, aviso, confirmar, setConfirmar, guardando, soloLectura, sucio, pedirGuardar } = fv;
  const [pestana, setPestana] = useState("motivos");
  const [vista, setVista] = useState(false);
  // Al buscar se miran todas las listas a la vez.
  const activa = fv.busqueda.trim() ? null : pestana;
  return (
    <>
      <AdminHeader
        title="Checklist"
        pestanas={<Pestanas pestanas={PESTANAS} activa={activa ?? ""} onCambiar={(c) => { fv.setBusqueda(""); setPestana(c); }} />}
      >
        <button type="button" className="btn-out" onClick={() => setVista(true)}>
          Así lo ve el técnico
        </button>
        <button type="button" className="btn-pri" onClick={pedirGuardar} disabled={guardando || !sucio || soloLectura}>
          {soloLectura ? "Solo lectura" : <Espera activo={guardando} accion="Guardando">{sucio ? "Guardar cambios" : "Sin cambios"}</Espera>}
        </button>
      </AdminHeader>

      <div className="wrap tras-cabecera ck">
        <Introduccion fv={fv} />
        <PestanaChecklist.Provider value={activa}>
          <div className="ck-bloque" hidden={activa !== null && activa !== "acta"}>
            <SeccionesObligatoriasActa iniciales={seccionesActaIniciales} soloLectura={soloLectura} aviso={aviso} />
          </div>
          <ListaMotivos fv={fv} />
          <ListaTiposProblema fv={fv} />
          <ListaTrabajos fv={fv} />
          <ListasSimples fv={fv} />
        </PestanaChecklist.Provider>
        <PlantillaPropia fv={fv} />
        <PieGuardar fv={fv} />
      </div>

      {vista ? <VistaTecnico fv={fv} onCerrar={() => setVista(false)} /> : null}
      {confirmar ? <Confirmar cfg={confirmar} onCerrar={() => setConfirmar(null)} /> : null}
      <Toast texto={toast} variante="panel" />
    </>
  );
}

const PESTANAS = [
  { clave: "motivos", label: "Motivos" },
  { clave: "problemas", label: "Tipos de problema" },
  { clave: "trabajos", label: "Trabajos" },
  { clave: "interno", label: "Comentario interno" },
  { clave: "gestion", label: "Gestión de problemas" },
  { clave: "estados", label: "Estados" },
  { clave: "cargos", label: "Cargos" },
  { clave: "acta", label: "Acta" },
];
