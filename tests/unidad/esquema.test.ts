import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { adaptarEsquema } from "../../scripts/adaptar-esquema.mjs";
import { GRUPO_CLIENTES, GRUPO_SEGURIDAD, OBJETOS, T, calificado, esquema, grupoDe, type Objeto } from "@/lib/db/esquema";

const RAIZ = resolve(__dirname, "../..");

afterEach(() => {
  delete process.env.DB_SCHEMA;
  delete process.env.DB_SCHEMA_CLIENTES;
  delete process.env.DB_SCHEMA_SEGURIDAD;
});

describe("esquema · resolución desde el entorno", () => {
  it("sin variables usa dmc: un despliegue de este código sigue sirviendo a DMC_Contingencia", () => {
    expect(esquema()).toBe("dmc");
    expect(T.visita).toBe("dmc.visita");
  });

  it("DB_SCHEMA cambia todas las tablas, vistas, la secuencia y los triggers", () => {
    process.env.DB_SCHEMA = "tecnico";
    expect(T.visita).toBe("tecnico.visita");
    expect(T.v_carga_tecnico).toBe("tecnico.v_carga_tecnico");
    expect(T.seq_folio_visita).toBe("tecnico.seq_folio_visita");
    expect(T.tg_visita_cambio).toBe("tecnico.tg_visita_cambio");
  });

  it("se resuelve en cada uso, no al importar: un cambio de entorno se respeta", () => {
    process.env.DB_SCHEMA = "uno";
    expect(T.visita).toBe("uno.visita");
    process.env.DB_SCHEMA = "otro";
    expect(T.visita).toBe("otro.visita");
  });

  it("las tablas de clientes siguen a DB_SCHEMA mientras no haya DB_SCHEMA_CLIENTES", () => {
    process.env.DB_SCHEMA = "tecnico";
    for (const t of GRUPO_CLIENTES) expect(T[t]).toBe(`tecnico.${t}`);
  });

  it("con DB_SCHEMA_CLIENTES solo se mueve ese grupo; lo demás se queda", () => {
    process.env.DB_SCHEMA = "tecnico";
    process.env.DB_SCHEMA_CLIENTES = "cliente";
    expect(T.cliente).toBe("cliente.cliente");
    expect(T.sucursal).toBe("cliente.sucursal");
    expect(T.sucursal_nombre_anterior).toBe("cliente.sucursal_nombre_anterior");
    expect(T.visita).toBe("tecnico.visita");
    expect(T.tecnico).toBe("tecnico.tecnico");
    expect(grupoDe("contacto_cargo")).toBe("clientes");
    expect(grupoDe("visita")).toBe("tecnico");
  });

  it.each(["tec nico", "tecnico.x", "1tecnico", "a;DROP TABLE x", "[tecnico]", "x".repeat(65)])(
    "rechaza un nombre de esquema que no es un identificador simple: %s",
    (malo) => {
      process.env.DB_SCHEMA = malo;
      expect(() => T.visita).toThrow(/DB_SCHEMA/);
    }
  );

  it("rechaza un DB_SCHEMA_CLIENTES inválido", () => {
    process.env.DB_SCHEMA_CLIENTES = "x y";
    expect(() => T.cliente).toThrow(/DB_SCHEMA_CLIENTES/);
  });

  it("un nombre armado en tiempo de ejecución que no existe falla en vez de salir en el SQL", () => {
    expect(() => calificado("no_existe" as Objeto)).toThrow(/objeto conocido/);
    expect(() => (T as Record<string, string>)["visita; DROP TABLE x"]).toThrow(/objeto conocido/);
  });
});

describe("esquema · el registro de objetos", () => {
  const ddl = readFileSync(join(RAIZ, "sql/dmc_contingencia_sqlserver.sql"), "utf8");
  const enElDdl = [...ddl.matchAll(/^\s*CREATE(?:\s+OR\s+ALTER)?\s+(?:TABLE|VIEW|SEQUENCE|TRIGGER)\s+dmc\.([a-z_0-9]+)/gim)].map((m) =>
    m[1].toLowerCase()
  );

  it("el DDL del repo tiene objetos que registrar", () => {
    expect(enElDdl.length).toBeGreaterThan(80);
  });

  it("todo objeto del DDL está en OBJETOS (si una migración crea uno, se agrega a lib/db/esquema.ts)", () => {
    const registrados = new Set<string>(OBJETOS);
    expect(enElDdl.filter((n) => !registrados.has(n))).toEqual([]);
  });

  it("OBJETOS no tiene nombres repetidos ni que ni el DDL ni una migración conozcan", () => {
    expect(new Set(OBJETOS).size).toBe(OBJETOS.length);
    // sucursal_nombre_anterior la crea la migración 033 y el DDL base no la trae.
    const conocidos = new Set(enElDdl);
    for (const archivo of readdirSync(join(RAIZ, "sql")).filter((n) => /^migracion-\d+-.*\.sql$/.test(n) && !n.includes("revertir"))) {
      const texto = readFileSync(join(RAIZ, "sql", archivo), "utf8");
      for (const m of texto.matchAll(/CREATE(?:\s+OR\s+ALTER)?\s+(?:TABLE|VIEW|SEQUENCE|TRIGGER)\s+dmc\.([a-z_0-9]+)/gi)) conocidos.add(m[1].toLowerCase());
    }
    expect(OBJETOS.filter((n) => !conocidos.has(n))).toEqual([]);
  });

  it("todo lo que dicen los grupos clientes y seguridad existe, y ningún objeto está en los dos", () => {
    const registrados = new Set<string>(OBJETOS);
    expect([...GRUPO_CLIENTES, ...GRUPO_SEGURIDAD].filter((n) => !registrados.has(n))).toEqual([]);
    expect(GRUPO_CLIENTES.filter((n) => (GRUPO_SEGURIDAD as readonly string[]).includes(n))).toEqual([]);
  });

  it("cuentas, roles y rastro de seguridad van a `seguridad`, y los clientes a `clientes`, como en DMC_Core", () => {
    process.env.DB_SCHEMA = "tecnico";
    process.env.DB_SCHEMA_CLIENTES = "clientes";
    process.env.DB_SCHEMA_SEGURIDAD = "seguridad";
    expect(T.usuario).toBe("seguridad.usuario");
    expect(T.usuario_rol).toBe("seguridad.usuario_rol");
    expect(T.rol_permiso).toBe("seguridad.rol_permiso");
    expect(T.intento_login).toBe("seguridad.intento_login");
    expect(T.tg_usuario_rol_coherente).toBe("seguridad.tg_usuario_rol_coherente");
    expect(T.sucursal).toBe("clientes.sucursal");
    expect(T.tg_sucursal_actualizado).toBe("clientes.tg_sucursal_actualizado");
    expect(T.visita).toBe("tecnico.visita");
    expect(T.tecnico).toBe("tecnico.tecnico");
    expect(T.v_carga_tecnico).toBe("tecnico.v_carga_tecnico");
    expect(T.seq_folio_visita).toBe("tecnico.seq_folio_visita");
    delete process.env.DB_SCHEMA_SEGURIDAD;
  });

  it("DB_SCHEMA_SEGURIDAD falta → usa DB_SCHEMA; inválida → falla", () => {
    process.env.DB_SCHEMA = "tecnico";
    expect(T.usuario).toBe("tecnico.usuario");
    process.env.DB_SCHEMA_SEGURIDAD = "x;y";
    expect(() => T.usuario).toThrow(/DB_SCHEMA_SEGURIDAD/);
    delete process.env.DB_SCHEMA_SEGURIDAD;
  });
});

describe("esquema · ninguna consulta escribe el esquema a mano", () => {
  // Una consulta con `dmc.tabla` literal ignoraría DB_SCHEMA y rompería en cuanto
  // la base no tenga el esquema dmc. Se ignoran los comentarios.
  function* fuentes(dir: string): Generator<string> {
    for (const nombre of readdirSync(dir)) {
      if (nombre === "node_modules" || nombre === ".next") continue;
      const ruta = join(dir, nombre);
      if (statSync(ruta).isDirectory()) yield* fuentes(ruta);
      else if (/\.(ts|tsx)$/.test(nombre)) yield ruta;
    }
  }

  it("lib, app, components y proxy.ts no contienen <esquema>.<objeto> fuera de comentarios (ni como sinónimo)", () => {
    const objetos = [...OBJETOS].sort((a, b) => b.length - a.length).join("|");
    const patron = new RegExp(`(?<![\\w@.\\-])(?:dmc|tecnico|clientes|seguridad)\\.(?:${objetos})(?![A-Za-z0-9_])`);
    const hallazgos: string[] = [];
    const rutas = ["lib", "app", "components"].flatMap((d) => [...fuentes(join(RAIZ, d))]).concat(join(RAIZ, "proxy.ts"));
    for (const ruta of rutas) {
      readFileSync(ruta, "utf8")
        .split(/\r?\n/)
        .forEach((linea, i) => {
          const t = linea.trim();
          if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") || t.startsWith("{/*")) return;
          const codigo = linea.replace(/\/\/.*$/, "");
          if (patron.test(codigo)) hallazgos.push(`${relative(RAIZ, ruta)}:${i + 1}  ${t.slice(0, 100)}`);
        });
    }
    expect(hallazgos).toEqual([]);
  });
});

describe("adaptarEsquema · scripts SQL escritos para dmc", () => {
  it("cambia los identificadores calificados y los literales del esquema", () => {
    const sql = [
      "IF SCHEMA_ID('dmc') IS NULL EXEC ('CREATE SCHEMA dmc');",
      "CREATE TABLE dmc.visita (id int);",
      "SELECT 1 FROM sys.tables WHERE SCHEMA_NAME(schema_id) = 'dmc';",
      "IF COL_LENGTH('dmc.usuario', 'rol') IS NOT NULL ALTER TABLE dmc.usuario DROP COLUMN rol;",
      "INSERT INTO dmc.schema_version (version) VALUES (45);",
    ].join("\n");
    const r = adaptarEsquema(sql, "tecnico");
    expect(r).toContain("SCHEMA_ID('tecnico')");
    expect(r).toContain("CREATE SCHEMA tecnico");
    expect(r).toContain("CREATE TABLE tecnico.visita");
    expect(r).toContain("SCHEMA_NAME(schema_id) = 'tecnico'");
    expect(r).toContain("COL_LENGTH('tecnico.usuario', 'rol')");
    expect(r).toContain("INSERT INTO tecnico.schema_version");
    expect(r).not.toMatch(/\bdmc\./);
  });

  it("no toca correos ni dominios", () => {
    const r = adaptarEsquema("INSERT INTO dmc.usuario (email) VALUES ('admin@dmc.cl'); -- grupo.dmc.cl", "tecnico");
    expect(r).toContain("'admin@dmc.cl'");
    expect(r).toContain("grupo.dmc.cl");
    expect(r).toContain("INSERT INTO tecnico.usuario");
  });

  it("acepta el marcador $(ESQUEMA) de las migraciones nuevas", () => {
    expect(adaptarEsquema("ALTER TABLE $(ESQUEMA).visita ADD x int;", "tecnico")).toBe("ALTER TABLE tecnico.visita ADD x int;");
  });

  it("cambia el USE solo si se da la base", () => {
    const sql = "USE DMC_Contingencia;\nGO\nSELECT 1;";
    expect(adaptarEsquema(sql, "tecnico")).toContain("USE DMC_Contingencia;");
    expect(adaptarEsquema(sql, "tecnico", { base: "DMC_Core" })).toContain("USE [DMC_Core];");
  });

  it("rechaza un esquema o una base que no sean un identificador", () => {
    expect(() => adaptarEsquema("x", "a b")).toThrow(/inválido/);
    expect(() => adaptarEsquema("x", "tecnico", { base: "a;b" })).toThrow(/inválida/);
  });
});
