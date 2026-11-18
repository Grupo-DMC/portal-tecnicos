/* =====================================================================
   DMC Contingencia · migración 040 — categorías de los tipos de problema
   Microsoft SQL Server 2022 · esquema dmc

   Los tipos de problema del checklist (Lista 2) pasan a tener la misma
   jerarquía que los trabajos: categoría → tipo de problema (subcategoría) →
   subdetalles. La categoría es una sección del checklist, la misma tabla que
   ya agrupa motivos y trabajos (migración 020).

   Qué cambia:

     1. dmc.catalogo_seccion.tipo ....... acepta 'PROBLEMA' además de 'MOTIVO'
                                          y 'TRABAJO'.
     2. dmc.catalogo_problema.seccion_id  la categoría del tipo de problema.
                                          Null = «sin categoría»: sigue
                                          saliendo, suelto.
     3. Categoría por defecto ........... «General». Todos los tipos que ya
                                          existen (activos e inactivos) quedan
                                          en ella. Se hace solo la primera vez,
                                          cuando nace la columna: correrla de
                                          nuevo no vuelve a mover un tipo que el
                                          panel cambió de categoría a propósito.

   No se toca dmc.problema: las visitas apuntan al tipo por su código
   (tipo_codigo), que no cambia. Las actas ya registradas se siguen viendo
   igual.

   Requisito: tener aplicada la migración 039.
   Es idempotente: se puede correr varias veces sin romper nada.

   Uso:  sqlcmd -S servidor -d DMC_Contingencia -i sql/migracion-040-categorias-de-problema.sql
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

USE DMC_Contingencia;
GO

IF NOT EXISTS (SELECT 1 FROM dmc.schema_version WHERE version = 39)
    THROW 50040, 'Falta aplicar la migración 039 antes que esta.', 1;
GO

-- ── 1. Una sección también puede agrupar tipos de problema ────────────────
IF EXISTS (
    SELECT 1 FROM sys.check_constraints
     WHERE name = 'ck_catalogo_seccion_tipo' AND definition NOT LIKE '%PROBLEMA%')
BEGIN
    BEGIN TRANSACTION;
    ALTER TABLE dmc.catalogo_seccion DROP CONSTRAINT ck_catalogo_seccion_tipo;
    ALTER TABLE dmc.catalogo_seccion ADD CONSTRAINT ck_catalogo_seccion_tipo
        CHECK (tipo IN ('MOTIVO', 'TRABAJO', 'PROBLEMA'));
    COMMIT TRANSACTION;
END
GO

-- ── 2 y 3. La categoría del tipo, y «General» para los que ya existen ─────
IF COL_LENGTH('dmc.catalogo_problema', 'seccion_id') IS NULL
BEGIN
    BEGIN TRANSACTION;
    ALTER TABLE dmc.catalogo_problema ADD seccion_id bigint NULL
        CONSTRAINT fk_cat_problema_seccion FOREIGN KEY REFERENCES dmc.catalogo_seccion (id);
    -- La columna recién nacida no se puede nombrar en el mismo lote: va dinámico.
    EXEC (N'
        IF EXISTS (SELECT 1 FROM dmc.catalogo_problema)
        BEGIN
            DECLARE @general bigint =
                (SELECT id FROM dmc.catalogo_seccion WHERE tipo = ''PROBLEMA'' AND nombre = N''General'');
            IF @general IS NULL
            BEGIN
                INSERT INTO dmc.catalogo_seccion (tipo, nombre, orden, activo)
                VALUES (''PROBLEMA'', N''General'', 1, 1);
                SET @general = SCOPE_IDENTITY();
            END
            UPDATE dmc.catalogo_problema SET seccion_id = @general WHERE seccion_id IS NULL;
        END
    ');
    COMMIT TRANSACTION;
END
GO

IF NOT EXISTS (SELECT 1 FROM dmc.schema_version WHERE version = 40)
    INSERT INTO dmc.schema_version (version, descripcion)
    VALUES (40, N'Categorías de los tipos de problema');
GO

PRINT 'Migración 040 aplicada.';
GO
