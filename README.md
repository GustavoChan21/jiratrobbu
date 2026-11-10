# Jira Interno TROBBU v16.6



## v15.7 · Responsive y credenciales

- Tablero y Mis tareas protegen las columnas contra títulos largos.
- Títulos: 2 líneas + elipsis en desktop/tablet; cards de hasta 3 líneas en móvil.
- Proyecto y responsable usan truncado seguro; el detalle conserva el título completo.
- En <=820 px los tickets se muestran como cards para evitar solapamientos.
- Al crear un usuario, “Copiar credenciales + enlace” incluye `https://jiratrobbu.vercel.app/`, correo y contraseña.
- No requiere cambios de base de datos.

Aplicación tipo Jira para gestión de desarrollo, QA, Backlog, Sprints, Helpdesk y planificación Timeline/Gantt. Está diseñada para funcionar en Vercel, GitHub Pages o un servidor HTTP equivalente con todos los archivos en la carpeta raíz y persistencia en Supabase.

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


## Manual de importación Excel

La raíz del proyecto incluye:

- `plantilla-importacion-backlog-trobbu.xlsx`
- `MANUAL_IMPORTACION_EXCEL.md`

La plantilla contiene además una hoja `Manual` con instrucciones integradas. La importación se realiza desde **Backlog / Sprints → Importar Excel** y siempre crea tickets en Backlog, sin Sprint.

## Vercel Speed Insights

El proyecto declara en raíz:

```bash
npm i @vercel/speed-insights
```

Dependencia configurada:

```json
"@vercel/speed-insights": "^2.1.0"
```

Como Jira Interno es actualmente un frontend estático sin bundler, `speed-insights.js` carga el endpoint oficial de Speed Insights de Vercel: `/_vercel/speed-insights/script.js`. El loader se omite automáticamente en `localhost` y GitHub Pages para evitar solicitudes 404. En Vercel se carga una sola vez.

Para recibir métricas, **Speed Insights debe estar habilitado para el proyecto `jiratrobbu` en Vercel**. Después de un deploy de producción, las métricas empiezan a poblarse conforme existan visitas reales.


## v15.1 · Estabilización responsive y UX

- Reportes / TROBBU AI y Campos/Módulos/Tags ahora usan el mismo contenedor `.page` del resto del sistema.
- Se definió `content-card` como superficie compartida para evitar paneles sin borde/padding.
- Se homologaron paddings, gaps, cards, tabs, tablas, filtros, formularios y acciones a los componentes existentes.
- Timeline/Gantt mantiene alineadas las filas de Módulo con las filas de tickets en desktop, tablet y móvil.
- En móvil, los controles de Gantt se distribuyen en tres filas estables: Sprint, rango/agrupación y navegación `← / Hoy / →`.
- Tabs de Configuración, detalle y módulos tienen scroll horizontal contenido cuando el ancho no alcanza.
- QA responsive ejecutado en 1440×1000, 1180×900, 820×1050 y 390×844.

## v15.4 · Paquete completo sobre v15.1

Esta versión parte directamente de `jiratrobbu-v15.1-final.zip` y conserva sus correcciones responsive/UI/UX. Integra además:

- importación Backlog por XLSX/XLS y CSV de Google Sheets;
- SheetJS cargado explícitamente desde `index.html`;
- productos `AUT` (Automatizaciones) y `FIN` (Panel Financiero);
- plantillas XLSX/CSV actualizadas con los cinco códigos de producto;
- catálogo CRUD de Tipos de solicitud de Helpdesk por workspace;
- tipos iniciales: Soporte, Incidencia, Requerimiento, Mejora, Acceso / permisos, Configuración y Otro;
- filtro y estadísticas de Helpdesk por tipo;
- compatibilidad con solicitudes anteriores mediante fallback de Soporte/Requerimiento;
- bootstrap actualizado para que workspaces nuevos nazcan con ADM/SOC/APP/AUT/FIN y los siete tipos de solicitud;
- `database.sql` consolidado y `upgrade-v15.4.sql` para actualización controlada.

### Despliegue

Para el frontend, reemplaza el contenido completo de la raíz por los archivos de este ZIP. `index.html` usa cache-busting `v=15.4.0`.

En el proyecto Supabase actual de Jira Interno TROBBU, la estructura de Tipos de solicitud ya fue aplicada durante la preparación de esta versión. `upgrade-v15.4.sql` se incluye para otros entornos o para una actualización controlada; evita ejecutar migraciones repetidamente sin revisar el estado del entorno.

## v15.5 · CSV + Tipos de solicitud Helpdesk

Esta versión parte del hotfix estable v15.4.1 e integra de forma incremental:

- Importación de Backlog desde Excel o CSV exportado desde Google Sheets.
- Descarga de plantillas XLSX y CSV desde el modal de importación.
- Productos ADM, SOC, APP, AUT y FIN compatibles con la plantilla.
- Configuración > Helpdesk segmentada en las tabs **Departamentos** y **Tipos de solicitudes**.
- CRUD escalable de tipos con nombre, código, descripción, icono, color, orden y estado.
- Tipos usados se desactivan en vez de eliminarse para conservar histórico.
- Selector de tipo en nuevas solicitudes, filtro por tipo y estadísticas por tipo.
- La columna interna `category` se conserva para la lógica especial de propuestas/requerimientos; `request_type_id` se usa para clasificación configurable y reporting.

Para actualizar desde v15.4.1 no se requiere una nueva migración de base de datos: el esquema de Tipos de solicitud ya está incluido en `upgrade-v15.4.sql` y aplicado en el proyecto actual.


## v15.6 · XLSM + CSV robusto

El importador de Backlog acepta XLSX, XLS, XLSM y CSV. Para CSV/Google Sheets detecta automáticamente la fila de encabezados dentro de las primeras 30 filas y normaliza variantes seguras de `Titulo*` y `Producto*`. Los XLSM se leen como hojas de cálculo; las macros no se ejecutan. No se modificó el esquema de base de datos para esta versión.

## v15.8 · Evidencias Helpdesk y operación rápida

Helpdesk permite adjuntar fotos comprimidas a comentarios usando el bucket privado `jira-evidence`. El archivo se optimiza en el navegador antes de Storage; PostgreSQL conserva únicamente metadatos del archivo. La asignación rápida permite elegir responsable y agregar comentario opcional en una sola operación protegida por RLS.

En el detalle de Sprint, el listado de actividades tiene scroll interno y cada ticket de un sprint no completado puede regresar directamente a Backlog.

## v15.9 · Evidencia inicial en Helpdesk

Al crear una solicitud de Helpdesk se pueden adjuntar hasta 5 fotografías. El navegador valida formato/tamaño, redimensiona hasta 1920 px y convierte a WebP solo cuando reduce el peso. Las imágenes quedan en el bucket privado `jira-evidence`; la base conserva únicamente metadatos. Si una carga falla, la solicitud recién creada se revierte para evitar reportes incompletos.

## v16 — Knowledge, Kanban enriquecido, Bulk Sprint, Staff y Realtime

La versión v16 incorpora un módulo Knowledge accesible a todos los miembros, sugerencias preventivas al crear tickets, tarjetas Kanban con prioridad/módulo/tags, movimiento múltiple de Backlog a sprint, edición de datos de Staff, regeneración segura de credenciales y sincronización en tiempo real mediante Supabase Realtime.

La contraseña actual de un usuario no puede ser leída desde Supabase Auth. La opción de Staff genera una contraseña temporal nueva y permite copiarla junto con el correo y `https://jiratrobbu.vercel.app/`.

El esquema consolidado está en `database.sql`; la actualización incremental está en `upgrade-v16.sql`. Ver `RELEASE-v16.md` y `QA-V16.md`.

## v16.1
- Notificaciones con scroll completo.
- Knowledge con editor por bloques, imágenes comprimidas y video embebido.
- Multimedia Knowledge privada con RLS.
- Helpdesk con scroll de comentarios y snapshot histórico del autor.

## v16.4 — Knowledge bilingüe y versionado
La aplicación incluye selector ES/EN. La UI estática usa un diccionario local; Knowledge usa traducciones cacheadas por versión para evitar consultas repetidas. Los artículos publicados son snapshots inmutables: para editar se crea una versión borrador con motivo obligatorio, que sustituye a la activa solo al publicarla. Para traducciones dinámicas configura `OPENAI_API_KEY` en Supabase Edge Function Secrets. Ver `RELEASE-v16.4.md` y `QA-V16.4.md`.

## Notification Center 360 · v16.5
El centro de actividad cubre Tickets, Helpdesk, Sprints, Knowledge y Staff. Los eventos se guardan con metadata estructurada, se deduplican y se muestran en ES/EN según el idioma del usuario. Los correos se procesan con la Edge Function `process-notifications` y respetan `profiles.locale`. Los CTA pueden abrir directamente Ticket, Helpdesk, Sprint, Knowledge o Staff.


## v16.6 · Deep links, ES/EN, Knowledge Preview y Producto Helpdesk

La v16.6 corrige enlaces Knowledge para respetar el dominio actual, completa una auditoría ES/EN, agrega preview lector desde el listado de Knowledge y permite clasificar solicitudes Helpdesk por producto opcional con herencia automática al Backlog. Ver `RELEASE-v16.6.md` y `QA-V16.6.md`.
