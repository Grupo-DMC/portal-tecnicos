---
version: 1
slug: "app-layout-tsx"
primary_target: "app/layout.tsx"
related_targets: ["app/globals.css"]
---

Scope: whole app (admin panel `/admin/*` and technician app `/tecnico/*`). Mode: Operate.
Audience and job: see PRODUCT.md. Constraint: rebrand on the incumbent world, not a new world.

## Direction contract

THESIS: Keep the incumbent square-cornered Modernist operating world; the brand becomes the logo's purple, and alarm meaning lives in its own red so purple never signals danger and red never signals progress. Refuses the category default of a soft rounded SaaS dashboard with tinted cards.

OWN-WORLD: Cool violet-tinted near-white ground (#f4f3f5), near-black ink (#1f1c21), flat ruled panels, radius 0, 800-weight Fira Sans headings with tight tracking. Purple #762282 only on primary actions, selection (nav, tabs, ranges, chosen options) and "en curso"; purple-500 #8f4a9a for planned states; red #c4260d only for errors, open problems, pending visits and overdue. Fira Code (cv11, unslashed zero) only on figures.

STORY: The coordinator scans the day and sees, by colour alone, what is moving (purple) and what is wrong (red); the technician sees today's stores first and acts with a thumb.

FIRST VIEWPORT: Admin: sticky header with the page title at left and actions at right, KPI row of four ruled cells with Fira Code figures, then two-column panels. Technician: greeting h1, date and identity in one muted line, three-figure stat row, then today's stores grouped by mall.

FORM: Incumbent Modernist operating world, kept; no new form. seed: none (owner-pinned refinement, no roll: the owner fixed palette and type — «usa los colores morados porfa», «usa la tipográfica que te recomienda» — on the existing world).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- Panel "Cumplimiento vs programado" on Hoy shows a single bar; a per-technician or per-hour view is a candidate.
- Acta header: six equal-weight buttons; grouping downloads is a candidate.
- Date formats differ by screen (ISO in tables, dd-mm-aaaa in edit acta, "2 nov 2026" in reagendas).
