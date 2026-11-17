# QA / Code Review · Jira Interno TROBBU v17.20.0

Fecha: 17/nov/2026

## Alcance

- identidad From / alias;
- protección del destinatario QA;
- asuntos por folio;
- compatibilidad de agrupado por conversación;
- HTML QA vs PROD;
- límites y guardas de SendPulse;
- regresión de v17.19.0.

## Hallazgos de producción

La consulta directa a la cuenta SendPulse configurada en Supabase confirmó:

- único sender activo: `devtest@sendpulseemail.com`;
- dominio `trobbucollection.com`: SPF pendiente, DKIM pendiente, DMARC detectado;
- correos recientes entregados con SMTP 250;
- asuntos recientes siguen prefijados por SendPulse para desarrollo;
- por tanto el entorno **NO está listo para abrir destinatarios productivos**.

El endpoint temporal usado para inspección fue retirado nuevamente al terminar la prueba.

## Decisiones de seguridad

1. `email_qa_mode` permanece `true`.
2. Destino físico controlado: `gustavo.chan@trobbucollection.com`.
3. Alias lógico preparado: **Notificaciones Helpdesk x Jira**.
4. No se amplía el conjunto de eventos de email.
5. No se simula un hilo RFC que el proveedor no permite controlar mediante su endpoint actual.

## Threading

Se implementó asunto canónico estable por folio. Esto evita que “asignado”, “nuevo comentario” y “cerrado” generen asuntos distintos para el mismo `HD-XX`.

La API de SendPulse admite `reply_to`, pero el flujo usado no dispone de campos documentados para `In-Reply-To`, `References` ni un RFC `Message-ID` reutilizable. Por ello el agrupado por cliente de correo es **best effort**, no una garantía RFC.

## Regresión

Antes de versionar v17.20 se ejecutó la suite completa de v17.19.0:

**55 PASS · 0 FAIL**.

La suite focal v17.20 valida adicionalmente identidad, QA gate, canonical subject, sintaxis TS y guardas PROD.

## Resultado automatizado

Suite focal v17.20.0: **39 PASS · 0 FAIL**.

## Verificación sobre Supabase real

- Migración aplicada: `jira_v17_20_email_identity_threading`.
- `process-notifications`: **v23 ACTIVE**.
- Alias en `workspace_settings`: **Notificaciones Helpdesk x Jira**.
- `email_qa_mode`: **true**.
- Destinatario QA físico: `gustavo.chan@trobbucollection.com`.
- Health Advisor posterior a la migración: **0 lints**.
- Cola comprobada antes del despliegue: 24 `sent`, 0 `pending`, 0 `failed`.
