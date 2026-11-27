import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { despachar } = vi.hoisted(() => ({ despachar: vi.fn() }));
// La ruta limpia en los primeros 10 minutos de cada hora: la simulación devuelve una promesa.
vi.mock("@/lib/data/correo-avisos", () => ({ despacharCorreos: despachar, limpiarCorreos: vi.fn(async () => {}) }));

import { GET } from "@/app/api/cron/correos/route";

const VARS = ["CRON_SECRET", "AVISOS_CORREO_ACTIVO", "RESEND_API_KEY", "CORREO_REMITENTE", "CORREO_AVISOS_REMITENTE", "APP_URL"];
const pedir = (token?: string) =>
  new NextRequest("https://app.test/api/cron/correos", token ? { headers: { authorization: `Bearer ${token}` } } : {});

describe("GET /api/cron/correos", () => {
  const antes: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const v of VARS) {
      antes[v] = process.env[v];
      delete process.env[v];
    }
    despachar.mockReset();
  });
  afterEach(() => {
    for (const v of VARS) {
      if (antes[v] === undefined) delete process.env[v];
      else process.env[v] = antes[v];
    }
  });

  it("sin CRON_SECRET la ruta no existe", async () => {
    expect((await GET(pedir("x"))).status).toBe(404);
  });

  it("con otro token, 401", async () => {
    process.env.CRON_SECRET = "secreto-de-prueba";
    expect((await GET(pedir("otro"))).status).toBe(401);
    expect((await GET(pedir())).status).toBe(401);
  });

  it("apagado no despacha nada", async () => {
    process.env.CRON_SECRET = "secreto-de-prueba";
    process.env.RESEND_API_KEY = "re_x";
    process.env.CORREO_REMITENTE = "Avisos <avisos@ejemplo.cl>";
    process.env.APP_URL = "https://visitas.ejemplo.cl";
    const r = await GET(pedir("secreto-de-prueba"));
    expect(await r.json()).toEqual({ ok: true, activo: false });
    expect(despachar).not.toHaveBeenCalled();
  });

  it("encendido pero sin APP_URL tampoco despacha", async () => {
    process.env.CRON_SECRET = "secreto-de-prueba";
    process.env.AVISOS_CORREO_ACTIVO = "true";
    process.env.RESEND_API_KEY = "re_x";
    process.env.CORREO_REMITENTE = "Avisos <avisos@ejemplo.cl>";
    const r = await GET(pedir("secreto-de-prueba"));
    expect(await r.json()).toEqual({ ok: true, activo: false });
    expect(despachar).not.toHaveBeenCalled();
  });

  it("encendido y completo, despacha", async () => {
    process.env.CRON_SECRET = "secreto-de-prueba";
    process.env.AVISOS_CORREO_ACTIVO = "true";
    process.env.RESEND_API_KEY = "re_x";
    process.env.CORREO_AVISOS_REMITENTE = "Avisos <avisos@avisos.ejemplo.cl>";
    process.env.APP_URL = "https://visitas.ejemplo.cl/";
    despachar.mockResolvedValue({ enviados: 2, errores: 0, descartados: 1 });
    const r = await GET(pedir("secreto-de-prueba"));
    expect(await r.json()).toEqual({ ok: true, activo: true, enviados: 2, errores: 0, descartados: 1 });
    expect(despachar.mock.calls[0][0]).toMatchObject({
      remitente: "Avisos <avisos@avisos.ejemplo.cl>",
      urlBase: "https://visitas.ejemplo.cl",
    });
  });
});
