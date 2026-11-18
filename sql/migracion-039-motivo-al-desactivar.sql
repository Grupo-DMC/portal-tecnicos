/* =====================================================================
   DMC Contingencia · migración 039 — motivo obligatorio al desactivar
   Microsoft SQL Server 2022 · esquema dmc

   Regla nueva: nada de los maestros queda inactivo sin que conste por qué.
   Hasta ahora solo clientes y sucursales pedían el motivo, y solo el panel lo
   exigía. Desde esta migración lo exige la base.

   Qué agrega:

     1. motivo_inactivo ......... nvarchar(400) en dmc.marca, dmc.mall,
                                  dmc.tecnico, dmc.usuario y dmc.contacto
                                  (cliente y sucursal ya lo tenían, migración
                                  009). Es el motivo vigente: se borra al
                                  reactivar.
     2. ck_<tabla>_motivo_inactivo  en las siete tablas: activo = 0 exige un
                                  motivo con texto. Los inactivos que hoy no
                                  tienen motivo reciben uno que dice que se
                                  desactivaron antes de esta regla, para que la
                                  restricción entre validada (WITH CHECK).
     3. dmc.cambio_estado ....... el historial: una fila por cada vez que algo
                                  se desactiva o se reactiva, con quién, cuándo
                                  y por qué. Solo se agrega; la app nunca la
                                  actualiza ni la borra. Sin FK a dmc.usuario,
                                  como dmc.auditoria, para sobrevivir a
                                  cualquier cambio de las cuentas.

   Requisito: tener aplicada la migración 038.
   Es idempotente: se puede correr varias veces sin romper nada.

   Uso:  sqlcmd -S servidor -d DMC_Contingencia -i sql/migracion-039-motivo-al-desactivar.sql
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

USE DMC_Contingencia;
GO

IF NOT EXISTS (SELECT 1 FROM dmc.schema_version WHERE version = 38)
    THROW 50039, 'Falta aplicar la migración 038 antes que esta.', 1;
GO

-- ── 1. La columna del motivo donde faltaba ────────────────────────────────
IF COL_LENGTH('dmc.marca', 'motivo_inactivo') IS NULL
    ALTER TABLE dmc.marca ADD motivo_inactivo nvarchar(400) NULL;
IF COL_LENGTH('dmc.mall', 'motivo_inactivo') IS NULL
    ALTER TABLE dmc.mall ADD motivo_inactivo nvarchar(400) NULL;
IF COL_LENGTH('dmc.tecnico', 'motivo_inactivo') IS NULL
    ALTER TABLE dmc.tecnico ADD motivo_inactivo nvarchar(400) NULL;
IF COL_LENGTH('dmc.usuario', 'motivo_inactivo') IS NULL
    ALTER TABLE dmc.usuario ADD motivo_inactivo nvarchar(400) NULL;
IF COL_LENGTH('dmc.contacto', 'motivo_inactivo') IS NULL
    ALTER TABLE dmc.contacto ADD motivo_inactivo nvarchar(400) NULL;
GO

-- ── 2. Historial de activaciones y desactivaciones ────────────────────────
IF OBJECT_ID('dmc.cambio_estado', 'U') IS NULL
BEGIN
    CREATE TABLE dmc.cambio_estado (
        id             bigint         IDENTITY(1,1) NOT NULL,
        entidad        varchar(20)    NOT NULL,     -- cliente, marca, mall…
        entidad_id     bigint         NOT NULL,
        activo         bit            NOT NULL,     -- el estado en que quedó
        motivo         nvarchar(400)  NULL,         -- obligatorio al desactivar
        usuario_id     bigint         NULL,
        usuario_email  nvarchar(160)  NULL,
        creado_en      datetime2(0)   NOT NULL CONSTRAINT df_cambio_estado_creado DEFAULT (SYSDATETIME()),
        CONSTRAINT pk_cambio_estado PRIMARY KEY (id),
        CONSTRAINT ck_cambio_estado_entidad CHECK (
            entidad IN ('cliente', 'marca', 'mall', 'sucursal', 'tecnico', 'usuario', 'contacto')),
        CONSTRAINT ck_cambio_estado_motivo CHECK (
            activo = 1 OR (motivo IS NOT NULL AND LEN(LTRIM(RTRIM(motivo))) > 0))
    );
    CREATE INDEX ix_cambio_estado_entidad ON dmc.cambio_estado (entidad, entidad_id, id DESC);
END
GO

-- ── 3. La base exige el motivo ────────────────────────────────────────────
-- Las siete tablas tienen la misma forma (activo, motivo_inactivo): se recorren
-- con SQL dinámico. Los nombres salen de esta lista fija, nunca de afuera.
DECLARE @tablas TABLE (nombre sysname);
INSERT INTO @tablas VALUES ('cliente'), ('marca'), ('mall'), ('sucursal'), ('tecnico'), ('usuario'), ('contacto');

DECLARE @t sysname, @sql nvarchar(max);
DECLARE c CURSOR LOCAL FAST_FORWARD FOR SELECT nombre FROM @tablas;
OPEN c;
FETCH NEXT FROM c INTO @t;
WHILE @@FETCH_STATUS = 0
BEGIN
    -- Los inactivos de antes de la regla quedan con un motivo que lo dice.
    SET @sql = N'UPDATE dmc.' + QUOTENAME(@t) + N'
                    SET motivo_inactivo = N''Sin motivo registrado: se desactivó antes de que el sistema lo pidiera.''
                  WHERE activo = 0
                    AND (motivo_inactivo IS NULL OR LEN(LTRIM(RTRIM(motivo_inactivo))) = 0);';
    EXEC sp_executesql @sql;

    IF OBJECT_ID(N'dmc.ck_' + @t + N'_motivo_inactivo', N'C') IS NULL
    BEGIN
        SET @sql = N'ALTER TABLE dmc.' + QUOTENAME(@t) + N' WITH CHECK
                       ADD CONSTRAINT ' + QUOTENAME(N'ck_' + @t + N'_motivo_inactivo') + N'
                       CHECK (activo = 1 OR (motivo_inactivo IS NOT NULL AND LEN(LTRIM(RTRIM(motivo_inactivo))) > 0));';
        EXEC sp_executesql @sql;
    END
    FETCH NEXT FROM c INTO @t;
END
CLOSE c;
DEALLOCATE c;
GO

IF NOT EXISTS (SELECT 1 FROM dmc.schema_version WHERE version = 39)
    INSERT INTO dmc.schema_version (version, descripcion)
    VALUES (39, N'Motivo obligatorio al desactivar e historial de cambios de estado');
GO

PRINT 'Migración 039 aplicada.';
GO
