import { expect, test } from "@playwright/test";
import { entrarComo } from "./ayuda";
import { hoyISO, sumarDias } from "@/lib/ui/fecha";

// El selector de fechas compartido (components/ui/DatePicker.tsx) en la app de verdad.

test("Visitas: el período se elige con atajos y viaja a la URL con «Ver resultados»", async ({ page }) => {
  await entrarComo(page, "admin");
  await page.goto("/admin/visitas");
  await page.getByRole("button", { name: /^Filtros/ }).click();
  await page.getByLabel("Período").click();
  const dlg = page.getByRole("dialog", { name: "Elegir período" });
  await expect(dlg).toBeVisible();
  await dlg.getByRole("button", { name: "Últimos 7 días" }).click();
  await expect(dlg.getByRole("button", { name: "Últimos 7 días" })).toHaveAttribute("aria-pressed", "true");
  await dlg.getByRole("button", { name: "Aplicar" }).click();
  await expect(dlg).toHaveCount(0);
  await page.getByRole("button", { name: "Ver resultados" }).click();
  const hoy = hoyISO();
  await expect(page).toHaveURL(new RegExp(`desde=${sumarDias(hoy, -6)}.*hasta=${hoy}|hasta=${hoy}.*desde=${sumarDias(hoy, -6)}`));
});

test("Nueva visita: no deja elegir días pasados y Esc cierra el calendario sin cerrar el panel", async ({ page }) => {
  await entrarComo(page, "admin");
  await page.goto("/admin/visitas");
  await page.getByRole("button", { name: "Nueva visita" }).first().click();
  const panel = page.getByRole("dialog", { name: /Nueva visita/ });
  await panel.getByLabel("Fecha", { exact: true }).click();
  const cal = page.getByRole("dialog", { name: "Elegir fecha" });
  await expect(cal).toBeVisible();
  const ayer = sumarDias(hoyISO(), -1);
  // Si ayer cae en el mes anterior, no está a la vista: ese caso lo cubre la prueba de componente.
  const celdaAyer = cal.locator(`[data-dia="${ayer}"]`);
  if (await celdaAyer.count()) await expect(celdaAyer).toBeDisabled();
  await expect(cal.locator(`[data-dia="${hoyISO()}"]`)).toBeEnabled();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await expect(cal).toHaveCount(0);
  await expect(panel).toBeVisible();
});

test("en el celular el calendario se abre como panel inferior", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await entrarComo(page, "admin");
  await page.goto("/admin/visitas");
  await page.getByRole("button", { name: /^Filtros/ }).click();
  await page.getByLabel("Período").click();
  const dlg = page.getByRole("dialog", { name: "Elegir período" });
  const caja = await dlg.boundingBox();
  expect(Math.round(caja!.x)).toBe(0);
  expect(Math.round(caja!.width)).toBe(390);
  expect(Math.round(caja!.y + caja!.height)).toBe(844);
  await page.keyboard.press("Escape");
  await expect(dlg).toHaveCount(0);
});
