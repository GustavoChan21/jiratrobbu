# RELEASE v17.20.0 · Jira Interno TROBBU

## Objetivo

Endurecer la capa transaccional de correo sin abrir producción antes de que SendPulse esté realmente listo.

## Identidad de correo

- Alias lógico actualizado a **Notificaciones Helpdesk x Jira**.
- El destinatario físico permanece en QA/dev mediante `email_qa_recipient`.
- La dirección From no se cambia silenciosamente; debe ser una dirección corporativa activa en SendPulse.

## Conversación por folio

- Helpdesk usa un asunto canónico estable: `HD-XX · Seguimiento Helpdesk`.
- Jira usa un asunto canónico estable: `APP-XX · Seguimiento Jira`.
- El movimiento concreto —asignación, comentario, respuesta o cierre— se muestra dentro del correo.
- El título del ticket puede cambiar sin romper el asunto canónico del folio.
- Se reporta explícitamente `threading_rfc_guaranteed=false`; no se simulan headers que SendPulse API no permite controlar.

## Correcciones del procesador

- El banner **ENTREGA QA CONTROLADA** solo se renderiza cuando `email_qa_mode=true`.
- PROD ya no heredará visualmente el banner QA.
- El nombre del destinatario deja de estar fijado a `QA Jira Interno`.
- Se usa nombre real del perfil cuando existe.
- `Reply-To` queda disponible cuando `workspace_settings.support_email` sea un correo válido.
- `status_only` ahora informa alias, modo de threading, eventos permitidos y readiness de producción.
- Se conserva el bloqueo automático si el sender productivo no está activo.

## Política de volumen

No se amplió el conjunto de eventos de email. Se conserva el flujo de alto valor de v17.11/v17.19:

- recordatorio diario;
- Helpdesk asignado;
- comentario Helpdesk;
- cierre Helpdesk;
- cierre Jira.

El resto continúa in-app para evitar ruido y proteger cuotas.

## Estado de producción

La auditoría real de SendPulse del 17/nov/2026 confirmó que la cuenta **continúa en SMTP Test**, con `devtest@sendpulseemail.com` como único sender activo y SPF/DKIM pendientes para `trobbucollection.com`.

Por ello **v17.20.0 no cambia `email_qa_mode` a false**.

Consulta `SENDPULSE-PRODUCTION-READINESS-v17.20.md`.
