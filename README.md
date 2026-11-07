# Jira Interno TROBBU · v10.1

Aplicación estática tipo Jira, preparada para **GitHub Pages** y **Supabase**, con todos los archivos directamente en la raíz del repositorio.

## Funcionalidad incluida

- Múltiples espacios de trabajo: crear, cambiar, editar nombre y eliminar (solo Admin).
- Productos/tableros independientes: Web Administrativa, Web Socios, App Socios y productos adicionales.
- Tickets con clave por workspace/producto, Tabla y Kanban, drag & drop, prioridad, tipo, Sprint, story points, fecha límite, Dev y QA.
- Menú de tres puntos: Ver detalle, Editar y Eliminar según permisos.
- Comentarios e historial de actividad en tickets.
- Sprints: crear, editar y eliminar; dashboard filtrable por producto/Sprint.
- Dashboard: tickets creados, en curso, terminados por Desarrollo, terminados por QA, rechazados por QA y cerrados; story points y avance por producto.
- Equipo: Admin, PM, Dev, QA y Viewer; invitación por correo y administración de acceso/rol.
- Helpdesk interno: solicitudes de otras áreas, dashboard de SLA, categorías, prioridades, asignación, estados, comentarios, historial y fecha objetivo automática.
- Notificaciones in-app: no leídas/leídas, abrir elemento relacionado, marcar, eliminar y limpiar leídas.
- Cola de emails operativos: ticket nuevo, asignación Dev/QA y regresado por QA.
- Configuración operativa del workspace: zona horaria, duración de Sprint, correo de soporte, SLA, Helpdesk y canales de notificación.
- UI inspirada en Jira con identidad TROBBU, logo SVG y paleta corporativa.
- Navegación responsive: sidebar completo en desktop y barra inferior funcional en móvil/tablet.

## UX / modales

No se utiliza `alert()`, `prompt()` ni `confirm()` del navegador.

Los flujos de creación, edición, eliminación y filtros principales utilizan componentes propios:

- Workspace y configuración.
- Tickets y filtros.
- Comentarios.
- Helpdesk y filtros.
- Colaboradores e invitaciones.
- Productos.
- Sprints.
- Áreas de Helpdesk.
- Confirmaciones destructivas.

## Roles

| Rol | Tickets | Configuración | Equipo | Helpdesk |
| --- | --- | --- | --- | --- |
| Admin | CRUD | CRUD + eliminar workspace | CRUD + otorgar Admin | CRUD |
| PM | Crear/editar/eliminar | Editar | Invitar/editar no-Admins | CRUD |
| Dev | Crear/editar | Lectura | Lectura | Atender |
| QA | Crear/editar | Lectura | Lectura | Atender |
| Viewer | Solo lectura | Lectura | Lectura | Crear/editar sus solicitudes |

El sistema impide dejar un workspace sin al menos un Admin activo y evita que un PM otorgue el rol Admin.

## Estructura raíz

No existen `src/`, `public/`, `dist/` ni carpetas de aplicación. Archivos principales:

- `index.html`
- `app.js`
- `styles.css`
- `config.js`
- `logo.svg`
- `database.sql`
- `upgrade-v4.sql`
- `upgrade-v5.sql`
- `upgrade-v6.sql`
- `upgrade-v7.sql`
- `upgrade-v8.sql`
- `upgrade-v9.sql`
- `upgrade-v10.sql`
- `fix-ticket-activity.sql`
- `invite-member.ts`
- `process-notifications.ts`
- `.nojekyll`
- `.gitignore`
- `package.json`

## GitHub Pages

La URL canónica configurada es:

`https://gustavochan21.github.io/jiratrobbu/`

Los assets usan `?v=10.0.0` para evitar que Safari o GitHub Pages reutilicen JS/CSS anteriores.

Publicación:

1. Colocar los archivos de este paquete en la raíz de `main`.
2. GitHub → Settings → Pages.
3. Deploy from a branch → `main` → `/ (root)`.

No requiere build.

## Supabase

Proyecto productivo actual:

`https://prweelxfuvbsdsxfopuh.supabase.co`

El backend productivo ya recibió los cambios v10. No es necesario ejecutar los SQL nuevamente allí.

Para una instalación nueva usa `database.sql`.

Para una instalación que ya estaba en v4, ejecuta en orden `upgrade-v5.sql`, `upgrade-v6.sql`, `upgrade-v7.sql`, `upgrade-v8.sql`, `upgrade-v9.sql` y `upgrade-v10.sql`.

Para una instalación que ya estaba en v5, ejecuta en orden `upgrade-v6.sql`, `upgrade-v7.sql`, `upgrade-v8.sql`, `upgrade-v9.sql` y `upgrade-v10.sql`.

Para una instalación que ya estaba en v6, ejecuta en orden `upgrade-v7.sql`, `upgrade-v8.sql`, `upgrade-v9.sql` y `upgrade-v10.sql`.

Para una instalación que ya estaba en v7, ejecuta en orden `upgrade-v8.sql`, `upgrade-v9.sql` y `upgrade-v10.sql`.

Para una instalación que ya estaba en v8, ejecuta `upgrade-v9.sql` y después `upgrade-v10.sql`.

Para una instalación que ya estaba en v9, ejecuta únicamente `upgrade-v10.sql`.

### Edge Functions desplegadas

- `invite-member` v5: invitaciones, roles y redirect seguro a GitHub Pages.
- `process-notifications` v5: estado del proveedor, reintentos y envío por Resend o Mailgun.

## Emails operativos

La plataforma siempre mantiene las **notificaciones in-app** independientemente del proveedor externo.

Para envío de emails, `process-notifications` detecta uno de estos esquemas de secretos de Supabase:

### Resend

- `RESEND_API_KEY`
- `EMAIL_FROM`

### Mailgun

- `MAILGUN_API_KEY`
- `MAILGUN_DOMAIN`
- `EMAIL_FROM` (opcional; si se omite se genera un remitente con el dominio)
- `MAILGUN_BASE_URL` (opcional)

Configuración → Notificaciones muestra si el proveedor está listo y el estado de la cola.

## QA ejecutado contra Supabase productivo

Todas las pruebas de base se ejecutaron como `authenticated`, con RLS activo, dentro de transacciones con `ROLLBACK` para no dejar datos de prueba.

### CRUD

- Workspace: create/read/update/delete.
- Workspace settings: read/update.
- Productos: create/update/delete.
- Sprints: create/update/delete.
- Tickets: create/read/update/delete.
- Comentarios de tickets: create/update/delete.
- Helpdesk departments: create/update/delete.
- Helpdesk tickets: create/read/update/delete.
- Helpdesk comments: create/update/delete.
- Notificaciones: read/update/delete.

### Matriz de roles

Verificado:

- Admin no puede eliminar/desactivar al último Admin activo.
- PM puede administrar productos pero no otorgar Admin.
- Dev puede crear y actualizar tickets, pero no eliminarlos.
- QA puede actualizar el flujo de tickets.
- Viewer puede leer tickets pero no crearlos, editarlos ni comentarlos.
- Viewer puede crear/editar su solicitud de Helpdesk y comentar.
- Viewer no puede cambiar estado, asignación ni SLA interno del Helpdesk.
- Cualquier usuario autenticado puede crear su propio workspace.

### Integración

Verificado:

- Dos workspaces pueden tener simultáneamente `ADM-1` y `HD-1` sin colisión global.
- Bootstrap de workspace crea 3 productos, settings y 6 áreas de Helpdesk.
- Notificaciones in-app/email respetan los toggles del workspace.
- Helpdesk calcula `due_at` automáticamente según SLA.
- Comentarios de ticket y Helpdesk completan CRUD.
- Eliminar un workspace limpia correctamente sus entidades dependientes.
- `ticket_activity` registra creación y cambios de estado sin violar FK.

### Validación frontend

- JSX parseado correctamente.
- CSS parseado sin errores.
- Auditoría estática de botones: todos tienen acción o submit válido.
- 29 rutas globales de modal verificadas sin rutas faltantes, además de modales locales de dashboard/comentarios.
- 0 usos de `alert()`, `prompt()` o `confirm()`.
- 0 subcarpetas requeridas por la aplicación.

## Seguridad

Supabase Health no reporta incidencias funcionales. El Security Advisor únicamente mantiene la recomendación de habilitar **Leaked Password Protection** en Supabase Auth.


### Integridad v7

- Producto, sprint y área de Helpdesk deben pertenecer al mismo workspace que su ticket.
- Los requesters de Helpdesk solo ven sus propias solicitudes; el staff ve todas.
- `workspace_id`, `created_by` y la identidad de una membresía son inmutables tras su creación.
- El toggle de Helpdesk también se aplica a nivel RLS/API.


### Privacidad de perfiles v8

Los perfiles solo pueden consultarse cuando son el perfil propio o existe al menos un workspace activo compartido con el colaborador.


### Validación de responsables v9

- Reporter/requester quedan inmutables tras crear el caso.
- Nuevas asignaciones solo aceptan colaboradores activos y con rol compatible del mismo workspace.
- Los casos históricos siguen siendo editables aunque un responsable sea desactivado posteriormente.
- La validación corre antes que los triggers de actividad/notificaciones para devolver errores claros.


### Privacidad Helpdesk v10

- Un requester pierde acceso a sus solicitudes/comentarios cuando su membresía deja de estar activa.
- Los miembros activos conservan visibilidad del perfil de colaboradores desactivados del mismo workspace para poder administrarlos/reactivarlos.
