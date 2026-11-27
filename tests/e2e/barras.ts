import { chromium } from "@playwright/test";

// Desborde horizontal con las barras de desplazamiento clásicas de Windows (17 px).
// Playwright sin cabeza oculta las barras con `--hide-scrollbars`; sin esa opción
// Chromium las dibuja y descuenta su ancho de `clientWidth`, como en un Windows real.

export const RUTAS_ADMIN = ["/admin", "/admin/visitas", "/admin/problemas", "/admin/clientes", "/admin/sucursales", "/admin/malls", "/admin/usuarios", "/admin/checklist", "/admin/cuenta"];

export async function desbordesConBarras(opciones: {
  baseURL: string;
  email: string;
  clave: string;
  rutas: string[];
  ventanas: number[];
  zooms: number[];
}): Promise<{ barra: number; fallas: string[] }> {
  const navegador = await chromium.launch({ ignoreDefaultArgs: ["--hide-scrollbars"] });
  const fallas: string[] = [];
  let barra = 0;
  try {
    for (const v of opciones.ventanas)
      for (const z of opciones.zooms) {
        const ctx = await navegador.newContext({ baseURL: opciones.baseURL, viewport: { width: Math.round(v / z), height: Math.round(800 / z) }, deviceScaleFactor: z });
        const page = await ctx.newPage();
        await page.goto("/login");
        await page.getByLabel("Correo").fill(opciones.email);
        await page.getByLabel("Contraseña", { exact: true }).fill(opciones.clave);
        await page.getByRole("button", { name: /Iniciar sesión/ }).click();
        await page.waitForURL(/\/admin/);
        for (const ruta of opciones.rutas) {
          await page.goto(ruta);
          await page.locator(".contenido h1").first().waitFor();
          await page.waitForTimeout(300);
          const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, iw: innerWidth }));
          barra = Math.max(barra, m.iw - m.cw);
          if (m.sw > m.cw) fallas.push(`${ruta} en ventana de ${v}px al ${Math.round(z * 100)}%: scrollWidth ${m.sw} > clientWidth ${m.cw}`);
        }
        await ctx.close();
      }
  } finally {
    await navegador.close();
  }
  return { barra, fallas };
}
