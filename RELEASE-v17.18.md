# Jira Interno TROBBU v17.18.0

## Bloque Texto de Knowledge

- Se reemplaza el editor dependiente del DOM de React por un editor enriquecido aislado dentro de un iframe same-origin.
- React controla únicamente el contenedor; el DOM editable, caret y selección viven dentro del iframe y no son reconstruidos al renderizar toolbar, formularios o estados externos.
- La persistencia continúa usando `content_blocks[].html`, por lo que los artículos existentes no cambian de esquema ni requieren conversión destructiva.
- Se conservan texto enriquecido, links, tipografías, tamaños, colores, resaltados, listas, sangrías, alineación, interlineado, undo/redo y limpieza de formato.
- El editor bloquea drops directos de archivos dentro del texto y mantiene sanitización de HTML/URLs.
- QA de navegador real: escritura en medio del texto, cambio de caret, mutaciones del DOM padre, edición de link existente, escritura después del link y editor vacío.

## Bitácora y sesiones — Solo Superadmin

Nueva vista `Bitácora y sesiones`, visible exclusivamente para Superadmin y protegida también por RLS.

### Resumen
- Usuarios conectados.
- Número de accesos por usuario.
- Tiempo conectado acumulado.
- Último login.
- Última actividad.
- Estado conectado/desconectado.

### Sesiones
- Una fila por sesión de autenticación registrada.
- Inicio, última señal, tiempo activo, última vista y estado.
- Heartbeat cada 60 segundos únicamente con la aplicación visible.
- Periodos largos en segundo plano no se acumulan como tiempo conectado.

### Actividad
- Filtros por usuario, módulo, acción y periodo.
- Registros de tickets, sprints, Helpdesk, Knowledge, Vacaciones, Staff/Roles, configuración y catálogos.
- Los triggers de BD registran actor, `session_id`, entidad y campos modificados sin guardar contraseñas ni tokens.
- Navegación y eventos de sesión se registran mediante RPC autenticado.

## Política de sesión

- Duración máxima de sesión de aplicación por defecto: 12 horas.
- Superadmin puede elegir 8, 10, 12, 16 o 24 horas.
- No se alarga el JWT de Supabase a 12 horas; se conserva la renovación segura normal de Auth y Jira impone un límite superior a nivel de aplicación.
- Al alcanzar el límite, Jira registra el cierre y ejecuta `signOut()`.

## Base de datos

Migraciones de producción:
- `jira_v17_18_session_audit`
- `jira_v17_18_audit_indexes`

Nuevas tablas:
- `public.app_user_sessions`
- `public.app_audit_events`

Ambas usan RLS, `REPLICA IDENTITY FULL` y Realtime.

Los datos históricos de acceso/tiempo se consideran autoritativos a partir de v17.18. Las sesiones activas existentes al momento del rollout se importan como línea base con `seeded_from_auth=true`.
