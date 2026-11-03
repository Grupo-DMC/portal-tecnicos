---
name: DMC Contingencia
description: Sistema de técnicos en terreno y panel de coordinación de Grupo DMC
colors:
  accent: "#762282"
  accent-hover: "#661d71"
  accent-active: "#571862"
  accent-100: "#f6eef7"
  accent-200: "#ecdcee"
  accent-300: "#dcc1df"
  accent-400: "#c69dc8"
  accent-500: "#8f4a9a"
  accent-800: "#4a1453"
  accent-900: "#2e0c34"
  danger: "#c4260d"
  danger-100: "#fdeeeb"
  danger-200: "#f9dcd6"
  danger-400: "#e0705e"
  danger-800: "#7c1405"
  bg: "#f4f3f5"
  surface: "#ebe9ed"
  surface-2: "#e9e6eb"
  surface-3: "#f9f7fa"
  canvas: "#cac7cd"
  text: "#1f1c21"
  muted: "#5f5b63"
  line: "#d7d4da"
  line-soft: "#e3e1e5"
  line-control: "#a8a4ad"
  divider: "rgba(31, 28, 33, 0.22)"
  divider-soft: "rgba(31, 28, 33, 0.16)"
  divider-faint: "rgba(31, 28, 33, 0.12)"
  neutral-100: "#f9f7fa"
  neutral-200: "#e9e6eb"
  neutral-300: "#d6d3d9"
  neutral-400: "#b9b5bd"
  neutral-500: "#9a969e"
  neutral-600: "#7c7880"
  neutral-700: "#5f5b63"
  neutral-800: "#433f46"
  neutral-900: "#2c292e"
  white: "#ffffff"
typography:
  cap:
    fontFamily: "Fira Sans, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.35
  meta:
    fontFamily: "Fira Sans, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
  ui:
    fontFamily: "Fira Sans, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  body:
    fontFamily: "Fira Sans, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
    fontFeature: "\"tnum\""
  lead:
    fontFamily: "Fira Sans, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 800
    lineHeight: 1.3
  h3:
    fontFamily: "Fira Sans, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 800
    lineHeight: 1.2
  h2:
    fontFamily: "Fira Sans, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  h1:
    fontFamily: "Fira Sans, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 800
    lineHeight: 1.08
    letterSpacing: "-0.03em"
  display:
    fontFamily: "Fira Code, ui-monospace, monospace"
    fontSize: "40px"
    fontWeight: 700
    lineHeight: 1.04
    letterSpacing: "-0.03em"
    fontFeature: "\"cv11\", \"tnum\""
  hero:
    fontFamily: "Fira Code, ui-monospace, monospace"
    fontSize: "56px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.03em"
    fontFeature: "\"cv11\", \"tnum\""
  data:
    fontFamily: "Fira Code, ui-monospace, monospace"
    fontWeight: 400
    letterSpacing: "-0.02em"
    fontFeature: "\"cv11\", \"tnum\""
rounded:
  none: "0px"
spacing:
  control-x: "16px"
  input-x: "12px"
  cell: "10px 8px"
  field-gap: "16px"
  header-x-desktop: "28px"
  header-x-mobile: "16px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.white}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: "42px"
    typography: "{typography.ui}"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-primary-active:
    backgroundColor: "{colors.accent-active}"
  button-primary-disabled:
    backgroundColor: "{colors.neutral-300}"
    textColor: "{colors.neutral-700}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: "42px"
  button-ghost:
    textColor: "{colors.accent-active}"
    padding: "0 4px"
  button-ghost-hover:
    backgroundColor: "{colors.accent-100}"
  input:
    backgroundColor: "{colors.white}"
    textColor: "{colors.text}"
    rounded: "{rounded.none}"
    padding: "8px 12px"
    height: "42px"
  input-disabled:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
  tag-accent:
    backgroundColor: "{colors.accent-100}"
    textColor: "{colors.accent-800}"
    rounded: "{rounded.none}"
    padding: "3px 9px"
    typography: "{typography.cap}"
  tag-danger:
    backgroundColor: "{colors.danger-100}"
    textColor: "{colors.danger-800}"
    padding: "3px 9px"
  tag-neutral:
    backgroundColor: "{colors.neutral-200}"
    textColor: "{colors.neutral-800}"
    padding: "3px 9px"
  tag-outline:
    backgroundColor: "transparent"
    textColor: "{colors.accent-active}"
    padding: "3px 9px"
  tag-dark:
    backgroundColor: "{colors.text}"
    textColor: "{colors.bg}"
    padding: "3px 9px"
  seg-option:
    height: "38px"
    padding: "0 14px"
  nav-item:
    textColor: "{colors.neutral-800}"
    height: "44px"
    padding: "0 20px"
    typography: "{typography.ui}"
  nav-item-active:
    backgroundColor: "{colors.accent-200}"
    textColor: "{colors.accent-800}"
  nav-badge-pending:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.white}"
    height: "20px"
    typography: "{typography.cap}"
  menu-actions:
    backgroundColor: "{colors.bg}"
    rounded: "{rounded.none}"
    width: "260px"
  menu-actions-item:
    textColor: "{colors.text}"
    padding: "12px 14px"
    typography: "{typography.ui}"
  menu-actions-item-hover:
    backgroundColor: "{colors.accent-100}"
---

# Design System: DMC Contingencia

## Overview

**Creative North Star: "La planilla de turno"**

Un mundo operativo modernista de esquinas rectas: fondo casi blanco apenas teñido de violeta, tinta casi negra, paneles planos separados por reglas y no por sombras. Es una herramienta de trabajo para dos personas distintas: la coordinación que escanea el día en el escritorio y el técnico que actúa con el pulgar, de pie dentro de una tienda. La densidad es alta en el panel y generosa en el celular, pero el lenguaje es el mismo.

El color es información, no decoración. El morado del logo de Grupo dMC marca la acción principal, la selección y lo que está en curso; un morado medio marca lo planificado; el rojo de alarma vive aparte y solo dice "esto está mal o atrasado". Así el coordinador ve, solo por color, qué se mueve (morado) y qué falla (rojo). Los títulos van en Fira Sans 800 con tracking ceñido; las cifras, en Fira Code con el cero sin barra.

Rechaza el tablero SaaS por defecto: nada de tarjetas redondeadas con tinte, sombras difusas ni degradados.

**Key Characteristics:**
- Radio 0 en toda la interfaz.
- Profundidad por reglas (líneas de 1 y 2 px) y escalones tonales, no por sombras.
- Un acento (morado #762282) y una alarma (rojo #c4260d) con significados que no se cruzan.
- Fira Sans para todo el texto; Fira Code solo para cifras y datos, en una escala de diez pasos con nombre.
- Grises fríos teñidos hacia el violeta del logo.

## Colors

Un acento morado con su escala propia, una alarma roja separada y neutros fríos teñidos de violeta.

### Primary
- **Morado dMC** (accent): el morado exacto del «MC» del logo. Botón primario, foco, cursor de texto, `accent-color` nativo, selección (pestaña del celular, opciones marcadas, segmentos, rangos), barras de avance bajo la meta y el estado "En curso". Texto blanco encima: 9:1.
- **Morado presionado / hover** (accent-hover, accent-active): estados del botón primario; accent-active es también el color de enlaces y del botón fantasma.
- **Morado medio** (accent-500): estados planificados: visita reagendada, problema agendado o en espera de repuesto. 4.9:1 sobre el fondo.
- **Lila dMC** (accent-400): el lila de la «d» del logo; tono claro de la escala.
- **Lavandas** (accent-100, accent-200, accent-300): fondo del tag de acento y hover de botón fantasma e ítems de menú (100); fila activa de la barra lateral y selección de texto (200).
- **Ciruela profunda** (accent-800, accent-900): texto sobre lavanda (tag de acento, ítem activo de navegación) y sobre la selección de texto.

### Secondary
- **Rojo alarma** (danger): solo errores, problemas abiertos, visitas pendientes, atrasos y el contador de pendientes de la navegación (con texto blanco). Nunca decoración ni marca.
- **Escala de alarma** (danger-100, danger-200, danger-400, danger-800): tag de alarma (100 de fondo, 800 de texto) y mensajes de error de campo (800).

### Neutral
- **Papel violáceo** (bg): fondo de página y de toda columna, diálogo, menú y hoja.
- **Superficies** (surface, surface-2, surface-3): tarjetas de visita del celular, cabeceras de bloque y campos deshabilitados (surface); áreas de escritura largas y listas de casillas (surface-3).
- **Lienzo** (canvas): el gris detrás de la columna móvil de 460 px y del body.
- **Tinta** (text): texto, tag oscuro "Completada", borde de diálogo, menú y hoja, barras de avance que alcanzan la meta y la marca de meta.
- **Gris legible** (muted): texto secundario, detalle de ítems de menú, etiquetas de campo y cabeceras de tabla. 5.5:1 sobre surface, 6:1 sobre bg.
- **Líneas** (line, line-soft, line-control): tres pasos: filas de tabla e ítems de menú (line), separaciones suaves (line-soft) y bordes de controles: input, botón secundario, control segmentado (line-control).
- **Divisores** (divider, divider-soft, divider-faint): tinta a 22 / 16 / 12 % para reglas estructurales de 2 px (cabeceras, barra lateral, barra de pestañas) y separadores internos.
- **Escala neutra** (neutral-100 a neutral-900): estados programados y cancelados (500 / 400), botones deshabilitados (300 / 700 en el primario de clase; 500 en los botones de confirmar del celular), tag neutro (200 / 800), texto de ítems de navegación en reposo (800), barra de desplazamiento (400).

### Named Rules
**The Two Meanings Rule.** El morado dice "acción, selección, en curso, planificado"; el rojo dice "mal, pendiente o atrasado". El morado nunca señala peligro y el rojo nunca señala avance.

**The Status Map Rule.** El color de cada estado sale de `lib/ui/estado.ts` y de ningún otro lado: Programada neutral-500 / tag neutro; En curso accent / tag de acento; Completada tinta / tag oscuro; Pendiente danger / tag de alarma; Reagendada accent-500 / tag de contorno; Canceladas neutral-400 y neutral-500 / tag neutro. Problemas: Abierto danger, intermedios accent-500 (tag de contorno), Resuelto tinta.

**The Selection Is Purple Rule.** Todo lo elegido (navegación, pestañas, opciones de casillas, segmentos, texto seleccionado) usa la escala morada, no la tinta ni el rojo.

## Typography

**Display Font:** Fira Sans (con system-ui, sans-serif), pesos 400 a 800, servida por next/font.
**Body Font:** Fira Sans.
**Label/Mono Font:** Fira Code variable (300 a 700), autoalojada en `app/fonts/FiraCode-VF.woff2` (OFL), con `cv11` (cero sin barra).

**Character:** Una humanista de lectura clara en pantallas pequeñas, cerrada a 800 en los títulos, y su par monoespaciado solo para cifras: las dos de la misma familia, así que los datos no rompen la voz.

### Hierarchy
Diez pasos con nombre, cada uno con su interlineado (`text-cap` … `text-hero`). Pasos de 1px abajo, donde se lee de cerca (12–15), y de ~1.25 arriba, donde se ve de lejos (17 → 56).
- **Hero** (56px, 1): la cifra protagonista del panel (cumplimiento del período), en Fira Code 700, -0.03em.
- **Display** (40px, 1.04): cifras KPI del panel en Fira Code 700, -0.03em; el folio del acta en escritorio.
- **H1** (30px, 1.08): títulos de página en escritorio y del celular (saludo del técnico, "Mis visitas"); cifras de la fila de estadísticas del técnico y KPI en celular.
- **H2** (24px, 1.15): títulos de página en celular; la cabecera usa H2 → H1 desde 768px, 800 con -0.03em.
- **H3** (20px, 1.2): hora de la tarjeta de visita y subtítulos.
- **Lead** (17px, 1.3): títulos de tarjeta, hoja y panel, en 800.
- **Body** (15px, 1.55): texto corrido; cifras tabulares en todo el body.
- **UI** (14px, 1.45): botones, tablas, campos, ítems de navegación y de menú. Inputs a 16px en celular para que iOS no acerque la pantalla.
- **Meta** (13px, 1.45): datos secundarios, etiquetas de campo, segmentos, línea de metadatos de las tarjetas.
- **Cap** (12px, 1.35): tags, cabeceras de tabla, contadores, detalle de ítems de menú. Sin mayúsculas ni tracking abierto.

### Named Rules
**The Named Step Rule.** Todo tamaño de texto es uno de los diez pasos; no hay `text-[Npx]` sueltos ni la escala genérica de Tailwind.

**The Figures Only Rule.** Fira Code se usa solo a través de la clase de cifras, y solo en números y datos. Títulos y texto van siempre en Fira Sans.

**The Tabular Rule.** Todo el body lleva `font-variant-numeric: tabular-nums`: folios, horas, conteos y KPI no bailan cuando cambian.

**The Chilean Date Rule.** Toda fecha numérica que lee una persona va en dd/mm/aaaa (02/11/2026), y con hora como "24/08/2026 · 14:35", en pantalla y en el PDF del acta. Los encabezados de día usan la fecha larga en palabras ("lunes, 2 de noviembre"). ISO queda solo en URLs, inputs y la base.

## Layout

El panel de coordinación es barra lateral pegajosa + contenido. La cabecera de página es pegajosa en escritorio (≥1024px), con el título a la izquierda, las acciones a la derecha y una regla de 2px abajo; relleno de 28px horizontal en escritorio y 16px en celular. Debajo: fila de KPI en celdas regladas y paneles en dos columnas. En celular la barra lateral se convierte en cajón (ancho `min(290px, 86vw)`) con una barra superior de 56px.

La app del técnico es una columna de máximo 460px centrada sobre el lienzo gris, con cabecera pegajosa arriba y tres pestañas pegajosas abajo (60px de alto). Hojas inferiores y diálogos ocupan ese mismo ancho; el diálogo de formulario del panel mide 720px, con campos en dos columnas (una en celular) separados por 16px.

Las tablas del panel se apilan en celular (<768px): cada fila pasa a una grilla de cuatro columnas (selección, datos, estado, ver) sin desplazamiento horizontal. Objetivos táctiles de 40–44px; botones de icono de 40px.

## Elevation & Depth

Plano por defecto. La profundidad se construye con reglas: 2px de divisor para la estructura (cabecera, barra lateral, pestañas, encabezado de hoja y diálogo), 1px para filas y controles, y un borde de 2px en tinta para lo que flota encima (diálogo, hoja, cajón lateral, menú de acciones). Los escalones tonales (bg → surface → surface-3, blanco para inputs) separan lo que se llena de lo que se lee. Lo modal se apoya en un velo de tinta semitransparente (rgba(31,28,33,…)), no en sombra.

### Shadow Vocabulary
- **Lista desplegable** (`box-shadow: 0 6px 18px rgba(0,0,0,.18)`): las listas flotantes de los selectores con búsqueda y múltiples.
- **Menú de acciones** (`box-shadow: 0 8px 24px rgba(31,28,33,.14)`): el menú que abre Descargar / Editar, siempre junto a su borde de 2px en tinta.

### Named Rules
**The Ruled Not Lifted Rule.** Un panel se separa con una regla o un cambio de superficie, nunca con una sombra. Solo lo que se despliega sobre el contenido (listas y menús) lleva sombra, y lo que flota lleva borde de 2px en tinta.

## Shapes

Esquinas rectas en todo: botones, inputs, tags, diálogos, menús, hojas, tarjetas y segmentos tienen radio 0. Los únicos círculos son puntos de estado (indicador de señal, grabación) y marcadores numéricos pequeños. Los bordes son el principal recurso de forma: 1px para controles, 2px para estructura y para los cuadros de casilla dibujados con `currentColor`. Los iconos son SVG de trazo (2–2.4px) a 14–22px.

### Named Rules
**The Status Edge Rule.** Una franja izquierda de 4px, del color de su estado, aparece solo en filas y tarjetas de estado (tarjetas de visita del celular, filas de problemas y pendientes). No se usa como adorno ni como marca de selección.

## Components

### Buttons
Contundentes y planos: peso 800, cuadrados, un leve hundimiento al presionar.
- **Shape:** esquinas rectas (0px), alto mínimo 42px (40px en barras de herramientas), relleno horizontal 16px, separación 8px entre icono y texto.
- **Primary:** fondo morado dMC con texto blanco, paso UI en 800. Uno por grupo de acciones.
- **Hover / Focus:** hover a accent-hover, presionado a accent-active y escala 0.96; transición de 150ms con la curva `cubic-bezier(0.22, 1, 0.36, 1)`. Foco: contorno de 2px morado a 2px de distancia.
- **Disabled:** el primario pasa a neutral-300 con texto neutral-700 (no a transparencia); el resto baja a 0.55 de opacidad.
- **Secondary:** transparente, borde line-control; en hover un velo de tinta al 6 % y borde en tinta.
- **Ghost:** texto accent-active subrayado (subrayado al 35 %), peso 600; en hover fondo accent-100 y subrayado pleno. También es el enlace de vuelta de una barra de herramientas.
- **Icon:** cuadrado de 40px sin relleno.

### Menú de acciones
Agrupa acciones hermanas detrás de un botón secundario con chevrón (que gira al abrir).
- **Panel:** alineado a la derecha, 4px bajo el botón, mínimo 260px, fondo bg, borde de 2px en tinta y la sombra de menú; entra como el diálogo (8px, 200ms).
- **Ítems:** icono a la izquierda, texto en paso UI semibold y detalle opcional en paso Cap gris legible; separados por reglas line; hover accent-100.
- **Comportamiento:** se cierra al elegir, con Escape o al tocar fuera. Un menú de una sola acción se pinta como botón secundario simple.

### Chips
- **Style:** tag cuadrado, paso Cap en 600, relleno 3px 9px, en cinco variantes: acento (lavanda + ciruela), alarma (rojo claro + rojo profundo), neutro, contorno (borde morado de 1px + texto accent-active) y oscuro (tinta + papel).
- **State:** la variante la decide el mapa de estados; el toggle Activo/Inactivo usa tag de acento para el elegido y neutro para el otro. Los tags se reservan para estados y roles, no para metadatos.

### Cards / Containers
- **Corner Style:** 0px.
- **Background:** surface en tarjetas de visita y cabeceras de bloque; bg en paneles; surface-3 en listas de casillas.
- **Shadow Strategy:** ninguna (ver Elevation & Depth).
- **Border:** 1px divider; las tarjetas de estado llevan además la franja de 4px.
- **Internal Padding:** 14px en tarjetas del celular; 16–22px en diálogos.

### Tarjeta de visita (celular)
Hora en H3 800, folio en Cap gris y el tag de estado a la derecha; sucursal en Lead 800; cliente y dirección en Meta gris. Los metadatos (motivos, "hasta el…", ayudante, quien recibe) van en una sola línea de texto Meta unida con " · " y cortada con "…", sin chips con borde. El único tag extra es el rol "Ayudante" (tag oscuro).

### Inputs / Fields
- **Style:** fondo blanco sobre el papel, borde 1px line-control, radio 0, 42px de alto, relleno 8px 12px, cursor de texto morado. Etiqueta arriba en Meta 600 gris legible. Textarea desde 90px.
- **Focus:** borde morado más el contorno de foco de 2px. Hover: borde neutral-700.
- **Error / Disabled:** mensaje de error en Cap danger-800 bajo el campo; deshabilitado en surface con texto muted.

### Navigation
- **Escritorio:** barra lateral con logo, grupos "Operación" y "Maestros" en Cap gris, ítems de 44px en UI 800 con su conteo en cifras a la derecha. En reposo, texto neutral-800 y hover con velo de tinta al 5 %; el activo pinta la fila entera en accent-200 con texto accent-800 y `aria-current="page"`, sin franja. Lo que espera atención se cuenta en un contador danger con texto blanco.
- **Celular (técnico):** tres pestañas abajo de 60px; la activa lleva una barra superior de 3px morada y opacidad plena, las demás 0.6.
- **Segmentos:** el control segmentado tiene borde line-control, opciones de 38px en Meta 600 separadas por reglas de 1px.

### Tabla
- Cabecera en Cap 600 gris legible con una sola línea fuerte (line-control) debajo; filas en UI con relleno 10px 8px y regla line; hover con velo de tinta al 4 %. En celular, apilada en grilla (ver Layout).

### Cabecera del acta
Barra de herramientas: a la izquierda el enlace fantasma "Visitas"; a la derecha Trazabilidad, los menús Descargar (PDF, fotos y videos) y Editar (editar acta, permitir al técnico), y al final la única acción primaria que corresponda al estado. Debajo, el folio como h1 (H1 → Display) con el tag de estado al lado, y bajo ellos la línea de metadatos y la de fecha.

### Cumplimiento por técnico (panel)
En la vista Hoy, una fila por técnico: nombre, "N de M" cerradas en Meta gris y una barra de avance con una marca de 1px en tinta en la meta interna (92 %). La barra va en morado bajo la meta y en tinta al alcanzarla. Cada fila abre las visitas de ese técnico y ese día. La tabla de carga por técnico aparece solo en Semana y Mes.

### Celda KPI
Celda reglada con etiqueta en Meta gris y la cifra en Display (Hero para la protagonista) en Fira Code. Cada cifra lleva a las visitas que la forman. "Esperan nueva fecha" cuenta todo lo reagendado y pendiente (el mismo número que la barra lateral) y su sublínea dice cuántas eran del período.

### Hoja inferior (celular)
Entra desde abajo (24px, 280ms) y sale más corta (16px, 200ms); borde superior de 2px en tinta, encabezado pegajoso con título en Lead 800 y cierre solo por la X.

### Diálogo de formulario (panel)
720px, borde de 2px en tinta, entra 8px hacia arriba en 200ms; cabecera con título 800, campos en dos columnas y pie con Cancelar (secundario) y la acción principal. Solo se cierra con la X.

## Do's and Don'ts

### Do:
- **Do** usar el morado dMC (#762282) para la acción principal, el foco y todo lo seleccionado.
- **Do** tomar el color y la variante de tag de cada estado de `lib/ui/estado.ts`.
- **Do** reservar el rojo (#c4260d) para errores, problemas abiertos, visitas pendientes, atrasos y contadores de lo que espera atención.
- **Do** usar solo los diez pasos de la escala de tipo, y las cifras (KPI, conteos, folios, horas) en Fira Code a través de la clase de cifras.
- **Do** mostrar las fechas numéricas en dd/mm/aaaa y las fechas con hora como "dd/mm/aaaa · hh:mm".
- **Do** agrupar acciones hermanas en un menú de acciones y dejar una sola acción primaria por barra.
- **Do** separar paneles con reglas de 1px y 2px y escalones de superficie; radio 0 en todo.
- **Do** animar solo opacidad y desplazamientos cortos con la curva `cubic-bezier(0.22, 1, 0.36, 1)` en 150 / 200 / 280ms, y respetar la preferencia de menos movimiento.

### Don't:
- **Don't** usar el rojo como color de marca o decoración, ni el morado para señalar peligro.
- **Don't** redondear esquinas ni separar tarjetas con sombras; las únicas sombras son las de listas desplegables y menús.
- **Don't** poner etiquetas en mayúsculas con tracking abierto encima de los títulos.
- **Don't** usar franjas izquierdas fuera de las filas y tarjetas de estado, ni para marcar el ítem activo.
- **Don't** mostrar fechas ISO a las personas ni usar tamaños de texto fuera de la escala.
- **Don't** convertir metadatos en chips con borde; van como una línea de texto unida con " · ".
- **Don't** usar Fira Code en títulos o texto corrido.
- **Don't** escribir colores sueltos en los componentes; usar los tokens de `app/globals.css`.
