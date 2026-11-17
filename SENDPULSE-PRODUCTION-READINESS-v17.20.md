# SendPulse · Production Readiness v17.20

## Estado validado · 17/nov/2026

**NO habilitar todavía destinatarios productivos.**

La cuenta SendPulse continúa en **SMTP Test**:

- Sender activo observado: `devtest@sendpulseemail.com`.
- `trobbucollection.com`: DMARC detectado, SPF pendiente y DKIM pendiente.
- Los correos recientes siguen mostrando el prefijo de desarrollo de SendPulse.
- `email_qa_mode` debe permanecer en `true` y el destino físico controlado continúa siendo `gustavo.chan@trobbucollection.com`.

## Identidad preparada

- Nombre / alias lógico: **Notificaciones Helpdesk x Jira**.
- El correo From real seguirá siendo el `workspace_settings.email_sender_address` que quede activado en SendPulse.
- Mientras la cuenta continúe en SMTP Test, SendPulse puede sustituir la identidad de From por su identidad de pruebas; esto no se puede corregir desde Jira.

## Conversaciones por folio

v17.20 usa un asunto canónico estable:

- Helpdesk: `[Jira Interno] HD-XX · Seguimiento Helpdesk`.
- Jira: `[Jira Interno] APP-XX · Seguimiento Jira`.

Asignación, comentarios y cierre de un mismo Helpdesk dejan de modificar el asunto. La acción concreta aparece dentro del cuerpo del correo.

Esto mejora el agrupado por conversación en Gmail/Outlook, pero **no equivale a threading RFC garantizado**. El endpoint transaccional de SendPulse que usa Jira expone `reply_to`, pero no un campo documentado para `In-Reply-To`, `References` o un RFC `Message-ID` reutilizable. Para threading RFC estricto haría falta un canal de envío que permita controlar esos headers.

## Política de eventos conservada

Para evitar ruido y respetar los límites del servicio se mantienen únicamente:

- `daily_jira_reminder`
- `helpdesk_assigned`
- `helpdesk_comment`
- `helpdesk_closed`
- `ticket_closed`

Menciones y cambios intermedios continúan como notificaciones in-app.

## Requisitos antes de PROD

1. Autenticar `trobbucollection.com` en SendPulse.
2. Corregir/verificar SPF y DKIM hasta que SendPulse los marque válidos.
3. Crear/activar el sender corporativo que se usará en `email_sender_address`.
4. Confirmar que `devtest@sendpulseemail.com` ya no sea el sender activo del plan.
5. Hacer un envío controlado a Gmail y Outlook y revisar entregabilidad/headers.
6. Confirmar que el alias visible sea **Notificaciones Helpdesk x Jira**.
7. Solo entonces cambiar `email_qa_mode=false`.

## Guardas de Jira

Aunque alguien desactive QA antes de tiempo, `process-notifications` devuelve `production_sender_not_ready` y envía **0** mensajes si el sender configurado no está activo o sigue siendo el sender de pruebas.

Límites internos conservados:

- QA: 8/h.
- General: 45/h.
- Mensual: 11,000.
- El recordatorio diario cede capacidad primero cuando el presupuesto mensual es bajo.
