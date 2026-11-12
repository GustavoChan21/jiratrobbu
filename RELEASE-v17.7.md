# Release v17.7.0 — Jira Interno TROBBU

## Alcance

Release de sincronización **Live Data** sobre v17.6.0. El objetivo es que las vistas activas reflejen cambios de Supabase sin obligar al usuario a cambiar de módulo/tab, conservando al mismo tiempo `view`, `tab` y `mode` en la URL.

## Arquitectura de estado

La aplicación actual no usa Redux: es un frontend React UMD/Babel con un `WorkspaceApp` raíz y estado compartido mediante hooks. Agregar Redux únicamente para resolver refresco habría creado una segunda fuente de verdad y una migración transversal de alto riesgo. v17.7 introduce un coordinador central de Live Data sobre el estado existente, dejando una futura migración a store externo como refactor independiente.

El coordinador aplica dos fases:

1. **Patch inmediato:** INSERT/UPDATE/DELETE recibido por Realtime se fusiona directamente en la colección visible.
2. **Reconciliación silenciosa:** contadores/relaciones se revalidan con debounce y solo las tablas estructurales disparan un refetch completo del workspace.

## Realtime / Live Data

- Canal único `workspace-live-v2-${workspaceId}` para evitar suscripciones duplicadas por módulo.
- Sincronización directa de tickets, sprints, Helpdesk, Knowledge, Vacaciones, configuraciones, catálogos y notificaciones.
- Revisión de detalles abiertos de Ticket, Sprint y Helpdesk mediante `liveRevision` sin cerrar el modal.
- Knowledge actualiza multimedia/preview en vivo sin sustituir el contenido no guardado del editor.
- Vacaciones elimina el segundo canal `vacation-meta-*` y consume la revisión central.
- Al reconectar, recuperar foco, volver online o hacer visible la pestaña se ejecuta reconciliación silenciosa si la información está potencialmente obsoleta.
- Polling de recuperación cada 15 s solo cuando el socket está degradado y la pestaña está visible.
- Se elimina el polling redundante de notificaciones.
- Indicador de estado: **En vivo / Conectando / Reconectando**.
- La primera conexión Realtime fuerza una reconciliación corta para cerrar la carrera entre consulta inicial y suscripción.

## Supabase

`upgrade-v17.7.sql`:

- Agrega a `supabase_realtime`: `workspace_settings`, `helpdesk_departments`, `helpdesk_request_types`, `helpdesk_activity` y `workspaces`.
- Configura `REPLICA IDENTITY FULL` en tablas filtradas por workspace/id para que DELETE pueda respetar filtros de Postgres Changes.
- La migración de publicación es idempotente y puede convivir con instalaciones donde alguna tabla ya esté publicada.

La migración base fue aplicada al proyecto productivo `Jira Interno Trobbu` como `jira_v17_7_live_data_sync`; durante el QA se añadió `jira_v17_7_helpdesk_assignment_live_sync` para completar `REPLICA IDENTITY FULL` en cola/historial de asignación. El archivo consolidado `upgrade-v17.7.sql` ya contiene ambos ajustes.

## URL y navegación

- `view`, `tab` y `mode` siguen preservándose al recargar.
- `popstate` restaura `mode=table` cuando el parámetro ya no existe, evitando arrastrar un modo anterior.
- La sincronización automática limpia `tab` y `mode` cuando no corresponden a la vista actual.
- Los refrescos Live no navegan, no modifican la URL y no desmontan la vista activa.

## Protección contra carreras

- Cada carga completa recibe un `loadSeq`; una respuesta antigua no puede sobrescribir una carga más nueva ni datos de otro workspace.
- Los timers de Realtime se deduplican.
- Los contadores derivados (`list_module_counts`, `get_navigation_counts`) se refrescan por separado del dataset completo.
- Un refetch completo queda reservado para cambios estructurales de miembros, roles, perfiles, productos o workspace.

## QA

- **272 PASS / 0 FAIL** en `npm run qa`.
- Supabase Health advisor: **0 incidencias** después de la migración.
- Publicación Realtime y `relreplident = full` verificados directamente en producción.
- Persiste el warning histórico no bloqueante de Auth: Leaked Password Protection desactivado.
