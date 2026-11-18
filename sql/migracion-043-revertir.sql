/* =====================================================================
   DMC Contingencia · revierte la migración 043 — avisos por correo
   Borra las preferencias de push y correo, los ajustes de correo de cada
   cuenta, la cola y el registro de envíos. La campanita y el push siguen
   como antes (el push vuelve a seguir al nivel «Avisar»).

   Antes de revertir, apaga AVISOS_CORREO_ACTIVO en el despliegue.

   Uso:  sqlcmd -S servidor -d DMC_Contingencia -i sql/migracion-043-revertir.sql
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

USE DMC_Contingencia;
GO

IF OBJECT_ID('dmc.correo_aviso', 'U') IS NOT NULL DROP TABLE dmc.correo_aviso;
IF OBJECT_ID('dmc.correo_aviso_lote', 'U') IS NOT NULL DROP TABLE dmc.correo_aviso_lote;
IF OBJECT_ID('dmc.notificacion_correo', 'U') IS NOT NULL DROP TABLE dmc.notificacion_correo;
IF OBJECT_ID('dmc.notificacion_canal', 'U') IS NOT NULL DROP TABLE dmc.notificacion_canal;
GO

DELETE FROM dmc.schema_version WHERE version = 43;
GO

PRINT 'Migración 043 revertida.';
GO
