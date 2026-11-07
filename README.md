# Jira Interno TROBBU v11.2

Plataforma interna tipo Jira para TROBBU, preparada para ejecutarse directamente desde **GitHub Pages** con todos los archivos en la carpeta raíz y Supabase como backend.

## Funcionalidades principales

- Workspaces completamente aislados: cada espacio tiene sus propios productos, tickets, sprints, miembros, configuraciones, Helpdesk, notificaciones y evidencias.
- Productos iniciales por workspace: **Web Administrativa**, **Web Socios** y **App Socios**. Los Superadmins/Administradores pueden administrar el catálogo del espacio.
- Tickets con Tabla, Kanban y **Calendario**.
- Calendario mensual con fecha de inicio, rango de ejecución y fecha de entrega, más próximos vencimientos y tickets aún sin planificar.
- **Backlog / Sprints** como módulo propio.
- Planeación de tickets del Backlog hacia un sprint.
- Cierre de sprint con traslado de tickets no resueltos al siguiente sprint o regreso automático al Backlog.
- Detalle de sprint con objetivo, texto de detalle, avance, tickets, comentarios e imágenes de evidencia.
- Detalle de ticket con comentarios e imágenes clasificadas como: Comentario, Revisión, Rechazo, Fix/Corrección o Cierre.
- Imágenes privadas almacenadas en Supabase Storage (`jira-evidence`) con RLS por workspace.
- Dashboard de sprint y estadísticas de tickets.
- Centro de notificaciones in-app.
- Invitación de colaboradores por workspace mediante Edge Function.
- Diseño TROBBU inspirado en Jira, responsive y sin diálogos nativos `alert`, `prompt` o `confirm`.

## Roles por workspace

Los permisos son independientes en cada workspace. Un usuario puede tener roles distintos en espacios diferentes.

| Rol | Permisos principales |
| --- | --- |
| **Superadmin** | Control total del workspace, miembros, administradores, productos, configuración, tickets, sprints, Helpdesk y eliminación del workspace. Siempre debe existir al menos uno activo. |
| **Administrador** | Administra configuración, equipo (excepto promover/modificar Superadmin), productos, tickets, sprints y Helpdesk. No puede eliminar el workspace. |
| **Gestor / PM** | Planea Backlog y sprints, administra tickets y operación del Helpdesk. No administra productos, configuración general ni equipo. |
| **Desarrollo** | Opera tickets, estados, comentarios/evidencias y solicitudes asignadas. No crea/administra sprints ni configuración. |
| **QA** | Opera revisión QA, comentarios/evidencias y solicitudes de Helpdesk. No administra sprints ni configuración. |
| **Solo carga de tickets** | Puede crear tickets propios exclusivamente en Backlog y consultar solo los tickets que reportó. No puede asignar sprint, Dev/QA, story points ni fechas. |
| **Solo dashboards** | Solo lectura de Resumen, Tablero, Backlog/Sprints y Calendario. No puede crear ni modificar tickets. |

El **portal Helpdesk** permanece disponible para todos los miembros del workspace independientemente del rol Jira: cada usuario puede crear y consultar sus propias solicitudes.

## Helpdesk

El módulo se divide en dos experiencias:

### Mis solicitudes

Portal para cualquier miembro del workspace:

1. Crear solicitud.
2. Consultar únicamente sus solicitudes.
3. Ver el avance completo.
4. Añadir comentarios de seguimiento.

El requester no puede modificar responsable, estado, SLA ni datos internos después del alta.

Flujo:

**Creado → En revisión → Atendido → Resuelto → Cerrado**

### Mesa de atención

Disponible para Superadmin, Administrador, PM, Desarrollo y QA. Permite consultar todas las solicitudes del workspace, asignar responsable, avanzar estado, registrar comentarios y controlar SLA.

Departamentos solicitantes configurados por workspace:

- Reservaciones
- Recepción
- Gerencia
- Administración
- Aperturas
- Marketing
- Callcenter
- Plataforma
- Atención a clientes
- Atención a socios

## Backlog y Sprints

Un ticket sin sprint pertenece al Backlog. Superadmin, Administrador o PM pueden planificarlo hacia un sprint.

Al cerrar un sprint:

- tickets `QA aprobado` o `Cerrado` permanecen en el sprint concluido;
- tickets no resueltos pueden pasar al siguiente sprint;
- si no se selecciona sprint destino, regresan a Backlog y su estado se establece en Backlog;
- el sprint origen queda `completed`;
- un sprint destino `planned` pasa a `active` automáticamente.

## Evidencias

Las evidencias son privadas y se guardan en el bucket `jira-evidence`. Se aceptan JPEG, PNG, WebP y GIF de hasta 10 MB.

Rutas internas:

- `<workspace>/tickets/<ticket>/...`
- `<workspace>/sprints/<sprint>/...`

La visibilidad sigue los permisos del workspace. El rol Solo carga puede ver evidencias de sus propios tickets pero no subirlas; Solo dashboards puede ver evidencias pero no escribir.

## Estructura raíz

La aplicación no requiere `/src`, `/public` ni `/dist`:

- `index.html`
- `app.js`
- `styles.css`
- `config.js`
- `logo.svg`
- `database.sql`
- `upgrade-v11-enum.sql`
- `upgrade-v11.sql`
- `invite-member.ts`
- `process-notifications.ts`
- `QA-REPORT.md`
- archivos de upgrades anteriores como respaldo histórico

GitHub Pages solo necesita los archivos frontend de raíz.

## Actualizar una BD v10.1 a v11

Por una restricción de PostgreSQL con valores nuevos de enums, ejecutar en este orden y confirmar cada archivo por separado:

1. `upgrade-v11-enum.sql`
2. `upgrade-v11.sql`

En el proyecto Supabase productivo de este proyecto estos cambios **ya fueron aplicados**.

Para una instalación nueva se puede utilizar directamente `database.sql`, que ya contiene los nuevos roles y el upgrade v11 consolidado.

## Edge Functions

- `invite-member`: invita colaboradores y asigna el rol dentro del workspace. Solo Superadmin/Administrador pueden invitar; solo Superadmin puede otorgar Superadmin.
- `process-notifications`: procesa correo transaccional mediante Resend o Mailgun cuando existe un proveedor configurado.

Las notificaciones dentro de la plataforma no dependen de un proveedor externo de email.

## GitHub Pages

Publicar desde:

**Settings → Pages → Deploy from a branch → `main` → `/ (root)`**

La versión frontend usa cache busting `v=11.2.0` en `index.html`.

## QA

Consulta `QA-REPORT.md`. La revisión v11 incluyó RLS por rol, aislamiento multi-workspace, Backlog/rollover, Helpdesk, evidencias, sintaxis JSX, botones/modales y pruebas visuales desktop/tablet/móvil.
