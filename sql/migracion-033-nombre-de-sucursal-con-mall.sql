/* =====================================================================
   DMC Contingencia · migración 033 — nombre de sucursal «Cliente · Marca · Mall»
   Microsoft SQL Server 2022 · esquema dmc

   Qué hace:

     Toda sucursal que está en un mall pasa a llamarse
     «Cliente · Marca · Mall» (la marca se omite si repite el nombre del
     cliente), igual que el nombre con que ahora se crean.
     Las sucursales a la calle (sin mall) no se tocan.

     Si dos sucursales de la misma marca en el mismo mall quedarían con el
     mismo nombre (la base no lo permite), la segunda en adelante lleva
     « (2)», « (3)»… al final. El nombre se corta a 120 caracteres.

     El nombre de antes queda en dmc.sucursal_nombre_anterior, para poder
     volver atrás con migracion-033-revertir.sql.

   Requisito: tener aplicada la migración 032.
   Es idempotente: una sucursal que ya tiene su nombre fusionado no cambia.

   Uso:  sqlcmd -S servidor -d DMC_Contingencia -i sql/migracion-033-nombre-de-sucursal-con-mall.sql
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

USE DMC_Contingencia;
GO

IF NOT EXISTS (SELECT 1 FROM dmc.schema_version WHERE version = 32)
    THROW 50033, 'Falta aplicar la migración 032 antes que esta.', 1;
GO

IF OBJECT_ID('dmc.sucursal_nombre_anterior', 'U') IS NULL
    CREATE TABLE dmc.sucursal_nombre_anterior (
        sucursal_id     bigint        NOT NULL CONSTRAINT pk_sucursal_nombre_anterior PRIMARY KEY,
        nombre_anterior nvarchar(120) NOT NULL,
        cambiado_en     datetime2(0)  NOT NULL CONSTRAINT df_sucursal_nombre_anterior DEFAULT (SYSDATETIME())
    );
GO

BEGIN TRANSACTION;

;WITH base AS (
    SELECT s.id,
           s.marca_id,
           s.nombre AS actual,
           LEFT(
               c.nombre_fantasia
               + CASE WHEN m.nombre <> c.nombre_fantasia THEN N' · ' + m.nombre ELSE N'' END
               + N' · ' + ml.nombre,
               120) AS fusionado
      FROM dmc.sucursal s
      JOIN dmc.cliente c  ON c.id  = s.cliente_id
      JOIN dmc.marca   m  ON m.id  = s.marca_id
      JOIN dmc.mall    ml ON ml.id = s.mall_id
),
numerado AS (
    SELECT *,
           ROW_NUMBER() OVER (PARTITION BY marca_id, fusionado ORDER BY id) AS n
      FROM base
),
nuevo AS (
    SELECT id, actual,
           CASE WHEN n = 1 THEN fusionado
                ELSE LEFT(fusionado, 120 - LEN(N' (' + CAST(n AS nvarchar(10)) + N')'))
                     + N' (' + CAST(n AS nvarchar(10)) + N')'
           END AS nombre
      FROM numerado
)
SELECT id, actual, nombre INTO #cambios FROM nuevo WHERE nombre <> actual;

-- Una sucursal sin mall de la misma marca ya podría llamarse así: esas quedan como están.
DELETE c FROM #cambios c
 WHERE EXISTS (SELECT 1 FROM dmc.sucursal o
                WHERE o.marca_id = (SELECT marca_id FROM dmc.sucursal WHERE id = c.id)
                  AND o.nombre = c.nombre AND o.id <> c.id
                  AND o.id NOT IN (SELECT id FROM #cambios));

INSERT INTO dmc.sucursal_nombre_anterior (sucursal_id, nombre_anterior)
SELECT c.id, c.actual FROM #cambios c
 WHERE NOT EXISTS (SELECT 1 FROM dmc.sucursal_nombre_anterior a WHERE a.sucursal_id = c.id);

-- Dos pasos para no chocar con la restricción única mientras se renombra.
UPDATE s SET nombre = N'~' + CAST(s.id AS nvarchar(20))
  FROM dmc.sucursal s JOIN #cambios c ON c.id = s.id;

UPDATE s SET nombre = c.nombre
  FROM dmc.sucursal s JOIN #cambios c ON c.id = s.id;

--PRINT CONCAT('Sucursales renombradas: ', (SELECT COUNT(*) FROM #cambios));
DROP TABLE #cambios;

COMMIT TRANSACTION;
GO

IF NOT EXISTS (SELECT 1 FROM dmc.schema_version WHERE version = 33)
    INSERT INTO dmc.schema_version (version, descripcion)
    VALUES (33, N'Las sucursales en un mall se llaman «Cliente · Marca · Mall»');
GO

PRINT 'Migración 033 aplicada.';
GO

