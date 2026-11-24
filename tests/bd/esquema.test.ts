import { describe, expect, it } from "vitest";
import { consulta } from "@/lib/data/sql";
import { esquema } from "@/lib/db/esquema";
import { hayBd } from "./_ayuda";

describe.skipIf(!hayBd)("BD de pruebas · esquema creado desde el DDL del repo", () => {
  it("es una base desechable dmc_test_*, nunca la de producción", async () => {
    const [{ nombre }] = await consulta<{ nombre: string }>("SELECT DB_NAME() AS nombre");
    expect(nombre).toMatch(/^dmc_test_[a-z0-9]+$/);
  });

  it("con TEST_DB_MULTIESQUEMA las cuentas viven en `seguridad` y los clientes en `clientes`; la app los encuentra ahí", async () => {
    if (esquema("seguridad") === esquema("tecnico")) return;
    const reales = await consulta<{ esq: string; name: string }>(
      `SELECT SCHEMA_NAME(schema_id) AS esq, name FROM sys.tables WHERE name IN ('usuario', 'cliente', 'visita')`
    );
    expect(reales.map((r) => `${r.esq}.${r.name}`).sort()).toEqual([`${esquema("clientes")}.cliente`, `${esquema("seguridad")}.usuario`, `${esquema("tecnico")}.visita`].sort());
  });

  it("trae las tablas, los defaults, las claves foráneas y los triggers que producción tiene", async () => {
    const [r] = await consulta<{ tablas: number; defaults: number; fks: number; triggers: number }>(`
      SELECT (SELECT COUNT(*) FROM sys.tables WHERE SCHEMA_NAME(schema_id) IN ('${esquema('tecnico')}','${esquema('clientes')}','${esquema('seguridad')}')) AS tablas,
             (SELECT COUNT(*) FROM sys.default_constraints) AS defaults,
             (SELECT COUNT(*) FROM sys.foreign_keys) AS fks,
             (SELECT COUNT(*) FROM sys.triggers WHERE is_ms_shipped = 0) AS triggers`);
    expect(r.tablas).toBeGreaterThan(40);
    expect(r.defaults).toBeGreaterThan(50);
    expect(r.fks).toBeGreaterThan(30);
    expect(r.triggers).toBeGreaterThan(5);
  });
});
