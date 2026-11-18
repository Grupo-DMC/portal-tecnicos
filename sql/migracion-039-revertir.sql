/* =====================================================================
   DMC Contingencia · revierte la migración 039 — motivo al desactivar
   Quita las restricciones que exigen el motivo, el historial de cambios de
   estado y la columna motivo_inactivo de marca, mall, técnico, usuario y
   contacto. Cliente y sucursal conservan la suya (es de la migración 009).
   Se pierde el historial: quién desactivó qué, cuándo y por qué.

   Uso:  sqlcmd -S servidor -d DMC_Contingencia -i sql/migracion-039-revertir.sql
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

USE DMC_Contingencia;
GO

DECLARE @tablas TABLE (nombre sysname);
INSERT INTO @tablas VALUES ('cliente'), ('marca'), ('mall'), ('sucursal'), ('tecnico'), ('usuario'), ('contacto');

DECLARE @t sysname, @sql nvarchar(max);
DECLARE c CURSOR LOCAL FAST_FORWARD FOR SELECT nombre FROM @tablas;
OPEN c;
FETCH NEXT FROM c INTO @t;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF OBJECT_ID(N'dmc.ck_' + @t + N'_motivo_inactivo', N'C') IS NOT NULL
    BEGIN
        SET @sql = N'ALTER TABLE dmc.' + QUOTENAME(@t) + N' DROP CONSTRAINT ' + QUOTENAME(N'ck_' + @t + N'_motivo_inactivo') + N';';
        EXEC sp_executesql @sql;
    END
    IF @t NOT IN ('cliente', 'sucursal') AND COL_LENGTH(N'dmc.' + @t, 'motivo_inactivo') IS NOT NULL
    BEGIN
        SET @sql = N'ALTER TABLE dmc.' + QUOTENAME(@t) + N' DROP COLUMN motivo_inactivo;';
        EXEC sp_executesql @sql;
    END
    FETCH NEXT FROM c INTO @t;
END
CLOSE c;
DEALLOCATE c;
GO

IF OBJECT_ID('dmc.cambio_estado', 'U') IS NOT NULL
    DROP TABLE dmc.cambio_estado;
GO

DELETE FROM dmc.schema_version WHERE version = 39;
GO

PRINT 'Migración 039 revertida.';
GO
