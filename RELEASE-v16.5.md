# Jira Interno TROBBU v16.5

## Notification Center 360

Cobertura unificada para:
- Tickets: creación, asignación Dev/QA, estado, comentarios, evidencias, Sprint, QA y cierre.
- Helpdesk: creación, canalización, asignación, estado, comentarios, evidencias y decisiones de requerimientos.
- Sprints: creación, cambios relevantes, comentarios y evidencias.
- Knowledge: borradores, publicación/restauración de versiones.
- Staff: altas y cambios de acceso/rol/permisos.

Las notificaciones usan `type + category + metadata` estructurada, dedupe y deep links. El frontend traduce ES/EN según el idioma del usuario y la cola de correo usa `profiles.locale`.

### Realtime
`notifications` y `notification_outbox`, junto con las entidades relacionadas, están publicadas en Supabase Realtime.

### Correo
`process-notifications` v10 soporta Resend/Mailgun y genera correos bilingües con CTA directo al recurso.

### Despliegue
El Supabase productivo ya tiene aplicada v16.5. `upgrade-v16.5.sql` se incluye para otros entornos y `database.sql` quedó consolidado.
