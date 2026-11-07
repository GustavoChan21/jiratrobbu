-- Jira Interno Trobbu
-- Esquema raíz de respaldo para Supabase/PostgreSQL.
-- El proyecto remoto ya fue provisionado; este archivo permite versionar la BD en GitHub.

create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('admin','pm','dev','qa','viewer');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.sprint_status as enum ('planned','active','completed');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.ticket_type as enum ('task','bug','story','improvement');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.ticket_priority as enum ('lowest','low','medium','high','highest','blocker');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.ticket_status as enum ('backlog','todo','in_progress','dev_done','qa_review','qa_rejected','qa_passed','closed');
exception when duplicate_object then null; end $$;

create schema if not exists private;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  job_title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'viewer',
  active boolean not null default true,
  joined_at timestamptz not null default now(),
  primary key (workspace_id,user_id)
);

create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role public.app_role not null default 'viewer',
  invited_by uuid references auth.users(id),
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique(workspace_id,email)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  key text not null,
  description text,
  icon text,
  board_order integer not null default 0,
  ticket_seq bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,key)
);

create table if not exists public.sprints (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  goal text,
  start_date date,
  end_date date,
  status public.sprint_status not null default 'planned',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  sprint_id uuid references public.sprints(id) on delete set null,
  ticket_number bigint,
  ticket_key text unique,
  title text not null,
  description text,
  type public.ticket_type not null default 'task',
  priority public.ticket_priority not null default 'medium',
  status public.ticket_status not null default 'backlog',
  reporter_id uuid references auth.users(id),
  dev_owner_id uuid references auth.users(id),
  qa_owner_id uuid references auth.users(id),
  story_points numeric(6,2),
  due_date date,
  labels text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  dev_completed_at timestamptz,
  qa_completed_at timestamptz,
  closed_at timestamptz
);

create table if not exists public.ticket_comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ticket_activity (
  id bigint generated always as identity primary key,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  actor_id uuid references auth.users(id),
  action text not null,
  from_value text,
  to_value text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_outbox (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  ticket_id uuid references public.tickets(id) on delete cascade,
  recipient_user_id uuid references auth.users(id) on delete cascade,
  recipient_email text,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists idx_tickets_workspace_status on public.tickets(workspace_id,status);
create index if not exists idx_tickets_product_status on public.tickets(product_id,status);
create index if not exists idx_tickets_sprint_status on public.tickets(sprint_id,status);
create index if not exists idx_tickets_dev_owner on public.tickets(dev_owner_id);
create index if not exists idx_tickets_qa_owner on public.tickets(qa_owner_id);
create index if not exists idx_tickets_reporter on public.tickets(reporter_id);
create index if not exists idx_workspace_members_user on public.workspace_members(user_id);
create index if not exists idx_workspace_invites_invited_by on public.workspace_invites(invited_by);
create index if not exists idx_sprints_workspace on public.sprints(workspace_id);
create index if not exists idx_sprints_created_by on public.sprints(created_by);
create index if not exists idx_comments_ticket on public.ticket_comments(ticket_id);
create index if not exists idx_comments_author on public.ticket_comments(author_id);
create index if not exists idx_activity_ticket on public.ticket_activity(ticket_id);
create index if not exists idx_activity_actor on public.ticket_activity(actor_id);
create index if not exists idx_outbox_workspace_status on public.notification_outbox(workspace_id,status);
create index if not exists idx_outbox_ticket on public.notification_outbox(ticket_id);
create index if not exists idx_outbox_recipient on public.notification_outbox(recipient_user_id);
create index if not exists idx_workspaces_created_by on public.workspaces(created_by);

create or replace function private.is_workspace_member(p_workspace uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = p_workspace
      and wm.user_id = (select auth.uid())
      and wm.active = true
  );
$$;

create or replace function private.has_workspace_role(p_workspace uuid, p_roles public.app_role[])
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = p_workspace
      and wm.user_id = (select auth.uid())
      and wm.active = true
      and wm.role = any(p_roles)
  );
$$;

revoke all on function private.is_workspace_member(uuid) from public;
revoke all on function private.has_workspace_role(uuid, public.app_role[]) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_workspace_member(uuid) to authenticated;
grant execute on function private.has_workspace_role(uuid, public.app_role[]) to authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end $$;

create or replace function private.assign_ticket_key()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_seq bigint;
  v_key text;
begin
  if new.ticket_key is not null then return new; end if;
  update public.products
     set ticket_seq = ticket_seq + 1
   where id = new.product_id and workspace_id = new.workspace_id
   returning ticket_seq, key into v_seq, v_key;
  if v_seq is null then raise exception 'Invalid product/workspace combination'; end if;
  new.ticket_number := v_seq;
  new.ticket_key := v_key || '-' || v_seq::text;
  return new;
end $$;

create or replace function private.track_ticket_change()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if old.status is distinct from new.status then
    if new.status = 'dev_done' and new.dev_completed_at is null then new.dev_completed_at := now(); end if;
    if new.status = 'qa_passed' and new.qa_completed_at is null then new.qa_completed_at := now(); end if;
    if new.status = 'closed' and new.closed_at is null then new.closed_at := now(); end if;

    insert into public.ticket_activity(ticket_id,actor_id,action,from_value,to_value)
    values(new.id,(select auth.uid()),'status_changed',old.status::text,new.status::text);

    if new.status = 'qa_rejected' and new.dev_owner_id is not null then
      insert into public.notification_outbox(workspace_id,ticket_id,recipient_user_id,event_type,payload)
      values(new.workspace_id,new.id,new.dev_owner_id,'qa_rejected',
        jsonb_build_object('ticket_key',new.ticket_key,'title',new.title,'status',new.status));
    end if;
  end if;

  if old.dev_owner_id is distinct from new.dev_owner_id and new.dev_owner_id is not null then
    insert into public.notification_outbox(workspace_id,ticket_id,recipient_user_id,event_type,payload)
    values(new.workspace_id,new.id,new.dev_owner_id,'assigned_dev',
      jsonb_build_object('ticket_key',new.ticket_key,'title',new.title));
  end if;

  if old.qa_owner_id is distinct from new.qa_owner_id and new.qa_owner_id is not null then
    insert into public.notification_outbox(workspace_id,ticket_id,recipient_user_id,event_type,payload)
    values(new.workspace_id,new.id,new.qa_owner_id,'assigned_qa',
      jsonb_build_object('ticket_key',new.ticket_key,'title',new.title));
  end if;

  return new;
end $$;

create or replace function private.log_ticket_created()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.ticket_activity(ticket_id,actor_id,action,to_value)
  values(new.id,(select auth.uid()),'created',new.status::text);
  return new;
end $$;

create or replace function private.notify_ticket_created()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.notification_outbox(workspace_id,ticket_id,recipient_user_id,event_type,payload)
  select new.workspace_id,new.id,wm.user_id,'ticket_created',
    jsonb_build_object('ticket_key',new.ticket_key,'title',new.title,'product_id',new.product_id)
  from public.workspace_members wm
  where wm.workspace_id = new.workspace_id
    and wm.active = true
    and wm.role in ('admin','pm')
    and wm.user_id is distinct from new.reporter_id;

  if new.dev_owner_id is not null then
    insert into public.notification_outbox(workspace_id,ticket_id,recipient_user_id,event_type,payload)
    values(new.workspace_id,new.id,new.dev_owner_id,'assigned_dev',jsonb_build_object('ticket_key',new.ticket_key,'title',new.title));
  end if;

  if new.qa_owner_id is not null then
    insert into public.notification_outbox(workspace_id,ticket_id,recipient_user_id,event_type,payload)
    values(new.workspace_id,new.id,new.qa_owner_id,'assigned_qa',jsonb_build_object('ticket_key',new.ticket_key,'title',new.title));
  end if;
  return new;
end $$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles(id,full_name,avatar_url)
  values(new.id,coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name'),new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end $$;

create or replace function private.bootstrap_workspace()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.created_by is not null then
    insert into public.workspace_members(workspace_id,user_id,role,active)
    values(new.id,new.created_by,'admin',true)
    on conflict (workspace_id,user_id) do update set role='admin',active=true;
  end if;

  insert into public.products(workspace_id,name,key,description,board_order)
  values
    (new.id,'Web Administrativa','ADM','Administración interna y operación',1),
    (new.id,'Web Socios','SOC','Portal web para socios/inversionistas',2),
    (new.id,'App Socios','APP','Aplicación móvil para socios/inversionistas',3)
  on conflict (workspace_id,key) do nothing;
  return new;
end $$;

-- Triggers
create or replace trigger trg_profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create or replace trigger trg_workspaces_updated before update on public.workspaces for each row execute function public.set_updated_at();
create or replace trigger trg_products_updated before update on public.products for each row execute function public.set_updated_at();
create or replace trigger trg_sprints_updated before update on public.sprints for each row execute function public.set_updated_at();
create or replace trigger trg_comments_updated before update on public.ticket_comments for each row execute function public.set_updated_at();
create or replace trigger trg_ticket_key before insert on public.tickets for each row execute function private.assign_ticket_key();
create or replace trigger trg_ticket_updated before update on public.tickets for each row execute function public.set_updated_at();
create or replace trigger trg_ticket_change before update on public.tickets for each row execute function private.track_ticket_change();
create or replace trigger trg_ticket_activity_created after insert on public.tickets for each row execute function private.log_ticket_created();
create or replace trigger trg_ticket_notify_created after insert on public.tickets for each row execute function private.notify_ticket_created();
create or replace trigger trg_bootstrap_workspace after insert on public.workspaces for each row execute function private.bootstrap_workspace();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();

create or replace view public.sprint_dashboard_stats
with (security_invoker = true)
as
select
  s.id as sprint_id,
  s.workspace_id,
  s.name as sprint_name,
  s.status as sprint_status,
  p.id as product_id,
  p.name as product_name,
  count(t.id) as tickets_created,
  count(t.id) filter (where t.status = 'in_progress') as tickets_in_progress,
  count(t.id) filter (where t.dev_completed_at is not null) as dev_finished,
  count(t.id) filter (where t.qa_completed_at is not null) as qa_finished,
  count(t.id) filter (where t.status = 'qa_rejected') as qa_rejected,
  count(t.id) filter (where t.status = 'closed') as tickets_closed,
  coalesce(sum(t.story_points),0) as story_points_total,
  coalesce(sum(t.story_points) filter (where t.status = 'closed'),0) as story_points_closed
from public.sprints s
left join public.tickets t on t.sprint_id = s.id
left join public.products p on p.id = t.product_id
group by s.id,s.workspace_id,s.name,s.status,p.id,p.name;

-- RLS
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;
alter table public.products enable row level security;
alter table public.sprints enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_comments enable row level security;
alter table public.ticket_activity enable row level security;
alter table public.notification_outbox enable row level security;

create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_update_self on public.profiles for update to authenticated using ((select auth.uid())=id) with check ((select auth.uid())=id);

create policy workspaces_select on public.workspaces for select to authenticated using (private.is_workspace_member(id));
create policy workspaces_insert on public.workspaces for insert to authenticated with check ((select auth.uid())=created_by);
create policy workspaces_update on public.workspaces for update to authenticated using (private.has_workspace_role(id,array['admin','pm']::public.app_role[])) with check (private.has_workspace_role(id,array['admin','pm']::public.app_role[]));

create policy members_select on public.workspace_members for select to authenticated using (private.is_workspace_member(workspace_id));
create policy members_insert on public.workspace_members for insert to authenticated with check (private.has_workspace_role(workspace_id,array['admin','pm']::public.app_role[]));
create policy members_update on public.workspace_members for update to authenticated using (private.has_workspace_role(workspace_id,array['admin','pm']::public.app_role[])) with check (private.has_workspace_role(workspace_id,array['admin','pm']::public.app_role[]));
create policy members_delete on public.workspace_members for delete to authenticated using (private.has_workspace_role(workspace_id,array['admin','pm']::public.app_role[]));

create policy invites_manage on public.workspace_invites for all to authenticated using (private.has_workspace_role(workspace_id,array['admin','pm']::public.app_role[])) with check (private.has_workspace_role(workspace_id,array['admin','pm']::public.app_role[]));

create policy products_select on public.products for select to authenticated using (private.is_workspace_member(workspace_id));
create policy products_insert on public.products for insert to authenticated with check (private.has_workspace_role(workspace_id,array['admin','pm']::public.app_role[]));
create policy products_update on public.products for update to authenticated using (private.has_workspace_role(workspace_id,array['admin','pm']::public.app_role[])) with check (private.has_workspace_role(workspace_id,array['admin','pm']::public.app_role[]));
create policy products_delete on public.products for delete to authenticated using (private.has_workspace_role(workspace_id,array['admin','pm']::public.app_role[]));

create policy sprints_select on public.sprints for select to authenticated using (private.is_workspace_member(workspace_id));
create policy sprints_insert on public.sprints for insert to authenticated with check (private.has_workspace_role(workspace_id,array['admin','pm']::public.app_role[]));
create policy sprints_update on public.sprints for update to authenticated using (private.has_workspace_role(workspace_id,array['admin','pm']::public.app_role[])) with check (private.has_workspace_role(workspace_id,array['admin','pm']::public.app_role[]));
create policy sprints_delete on public.sprints for delete to authenticated using (private.has_workspace_role(workspace_id,array['admin','pm']::public.app_role[]));

create policy tickets_select on public.tickets for select to authenticated using (private.is_workspace_member(workspace_id));
create policy tickets_insert on public.tickets for insert to authenticated with check (private.is_workspace_member(workspace_id));
create policy tickets_update on public.tickets for update to authenticated using (private.is_workspace_member(workspace_id)) with check (private.is_workspace_member(workspace_id));
create policy tickets_delete on public.tickets for delete to authenticated using (private.has_workspace_role(workspace_id,array['admin','pm']::public.app_role[]));

create policy comments_access on public.ticket_comments for all to authenticated
using (exists(select 1 from public.tickets t where t.id=ticket_id and private.is_workspace_member(t.workspace_id)))
with check (exists(select 1 from public.tickets t where t.id=ticket_id and private.is_workspace_member(t.workspace_id)));

create policy activity_select on public.ticket_activity for select to authenticated
using (exists(select 1 from public.tickets t where t.id=ticket_id and private.is_workspace_member(t.workspace_id)));

create policy outbox_admin_select on public.notification_outbox for select to authenticated
using (recipient_user_id=(select auth.uid()) or private.has_workspace_role(workspace_id,array['admin','pm']::public.app_role[]));

-- API grants
grant usage on schema public to authenticated;
grant select,insert,update,delete on public.profiles to authenticated;
grant select,insert,update on public.workspaces to authenticated;
grant select,insert,update,delete on public.workspace_members to authenticated;
grant select,insert,update,delete on public.workspace_invites to authenticated;
grant select,insert,update,delete on public.products to authenticated;
grant select,insert,update,delete on public.sprints to authenticated;
grant select,insert,update,delete on public.tickets to authenticated;
grant select,insert,update,delete on public.ticket_comments to authenticated;
grant select on public.ticket_activity to authenticated;
grant select on public.notification_outbox to authenticated;
grant select on public.sprint_dashboard_stats to authenticated;
grant usage,select on all sequences in schema public to authenticated;

revoke all on function public.set_updated_at() from public,anon;
revoke all on function private.assign_ticket_key() from public,anon,authenticated;
revoke all on function private.track_ticket_change() from public,anon,authenticated;
revoke all on function private.log_ticket_created() from public,anon,authenticated;
revoke all on function private.notify_ticket_created() from public,anon,authenticated;
revoke all on function private.handle_new_user() from public,anon,authenticated;
revoke all on function private.bootstrap_workspace() from public,anon,authenticated;
-- Jira Interno TROBBU v4 upgrade
-- Apply AFTER database.sql on a fresh installation.

-- 1) Workspace creation / RLS
drop policy if exists workspaces_select on public.workspaces;
create policy workspaces_select on public.workspaces
for select to authenticated
using (private.is_workspace_member(id) or created_by=(select auth.uid()));

drop policy if exists workspaces_delete on public.workspaces;
create policy workspaces_delete on public.workspaces
for delete to authenticated
using (private.has_workspace_role(id,array['admin']::public.app_role[]) or created_by=(select auth.uid()));

create or replace function public.create_workspace(p_name text,p_slug text)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_id uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if nullif(trim(p_name),'') is null or nullif(trim(p_slug),'') is null then raise exception 'Workspace name and slug are required'; end if;
  insert into public.workspaces(name,slug,created_by) values(trim(p_name),trim(p_slug),v_uid) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.create_workspace(text,text) from public,anon;
grant execute on function public.create_workspace(text,text) to authenticated;

-- 2) Workspace settings
create table if not exists public.workspace_settings(
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  timezone text not null default 'America/Merida',
  default_sprint_days integer not null default 14 check(default_sprint_days between 1 and 90),
  email_notifications boolean not null default true,
  in_app_notifications boolean not null default true,
  helpdesk_enabled boolean not null default true,
  support_email text,
  sla_first_response_hours integer not null default 4 check(sla_first_response_hours between 1 and 720),
  sla_resolution_hours integer not null default 24 check(sla_resolution_hours between 1 and 2160),
  helpdesk_seq bigint not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.workspace_settings enable row level security;
drop policy if exists workspace_settings_select on public.workspace_settings;
create policy workspace_settings_select on public.workspace_settings for select to authenticated using(private.is_workspace_member(workspace_id));
drop policy if exists workspace_settings_update on public.workspace_settings;
create policy workspace_settings_update on public.workspace_settings for update to authenticated
using(private.has_workspace_role(workspace_id,array['admin','pm']::public.app_role[]))
with check(private.has_workspace_role(workspace_id,array['admin','pm']::public.app_role[]));
grant select,update on public.workspace_settings to authenticated;
drop trigger if exists trg_workspace_settings_updated on public.workspace_settings;
create trigger trg_workspace_settings_updated before update on public.workspace_settings for each row execute function public.set_updated_at();

-- 3) Helpdesk
create table if not exists public.helpdesk_departments(
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  color text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(workspace_id,name)
);

create table if not exists public.helpdesk_tickets(
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  department_id uuid references public.helpdesk_departments(id) on delete set null,
  ticket_number bigint,
  ticket_key text unique,
  subject text not null,
  description text,
  requester_name text,
  requester_email text,
  requester_user_id uuid references auth.users(id) on delete set null,
  category text not null default 'general',
  priority public.ticket_priority not null default 'medium',
  status text not null default 'new' check(status in('new','triage','in_progress','waiting_requester','resolved','closed')),
  assigned_to uuid references auth.users(id) on delete set null,
  source text not null default 'portal' check(source in('portal','email','phone','whatsapp','internal')),
  due_at timestamptz,
  first_response_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_helpdesk_workspace_status on public.helpdesk_tickets(workspace_id,status);
create index if not exists idx_helpdesk_assigned_to on public.helpdesk_tickets(assigned_to);

create table if not exists public.helpdesk_comments(
  id uuid primary key default gen_random_uuid(),
  helpdesk_ticket_id uuid not null references public.helpdesk_tickets(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.helpdesk_activity(
  id bigint generated always as identity primary key,
  helpdesk_ticket_id uuid not null references public.helpdesk_tickets(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  from_value text,
  to_value text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.helpdesk_departments enable row level security;
alter table public.helpdesk_tickets enable row level security;
alter table public.helpdesk_comments enable row level security;
alter table public.helpdesk_activity enable row level security;

drop policy if exists helpdesk_departments_select on public.helpdesk_departments;
create policy helpdesk_departments_select on public.helpdesk_departments for select to authenticated using(private.is_workspace_member(workspace_id));
drop policy if exists helpdesk_departments_manage on public.helpdesk_departments;
create policy helpdesk_departments_manage on public.helpdesk_departments for all to authenticated
using(private.has_workspace_role(workspace_id,array['admin','pm']::public.app_role[]))
with check(private.has_workspace_role(workspace_id,array['admin','pm']::public.app_role[]));

drop policy if exists helpdesk_tickets_select on public.helpdesk_tickets;
create policy helpdesk_tickets_select on public.helpdesk_tickets for select to authenticated using(private.is_workspace_member(workspace_id));
drop policy if exists helpdesk_tickets_insert on public.helpdesk_tickets;
create policy helpdesk_tickets_insert on public.helpdesk_tickets for insert to authenticated
with check(private.is_workspace_member(workspace_id) and(requester_user_id is null or requester_user_id=(select auth.uid())));
drop policy if exists helpdesk_tickets_update on public.helpdesk_tickets;
create policy helpdesk_tickets_update on public.helpdesk_tickets for update to authenticated
using(private.has_workspace_role(workspace_id,array['admin','pm','dev','qa']::public.app_role[]) or requester_user_id=(select auth.uid()))
with check(private.has_workspace_role(workspace_id,array['admin','pm','dev','qa']::public.app_role[]) or requester_user_id=(select auth.uid()));
drop policy if exists helpdesk_tickets_delete on public.helpdesk_tickets;
create policy helpdesk_tickets_delete on public.helpdesk_tickets for delete to authenticated using(private.has_workspace_role(workspace_id,array['admin','pm']::public.app_role[]));

drop policy if exists helpdesk_comments_select on public.helpdesk_comments;
create policy helpdesk_comments_select on public.helpdesk_comments for select to authenticated using(exists(select 1 from public.helpdesk_tickets h where h.id=helpdesk_ticket_id and private.is_workspace_member(h.workspace_id)));
drop policy if exists helpdesk_comments_insert on public.helpdesk_comments;
create policy helpdesk_comments_insert on public.helpdesk_comments for insert to authenticated with check(author_id=(select auth.uid()) and exists(select 1 from public.helpdesk_tickets h where h.id=helpdesk_ticket_id and private.is_workspace_member(h.workspace_id)));
drop policy if exists helpdesk_comments_update on public.helpdesk_comments;
create policy helpdesk_comments_update on public.helpdesk_comments for update to authenticated using(author_id=(select auth.uid())) with check(author_id=(select auth.uid()));
drop policy if exists helpdesk_comments_delete on public.helpdesk_comments;
create policy helpdesk_comments_delete on public.helpdesk_comments for delete to authenticated using(author_id=(select auth.uid()));
drop policy if exists helpdesk_activity_select on public.helpdesk_activity;
create policy helpdesk_activity_select on public.helpdesk_activity for select to authenticated using(exists(select 1 from public.helpdesk_tickets h where h.id=helpdesk_ticket_id and private.is_workspace_member(h.workspace_id)));

grant select,insert,update,delete on public.helpdesk_departments to authenticated;
grant select,insert,update,delete on public.helpdesk_tickets to authenticated;
grant select,insert,update,delete on public.helpdesk_comments to authenticated;
grant select on public.helpdesk_activity to authenticated;

-- 4) In-app notifications
create table if not exists public.notifications(
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  ticket_id uuid references public.tickets(id) on delete cascade,
  helpdesk_ticket_id uuid references public.helpdesk_tickets(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user_read on public.notifications(user_id,read_at,created_at desc);
alter table public.notifications enable row level security;
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select to authenticated using(user_id=(select auth.uid()) and private.is_workspace_member(workspace_id));
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications for delete to authenticated using(user_id=(select auth.uid()));
grant select,update,delete on public.notifications to authenticated;
grant usage,select on all sequences in schema public to authenticated;

-- 5) Helpdesk triggers
create or replace function private.assign_helpdesk_key()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_seq bigint;
begin
  insert into public.workspace_settings(workspace_id) values(new.workspace_id) on conflict(workspace_id) do nothing;
  update public.workspace_settings set helpdesk_seq=helpdesk_seq+1 where workspace_id=new.workspace_id returning helpdesk_seq into v_seq;
  new.ticket_number:=v_seq; new.ticket_key:='HD-'||v_seq::text; return new;
end $$;
revoke all on function private.assign_helpdesk_key() from public,anon,authenticated;
drop trigger if exists trg_helpdesk_key on public.helpdesk_tickets;
create trigger trg_helpdesk_key before insert on public.helpdesk_tickets for each row execute function private.assign_helpdesk_key();

create or replace function private.helpdesk_created()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  insert into public.helpdesk_activity(helpdesk_ticket_id,actor_id,action,to_value) values(new.id,auth.uid(),'created',new.status);
  if new.requester_user_id is not null then
    insert into public.notifications(workspace_id,user_id,helpdesk_ticket_id,type,title,body)
    values(new.workspace_id,new.requester_user_id,new.id,'helpdesk_created','Solicitud creada '||new.ticket_key,new.subject);
  end if;
  insert into public.notifications(workspace_id,user_id,helpdesk_ticket_id,type,title,body)
  select new.workspace_id,wm.user_id,new.id,'helpdesk_new','Nueva solicitud '||new.ticket_key,new.subject
  from public.workspace_members wm
  where wm.workspace_id=new.workspace_id and wm.active=true and wm.role in('admin','pm','dev','qa') and wm.user_id is distinct from new.requester_user_id;
  return new;
end $$;
revoke all on function private.helpdesk_created() from public,anon,authenticated;
drop trigger if exists trg_helpdesk_created on public.helpdesk_tickets;
create trigger trg_helpdesk_created after insert on public.helpdesk_tickets for each row execute function private.helpdesk_created();

create or replace function private.track_helpdesk_change()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if old.status is distinct from new.status then
    if new.status='in_progress' and new.first_response_at is null then new.first_response_at=now(); end if;
    if new.status='resolved' and new.resolved_at is null then new.resolved_at=now(); end if;
    if new.status='closed' and new.closed_at is null then new.closed_at=now(); end if;
    insert into public.helpdesk_activity(helpdesk_ticket_id,actor_id,action,from_value,to_value) values(new.id,auth.uid(),'status_changed',old.status,new.status);
    if new.requester_user_id is not null and new.requester_user_id is distinct from auth.uid() then
      insert into public.notifications(workspace_id,user_id,helpdesk_ticket_id,type,title,body) values(new.workspace_id,new.requester_user_id,new.id,'helpdesk_status',new.ticket_key||' actualizado','El estado cambió a '||new.status||'.');
    end if;
  end if;
  if old.assigned_to is distinct from new.assigned_to and new.assigned_to is not null then
    insert into public.helpdesk_activity(helpdesk_ticket_id,actor_id,action,from_value,to_value) values(new.id,auth.uid(),'assigned',old.assigned_to::text,new.assigned_to::text);
    if new.assigned_to is distinct from auth.uid() then insert into public.notifications(workspace_id,user_id,helpdesk_ticket_id,type,title,body) values(new.workspace_id,new.assigned_to,new.id,'helpdesk_assigned',new.ticket_key||' asignado',new.subject); end if;
  end if;
  return new;
end $$;
revoke all on function private.track_helpdesk_change() from public,anon,authenticated;
drop trigger if exists trg_helpdesk_updated on public.helpdesk_tickets;
create trigger trg_helpdesk_updated before update on public.helpdesk_tickets for each row execute function public.set_updated_at();
drop trigger if exists trg_helpdesk_change on public.helpdesk_tickets;
create trigger trg_helpdesk_change before update on public.helpdesk_tickets for each row execute function private.track_helpdesk_change();

-- 6) Bootstrap defaults for new/existing workspaces
create or replace function private.bootstrap_workspace()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.created_by is not null then insert into public.workspace_members(workspace_id,user_id,role,active) values(new.id,new.created_by,'admin',true) on conflict(workspace_id,user_id) do update set role='admin',active=true; end if;
  insert into public.products(workspace_id,name,key,description,board_order) values
    (new.id,'Web Administrativa','ADM','Administración interna y operación',1),
    (new.id,'Web Socios','SOC','Portal web para socios/inversionistas',2),
    (new.id,'App Socios','APP','Aplicación móvil para socios/inversionistas',3)
  on conflict(workspace_id,key) do nothing;
  insert into public.workspace_settings(workspace_id) values(new.id) on conflict(workspace_id) do nothing;
  insert into public.helpdesk_departments(workspace_id,name,color) values
    (new.id,'Reservaciones','#0D47A1'),(new.id,'Operaciones','#4D5A51'),(new.id,'Finanzas','#CA6832'),
    (new.id,'Comercial','#249F58'),(new.id,'Dirección','#21343E'),(new.id,'Otros','#D4DCE0')
  on conflict(workspace_id,name) do nothing;
  return new;
end $$;

insert into public.workspace_settings(workspace_id) select id from public.workspaces on conflict(workspace_id) do nothing;
insert into public.helpdesk_departments(workspace_id,name,color)
select w.id,d.name,d.color from public.workspaces w cross join(values
 ('Reservaciones','#0D47A1'),('Operaciones','#4D5A51'),('Finanzas','#CA6832'),('Comercial','#249F58'),('Dirección','#21343E'),('Otros','#D4DCE0')
) d(name,color) on conflict(workspace_id,name) do nothing;

-- 7) Ticket comment policies (replace broad FOR ALL policy)
drop policy if exists comments_access on public.ticket_comments;
drop policy if exists ticket_comments_select on public.ticket_comments;
create policy ticket_comments_select on public.ticket_comments for select to authenticated using(exists(select 1 from public.tickets t where t.id=ticket_id and private.is_workspace_member(t.workspace_id)));
drop policy if exists ticket_comments_insert on public.ticket_comments;
create policy ticket_comments_insert on public.ticket_comments for insert to authenticated with check(author_id=(select auth.uid()) and exists(select 1 from public.tickets t where t.id=ticket_id and private.is_workspace_member(t.workspace_id)));
drop policy if exists ticket_comments_update on public.ticket_comments;
create policy ticket_comments_update on public.ticket_comments for update to authenticated using(author_id=(select auth.uid()) or exists(select 1 from public.tickets t where t.id=ticket_id and private.has_workspace_role(t.workspace_id,array['admin','pm']::public.app_role[]))) with check(author_id=(select auth.uid()) or exists(select 1 from public.tickets t where t.id=ticket_id and private.has_workspace_role(t.workspace_id,array['admin','pm']::public.app_role[])));
drop policy if exists ticket_comments_delete on public.ticket_comments;
create policy ticket_comments_delete on public.ticket_comments for delete to authenticated using(author_id=(select auth.uid()) or exists(select 1 from public.tickets t where t.id=ticket_id and private.has_workspace_role(t.workspace_id,array['admin','pm']::public.app_role[])));

-- 8) Helpdesk dashboard
create or replace view public.helpdesk_dashboard_stats with(security_invoker=true) as
select workspace_id,count(*) total,
 count(*) filter(where status='new') new_count,
 count(*) filter(where status in('triage','in_progress','waiting_requester')) open_count,
 count(*) filter(where status='in_progress') in_progress_count,
 count(*) filter(where status='waiting_requester') waiting_count,
 count(*) filter(where status='resolved') resolved_count,
 count(*) filter(where status='closed') closed_count,
 count(*) filter(where resolved_at is not null and due_at is not null and resolved_at<=due_at) resolved_within_sla
from public.helpdesk_tickets group by workspace_id;
grant select on public.helpdesk_dashboard_stats to authenticated;
