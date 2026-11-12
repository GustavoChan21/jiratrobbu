# Release v17.9.0 — Jira Interno TROBBU

## Alcance

v17.9.0 consolida la sincronización Live/counters, agrega tema claro/oscuro global, simplifica el flujo operativo de Helpdesk y mejora la edición de tipos de ausencia.

## Live Data y counters

- `get_live_counters(workspace_id)` centraliza en un solo snapshot los counters de navegación, módulos y resumen de Helpdesk.
- Realtime sigue aplicando el cambio recibido inmediatamente y después invalida/reconcilia counters derivados.
- Snapshot autoritativo de counters cada 20 s mientras la pestaña está visible.
- Reconciliación ligera cada 60 s de Tickets, Sprints, Helpdesk, Vacaciones y Knowledge para corregir eventos WebSocket perdidos sin recargar todo el workspace.
- Los detalles abiertos de Ticket, Sprint y Helpdesk revalidan comentarios/actividad/evidencias cada 30 s y también al recuperar focus, visibilidad o conexión.
- `ticket_comments`, `ticket_activity`, `ticket_attachments`, `sprint_comments`, `sprint_attachments`, `helpdesk_comments`, `helpdesk_activity` y `helpdesk_attachments` usan `REPLICA IDENTITY FULL` y permanecen en `supabase_realtime`.
- Los KPIs principales de Helpdesk consumen el snapshot autoritativo del servidor y usan la colección local como fallback.

## Tema claro / oscuro

- Toggle global disponible antes de login, durante validación de acceso y en el Topbar.
- Preferencia inmediata en `localStorage` para evitar flash de tema al recargar.
- Preferencia autenticada persistida en `profiles.theme_preference` (`light` / `dark`).
- Cobertura dark para shell, Sidebar, Topbar, tablas, formularios, modales, drawers, Kanban, Knowledge editor/reader, Vacaciones, timeline/Gantt, Helpdesk y componentes secundarios.

## Helpdesk

Flujo canónico:

**Nuevo → En revisión → Atendido → Cerrado**

- Se elimina `resolved` como estado operativo.
- Registros históricos `resolved` se migran a `closed`, conservando `resolved_at` únicamente como auditoría heredada.
- Solicitante: puede cerrar su propia solicitud cuando está en `Atendido`.
- Responsable asignado sin permiso de gestión: solo puede avanzar `Nuevo → En revisión → Atendido`.
- Usuarios con `manage_helpdesk` conservan control operativo y pueden cerrar una solicitud en `Atendido` si el solicitante no lo hace.
- Tabla de solicitudes internas permite cambiar responsable y estado mediante controles clicables en línea.
- Requerimientos muestran decisión inline: pendiente / aceptar a Backlog / rechazar.
- Autoasignación y notificaciones ya no consideran ni muestran `resolved`.

## Vacaciones

El editor de Tipos de Ausencia reemplaza checkboxes por switches profesionales para:

- `Descontar del saldo anual`.
- `Tipo activo`.

## Base de datos / producción

Migración: `jira_v17_9_workflow_theme_live_counters`.

Verificaciones posteriores:

- 0 filas Helpdesk con `status='resolved'`.
- Constraint Helpdesk: `created`, `review`, `attended`, `closed` únicamente.
- `profiles.theme_preference` activo.
- `get_live_counters(uuid)` activo y con `SECURITY INVOKER`.
- tablas de comentarios/actividad publicadas y con replica identity FULL.
- `auto-assign-helpdesk` productivo: v7 ACTIVE, JWT requerido.
- `process-notifications` productivo: v14 ACTIVE, JWT requerido.
- Supabase Health Advisor: 0 lints.

## QA

- Suite v17.9: **327 PASS / 0 FAIL**.
- Parseo AST JSX/TypeScript: 0 errores en `app.js` y las Edge Functions principales.
- Prueba transaccional con rollback: responsable secuencial, bloqueo de cierre por responsable, cierre por solicitante, rechazo de `resolved`, snapshot de counters y tema.
- Prueba con rol PostgreSQL `authenticated` + RLS: cierre por solicitante, actualización de tema y lectura de counters aprobados.
- Los assets principales responden correctamente desde servidor HTTP local.

La advertencia de seguridad de Supabase sobre leaked-password protection continúa siendo una configuración de Auth preexistente y no bloquea esta release.
