# SendPulse QA / Corporate Setup — Jira Interno TROBBU

## Estado actual

Jira Interno está integrado con SendPulse por API usando el secreto Supabase `SENDPULSE_API_KEY`.

Durante QA:

- Único destino físico: `gustavo.chan@trobbucollection.com`.
- Otros destinatarios solo se conservan como referencia lógica; no reciben correo.
- Límite interno: 8 correos por hora.
- Los eventos no incluidos en QA se suprimen.
- Los 575 correos históricos anteriores al rollout no serán liberados.

## Dominio corporativo

El dominio `trobbucollection.com` ya fue agregado a SendPulse.

Estado de checks observado al configurarlo:

- DMARC: detectado.
- SPF: pendiente.
- DKIM: pendiente.

SendPulse devolvió como SPF requerido:

`v=spf1 include:_spf.google.com include:mxsspf.sendpulse.com ~all`

> No se debe crear un segundo registro SPF si el dominio ya tiene uno. Debe mantenerse un único SPF válido e integrar el include de SendPulse. El valor anterior ya combina Google Workspace + SendPulse según lo indicado por la propia cuenta.

Para DKIM, abre SendPulse > SMTP > Settings > Domain settings > `trobbucollection.com` y copia exactamente el host/nombre y valor que SendPulse muestre. Agrégalo en el proveedor DNS y pulsa Verify/Check.

## Remitente

Se solicitó:

- From: `gustavo.chan@trobbucollection.com`
- Nombre: `Notificaciones Helpdesk x Jira`

También se solicitó el código de activación al mismo correo. Revisa inbox/spam de `gustavo.chan@trobbucollection.com`.

Cuando el dominio quede autenticado, SendPulse puede activar el sender automáticamente; si aún solicita código, usa el correo de activación recibido.

## Después de autenticar dominio/sender

1. Confirma en SendPulse SMTP Dashboard que ya no aparece SMTP Test.
2. Confirma que el sender corporativo aparece en la lista SMTP.
3. Opcional/recomendado en Supabase Secrets:
   - `SENDPULSE_FROM_EMAIL=gustavo.chan@trobbucollection.com`
   - `SENDPULSE_FROM_NAME=Notificaciones Helpdesk x Jira`
4. Mantén `email_qa_mode=true` hasta validar diseño, entregabilidad y spam.
5. Solo después de aprobar QA se cambia `email_qa_mode=false` para permitir los destinatarios reales.

## Eventos habilitados por email durante QA

- `daily_jira_reminder`
- `helpdesk_assigned`
- `helpdesk_comment`
- `helpdesk_closed`
- `ticket_closed`

El resto de notificaciones puede seguir apareciendo dentro de Jira, pero su email se bloquea durante QA.
