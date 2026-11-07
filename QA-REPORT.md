# QA Report · Jira Interno TROBBU v10.1

Fecha de validación: 06/11/2026. Backend: Supabase `prweelxfuvbsdsxfopuh`.

## Resultado

**PASS** en las matrices funcionales ejecutadas con RLS activo y transacciones con `ROLLBACK`, sin dejar datos de prueba.

## Cobertura validada

- Workspace: crear por RPC, lectura inmediata, editar, cambiar, eliminar Admin, cascada y bloqueo de eliminación para PM.
- Bootstrap: 3 productos, configuración y 6 áreas de Helpdesk por nuevo workspace.
- Productos: crear, editar, eliminar e integridad de workspace.
- Sprints: crear, editar, eliminar y `SET NULL` de `sprint_id` sin alterar workspace.
- Tickets: crear, editar, eliminar, estados, responsables Dev/QA, story points, fecha límite, claves independientes por workspace y actividad.
- Comentarios de tickets: crear, editar y eliminar con permisos.
- Roles: Admin, PM, Dev, QA y Viewer; Viewer solo lectura en tickets; PM no puede otorgar Admin; no se puede dejar el workspace sin Admin activo.
- Helpdesk: crear, editar, eliminar, categorías, área, asignación, estado, SLA automático, comentarios, actividad y privacidad del requester.
- Helpdesk deshabilitado: RLS bloquea nuevas solicitudes.
- Notificaciones in-app: creación, leído/no leído y eliminación; preferencias in-app/email respetadas.
- Cola de email: Resend/Mailgun, reintentos y reporte de proveedor no configurado.
- Integridad: producto/sprint/área deben pertenecer al mismo workspace; `workspace_id`, creator/reporter/requester y memberships protegidos contra reasignación.
- Responsables: solo miembros activos y con rol compatible pueden recibir nuevas asignaciones; los históricos siguen actualizables después de una baja.
- Perfil: visible solo al propio usuario o a personas del mismo workspace.
- UI: JSX parseado sin errores, CSS parseado sin errores, 82 botones auditados, 0 botones sin acción, 0 botones de form con submit implícito, 0 `alert/prompt/confirm`.
- Modales: 29 tipos abiertos y 29 rutas correspondientes en `ModalRouter`, sin rutas huérfanas.
- Responsive: navegación móvil agregada para Resumen, Tablero, Mis tareas, Helpdesk, Equipo y Configuración.

## Estado de Supabase

- Health advisor: sin incidencias.
- Security advisor: únicamente recomienda habilitar **Leaked Password Protection** en Supabase Auth. Esta preferencia no es modificable mediante el conector disponible en esta sesión.
- Edge Functions activas: `invite-member` v5 y `process-notifications` v5.

## Dependencias externas

El transporte de correo operativo requiere secretos de Resend o Mailgun. La aplicación detecta si existe proveedor y evita aparentar un envío exitoso cuando no está configurado. Las notificaciones in-app no dependen de ese proveedor.

La publicación automática en `GustavoChan21/jiratrobbu` no puede ejecutarse desde esta sesión porque la GitHub App devuelve `403 Resource not accessible by integration` tanto en Contents API como Git Data API y reporta cero instalaciones autorizadas.
