-- Jira Interno TROBBU v17.7.0
-- Live Data / Supabase Realtime hardening.
-- Keeps the active URL/view intact while data is synchronized in place.

begin;

-- Tables that feed visible UI but were not part of the Realtime publication.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'workspace_settings',
    'helpdesk_departments',
    'helpdesk_request_types',
    'helpdesk_activity',
    'helpdesk_assignment_queue',
    'helpdesk_assignment_log',
    'workspaces'
  ] loop
    if to_regclass(format('public.%I',v_table)) is not null
       and not exists (
         select 1
         from pg_publication_tables
         where pubname='supabase_realtime'
           and schemaname='public'
           and tablename=v_table
       ) then
      execute format('alter publication supabase_realtime add table public.%I',v_table);
    end if;
  end loop;
end $$;

-- Filtered Postgres Changes DELETE events only include enough old-row data for
-- workspace/id filtering when the table uses REPLICA IDENTITY FULL. This keeps
-- deletes in sync without waiting for a navigation-triggered refetch.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'tickets','sprints','products','ticket_modules','ticket_tags','ticket_tag_links',
    'ticket_links','ticket_attachments','sprint_attachments','workspace_members',
    'workspace_member_products','workspace_roles','workspace_settings',
    'helpdesk_departments','helpdesk_request_types','helpdesk_tickets',
    'helpdesk_attachments','helpdesk_assignment_queue','helpdesk_assignment_log','notifications','notification_outbox','knowledge_articles',
    'knowledge_media','knowledge_article_versions','knowledge_version_events',
    'knowledge_version_translations','knowledge_categories','vacation_requests',
    'vacation_types','vacation_balances','custom_ticket_fields',
    'custom_ticket_field_products','ticket_custom_field_values','workspaces'
  ] loop
    if to_regclass(format('public.%I',v_table)) is not null then
      execute format('alter table public.%I replica identity full',v_table);
    end if;
  end loop;
end $$;

commit;
