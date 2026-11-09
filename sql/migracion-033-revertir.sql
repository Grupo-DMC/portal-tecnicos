/* Revierte la migración 033: devuelve a cada sucursal el nombre que tenía antes. */
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

USE DMC_Contingencia;
GO

IF OBJECT_ID('dmc.sucursal_nombre_anterior', 'U') IS NULL
    THROW 50034, 'No hay nada que revertir: falta dmc.sucursal_nombre_anterior.', 1;
GO

BEGIN TRANSACTION;

UPDATE s SET nombre = N'~' + CAST(s.id AS nvarchar(20))
  FROM dmc.sucursal s JOIN dmc.sucursal_nombre_anterior a ON a.sucursal_id = s.id;

UPDATE s SET nombre = a.nombre_anterior
  FROM dmc.sucursal s JOIN dmc.sucursal_nombre_anterior a ON a.sucursal_id = s.id;

DROP TABLE dmc.sucursal_nombre_anterior;
DELETE FROM dmc.schema_version WHERE version = 33;

COMMIT TRANSACTION;
GO

PRINT 'Migración 033 revertida.';
GO
