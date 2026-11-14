# RELEASE v17.11.0 - Jira Interno TROBBU

## Objetivo
Cerrar los pendientes operativos posteriores a v17.10: menciones con acceso específico, correo SendPulse seguro para free-plan, UX optimista sin recarga visible, cierre del registro público desde UI, counters resilientes, cache-busting y contraste oscuro final.

## Menciones
- Nueva vista **Mencionados** para Jira y Helpdesk.
- `@menciones` desde comentarios/evidencias.
- RLS específica por entidad: el mencionado lee/comenta/adjunta, pero no administra.
- Realtime FULL para `ticket_mentions` y `helpdesk_mentions`.
- Notificación in-app; sin correo para evitar ruido.

## Email
- Outbox reiniciado a cero al aplicar la migración.
- Eventos permitidos: daily reminder, Helpdesk assigned/comment/closed y Jira closed.
- 45 correos/hora y 11,000/mes como límites internos.
- Los recordatorios diarios solo aplican a miembros con trabajo abierto.
- Procesador SendPulse v21 con bloqueo de producción si no existe el remitente exacto `helpdesk@trobbucollection.com`.
- SMTP Test continúa en QA hasta que SPF, DKIM y remitente queden activos.

## UX
- Kanban y reasignación: optimistic update + rollback + reconciliación dirigida.
- Sin full refresh visible en cambios de estado/asignación.
- Cache-busting v17.11 + headers Vercel no-cache.
- Auth UI login-only.

## Dark mode
- Gantt: porcentaje en negro.
- Staff/Roles: counters azules legibles.
- Detail counters: contraste alto.
- Paneles laterales integrados.

## PDF
Se incluye `Manual-Jira-TROBBU-Knowledge-Helpdesk-v17.11.pdf`.

## Restricción de signup
El frontend queda login-only. QA del endpoint `/auth/v1/settings` devolvió `disable_signup=false`; cerrar signup a nivel Auth requiere el toggle de configuración de Supabase, no expuesto por el MCP disponible.

## Producción de email
No se habilitó `email_qa_mode=false` porque SendPulse sigue en SMTP Test. Esta es una protección deliberada, no un pendiente de código.
