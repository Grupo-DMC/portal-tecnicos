import { expect, test } from "@playwright/test";
import { entrarComo } from "./ayuda";

test.describe("permisos por rol", () => {
  test("el técnico que intenta abrir el panel vuelve a su zona", async ({ page }) => {
    await entrarComo(page, "tecnico");
    for (const ruta of ["/admin", "/admin/visitas", "/admin/usuarios", "/admin/checklist"]) {
      await page.goto(ruta);
      await expect(page, ruta).toHaveURL(/\/tecnico/);
    }
  });

  test("el administrador que abre la zona del técnico vuelve al panel", async ({ page }) => {
    await entrarComo(page, "admin");
    await page.goto("/tecnico");
    await expect(page).toHaveURL(/\/admin/);
  });

  test("los usuarios con un solo rol no ven el botón para cambiar de panel", async ({ page }) => {
    await entrarComo(page, "admin");
    await expect(page.getByRole("button", { name: /panel de técnico/i })).toHaveCount(0);
  });

  test("admin + técnico: entra al panel, pasa al de técnico y vuelve, con la misma sesión", async ({ page }) => {
    await entrarComo(page, "doble");
    await expect(page.getByRole("heading", { name: "Panel de operación" })).toBeVisible();
    await expect(page.getByText(/Estás en el panel de administración/i)).toBeVisible();

    // Mientras está en el panel, la zona del técnico no se abre por la dirección.
    await page.goto("/tecnico");
    await expect(page).toHaveURL(/\/admin/);

    await page.getByRole("button", { name: "Ir al panel de técnico" }).first().click();
    await expect(page).toHaveURL(/\/tecnico/);
    await expect(page.getByText("Panel de técnico", { exact: true })).toBeVisible();

    // Trabajando como técnico, el panel no se abre por la dirección.
    for (const ruta of ["/admin", "/admin/usuarios"]) {
      await page.goto(ruta);
      await expect(page, ruta).toHaveURL(/\/tecnico/);
    }

    await page.getByRole("button", { name: "Volver al panel de admin" }).click();
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByRole("heading", { name: "Panel de operación" })).toBeVisible();
  });

  test("en el celular, el botón de cambiar de panel está en el cajón del menú", async ({ page }) => {
    // Como en la demo: la barra de arriba solo lleva hamburguesa, logo y campana.
    await page.setViewportSize({ width: 375, height: 740 });
    await entrarComo(page, "doble");
    await page.getByRole("button", { name: "Abrir el menú" }).click();
    const boton = page.getByRole("button", { name: "Ir al panel de técnico" }).first();
    await expect(boton).toBeVisible();
    await boton.click();
    await expect(page).toHaveURL(/\/tecnico/);
    await expect(page.getByRole("button", { name: "Volver al panel de admin" })).toBeVisible();
    // Sin desborde horizontal.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("el coordinador entra al panel pero no ve lo que es solo del administrador", async ({ page }) => {
    await entrarComo(page, "coordinador");
    await expect(page.getByRole("heading", { name: "Panel de operación" })).toBeVisible();
    // «Roles y permisos» (usuarios.roles) no forma parte del rol Coordinador.
    await page.goto("/admin/usuarios");
    await expect(page.getByRole("button", { name: /Nuevo rol/i })).toHaveCount(0);
  });

  test("las rutas de evidencia exigen sesión y un técnico no ve la de otro", async ({ page, request }) => {
    expect((await request.get("/api/visita/foto/1")).status()).toBe(401);
    expect((await request.get("/api/visita/video/1")).status()).toBe(401);
    await entrarComo(page, "tecnico");
    expect((await page.request.get("/api/visita/foto/999999")).status()).toBe(404);
  });
});
