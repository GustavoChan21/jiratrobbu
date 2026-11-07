# Jira Interno TROBBU v12.1

Plataforma interna tipo Jira para TROBBU, preparada para ejecutarse directamente desde **GitHub Pages** con todos los archivos en la carpeta raíz y Supabase como backend.

## Novedades v12.1

- Nuevo módulo **Staff y Roles** por workspace.
- Roles base: **Consulta, Dev, QA, PM, Admin y Superadmin**.
- Permisos efectivos ajustables por usuario.
- Alcance de productos por usuario: **Todos** o una selección concreta.
- Superadmin conserva siempre todos los permisos y todos los productos, aunque existan overrides restrictivos.
- RLS de tickets, comentarios, actividad, evidencias y notificaciones respeta workspace + producto.
- Nuevo **Cronograma Gantt** tipo Jira/Roadmap con duración, progreso, sprints, vencimientos y proyección.
- Footers de todos los formularios/modales unificados: `Cancelar` + acción principal, sin márgenes negativos ni diálogos JS nativos.

## Jerarquía de acceso

La autorización tiene dos niveles:

1. **Workspace:** el usuario debe ser miembro activo del espacio.
2. **Producto:** dentro de ese workspace puede tener todos los productos o solo productos seleccionados.

Los productos, tickets, sprints, Helpdesk, configuración y Staff nunca se mezclan entre workspaces. Para administrar el acceso de un usuario en otro workspace, cambia al workspace correspondiente y edita su membresía ahí.

### Roles base

| Rol | Base de permisos |
| --- | --- |
| **Consulta** | Ver dashboards, tableros, Backlog y Gantt de productos autorizados. Sin escritura. |
| **Dev** | Consulta + crear/editar tickets y evidencias dentro de productos autorizados. |
| **QA** | Dev + acciones de revisión QA. |
| **PM** | Planeación, Backlog, sprints, Gantt, tickets, eliminación de tickets y Mesa Helpdesk. |
| **Admin** | Todos los permisos funcionales del workspace y todos los productos. No puede otorgar Superadmin ni eliminar al último Superadmin. |
| **Superadmin** | Control total forzado: Staff, productos, configuración, tickets, sprints, Helpdesk, todos los productos y eliminación del workspace. |

Los roles son plantillas base. Desde **Staff → Accesos** se pueden activar/desactivar permisos individuales para cualquier rol excepto Superadmin. Superadmin siempre mantiene acceso total.

Permisos disponibles:

- Ver dashboards y estadísticas
- Ver tickets y tableros
- Crear tickets
- Editar y mover tickets
- Eliminar tickets
- Backlog y sprints
- Revisión QA
- Mesa de Helpdesk
- Staff y Roles
- Administrar productos
- Configuración

## Staff y Roles

El módulo muestra por colaborador:

- workspace activo;
- rol base;
- estado activo/desactivado;
- productos autorizados;
- permisos efectivos.

Admin y Superadmin tienen todos los productos. Para Dev, QA, PM y Consulta se puede elegir **Todos** o productos concretos.

La invitación de Staff se ejecuta mediante `invite-member` y guarda en una sola operación la membresía, rol, permisos y scope de productos.

## Tickets y productos

Cada ticket pertenece obligatoriamente a un producto del mismo workspace. RLS valida el producto tanto para lectura como creación, edición, eliminación, comentarios, actividad, evidencia y notificaciones.

También se valida que:

- Responsable Dev pertenezca al workspace, tenga rol compatible y acceso al producto.
- Responsable QA pertenezca al workspace, tenga rol compatible y acceso al producto.
- Cambiar el producto vuelve a validar los responsables.

## Cronograma Gantt

**Cronograma** es una vista independiente y también está disponible desde el Tablero.

Incluye:

- zoom de 4, 8 o 12 semanas;
- navegación anterior / Hoy / siguiente;
- bandas de sprints activos y planeados;
- barras por ticket usando fecha de inicio y fecha de entrega;
- progreso visual derivado del estado del ticket;
- tickets vencidos;
- actividades sin fechas;
- producto, clave y estado de cada ticket;
- acceso directo al detalle del ticket.

Progreso por estado utilizado para la proyección:

- Backlog: 0%
- Por hacer: 10%
- En curso: 45%
- Desarrollo finalizado: 65%
- Revisión QA: 78%
- QA rechazado: 58%
- QA aprobado: 92%
- Cerrado: 100%

## Backlog y Sprints

Un ticket sin sprint queda en Backlog. Quien tenga `manage_sprints` puede planificarlo hacia un sprint.

Al cerrar un sprint:

- `QA aprobado` y `Cerrado` permanecen en el sprint histórico;
- los pendientes pueden trasladarse al siguiente sprint;
- si no se elige destino regresan al Backlog;
- el sprint origen pasa a `completed`;
- un sprint destino `planned` pasa a `active` automáticamente.

## Evidencias

Tickets y sprints admiten comentarios e imágenes de evidencia clasificadas como:

**General · Revisión · Rechazo · Fix/Corrección · Cierre**

Las imágenes se guardan en el bucket privado `jira-evidence`, con RLS y scope de producto para tickets.

## Helpdesk

### Mis solicitudes

Cualquier miembro activo puede crear una solicitud y consultar su seguimiento:

**Creado → En revisión → Atendido → Resuelto → Cerrado**

El requester puede comentar, pero no puede manipular estado, responsable ni SLA.

### Mesa de atención

Solo quienes tengan el permiso efectivo `manage_helpdesk` pueden ver y atender solicitudes ajenas, asignarse casos y cambiar el flujo.

Departamentos del portal:

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

## Modales / UX

Los formularios principales comparten un único `AsyncForm` con:

- cuerpo con scroll interno;
- footer propio y fijo dentro del modal;
- `Cancelar` separado de la acción primaria;
- desktop/tablet: Cancelar izquierda, acción principal derecha;
- móvil: botones apilados, a ancho completo;
- sin `alert()`, `prompt()` o `confirm()` del navegador.

## Base de datos

### Upgrade desde v11.2

Por la restricción de PostgreSQL al añadir valores a enums, ejecutar y confirmar por separado:

1. `upgrade-v12-enum.sql`
2. `upgrade-v12.sql`

El proyecto Supabase productivo ya tiene estos cambios aplicados.

### Instalación nueva

Utiliza `database.sql`, que ya contiene `consulta` en el enum inicial y el modelo v12 consolidado.

## Edge Functions

- `invite-member`: invitación + rol + permisos + scope de productos.
- `process-notifications`: cola de email mediante Resend/Mailgun cuando existe proveedor configurado.

Las notificaciones in-app no dependen del proveedor de correo.

## Estructura raíz / GitHub Pages

No se usan `/src`, `/public` ni `/dist`. Los archivos operativos viven en la raíz.

Publicación esperada:

**Settings → Pages → Deploy from a branch → `main` → `/ (root)`**

El frontend usa cache busting `v=12.1.0`.

## QA

Consulta `QA-REPORT.md` para las matrices RLS, E2E, JSX/CSS, botones/modales y responsive.
