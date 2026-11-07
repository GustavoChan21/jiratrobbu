# Jira Interno TROBBU v13.0

Aplicación tipo Jira para gestión de desarrollo, QA, Backlog, Sprints, Helpdesk y planificación Timeline/Gantt. Está diseñada para funcionar desde GitHub Pages con todos los archivos en la carpeta raíz y persistencia en Supabase.

## Novedades v13.0

### Staff y Roles administrables

Los roles dejan de ser una matriz informativa y pasan a ser entidades reales por workspace (`workspace_roles`). Cada workspace inicia con seis roles base:

- **Superadmin** — control total obligatorio; todos los permisos y todos los productos.
- **Admin** — administración integral; sus permisos y alcance de productos pueden limitarse.
- **PM** — planeación, Backlog, Sprints, Timeline/Gantt y seguimiento.
- **Dev** — operación de desarrollo sobre productos autorizados.
- **QA** — revisión QA, aprobaciones/rechazos y evidencias.
- **Consulta** — lectura de dashboards, tickets, Backlog y Timeline.

Desde **Equipo → Roles** un Superadmin/Admin con `Gestionar Staff` puede:

- crear roles personalizados;
- editar nombre, descripción, rol base y permisos;
- desactivar roles;
- eliminar roles no asignados;
- consultar cuántos colaboradores usan cada rol.

El rol **Superadmin** está protegido: no se puede eliminar, desactivar ni restringir. El último Superadmin activo tampoco puede retirarse del workspace.

### Acceso por workspace y producto

Cada membresía pertenece a un workspace y puede tener:

- acceso a todos los productos; o
- acceso únicamente a productos seleccionados.

El alcance se valida en RLS para catálogo de productos, tickets, actividad, comentarios, evidencias y notificaciones. **Solo Superadmin es global por obligación**; Admin, PM, Dev, QA, Consulta y roles personalizados pueden limitarse a productos concretos.

### Alta de colaboradores robusta

`invite-member` v11 acepta `role_id`, alcance de productos y permisos individuales. También mantiene compatibilidad con UIs cacheadas:

- `reporter` se normaliza a `Consulta` + permiso `Crear tickets`;
- `viewer` se normaliza a `Consulta`.

La función intenta enviar la invitación mediante Supabase Auth. Si el envío falla y el usuario aún no existe, crea una cuenta confirmada con una **contraseña temporal aleatoria** y la devuelve una sola vez al administrador autorizado. La UI muestra esas credenciales en un modal propio.

Los errores de la Edge Function se muestran con el mensaje real del backend; ya no se presenta únicamente `Edge Function returned a non-2xx status code`.

### Timeline / Gantt tipo Jira

El módulo **Timeline** muestra:

- columna fija de tareas;
- encabezado por meses y días;
- sprints activos, planeados, vencidos y completados;
- barras de tickets desde fecha de inicio hasta fecha de entrega;
- progreso visual por estado;
- navegación al mes anterior/siguiente y botón Hoy;
- ventanas de 1, 3, 6 y 12 meses;
- selector para saltar a cualquier sprint, incluidos históricos/cerrados;
- tickets sin programación en una sección separada.

Desde cada fila del Timeline, según permisos, se puede:

- abrir detalle;
- editar;
- mover a Backlog;
- eliminar.

Mover a Backlog limpia `sprint_id`, fecha de inicio y fecha de entrega. Al volver a planificar un ticket sin fechas, toma por defecto el rango del sprint seleccionado.

### Formularios y responsive

Todos los formularios utilizan el mismo footer:

- desktop/tablet: **Cancelar** a la izquierda y acción principal a la derecha;
- móvil: botones apilados a ancho completo, primero Cancelar y después la acción principal.

No se utilizan `alert()`, `prompt()` ni `confirm()` del navegador.

## Helpdesk

El Helpdesk mantiene dos experiencias:

- **Mis solicitudes** para quien reporta: crear, consultar seguimiento y comentar sus propias solicitudes.
- **Mesa de atención** para Staff autorizado: responsable, SLA, cambios de estado, actividad y dashboard.

Flujo:

`Creado → En revisión → Atendido → Resuelto → Cerrado`

Departamentos por workspace:

Reservaciones, Recepción, Gerencia, Administración, Aperturas, Marketing, Callcenter, Plataforma, Atención a clientes y Atención a socios.

## Evidencias

Tickets y Sprints admiten comentarios y evidencias privadas en Supabase Storage con tipos:

`Comentario · Revisión · Rechazo · Fix/Corrección · Cierre`

El bucket `jira-evidence` es privado y la lectura/escritura respeta RLS y scope de producto.

## Archivos raíz

El proyecto no requiere estructura `src/` ni subcarpetas para ejecutarse en GitHub Pages. Los principales archivos son:

- `index.html`
- `app.js`
- `styles.css`
- `config.js`
- `logo.svg`
- `database.sql`
- `upgrade-v13.sql`
- `invite-member.ts`
- `process-notifications.ts`
- `QA-REPORT.md`

## Actualizar desde v12.1

Ejecutar `upgrade-v13.sql` sobre la base ya actualizada a v12.1 y desplegar la versión incluida de `invite-member.ts`.

Para una instalación nueva utilizar `database.sql`, que contiene las capas anteriores más la consolidación v13 al final.

## GitHub Pages

Copiar el contenido del ZIP directamente a la raíz de `main`. `index.html` referencia `styles.css`, `config.js` y `app.js` con versión `13.0.0` para evitar cache de versiones anteriores.

## Seguridad

La publishable key de Supabase incluida en `config.js` es una clave pública de cliente y todas las operaciones sensibles se protegen con RLS. No incluir `service_role`, contraseñas, API keys privadas ni secretos de correo en el repositorio.

## v14.0 — Auth Luxury, Gantt flexible y Portal Helpdesk administrativo

- Login y registro con fondo TROBBU, panel luxury y responsive.
- Timeline/Gantt anclado por fecha: inicia por defecto un día antes de hoy y permite 1/4/6/8 semanas o 1/2/3/6 meses.
- Nuevo rol de sistema **Solicitante Helpdesk** sin productos, tableros, Backlog ni Gantt. Solo consulta sus propias solicitudes y estadísticas.
- Nuevos módulos/funcionalidades/requerimientos se manejan como propuestas sin SLA: PM/Admin/Superadmin decide **Aceptar a Backlog** o **Sugerencia rechazada**.
- Al aceptar, el producto se elige en la decisión y se crea un ticket `improvement` en Backlog sin exponerlo al solicitante.
- Edge Function `invite-member` v13 permite roles sin productos y conserva validación estricta para roles de producto.



## v14.1 — Staff con contraseña, Configuración estable y canalización Helpdesk

- **Staff:** al crear un usuario se puede elegir `Crear con contraseña` para entregar correo + contraseña inmediatamente, o `Enviar invitación`.
- **Configuración:** corregida la regresión de las tabs Productos/Sprints y restaurado el CRUD de departamentos de Helpdesk.
- **Alta Helpdesk:** el solicitante solo captura asunto, descripción, departamento, tipo y prioridad; nombre/correo provienen de su sesión. No puede definir responsable, estado ni fecha objetivo.
- **Canalización:** PM/Admin/Superadmin abre la solicitud después y define responsable/estado/fecha. Si cambia a `En revisión` sin fecha objetivo, se calcula automáticamente con el SLA del workspace.
- **Notificaciones:** al crear una solicitud se genera una notificación in-app para PM/Admin/Superadmin; propuestas de producto usan una notificación específica de decisión pendiente.

### Actualizar desde v14.0

1. Reemplazar los archivos frontend por esta versión.
2. Ejecutar `upgrade-v14.1.sql`.
3. Desplegar `invite-member.ts` (la versión activa correspondiente es v15).

`database.sql` incluye al final los ajustes v14.1 para instalaciones nuevas.
