import { describe, expect, it } from "vitest";
import {
  enModoTecnico,
  enPanel,
  esAdmin,
  inicioDelModo,
  modosDisponibles,
  mismosRoles,
  ordenarRoles,
  problemaDeRoles,
  resolverModo,
  rolDelPanel,
  textoRoles,
  type Modo,
} from "@/lib/roles";
import { motivoParaNoGuardarCuenta, PERMISOS_COORDINADOR, TODOS_LOS_PERMISOS } from "@/lib/permisos";
import { firmarToken, verificarToken } from "@/lib/session";
import type { RolUsuario } from "@/lib/types";

// Varios roles por cuenta (migración 044): qué modos tiene cada combinación,
// cuál queda cuando el token pide uno, y qué deja hacer cada modo.

const sesion = (roles: RolUsuario[], modo: Modo) => ({ modo, usuario: { roles } });

describe("roles", () => {
  it("se ordenan, sin repetidos ni valores desconocidos", () => {
    expect(ordenarRoles(["TECNICO", "ADMIN", "TECNICO", "ROOT", ""])).toEqual(["ADMIN", "TECNICO"]);
    expect(ordenarRoles([])).toEqual([]);
  });

  it("el rol del panel: ADMIN, COORDINADOR o ninguno", () => {
    expect(rolDelPanel(["ADMIN", "TECNICO"])).toBe("ADMIN");
    expect(rolDelPanel(["COORDINADOR", "TECNICO"])).toBe("COORDINADOR");
    expect(rolDelPanel(["TECNICO"])).toBeNull();
  });

  it("combinaciones válidas e inválidas", () => {
    expect(problemaDeRoles(["ADMIN"], null)).toBeNull();
    expect(problemaDeRoles(["COORDINADOR"], null)).toBeNull();
    expect(problemaDeRoles(["TECNICO"], 3)).toBeNull();
    expect(problemaDeRoles(["ADMIN", "TECNICO"], 3)).toBeNull();
    expect(problemaDeRoles(["COORDINADOR", "TECNICO"], 3)).toBeNull();
    expect(problemaDeRoles([], null)).toMatch(/al menos un rol/);
    expect(problemaDeRoles(["ADMIN", "COORDINADOR"], null)).toMatch(/a la vez/);
    expect(problemaDeRoles(["TECNICO"], null)).toMatch(/vincular un técnico/);
    expect(problemaDeRoles(["ADMIN", "TECNICO"], 0)).toMatch(/vincular un técnico/);
  });

  it("mismosRoles no mira el orden", () => {
    expect(mismosRoles(["TECNICO", "ADMIN"], ["ADMIN", "TECNICO"])).toBe(true);
    expect(mismosRoles(["ADMIN"], ["ADMIN", "TECNICO"])).toBe(false);
  });

  it("textoRoles", () => {
    expect(textoRoles(["TECNICO", "COORDINADOR"])).toBe("Coordinador + Técnico");
  });
});

describe("modos disponibles", () => {
  it.each<[string, RolUsuario[], boolean, Modo[]]>([
    ["solo técnico", ["TECNICO"], true, ["tecnico"]],
    ["solo técnico, con el técnico inactivo", ["TECNICO"], false, []],
    ["solo admin", ["ADMIN"], false, ["panel"]],
    ["solo coordinador", ["COORDINADOR"], false, ["panel"]],
    ["admin + técnico", ["ADMIN", "TECNICO"], true, ["panel", "tecnico"]],
    ["coordinador + técnico", ["COORDINADOR", "TECNICO"], true, ["panel", "tecnico"]],
    ["admin + técnico, con el técnico inactivo", ["ADMIN", "TECNICO"], false, ["panel"]],
  ])("%s", (_n, roles, activo, modos) => {
    expect(modosDisponibles(roles, activo)).toEqual(modos);
  });
});

describe("resolverModo: el token pide, la base decide", () => {
  it("sin pedir nada, el primero: el panel para quien tiene los dos", () => {
    expect(resolverModo(undefined, ["panel", "tecnico"])).toBe("panel");
    expect(resolverModo(undefined, ["tecnico"])).toBe("tecnico");
  });

  it("el pedido vale si la cuenta lo tiene", () => {
    expect(resolverModo("tecnico", ["panel", "tecnico"])).toBe("tecnico");
    expect(resolverModo("panel", ["panel", "tecnico"])).toBe("panel");
  });

  it("un técnico puro que pide el panel se queda de técnico", () => {
    expect(resolverModo("panel", ["tecnico"])).toBe("tecnico");
  });

  it("un admin puro que pide el modo técnico se queda en el panel", () => {
    expect(resolverModo("tecnico", ["panel"])).toBe("panel");
  });

  it("sin ningún modo no hay sesión", () => {
    expect(resolverModo("panel", [])).toBeNull();
    expect(resolverModo(undefined, [])).toBeNull();
  });

  it("cada modo tiene su inicio", () => {
    expect(inicioDelModo("panel")).toBe("/admin");
    expect(inicioDelModo("tecnico")).toBe("/tecnico");
  });
});

describe("qué deja hacer cada modo", () => {
  it.each<[string, RolUsuario[], Modo, { panel: boolean; tecnico: boolean; admin: boolean }]>([
    ["solo técnico", ["TECNICO"], "tecnico", { panel: false, tecnico: true, admin: false }],
    ["solo admin", ["ADMIN"], "panel", { panel: true, tecnico: false, admin: true }],
    ["solo coordinador", ["COORDINADOR"], "panel", { panel: true, tecnico: false, admin: false }],
    ["admin + técnico en el panel", ["ADMIN", "TECNICO"], "panel", { panel: true, tecnico: false, admin: true }],
    ["admin + técnico de técnico", ["ADMIN", "TECNICO"], "tecnico", { panel: false, tecnico: true, admin: false }],
    ["coordinador + técnico en el panel", ["COORDINADOR", "TECNICO"], "panel", { panel: true, tecnico: false, admin: false }],
    ["coordinador + técnico de técnico", ["COORDINADOR", "TECNICO"], "tecnico", { panel: false, tecnico: true, admin: false }],
  ])("%s", (_n, roles, modo, esperado) => {
    const s = sesion(roles, modo);
    expect({ panel: enPanel(s), tecnico: enModoTecnico(s), admin: esAdmin(s) }).toEqual(esperado);
  });

  it("un modo «panel» sin rol del panel no abre el panel", () => {
    expect(enPanel(sesion(["TECNICO"], "panel"))).toBe(false);
    expect(esAdmin(sesion(["TECNICO"], "panel"))).toBe(false);
  });
});

describe("el modo en el token", () => {
  it("viaja firmado y se lee igual", async () => {
    const t = await verificarToken(await firmarToken(4, 2, Date.now(), "tecnico"));
    expect(t).toMatchObject({ uid: 4, sv: 2, modo: "tecnico" });
  });

  it("sin modo, el token no lo trae", async () => {
    const t = await verificarToken(await firmarToken(4, 2));
    expect(t).not.toHaveProperty("modo");
  });

  it("un modo que no existe invalida el token", async () => {
    const t = await firmarToken(4, 2, Date.now(), "root" as Modo);
    expect(await verificarToken(t)).toBeNull();
  });

  it("cambiar el modo a mano rompe la firma", async () => {
    const t = await firmarToken(4, 2, Date.now(), "panel");
    const [cuerpo, firma] = t.split(".");
    const carga = JSON.parse(Buffer.from(cuerpo, "base64url").toString());
    const alterado = Buffer.from(JSON.stringify({ ...carga, modo: "tecnico" })).toString("base64url");
    expect(await verificarToken(`${alterado}.${firma}`)).toBeNull();
  });
});

describe("motivoParaNoGuardarCuenta: vincular técnicos a cuentas del panel", () => {
  const admin = { modo: "panel" as const, usuario: { id: 1, roles: ["ADMIN" as const] }, permisos: TODOS_LOS_PERMISOS };
  const coord = {
    modo: "panel" as const,
    usuario: { id: 2, roles: ["COORDINADOR" as const] },
    permisos: [...PERMISOS_COORDINADOR, "usuarios.crear", "usuarios.editar"],
  };
  const panel = { roles: ["COORDINADOR" as const], rolId: 5, tecnicoId: null, permisos: ["visitas.ver"] };
  const doble = { ...panel, roles: ["COORDINADOR" as const, "TECNICO" as const], tecnicoId: 11 };

  it("el administrador puede", () => {
    expect(motivoParaNoGuardarCuenta(admin, 9, panel, doble)).toBeNull();
    expect(motivoParaNoGuardarCuenta(admin, null, null, { ...doble, roles: ["ADMIN", "TECNICO"], permisos: TODOS_LOS_PERMISOS })).toBeNull();
  });

  it("un coordinador no", () => {
    expect(motivoParaNoGuardarCuenta(coord, 9, panel, doble)).toMatch(/Solo un administrador/);
    expect(motivoParaNoGuardarCuenta(coord, null, null, doble)).toMatch(/Solo un administrador/);
    expect(motivoParaNoGuardarCuenta(coord, 9, doble, { ...doble, tecnicoId: 12 })).toMatch(/Solo un administrador/);
  });

  it("un coordinador no puede hacerse técnico a sí mismo", () => {
    expect(motivoParaNoGuardarCuenta(coord, 2, panel, doble)).toBe("No puedes cambiar tu propio rol.");
  });

  it("un administrador en modo técnico no administra cuentas", () => {
    const enTerreno = { ...admin, modo: "tecnico" as const, usuario: { id: 1, roles: ["ADMIN" as const, "TECNICO" as const] } };
    expect(motivoParaNoGuardarCuenta(enTerreno, 9, panel, panel)).not.toBeNull();
  });
});
