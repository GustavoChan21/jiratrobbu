# QA Report — Jira Interno TROBBU v13.0

Fecha de cierre: 07/11/2026.

## Resultado

Las pruebas se ejecutaron después de aplicar los cambios v13 a Supabase. Los datos de QA de base de datos se ejecutaron dentro de transacciones con `ROLLBACK`.

### Roles administrables

**7/7 PASS**

- Se crean exactamente los seis roles base por workspace.
- Crear rol personalizado.
- Editar rol personalizado.
- Eliminar rol personalizado sin asignaciones.
- Superadmin no puede eliminarse.
- Todos los permisos de Superadmin permanecen forzados a `true`.
- El creador del workspace queda relacionado con el `role_id` Superadmin y todos los productos.

Prueba adicional de roles asignados: **3/3 PASS**

- Un rol personalizado concede sus permisos efectivos.
- Un rol asignado no puede eliminarse.
- Cambiar el rol base de una plantilla sincroniza a sus miembros.

### Superadmin E2E

**10/10 PASS**

- Editar workspace y configuración.
- Crear/editar/eliminar roles.
- Crear/editar/eliminar productos.
- Crear/editar/eliminar Sprints.
- Crear/editar/eliminar tickets.
- Crear/editar/eliminar Helpdesk.
- Mover ticket a Backlog limpiando fechas/sprint.
- Eliminar workspace completo con cascada.

Durante esta prueba se detectó y corrigió un bloqueo del cascade provocado por la protección del rol Superadmin. La prueba se repitió después de la corrección y terminó 10/10.

### Scope por producto

La matriz v12/v13 previa terminó **16/16 PASS** y se añadió una prueba específica de Admin limitado: **3/3 PASS**.

- Dev/QA/Consulta no pueden leer ni crear tickets fuera de sus productos.
- Consulta base es read-only.
- Consulta con override `create_tickets` puede cargar únicamente tickets no planificados en Backlog.
- PM conserva gestión de Sprints.
- Admin puede conservar permisos administrativos y limitarse a productos concretos.
- Superadmin ignora cualquier restricción de producto y permanece global.

### Privacidad secundaria

**7/7 PASS**

- Actividad de un ticket de producto no autorizado queda oculta.
- Notificación de producto no autorizado queda oculta.
- Helpdesk ajeno queda oculto sin `manage_helpdesk`.
- Comentarios y actividad Helpdesk también quedan ocultos.
- El alta desde portal se normaliza a `Creado / Portal / sin responsable`.
- Un override explícito `manage_helpdesk=true` habilita nuevamente la mesa de atención.

### E2E funcional general

La matriz anterior después de la capa v12 terminó **13/13 PASS**:

- bootstrap de workspace;
- configuración;
- producto;
- Sprint;
- ticket con fechas Gantt;
- evidencias;
- actividad;
- Helpdesk y timestamps;
- comentarios;
- notificaciones;
- rollover de Sprint;
- eliminaciones;
- cascade del workspace.

## Invitación / creación de usuarios

Los logs de Supabase confirmaron `POST 400` en `invite-member` exactamente durante los intentos mostrados en las capturas del 07/11/2026.

Se identificó una incompatibilidad: la UI anterior enviaba el valor legado `reporter` (`Solo carga de tickets`) mientras la función nueva aceptaba únicamente los seis roles base. `invite-member` v11 corrige esto:

- normaliza `reporter → consulta + create_tickets`;
- normaliza `viewer → consulta`;
- trabaja con `role_id` real del workspace;
- reutiliza usuarios existentes;
- intenta `inviteUserByEmail`;
- si el envío falla y el usuario no existe, utiliza `auth.admin.createUser` con contraseña temporal aleatoria;
- devuelve la contraseña temporal únicamente a la sesión administrativa autorizada;
- valida productos y permisos antes de crear la membresía;
- devuelve mensajes de error específicos.

No fue posible crear desde las herramientas de administración de esta sesión un usuario Auth caller con JWT para invocar la función como navegador, porque el conector bloqueó la escritura directa sobre `auth.users`. Por ello no se declara una prueba JWT artificial. La función desplegada está `ACTIVE`, `verify_jwt=true`, y sus componentes de BD/RLS fueron probados separadamente. El siguiente intento desde una sesión real utilizará la versión 13 de `invite-member`, compatible con perfiles sin producto.

## QA frontend estático

Resultado final:

- Parse JSX/TypeScript: **0 errores**.
- `alert()`: **0**.
- `prompt()`: **0**.
- `confirm()`: **0**.
- `AsyncForm`: **19/19** con footer común y botón Cancelar.
- Botones auditados: **149**, **0** sin handler o `type=submit`.
- Aperturas de modal: **38**.
- Rutas de modal: **38**.
- Rutas de modal faltantes: **0**.
- Balance de llaves CSS: **0**.
- Etiquetas UI legadas `Solo carga de tickets` / `Solo dashboards`: **0**.

## QA visual responsive

Se revisaron los layouts finales mediante Chromium/Playwright con CSS real de la aplicación.

### Selector de workspace

- Desktop 1440 px: sin overflow; footer horizontal correcto.
- Tablet 820 px: sin overflow.
- Mobile 390 px: sin overflow; Cancelar y Crear workspace apilados a ancho completo.

### Modal de rol

- Desktop/tablet: Cancelar y Guardar alineados en el footer.
- Mobile 390 px: ambos botones a ancho completo, primero Cancelar y después Guardar.

### Roles

- Tarjetas de roles responsive sin overflow general.
- Superadmin se muestra protegido.
- Editar/Eliminar visibles únicamente según reglas.

### Timeline/Gantt

- Sin overflow horizontal del documento.
- El scroll horizontal queda contenido dentro del Timeline.
- Columna de tareas fija + meses/días + barras de Sprint/ticket.
- Navegación histórica y selector de Sprint.
- Acciones de detalle, edición, Backlog y eliminación por fila.

## Supabase

Health Advisor: **0 incidencias** en la última revisión previa a empaquetado.

Security Advisor: permanece la recomendación externa `Leaked Password Protection Disabled` de Supabase Auth. No afecta el RLS ni las funcionalidades de Jira Interno, pero se recomienda activarla desde la configuración de Auth.

## QA v14.0

- Backend Helpdesk/propuestas: **10/10 PASS** en aislamiento, SLA, conversión a Backlog y visibilidad de notificaciones.
- QA visual: **15/15 PASS** en desktop/tablet/móvil para Login, Registro, Gantt, Staff Portal y Mis solicitudes; sin overflow general.
- JSX parser: **0 errores**.
- Rutas de modal: **38/38** implementadas.
- Formularios con footer común: **19/19**.
- Diálogos nativos (`alert`, `prompt`, `confirm`): **0**.
- `invite-member` desplegada en Supabase como versión **15 ACTIVE** con soporte a perfiles sin producto y contraseña inicial explícita.



## QA v14.1 — Correcciones solicitadas 07/11/2026

### Staff / credenciales

- El modal **Agregar Staff** permite elegir **Crear con contraseña** o **Enviar invitación**.
- Crear con contraseña es el modo inicial y genera una contraseña fuerte que el administrador puede editar, mostrar u regenerar.
- La Edge Function `invite-member` v15 usa `auth.admin.createUser` cuando se define contraseña, confirma el email para acceso inmediato y devuelve la contraseña únicamente en la respuesta de esa operación administrativa.
- Si el correo ya existe, el flujo con contraseña se bloquea para no sobrescribir credenciales existentes; se debe usar invitación/agregar al workspace.
- La contraseña nunca se persiste en tablas del workspace ni en perfiles.

### Configuración

- Corregido `ReferenceError: canManage is not defined` al entrar a **Productos** o **Sprints**.
- Productos usa `canManageProducts`; Sprints usa `canPlan`.
- La tab Helpdesk vuelve a exponer CRUD de departamentos para administradores: crear, editar, activar/desactivar y eliminar.

### Helpdesk

Matriz transaccional backend: **7/7 PASS**.

- Alta desde portal forzada a `created`, `assigned_to=null`, `due_at=null`, `source=portal`.
- Solicitante y correo se normalizan desde la sesión autenticada.
- PM/Admin/Superadmin recibe `Nueva solicitud por canalizar · HD-X`.
- El solicitante recibe confirmación de creación.
- Al canalizar a `review`, si no se definió fecha objetivo, el SLA se calcula automáticamente.
- El responsable asignado recibe notificación.
- Módulos/funcionalidades/requerimientos permanecen sin SLA y generan `Nueva propuesta por decidir · HD-X`.

### QA visual v14.1

Chromium/Playwright: **12/12 PASS** sin overflow general en desktop 1440, tablet 820 y mobile 390 para:

- Configuración / Productos;
- Configuración / Helpdesk;
- Staff con contraseña inicial;
- Alta de solicitud Helpdesk sin campos internos.

Sanity estático:

- `SettingsView`: 0 referencias a `canManage` fuera de scope.
- Llaves, paréntesis y corchetes balanceados en `app.js`.
- El alta Helpdesk solo muestra información de solicitud y solicitante; los campos de atención interna aparecen únicamente al editar una solicitud existente con permisos de mesa.

### Revisión final Supabase v14.1

- Health Advisor: **0 incidencias**.
- Security Advisor: únicamente `Leaked Password Protection Disabled` (configuración global de Auth ya existente).
- `invite-member`: **v15 ACTIVE**, `verify_jwt=true`.
- Residuos de QA: **0 workspaces** y **0 solicitudes** persistidas.


## v14.3 · Manual Excel + Vercel Speed Insights

- Plantilla Excel incluye hoja `Manual`.
- Manual raíz: `MANUAL_IMPORTACION_EXCEL.md`.
- `package.json` declara `@vercel/speed-insights ^2.1.0`.
- Loader raíz `speed-insights.js`.
- `index.html` carga Speed Insights una sola vez y omite local/GitHub Pages.
- Todos los archivos de implementación continúan en la raíz.


## v15.1 · Responsive / UI / UX stabilization

- 32/32 escenarios visuales sin overflow global en 4 viewports.
- 12/12 E2E funcional backend con rollback.
- 50/50 rutas de modal implementadas.
- 189 botones auditados, 0 sin acción.
- 24 AsyncForm; footers normalizados.
- 0 alert(), confirm() o prompt() nativos.
- 0 errores JSX/TypeScript detectados.
- Reportes y Catálogos recuperan el mismo gutter `.page` que el resto del sistema.
- `content-card` definido y homologado con `workspace-panel`.
- Gantt móvil corregido: navegación `← / Hoy / →` ya no se parte en filas inconsistentes.
- Health Advisor Supabase: 0 incidencias. Security Advisor: solo Leaked Password Protection Disabled.
- 0 registros QA persistidos.

## v15.4 · CSV + Productos AUT/FIN + Tipos de solicitud Helpdesk

### Base

- Fuente: `jiratrobbu-v15.1-final.zip` exacto, preservando la estabilización responsive 15.1.
- `index.html`, `app.js`, `styles.css`, SQL y plantillas actualizados sobre esa base.

### Frontend / sintaxis

- JSX/JavaScript validado con TypeScript parser sobre copia `.jsx`: 0 errores de sintaxis.
- Paréntesis, llaves y corchetes: balance 0/0/0.
- Cache-busting actualizado a `15.4.0`.
- SheetJS agregado explícitamente al loader.
- Parser CSV incluido antes de `app.js`.
- Sin nuevos `alert()`, `prompt()` o `confirm()` nativos.

### Importación

- XLSX/XLS conserva el flujo v15.1.
- CSV usa el mismo modelo intermedio y las mismas validaciones del Excel.
- CSV soporta BOM, CRLF/LF, comillas, comillas escapadas, campos multilínea y separadores coma/punto y coma/tab.
- Productos válidos en plantilla: ADM, SOC, APP, AUT, FIN.
- Story Points: 1–5.
- Máximo: 250 tickets por lote.
- Importación atómica mediante RPC existente.

### Helpdesk Tipos de solicitud

- Tabla relacional por workspace con RLS.
- 7 tipos iniciales.
- CRUD disponible desde Configuración → Helpdesk → Tipos de solicitud.
- Usuarios con `manage_helpdesk` también pueden acceder al apartado de configuración de Helpdesk sin recibir permisos de edición global del workspace.
- Alta de solicitud exige tipo activo.
- Filtro por tipo agregado a Mesa de atención.
- Estadística por tipo agregada a Mesa y Portal.
- Tipo visible en cards, tabla y detalle.
- Un tipo utilizado no se elimina desde UI; se desactiva para preservar histórico.

### Backend validado previamente durante v15.3

- Usuario Consulta: lectura de catálogo PASS; escritura bloqueada PASS.
- Superadmin: crear/editar/desactivar/eliminar tipo no usado PASS.
- Workspace temporal: 5 productos + 7 tipos PASS.
- Ticket general sin tipo: fallback Soporte PASS.
- Requerimiento sin tipo: fallback Requerimiento PASS.
- Backfill de solicitud existente PASS.
- Pruebas transaccionales con rollback; 0 residuos QA.
- Supabase Health Advisor: 0 incidencias.
- Security Advisor: solo `Leaked Password Protection Disabled`, aviso global preexistente de Auth.

### Responsive / regresión

Se preservan los estilos y componentes v15.1. Los componentes nuevos reutilizan `page`, `workspace-panel`, `settings-content`, `entity-list`, `form-grid`, `AsyncForm`, `Modal` y footers existentes. Se añadieron reglas móviles específicas para descargas, resumen por tipo, tabs de Helpdesk y filas CRUD.

La navegación gráfica automatizada del runtime actual está bloqueada por la política del navegador del entorno, por lo que la comprobación de esta integración se realizó mediante parser JSX, revisión estática, backend real y preservación de los componentes responsive ya validados en v15.1.

### Cierre QA v15.4

- Parser CSV automatizado: **11/11 PASS**.
- Plantilla XLSX: códigos `ADM`, `SOC`, `APP`, `AUT`, `FIN` verificados.
- JSX/JS parse: **PASS**, 0 errores de sintaxis.
- Archivos obligatorios de despliegue: **PASS**.
- Referencias de `index.html`: SheetJS + CSV helper + cache `15.4.0`: **PASS**.
- Backend post-ajuste: 5 productos, 7 tipos, 0 solicitudes sin `request_type_id`.
- Histórico con tipo desactivado: edición conservada **PASS** con rollback.
- Health Advisor final: **0 incidencias**.
- Security Advisor final: solo `Leaked Password Protection Disabled`.

# QA v15.5 · CSV + Tipos de solicitud Helpdesk

Fecha: 2026-11-09
Base: v15.4.1 hotfix estable (runtime v15.1) + integración incremental.

## Alcance validado

- Backlog: importación XLSX/XLS y CSV exportado desde Google Sheets.
- CSV: BOM UTF-8, CRLF/LF, comas, punto y coma, tabuladores, campos entre comillas, comillas escapadas y campos multilínea.
- Productos permitidos en plantilla: ADM, SOC, APP, AUT, FIN.
- Configuración > Helpdesk con dos tabs internas: Departamentos / Tipos de solicitudes.
- CRUD Tipos de solicitudes: crear, editar, activar/desactivar, validación de duplicados y eliminación segura.
- Nueva solicitud Helpdesk: request_type_id obligatorio y solo tipos activos.
- Histórico: tipos desactivados siguen visibles en tickets existentes y estadísticas.
- Filtro y segmentación por Tipo de solicitud.
- Estadísticas de Helpdesk por Tipo de solicitud.
- Regresión de lógica especial de Requerimientos basada en category interno.

## Resultados

- JSX/JavaScript de app.js: 0 errores de parseo (TypeScript JSX transpile).
- csv-import-v15.2.js: 11/11 pruebas PASS.
- config.js / speed-insights.js / parser CSV: sintaxis JavaScript PASS.
- Supabase CRUD de helpdesk_request_types como Superadmin: PASS con rollback.
- Lectura de tipos y creación de solicitud con request_type_id como usuario Consulta/Portal: PASS con rollback.
- Catálogo actual: 7 tipos de solicitud.
- Productos actuales: 5.
- Solicitudes Helpdesk sin request_type_id: 0.
- import_backlog_tickets con payload equivalente a CSV: PASS con rollback.
- Supabase Health Advisor: 0 findings.
- Security Advisor: únicamente aviso global existente `Leaked Password Protection Disabled`.

## Actividad QA creada

- Ticket: ADM-1
- Título: QA v15.5 · CSV + Tipos de solicitud Helpdesk
- Producto: Web Administrativa
- Estado: Backlog
- Story Points: 3

El ticket contiene la matriz de validación funcional y responsive para ejecución manual/regresión en el entorno desplegado.
