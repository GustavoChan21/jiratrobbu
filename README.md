# Jira Interno TROBBU v17.5.1

**Base:** v17.5.0 Final Completo → v17.5.1. Se conservan exactamente **101 archivos**.

## Fix principal: Texto Knowledge desde cero

La corrección v17.5.1 resuelve el caso donde un bloque Texto vacío permitía escribir solo el primer carácter aunque contenido pegado sí pudiera editarse/formatearse. El editor ahora arranca con un párrafo real `<p><br></p>`, coloca un cursor válido al recibir foco y protege la primera entrada mediante `beforeinput`. El placeholder se controla con `data-empty`, no con `:empty`.

El flujo principal permite **escribir directamente y formatear durante la escritura**. Como protección adicional existe **Escritura segura**, un textarea estándar que permite capturar todo el contenido y posteriormente pasarlo a modo formato. Ese texto también participa en Guardar/Vista previa antes de cambiar de modo.

Las herramientas conservan formato parcial por selección: H1-H5, fuente, tamaño, negrita, cursiva, subrayado, tachado, color, resaltado, listas, sangría, alineación, enlaces, limpiar formato, interlineado y undo/redo.

## UX de salida

En la cabecera de autoría, **Salir** queda al mismo nivel visual que **Vista previa · Guardar borrador · Publicar artículo**. La alerta de cambios sin guardar se conserva.

## Cache / despliegue

Los recursos ahora usan `?v=17.5.1` para evitar que el navegador conserve `app.js` de v17.5.0.

- Si ya ejecutaste `upgrade-v17.5.sql`, **no debes ejecutarlo nuevamente** por este parche.
- Si vienes de v17.3.1, ejecuta `upgrade-v17.5.sql` una vez y luego publica v17.5.1.

## QA

`npm run qa` valida **163 casos**. También se ejecutó Chromium real mediante CDP: escritura carácter por carácter desde un editor vacío, selección parcial, negrita, cursiva, subrayado, link y continuación de escritura: **PASS**.

Consulta `RELEASE-v17.5.md` y `QA-v17.5.md`.

---

# Jira Interno TROBBU v17.2

**Base de actualización:** v17.1 → v17.2. Para instalaciones ya en v17.1 ejecuta únicamente `upgrade-v17.2.sql` y despliega los archivos/Edge Functions actualizados.

v17.2 corrige las regresiones restantes de Knowledge y endurece el flujo completo de autoría: crear borradores, reabrir borradores propios, editar, crear nuevas versiones, publicar, adjuntar imágenes y leerlas con RLS/Storage coherentes. El editor incorpora H1–H5 por bloque de título, texto enriquecido con fuente/tamaño/negrita/cursiva/subrayado/alineación, compatibilidad con párrafos antiguos, separadores y saltos de página.

El Asistente Knowledge ahora exige contexto en la descripción, analiza título + etiquetas + resumen + contenido completo del artículo, utiliza términos ancla no genéricos y puede devolver cero sugerencias. También se corrige el buscador doble y el Timeline/Gantt deja sus cinco controles lógicos en una sola fila de escritorio, apilándolos limpiamente en responsive.

Consulta `RELEASE-v17.2.md` y `QA-v17.2.md` para despliegue y validación.

---

# Jira Interno TROBBU v17.1

**Base de actualización:** v17.0 → v17.1. Para instalaciones ya en v17.0 ejecuta únicamente `upgrade-v17.1.sql` y despliega los archivos/Edge Functions actualizados.

v17.1 corrige regresiones detectadas en Knowledge y añade: creación inicial atómica de artículos, editor enriquecido, autoasignación manual de Helpdesk existente, counters coherentes con filtros, vacaciones multi-bloque con fecha de reincorporación y timeline, selector rápido de responsable compartido entre Kanban/Tabla, buscador de relaciones de tickets y ajuste de layout del Gantt.

Consulta `RELEASE-v17.1.md` y `QA-v17.1.md` para detalle de despliegue y validación.

---

# Jira Interno TROBBU v17.0

## v17.0 · Knowledge inteligente, Vacaciones y control operativo

Esta versión parte de v16.9 y agrega una revisión transversal de Helpdesk, Knowledge, Staff, Sprints, permisos y UI. Los cambios principales son:

- Asistente Knowledge con prefiltrado léxico + validación semántica; puede devolver cero artículos cuando no existe una coincidencia confiable.
- Filtros de Helpdesk por Nuevo, En revisión, Atendido, Resuelto y Cerrado; en “Ver todo” se prioriza trabajo abierto y se dejan Resuelto/Cerrado al final.
- Filtro por producto dentro del detalle de Sprint, con métricas calculadas sobre las actividades visibles.
- Actualización administrativa de contraseña desde Staff mediante Edge Function server-side.
- Autoasignación de Helpdesk basada en responsabilidades del integrante, límites diarios/activos, overflow y exclusión automática de personas con vacaciones aprobadas.
- RBAC granular de Knowledge: ver, crear, editar/publicar y eliminar.
- Categorías de Knowledge por producto/área: Sistemas, Recepción, Operaciones, Políticas, SOP, Reservaciones, Administración y General.
- Editor enriquecido de Knowledge con H1-H5, negrita, cursiva, subrayado, tamaño de texto y sanitización HTML.
- Nuevo módulo Vacaciones con solicitudes, calendario, permisos, alertas de ausencias de hoy y análisis de impacto contra sprints/entregables antes de aprobar.
- La aprobación de vacaciones exige análisis vigente; se invalida si cambian tickets asignados, planeación de sprint, disponibilidad del equipo o pasan más de 12 horas.
- Normalización visual de inputs, selects y textareas en superficies principales.

### Actualización desde v16.9

1. Ejecuta `upgrade-v17.0.sql` en la base de datos del proyecto.
2. Despliega las Edge Functions modificadas: `manage-member`, `invite-member`, `auto-assign-helpdesk`, `trobbu-knowledge-assistant`, `translate-knowledge-version` y la nueva `vacation-impact-assistant`.
3. Publica los archivos estáticos (`index.html`, `app.js`, `styles.css` y demás archivos del paquete).
4. Configura `OPENAI_API_KEY` o `AI_GATEWAY_API_KEY`. Los modelos pueden sobreescribirse con `TROBBU_OPENAI_MODEL` / `TROBBU_AI_MODEL`.
5. Ejecuta `npm run qa` antes y después del despliegue de los archivos.

Consulta `RELEASE-v17.0.md` y `QA-v17.0.md` para el detalle de cambios y verificación.




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

## v16.7 · Workspace governance, contadores, asignación rápida y documentos

La v16.7 restringe la creación de workspaces a Admin/PM/Superadmin, corrige contadores, agrega asignación rápida auditable en Kanban, elimina el Centro de ayuda, incorpora favicon TROBBU y amplía los adjuntos privados a documentos Office/PDF/CSV. Ver `RELEASE-v16.7.md` y `QA-V16.7.md`.


## v16.8 — Intelligent Helpdesk routing

Staff can document responsibilities for Helpdesk auto-routing, configure per-user daily/active capacity, overflow/fallback behavior and queueing. The Helpdesk assistant can use OpenAI when configured and always has deterministic local routing as a fallback. Assigned specialists can redirect incorrectly routed work, comment and attach evidence without becoming Helpdesk administrators. The default TROBBU workspace is configured for 4 assignments/day + 4 active requests, overflowing to Gustavo Chan, with a queue processor running every minute.

## v16.9 — Contadores estables, carga privada y adjuntos unificados

- Contadores del Sidebar calculados mediante RPC RLS-aware independiente de los arrays visuales.
- Badges únicamente en Tablero, Backlog/Sprints, Knowledge, Mis tareas/Helpdesk y productos autorizados.
- Productos operativos cargados con `list_authorized_products`; Helpdesk conserva su catálogo separado según permisos.
- Skeleton privado mientras se valida workspace/rol/permisos; evita mostrar nombres de módulos o datos del workspace anterior.
- `loadWorkspaceData()` tolera errores opcionales sin perder toda la hidratación.
- Comentarios de Ticket y Sprint aceptan archivo sin texto y comparten la whitelist documental de Helpdesk.
- `upgrade-v16.9.sql` y `QA-V16.9.md` documentan los cambios y pruebas.
