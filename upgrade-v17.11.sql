-- Jira Interno TROBBU v17.11.0
-- Mentions/read-only access, production email guardrails, free-plan quotas, queue reset,
-- role-aware reminders and realtime support.

begin;

create extension if not exists pgcrypto;

alter table public.workspace_settings
  add column if not exists email_hourly_limit integer not null default 45,
  add column if not exists email_monthly_limit integer not null default 11000,
  add column if not exists email_sender_address text not null default 'helpdesk@trobbucollection.com',
  add column if not exists email_sender_name text not null default 'Helpdesk TROBBU';

alter table public.workspace_settings drop constraint if exists workspace_settings_email_hourly_limit_check;
alter table public.workspace_settings add constraint workspace_settings_email_hourly_limit_check
  check (email_hourly_limit between 1 and 50);
alter table public.workspace_settings drop constraint if exists workspace_settings_email_monthly_limit_check;
alter table public.workspace_settings add constraint workspace_settings_email_monthly_limit_check
  check (email_monthly_limit between 1 and 12000);

update public.workspace_settings
set email_hourly_limit=least(greatest(coalesce(email_hourly_limit,45),1),45),
    email_monthly_limit=least(greatest(coalesce(email_monthly_limit,11000),1),11000),
    email_sender_address=coalesce(nullif(btrim(email_sender_address),''),'helpdesk@trobbucollection.com'),
    email_sender_name=coalesce(nullif(btrim(email_sender_name),''),'Helpdesk TROBBU');

-- User requested a clean start for outbound email accounting.
delete from public.notification_outbox;

create table if not exists public.ticket_mentions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  mentioned_by uuid references auth.users(id) on delete set null,
  comment_id uuid references public.ticket_comments(id) on delete set null,
  created_at timestamptz not null default now(),
  last_mentioned_at timestamptz not null default now(),
  read_at timestamptz,
  unique(ticket_id,user_id)
);

create table if not exists public.helpdesk_mentions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  helpdesk_ticket_id uuid not null references public.helpdesk_tickets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  mentioned_by uuid references auth.users(id) on delete set null,
  comment_id uuid references public.helpdesk_comments(id) on delete set null,
  created_at timestamptz not null default now(),
  last_mentioned_at timestamptz not null default now(),
  read_at timestamptz,
  unique(helpdesk_ticket_id,user_id)
);

create index if not exists ix_ticket_mentions_user_workspace on public.ticket_mentions(user_id,workspace_id,last_mentioned_at desc);
create index if not exists ix_helpdesk_mentions_user_workspace on public.helpdesk_mentions(user_id,workspace_id,last_mentioned_at desc);

alter table public.ticket_mentions enable row level security;
alter table public.helpdesk_mentions enable row level security;

drop policy if exists ticket_mentions_select on public.ticket_mentions;
create policy ticket_mentions_select on public.ticket_mentions
for select to authenticated
using (
  user_id=(select auth.uid())
  or mentioned_by=(select auth.uid())
  or private.has_workspace_permission(workspace_id,'manage_staff')
);

drop policy if exists ticket_mentions_update_self on public.ticket_mentions;
create policy ticket_mentions_update_self on public.ticket_mentions
for update to authenticated
using (user_id=(select auth.uid()))
with check (user_id=(select auth.uid()));

drop policy if exists helpdesk_mentions_select on public.helpdesk_mentions;
create policy helpdesk_mentions_select on public.helpdesk_mentions
for select to authenticated
using (
  user_id=(select auth.uid())
  or mentioned_by=(select auth.uid())
  or private.has_workspace_permission(workspace_id,'manage_helpdesk')
);

drop policy if exists helpdesk_mentions_update_self on public.helpdesk_mentions;
create policy helpdesk_mentions_update_self on public.helpdesk_mentions
for update to authenticated
using (user_id=(select auth.uid()))
with check (user_id=(select auth.uid()));

create or replace function private.is_ticket_mentioned(p_ticket uuid)
returns boolean
language sql stable security definer
set search_path=public,pg_temp
as $$
  select exists(
    select 1
    from public.ticket_mentions tm
    join public.workspace_members wm
      on wm.workspace_id=tm.workspace_id and wm.user_id=tm.user_id and wm.active=true
    where tm.ticket_id=p_ticket and tm.user_id=(select auth.uid())
  );
$$;

create or replace function private.is_helpdesk_mentioned(p_ticket uuid)
returns boolean
language sql stable security definer
set search_path=public,pg_temp
as $$
  select exists(
    select 1
    from public.helpdesk_mentions hm
    join public.workspace_members wm
      on wm.workspace_id=hm.workspace_id and wm.user_id=hm.user_id and wm.active=true
    where hm.helpdesk_ticket_id=p_ticket and hm.user_id=(select auth.uid())
  );
$$;

revoke all on function private.is_ticket_mentioned(uuid) from public,anon;
revoke all on function private.is_helpdesk_mentioned(uuid) from public,anon;
grant execute on function private.is_ticket_mentioned(uuid) to authenticated;
grant execute on function private.is_helpdesk_mentioned(uuid) to authenticated;

create or replace function private.mention_entity_users_impl(
  p_entity_type text,
  p_entity_id uuid,
  p_user_ids uuid[],
  p_comment_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_actor uuid:=(select auth.uid());
  v_workspace uuid;
  v_key text;
  v_title text;
  v_user uuid;
  v_added integer:=0;
  v_allowed boolean:=false;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if p_entity_type not in ('ticket','helpdesk') then raise exception 'Unsupported mention entity'; end if;
  if coalesce(array_length(p_user_ids,1),0)=0 then return jsonb_build_object('added',0); end if;

  if p_entity_type='ticket' then
    select t.workspace_id,t.ticket_key,t.title,
      ((private.has_workspace_permission(t.workspace_id,'view_tickets') and private.has_product_access(t.workspace_id,t.product_id)) or private.is_ticket_mentioned(t.id))
    into v_workspace,v_key,v_title,v_allowed
    from public.tickets t where t.id=p_entity_id;
  else
    select h.workspace_id,h.ticket_key,h.subject,
      (private.has_workspace_permission(h.workspace_id,'manage_helpdesk')
       or h.requester_user_id=v_actor or h.assigned_to=v_actor or private.is_helpdesk_mentioned(h.id))
    into v_workspace,v_key,v_title,v_allowed
    from public.helpdesk_tickets h where h.id=p_entity_id;
  end if;

  if v_workspace is null then raise exception 'Entity not found'; end if;
  if not private.is_workspace_member(v_workspace) or not v_allowed then raise exception 'Insufficient access to mention users here'; end if;

  for v_user in select distinct unnest(p_user_ids) loop
    if v_user is null or v_user=v_actor then continue; end if;
    if not exists(select 1 from public.workspace_members wm where wm.workspace_id=v_workspace and wm.user_id=v_user and wm.active=true) then continue; end if;

    if p_entity_type='ticket' then
      insert into public.ticket_mentions(workspace_id,ticket_id,user_id,mentioned_by,comment_id,last_mentioned_at,read_at)
      values(v_workspace,p_entity_id,v_user,v_actor,p_comment_id,now(),null)
      on conflict(ticket_id,user_id) do update
        set mentioned_by=excluded.mentioned_by,comment_id=excluded.comment_id,last_mentioned_at=now(),read_at=null;
      perform private.emit_notification(
        v_workspace,v_user,'ticket_mention','mentions','Te mencionaron en '||coalesce(v_key,'ticket'),
        coalesce(v_title,'Se solicitó tu atención en un ticket.'),
        jsonb_build_object('entity_type','ticket','entity_id',p_entity_id,'ticket_key',v_key,'ticket_title',v_title,'action','mention','comment_id',p_comment_id),
        v_actor,p_entity_id,null,'mention:ticket:'||p_entity_id||':'||v_user||':'||coalesce(p_comment_id::text,extract(epoch from now())::bigint::text),false);
    else
      insert into public.helpdesk_mentions(workspace_id,helpdesk_ticket_id,user_id,mentioned_by,comment_id,last_mentioned_at,read_at)
      values(v_workspace,p_entity_id,v_user,v_actor,p_comment_id,now(),null)
      on conflict(helpdesk_ticket_id,user_id) do update
        set mentioned_by=excluded.mentioned_by,comment_id=excluded.comment_id,last_mentioned_at=now(),read_at=null;
      perform private.emit_notification(
        v_workspace,v_user,'helpdesk_mention','mentions','Te mencionaron en '||coalesce(v_key,'Helpdesk'),
        coalesce(v_title,'Se solicitó tu atención en una solicitud.'),
        jsonb_build_object('entity_type','helpdesk','entity_id',p_entity_id,'helpdesk_key',v_key,'subject',v_title,'action','mention','comment_id',p_comment_id),
        v_actor,null,p_entity_id,'mention:helpdesk:'||p_entity_id||':'||v_user||':'||coalesce(p_comment_id::text,extract(epoch from now())::bigint::text),false);
    end if;
    v_added:=v_added+1;
  end loop;
  return jsonb_build_object('added',v_added,'entity_type',p_entity_type,'entity_id',p_entity_id);
end $$;

revoke all on function private.mention_entity_users_impl(text,uuid,uuid[],uuid) from public,anon;
grant execute on function private.mention_entity_users_impl(text,uuid,uuid[],uuid) to authenticated;

create or replace function public.mention_entity_users(
  p_entity_type text,
  p_entity_id uuid,
  p_user_ids uuid[],
  p_comment_id uuid default null
)
returns jsonb
language sql
security invoker
set search_path=public,private,pg_temp
as $$
  select private.mention_entity_users_impl(p_entity_type,p_entity_id,p_user_ids,p_comment_id);
$$;

revoke all on function public.mention_entity_users(text,uuid,uuid[],uuid) from public,anon;
grant execute on function public.mention_entity_users(text,uuid,uuid[],uuid) to authenticated;

-- Mentioned users receive read/comment access to the specific item without gaining product/workspace management rights.
drop policy if exists tickets_select on public.tickets;
create policy tickets_select on public.tickets for select to authenticated
using (
  (private.has_workspace_permission(workspace_id,'view_tickets') and private.has_product_access(workspace_id,product_id))
  or private.is_ticket_mentioned(id)
);

drop policy if exists ticket_comments_select on public.ticket_comments;
create policy ticket_comments_select on public.ticket_comments for select to authenticated
using (exists(select 1 from public.tickets t where t.id=ticket_comments.ticket_id and (
  (private.has_workspace_permission(t.workspace_id,'view_tickets') and private.has_product_access(t.workspace_id,t.product_id))
  or private.is_ticket_mentioned(t.id)
)));

drop policy if exists ticket_comments_insert on public.ticket_comments;
create policy ticket_comments_insert on public.ticket_comments for insert to authenticated
with check (author_id=(select auth.uid()) and exists(select 1 from public.tickets t where t.id=ticket_comments.ticket_id and (
  (private.has_workspace_permission(t.workspace_id,'edit_tickets') and private.has_product_access(t.workspace_id,t.product_id))
  or private.is_ticket_mentioned(t.id)
)));

drop policy if exists ticket_comments_update on public.ticket_comments;
create policy ticket_comments_update on public.ticket_comments for update to authenticated
using (author_id=(select auth.uid()) and exists(select 1 from public.tickets t where t.id=ticket_comments.ticket_id and (
  (private.has_workspace_permission(t.workspace_id,'edit_tickets') and private.has_product_access(t.workspace_id,t.product_id))
  or private.is_ticket_mentioned(t.id)
)))
with check (author_id=(select auth.uid()) and exists(select 1 from public.tickets t where t.id=ticket_comments.ticket_id and (
  (private.has_workspace_permission(t.workspace_id,'edit_tickets') and private.has_product_access(t.workspace_id,t.product_id))
  or private.is_ticket_mentioned(t.id)
)));

drop policy if exists ticket_comments_delete on public.ticket_comments;
create policy ticket_comments_delete on public.ticket_comments for delete to authenticated
using (author_id=(select auth.uid()) and exists(select 1 from public.tickets t where t.id=ticket_comments.ticket_id and (
  (private.has_workspace_permission(t.workspace_id,'edit_tickets') and private.has_product_access(t.workspace_id,t.product_id))
  or private.is_ticket_mentioned(t.id)
)) or exists(select 1 from public.tickets t where t.id=ticket_comments.ticket_id and private.has_workspace_permission(t.workspace_id,'delete_tickets') and private.has_product_access(t.workspace_id,t.product_id)));

drop policy if exists activity_select on public.ticket_activity;
create policy activity_select on public.ticket_activity for select to authenticated
using (exists(select 1 from public.tickets t where t.id=ticket_activity.ticket_id and (
  (private.has_workspace_permission(t.workspace_id,'view_tickets') and private.has_product_access(t.workspace_id,t.product_id))
  or private.is_ticket_mentioned(t.id)
)));

drop policy if exists ticket_attachments_select on public.ticket_attachments;
create policy ticket_attachments_select on public.ticket_attachments for select to authenticated
using (exists(select 1 from public.tickets t where t.id=ticket_attachments.ticket_id and t.workspace_id=ticket_attachments.workspace_id and (
  (private.has_workspace_permission(t.workspace_id,'view_tickets') and private.has_product_access(t.workspace_id,t.product_id))
  or private.is_ticket_mentioned(t.id)
)));

drop policy if exists ticket_attachments_insert on public.ticket_attachments;
create policy ticket_attachments_insert on public.ticket_attachments for insert to authenticated
with check (uploaded_by=(select auth.uid()) and exists(select 1 from public.tickets t where t.id=ticket_attachments.ticket_id and t.workspace_id=ticket_attachments.workspace_id and (
  (private.has_workspace_permission(t.workspace_id,'edit_tickets') and private.has_product_access(t.workspace_id,t.product_id))
  or private.is_ticket_mentioned(t.id)
)));

drop policy if exists ticket_attachments_delete on public.ticket_attachments;
create policy ticket_attachments_delete on public.ticket_attachments for delete to authenticated
using (exists(select 1 from public.tickets t where t.id=ticket_attachments.ticket_id and t.workspace_id=ticket_attachments.workspace_id and (
  ((ticket_attachments.uploaded_by=(select auth.uid())) and ((private.has_workspace_permission(t.workspace_id,'edit_tickets') and private.has_product_access(t.workspace_id,t.product_id)) or private.is_ticket_mentioned(t.id)))
  or (private.has_workspace_permission(t.workspace_id,'delete_tickets') and private.has_product_access(t.workspace_id,t.product_id))
)));

drop policy if exists helpdesk_tickets_select on public.helpdesk_tickets;
create policy helpdesk_tickets_select on public.helpdesk_tickets for select to authenticated
using (
  private.has_workspace_permission(workspace_id,'manage_helpdesk')
  or ((requester_user_id=(select auth.uid()) or assigned_to=(select auth.uid())) and private.is_workspace_member(workspace_id))
  or private.is_helpdesk_mentioned(id)
);

drop policy if exists helpdesk_comments_select on public.helpdesk_comments;
create policy helpdesk_comments_select on public.helpdesk_comments for select to authenticated
using (exists(select 1 from public.helpdesk_tickets h where h.id=helpdesk_comments.helpdesk_ticket_id and private.is_workspace_member(h.workspace_id) and (
  private.has_workspace_permission(h.workspace_id,'manage_helpdesk') or h.requester_user_id=(select auth.uid()) or h.assigned_to=(select auth.uid()) or private.is_helpdesk_mentioned(h.id)
)));

drop policy if exists helpdesk_comments_insert on public.helpdesk_comments;
create policy helpdesk_comments_insert on public.helpdesk_comments for insert to authenticated
with check (author_id=(select auth.uid()) and exists(select 1 from public.helpdesk_tickets h where h.id=helpdesk_comments.helpdesk_ticket_id and private.is_workspace_member(h.workspace_id) and (
  private.has_workspace_permission(h.workspace_id,'manage_helpdesk') or h.requester_user_id=(select auth.uid()) or h.assigned_to=(select auth.uid()) or private.is_helpdesk_mentioned(h.id)
)));

drop policy if exists helpdesk_comments_update on public.helpdesk_comments;
create policy helpdesk_comments_update on public.helpdesk_comments for update to authenticated
using (author_id=(select auth.uid()) and exists(select 1 from public.helpdesk_tickets h where h.id=helpdesk_comments.helpdesk_ticket_id and private.is_workspace_member(h.workspace_id) and (
  private.has_workspace_permission(h.workspace_id,'manage_helpdesk') or h.requester_user_id=(select auth.uid()) or h.assigned_to=(select auth.uid()) or private.is_helpdesk_mentioned(h.id)
)))
with check (author_id=(select auth.uid()) and exists(select 1 from public.helpdesk_tickets h where h.id=helpdesk_comments.helpdesk_ticket_id and private.is_workspace_member(h.workspace_id) and (
  private.has_workspace_permission(h.workspace_id,'manage_helpdesk') or h.requester_user_id=(select auth.uid()) or h.assigned_to=(select auth.uid()) or private.is_helpdesk_mentioned(h.id)
)));

drop policy if exists helpdesk_comments_delete on public.helpdesk_comments;
create policy helpdesk_comments_delete on public.helpdesk_comments for delete to authenticated
using (author_id=(select auth.uid()) and exists(select 1 from public.helpdesk_tickets h where h.id=helpdesk_comments.helpdesk_ticket_id and private.is_workspace_member(h.workspace_id) and (
  private.has_workspace_permission(h.workspace_id,'manage_helpdesk') or h.requester_user_id=(select auth.uid()) or h.assigned_to=(select auth.uid()) or private.is_helpdesk_mentioned(h.id)
)));

drop policy if exists helpdesk_activity_select on public.helpdesk_activity;
create policy helpdesk_activity_select on public.helpdesk_activity for select to authenticated
using (exists(select 1 from public.helpdesk_tickets h where h.id=helpdesk_activity.helpdesk_ticket_id and private.is_workspace_member(h.workspace_id) and (
  private.has_workspace_permission(h.workspace_id,'manage_helpdesk') or h.requester_user_id=(select auth.uid()) or h.assigned_to=(select auth.uid()) or private.is_helpdesk_mentioned(h.id)
)));

drop policy if exists helpdesk_attachments_select on public.helpdesk_attachments;
create policy helpdesk_attachments_select on public.helpdesk_attachments for select to authenticated
using (exists(select 1 from public.helpdesk_tickets h where h.id=helpdesk_attachments.helpdesk_ticket_id and h.workspace_id=helpdesk_attachments.workspace_id and private.is_workspace_member(h.workspace_id) and (
  private.has_workspace_permission(h.workspace_id,'manage_helpdesk') or h.requester_user_id=(select auth.uid()) or h.assigned_to=(select auth.uid()) or private.is_helpdesk_mentioned(h.id)
)));

drop policy if exists helpdesk_attachments_insert on public.helpdesk_attachments;
create policy helpdesk_attachments_insert on public.helpdesk_attachments for insert to authenticated
with check (uploaded_by=(select auth.uid()) and exists(select 1 from public.helpdesk_tickets h where h.id=helpdesk_attachments.helpdesk_ticket_id and h.workspace_id=helpdesk_attachments.workspace_id and private.is_workspace_member(h.workspace_id) and (
  private.has_workspace_permission(h.workspace_id,'manage_helpdesk') or h.requester_user_id=(select auth.uid()) or h.assigned_to=(select auth.uid()) or private.is_helpdesk_mentioned(h.id)
)));

create or replace function private.can_view_evidence_object(p_name text)
returns boolean
language plpgsql stable security definer
set search_path=public,storage,private,pg_temp
as $$
declare v_workspace uuid;v_parent uuid;v_scope text;
begin
  v_workspace:=split_part(p_name,'/',1)::uuid;v_scope:=split_part(p_name,'/',2);v_parent:=split_part(p_name,'/',3)::uuid;
  if v_scope='tickets' then return exists(select 1 from public.tickets t where t.id=v_parent and t.workspace_id=v_workspace and ((private.has_workspace_permission(v_workspace,'view_tickets') and private.has_product_access(v_workspace,t.product_id)) or private.is_ticket_mentioned(t.id)));
  elsif v_scope='sprints' then return exists(select 1 from public.sprints s where s.id=v_parent and s.workspace_id=v_workspace and private.has_workspace_permission(v_workspace,'view_dashboard'));
  elsif v_scope='helpdesk' then return exists(select 1 from public.helpdesk_tickets h where h.id=v_parent and h.workspace_id=v_workspace and private.is_workspace_member(v_workspace) and (private.has_workspace_permission(v_workspace,'manage_helpdesk') or h.requester_user_id=(select auth.uid()) or h.assigned_to=(select auth.uid()) or private.is_helpdesk_mentioned(h.id)));
  elsif v_scope='knowledge' then return exists(select 1 from public.knowledge_articles a where a.id=v_parent and a.workspace_id=v_workspace and ((a.status='published' and private.has_workspace_permission(v_workspace,'view_knowledge')) or private.has_workspace_permission(v_workspace,'edit_knowledge') or private.has_workspace_permission(v_workspace,'delete_knowledge') or (private.has_workspace_permission(v_workspace,'create_knowledge') and a.created_by=(select auth.uid()) and a.active_version_id is null)));
  end if;return false;
exception when invalid_text_representation then return false;end $$;

create or replace function private.can_upload_evidence_object(p_name text)
returns boolean
language plpgsql stable security definer
set search_path=public,storage,private,pg_temp
as $$
declare v_workspace uuid;v_parent uuid;v_scope text;
begin
  v_workspace:=split_part(p_name,'/',1)::uuid;v_scope:=split_part(p_name,'/',2);v_parent:=split_part(p_name,'/',3)::uuid;
  if v_scope='tickets' then return exists(select 1 from public.tickets t where t.id=v_parent and t.workspace_id=v_workspace and ((private.has_workspace_permission(v_workspace,'edit_tickets') and private.has_product_access(v_workspace,t.product_id)) or private.is_ticket_mentioned(t.id)));
  elsif v_scope='sprints' then return exists(select 1 from public.sprints s where s.id=v_parent and s.workspace_id=v_workspace and private.has_workspace_permission(v_workspace,'edit_tickets'));
  elsif v_scope='helpdesk' then return exists(select 1 from public.helpdesk_tickets h where h.id=v_parent and h.workspace_id=v_workspace and private.is_workspace_member(v_workspace) and (private.has_workspace_permission(v_workspace,'manage_helpdesk') or h.requester_user_id=(select auth.uid()) or h.assigned_to=(select auth.uid()) or private.is_helpdesk_mentioned(h.id)));
  elsif v_scope='knowledge' then return exists(select 1 from public.knowledge_articles a where a.id=v_parent and a.workspace_id=v_workspace and (private.has_workspace_permission(v_workspace,'edit_knowledge') or (private.has_workspace_permission(v_workspace,'create_knowledge') and a.created_by=(select auth.uid()) and a.active_version_id is null)));
  end if;return false;
exception when invalid_text_representation then return false;end $$;

-- Only high-value transactional events are allowed into the email outbox.
create or replace function private.emit_notification(p_workspace uuid,p_user uuid,p_type text,p_category text,p_title text,p_body text,p_metadata jsonb default '{}'::jsonb,p_actor uuid default null,p_ticket uuid default null,p_helpdesk uuid default null,p_dedupe text default null,p_email boolean default true)
returns void
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare
  v_in_app boolean:=true;
  v_email boolean:=true;
  v_email_type_allowed boolean:=p_type in ('daily_jira_reminder','helpdesk_assigned','helpdesk_comment','helpdesk_closed','ticket_closed');
  v_meta jsonb:=coalesce(p_metadata,'{}'::jsonb)||jsonb_build_object('category',coalesce(nullif(p_category,''),'system'),'event_type',p_type);
begin
  if p_workspace is null or p_user is null then return; end if;
  if not exists(select 1 from public.workspace_members wm where wm.workspace_id=p_workspace and wm.user_id=p_user and wm.active=true) then return; end if;
  select coalesce(ws.in_app_notifications,true),coalesce(ws.email_notifications,true) into v_in_app,v_email from public.workspace_settings ws where ws.workspace_id=p_workspace;
  if not found then v_in_app:=true;v_email:=true;end if;

  if v_in_app and not exists(select 1 from public.notifications n where n.user_id=p_user and p_dedupe is not null and n.dedupe_key=p_dedupe) then
    insert into public.notifications(workspace_id,user_id,ticket_id,helpdesk_ticket_id,type,category,title,body,metadata,actor_id,dedupe_key)
    values(p_workspace,p_user,p_ticket,p_helpdesk,p_type,coalesce(nullif(p_category,''),'system'),coalesce(p_title,p_type),p_body,v_meta,p_actor,p_dedupe);
  end if;

  if p_email and v_email and v_email_type_allowed and not exists(
    select 1 from public.notification_outbox o where o.recipient_user_id=p_user and p_dedupe is not null and o.dedupe_key=p_dedupe
  ) then
    insert into public.notification_outbox(workspace_id,ticket_id,recipient_user_id,event_type,payload,category,dedupe_key)
    values(p_workspace,p_ticket,p_user,p_type,jsonb_build_object('title',p_title,'body',p_body,'metadata',v_meta,'helpdesk_ticket_id',p_helpdesk),coalesce(nullif(p_category,''),'system'),p_dedupe);
  end if;
end $$;

-- Daily email only goes to people who actually have open work to update.
create or replace function private.queue_daily_jira_reminders(p_workspace uuid default null)
returns integer
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare
  ws record;v_user uuid;v_date date;v_key text;v_open bigint;v_backlog bigint;v_helpdesk bigint;v_sprints bigint;v_inserted integer:=0;
begin
  for ws in select * from public.workspace_settings s where coalesce(s.email_notifications,true)=true and coalesce(s.email_daily_reminder_enabled,true)=true and (p_workspace is null or s.workspace_id=p_workspace)
  loop
    v_date:=timezone(coalesce(ws.timezone,'America/Merida'),now())::date;
    if coalesce(ws.email_qa_mode,true) then
      v_key:='daily-jira-reminder:qa:'||ws.workspace_id||':'||v_date;
      if not exists(select 1 from public.notification_outbox o where o.workspace_id=ws.workspace_id and o.dedupe_key=v_key) then
        select count(*) into v_open from public.tickets t where t.workspace_id=ws.workspace_id and t.status<>'closed';
        select count(*) into v_backlog from public.tickets t where t.workspace_id=ws.workspace_id and t.sprint_id is null and t.status<>'closed';
        select count(*) into v_helpdesk from public.helpdesk_tickets h where h.workspace_id=ws.workspace_id and h.status<>'closed';
        select count(*) into v_sprints from public.sprints s where s.workspace_id=ws.workspace_id and s.status in ('active','planned');
        insert into public.notification_outbox(workspace_id,recipient_email,event_type,payload,category,dedupe_key,status)
        values(ws.workspace_id,ws.email_qa_recipient,'daily_jira_reminder',jsonb_build_object('title','Recordatorio diario de Jira Interno','body','Revisa y actualiza el avance de tus tickets.','metadata',jsonb_build_object('entity_type','system','action','daily_reminder','date',v_date,'open_tickets',v_open,'backlog_tickets',v_backlog,'open_helpdesk',v_helpdesk,'active_sprints',v_sprints)),'system',v_key,'pending');
        v_inserted:=v_inserted+1;
      end if;
    else
      for v_user in
        select wm.user_id
        from public.workspace_members wm
        left join public.workspace_roles wr on wr.id=wm.role_id
        where wm.workspace_id=ws.workspace_id and wm.active=true
          and coalesce(wr.code,'')<>'helpdesk_requester'
          and (
            exists(select 1 from public.tickets t where t.workspace_id=ws.workspace_id and t.status<>'closed' and (t.reporter_id=wm.user_id or t.dev_owner_id=wm.user_id or t.qa_owner_id=wm.user_id))
            or exists(select 1 from public.helpdesk_tickets h where h.workspace_id=ws.workspace_id and h.status<>'closed' and h.assigned_to=wm.user_id)
          )
      loop
        v_key:='daily-jira-reminder:'||ws.workspace_id||':'||v_user||':'||v_date;
        if not exists(select 1 from public.notification_outbox o where o.recipient_user_id=v_user and o.dedupe_key=v_key) then
          select count(*) into v_open from public.tickets t where t.workspace_id=ws.workspace_id and t.status<>'closed' and (t.reporter_id=v_user or t.dev_owner_id=v_user or t.qa_owner_id=v_user);
          select count(*) into v_backlog from public.tickets t where t.workspace_id=ws.workspace_id and t.sprint_id is null and t.status<>'closed' and (t.reporter_id=v_user or t.dev_owner_id=v_user or t.qa_owner_id=v_user);
          select count(*) into v_helpdesk from public.helpdesk_tickets h where h.workspace_id=ws.workspace_id and h.status<>'closed' and h.assigned_to=v_user;
          select count(distinct t.sprint_id) into v_sprints from public.tickets t where t.workspace_id=ws.workspace_id and t.status<>'closed' and t.sprint_id is not null and (t.reporter_id=v_user or t.dev_owner_id=v_user or t.qa_owner_id=v_user);
          insert into public.notification_outbox(workspace_id,recipient_user_id,event_type,payload,category,dedupe_key,status)
          values(ws.workspace_id,v_user,'daily_jira_reminder',jsonb_build_object('title','Recordatorio diario de Jira Interno','body','Revisa y actualiza el avance de tus tickets.','metadata',jsonb_build_object('entity_type','system','action','daily_reminder','date',v_date,'open_tickets',v_open,'backlog_tickets',v_backlog,'open_helpdesk',v_helpdesk,'active_sprints',v_sprints)),'system',v_key,'pending');
          v_inserted:=v_inserted+1;
        end if;
      end loop;
    end if;
  end loop;
  return v_inserted;
end $$;

alter table public.ticket_mentions replica identity full;
alter table public.helpdesk_mentions replica identity full;

do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='ticket_mentions') then
    alter publication supabase_realtime add table public.ticket_mentions;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='helpdesk_mentions') then
    alter publication supabase_realtime add table public.helpdesk_mentions;
  end if;
end $$;

grant select,update on public.ticket_mentions to authenticated;
grant select,update on public.helpdesk_mentions to authenticated;

notify pgrst,'reload schema';
commit;
