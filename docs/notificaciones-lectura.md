# Campanita: estado de lectura por notificación

Decisión del 2026-11-27: se queda así, **sin migración por ahora**. No se toca el esquema sin confirmación.

## Cómo funciona hoy

- El servidor guarda **un solo número por usuario**: `notificacion_usuario.leido_hasta`, el id de actividad hasta el que ya vio todo.
- **Al tocar un aviso** (como en la demo), el aviso queda leído **solo en ese navegador**. Se guarda en `localStorage`, clave `dmc:ntf-leidas:<usuarioId>`, con la lista de ids.
- **«Marcar todo como leído»** mueve `leido_hasta` al aviso más nuevo y vacía la lista local. Leer todos los avisos uno a uno hace lo mismo.
- **Abrir la campanita no marca nada como leído.** La demo tampoco lo hace.
- **El número rojo** es la cuenta del servidor (avisos «Avisar» con id mayor a `leido_hasta`) menos los que se leyeron en este navegador.

## Limitación

**La lectura de un aviso suelto no se sincroniza entre dispositivos.**
- Ejemplo: un aviso leído en el computador sigue como «Nuevo» en el celular o en otro navegador.
- Solo se corrige en el otro equipo con «Marcar todo como leído», o cuando se leen todos.
- Borrar los datos del navegador también devuelve como «Nuevo» lo que se había leído uno a uno.

## Propuesta de migración (pendiente para la fase de datos reales)

Tabla de lecturas por usuario y notificación:

```sql
CREATE TABLE <esquema>.notificacion_lectura (
  usuario_id   BIGINT    NOT NULL REFERENCES <esquema>.usuario(id),
  actividad_id BIGINT    NOT NULL REFERENCES <esquema>.actividad(id) ON DELETE CASCADE,
  leido_en     DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  CONSTRAINT PK_notificacion_lectura PRIMARY KEY (usuario_id, actividad_id)
);
```

**Cambios que traería:**
- **Bandeja** (`bandejaDe`):
  - cada aviso viene con `leida` (un `LEFT JOIN` a la tabla nueva);
  - `noLeidas` cuenta los avisos con id mayor a `leido_hasta` que no tengan lectura.
- **Nueva acción `marcarNotificacionLeidaAction(id)`:**
  - hace un `MERGE` de una fila;
  - reemplaza el `localStorage` de `components/admin/Campanita.tsx`.
- **«Marcar todo»:**
  - sigue moviendo `leido_hasta`;
  - borra las lecturas sueltas de ese usuario con id menor o igual al nuevo `leido_hasta`, que ya no hacen falta.
- **Limpieza:** la actividad se muestra 30 días, así que las lecturas más viejas se pueden borrar en el mismo trabajo que limpia la actividad.
- **Tamaño acotado:** a lo más una fila por usuario y aviso, y solo de lo que se lee suelto.
