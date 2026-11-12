# Jira Interno TROBBU v17.9.0

Release sobre v17.8.0 enfocada en **Live Data/counters resilientes**, **modo claro/oscuro**, simplificación del **workflow de Helpdesk** y mejoras de UI en Vacaciones.

## Principales cambios

### Counters + Realtime

- Snapshot único de counters mediante `get_live_counters`.
- Patch inmediato al recibir Realtime.
- Reconciliación de counters cada 20 s.
- Reconciliación ligera de filas principales cada 60 s para recuperar eventos WebSocket perdidos sin recargar todo el sistema.
- Comentarios, actividad y adjuntos/evidencias en Ticket, Sprint y Helpdesk se refrescan mientras el modal permanece abierto.
- Tablas Live relevantes configuradas con `REPLICA IDENTITY FULL`.

### Tema claro / oscuro

El botón de tema aparece desde login y en la barra superior. La selección se guarda localmente y, al iniciar sesión, también en `profiles.theme_preference`, por lo que sigue al usuario entre sesiones/dispositivos compatibles.

### Helpdesk

Estados operativos:

**Nuevo → En revisión → Atendido → Cerrado**

`Resuelto` deja de existir como estado. Los históricos fueron normalizados a Cerrado.

En la tabla interna ahora se puede:

- reasignar responsable directamente;
- cambiar estado directamente;
- decidir requerimientos inline.

Después de `Atendido`, el solicitante puede confirmar la solución y cerrar. Un usuario con permiso `manage_helpdesk` también puede cerrar cuando la solicitud ya está en `Atendido` y el solicitante no lo hace.

### Vacaciones

`Descontar del saldo anual` y `Tipo activo` se muestran como switches en el CRUD de tipos de ausencia.

## Base de datos

Aplicar `upgrade-v17.9.sql` si se instala en otro proyecto. En producción TROBBU la migración ya fue aplicada y `database.sql` termina con el mismo bloque consolidado.

## Edge Functions

Archivos incluidos y productivos:

- `trobbu-knowledge-assistant.ts`
- `vacation-impact-assistant.ts`
- `auto-assign-helpdesk.ts` — producción v7
- `process-notifications.ts` — producción v14
- `translate-knowledge-version.ts`
- demás funciones existentes del proyecto.

## QA

**327 PASS / 0 FAIL** con `npm run qa`.

Consulta `QA-v17.9.md`, `RELEASE-v17.9.md` y `qa-v17.9-output.txt`.

## Paquetes

Se entregan dos variantes:

1. **FULL**: mantiene todos los documentos, migraciones, QA y releases históricos como archivos individuales.
2. **COMPACT**: misma aplicación y funcionalidad; agrupa históricos no necesarios en runtime dentro de `_history-v17.8-and-earlier.zip` para reducir la cantidad de archivos del proyecto.
