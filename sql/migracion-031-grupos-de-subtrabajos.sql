/* =====================================================================
   DMC Contingencia · migración 031 — varios grupos de subtrabajos
   Microsoft SQL Server 2022 · esquema dmc

   Qué agrega, y para qué:

     1. dmc.catalogo_trabajo_subtrabajo.grupo
                                   Un trabajo puede tener más de un grupo de
                                   subtrabajos, cada uno con su nombre y sus
                                   opciones (p. ej. «Antenas» y «Cables»).
                                   NULL = el primer grupo, el que se titula con
                                   dmc.catalogo_trabajo.grupo_label, como hasta
                                   ahora. Con texto = un grupo adicional con ese
                                   nombre. Los subtrabajos de un mismo grupo van
                                   seguidos por su `orden`.

   La etiqueta sigue siendo única por trabajo (uq_catalogo_trabajo_subtrabajo):
   el acta guarda el subtrabajo marcado por su etiqueta, así que dos grupos del
   mismo trabajo no pueden repetir opción.

   Requisito: tener aplicada la migración 030.
   Es idempotente: se puede correr varias veces sin romper nada.

   Uso:  sqlcmd -S servidor -d DMC_Contingencia -i sql/migracion-031-grupos-de-subtrabajos.sql
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

USE DMC_Contingencia;
GO

IF NOT EXISTS (SELECT 1 FROM dmc.schema_version WHERE version = 30)
    THROW 50031, 'Falta aplicar la migración 030 antes que esta.', 1;
GO

IF COL_LENGTH('dmc.catalogo_trabajo_subtrabajo', 'grupo') IS NULL
    ALTER TABLE dmc.catalogo_trabajo_subtrabajo ADD grupo nvarchar(60) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM dmc.schema_version WHERE version = 31)
    INSERT INTO dmc.schema_version (version, descripcion)
    VALUES (31, N'Varios grupos de subtrabajos por trabajo');
GO

PRINT 'Migración 031 aplicada.';
GO
