# RELEASE v17.12.0 - Jira Interno TROBBU

## Objetivo
Cerrar definitivamente los pendientes visuales y de actualización de la v17.11 sin ampliar el esquema de base de datos.

## Correcciones principales
- Counters de Ticket/Helpdesk/Sprint derivados de las mismas filas renderizadas. Si una fila de comentario o actividad está visible, el badge no puede permanecer en 0.
- Eliminada la dependencia de `HEAD count` para counters de detalle, reduciendo discrepancias por RLS/caché.
- Realtime sigue invalidando cada detalle mediante `liveRevision` y además permanece la reconciliación periódica.
- Actividad de asignación nunca presenta UUID crudo; usa nombre/correo del miembro o un fallback humano.
- Vista previa interna para imágenes, PDF y texto/CSV; formatos que el navegador no puede mostrar conservan apertura externa.
- El paso actual del flujo Helpdesk tiene pulso verde animado, respetando `prefers-reduced-motion`.
- Texto de la barra de Sprint en Gantt blanco en modo oscuro; porcentajes de actividades conservan texto oscuro.
- Counters de columnas Kanban usan colores semánticos de alto contraste en modo oscuro.
- Vista Mencionados con gutters, grid responsive y filas adaptadas a tablet/móvil.
- Cache bust actualizado a v17.12.0 en todos los assets principales.

## SendPulse
- QA permanece activo.
- Remitente productivo preferido configurado en Supabase: `Helpdesk TROBBU <gustavo.chan@trobbucollection.com>`.
- Mientras SendPulse siga en SMTP Test, el proveedor fuerza `devtest@sendpulseemail.com`.
- Producción permanece bloqueada hasta que SPF/DKIM permitan el remitente corporativo por SMTP.

## Base de datos
Sin migración nueva. Se conserva `upgrade-v17.11.sql` como último cambio de esquema.
