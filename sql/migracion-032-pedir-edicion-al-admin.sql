/* =====================================================================
   DMC Contingencia · migración 032 — el técnico pide editar un acta cerrada
   Microsoft SQL Server 2022 · esquema dmc

   Qué agrega, y para qué:

     dmc.visita_ejecucion.edicion_solicitada_en ..
                           cuándo el técnico pidió a coordinación poder
                           corregir su acta (cuando ya pasó el plazo de un día).
                           Coordinación lo ve en la ficha de la visita y lo
                           atiende con «Permitir editar al técnico», que lo
                           borra. NULL = sin solicitud pendiente.

     dmc.visita_ejecucion.edicion_solicitada_motivo ..
                           qué quiere corregir, con sus palabras (opcional).

   Requisito: tener aplicada la migración 031.
   Es idempotente: se puede correr varias veces sin romper nada.

   Uso:  sqlcmd -S servidor -d DMC_Contingencia -i sql/migracion-032-pedir-edicion-al-admin.sql
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

USE DMC_Contingencia;
GO

IF NOT EXISTS (SELECT 1 FROM dmc.schema_version WHERE version = 31)
    THROW 50032, 'Falta aplicar la migración 031 antes que esta.', 1;
GO

IF COL_LENGTH('dmc.visita_ejecucion', 'edicion_solicitada_en') IS NULL
    ALTER TABLE dmc.visita_ejecucion ADD
        edicion_solicitada_en     datetime2(0)  NULL,
        edicion_solicitada_motivo nvarchar(500) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM dmc.schema_version WHERE version = 32)
    INSERT INTO dmc.schema_version (version, descripcion)
    VALUES (32, N'El técnico pide editar un acta cerrada (visita_ejecucion.edicion_solicitada_en)');
GO

PRINT 'Migración 032 aplicada.';
GO
