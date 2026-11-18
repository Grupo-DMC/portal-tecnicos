"use client";

import MaestroTable from "@/components/admin/MaestroTable";
import Tag from "@/components/Tag";
import EstadoActivo from "@/components/ui/EstadoActivo";
import { guardarUsuarioAction } from "@/app/actions/maestros";
import { ETIQUETA_ROL, problemaDeRoles, rolDelPanel, tieneRolTecnico } from "@/lib/roles";
import type { Rol, RolUsuario, Tecnico, Usuario } from "@/lib/types";

/** En el formulario, un rol del panel viaja como "R:<id>" junto a ADMIN. */
const PREFIJO_ROL = "R:";
/** «Acceso al panel» vacío: la cuenta es solo de técnico. */
const SIN_PANEL = "";
const SIN_TECNICO = "—";

type Form = Record<string, string | boolean>;

/** Los roles que arma el formulario: el del panel elegido y, si va, TECNICO. */
function rolesDelForm(f: Form): RolUsuario[] {
  const panel = String(f.panel ?? SIN_PANEL);
  if (panel === SIN_PANEL) return ["TECNICO"];
  const rolPanel: RolUsuario = panel === "ADMIN" ? "ADMIN" : "COORDINADOR";
  return f.tambienTecnico === true ? [rolPanel, "TECNICO"] : [rolPanel];
}

/** "R:5" → 5; el resto, sin rol del panel. */
function rolIdDelForm(f: Form): number | null {
  const panel = String(f.panel ?? "");
  return panel.startsWith(PREFIJO_ROL) ? Number(panel.slice(PREFIJO_ROL.length)) : null;
}

function valorPanel(u: Usuario): string {
  const panel = rolDelPanel(u.roles);
  if (panel === "ADMIN") return "ADMIN";
  if (panel === "COORDINADOR") return u.rolId ? `${PREFIJO_ROL}${u.rolId}` : "COORDINADOR";
  return SIN_PANEL;
}

export default function UsuariosTable({
  usuarios,
  tecnicos,
  roles,
  pestanas,
}: {
  usuarios: Usuario[];
  tecnicos: Tecnico[];
  /** Los roles del panel. */
  roles: Rol[];
  pestanas?: React.ReactNode;
}) {
  /** El nombre de su acceso al panel; "Técnico" si no tiene. */
  const nombreRol = (u: Usuario) => {
    const panel = rolDelPanel(u.roles);
    if (panel === "COORDINADOR") return roles.find((r) => r.id === u.rolId)?.nombre ?? ETIQUETA_ROL.COORDINADOR;
    return ETIQUETA_ROL[panel ?? "TECNICO"];
  };
  const opcionesPanel = [
    { v: "ADMIN", t: "Administrador · acceso total" },
    ...(roles.length
      ? roles.map((r) => ({ v: `${PREFIJO_ROL}${r.id}`, t: r.nombre }))
      : [{ v: "COORDINADOR", t: "Coordinador" }]),
    { v: SIN_PANEL, t: "Sin panel · solo técnico (celular)" },
  ];
  const nombreTecnico = (id: number | null) =>
    id ? tecnicos.find((t) => t.id === id)?.nombreCompleto ?? SIN_TECNICO : SIN_TECNICO;

  return (
    <MaestroTable<Usuario>
      title="Usuarios"
      modulo="usuarios"
      pestanas={pestanas}
      addLabel="Nuevo usuario"
      editLabel="Editar usuario"
      nota="El acceso al panel decide qué puede hacer la persona ahí; se arma en la pestaña Roles y permisos. Marca «También es técnico» para que, con el mismo correo y la misma clave, pueda pasar al panel de técnico y llenar las actas de su técnico vinculado (solo un administrador puede marcarlo). Las contraseñas se guardan cifradas: no se pueden consultar, solo reemplazar."
      phBusqueda="Buscar correo o rol…"
      rows={usuarios}
      searchKeys={(u) => `${u.email} ${u.roles.join(" ")} ${nombreRol(u)} ${nombreTecnico(u.tecnicoId)}`}
      columns={[
        { key: "email", label: "Correo" },
        {
          key: "rol",
          label: "Rol",
          render: (u) => {
            const panel = rolDelPanel(u.roles);
            return (
              <span className="inline-flex flex-wrap gap-1">
                {panel && <Tag variant={panel === "ADMIN" ? "outline" : "accent"}>{nombreRol(u)}</Tag>}
                {tieneRolTecnico(u.roles) && <Tag variant="neutral">{ETIQUETA_ROL.TECNICO}</Tag>}
              </span>
            );
          },
        },
        { key: "tecnico", label: "Técnico vinculado", render: (u) => nombreTecnico(u.tecnicoId) },
        {
          key: "ultimoAcceso",
          label: "Último acceso",
          render: (u) =>
            u.ultimoAccesoEn ? (
              <span className="tabular-nums opacity-75">{u.ultimoAccesoEn.slice(0, 16).replace("T", " ")}</span>
            ) : (
              <span className="opacity-45">Nunca</span>
            ),
        },
        {
          key: "activo",
          label: "Estado",
          render: (u) => <EstadoActivo activo={u.activo} baja={u.baja} motivo={u.motivoInactivo} />,
        },
      ]}
      fields={[
        { k: "email", label: "Correo", span: 2, tipo: "email" },
        {
          k: "panel",
          label: "Acceso al panel",
          tipo: "select",
          opciones: opcionesPanel,
          // Sin acceso al panel la cuenta ya es de técnico: la casilla es para
          // quien tiene panel y además sale a terreno.
          casilla: { k: "tambienTecnico", label: "También es técnico" },
        },
        {
          k: "tecnicoId",
          label: "Técnico vinculado",
          tipo: "select",
          opciones: [
            { v: "", t: SIN_TECNICO },
            ...tecnicos.filter((t) => t.activo).map((t) => ({ v: String(t.id), t: t.nombreCompleto })),
          ],
          ayuda: "Con este técnico ve sus visitas asignadas y llena sus actas desde el panel de técnico.",
          visible: (f) => rolesDelForm(f).includes("TECNICO"),
        },
        {
          k: "password",
          label: "Contraseña",
          tipo: "password",
          span: 2,
          ph: "Mínimo 10 caracteres",
          // El hash de bcrypt no se puede revertir: la contraseña actual no se
          // muestra nunca, solo se reemplaza.
          ayuda:
            "Al editar, déjala vacía para no cambiarla. No hay forma de consultar la contraseña actual. Si la pones tú, la persona tendrá que cambiarla al entrar.",
        },
        { k: "activo", label: "Estado", tipo: "toggle", desactiva: "la cuenta" },
      ]}
      validar={(f) => {
        if (!String(f.email).includes("@")) return "Escribe un correo válido";
        return problemaDeRoles(rolesDelForm(f), f.tecnicoId ? Number(f.tecnicoId) : null);
      }}
      toFormValues={(u) => ({
        email: u.email,
        panel: valorPanel(u),
        tambienTecnico: rolDelPanel(u.roles) !== null && tieneRolTecnico(u.roles),
        tecnicoId: u.tecnicoId ? String(u.tecnicoId) : "",
        password: "",
        activo: u.activo,
        motivoInactivo: u.motivoInactivo ?? "",
      })}
      guardarAction={(id, f) => {
        const rolesNuevos = rolesDelForm(f);
        return guardarUsuarioAction(id, {
          email: String(f.email).trim().toLowerCase(),
          roles: rolesNuevos,
          rolId: rolIdDelForm(f),
          tecnicoId: rolesNuevos.includes("TECNICO") && f.tecnicoId ? Number(f.tecnicoId) : null,
          activo: f.activo !== false,
          motivoInactivo: String(f.motivoInactivo ?? "").trim() || null,
          password: String(f.password),
        });
      }}
      emptyRow={{
        email: "",
        panel: roles[0] ? `${PREFIJO_ROL}${roles[0].id}` : "COORDINADOR",
        tambienTecnico: false,
        tecnicoId: "",
        password: "",
        activo: true,
        motivoInactivo: "",
      }}
    />
  );
}
