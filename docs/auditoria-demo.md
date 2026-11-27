# Auditoría: demo `panel-operacion.html` frente a React

Fuente de verdad: `C:\Users\EQUIPO\Downloads\panel-operacion.html`. Fecha: 2026-11-26.

**Capturas.** Están en `docs/capturas/<seccion>-{demo|react}-{1440|390}.png`.
- Demo: `node scripts/capturas-demo.mjs`.
- React: `CAPTURAS_DEMO=1 npx playwright test capturas`, contra la base E2E desechable.

**Datos de las capturas.** React se capturó con la siembra E2E (1 cliente, 3 visitas), así que se ve más vacío que la demo. Esa diferencia no se cuenta como desvío; solo cuentan el markup, los bloques y el comportamiento.

**Leyenda:**
- ✅ igual
- ⚠️ distinto (se dice en qué)
- ❌ falta en React
- ➕ React tiene algo que la demo no tiene (se cuenta como ⚠️)

**Desvíos pedidos que no se cuentan:**
- la demo usa `<input type="date">` y React usará el `DatePicker`;
- la demo muestra «Cargando…» o nada, y React usará skeletons;
- la demo tiene subtítulos explicativos, y React los quita.

---

## 0. Layout general y menú lateral — ✅ cerrada (etapa 1, 2026-11-27)

Capturas: `docs/capturas/menu/menu-<ventana>-z<zoom>.png` (React) y `…-demo.png` (demo), a 1200/1280/1366/1440/1920 px con zoom 100/110/125 %. Antes: `docs/capturas/antes/`.

| Punto | Estado |
|---|---|
| Columna `.app`: 272 px + `minmax(0,1fr)`, fondo blanco del menú hasta el final de la página | ✅ (`.dmc-marco` en CSS; antes era una grilla de Tailwind con otro corte) |
| Menú de alto completo (100dvh), sticky, pegado al borde; desplazamiento dentro de `.nav` | ✅ (verificado en `tests/e2e/layout.spec.ts` a 11 anchos CSS) |
| Contenido en todo el ancho restante, `.wrap` de 1560 px a la izquierda con el padding de la demo | ✅ Panel (`.pv-wrap` iba centrado a 1240), Checklist (`.wrap.ck` a 1060) y Mi cuenta (1120) ahora usan el mismo ancho |
| Pie «Grupo DMC, Ideas Tecnológicas de Seguridad.» | ✅ |
| Logo de la demo (561×199, 36 px de alto; 28 px en la barra) | ✅ `public/dmc-logo-menu.png` (antes otro archivo, más chico) |
| «Sistema de técnicos, Coordinación» con el margen del párrafo | ✅ |
| Bloque «Estás en el panel de administración» + «Ir al panel de técnico» | ✅ para cuentas con los dos paneles (como Hperalta en la demo) |
| Ítems con ícono, texto y contador a la derecha; contador rojo solo en Problemas | ✅ (se quitó el rojo extra de «Usuarios»; lo pendiente se avisa en Usuarios y la campanita) |
| Campana con contador rojo `.ntf-badge` (máx. «9+») | ✅ (panel rehecho en la etapa 3) |
| ≤1024 px: barra `mbar` con hamburguesa, logo y campana; cajón con scrim, Esc y clic fuera | ✅ (se quitaron el botón «Técnico» y el contador de la hamburguesa, que la demo no tiene; el cambio de panel queda en el cajón) |
| Sin desborde horizontal de 320 a 1920 px | ✅ (9 pantallas × 8 anchos en la prueba) |

**Recorte por la izquierda: comprobado ✅ (2026-11-27).**
- **Con barras clásicas de Windows:**
  - Playwright sin la opción `--hide-scrollbars`, de modo que la barra ocupa 17 px; también se probó con cabeza: 15 px reales.
  - Las 9 pantallas, a 1196, 1200, 1280 y 1366 px, con zoom de 100, 110 y 125 %: `scrollWidth <= clientWidth` en todas.
  - Se probó contra el seed de volumen (`tests/demo/layout-volumen.spec.ts`) y contra la base E2E con textos al límite (`tests/e2e/layout.spec.ts`, incluido el Panel a 1196 px).
- **Datos al límite:**
  - el cliente «Comercializadora Internacional de Artículos Deportivos, Calzado y Vestuario Limitada»;
  - una sucursal y un mall de más de 60 caracteres;
  - el correo `maximiliano.valenzuela.echeverria.santibanez@contratistas-externos.example.com`;
  - 1.180 visitas, para que el menú muestre un contador de 4 dígitos.
- **Anchos fijos:**
  - Lo único con mínimos grandes son las tablas: `.cl-t`, `.su-t`, `.ma-t`, `.us-t` y `.vt` (640 a 1000 px) y las de Roles y Contraseñas (640 a 720 px). Todas van dentro de un contenedor con `overflow-x: auto`, como en la demo.
  - El resto de las grillas usa `minmax(0, 1fr)` o `min(…, 100%)`.
  - `.us-cards` (`minmax(300px, 1fr)`) se corrige al rehacer Usuarios: a 320 px no cabe.
- **Causa: no confirmada** (decisión del 2026-11-27: probablemente una captura de una versión anterior; si el recorte reaparece, se reabre con captura y versión). No se pudo reproducir con exactitud.
  - Se rearmó el CSS anterior (Panel a 1240 centrado, grilla de Tailwind) y el Panel a 1196 px tampoco se desbordaba: `.pv-wrap` tenía `width: 100%` y se encogía.
  - Lo más probable es que la captura viniera de una versión anterior al rediseño de esta rama: todavía queda un resto de un menú de 248 px en `papel/carga.tsx`, que se limpia al rehacer Visitas.
  - En el código actual, la estructura de la demo (`272px minmax(0,1fr)`, `.wrap` de 1560 px a la izquierda, `min-width: 0`) y las pruebas de arriba aseguran que no se repita.

**Visitas masivas.** El botón sí existe. La captura falló por la prueba: contaba los botones antes de que la página cargara. Ya hay captura (`visitas-masivas-react-*.png`).

## T. Transversales: DatePicker, Skeleton y textos — ✅ cerrada (etapa 2, 2026-11-27)

| Punto | Estado |
|---|---|
| `DatePicker` compartido (`components/ui/DatePicker.tsx`), modos `range` y `single`, API en `dd-mm-aaaa` | ✅ |
| Ventana de dos columnas; atajos Hoy, Últimos 7 días, Últimos 30 días, Este mes, Mes anterior, Este año y Año anterior, en tres grupos separados por una raya (el activo en lila). «Hoy» se tomó de `RangoFechas.jsx` (2026-11-27) | ✅ |
| «Noviembre 2026» con ‹ ›; › desactivada si el mes siguiente queda fuera del máximo | ✅ |
| L M M J V S D (lunes primero); extremos en cuadrados `--purple`; franja lila; hoy con borde; días fuera de rango desactivados | ✅ |
| Punto morado bajo los días con visitas, con datos reales: `GET /api/visitas/actividad?mes=AAAA-MM` hace una cuenta agrupada por día y guarda el resultado por mes; el técnico ve solo las suyas | ✅ |
| Pie con el rango en texto («12 nov – 19 nov 2026»), Limpiar (contorno) y Aplicar (primario) | ✅ |
| `single` sin atajos: Nueva visita, Reagendar, lote, masivas y la visita que agrega el técnico no permiten fechas pasadas; corregir una visita ya hecha y la fecha de instalación sí | ✅ |
| Teclado: flechas (cambian de mes al pasar el borde), RePág/AvPág, Enter elige, Esc cierra y devuelve el foco | ✅ |
| En celular (≤640 px), panel inferior con las columnas apiladas | ✅ |
| Ningún `type="date"`: prueba `tests/unidad/sin-fecha-nativa.test.ts` | ✅ |
| Siluetas con la forma de cada pantalla (`components/ui/esqueletos.tsx`), un `loading.tsx` por ruta (13 del panel y 5 del técnico) y brillo que se apaga con `prefers-reduced-motion` | ✅ (prueba `tests/componentes/esqueletos.test.tsx`) |
| Spinner dentro del botón, sin cambiar su ancho (`components/ui/Espera.tsx`); fuera los «Guardando…», «Enviando…», «Cambiando…» | ✅ |
| «Cargando…» eliminado (se borró `components/ui/Cargando.tsx`) | ✅ |
| Limpieza de textos explicativos: 50 quitados y 22 dudosos que se dejaron, en `docs/textos-quitados.md` | ✅ |

**Desvíos, a confirmar:**
- **Diferencias con el original.** `RangoFechas.jsx` de sys_clientes no tiene ventana emergente, días futuros desactivados, puntos de actividad, Limpiar/Aplicar ni los atajos «Mes anterior», «Este año» y «Año anterior». Se siguió la especificación escrita. Del original se tomaron:
  - la selección en dos clics, en cualquier orden, con vista previa al pasar el mouse;
  - el texto del rango;
  - la paleta.
- **Visitas permite días futuros.** El filtro de Visitas deja elegir días futuros, porque la lista tiene visitas programadas hacia adelante. En los historiales rige el máximo «hoy».
- **Flechas renombradas.** Se llaman «Ver mes anterior» y «Ver mes siguiente», porque «Mes anterior» ya es un atajo y el lector de pantalla no los distinguiría.

**Pendientes con fecha:**
- **Campanita:** ✅ hecho en la etapa 3.
- **Detalle de visita:** los «Descargando…» y «Habilitando…» del menú se rehacen con el menú Descargar/Editar de la demo en la etapa 5.

## 1. Panel

**Encabezado**

| Punto | Estado |
|---|---|
| H1 + línea de fecha | ⚠️ la demo dice «Datos al martes 24 de noviembre de 2026» (el subtítulo explicativo se quita y queda la fecha) |
| Selector Hoy / Semana / Mes | ✅ |
| Etiqueta «Datos de ejemplo» | n/a (no hay datos de ejemplo en producción) |

**Indicadores y Técnicos**

| Punto | Estado |
|---|---|
| 4 KPIs enlazados (Visitas, Cerradas a tiempo, Problemas abiertos, Esperan nueva fecha) | ✅ |
| Técnicos: avatar, nombre, «x de y a tiempo», barra con marca de la meta, %, chip | ✅ |
| Etiqueta «Hoy, dd/mm» | ✅ |

**Estado de las visitas y problemas por tipo**

| Punto | Estado |
|---|---|
| Estado de las visitas: barra apilada + lista con punto, total y % | ✅ |
| Problemas por tipo: anillo, leyenda con botón, «Otro» al final en gris con «Sin clasificar» | ✅ |
| Elegir un tipo destaca el arco y muestra la barra «N problemas abiertos de tipo "X"» + «Ver problemas» | ⚠️ revisar el texto exacto y el hover cruzado anillo ↔ leyenda |

**Tiempos y fallas**

| Punto | Estado |
|---|---|
| Tiempo promedio de resolución: línea, eje 0/24/48/72 h, línea roja del SLA 48 h, punto final, tooltip con «x h sobre el SLA» | ⚠️ React no tiene la línea del SLA ni la nota «La línea roja es el SLA…» |
| Sucursales con más fallas: ranking, cliente + nombre, comuna, total, «n sin cerrar» | ✅ |
| Sucursales con más fallas: flag «Revisar nombre» cuando falta el cliente | ❌ |
| Tiempo en sitio por tipo de trabajo: puntos, promedio, eje y leyenda | ✅ |

**Reagendamientos**

| Punto | Estado |
|---|---|
| Lista de reagendamientos | ✅ |
| Interruptor «Ocultar registros de prueba» (marcado) y conteo «n de prueba ocultos» | ❌ |

**De más en React**

| Punto | Estado |
|---|---|
| ➕ Tarjeta «Visitas realizadas» | ⚠️ no está en la demo |

**Resumen: 4 ⚠️ · 2 ❌**

## 2. Visitas (listado)

**Encabezado y barra**

| Punto | Estado |
|---|---|
| H1 + «N visitas registradas» | ✅ (el dato se queda) |
| Botones: «Acciones múltiples» (toggle) + «Visitas masivas» + «Nueva visita» | ⚠️ «Visitas masivas» no apareció como botón en la captura (no se pudo abrir) |
| Pestañas Todas / Programadas / En curso / Completadas / Canceladas con contador | ⚠️ React agrega Reagendada; revisar contra la demo |
| Buscador «Buscar por folio, cliente, sucursal o técnico» y atajo «/» | ⚠️ el placeholder difiere; revisar que el atajo «/» enfoque |

**Filtros**

| Punto | Estado |
|---|---|
| Botón Filtros con contador | ✅ |
| Formulario: Zona, Mall, Cliente, Técnico, Desde, Hasta | ⚠️ Desde/Hasta pasan a un `DatePicker` de rango |
| Validación «La fecha "Hasta" debe ser igual o posterior a "Desde".» | ❌ (con el rango deja de aplicar: el picker no permite ese caso) |
| Chips de filtros con ✕ y «Quitar todos» | ✅ |

**Acciones múltiples**

| Punto | Estado |
|---|---|
| Barra inline: «Reasignar a [select] Aplicar», «Mover al [fecha] Aplicar», «Cancelar visitas» | ⚠️ React abre un diálogo por acción en lugar de la barra inline |
| Nota «Solo cambian las programadas; las completadas o canceladas se omiten.» | ⚠️ React muestra otra nota. Es una advertencia de regla, así que se queda la de la demo |
| Toast al omitir las no programadas | ⚠️ revisar |

**Tabla**

| Punto | Estado |
|---|---|
| Filas agrupadas por día («Hoy, …», «Ayer, …», «Mañana, …») con «n visitas» | ✅ |
| Columnas Visita (folio + motivo + «+n») / Cliente y sucursal / Técnico (mini-av + «+ ayudante») / Llegada / Estado / › | ⚠️ React agrega la columna «Motivo del técnico» |
| Llegada: «inicio a fin», hora, «Hasta dd/mm» o «Todo el día» | ⚠️ React usa «Sin hora» y textos propios |
| La fila completa abre el detalle; en modo selección, la fila marca | ✅ |
| Resaltado `new-row` de lo recién creado | ✅ |
| Vacío «No hay visitas con esa búsqueda» + «Quitar filtros» | ✅ |

**Paginador**

| Punto | Estado |
|---|---|
| «a–b de n cargadas, total en total», selector Filas 25/50/100, ‹ p / P › | ⚠️ React usa «registros» y su propio selector |

**Resumen: 10 ⚠️ · 1 ❌**

## 3. Detalle de visita (acta, admin)

**Cabecera**

| Punto | Estado |
|---|---|
| Volver «Visitas», folio + pill de estado, meta «Cliente, Sucursal. Motivos», fecha y horario | ⚠️ React separa con «·» (la demo con comas) |
| Botones: Trazabilidad / **Descargar ▾** (Acta en PDF + Fotos y videos .zip) / **Editar ▾** (Editar el acta + Permitir que el técnico la corrija, 5 min) / Enviar por correo | ⚠️ React tiene «Acta en PDF» suelto y le falta el .zip; revisar el menú Editar |
| «Cambiar fecha o técnico» en las programadas | ⚠️ revisar |
| Franja «X puede corregir el acta… Quedan m:ss» + «Cerrar acceso» | ⚠️ revisar |

**Cuerpo**

| Punto | Estado |
|---|---|
| Trabajo solicitado | ✅ |
| Trabajo solicitado: «por usuario» | ❌ |
| Trabajo realizado: tarjetas por trabajo con tipo, título y lista de ítems «× cantidad» | ⚠️ React muestra el título + texto, sin cantidades |
| ➕ Tarjeta «Observaciones del técnico» | ⚠️ no está en la demo (dato real: preguntar) |
| Problemas: número, «Problema i de n», pill Abierto/Resuelto, Tipo, **Equipos afectados (× cant)**, Qué encontró | ⚠️ faltan «Equipos afectados» |
| Acciones del problema: «Agendar visita para resolver» / «Visita para resolver: folio» / **Corregir** / **Marcar resuelto** / **Reabrir** | ⚠️ React tiene un único «Estado o tipo» |
| Evidencia: fotos (miniatura, «Foto n», hora) y videos (▶, duración, resolución) | ✅ (la siembra no trae fotos; revisar con datos) |
| Visor (lightbox) con ←/→, Esc y contador | ⚠️ revisar |
| Zona de peligro plegable: escribir el folio para habilitar «Eliminar visita» | ⚠️ falta el chevron; revisar el flujo |

**Columna derecha**

| Punto | Estado |
|---|---|
| Detalle de la visita: Fecha, Horario/Llegada, Cliente, Sucursal (+región), Técnico (mini-av + ayudante), Contacto (nombre, cargo, tel) | ⚠️ React agrega «En terreno» y el RUT del contacto, y no tiene mini-av |
| ➕ «Corregir visita» + nota bajo la tarjeta | ⚠️ no está en la demo |
| Último movimiento: título + «fecha, quién» + «Ver trazabilidad completa» | ⚠️ falta «fecha, quién» |
| **Recepción conforme a la derecha**: fecha y hora, firma, línea, nombre, «cargo, RUT 12.345.\*\*\*-5 Mostrar/Ocultar» | ⚠️ falta la fecha; el botón dice «Mostrar RUT completos» y va abajo en lugar de en línea |

**Diálogos**

| Punto | Estado |
|---|---|
| Trazabilidad: último movimiento, línea de tiempo y datos del registro | ⚠️ revisar |
| Editar acta: solicitado, responsable, cargo y motivo obligatorio (validaciones) | ⚠️ revisar (React tiene una página aparte `/editar`) |
| Enviar por correo: destinatarios separados por coma (validación de cada uno), adjuntos PDF/.zip (al menos uno) | ⚠️ revisar |
| Agregar o corregir problema: tipo, equipo, cantidad, qué y estado, con validaciones | ⚠️ revisar |

**Por confirmar**

| Punto | Estado |
|---|---|
| Comentario interno y ocultar credenciales en las notas | ❓ la demo **no** muestra el comentario interno ni las notas en el detalle admin. React ya los tiene. Ver la pregunta 2 |

**Resumen: 19 ⚠️ · 1 ❌**

## 4. Nueva visita

**Secciones y campos**

| Punto | Estado |
|---|---|
| Panel lateral (`sheet`) con secciones numeradas 1–5 | ✅ |
| 1 Local: «Cliente» + casilla «Buscar por mall» (cambia la etiqueta a Mall) → Sucursal | ⚠️ React dice «Mall» en la casilla |
| 2 Quién va: «Técnico» / «Ayudante opcional», con la opción «Sin ayudante, va solo» | ⚠️ las etiquetas dicen «Técnico asignado» y «Técnico ayudante (opcional)», hay ayuda gris debajo, y la opción usa «·» en lugar de coma |
| 3 Motivo: **selector agrupado** (grupos plegables con «n marcados», total, chip «Principal», resumen «n marcados. Principal: X»; un grupo con marcados no se cierra y avisa) | ❌ React muestra chips sueltos, sin grupos |
| 4 Cuándo: Fecha + casilla «Con margen» (muestra «a [fecha límite]») | ⚠️ React dice «Margen de días»; pasa a `DatePicker` |
| 4 Cuándo: Hora de llegada (opcional → obligatoria si el motivo es instalación, con la etiqueta y la ayuda dinámicas) | ⚠️ revisar la regla de instalación |
| 5 Qué hay que hacer (textarea con placeholder) | ✅ |

**Opciones ocultas**

| Punto | Estado |
|---|---|
| `details` «Contacto en tienda» (el resumen muestra el nombre): «Elegir de quienes ya firmaron», Nombre, Cargo (lista fija), RUT (formatea al salir), Teléfono +56 | ❌ revisar si existe; no aparece como desplegable |
| `details` «Indicaciones de acceso» | ❌ |
| «Adjuntar fotos o videos» (hasta 12; lista con ✕; toast si se pasa) | ❌ revisar |

**Validaciones**

| Punto | Estado |
|---|---|
| Elige la sucursal / ayudante distinto / al menos un motivo / fecha / fecha límite ≥ / hora en instalaciones / RUT válido / teléfono de 9 dígitos (abre Contacto si falla); desplaza al primer error | ⚠️ revisar una por una |

**Prellenado y cierre**

| Punto | Estado |
|---|---|
| Prellenado «Visita para resolver» desde un problema | ✅ existe |
| Título y textos según la demo | ⚠️ |
| Toast «Visita X programada para T el dd/mm/aaaa.» + notificación «Mis cambios» | ⚠️ revisar |

**Resumen: 7 ⚠️ · 4 ❌**

## 5. Visitas masivas

| Punto | Estado |
|---|---|
| Panel del mismo tamaño que Nueva visita, en dos columnas (configuración + Ruta) | ⚠️ no se pudo abrir en la captura; React usa otro tamaño |
| Quién va, Motivo para todos (selector agrupado), Cuándo con margen, Qué hay que hacer, Indicaciones de acceso | ❌ falta el selector agrupado; revisar el resto |
| Ruta: «n locales», Cliente/Mall → «Agregar sucursal», lista con ↑ ↓ «Detalle propio» ✕ | ⚠️ revisar |
| Detalle propio: textarea + hora | ⚠️ revisar |
| Vacío «Todavía no hay locales…» | ⚠️ revisar |
| Validación «En instalaciones, cada local necesita su hora» | ⚠️ revisar |
| Botón «Programar n visitas» | ✅ |
| Toast | ⚠️ revisar |

**Resumen: 6 ⚠️ · 1 ❌**

## 6. Problemas

| Punto | Estado |
|---|---|
| H1 + «n problemas sin cerrar en m tiendas» + «Checklist de gestión» | ✅ |
| Franja «Sin cerrar» con cuadros por antigüedad y tramos clicables | ✅ |
| 5 indicadores (Levantados, Resueltos, Tiempo medio, El más antiguo, Sin visita agendada) | ✅ |
| Buscador a todo el ancho + conteo + Filtros | ⚠️ el buscador es angosto |
| ➕ Aviso «Todavía no hay pasos de gestión…» | ⚠️ no está en la demo |
| Lista de tiendas (oscura la elegida, cuadritos, contador) y cabecera de la tienda con 4 datos + «Historial del local» | ✅ |
| Tarjeta de problema: días, tipo, estado, folio, detalle, **chips de equipo × cant**, quién y cuándo, Agendar visita, Bitácora n, Estado o tipo | ⚠️ revisar los chips de equipo (la siembra no trae) |
| Checklist de gestión (cajón) | ✅ |
| Nota suelta en la bitácora | ❌ (pendiente conocido: requiere migración) |

**Resumen: 3 ⚠️ · 1 ❌**

## 7. Clientes (lista)

| Punto | Estado |
|---|---|
| H1 + «n clientes, m locales activos.» + «Nuevo cliente» | ⚠️ falta el subtítulo de dato |
| 4 KPIs enlazados, con el activo subrayado | ⚠️ sin flechas ni estado activo |
| **Pestañas** Activos / En plan / Sin locales / Inactivos / Todos con contador | ❌ React usa «Filtros» |
| Buscador «Buscar cliente o RUT» + **orden «Más locales»** | ⚠️ |
| Fila: avatar con iniciales, nombre, razón + RUT, locales (barra + «en n malls, k inactivo»), plan, **Última visita**, estado, acciones editar / locales / › | ⚠️ falta el avatar y la última visita; las acciones son distintas |
| Paginador | ⚠️ |
| Diálogo Nuevo / Editar cliente (Empresa, RUT único, etc.) | ⚠️ revisar contra `#mCli` |

**Resumen: 6 ⚠️ · 1 ❌**

## 8. Detalle de cliente

**Cabecera e indicadores**

| Punto | Estado |
|---|---|
| Avatar cuadrado con iniciales | ❌ |
| Pills Activo + «En plan de calibración» | ⚠️ falta la del plan |
| Subtítulo «Razón, RUT. n locales activos en m malls.» | ⚠️ |
| Botones «Editar sus locales» + **«Editar cliente»** | ❌ falta «Editar cliente» |
| 5 KPIs | ✅ |

**Actividad y datos**

| Punto | Estado |
|---|---|
| Actividad: barras por mes con su valor | ⚠️ |
| Actividad: **chips de estado con n y % que filtran el historial** | ❌ |
| Motivos más frecuentes (ranking numerado) | ⚠️ React usa barras sin número |
| Datos del cliente: Razón, RUT, Locales, **Calibración, Garantía, Problemas (enlace)** | ⚠️ faltan 3 filas |
| Marcas (n, Agregar marca, Editar) y Contactos (n, Agregar, vacío) en 3 columnas con Datos | ⚠️ distinto orden y tamaño |

**Sus tiendas e historial**

| Punto | Estado |
|---|---|
| ➕ Visitas por estado, Visitas por mall, Problemas y tiempo en sitio | ⚠️ no están en la demo |
| Sus tiendas: «Ordenadas por visitas completadas», 10 filas + «Ver las n tiendas» | ⚠️ |
| Historial de visitas con **folios únicos**: buscador, Folio / Fecha (+hora) / Tienda (+mall) / Técnico / Motivo / Problemas / Estado, paginador | ⚠️ React agrega las columnas Hora y Mall y Filtros |
| Pestaña / sección Problemas del cliente | ⚠️ revisar dónde vive en la demo |

**Resumen: 11 ⚠️ · 3 ❌**

## 9. Sucursales (lista) y detalle

**Lista**

| Punto | Estado |
|---|---|
| Lista: KPIs, pestañas, filtros, filas, acciones y alta en lote | ⚠️ por detallar (`sucursales-*.png`) |

**Detalle: cabecera e indicadores**

| Punto | Estado |
|---|---|
| Ícono de tienda | ❌ |
| «Cliente, Marca» sobre el título | ❌ |
| Subtítulo dirección | ⚠️ |
| **Editar** + **Agendar visita** | ❌ |
| 5 KPIs | ✅ |

**Detalle: datos, contactos y actividad**

| Punto | Estado |
|---|---|
| Datos de la tienda: Cliente, Marca, Mall, Dirección, **Teléfono, Instalación, Garantía (vence), Calibración, Remota** | ⚠️ faltan filas |
| Contactos en **una** tarjeta: «De la tienda» + «Heredados del cliente, la marca o la región» | ⚠️ React usa dos tarjetas |
| Actividad (barras) + **Técnicos que han ido** en la misma tarjeta | ⚠️ |
| ➕ Visitas por estado, Motivos, Problemas y tiempo en sitio | ⚠️ |
| Historial: buscador + **select estados** + **select años** | ⚠️ React usa Filtros |

**Resumen: 6 ⚠️ · 4 ❌**

## 10. Malls (lista) y detalle

**Lista**

| Punto | Estado |
|---|---|
| Lista | ⚠️ por detallar (`malls-*.png`) |

**Detalle**

| Punto | Estado |
|---|---|
| Ícono | ❌ |
| Subtítulo «dirección. n tiendas activas de m clientes.» | ⚠️ |
| Editar + «Agregar o quitar tiendas» | ❌ |
| 5 KPIs | ✅ |
| Sus tiendas en una lista con avatar, nombre, cliente, barra, n, última visita, estado y «Agregar o quitar» | ⚠️ |
| **Clientes en el mall** (filtran el historial) + **Visitas por mes** | ❌ |
| ➕ Actividad, Visitas por estado, Datos, Motivos, Visitas por cliente, Problemas y tiempo | ⚠️ |
| Historial con select de estados | ⚠️ |

**Resumen: 5 ⚠️ · 3 ❌**

## 11. Campanita — ✅ cerrada (etapa 3, 2026-11-27)

Capturas: `docs/capturas/etapa3/campanita{,-ajustes}-{demo,react}-{1440,390}.png` (`npx playwright test -c playwright.demo.config.ts etapa3`, siembra en la base local de comparación la misma actividad que la demo).

| Punto | Estado |
|---|---|
| Hoja lateral derecha `.sheet.ntf` (440 px, alto completo) con fondo `.ov`; Esc, clic en el fondo y ✕ cierran; Tab no sale de la hoja; el foco vuelve a la campana | ✅ |
| Encabezado «Notificaciones», «n avisos sin leer» / «Estás al día», «Marcar todo como leído», ⚙ «Qué quiero ver», ✕ | ✅ |
| Pestañas Todo / Avisos / Mis cambios con contador (flechas para moverse) | ✅ |
| Grupos Hoy / Ayer / Antes, avatar con iniciales («TÚ» y «ST» para el sistema), folio en negrita, línea de detalle, «hace x, desde el celular», etiqueta Terreno / Panel / Seguimiento / Maestros, «Nuevo», punto rojo | ✅ |
| Lo propio en segunda persona («Tú agendaste…»): `lib/ui/segunda-persona.ts` | ✅ |
| Solicitud de contraseña → Usuarios › Contraseñas pedidas, con «Se atiende en Usuarios, Contraseñas pedidas.» | ✅ |
| «Qué quiero ver»: leyenda, tres casillas, segmentado Avisar / Mostrar / Ocultar con flechas, «Volver a lo recomendado» y Guardar (borrador hasta guardar) | ✅ |
| Contador rojo en la campana (máx. «9+») | ✅ |
| «Cargando…» → silueta de la lista | ✅ |

Pruebas: `tests/componentes/campanita.test.tsx` (6) y `tests/unidad/segunda-persona.test.ts` (13).

**Decisiones (2026-11-27):**
- **Lectura por aviso: aceptada sin migración.**
  - Lo que se toca suelto se guarda en el navegador y no se sincroniza entre equipos.
  - «Marcar todo como leído» mueve el «leído hasta» del servidor.
  - Abrir la campana no marca nada, como en la demo.
  - Limitación y propuesta de migración (tabla `notificacion_lectura`), pendiente para la fase de datos reales: `docs/notificaciones-lectura.md`.
- **Línea de detalle con solo la tienda** (la demo muestra «cliente, sucursal»): **diferencia aceptada por datos**.
- **Contraseña pedida con el correo** (la demo muestra el nombre y «Cuenta de técnico»): **diferencia aceptada por datos**. Quien pide no tiene sesión.
- **Sin la línea gris extra de la demo** (`sub2`): **diferencia aceptada por datos**. Ese texto no existe en la actividad.

**Pendiente de prueba manual (no ✅): avisos del navegador y sonido en un equipo real**

Hay que estar conectado con una cuenta del panel y tener la campana abierta.

1. **Permitir avisos.**
   - Pasos: ⚙ «Qué quiero ver», marcar «Avisos del navegador en este equipo» y aceptar el permiso del navegador. Luego Guardar.
   - Debe: no mostrar ningún mensaje de error, y la casilla debe quedar marcada al volver a entrar.
2. **Recibir un aviso.**
   - Pasos: con el panel abierto en otra pestaña o minimizado, hacer desde otra cuenta algo que esté en «Avisar», por ejemplo pedir una contraseña nueva desde el login.
   - Debe, dentro de 30 s (2 min si la pestaña está escondida):
     - aparecer el aviso del sistema operativo con el texto del aviso;
     - al hacer clic, abrir el registro;
     - subir el número rojo.
3. **Sonido.**
   - Pasos: marcar «Sonido al llegar un aviso». Al marcarlo suena un «ding» de prueba. Guardar y repetir el paso 2.
   - Debe sonar el «ding» al llegar el aviso.
4. **Permiso denegado.**
   - Pasos: en el candado de la barra de direcciones, bloquear las notificaciones del sitio y volver a marcar la casilla.
   - Debe mostrar «El navegador no dio permiso. Puedes activarlo en el candado de la barra de direcciones.» y la casilla se desmarca sola.
5. **Apagar.**
   - Pasos: desmarcar las dos casillas y Guardar.
   - Debe: no llegar más avisos del sistema operativo ni sonar el «ding».

## 12. Mi cuenta

| Punto | Estado |
|---|---|
| Tarjeta de cabecera ancha: avatar con cámara, nombre + rol, correo, «Subir foto» + formatos, recuadro Último acceso / Miembro desde / Permisos | ⚠️ React tiene una columna lateral con otro diseño; faltan Miembro desde y Permisos |
| Datos: Nombre, Correo, Teléfono opcional (+56), «Guardar datos» desactivado sin cambios | ⚠️ el prefijo dice «+56 9» |
| Contraseña: actual, nueva, repetir, **barra de fuerza**, **lista de reglas con check en vivo** (10 caracteres, distinta del correo, distinta de la actual, coinciden), mostrar, botón desactivado | ⚠️ faltan la barra y las reglas |
| **Dónde tienes la sesión abierta**: equipos, «Activa ahora», «Cerrar sesión» por equipo, «Cerrar en los demás equipos» | ❌ pendiente conocido: requiere registro de sesiones (migración) |

**Resumen: 3 ⚠️ · 1 ❌**

## 13. Usuarios

**Cabecera**

| Punto | Estado |
|---|---|
| Subtítulo de datos «n cuentas activas, m técnicos activos y k roles.» | ❌ |
| **Aviso rojo** «n contraseña(s) pedida(s) espera(n) respuesta» + correo + «Atender» | ❌ |
| Pestañas con contador (Contraseñas pedidas con contador rojo) | ⚠️ otro estilo |

**Cuentas**

| Punto | Estado |
|---|---|
| Buscador «correo, rol o técnico» + select de estado | ⚠️ |
| Inicial (oscura si es admin), «Tú», etiqueta de prueba, Acceso (Solo celular / rol), técnico vinculado con mini-av, último acceso relativo, estado con motivo | ❌ faltan la inicial, «Tú», «Solo celular», el mini-av y el motivo |
| Formulario: correo único, Solo celular ⇒ técnico, También es técnico, ver/generar contraseña, motivo al desactivar, no quitarse el rol ni desactivarse | ⚠️ revisar todo |

**Técnicos, contraseñas y roles**

| Punto | Estado |
|---|---|
| Técnicos: tarjetas, RUT oculto + «Mostrar RUT completos», «Crearle una cuenta», validación de RUT | ❌ hoy es una tabla |
| Contraseñas pedidas: contraseña temporal mostrada una vez + copiar, descartar, ver cerradas | ⚠️ revisar |
| Roles: barra de permisos, cuentas por rol, Administrador no editable, rol en uso no se borra, doble confirmación, editor por módulo (Marcar todo; acción ⇒ Ver; quitar Ver limpia), permisos del celular aparte | ⚠️ revisar todo |

**Resumen: 5 ⚠️ · 4 ❌** (se rehace completa)

## 14. Checklist

**Encabezado y pestañas**

| Punto | Estado |
|---|---|
| H1 + subtítulo de dato «n entradas guardadas en m listas» | ⚠️ |
| Buscador global arriba a la derecha + botón de estado «Sin cambios» / «Guardar» | ⚠️ |
| **8 pestañas con contador**, primera «Secciones del acta» | ⚠️ React tiene otro orden, no tiene contadores y la llama «Acta» al final |

**Motivos y vista previa**

| Punto | Estado |
|---|---|
| **«Así lo ve el técnico»: celular fijo a la derecha**, que sigue al motivo elegido | ⚠️ React lo abre con un botón |
| Motivos agrupados en **secciones oscuras** plegables, con nombre editable, «n motivos», ↑ ↓, «Motivo aquí» y borrar | ❌ |
| Fila: manilla, número, nombre editable, **código debajo en mono**, «Ver trabajos n», clonar, borrar | ⚠️ |

**Plantilla y teclado**

| Punto | Estado |
|---|---|
| Tu plantilla (Fijar / Reiniciar) | ✅ (con otro título) |
| ➕ Barra inferior «Guardar cambios» | ⚠️ en la demo va arriba |
| Teclado (flechas en las pestañas, mover filas con el teclado) y aviso al salir con cambios | ⚠️ revisar |

**Resumen: 7 ⚠️ · 1 ❌**

## 15. Panel de técnico

**Cabecera e inicio**

| Punto | Estado |
|---|---|
| Barra superior (logo, sección, inicio, salir) + franja «Panel de técnico / Volver al panel de admin» para quien es admin | ⚠️ revisar la franja con la cuenta doble |
| Hola + nombre + fecha + «RUT · rol · correo» | ✅ |
| 3 contadores | ✅ |

**Bloques del inicio**

| Punto | Estado |
|---|---|
| **Tarjeta oscura «En curso desde…»** con minutos en terreno y «Continuar formulario» | ❌ React lo muestra como una fila normal |
| Lo que sigue hoy | ⚠️ revisar con más datos |
| Quedaron sin cerrar | ⚠️ revisar con más datos |
| Próximas por día | ⚠️ revisar con más datos |
| «Vas de ayudante», «Ver todas mis visitas n» | ✅ |

**Navegación y hojas**

| Punto | Estado |
|---|---|
| Barra inferior con contador de atrasadas en Visitas | ⚠️ |
| Hojas del celular: Agregar visita, Reagendar / No se pudo / Cancelar, detalle de una visita cerrada; Esc las cierra | ⚠️ pendiente conocido: Esc en las hojas |

**Resumen: 6 ⚠️ · 1 ❌**

## 16. Formulario del acta

**Encabezado**

| Punto | Estado |
|---|---|
| Folio + pill «En curso» | ⚠️ |
| «Cliente · Motivo · desde hh:mm» | ⚠️ |
| Progreso segmentado + «n de 6 secciones listas» + «se guarda en este celular» | ✅ |

**Sección 1**

| Punto | Estado |
|---|---|
| Tarjetas blancas por sección, con número, título, Obligatorio/Opcional y estado (Pendiente / Responde n / Al final) | ⚠️ React usa tarjetas lilas y «OBLIGATORIO» en mayúsculas |
| 1: **Personas del local** (select) y **Cargo** | ❌ |
| 1: Responsable, RUT, Teléfono +56, Correo | ⚠️ el prefijo dice «+56 9» |

**Secciones 2 a 6**

| Punto | Estado |
|---|---|
| 2: motivo y trabajo realizado (hoja «Trabajo realizado») | ⚠️ revisar |
| 3: problemas | ⚠️ revisar |
| 3: «Responde n» de los problemas que venía a resolver | ⚠️ revisar |
| 4: comentario interno | ⚠️ revisar |
| 5: fotos y video | ⚠️ revisar |
| 6: firma (recuadro + «Firmar a lo ancho», RUT, aviso) | ⚠️ revisar |
| «Revisar y guardar» + lista de lo que falta | ✅ |
| Revisión (`tf-rv`) | ⚠️ revisar |
| Pantalla de enviado | ⚠️ revisar |

**Resumen: 13 ⚠️ · 1 ❌**

---

## Totales

| Sección | ⚠️ | ❌ |
|---|---|---|
| Layout y menú | 0 | 0 |
| Panel | 4 | 2 |
| Visitas (lista) | 10 | 1 |
| Detalle de visita | 19 | 1 |
| Nueva visita | 7 | 4 |
| Visitas masivas | 6 | 1 |
| Problemas | 3 | 1 |
| Clientes | 6 | 1 |
| Detalle de cliente | 11 | 3 |
| Sucursales y detalle | 6 | 4 |
| Malls y detalle | 5 | 3 |
| Campanita | 0 | 0 |
| Mi cuenta | 3 | 1 |
| Usuarios | 5 | 4 |
| Checklist | 7 | 1 |
| Panel de técnico | 6 | 1 |
| Formulario del acta | 13 | 1 |
| **Total** | **117** | **30** |

**Alcance de esta auditoría.** Las secciones Panel, Visitas, Detalle, Nueva visita y Masivas se auditaron leyendo el JS de la demo línea por línea. El resto se auditó con las capturas y el markup.

Los puntos «revisar» y las listas de Sucursales y Malls se completan contra el JS de la demo al empezar cada etapa, antes de tocar el código, y se actualizan en este archivo.
