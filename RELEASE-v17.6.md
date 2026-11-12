# Release v17.6.0 — Jira Interno TROBBU

## Alcance

Release de estabilización de Vacaciones, Knowledge, navegación persistente y QA global sobre v17.5.4.

## Bugs de producción cerrados

- Error de aprobación/guardado relacionado con `decision_by` y schema cache.
- `vacation-impact-assistant` no podía persistir análisis porque el trigger no reconocía el contexto `service_role` moderno de PostgREST.
- Saldo de vacaciones guardado en 16 podía mostrarse temporalmente como 12 por fallback mientras cargaba metadata.
- RPC `update_knowledge_draft_version(...)` inexistente en producción y 404/PGRST202 asociado.
- Falta de RPC atómico para borrador inicial en instalaciones con drift.
- Fallback del lector de Knowledge podía seleccionar una versión publicada sin acotarla al artículo actual.
- Desalineación entre bloques legacy y esquema Knowledge v3.
- Permisos del asistente de Vacaciones podían tratar PM/Admin por nombre aunque existiera override explícito `manage_vacations=false`.

## Cambios de base de datos

- `content_schema_version smallint not null default 3` en Knowledge.
- Helpers de normalización v3.
- RPCs `create_knowledge_initial_draft` y `update_knowledge_draft_version`.
- `publish_knowledge_version` sincroniza versión publicada y shadow row del artículo.
- Guard de Vacaciones actualizado para `request.jwt.claims`.
- `notify pgrst, 'reload schema'` al final de migración.

## Edge Functions

- `vacation-impact-assistant` v9.
- Diagnóstico de proveedor/fallback IA.
- Respeto de overrides explícitos de `manage_vacations`.

## Frontend

- URL persistente para vistas/tabs/modos.
- Tabs de Vacaciones con RBAC.
- Saldo propio cargado de forma explícita y estado de carga no engañoso.
- Knowledge reader vinculado estrictamente a `active_version_id` del artículo.
- Gantt KPI chips filtrables.
- Backlog bulk row estabilizada en desktop.

## QA

- 238/238 validaciones estáticas/contractuales.
- RPC de edición y creación inicial probado dentro de transacción con rollback.
- Persistencia `service_role` de análisis de Vacaciones probada dentro de transacción con rollback.
- Estado v1 publicada/v2 borrador verificado en producción.
