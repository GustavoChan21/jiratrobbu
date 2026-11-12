# QA v17.5.3 · Jira Interno TROBBU

## Resultado automatizado

- `npm run qa`: **203 / 203 PASS**.
- Archivos del proyecto: **101 exactos**.
- `database.sql` termina exactamente con `upgrade-v17.5.sql`.
- Sin marcadores de merge.
- SQL/CSS estructuralmente balanceados.

## Regresiones Vacaciones cubiertas

- `Analyze` envía `request_id` y compatibilidad con campos legado.
- Edge Function request-centric: ya no exige `workspace_id + user_id + start_date + end_date` desde frontend.
- Métricas superiores funcionan como filtros.
- Tabs de Pendientes / Fuera hoy / Aprobadas próximas / Mis solicitudes / Ver todo.
- Panel de solicitudes ubicado antes de saldo/timeline/admin.
- Aprobación independiente de análisis IA en UI y trigger DB.
- IA sigue disponible como recomendación/mitigación opcional.
- Calendario mensual removido.
- Permitidos/Ajuste aceptan decimales y medios días.
- `vacation_requests`, `vacation_types`, `vacation_balances` publicados en Realtime.
- `REPLICA IDENTITY FULL` para payloads de actualización completos.
- Canal WebSocket escucha las tres tablas.
- Fallback 15 s solo cuando Realtime entra en CHANNEL_ERROR/TIMED_OUT/CLOSED.
- Reparación previa de `date_blocks`, `return_date`, tipos y balances continúa incluida.
- Validación de saldo anual permanece en servidor.

## Validación contra Supabase real

Durante esta corrección se verificó y corrigió el proyecto `Jira Interno Trobbu` (`prweelxfuvbsdsxfopuh`):

- Se reemplazó el trigger/guard de Vacaciones por la variante donde IA es opcional.
- Se añadieron requests/types/balances a `supabase_realtime` y `REPLICA IDENTITY FULL`.
- Se desplegó `vacation-impact-assistant` v6 con entrada principal `request_id`.

## Smoke recomendado

1. Abrir Vacaciones como PM/Superadmin.
2. Confirmar que Pendientes está arriba y coincide con su contador.
3. Cambiar cada tab/chip y validar listado.
4. Analizar una solicitud pendiente.
5. Aprobar otra solicitud **sin** analizarla.
6. Guardar Ajuste = `0.5`, después `0,5`.
7. Probar Medio día primera/segunda mitad.
8. Con dos sesiones, modificar una solicitud y validar actualización Realtime en la otra.
9. Simular canal offline y comprobar refresco de respaldo.
10. Confirmar ausencia del calendario mensual.
