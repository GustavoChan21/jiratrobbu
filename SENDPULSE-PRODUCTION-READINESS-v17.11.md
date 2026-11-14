# SendPulse - Production Readiness v17.11

## Estado actual
El procesador de Jira está preparado para producción, pero **no debe salir de QA** mientras SendPulse muestre el plan `SMTP Test` o el remitente `devtest@sendpulseemail.com`.

Remitente productivo esperado:
- Nombre: `Helpdesk TROBBU`
- Email: `helpdesk@trobbucollection.com`

## Por qué no usar helpdesk@sendpulse.com
El remitente debe pertenecer a un dominio que TROBBU controle y autentique. `sendpulse.com` pertenece al proveedor; no puede usarse como identidad corporativa propia.

## Pasos para producción
1. En SendPulse > SMTP > Settings > Domain settings, autenticar `trobbucollection.com`.
2. Publicar exactamente los registros SPF/DKIM que SendPulse genere.
3. Si ya existe SPF, mantener **un solo registro SPF** y fusionar el include de SendPulse.
4. En Sender emails, crear/activar `helpdesk@trobbucollection.com`.
5. Confirmar que `devtest@sendpulseemail.com` desaparezca del plan activo y que el dashboard muestre SMTP Free.
6. Verificar un envío a Gmail/Outlook y revisar `SPF=PASS`, `DKIM=PASS` y, si aplica, `DMARC=PASS` en los headers.
7. Solo entonces cambiar `workspace_settings.email_qa_mode=false`.

## Guardas automáticas
Incluso con `email_qa_mode=false`, `process-notifications` devuelve `production_sender_not_ready` y envía cero si el remitente corporativo exacto no está activo.

## Límites internos
- 45 emails/hora (plan permite hasta 50/h).
- 11,000 emails/mes (plan SMTP Free documentado: 12,000/mes).
- Si faltan <=100 emails del presupuesto mensual, el recordatorio diario se sacrifica primero y se reserva capacidad para eventos transaccionales.

## Destinatarios
- Asignación Helpdesk -> nuevo responsable.
- Comentario del solicitante -> responsable/seguimiento principal.
- Comentario de seguimiento -> solicitante.
- Cierre Helpdesk -> solicitante.
- Cierre Jira -> reporter/Dev/QA realmente vinculados, excluyendo al actor y deduplicando.
- Recordatorio diario -> solo usuarios con tickets/Helpdesk abiertos a su cargo.
- @Menciones -> notificación in-app únicamente.

## Spam / entregabilidad
Ningún proveedor puede garantizar 0% spam. La configuración prevista maximiza entregabilidad mediante dominio propio, SPF, DKIM, alineación de remitente, destinatarios relevantes y baja cadencia.
