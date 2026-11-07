# QA Report — Jira Interno TROBBU v12.1

Fecha de revisión: 7 noviembre 2026.

## Estado final

- Backend / CRUD / RLS: **PASS**
- Staff y Roles: **PASS**
- Scope por workspace/producto: **PASS**
- Superadmin full access: **PASS**
- Gantt: **PASS**
- Backlog / Sprints: **PASS**
- Helpdesk: **PASS**
- Evidencias: **PASS**
- JSX/CSS: **PASS**
- Modales: **PASS**
- Responsive: **PASS**

Todas las escrituras QA contra Supabase se ejecutaron dentro de transacciones con `ROLLBACK`. El estado final reporta **0 workspaces, tickets y solicitudes Helpdesk QA persistidos**.

## Matriz de producto/permisos — 16/16 PASS

1. Superadmin conserva todos los permisos aunque su JSON intente desactivarlos.
2. Dev limitado a ADM solo ve el producto ADM.
3. Dev crea ticket en producto autorizado.
4. Dev no puede crear ticket en producto no autorizado.
5. Dev solo consulta tickets del producto autorizado.
6. QA puede operar ticket del producto autorizado.
7. Consulta base es lectura únicamente y respeta producto.
8. Consulta no puede crear ticket por defecto.
9. Consulta no puede editar ticket.
10. Override `create_tickets=true` permite carga controlada a Backlog.
11. Usuario con create pero sin edit no puede introducir fechas/planificación.
12. PM puede gestionar sprints.
13. Admin mantiene todos los productos.
14. Admin puede administrar mappings de productos del Staff.
15. Un permiso de Admin puede revocarse mediante override.
16. Overrides restrictivos nunca reducen a Superadmin.

## Pruebas de privacidad — 7/7 PASS

1. Actividad de un ticket de producto no autorizado queda oculta.
2. Notificación de un producto no autorizado queda oculta.
3. Caso Helpdesk ajeno queda oculto sin `manage_helpdesk`.
4. Comentarios Helpdesk ajenos quedan ocultos sin permiso.
5. Actividad Helpdesk ajena queda oculta sin permiso.
6. Alta de portal se normaliza a `created / portal / sin responsable`.
7. Un override `manage_helpdesk=true` habilita correctamente Mesa de atención y asignación.

## E2E final — 13/13 PASS

1. Bootstrap de workspace: Superadmin + 3 productos + 10 departamentos.
2. Actualización de configuración.
3. CRUD de producto.
4. Creación de sprint con detalle.
5. Ticket con fechas Gantt, responsable, story points y cambio de estado.
6. Comentario/evidencia de ticket.
7. Actividad de ticket.
8. Flujo Helpdesk completo con timestamps.
9. Comentario Helpdesk.
10. Notificaciones in-app.
11. Cierre y rollover trasladó exactamente 3 tickets pendientes y conservó el cerrado en origen.
12. Deletes de Helpdesk/tickets/sprints/producto.
13. Eliminación de workspace con cascada.

## Frontend / sintaxis

- Parser JSX real (TypeScript ScriptKind.JSX): **0 diagnostics**.
- CSS PostCSS parse: **PASS**.
- Botones auditados por AST: **125**.
- Botones no-submit sin acción: **0**.
- Formularios `AsyncForm`: **17**.
- Formularios sin botón Cancelar: **0**.
- Botones internos de formularios sin `type`: **0**.
- Tipos de modal abiertos: **32**.
- Rutas de modal implementadas: **32**.
- Rutas de modal faltantes: **0**.
- `alert()`, `prompt()`, `confirm()`: **0**.

Durante esta revisión el parser detectó inicialmente un error JSX en la fila Staff. Fue corregido y el parser se volvió a ejecutar con **0 diagnostics** antes del empaquetado.

## QA visual Playwright — 12/12 PASS

Renderizado real de CSS/DOM en Chromium mediante Playwright, 3 tamaños:

- Desktop: 1440×900
- Tablet: 820×1180
- Mobile: 390×844

Módulos probados:

- Staff
- Roles base
- Gantt
- Modal largo de Accesos

Validaciones:

- sin overflow horizontal del documento;
- Staff contenido dentro del viewport;
- matriz de roles usa scroll interno en móvil;
- Gantt usa scroll horizontal interno, nunca el documento;
- modal contenido dentro del viewport;
- footer no queda recortado;
- Cancelar y Guardar permanecen dentro del modal;
- móvil: Cancelar arriba, Guardar abajo, ambos a ancho completo.

Resultado: **12/12 PASS**.

## Gantt

Se verificó visualmente:

- bandas de sprint;
- barras de tickets;
- porcentaje/progreso;
- 4/8/12 semanas;
- navegación temporal;
- indicadores de tickets planificados, sin fechas, vencidos y cerrados;
- sección de actividades sin programar;
- sticky label de actividad y scroll interno en móvil.

## Supabase final

- Usuario principal en `Trobbu Tecnología`: **Superadmin**.
- `all_products=true`.
- `manage_staff=true`.
- `manage_settings=true`.
- Productos del workspace: 3.
- `invite-member`: ACTIVE v9.
- `process-notifications`: ACTIVE v6.
- Health Advisor: **0 issues**.
- Security Advisor: solo permanece **Leaked Password Protection Disabled** de Supabase Auth.
