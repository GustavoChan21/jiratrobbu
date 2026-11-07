# Jira Interno TROBBU · v4

Versión estática preparada para GitHub Pages y Supabase, con todos los archivos en la raíz del repositorio.

## Cambios principales v4

- Creación y cambio entre múltiples workspaces.
- Configuración funcional del workspace: nombre, zona horaria, duración de sprint, Helpdesk, SLA y notificaciones.
- Productos: crear, editar y eliminar desde Configuración.
- Sprints: crear, editar y eliminar desde Configuración.
- Tickets: crear, ver detalle, editar, eliminar, mover en Kanban, comentar y revisar historial.
- Menú de tres puntos funcional mediante modal de acciones.
- Filtros en modal propio del sistema, sin `prompt`, `alert` ni `confirm` del navegador.
- Helpdesk para solicitudes de otros departamentos con dashboard, área, categoría, prioridad, asignación, estado, fecha objetivo, comentarios e historial.
- Centro de notificaciones in-app con leído/no leído y acceso directo al ticket/solicitud relacionada.
- Equipo: invitaciones y edición de rol/estado de colaboradores.
- UI estilo Jira con identidad TROBBU y logo SVG oficial.

## Estructura raíz

No existen carpetas `src`, `public`, `dist` o similares. GitHub Pages puede servir directamente:

- `index.html`
- `app.js`
- `styles.css`
- `config.js`
- `logo.svg`
- `database.sql` — esquema base + actualización v4.
- `upgrade-v4.sql` — solo actualización v4 para instalaciones que ya tenían v3.
- `fix-ticket-activity.sql`
- `invite-member.ts`
- `process-notifications.ts`
- `.nojekyll`
- `.gitignore`
- `package.json`

## Publicación GitHub Pages

1. Sustituye los archivos de la raíz de `main` por los de este paquete.
2. Settings → Pages → Deploy from a branch.
3. Selecciona `main` y `/ (root)`.
4. La versión usa `?v=4.0.0` en los assets para evitar que Safari reutilice CSS/JS antiguos.

URL canónica configurada:

`https://gustavochan21.github.io/jiratrobbu/`

## Supabase

El backend productivo `prweelxfuvbsdsxfopuh` ya recibió las correcciones y tablas de v4. No hace falta ejecutar nuevamente los SQL en ese proyecto.

Para una instalación nueva, ejecuta `database.sql`.

Para una instalación existente basada en v3, ejecuta `upgrade-v4.sql`.

### Tablas añadidas

- `workspace_settings`
- `helpdesk_departments`
- `helpdesk_tickets`
- `helpdesk_comments`
- `helpdesk_activity`
- `notifications`

### Correcciones RLS

La creación de workspaces ya permite que el creador vea inmediatamente la fila devuelta por `INSERT ... RETURNING`. También existe el RPC `create_workspace()` como `SECURITY INVOKER` para crear workspaces sin elevar privilegios.

## QA realizado contra Supabase productivo

Se ejecutó como rol `authenticated`, con RLS activo, dentro de transacciones con `ROLLBACK`:

- Workspace: INSERT, SELECT, UPDATE, DELETE.
- Compatibilidad `INSERT ... RETURNING` para workspaces.
- RPC `create_workspace()` con `SECURITY INVOKER`.
- Workspace settings: SELECT y UPDATE.
- Producto: INSERT, UPDATE, DELETE.
- Sprint: INSERT, UPDATE, DELETE.
- Ticket: INSERT, UPDATE de estado/prioridad, DELETE.
- Comentario de ticket: INSERT, UPDATE, DELETE.
- Actividad de ticket: creación y cambio de estado.
- Helpdesk department: INSERT, UPDATE, DELETE.
- Helpdesk ticket: INSERT, UPDATE, DELETE.
- Helpdesk comment: INSERT, UPDATE, DELETE.
- Notificación in-app: SELECT, marcar como leída y DELETE.
- Trigger de creación de ticket: genera notificación al reporter.
- Trigger de Helpdesk: genera notificación al solicitante.
- Eliminación de workspace: cascadas verificadas.

El QA CRUD completo devolvió `PASS` y todas las transacciones de prueba fueron revertidas para no dejar registros de prueba.

## Correos

La Edge Function `process-notifications` sigue utilizando Resend para correos operativos. La cola de correo permanece separada de las notificaciones in-app. Para enviar correos se requieren los secretos de Supabase:

- `RESEND_API_KEY`
- `EMAIL_FROM`

Las notificaciones dentro de la plataforma no dependen de Resend.
