# QA v16.5 · Notification Center 360

Fecha: 10 nov 2026

## Alcance
- Notificaciones In-App y cola de correo para Tickets, Helpdesk, Sprints, Knowledge y Staff.
- Traducción ES/EN en frontend y correo según `profiles.locale`.
- Metadata estructurada, deep links, Realtime y deduplicación.
- Regresión de importadores y compilación frontend.

## QA frontend
- TypeScript/JSX: PASS (`tsc` exit 0).
- CSV/XLS/XLSX/XLSM: 16/16 PASS.
- `csv-import-v15.2.js`: PASS.
- `config.js`: PASS.
- `speed-insights.js`: PASS.
- CSS: 1936 aperturas / 1936 cierres.
- `alert/confirm/prompt` nativos: 0.
- Drawer: filtros Todos/Tickets/Helpdesk/Sprints/Knowledge/Staff.
- Iconografía por categoría, traducción ES/EN y navegación directa: PASS por revisión de código/compilación.

## QA backend con rollback
Se validó sin dejar registros de QA:
- Comentario de Ticket -> In-App + Outbox: PASS.
- Comentario de Sprint -> In-App + Outbox: PASS.
- Publicación Knowledge -> In-App + Outbox: PASS.
- Cambio de acceso Staff -> notificación: PASS.
- Asignación QA -> notificación: PASS.
- Movimiento Ticket a Sprint -> notificación: PASS.
- Asignación Helpdesk -> notificación: PASS.
- Comentario Helpdesk -> notificación: PASS.
- Evidencia Helpdesk -> notificación: PASS.
- Evidencia Sprint -> notificación: PASS.
- Deduplicación: dos emisiones del mismo evento => 1 In-App + 1 Outbox: PASS.
- RLS destinatario: usuario destino ve su notificación; usuario ajeno no la ve: PASS.
- Residuos QA tras rollback: 0.

## Realtime
Verificadas en `supabase_realtime`: notifications, notification_outbox, tickets, comentarios/evidencias, sprints, helpdesk, knowledge y workspace_members.

## Edge Function
- `process-notifications` desplegada ACTIVE v10 con JWT obligatorio.
- Renderiza correo en ES/EN según `profiles.locale` y genera CTA por entidad.
- Proveedores soportados: Resend / Mailgun.
- La generación de cola está verificada. El envío real depende de tener configurado un proveedor de correo y sus secretos.

## Advisors
- Health Advisor: 0 incidencias.
- Security Advisor: solo warning global preexistente `Leaked Password Protection Disabled`.
- Se añadieron índices para `notifications.ticket_id` y `notifications.helpdesk_ticket_id` y se eliminó un índice duplicado introducido durante el desarrollo.
- Los avisos restantes de performance son deuda histórica o índices nuevos aún sin tráfico; v16.5 no deja FK nuevas de notificaciones sin índice.
