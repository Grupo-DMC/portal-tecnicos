import { T } from "@/lib/db/esquema";

// Versión del esquema — tecnico.schema_version (migración 025).
//
// La app da por hecho que la base tiene aplicadas todas las migraciones hasta
// VERSION_ESQUEMA: no hay caminos alternativos para una base atrasada. Cada
// migración nueva registra su número en tecnico.schema_version y sube esta
// constante en el mismo commit.

/** La versión que este código necesita. */
// 44 y no 45: la app nueva ya no lee tecnico.usuario.rol, así que funciona antes y
// después de que la 045 borre esa columna.

export const VERSION_ESQUEMA = 44;

/** La versión aplicada en la base: la mayor registrada. Para una consulta. */
export const SQL_VERSION_ESQUEMA = `(SELECT MAX(version) FROM ${T.schema_version})`;
