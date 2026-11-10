# Jira Interno TROBBU v16

## Alcance

Versión integral basada en v15.9 con mejoras de operación, Knowledge, Staff y sincronización en tiempo real.

### Kanban enriquecido
- Prioridad siempre visible en la parte superior de la tarjeta.
- Prioridades Bloqueante/Muy alta resaltadas visualmente.
- Módulo visible mediante badge.
- Hasta 3 tags visibles y contador `+N` cuando existen más.
- Producto, responsable y fecha límite permanecen visibles.
- Responsive adaptado para tarjetas angostas.

### Planeación múltiple de Backlog
- Checkbox por ticket.
- Seleccionar todos los tickets visibles del Backlog.
- Elegir sprint activo o planeado.
- Mover hasta 100 tickets de forma atómica con `bulk_move_tickets_to_sprint`.
- Tickets en Backlog pasan a `Por hacer` al comprometerse al sprint.
- Fechas faltantes heredan inicio/fin del sprint.
- Si un ticket no es válido, está cerrado, ya tiene sprint o está fuera del alcance del usuario, no se mueve ninguno.

### Knowledge
- Nuevo módulo `Knowledge` disponible para todos los miembros del workspace, incluido Portal Helpdesk.
- Búsqueda por título, contenido y tags.
- Artículos por producto y módulo.
- Estados Publicado / Borrador / Archivado.
- Todos leen publicados; `manage_settings` administra CRUD y contenido no publicado.
- Asistente preventivo en alta/edición de tickets y solicitudes Helpdesk.
- Sugerencias automáticas después de escribir el título/descripción.
- Motor de relevancia determinístico siempre disponible.
- Si existe `AI_GATEWAY_API_KEY` o `OPENAI_API_KEY`, el asistente utiliza IA para redactar una recomendación basada exclusivamente en los artículos candidatos.

### Staff y accesos
- Edición de Nombre, Correo y Puesto desde el frontend.
- Correo sincronizado a `profiles.email` desde Supabase Auth.
- La contraseña actual nunca se puede recuperar porque Auth almacena hashes.
- Acción segura `Regenerar y copiar acceso`: establece una contraseña temporal nueva.
- El bloque copiable incluye:
  - `https://jiratrobbu.vercel.app/`
  - correo
  - contraseña temporal nueva
- `invite-member` actualizado para utilizar Vercel como URL principal.

### Tiempo real
- Supabase Realtime/Postgres Changes para tickets, sprints, módulos, tags, Staff, Helpdesk, Knowledge, comentarios, evidencias, custom fields y notificaciones.
- Refresh silencioso con debounce para evitar ráfagas de consultas.
- Se conserva polling de notificaciones cada 15 s como respaldo.
- Cuando Realtime pierde conexión se muestra aviso, pero la app sigue operando con el mecanismo de respaldo.

## Backend
- `knowledge_articles` con RLS.
- `bulk_move_tickets_to_sprint` como SECURITY INVOKER.
- `profiles.email` + trigger de sincronización Auth → Profiles.
- Publicación `supabase_realtime` configurada para 24 tablas relevantes.
- Edge Functions:
  - `invite-member` v17
  - `manage-member` v1
  - `trobbu-knowledge-assistant` v1

## Migración
El entorno Supabase actual ya fue actualizado. Para otros entornos usar `upgrade-v16.sql` o `database.sql` consolidado.
