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
- `invite-member` desplegada en Supabase como versión **13 ACTIVE** con soporte a perfiles sin producto.

