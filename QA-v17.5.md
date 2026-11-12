# QA v17.5.4 · Jira Interno TROBBU

## Resultado automatizado

- `npm run qa`: **226 / 226 PASS**.
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

## Cobertura adicional v17.5.4

- URL `view/tab/mode` preserva módulo, tabs y modo de tablero al recargar/navegar atrás/adelante.
- `decision_by` y `ai_*` existen aun sobre instalaciones con columnas legado; histórico migrado sin borrar información.
- Helper anual de saldo existe antes del guard de Vacaciones.
- Permiso independiente `view_vacation_projection` cubierto en UI, defaults y RLS.
- Saldo anual guardado usa `upsert().select().single()` y actualiza estado inmediatamente.
- Knowledge utiliza únicamente artículos publicados con `active_version_id` y contenido de la versión pública activa.
- Umbrales semánticos estrictos + cero resultados permitido + GPT-6.1 Sol cuando está disponible.
- KPI chips del Gantt filtran resultados; Backlog bulk controls comparten una sola fila de escritorio.
- Parser TypeScript/JSX: `app.js` + 8 Edge Functions sin errores de sintaxis.
