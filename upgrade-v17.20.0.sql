-- Jira Interno TROBBU v17.20.0
-- Email identity + conversation-safe subject strategy.
-- IMPORTANT: this migration does NOT disable QA mode. Production rollout remains gated
-- by SendPulse domain/sender readiness and process-notifications production checks.
begin;

alter table public.workspace_settings
  alter column email_sender_name set default 'Notificaciones Helpdesk x Jira';

update public.workspace_settings
set email_sender_name='Notificaciones Helpdesk x Jira'
where email_sender_name is distinct from 'Notificaciones Helpdesk x Jira';

notify pgrst,'reload schema';
commit;
