# QA v17.11.0

## Cobertura
- Regresión completa histórica v17.x.
- Menciones Jira/Helpdesk + RLS.
- Realtime de menciones.
- Login sin signup.
- Optimistic Kanban + rollback.
- Counters exactos.
- Dark mode final.
- Vercel no-cache.
- SendPulse quotas/production guard.
- Manual PDF preflight.

## Validación productiva adicional
- Transactional RLS QA: un usuario `helpdesk_requester` sin acceso de producto pudo leer y comentar un ticket únicamente después de ser mencionado.
- El mismo usuario no recibió permiso para editar el ticket.
- `notification_outbox` fue reiniciado a cero.
- `process-notifications` desplegado como v21 ACTIVE.
- `sendpulse-qa-diagnostic` y `auth-signup-qa-diagnostic` fueron retirados y protegidos después de QA.
- Auth settings observados: `disable_signup=false`; UI v17.11 no expone signup.

## Resultado
Ver `qa-v17.11-output.txt` generado por `npm run qa`.
