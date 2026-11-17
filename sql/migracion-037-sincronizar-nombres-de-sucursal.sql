/* =====================================================================
   DMC Contingencia · migración 037 — nombres de sucursal al día
   Microsoft SQL Server 2022 · esquema dmc

   Qué hace:

     Las sucursales en un mall se llaman «Cliente · Marca · Mall» (migración
     033), pero ese texto solo se armaba al crear: al cambiar la marca o el
     mall de una sucursal, o al renombrar un cliente, una marca o un mall,
     el nombre guardado quedaba viejo y así lo mostraban «Agendar visita»,
     las visitas, los filtros y las actas.

     La app ahora lo recalcula en cada una de esas operaciones
     (sincronizarNombresDeSucursales, lib/data/maestros.ts). Esta migración
     deja bien los que ya habían quedado desfasados, con la misma regla.

     El nombre de antes queda en dmc.sucursal_nombre_anterior solo si esa
     sucursal no tenía ya un registro (el más antiguo manda), para poder
     consultarlo. Las sucursales a la calle (sin mall) no se tocan.

   Requisito: tener aplicada la migración 033.
   Es idempotente: una sucursal con el nombre al día no cambia.

   Uso:  sqlcmd -S servidor -d DMC_Contingencia -i sql/migracion-037-sincronizar-nombres-de-sucursal.sql
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

USE DMC_Contingencia;
GO

IF NOT EXISTS (SELECT 1 FROM dmc.schema_version WHERE version = 36)
    THROW 50037, 'Falta aplicar la migración 036 antes que esta.', 1;
GO

IF OBJECT_ID('tempdb..#cambios') IS NOT NULL DROP TABLE #cambios;

BEGIN TRANSACTION;

;WITH base AS (
    SELECT s.id, s.marca_id, s.nombre AS actual,
           LEFT(c.nombre_fantasia
                + CASE WHEN m.nombre <> c.nombre_fantasia THEN N' · ' + m.nombre ELSE N'' END
                + N' · ' + ml.nombre, 120) AS fusionado
      FROM dmc.sucursal s
      JOIN dmc.cliente c  ON c.id  = s.cliente_id
      JOIN dmc.marca   m  ON m.id  = s.marca_id
      JOIN dmc.mall    ml ON ml.id = s.mall_id
),
numerado AS (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY marca_id, fusionado ORDER BY id) AS n FROM base
),
nuevo AS (
    SELECT id, actual,
           CASE WHEN n = 1 THEN fusionado
                ELSE LEFT(fusionado, 120 - LEN(N' (' + CAST(n AS nvarchar(10)) + N')'))
                     + N' (' + CAST(n AS nvarchar(10)) + N')'
           END AS nombre
      FROM numerado
)
SELECT id, actual, nombre INTO #cambios FROM nuevo
 WHERE nombre COLLATE Latin1_General_BIN2 <> actual COLLATE Latin1_General_BIN2;

DELETE c FROM #cambios c
 WHERE EXISTS (SELECT 1 FROM dmc.sucursal o
                WHERE o.marca_id = (SELECT marca_id FROM dmc.sucursal WHERE id = c.id)
                  AND o.nombre = c.nombre AND o.id <> c.id
                  AND o.id NOT IN (SELECT id FROM #cambios));

IF OBJECT_ID('dmc.sucursal_nombre_anterior', 'U') IS NOT NULL
    INSERT INTO dmc.sucursal_nombre_anterior (sucursal_id, nombre_anterior)
    SELECT c.id, c.actual FROM #cambios c
     WHERE NOT EXISTS (SELECT 1 FROM dmc.sucursal_nombre_anterior a WHERE a.sucursal_id = c.id);

-- Dos pasos para no chocar con la restricción única mientras se renombra.
UPDATE s SET nombre = N'~' + CAST(s.id AS nvarchar(20)) FROM dmc.sucursal s JOIN #cambios c ON c.id = s.id;
UPDATE s SET nombre = c.nombre FROM dmc.sucursal s JOIN #cambios c ON c.id = s.id;

DROP TABLE #cambios;

COMMIT TRANSACTION;
GO

IF NOT EXISTS (SELECT 1 FROM dmc.schema_version WHERE version = 37)
    INSERT INTO dmc.schema_version (version, descripcion)
    VALUES (37, N'Nombres de sucursal en mall al día con su cliente, marca y mall');
GO

PRINT 'Migración 037 aplicada.';
GO
