# Jira Interno TROBBU v17.10.0

## Resumen

v17.10.0 integra correo transaccional por SendPulse con rollout QA controlado, plantillas TROBBU profesionales, recordatorio diario, eventos de Helpdesk/Tickets y una nueva pasada de contraste oscuro/counters.

## SendPulse QA

- Proveedor preferente: SendPulse API (`POST /smtp/emails`).
- `SENDPULSE_API_KEY` permanece únicamente como secreto de Supabase.
- QA mode activo: el único destinatario físico permitido es `gustavo.chan@trobbucollection.com`.
- Se conserva el destinatario lógico original en `notification_outbox.intended_recipient_email` para auditoría.
- Se guarda el destino físico en `delivered_to` y el ID de SendPulse en `provider_message_id`.
- Rate limit interno QA: 8 correos/hora, por debajo del límite del plan SMTP Test.
- Los eventos no autorizados durante QA se marcan `suppressed`; no salen por email.
- El backlog histórico previo al rollout se conserva como auditoría pero está suprimido y no se reenvía.
- El cron token se almacena en Supabase Vault; solo su hash vive en `workspace_settings`.

## Plantillas transaccionales

1. Recordatorio diario para actualizar Jira Interno.
2. Nueva asignación/reasignación de Helpdesk.
3. Comentario Helpdesk solicitante → seguimiento.
4. Comentario Helpdesk seguimiento → solicitante.
5. Cierre de Helpdesk/Ticket.

Todas utilizan una plantilla responsive HTML propia con paleta TROBBU, CTA a Jira Interno, fallback de texto plano y banner visible de QA mientras el rollout siga restringido.

## Programación

- Recordatorio diario: 09:00 America/Merida (`0 15 * * *` UTC).
- Procesamiento de `notification_outbox`: cada minuto.
- Durante QA, el recordatorio es uno por workspace/día al buzón QA.

## SendPulse corporativo

Se registró `trobbucollection.com` en SendPulse y se solicitó el remitente `gustavo.chan@trobbucollection.com` con nombre `Jira Interno TROBBU`.

Estado observado durante QA:
- SMTP Test activo.
- DMARC detectado.
- SPF pendiente.
- DKIM pendiente.
- SPF esperado por SendPulse: `v=spf1 include:_spf.google.com include:mxsspf.sendpulse.com ~all`.
- Se solicitó el código de activación del remitente al mismo buzón QA.

Una vez autenticado el dominio y activado el remitente, SendPulse cambiará automáticamente del plan SMTP Test al plan SMTP gratuito correspondiente.

## Counters

Los badges de comentarios/actividad/evidencias de Ticket, Sprint y Helpdesk nunca muestran un número inferior al número de filas que ya están renderizadas. Los conteos exactos del servidor siguen siendo la fuente autoritativa y Realtime/reconciliación permanecen activos.

## Dark mode

Nueva corrección focalizada en:
- Reportes / AI: Sprint y proyección de cierre.
- Staff / Roles: counters de tabs.
- Timeline / Gantt: texto de porcentaje con colores semánticos oscuros por estado.
- Los overrides v17.10 se aplican después de los estilos heredados para evitar regresiones de contraste.

## Producción Supabase

Migración: `jira_v17_10_sendpulse_qa_notifications`.

Edge Function `process-notifications`: v19 ACTIVE.

Los helpers temporales de diagnóstico/configuración de SendPulse quedaron deshabilitados después de QA.
