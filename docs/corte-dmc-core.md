# Corte de DMC_Contingencia (esquema `dmc`) a DMC_Core (esquema `tecnico`)

Documento de ejecución. **No se corre solo:** cada paso lo hace una persona, en este orden.

La app no escribe el nombre del esquema en ninguna consulta: lo toma de `DB_SCHEMA`
(`lib/db/esquema.ts`). Sin `DB_SCHEMA` usa `dmc`, así que **el código con esta preparación
sirve igual a la base actual**. Eso permite desplegarlo antes del corte y que el corte sea solo
cambiar variables.

| | Hoy (producción) | Después del corte |
|---|---|---|
| `DB_SERVER` / `DB_PORT` | `74.208.211.175` / `14330` | igual |
| `DB_NAME` | `DMC_Contingencia` | `DMC_Core` |
| `DB_USER` | `sysContingencia` | `dmc_app_tecnicos` |
| `DB_PASSWORD` | la actual | la de `dmc_app_tecnicos` (marcarla como secreta) |
| `DB_ENCRYPT` | `true` | `true` |
| `DB_TRUST_SERVER_CERT` | `true` | `true` (el servidor no tiene certificado válido) |
| `DB_SCHEMA` | *(no existe → `dmc`)* | `tecnico` |
| `DB_SCHEMA_CLIENTES` | *(no existe → `dmc`)* | `clientes` |
| `DB_SCHEMA_SEGURIDAD` | *(no existe → `dmc`)* | `seguridad` |

Los valores de «Hoy» salen del último `vercel env pull` guardado en `.env.production`; confírmalos
en el panel antes de tocar nada, porque son los que hay que restaurar si se vuelve atrás.
`DB_ENCRYPT` y `DB_TRUST_SERVER_CERT` ya valían `true` en ese archivo: si es así, no cambian.

---

## Estado verificado (2026-11-24)

- Proyecto Vercel `dmc-359c/portal-tecnicos`; dominios `tecnicosdmc.cl`, `www.tecnicosdmc.cl` y
  `portal-tecnicos.vercel.app`.
- El PR #6 (soporte de `DB_SCHEMA`) está en `main`, pero **su despliegue de producción quedó
  «Canceled»** («through the Vercel API»). El último despliegue `Ready` es del 2026-11-23: producción
  **todavía corre el código anterior**, que consulta `dmc.*` con el esquema escrito a mano. Hay que
  desplegar `main` antes del corte (paso 0.1).
- Las variables `DB_*` están en Vercel como **Secret** y compartidas entre **Production y Preview**: sus
  valores no se pueden leer desde Vercel, y un preview de cualquier rama usa hoy la base de producción.
  Si se editan, hay que separar Production de Preview (en el panel: editar la variable, quitar «Preview»
  y crear la nueva solo para Production).
- Los valores actuales (los de vuelta atrás) solo están en `.env.production`, un `vercel env pull` del
  2026-11-23. **Guarda una copia fuera del repositorio antes de tocar nada.**
- `DB_SCHEMA`, `DB_SCHEMA_CLIENTES` y `DB_SCHEMA_SEGURIDAD` no existen todavía en Vercel (correcto: hasta el
  corte la app usa `dmc`).
- DMC_Core: login `dmc_app_tecnicos` verificado; los 94 objetos están en su esquema real; versión 45.

---

## 0. Antes del día del corte

1. **Desplegar este código en producción con las variables de hoy.** Funciona porque `DB_SCHEMA`
   falta y vale `dmc`. Si el corte se hiciera con el código anterior, la app redesplegada
   consultaría `dmc.*` en DMC_Core y fallaría en todo.
   - Verificar en producción: `GET /api/salud` responde `esquema.nombre: "dmc"` y `alDia: true`.
2. En DMC_Core, con el login de la app: `npm run comparar-esquema -- --env .env.development`
   (compara el catálogo contra `sql/dmc_contingencia_sqlserver.sql`) y
   `npm run migrar` con el login de migraciones (no aplica nada sin `--aplicar`): debe decir
   «No hay migraciones pendientes».
3. Pruebas funcionales contra DMC_Core (lista en la sección «Verificación»).
4. Avisar la ventana. Los técnicos con un acta a medias conservan el borrador en el celular
   (`localStorage`), pero no pueden enviarla mientras la app esté congelada.

## 1. Congelar la escritura

Elige una; la 1A es la más simple y no deja a nadie escribiendo en la base vieja:

- **1A. Pausar el proyecto en Vercel** (Settings → Advanced → Pause, o la herramienta
  `pause_project`). La app deja de responder, también para leer.
- **1B. Base en solo lectura**: `ALTER DATABASE DMC_Contingencia SET READ_ONLY WITH ROLLBACK IMMEDIATE`.
  La app lee pero falla al escribir, y **el login también**: escribe en `intento_login` y en
  `usuario.ultimo_acceso_en`. Úsala solo si se acepta que nadie pueda entrar.

Anota la hora. Todo lo escrito en `DMC_Contingencia` antes de ese momento tiene que estar en
DMC_Core al terminar el paso 2.

## 2. Recargar los datos de `dmc` a `tecnico` (tus scripts)

Vaciar y recargar las 68 tablas desde `DMC_Contingencia.dmc`. Comprobar al terminar, además de
conteos y checksums:

- `tecnico.schema_version` con las versiones 25…45.
- **La secuencia de folios**: `tecnico.seq_folio_visita` debe quedar por encima del mayor folio
  emitido (el siguiente debe ser `V-2026-01075` o posterior, nunca uno ya usado):
  `SELECT current_value FROM sys.sequences WHERE name = 'seq_folio_visita'`.
- Las columnas `IDENTITY`: al cargar con `IDENTITY_INSERT` el contador queda en el mayor id
  insertado, pero compruébalo en las tablas que se escriben a diario (`visita`, `problema`,
  `actividad`, `visita_foto`, `visita_firma`, `visita_video`).
- Los triggers y las vistas quedan habilitados (`sys.triggers.is_disabled = 0`).

## 3. Cambiar las variables en Vercel (entorno Production)

Cambiar: `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_ENCRYPT`, `DB_TRUST_SERVER_CERT` (si no valían ya
lo de la tabla) y agregar `DB_SCHEMA=tecnico`, `DB_SCHEMA_CLIENTES=clientes` y `DB_SCHEMA_SEGURIDAD=seguridad`.
No tocar `DB_SERVER` ni `DB_PORT`. Si falta alguna de las tres, esas tablas se buscarían en `dmc` o en
`tecnico` y la app fallaría con `Invalid object name`.

Guardar en un lugar seguro los valores **anteriores** de cada una: son el plan de vuelta atrás.

## 4. Redesplegar

Las variables solo valen para despliegues nuevos. Redesplegar el último despliegue de producción
(Deployments → ⋯ → Redeploy). Si se pausó el proyecto en 1A, reanudarlo antes.

## 5. Verificación

Con `curl -H "Authorization: Bearer $HEALTHCHECK_TOKEN" https://<app>/api/salud`:

- `ok: true`, `destino` termina en `/DMC_Core`, `esquema.nombre` = `tecnico`, `esquema.alDia` = `true`,
  `catalogo.listo` = `true`.

Y en la app, con una cuenta real:

1. Iniciar sesión (los hashes bcrypt son los mismos).
2. Listar visitas; abrir una con fotos, video y firma (`/api/visita/foto/<id>` sigue valiendo).
3. Descargar el PDF de un acta.
4. Crear una visita: el folio sale de `tecnico.seq_folio_visita` y es el siguiente a `V-2026-01074`.
5. Reagendar o cambiar el estado de una visita: aparece una fila nueva en
   `tecnico.visita_estado_historial` (la escribe el trigger).
6. Revisar los logs de runtime de Vercel unos minutos: ningún `Invalid object name`.

Lo creado en la verificación queda en la base real; borrar o cancelar las visitas de prueba.

## 6. Vuelta atrás

Si algo falla y no se arregla en minutos:

1. **Lo más rápido:** Deployments → el último despliegue anterior al corte → **Instant Rollback**.
   Ese despliegue conserva las variables con que se construyó, es decir, las de DMC_Contingencia.
2. O restaurar las variables a los valores anteriores (`DB_NAME=DMC_Contingencia`,
   `DB_USER=sysContingencia`, su contraseña y **quitar `DB_SCHEMA`**) y redesplegar.
3. Si se usó 1B: `ALTER DATABASE DMC_Contingencia SET READ_WRITE`.
4. Verificar con `/api/salud` (`esquema.nombre` = `dmc`).

**Ojo con los datos:** lo que se haya escrito en DMC_Core después del corte no existe en
DMC_Contingencia. Si la ventana fue corta, se descarta; si no, hay que copiarlo de vuelta a mano
(incluida la secuencia de folios) antes de reabrir. Por eso conviene decidir la vuelta atrás
rápido y no dejar DMC_Core recibiendo escrituras «a ver si se arregla».

`DMC_Contingencia` no se borra ni se cambia hasta que el sistema lleve unos días estable sobre
DMC_Core.

## 7. Sinónimos de `tecnico`

La app no usa los sinónimos (`tecnico.usuario` → `seguridad.usuario`, etc.): cada consulta apunta al esquema real
(`npm run verificar-ubicacion` lo comprueba contra la base). **Pero no se pueden borrar todavía:** los triggers
y las vistas de la base los usan. Con una base de pruebas sin sinónimos, 12 de 13 archivos de `tests/bd` fallan con
`Invalid object name 'tecnico.usuario'`. Para borrarlos hay que reescribir antes esas vistas y triggers con los
nombres reales, y comprobarlo con un login que tenga `VIEW DEFINITION`.

## 8. Después del corte

- Cuando todo esté estable, cambiar el valor por defecto de `ESQUEMA_POR_DEFECTO` en
  `lib/db/esquema.ts` de `dmc` a `tecnico` y retirar la dependencia de la variable.
- Las migraciones nuevas se escriben con `$(ESQUEMA).tabla` (sin `dmc.` ni `USE`) y se aplican con
  `npm run migrar -- --aplicar` y el login de migraciones (`DB_MIGRATIONS_USER`).
