/* =====================================================================
   DMC Contingencia · migración 038 — problemas registrados desde el panel
   Microsoft SQL Server 2022 · esquema dmc

   Coordinación puede registrar problemas en una visita que todavía no se
   cierra (programada, en curso, pendiente…). Hasta ahora, al cerrar el acta,
   el servidor borraba los problemas «que nacieron ahí y que nadie más agarró»
   y los volvía a escribir con lo que traía el celular: un problema anotado
   desde el panel se habría perdido en silencio.

   Qué agrega:

     dmc.problema.registrado_en_panel .. 1 = lo anotó coordinación desde el
                                          panel; el cierre del acta no lo
                                          toca. 0 (por defecto) = lo levantó el
                                          técnico en el acta, como siempre.

   Los problemas que ya existen quedan en 0: nada cambia para ellos.

   Requisito: tener aplicada la migración 036.
   Es idempotente: se puede correr varias veces sin romper nada.

   Uso:  sqlcmd -S servidor -d DMC_Contingencia -i sql/migracion-038-problemas-desde-el-panel.sql
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

USE DMC_Contingencia;
GO

IF NOT EXISTS (SELECT 1 FROM dmc.schema_version WHERE version = 36)
    THROW 50038, 'Falta aplicar la migración 036 antes que esta.', 1;
GO

IF COL_LENGTH('dmc.problema', 'registrado_en_panel') IS NULL
    ALTER TABLE dmc.problema
        ADD registrado_en_panel bit NOT NULL CONSTRAINT df_problema_en_panel DEFAULT (0);
GO

IF NOT EXISTS (SELECT 1 FROM dmc.schema_version WHERE version = 38)
    INSERT INTO dmc.schema_version (version, descripcion)
    VALUES (38, N'Problemas registrados desde el panel en visitas sin cerrar');
GO

PRINT 'Migración 038 aplicada.';
GO
