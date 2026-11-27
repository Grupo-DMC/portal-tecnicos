import { render } from "@testing-library/react";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Cada ruta muestra, mientras carga, una silueta con la forma de su pantalla (components/ui/esqueletos.tsx):
// sin el texto «Cargando…» y avisando a los lectores de pantalla con aria-busy.
const RAIZ = join(__dirname, "../..");
function loadings(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? loadings(p) : n === "loading.tsx" ? [p] : [];
  });
}
const archivos = loadings(join(RAIZ, "app"));

describe("siluetas de carga", () => {
  it("hay una por pantalla del panel y del técnico", () => {
    const rutas = archivos.map((f) => relative(join(RAIZ, "app"), f).replace(/\\/g, "/"));
    for (const r of [
      "admin/loading.tsx",
      "admin/visitas/loading.tsx",
      "admin/visitas/[folio]/loading.tsx",
      "admin/problemas/loading.tsx",
      "admin/clientes/loading.tsx",
      "admin/clientes/[id]/loading.tsx",
      "admin/sucursales/loading.tsx",
      "admin/sucursales/[id]/loading.tsx",
      "admin/malls/loading.tsx",
      "admin/malls/[id]/loading.tsx",
      "admin/usuarios/loading.tsx",
      "admin/checklist/loading.tsx",
      "admin/cuenta/loading.tsx",
      "tecnico/loading.tsx",
      "tecnico/visitas/loading.tsx",
      "tecnico/visitas/[folio]/loading.tsx",
      "tecnico/visitas/[folio]/formulario/loading.tsx",
      "tecnico/perfil/loading.tsx",
    ])
      expect(rutas).toContain(r);
  });

  for (const f of archivos) {
    it(`${relative(RAIZ, f).replace(/\\/g, "/")}: silueta sin texto y con aria-busy`, async () => {
      const { default: Loading } = (await import(/* @vite-ignore */ f)) as { default: () => React.ReactElement };
      const { container } = render(<Loading />);
      expect(container.textContent?.trim()).toBe("");
      expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
      expect(container.innerHTML).not.toMatch(/Cargando/i);
    });
  }
});
