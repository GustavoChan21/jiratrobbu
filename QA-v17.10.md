# QA v17.10.0

## Suite estática / regresión

Resultado: **404 PASS / 0 FAIL**.

La suite valida historial funcional de Knowledge, Helpdesk, Vacaciones, permisos, Realtime, dark mode, URL state, counters, además del nuevo flujo SendPulse.

## QA productivo SendPulse

Se enviaron cinco casos sintéticos controlados:

1. Recordatorio diario.
2. Asignación Helpdesk.
3. Comentario solicitante → seguimiento.
4. Comentario seguimiento → solicitante.
5. Cierre Helpdesk.

Resultado:
- 5 mensajes aceptados por SendPulse.
- 5 con `provider_message_id` almacenado.
- 5 con `delivered_to = gustavo.chan@trobbucollection.com`.
- 0 entregas físicas a otra dirección.
- El destinatario lógico original se conserva para auditoría.

## QA de triggers con ROLLBACK

- Comentario solicitante → equipo: exactamente 1 salida de email al responsable lógico.
- Comentario equipo → solicitante: exactamente 1 salida de email al solicitante lógico.
- Reasignación Helpdesk: exactamente 1 salida `helpdesk_assigned`.
- Cierre Helpdesk: exactamente 1 salida `helpdesk_closed`.
- Recordatorio diario: dedupe correcto a 1 por workspace/día en QA.

Los ensayos se ejecutaron en transacciones con `ROLLBACK`; no alteraron tickets reales.

## Outbox

- 575 registros históricos previos al rollout: `suppressed`.
- 5 pruebas QA: `sent`.
- 0 registros `pending`, `failed` o `processing` al cierre de QA.

## Cron

- `jira-daily-email-reminder`: activo, `0 15 * * *` UTC = 09:00 America/Merida.
- `jira-process-email-outbox`: activo, cada minuto.
- Llamadas posteriores al rollout observadas con HTTP 200.

## Supabase

- Health Advisor: 0 lints.
- `pg_net` reinstalado en schema `extensions` conforme a la recomendación actual de Supabase.
- Security Advisor conserva únicamente el warning preexistente de Leaked Password Protection deshabilitado; no pertenece al flujo SendPulse.

## SendPulse corporate setup

- Dominio `trobbucollection.com`: creado en SendPulse.
- Sender `gustavo.chan@trobbucollection.com`: solicitud aceptada.
- Código de activación de sender solicitado al mismo buzón QA.
- SPF/DKIM siguen pendientes hasta completar DNS.
