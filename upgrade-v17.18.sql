-- Jira Interno TROBBU v17.18.0
-- Knowledge editor stability + Superadmin access/session audit.
-- This migration adds application-level session telemetry and immutable audit events.

begin;

create extension if not exists pgcrypto;

alter table public.workspace_settings
  add column if not exists app_session_max_hours integer not null default 12;

do $$
begin
  if not exists(select 1 from pg_constraint where conname='workspace_settings_app_session_max_hours_check') then
    alter table public.workspace_settings
      add constraint workspace_settings_app_session_max_hours_check
      check (app_session_max_hours between 1 and 24);
  end if;
end $$;

update public.workspace_settings
set app_session_max_hours=12
where app_session_max_hours is null or app_session_max_hours<1 or app_session_max_hours>24;

create table if not exists public.app_user_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  auth_session_id uuid not null,
  started_at timestamptz not null default now(),
  tracking_started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz,
  active_seconds bigint not null default 0 check(active_seconds>=0),
  start_view text,
  last_view text,
  user_agent text,
  locale text,
  theme text,
  end_reason text,
  seeded_from_auth boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,auth_session_id)
);

create index if not exists ix_app_user_sessions_workspace_user_started
  on public.app_user_sessions(workspace_id,user_id,started_at desc);
create index if not exists ix_app_user_sessions_workspace_last_seen
  on public.app_user_sessions(workspace_id,last_seen_at desc);
create index if not exists ix_app_user_sessions_user
  on public.app_user_sessions(user_id,started_at desc);

create table if not exists public.app_audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  auth_session_id uuid,
  source text not null default 'database' check(source in ('database','client','session','system')),
  event_type text not null,
  module text,
  action text not null,
  entity_type text,
  entity_id text,
  entity_label text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ix_app_audit_events_workspace_created
  on public.app_audit_events(workspace_id,created_at desc);
create index if not exists ix_app_audit_events_workspace_actor
  on public.app_audit_events(workspace_id,actor_id,created_at desc);
create index if not exists ix_app_audit_events_actor
  on public.app_audit_events(actor_id,created_at desc);
create index if not exists ix_app_audit_events_workspace_module
  on public.app_audit_events(workspace_id,module,created_at desc);
create index if not exists ix_app_audit_events_entity
  on public.app_audit_events(workspace_id,entity_type,entity_id,created_at desc);

create or replace function private.is_workspace_superadmin(p_workspace uuid,p_user uuid)
returns boolean
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select exists(
    select 1
    from public.workspace_members wm
    left join public.workspace_roles wr on wr.id=wm.role_id and wr.workspace_id=wm.workspace_id
    where wm.workspace_id=p_workspace
      and wm.user_id=p_user
      and wm.active=true
      and (wm.role='superadmin' or wr.code='superadmin')
  );
$$;
revoke all on function private.is_workspace_superadmin(uuid,uuid) from public,anon;
grant execute on function private.is_workspace_superadmin(uuid,uuid) to authenticated;

alter table public.app_user_sessions enable row level security;
alter table public.app_audit_events enable row level security;

revoke all on public.app_user_sessions from anon,authenticated;
revoke all on public.app_audit_events from anon,authenticated;
grant select on public.app_user_sessions to authenticated;
grant select on public.app_audit_events to authenticated;

drop policy if exists app_user_sessions_select on public.app_user_sessions;
create policy app_user_sessions_select on public.app_user_sessions
for select to authenticated
using (private.is_workspace_superadmin(workspace_id,(select auth.uid())));

drop policy if exists app_audit_events_select on public.app_audit_events;
create policy app_audit_events_select on public.app_audit_events
for select to authenticated
using (private.is_workspace_superadmin(workspace_id,(select auth.uid())));

create or replace function public.touch_app_session(
  p_workspace_id uuid,
  p_view text default null,
  p_user_agent text default null,
  p_locale text default null,
  p_theme text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_uid uuid:=(select auth.uid());
  v_session_id uuid;
  v_now timestamptz:=now();
  v_max_hours integer:=12;
  v_row public.app_user_sessions%rowtype;
  v_gap numeric:=0;
  v_add bigint:=0;
  v_expired boolean:=false;
  v_was_ended boolean:=false;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  begin
    v_session_id:=nullif((select auth.jwt()->>'session_id'),'')::uuid;
  exception when others then
    v_session_id:=null;
  end;
  if v_session_id is null then raise exception 'Session id unavailable'; end if;
  if not exists(select 1 from public.workspace_members wm where wm.workspace_id=p_workspace_id and wm.user_id=v_uid and wm.active=true) then
    raise exception 'Workspace access denied';
  end if;
  select coalesce(ws.app_session_max_hours,12) into v_max_hours
  from public.workspace_settings ws where ws.workspace_id=p_workspace_id;
  v_max_hours:=coalesce(v_max_hours,12);

  select * into v_row
  from public.app_user_sessions s
  where s.workspace_id=p_workspace_id and s.auth_session_id=v_session_id
  for update;

  if not found then
    insert into public.app_user_sessions(
      workspace_id,user_id,auth_session_id,started_at,tracking_started_at,last_seen_at,
      start_view,last_view,user_agent,locale,theme,seeded_from_auth
    ) values(
      p_workspace_id,v_uid,v_session_id,v_now,v_now,v_now,
      nullif(p_view,''),nullif(p_view,''),left(nullif(p_user_agent,''),500),nullif(p_locale,''),nullif(p_theme,''),false
    ) returning * into v_row;

    insert into public.app_audit_events(workspace_id,actor_id,auth_session_id,source,event_type,module,action,entity_type,entity_id,entity_label,metadata)
    values(p_workspace_id,v_uid,v_session_id,'session','login','auth','login','session',v_session_id::text,'Inicio de sesión',jsonb_build_object('view',p_view));
  else
    v_was_ended:=v_row.ended_at is not null;
    v_gap:=greatest(0,extract(epoch from (v_now-v_row.last_seen_at)));
    -- Count only short heartbeat gaps as active time. Long gaps are treated as inactivity/offline.
    v_add:=case when v_gap<=180 and v_row.ended_at is null then floor(v_gap)::bigint else 0 end;
    update public.app_user_sessions
    set active_seconds=active_seconds+v_add,
        last_seen_at=v_now,
        last_view=coalesce(nullif(p_view,''),last_view),
        user_agent=coalesce(left(nullif(p_user_agent,''),500),user_agent),
        locale=coalesce(nullif(p_locale,''),locale),
        theme=coalesce(nullif(p_theme,''),theme),
        updated_at=v_now
    where id=v_row.id
    returning * into v_row;
  end if;

  v_expired:=v_now >= (v_row.tracking_started_at + make_interval(hours=>v_max_hours))
             or v_row.ended_at is not null;
  if v_expired and not v_was_ended and v_row.ended_at is null then
    update public.app_user_sessions
    set ended_at=v_now,end_reason='max_session_hours',updated_at=v_now
    where id=v_row.id
    returning * into v_row;
    insert into public.app_audit_events(workspace_id,actor_id,auth_session_id,source,event_type,module,action,entity_type,entity_id,entity_label,metadata)
    values(p_workspace_id,v_uid,v_session_id,'session','session_expired','auth','session_expired','session',v_session_id::text,'Sesión finalizada por límite',jsonb_build_object('max_hours',v_max_hours));
  end if;

  return jsonb_build_object(
    'session_id',v_row.id,
    'auth_session_id',v_session_id,
    'started_at',v_row.started_at,
    'tracking_started_at',v_row.tracking_started_at,
    'last_seen_at',v_row.last_seen_at,
    'active_seconds',v_row.active_seconds,
    'max_hours',v_max_hours,
    'expires_at',v_row.tracking_started_at+make_interval(hours=>v_max_hours),
    'expired',v_expired,
    'ended_at',v_row.ended_at
  );
end;
$$;

create or replace function public.end_app_session(
  p_workspace_id uuid,
  p_reason text default 'logout'
)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_uid uuid:=(select auth.uid());
  v_session_id uuid;
  v_now timestamptz:=now();
  v_row public.app_user_sessions%rowtype;
begin
  if v_uid is null then return; end if;
  begin v_session_id:=nullif((select auth.jwt()->>'session_id'),'')::uuid; exception when others then v_session_id:=null; end;
  if v_session_id is null then return; end if;
  select * into v_row from public.app_user_sessions
  where workspace_id=p_workspace_id and auth_session_id=v_session_id and user_id=v_uid
  for update;
  if found and v_row.ended_at is null then
    update public.app_user_sessions
    set active_seconds=active_seconds+case when extract(epoch from (v_now-last_seen_at)) between 0 and 180 then floor(extract(epoch from (v_now-last_seen_at)))::bigint else 0 end,
        last_seen_at=v_now,ended_at=v_now,end_reason=left(coalesce(nullif(p_reason,''),'logout'),80),updated_at=v_now
    where id=v_row.id;
    insert into public.app_audit_events(workspace_id,actor_id,auth_session_id,source,event_type,module,action,entity_type,entity_id,entity_label,metadata)
    values(p_workspace_id,v_uid,v_session_id,'session','logout','auth','logout','session',v_session_id::text,'Cierre de sesión',jsonb_build_object('reason',coalesce(nullif(p_reason,''),'logout')));
  end if;
end;
$$;

create or replace function public.log_app_event(
  p_workspace_id uuid,
  p_event_type text,
  p_module text default null,
  p_action text default 'view',
  p_entity_type text default null,
  p_entity_id text default null,
  p_entity_label text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_uid uuid:=(select auth.uid());
  v_session_id uuid;
  v_id uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.workspace_members wm where wm.workspace_id=p_workspace_id and wm.user_id=v_uid and wm.active=true) then
    raise exception 'Workspace access denied';
  end if;
  begin v_session_id:=nullif((select auth.jwt()->>'session_id'),'')::uuid; exception when others then v_session_id:=null; end;
  insert into public.app_audit_events(workspace_id,actor_id,auth_session_id,source,event_type,module,action,entity_type,entity_id,entity_label,metadata)
  values(
    p_workspace_id,v_uid,v_session_id,'client',left(coalesce(nullif(p_event_type,''),'ui_action'),80),left(nullif(p_module,''),80),
    left(coalesce(nullif(p_action,''),'view'),80),left(nullif(p_entity_type,''),80),left(nullif(p_entity_id,''),180),left(nullif(p_entity_label,''),240),
    coalesce(p_metadata,'{}'::jsonb)
  ) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.touch_app_session(uuid,text,text,text,text) from public,anon;
revoke all on function public.end_app_session(uuid,text) from public,anon;
revoke all on function public.log_app_event(uuid,text,text,text,text,text,text,jsonb) from public,anon;
grant execute on function public.touch_app_session(uuid,text,text,text,text) to authenticated;
grant execute on function public.end_app_session(uuid,text) to authenticated;
grant execute on function public.log_app_event(uuid,text,text,text,text,text,text,jsonb) to authenticated;

create or replace function private.capture_app_audit()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_row jsonb:=case when TG_OP='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_old jsonb:=case when TG_OP='INSERT' then '{}'::jsonb else to_jsonb(old) end;
  v_new jsonb:=case when TG_OP='DELETE' then '{}'::jsonb else to_jsonb(new) end;
  v_workspace uuid;
  v_actor uuid:=(select auth.uid());
  v_session_id uuid;
  v_changed jsonb:='[]'::jsonb;
  v_module text;
  v_action text:=lower(TG_OP);
  v_entity_id text;
  v_label text;
  v_metadata jsonb:='{}'::jsonb;
begin
  begin v_session_id:=nullif((select auth.jwt()->>'session_id'),'')::uuid; exception when others then v_session_id:=null; end;
  begin v_workspace:=nullif(v_row->>'workspace_id','')::uuid; exception when others then v_workspace:=null; end;

  if v_workspace is null then
    if TG_TABLE_NAME in ('ticket_comments','ticket_activity') then
      select workspace_id into v_workspace from public.tickets where id=nullif(v_row->>'ticket_id','')::uuid;
    elsif TG_TABLE_NAME='sprint_comments' then
      select workspace_id into v_workspace from public.sprints where id=nullif(v_row->>'sprint_id','')::uuid;
    elsif TG_TABLE_NAME in ('helpdesk_comments','helpdesk_activity') then
      select workspace_id into v_workspace from public.helpdesk_tickets where id=nullif(v_row->>'helpdesk_ticket_id','')::uuid;
    end if;
  end if;
  if v_workspace is null then return coalesce(new,old); end if;

  if TG_OP='UPDATE' then
    select coalesce(jsonb_agg(k order by k),'[]'::jsonb) into v_changed
    from (
      select n.key k from jsonb_each(v_new) n
      where (v_old->n.key) is distinct from n.value
        and n.key not in ('updated_at','content_updated_at')
    ) q;
  end if;

  v_module:=case
    when TG_TABLE_NAME like 'helpdesk_%' then 'helpdesk'
    when TG_TABLE_NAME like 'knowledge_%' then 'knowledge'
    when TG_TABLE_NAME like 'vacation_%' then 'vacations'
    when TG_TABLE_NAME in ('sprints','sprint_comments','sprint_attachments') then 'sprints'
    when TG_TABLE_NAME in ('workspace_members','workspace_roles','workspace_member_products') then 'staff'
    when TG_TABLE_NAME='workspace_settings' then 'settings'
    when TG_TABLE_NAME in ('products','ticket_modules','ticket_tags','ticket_tag_links','custom_ticket_fields','custom_ticket_field_products','ticket_custom_field_values') then 'catalogs'
    else 'tickets'
  end;

  if TG_OP='UPDATE' and (v_old->>'status') is distinct from (v_new->>'status') and (v_new ? 'status') then
    v_action:='status_change';
  elsif TG_OP='UPDATE' and (
    (v_old->>'assigned_to') is distinct from (v_new->>'assigned_to')
    or (v_old->>'dev_owner_id') is distinct from (v_new->>'dev_owner_id')
    or (v_old->>'qa_owner_id') is distinct from (v_new->>'qa_owner_id')
  ) then
    v_action:='assignment_change';
  elsif TG_OP='INSERT' and TG_TABLE_NAME like '%comments' then v_action:='comment_added';
  elsif TG_OP='DELETE' and TG_TABLE_NAME like '%comments' then v_action:='comment_deleted';
  elsif TG_OP='INSERT' and TG_TABLE_NAME like '%attachments' then v_action:='attachment_added';
  elsif TG_OP='DELETE' and TG_TABLE_NAME like '%attachments' then v_action:='attachment_deleted';
  elsif TG_OP='INSERT' and TG_TABLE_NAME like '%mentions' then v_action:='mentioned';
  elsif TG_OP='DELETE' and TG_TABLE_NAME like '%mentions' then v_action:='mention_removed';
  elsif TG_OP='INSERT' then v_action:='created';
  elsif TG_OP='DELETE' then v_action:='deleted';
  else v_action:='updated';
  end if;

  v_entity_id:=coalesce(v_row->>'id',v_row->>'ticket_id',v_row->>'helpdesk_ticket_id',v_row->>'sprint_id',v_row->>'article_id',v_row->>'user_id',v_row->>'workspace_id');
  v_label:=coalesce(v_row->>'ticket_key',v_row->>'module_key',v_row->>'name',v_row->>'title',v_row->>'subject',v_row->>'file_name',v_row->>'code',v_row->>'user_id',v_entity_id,TG_TABLE_NAME);
  v_metadata:=jsonb_build_object('table',TG_TABLE_NAME,'operation',TG_OP,'changed_fields',v_changed);
  if v_row ? 'status' then v_metadata:=v_metadata||jsonb_build_object('status',v_row->>'status','previous_status',v_old->>'status'); end if;
  if v_row ? 'assigned_to' then v_metadata:=v_metadata||jsonb_build_object('assigned_to',v_row->>'assigned_to','previous_assigned_to',v_old->>'assigned_to'); end if;
  if v_row ? 'dev_owner_id' then v_metadata:=v_metadata||jsonb_build_object('dev_owner_id',v_row->>'dev_owner_id','previous_dev_owner_id',v_old->>'dev_owner_id'); end if;
  if v_row ? 'qa_owner_id' then v_metadata:=v_metadata||jsonb_build_object('qa_owner_id',v_row->>'qa_owner_id','previous_qa_owner_id',v_old->>'qa_owner_id'); end if;

  insert into public.app_audit_events(workspace_id,actor_id,auth_session_id,source,event_type,module,action,entity_type,entity_id,entity_label,metadata)
  values(v_workspace,v_actor,v_session_id,case when v_actor is null then 'system' else 'database' end,'data_change',v_module,v_action,TG_TABLE_NAME,v_entity_id,left(v_label,240),v_metadata);

  return coalesce(new,old);
end;
$$;
revoke all on function private.capture_app_audit() from public,anon,authenticated;

-- Profiles do not contain workspace_id, so emit one event per active workspace membership.
create or replace function private.capture_profile_audit()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_actor uuid:=(select auth.uid());
  v_session_id uuid;
  v_changed jsonb:='[]'::jsonb;
  v_workspace uuid;
begin
  begin v_session_id:=nullif((select auth.jwt()->>'session_id'),'')::uuid; exception when others then v_session_id:=null; end;
  if TG_OP='UPDATE' then
    select coalesce(jsonb_agg(k order by k),'[]'::jsonb) into v_changed
    from (
      select n.key k from jsonb_each(to_jsonb(new)) n
      where (to_jsonb(old)->n.key) is distinct from n.value
        and n.key not in ('updated_at')
    ) q;
    if v_changed='[]'::jsonb then return new; end if;
  end if;
  for v_workspace in select wm.workspace_id from public.workspace_members wm where wm.user_id=coalesce(new.id,old.id) and wm.active=true loop
    insert into public.app_audit_events(workspace_id,actor_id,auth_session_id,source,event_type,module,action,entity_type,entity_id,entity_label,metadata)
    values(v_workspace,v_actor,v_session_id,case when v_actor is null then 'system' else 'database' end,'data_change','staff',lower(TG_OP),'profiles',coalesce(new.id,old.id)::text,coalesce(new.full_name,new.email,old.full_name,old.email,'Perfil'),jsonb_build_object('changed_fields',v_changed));
  end loop;
  return coalesce(new,old);
end;
$$;
revoke all on function private.capture_profile_audit() from public,anon,authenticated;

create or replace function private.guard_superadmin_session_policy()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_claims jsonb;
  v_service boolean:=false;
begin
  begin
    v_claims:=nullif(current_setting('request.jwt.claims',true),'')::jsonb;
  exception when others then
    v_claims:='{}'::jsonb;
  end;
  v_service:=coalesce(v_claims->>'role',current_setting('request.jwt.claim.role',true),'')='service_role';

  if new.app_session_max_hours is distinct from old.app_session_max_hours
     and not v_service
     and not private.is_workspace_superadmin(old.workspace_id,(select auth.uid())) then
    raise exception 'Solo Superadmin puede cambiar la duración máxima de sesión';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_superadmin_session_policy() from public,anon,authenticated;

drop trigger if exists trg_guard_superadmin_session_policy on public.workspace_settings;
create trigger trg_guard_superadmin_session_policy
before update on public.workspace_settings
for each row execute function private.guard_superadmin_session_policy();

-- Generic audit triggers. Existing business triggers remain untouched.
do $$
declare
  t text;
  tables text[]:=array[
    'tickets','sprints','ticket_comments','ticket_attachments','ticket_links','ticket_tag_links','ticket_custom_field_values',
    'sprint_comments','sprint_attachments','helpdesk_tickets','helpdesk_comments','helpdesk_attachments',
    'knowledge_articles','knowledge_article_versions','knowledge_categories','knowledge_media','knowledge_version_events',
    'vacation_requests','vacation_balances','vacation_types','products','ticket_modules','ticket_tags','custom_ticket_fields',
    'workspace_members','workspace_roles','workspace_member_products','workspace_settings','ticket_mentions','helpdesk_mentions'
  ];
begin
  foreach t in array tables loop
    if to_regclass('public.'||t) is not null then
      execute format('drop trigger if exists %I on public.%I','trg_app_audit_'||t,t);
      execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.capture_app_audit()','trg_app_audit_'||t,t);
    end if;
  end loop;
end $$;

drop trigger if exists trg_app_audit_profiles on public.profiles;
create trigger trg_app_audit_profiles
after update on public.profiles
for each row execute function private.capture_profile_audit();

-- Seed currently active Auth sessions as a baseline. Active duration starts counting from this rollout.
insert into public.app_user_sessions(
  workspace_id,user_id,auth_session_id,started_at,tracking_started_at,last_seen_at,active_seconds,seeded_from_auth,created_at,updated_at
)
select wm.workspace_id,s.user_id,s.id,s.created_at,now(),coalesce(s.updated_at,s.created_at),0,true,now(),now()
from auth.sessions s
join public.workspace_members wm on wm.user_id=s.user_id and wm.active=true
on conflict(workspace_id,auth_session_id) do nothing;

alter table public.app_user_sessions replica identity full;
alter table public.app_audit_events replica identity full;
do $$
begin
  begin alter publication supabase_realtime add table public.app_user_sessions; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.app_audit_events; exception when duplicate_object then null; end;
end $$;

notify pgrst,'reload schema';
commit;
