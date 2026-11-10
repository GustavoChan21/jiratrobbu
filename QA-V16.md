# QA v16 — Jira Interno TROBBU

No se crearon tickets ni solicitudes de Helpdesk para ejecutar este QA.

## Frontend / código
- `app.js` validado como JavaScript + JSX con TypeScript: 0 errores.
- `config.js`: sintaxis PASS.
- `csv-import-v15.2.js`: sintaxis PASS.
- `speed-insights.js`: sintaxis PASS.
- Importación CSV/XLS/XLSX/XLSM: 16/16 casos PASS.
- CSS: llaves balanceadas.
- `alert()`, `confirm()` y `prompt()` nativos: 0.
- Cache bust: `v=16.0.0`.
- Verificación estática de rutas/componentes: Knowledge, sugerencias, Kanban enriquecido, bulk sprint, Staff y Realtime presentes.

## Kanban
- Prioridad enlazada a `ticket.priority`.
- Marcador visual para `highest` y `blocker`.
- Módulo resuelto por `module_id`.
- Tags resueltos mediante `ticket_tag_links` + `ticket_tags`.
- Límite visual de 3 tags + contador adicional.
- Responsive CSS específico a 720 px.

## Bulk Sprint — prueba real con rollback
- Superadmin: 5 tickets movidos a un sprint activo en una sola llamada: PASS.
- `sprint_id`, fecha inicio y fecha límite asignados correctamente: PASS.
- Rollback: 0 cambios residuales.
- Ticket Backlog pasa a `todo`: PASS con rollback.
- Usuario Consulta sin `manage_sprints`: bloqueado correctamente.
- RPC SECURITY INVOKER y máximo 100 tickets.

## Knowledge — prueba RLS con rollback
- Superadmin puede crear Publicado/Borrador: PASS.
- Usuario Consulta ve Publicado: PASS.
- Usuario Consulta no ve Borrador: PASS.
- Usuario Consulta no puede crear artículo: PASS.
- Rollback: 0 artículos QA residuales.
- FK nuevas de Knowledge cuentan con índices directos; Performance Advisor ya no reporta FK de Knowledge sin índice.

## Staff / Auth
- `profiles.email` agregado y sincronizado desde Auth.
- 8/8 miembros activos actuales con email en `profiles`.
- `manage-member` desplegada ACTIVE con `verify_jwt=true`.
- `invite-member` desplegada ACTIVE versión 17 con URL Vercel.
- `trobbu-knowledge-assistant` desplegada ACTIVE con `verify_jwt=true`.
- Revisión estática: `manage-member` exige `manage_staff` y limita modificación de Superadmin.
- La contraseña existente no se expone; solo se puede regenerar una temporal.

## Realtime
- 24 tablas relevantes verificadas dentro de `supabase_realtime`.
- Cliente suscrito a tablas con `workspace_id` usando filtro de workspace.
- Tablas relacionadas sin `workspace_id` utilizan RLS y suscripción sin filtro.
- Cleanup del channel al cambiar de workspace/unmount.
- Debounce 220 ms para agrupar eventos.
- Polling de notificaciones cada 15 s se mantiene como fallback.

## Supabase Advisors
- Health Advisor: 0 lints.
- Security Advisor: solo aviso preexistente `Leaked Password Protection Disabled`.
- Performance Advisor: 39 FK legacy sin índice, 5 grupos de políticas permisivas legacy y algunos índices aún sin uso. No se introdujo ninguna FK de Knowledge sin índice en v16.

## Límites de QA
No se realizó un E2E visual multiusuario con dos navegadores autenticados simultáneamente porque el entorno de ejecución no dispone de las sesiones reales de los usuarios. La configuración Realtime, publicación, cliente, RLS y compilación sí fueron verificadas directamente.
