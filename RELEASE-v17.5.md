# RELEASE v17.5.3 · Jira Interno TROBBU

## Base
v17.5.2, compatible con instalaciones que continúan en Git v17.5.1 mediante `upgrade-v17.5.sql` re-ejecutable.

## Cambios principales

- Corregido el desfase entre frontend y `vacation-impact-assistant`: el análisis recibe `request_id` y la función recupera internamente workspace, usuario y bloques.
- Solicitudes movidas al inicio de Vacaciones.
- Métricas superiores convertidas en filtros interactivos.
- Tabs de solicitudes: Pendientes, Fuera hoy, Aprobadas próximas, Mis solicitudes y Ver todo.
- IA convertida explícitamente en **asesoría opcional**; la aprobación/rechazo es decisión humana y no queda bloqueada por análisis inexistente o vencido.
- Eliminado el calendario mensual de ausencias.
- Ajustes/permitidos aceptan medios días decimales (`0.5` o `0,5`).
- `vacation_requests`, `vacation_types` y `vacation_balances` integradas a Supabase Realtime/WebSocket con `REPLICA IDENTITY FULL`.
- Fallback de refresco cada 15 s únicamente mientras el WebSocket esté desconectado.
- Se preservan CRUD de tipos, bloques múltiples, reincorporación, saldos, Knowledge, Helpdesk, Gantt, Kanban/Tabla y autoasignación.

## Deploy

1. Ejecutar `upgrade-v17.5.sql` completo.
2. Desplegar `vacation-impact-assistant.ts`.
3. Publicar frontend v17.5.3.
4. Ejecutar `npm run qa`.

## Estado validado

En el Supabase `Jira Interno Trobbu` se aplicó la migración de workflow/realtime y se desplegó `vacation-impact-assistant` versión 6 durante esta corrección. El repo v17.5.3 queda alineado con ese estado.
