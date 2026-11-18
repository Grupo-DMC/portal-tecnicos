import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { consulta } from "@/lib/data/sql";
import { guardarUsuario, listarUsuarios, type DatosUsuario } from "@/lib/data/maestros";
import { getUsuarioPorId } from "@/lib/data/usuarios";
import { leerCuenta } from "@/lib/data/roles";
import { hayBd, limpiarDatos, mensajeDeError, sembrarMundo, uno, type Mundo } from "./_ayuda";

// Varios roles por cuenta (migración 044) contra SQL Server de verdad: el MERGE
// de dmc.usuario_rol y el orden en que guardarUsuario escribe, que tiene que
// dejar la cuenta válida ante los triggers en cada paso.
describe.skipIf(!hayBd)("BD · roles por cuenta", () => {
  let m: Mundo;
  let tecnicoLibre: number;
  let rolPanel: number;

  const base = (extra: Partial<DatosUsuario> = {}): DatosUsuario => ({
    email: "persona@example.com",
    roles: ["ADMIN"],
    rolId: null,
    tecnicoId: null,
    activo: true,
    motivoInactivo: null,
    password: "",
    ...extra,
  });
  const control = { actorId: 0, actorEmail: "admin@example.com", autorizar: () => null };
  const roles = async (id: number) =>
    (await consulta<{ rol: string }>(`SELECT rol FROM dmc.usuario_rol WHERE usuario_id = ${id} ORDER BY rol`)).map((f) => f.rol);
  // bigint llega como texto: se pasa a número para comparar.
  const fila = async (id: number) => {
    const f = (await uno<{ tecnico_id: unknown; rol_id: unknown; sesion_version: unknown }>(
      `SELECT tecnico_id, rol_id, sesion_version FROM dmc.usuario WHERE id = ${id}`
    ))!;
    const n = (v: unknown) => (v === null ? null : Number(v));
    return { tecnico_id: n(f.tecnico_id), rol_id: n(f.rol_id), sesion_version: Number(f.sesion_version) };
  };

  beforeEach(async () => {
    await limpiarDatos();
    m = await sembrarMundo();
    tecnicoLibre = Number(
      (await uno<{ id: number }>(
        `INSERT INTO dmc.tecnico (rut, nombres, apellido_paterno, email) VALUES ('55.555.555-5', N'Doble', N'Rol', 'doble@example.com');
         SELECT CAST(SCOPE_IDENTITY() AS bigint) AS id`
      ))!.id
    );
    rolPanel = Number((await uno<{ id: number }>(`SELECT TOP 1 id FROM dmc.rol WHERE es_sistema = 1 AND nombre <> N'Técnico'`))!.id);
  });
  afterAll(() => limpiarDatos());

  it("crea una cuenta ADMIN + TECNICO de una vez", async () => {
    const { id } = await guardarUsuario(null, base({ roles: ["ADMIN", "TECNICO"], tecnicoId: tecnicoLibre, password: "Clave-Larga-123" }), control);
    expect(await roles(id)).toEqual(["ADMIN", "TECNICO"]);
    expect((await fila(id)).tecnico_id).toBe(tecnicoLibre);
    const leido = await getUsuarioPorId(id);
    expect(leido?.usuario.roles).toEqual(["ADMIN", "TECNICO"]);
    expect(leido?.tecnico?.id).toBe(tecnicoLibre);
  });

  it("a un admin existente se le suma el rol de técnico, y sus sesiones se cierran", async () => {
    const antes = (await fila(m.adminId)).sesion_version;
    await guardarUsuario(m.adminId, base({ email: "admin@example.com", roles: ["ADMIN", "TECNICO"], tecnicoId: tecnicoLibre }), control);
    expect(await roles(m.adminId)).toEqual(["ADMIN", "TECNICO"]);
    expect((await fila(m.adminId)).sesion_version).toBe(antes + 1);
  });

  it("quitarle el técnico a una cuenta doble suelta el vínculo", async () => {
    await guardarUsuario(m.adminId, base({ email: "admin@example.com", roles: ["ADMIN", "TECNICO"], tecnicoId: tecnicoLibre }), control);
    await guardarUsuario(m.adminId, base({ email: "admin@example.com", roles: ["ADMIN"], tecnicoId: tecnicoLibre }), control);
    expect(await roles(m.adminId)).toEqual(["ADMIN"]);
    expect((await fila(m.adminId)).tecnico_id).toBeNull();
  });

  it("de técnico puro a coordinador con rol del panel, y de vuelta", async () => {
    await guardarUsuario(m.usuarioTecnicoId, base({ email: "ana@example.com", roles: ["COORDINADOR"], rolId: rolPanel, tecnicoId: m.tecnicoId }), control);
    expect(await roles(m.usuarioTecnicoId)).toEqual(["COORDINADOR"]);
    expect(await fila(m.usuarioTecnicoId)).toMatchObject({ tecnico_id: null, rol_id: rolPanel });

    await guardarUsuario(m.usuarioTecnicoId, base({ email: "ana@example.com", roles: ["TECNICO"], rolId: rolPanel, tecnicoId: m.tecnicoId }), control);
    expect(await roles(m.usuarioTecnicoId)).toEqual(["TECNICO"]);
    expect(await fila(m.usuarioTecnicoId)).toMatchObject({ tecnico_id: m.tecnicoId, rol_id: null });
  });

  it("de coordinador + técnico a administrador + técnico, cambiando el técnico", async () => {
    await guardarUsuario(m.adminId, base({ email: "admin@example.com", roles: ["COORDINADOR", "TECNICO"], rolId: rolPanel, tecnicoId: tecnicoLibre }), control);
    expect(await roles(m.adminId)).toEqual(["COORDINADOR", "TECNICO"]);
    // El técnico de Ana queda libre al pasar su cuenta a solo coordinadora.
    await guardarUsuario(m.usuarioTecnicoId, base({ email: "ana@example.com", roles: ["COORDINADOR"], rolId: rolPanel }), control);
    await guardarUsuario(m.adminId, base({ email: "admin@example.com", roles: ["ADMIN", "TECNICO"], tecnicoId: m.tecnicoId }), control);
    expect(await roles(m.adminId)).toEqual(["ADMIN", "TECNICO"]);
    expect(await fila(m.adminId)).toMatchObject({ tecnico_id: m.tecnicoId, rol_id: null });
  });

  it("un técnico ya vinculado a otra cuenta activa no se puede repetir", async () => {
    const e = await guardarUsuario(m.adminId, base({ email: "admin@example.com", roles: ["ADMIN", "TECNICO"], tecnicoId: m.tecnicoId }), control).catch(
      (err: Error) => err.message
    );
    expect(e).toMatch(/uq_usuario_tecnico/);
    // Y la transacción no dejó nada a medias.
    expect(await roles(m.adminId)).toEqual(["ADMIN"]);
    expect((await fila(m.adminId)).tecnico_id).toBeNull();
  });

  it("la lista de usuarios y la cuenta administrada traen los roles", async () => {
    await guardarUsuario(m.adminId, base({ email: "admin@example.com", roles: ["ADMIN", "TECNICO"], tecnicoId: tecnicoLibre }), control);
    const lista = await listarUsuarios();
    expect(lista.find((u) => u.id === m.adminId)?.roles).toEqual(["ADMIN", "TECNICO"]);
    expect(lista.find((u) => u.id === m.usuarioTecnicoId)?.roles).toEqual(["TECNICO"]);
    expect(await leerCuenta(m.adminId)).toMatchObject({ roles: ["ADMIN", "TECNICO"], tecnicoId: tecnicoLibre });
  });

  it("guardar sin roles no llega a la base", async () => {
    await expect(guardarUsuario(m.adminId, base({ email: "admin@example.com", roles: [] }), control)).rejects.toThrow(/al menos un rol/);
    expect(await roles(m.adminId)).toEqual(["ADMIN"]);
  });

  it("los avisos por correo van a las cuentas con panel, también si son técnicas", async () => {
    await guardarUsuario(m.adminId, base({ email: "admin@example.com", roles: ["ADMIN", "TECNICO"], tecnicoId: tecnicoLibre }), control);
    const ids = (
      await consulta<{ id: number }>(
        `SELECT u.id FROM dmc.usuario u
          WHERE u.activo = 1
            AND EXISTS (SELECT 1 FROM dmc.usuario_rol r WHERE r.usuario_id = u.id AND r.rol IN ('ADMIN', 'COORDINADOR'))`
      )
    ).map((f) => Number(f.id));
    expect(ids).toEqual([m.adminId]);
    expect(await mensajeDeError(`SELECT rol FROM dmc.usuario`)).toMatch(/Invalid column name 'rol'|nombre de columna 'rol' no es válido/i);
  });
});
