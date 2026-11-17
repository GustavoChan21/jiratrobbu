-- Jira Interno TROBBU v17.21.0
-- UI recovery / Staff CRUD edge rollout / temporary SendPulse PROD enablement.
-- The Edge Functions process-notifications and manage-member must also be deployed from this package.
begin;

alter table public.workspace_settings
  alter column email_sender_name set default 'Notificaciones Jira x Helpdesk';

update public.workspace_settings
set email_notifications=true,
    email_qa_mode=false,
    email_sender_name='Notificaciones Jira x Helpdesk',
    email_sender_address='devtest@sendpulseemail.com',
    email_hourly_limit=least(coalesce(email_hourly_limit,10),10),
    email_rollout_at=now();

notify pgrst,'reload schema';
commit;
