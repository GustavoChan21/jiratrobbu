-- Jira Interno Trobbu
-- Esquema raíz de respaldo para Supabase/PostgreSQL.
-- El proyecto remoto ya fue provisionado; este archivo permite versionar la BD en GitHub.

create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('superadmin','admin','pm','dev','qa','consulta','reporter','viewer');
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


-- Jira Interno TROBBU · Upgrade v5
-- Apply after database.sql / v4. Idempotent where practical.

-- 1) Ticket/helpdesk keys are unique inside each workspace, not globally.
alter table public.tickets drop constraint if exists tickets_ticket_key_key;
alter table public.tickets drop constraint if exists tickets_workspace_ticket_key_key;
alter table public.tickets add constraint tickets_workspace_ticket_key_key unique(workspace_id,ticket_key);

alter table public.helpdesk_tickets drop constraint if exists helpdesk_tickets_ticket_key_key;
alter table public.helpdesk_tickets drop constraint if exists helpdesk_workspace_ticket_key_key;
alter table public.helpdesk_tickets add constraint helpdesk_workspace_ticket_key_key unique(workspace_id,ticket_key);

-- 2) Workspace creator may immediately read the new workspace; admins may delete it.
drop policy if exists workspaces_select on public.workspaces;
create policy workspaces_select on public.workspaces
for select to authenticated
using (
  private.is_workspace_member(id)
  or created_by = (select auth.uid())
);

drop policy if exists workspaces_delete on public.workspaces;
create policy workspaces_delete on public.workspaces
for delete to authenticated
using (
  private.has_workspace_role(id,array['admin']::public.app_role[])
  or created_by = (select auth.uid())
);

create or replace function public.create_workspace(p_name text,p_slug text)
returns uuid
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  v_uid uuid:=auth.uid();
  v_id uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if nullif(trim(p_name),'') is null or nullif(trim(p_slug),'') is null then
    raise exception 'Workspace name and slug are required';
  end if;

  insert into public.workspaces(name,slug,created_by)
  values(trim(p_name),trim(p_slug),v_uid)
  returning id into v_id;

  return v_id;
end
$$;
revoke all on function public.create_workspace(text,text) from public,anon;
grant execute on function public.create_workspace(text,text) to authenticated;

-- 3) Viewer is read-only for product tickets.
drop policy if exists tickets_insert on public.tickets;
create policy tickets_insert on public.tickets
for insert to authenticated
with check (
  private.has_workspace_role(workspace_id,array['admin','pm','dev','qa']::public.app_role[])
);

drop policy if exists tickets_update on public.tickets;
create policy tickets_update on public.tickets
for update to authenticated
using (
  private.has_workspace_role(workspace_id,array['admin','pm','dev','qa']::public.app_role[])
)
with check (
  private.has_workspace_role(workspace_id,array['admin','pm','dev','qa']::public.app_role[])
);

-- 4) Ticket comment permissions.
drop policy if exists comments_access on public.ticket_comments;
drop policy if exists ticket_comments_select on public.ticket_comments;
create policy ticket_comments_select on public.ticket_comments
for select to authenticated
using (exists (
  select 1 from public.tickets t
  where t.id=ticket_id and private.is_workspace_member(t.workspace_id)
));

drop policy if exists ticket_comments_insert on public.ticket_comments;
create policy ticket_comments_insert on public.ticket_comments
for insert to authenticated
with check (
  author_id=(select auth.uid())
  and exists (
    select 1 from public.tickets t
    where t.id=ticket_id
      and private.has_workspace_role(t.workspace_id,array['admin','pm','dev','qa']::public.app_role[])
  )
);

drop policy if exists ticket_comments_update on public.ticket_comments;
create policy ticket_comments_update on public.ticket_comments
for update to authenticated
using (
  author_id=(select auth.uid())
  and exists (
    select 1 from public.tickets t
    where t.id=ticket_id
      and private.has_workspace_role(t.workspace_id,array['admin','pm','dev','qa']::public.app_role[])
  )
)
with check (
  author_id=(select auth.uid())
  and exists (
    select 1 from public.tickets t
    where t.id=ticket_id
      and private.has_workspace_role(t.workspace_id,array['admin','pm','dev','qa']::public.app_role[])
  )
);

drop policy if exists ticket_comments_delete on public.ticket_comments;
create policy ticket_comments_delete on public.ticket_comments
for delete to authenticated
using (
  (
    author_id=(select auth.uid())
    and exists (
      select 1 from public.tickets t
      where t.id=ticket_id
        and private.has_workspace_role(t.workspace_id,array['admin','pm','dev','qa']::public.app_role[])
    )
  )
  or exists (
    select 1 from public.tickets t
    where t.id=ticket_id
      and private.has_workspace_role(t.workspace_id,array['admin','pm']::public.app_role[])
  )
);

-- 5) Membership guard: protect Admin role and keep at least one active Admin.
create or replace function private.guard_workspace_membership()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_caller uuid := auth.uid();
  v_caller_is_admin boolean;
  v_admins integer;
begin
  -- Workspace FK cascade must be allowed.
  if tg_op='DELETE' and not exists(
    select 1 from public.workspaces w where w.id=old.workspace_id
  ) then
    return old;
  end if;

  -- Trusted backend/service_role calls are authorized server-side.
  if v_caller is null then
    if tg_op='DELETE' then return old; end if;
    return new;
  end if;

  if tg_op='INSERT' then
    if new.role='admin' then
      select private.has_workspace_role(new.workspace_id,array['admin']::public.app_role[])
      into v_caller_is_admin;
      if not v_caller_is_admin and new.user_id is distinct from v_caller then
        raise exception 'Only an admin can grant the admin role';
      end if;
    end if;
    return new;
  end if;

  select private.has_workspace_role(old.workspace_id,array['admin']::public.app_role[])
  into v_caller_is_admin;

  if old.role='admin' and not v_caller_is_admin then
    raise exception 'Only an admin can modify another admin';
  end if;

  if tg_op='UPDATE' and new.role='admin' and old.role<>'admin' and not v_caller_is_admin then
    raise exception 'Only an admin can grant the admin role';
  end if;

  if old.role='admin' and (
    tg_op='DELETE'
    or (tg_op='UPDATE' and (new.role<>'admin' or new.active=false))
  ) then
    select count(*) into v_admins
    from public.workspace_members wm
    where wm.workspace_id=old.workspace_id
      and wm.active=true
      and wm.role='admin'
      and wm.user_id<>old.user_id;

    if v_admins=0 then
      raise exception 'A workspace must keep at least one active admin';
    end if;
  end if;

  if tg_op='DELETE' then return old; end if;
  return new;
end
$$;
revoke all on function private.guard_workspace_membership() from public,anon,authenticated;

drop trigger if exists trg_guard_workspace_membership on public.workspace_members;
create trigger trg_guard_workspace_membership
before insert or update or delete on public.workspace_members
for each row execute function private.guard_workspace_membership();

-- 6) Requester Helpdesk guard.
create or replace function private.guard_helpdesk_requester_update()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_staff boolean;
begin
  select private.has_workspace_role(old.workspace_id,array['admin','pm','dev','qa']::public.app_role[])
  into v_staff;

  if v_staff then return new; end if;

  if old.requester_user_id is distinct from auth.uid() then
    raise exception 'You cannot update this Helpdesk request';
  end if;

  if new.workspace_id is distinct from old.workspace_id
     or new.requester_user_id is distinct from old.requester_user_id
     or new.assigned_to is distinct from old.assigned_to
     or new.status is distinct from old.status
     or new.due_at is distinct from old.due_at
     or new.first_response_at is distinct from old.first_response_at
     or new.resolved_at is distinct from old.resolved_at
     or new.closed_at is distinct from old.closed_at then
    raise exception 'Requesters cannot change internal Helpdesk handling fields';
  end if;

  return new;
end
$$;
revoke all on function private.guard_helpdesk_requester_update() from public,anon,authenticated;

drop trigger if exists trg_guard_helpdesk_requester_update on public.helpdesk_tickets;
create trigger trg_guard_helpdesk_requester_update
before update on public.helpdesk_tickets
for each row execute function private.guard_helpdesk_requester_update();

-- 7) Helpdesk key + automatic resolution SLA due_at.
create or replace function private.assign_helpdesk_key()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_seq bigint;
  v_sla integer;
begin
  insert into public.workspace_settings(workspace_id)
  values(new.workspace_id)
  on conflict (workspace_id) do nothing;

  update public.workspace_settings
  set helpdesk_seq=helpdesk_seq+1
  where workspace_id=new.workspace_id
  returning helpdesk_seq,sla_resolution_hours into v_seq,v_sla;

  new.ticket_number := v_seq;
  new.ticket_key := 'HD-' || v_seq::text;
  if new.due_at is null then
    new.due_at := now() + make_interval(hours=>coalesce(v_sla,24));
  end if;
  return new;
end
$$;
revoke all on function private.assign_helpdesk_key() from public,anon,authenticated;

-- 8) Respect workspace notification preferences.
create or replace function private.notify_ticket_created()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_in_app boolean := true;
  v_email boolean := true;
begin
  select coalesce(ws.in_app_notifications,true),coalesce(ws.email_notifications,true)
  into v_in_app,v_email
  from public.workspace_settings ws
  where ws.workspace_id=new.workspace_id;

  if not found then v_in_app:=true; v_email:=true; end if;

  if v_email then
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
      values(new.workspace_id,new.id,new.dev_owner_id,'assigned_dev',
        jsonb_build_object('ticket_key',new.ticket_key,'title',new.title));
    end if;

    if new.qa_owner_id is not null then
      insert into public.notification_outbox(workspace_id,ticket_id,recipient_user_id,event_type,payload)
      values(new.workspace_id,new.id,new.qa_owner_id,'assigned_qa',
        jsonb_build_object('ticket_key',new.ticket_key,'title',new.title));
    end if;
  end if;

  if v_in_app then
    if new.reporter_id is not null then
      insert into public.notifications(workspace_id,user_id,ticket_id,type,title,body)
      values(new.workspace_id,new.reporter_id,new.id,'ticket_created','Ticket creado '||new.ticket_key,new.title);
    end if;

    insert into public.notifications(workspace_id,user_id,ticket_id,type,title,body)
    select distinct new.workspace_id,x.user_id,new.id,x.notification_type,x.notification_title,x.notification_body
    from (
      select wm.user_id,
        'ticket_created'::text as notification_type,
        ('Nuevo ticket '||new.ticket_key)::text as notification_title,
        new.title::text as notification_body
      from public.workspace_members wm
      where wm.workspace_id=new.workspace_id
        and wm.active=true
        and wm.role in ('admin','pm')
        and wm.user_id is distinct from new.reporter_id
      union all
      select new.dev_owner_id,'assigned_dev','Ticket asignado '||new.ticket_key,new.title
      where new.dev_owner_id is not null and new.dev_owner_id is distinct from new.reporter_id
      union all
      select new.qa_owner_id,'assigned_qa','Ticket asignado a QA '||new.ticket_key,new.title
      where new.qa_owner_id is not null and new.qa_owner_id is distinct from new.reporter_id
    ) x
    where x.user_id is not null;
  end if;

  return new;
end
$$;

create or replace function private.track_ticket_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_in_app boolean := true;
  v_email boolean := true;
begin
  select coalesce(ws.in_app_notifications,true),coalesce(ws.email_notifications,true)
  into v_in_app,v_email
  from public.workspace_settings ws
  where ws.workspace_id=new.workspace_id;
  if not found then v_in_app:=true; v_email:=true; end if;

  if old.status is distinct from new.status then
    if new.status='dev_done' and new.dev_completed_at is null then new.dev_completed_at:=now(); end if;
    if new.status='qa_passed' and new.qa_completed_at is null then new.qa_completed_at:=now(); end if;
    if new.status='closed' and new.closed_at is null then new.closed_at:=now(); end if;

    insert into public.ticket_activity(ticket_id,actor_id,action,from_value,to_value)
    values(new.id,auth.uid(),'status_changed',old.status::text,new.status::text);

    if v_in_app and new.reporter_id is not null and new.reporter_id is distinct from auth.uid() then
      insert into public.notifications(workspace_id,user_id,ticket_id,type,title,body)
      values(new.workspace_id,new.reporter_id,new.id,'ticket_status',new.ticket_key||' actualizado','El estado cambió de '||old.status::text||' a '||new.status::text||'.');
    end if;

    if new.status='qa_rejected' and new.dev_owner_id is not null then
      if v_email then
        insert into public.notification_outbox(workspace_id,ticket_id,recipient_user_id,event_type,payload)
        values(new.workspace_id,new.id,new.dev_owner_id,'qa_rejected',jsonb_build_object('ticket_key',new.ticket_key,'title',new.title,'status',new.status));
      end if;
      if v_in_app and new.dev_owner_id is distinct from auth.uid() then
        insert into public.notifications(workspace_id,user_id,ticket_id,type,title,body)
        values(new.workspace_id,new.dev_owner_id,new.id,'qa_rejected',new.ticket_key||' regresado por QA','Requiere correcciones antes de volver a revisión.');
      end if;
    end if;
  end if;

  if old.dev_owner_id is distinct from new.dev_owner_id and new.dev_owner_id is not null then
    if v_email then
      insert into public.notification_outbox(workspace_id,ticket_id,recipient_user_id,event_type,payload)
      values(new.workspace_id,new.id,new.dev_owner_id,'assigned_dev',jsonb_build_object('ticket_key',new.ticket_key,'title',new.title));
    end if;
    if v_in_app and new.dev_owner_id is distinct from auth.uid() then
      insert into public.notifications(workspace_id,user_id,ticket_id,type,title,body)
      values(new.workspace_id,new.dev_owner_id,new.id,'assigned_dev','Ticket asignado '||new.ticket_key,new.title);
    end if;
  end if;

  if old.qa_owner_id is distinct from new.qa_owner_id and new.qa_owner_id is not null then
    if v_email then
      insert into public.notification_outbox(workspace_id,ticket_id,recipient_user_id,event_type,payload)
      values(new.workspace_id,new.id,new.qa_owner_id,'assigned_qa',jsonb_build_object('ticket_key',new.ticket_key,'title',new.title));
    end if;
    if v_in_app and new.qa_owner_id is distinct from auth.uid() then
      insert into public.notifications(workspace_id,user_id,ticket_id,type,title,body)
      values(new.workspace_id,new.qa_owner_id,new.id,'assigned_qa','Ticket asignado a QA '||new.ticket_key,new.title);
    end if;
  end if;
  return new;
end
$$;

create or replace function private.helpdesk_created()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_in_app boolean := true;
begin
  select coalesce(ws.in_app_notifications,true) into v_in_app
  from public.workspace_settings ws where ws.workspace_id=new.workspace_id;
  if not found then v_in_app:=true; end if;

  insert into public.helpdesk_activity(helpdesk_ticket_id,actor_id,action,to_value)
  values(new.id,auth.uid(),'created',new.status);

  if v_in_app then
    if new.requester_user_id is not null then
      insert into public.notifications(workspace_id,user_id,helpdesk_ticket_id,type,title,body)
      values(new.workspace_id,new.requester_user_id,new.id,'helpdesk_created','Solicitud creada '||new.ticket_key,new.subject);
    end if;
    insert into public.notifications(workspace_id,user_id,helpdesk_ticket_id,type,title,body)
    select new.workspace_id,wm.user_id,new.id,'helpdesk_new','Nueva solicitud '||new.ticket_key,new.subject
    from public.workspace_members wm
    where wm.workspace_id=new.workspace_id and wm.active=true
      and wm.role in ('admin','pm','dev','qa')
      and wm.user_id is distinct from new.requester_user_id;
    if new.assigned_to is not null and new.assigned_to is distinct from new.requester_user_id then
      insert into public.notifications(workspace_id,user_id,helpdesk_ticket_id,type,title,body)
      values(new.workspace_id,new.assigned_to,new.id,'helpdesk_assigned',new.ticket_key||' asignado',new.subject);
    end if;
  end if;
  return new;
end
$$;

create or replace function private.track_helpdesk_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_in_app boolean := true;
begin
  select coalesce(ws.in_app_notifications,true) into v_in_app
  from public.workspace_settings ws where ws.workspace_id=new.workspace_id;
  if not found then v_in_app:=true; end if;

  if old.status is distinct from new.status then
    if new.status='in_progress' and new.first_response_at is null then new.first_response_at=now(); end if;
    if new.status='resolved' and new.resolved_at is null then new.resolved_at=now(); end if;
    if new.status='closed' and new.closed_at is null then new.closed_at=now(); end if;

    insert into public.helpdesk_activity(helpdesk_ticket_id,actor_id,action,from_value,to_value)
    values(new.id,auth.uid(),'status_changed',old.status,new.status);

    if v_in_app and new.requester_user_id is not null and new.requester_user_id is distinct from auth.uid() then
      insert into public.notifications(workspace_id,user_id,helpdesk_ticket_id,type,title,body)
      values(new.workspace_id,new.requester_user_id,new.id,'helpdesk_status',new.ticket_key||' actualizado','El estado de tu solicitud cambió a '||new.status||'.');
    end if;
  end if;

  if old.assigned_to is distinct from new.assigned_to and new.assigned_to is not null then
    insert into public.helpdesk_activity(helpdesk_ticket_id,actor_id,action,from_value,to_value)
    values(new.id,auth.uid(),'assigned',old.assigned_to::text,new.assigned_to::text);
    if v_in_app and new.assigned_to is distinct from auth.uid() then
      insert into public.notifications(workspace_id,user_id,helpdesk_ticket_id,type,title,body)
      values(new.workspace_id,new.assigned_to,new.id,'helpdesk_assigned',new.ticket_key||' asignado',new.subject);
    end if;
  end if;
  return new;
end
$$;

-- Keep the internal trigger functions non-callable through the API.
revoke all on function private.notify_ticket_created() from public,anon,authenticated;
revoke all on function private.track_ticket_change() from public,anon,authenticated;
revoke all on function private.helpdesk_created() from public,anon,authenticated;
revoke all on function private.track_helpdesk_change() from public,anon,authenticated;
-- Jira Interno TROBBU · Upgrade v6
-- Integridad multi-workspace, privacidad Helpdesk y controles finales de permisos.

-- 1) Integridad: las relaciones operativas deben permanecer dentro del mismo workspace.
alter table public.products drop constraint if exists products_id_workspace_id_key;
alter table public.products add constraint products_id_workspace_id_key unique(id,workspace_id);

alter table public.sprints drop constraint if exists sprints_id_workspace_id_key;
alter table public.sprints add constraint sprints_id_workspace_id_key unique(id,workspace_id);

alter table public.helpdesk_departments drop constraint if exists helpdesk_departments_id_workspace_id_key;
alter table public.helpdesk_departments add constraint helpdesk_departments_id_workspace_id_key unique(id,workspace_id);

alter table public.tickets drop constraint if exists tickets_product_workspace_fkey;
alter table public.tickets add constraint tickets_product_workspace_fkey
  foreign key(product_id,workspace_id)
  references public.products(id,workspace_id)
  on update cascade on delete restrict;

alter table public.tickets drop constraint if exists tickets_sprint_workspace_fkey;
alter table public.tickets add constraint tickets_sprint_workspace_fkey
  foreign key(sprint_id,workspace_id)
  references public.sprints(id,workspace_id)
  on update cascade on delete set null (sprint_id);

alter table public.helpdesk_tickets drop constraint if exists helpdesk_department_workspace_fkey;
alter table public.helpdesk_tickets add constraint helpdesk_department_workspace_fkey
  foreign key(department_id,workspace_id)
  references public.helpdesk_departments(id,workspace_id)
  on update cascade on delete set null (department_id);

-- 2) Solo Admin puede eliminar por completo un workspace.
drop policy if exists workspaces_delete on public.workspaces;
create policy workspaces_delete on public.workspaces
for delete to authenticated
using (private.has_workspace_role(id,array['admin']::public.app_role[]));

-- 3) Privacidad de Helpdesk:
-- Staff ve todas las solicitudes; usuarios Viewer/requesters solo ven las propias.
drop policy if exists helpdesk_tickets_select on public.helpdesk_tickets;
create policy helpdesk_tickets_select on public.helpdesk_tickets
for select to authenticated
using (
  private.has_workspace_role(workspace_id,array['admin','pm','dev','qa']::public.app_role[])
  or (
    requester_user_id=(select auth.uid())
    and private.is_workspace_member(workspace_id)
  )
);

drop policy if exists helpdesk_comments_select on public.helpdesk_comments;
create policy helpdesk_comments_select on public.helpdesk_comments
for select to authenticated
using (
  exists (
    select 1 from public.helpdesk_tickets h
    where h.id=helpdesk_ticket_id
      and (
        private.has_workspace_role(h.workspace_id,array['admin','pm','dev','qa']::public.app_role[])
        or h.requester_user_id=(select auth.uid())
      )
  )
);

drop policy if exists helpdesk_comments_insert on public.helpdesk_comments;
create policy helpdesk_comments_insert on public.helpdesk_comments
for insert to authenticated
with check (
  author_id=(select auth.uid())
  and exists (
    select 1 from public.helpdesk_tickets h
    where h.id=helpdesk_ticket_id
      and (
        private.has_workspace_role(h.workspace_id,array['admin','pm','dev','qa']::public.app_role[])
        or h.requester_user_id=(select auth.uid())
      )
  )
);

drop policy if exists helpdesk_activity_select on public.helpdesk_activity;
create policy helpdesk_activity_select on public.helpdesk_activity
for select to authenticated
using (
  exists (
    select 1 from public.helpdesk_tickets h
    where h.id=helpdesk_ticket_id
      and (
        private.has_workspace_role(h.workspace_id,array['admin','pm','dev','qa']::public.app_role[])
        or h.requester_user_id=(select auth.uid())
      )
  )
);

-- 4) El toggle Helpdesk debe ser efectivo también a nivel de API/RLS.
drop policy if exists helpdesk_tickets_insert on public.helpdesk_tickets;
create policy helpdesk_tickets_insert on public.helpdesk_tickets
for insert to authenticated
with check (
  private.is_workspace_member(workspace_id)
  and (requester_user_id is null or requester_user_id=(select auth.uid()))
  and coalesce(
    (select ws.helpdesk_enabled
       from public.workspace_settings ws
      where ws.workspace_id=helpdesk_tickets.workspace_id),
    true
  )
);
-- Jira Interno TROBBU · Upgrade v7
-- Inmutabilidad de workspace/propietario y membresías para evitar movimientos cruzados vía API.

create or replace function private.prevent_workspace_reassignment()
returns trigger
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
begin
  if new.workspace_id is distinct from old.workspace_id then
    raise exception 'workspace_id cannot be changed after creation';
  end if;
  return new;
end
$$;
revoke all on function private.prevent_workspace_reassignment() from public,anon,authenticated;

drop trigger if exists trg_products_workspace_immutable on public.products;
create trigger trg_products_workspace_immutable
before update on public.products
for each row execute function private.prevent_workspace_reassignment();

drop trigger if exists trg_sprints_workspace_immutable on public.sprints;
create trigger trg_sprints_workspace_immutable
before update on public.sprints
for each row execute function private.prevent_workspace_reassignment();

drop trigger if exists trg_tickets_workspace_immutable on public.tickets;
create trigger trg_tickets_workspace_immutable
before update on public.tickets
for each row execute function private.prevent_workspace_reassignment();

drop trigger if exists trg_helpdesk_departments_workspace_immutable on public.helpdesk_departments;
create trigger trg_helpdesk_departments_workspace_immutable
before update on public.helpdesk_departments
for each row execute function private.prevent_workspace_reassignment();

drop trigger if exists trg_helpdesk_tickets_workspace_immutable on public.helpdesk_tickets;
create trigger trg_helpdesk_tickets_workspace_immutable
before update on public.helpdesk_tickets
for each row execute function private.prevent_workspace_reassignment();

create or replace function private.guard_workspace_identity()
returns trigger
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'created_by cannot be changed';
  end if;
  return new;
end
$$;
revoke all on function private.guard_workspace_identity() from public,anon,authenticated;

drop trigger if exists trg_workspace_identity_immutable on public.workspaces;
create trigger trg_workspace_identity_immutable
before update on public.workspaces
for each row execute function private.guard_workspace_identity();

create or replace function private.guard_workspace_membership()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_caller uuid := auth.uid();
  v_caller_is_admin boolean;
  v_admins integer;
begin
  if tg_op='DELETE' and not exists(
    select 1 from public.workspaces w where w.id=old.workspace_id
  ) then
    return old;
  end if;

  if v_caller is null then
    if tg_op='UPDATE' and (
      new.workspace_id is distinct from old.workspace_id
      or new.user_id is distinct from old.user_id
    ) then
      raise exception 'Membership workspace/user cannot be reassigned';
    end if;
    if tg_op='DELETE' then return old; end if;
    return new;
  end if;

  if tg_op='INSERT' then
    if new.role='admin' then
      select private.has_workspace_role(new.workspace_id,array['admin']::public.app_role[])
      into v_caller_is_admin;
      if not v_caller_is_admin and new.user_id is distinct from v_caller then
        raise exception 'Only an admin can grant the admin role';
      end if;
    end if;
    return new;
  end if;

  if tg_op='UPDATE' and (
    new.workspace_id is distinct from old.workspace_id
    or new.user_id is distinct from old.user_id
  ) then
    raise exception 'Membership workspace/user cannot be reassigned';
  end if;

  select private.has_workspace_role(old.workspace_id,array['admin']::public.app_role[])
  into v_caller_is_admin;

  if old.role='admin' and not v_caller_is_admin then
    raise exception 'Only an admin can modify another admin';
  end if;

  if tg_op='UPDATE' and new.role='admin' and old.role<>'admin' and not v_caller_is_admin then
    raise exception 'Only an admin can grant the admin role';
  end if;

  if old.role='admin' and (
    tg_op='DELETE'
    or (tg_op='UPDATE' and (new.role<>'admin' or new.active=false))
  ) then
    select count(*) into v_admins
    from public.workspace_members wm
    where wm.workspace_id=old.workspace_id
      and wm.active=true
      and wm.role='admin'
      and wm.user_id<>old.user_id;

    if v_admins=0 then
      raise exception 'A workspace must keep at least one active admin';
    end if;
  end if;

  if tg_op='DELETE' then return old; end if;
  return new;
end
$$;
-- Jira Interno TROBBU · Upgrade v8
-- Privacidad de perfiles: solo perfil propio o colaboradores que comparten workspace.

create or replace function private.shares_workspace_with(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select exists (
    select 1
    from public.workspace_members me
    join public.workspace_members other
      on other.workspace_id=me.workspace_id
     and other.active=true
    where me.user_id=(select auth.uid())
      and me.active=true
      and other.user_id=p_user
  );
$$;
revoke all on function private.shares_workspace_with(uuid) from public,anon;
grant execute on function private.shares_workspace_with(uuid) to authenticated;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
for select to authenticated
using (
  id=(select auth.uid())
  or private.shares_workspace_with(id)
);
-- Jira Interno TROBBU · Upgrade v9
-- Validación de reporter/requester/asignaciones y orden de triggers antes de notificaciones.

create or replace function private.validate_ticket_people()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if tg_op='UPDATE' and new.reporter_id is distinct from old.reporter_id then
    raise exception 'reporter_id cannot be changed after ticket creation';
  end if;

  if tg_op='INSERT' and new.reporter_id is not null and not exists(
    select 1 from public.workspace_members wm
    where wm.workspace_id=new.workspace_id
      and wm.user_id=new.reporter_id
      and wm.active=true
  ) then
    raise exception 'Reporter must be an active member of the workspace';
  end if;

  if (tg_op='INSERT' or new.dev_owner_id is distinct from old.dev_owner_id)
     and new.dev_owner_id is not null
     and not exists(
       select 1 from public.workspace_members wm
       where wm.workspace_id=new.workspace_id
         and wm.user_id=new.dev_owner_id
         and wm.active=true
         and wm.role in ('admin','pm','dev')
     ) then
    raise exception 'Development owner must be an active Admin, PM or Dev in the workspace';
  end if;

  if (tg_op='INSERT' or new.qa_owner_id is distinct from old.qa_owner_id)
     and new.qa_owner_id is not null
     and not exists(
       select 1 from public.workspace_members wm
       where wm.workspace_id=new.workspace_id
         and wm.user_id=new.qa_owner_id
         and wm.active=true
         and wm.role in ('admin','pm','qa')
     ) then
    raise exception 'QA owner must be an active Admin, PM or QA in the workspace';
  end if;

  return new;
end
$$;
revoke all on function private.validate_ticket_people() from public,anon,authenticated;

drop trigger if exists trg_validate_ticket_people on public.tickets;
drop trigger if exists trg_00_validate_ticket_people on public.tickets;
create trigger trg_00_validate_ticket_people
before insert or update on public.tickets
for each row execute function private.validate_ticket_people();

create or replace function private.validate_helpdesk_people()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if tg_op='UPDATE' and new.requester_user_id is distinct from old.requester_user_id then
    raise exception 'requester_user_id cannot be changed after request creation';
  end if;

  if tg_op='INSERT' and new.requester_user_id is not null and not exists(
    select 1 from public.workspace_members wm
    where wm.workspace_id=new.workspace_id
      and wm.user_id=new.requester_user_id
      and wm.active=true
  ) then
    raise exception 'Requester must be an active member of the workspace';
  end if;

  if (tg_op='INSERT' or new.assigned_to is distinct from old.assigned_to)
     and new.assigned_to is not null
     and not exists(
       select 1 from public.workspace_members wm
       where wm.workspace_id=new.workspace_id
         and wm.user_id=new.assigned_to
         and wm.active=true
         and wm.role in ('admin','pm','dev','qa')
     ) then
    raise exception 'Helpdesk assignee must be an active staff member of the workspace';
  end if;

  return new;
end
$$;
revoke all on function private.validate_helpdesk_people() from public,anon,authenticated;

drop trigger if exists trg_validate_helpdesk_people on public.helpdesk_tickets;
drop trigger if exists trg_00_validate_helpdesk_people on public.helpdesk_tickets;
create trigger trg_00_validate_helpdesk_people
before insert or update on public.helpdesk_tickets
for each row execute function private.validate_helpdesk_people();
-- Jira Interno TROBBU · Upgrade v10
-- Privacidad Helpdesk tras baja de usuario y visibilidad de perfiles de colaboradores inactivos del mismo workspace.

-- Los miembros activos pueden seguir viendo el perfil de colaboradores desactivados
-- que conservan una membresía en el mismo workspace, para poder administrarlos/reactivarlos.
create or replace function private.shares_workspace_with(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select exists (
    select 1
    from public.workspace_members me
    join public.workspace_members other
      on other.workspace_id=me.workspace_id
    where me.user_id=(select auth.uid())
      and me.active=true
      and other.user_id=p_user
  );
$$;

-- Requesters solo conservan acceso al Helpdesk mientras su membresía siga activa.
drop policy if exists helpdesk_tickets_update on public.helpdesk_tickets;
create policy helpdesk_tickets_update on public.helpdesk_tickets
for update to authenticated
using (
  private.has_workspace_role(workspace_id,array['admin','pm','dev','qa']::public.app_role[])
  or (
    requester_user_id=(select auth.uid())
    and private.is_workspace_member(workspace_id)
  )
)
with check (
  private.has_workspace_role(workspace_id,array['admin','pm','dev','qa']::public.app_role[])
  or (
    requester_user_id=(select auth.uid())
    and private.is_workspace_member(workspace_id)
  )
);

drop policy if exists helpdesk_comments_select on public.helpdesk_comments;
create policy helpdesk_comments_select on public.helpdesk_comments
for select to authenticated
using (
  exists (
    select 1 from public.helpdesk_tickets h
    where h.id=helpdesk_ticket_id
      and private.is_workspace_member(h.workspace_id)
      and (
        private.has_workspace_role(h.workspace_id,array['admin','pm','dev','qa']::public.app_role[])
        or h.requester_user_id=(select auth.uid())
      )
  )
);

drop policy if exists helpdesk_comments_insert on public.helpdesk_comments;
create policy helpdesk_comments_insert on public.helpdesk_comments
for insert to authenticated
with check (
  author_id=(select auth.uid())
  and exists (
    select 1 from public.helpdesk_tickets h
    where h.id=helpdesk_ticket_id
      and private.is_workspace_member(h.workspace_id)
      and (
        private.has_workspace_role(h.workspace_id,array['admin','pm','dev','qa']::public.app_role[])
        or h.requester_user_id=(select auth.uid())
      )
  )
);

drop policy if exists helpdesk_comments_update on public.helpdesk_comments;
create policy helpdesk_comments_update on public.helpdesk_comments
for update to authenticated
using (
  author_id=(select auth.uid())
  and exists (
    select 1 from public.helpdesk_tickets h
    where h.id=helpdesk_ticket_id
      and private.is_workspace_member(h.workspace_id)
      and (
        private.has_workspace_role(h.workspace_id,array['admin','pm','dev','qa']::public.app_role[])
        or h.requester_user_id=(select auth.uid())
      )
  )
)
with check (
  author_id=(select auth.uid())
  and exists (
    select 1 from public.helpdesk_tickets h
    where h.id=helpdesk_ticket_id
      and private.is_workspace_member(h.workspace_id)
      and (
        private.has_workspace_role(h.workspace_id,array['admin','pm','dev','qa']::public.app_role[])
        or h.requester_user_id=(select auth.uid())
      )
  )
);

drop policy if exists helpdesk_comments_delete on public.helpdesk_comments;
create policy helpdesk_comments_delete on public.helpdesk_comments
for delete to authenticated
using (
  author_id=(select auth.uid())
  and exists (
    select 1 from public.helpdesk_tickets h
    where h.id=helpdesk_ticket_id
      and private.is_workspace_member(h.workspace_id)
      and (
        private.has_workspace_role(h.workspace_id,array['admin','pm','dev','qa']::public.app_role[])
        or h.requester_user_id=(select auth.uid())
      )
  )
);

drop policy if exists helpdesk_activity_select on public.helpdesk_activity;
create policy helpdesk_activity_select on public.helpdesk_activity
for select to authenticated
using (
  exists (
    select 1 from public.helpdesk_tickets h
    where h.id=helpdesk_ticket_id
      and private.is_workspace_member(h.workspace_id)
      and (
        private.has_workspace_role(h.workspace_id,array['admin','pm','dev','qa']::public.app_role[])
        or h.requester_user_id=(select auth.uid())
      )
  )
);


-- ===== Jira Interno TROBBU v11 consolidated upgrade =====
-- Jira Interno TROBBU v11
-- Requiere haber ejecutado previamente upgrade-v11-enum.sql.
-- Roles: superadmin, admin, pm, dev, qa, reporter (solo carga), viewer (solo dashboards).

-- -----------------------------------------------------------------------------
-- Planeación, evidencias y colaboración
-- -----------------------------------------------------------------------------
alter table public.tickets add column if not exists start_date date;
alter table public.ticket_comments add column if not exists kind text not null default 'comment';
alter table public.ticket_comments drop constraint if exists ticket_comments_kind_check;
alter table public.ticket_comments add constraint ticket_comments_kind_check
  check (kind in ('comment','review','rejection','fix','closure'));
alter table public.sprints add column if not exists details text;

create table if not exists public.sprint_comments (
  id uuid primary key default gen_random_uuid(),
  sprint_id uuid not null references public.sprints(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  kind text not null default 'comment'
    check (kind in ('comment','review','rejection','fix','closure')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_sprint_comments_sprint on public.sprint_comments(sprint_id,created_at);

create table if not exists public.ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  comment_id uuid references public.ticket_comments(id) on delete set null,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  evidence_type text not null default 'general'
    check (evidence_type in ('general','review','rejection','fix','closure')),
  created_at timestamptz not null default now()
);
create index if not exists idx_ticket_attachments_ticket on public.ticket_attachments(ticket_id,created_at);

create table if not exists public.sprint_attachments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  sprint_id uuid not null references public.sprints(id) on delete cascade,
  comment_id uuid references public.sprint_comments(id) on delete set null,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  evidence_type text not null default 'general'
    check (evidence_type in ('general','review','rejection','fix','closure')),
  created_at timestamptz not null default now()
);
create index if not exists idx_sprint_attachments_sprint on public.sprint_attachments(sprint_id,created_at);

alter table public.tickets drop constraint if exists tickets_date_range_check;
alter table public.tickets add constraint tickets_date_range_check
  check (start_date is null or due_date is null or due_date>=start_date);
alter table public.sprints drop constraint if exists sprints_date_range_check;
alter table public.sprints add constraint sprints_date_range_check
  check (start_date is null or end_date is null or end_date>=start_date);

alter table public.tickets drop constraint if exists tickets_id_workspace_id_key;
alter table public.tickets add constraint tickets_id_workspace_id_key unique(id,workspace_id);
alter table public.ticket_attachments drop constraint if exists ticket_attachments_ticket_workspace_fkey;
alter table public.ticket_attachments add constraint ticket_attachments_ticket_workspace_fkey
  foreign key(ticket_id,workspace_id) references public.tickets(id,workspace_id) on delete cascade;
alter table public.sprint_attachments drop constraint if exists sprint_attachments_sprint_workspace_fkey;
alter table public.sprint_attachments add constraint sprint_attachments_sprint_workspace_fkey
  foreign key(sprint_id,workspace_id) references public.sprints(id,workspace_id) on delete cascade;

alter table public.sprint_comments enable row level security;
alter table public.ticket_attachments enable row level security;
alter table public.sprint_attachments enable row level security;
grant select,insert,update,delete on public.sprint_comments to authenticated;
grant select,insert,delete on public.ticket_attachments to authenticated;
grant select,insert,delete on public.sprint_attachments to authenticated;

drop trigger if exists trg_sprint_comments_updated on public.sprint_comments;
create trigger trg_sprint_comments_updated
before update on public.sprint_comments
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Helpdesk: estados y departamentos solicitantes
-- -----------------------------------------------------------------------------
alter table public.helpdesk_tickets add column if not exists reviewed_at timestamptz;
alter table public.helpdesk_tickets add column if not exists attended_at timestamptz;
alter table public.helpdesk_tickets drop constraint if exists helpdesk_tickets_status_check;
update public.helpdesk_tickets
set status=case status
  when 'new' then 'created'
  when 'triage' then 'review'
  when 'in_progress' then 'attended'
  when 'waiting_requester' then 'review'
  else status
end
where status in ('new','triage','in_progress','waiting_requester');
alter table public.helpdesk_tickets add constraint helpdesk_tickets_status_check
  check (status in ('created','review','attended','resolved','closed'));
alter table public.helpdesk_tickets alter column status set default 'created';

insert into public.helpdesk_departments(workspace_id,name,color,active)
select w.id,d.name,d.color,true
from public.workspaces w
cross join (values
  ('Reservaciones','#0D47A1'),
  ('Recepción','#4D5A51'),
  ('Gerencia','#21343E'),
  ('Administración','#CA6832'),
  ('Aperturas','#249F58'),
  ('Marketing','#AE6A3E'),
  ('Callcenter','#007BFF'),
  ('Plataforma','#056D25'),
  ('Atención a clientes','#D4DCE0'),
  ('Atención a socios','#FF6363')
) d(name,color)
on conflict (workspace_id,name) do update set color=excluded.color,active=true;

update public.helpdesk_departments
set active=false
where name not in (
  'Reservaciones','Recepción','Gerencia','Administración','Aperturas',
  'Marketing','Callcenter','Plataforma','Atención a clientes','Atención a socios'
);

-- -----------------------------------------------------------------------------
-- Jerarquía de workspace
-- -----------------------------------------------------------------------------
update public.workspace_members wm
set role='superadmin'
from public.workspaces w
where w.id=wm.workspace_id and w.created_by=wm.user_id and wm.role<>'superadmin';

create or replace function private.guard_workspace_membership()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_caller uuid:=auth.uid();
  v_super boolean:=false;
  v_admin boolean:=false;
  v_supers integer;
begin
  if tg_op='DELETE' and not exists(select 1 from public.workspaces w where w.id=old.workspace_id) then return old; end if;
  if v_caller is null then
    if tg_op='UPDATE' and (new.workspace_id is distinct from old.workspace_id or new.user_id is distinct from old.user_id) then
      raise exception 'Membership workspace/user cannot be reassigned';
    end if;
    if tg_op='DELETE' then return old; end if;
    return new;
  end if;
  if tg_op='INSERT' then
    v_super:=private.has_workspace_role(new.workspace_id,array['superadmin']::public.app_role[]);
    v_admin:=private.has_workspace_role(new.workspace_id,array['superadmin','admin']::public.app_role[]);
    if new.role='superadmin' and not v_super then
      if not (new.user_id=v_caller and exists(select 1 from public.workspaces w where w.id=new.workspace_id and w.created_by=v_caller)) then
        raise exception 'Only a Superadmin can grant the Superadmin role';
      end if;
    elsif new.role='admin' and not v_admin then
      raise exception 'Only a Superadmin or Admin can grant the Admin role';
    end if;
    return new;
  end if;
  if tg_op='UPDATE' and (new.workspace_id is distinct from old.workspace_id or new.user_id is distinct from old.user_id) then
    raise exception 'Membership workspace/user cannot be reassigned';
  end if;
  v_super:=private.has_workspace_role(old.workspace_id,array['superadmin']::public.app_role[]);
  v_admin:=private.has_workspace_role(old.workspace_id,array['superadmin','admin']::public.app_role[]);
  if old.role='superadmin' and not v_super then raise exception 'Only a Superadmin can modify another Superadmin'; end if;
  if old.role='admin' and not v_admin then raise exception 'Only a Superadmin or Admin can modify an Admin'; end if;
  if tg_op='UPDATE' and new.role='superadmin' and old.role<>'superadmin' and not v_super then raise exception 'Only a Superadmin can grant the Superadmin role'; end if;
  if tg_op='UPDATE' and new.role='admin' and old.role not in ('superadmin','admin') and not v_admin then raise exception 'Only a Superadmin or Admin can grant the Admin role'; end if;
  if old.role='superadmin' and (tg_op='DELETE' or (tg_op='UPDATE' and (new.role<>'superadmin' or new.active=false))) then
    select count(*) into v_supers from public.workspace_members wm
    where wm.workspace_id=old.workspace_id and wm.active=true and wm.role='superadmin' and wm.user_id<>old.user_id;
    if v_supers=0 then raise exception 'A workspace must keep at least one active Superadmin'; end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
revoke all on function private.guard_workspace_membership() from public,anon,authenticated;

create or replace function private.bootstrap_workspace()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.created_by is not null then
    insert into public.workspace_members(workspace_id,user_id,role,active)
    values(new.id,new.created_by,'superadmin',true)
    on conflict(workspace_id,user_id) do update set role='superadmin',active=true;
  end if;
  insert into public.products(workspace_id,name,key,description,board_order) values
    (new.id,'Web Administrativa','ADM','Administración interna y operación',1),
    (new.id,'Web Socios','SOC','Portal web para socios/inversionistas',2),
    (new.id,'App Socios','APP','Aplicación móvil para socios/inversionistas',3)
  on conflict(workspace_id,key) do nothing;
  insert into public.workspace_settings(workspace_id) values(new.id) on conflict(workspace_id) do nothing;
  insert into public.helpdesk_departments(workspace_id,name,color,active) values
    (new.id,'Reservaciones','#0D47A1',true),(new.id,'Recepción','#4D5A51',true),
    (new.id,'Gerencia','#21343E',true),(new.id,'Administración','#CA6832',true),
    (new.id,'Aperturas','#249F58',true),(new.id,'Marketing','#AE6A3E',true),
    (new.id,'Callcenter','#007BFF',true),(new.id,'Plataforma','#056D25',true),
    (new.id,'Atención a clientes','#D4DCE0',true),(new.id,'Atención a socios','#FF6363',true)
  on conflict(workspace_id,name) do update set color=excluded.color,active=true;
  return new;
end $$;
revoke all on function private.bootstrap_workspace() from public,anon,authenticated;

-- Workspace / collaborator / product / sprint policies
drop policy if exists workspaces_update on public.workspaces;
create policy workspaces_update on public.workspaces for update to authenticated
using(private.has_workspace_role(id,array['superadmin','admin']::public.app_role[]))
with check(private.has_workspace_role(id,array['superadmin','admin']::public.app_role[]));
drop policy if exists workspaces_delete on public.workspaces;
create policy workspaces_delete on public.workspaces for delete to authenticated
using(private.has_workspace_role(id,array['superadmin']::public.app_role[]));

drop policy if exists members_insert on public.workspace_members;
create policy members_insert on public.workspace_members for insert to authenticated
with check(private.has_workspace_role(workspace_id,array['superadmin','admin']::public.app_role[]));
drop policy if exists members_update on public.workspace_members;
create policy members_update on public.workspace_members for update to authenticated
using(private.has_workspace_role(workspace_id,array['superadmin','admin']::public.app_role[]))
with check(private.has_workspace_role(workspace_id,array['superadmin','admin']::public.app_role[]));
drop policy if exists members_delete on public.workspace_members;
create policy members_delete on public.workspace_members for delete to authenticated
using(private.has_workspace_role(workspace_id,array['superadmin','admin']::public.app_role[]));

drop policy if exists invites_manage on public.workspace_invites;
create policy invites_manage on public.workspace_invites for all to authenticated
using(private.has_workspace_role(workspace_id,array['superadmin','admin']::public.app_role[]))
with check(private.has_workspace_role(workspace_id,array['superadmin','admin']::public.app_role[]));

drop policy if exists workspace_settings_update on public.workspace_settings;
create policy workspace_settings_update on public.workspace_settings for update to authenticated
using(private.has_workspace_role(workspace_id,array['superadmin','admin']::public.app_role[]))
with check(private.has_workspace_role(workspace_id,array['superadmin','admin']::public.app_role[]));

drop policy if exists products_insert on public.products;
create policy products_insert on public.products for insert to authenticated
with check(private.has_workspace_role(workspace_id,array['superadmin','admin']::public.app_role[]));
drop policy if exists products_update on public.products;
create policy products_update on public.products for update to authenticated
using(private.has_workspace_role(workspace_id,array['superadmin','admin']::public.app_role[]))
with check(private.has_workspace_role(workspace_id,array['superadmin','admin']::public.app_role[]));
drop policy if exists products_delete on public.products;
create policy products_delete on public.products for delete to authenticated
using(private.has_workspace_role(workspace_id,array['superadmin','admin']::public.app_role[]));

drop policy if exists sprints_insert on public.sprints;
create policy sprints_insert on public.sprints for insert to authenticated
with check(private.has_workspace_role(workspace_id,array['superadmin','admin','pm']::public.app_role[]));
drop policy if exists sprints_update on public.sprints;
create policy sprints_update on public.sprints for update to authenticated
using(private.has_workspace_role(workspace_id,array['superadmin','admin','pm']::public.app_role[]))
with check(private.has_workspace_role(workspace_id,array['superadmin','admin','pm']::public.app_role[]));
drop policy if exists sprints_delete on public.sprints;
create policy sprints_delete on public.sprints for delete to authenticated
using(private.has_workspace_role(workspace_id,array['superadmin','admin','pm']::public.app_role[]));

drop policy if exists helpdesk_departments_manage on public.helpdesk_departments;
create policy helpdesk_departments_manage on public.helpdesk_departments for all to authenticated
using(private.has_workspace_role(workspace_id,array['superadmin','admin']::public.app_role[]))
with check(private.has_workspace_role(workspace_id,array['superadmin','admin']::public.app_role[]));

drop policy if exists outbox_admin_select on public.notification_outbox;
create policy outbox_admin_select on public.notification_outbox for select to authenticated
using(recipient_user_id=(select auth.uid()) or private.has_workspace_role(workspace_id,array['superadmin','admin']::public.app_role[]));

-- -----------------------------------------------------------------------------
-- Tickets: Solo carga / Solo dashboards / operación
-- -----------------------------------------------------------------------------
drop policy if exists tickets_select on public.tickets;
create policy tickets_select on public.tickets for select to authenticated using(
  private.has_workspace_role(workspace_id,array['superadmin','admin','pm','dev','qa','viewer']::public.app_role[])
  or (private.has_workspace_role(workspace_id,array['reporter']::public.app_role[]) and reporter_id=(select auth.uid()))
);
drop policy if exists tickets_insert on public.tickets;
create policy tickets_insert on public.tickets for insert to authenticated with check(
  (private.has_workspace_role(workspace_id,array['superadmin','admin','pm','dev','qa']::public.app_role[]) and reporter_id=(select auth.uid()))
  or (
    private.has_workspace_role(workspace_id,array['reporter']::public.app_role[])
    and reporter_id=(select auth.uid()) and status='backlog' and sprint_id is null
    and dev_owner_id is null and qa_owner_id is null and story_points is null
    and start_date is null and due_date is null
  )
);
drop policy if exists tickets_update on public.tickets;
create policy tickets_update on public.tickets for update to authenticated
using(private.has_workspace_role(workspace_id,array['superadmin','admin','pm','dev','qa']::public.app_role[]))
with check(private.has_workspace_role(workspace_id,array['superadmin','admin','pm','dev','qa']::public.app_role[]));
drop policy if exists tickets_delete on public.tickets;
create policy tickets_delete on public.tickets for delete to authenticated
using(private.has_workspace_role(workspace_id,array['superadmin','admin','pm']::public.app_role[]));

drop policy if exists ticket_comments_select on public.ticket_comments;
create policy ticket_comments_select on public.ticket_comments for select to authenticated using(
  exists(select 1 from public.tickets t where t.id=ticket_id and (
    private.has_workspace_role(t.workspace_id,array['superadmin','admin','pm','dev','qa','viewer']::public.app_role[])
    or (private.has_workspace_role(t.workspace_id,array['reporter']::public.app_role[]) and t.reporter_id=(select auth.uid()))
  ))
);
drop policy if exists ticket_comments_insert on public.ticket_comments;
create policy ticket_comments_insert on public.ticket_comments for insert to authenticated with check(
  author_id=(select auth.uid()) and exists(select 1 from public.tickets t where t.id=ticket_id and private.has_workspace_role(t.workspace_id,array['superadmin','admin','pm','dev','qa']::public.app_role[]))
);
drop policy if exists ticket_comments_update on public.ticket_comments;
create policy ticket_comments_update on public.ticket_comments for update to authenticated
using(author_id=(select auth.uid()) and exists(select 1 from public.tickets t where t.id=ticket_id and private.has_workspace_role(t.workspace_id,array['superadmin','admin','pm','dev','qa']::public.app_role[])))
with check(author_id=(select auth.uid()) and exists(select 1 from public.tickets t where t.id=ticket_id and private.has_workspace_role(t.workspace_id,array['superadmin','admin','pm','dev','qa']::public.app_role[])));
drop policy if exists ticket_comments_delete on public.ticket_comments;
create policy ticket_comments_delete on public.ticket_comments for delete to authenticated using(
  (author_id=(select auth.uid()) and exists(select 1 from public.tickets t where t.id=ticket_id and private.has_workspace_role(t.workspace_id,array['superadmin','admin','pm','dev','qa']::public.app_role[])))
  or exists(select 1 from public.tickets t where t.id=ticket_id and private.has_workspace_role(t.workspace_id,array['superadmin','admin','pm']::public.app_role[]))
);

-- Sprint comments
drop policy if exists sprint_comments_select on public.sprint_comments;
create policy sprint_comments_select on public.sprint_comments for select to authenticated using(
  exists(select 1 from public.sprints s where s.id=sprint_id and private.has_workspace_role(s.workspace_id,array['superadmin','admin','pm','dev','qa','viewer']::public.app_role[]))
);
drop policy if exists sprint_comments_insert on public.sprint_comments;
create policy sprint_comments_insert on public.sprint_comments for insert to authenticated with check(
  author_id=(select auth.uid()) and exists(select 1 from public.sprints s where s.id=sprint_id and private.has_workspace_role(s.workspace_id,array['superadmin','admin','pm','dev','qa']::public.app_role[]))
);
drop policy if exists sprint_comments_update on public.sprint_comments;
create policy sprint_comments_update on public.sprint_comments for update to authenticated
using(author_id=(select auth.uid()) and exists(select 1 from public.sprints s where s.id=sprint_id and private.has_workspace_role(s.workspace_id,array['superadmin','admin','pm','dev','qa']::public.app_role[])))
with check(author_id=(select auth.uid()) and exists(select 1 from public.sprints s where s.id=sprint_id and private.has_workspace_role(s.workspace_id,array['superadmin','admin','pm','dev','qa']::public.app_role[])));
drop policy if exists sprint_comments_delete on public.sprint_comments;
create policy sprint_comments_delete on public.sprint_comments for delete to authenticated using(
  (author_id=(select auth.uid()) and exists(select 1 from public.sprints s where s.id=sprint_id and private.has_workspace_role(s.workspace_id,array['superadmin','admin','pm','dev','qa']::public.app_role[])))
  or exists(select 1 from public.sprints s where s.id=sprint_id and private.has_workspace_role(s.workspace_id,array['superadmin','admin','pm']::public.app_role[]))
);

-- -----------------------------------------------------------------------------
-- Responsables, actividad y notificaciones
-- -----------------------------------------------------------------------------
create or replace function private.validate_ticket_people()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='UPDATE' and new.reporter_id is distinct from old.reporter_id then raise exception 'reporter_id cannot be changed after ticket creation'; end if;
  if tg_op='INSERT' and new.reporter_id is not null and not exists(select 1 from public.workspace_members wm where wm.workspace_id=new.workspace_id and wm.user_id=new.reporter_id and wm.active=true) then
    raise exception 'Reporter must be an active member of the workspace';
  end if;
  if (tg_op='INSERT' or new.dev_owner_id is distinct from old.dev_owner_id) and new.dev_owner_id is not null and not exists(
    select 1 from public.workspace_members wm where wm.workspace_id=new.workspace_id and wm.user_id=new.dev_owner_id and wm.active=true and wm.role in ('superadmin','admin','pm','dev')
  ) then raise exception 'Development owner must be an active Superadmin, Admin, PM or Dev in the workspace'; end if;
  if (tg_op='INSERT' or new.qa_owner_id is distinct from old.qa_owner_id) and new.qa_owner_id is not null and not exists(
    select 1 from public.workspace_members wm where wm.workspace_id=new.workspace_id and wm.user_id=new.qa_owner_id and wm.active=true and wm.role in ('superadmin','admin','pm','qa')
  ) then raise exception 'QA owner must be an active Superadmin, Admin, PM or QA in the workspace'; end if;
  return new;
end $$;
revoke all on function private.validate_ticket_people() from public,anon,authenticated;

create or replace function private.track_ticket_change()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_in_app boolean:=true; v_email boolean:=true;
begin
  select coalesce(ws.in_app_notifications,true),coalesce(ws.email_notifications,true) into v_in_app,v_email from public.workspace_settings ws where ws.workspace_id=new.workspace_id;
  if not found then v_in_app:=true; v_email:=true; end if;
  if old.status is distinct from new.status then
    if new.status='in_progress' and new.start_date is null then new.start_date:=current_date; end if;
    if new.status='dev_done' and new.dev_completed_at is null then new.dev_completed_at:=now(); end if;
    if new.status='qa_passed' and new.qa_completed_at is null then new.qa_completed_at:=now(); end if;
    if new.status='closed' and new.closed_at is null then new.closed_at:=now(); end if;
    insert into public.ticket_activity(ticket_id,actor_id,action,from_value,to_value) values(new.id,auth.uid(),'status_changed',old.status::text,new.status::text);
    if v_in_app and new.reporter_id is not null and new.reporter_id is distinct from auth.uid() then
      insert into public.notifications(workspace_id,user_id,ticket_id,type,title,body)
      values(new.workspace_id,new.reporter_id,new.id,'ticket_status',new.ticket_key||' actualizado','El estado cambió de '||old.status::text||' a '||new.status::text||'.');
    end if;
    if new.status='qa_rejected' and new.dev_owner_id is not null then
      if v_email then insert into public.notification_outbox(workspace_id,ticket_id,recipient_user_id,event_type,payload)
        values(new.workspace_id,new.id,new.dev_owner_id,'qa_rejected',jsonb_build_object('ticket_key',new.ticket_key,'title',new.title,'status',new.status)); end if;
      if v_in_app and new.dev_owner_id is distinct from auth.uid() then insert into public.notifications(workspace_id,user_id,ticket_id,type,title,body)
        values(new.workspace_id,new.dev_owner_id,new.id,'qa_rejected',new.ticket_key||' regresado por QA','Requiere correcciones antes de volver a revisión.'); end if;
    end if;
  end if;
  if old.dev_owner_id is distinct from new.dev_owner_id and new.dev_owner_id is not null then
    if v_email then insert into public.notification_outbox(workspace_id,ticket_id,recipient_user_id,event_type,payload)
      values(new.workspace_id,new.id,new.dev_owner_id,'assigned_dev',jsonb_build_object('ticket_key',new.ticket_key,'title',new.title)); end if;
    if v_in_app and new.dev_owner_id is distinct from auth.uid() then insert into public.notifications(workspace_id,user_id,ticket_id,type,title,body)
      values(new.workspace_id,new.dev_owner_id,new.id,'assigned_dev','Ticket asignado '||new.ticket_key,new.title); end if;
  end if;
  if old.qa_owner_id is distinct from new.qa_owner_id and new.qa_owner_id is not null then
    if v_email then insert into public.notification_outbox(workspace_id,ticket_id,recipient_user_id,event_type,payload)
      values(new.workspace_id,new.id,new.qa_owner_id,'assigned_qa',jsonb_build_object('ticket_key',new.ticket_key,'title',new.title)); end if;
    if v_in_app and new.qa_owner_id is distinct from auth.uid() then insert into public.notifications(workspace_id,user_id,ticket_id,type,title,body)
      values(new.workspace_id,new.qa_owner_id,new.id,'assigned_qa','Ticket asignado a QA '||new.ticket_key,new.title); end if;
  end if;
  return new;
end $$;
revoke all on function private.track_ticket_change() from public,anon,authenticated;

create or replace function private.notify_ticket_created()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_in_app boolean:=true; v_email boolean:=true;
begin
  select coalesce(ws.in_app_notifications,true),coalesce(ws.email_notifications,true) into v_in_app,v_email from public.workspace_settings ws where ws.workspace_id=new.workspace_id;
  if not found then v_in_app:=true; v_email:=true; end if;
  if v_email then
    insert into public.notification_outbox(workspace_id,ticket_id,recipient_user_id,event_type,payload)
    select new.workspace_id,new.id,wm.user_id,'ticket_created',jsonb_build_object('ticket_key',new.ticket_key,'title',new.title,'product_id',new.product_id)
    from public.workspace_members wm where wm.workspace_id=new.workspace_id and wm.active=true and wm.role in ('superadmin','admin','pm') and wm.user_id is distinct from new.reporter_id;
    if new.dev_owner_id is not null then insert into public.notification_outbox(workspace_id,ticket_id,recipient_user_id,event_type,payload)
      values(new.workspace_id,new.id,new.dev_owner_id,'assigned_dev',jsonb_build_object('ticket_key',new.ticket_key,'title',new.title)); end if;
    if new.qa_owner_id is not null then insert into public.notification_outbox(workspace_id,ticket_id,recipient_user_id,event_type,payload)
      values(new.workspace_id,new.id,new.qa_owner_id,'assigned_qa',jsonb_build_object('ticket_key',new.ticket_key,'title',new.title)); end if;
  end if;
  if v_in_app then
    if new.reporter_id is not null then insert into public.notifications(workspace_id,user_id,ticket_id,type,title,body)
      values(new.workspace_id,new.reporter_id,new.id,'ticket_created','Ticket creado '||new.ticket_key,new.title); end if;
    insert into public.notifications(workspace_id,user_id,ticket_id,type,title,body)
    select distinct new.workspace_id,x.user_id,new.id,x.notification_type,x.notification_title,x.notification_body from (
      select wm.user_id,'ticket_created'::text notification_type,('Nuevo ticket '||new.ticket_key)::text notification_title,new.title::text notification_body
      from public.workspace_members wm where wm.workspace_id=new.workspace_id and wm.active=true and wm.role in ('superadmin','admin','pm') and wm.user_id is distinct from new.reporter_id
      union all select new.dev_owner_id,'assigned_dev','Ticket asignado '||new.ticket_key,new.title where new.dev_owner_id is not null and new.dev_owner_id is distinct from new.reporter_id
      union all select new.qa_owner_id,'assigned_qa','Ticket asignado a QA '||new.ticket_key,new.title where new.qa_owner_id is not null and new.qa_owner_id is distinct from new.reporter_id
    ) x where x.user_id is not null;
  end if;
  return new;
end $$;
revoke all on function private.notify_ticket_created() from public,anon,authenticated;

-- -----------------------------------------------------------------------------
-- Backlog / cierre de Sprint
-- -----------------------------------------------------------------------------
create or replace function public.close_sprint_and_rollover(p_sprint_id uuid,p_next_sprint_id uuid default null)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_workspace uuid; v_moved integer:=0;
begin
  select workspace_id into v_workspace from public.sprints where id=p_sprint_id;
  if v_workspace is null then raise exception 'Sprint not found'; end if;
  if not private.has_workspace_role(v_workspace,array['superadmin','admin','pm']::public.app_role[]) then raise exception 'You do not have permission to close this sprint'; end if;
  if p_next_sprint_id is not null then
    if p_next_sprint_id=p_sprint_id then raise exception 'Next sprint must be different'; end if;
    if not exists(select 1 from public.sprints where id=p_next_sprint_id and workspace_id=v_workspace) then raise exception 'Next sprint must belong to the same workspace'; end if;
    update public.tickets set sprint_id=p_next_sprint_id where sprint_id=p_sprint_id and status not in ('qa_passed','closed');
    get diagnostics v_moved=row_count;
    update public.sprints set status='active' where id=p_next_sprint_id and status='planned';
  else
    update public.tickets set sprint_id=null,status='backlog' where sprint_id=p_sprint_id and status not in ('qa_passed','closed');
    get diagnostics v_moved=row_count;
  end if;
  update public.sprints set status='completed' where id=p_sprint_id;
  return jsonb_build_object('ok',true,'moved',v_moved,'source_sprint_id',p_sprint_id,'next_sprint_id',p_next_sprint_id);
end $$;
revoke all on function public.close_sprint_and_rollover(uuid,uuid) from public,anon;
grant execute on function public.close_sprint_and_rollover(uuid,uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Helpdesk portal / mesa de atención
-- -----------------------------------------------------------------------------
create or replace function private.normalize_helpdesk_insert()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_staff boolean;
begin
  select private.has_workspace_role(new.workspace_id,array['superadmin','admin','pm','dev','qa']::public.app_role[]) into v_staff;
  if not coalesce(v_staff,false) then
    new.requester_user_id:=auth.uid(); new.status:='created'; new.assigned_to:=null; new.due_at:=null; new.source:='portal';
  end if;
  return new;
end $$;
revoke all on function private.normalize_helpdesk_insert() from public,anon,authenticated;
drop trigger if exists trg_00_normalize_helpdesk_insert on public.helpdesk_tickets;
create trigger trg_00_normalize_helpdesk_insert before insert on public.helpdesk_tickets for each row execute function private.normalize_helpdesk_insert();

create or replace function private.validate_helpdesk_people()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='UPDATE' and new.requester_user_id is distinct from old.requester_user_id then raise exception 'requester_user_id cannot be changed after request creation'; end if;
  if tg_op='INSERT' and new.requester_user_id is not null and not exists(select 1 from public.workspace_members wm where wm.workspace_id=new.workspace_id and wm.user_id=new.requester_user_id and wm.active=true) then raise exception 'Requester must be an active member of the workspace'; end if;
  if (tg_op='INSERT' or new.assigned_to is distinct from old.assigned_to) and new.assigned_to is not null and not exists(
    select 1 from public.workspace_members wm where wm.workspace_id=new.workspace_id and wm.user_id=new.assigned_to and wm.active=true and wm.role in ('superadmin','admin','pm','dev','qa')
  ) then raise exception 'Helpdesk assignee must be an active staff member of the workspace'; end if;
  return new;
end $$;
revoke all on function private.validate_helpdesk_people() from public,anon,authenticated;

create or replace function private.guard_helpdesk_requester_update()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_staff boolean;
begin
  select private.has_workspace_role(old.workspace_id,array['superadmin','admin','pm','dev','qa']::public.app_role[]) into v_staff;
  if v_staff then return new; end if;
  if old.requester_user_id is distinct from auth.uid() then raise exception 'You cannot update this Helpdesk request'; end if;
  if new.workspace_id is distinct from old.workspace_id or new.requester_user_id is distinct from old.requester_user_id or new.assigned_to is distinct from old.assigned_to or new.status is distinct from old.status or new.due_at is distinct from old.due_at or new.first_response_at is distinct from old.first_response_at or new.reviewed_at is distinct from old.reviewed_at or new.attended_at is distinct from old.attended_at or new.resolved_at is distinct from old.resolved_at or new.closed_at is distinct from old.closed_at then
    raise exception 'Requesters cannot change internal Helpdesk handling fields';
  end if;
  return new;
end $$;
revoke all on function private.guard_helpdesk_requester_update() from public,anon,authenticated;

create or replace function private.track_helpdesk_change()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_in_app boolean:=true;
begin
  select coalesce(ws.in_app_notifications,true) into v_in_app from public.workspace_settings ws where ws.workspace_id=new.workspace_id;
  if not found then v_in_app:=true; end if;
  if old.status is distinct from new.status then
    if new.status='review' and new.reviewed_at is null then new.reviewed_at:=now(); new.first_response_at:=coalesce(new.first_response_at,now()); end if;
    if new.status='attended' and new.attended_at is null then new.attended_at:=now(); new.first_response_at:=coalesce(new.first_response_at,now()); end if;
    if new.status='resolved' and new.resolved_at is null then new.resolved_at:=now(); end if;
    if new.status='closed' and new.closed_at is null then new.closed_at:=now(); end if;
    insert into public.helpdesk_activity(helpdesk_ticket_id,actor_id,action,from_value,to_value) values(new.id,auth.uid(),'status_changed',old.status,new.status);
    if v_in_app and new.requester_user_id is not null and new.requester_user_id is distinct from auth.uid() then
      insert into public.notifications(workspace_id,user_id,helpdesk_ticket_id,type,title,body)
      values(new.workspace_id,new.requester_user_id,new.id,'helpdesk_status',new.ticket_key||' actualizado','El estado de tu solicitud cambió a '||case new.status when 'created' then 'Creado' when 'review' then 'En revisión' when 'attended' then 'Atendido' when 'resolved' then 'Resuelto' when 'closed' then 'Cerrado' else new.status end||'.');
    end if;
  end if;
  if old.assigned_to is distinct from new.assigned_to and new.assigned_to is not null then
    insert into public.helpdesk_activity(helpdesk_ticket_id,actor_id,action,from_value,to_value) values(new.id,auth.uid(),'assigned',old.assigned_to::text,new.assigned_to::text);
    if v_in_app and new.assigned_to is distinct from auth.uid() then insert into public.notifications(workspace_id,user_id,helpdesk_ticket_id,type,title,body) values(new.workspace_id,new.assigned_to,new.id,'helpdesk_assigned',new.ticket_key||' asignado',new.subject); end if;
  end if;
  return new;
end $$;
revoke all on function private.track_helpdesk_change() from public,anon,authenticated;

create or replace function private.helpdesk_created()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_in_app boolean:=true;
begin
  select coalesce(ws.in_app_notifications,true) into v_in_app from public.workspace_settings ws where ws.workspace_id=new.workspace_id;
  if not found then v_in_app:=true; end if;
  insert into public.helpdesk_activity(helpdesk_ticket_id,actor_id,action,to_value) values(new.id,auth.uid(),'created',new.status);
  if v_in_app then
    if new.requester_user_id is not null then insert into public.notifications(workspace_id,user_id,helpdesk_ticket_id,type,title,body) values(new.workspace_id,new.requester_user_id,new.id,'helpdesk_created','Solicitud creada '||new.ticket_key,new.subject); end if;
    insert into public.notifications(workspace_id,user_id,helpdesk_ticket_id,type,title,body)
    select new.workspace_id,wm.user_id,new.id,'helpdesk_new','Nueva solicitud '||new.ticket_key,new.subject from public.workspace_members wm
    where wm.workspace_id=new.workspace_id and wm.active=true and wm.role in ('superadmin','admin','pm','dev','qa') and wm.user_id is distinct from new.requester_user_id;
    if new.assigned_to is not null and new.assigned_to is distinct from new.requester_user_id then insert into public.notifications(workspace_id,user_id,helpdesk_ticket_id,type,title,body) values(new.workspace_id,new.assigned_to,new.id,'helpdesk_assigned',new.ticket_key||' asignado',new.subject); end if;
  end if;
  return new;
end $$;
revoke all on function private.helpdesk_created() from public,anon,authenticated;

drop policy if exists helpdesk_tickets_select on public.helpdesk_tickets;
create policy helpdesk_tickets_select on public.helpdesk_tickets for select to authenticated using(
  private.has_workspace_role(workspace_id,array['superadmin','admin','pm','dev','qa']::public.app_role[])
  or (requester_user_id=(select auth.uid()) and private.is_workspace_member(workspace_id))
);
drop policy if exists helpdesk_tickets_insert on public.helpdesk_tickets;
create policy helpdesk_tickets_insert on public.helpdesk_tickets for insert to authenticated with check(
  private.is_workspace_member(workspace_id)
  and coalesce((select ws.helpdesk_enabled from public.workspace_settings ws where ws.workspace_id=helpdesk_tickets.workspace_id),true)
  and (
    private.has_workspace_role(workspace_id,array['superadmin','admin','pm','dev','qa']::public.app_role[])
    or (requester_user_id=(select auth.uid()) and status='created' and assigned_to is null and source='portal')
  )
);
drop policy if exists helpdesk_tickets_update on public.helpdesk_tickets;
create policy helpdesk_tickets_update on public.helpdesk_tickets for update to authenticated
using(private.has_workspace_role(workspace_id,array['superadmin','admin','pm','dev','qa']::public.app_role[]))
with check(private.has_workspace_role(workspace_id,array['superadmin','admin','pm','dev','qa']::public.app_role[]));
drop policy if exists helpdesk_tickets_delete on public.helpdesk_tickets;
create policy helpdesk_tickets_delete on public.helpdesk_tickets for delete to authenticated
using(private.has_workspace_role(workspace_id,array['superadmin','admin','pm']::public.app_role[]));

drop policy if exists helpdesk_comments_select on public.helpdesk_comments;
create policy helpdesk_comments_select on public.helpdesk_comments for select to authenticated using(
  exists(select 1 from public.helpdesk_tickets h where h.id=helpdesk_ticket_id and private.is_workspace_member(h.workspace_id) and (private.has_workspace_role(h.workspace_id,array['superadmin','admin','pm','dev','qa']::public.app_role[]) or h.requester_user_id=(select auth.uid())))
);
drop policy if exists helpdesk_comments_insert on public.helpdesk_comments;
create policy helpdesk_comments_insert on public.helpdesk_comments for insert to authenticated with check(
  author_id=(select auth.uid()) and exists(select 1 from public.helpdesk_tickets h where h.id=helpdesk_ticket_id and private.is_workspace_member(h.workspace_id) and (private.has_workspace_role(h.workspace_id,array['superadmin','admin','pm','dev','qa']::public.app_role[]) or h.requester_user_id=(select auth.uid())))
);
drop policy if exists helpdesk_comments_update on public.helpdesk_comments;
create policy helpdesk_comments_update on public.helpdesk_comments for update to authenticated
using(author_id=(select auth.uid()) and exists(select 1 from public.helpdesk_tickets h where h.id=helpdesk_ticket_id and private.is_workspace_member(h.workspace_id) and (private.has_workspace_role(h.workspace_id,array['superadmin','admin','pm','dev','qa']::public.app_role[]) or h.requester_user_id=(select auth.uid()))))
with check(author_id=(select auth.uid()) and exists(select 1 from public.helpdesk_tickets h where h.id=helpdesk_ticket_id and private.is_workspace_member(h.workspace_id) and (private.has_workspace_role(h.workspace_id,array['superadmin','admin','pm','dev','qa']::public.app_role[]) or h.requester_user_id=(select auth.uid()))));
drop policy if exists helpdesk_comments_delete on public.helpdesk_comments;
create policy helpdesk_comments_delete on public.helpdesk_comments for delete to authenticated using(
  author_id=(select auth.uid()) and exists(select 1 from public.helpdesk_tickets h where h.id=helpdesk_ticket_id and private.is_workspace_member(h.workspace_id) and (private.has_workspace_role(h.workspace_id,array['superadmin','admin','pm','dev','qa']::public.app_role[]) or h.requester_user_id=(select auth.uid())))
);
drop policy if exists helpdesk_activity_select on public.helpdesk_activity;
create policy helpdesk_activity_select on public.helpdesk_activity for select to authenticated using(
  exists(select 1 from public.helpdesk_tickets h where h.id=helpdesk_ticket_id and private.is_workspace_member(h.workspace_id) and (private.has_workspace_role(h.workspace_id,array['superadmin','admin','pm','dev','qa']::public.app_role[]) or h.requester_user_id=(select auth.uid())))
);

drop view if exists public.helpdesk_dashboard_stats;
create view public.helpdesk_dashboard_stats with(security_invoker=true) as
select h.workspace_id,
  count(*) total,
  count(*) filter(where h.status='created') created_count,
  count(*) filter(where h.status='review') review_count,
  count(*) filter(where h.status='attended') attended_count,
  count(*) filter(where h.status in ('created','review','attended')) open_count,
  count(*) filter(where h.status='resolved') resolved_count,
  count(*) filter(where h.status='closed') closed_count,
  count(*) filter(where h.resolved_at is not null and h.due_at is not null and h.resolved_at<=h.due_at) resolved_within_sla
from public.helpdesk_tickets h group by h.workspace_id;
grant select on public.helpdesk_dashboard_stats to authenticated;

-- -----------------------------------------------------------------------------
-- Evidencia privada en Storage
-- -----------------------------------------------------------------------------
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('jira-evidence','jira-evidence',false,10485760,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create or replace function private.can_view_evidence_object(p_name text)
returns boolean language plpgsql stable security definer set search_path=public,storage,pg_temp as $$
declare v_workspace uuid; v_parent uuid; v_scope text;
begin
  v_workspace:=split_part(p_name,'/',1)::uuid; v_scope:=split_part(p_name,'/',2); v_parent:=split_part(p_name,'/',3)::uuid;
  if v_scope='tickets' then
    return exists(select 1 from public.tickets t where t.id=v_parent and t.workspace_id=v_workspace and (
      private.has_workspace_role(v_workspace,array['superadmin','admin','pm','dev','qa','viewer']::public.app_role[])
      or (private.has_workspace_role(v_workspace,array['reporter']::public.app_role[]) and t.reporter_id=(select auth.uid()))
    ));
  elsif v_scope='sprints' then
    return exists(select 1 from public.sprints s where s.id=v_parent and s.workspace_id=v_workspace and private.has_workspace_role(v_workspace,array['superadmin','admin','pm','dev','qa','viewer']::public.app_role[]));
  end if;
  return false;
exception when invalid_text_representation then return false;
end $$;

create or replace function private.can_upload_evidence_object(p_name text)
returns boolean language plpgsql stable security definer set search_path=public,storage,pg_temp as $$
declare v_workspace uuid; v_parent uuid; v_scope text;
begin
  v_workspace:=split_part(p_name,'/',1)::uuid; v_scope:=split_part(p_name,'/',2); v_parent:=split_part(p_name,'/',3)::uuid;
  if not private.has_workspace_role(v_workspace,array['superadmin','admin','pm','dev','qa']::public.app_role[]) then return false; end if;
  if v_scope='tickets' then return exists(select 1 from public.tickets t where t.id=v_parent and t.workspace_id=v_workspace);
  elsif v_scope='sprints' then return exists(select 1 from public.sprints s where s.id=v_parent and s.workspace_id=v_workspace);
  end if;
  return false;
exception when invalid_text_representation then return false;
end $$;

create or replace function private.can_manage_evidence_object(p_name text)
returns boolean language plpgsql stable security definer set search_path=public,storage,pg_temp as $$
declare v_workspace uuid;
begin
  v_workspace:=split_part(p_name,'/',1)::uuid;
  return private.has_workspace_role(v_workspace,array['superadmin','admin','pm']::public.app_role[]);
exception when invalid_text_representation then return false;
end $$;

revoke all on function private.can_view_evidence_object(text) from public,anon;
revoke all on function private.can_upload_evidence_object(text) from public,anon;
revoke all on function private.can_manage_evidence_object(text) from public,anon;
grant execute on function private.can_view_evidence_object(text) to authenticated;
grant execute on function private.can_upload_evidence_object(text) to authenticated;
grant execute on function private.can_manage_evidence_object(text) to authenticated;

drop policy if exists ticket_attachments_select on public.ticket_attachments;
create policy ticket_attachments_select on public.ticket_attachments for select to authenticated using(
  exists(select 1 from public.tickets t where t.id=ticket_id and t.workspace_id=ticket_attachments.workspace_id and (
    private.has_workspace_role(t.workspace_id,array['superadmin','admin','pm','dev','qa','viewer']::public.app_role[])
    or (private.has_workspace_role(t.workspace_id,array['reporter']::public.app_role[]) and t.reporter_id=(select auth.uid()))
  ))
);
drop policy if exists ticket_attachments_insert on public.ticket_attachments;
create policy ticket_attachments_insert on public.ticket_attachments for insert to authenticated with check(
  uploaded_by=(select auth.uid())
  and exists(select 1 from public.tickets t where t.id=ticket_id and t.workspace_id=ticket_attachments.workspace_id and private.has_workspace_role(t.workspace_id,array['superadmin','admin','pm','dev','qa']::public.app_role[]))
  and (comment_id is null or exists(select 1 from public.ticket_comments c where c.id=comment_id and c.ticket_id=ticket_id))
);
drop policy if exists ticket_attachments_delete on public.ticket_attachments;
create policy ticket_attachments_delete on public.ticket_attachments for delete to authenticated using(
  uploaded_by=(select auth.uid()) or private.has_workspace_role(workspace_id,array['superadmin','admin','pm']::public.app_role[])
);

drop policy if exists sprint_attachments_select on public.sprint_attachments;
create policy sprint_attachments_select on public.sprint_attachments for select to authenticated
using(private.has_workspace_role(workspace_id,array['superadmin','admin','pm','dev','qa','viewer']::public.app_role[]));
drop policy if exists sprint_attachments_insert on public.sprint_attachments;
create policy sprint_attachments_insert on public.sprint_attachments for insert to authenticated with check(
  uploaded_by=(select auth.uid()) and private.has_workspace_role(workspace_id,array['superadmin','admin','pm','dev','qa']::public.app_role[])
  and exists(select 1 from public.sprints s where s.id=sprint_id and s.workspace_id=sprint_attachments.workspace_id)
  and (comment_id is null or exists(select 1 from public.sprint_comments c where c.id=comment_id and c.sprint_id=sprint_id))
);
drop policy if exists sprint_attachments_delete on public.sprint_attachments;
create policy sprint_attachments_delete on public.sprint_attachments for delete to authenticated using(
  uploaded_by=(select auth.uid()) or private.has_workspace_role(workspace_id,array['superadmin','admin','pm']::public.app_role[])
);

drop policy if exists jira_evidence_select on storage.objects;
create policy jira_evidence_select on storage.objects for select to authenticated
using(bucket_id='jira-evidence' and private.can_view_evidence_object(name));
drop policy if exists jira_evidence_insert on storage.objects;
create policy jira_evidence_insert on storage.objects for insert to authenticated
with check(bucket_id='jira-evidence' and private.can_upload_evidence_object(name));
drop policy if exists jira_evidence_delete on storage.objects;
create policy jira_evidence_delete on storage.objects for delete to authenticated
using(bucket_id='jira-evidence' and (owner=(select auth.uid()) or private.can_manage_evidence_object(name)));
-- =============================
-- v12 Staff/Roles + product scope
-- =============================
-- Jira Interno TROBBU v12 — paso 2 de 2
-- Requiere haber ejecutado/confirmado upgrade-v12-enum.sql.
-- Staff/Roles por workspace + producto, permisos efectivos y aislamiento RLS.

alter table public.workspace_members
  add column if not exists permissions jsonb not null default '{}'::jsonb,
  add column if not exists all_products boolean not null default false;

update public.workspace_members
set role='consulta'
where role in ('reporter','viewer');

-- Conserva el alcance actual durante el upgrade. Staff puede acotarlo después.
update public.workspace_members
set all_products=true
where active=true;

create table if not exists public.workspace_member_products (
  workspace_id uuid not null,
  user_id uuid not null,
  product_id uuid not null,
  created_at timestamptz not null default now(),
  primary key(workspace_id,user_id,product_id),
  constraint workspace_member_products_member_fkey
    foreign key(workspace_id,user_id)
    references public.workspace_members(workspace_id,user_id)
    on delete cascade,
  constraint workspace_member_products_product_fkey
    foreign key(product_id,workspace_id)
    references public.products(id,workspace_id)
    on delete cascade
);
create index if not exists idx_workspace_member_products_user
  on public.workspace_member_products(user_id,workspace_id);
create index if not exists idx_workspace_member_products_product
  on public.workspace_member_products(product_id,workspace_id);

alter table public.workspace_member_products enable row level security;
grant select,insert,delete on public.workspace_member_products to authenticated;

create or replace function private.role_default_permission(p_role public.app_role,p_permission text)
returns boolean
language sql
immutable
security invoker
set search_path=public,pg_temp
as $$
  select case
    when p_role='superadmin' then true
    when p_role='admin' then p_permission in (
      'view_dashboard','view_tickets','create_tickets','edit_tickets','delete_tickets',
      'manage_sprints','qa_review','manage_helpdesk','manage_staff','manage_products','manage_settings'
    )
    when p_role='pm' then p_permission in (
      'view_dashboard','view_tickets','create_tickets','edit_tickets','delete_tickets',
      'manage_sprints','qa_review','manage_helpdesk'
    )
    when p_role='dev' then p_permission in (
      'view_dashboard','view_tickets','create_tickets','edit_tickets'
    )
    when p_role='qa' then p_permission in (
      'view_dashboard','view_tickets','create_tickets','edit_tickets','qa_review'
    )
    when p_role='consulta' then p_permission in ('view_dashboard','view_tickets')
    else false
  end;
$$;

create or replace function private.member_has_permission(p_workspace uuid,p_user uuid,p_permission text)
returns boolean
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select coalesce((
    select case
      when wm.role='superadmin' then true
      when jsonb_typeof(wm.permissions -> p_permission)='boolean'
        then (wm.permissions ->> p_permission)::boolean
      else private.role_default_permission(wm.role,p_permission)
    end
    from public.workspace_members wm
    where wm.workspace_id=p_workspace
      and wm.user_id=p_user
      and wm.active=true
  ),false);
$$;

create or replace function private.has_workspace_permission(p_workspace uuid,p_permission text)
returns boolean
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select private.member_has_permission(p_workspace,(select auth.uid()),p_permission);
$$;

create or replace function private.member_has_product_access(p_workspace uuid,p_user uuid,p_product uuid)
returns boolean
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select coalesce((
    select case
      when wm.role in ('superadmin','admin') then true
      when wm.all_products then true
      else exists(
        select 1 from public.workspace_member_products mp
        where mp.workspace_id=p_workspace
          and mp.user_id=p_user
          and mp.product_id=p_product
      )
    end
    from public.workspace_members wm
    where wm.workspace_id=p_workspace
      and wm.user_id=p_user
      and wm.active=true
  ),false);
$$;

create or replace function private.has_product_access(p_workspace uuid,p_product uuid)
returns boolean
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select private.member_has_product_access(p_workspace,(select auth.uid()),p_product);
$$;

revoke all on function private.role_default_permission(public.app_role,text) from public,anon;
revoke all on function private.member_has_permission(uuid,uuid,text) from public,anon;
revoke all on function private.has_workspace_permission(uuid,text) from public,anon;
revoke all on function private.member_has_product_access(uuid,uuid,uuid) from public,anon;
revoke all on function private.has_product_access(uuid,uuid) from public,anon;
grant execute on function private.role_default_permission(public.app_role,text) to authenticated;
grant execute on function private.member_has_permission(uuid,uuid,text) to authenticated;
grant execute on function private.has_workspace_permission(uuid,text) to authenticated;
grant execute on function private.member_has_product_access(uuid,uuid,uuid) to authenticated;
grant execute on function private.has_product_access(uuid,uuid) to authenticated;

create or replace function private.guard_workspace_membership()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_caller uuid := auth.uid();
  v_super boolean := false;
  v_staff boolean := false;
  v_supers integer;
begin
  if tg_op='DELETE' and not exists(select 1 from public.workspaces w where w.id=old.workspace_id) then
    return old;
  end if;

  if v_caller is null then
    if tg_op='UPDATE' and (
      new.workspace_id is distinct from old.workspace_id
      or new.user_id is distinct from old.user_id
    ) then
      raise exception 'Membership workspace/user cannot be reassigned';
    end if;
    if tg_op<>'DELETE' and new.role in ('superadmin','admin') then new.all_products:=true; end if;
    if tg_op='DELETE' then return old; end if;
    return new;
  end if;

  if tg_op='INSERT' then
    v_super := private.has_workspace_role(new.workspace_id,array['superadmin']::public.app_role[]);
    v_staff := private.has_workspace_permission(new.workspace_id,'manage_staff');
    if new.role='superadmin' and not v_super then
      if not (
        new.user_id=v_caller
        and exists(select 1 from public.workspaces w where w.id=new.workspace_id and w.created_by=v_caller)
      ) then
        raise exception 'Only a Superadmin can grant the Superadmin role';
      end if;
    elsif not v_staff and new.user_id is distinct from v_caller then
      raise exception 'You do not have permission to manage Staff';
    end if;
    if new.role in ('superadmin','admin') then new.all_products:=true; end if;
    return new;
  end if;

  if tg_op='UPDATE' and (
    new.workspace_id is distinct from old.workspace_id
    or new.user_id is distinct from old.user_id
  ) then
    raise exception 'Membership workspace/user cannot be reassigned';
  end if;

  v_super := private.has_workspace_role(old.workspace_id,array['superadmin']::public.app_role[]);
  v_staff := private.has_workspace_permission(old.workspace_id,'manage_staff');

  if old.role='superadmin' and not v_super then
    raise exception 'Only a Superadmin can modify another Superadmin';
  end if;
  if not v_staff and not v_super then
    raise exception 'You do not have permission to manage Staff';
  end if;
  if new.role='superadmin' and old.role<>'superadmin' and not v_super then
    raise exception 'Only a Superadmin can grant the Superadmin role';
  end if;

  if old.role='superadmin' and (
    tg_op='DELETE'
    or (tg_op='UPDATE' and (new.role<>'superadmin' or new.active=false))
  ) then
    select count(*) into v_supers
    from public.workspace_members wm
    where wm.workspace_id=old.workspace_id
      and wm.active=true
      and wm.role='superadmin'
      and wm.user_id<>old.user_id;
    if v_supers=0 then raise exception 'A workspace must keep at least one active Superadmin'; end if;
  end if;

  if tg_op<>'DELETE' and new.role in ('superadmin','admin') then new.all_products:=true; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end
$$;

-- Producto/rol por usuario.
drop policy if exists member_products_select on public.workspace_member_products;
create policy member_products_select on public.workspace_member_products
for select to authenticated
using (user_id=(select auth.uid()) or private.has_workspace_permission(workspace_id,'manage_staff'));
drop policy if exists member_products_insert on public.workspace_member_products;
create policy member_products_insert on public.workspace_member_products
for insert to authenticated
with check (private.has_workspace_permission(workspace_id,'manage_staff'));
drop policy if exists member_products_delete on public.workspace_member_products;
create policy member_products_delete on public.workspace_member_products
for delete to authenticated
using (private.has_workspace_permission(workspace_id,'manage_staff'));

-- Workspace / Staff / settings.
drop policy if exists workspaces_update on public.workspaces;
create policy workspaces_update on public.workspaces
for update to authenticated
using (private.has_workspace_permission(id,'manage_settings'))
with check (private.has_workspace_permission(id,'manage_settings'));
drop policy if exists workspaces_delete on public.workspaces;
create policy workspaces_delete on public.workspaces
for delete to authenticated
using (private.has_workspace_role(id,array['superadmin']::public.app_role[]));

drop policy if exists members_insert on public.workspace_members;
create policy members_insert on public.workspace_members
for insert to authenticated with check (private.has_workspace_permission(workspace_id,'manage_staff'));
drop policy if exists members_update on public.workspace_members;
create policy members_update on public.workspace_members
for update to authenticated using (private.has_workspace_permission(workspace_id,'manage_staff'))
with check (private.has_workspace_permission(workspace_id,'manage_staff'));
drop policy if exists members_delete on public.workspace_members;
create policy members_delete on public.workspace_members
for delete to authenticated using (private.has_workspace_permission(workspace_id,'manage_staff'));

drop policy if exists workspace_settings_update on public.workspace_settings;
create policy workspace_settings_update on public.workspace_settings
for update to authenticated using (private.has_workspace_permission(workspace_id,'manage_settings'))
with check (private.has_workspace_permission(workspace_id,'manage_settings'));

drop policy if exists invites_manage on public.workspace_invites;
create policy invites_manage on public.workspace_invites
for all to authenticated using (private.has_workspace_permission(workspace_id,'manage_staff'))
with check (private.has_workspace_permission(workspace_id,'manage_staff'));

-- Productos.
drop policy if exists products_select on public.products;
create policy products_select on public.products
for select to authenticated
using (private.is_workspace_member(workspace_id) and private.has_product_access(workspace_id,id));
drop policy if exists products_insert on public.products;
create policy products_insert on public.products
for insert to authenticated with check (private.has_workspace_permission(workspace_id,'manage_products'));
drop policy if exists products_update on public.products;
create policy products_update on public.products
for update to authenticated using (private.has_workspace_permission(workspace_id,'manage_products'))
with check (private.has_workspace_permission(workspace_id,'manage_products'));
drop policy if exists products_delete on public.products;
create policy products_delete on public.products
for delete to authenticated using (private.has_workspace_permission(workspace_id,'manage_products'));

-- Sprints.
drop policy if exists sprints_select on public.sprints;
create policy sprints_select on public.sprints
for select to authenticated
using (private.is_workspace_member(workspace_id) and private.has_workspace_permission(workspace_id,'view_dashboard'));
drop policy if exists sprints_insert on public.sprints;
create policy sprints_insert on public.sprints
for insert to authenticated with check (private.has_workspace_permission(workspace_id,'manage_sprints'));
drop policy if exists sprints_update on public.sprints;
create policy sprints_update on public.sprints
for update to authenticated using (private.has_workspace_permission(workspace_id,'manage_sprints'))
with check (private.has_workspace_permission(workspace_id,'manage_sprints'));
drop policy if exists sprints_delete on public.sprints;
create policy sprints_delete on public.sprints
for delete to authenticated using (private.has_workspace_permission(workspace_id,'manage_sprints'));

-- Tickets por permiso + producto.
drop policy if exists tickets_select on public.tickets;
create policy tickets_select on public.tickets
for select to authenticated
using (private.has_workspace_permission(workspace_id,'view_tickets') and private.has_product_access(workspace_id,product_id));
drop policy if exists tickets_insert on public.tickets;
create policy tickets_insert on public.tickets
for insert to authenticated
with check (
  private.has_workspace_permission(workspace_id,'create_tickets')
  and private.has_product_access(workspace_id,product_id)
  and reporter_id=(select auth.uid())
  and (
    private.has_workspace_permission(workspace_id,'edit_tickets')
    or (
      status='backlog' and sprint_id is null and dev_owner_id is null and qa_owner_id is null
      and story_points is null and start_date is null and due_date is null
    )
  )
);
drop policy if exists tickets_update on public.tickets;
create policy tickets_update on public.tickets
for update to authenticated
using (private.has_workspace_permission(workspace_id,'edit_tickets') and private.has_product_access(workspace_id,product_id))
with check (private.has_workspace_permission(workspace_id,'edit_tickets') and private.has_product_access(workspace_id,product_id));
drop policy if exists tickets_delete on public.tickets;
create policy tickets_delete on public.tickets
for delete to authenticated
using (private.has_workspace_permission(workspace_id,'delete_tickets') and private.has_product_access(workspace_id,product_id));

-- Comentarios, actividad y evidencias de tickets.
drop policy if exists ticket_comments_select on public.ticket_comments;
create policy ticket_comments_select on public.ticket_comments for select to authenticated using (
  exists(select 1 from public.tickets t where t.id=ticket_id
    and private.has_workspace_permission(t.workspace_id,'view_tickets')
    and private.has_product_access(t.workspace_id,t.product_id))
);
drop policy if exists ticket_comments_insert on public.ticket_comments;
create policy ticket_comments_insert on public.ticket_comments for insert to authenticated with check (
  author_id=(select auth.uid()) and exists(select 1 from public.tickets t where t.id=ticket_id
    and private.has_workspace_permission(t.workspace_id,'edit_tickets')
    and private.has_product_access(t.workspace_id,t.product_id))
);
drop policy if exists ticket_comments_update on public.ticket_comments;
create policy ticket_comments_update on public.ticket_comments for update to authenticated using (
  author_id=(select auth.uid()) and exists(select 1 from public.tickets t where t.id=ticket_id
    and private.has_workspace_permission(t.workspace_id,'edit_tickets')
    and private.has_product_access(t.workspace_id,t.product_id))
) with check (
  author_id=(select auth.uid()) and exists(select 1 from public.tickets t where t.id=ticket_id
    and private.has_workspace_permission(t.workspace_id,'edit_tickets')
    and private.has_product_access(t.workspace_id,t.product_id))
);
drop policy if exists ticket_comments_delete on public.ticket_comments;
create policy ticket_comments_delete on public.ticket_comments for delete to authenticated using (
  exists(select 1 from public.tickets t where t.id=ticket_id
    and private.has_product_access(t.workspace_id,t.product_id)
    and ((author_id=(select auth.uid()) and private.has_workspace_permission(t.workspace_id,'edit_tickets'))
      or private.has_workspace_permission(t.workspace_id,'delete_tickets')))
);

drop policy if exists activity_select on public.ticket_activity;
create policy activity_select on public.ticket_activity for select to authenticated using (
  exists(select 1 from public.tickets t where t.id=ticket_id
    and private.has_workspace_permission(t.workspace_id,'view_tickets')
    and private.has_product_access(t.workspace_id,t.product_id))
);

drop policy if exists ticket_attachments_select on public.ticket_attachments;
create policy ticket_attachments_select on public.ticket_attachments for select to authenticated using (
  exists(select 1 from public.tickets t where t.id=ticket_id and t.workspace_id=ticket_attachments.workspace_id
    and private.has_workspace_permission(t.workspace_id,'view_tickets')
    and private.has_product_access(t.workspace_id,t.product_id))
);
drop policy if exists ticket_attachments_insert on public.ticket_attachments;
create policy ticket_attachments_insert on public.ticket_attachments for insert to authenticated with check (
  uploaded_by=(select auth.uid()) and exists(select 1 from public.tickets t where t.id=ticket_id and t.workspace_id=ticket_attachments.workspace_id
    and private.has_workspace_permission(t.workspace_id,'edit_tickets')
    and private.has_product_access(t.workspace_id,t.product_id))
);
drop policy if exists ticket_attachments_delete on public.ticket_attachments;
create policy ticket_attachments_delete on public.ticket_attachments for delete to authenticated using (
  exists(select 1 from public.tickets t where t.id=ticket_id and t.workspace_id=ticket_attachments.workspace_id
    and private.has_product_access(t.workspace_id,t.product_id)
    and (uploaded_by=(select auth.uid()) or private.has_workspace_permission(t.workspace_id,'delete_tickets')))
);

-- Colaboración de sprint.
drop policy if exists sprint_comments_select on public.sprint_comments;
create policy sprint_comments_select on public.sprint_comments for select to authenticated using (
  exists(select 1 from public.sprints s where s.id=sprint_id and private.has_workspace_permission(s.workspace_id,'view_dashboard'))
);
drop policy if exists sprint_comments_insert on public.sprint_comments;
create policy sprint_comments_insert on public.sprint_comments for insert to authenticated with check (
  author_id=(select auth.uid()) and exists(select 1 from public.sprints s where s.id=sprint_id and private.has_workspace_permission(s.workspace_id,'edit_tickets'))
);
drop policy if exists sprint_comments_update on public.sprint_comments;
create policy sprint_comments_update on public.sprint_comments for update to authenticated using (
  author_id=(select auth.uid()) and exists(select 1 from public.sprints s where s.id=sprint_id and private.has_workspace_permission(s.workspace_id,'edit_tickets'))
) with check (
  author_id=(select auth.uid()) and exists(select 1 from public.sprints s where s.id=sprint_id and private.has_workspace_permission(s.workspace_id,'edit_tickets'))
);
drop policy if exists sprint_comments_delete on public.sprint_comments;
create policy sprint_comments_delete on public.sprint_comments for delete to authenticated using (
  exists(select 1 from public.sprints s where s.id=sprint_id
    and ((author_id=(select auth.uid()) and private.has_workspace_permission(s.workspace_id,'edit_tickets'))
      or private.has_workspace_permission(s.workspace_id,'manage_sprints')))
);
drop policy if exists sprint_attachments_select on public.sprint_attachments;
create policy sprint_attachments_select on public.sprint_attachments for select to authenticated
using (private.has_workspace_permission(workspace_id,'view_dashboard'));
drop policy if exists sprint_attachments_insert on public.sprint_attachments;
create policy sprint_attachments_insert on public.sprint_attachments for insert to authenticated
with check (uploaded_by=(select auth.uid()) and private.has_workspace_permission(workspace_id,'edit_tickets'));
drop policy if exists sprint_attachments_delete on public.sprint_attachments;
create policy sprint_attachments_delete on public.sprint_attachments for delete to authenticated
using (uploaded_by=(select auth.uid()) or private.has_workspace_permission(workspace_id,'manage_sprints'));

-- Helpdesk por permiso efectivo o requester.
drop policy if exists helpdesk_tickets_select on public.helpdesk_tickets;
create policy helpdesk_tickets_select on public.helpdesk_tickets for select to authenticated using (
  private.has_workspace_permission(workspace_id,'manage_helpdesk')
  or (requester_user_id=(select auth.uid()) and private.is_workspace_member(workspace_id))
);
drop policy if exists helpdesk_tickets_insert on public.helpdesk_tickets;
create policy helpdesk_tickets_insert on public.helpdesk_tickets for insert to authenticated with check (
  private.is_workspace_member(workspace_id)
  and coalesce((select ws.helpdesk_enabled from public.workspace_settings ws where ws.workspace_id=helpdesk_tickets.workspace_id),true)
  and (private.has_workspace_permission(workspace_id,'manage_helpdesk')
    or (requester_user_id=(select auth.uid()) and status='created' and assigned_to is null and source='portal'))
);
drop policy if exists helpdesk_tickets_update on public.helpdesk_tickets;
create policy helpdesk_tickets_update on public.helpdesk_tickets for update to authenticated
using (private.has_workspace_permission(workspace_id,'manage_helpdesk'))
with check (private.has_workspace_permission(workspace_id,'manage_helpdesk'));
drop policy if exists helpdesk_tickets_delete on public.helpdesk_tickets;
create policy helpdesk_tickets_delete on public.helpdesk_tickets for delete to authenticated
using (private.has_workspace_permission(workspace_id,'manage_helpdesk'));

-- Mismo predicado para comentarios/actividad de Helpdesk.
drop policy if exists helpdesk_comments_select on public.helpdesk_comments;
create policy helpdesk_comments_select on public.helpdesk_comments for select to authenticated using (
  exists(select 1 from public.helpdesk_tickets h where h.id=helpdesk_ticket_id and private.is_workspace_member(h.workspace_id)
    and (private.has_workspace_permission(h.workspace_id,'manage_helpdesk') or h.requester_user_id=(select auth.uid())))
);
drop policy if exists helpdesk_comments_insert on public.helpdesk_comments;
create policy helpdesk_comments_insert on public.helpdesk_comments for insert to authenticated with check (
  author_id=(select auth.uid()) and exists(select 1 from public.helpdesk_tickets h where h.id=helpdesk_ticket_id and private.is_workspace_member(h.workspace_id)
    and (private.has_workspace_permission(h.workspace_id,'manage_helpdesk') or h.requester_user_id=(select auth.uid())))
);
drop policy if exists helpdesk_comments_update on public.helpdesk_comments;
create policy helpdesk_comments_update on public.helpdesk_comments for update to authenticated using (
  author_id=(select auth.uid()) and exists(select 1 from public.helpdesk_tickets h where h.id=helpdesk_ticket_id and private.is_workspace_member(h.workspace_id)
    and (private.has_workspace_permission(h.workspace_id,'manage_helpdesk') or h.requester_user_id=(select auth.uid())))
) with check (
  author_id=(select auth.uid()) and exists(select 1 from public.helpdesk_tickets h where h.id=helpdesk_ticket_id and private.is_workspace_member(h.workspace_id)
    and (private.has_workspace_permission(h.workspace_id,'manage_helpdesk') or h.requester_user_id=(select auth.uid())))
);
drop policy if exists helpdesk_comments_delete on public.helpdesk_comments;
create policy helpdesk_comments_delete on public.helpdesk_comments for delete to authenticated using (
  author_id=(select auth.uid()) and exists(select 1 from public.helpdesk_tickets h where h.id=helpdesk_ticket_id and private.is_workspace_member(h.workspace_id)
    and (private.has_workspace_permission(h.workspace_id,'manage_helpdesk') or h.requester_user_id=(select auth.uid())))
);
drop policy if exists helpdesk_activity_select on public.helpdesk_activity;
create policy helpdesk_activity_select on public.helpdesk_activity for select to authenticated using (
  exists(select 1 from public.helpdesk_tickets h where h.id=helpdesk_ticket_id and private.is_workspace_member(h.workspace_id)
    and (private.has_workspace_permission(h.workspace_id,'manage_helpdesk') or h.requester_user_id=(select auth.uid())))
);

drop policy if exists helpdesk_departments_manage on public.helpdesk_departments;
create policy helpdesk_departments_manage on public.helpdesk_departments for all to authenticated
using (private.has_workspace_permission(workspace_id,'manage_settings'))
with check (private.has_workspace_permission(workspace_id,'manage_settings'));

drop policy if exists outbox_admin_select on public.notification_outbox;
create policy outbox_admin_select on public.notification_outbox for select to authenticated
using (recipient_user_id=(select auth.uid()) or private.has_workspace_permission(workspace_id,'manage_settings'));

-- Notificaciones dejan de mostrar referencias a productos/Helpdesk que ya no son accesibles.
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select to authenticated using (
  user_id=(select auth.uid())
  and private.is_workspace_member(workspace_id)
  and (ticket_id is null or exists(select 1 from public.tickets t where t.id=notifications.ticket_id
    and private.has_workspace_permission(t.workspace_id,'view_tickets')
    and private.has_product_access(t.workspace_id,t.product_id)))
  and (helpdesk_ticket_id is null or exists(select 1 from public.helpdesk_tickets h where h.id=notifications.helpdesk_ticket_id
    and (private.has_workspace_permission(h.workspace_id,'manage_helpdesk') or h.requester_user_id=(select auth.uid()))))
);

create or replace function private.validate_ticket_people()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if tg_op='UPDATE' and new.reporter_id is distinct from old.reporter_id then
    raise exception 'reporter_id cannot be changed after ticket creation';
  end if;
  if tg_op='INSERT' and new.reporter_id is not null and not exists(
    select 1 from public.workspace_members wm where wm.workspace_id=new.workspace_id and wm.user_id=new.reporter_id and wm.active=true
  ) then raise exception 'Reporter must be an active member of the workspace'; end if;

  if (tg_op='INSERT' or new.dev_owner_id is distinct from old.dev_owner_id or new.product_id is distinct from old.product_id)
     and new.dev_owner_id is not null and not exists(
       select 1 from public.workspace_members wm
       where wm.workspace_id=new.workspace_id and wm.user_id=new.dev_owner_id and wm.active=true
         and wm.role in ('superadmin','admin','pm','dev')
         and (wm.role in ('superadmin','admin') or wm.all_products or exists(
           select 1 from public.workspace_member_products mp
           where mp.workspace_id=new.workspace_id and mp.user_id=wm.user_id and mp.product_id=new.product_id))
     ) then raise exception 'Development owner must have active access to this product'; end if;

  if (tg_op='INSERT' or new.qa_owner_id is distinct from old.qa_owner_id or new.product_id is distinct from old.product_id)
     and new.qa_owner_id is not null and not exists(
       select 1 from public.workspace_members wm
       where wm.workspace_id=new.workspace_id and wm.user_id=new.qa_owner_id and wm.active=true
         and wm.role in ('superadmin','admin','pm','qa')
         and (wm.role in ('superadmin','admin') or wm.all_products or exists(
           select 1 from public.workspace_member_products mp
           where mp.workspace_id=new.workspace_id and mp.user_id=wm.user_id and mp.product_id=new.product_id))
     ) then raise exception 'QA owner must have active access to this product'; end if;
  return new;
end
$$;

create or replace function private.validate_helpdesk_people()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if tg_op='UPDATE' and new.requester_user_id is distinct from old.requester_user_id then
    raise exception 'requester_user_id cannot be changed after request creation';
  end if;
  if tg_op='INSERT' and new.requester_user_id is not null and not exists(
    select 1 from public.workspace_members wm
    where wm.workspace_id=new.workspace_id and wm.user_id=new.requester_user_id and wm.active=true
  ) then raise exception 'Requester must be an active member of the workspace'; end if;
  if (tg_op='INSERT' or new.assigned_to is distinct from old.assigned_to)
     and new.assigned_to is not null
     and not private.member_has_permission(new.workspace_id,new.assigned_to,'manage_helpdesk') then
    raise exception 'Helpdesk assignee must have active Helpdesk management access in the workspace';
  end if;
  return new;
end
$$;

create or replace function private.normalize_helpdesk_insert()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if not private.has_workspace_permission(new.workspace_id,'manage_helpdesk') then
    new.requester_user_id:=auth.uid();
    new.status:='created';
    new.assigned_to:=null;
    new.due_at:=null;
    new.source:='portal';
  end if;
  return new;
end
$$;

create or replace function private.guard_helpdesk_requester_update()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if private.has_workspace_permission(old.workspace_id,'manage_helpdesk') then return new; end if;
  if old.requester_user_id is distinct from auth.uid() then raise exception 'You cannot update this Helpdesk request'; end if;
  if row(new.workspace_id,new.requester_user_id,new.assigned_to,new.status,new.due_at,new.first_response_at,new.reviewed_at,new.attended_at,new.resolved_at,new.closed_at)
     is distinct from row(old.workspace_id,old.requester_user_id,old.assigned_to,old.status,old.due_at,old.first_response_at,old.reviewed_at,old.attended_at,old.resolved_at,old.closed_at) then
    raise exception 'Requesters cannot change internal Helpdesk handling fields';
  end if;
  return new;
end
$$;

create or replace function private.can_view_evidence_object(p_name text)
returns boolean
language plpgsql stable security definer set search_path=public,storage,pg_temp
as $$
declare v_workspace uuid; v_parent uuid; v_scope text;
begin
  v_workspace:=split_part(p_name,'/',1)::uuid; v_scope:=split_part(p_name,'/',2); v_parent:=split_part(p_name,'/',3)::uuid;
  if v_scope='tickets' then
    return exists(select 1 from public.tickets t where t.id=v_parent and t.workspace_id=v_workspace
      and private.has_workspace_permission(v_workspace,'view_tickets') and private.has_product_access(v_workspace,t.product_id));
  elsif v_scope='sprints' then
    return exists(select 1 from public.sprints s where s.id=v_parent and s.workspace_id=v_workspace
      and private.has_workspace_permission(v_workspace,'view_dashboard'));
  end if;
  return false;
exception when invalid_text_representation then return false;
end
$$;

create or replace function private.can_upload_evidence_object(p_name text)
returns boolean
language plpgsql stable security definer set search_path=public,storage,pg_temp
as $$
declare v_workspace uuid; v_parent uuid; v_scope text;
begin
  v_workspace:=split_part(p_name,'/',1)::uuid; v_scope:=split_part(p_name,'/',2); v_parent:=split_part(p_name,'/',3)::uuid;
  if v_scope='tickets' then
    return exists(select 1 from public.tickets t where t.id=v_parent and t.workspace_id=v_workspace
      and private.has_workspace_permission(v_workspace,'edit_tickets') and private.has_product_access(v_workspace,t.product_id));
  elsif v_scope='sprints' then
    return exists(select 1 from public.sprints s where s.id=v_parent and s.workspace_id=v_workspace
      and private.has_workspace_permission(v_workspace,'edit_tickets'));
  end if;
  return false;
exception when invalid_text_representation then return false;
end
$$;

create or replace function private.can_manage_evidence_object(p_name text)
returns boolean
language plpgsql stable security definer set search_path=public,storage,pg_temp
as $$
declare v_workspace uuid;
begin
  v_workspace:=split_part(p_name,'/',1)::uuid;
  return private.has_workspace_permission(v_workspace,'delete_tickets')
      or private.has_workspace_permission(v_workspace,'manage_sprints');
exception when invalid_text_representation then return false;
end
$$;

create or replace function public.close_sprint_and_rollover(p_sprint_id uuid,p_next_sprint_id uuid default null)
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare v_workspace uuid; v_moved integer:=0;
begin
  select workspace_id into v_workspace from public.sprints where id=p_sprint_id;
  if v_workspace is null then raise exception 'Sprint not found'; end if;
  if not private.has_workspace_permission(v_workspace,'manage_sprints') then raise exception 'You do not have permission to close this sprint'; end if;
  if p_next_sprint_id is not null then
    if p_next_sprint_id=p_sprint_id then raise exception 'Next sprint must be different'; end if;
    if not exists(select 1 from public.sprints where id=p_next_sprint_id and workspace_id=v_workspace) then raise exception 'Next sprint must belong to the same workspace'; end if;
    update public.tickets set sprint_id=p_next_sprint_id where sprint_id=p_sprint_id and status not in ('qa_passed','closed');
    get diagnostics v_moved=row_count;
    update public.sprints set status='active' where id=p_next_sprint_id and status='planned';
  else
    update public.tickets set sprint_id=null,status='backlog' where sprint_id=p_sprint_id and status not in ('qa_passed','closed');
    get diagnostics v_moved=row_count;
  end if;
  update public.sprints set status='completed' where id=p_sprint_id;
  return jsonb_build_object('ok',true,'moved',v_moved,'source_sprint_id',p_sprint_id,'next_sprint_id',p_next_sprint_id);
end
$$;
revoke all on function public.close_sprint_and_rollover(uuid,uuid) from public,anon;
grant execute on function public.close_sprint_and_rollover(uuid,uuid) to authenticated;


create or replace function private.helpdesk_created()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_in_app boolean:=true;
begin
  select coalesce(ws.in_app_notifications,true) into v_in_app
  from public.workspace_settings ws where ws.workspace_id=new.workspace_id;
  if not found then v_in_app:=true; end if;

  insert into public.helpdesk_activity(helpdesk_ticket_id,actor_id,action,to_value)
  values(new.id,auth.uid(),'created',new.status);

  if v_in_app then
    if new.requester_user_id is not null then
      insert into public.notifications(workspace_id,user_id,helpdesk_ticket_id,type,title,body)
      values(new.workspace_id,new.requester_user_id,new.id,'helpdesk_created','Solicitud creada '||new.ticket_key,new.subject);
    end if;
    insert into public.notifications(workspace_id,user_id,helpdesk_ticket_id,type,title,body)
    select new.workspace_id,wm.user_id,new.id,'helpdesk_new','Nueva solicitud '||new.ticket_key,new.subject
    from public.workspace_members wm
    where wm.workspace_id=new.workspace_id
      and wm.active=true
      and private.member_has_permission(new.workspace_id,wm.user_id,'manage_helpdesk')
      and wm.user_id is distinct from new.requester_user_id;
    if new.assigned_to is not null and new.assigned_to is distinct from new.requester_user_id then
      insert into public.notifications(workspace_id,user_id,helpdesk_ticket_id,type,title,body)
      values(new.workspace_id,new.assigned_to,new.id,'helpdesk_assigned',new.ticket_key||' asignado',new.subject);
    end if;
  end if;
  return new;
end
$$;

create or replace function private.notify_ticket_created()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_in_app boolean:=true; v_email boolean:=true;
begin
  select coalesce(ws.in_app_notifications,true),coalesce(ws.email_notifications,true)
  into v_in_app,v_email
  from public.workspace_settings ws where ws.workspace_id=new.workspace_id;
  if not found then v_in_app:=true;v_email:=true;end if;

  if v_email then
    insert into public.notification_outbox(workspace_id,ticket_id,recipient_user_id,event_type,payload)
    select new.workspace_id,new.id,wm.user_id,'ticket_created',
      jsonb_build_object('ticket_key',new.ticket_key,'title',new.title,'product_id',new.product_id)
    from public.workspace_members wm
    where wm.workspace_id=new.workspace_id
      and wm.active=true
      and (
        private.member_has_permission(new.workspace_id,wm.user_id,'manage_sprints')
        or private.member_has_permission(new.workspace_id,wm.user_id,'manage_staff')
      )
      and private.member_has_product_access(new.workspace_id,wm.user_id,new.product_id)
      and wm.user_id is distinct from new.reporter_id;

    if new.dev_owner_id is not null then
      insert into public.notification_outbox(workspace_id,ticket_id,recipient_user_id,event_type,payload)
      values(new.workspace_id,new.id,new.dev_owner_id,'assigned_dev',jsonb_build_object('ticket_key',new.ticket_key,'title',new.title));
    end if;
    if new.qa_owner_id is not null then
      insert into public.notification_outbox(workspace_id,ticket_id,recipient_user_id,event_type,payload)
      values(new.workspace_id,new.id,new.qa_owner_id,'assigned_qa',jsonb_build_object('ticket_key',new.ticket_key,'title',new.title));
    end if;
  end if;

  if v_in_app then
    if new.reporter_id is not null then
      insert into public.notifications(workspace_id,user_id,ticket_id,type,title,body)
      values(new.workspace_id,new.reporter_id,new.id,'ticket_created','Ticket creado '||new.ticket_key,new.title);
    end if;

    insert into public.notifications(workspace_id,user_id,ticket_id,type,title,body)
    select new.workspace_id,wm.user_id,new.id,'ticket_created','Nuevo ticket '||new.ticket_key,new.title
    from public.workspace_members wm
    where wm.workspace_id=new.workspace_id
      and wm.active=true
      and (
        private.member_has_permission(new.workspace_id,wm.user_id,'manage_sprints')
        or private.member_has_permission(new.workspace_id,wm.user_id,'manage_staff')
      )
      and private.member_has_product_access(new.workspace_id,wm.user_id,new.product_id)
      and wm.user_id is distinct from new.reporter_id;

    if new.dev_owner_id is not null and new.dev_owner_id is distinct from new.reporter_id then
      insert into public.notifications(workspace_id,user_id,ticket_id,type,title,body)
      values(new.workspace_id,new.dev_owner_id,new.id,'assigned_dev','Ticket asignado '||new.ticket_key,new.title);
    end if;
    if new.qa_owner_id is not null and new.qa_owner_id is distinct from new.reporter_id then
      insert into public.notifications(workspace_id,user_id,ticket_id,type,title,body)
      values(new.workspace_id,new.qa_owner_id,new.id,'assigned_qa','Ticket asignado a QA '||new.ticket_key,new.title);
    end if;
  end if;
  return new;
end
$$;

-- Mantener funciones privadas fuera de la API pública.
revoke all on function private.guard_workspace_membership() from public,anon,authenticated;
revoke all on function private.validate_ticket_people() from public,anon,authenticated;
revoke all on function private.validate_helpdesk_people() from public,anon,authenticated;
revoke all on function private.normalize_helpdesk_insert() from public,anon,authenticated;
revoke all on function private.guard_helpdesk_requester_update() from public,anon,authenticated;
revoke all on function private.helpdesk_created() from public,anon,authenticated;
revoke all on function private.notify_ticket_created() from public,anon,authenticated;
revoke all on function private.can_view_evidence_object(text) from public,anon;
revoke all on function private.can_upload_evidence_object(text) from public,anon;
revoke all on function private.can_manage_evidence_object(text) from public,anon;
grant execute on function private.can_view_evidence_object(text) to authenticated;
grant execute on function private.can_upload_evidence_object(text) to authenticated;
grant execute on function private.can_manage_evidence_object(text) to authenticated;


-- ============================================================================
-- v13.0 - Roles administrables, scope por producto y Superadmin forzado
-- ============================================================================
-- Jira Interno TROBBU v13.0
-- Roles administrables por workspace, alcance por producto, Superadmin forzado,
-- compatibilidad de permisos y soporte del Timeline/Gantt mejorado.

begin;

alter table public.workspace_members
  add column if not exists permissions jsonb not null default '{}'::jsonb,
  add column if not exists all_products boolean not null default false;

create table if not exists public.workspace_member_products (
  workspace_id uuid not null,
  user_id uuid not null,
  product_id uuid not null,
  created_at timestamptz not null default now(),
  primary key(workspace_id,user_id,product_id),
  constraint workspace_member_products_member_fkey
    foreign key(workspace_id,user_id)
    references public.workspace_members(workspace_id,user_id)
    on delete cascade,
  constraint workspace_member_products_product_fkey
    foreign key(product_id,workspace_id)
    references public.products(id,workspace_id)
    on delete cascade
);
create index if not exists idx_workspace_member_products_user
  on public.workspace_member_products(user_id,workspace_id);
create index if not exists idx_workspace_member_products_product
  on public.workspace_member_products(product_id,workspace_id);

alter table public.workspace_member_products enable row level security;
grant select,insert,delete on public.workspace_member_products to authenticated;

create table if not exists public.workspace_roles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  base_role public.app_role not null default 'consulta',
  permissions jsonb not null default '{}'::jsonb,
  is_system boolean not null default false,
  protected boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,code),
  unique(id,workspace_id)
);
create index if not exists idx_workspace_roles_workspace on public.workspace_roles(workspace_id,active);
alter table public.workspace_roles enable row level security;
grant select,insert,update,delete on public.workspace_roles to authenticated;

alter table public.workspace_members add column if not exists role_id uuid;
alter table public.workspace_members drop constraint if exists workspace_members_role_workspace_fkey;
alter table public.workspace_members add constraint workspace_members_role_workspace_fkey
  foreign key(role_id,workspace_id)
  references public.workspace_roles(id,workspace_id)
  on delete restrict;

drop trigger if exists trg_workspace_roles_updated on public.workspace_roles;
create trigger trg_workspace_roles_updated
before update on public.workspace_roles
for each row execute function public.set_updated_at();

create or replace function private.role_default_permission(p_role public.app_role,p_permission text)
returns boolean
language sql
immutable
security invoker
set search_path=public,pg_temp
as $$
  select case
    when p_role='superadmin' then true
    when p_role='admin' then p_permission in (
      'view_dashboard','view_tickets','create_tickets','edit_tickets','delete_tickets',
      'manage_sprints','qa_review','manage_helpdesk','manage_staff','manage_products','manage_settings'
    )
    when p_role='pm' then p_permission in (
      'view_dashboard','view_tickets','create_tickets','edit_tickets','delete_tickets',
      'manage_sprints','qa_review','manage_helpdesk'
    )
    when p_role='dev' then p_permission in (
      'view_dashboard','view_tickets','create_tickets','edit_tickets'
    )
    when p_role='qa' then p_permission in (
      'view_dashboard','view_tickets','create_tickets','edit_tickets','qa_review'
    )
    when p_role='consulta' then p_permission in ('view_dashboard','view_tickets')
    else false
  end;
$$;

create or replace function private.seed_workspace_roles(p_workspace uuid)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  insert into public.workspace_roles(workspace_id,code,name,description,base_role,permissions,is_system,protected,active)
  values
    (p_workspace,'superadmin','Superadmin','Control total del workspace. Acceso forzado a todas las funciones y productos.','superadmin','{}',true,true,true),
    (p_workspace,'admin','Admin','Administración integral del workspace, Staff, productos y operación.','admin','{}',true,false,true),
    (p_workspace,'pm','PM','Planeación, Backlog, Sprints, Timeline/Gantt y seguimiento.','pm','{}',true,false,true),
    (p_workspace,'dev','Dev','Desarrollo y actualización de tickets dentro de productos autorizados.','dev','{}',true,false,true),
    (p_workspace,'qa','QA','Revisión QA, rechazo/aprobación y evidencias dentro de productos autorizados.','qa','{}',true,false,true),
    (p_workspace,'consulta','Consulta','Lectura de dashboards, tickets, Backlog y Timeline/Gantt.','consulta','{}',true,false,true)
  on conflict (workspace_id,code) do update set
    name=excluded.name,
    description=coalesce(public.workspace_roles.description,excluded.description),
    base_role=excluded.base_role,
    is_system=true,
    protected=(excluded.code='superadmin'),
    active=true;
end
$$;
revoke all on function private.seed_workspace_roles(uuid) from public,anon,authenticated;

select private.seed_workspace_roles(id) from public.workspaces;

update public.workspace_members wm
set role='consulta'
where role in ('reporter','viewer');

update public.workspace_members wm
set role_id=wr.id
from public.workspace_roles wr
where wr.workspace_id=wm.workspace_id
  and wr.code=case when wm.role in ('reporter','viewer') then 'consulta' else wm.role::text end
  and wm.role_id is null;

update public.workspace_members
set all_products=true
where role='superadmin' and active=true;

create or replace function private.role_permission_from_definition(
  p_workspace uuid,
  p_role_id uuid,
  p_fallback public.app_role,
  p_permission text
)
returns boolean
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select coalesce(
    (
      select case
        when wr.code='superadmin' or wr.base_role='superadmin' then true
        when jsonb_typeof(wr.permissions -> p_permission)='boolean'
          then (wr.permissions ->> p_permission)::boolean
        else private.role_default_permission(wr.base_role,p_permission)
      end
      from public.workspace_roles wr
      where wr.id=p_role_id
        and wr.workspace_id=p_workspace
        and wr.active=true
    ),
    private.role_default_permission(p_fallback,p_permission)
  );
$$;

create or replace function private.member_has_permission(p_workspace uuid,p_user uuid,p_permission text)
returns boolean
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select coalesce((
    select case
      when wm.role='superadmin' then true
      when jsonb_typeof(wm.permissions -> p_permission)='boolean'
        then (wm.permissions ->> p_permission)::boolean
      else private.role_permission_from_definition(wm.workspace_id,wm.role_id,wm.role,p_permission)
    end
    from public.workspace_members wm
    where wm.workspace_id=p_workspace
      and wm.user_id=p_user
      and wm.active=true
  ),false);
$$;

create or replace function private.has_workspace_permission(p_workspace uuid,p_permission text)
returns boolean
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select private.member_has_permission(p_workspace,(select auth.uid()),p_permission);
$$;

create or replace function private.member_has_product_access(p_workspace uuid,p_user uuid,p_product uuid)
returns boolean
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select coalesce((
    select case
      when wm.role='superadmin' then true
      when wm.all_products then true
      else exists(
        select 1 from public.workspace_member_products mp
        where mp.workspace_id=p_workspace
          and mp.user_id=p_user
          and mp.product_id=p_product
      )
    end
    from public.workspace_members wm
    where wm.workspace_id=p_workspace
      and wm.user_id=p_user
      and wm.active=true
  ),false);
$$;

create or replace function private.has_product_access(p_workspace uuid,p_product uuid)
returns boolean
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select private.member_has_product_access(p_workspace,(select auth.uid()),p_product);
$$;

revoke all on function private.role_default_permission(public.app_role,text) from public,anon;
revoke all on function private.role_permission_from_definition(uuid,uuid,public.app_role,text) from public,anon;
revoke all on function private.member_has_permission(uuid,uuid,text) from public,anon;
revoke all on function private.has_workspace_permission(uuid,text) from public,anon;
revoke all on function private.member_has_product_access(uuid,uuid,uuid) from public,anon;
revoke all on function private.has_product_access(uuid,uuid) from public,anon;
grant execute on function private.role_default_permission(public.app_role,text) to authenticated;
grant execute on function private.role_permission_from_definition(uuid,uuid,public.app_role,text) to authenticated;
grant execute on function private.member_has_permission(uuid,uuid,text) to authenticated;
grant execute on function private.has_workspace_permission(uuid,text) to authenticated;
grant execute on function private.member_has_product_access(uuid,uuid,uuid) to authenticated;
grant execute on function private.has_product_access(uuid,uuid) to authenticated;

create or replace function private.guard_workspace_role_definition()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if tg_op='DELETE' and not exists(select 1 from public.workspaces w where w.id=old.workspace_id) then
    return old;
  end if;

  if tg_op='DELETE' then
    if old.protected then raise exception 'The Superadmin role cannot be deleted'; end if;
    if exists(select 1 from public.workspace_members wm where wm.role_id=old.id) then
      raise exception 'Role is currently assigned to one or more collaborators';
    end if;
    return old;
  end if;

  if tg_op='UPDATE' then
    if new.workspace_id is distinct from old.workspace_id then raise exception 'Role workspace cannot be changed'; end if;
    if old.protected then
      new.code:='superadmin';
      new.name:='Superadmin';
      new.base_role:='superadmin';
      new.permissions:='{}'::jsonb;
      new.active:=true;
      new.protected:=true;
    end if;
  end if;

  if tg_op='INSERT' and new.code='superadmin' then
    new.base_role:='superadmin';
    new.permissions:='{}'::jsonb;
    new.protected:=true;
  end if;
  return new;
end
$$;

create or replace function private.sync_workspace_role_members()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if new.base_role is distinct from old.base_role then
    update public.workspace_members
    set role=case when new.code='superadmin' then 'superadmin'::public.app_role else new.base_role end
    where role_id=new.id;
  end if;
  return new;
end
$$;
revoke all on function private.sync_workspace_role_members() from public,anon,authenticated;

drop trigger if exists trg_guard_workspace_role_definition on public.workspace_roles;
create trigger trg_guard_workspace_role_definition
before insert or update or delete on public.workspace_roles
for each row execute function private.guard_workspace_role_definition();

drop trigger if exists trg_sync_workspace_role_members on public.workspace_roles;
create trigger trg_sync_workspace_role_members
after update on public.workspace_roles
for each row execute function private.sync_workspace_role_members();

drop policy if exists workspace_roles_select on public.workspace_roles;
create policy workspace_roles_select on public.workspace_roles
for select to authenticated
using (private.is_workspace_member(workspace_id));

drop policy if exists workspace_roles_insert on public.workspace_roles;
create policy workspace_roles_insert on public.workspace_roles
for insert to authenticated
with check (private.has_workspace_permission(workspace_id,'manage_staff'));

drop policy if exists workspace_roles_update on public.workspace_roles;
create policy workspace_roles_update on public.workspace_roles
for update to authenticated
using (private.has_workspace_permission(workspace_id,'manage_staff'))
with check (private.has_workspace_permission(workspace_id,'manage_staff'));

drop policy if exists workspace_roles_delete on public.workspace_roles;
create policy workspace_roles_delete on public.workspace_roles
for delete to authenticated
using (private.has_workspace_permission(workspace_id,'manage_staff'));

drop policy if exists member_products_select on public.workspace_member_products;
create policy member_products_select on public.workspace_member_products
for select to authenticated
using (user_id=(select auth.uid()) or private.has_workspace_permission(workspace_id,'manage_staff'));

drop policy if exists member_products_insert on public.workspace_member_products;
create policy member_products_insert on public.workspace_member_products
for insert to authenticated
with check (private.has_workspace_permission(workspace_id,'manage_staff'));

drop policy if exists member_products_delete on public.workspace_member_products;
create policy member_products_delete on public.workspace_member_products
for delete to authenticated
using (private.has_workspace_permission(workspace_id,'manage_staff'));

create or replace function private.bootstrap_workspace()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_super_role uuid;
begin
  perform private.seed_workspace_roles(new.id);
  select id into v_super_role from public.workspace_roles where workspace_id=new.id and code='superadmin';

  if new.created_by is not null then
    insert into public.workspace_members(workspace_id,user_id,role,role_id,active,all_products)
    values(new.id,new.created_by,'superadmin',v_super_role,true,true)
    on conflict (workspace_id,user_id)
    do update set role='superadmin',role_id=v_super_role,active=true,all_products=true,permissions='{}'::jsonb;
  end if;

  insert into public.products(workspace_id,name,key,description,board_order)
  values
    (new.id,'Web Administrativa','ADM','Administración interna y operación',1),
    (new.id,'Web Socios','SOC','Portal web para socios/inversionistas',2),
    (new.id,'App Socios','APP','Aplicación móvil para socios/inversionistas',3)
  on conflict (workspace_id,key) do nothing;

  insert into public.workspace_settings(workspace_id) values(new.id) on conflict (workspace_id) do nothing;

  insert into public.helpdesk_departments(workspace_id,name,color,active)
  values
    (new.id,'Reservaciones','#0D47A1',true),(new.id,'Recepción','#4D5A51',true),
    (new.id,'Gerencia','#21343E',true),(new.id,'Administración','#CA6832',true),
    (new.id,'Aperturas','#249F58',true),(new.id,'Marketing','#AE6A3E',true),
    (new.id,'Callcenter','#007BFF',true),(new.id,'Plataforma','#056D25',true),
    (new.id,'Atención a clientes','#D4DCE0',true),(new.id,'Atención a socios','#FF6363',true)
  on conflict (workspace_id,name) do update set color=excluded.color,active=true;
  return new;
end
$$;

create or replace function private.guard_workspace_membership()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_caller uuid:=auth.uid();
  v_super boolean:=false;
  v_staff boolean:=false;
  v_supers integer;
  v_role public.workspace_roles;
begin
  if tg_op='DELETE' and not exists(select 1 from public.workspaces w where w.id=old.workspace_id) then return old; end if;

  if tg_op<>'DELETE' then
    if new.role_id is not null then
      select * into v_role from public.workspace_roles
      where id=new.role_id and workspace_id=new.workspace_id and active=true;
      if not found then raise exception 'Selected role does not belong to this workspace'; end if;
      new.role:=v_role.base_role;
      if v_role.code='superadmin' then new.role:='superadmin'; end if;
    else
      select * into v_role from public.workspace_roles
      where workspace_id=new.workspace_id
        and code=case when new.role in ('reporter','viewer') then 'consulta' else new.role::text end
        and active=true limit 1;
      if found then new.role_id:=v_role.id;new.role:=v_role.base_role;end if;
    end if;
  end if;

  if v_caller is null then
    if tg_op='UPDATE' and (new.workspace_id is distinct from old.workspace_id or new.user_id is distinct from old.user_id) then
      raise exception 'Membership workspace/user cannot be reassigned';
    end if;
    if tg_op<>'DELETE' and new.role='superadmin' then new.all_products:=true;new.permissions:='{}'::jsonb;end if;
    if tg_op='DELETE' then return old; end if;
    return new;
  end if;

  if tg_op='INSERT' then
    v_super:=private.has_workspace_role(new.workspace_id,array['superadmin']::public.app_role[]);
    v_staff:=private.has_workspace_permission(new.workspace_id,'manage_staff');
    if new.role='superadmin' and not v_super then
      if not(new.user_id=v_caller and exists(select 1 from public.workspaces w where w.id=new.workspace_id and w.created_by=v_caller)) then
        raise exception 'Only a Superadmin can grant the Superadmin role';
      end if;
    elsif not v_staff and new.user_id is distinct from v_caller then
      raise exception 'You do not have permission to manage Staff';
    end if;
    if new.role='superadmin' then new.all_products:=true;new.permissions:='{}'::jsonb;end if;
    return new;
  end if;

  if tg_op='UPDATE' and (new.workspace_id is distinct from old.workspace_id or new.user_id is distinct from old.user_id) then
    raise exception 'Membership workspace/user cannot be reassigned';
  end if;

  v_super:=private.has_workspace_role(old.workspace_id,array['superadmin']::public.app_role[]);
  v_staff:=private.has_workspace_permission(old.workspace_id,'manage_staff');
  if old.role='superadmin' and not v_super then raise exception 'Only a Superadmin can modify another Superadmin'; end if;
  if not v_staff and not v_super then raise exception 'You do not have permission to manage Staff'; end if;
  if new.role='superadmin' and old.role<>'superadmin' and not v_super then raise exception 'Only a Superadmin can grant the Superadmin role'; end if;

  if old.role='superadmin' and (tg_op='DELETE' or (tg_op='UPDATE' and (new.role<>'superadmin' or new.active=false))) then
    select count(*) into v_supers from public.workspace_members wm
    where wm.workspace_id=old.workspace_id and wm.active=true and wm.role='superadmin' and wm.user_id<>old.user_id;
    if v_supers=0 then raise exception 'A workspace must keep at least one active Superadmin'; end if;
  end if;

  if tg_op<>'DELETE' and new.role='superadmin' then new.all_products:=true;new.permissions:='{}'::jsonb;end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end
$$;

-- Workspace / Staff permission policies.
drop policy if exists workspaces_update on public.workspaces;
create policy workspaces_update on public.workspaces for update to authenticated
using (private.has_workspace_permission(id,'manage_settings'))
with check (private.has_workspace_permission(id,'manage_settings'));

drop policy if exists workspaces_delete on public.workspaces;
create policy workspaces_delete on public.workspaces for delete to authenticated
using (private.has_workspace_role(id,array['superadmin']::public.app_role[]));

drop policy if exists members_insert on public.workspace_members;
create policy members_insert on public.workspace_members for insert to authenticated
with check (private.has_workspace_permission(workspace_id,'manage_staff'));
drop policy if exists members_update on public.workspace_members;
create policy members_update on public.workspace_members for update to authenticated
using (private.has_workspace_permission(workspace_id,'manage_staff'))
with check (private.has_workspace_permission(workspace_id,'manage_staff'));
drop policy if exists members_delete on public.workspace_members;
create policy members_delete on public.workspace_members for delete to authenticated
using (private.has_workspace_permission(workspace_id,'manage_staff'));

drop policy if exists workspace_settings_update on public.workspace_settings;
create policy workspace_settings_update on public.workspace_settings for update to authenticated
using (private.has_workspace_permission(workspace_id,'manage_settings'))
with check (private.has_workspace_permission(workspace_id,'manage_settings'));

drop policy if exists invites_manage on public.workspace_invites;
create policy invites_manage on public.workspace_invites for all to authenticated
using (private.has_workspace_permission(workspace_id,'manage_staff'))
with check (private.has_workspace_permission(workspace_id,'manage_staff'));

-- Products respect membership product scope. Superadmin is always global.
drop policy if exists products_select on public.products;
create policy products_select on public.products for select to authenticated
using (private.is_workspace_member(workspace_id) and private.has_product_access(workspace_id,id));
drop policy if exists products_insert on public.products;
create policy products_insert on public.products for insert to authenticated
with check (private.has_workspace_permission(workspace_id,'manage_products'));
drop policy if exists products_update on public.products;
create policy products_update on public.products for update to authenticated
using (private.has_workspace_permission(workspace_id,'manage_products'))
with check (private.has_workspace_permission(workspace_id,'manage_products'));
drop policy if exists products_delete on public.products;
create policy products_delete on public.products for delete to authenticated
using (private.has_workspace_permission(workspace_id,'manage_products'));

-- Sprints.
drop policy if exists sprints_select on public.sprints;
create policy sprints_select on public.sprints for select to authenticated
using (private.is_workspace_member(workspace_id) and private.has_workspace_permission(workspace_id,'view_dashboard'));
drop policy if exists sprints_insert on public.sprints;
create policy sprints_insert on public.sprints for insert to authenticated
with check (private.has_workspace_permission(workspace_id,'manage_sprints'));
drop policy if exists sprints_update on public.sprints;
create policy sprints_update on public.sprints for update to authenticated
using (private.has_workspace_permission(workspace_id,'manage_sprints'))
with check (private.has_workspace_permission(workspace_id,'manage_sprints'));
drop policy if exists sprints_delete on public.sprints;
create policy sprints_delete on public.sprints for delete to authenticated
using (private.has_workspace_permission(workspace_id,'manage_sprints'));

-- Tickets and ticket data: capability + product scope.
drop policy if exists tickets_select on public.tickets;
create policy tickets_select on public.tickets for select to authenticated
using (private.has_workspace_permission(workspace_id,'view_tickets') and private.has_product_access(workspace_id,product_id));
drop policy if exists tickets_insert on public.tickets;
create policy tickets_insert on public.tickets for insert to authenticated
with check (
  private.has_workspace_permission(workspace_id,'create_tickets')
  and private.has_product_access(workspace_id,product_id)
  and reporter_id=(select auth.uid())
  and (
    private.has_workspace_permission(workspace_id,'edit_tickets')
    or (status='backlog' and sprint_id is null and dev_owner_id is null and qa_owner_id is null and story_points is null and start_date is null and due_date is null)
  )
);
drop policy if exists tickets_update on public.tickets;
create policy tickets_update on public.tickets for update to authenticated
using (private.has_workspace_permission(workspace_id,'edit_tickets') and private.has_product_access(workspace_id,product_id))
with check (private.has_workspace_permission(workspace_id,'edit_tickets') and private.has_product_access(workspace_id,product_id));
drop policy if exists tickets_delete on public.tickets;
create policy tickets_delete on public.tickets for delete to authenticated
using (private.has_workspace_permission(workspace_id,'delete_tickets') and private.has_product_access(workspace_id,product_id));

drop policy if exists activity_select on public.ticket_activity;
create policy activity_select on public.ticket_activity for select to authenticated
using (exists(select 1 from public.tickets t where t.id=ticket_id and private.has_workspace_permission(t.workspace_id,'view_tickets') and private.has_product_access(t.workspace_id,t.product_id)));

-- Helpdesk permission-driven policies.
drop policy if exists helpdesk_tickets_select on public.helpdesk_tickets;
create policy helpdesk_tickets_select on public.helpdesk_tickets for select to authenticated
using (private.has_workspace_permission(workspace_id,'manage_helpdesk') or (requester_user_id=(select auth.uid()) and private.is_workspace_member(workspace_id)));
drop policy if exists helpdesk_tickets_update on public.helpdesk_tickets;
create policy helpdesk_tickets_update on public.helpdesk_tickets for update to authenticated
using (private.has_workspace_permission(workspace_id,'manage_helpdesk'))
with check (private.has_workspace_permission(workspace_id,'manage_helpdesk'));
drop policy if exists helpdesk_tickets_delete on public.helpdesk_tickets;
create policy helpdesk_tickets_delete on public.helpdesk_tickets for delete to authenticated
using (private.has_workspace_permission(workspace_id,'manage_helpdesk'));

drop policy if exists helpdesk_comments_select on public.helpdesk_comments;
create policy helpdesk_comments_select on public.helpdesk_comments for select to authenticated
using (exists(select 1 from public.helpdesk_tickets h where h.id=helpdesk_ticket_id and private.is_workspace_member(h.workspace_id) and (private.has_workspace_permission(h.workspace_id,'manage_helpdesk') or h.requester_user_id=(select auth.uid()))));
drop policy if exists helpdesk_comments_insert on public.helpdesk_comments;
create policy helpdesk_comments_insert on public.helpdesk_comments for insert to authenticated
with check (author_id=(select auth.uid()) and exists(select 1 from public.helpdesk_tickets h where h.id=helpdesk_ticket_id and private.is_workspace_member(h.workspace_id) and (private.has_workspace_permission(h.workspace_id,'manage_helpdesk') or h.requester_user_id=(select auth.uid()))));
drop policy if exists helpdesk_comments_update on public.helpdesk_comments;
create policy helpdesk_comments_update on public.helpdesk_comments for update to authenticated
using (author_id=(select auth.uid()) and exists(select 1 from public.helpdesk_tickets h where h.id=helpdesk_ticket_id and private.is_workspace_member(h.workspace_id) and (private.has_workspace_permission(h.workspace_id,'manage_helpdesk') or h.requester_user_id=(select auth.uid()))))
with check (author_id=(select auth.uid()) and exists(select 1 from public.helpdesk_tickets h where h.id=helpdesk_ticket_id and private.is_workspace_member(h.workspace_id) and (private.has_workspace_permission(h.workspace_id,'manage_helpdesk') or h.requester_user_id=(select auth.uid()))));
drop policy if exists helpdesk_comments_delete on public.helpdesk_comments;
create policy helpdesk_comments_delete on public.helpdesk_comments for delete to authenticated
using (author_id=(select auth.uid()) and exists(select 1 from public.helpdesk_tickets h where h.id=helpdesk_ticket_id and private.is_workspace_member(h.workspace_id) and (private.has_workspace_permission(h.workspace_id,'manage_helpdesk') or h.requester_user_id=(select auth.uid()))));
drop policy if exists helpdesk_activity_select on public.helpdesk_activity;
create policy helpdesk_activity_select on public.helpdesk_activity for select to authenticated
using (exists(select 1 from public.helpdesk_tickets h where h.id=helpdesk_ticket_id and private.is_workspace_member(h.workspace_id) and (private.has_workspace_permission(h.workspace_id,'manage_helpdesk') or h.requester_user_id=(select auth.uid()))));

-- Notification visibility inherits ticket/helpdesk visibility.
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select to authenticated
using (
  user_id=(select auth.uid()) and private.is_workspace_member(workspace_id)
  and (ticket_id is null or exists(select 1 from public.tickets t where t.id=notifications.ticket_id and private.has_workspace_permission(t.workspace_id,'view_tickets') and private.has_product_access(t.workspace_id,t.product_id)))
  and (helpdesk_ticket_id is null or exists(select 1 from public.helpdesk_tickets h where h.id=notifications.helpdesk_ticket_id and (private.has_workspace_permission(h.workspace_id,'manage_helpdesk') or h.requester_user_id=(select auth.uid()))))
);

commit;

-- Jira Interno TROBBU v14.0
-- Luxury Auth, flexible Timeline/Gantt and Helpdesk-only administrative portal.

alter table public.helpdesk_tickets
  add column if not exists proposal_status text,
  add column if not exists decision_by uuid references auth.users(id) on delete set null,
  add column if not exists decision_at timestamptz,
  add column if not exists decision_note text,
  add column if not exists converted_ticket_id uuid references public.tickets(id) on delete set null,
  add column if not exists converted_ticket_key text;

alter table public.helpdesk_tickets drop constraint if exists helpdesk_tickets_proposal_status_check;
alter table public.helpdesk_tickets add constraint helpdesk_tickets_proposal_status_check
  check (proposal_status is null or proposal_status in ('pending','accepted_backlog','rejected'));

create index if not exists idx_helpdesk_requirement_decisions
  on public.helpdesk_tickets(workspace_id,category,proposal_status,created_at desc);
create index if not exists idx_helpdesk_requester_category
  on public.helpdesk_tickets(requester_user_id,category,created_at desc);

-- Dedicated portal role: no products, boards, backlog or timeline.
insert into public.workspace_roles(
  workspace_id,code,name,description,base_role,permissions,is_system,protected,active
)
select
  w.id,
  'helpdesk_requester',
  'Solicitante Helpdesk',
  'Portal administrativo: crea y consulta únicamente sus solicitudes de Helpdesk. No accede a productos, tableros, Backlog ni Gantt.',
  'consulta'::public.app_role,
  '{"view_dashboard":false,"view_tickets":false,"create_tickets":false,"edit_tickets":false,"delete_tickets":false,"manage_sprints":false,"qa_review":false,"manage_helpdesk":false,"manage_staff":false,"manage_products":false,"manage_settings":false}'::jsonb,
  true,false,true
from public.workspaces w
on conflict (workspace_id,code) do update set
  name=excluded.name,
  description=excluded.description,
  base_role=excluded.base_role,
  permissions=excluded.permissions,
  is_system=true,
  protected=false,
  active=true;

create or replace function private.seed_workspace_roles(p_workspace uuid)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  insert into public.workspace_roles(workspace_id,code,name,description,base_role,permissions,is_system,protected,active)
  values
    (p_workspace,'superadmin','Superadmin','Control total del workspace. Acceso forzado a todas las funciones y productos.','superadmin','{}',true,true,true),
    (p_workspace,'admin','Admin','Administración integral del workspace, Staff, productos y operación.','admin','{}',true,false,true),
    (p_workspace,'pm','PM','Planeación, Backlog, Sprints, Timeline/Gantt y seguimiento.','pm','{}',true,false,true),
    (p_workspace,'dev','Dev','Desarrollo y actualización de tickets dentro de productos autorizados.','dev','{}',true,false,true),
    (p_workspace,'qa','QA','Revisión QA, rechazo/aprobación y evidencias dentro de productos autorizados.','qa','{}',true,false,true),
    (p_workspace,'consulta','Consulta','Lectura de dashboards, tickets, Backlog y Timeline/Gantt.','consulta','{}',true,false,true),
    (
      p_workspace,'helpdesk_requester','Solicitante Helpdesk',
      'Portal administrativo: crea y consulta únicamente sus solicitudes de Helpdesk. No accede a productos, tableros, Backlog ni Gantt.',
      'consulta',
      '{"view_dashboard":false,"view_tickets":false,"create_tickets":false,"edit_tickets":false,"delete_tickets":false,"manage_sprints":false,"qa_review":false,"manage_helpdesk":false,"manage_staff":false,"manage_products":false,"manage_settings":false}'::jsonb,
      true,false,true
    )
  on conflict (workspace_id,code) do update set
    name=excluded.name,
    description=excluded.description,
    base_role=excluded.base_role,
    permissions=excluded.permissions,
    is_system=true,
    protected=(excluded.code='superadmin'),
    active=true;
end
$$;
revoke all on function private.seed_workspace_roles(uuid) from public,anon,authenticated;

-- Portal users should only receive their own membership. Staff/product teams keep the access they need.
drop policy if exists members_select on public.workspace_members;
create policy members_select on public.workspace_members
for select to authenticated
using (
  user_id=(select auth.uid())
  or private.has_workspace_permission(workspace_id,'view_dashboard')
  or private.has_workspace_permission(workspace_id,'manage_helpdesk')
  or private.has_workspace_permission(workspace_id,'manage_staff')
);

-- Normalize portal requests. Product proposals are decision items, not operational SLA cases.
create or replace function private.normalize_helpdesk_insert()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if not private.has_workspace_permission(new.workspace_id,'manage_helpdesk') then
    new.requester_user_id:=auth.uid();
    new.status:='created';
    new.assigned_to:=null;
    new.due_at:=null;
    new.source:='portal';
  end if;

  if new.category in ('module','feature','new_requirement') then
    new.status:='created';
    new.assigned_to:=null;
    new.due_at:=null;
    new.proposal_status:='pending';
    new.decision_by:=null;
    new.decision_at:=null;
    new.decision_note:=null;
    new.converted_ticket_id:=null;
    new.converted_ticket_key:=null;
  else
    new.proposal_status:=null;
    new.decision_by:=null;
    new.decision_at:=null;
    new.decision_note:=null;
    new.converted_ticket_id:=null;
    new.converted_ticket_key:=null;
  end if;
  return new;
end
$$;
revoke all on function private.normalize_helpdesk_insert() from public,anon,authenticated;

create or replace function private.assign_helpdesk_key()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_seq bigint;
  v_sla integer;
begin
  insert into public.workspace_settings(workspace_id)
  values(new.workspace_id)
  on conflict (workspace_id) do nothing;

  update public.workspace_settings
  set helpdesk_seq=helpdesk_seq+1
  where workspace_id=new.workspace_id
  returning helpdesk_seq,sla_resolution_hours into v_seq,v_sla;

  new.ticket_number:=v_seq;
  new.ticket_key:='HD-'||v_seq::text;

  if new.category not in ('module','feature','new_requirement') and new.due_at is null then
    new.due_at:=now()+make_interval(hours=>coalesce(v_sla,24));
  end if;
  return new;
end
$$;
revoke all on function private.assign_helpdesk_key() from public,anon,authenticated;

create or replace function private.guard_helpdesk_requirement()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_decision_context text:=coalesce(current_setting('app.helpdesk_requirement_decision',true),'');
  v_old_proposal boolean:=old.category in ('module','feature','new_requirement');
  v_new_proposal boolean:=new.category in ('module','feature','new_requirement');
begin
  if v_old_proposal then
    if new.category is distinct from old.category then
      raise exception 'A product proposal cannot change category after creation';
    end if;
    if row(new.status,new.assigned_to,new.due_at)
       is distinct from row(old.status,old.assigned_to,old.due_at) then
      raise exception 'Product proposals do not use the operational Helpdesk status/SLA workflow';
    end if;
    if row(new.proposal_status,new.decision_by,new.decision_at,new.decision_note,new.converted_ticket_id,new.converted_ticket_key)
       is distinct from
       row(old.proposal_status,old.decision_by,old.decision_at,old.decision_note,old.converted_ticket_id,old.converted_ticket_key)
       and v_decision_context<>'1' then
      raise exception 'Use the requirement decision action to accept or reject this proposal';
    end if;
  elsif v_new_proposal then
    raise exception 'Create a product proposal as a new request instead of changing an existing Helpdesk ticket';
  end if;
  return new;
end
$$;
revoke all on function private.guard_helpdesk_requirement() from public,anon,authenticated;

drop trigger if exists trg_01_guard_helpdesk_requirement on public.helpdesk_tickets;
create trigger trg_01_guard_helpdesk_requirement
before update on public.helpdesk_tickets
for each row execute function private.guard_helpdesk_requirement();

create or replace function private.record_helpdesk_requirement_decision(
  p_helpdesk_id uuid,
  p_decision text,
  p_ticket_id uuid,
  p_ticket_key text,
  p_note text
)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_req public.helpdesk_tickets%rowtype;
  v_actor uuid:=auth.uid();
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  select * into v_req from public.helpdesk_tickets where id=p_helpdesk_id;
  if not found then raise exception 'Solicitud no encontrada'; end if;
  if not private.member_has_permission(v_req.workspace_id,v_actor,'manage_sprints') then
    raise exception 'No tienes permiso para registrar esta decisión';
  end if;

  insert into public.helpdesk_activity(helpdesk_ticket_id,actor_id,action,from_value,to_value)
  values(
    p_helpdesk_id,v_actor,'requirement_decision','pending',
    case when p_decision='accepted_backlog'
      then 'accepted_backlog:'||coalesce(p_ticket_key,'')
      else 'rejected'
    end
  );

  if v_req.requester_user_id is not null then
    insert into public.notifications(workspace_id,user_id,helpdesk_ticket_id,ticket_id,type,title,body)
    values(
      v_req.workspace_id,v_req.requester_user_id,p_helpdesk_id,p_ticket_id,
      'helpdesk_requirement_decision',
      case when p_decision='accepted_backlog'
        then coalesce(v_req.ticket_key,'Solicitud')||' aceptado a Backlog'
        else coalesce(v_req.ticket_key,'Solicitud')||' · sugerencia rechazada'
      end,
      case when p_decision='accepted_backlog'
        then 'El requerimiento fue aceptado para evaluación/desarrollo futuro como '||coalesce(p_ticket_key,'ticket de Backlog')||'.'
        else 'El requerimiento fue descartado. '||trim(coalesce(p_note,''))
      end
    );
  end if;
end
$$;
revoke all on function private.record_helpdesk_requirement_decision(uuid,text,uuid,text,text) from public,anon;
grant execute on function private.record_helpdesk_requirement_decision(uuid,text,uuid,text,text) to authenticated;

create or replace function public.decide_helpdesk_requirement(
  p_helpdesk_id uuid,
  p_decision text,
  p_product_id uuid default null,
  p_note text default null
)
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  v_req public.helpdesk_tickets%rowtype;
  v_ticket_id uuid;
  v_ticket_key text;
  v_title text;
begin
  select * into v_req from public.helpdesk_tickets where id=p_helpdesk_id for update;
  if not found then raise exception 'Solicitud no encontrada'; end if;
  if v_req.category not in ('module','feature','new_requirement') then raise exception 'La solicitud no es una propuesta de producto'; end if;
  if coalesce(v_req.proposal_status,'pending')<>'pending' then raise exception 'Este requerimiento ya fue evaluado'; end if;
  if not private.has_workspace_permission(v_req.workspace_id,'manage_sprints') then
    raise exception 'Solo PM, Admin, Superadmin o un rol con permiso de planeación puede evaluar nuevos requerimientos';
  end if;
  if p_decision not in ('accepted_backlog','rejected') then raise exception 'Decisión inválida'; end if;

  if p_decision='accepted_backlog' then
    if p_product_id is null then raise exception 'Selecciona el producto al que se enviará el requerimiento'; end if;
    if not exists(select 1 from public.products p where p.id=p_product_id and p.workspace_id=v_req.workspace_id) then
      raise exception 'El producto no pertenece a este workspace';
    end if;
    if not private.has_product_access(v_req.workspace_id,p_product_id) then
      raise exception 'No tienes acceso al producto seleccionado';
    end if;

    v_title:=left(coalesce(nullif(trim(v_req.subject),''),'Nuevo requerimiento'),220);
    insert into public.tickets(
      workspace_id,product_id,title,description,type,priority,status,reporter_id,
      sprint_id,dev_owner_id,qa_owner_id,story_points,start_date,due_date
    ) values (
      v_req.workspace_id,p_product_id,v_title,
      concat(
        'Origen: ',coalesce(v_req.ticket_key,'Helpdesk'),E'\n',
        'Tipo: ',coalesce(v_req.category,'new_requirement'),E'\n',
        'Solicitante: ',coalesce(v_req.requester_name,v_req.requester_email,'—'),E'\n\n',
        coalesce(v_req.description,'Sin descripción.'),
        case when nullif(trim(coalesce(p_note,'')),'') is not null
          then E'\n\nDecisión PM/Admin:\n'||trim(p_note) else '' end
      ),
      'improvement',v_req.priority,'backlog',auth.uid(),
      null,null,null,null,null,null
    ) returning id,ticket_key into v_ticket_id,v_ticket_key;
  else
    if nullif(trim(coalesce(p_note,'')),'') is null then
      raise exception 'Indica el motivo para rechazar la sugerencia';
    end if;
  end if;

  perform set_config('app.helpdesk_requirement_decision','1',true);
  update public.helpdesk_tickets
  set proposal_status=p_decision,
      decision_by=auth.uid(),
      decision_at=now(),
      decision_note=nullif(trim(coalesce(p_note,'')),''),
      converted_ticket_id=v_ticket_id,
      converted_ticket_key=v_ticket_key
  where id=p_helpdesk_id;

  perform private.record_helpdesk_requirement_decision(p_helpdesk_id,p_decision,v_ticket_id,v_ticket_key,p_note);

  return jsonb_build_object('ok',true,'decision',p_decision,'ticket_id',v_ticket_id,'ticket_key',v_ticket_key);
end
$$;
revoke all on function public.decide_helpdesk_requirement(uuid,text,uuid,text) from public,anon;
grant execute on function public.decide_helpdesk_requirement(uuid,text,uuid,text) to authenticated;

-- A requester can see the decision notification linked to their own Helpdesk request,
-- while the internal converted ticket remains protected by tickets RLS.
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
for select to authenticated
using (
  user_id=(select auth.uid())
  and private.is_workspace_member(workspace_id)
  and (
    (
      helpdesk_ticket_id is not null
      and exists(
        select 1 from public.helpdesk_tickets h
        where h.id=notifications.helpdesk_ticket_id
          and (
            private.has_workspace_permission(h.workspace_id,'manage_helpdesk')
            or h.requester_user_id=(select auth.uid())
          )
      )
    )
    or
    (
      helpdesk_ticket_id is null
      and (
        ticket_id is null
        or exists(
          select 1 from public.tickets t
          where t.id=notifications.ticket_id
            and private.has_workspace_permission(t.workspace_id,'view_tickets')
            and private.has_product_access(t.workspace_id,t.product_id)
        )
      )
    )
  )
);

-- Jira Interno TROBBU v14.1
-- Fixes: Staff password creation, Settings regression, Helpdesk clean intake + routing notifications.

create or replace function private.normalize_helpdesk_insert()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_email text;
  v_name text;
begin
  -- Every request created from the app portal starts as intake only, regardless of caller role.
  if new.source='portal' or not private.has_workspace_permission(new.workspace_id,'manage_helpdesk') then
    new.requester_user_id:=auth.uid();
    new.status:='created';
    new.assigned_to:=null;
    new.due_at:=null;
    new.source:='portal';

    select u.email,coalesce(p.full_name,u.raw_user_meta_data->>'full_name')
      into v_email,v_name
    from auth.users u
    left join public.profiles p on p.id=u.id
    where u.id=auth.uid();
    new.requester_email:=coalesce(v_email,new.requester_email);
    new.requester_name:=coalesce(nullif(v_name,''),new.requester_name);
  end if;

  if new.category in ('module','feature','new_requirement') then
    new.status:='created';
    new.assigned_to:=null;
    new.due_at:=null;
    new.proposal_status:='pending';
    new.decision_by:=null;
    new.decision_at:=null;
    new.decision_note:=null;
    new.converted_ticket_id:=null;
    new.converted_ticket_key:=null;
  else
    new.proposal_status:=null;
    new.decision_by:=null;
    new.decision_at:=null;
    new.decision_note:=null;
    new.converted_ticket_id:=null;
    new.converted_ticket_key:=null;
  end if;
  return new;
end
$$;
revoke all on function private.normalize_helpdesk_insert() from public,anon,authenticated;

create or replace function private.assign_helpdesk_key()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_seq bigint;
  v_sla integer;
begin
  insert into public.workspace_settings(workspace_id)
  values(new.workspace_id)
  on conflict (workspace_id) do nothing;

  update public.workspace_settings
  set helpdesk_seq=helpdesk_seq+1
  where workspace_id=new.workspace_id
  returning helpdesk_seq,sla_resolution_hours into v_seq,v_sla;

  new.ticket_number:=v_seq;
  new.ticket_key:='HD-'||v_seq::text;

  -- Portal intake is deliberately unassigned and without target date.
  -- Non-portal imported/internal requests may keep the historical automatic SLA behavior.
  if new.source<>'portal'
     and new.category not in ('module','feature','new_requirement')
     and new.due_at is null then
    new.due_at:=now()+make_interval(hours=>coalesce(v_sla,24));
  end if;
  return new;
end
$$;
revoke all on function private.assign_helpdesk_key() from public,anon,authenticated;

create or replace function private.track_helpdesk_change()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_in_app boolean:=true;
  v_resolution_hours integer:=24;
begin
  select coalesce(ws.in_app_notifications,true),coalesce(ws.sla_resolution_hours,24)
  into v_in_app,v_resolution_hours
  from public.workspace_settings ws
  where ws.workspace_id=new.workspace_id;
  if not found then v_in_app:=true;v_resolution_hours:=24; end if;

  if old.status is distinct from new.status then
    if new.status='review' and new.reviewed_at is null then
      new.reviewed_at=now();
      new.first_response_at=coalesce(new.first_response_at,now());
      new.due_at=coalesce(new.due_at,now()+make_interval(hours=>v_resolution_hours));
    end if;
    if new.status='attended' and new.attended_at is null then
      new.attended_at=now();
      new.first_response_at=coalesce(new.first_response_at,now());
      new.due_at=coalesce(new.due_at,now()+make_interval(hours=>v_resolution_hours));
    end if;
    if new.status='resolved' and new.resolved_at is null then new.resolved_at=now(); end if;
    if new.status='closed' and new.closed_at is null then new.closed_at=now(); end if;

    insert into public.helpdesk_activity(helpdesk_ticket_id,actor_id,action,from_value,to_value)
    values(new.id,auth.uid(),'status_changed',old.status,new.status);

    if v_in_app and new.requester_user_id is not null and new.requester_user_id is distinct from auth.uid() then
      insert into public.notifications(workspace_id,user_id,helpdesk_ticket_id,type,title,body)
      values(
        new.workspace_id,new.requester_user_id,new.id,'helpdesk_status',
        new.ticket_key||' actualizado',
        'El estado de tu solicitud cambió a '||
        case new.status
          when 'created' then 'Creado'
          when 'review' then 'En revisión'
          when 'attended' then 'Atendido'
          when 'resolved' then 'Resuelto'
          when 'closed' then 'Cerrado'
          else new.status
        end||'.'
      );
    end if;
  end if;

  if old.assigned_to is distinct from new.assigned_to and new.assigned_to is not null then
    insert into public.helpdesk_activity(helpdesk_ticket_id,actor_id,action,from_value,to_value)
    values(new.id,auth.uid(),'assigned',old.assigned_to::text,new.assigned_to::text);

    if v_in_app and new.assigned_to is distinct from auth.uid() then
      insert into public.notifications(workspace_id,user_id,helpdesk_ticket_id,type,title,body)
      values(new.workspace_id,new.assigned_to,new.id,'helpdesk_assigned',new.ticket_key||' asignado',new.subject);
    end if;
  end if;

  return new;
end
$$;
revoke all on function private.track_helpdesk_change() from public,anon,authenticated;

create or replace function private.helpdesk_created()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_in_app boolean:=true;
  v_proposal boolean:=new.category in ('module','feature','new_requirement');
begin
  select coalesce(ws.in_app_notifications,true) into v_in_app
  from public.workspace_settings ws where ws.workspace_id=new.workspace_id;
  if not found then v_in_app:=true; end if;

  insert into public.helpdesk_activity(helpdesk_ticket_id,actor_id,action,to_value)
  values(new.id,auth.uid(),'created',new.status);

  if v_in_app then
    if new.requester_user_id is not null then
      insert into public.notifications(workspace_id,user_id,helpdesk_ticket_id,type,title,body)
      values(
        new.workspace_id,new.requester_user_id,new.id,'helpdesk_created',
        'Solicitud creada '||new.ticket_key,
        case when v_proposal
          then 'Tu propuesta fue registrada y quedó pendiente de decisión.'
          else 'Tu solicitud fue registrada y está pendiente de canalización.'
        end
      );
    end if;

    insert into public.notifications(workspace_id,user_id,helpdesk_ticket_id,type,title,body)
    select
      new.workspace_id,wm.user_id,new.id,'helpdesk_new',
      case when v_proposal
        then 'Nueva propuesta por decidir · '||new.ticket_key
        else 'Nueva solicitud por canalizar · '||new.ticket_key
      end,
      new.subject
    from public.workspace_members wm
    where wm.workspace_id=new.workspace_id
      and wm.active=true
      and (
        wm.role in ('pm','admin','superadmin')
        or private.member_has_permission(new.workspace_id,wm.user_id,'manage_helpdesk')
      )
      and wm.user_id is distinct from new.requester_user_id;
  end if;
  return new;
end
$$;
revoke all on function private.helpdesk_created() from public,anon,authenticated;
-- Jira Interno TROBBU v14.2
-- Importación atómica de Backlog + notificaciones de seguimiento.

create or replace function public.import_backlog_tickets(p_workspace uuid,p_rows jsonb)
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  v_row jsonb;
  v_count integer:=0;
  v_keys text[]:=array[]::text[];
  v_id uuid;
  v_key text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not private.has_workspace_permission(p_workspace,'manage_sprints') then
    raise exception 'Solo PM, Admin, Superadmin o un rol con permiso de Backlog/Sprints puede importar tickets';
  end if;
  if jsonb_typeof(p_rows)<>'array' then raise exception 'Formato de importación inválido'; end if;
  if jsonb_array_length(p_rows)=0 then raise exception 'No hay filas para importar'; end if;
  if jsonb_array_length(p_rows)>250 then raise exception 'Máximo 250 tickets por importación'; end if;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    if coalesce(nullif(trim(v_row->>'title'),''),'')='' then raise exception 'Todos los tickets requieren título'; end if;
    if coalesce(nullif(v_row->>'product_id',''),'')='' then raise exception 'Todos los tickets requieren producto'; end if;

    insert into public.tickets(
      workspace_id,product_id,title,description,type,priority,status,reporter_id,
      sprint_id,dev_owner_id,qa_owner_id,story_points,start_date,due_date
    ) values (
      p_workspace,
      (v_row->>'product_id')::uuid,
      left(trim(v_row->>'title'),220),
      nullif(trim(coalesce(v_row->>'description','')),''),
      coalesce(nullif(v_row->>'type',''),'task')::public.ticket_type,
      coalesce(nullif(v_row->>'priority',''),'medium')::public.ticket_priority,
      'backlog'::public.ticket_status,
      auth.uid(),
      null,
      nullif(v_row->>'dev_owner_id','')::uuid,
      nullif(v_row->>'qa_owner_id','')::uuid,
      case when nullif(v_row->>'story_points','') is null then null else (v_row->>'story_points')::integer end,
      nullif(v_row->>'start_date','')::date,
      nullif(v_row->>'due_date','')::date
    )
    returning id,ticket_key into v_id,v_key;

    v_count:=v_count+1;
    v_keys:=array_append(v_keys,v_key);
  end loop;

  return jsonb_build_object('ok',true,'imported',v_count,'ticket_keys',to_jsonb(v_keys));
end
$$;
revoke all on function public.import_backlog_tickets(uuid,jsonb) from public,anon;
grant execute on function public.import_backlog_tickets(uuid,jsonb) to authenticated;

create or replace function private.notify_ticket_comment_created()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_ticket public.tickets%rowtype;
  v_in_app boolean:=true;
begin
  select * into v_ticket from public.tickets where id=new.ticket_id;
  if not found then return new; end if;
  select coalesce(in_app_notifications,true) into v_in_app
  from public.workspace_settings where workspace_id=v_ticket.workspace_id;
  if not found then v_in_app:=true; end if;

  if v_in_app then
    insert into public.notifications(workspace_id,user_id,ticket_id,type,title,body)
    select distinct
      v_ticket.workspace_id,u.user_id,v_ticket.id,'ticket_comment',
      v_ticket.ticket_key||' · nuevo seguimiento',
      left(coalesce(new.body,'Nuevo comentario'),180)
    from (values (v_ticket.reporter_id),(v_ticket.dev_owner_id),(v_ticket.qa_owner_id)) as u(user_id)
    where u.user_id is not null and u.user_id is distinct from new.author_id;
  end if;
  return new;
end
$$;
revoke all on function private.notify_ticket_comment_created() from public,anon,authenticated;

drop trigger if exists trg_notify_ticket_comment_created on public.ticket_comments;
create trigger trg_notify_ticket_comment_created
after insert on public.ticket_comments
for each row execute function private.notify_ticket_comment_created();

create or replace function private.notify_helpdesk_comment_created()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_req public.helpdesk_tickets%rowtype;
  v_in_app boolean:=true;
begin
  select * into v_req from public.helpdesk_tickets where id=new.helpdesk_ticket_id;
  if not found then return new; end if;
  select coalesce(in_app_notifications,true) into v_in_app
  from public.workspace_settings where workspace_id=v_req.workspace_id;
  if not found then v_in_app:=true; end if;

  if v_in_app then
    insert into public.notifications(workspace_id,user_id,helpdesk_ticket_id,type,title,body)
    select distinct v_req.workspace_id,x.user_id,v_req.id,'helpdesk_comment',
      v_req.ticket_key||' · nuevo seguimiento',
      left(coalesce(new.body,'Nuevo comentario'),180)
    from (
      select v_req.requester_user_id as user_id
      union
      select v_req.assigned_to
      union
      select wm.user_id
      from public.workspace_members wm
      where v_req.assigned_to is null
        and wm.workspace_id=v_req.workspace_id
        and wm.active=true
        and (
          wm.role in ('pm','admin','superadmin')
          or private.member_has_permission(v_req.workspace_id,wm.user_id,'manage_helpdesk')
        )
    ) x
    where x.user_id is not null and x.user_id is distinct from new.author_id;
  end if;
  return new;
end
$$;
revoke all on function private.notify_helpdesk_comment_created() from public,anon,authenticated;

drop trigger if exists trg_notify_helpdesk_comment_created on public.helpdesk_comments;
create trigger trg_notify_helpdesk_comment_created
after insert on public.helpdesk_comments
for each row execute function private.notify_helpdesk_comment_created();

create or replace function private.track_ticket_change()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_in_app boolean := true;
  v_email boolean := true;
begin
  select coalesce(ws.in_app_notifications,true),coalesce(ws.email_notifications,true)
  into v_in_app,v_email
  from public.workspace_settings ws
  where ws.workspace_id=new.workspace_id;
  if not found then v_in_app:=true; v_email:=true; end if;

  if old.status is distinct from new.status then
    if new.status='in_progress' and new.start_date is null then new.start_date:=current_date; end if;
    if new.status='dev_done' and new.dev_completed_at is null then new.dev_completed_at:=now(); end if;
    if new.status='qa_passed' and new.qa_completed_at is null then new.qa_completed_at:=now(); end if;
    if new.status='closed' and new.closed_at is null then new.closed_at:=now(); end if;

    insert into public.ticket_activity(ticket_id,actor_id,action,from_value,to_value)
    values(new.id,auth.uid(),'status_changed',old.status::text,new.status::text);

    if v_in_app and new.reporter_id is not null and new.reporter_id is distinct from auth.uid() then
      insert into public.notifications(workspace_id,user_id,ticket_id,type,title,body)
      values(new.workspace_id,new.reporter_id,new.id,'ticket_status',new.ticket_key||' actualizado','El estado cambió de '||old.status::text||' a '||new.status::text||'.');
    end if;

    if new.status in ('dev_done','qa_review') and new.qa_owner_id is not null and new.qa_owner_id is distinct from auth.uid() and v_in_app then
      insert into public.notifications(workspace_id,user_id,ticket_id,type,title,body)
      values(new.workspace_id,new.qa_owner_id,new.id,'qa_ready',new.ticket_key||' listo para QA',case when new.status='dev_done' then 'Desarrollo marcó el ticket como terminado y requiere revisión QA.' else 'El ticket está en revisión QA.' end);
    end if;

    if new.status='qa_rejected' and new.dev_owner_id is not null then
      if v_email then
        insert into public.notification_outbox(workspace_id,ticket_id,recipient_user_id,event_type,payload)
        values(new.workspace_id,new.id,new.dev_owner_id,'qa_rejected',jsonb_build_object('ticket_key',new.ticket_key,'title',new.title,'status',new.status));
      end if;
      if v_in_app and new.dev_owner_id is distinct from auth.uid() then
        insert into public.notifications(workspace_id,user_id,ticket_id,type,title,body)
        values(new.workspace_id,new.dev_owner_id,new.id,'qa_rejected',new.ticket_key||' regresado por QA','Requiere correcciones antes de volver a revisión.');
      end if;
    end if;

    if new.status='qa_passed' and new.dev_owner_id is not null and new.dev_owner_id is distinct from auth.uid() and v_in_app then
      insert into public.notifications(workspace_id,user_id,ticket_id,type,title,body)
      values(new.workspace_id,new.dev_owner_id,new.id,'qa_passed',new.ticket_key||' aprobado por QA','La revisión QA fue aprobada.');
    end if;

    if new.status='closed' and v_in_app then
      insert into public.notifications(workspace_id,user_id,ticket_id,type,title,body)
      select distinct new.workspace_id,u.user_id,new.id,'ticket_closed',new.ticket_key||' cerrado','El ticket fue cerrado completamente.'
      from (values (new.dev_owner_id),(new.qa_owner_id)) u(user_id)
      where u.user_id is not null and u.user_id is distinct from auth.uid() and u.user_id is distinct from new.reporter_id;
    end if;
  end if;

  if old.dev_owner_id is distinct from new.dev_owner_id and new.dev_owner_id is not null then
    if v_email then
      insert into public.notification_outbox(workspace_id,ticket_id,recipient_user_id,event_type,payload)
      values(new.workspace_id,new.id,new.dev_owner_id,'assigned_dev',jsonb_build_object('ticket_key',new.ticket_key,'title',new.title));
    end if;
    if v_in_app and new.dev_owner_id is distinct from auth.uid() then
      insert into public.notifications(workspace_id,user_id,ticket_id,type,title,body)
      values(new.workspace_id,new.dev_owner_id,new.id,'assigned_dev','Ticket asignado '||new.ticket_key,new.title);
    end if;
  end if;

  if old.qa_owner_id is distinct from new.qa_owner_id and new.qa_owner_id is not null then
    if v_email then
      insert into public.notification_outbox(workspace_id,ticket_id,recipient_user_id,event_type,payload)
      values(new.workspace_id,new.id,new.qa_owner_id,'assigned_qa',jsonb_build_object('ticket_key',new.ticket_key,'title',new.title));
    end if;
    if v_in_app and new.qa_owner_id is distinct from auth.uid() then
      insert into public.notifications(workspace_id,user_id,ticket_id,type,title,body)
      values(new.workspace_id,new.qa_owner_id,new.id,'assigned_qa','Ticket asignado a QA '||new.ticket_key,new.title);
    end if;
  end if;

  return new;
end
$$;

-- v14.2 PM planning visibility for product assignments.
drop policy if exists member_products_select on public.workspace_member_products;
create policy member_products_select on public.workspace_member_products
for select to authenticated
using (
  user_id=(select auth.uid())
  or private.has_workspace_permission(workspace_id,'manage_staff')
  or private.has_workspace_permission(workspace_id,'manage_sprints')
);

-- Jira Interno TROBBU v15
-- Relaciones entre tickets, módulos/grupos, tags, campos personalizados y reportes.

-- 1) Permiso dedicado para administrar metadatos de tickets.
create or replace function private.role_default_permission(p_role public.app_role,p_permission text)
returns boolean
language sql
immutable
security invoker
set search_path=public,pg_temp
as $$
  select case
    when p_role='superadmin' then true
    when p_role='admin' then p_permission in (
      'view_dashboard','view_tickets','create_tickets','edit_tickets','delete_tickets',
      'manage_sprints','qa_review','manage_helpdesk','manage_staff','manage_products','manage_settings',
      'manage_ticket_fields'
    )
    when p_role='pm' then p_permission in (
      'view_dashboard','view_tickets','create_tickets','edit_tickets','delete_tickets',
      'manage_sprints','qa_review','manage_helpdesk','manage_ticket_fields'
    )
    when p_role='dev' then p_permission in (
      'view_dashboard','view_tickets','create_tickets','edit_tickets'
    )
    when p_role='qa' then p_permission in (
      'view_dashboard','view_tickets','create_tickets','edit_tickets','qa_review'
    )
    when p_role='consulta' then p_permission in ('view_dashboard','view_tickets')
    else false
  end;
$$;

-- 2) Story Points 1..5.
alter table public.tickets drop constraint if exists tickets_story_points_v15_check;
alter table public.tickets add constraint tickets_story_points_v15_check
  check (story_points is null or (story_points between 1 and 5 and story_points = trunc(story_points)));

-- 3) Secuencia de módulos por workspace.
alter table public.workspace_settings add column if not exists module_seq bigint not null default 0;

create table if not exists public.ticket_modules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  module_number bigint,
  module_key text not null,
  name text not null,
  description text,
  color text not null default '#4D5A51',
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,module_key),
  unique(id,workspace_id)
);
create index if not exists idx_ticket_modules_workspace on public.ticket_modules(workspace_id,active,name);

alter table public.tickets add column if not exists module_id uuid;
alter table public.tickets drop constraint if exists tickets_module_workspace_fkey;
alter table public.tickets add constraint tickets_module_workspace_fkey
  foreign key(module_id,workspace_id)
  references public.ticket_modules(id,workspace_id)
  on delete set null;
create index if not exists idx_tickets_module on public.tickets(workspace_id,module_id,status);

create table if not exists public.ticket_tags (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  color text not null default '#0D47A1',
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,slug),
  unique(id,workspace_id)
);
create index if not exists idx_ticket_tags_workspace on public.ticket_tags(workspace_id,active,name);

create table if not exists public.ticket_tag_links (
  workspace_id uuid not null,
  ticket_id uuid not null,
  tag_id uuid not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key(ticket_id,tag_id),
  foreign key(ticket_id,workspace_id) references public.tickets(id,workspace_id) on delete cascade,
  foreign key(tag_id,workspace_id) references public.ticket_tags(id,workspace_id) on delete cascade
);
create index if not exists idx_ticket_tag_links_workspace on public.ticket_tag_links(workspace_id,tag_id,ticket_id);

create table if not exists public.ticket_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_ticket_id uuid not null,
  target_ticket_id uuid not null,
  link_type text not null check(link_type in ('blocks','relates','follows')),
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check(source_ticket_id<>target_ticket_id),
  unique(workspace_id,source_ticket_id,target_ticket_id,link_type),
  foreign key(source_ticket_id,workspace_id) references public.tickets(id,workspace_id) on delete cascade,
  foreign key(target_ticket_id,workspace_id) references public.tickets(id,workspace_id) on delete cascade
);
create index if not exists idx_ticket_links_source on public.ticket_links(workspace_id,source_ticket_id,link_type);
create index if not exists idx_ticket_links_target on public.ticket_links(workspace_id,target_ticket_id,link_type);

create table if not exists public.custom_ticket_fields (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  field_key text not null,
  description text,
  field_type text not null check(field_type in ('text','textarea','number','date','boolean','select','multiselect','url')),
  required boolean not null default false,
  placeholder text,
  options jsonb not null default '[]'::jsonb,
  applies_to_all_products boolean not null default true,
  sort_order integer not null default 100,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,field_key),
  unique(id,workspace_id)
);
create index if not exists idx_custom_ticket_fields_workspace on public.custom_ticket_fields(workspace_id,active,sort_order);

create table if not exists public.custom_ticket_field_products (
  workspace_id uuid not null,
  field_id uuid not null,
  product_id uuid not null,
  primary key(field_id,product_id),
  foreign key(field_id,workspace_id) references public.custom_ticket_fields(id,workspace_id) on delete cascade,
  foreign key(product_id,workspace_id) references public.products(id,workspace_id) on delete cascade
);

create table if not exists public.ticket_custom_field_values (
  workspace_id uuid not null,
  ticket_id uuid not null,
  field_id uuid not null,
  value jsonb not null default 'null'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(ticket_id,field_id),
  foreign key(ticket_id,workspace_id) references public.tickets(id,workspace_id) on delete cascade,
  foreign key(field_id,workspace_id) references public.custom_ticket_fields(id,workspace_id) on delete cascade
);
create index if not exists idx_ticket_custom_values_workspace on public.ticket_custom_field_values(workspace_id,field_id,ticket_id);

create table if not exists public.executive_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  report_type text not null default 'executive' check(report_type in ('executive','chat','infographic')),
  question text,
  metrics jsonb not null default '{}'::jsonb,
  content text,
  provider text not null default 'deterministic',
  model text,
  generated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_executive_reports_workspace on public.executive_reports(workspace_id,created_at desc);

-- Updated-at triggers.
drop trigger if exists trg_ticket_modules_updated on public.ticket_modules;
create trigger trg_ticket_modules_updated before update on public.ticket_modules for each row execute function public.set_updated_at();
drop trigger if exists trg_ticket_tags_updated on public.ticket_tags;
create trigger trg_ticket_tags_updated before update on public.ticket_tags for each row execute function public.set_updated_at();
drop trigger if exists trg_custom_ticket_fields_updated on public.custom_ticket_fields;
create trigger trg_custom_ticket_fields_updated before update on public.custom_ticket_fields for each row execute function public.set_updated_at();
drop trigger if exists trg_ticket_custom_field_values_updated on public.ticket_custom_field_values;
create trigger trg_ticket_custom_field_values_updated before update on public.ticket_custom_field_values for each row execute function public.set_updated_at();

-- Auto-claves.
create or replace function private.assign_ticket_module_key()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_seq bigint;
begin
  if new.module_key is null or btrim(new.module_key)='' then
    update public.workspace_settings set module_seq=module_seq+1
    where workspace_id=new.workspace_id returning module_seq into v_seq;
    if v_seq is null then
      insert into public.workspace_settings(workspace_id,module_seq) values(new.workspace_id,1)
      on conflict(workspace_id) do update set module_seq=public.workspace_settings.module_seq+1
      returning module_seq into v_seq;
    end if;
    new.module_number:=v_seq;
    new.module_key:='MOD-'||lpad(v_seq::text,3,'0');
  end if;
  return new;
end
$$;
revoke all on function private.assign_ticket_module_key() from public,anon,authenticated;
drop trigger if exists trg_assign_ticket_module_key on public.ticket_modules;
create trigger trg_assign_ticket_module_key before insert on public.ticket_modules for each row execute function private.assign_ticket_module_key();

create or replace function private.normalize_ticket_tag()
returns trigger
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
begin
  new.name:=btrim(new.name);
  if new.slug is null or btrim(new.slug)='' then
    new.slug:=trim(both '-' from regexp_replace(lower(new.name),'[^a-z0-9]+','-','g'));
  else
    new.slug:=trim(both '-' from regexp_replace(lower(new.slug),'[^a-z0-9]+','-','g'));
  end if;
  if new.slug='' then raise exception 'La etiqueta necesita un nombre válido'; end if;
  return new;
end
$$;
drop trigger if exists trg_normalize_ticket_tag on public.ticket_tags;
create trigger trg_normalize_ticket_tag before insert or update on public.ticket_tags for each row execute function private.normalize_ticket_tag();

create or replace function private.normalize_custom_field_key()
returns trigger
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
begin
  new.name:=btrim(new.name);
  if new.field_key is null or btrim(new.field_key)='' then
    new.field_key:=trim(both '_' from regexp_replace(lower(new.name),'[^a-z0-9]+','_','g'));
  else
    new.field_key:=trim(both '_' from regexp_replace(lower(new.field_key),'[^a-z0-9]+','_','g'));
  end if;
  if new.field_key='' then raise exception 'El campo necesita una clave válida'; end if;
  if new.field_type in ('select','multiselect') and jsonb_typeof(new.options)<>'array' then
    raise exception 'Las opciones deben ser una lista';
  end if;
  return new;
end
$$;
drop trigger if exists trg_normalize_custom_field_key on public.custom_ticket_fields;
create trigger trg_normalize_custom_field_key before insert or update on public.custom_ticket_fields for each row execute function private.normalize_custom_field_key();

-- Relaciones: sin duplicados inversos para relates y sin ciclos para blocks.
create or replace function private.guard_ticket_link()
returns trigger
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare v_cycle boolean;
begin
  if new.source_ticket_id=new.target_ticket_id then raise exception 'Un ticket no puede relacionarse consigo mismo'; end if;

  if new.link_type='relates' and exists(
    select 1 from public.ticket_links l
    where l.workspace_id=new.workspace_id and l.link_type='relates'
      and l.source_ticket_id=new.target_ticket_id and l.target_ticket_id=new.source_ticket_id
      and (tg_op='INSERT' or l.id<>new.id)
  ) then raise exception 'Esta relación ya existe'; end if;

  if new.link_type='blocks' then
    with recursive chain(id) as (
      select l.target_ticket_id
      from public.ticket_links l
      where l.workspace_id=new.workspace_id and l.link_type='blocks' and l.source_ticket_id=new.target_ticket_id
        and (tg_op='INSERT' or l.id<>new.id)
      union
      select l.target_ticket_id
      from public.ticket_links l join chain c on l.source_ticket_id=c.id
      where l.workspace_id=new.workspace_id and l.link_type='blocks'
        and (tg_op='INSERT' or l.id<>new.id)
    )
    select exists(select 1 from chain where id=new.source_ticket_id) into v_cycle;
    if v_cycle then raise exception 'La dependencia crearía un ciclo de bloqueo'; end if;
  end if;
  return new;
end
$$;
drop trigger if exists trg_guard_ticket_link on public.ticket_links;
create trigger trg_guard_ticket_link before insert or update on public.ticket_links for each row execute function private.guard_ticket_link();

create or replace function private.ticket_has_open_blockers(p_ticket uuid)
returns boolean
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select exists(
    select 1 from public.ticket_links l
    join public.tickets blocker on blocker.id=l.source_ticket_id
    where l.target_ticket_id=p_ticket and l.link_type='blocks'
      and blocker.status not in ('qa_passed','closed')
  );
$$;
revoke all on function private.ticket_has_open_blockers(uuid) from public,anon;
grant execute on function private.ticket_has_open_blockers(uuid) to authenticated;

create or replace function private.guard_ticket_blocked_transition()
returns trigger
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
begin
  if new.status is distinct from old.status
     and new.status in ('in_progress','dev_done','qa_review','qa_rejected','qa_passed','closed')
     and coalesce(current_setting('app.ticket_dependency_override',true),'')<>'1'
     and private.ticket_has_open_blockers(new.id) then
    raise exception 'El ticket está bloqueado por dependencias pendientes';
  end if;
  return new;
end
$$;
drop trigger if exists trg_guard_ticket_blocked_transition on public.tickets;
create trigger trg_guard_ticket_blocked_transition before update of status on public.tickets for each row execute function private.guard_ticket_blocked_transition();

create or replace function private.record_dependency_override(p_ticket uuid,p_note text)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_workspace uuid;
begin
  select workspace_id into v_workspace from public.tickets where id=p_ticket;
  if v_workspace is null then raise exception 'Ticket no encontrado'; end if;
  if not private.has_workspace_role(v_workspace,array['superadmin','admin']::public.app_role[]) then
    raise exception 'Solo Admin o Superadmin puede forzar el avance de un ticket bloqueado';
  end if;
  insert into public.ticket_activity(ticket_id,actor_id,action,metadata)
  values(p_ticket,auth.uid(),'dependency_override',jsonb_build_object('note',coalesce(nullif(btrim(p_note),''),'Sin comentario')));
end
$$;
revoke all on function private.record_dependency_override(uuid,text) from public,anon;
grant execute on function private.record_dependency_override(uuid,text) to authenticated;

create or replace function public.transition_ticket_status(
  p_ticket_id uuid,
  p_status public.ticket_status,
  p_override_blockers boolean default false,
  p_note text default null
)
returns public.tickets
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare v_ticket public.tickets%rowtype;
begin
  select * into v_ticket from public.tickets where id=p_ticket_id;
  if not found then raise exception 'Ticket no encontrado o no autorizado'; end if;
  if not private.has_workspace_permission(v_ticket.workspace_id,'edit_tickets')
     or not private.has_product_access(v_ticket.workspace_id,v_ticket.product_id) then
    raise exception 'No tienes permiso para editar este ticket';
  end if;

  if p_override_blockers then
    if not private.has_workspace_role(v_ticket.workspace_id,array['superadmin','admin']::public.app_role[]) then
      raise exception 'Solo Admin o Superadmin puede forzar el avance';
    end if;
    perform set_config('app.ticket_dependency_override','1',true);
    perform private.record_dependency_override(p_ticket_id,p_note);
  end if;

  update public.tickets set status=p_status where id=p_ticket_id returning * into v_ticket;
  return v_ticket;
end
$$;
revoke all on function public.transition_ticket_status(uuid,public.ticket_status,boolean,text) from public,anon;
grant execute on function public.transition_ticket_status(uuid,public.ticket_status,boolean,text) to authenticated;

-- Validación de valores de campos personalizados.
create or replace function private.validate_custom_field_value()
returns trigger
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare f public.custom_ticket_fields%rowtype;
declare txt text;
begin
  select * into f from public.custom_ticket_fields where id=new.field_id and workspace_id=new.workspace_id and active;
  if not found then raise exception 'Campo personalizado no disponible'; end if;

  if new.value='null'::jsonb then
    if f.required then raise exception 'El campo % es obligatorio',f.name; end if;
    return new;
  end if;

  if f.field_type in ('text','textarea','date','url','select') and jsonb_typeof(new.value)<>'string' then
    raise exception 'El campo % requiere texto',f.name;
  elsif f.field_type='number' and jsonb_typeof(new.value)<>'number' then
    raise exception 'El campo % requiere número',f.name;
  elsif f.field_type='boolean' and jsonb_typeof(new.value)<>'boolean' then
    raise exception 'El campo % requiere Sí/No',f.name;
  elsif f.field_type='multiselect' and jsonb_typeof(new.value)<>'array' then
    raise exception 'El campo % requiere una lista',f.name;
  end if;

  if f.field_type='date' then
    txt:=trim(both '"' from new.value::text);
    begin perform txt::date; exception when others then raise exception 'El campo % requiere fecha AAAA-MM-DD',f.name; end;
  end if;

  if f.field_type='select' and jsonb_array_length(f.options)>0 and not exists(
    select 1 from jsonb_array_elements_text(f.options) x(value)
    where x.value=trim(both '"' from new.value::text)
  ) then raise exception 'Valor inválido para %',f.name; end if;

  if f.field_type='multiselect' and jsonb_array_length(f.options)>0 and exists(
    select 1 from jsonb_array_elements_text(new.value) v(value)
    where not exists(select 1 from jsonb_array_elements_text(f.options) o(value) where o.value=v.value)
  ) then raise exception 'Valor inválido para %',f.name; end if;

  new.updated_by:=coalesce(new.updated_by,auth.uid());
  return new;
end
$$;
drop trigger if exists trg_validate_custom_field_value on public.ticket_custom_field_values;
create trigger trg_validate_custom_field_value before insert or update on public.ticket_custom_field_values for each row execute function private.validate_custom_field_value();

-- Reporte determinístico por workspace/producto.
create or replace function public.get_workspace_progress_report(p_workspace uuid,p_as_of date default current_date)
returns jsonb
language plpgsql
stable
security invoker
set search_path=public,pg_temp
as $$
declare result jsonb;
declare week_end date:=p_as_of + (7-extract(isodow from p_as_of)::int);
begin
  if not private.has_workspace_permission(p_workspace,'view_dashboard') then
    raise exception 'No tienes permiso para consultar reportes de este workspace';
  end if;

  with visible_tickets as (
    select t.*,
      coalesce(t.story_points,1)::numeric as weight,
      case t.status
        when 'backlog' then 0 when 'todo' then 10 when 'in_progress' then 45 when 'dev_done' then 65
        when 'qa_review' then 78 when 'qa_rejected' then 58 when 'qa_passed' then 92 when 'closed' then 100 else 0 end::numeric as progress
    from public.tickets t
    where t.workspace_id=p_workspace and private.has_product_access(t.workspace_id,t.product_id)
  ), product_rows as (
    select p.id,p.key,p.name,
      count(v.id)::int total_tickets,
      coalesce(sum(v.weight),0)::numeric total_sp,
      coalesce(round(sum(v.weight*v.progress)/nullif(sum(v.weight),0),1),0) progress_percent,
      count(v.id) filter(where v.status='backlog')::int backlog,
      count(v.id) filter(where v.status in ('todo','in_progress','dev_done'))::int development,
      count(v.id) filter(where v.status in ('qa_review','qa_rejected','qa_passed'))::int qa,
      count(v.id) filter(where v.status='closed')::int closed,
      count(v.id) filter(where v.due_date<p_as_of and v.status not in ('qa_passed','closed'))::int overdue,
      count(v.id) filter(where v.due_date between p_as_of and week_end and v.status not in ('closed'))::int due_this_week,
      coalesce(sum(v.weight) filter(where v.due_date between p_as_of and week_end and v.status not in ('closed')),0)::numeric sp_due_this_week,
      count(v.id) filter(where private.ticket_has_open_blockers(v.id))::int blocked
    from public.products p
    left join visible_tickets v on v.product_id=p.id
    where p.workspace_id=p_workspace and private.has_product_access(p.workspace_id,p.id)
    group by p.id,p.key,p.name,p.board_order
    order by p.board_order
  ), sprint_rows as (
    select s.id,s.name,s.status,s.start_date,s.end_date,
      count(v.id)::int total_tickets,
      count(v.id) filter(where v.status in ('qa_passed','closed'))::int completed,
      count(v.id) filter(where v.status not in ('qa_passed','closed'))::int remaining,
      coalesce(sum(v.weight),0)::numeric total_sp,
      coalesce(sum(v.weight) filter(where v.status in ('qa_passed','closed')),0)::numeric completed_sp,
      count(v.id) filter(where private.ticket_has_open_blockers(v.id))::int blocked,
      count(v.id) filter(where v.due_date is not null and v.due_date<=coalesce(s.end_date,p_as_of) and v.status not in ('closed'))::int planned_by_sprint_end,
      coalesce(round(100.0*count(v.id) filter(where v.status in ('qa_passed','closed'))/nullif(count(v.id),0),1),0) progress_percent
    from public.sprints s
    left join visible_tickets v on v.sprint_id=s.id
    where s.workspace_id=p_workspace
      and (s.status='active' or (p_as_of between coalesce(s.start_date,p_as_of) and coalesce(s.end_date,p_as_of)))
    group by s.id,s.name,s.status,s.start_date,s.end_date
    order by s.start_date desc nulls last
    limit 3
  ), module_rows as (
    select m.id,m.module_key,m.name,m.color,
      count(v.id)::int total_tickets,
      coalesce(sum(v.weight),0)::numeric total_sp,
      coalesce(round(sum(v.weight*v.progress)/nullif(sum(v.weight),0),1),0) progress_percent,
      count(v.id) filter(where v.status='closed')::int closed
    from public.ticket_modules m
    left join visible_tickets v on v.module_id=m.id
    where m.workspace_id=p_workspace and m.active
    group by m.id,m.module_key,m.name,m.color
    having count(v.id)>0
    order by count(v.id) desc,m.name
  ), totals as (
    select count(*)::int total_tickets,
      coalesce(sum(weight),0)::numeric total_sp,
      coalesce(round(sum(weight*progress)/nullif(sum(weight),0),1),0) progress_percent,
      count(*) filter(where status='closed')::int closed,
      count(*) filter(where status='backlog')::int backlog,
      count(*) filter(where due_date<p_as_of and status not in ('qa_passed','closed'))::int overdue,
      count(*) filter(where due_date between p_as_of and week_end and status not in ('closed'))::int due_this_week,
      count(*) filter(where private.ticket_has_open_blockers(id))::int blocked
    from visible_tickets
  )
  select jsonb_build_object(
    'as_of',p_as_of,
    'week_end',week_end,
    'workspace_id',p_workspace,
    'workspace',(select jsonb_build_object('name',w.name,'slug',w.slug) from public.workspaces w where w.id=p_workspace),
    'totals',(select to_jsonb(totals) from totals),
    'products',coalesce((select jsonb_agg(to_jsonb(product_rows)) from product_rows),'[]'::jsonb),
    'active_sprints',coalesce((select jsonb_agg(to_jsonb(sprint_rows)) from sprint_rows),'[]'::jsonb),
    'modules',coalesce((select jsonb_agg(to_jsonb(module_rows)) from module_rows),'[]'::jsonb)
  ) into result;
  return result;
end
$$;
revoke all on function public.get_workspace_progress_report(uuid,date) from public,anon;
grant execute on function public.get_workspace_progress_report(uuid,date) to authenticated;

-- RLS / grants.
alter table public.ticket_modules enable row level security;
alter table public.ticket_tags enable row level security;
alter table public.ticket_tag_links enable row level security;
alter table public.ticket_links enable row level security;
alter table public.custom_ticket_fields enable row level security;
alter table public.custom_ticket_field_products enable row level security;
alter table public.ticket_custom_field_values enable row level security;
alter table public.executive_reports enable row level security;

grant select,insert,update,delete on public.ticket_modules,public.ticket_tags,public.ticket_tag_links,public.ticket_links,public.custom_ticket_fields,public.custom_ticket_field_products,public.ticket_custom_field_values,public.executive_reports to authenticated;

-- Modules.
drop policy if exists ticket_modules_select on public.ticket_modules;
create policy ticket_modules_select on public.ticket_modules for select to authenticated using(
  private.is_workspace_member(workspace_id) and (
    private.has_workspace_permission(workspace_id,'view_tickets') or private.has_workspace_permission(workspace_id,'manage_ticket_fields')
  )
);
drop policy if exists ticket_modules_manage on public.ticket_modules;
create policy ticket_modules_manage on public.ticket_modules for all to authenticated
using(private.has_workspace_permission(workspace_id,'manage_ticket_fields'))
with check(private.has_workspace_permission(workspace_id,'manage_ticket_fields'));

-- Tags catalog.
drop policy if exists ticket_tags_select on public.ticket_tags;
create policy ticket_tags_select on public.ticket_tags for select to authenticated using(
  private.is_workspace_member(workspace_id) and (
    private.has_workspace_permission(workspace_id,'view_tickets') or private.has_workspace_permission(workspace_id,'create_tickets') or private.has_workspace_permission(workspace_id,'manage_ticket_fields')
  )
);
drop policy if exists ticket_tags_manage on public.ticket_tags;
create policy ticket_tags_manage on public.ticket_tags for all to authenticated
using(private.has_workspace_permission(workspace_id,'manage_ticket_fields'))
with check(private.has_workspace_permission(workspace_id,'manage_ticket_fields'));

-- Tag links.
drop policy if exists ticket_tag_links_select on public.ticket_tag_links;
create policy ticket_tag_links_select on public.ticket_tag_links for select to authenticated using(
  exists(select 1 from public.tickets t where t.id=ticket_id and t.workspace_id=ticket_tag_links.workspace_id
    and private.has_workspace_permission(t.workspace_id,'view_tickets') and private.has_product_access(t.workspace_id,t.product_id))
);
drop policy if exists ticket_tag_links_insert on public.ticket_tag_links;
create policy ticket_tag_links_insert on public.ticket_tag_links for insert to authenticated with check(
  created_by=(select auth.uid()) and exists(select 1 from public.tickets t where t.id=ticket_id and t.workspace_id=ticket_tag_links.workspace_id
    and private.has_workspace_permission(t.workspace_id,'edit_tickets') and private.has_product_access(t.workspace_id,t.product_id))
);
drop policy if exists ticket_tag_links_delete on public.ticket_tag_links;
create policy ticket_tag_links_delete on public.ticket_tag_links for delete to authenticated using(
  exists(select 1 from public.tickets t where t.id=ticket_id and t.workspace_id=ticket_tag_links.workspace_id
    and private.has_workspace_permission(t.workspace_id,'edit_tickets') and private.has_product_access(t.workspace_id,t.product_id))
);

-- Ticket links.
drop policy if exists ticket_links_select on public.ticket_links;
create policy ticket_links_select on public.ticket_links for select to authenticated using(
  exists(select 1 from public.tickets s where s.id=source_ticket_id and s.workspace_id=ticket_links.workspace_id
    and private.has_workspace_permission(s.workspace_id,'view_tickets') and private.has_product_access(s.workspace_id,s.product_id))
  and exists(select 1 from public.tickets t where t.id=target_ticket_id and t.workspace_id=ticket_links.workspace_id
    and private.has_workspace_permission(t.workspace_id,'view_tickets') and private.has_product_access(t.workspace_id,t.product_id))
);
drop policy if exists ticket_links_insert on public.ticket_links;
create policy ticket_links_insert on public.ticket_links for insert to authenticated with check(
  created_by=(select auth.uid())
  and exists(select 1 from public.tickets s where s.id=source_ticket_id and s.workspace_id=ticket_links.workspace_id
    and private.has_workspace_permission(s.workspace_id,'edit_tickets') and private.has_product_access(s.workspace_id,s.product_id))
  and exists(select 1 from public.tickets t where t.id=target_ticket_id and t.workspace_id=ticket_links.workspace_id
    and private.has_workspace_permission(t.workspace_id,'view_tickets') and private.has_product_access(t.workspace_id,t.product_id))
);
drop policy if exists ticket_links_delete on public.ticket_links;
create policy ticket_links_delete on public.ticket_links for delete to authenticated using(
  exists(select 1 from public.tickets s where s.id=source_ticket_id and s.workspace_id=ticket_links.workspace_id
    and private.has_workspace_permission(s.workspace_id,'edit_tickets') and private.has_product_access(s.workspace_id,s.product_id))
);

-- Custom field definitions.
drop policy if exists custom_ticket_fields_select on public.custom_ticket_fields;
create policy custom_ticket_fields_select on public.custom_ticket_fields for select to authenticated using(
  private.is_workspace_member(workspace_id) and (
    private.has_workspace_permission(workspace_id,'view_tickets') or private.has_workspace_permission(workspace_id,'create_tickets') or private.has_workspace_permission(workspace_id,'manage_ticket_fields')
  )
);
drop policy if exists custom_ticket_fields_manage on public.custom_ticket_fields;
create policy custom_ticket_fields_manage on public.custom_ticket_fields for all to authenticated
using(private.has_workspace_permission(workspace_id,'manage_ticket_fields'))
with check(private.has_workspace_permission(workspace_id,'manage_ticket_fields'));

drop policy if exists custom_ticket_field_products_select on public.custom_ticket_field_products;
create policy custom_ticket_field_products_select on public.custom_ticket_field_products for select to authenticated using(
  private.is_workspace_member(workspace_id)
);
drop policy if exists custom_ticket_field_products_manage on public.custom_ticket_field_products;
create policy custom_ticket_field_products_manage on public.custom_ticket_field_products for all to authenticated
using(private.has_workspace_permission(workspace_id,'manage_ticket_fields'))
with check(private.has_workspace_permission(workspace_id,'manage_ticket_fields'));

-- Custom values.
drop policy if exists ticket_custom_values_select on public.ticket_custom_field_values;
create policy ticket_custom_values_select on public.ticket_custom_field_values for select to authenticated using(
  exists(select 1 from public.tickets t where t.id=ticket_id and t.workspace_id=ticket_custom_field_values.workspace_id
    and private.has_workspace_permission(t.workspace_id,'view_tickets') and private.has_product_access(t.workspace_id,t.product_id))
);
drop policy if exists ticket_custom_values_insert on public.ticket_custom_field_values;
create policy ticket_custom_values_insert on public.ticket_custom_field_values for insert to authenticated with check(
  updated_by=(select auth.uid()) and exists(select 1 from public.tickets t where t.id=ticket_id and t.workspace_id=ticket_custom_field_values.workspace_id
    and private.has_product_access(t.workspace_id,t.product_id)
    and (private.has_workspace_permission(t.workspace_id,'edit_tickets') or (t.reporter_id=(select auth.uid()) and private.has_workspace_permission(t.workspace_id,'create_tickets'))))
);
drop policy if exists ticket_custom_values_update on public.ticket_custom_field_values;
create policy ticket_custom_values_update on public.ticket_custom_field_values for update to authenticated
using(exists(select 1 from public.tickets t where t.id=ticket_id and private.has_workspace_permission(t.workspace_id,'edit_tickets') and private.has_product_access(t.workspace_id,t.product_id)))
with check(exists(select 1 from public.tickets t where t.id=ticket_id and private.has_workspace_permission(t.workspace_id,'edit_tickets') and private.has_product_access(t.workspace_id,t.product_id)));
drop policy if exists ticket_custom_values_delete on public.ticket_custom_field_values;
create policy ticket_custom_values_delete on public.ticket_custom_field_values for delete to authenticated using(
  exists(select 1 from public.tickets t where t.id=ticket_id and private.has_workspace_permission(t.workspace_id,'edit_tickets') and private.has_product_access(t.workspace_id,t.product_id))
);

-- Reports history.
drop policy if exists executive_reports_select on public.executive_reports;
create policy executive_reports_select on public.executive_reports for select to authenticated using(
  private.has_workspace_permission(workspace_id,'view_dashboard')
);
drop policy if exists executive_reports_insert on public.executive_reports;
create policy executive_reports_insert on public.executive_reports for insert to authenticated with check(
  generated_by=(select auth.uid()) and private.has_workspace_permission(workspace_id,'view_dashboard')
);
drop policy if exists executive_reports_delete on public.executive_reports;
create policy executive_reports_delete on public.executive_reports for delete to authenticated using(
  private.has_workspace_role(workspace_id,array['superadmin','admin']::public.app_role[])
);

-- v15 correction: ticket uploaders may read module catalog to classify new tickets.
drop policy if exists ticket_modules_select on public.ticket_modules;
create policy ticket_modules_select on public.ticket_modules for select to authenticated using(
  private.is_workspace_member(workspace_id) and (
    private.has_workspace_permission(workspace_id,'view_tickets')
    or private.has_workspace_permission(workspace_id,'create_tickets')
    or private.has_workspace_permission(workspace_id,'manage_ticket_fields')
  )
);

create or replace function private.notify_ticket_link_change()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_source public.tickets%rowtype;
  v_target public.tickets%rowtype;
  v_in_app boolean:=true;
  v_title text;
  v_body text;
  v_type text;
  v_user uuid;
begin
  if tg_op='INSERT' then
    select * into v_source from public.tickets where id=new.source_ticket_id;
    select * into v_target from public.tickets where id=new.target_ticket_id;
    if new.link_type='blocks' then
      v_type:='ticket_blocked';v_title:=v_target.ticket_key||' bloqueado por '||v_source.ticket_key;v_body:=v_source.title;
    elsif new.link_type='follows' then
      v_type:='ticket_followup';v_title:=v_source.ticket_key||' da seguimiento a '||v_target.ticket_key;v_body:=v_source.title;
    else
      v_type:='ticket_related';v_title:=v_source.ticket_key||' relacionado con '||v_target.ticket_key;v_body:=coalesce(new.note,v_source.title);
    end if;
  else
    select * into v_source from public.tickets where id=old.source_ticket_id;
    select * into v_target from public.tickets where id=old.target_ticket_id;
    if old.link_type<>'blocks' then return old; end if;
    v_type:='ticket_dependency_released';v_title:='Dependencia retirada · '||coalesce(v_target.ticket_key,'Ticket');v_body:='Ya no está bloqueado por '||coalesce(v_source.ticket_key,'el ticket relacionado')||'.';
  end if;

  select coalesce(in_app_notifications,true) into v_in_app from public.workspace_settings where workspace_id=coalesce(v_target.workspace_id,v_source.workspace_id);
  if coalesce(v_in_app,true) then
    for v_user in
      select distinct x.uid from (
        values(v_target.reporter_id),(v_target.dev_owner_id),(v_target.qa_owner_id),(v_source.dev_owner_id),(v_source.qa_owner_id)
      ) as x(uid)
      where x.uid is not null and x.uid is distinct from auth.uid()
    loop
      insert into public.notifications(workspace_id,user_id,ticket_id,type,title,body)
      values(coalesce(v_target.workspace_id,v_source.workspace_id),v_user,coalesce(v_target.id,v_source.id),v_type,v_title,v_body);
    end loop;
  end if;
  if tg_op='INSERT' then return new; else return old; end if;
end
$$;
revoke all on function private.notify_ticket_link_change() from public,anon,authenticated;

drop trigger if exists trg_notify_ticket_link_change on public.ticket_links;
create trigger trg_notify_ticket_link_change
after insert or delete on public.ticket_links
for each row execute function private.notify_ticket_link_change();

create or replace function public.import_backlog_tickets(p_workspace uuid,p_rows jsonb)
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  v_row jsonb;
  v_count integer:=0;
  v_keys text[]:=array[]::text[];
  v_id uuid;
  v_key text;
  v_sp integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not private.has_workspace_permission(p_workspace,'manage_sprints') then
    raise exception 'Solo PM, Admin, Superadmin o un rol con permiso de Backlog/Sprints puede importar tickets';
  end if;
  if jsonb_typeof(p_rows)<>'array' then raise exception 'Formato de importación inválido'; end if;
  if jsonb_array_length(p_rows)=0 then raise exception 'No hay filas para importar'; end if;
  if jsonb_array_length(p_rows)>250 then raise exception 'Máximo 250 tickets por importación'; end if;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    if coalesce(nullif(trim(v_row->>'title'),''),'')='' then raise exception 'Todos los tickets requieren título'; end if;
    if coalesce(nullif(v_row->>'product_id',''),'')='' then raise exception 'Todos los tickets requieren producto'; end if;
    v_sp:=case when nullif(v_row->>'story_points','') is null then null else (v_row->>'story_points')::integer end;
    if v_sp is not null and v_sp not between 1 and 5 then raise exception 'Story Points debe estar entre 1 y 5'; end if;
    insert into public.tickets(
      workspace_id,product_id,title,description,type,priority,status,reporter_id,
      sprint_id,dev_owner_id,qa_owner_id,story_points,start_date,due_date
    ) values (
      p_workspace,(v_row->>'product_id')::uuid,left(trim(v_row->>'title'),220),nullif(trim(coalesce(v_row->>'description','')),''),
      coalesce(nullif(v_row->>'type',''),'task')::public.ticket_type,coalesce(nullif(v_row->>'priority',''),'medium')::public.ticket_priority,
      'backlog'::public.ticket_status,auth.uid(),null,nullif(v_row->>'dev_owner_id','')::uuid,nullif(v_row->>'qa_owner_id','')::uuid,v_sp,
      nullif(v_row->>'start_date','')::date,nullif(v_row->>'due_date','')::date
    ) returning id,ticket_key into v_id,v_key;
    v_count:=v_count+1;v_keys:=array_append(v_keys,v_key);
  end loop;
  return jsonb_build_object('ok',true,'imported',v_count,'ticket_keys',to_jsonb(v_keys));
end
$$;
revoke all on function public.import_backlog_tickets(uuid,jsonb) from public,anon;
grant execute on function public.import_backlog_tickets(uuid,jsonb) to authenticated;

-- v15 correction: ticket uploaders can attach configured tags during ticket creation.
drop policy if exists ticket_tag_links_insert on public.ticket_tag_links;
create policy ticket_tag_links_insert on public.ticket_tag_links for insert to authenticated with check(
  created_by=(select auth.uid()) and exists(
    select 1 from public.tickets t where t.id=ticket_id and t.workspace_id=ticket_tag_links.workspace_id
      and private.has_product_access(t.workspace_id,t.product_id)
      and (
        private.has_workspace_permission(t.workspace_id,'edit_tickets')
        or (t.reporter_id=(select auth.uid()) and private.has_workspace_permission(t.workspace_id,'create_tickets'))
      )
  )
);

-- Do not expose custom-field product mappings to Helpdesk-only users.
drop policy if exists custom_ticket_field_products_select on public.custom_ticket_field_products;
create policy custom_ticket_field_products_select on public.custom_ticket_field_products for select to authenticated using(
  exists(
    select 1 from public.custom_ticket_fields f
    where f.id=field_id and f.workspace_id=custom_ticket_field_products.workspace_id
      and (
        private.has_workspace_permission(f.workspace_id,'view_tickets')
        or private.has_workspace_permission(f.workspace_id,'create_tickets')
        or private.has_workspace_permission(f.workspace_id,'manage_ticket_fields')
      )
  )
);

-- v15 final: dependency release/reblock notifications.
create or replace function private.notify_blocker_status_change()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  dep record;
  v_user uuid;
  v_type text;
  v_title text;
  v_body text;
  was_released boolean := old.status in ('qa_passed','closed');
  is_released boolean := new.status in ('qa_passed','closed');
begin
  if was_released=is_released then return new; end if;

  for dep in
    select l.target_ticket_id,t.workspace_id,t.ticket_key,t.title,t.reporter_id,t.dev_owner_id,t.qa_owner_id
    from public.ticket_links l
    join public.tickets t on t.id=l.target_ticket_id
    where l.source_ticket_id=new.id and l.link_type='blocks'
  loop
    if is_released then
      v_type:='ticket_dependency_released';
      v_title:=dep.ticket_key||' · dependencia liberada';
      v_body:=new.ticket_key||' llegó a '||case when new.status='closed' then 'Cerrado' else 'QA aprobado' end||'. El ticket ya puede continuar si no tiene otros bloqueos.';
    else
      v_type:='ticket_blocked';
      v_title:=dep.ticket_key||' vuelve a estar bloqueado';
      v_body:=new.ticket_key||' dejó un estado liberado y vuelve a bloquear esta actividad.';
    end if;

    for v_user in
      select distinct x.uid from (values(dep.reporter_id),(dep.dev_owner_id),(dep.qa_owner_id)) as x(uid)
      where x.uid is not null and x.uid is distinct from auth.uid()
    loop
      insert into public.notifications(workspace_id,user_id,ticket_id,type,title,body)
      values(dep.workspace_id,v_user,dep.target_ticket_id,v_type,v_title,v_body);
    end loop;
  end loop;
  return new;
end
$$;
revoke all on function private.notify_blocker_status_change() from public,anon,authenticated;
drop trigger if exists trg_notify_blocker_status_change on public.tickets;
create trigger trg_notify_blocker_status_change after update of status on public.tickets for each row execute function private.notify_blocker_status_change();

-- v15 atomic ticket save: core ticket + module + tags + custom fields commit together.
create or replace function public.save_ticket_documented(
  p_ticket_id uuid,
  p_workspace uuid,
  p_product_id uuid,
  p_title text,
  p_description text default null,
  p_type public.ticket_type default 'task',
  p_priority public.ticket_priority default 'medium',
  p_status public.ticket_status default 'backlog',
  p_sprint_id uuid default null,
  p_dev_owner_id uuid default null,
  p_qa_owner_id uuid default null,
  p_story_points integer default null,
  p_start_date date default null,
  p_due_date date default null,
  p_module_id uuid default null,
  p_tag_ids uuid[] default array[]::uuid[],
  p_custom_values jsonb default '{}'::jsonb
)
returns public.tickets
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  v_ticket public.tickets%rowtype;
  v_can_edit boolean;
  v_field public.custom_ticket_fields%rowtype;
  v_value jsonb;
  v_empty boolean;
  v_tag uuid;
  v_key text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if nullif(btrim(coalesce(p_title,'')),'') is null then raise exception 'El título es obligatorio'; end if;
  if not private.has_workspace_permission(p_workspace,'create_tickets') and p_ticket_id is null then raise exception 'Tu rol no permite crear tickets'; end if;
  if not private.has_product_access(p_workspace,p_product_id) then raise exception 'No tienes acceso al producto seleccionado'; end if;
  if p_story_points is not null and p_story_points not between 1 and 5 then raise exception 'Story Points debe estar entre 1 y 5'; end if;

  v_can_edit:=private.has_workspace_permission(p_workspace,'edit_tickets');

  if p_ticket_id is null then
    insert into public.tickets(workspace_id,product_id,module_id,title,description,type,priority,status,reporter_id,sprint_id,dev_owner_id,qa_owner_id,story_points,start_date,due_date)
    values (
      p_workspace,p_product_id,p_module_id,left(btrim(p_title),220),nullif(btrim(coalesce(p_description,'')),''),p_type,p_priority,
      case when v_can_edit then p_status else 'backlog'::public.ticket_status end,auth.uid(),
      case when v_can_edit then p_sprint_id else null end,case when v_can_edit then p_dev_owner_id else null end,
      case when v_can_edit then p_qa_owner_id else null end,case when v_can_edit then p_story_points else null end,
      case when v_can_edit then p_start_date else null end,case when v_can_edit then p_due_date else null end
    ) returning * into v_ticket;
  else
    select * into v_ticket from public.tickets where id=p_ticket_id and workspace_id=p_workspace;
    if not found then raise exception 'Ticket no encontrado'; end if;
    if not v_can_edit then raise exception 'Tu rol no permite editar tickets'; end if;
    update public.tickets set product_id=p_product_id,module_id=p_module_id,title=left(btrim(p_title),220),description=nullif(btrim(coalesce(p_description,'')),''),type=p_type,priority=p_priority,status=p_status,sprint_id=p_sprint_id,dev_owner_id=p_dev_owner_id,qa_owner_id=p_qa_owner_id,story_points=p_story_points,start_date=p_start_date,due_date=p_due_date
    where id=p_ticket_id returning * into v_ticket;
  end if;

  for v_field in
    select f.* from public.custom_ticket_fields f
    where f.workspace_id=p_workspace and f.active
      and (f.applies_to_all_products or exists(select 1 from public.custom_ticket_field_products fp where fp.field_id=f.id and fp.workspace_id=p_workspace and fp.product_id=p_product_id))
    order by f.sort_order,f.name
  loop
    v_key:=v_field.id::text;v_value:=p_custom_values->v_key;
    v_empty:=v_value is null or v_value='null'::jsonb or (jsonb_typeof(v_value)='string' and btrim(trim(both '"' from v_value::text))='') or (jsonb_typeof(v_value)='array' and jsonb_array_length(v_value)=0);
    if v_field.required and v_empty then raise exception 'El campo % es obligatorio',v_field.name; end if;
  end loop;

  delete from public.ticket_tag_links l where l.ticket_id=v_ticket.id and not (l.tag_id=any(coalesce(p_tag_ids,array[]::uuid[])));
  foreach v_tag in array coalesce(p_tag_ids,array[]::uuid[]) loop
    insert into public.ticket_tag_links(workspace_id,ticket_id,tag_id,created_by) values(p_workspace,v_ticket.id,v_tag,auth.uid()) on conflict(ticket_id,tag_id) do nothing;
  end loop;

  delete from public.ticket_custom_field_values cv
  where cv.ticket_id=v_ticket.id and exists(
    select 1 from public.custom_ticket_fields f where f.id=cv.field_id and f.workspace_id=p_workspace
      and (f.applies_to_all_products or exists(select 1 from public.custom_ticket_field_products fp where fp.field_id=f.id and fp.workspace_id=p_workspace and fp.product_id=p_product_id))
  );

  for v_field in
    select f.* from public.custom_ticket_fields f
    where f.workspace_id=p_workspace and f.active
      and (f.applies_to_all_products or exists(select 1 from public.custom_ticket_field_products fp where fp.field_id=f.id and fp.workspace_id=p_workspace and fp.product_id=p_product_id))
  loop
    v_key:=v_field.id::text;v_value:=p_custom_values->v_key;
    v_empty:=v_value is null or v_value='null'::jsonb or (jsonb_typeof(v_value)='string' and btrim(trim(both '"' from v_value::text))='') or (jsonb_typeof(v_value)='array' and jsonb_array_length(v_value)=0);
    if not v_empty then
      insert into public.ticket_custom_field_values(workspace_id,ticket_id,field_id,value,updated_by) values(p_workspace,v_ticket.id,v_field.id,v_value,auth.uid());
    end if;
  end loop;

  return v_ticket;
end
$$;
revoke all on function public.save_ticket_documented(uuid,uuid,uuid,text,text,public.ticket_type,public.ticket_priority,public.ticket_status,uuid,uuid,uuid,integer,date,date,uuid,uuid[],jsonb) from public,anon;
grant execute on function public.save_ticket_documented(uuid,uuid,uuid,text,text,public.ticket_type,public.ticket_priority,public.ticket_status,uuid,uuid,uuid,integer,date,date,uuid,uuid[],jsonb) to authenticated;


-- BEGIN v15.4 CONSOLIDATED
-- Jira Interno TROBBU v15.4
-- Helpdesk: catálogo CRUD de Tipos de solicitud
-- Esta migración ya fue aplicada y validada sobre el proyecto Supabase Jira Interno Trobbu.

create table if not exists public.helpdesk_request_types (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  color text not null default '#0D47A1',
  icon text not null default 'lucide:ticket',
  active boolean not null default true,
  sort_order integer not null default 100,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint helpdesk_request_types_code_format check (code ~ '^[a-z0-9][a-z0-9_-]{1,39}$'),
  constraint helpdesk_request_types_name_not_blank check (btrim(name) <> ''),
  constraint helpdesk_request_types_color_format check (color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint helpdesk_request_types_workspace_code_key unique (workspace_id, code),
  constraint helpdesk_request_types_workspace_name_key unique (workspace_id, name),
  constraint helpdesk_request_types_id_workspace_key unique (id, workspace_id)
);

alter table public.helpdesk_request_types enable row level security;

revoke all on table public.helpdesk_request_types from anon;
revoke all on table public.helpdesk_request_types from authenticated;
grant select, insert, update, delete on table public.helpdesk_request_types to authenticated;
grant select, insert, update, delete on table public.helpdesk_request_types to service_role;

drop policy if exists helpdesk_request_types_select on public.helpdesk_request_types;
create policy helpdesk_request_types_select
on public.helpdesk_request_types
for select to authenticated
using (private.is_workspace_member(workspace_id));

drop policy if exists helpdesk_request_types_insert on public.helpdesk_request_types;
create policy helpdesk_request_types_insert
on public.helpdesk_request_types
for insert to authenticated
with check (
  private.has_workspace_permission(workspace_id, 'manage_settings')
  or private.has_workspace_permission(workspace_id, 'manage_helpdesk')
);

drop policy if exists helpdesk_request_types_update on public.helpdesk_request_types;
create policy helpdesk_request_types_update
on public.helpdesk_request_types
for update to authenticated
using (
  private.has_workspace_permission(workspace_id, 'manage_settings')
  or private.has_workspace_permission(workspace_id, 'manage_helpdesk')
)
with check (
  private.has_workspace_permission(workspace_id, 'manage_settings')
  or private.has_workspace_permission(workspace_id, 'manage_helpdesk')
);

drop policy if exists helpdesk_request_types_delete on public.helpdesk_request_types;
create policy helpdesk_request_types_delete
on public.helpdesk_request_types
for delete to authenticated
using (
  private.has_workspace_permission(workspace_id, 'manage_settings')
  or private.has_workspace_permission(workspace_id, 'manage_helpdesk')
);

drop trigger if exists trg_helpdesk_request_types_updated on public.helpdesk_request_types;
create trigger trg_helpdesk_request_types_updated
before update on public.helpdesk_request_types
for each row execute function public.set_updated_at();

create or replace function private.seed_helpdesk_request_types(p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  insert into public.helpdesk_request_types
    (workspace_id, code, name, description, color, icon, active, sort_order)
  values
    (p_workspace_id,'support','Soporte','Ayuda operativa, fallas de uso o asistencia general.','#0D47A1','lucide:headphones',true,10),
    (p_workspace_id,'incident','Incidencia','Error, interrupción o comportamiento inesperado que requiere atención.','#FF6363','lucide:triangle-alert',true,20),
    (p_workspace_id,'requirement','Requerimiento','Solicitud de nueva necesidad, módulo, funcionalidad o cambio de alcance.','#4D5A51','lucide:list-plus',true,30),
    (p_workspace_id,'improvement','Mejora','Optimización de una funcionalidad, proceso o experiencia existente.','#249F58','lucide:sparkles',true,40),
    (p_workspace_id,'access','Acceso / permisos','Alta, baja, cambio de acceso, rol o permisos.','#7C5CFC','lucide:key-round',true,50),
    (p_workspace_id,'configuration','Configuración','Cambio de parámetros, catálogos o configuración operativa.','#CA6832','lucide:settings-2',true,60),
    (p_workspace_id,'other','Otro','Solicitud que no encaja en los tipos anteriores.','#6B7280','lucide:circle-ellipsis',true,999)
  on conflict (workspace_id, code) do update
    set name=excluded.name,
        description=excluded.description,
        color=excluded.color,
        icon=excluded.icon,
        sort_order=excluded.sort_order;
end
$function$;

do $$
declare
  v_workspace uuid;
begin
  for v_workspace in select id from public.workspaces loop
    perform private.seed_helpdesk_request_types(v_workspace);
  end loop;
end
$$;

alter table public.helpdesk_tickets
  add column if not exists request_type_id uuid;

alter table public.helpdesk_tickets disable trigger trg_guard_helpdesk_requester_update;

update public.helpdesk_tickets ht
set request_type_id = rt.id
from public.helpdesk_request_types rt
where rt.workspace_id = ht.workspace_id
  and rt.code = case
    when ht.category in ('module','feature','new_requirement') then 'requirement'
    else 'support'
  end
  and ht.request_type_id is null;

alter table public.helpdesk_tickets enable trigger trg_guard_helpdesk_requester_update;

alter table public.helpdesk_tickets
  drop constraint if exists helpdesk_tickets_request_type_workspace_fkey;

alter table public.helpdesk_tickets
  add constraint helpdesk_tickets_request_type_workspace_fkey
  foreign key (request_type_id, workspace_id)
  references public.helpdesk_request_types(id, workspace_id)
  on update restrict
  on delete restrict;

create index if not exists helpdesk_request_types_workspace_active_sort_idx
  on public.helpdesk_request_types(workspace_id, active, sort_order, name);

create index if not exists helpdesk_tickets_workspace_request_type_idx
  on public.helpdesk_tickets(workspace_id, request_type_id);

create or replace function private.ensure_helpdesk_request_type()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_code text;
begin
  if new.request_type_id is null then
    v_code := case
      when new.category in ('module','feature','new_requirement') then 'requirement'
      else 'support'
    end;

    select id into new.request_type_id
    from public.helpdesk_request_types
    where workspace_id = new.workspace_id
      and code = v_code
      and active = true
    order by sort_order, name
    limit 1;

    if new.request_type_id is null then
      perform private.seed_helpdesk_request_types(new.workspace_id);

      select id into new.request_type_id
      from public.helpdesk_request_types
      where workspace_id = new.workspace_id
        and code = v_code
      order by sort_order, name
      limit 1;
    end if;
  end if;

  if tg_op = 'UPDATE'
     and new.request_type_id is not distinct from old.request_type_id
     and new.workspace_id is not distinct from old.workspace_id
     and exists (
       select 1
       from public.helpdesk_request_types rt
       where rt.id = new.request_type_id
         and rt.workspace_id = new.workspace_id
     ) then
    return new;
  end if;

  if not exists (
    select 1
    from public.helpdesk_request_types rt
    where rt.id = new.request_type_id
      and rt.workspace_id = new.workspace_id
      and rt.active = true
  ) then
    raise exception 'Invalid or inactive Helpdesk request type for this workspace';
  end if;

  return new;
end
$function$;
drop trigger if exists trg_00_ensure_helpdesk_request_type on public.helpdesk_tickets;
create trigger trg_00_ensure_helpdesk_request_type
before insert or update of request_type_id, workspace_id, category
on public.helpdesk_tickets
for each row execute function private.ensure_helpdesk_request_type();

alter table public.helpdesk_tickets
  alter column request_type_id set not null;

-- Bootstrap actualizado: nuevos workspaces reciben también AUT y FIN
-- además de los 7 tipos de solicitud.


-- v15.4 · asegurar productos adicionales en workspaces ya existentes
insert into public.products(workspace_id,name,key,description,board_order)
select w.id,'Automatizaciones','AUT','Automatizaciones, integraciones, jobs y procesos automáticos',4
from public.workspaces w
on conflict (workspace_id,key) do update set
  name=excluded.name,
  description=excluded.description,
  board_order=excluded.board_order;

insert into public.products(workspace_id,name,key,description,board_order)
select w.id,'Panel Financiero','FIN','Paneles, conciliación, indicadores y seguimiento financiero',5
from public.workspaces w
on conflict (workspace_id,key) do update set
  name=excluded.name,
  description=excluded.description,
  board_order=excluded.board_order;

create or replace function private.bootstrap_workspace()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_super_role uuid;
begin
  perform private.seed_workspace_roles(new.id);
  select id into v_super_role
  from public.workspace_roles
  where workspace_id=new.id and code='superadmin';

  if new.created_by is not null then
    insert into public.workspace_members(workspace_id,user_id,role,role_id,active,all_products)
    values(new.id,new.created_by,'superadmin',v_super_role,true,true)
    on conflict (workspace_id,user_id)
    do update set role='superadmin',role_id=v_super_role,active=true,all_products=true,permissions='{}'::jsonb;
  end if;

  insert into public.products(workspace_id,name,key,description,board_order)
  values
    (new.id,'Web Administrativa','ADM','Administración interna y operación',1),
    (new.id,'Web Socios','SOC','Portal web para socios/inversionistas',2),
    (new.id,'App Socios','APP','Aplicación móvil para socios/inversionistas',3),
    (new.id,'Automatizaciones','AUT','Automatizaciones, integraciones, jobs y procesos automáticos',4),
    (new.id,'Panel Financiero','FIN','Paneles, conciliación, indicadores y seguimiento financiero',5)
  on conflict (workspace_id,key) do update set
    name=excluded.name,
    description=excluded.description,
    board_order=excluded.board_order;

  insert into public.workspace_settings(workspace_id)
  values(new.id)
  on conflict (workspace_id) do nothing;

  insert into public.helpdesk_departments(workspace_id,name,color,active)
  values
    (new.id,'Reservaciones','#0D47A1',true),
    (new.id,'Recepción','#4D5A51',true),
    (new.id,'Gerencia','#21343E',true),
    (new.id,'Administración','#CA6832',true),
    (new.id,'Aperturas','#249F58',true),
    (new.id,'Marketing','#AE6A3E',true),
    (new.id,'Callcenter','#007BFF',true),
    (new.id,'Plataforma','#056D25',true),
    (new.id,'Atención a clientes','#D4DCE0',true),
    (new.id,'Atención a socios','#FF6363',true)
  on conflict (workspace_id,name) do update set color=excluded.color,active=true;

  perform private.seed_helpdesk_request_types(new.id);
  return new;
end
$function$;

-- END v15.4 CONSOLIDATED


-- Jira Interno TROBBU v15.8
-- Helpdesk: evidencia fotográfica optimizada + asignación rápida atómica.

create table if not exists public.helpdesk_attachments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  helpdesk_ticket_id uuid not null references public.helpdesk_tickets(id) on delete cascade,
  comment_id uuid references public.helpdesk_comments(id) on delete set null,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  original_size_bytes bigint,
  evidence_type text not null default 'general' check (evidence_type in ('general')),
  created_at timestamptz not null default now()
);

create index if not exists idx_helpdesk_attachments_ticket
  on public.helpdesk_attachments(helpdesk_ticket_id,created_at);
create index if not exists idx_helpdesk_attachments_comment
  on public.helpdesk_attachments(comment_id) where comment_id is not null;
create index if not exists idx_helpdesk_attachments_workspace
  on public.helpdesk_attachments(workspace_id);
create index if not exists idx_helpdesk_attachments_uploaded_by
  on public.helpdesk_attachments(uploaded_by);

alter table public.helpdesk_attachments enable row level security;
grant select,insert,delete on public.helpdesk_attachments to authenticated;
revoke all on public.helpdesk_attachments from anon;

drop policy if exists helpdesk_attachments_select on public.helpdesk_attachments;
create policy helpdesk_attachments_select on public.helpdesk_attachments
for select to authenticated using (
  exists (
    select 1 from public.helpdesk_tickets h
    where h.id=helpdesk_attachments.helpdesk_ticket_id
      and h.workspace_id=helpdesk_attachments.workspace_id
      and private.is_workspace_member(h.workspace_id)
      and (
        private.has_workspace_permission(h.workspace_id,'manage_helpdesk')
        or h.requester_user_id=(select auth.uid())
      )
  )
);

drop policy if exists helpdesk_attachments_insert on public.helpdesk_attachments;
create policy helpdesk_attachments_insert on public.helpdesk_attachments
for insert to authenticated with check (
  uploaded_by=(select auth.uid())
  and exists (
    select 1 from public.helpdesk_tickets h
    where h.id=helpdesk_ticket_id
      and h.workspace_id=helpdesk_attachments.workspace_id
      and private.is_workspace_member(h.workspace_id)
      and (
        private.has_workspace_permission(h.workspace_id,'manage_helpdesk')
        or h.requester_user_id=(select auth.uid())
      )
  )
  and (
    comment_id is null
    or exists (
      select 1 from public.helpdesk_comments c
      where c.id=helpdesk_attachments.comment_id
        and c.helpdesk_ticket_id=helpdesk_attachments.helpdesk_ticket_id
    )
  )
);

drop policy if exists helpdesk_attachments_delete on public.helpdesk_attachments;
create policy helpdesk_attachments_delete on public.helpdesk_attachments
for delete to authenticated using (
  uploaded_by=(select auth.uid())
  or private.has_workspace_permission(workspace_id,'manage_helpdesk')
);

create or replace function private.can_view_evidence_object(p_name text)
returns boolean
language plpgsql stable security definer
set search_path=public,storage,pg_temp
as $$
declare
  v_workspace uuid;
  v_parent uuid;
  v_scope text;
begin
  v_workspace:=split_part(p_name,'/',1)::uuid;
  v_scope:=split_part(p_name,'/',2);
  v_parent:=split_part(p_name,'/',3)::uuid;

  if v_scope='tickets' then
    return exists(
      select 1 from public.tickets t
      where t.id=v_parent
        and t.workspace_id=v_workspace
        and private.has_workspace_permission(v_workspace,'view_tickets')
        and private.has_product_access(v_workspace,t.product_id)
    );
  elsif v_scope='sprints' then
    return exists(
      select 1 from public.sprints s
      where s.id=v_parent
        and s.workspace_id=v_workspace
        and private.has_workspace_permission(v_workspace,'view_dashboard')
    );
  elsif v_scope='helpdesk' then
    return exists(
      select 1 from public.helpdesk_tickets h
      where h.id=v_parent
        and h.workspace_id=v_workspace
        and private.is_workspace_member(v_workspace)
        and (
          private.has_workspace_permission(v_workspace,'manage_helpdesk')
          or h.requester_user_id=(select auth.uid())
        )
    );
  end if;
  return false;
exception when invalid_text_representation then return false;
end
$$;

create or replace function private.can_upload_evidence_object(p_name text)
returns boolean
language plpgsql stable security definer
set search_path=public,storage,pg_temp
as $$
declare
  v_workspace uuid;
  v_parent uuid;
  v_scope text;
begin
  v_workspace:=split_part(p_name,'/',1)::uuid;
  v_scope:=split_part(p_name,'/',2);
  v_parent:=split_part(p_name,'/',3)::uuid;

  if v_scope='tickets' then
    return exists(
      select 1 from public.tickets t
      where t.id=v_parent
        and t.workspace_id=v_workspace
        and private.has_workspace_permission(v_workspace,'edit_tickets')
        and private.has_product_access(v_workspace,t.product_id)
    );
  elsif v_scope='sprints' then
    return exists(
      select 1 from public.sprints s
      where s.id=v_parent
        and s.workspace_id=v_workspace
        and private.has_workspace_permission(v_workspace,'edit_tickets')
    );
  elsif v_scope='helpdesk' then
    return exists(
      select 1 from public.helpdesk_tickets h
      where h.id=v_parent
        and h.workspace_id=v_workspace
        and private.is_workspace_member(v_workspace)
        and (
          private.has_workspace_permission(v_workspace,'manage_helpdesk')
          or h.requester_user_id=(select auth.uid())
        )
    );
  end if;
  return false;
exception when invalid_text_representation then return false;
end
$$;

create or replace function private.can_manage_evidence_object(p_name text)
returns boolean
language plpgsql stable security definer
set search_path=public,storage,pg_temp
as $$
declare
  v_workspace uuid;
  v_scope text;
begin
  v_workspace:=split_part(p_name,'/',1)::uuid;
  v_scope:=split_part(p_name,'/',2);
  if v_scope='helpdesk' then
    return private.has_workspace_permission(v_workspace,'manage_helpdesk');
  elsif v_scope='sprints' then
    return private.has_workspace_permission(v_workspace,'manage_sprints');
  end if;
  return private.has_workspace_permission(v_workspace,'delete_tickets');
exception when invalid_text_representation then return false;
end
$$;

revoke all on function private.can_view_evidence_object(text) from public,anon;
revoke all on function private.can_upload_evidence_object(text) from public,anon;
revoke all on function private.can_manage_evidence_object(text) from public,anon;
grant execute on function private.can_view_evidence_object(text) to authenticated;
grant execute on function private.can_upload_evidence_object(text) to authenticated;
grant execute on function private.can_manage_evidence_object(text) to authenticated;

-- Atomic quick assignment. Existing helpdesk trigger records the assignment and notifies the assignee.
create or replace function public.assign_helpdesk_ticket(
  p_ticket_id uuid,
  p_assignee uuid,
  p_comment text default null
)
returns jsonb
language plpgsql
security invoker
set search_path=public,private,pg_temp
as $$
declare
  v_workspace uuid;
  v_key text;
  v_category text;
  v_comment text:=nullif(btrim(coalesce(p_comment,'')),'');
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;

  select workspace_id,ticket_key,category
    into v_workspace,v_key,v_category
  from public.helpdesk_tickets
  where id=p_ticket_id;

  if v_workspace is null then raise exception 'Helpdesk ticket not found'; end if;
  if not private.has_workspace_permission(v_workspace,'manage_helpdesk') then
    raise exception 'Insufficient Helpdesk permissions';
  end if;
  if v_category in ('module','feature','new_requirement') then
    raise exception 'Requirement proposals are handled through the decision flow';
  end if;
  if p_assignee is null or not private.member_has_permission(v_workspace,p_assignee,'manage_helpdesk') then
    raise exception 'The selected assignee is not an active Helpdesk agent';
  end if;
  if v_comment is not null and char_length(v_comment)>4000 then
    raise exception 'Assignment comment is too long';
  end if;

  update public.helpdesk_tickets
  set assigned_to=p_assignee
  where id=p_ticket_id;

  if v_comment is not null then
    insert into public.helpdesk_comments(helpdesk_ticket_id,author_id,body)
    values(p_ticket_id,(select auth.uid()),v_comment);
  end if;

  return jsonb_build_object('ticket_id',p_ticket_id,'ticket_key',v_key,'assigned_to',p_assignee,'comment_added',v_comment is not null);
end
$$;

revoke all on function public.assign_helpdesk_ticket(uuid,uuid,text) from public,anon;
grant execute on function public.assign_helpdesk_ticket(uuid,uuid,text) to authenticated;


-- ============================================================
-- v15.9 · Helpdesk initial evidence rollback hardening
-- ============================================================
drop policy if exists helpdesk_tickets_requester_recent_rollback_delete on public.helpdesk_tickets;
drop policy if exists helpdesk_tickets_delete on public.helpdesk_tickets;
create policy helpdesk_tickets_delete
on public.helpdesk_tickets
for delete
to authenticated
using (
  private.has_workspace_permission(workspace_id,'manage_helpdesk')
  or (
    requester_user_id=(select auth.uid())
    and source='portal'
    and status='created'
    and assigned_to is null
    and created_at >= now() - interval '10 minutes'
  )
);


-- ============================================================
-- Jira Interno TROBBU v16 consolidated upgrade
-- ============================================================
-- Jira Interno TROBBU v16
-- Knowledge, bulk sprint planning, Staff identity sync and Realtime publication.

create table if not exists public.knowledge_articles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  slug text not null,
  summary text,
  content text not null default '',
  tags text[] not null default '{}',
  product_id uuid references public.products(id) on delete set null,
  module_id uuid references public.ticket_modules(id) on delete set null,
  status text not null default 'published' check (status in ('draft','published','archived')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,slug),
  check (length(btrim(title)) between 2 and 180),
  check (length(content) <= 80000)
);
create index if not exists idx_knowledge_articles_workspace_status on public.knowledge_articles(workspace_id,status,updated_at desc);
create index if not exists idx_knowledge_articles_product on public.knowledge_articles(workspace_id,product_id) where product_id is not null;
create index if not exists idx_knowledge_articles_module on public.knowledge_articles(workspace_id,module_id) where module_id is not null;
create index if not exists idx_knowledge_articles_product_id on public.knowledge_articles(product_id) where product_id is not null;
create index if not exists idx_knowledge_articles_module_id on public.knowledge_articles(module_id) where module_id is not null;
create index if not exists idx_knowledge_articles_created_by on public.knowledge_articles(created_by) where created_by is not null;
create index if not exists idx_knowledge_articles_updated_by on public.knowledge_articles(updated_by) where updated_by is not null;
alter table public.knowledge_articles enable row level security;
revoke all on public.knowledge_articles from anon;
grant select,insert,update,delete on public.knowledge_articles to authenticated;

drop policy if exists knowledge_articles_select on public.knowledge_articles;
create policy knowledge_articles_select on public.knowledge_articles for select to authenticated using (
  private.is_workspace_member(workspace_id)
  and (status='published' or private.has_workspace_permission(workspace_id,'manage_settings'))
);
drop policy if exists knowledge_articles_insert on public.knowledge_articles;
create policy knowledge_articles_insert on public.knowledge_articles for insert to authenticated with check (
  private.has_workspace_permission(workspace_id,'manage_settings')
  and (created_by is null or created_by=(select auth.uid()))
);
drop policy if exists knowledge_articles_update on public.knowledge_articles;
create policy knowledge_articles_update on public.knowledge_articles for update to authenticated
using (private.has_workspace_permission(workspace_id,'manage_settings'))
with check (private.has_workspace_permission(workspace_id,'manage_settings'));
drop policy if exists knowledge_articles_delete on public.knowledge_articles;
create policy knowledge_articles_delete on public.knowledge_articles for delete to authenticated
using (private.has_workspace_permission(workspace_id,'manage_settings'));

create or replace function private.guard_knowledge_article()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  new.title=btrim(new.title);
  new.slug=lower(regexp_replace(btrim(new.slug),'[^a-zA-Z0-9]+','-','g'));
  new.slug=trim(both '-' from new.slug);
  if new.slug='' then raise exception 'Knowledge slug is required'; end if;
  if new.product_id is not null and not exists(select 1 from public.products p where p.id=new.product_id and p.workspace_id=new.workspace_id) then
    raise exception 'Knowledge product must belong to the same workspace';
  end if;
  if new.module_id is not null and not exists(select 1 from public.ticket_modules m where m.id=new.module_id and m.workspace_id=new.workspace_id) then
    raise exception 'Knowledge module must belong to the same workspace';
  end if;
  new.updated_at=now();
  new.updated_by=coalesce((select auth.uid()),new.updated_by);
  return new;
end $$;
drop trigger if exists trg_guard_knowledge_article on public.knowledge_articles;
create trigger trg_guard_knowledge_article before insert or update on public.knowledge_articles
for each row execute function private.guard_knowledge_article();

create or replace function public.bulk_move_tickets_to_sprint(p_workspace uuid,p_ticket_ids uuid[],p_sprint_id uuid)
returns jsonb language plpgsql security invoker set search_path=public,private,pg_temp as $$
declare
  v_sprint public.sprints%rowtype;
  v_requested int;
  v_allowed int;
  v_moved int;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not private.has_workspace_permission(p_workspace,'manage_sprints') then raise exception 'Insufficient sprint permissions'; end if;
  if p_ticket_ids is null or cardinality(p_ticket_ids)=0 then raise exception 'Select at least one ticket'; end if;
  if cardinality(p_ticket_ids)>100 then raise exception 'Maximum 100 tickets per bulk move'; end if;
  select * into v_sprint from public.sprints where id=p_sprint_id and workspace_id=p_workspace and status in ('active','planned');
  if not found then raise exception 'Sprint is not active or planned in this workspace'; end if;
  select count(distinct x) into v_requested from unnest(p_ticket_ids) x;
  select count(*) into v_allowed from public.tickets t
  where t.workspace_id=p_workspace and t.id=any(p_ticket_ids) and t.sprint_id is null and t.status<>'closed'
    and private.has_product_access(p_workspace,t.product_id);
  if v_allowed<>v_requested then raise exception 'One or more selected tickets are invalid, already planned, closed, or outside your product scope'; end if;
  update public.tickets t set sprint_id=v_sprint.id,
      status=case when t.status='backlog' then 'todo'::public.ticket_status else t.status end,
      start_date=coalesce(t.start_date,v_sprint.start_date),due_date=coalesce(t.due_date,v_sprint.end_date),updated_at=now()
  where t.workspace_id=p_workspace and t.id=any(p_ticket_ids);
  get diagnostics v_moved=row_count;
  return jsonb_build_object('moved',v_moved,'sprint_id',v_sprint.id,'sprint_name',v_sprint.name);
end $$;
revoke all on function public.bulk_move_tickets_to_sprint(uuid,uuid[],uuid) from public,anon;
grant execute on function public.bulk_move_tickets_to_sprint(uuid,uuid[],uuid) to authenticated;

alter table public.profiles add column if not exists email text;
update public.profiles p set email=u.email from auth.users u where u.id=p.id and p.email is distinct from u.email;
create or replace function private.sync_profile_auth_identity()
returns trigger language plpgsql security definer set search_path=public,auth,pg_temp as $$
begin
  insert into public.profiles(id,email,full_name,updated_at)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name'),now())
  on conflict(id) do update set email=excluded.email,full_name=coalesce(public.profiles.full_name,excluded.full_name),updated_at=now();
  return new;
end $$;
drop trigger if exists trg_sync_profile_auth_identity on auth.users;
create trigger trg_sync_profile_auth_identity after insert or update of email,raw_user_meta_data on auth.users
for each row execute function private.sync_profile_auth_identity();

-- Realtime: add only when absent so this migration is idempotent.
do $$
declare t text;
begin
  foreach t in array array[
    'tickets','sprints','products','ticket_modules','ticket_tags','ticket_tag_links','ticket_links','ticket_attachments',
    'ticket_comments','ticket_activity','sprint_comments','sprint_attachments','workspace_members','workspace_member_products',
    'workspace_roles','profiles','helpdesk_tickets','helpdesk_comments','helpdesk_attachments','notifications','knowledge_articles',
    'custom_ticket_fields','custom_ticket_field_products','ticket_custom_field_values'
  ] loop
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime add table public.%I',t);
    end if;
  end loop;
end $$;
-- Jira Interno TROBBU v16.1
-- Knowledge rich content + private media + Helpdesk author snapshot.

alter table public.knowledge_articles
  add column if not exists content_blocks jsonb not null default '[]'::jsonb;

create table if not exists public.knowledge_media (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  article_id uuid not null references public.knowledge_articles(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  original_size_bytes bigint,
  width integer,
  height integer,
  created_at timestamptz not null default now()
);
create index if not exists idx_knowledge_media_article on public.knowledge_media(article_id,created_at);
create index if not exists idx_knowledge_media_workspace on public.knowledge_media(workspace_id);
create index if not exists idx_knowledge_media_uploaded_by on public.knowledge_media(uploaded_by);

alter table public.knowledge_media enable row level security;
revoke all on public.knowledge_media from anon;
grant select,insert,delete on public.knowledge_media to authenticated;

drop policy if exists knowledge_media_select on public.knowledge_media;
create policy knowledge_media_select on public.knowledge_media
for select to authenticated using (
  exists (
    select 1 from public.knowledge_articles a
    where a.id=article_id
      and a.workspace_id=knowledge_media.workspace_id
      and private.is_workspace_member(a.workspace_id)
      and (a.status='published' or private.has_workspace_permission(a.workspace_id,'manage_settings'))
  )
);

drop policy if exists knowledge_media_insert on public.knowledge_media;
create policy knowledge_media_insert on public.knowledge_media
for insert to authenticated with check (
  uploaded_by=(select auth.uid())
  and private.has_workspace_permission(workspace_id,'manage_settings')
  and exists (
    select 1 from public.knowledge_articles a
    where a.id=article_id and a.workspace_id=knowledge_media.workspace_id
  )
);

drop policy if exists knowledge_media_delete on public.knowledge_media;
create policy knowledge_media_delete on public.knowledge_media
for delete to authenticated using (
  private.has_workspace_permission(workspace_id,'manage_settings')
);

create or replace function private.can_view_evidence_object(p_name text)
returns boolean language plpgsql stable security definer
set search_path=public,storage,pg_temp as $$
declare v_workspace uuid; v_parent uuid; v_scope text;
begin
  v_workspace:=split_part(p_name,'/',1)::uuid;
  v_scope:=split_part(p_name,'/',2);
  v_parent:=split_part(p_name,'/',3)::uuid;
  if v_scope='tickets' then
    return exists(select 1 from public.tickets t where t.id=v_parent and t.workspace_id=v_workspace and private.has_workspace_permission(v_workspace,'view_tickets') and private.has_product_access(v_workspace,t.product_id));
  elsif v_scope='sprints' then
    return exists(select 1 from public.sprints s where s.id=v_parent and s.workspace_id=v_workspace and private.has_workspace_permission(v_workspace,'view_dashboard'));
  elsif v_scope='helpdesk' then
    return exists(select 1 from public.helpdesk_tickets h where h.id=v_parent and h.workspace_id=v_workspace and private.is_workspace_member(v_workspace) and (private.has_workspace_permission(v_workspace,'manage_helpdesk') or h.requester_user_id=(select auth.uid())));
  elsif v_scope='knowledge' then
    return exists(select 1 from public.knowledge_articles a where a.id=v_parent and a.workspace_id=v_workspace and private.is_workspace_member(v_workspace) and (a.status='published' or private.has_workspace_permission(v_workspace,'manage_settings')));
  end if;
  return false;
exception when invalid_text_representation then return false;
end $$;

create or replace function private.can_upload_evidence_object(p_name text)
returns boolean language plpgsql stable security definer
set search_path=public,storage,pg_temp as $$
declare v_workspace uuid; v_parent uuid; v_scope text;
begin
  v_workspace:=split_part(p_name,'/',1)::uuid;
  v_scope:=split_part(p_name,'/',2);
  v_parent:=split_part(p_name,'/',3)::uuid;
  if v_scope='tickets' then
    return exists(select 1 from public.tickets t where t.id=v_parent and t.workspace_id=v_workspace and private.has_workspace_permission(v_workspace,'edit_tickets') and private.has_product_access(v_workspace,t.product_id));
  elsif v_scope='sprints' then
    return exists(select 1 from public.sprints s where s.id=v_parent and s.workspace_id=v_workspace and private.has_workspace_permission(v_workspace,'edit_tickets'));
  elsif v_scope='helpdesk' then
    return exists(select 1 from public.helpdesk_tickets h where h.id=v_parent and h.workspace_id=v_workspace and private.is_workspace_member(v_workspace) and (private.has_workspace_permission(v_workspace,'manage_helpdesk') or h.requester_user_id=(select auth.uid())));
  elsif v_scope='knowledge' then
    return exists(select 1 from public.knowledge_articles a where a.id=v_parent and a.workspace_id=v_workspace and private.has_workspace_permission(v_workspace,'manage_settings'));
  end if;
  return false;
exception when invalid_text_representation then return false;
end $$;

create or replace function private.can_manage_evidence_object(p_name text)
returns boolean language plpgsql stable security definer
set search_path=public,storage,pg_temp as $$
declare v_workspace uuid; v_scope text;
begin
  v_workspace:=split_part(p_name,'/',1)::uuid;
  v_scope:=split_part(p_name,'/',2);
  if v_scope='helpdesk' then return private.has_workspace_permission(v_workspace,'manage_helpdesk');
  elsif v_scope='sprints' then return private.has_workspace_permission(v_workspace,'manage_sprints');
  elsif v_scope='knowledge' then return private.has_workspace_permission(v_workspace,'manage_settings');
  end if;
  return private.has_workspace_permission(v_workspace,'delete_tickets');
exception when invalid_text_representation then return false;
end $$;

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='knowledge_media') then
    alter publication supabase_realtime add table public.knowledge_media;
  end if;
end $$;

alter table public.helpdesk_comments
  add column if not exists author_name text,
  add column if not exists author_email text;

update public.helpdesk_comments c
set author_name=coalesce(p.full_name,u.raw_user_meta_data->>'full_name',u.email,'Usuario'),
    author_email=u.email
from auth.users u
left join public.profiles p on p.id=u.id
where c.author_id=u.id and (c.author_name is null or c.author_email is null);

create or replace function private.snapshot_helpdesk_comment_author()
returns trigger language plpgsql security definer
set search_path=public,auth,pg_temp as $$
declare v_name text; v_email text;
begin
  select coalesce(p.full_name,u.raw_user_meta_data->>'full_name',u.email,'Usuario'),u.email
  into v_name,v_email
  from auth.users u left join public.profiles p on p.id=u.id
  where u.id=new.author_id;
  new.author_name=coalesce(new.author_name,v_name,'Usuario');
  new.author_email=coalesce(new.author_email,v_email);
  return new;
end $$;

drop trigger if exists trg_snapshot_helpdesk_comment_author on public.helpdesk_comments;
create trigger trg_snapshot_helpdesk_comment_author
before insert on public.helpdesk_comments
for each row execute function private.snapshot_helpdesk_comment_author();


-- Jira Interno TROBBU v16.4
-- Knowledge: versionado, auditoría, ES/EN y cache de traducciones por versión activa.

alter table public.profiles
  add column if not exists locale text not null default 'es'
  check (locale in ('es','en'));

alter table public.knowledge_articles
  add column if not exists default_language text not null default 'es'
  check (default_language in ('es','en'));

create table if not exists public.knowledge_article_versions (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.knowledge_articles(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  change_note text not null default 'Actualización del artículo',
  title text not null,
  slug text not null,
  summary text,
  content text not null default '',
  content_blocks jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  product_id uuid references public.products(id) on delete set null,
  module_id uuid references public.ticket_modules(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  content_updated_by uuid references auth.users(id) on delete set null,
  published_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  content_updated_at timestamptz,
  published_at timestamptz,
  unique(article_id,version_number)
);
create unique index if not exists uq_knowledge_article_one_draft on public.knowledge_article_versions(article_id) where status='draft';
create index if not exists idx_knowledge_versions_article on public.knowledge_article_versions(article_id,version_number desc);
create index if not exists idx_knowledge_versions_workspace on public.knowledge_article_versions(workspace_id,status,updated_at desc);
create index if not exists idx_knowledge_versions_created_by on public.knowledge_article_versions(created_by) where created_by is not null;
create index if not exists idx_knowledge_versions_updated_by on public.knowledge_article_versions(updated_by) where updated_by is not null;
create index if not exists idx_knowledge_versions_content_updated_by on public.knowledge_article_versions(content_updated_by) where content_updated_by is not null;
create index if not exists idx_knowledge_versions_published_by on public.knowledge_article_versions(published_by) where published_by is not null;
create index if not exists idx_knowledge_versions_product on public.knowledge_article_versions(product_id) where product_id is not null;
create index if not exists idx_knowledge_versions_module on public.knowledge_article_versions(module_id) where module_id is not null;

alter table public.knowledge_articles
  add column if not exists active_version_id uuid,
  add column if not exists draft_version_id uuid;
do $$
begin
  if not exists(select 1 from pg_constraint where conname='knowledge_articles_active_version_fkey') then
    alter table public.knowledge_articles add constraint knowledge_articles_active_version_fkey foreign key(active_version_id) references public.knowledge_article_versions(id) on delete set null;
  end if;
  if not exists(select 1 from pg_constraint where conname='knowledge_articles_draft_version_fkey') then
    alter table public.knowledge_articles add constraint knowledge_articles_draft_version_fkey foreign key(draft_version_id) references public.knowledge_article_versions(id) on delete set null;
  end if;
end $$;

create table if not exists public.knowledge_version_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  article_id uuid not null references public.knowledge_articles(id) on delete cascade,
  version_id uuid not null references public.knowledge_article_versions(id) on delete cascade,
  event_type text not null check (event_type in ('created','updated','published','archived','restored')),
  note text,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_knowledge_version_events_version on public.knowledge_version_events(version_id,created_at desc);
create index if not exists idx_knowledge_version_events_article on public.knowledge_version_events(article_id,created_at desc);
create index if not exists idx_knowledge_version_events_actor on public.knowledge_version_events(actor_id) where actor_id is not null;

create table if not exists public.knowledge_version_translations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  article_id uuid not null references public.knowledge_articles(id) on delete cascade,
  version_id uuid not null references public.knowledge_article_versions(id) on delete cascade,
  language text not null check (language in ('es','en')),
  source_hash text not null,
  title text not null,
  summary text,
  content text not null default '',
  content_blocks jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  provider text not null default 'openai',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(version_id,language)
);
create index if not exists idx_knowledge_translations_article on public.knowledge_version_translations(article_id,language);
create index if not exists idx_knowledge_translations_workspace on public.knowledge_version_translations(workspace_id,language);
create index if not exists idx_knowledge_translations_version on public.knowledge_version_translations(version_id);

alter table public.knowledge_article_versions enable row level security;
alter table public.knowledge_version_events enable row level security;
alter table public.knowledge_version_translations enable row level security;
revoke all on public.knowledge_article_versions,public.knowledge_version_events,public.knowledge_version_translations from anon;
grant select,insert,update,delete on public.knowledge_article_versions to authenticated;
grant select on public.knowledge_version_events,public.knowledge_version_translations to authenticated;

drop policy if exists knowledge_versions_select on public.knowledge_article_versions;
create policy knowledge_versions_select on public.knowledge_article_versions for select to authenticated using (
  private.is_workspace_member(workspace_id) and (status in ('published','archived') or private.has_workspace_permission(workspace_id,'manage_settings'))
);
drop policy if exists knowledge_versions_insert on public.knowledge_article_versions;
create policy knowledge_versions_insert on public.knowledge_article_versions for insert to authenticated with check (
  private.has_workspace_permission(workspace_id,'manage_settings') and (created_by is null or created_by=(select auth.uid()))
);
drop policy if exists knowledge_versions_update on public.knowledge_article_versions;
create policy knowledge_versions_update on public.knowledge_article_versions for update to authenticated
using (private.has_workspace_permission(workspace_id,'manage_settings'))
with check (private.has_workspace_permission(workspace_id,'manage_settings'));
drop policy if exists knowledge_versions_delete on public.knowledge_article_versions;
create policy knowledge_versions_delete on public.knowledge_article_versions for delete to authenticated using (
  private.has_workspace_permission(workspace_id,'manage_settings') and status='draft'
);

drop policy if exists knowledge_version_events_select on public.knowledge_version_events;
create policy knowledge_version_events_select on public.knowledge_version_events for select to authenticated using (private.is_workspace_member(workspace_id));

drop policy if exists knowledge_translations_select on public.knowledge_version_translations;
create policy knowledge_translations_select on public.knowledge_version_translations for select to authenticated using (
  private.is_workspace_member(workspace_id) and exists (
    select 1 from public.knowledge_article_versions v where v.id=version_id and v.workspace_id=knowledge_version_translations.workspace_id
      and (v.status in ('published','archived') or private.has_workspace_permission(v.workspace_id,'manage_settings'))
  )
);

-- Existing articles become version 1 without changing their public content.
insert into public.knowledge_article_versions(
  article_id,workspace_id,version_number,status,change_note,title,slug,summary,content,content_blocks,tags,product_id,module_id,
  created_by,updated_by,content_updated_by,published_by,created_at,updated_at,content_updated_at,published_at
)
select a.id,a.workspace_id,1,case when a.status='published' then 'published' else 'draft' end,'Versión inicial',a.title,a.slug,a.summary,a.content,a.content_blocks,a.tags,a.product_id,a.module_id,
       a.created_by,a.updated_by,coalesce(a.updated_by,a.created_by),case when a.status='published' then coalesce(a.updated_by,a.created_by) end,
       a.created_at,a.updated_at,a.updated_at,case when a.status='published' then a.updated_at end
from public.knowledge_articles a
where not exists(select 1 from public.knowledge_article_versions v where v.article_id=a.id);

update public.knowledge_articles a set active_version_id=v.id
from public.knowledge_article_versions v where v.article_id=a.id and v.status='published' and a.active_version_id is null;
update public.knowledge_articles a set draft_version_id=v.id
from public.knowledge_article_versions v where v.article_id=a.id and v.status='draft' and a.draft_version_id is null;

insert into public.knowledge_version_events(workspace_id,article_id,version_id,event_type,note,actor_id,created_at)
select v.workspace_id,v.article_id,v.id,'created',v.change_note,v.created_by,v.created_at
from public.knowledge_article_versions v where not exists(select 1 from public.knowledge_version_events e where e.version_id=v.id and e.event_type='created');
insert into public.knowledge_version_events(workspace_id,article_id,version_id,event_type,note,actor_id,created_at)
select v.workspace_id,v.article_id,v.id,'published',v.change_note,v.published_by,coalesce(v.published_at,v.updated_at)
from public.knowledge_article_versions v where v.status='published' and not exists(select 1 from public.knowledge_version_events e where e.version_id=v.id and e.event_type='published');

create or replace function private.guard_knowledge_version()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare content_changed boolean:=true;
begin
  if not exists(select 1 from public.knowledge_articles a where a.id=new.article_id and a.workspace_id=new.workspace_id) then raise exception 'Knowledge version must belong to the same workspace as its article'; end if;
  if new.product_id is not null and not exists(select 1 from public.products p where p.id=new.product_id and p.workspace_id=new.workspace_id) then raise exception 'Knowledge version product must belong to the same workspace'; end if;
  if new.module_id is not null and not exists(select 1 from public.ticket_modules m where m.id=new.module_id and m.workspace_id=new.workspace_id) then raise exception 'Knowledge version module must belong to the same workspace'; end if;
  new.title=btrim(new.title);
  new.slug=trim(both '-' from lower(regexp_replace(btrim(new.slug),'[^a-zA-Z0-9]+','-','g')));
  if new.slug='' then raise exception 'Knowledge version slug is required'; end if;
  new.change_note=coalesce(nullif(btrim(new.change_note),''),'Actualización del artículo');
  if tg_op='UPDATE' then
    content_changed := row(new.title,new.slug,new.summary,new.content,new.content_blocks,new.tags,new.product_id,new.module_id)
      is distinct from row(old.title,old.slug,old.summary,old.content,old.content_blocks,old.tags,old.product_id,old.module_id);
  end if;
  if tg_op='INSERT' or content_changed then
    new.content_updated_by=coalesce((select auth.uid()),new.content_updated_by,new.updated_by,new.created_by);
    new.content_updated_at=now();
  end if;
  new.updated_at=now();new.updated_by=coalesce((select auth.uid()),new.updated_by);
  return new;
end $$;
drop trigger if exists trg_guard_knowledge_version on public.knowledge_article_versions;
create trigger trg_guard_knowledge_version before insert or update on public.knowledge_article_versions for each row execute function private.guard_knowledge_version();

create or replace function private.audit_knowledge_version()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare evt text;
begin
  if tg_op='INSERT' then evt:='created';
  elsif old.status is distinct from new.status and new.status='published' then evt:=case when old.status='archived' then 'restored' else 'published' end;
  elsif old.status is distinct from new.status and new.status='archived' then evt:='archived';
  else evt:='updated'; end if;
  insert into public.knowledge_version_events(workspace_id,article_id,version_id,event_type,note,actor_id)
  values(new.workspace_id,new.article_id,new.id,evt,new.change_note,coalesce((select auth.uid()),new.updated_by,new.created_by));
  return new;
end $$;
drop trigger if exists trg_audit_knowledge_version on public.knowledge_article_versions;
create trigger trg_audit_knowledge_version after insert or update on public.knowledge_article_versions for each row execute function private.audit_knowledge_version();

create or replace function public.create_knowledge_draft_version(p_article_id uuid,p_change_note text)
returns uuid language plpgsql security invoker set search_path=public,private,pg_temp as $$
declare a public.knowledge_articles%rowtype;src public.knowledge_article_versions%rowtype;v_id uuid;v_no int;
begin
  select * into a from public.knowledge_articles where id=p_article_id;if not found then raise exception 'Knowledge article not found';end if;
  if not private.has_workspace_permission(a.workspace_id,'manage_settings') then raise exception 'Insufficient Knowledge permissions';end if;
  if nullif(btrim(coalesce(p_change_note,'')),'') is null then raise exception 'Describe why this new version is being created';end if;
  if a.draft_version_id is not null then raise exception 'This article already has an active draft version';end if;
  if a.active_version_id is not null then select * into src from public.knowledge_article_versions where id=a.active_version_id;
  else src.title:=a.title;src.slug:=a.slug;src.summary:=a.summary;src.content:=a.content;src.content_blocks:=a.content_blocks;src.tags:=a.tags;src.product_id:=a.product_id;src.module_id:=a.module_id;end if;
  select coalesce(max(version_number),0)+1 into v_no from public.knowledge_article_versions where article_id=a.id;
  insert into public.knowledge_article_versions(article_id,workspace_id,version_number,status,change_note,title,slug,summary,content,content_blocks,tags,product_id,module_id,created_by,updated_by)
  values(a.id,a.workspace_id,v_no,'draft',btrim(p_change_note),src.title,src.slug,src.summary,src.content,src.content_blocks,src.tags,src.product_id,src.module_id,(select auth.uid()),(select auth.uid())) returning id into v_id;
  update public.knowledge_articles set draft_version_id=v_id where id=a.id;return v_id;
end $$;
revoke all on function public.create_knowledge_draft_version(uuid,text) from public,anon;grant execute on function public.create_knowledge_draft_version(uuid,text) to authenticated;

create or replace function public.publish_knowledge_version(p_version_id uuid)
returns jsonb language plpgsql security invoker set search_path=public,private,pg_temp as $$
declare v public.knowledge_article_versions%rowtype;a public.knowledge_articles%rowtype;old_id uuid;
begin
  select * into v from public.knowledge_article_versions where id=p_version_id;if not found then raise exception 'Knowledge version not found';end if;
  select * into a from public.knowledge_articles where id=v.article_id;
  if not private.has_workspace_permission(v.workspace_id,'manage_settings') then raise exception 'Insufficient Knowledge permissions';end if;
  old_id:=a.active_version_id;
  if old_id is not null and old_id<>v.id then update public.knowledge_article_versions set status='archived' where id=old_id;end if;
  update public.knowledge_article_versions set status='published',published_by=(select auth.uid()),published_at=now() where id=v.id;
  update public.knowledge_articles set title=v.title,slug=v.slug,summary=v.summary,content=v.content,content_blocks=v.content_blocks,tags=v.tags,product_id=v.product_id,module_id=v.module_id,status='published',active_version_id=v.id,draft_version_id=case when draft_version_id=v.id then null else draft_version_id end,updated_by=(select auth.uid()),updated_at=now() where id=v.article_id;
  return jsonb_build_object('article_id',v.article_id,'version_id',v.id,'version_number',v.version_number);
end $$;
revoke all on function public.publish_knowledge_version(uuid) from public,anon;grant execute on function public.publish_knowledge_version(uuid) to authenticated;

create or replace function public.discard_knowledge_draft_version(p_version_id uuid)
returns boolean language plpgsql security invoker set search_path=public,private,pg_temp as $$
declare v public.knowledge_article_versions%rowtype;
begin
  select * into v from public.knowledge_article_versions where id=p_version_id and status='draft';if not found then raise exception 'Draft version not found';end if;
  if not private.has_workspace_permission(v.workspace_id,'manage_settings') then raise exception 'Insufficient Knowledge permissions';end if;
  update public.knowledge_articles set draft_version_id=null where id=v.article_id and draft_version_id=v.id;delete from public.knowledge_article_versions where id=v.id;return true;
end $$;
revoke all on function public.discard_knowledge_draft_version(uuid) from public,anon;grant execute on function public.discard_knowledge_draft_version(uuid) to authenticated;

do $$
declare t text;
begin
  foreach t in array array['knowledge_article_versions','knowledge_version_events','knowledge_version_translations'] loop
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t);end if;
  end loop;
end $$;

-- v16.4 hardening override: immutable published/archived Knowledge versions.
create or replace function private.guard_knowledge_version()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare content_changed boolean:=true;state_change_allowed boolean:=coalesce(current_setting('app.knowledge_publish',true),'')='on';
begin
  if not exists(select 1 from public.knowledge_articles a where a.id=new.article_id and a.workspace_id=new.workspace_id) then raise exception 'Knowledge version must belong to the same workspace as its article'; end if;
  if new.product_id is not null and not exists(select 1 from public.products p where p.id=new.product_id and p.workspace_id=new.workspace_id) then raise exception 'Knowledge version product must belong to the same workspace'; end if;
  if new.module_id is not null and not exists(select 1 from public.ticket_modules m where m.id=new.module_id and m.workspace_id=new.workspace_id) then raise exception 'Knowledge version module must belong to the same workspace'; end if;
  new.title=btrim(new.title);new.slug=trim(both '-' from lower(regexp_replace(btrim(new.slug),'[^a-zA-Z0-9]+','-','g')));if new.slug='' then raise exception 'Knowledge version slug is required';end if;
  new.change_note=coalesce(nullif(btrim(new.change_note),''),'Actualización del artículo');
  if tg_op='UPDATE' then
    content_changed:=row(new.title,new.slug,new.summary,new.content,new.content_blocks,new.tags,new.product_id,new.module_id,new.change_note) is distinct from row(old.title,old.slug,old.summary,old.content,old.content_blocks,old.tags,old.product_id,old.module_id,old.change_note);
    if old.status<>'draft' and content_changed then raise exception 'Published or archived Knowledge versions are immutable';end if;
    if new.status is distinct from old.status and not state_change_allowed then raise exception 'Knowledge version status can only change through the controlled publish workflow';end if;
  end if;
  if tg_op='INSERT' or content_changed then new.content_updated_by=coalesce((select auth.uid()),new.content_updated_by,new.updated_by,new.created_by);new.content_updated_at=now();end if;
  new.updated_at=now();new.updated_by=coalesce((select auth.uid()),new.updated_by);return new;
end $$;
create or replace function public.publish_knowledge_version(p_version_id uuid)
returns jsonb language plpgsql security invoker set search_path=public,private,pg_temp as $$
declare v public.knowledge_article_versions%rowtype;a public.knowledge_articles%rowtype;old_id uuid;
begin
  select * into v from public.knowledge_article_versions where id=p_version_id;if not found then raise exception 'Knowledge version not found';end if;select * into a from public.knowledge_articles where id=v.article_id;if not private.has_workspace_permission(v.workspace_id,'manage_settings') then raise exception 'Insufficient Knowledge permissions';end if;perform set_config('app.knowledge_publish','on',true);old_id:=a.active_version_id;if old_id is not null and old_id<>v.id then update public.knowledge_article_versions set status='archived' where id=old_id;end if;update public.knowledge_article_versions set status='published',published_by=(select auth.uid()),published_at=now() where id=v.id;update public.knowledge_articles set title=v.title,slug=v.slug,summary=v.summary,content=v.content,content_blocks=v.content_blocks,tags=v.tags,product_id=v.product_id,module_id=v.module_id,status='published',active_version_id=v.id,draft_version_id=case when draft_version_id=v.id then null else draft_version_id end,updated_by=(select auth.uid()),updated_at=now() where id=v.article_id;return jsonb_build_object('article_id',v.article_id,'version_id',v.id,'version_number',v.version_number);
end $$;
revoke all on function public.publish_knowledge_version(uuid) from public,anon;grant execute on function public.publish_knowledge_version(uuid) to authenticated;

-- v16.4 performance indexes for Knowledge versioning foreign keys.
create index if not exists idx_knowledge_articles_active_version on public.knowledge_articles(active_version_id) where active_version_id is not null;
create index if not exists idx_knowledge_articles_draft_version on public.knowledge_articles(draft_version_id) where draft_version_id is not null;
create index if not exists idx_knowledge_version_events_workspace on public.knowledge_version_events(workspace_id);


-- ============================================================================
-- BEGIN V16.5 NOTIFICATION CENTER 360
-- ============================================================================
-- Jira Interno TROBBU v16.5
-- Notification Center 360 · Tickets, Helpdesk, Sprints, Knowledge, Staff · ES/EN metadata-ready.

alter table public.notifications
  add column if not exists category text not null default 'system',
  add column if not exists actor_id uuid references auth.users(id) on delete set null,
  add column if not exists dedupe_key text;

alter table public.notification_outbox
  add column if not exists category text not null default 'system',
  add column if not exists dedupe_key text;

create index if not exists idx_notifications_user_unread_created
  on public.notifications(user_id,read_at,created_at desc);
create index if not exists idx_notifications_workspace_category_created
  on public.notifications(workspace_id,category,created_at desc);
create index if not exists idx_notifications_actor on public.notifications(actor_id) where actor_id is not null;
create unique index if not exists uq_notifications_user_dedupe
  on public.notifications(user_id,dedupe_key) where dedupe_key is not null;
create unique index if not exists uq_notification_outbox_user_dedupe
  on public.notification_outbox(recipient_user_id,dedupe_key)
  where recipient_user_id is not null and dedupe_key is not null;

create or replace function private.emit_notification(
  p_workspace uuid,
  p_user uuid,
  p_type text,
  p_category text,
  p_title text,
  p_body text,
  p_metadata jsonb default '{}'::jsonb,
  p_actor uuid default null,
  p_ticket uuid default null,
  p_helpdesk uuid default null,
  p_dedupe text default null,
  p_email boolean default true
)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_in_app boolean:=true;
  v_email boolean:=true;
  v_meta jsonb:=coalesce(p_metadata,'{}'::jsonb)
    || jsonb_build_object('category',coalesce(nullif(p_category,''),'system'),'event_type',p_type);
begin
  if p_workspace is null or p_user is null then return; end if;
  if not exists(select 1 from public.workspace_members wm where wm.workspace_id=p_workspace and wm.user_id=p_user and wm.active=true) then return; end if;

  select coalesce(ws.in_app_notifications,true),coalesce(ws.email_notifications,true)
  into v_in_app,v_email
  from public.workspace_settings ws where ws.workspace_id=p_workspace;
  if not found then v_in_app:=true;v_email:=true;end if;

  if v_in_app and not exists(
    select 1 from public.notifications n
    where n.user_id=p_user and p_dedupe is not null and n.dedupe_key=p_dedupe
  ) then
    insert into public.notifications(
      workspace_id,user_id,ticket_id,helpdesk_ticket_id,type,category,title,body,metadata,actor_id,dedupe_key
    ) values(
      p_workspace,p_user,p_ticket,p_helpdesk,p_type,coalesce(nullif(p_category,''),'system'),
      coalesce(p_title,p_type),p_body,v_meta,p_actor,p_dedupe
    );
  end if;

  if p_email and v_email and not exists(
    select 1 from public.notification_outbox o
    where o.recipient_user_id=p_user and p_dedupe is not null and o.dedupe_key=p_dedupe
  ) then
    insert into public.notification_outbox(
      workspace_id,ticket_id,recipient_user_id,event_type,payload,category,dedupe_key
    ) values(
      p_workspace,p_ticket,p_user,p_type,
      jsonb_build_object('title',p_title,'body',p_body,'metadata',v_meta,'helpdesk_ticket_id',p_helpdesk),
      coalesce(nullif(p_category,''),'system'),p_dedupe
    );
  end if;
end $$;
revoke all on function private.emit_notification(uuid,uuid,text,text,text,text,jsonb,uuid,uuid,uuid,text,boolean) from public,anon;
grant execute on function private.emit_notification(uuid,uuid,text,text,text,text,jsonb,uuid,uuid,uuid,text,boolean) to authenticated;

-- Tickets --------------------------------------------------------------------
create or replace function private.notify_ticket_created()
returns trigger
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare v_user uuid; v_actor uuid:=coalesce(auth.uid(),new.reporter_id);
begin
  if new.reporter_id is not null then
    perform private.emit_notification(new.workspace_id,new.reporter_id,'ticket_created','tickets',
      'Ticket creado '||new.ticket_key,new.title,
      jsonb_build_object('entity_type','ticket','entity_id',new.id,'ticket_key',new.ticket_key,'ticket_title',new.title,'action','created'),
      v_actor,new.id,null,'ticket:'||new.id||':created:reporter:'||new.reporter_id,true);
  end if;

  for v_user in
    select distinct x.uid from (
      select wm.user_id uid from public.workspace_members wm
      where wm.workspace_id=new.workspace_id and wm.active=true
        and (private.member_has_permission(new.workspace_id,wm.user_id,'manage_sprints') or private.member_has_permission(new.workspace_id,wm.user_id,'manage_staff'))
        and private.member_has_product_access(new.workspace_id,wm.user_id,new.product_id)
      union select new.dev_owner_id
      union select new.qa_owner_id
    ) x
    where x.uid is not null and x.uid is distinct from new.reporter_id
  loop
    perform private.emit_notification(new.workspace_id,v_user,'ticket_created','tickets',
      'Nuevo ticket '||new.ticket_key,new.title,
      jsonb_build_object('entity_type','ticket','entity_id',new.id,'ticket_key',new.ticket_key,'ticket_title',new.title,'action','created'),
      v_actor,new.id,null,'ticket:'||new.id||':created:user:'||v_user,true);
  end loop;
  return new;
end $$;

create or replace function private.track_ticket_change()
returns trigger
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare
  v_actor uuid:=auth.uid(); v_user uuid; v_sprint_name text; v_old_sprint_name text;
begin
  if old.status is distinct from new.status then
    if new.status='in_progress' and new.start_date is null then new.start_date:=current_date; end if;
    if new.status='dev_done' and new.dev_completed_at is null then new.dev_completed_at:=now(); end if;
    if new.status='qa_passed' and new.qa_completed_at is null then new.qa_completed_at:=now(); end if;
    if new.status='closed' and new.closed_at is null then new.closed_at:=now(); end if;
    insert into public.ticket_activity(ticket_id,actor_id,action,from_value,to_value)
    values(new.id,v_actor,'status_changed',old.status::text,new.status::text);

    for v_user in select distinct x.uid from (values(new.reporter_id),(new.dev_owner_id),(new.qa_owner_id)) x(uid)
      where x.uid is not null and x.uid is distinct from v_actor
    loop
      perform private.emit_notification(new.workspace_id,v_user,
        case when new.status='qa_rejected' then 'qa_rejected' when new.status='qa_passed' then 'qa_passed' when new.status='closed' then 'ticket_closed' else 'ticket_status' end,
        'tickets',new.ticket_key||' actualizado',
        'El estado cambió de '||old.status::text||' a '||new.status::text||'.',
        jsonb_build_object('entity_type','ticket','entity_id',new.id,'ticket_key',new.ticket_key,'ticket_title',new.title,'action','status_changed','from_status',old.status::text,'to_status',new.status::text),
        v_actor,new.id,null,'ticket:'||new.id||':status:'||new.status::text||':'||v_user||':'||extract(epoch from new.updated_at)::bigint,true);
    end loop;
  end if;

  if old.dev_owner_id is distinct from new.dev_owner_id and new.dev_owner_id is not null and new.dev_owner_id is distinct from v_actor then
    perform private.emit_notification(new.workspace_id,new.dev_owner_id,'assigned_dev','tickets',
      'Ticket asignado '||new.ticket_key,new.title,
      jsonb_build_object('entity_type','ticket','entity_id',new.id,'ticket_key',new.ticket_key,'ticket_title',new.title,'action','assigned_dev'),
      v_actor,new.id,null,'ticket:'||new.id||':dev:'||new.dev_owner_id||':'||extract(epoch from new.updated_at)::bigint,true);
  end if;

  if old.qa_owner_id is distinct from new.qa_owner_id and new.qa_owner_id is not null and new.qa_owner_id is distinct from v_actor then
    perform private.emit_notification(new.workspace_id,new.qa_owner_id,'assigned_qa','tickets',
      'Ticket asignado a QA '||new.ticket_key,new.title,
      jsonb_build_object('entity_type','ticket','entity_id',new.id,'ticket_key',new.ticket_key,'ticket_title',new.title,'action','assigned_qa'),
      v_actor,new.id,null,'ticket:'||new.id||':qa:'||new.qa_owner_id||':'||extract(epoch from new.updated_at)::bigint,true);
  end if;

  if old.sprint_id is distinct from new.sprint_id then
    if new.sprint_id is not null then select name into v_sprint_name from public.sprints where id=new.sprint_id; end if;
    if old.sprint_id is not null then select name into v_old_sprint_name from public.sprints where id=old.sprint_id; end if;
    for v_user in select distinct x.uid from (values(new.reporter_id),(new.dev_owner_id),(new.qa_owner_id)) x(uid)
      where x.uid is not null and x.uid is distinct from v_actor
    loop
      perform private.emit_notification(new.workspace_id,v_user,'ticket_sprint','sprints',
        new.ticket_key||case when new.sprint_id is null then ' volvió a Backlog' else ' movido a sprint' end,
        case when new.sprint_id is null then 'Se retiró de '||coalesce(v_old_sprint_name,'Sprint')||' y volvió a Backlog.' else 'Ahora forma parte de '||coalesce(v_sprint_name,'Sprint')||'.' end,
        jsonb_build_object('entity_type','ticket','entity_id',new.id,'ticket_key',new.ticket_key,'ticket_title',new.title,'action','sprint_changed','sprint_id',new.sprint_id,'sprint_name',v_sprint_name,'old_sprint_id',old.sprint_id,'old_sprint_name',v_old_sprint_name),
        v_actor,new.id,null,'ticket:'||new.id||':sprint:'||coalesce(new.sprint_id::text,'backlog')||':'||v_user||':'||extract(epoch from new.updated_at)::bigint,true);
    end loop;
  end if;
  return new;
end $$;

create or replace function private.notify_ticket_comment_created()
returns trigger
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare v_ticket public.tickets%rowtype; v_user uuid;
begin
  select * into v_ticket from public.tickets where id=new.ticket_id;if not found then return new;end if;
  for v_user in select distinct x.uid from (values(v_ticket.reporter_id),(v_ticket.dev_owner_id),(v_ticket.qa_owner_id)) x(uid)
    where x.uid is not null and x.uid is distinct from new.author_id
  loop
    perform private.emit_notification(v_ticket.workspace_id,v_user,'ticket_comment','tickets',
      v_ticket.ticket_key||' · nuevo comentario',left(coalesce(new.body,'Nuevo comentario'),180),
      jsonb_build_object('entity_type','ticket','entity_id',v_ticket.id,'ticket_key',v_ticket.ticket_key,'ticket_title',v_ticket.title,'action','comment','comment_id',new.id,'comment_preview',left(coalesce(new.body,''),180)),
      new.author_id,v_ticket.id,null,'ticket:'||v_ticket.id||':comment:'||new.id||':'||v_user,true);
  end loop;
  return new;
end $$;

create or replace function private.notify_ticket_attachment_created()
returns trigger
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare v_ticket public.tickets%rowtype; v_user uuid;
begin
  if new.comment_id is not null then return new; end if;
  select * into v_ticket from public.tickets where id=new.ticket_id;if not found then return new;end if;
  for v_user in select distinct x.uid from (values(v_ticket.reporter_id),(v_ticket.dev_owner_id),(v_ticket.qa_owner_id)) x(uid)
    where x.uid is not null and x.uid is distinct from new.uploaded_by
  loop
    perform private.emit_notification(v_ticket.workspace_id,v_user,'ticket_evidence','tickets',
      v_ticket.ticket_key||' · nueva evidencia',coalesce(new.file_name,'Se agregó una evidencia al ticket.'),
      jsonb_build_object('entity_type','ticket','entity_id',v_ticket.id,'ticket_key',v_ticket.ticket_key,'ticket_title',v_ticket.title,'action','evidence','attachment_id',new.id,'file_name',new.file_name),
      new.uploaded_by,v_ticket.id,null,'ticket:'||v_ticket.id||':evidence:'||new.id||':'||v_user,true);
  end loop;
  return new;
end $$;
drop trigger if exists trg_notify_ticket_attachment_created on public.ticket_attachments;
create trigger trg_notify_ticket_attachment_created after insert on public.ticket_attachments for each row execute function private.notify_ticket_attachment_created();

-- Helpdesk -------------------------------------------------------------------
create or replace function private.helpdesk_created()
returns trigger
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare v_user uuid;v_proposal boolean:=new.category in ('module','feature','new_requirement');v_actor uuid:=coalesce(auth.uid(),new.requester_user_id);
begin
  insert into public.helpdesk_activity(helpdesk_ticket_id,actor_id,action,to_value) values(new.id,v_actor,'created',new.status);
  if new.requester_user_id is not null then
    perform private.emit_notification(new.workspace_id,new.requester_user_id,'helpdesk_created','helpdesk',
      'Solicitud creada '||new.ticket_key,case when v_proposal then 'Tu propuesta fue registrada y quedó pendiente de decisión.' else 'Tu solicitud fue registrada y está pendiente de canalización.' end,
      jsonb_build_object('entity_type','helpdesk','entity_id',new.id,'helpdesk_key',new.ticket_key,'subject',new.subject,'action','created'),
      v_actor,null,new.id,'helpdesk:'||new.id||':created:requester:'||new.requester_user_id,true);
  end if;
  for v_user in select wm.user_id from public.workspace_members wm
    where wm.workspace_id=new.workspace_id and wm.active=true
      and (wm.role in ('pm','admin','superadmin') or private.member_has_permission(new.workspace_id,wm.user_id,'manage_helpdesk'))
      and wm.user_id is distinct from new.requester_user_id
  loop
    perform private.emit_notification(new.workspace_id,v_user,'helpdesk_new','helpdesk',
      case when v_proposal then 'Nueva propuesta por decidir · '||new.ticket_key else 'Nueva solicitud por canalizar · '||new.ticket_key end,new.subject,
      jsonb_build_object('entity_type','helpdesk','entity_id',new.id,'helpdesk_key',new.ticket_key,'subject',new.subject,'action','new'),
      v_actor,null,new.id,'helpdesk:'||new.id||':new:'||v_user,true);
  end loop;
  return new;
end $$;

create or replace function private.track_helpdesk_change()
returns trigger
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare v_resolution_hours integer:=24;v_actor uuid:=auth.uid();v_user uuid;
begin
  select coalesce(ws.sla_resolution_hours,24) into v_resolution_hours from public.workspace_settings ws where ws.workspace_id=new.workspace_id;
  if not found then v_resolution_hours:=24;end if;
  if old.status is distinct from new.status then
    if new.status='review' and new.reviewed_at is null then new.reviewed_at=now();new.first_response_at=coalesce(new.first_response_at,now());new.due_at=coalesce(new.due_at,now()+make_interval(hours=>v_resolution_hours));end if;
    if new.status='attended' and new.attended_at is null then new.attended_at=now();new.first_response_at=coalesce(new.first_response_at,now());new.due_at=coalesce(new.due_at,now()+make_interval(hours=>v_resolution_hours));end if;
    if new.status='resolved' and new.resolved_at is null then new.resolved_at=now();end if;
    if new.status='closed' and new.closed_at is null then new.closed_at=now();end if;
    insert into public.helpdesk_activity(helpdesk_ticket_id,actor_id,action,from_value,to_value) values(new.id,v_actor,'status_changed',old.status,new.status);
    if new.requester_user_id is not null and new.requester_user_id is distinct from v_actor then
      perform private.emit_notification(new.workspace_id,new.requester_user_id,'helpdesk_status','helpdesk',new.ticket_key||' actualizado','El estado de tu solicitud cambió a '||new.status||'.',
        jsonb_build_object('entity_type','helpdesk','entity_id',new.id,'helpdesk_key',new.ticket_key,'subject',new.subject,'action','status_changed','from_status',old.status,'to_status',new.status),v_actor,null,new.id,'helpdesk:'||new.id||':status:'||new.status||':'||extract(epoch from new.updated_at)::bigint,true);
    end if;
    if new.assigned_to is not null and new.assigned_to is distinct from v_actor and new.assigned_to is distinct from new.requester_user_id then
      perform private.emit_notification(new.workspace_id,new.assigned_to,'helpdesk_status','helpdesk',new.ticket_key||' actualizado','El estado cambió a '||new.status||'.',
        jsonb_build_object('entity_type','helpdesk','entity_id',new.id,'helpdesk_key',new.ticket_key,'subject',new.subject,'action','status_changed','from_status',old.status,'to_status',new.status),v_actor,null,new.id,'helpdesk:'||new.id||':status-assignee:'||new.status||':'||extract(epoch from new.updated_at)::bigint,true);
    end if;
  end if;
  if old.assigned_to is distinct from new.assigned_to and new.assigned_to is not null then
    insert into public.helpdesk_activity(helpdesk_ticket_id,actor_id,action,from_value,to_value) values(new.id,v_actor,'assigned',old.assigned_to::text,new.assigned_to::text);
    perform private.emit_notification(new.workspace_id,new.assigned_to,'helpdesk_assigned','helpdesk',new.ticket_key||' asignado',new.subject,
      jsonb_build_object('entity_type','helpdesk','entity_id',new.id,'helpdesk_key',new.ticket_key,'subject',new.subject,'action','assigned'),v_actor,null,new.id,'helpdesk:'||new.id||':assigned:'||new.assigned_to||':'||extract(epoch from new.updated_at)::bigint,true);
  end if;
  return new;
end $$;

create or replace function private.notify_helpdesk_comment_created()
returns trigger
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare v_req public.helpdesk_tickets%rowtype;v_user uuid;
begin
  select * into v_req from public.helpdesk_tickets where id=new.helpdesk_ticket_id;if not found then return new;end if;
  for v_user in
    select distinct x.user_id from (
      select v_req.requester_user_id user_id union select v_req.assigned_to
      union select wm.user_id from public.workspace_members wm where wm.workspace_id=v_req.workspace_id and wm.active=true and private.member_has_permission(v_req.workspace_id,wm.user_id,'manage_helpdesk')
    ) x where x.user_id is not null and x.user_id is distinct from new.author_id
  loop
    perform private.emit_notification(v_req.workspace_id,v_user,'helpdesk_comment','helpdesk',v_req.ticket_key||' · nuevo comentario',left(coalesce(new.body,'Nuevo comentario'),180),
      jsonb_build_object('entity_type','helpdesk','entity_id',v_req.id,'helpdesk_key',v_req.ticket_key,'subject',v_req.subject,'action','comment','comment_id',new.id,'comment_preview',left(coalesce(new.body,''),180)),new.author_id,null,v_req.id,'helpdesk:'||v_req.id||':comment:'||new.id||':'||v_user,true);
  end loop;
  return new;
end $$;

create or replace function private.notify_helpdesk_attachment_created()
returns trigger
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare v_req public.helpdesk_tickets%rowtype;v_user uuid;
begin
  if new.comment_id is not null then return new;end if;
  select * into v_req from public.helpdesk_tickets where id=new.helpdesk_ticket_id;if not found then return new;end if;
  for v_user in
    select distinct x.user_id from (
      select v_req.requester_user_id user_id union select v_req.assigned_to
      union select wm.user_id from public.workspace_members wm where wm.workspace_id=v_req.workspace_id and wm.active=true and private.member_has_permission(v_req.workspace_id,wm.user_id,'manage_helpdesk')
    ) x where x.user_id is not null and x.user_id is distinct from new.uploaded_by
  loop
    perform private.emit_notification(v_req.workspace_id,v_user,'helpdesk_evidence','helpdesk',v_req.ticket_key||' · nueva evidencia',coalesce(new.file_name,'Se agregó evidencia a la solicitud.'),
      jsonb_build_object('entity_type','helpdesk','entity_id',v_req.id,'helpdesk_key',v_req.ticket_key,'subject',v_req.subject,'action','evidence','attachment_id',new.id,'file_name',new.file_name),new.uploaded_by,null,v_req.id,'helpdesk:'||v_req.id||':evidence:'||new.id||':'||v_user,true);
  end loop;
  return new;
end $$;
drop trigger if exists trg_notify_helpdesk_attachment_created on public.helpdesk_attachments;
create trigger trg_notify_helpdesk_attachment_created after insert on public.helpdesk_attachments for each row execute function private.notify_helpdesk_attachment_created();

-- Sprint ---------------------------------------------------------------------
create or replace function private.notify_sprint_created()
returns trigger
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare v_user uuid;v_actor uuid:=coalesce(auth.uid(),new.created_by);
begin
  for v_user in select wm.user_id from public.workspace_members wm
    where wm.workspace_id=new.workspace_id and wm.active=true and private.member_has_permission(new.workspace_id,wm.user_id,'manage_sprints') and wm.user_id is distinct from v_actor
  loop
    perform private.emit_notification(new.workspace_id,v_user,'sprint_created','sprints','Nuevo sprint · '||new.name,coalesce(new.goal,'Sprint creado.'),
      jsonb_build_object('entity_type','sprint','entity_id',new.id,'sprint_name',new.name,'action','created','status',new.status::text),v_actor,null,null,'sprint:'||new.id||':created:'||v_user,true);
  end loop;
  return new;
end $$;
drop trigger if exists trg_notify_sprint_created on public.sprints;
create trigger trg_notify_sprint_created after insert on public.sprints for each row execute function private.notify_sprint_created();

create or replace function private.notify_sprint_changed()
returns trigger
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare v_user uuid;v_actor uuid:=auth.uid();v_important boolean:=false;
begin
  v_important:=old.status is distinct from new.status or old.start_date is distinct from new.start_date or old.end_date is distinct from new.end_date or old.goal is distinct from new.goal;
  if not v_important then return new;end if;
  for v_user in
    select distinct x.uid from (
      select wm.user_id uid from public.workspace_members wm where wm.workspace_id=new.workspace_id and wm.active=true and private.member_has_permission(new.workspace_id,wm.user_id,'manage_sprints')
      union select t.reporter_id from public.tickets t where t.sprint_id=new.id
      union select t.dev_owner_id from public.tickets t where t.sprint_id=new.id
      union select t.qa_owner_id from public.tickets t where t.sprint_id=new.id
    ) x where x.uid is not null and x.uid is distinct from v_actor
  loop
    perform private.emit_notification(new.workspace_id,v_user,'sprint_updated','sprints',new.name||' actualizado',
      case when old.status is distinct from new.status then 'El sprint cambió a '||new.status::text||'.' else 'Se actualizaron la planeación u objetivo del sprint.' end,
      jsonb_build_object('entity_type','sprint','entity_id',new.id,'sprint_name',new.name,'action','updated','status',new.status::text,'old_status',old.status::text,'start_date',new.start_date,'end_date',new.end_date),v_actor,null,null,'sprint:'||new.id||':updated:'||v_user||':'||extract(epoch from new.updated_at)::bigint,true);
  end loop;
  return new;
end $$;
drop trigger if exists trg_notify_sprint_changed on public.sprints;
create trigger trg_notify_sprint_changed after update on public.sprints for each row execute function private.notify_sprint_changed();

create or replace function private.notify_sprint_comment_created()
returns trigger
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare v_sprint public.sprints%rowtype;v_user uuid;
begin
  select * into v_sprint from public.sprints where id=new.sprint_id;if not found then return new;end if;
  for v_user in
    select distinct x.uid from (
      select wm.user_id uid from public.workspace_members wm where wm.workspace_id=v_sprint.workspace_id and wm.active=true and private.member_has_permission(v_sprint.workspace_id,wm.user_id,'manage_sprints')
      union select t.reporter_id from public.tickets t where t.sprint_id=v_sprint.id
      union select t.dev_owner_id from public.tickets t where t.sprint_id=v_sprint.id
      union select t.qa_owner_id from public.tickets t where t.sprint_id=v_sprint.id
    ) x where x.uid is not null and x.uid is distinct from new.author_id
  loop
    perform private.emit_notification(v_sprint.workspace_id,v_user,'sprint_comment','sprints',v_sprint.name||' · nuevo comentario',left(coalesce(new.body,'Nuevo comentario'),180),
      jsonb_build_object('entity_type','sprint','entity_id',v_sprint.id,'sprint_name',v_sprint.name,'action','comment','comment_id',new.id,'comment_preview',left(coalesce(new.body,''),180)),new.author_id,null,null,'sprint:'||v_sprint.id||':comment:'||new.id||':'||v_user,true);
  end loop;
  return new;
end $$;
drop trigger if exists trg_notify_sprint_comment_created on public.sprint_comments;
create trigger trg_notify_sprint_comment_created after insert on public.sprint_comments for each row execute function private.notify_sprint_comment_created();

create or replace function private.notify_sprint_attachment_created()
returns trigger
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare v_sprint public.sprints%rowtype;v_user uuid;
begin
  if new.comment_id is not null then return new;end if;
  select * into v_sprint from public.sprints where id=new.sprint_id;if not found then return new;end if;
  for v_user in
    select distinct x.uid from (
      select wm.user_id uid from public.workspace_members wm where wm.workspace_id=v_sprint.workspace_id and wm.active=true and private.member_has_permission(v_sprint.workspace_id,wm.user_id,'manage_sprints')
      union select t.reporter_id from public.tickets t where t.sprint_id=v_sprint.id
      union select t.dev_owner_id from public.tickets t where t.sprint_id=v_sprint.id
      union select t.qa_owner_id from public.tickets t where t.sprint_id=v_sprint.id
    ) x where x.uid is not null and x.uid is distinct from new.uploaded_by
  loop
    perform private.emit_notification(v_sprint.workspace_id,v_user,'sprint_evidence','sprints',v_sprint.name||' · nueva evidencia',coalesce(new.file_name,'Se agregó evidencia al sprint.'),
      jsonb_build_object('entity_type','sprint','entity_id',v_sprint.id,'sprint_name',v_sprint.name,'action','evidence','attachment_id',new.id,'file_name',new.file_name),new.uploaded_by,null,null,'sprint:'||v_sprint.id||':evidence:'||new.id||':'||v_user,true);
  end loop;
  return new;
end $$;
drop trigger if exists trg_notify_sprint_attachment_created on public.sprint_attachments;
create trigger trg_notify_sprint_attachment_created after insert on public.sprint_attachments for each row execute function private.notify_sprint_attachment_created();

-- Knowledge ------------------------------------------------------------------
create or replace function private.notify_knowledge_version_event()
returns trigger
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare v_version public.knowledge_article_versions%rowtype;v_article public.knowledge_articles%rowtype;v_user uuid;v_type text;v_title text;v_body text;
begin
  select * into v_version from public.knowledge_article_versions where id=new.version_id;if not found then return new;end if;
  select * into v_article from public.knowledge_articles where id=new.article_id;if not found then return new;end if;
  if new.event_type='created' then
    v_type:='knowledge_draft';v_title:='Nuevo borrador · '||v_version.title;v_body:='Versión '||v_version.version_number||' · '||coalesce(new.note,'Nueva versión en borrador.');
    for v_user in select wm.user_id from public.workspace_members wm where wm.workspace_id=new.workspace_id and wm.active=true and private.member_has_permission(new.workspace_id,wm.user_id,'manage_settings') and wm.user_id is distinct from new.actor_id loop
      perform private.emit_notification(new.workspace_id,v_user,v_type,'knowledge',v_title,v_body,
        jsonb_build_object('entity_type','knowledge','entity_id',new.article_id,'article_id',new.article_id,'version_id',new.version_id,'version_number',v_version.version_number,'article_title',v_version.title,'action','draft_created'),new.actor_id,null,null,'knowledge:'||new.version_id||':draft:'||v_user,true);
    end loop;
  elsif new.event_type in ('published','restored') then
    v_type:=case when new.event_type='restored' then 'knowledge_restored' else 'knowledge_published' end;
    v_title:=case when new.event_type='restored' then 'Artículo restaurado · ' else 'Nuevo artículo publicado · ' end||v_version.title;
    v_body:='Versión '||v_version.version_number||' · '||coalesce(new.note,'Knowledge actualizado.');
    for v_user in select wm.user_id from public.workspace_members wm where wm.workspace_id=new.workspace_id and wm.active=true and wm.user_id is distinct from new.actor_id loop
      perform private.emit_notification(new.workspace_id,v_user,v_type,'knowledge',v_title,v_body,
        jsonb_build_object('entity_type','knowledge','entity_id',new.article_id,'article_id',new.article_id,'version_id',new.version_id,'version_number',v_version.version_number,'article_title',v_version.title,'action',new.event_type),new.actor_id,null,null,'knowledge:'||new.version_id||':'||new.event_type||':'||v_user,true);
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists trg_notify_knowledge_version_event on public.knowledge_version_events;
create trigger trg_notify_knowledge_version_event after insert on public.knowledge_version_events for each row execute function private.notify_knowledge_version_event();

-- Staff ----------------------------------------------------------------------
create or replace function private.notify_workspace_member_change()
returns trigger
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare v_actor uuid:=auth.uid();v_name text;v_role text;
begin
  select coalesce(p.full_name,p.email,'Usuario') into v_name from public.profiles p where p.id=new.user_id;
  v_role:=coalesce(new.role::text,'consulta');
  if tg_op='INSERT' then
    perform private.emit_notification(new.workspace_id,new.user_id,'member_added','staff','Acceso al workspace habilitado',
      'Fuiste agregado al workspace con rol '||v_role||'.',
      jsonb_build_object('entity_type','staff','entity_id',new.user_id,'member_user_id',new.user_id,'member_name',v_name,'role',v_role,'action','added'),v_actor,null,null,'staff:'||new.workspace_id||':'||new.user_id||':added',true);
  elsif old.role is distinct from new.role or old.role_id is distinct from new.role_id or old.active is distinct from new.active or old.all_products is distinct from new.all_products or old.permissions is distinct from new.permissions then
    perform private.emit_notification(new.workspace_id,new.user_id,'member_access_updated','staff','Tus accesos fueron actualizados',
      case when new.active then 'Tu rol, permisos o alcance de productos fue actualizado.' else 'Tu acceso al workspace fue desactivado.' end,
      jsonb_build_object('entity_type','staff','entity_id',new.user_id,'member_user_id',new.user_id,'member_name',v_name,'role',v_role,'active',new.active,'action','access_updated'),v_actor,null,null,'staff:'||new.workspace_id||':'||new.user_id||':updated:'||extract(epoch from now())::bigint,true);
  end if;
  return new;
end $$;
drop trigger if exists trg_notify_workspace_member_change on public.workspace_members;
create trigger trg_notify_workspace_member_change after insert or update on public.workspace_members for each row execute function private.notify_workspace_member_change();

-- Requirement decision now uses the unified notification pipeline.
create or replace function private.record_helpdesk_requirement_decision(p_helpdesk_id uuid,p_decision text,p_ticket_id uuid,p_ticket_key text,p_note text)
returns void
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare v_req public.helpdesk_tickets%rowtype;v_actor uuid:=auth.uid();
begin
  if v_actor is null then raise exception 'Authentication required';end if;
  select * into v_req from public.helpdesk_tickets where id=p_helpdesk_id;if not found then raise exception 'Solicitud no encontrada';end if;
  if not private.member_has_permission(v_req.workspace_id,v_actor,'manage_sprints') then raise exception 'No tienes permiso para registrar esta decisión';end if;
  insert into public.helpdesk_activity(helpdesk_ticket_id,actor_id,action,from_value,to_value)
  values(p_helpdesk_id,v_actor,'requirement_decision','pending',case when p_decision='accepted_backlog' then 'accepted_backlog:'||coalesce(p_ticket_key,'') else 'rejected' end);
  if v_req.requester_user_id is not null then
    perform private.emit_notification(v_req.workspace_id,v_req.requester_user_id,'helpdesk_requirement_decision','helpdesk',
      case when p_decision='accepted_backlog' then coalesce(v_req.ticket_key,'Solicitud')||' aceptado a Backlog' else coalesce(v_req.ticket_key,'Solicitud')||' · sugerencia rechazada' end,
      case when p_decision='accepted_backlog' then 'El requerimiento fue aceptado como '||coalesce(p_ticket_key,'ticket de Backlog')||'.' else 'El requerimiento fue descartado. '||trim(coalesce(p_note,'')) end,
      jsonb_build_object('entity_type','helpdesk','entity_id',p_helpdesk_id,'helpdesk_key',v_req.ticket_key,'subject',v_req.subject,'action','requirement_decision','decision',p_decision,'converted_ticket_id',p_ticket_id,'converted_ticket_key',p_ticket_key,'note',p_note),v_actor,p_ticket_id,p_helpdesk_id,
      'helpdesk:'||p_helpdesk_id||':decision:'||p_decision||':'||coalesce(p_ticket_id::text,'none'),true);
  end if;
end $$;

-- Keep notification rows visible to their recipient for metadata-only entity types.
-- Existing ticket/helpdesk restrictions remain enforced where foreign ids exist.

-- Add new related tables to Realtime when needed.
do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notification_outbox') then
    alter publication supabase_realtime add table public.notification_outbox;
  end if;
end $$;

-- Performance hardening final v16.5
-- Reuse pre-existing unread index and cover notification resource FKs.
drop index if exists public.idx_notifications_user_read;
create index if not exists idx_notifications_ticket_id on public.notifications(ticket_id) where ticket_id is not null;
create index if not exists idx_notifications_helpdesk_ticket_id on public.notifications(helpdesk_ticket_id) where helpdesk_ticket_id is not null;

-- ============================================================================
-- END V16.5 NOTIFICATION CENTER 360
-- ============================================================================


-- BEGIN v16.6 CONSOLIDATED
-- Jira Interno TROBBU v16.6
-- Deep links por entorno + Helpdesk product profiling + Knowledge preview/i18n frontend support

alter table public.helpdesk_tickets
  add column if not exists product_id uuid references public.products(id) on delete set null;

create index if not exists idx_helpdesk_tickets_product_id
  on public.helpdesk_tickets(product_id) where product_id is not null;

create or replace function private.validate_helpdesk_product()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if new.product_id is not null and not exists(
    select 1 from public.products p
    where p.id=new.product_id and p.workspace_id=new.workspace_id
  ) then
    raise exception 'El producto seleccionado no pertenece a este workspace';
  end if;
  if tg_op='UPDATE'
     and coalesce(old.proposal_status,'pending')<>'pending'
     and new.product_id is distinct from old.product_id then
    raise exception 'El producto de un requerimiento ya evaluado no puede modificarse';
  end if;
  return new;
end $$;
revoke all on function private.validate_helpdesk_product() from public,anon,authenticated;

drop trigger if exists trg_00_validate_helpdesk_product on public.helpdesk_tickets;
create trigger trg_00_validate_helpdesk_product
before insert or update of workspace_id,product_id on public.helpdesk_tickets
for each row execute function private.validate_helpdesk_product();


-- Catálogo Helpdesk integrado a la política SELECT existente de productos.
-- Ver el nombre/clave del producto no concede acceso a tickets/tableros; esas tablas conservan RLS independiente.
drop policy if exists products_helpdesk_catalog_select on public.products;
drop policy if exists products_select on public.products;
create policy products_select
on public.products for select to authenticated
using (
  private.is_workspace_member(workspace_id)
  and (
    private.has_product_access(workspace_id,id)
    or coalesce(
      (select ws.helpdesk_enabled from public.workspace_settings ws where ws.workspace_id=products.workspace_id),
      true
    )
  )
);

-- Catálogo de productos visible exclusivamente para clasificar solicitudes de Helpdesk.
-- No concede acceso operativo a tickets/tableros del producto.
create or replace function public.list_helpdesk_products(p_workspace uuid)
returns table(id uuid,name text,key text,description text,board_order integer)
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not private.is_workspace_member(p_workspace) then raise exception 'Workspace access required'; end if;
  if not coalesce((select ws.helpdesk_enabled from public.workspace_settings ws where ws.workspace_id=p_workspace),true) then
    return;
  end if;
  return query
  select p.id,p.name,p.key,p.description,p.board_order
  from public.products p
  where p.workspace_id=p_workspace
  order by p.board_order,p.name;
end $$;
revoke all on function public.list_helpdesk_products(uuid) from public,anon;
grant execute on function public.list_helpdesk_products(uuid) to authenticated;

create or replace function public.decide_helpdesk_requirement(
  p_helpdesk_id uuid,
  p_decision text,
  p_product_id uuid default null,
  p_note text default null
)
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  v_req public.helpdesk_tickets%rowtype;
  v_ticket_id uuid;
  v_ticket_key text;
  v_title text;
  v_product_id uuid;
begin
  select * into v_req from public.helpdesk_tickets where id=p_helpdesk_id for update;
  if not found then raise exception 'Solicitud no encontrada'; end if;
  if v_req.category not in ('module','feature','new_requirement') then raise exception 'La solicitud no es una propuesta de producto'; end if;
  if coalesce(v_req.proposal_status,'pending')<>'pending' then raise exception 'Este requerimiento ya fue evaluado'; end if;
  if not private.has_workspace_permission(v_req.workspace_id,'manage_sprints') then
    raise exception 'Solo PM, Admin, Superadmin o un rol con permiso de planeación puede evaluar nuevos requerimientos';
  end if;
  if p_decision not in ('accepted_backlog','rejected') then raise exception 'Decisión inválida'; end if;

  if p_decision='accepted_backlog' then
    v_product_id:=coalesce(p_product_id,v_req.product_id);
    if v_product_id is null then raise exception 'Selecciona el producto al que se enviará el requerimiento'; end if;
    if not exists(select 1 from public.products p where p.id=v_product_id and p.workspace_id=v_req.workspace_id) then
      raise exception 'El producto no pertenece a este workspace';
    end if;
    if not private.has_product_access(v_req.workspace_id,v_product_id) then
      raise exception 'No tienes acceso al producto seleccionado';
    end if;

    v_title:=left(coalesce(nullif(trim(v_req.subject),''),'Nuevo requerimiento'),220);
    insert into public.tickets(
      workspace_id,product_id,title,description,type,priority,status,reporter_id,
      sprint_id,dev_owner_id,qa_owner_id,story_points,start_date,due_date
    ) values (
      v_req.workspace_id,v_product_id,v_title,
      concat(
        'Origen: ',coalesce(v_req.ticket_key,'Helpdesk'),E'\n',
        'Tipo: ',coalesce(v_req.category,'new_requirement'),E'\n',
        'Solicitante: ',coalesce(v_req.requester_name,v_req.requester_email,'—'),E'\n\n',
        coalesce(v_req.description,'Sin descripción.'),
        case when nullif(trim(coalesce(p_note,'')),'') is not null
          then E'\n\nDecisión PM/Admin:\n'||trim(p_note) else '' end
      ),
      'improvement',v_req.priority,'backlog',auth.uid(),
      null,null,null,null,null,null
    ) returning id,ticket_key into v_ticket_id,v_ticket_key;
  else
    if nullif(trim(coalesce(p_note,'')),'') is null then
      raise exception 'Indica el motivo para rechazar la sugerencia';
    end if;
  end if;

  perform set_config('app.helpdesk_requirement_decision','1',true);
  update public.helpdesk_tickets
  set proposal_status=p_decision,
      decision_by=auth.uid(),
      decision_at=now(),
      decision_note=nullif(trim(coalesce(p_note,'')),''),
      converted_ticket_id=v_ticket_id,
      converted_ticket_key=v_ticket_key,
      product_id=case when p_decision='accepted_backlog' then v_product_id else product_id end
  where id=p_helpdesk_id;

  perform private.record_helpdesk_requirement_decision(p_helpdesk_id,p_decision,v_ticket_id,v_ticket_key,p_note);

  return jsonb_build_object(
    'ok',true,
    'decision',p_decision,
    'ticket_id',v_ticket_id,
    'ticket_key',v_ticket_key,
    'product_id',case when p_decision='accepted_backlog' then v_product_id else v_req.product_id end
  );
end $$;
revoke all on function public.decide_helpdesk_requirement(uuid,text,uuid,text) from public,anon;
grant execute on function public.decide_helpdesk_requirement(uuid,text,uuid,text) to authenticated;

-- Realtime already includes helpdesk_tickets; no additional publication required.

-- END v16.6 CONSOLIDATED

-- =============================================================================
-- Jira Interno TROBBU v16.7 consolidated upgrade
-- =============================================================================
-- Jira Interno TROBBU v16.7
-- Workspace permissions + assignment audit + document attachments.

-- -----------------------------------------------------------------------------
-- 1) Workspace creation: only Admin / PM / Superadmin (plus first-install bootstrap)
-- -----------------------------------------------------------------------------
create or replace function private.user_can_create_workspace(p_user uuid default auth.uid())
returns boolean
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
begin
  if p_user is null then return false; end if;
  -- Bootstrap exception only when the installation does not contain any workspace yet.
  if not exists(select 1 from public.workspaces) then return true; end if;
  return exists(
    select 1
    from public.workspace_members wm
    left join public.workspace_roles wr
      on wr.id=wm.role_id and wr.workspace_id=wm.workspace_id
    where wm.user_id=p_user
      and wm.active=true
      and coalesce(wr.base_role::text,wm.role::text) in ('admin','pm','superadmin')
  );
end $$;
revoke all on function private.user_can_create_workspace(uuid) from public,anon;
grant execute on function private.user_can_create_workspace(uuid) to authenticated;

drop policy if exists workspaces_insert on public.workspaces;
create policy workspaces_insert
on public.workspaces
for insert
to authenticated
with check (
  created_by=(select auth.uid())
  and private.user_can_create_workspace((select auth.uid()))
);

create or replace function public.create_workspace(p_name text,p_slug text)
returns uuid
language plpgsql
security invoker
set search_path=public,private,pg_temp
as $$
declare
  v_uid uuid:=(select auth.uid());
  v_id uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not private.user_can_create_workspace(v_uid) then
    raise exception 'Solo Admin, PM o Superadmin pueden crear espacios de trabajo';
  end if;
  if nullif(trim(p_name),'') is null or nullif(trim(p_slug),'') is null then
    raise exception 'Workspace name and slug are required';
  end if;
  insert into public.workspaces(name,slug,created_by)
  values(trim(p_name),trim(p_slug),v_uid)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.create_workspace(text,text) from public,anon;
grant execute on function public.create_workspace(text,text) to authenticated;

-- -----------------------------------------------------------------------------
-- 2) Ticket assignment audit for all assignment / reassignment / unassignment
-- -----------------------------------------------------------------------------
create or replace function private.log_ticket_assignment_change()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_actor uuid:=(select auth.uid());
begin
  if old.dev_owner_id is distinct from new.dev_owner_id then
    insert into public.ticket_activity(ticket_id,actor_id,action,from_value,to_value,metadata)
    values(
      new.id,v_actor,'dev_assignee_changed',
      old.dev_owner_id::text,new.dev_owner_id::text,
      jsonb_build_object('assignment_role','dev','product_id',new.product_id,'ticket_key',new.ticket_key)
    );
  end if;
  if old.qa_owner_id is distinct from new.qa_owner_id then
    insert into public.ticket_activity(ticket_id,actor_id,action,from_value,to_value,metadata)
    values(
      new.id,v_actor,'qa_assignee_changed',
      old.qa_owner_id::text,new.qa_owner_id::text,
      jsonb_build_object('assignment_role','qa','product_id',new.product_id,'ticket_key',new.ticket_key)
    );
  end if;
  return new;
end $$;
revoke all on function private.log_ticket_assignment_change() from public,anon,authenticated;

drop trigger if exists trg_ticket_assignment_activity on public.tickets;
create trigger trg_ticket_assignment_activity
after update of dev_owner_id,qa_owner_id on public.tickets
for each row execute function private.log_ticket_assignment_change();

-- -----------------------------------------------------------------------------
-- 3) Private Storage: images + business documents.
-- -----------------------------------------------------------------------------
alter table public.ticket_attachments add column if not exists original_size_bytes bigint;
alter table public.sprint_attachments add column if not exists original_size_bytes bigint;

create or replace function private.is_allowed_jira_evidence_name(p_name text)
returns boolean
language plpgsql
immutable
set search_path=pg_catalog,pg_temp
as $$
declare
  v_scope text:=lower(split_part(coalesce(p_name,''),'/',2));
  v_name text:=lower(coalesce(p_name,''));
begin
  if v_scope='knowledge' then
    return v_name ~ '\.(jpg|jpeg|png|webp|gif)$';
  end if;
  return v_name ~ '\.(jpg|jpeg|png|webp|gif|pdf|csv|xls|xlsx|xlsm|xlsb|xlt|xltx|xltm|doc|docx|docm|dot|dotx|dotm|rtf|ppt|pptx|pptm|pps|ppsx|ppsm|pot|potx|potm|odt|ods|odp|txt)$';
end $$;
revoke all on function private.is_allowed_jira_evidence_name(text) from public,anon;
grant execute on function private.is_allowed_jira_evidence_name(text) to authenticated;

update storage.buckets
set file_size_limit=26214400,
    allowed_mime_types=array[
      'image/jpeg','image/png','image/webp','image/gif',
      'application/pdf','text/csv','application/csv','text/plain',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel.sheet.macroEnabled.12',
      'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
      'application/vnd.ms-excel.template.macroEnabled.12',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-word.document.macroEnabled.12',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
      'application/vnd.ms-word.template.macroEnabled.12',
      'application/rtf','text/rtf',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
      'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
      'application/vnd.ms-powerpoint.slideshow.macroEnabled.12',
      'application/vnd.openxmlformats-officedocument.presentationml.template',
      'application/vnd.ms-powerpoint.template.macroEnabled.12',
      'application/vnd.oasis.opendocument.text',
      'application/vnd.oasis.opendocument.spreadsheet',
      'application/vnd.oasis.opendocument.presentation',
      'application/octet-stream'
    ]::text[]
where id='jira-evidence';

drop policy if exists jira_evidence_insert on storage.objects;
create policy jira_evidence_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id='jira-evidence'
  and private.can_upload_evidence_object(name)
  and private.is_allowed_jira_evidence_name(name)
);


-- -----------------------------------------------------------------------------
-- 4) Live module counters: visible tickets, ticket activity and Knowledge articles.
-- -----------------------------------------------------------------------------
create or replace function public.list_module_counts(p_workspace uuid)
returns table(
  module_id uuid,
  ticket_count bigint,
  activity_count bigint,
  article_count bigint
)
language sql
stable
security invoker
set search_path=public,pg_temp
as $$
  select m.id,
    (select count(*) from public.tickets t where t.workspace_id=p_workspace and t.module_id=m.id) as ticket_count,
    (select count(*) from public.ticket_activity a join public.tickets t on t.id=a.ticket_id where t.workspace_id=p_workspace and t.module_id=m.id) as activity_count,
    (select count(*) from public.knowledge_articles k where k.workspace_id=p_workspace and k.module_id=m.id) as article_count
  from public.ticket_modules m
  where m.workspace_id=p_workspace
  order by m.name
$$;
revoke all on function public.list_module_counts(uuid) from public,anon;
grant execute on function public.list_module_counts(uuid) to authenticated;

-- v16.7 final hardening: expanded Office formats, module counters and attachment indexes.
-- Jira Interno TROBBU v16.7
-- Workspace permissions + assignment audit + document attachments.

-- -----------------------------------------------------------------------------
-- 1) Workspace creation: only Admin / PM / Superadmin (plus first-install bootstrap)
-- -----------------------------------------------------------------------------
create or replace function private.user_can_create_workspace(p_user uuid default auth.uid())
returns boolean
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
begin
  if p_user is null then return false; end if;
  -- Bootstrap exception only when the installation does not contain any workspace yet.
  if not exists(select 1 from public.workspaces) then return true; end if;
  return exists(
    select 1
    from public.workspace_members wm
    left join public.workspace_roles wr
      on wr.id=wm.role_id and wr.workspace_id=wm.workspace_id
    where wm.user_id=p_user
      and wm.active=true
      and coalesce(wr.base_role::text,wm.role::text) in ('admin','pm','superadmin')
  );
end $$;
revoke all on function private.user_can_create_workspace(uuid) from public,anon;
grant execute on function private.user_can_create_workspace(uuid) to authenticated;

drop policy if exists workspaces_insert on public.workspaces;
create policy workspaces_insert
on public.workspaces
for insert
to authenticated
with check (
  created_by=(select auth.uid())
  and private.user_can_create_workspace((select auth.uid()))
);

create or replace function public.create_workspace(p_name text,p_slug text)
returns uuid
language plpgsql
security invoker
set search_path=public,private,pg_temp
as $$
declare
  v_uid uuid:=(select auth.uid());
  v_id uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not private.user_can_create_workspace(v_uid) then
    raise exception 'Solo Admin, PM o Superadmin pueden crear espacios de trabajo';
  end if;
  if nullif(trim(p_name),'') is null or nullif(trim(p_slug),'') is null then
    raise exception 'Workspace name and slug are required';
  end if;
  insert into public.workspaces(name,slug,created_by)
  values(trim(p_name),trim(p_slug),v_uid)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.create_workspace(text,text) from public,anon;
grant execute on function public.create_workspace(text,text) to authenticated;

-- -----------------------------------------------------------------------------
-- 2) Ticket assignment audit for all assignment / reassignment / unassignment
-- -----------------------------------------------------------------------------
create or replace function private.log_ticket_assignment_change()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_actor uuid:=(select auth.uid());
begin
  if old.dev_owner_id is distinct from new.dev_owner_id then
    insert into public.ticket_activity(ticket_id,actor_id,action,from_value,to_value,metadata)
    values(
      new.id,v_actor,'dev_assignee_changed',
      old.dev_owner_id::text,new.dev_owner_id::text,
      jsonb_build_object('assignment_role','dev','product_id',new.product_id,'ticket_key',new.ticket_key)
    );
  end if;
  if old.qa_owner_id is distinct from new.qa_owner_id then
    insert into public.ticket_activity(ticket_id,actor_id,action,from_value,to_value,metadata)
    values(
      new.id,v_actor,'qa_assignee_changed',
      old.qa_owner_id::text,new.qa_owner_id::text,
      jsonb_build_object('assignment_role','qa','product_id',new.product_id,'ticket_key',new.ticket_key)
    );
  end if;
  return new;
end $$;
revoke all on function private.log_ticket_assignment_change() from public,anon,authenticated;

drop trigger if exists trg_ticket_assignment_activity on public.tickets;
create trigger trg_ticket_assignment_activity
after update of dev_owner_id,qa_owner_id on public.tickets
for each row execute function private.log_ticket_assignment_change();

-- -----------------------------------------------------------------------------
-- 3) Private Storage: images + business documents.
-- -----------------------------------------------------------------------------
alter table public.ticket_attachments add column if not exists original_size_bytes bigint;
alter table public.sprint_attachments add column if not exists original_size_bytes bigint;

create or replace function private.is_allowed_jira_evidence_name(p_name text)
returns boolean
language plpgsql
immutable
set search_path=pg_catalog,pg_temp
as $$
declare
  v_scope text:=lower(split_part(coalesce(p_name,''),'/',2));
  v_name text:=lower(coalesce(p_name,''));
begin
  if v_scope='knowledge' then
    return v_name ~ '\.(jpg|jpeg|png|webp|gif)$';
  end if;
  return v_name ~ '\.(jpg|jpeg|png|webp|gif|pdf|csv|xls|xlsx|xlsm|xlsb|xlt|xltx|xltm|doc|docx|docm|dot|dotx|dotm|rtf|ppt|pptx|pptm|pps|ppsx|ppsm|pot|potx|potm|odt|ods|odp|txt)$';
end $$;
revoke all on function private.is_allowed_jira_evidence_name(text) from public,anon;
grant execute on function private.is_allowed_jira_evidence_name(text) to authenticated;

update storage.buckets
set file_size_limit=26214400,
    allowed_mime_types=array[
      'image/jpeg','image/png','image/webp','image/gif',
      'application/pdf','text/csv','application/csv','text/plain',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel.sheet.macroEnabled.12',
      'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
      'application/vnd.ms-excel.template.macroEnabled.12',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-word.document.macroEnabled.12',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
      'application/vnd.ms-word.template.macroEnabled.12',
      'application/rtf','text/rtf',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
      'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
      'application/vnd.ms-powerpoint.slideshow.macroEnabled.12',
      'application/vnd.openxmlformats-officedocument.presentationml.template',
      'application/vnd.ms-powerpoint.template.macroEnabled.12',
      'application/vnd.oasis.opendocument.text',
      'application/vnd.oasis.opendocument.spreadsheet',
      'application/vnd.oasis.opendocument.presentation',
      'application/octet-stream'
    ]::text[]
where id='jira-evidence';

drop policy if exists jira_evidence_insert on storage.objects;
create policy jira_evidence_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id='jira-evidence'
  and private.can_upload_evidence_object(name)
  and private.is_allowed_jira_evidence_name(name)
);


-- -----------------------------------------------------------------------------
-- 4) Live module counters: visible tickets, ticket activity and Knowledge articles.
-- -----------------------------------------------------------------------------
create or replace function public.list_module_counts(p_workspace uuid)
returns table(
  module_id uuid,
  ticket_count bigint,
  activity_count bigint,
  article_count bigint
)
language sql
stable
security invoker
set search_path=public,pg_temp
as $$
  select m.id,
    (select count(*) from public.tickets t where t.workspace_id=p_workspace and t.module_id=m.id) as ticket_count,
    (select count(*) from public.ticket_activity a join public.tickets t on t.id=a.ticket_id where t.workspace_id=p_workspace and t.module_id=m.id) as activity_count,
    (select count(*) from public.knowledge_articles k where k.workspace_id=p_workspace and k.module_id=m.id) as article_count
  from public.ticket_modules m
  where m.workspace_id=p_workspace
  order by m.name
$$;
revoke all on function public.list_module_counts(uuid) from public,anon;
grant execute on function public.list_module_counts(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 5) Attachment FK indexes for document-heavy workloads.
-- -----------------------------------------------------------------------------
create index if not exists idx_ticket_attachments_ticket_workspace on public.ticket_attachments(ticket_id,workspace_id);
create index if not exists idx_ticket_attachments_comment on public.ticket_attachments(comment_id) where comment_id is not null;
create index if not exists idx_ticket_attachments_uploaded_by on public.ticket_attachments(uploaded_by);
create index if not exists idx_ticket_attachments_workspace on public.ticket_attachments(workspace_id);
create index if not exists idx_sprint_attachments_sprint_workspace on public.sprint_attachments(sprint_id,workspace_id);
create index if not exists idx_sprint_attachments_comment on public.sprint_attachments(comment_id) where comment_id is not null;
create index if not exists idx_sprint_attachments_uploaded_by on public.sprint_attachments(uploaded_by);
create index if not exists idx_sprint_attachments_workspace on public.sprint_attachments(workspace_id);

-- v16.7 assignment audit hardening.
create or replace function private.log_ticket_initial_assignment()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_actor uuid:=(select auth.uid());
begin
  if new.dev_owner_id is not null then
    insert into public.ticket_activity(ticket_id,actor_id,action,from_value,to_value,metadata)
    values(new.id,v_actor,'dev_assignee_changed',null,new.dev_owner_id::text,
      jsonb_build_object('assignment_role','dev','initial',true,'product_id',new.product_id,'ticket_key',new.ticket_key));
  end if;
  if new.qa_owner_id is not null then
    insert into public.ticket_activity(ticket_id,actor_id,action,from_value,to_value,metadata)
    values(new.id,v_actor,'qa_assignee_changed',null,new.qa_owner_id::text,
      jsonb_build_object('assignment_role','qa','initial',true,'product_id',new.product_id,'ticket_key',new.ticket_key));
  end if;
  return new;
end $$;
revoke all on function private.log_ticket_initial_assignment() from public,anon,authenticated;
drop trigger if exists trg_ticket_initial_assignment_activity on public.tickets;
create trigger trg_ticket_initial_assignment_activity after insert on public.tickets for each row execute function private.log_ticket_initial_assignment();

-- Jira Interno TROBBU v16.8 consolidated upgrade
-- Jira Interno TROBBU v16.8
-- Helpdesk intelligent routing, staff capacity rules, queueing and UI-support metadata.

create extension if not exists pg_cron;

alter table public.workspace_members
  add column if not exists helpdesk_routing_description text,
  add column if not exists helpdesk_auto_assign_enabled boolean not null default false,
  add column if not exists helpdesk_daily_limit integer,
  add column if not exists helpdesk_active_limit integer,
  add column if not exists helpdesk_overflow_mode text,
  add column if not exists helpdesk_overflow_user_id uuid references auth.users(id) on delete set null;

do $$
begin
  if not exists(select 1 from pg_constraint where conname='workspace_members_helpdesk_daily_limit_check') then
    alter table public.workspace_members add constraint workspace_members_helpdesk_daily_limit_check check (helpdesk_daily_limit is null or helpdesk_daily_limit between 0 and 500);
  end if;
  if not exists(select 1 from pg_constraint where conname='workspace_members_helpdesk_active_limit_check') then
    alter table public.workspace_members add constraint workspace_members_helpdesk_active_limit_check check (helpdesk_active_limit is null or helpdesk_active_limit between 0 and 500);
  end if;
  if not exists(select 1 from pg_constraint where conname='workspace_members_helpdesk_overflow_mode_check') then
    alter table public.workspace_members add constraint workspace_members_helpdesk_overflow_mode_check check (helpdesk_overflow_mode is null or helpdesk_overflow_mode in ('inherit','fallback','queue','next_available'));
  end if;
end $$;

create index if not exists idx_workspace_members_helpdesk_auto on public.workspace_members(workspace_id,helpdesk_auto_assign_enabled,active);
create index if not exists idx_workspace_members_helpdesk_overflow on public.workspace_members(workspace_id,helpdesk_overflow_user_id) where helpdesk_overflow_user_id is not null;

alter table public.workspace_settings
  add column if not exists helpdesk_auto_assignment_enabled boolean not null default true,
  add column if not exists helpdesk_default_daily_limit integer not null default 4,
  add column if not exists helpdesk_default_active_limit integer not null default 4,
  add column if not exists helpdesk_default_overflow_mode text not null default 'fallback',
  add column if not exists helpdesk_default_overflow_user_id uuid references auth.users(id) on delete set null;

do $$
begin
  if not exists(select 1 from pg_constraint where conname='workspace_settings_helpdesk_daily_limit_check') then
    alter table public.workspace_settings add constraint workspace_settings_helpdesk_daily_limit_check check (helpdesk_default_daily_limit between 0 and 500);
  end if;
  if not exists(select 1 from pg_constraint where conname='workspace_settings_helpdesk_active_limit_check') then
    alter table public.workspace_settings add constraint workspace_settings_helpdesk_active_limit_check check (helpdesk_default_active_limit between 0 and 500);
  end if;
  if not exists(select 1 from pg_constraint where conname='workspace_settings_helpdesk_overflow_mode_check') then
    alter table public.workspace_settings add constraint workspace_settings_helpdesk_overflow_mode_check check (helpdesk_default_overflow_mode in ('fallback','queue','next_available'));
  end if;
end $$;

-- Current TROBBU workspace defaults requested by the product owner.
update public.workspace_settings
set helpdesk_auto_assignment_enabled=true,
    helpdesk_default_daily_limit=4,
    helpdesk_default_active_limit=4,
    helpdesk_default_overflow_mode='fallback',
    helpdesk_default_overflow_user_id='2ab7d928-9ffe-4b72-a433-cde74a9c9518'
where workspace_id='13345ea4-59e7-4d65-874c-f13a131647d4';

-- Existing non-portal team members are eligible by default. Admin can disable individually.
update public.workspace_members wm
set helpdesk_auto_assign_enabled=true
from public.workspace_roles wr
where wr.id=wm.role_id and wr.workspace_id=wm.workspace_id
  and coalesce(wr.base_role::text,wm.role::text) in ('dev','qa','pm','admin','superadmin')
  and wm.active=true;

alter table public.helpdesk_tickets
  add column if not exists assignment_source text,
  add column if not exists assignment_reason text,
  add column if not exists assignment_confidence numeric(5,4),
  add column if not exists assignment_queued_at timestamptz,
  add column if not exists assignment_last_routed_at timestamptz;

do $$
begin
  if not exists(select 1 from pg_constraint where conname='helpdesk_tickets_assignment_source_check') then
    alter table public.helpdesk_tickets add constraint helpdesk_tickets_assignment_source_check check (
      assignment_source is null or assignment_source in ('manual','redirect','auto_ai','auto_rules','overflow','queue')
    );
  end if;
  if not exists(select 1 from pg_constraint where conname='helpdesk_tickets_assignment_confidence_check') then
    alter table public.helpdesk_tickets add constraint helpdesk_tickets_assignment_confidence_check check (
      assignment_confidence is null or assignment_confidence between 0 and 1
    );
  end if;
end $$;

create table if not exists public.helpdesk_assignment_log (
  id bigint generated by default as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  helpdesk_ticket_id uuid not null references public.helpdesk_tickets(id) on delete cascade,
  assigned_user_id uuid not null references auth.users(id) on delete cascade,
  previous_user_id uuid references auth.users(id) on delete set null,
  source text not null default 'manual',
  reason text,
  confidence numeric(5,4),
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_helpdesk_assignment_log_daily on public.helpdesk_assignment_log(workspace_id,assigned_user_id,created_at desc);
create index if not exists idx_helpdesk_assignment_log_ticket on public.helpdesk_assignment_log(helpdesk_ticket_id,created_at desc);
create index if not exists idx_helpdesk_assignment_log_actor on public.helpdesk_assignment_log(actor_id) where actor_id is not null;
alter table public.helpdesk_assignment_log enable row level security;
revoke all on public.helpdesk_assignment_log from anon;
grant select on public.helpdesk_assignment_log to authenticated;
drop policy if exists helpdesk_assignment_log_select on public.helpdesk_assignment_log;
create policy helpdesk_assignment_log_select on public.helpdesk_assignment_log
for select to authenticated using (
  assigned_user_id=(select auth.uid())
  or private.has_workspace_permission(workspace_id,'manage_helpdesk')
  or private.has_workspace_permission(workspace_id,'manage_staff')
);

create table if not exists public.helpdesk_assignment_queue (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  helpdesk_ticket_id uuid not null references public.helpdesk_tickets(id) on delete cascade,
  status text not null default 'waiting' check (status in ('waiting','assigned','cancelled')),
  suggested_user_id uuid references auth.users(id) on delete set null,
  assigned_user_id uuid references auth.users(id) on delete set null,
  reason text,
  attempts integer not null default 0,
  queued_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  assigned_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(helpdesk_ticket_id)
);
create index if not exists idx_helpdesk_assignment_queue_waiting on public.helpdesk_assignment_queue(workspace_id,status,queued_at) where status='waiting';
create index if not exists idx_helpdesk_assignment_queue_suggested on public.helpdesk_assignment_queue(suggested_user_id) where suggested_user_id is not null;
create index if not exists idx_helpdesk_assignment_queue_assigned on public.helpdesk_assignment_queue(assigned_user_id) where assigned_user_id is not null;
alter table public.helpdesk_assignment_queue enable row level security;
revoke all on public.helpdesk_assignment_queue from anon;
grant select on public.helpdesk_assignment_queue to authenticated;
drop policy if exists helpdesk_assignment_queue_select on public.helpdesk_assignment_queue;
create policy helpdesk_assignment_queue_select on public.helpdesk_assignment_queue
for select to authenticated using (
  private.has_workspace_permission(workspace_id,'manage_helpdesk')
  or private.has_workspace_permission(workspace_id,'manage_staff')
);

create or replace function private.helpdesk_member_capacity(
  p_workspace uuid,
  p_user uuid
)
returns table(
  daily_count integer,
  active_count integer,
  daily_limit integer,
  active_limit integer,
  overflow_mode text,
  overflow_user_id uuid,
  available boolean
)
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare
  v_timezone text:='America/Merida';
  v_daily integer:=4;
  v_active integer:=4;
  v_mode text:='fallback';
  v_overflow uuid;
  v_member_daily integer;
  v_member_active integer;
  v_member_mode text;
  v_member_overflow uuid;
  v_daily_count integer:=0;
  v_active_count integer:=0;
begin
  select coalesce(ws.timezone,'America/Merida'),
         coalesce(ws.helpdesk_default_daily_limit,4),
         coalesce(ws.helpdesk_default_active_limit,4),
         coalesce(ws.helpdesk_default_overflow_mode,'fallback'),
         ws.helpdesk_default_overflow_user_id
    into v_timezone,v_daily,v_active,v_mode,v_overflow
  from public.workspace_settings ws where ws.workspace_id=p_workspace;

  select wm.helpdesk_daily_limit,wm.helpdesk_active_limit,
         nullif(wm.helpdesk_overflow_mode,'inherit'),wm.helpdesk_overflow_user_id
    into v_member_daily,v_member_active,v_member_mode,v_member_overflow
  from public.workspace_members wm
  where wm.workspace_id=p_workspace and wm.user_id=p_user and wm.active=true;

  if not found then
    return query select 0,0,0,0,'queue'::text,null::uuid,false;
    return;
  end if;

  v_daily:=coalesce(v_member_daily,v_daily);
  v_active:=coalesce(v_member_active,v_active);
  v_mode:=coalesce(v_member_mode,v_mode);
  v_overflow:=coalesce(v_member_overflow,v_overflow);

  select count(*)::int into v_daily_count
  from public.helpdesk_assignment_log l
  where l.workspace_id=p_workspace and l.assigned_user_id=p_user
    and timezone(v_timezone,l.created_at)::date=timezone(v_timezone,now())::date;

  select count(*)::int into v_active_count
  from public.helpdesk_tickets h
  where h.workspace_id=p_workspace and h.assigned_to=p_user
    and h.category not in ('module','feature','new_requirement')
    and h.status not in ('resolved','closed');

  return query select v_daily_count,v_active_count,v_daily,v_active,v_mode,v_overflow,
    ((v_daily=0 or v_daily_count<v_daily) and (v_active=0 or v_active_count<v_active));
end $$;
revoke all on function private.helpdesk_member_capacity(uuid,uuid) from public,anon,authenticated;

create or replace function private.helpdesk_member_routable(p_workspace uuid,p_user uuid)
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
    where wm.workspace_id=p_workspace and wm.user_id=p_user and wm.active=true
      and (
        wm.helpdesk_auto_assign_enabled
        or private.member_has_permission(p_workspace,p_user,'manage_helpdesk')
        or coalesce(wr.base_role::text,wm.role::text) in ('dev','qa','pm','admin','superadmin')
      )
      and coalesce(wr.code,'')<>'helpdesk_requester'
  )
$$;
revoke all on function private.helpdesk_member_routable(uuid,uuid) from public,anon,authenticated;

create or replace function private.helpdesk_match_score(p_ticket_text text,p_profile_text text)
returns integer
language sql
immutable
set search_path=pg_catalog,pg_temp
as $$
  with src as (
    select trim(translate(lower(coalesce(p_ticket_text,'')),'áéíóúüñ','aeiouun')) as ticket,
           trim(translate(lower(coalesce(p_profile_text,'')),'áéíóúüñ','aeiouun')) as profile
  ), tokens as (
    select distinct token
    from src, regexp_split_to_table(regexp_replace(ticket,'[^a-z0-9]+',' ','g'),'\s+') token
    where length(token)>=4
      and token not in ('para','como','este','esta','estos','estas','ticket','helpdesk','solicitud','reporte','usuario','sistema','necesito','quiero','error')
  )
  select coalesce(sum(case when position(token in profile)>0 then 1 else 0 end),0)::int from tokens,src
$$;
revoke all on function private.helpdesk_match_score(text,text) from public,anon,authenticated;

create or replace function private.helpdesk_ticket_context(p_ticket uuid)
returns text
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select concat_ws(' ',h.subject,h.description,rt.name,d.name,p.name,h.category,h.priority::text)
  from public.helpdesk_tickets h
  left join public.helpdesk_request_types rt on rt.id=h.request_type_id
  left join public.helpdesk_departments d on d.id=h.department_id
  left join public.products p on p.id=h.product_id
  where h.id=p_ticket
$$;
revoke all on function private.helpdesk_ticket_context(uuid) from public,anon,authenticated;

create or replace function private.helpdesk_member_context(p_workspace uuid,p_user uuid)
returns text
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select concat_ws(' ',wm.helpdesk_routing_description,p.job_title,wr.name,wr.description,wm.role::text)
  from public.workspace_members wm
  left join public.profiles p on p.id=wm.user_id
  left join public.workspace_roles wr on wr.id=wm.role_id and wr.workspace_id=wm.workspace_id
  where wm.workspace_id=p_workspace and wm.user_id=p_user
$$;
revoke all on function private.helpdesk_member_context(uuid,uuid) from public,anon,authenticated;

create or replace function private.queue_helpdesk_assignment(p_ticket uuid,p_reason text,p_suggested uuid default null)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_workspace uuid;
begin
  select workspace_id into v_workspace from public.helpdesk_tickets where id=p_ticket;
  if v_workspace is null then return; end if;
  insert into public.helpdesk_assignment_queue(workspace_id,helpdesk_ticket_id,status,suggested_user_id,reason,attempts,queued_at,last_attempt_at,updated_at)
  values(v_workspace,p_ticket,'waiting',p_suggested,left(coalesce(p_reason,'Pendiente de asignación automática'),1000),1,now(),now(),now())
  on conflict(helpdesk_ticket_id) do update set
    status='waiting',suggested_user_id=excluded.suggested_user_id,reason=excluded.reason,
    attempts=public.helpdesk_assignment_queue.attempts+1,last_attempt_at=now(),updated_at=now();
  perform set_config('app.helpdesk_assignment_action','1',true);
  update public.helpdesk_tickets
  set assignment_source='queue',assignment_reason=left(coalesce(p_reason,'Pendiente de asignación automática'),1000),
      assignment_queued_at=coalesce(assignment_queued_at,now()),assignment_last_routed_at=now()
  where id=p_ticket and assigned_to is null;
end $$;
revoke all on function private.queue_helpdesk_assignment(uuid,text,uuid) from public,anon,authenticated;

create or replace function private.assign_helpdesk_internal(
  p_ticket uuid,
  p_user uuid,
  p_source text,
  p_reason text,
  p_confidence numeric default null
)
returns boolean
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_workspace uuid;
  v_category text;
begin
  select workspace_id,category into v_workspace,v_category from public.helpdesk_tickets where id=p_ticket for update;
  if v_workspace is null or v_category in ('module','feature','new_requirement') then return false; end if;
  if not private.helpdesk_member_routable(v_workspace,p_user) then return false; end if;
  perform set_config('app.helpdesk_assignment_action','1',true);
  perform set_config('app.helpdesk_assignment_source',coalesce(p_source,'auto_rules'),true);
  update public.helpdesk_tickets
  set assigned_to=p_user,
      assignment_source=coalesce(p_source,'auto_rules'),
      assignment_reason=left(nullif(btrim(coalesce(p_reason,'')),''),1000),
      assignment_confidence=case when p_confidence is null then null else greatest(0,least(1,p_confidence)) end,
      assignment_queued_at=null,
      assignment_last_routed_at=now()
  where id=p_ticket and assigned_to is null;
  if not found then return false; end if;
  update public.helpdesk_assignment_queue
  set status='assigned',assigned_user_id=p_user,assigned_at=now(),updated_at=now(),reason=left(coalesce(p_reason,reason),1000)
  where helpdesk_ticket_id=p_ticket;
  return true;
end $$;
revoke all on function private.assign_helpdesk_internal(uuid,uuid,text,text,numeric) from public,anon,authenticated;

create or replace function private.route_helpdesk_ticket_rules(p_ticket uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  h public.helpdesk_tickets%rowtype;
  ws public.workspace_settings%rowtype;
  ticket_text text;
  candidate uuid;
  candidate_score int:=0;
  cap record;
  fallback uuid;
  next_user uuid;
  next_score int:=0;
  reason text;
begin
  select * into h from public.helpdesk_tickets where id=p_ticket;
  if not found then return jsonb_build_object('assigned',false,'reason','ticket_not_found'); end if;
  if h.category in ('module','feature','new_requirement') then return jsonb_build_object('assigned',false,'reason','proposal'); end if;
  if h.assigned_to is not null then return jsonb_build_object('assigned',true,'user_id',h.assigned_to,'reason','already_assigned'); end if;
  select * into ws from public.workspace_settings where workspace_id=h.workspace_id;
  if not coalesce(ws.helpdesk_auto_assignment_enabled,true) then return jsonb_build_object('assigned',false,'reason','auto_assignment_disabled'); end if;
  ticket_text:=private.helpdesk_ticket_context(h.id);

  select wm.user_id,
         private.helpdesk_match_score(ticket_text,private.helpdesk_member_context(h.workspace_id,wm.user_id)) as score
  into candidate,candidate_score
  from public.workspace_members wm
  left join public.workspace_roles wr on wr.id=wm.role_id and wr.workspace_id=wm.workspace_id
  where wm.workspace_id=h.workspace_id and wm.active=true and wm.helpdesk_auto_assign_enabled
    and coalesce(wr.code,'')<>'helpdesk_requester'
    and coalesce(wr.base_role::text,wm.role::text)<>'consulta'
    and wm.user_id is distinct from h.requester_user_id
  order by score desc,wm.joined_at
  limit 1;

  if candidate is null or candidate_score<=0 then
    candidate:=ws.helpdesk_default_overflow_user_id;
    candidate_score:=0;
  end if;

  if candidate is null then
    reason:='No se encontró un integrante con perfil de atención relacionado.';
    perform private.queue_helpdesk_assignment(h.id,reason,null);
    return jsonb_build_object('assigned',false,'queued',true,'reason',reason);
  end if;

  select * into cap from private.helpdesk_member_capacity(h.workspace_id,candidate);
  if cap.available then
    reason:=case when candidate_score>0 then 'Coincidencia automática por descripción de responsabilidades.' else 'Asignado al responsable de respaldo del workspace.' end;
    if private.assign_helpdesk_internal(h.id,candidate,case when candidate_score>0 then 'auto_rules' else 'overflow' end,reason,case when candidate_score>0 then least(0.95,0.45+candidate_score*0.08) else 0.25 end) then
      return jsonb_build_object('assigned',true,'user_id',candidate,'source',case when candidate_score>0 then 'auto_rules' else 'overflow' end,'score',candidate_score,'reason',reason);
    end if;
  end if;

  if cap.overflow_mode='next_available' then
    select wm.user_id,private.helpdesk_match_score(ticket_text,private.helpdesk_member_context(h.workspace_id,wm.user_id)) as score
      into next_user,next_score
    from public.workspace_members wm
    left join public.workspace_roles wr on wr.id=wm.role_id and wr.workspace_id=wm.workspace_id
    cross join lateral private.helpdesk_member_capacity(h.workspace_id,wm.user_id) c
    where wm.workspace_id=h.workspace_id and wm.active=true and wm.helpdesk_auto_assign_enabled
      and wm.user_id<>candidate and wm.user_id is distinct from h.requester_user_id
      and coalesce(wr.code,'')<>'helpdesk_requester' and coalesce(wr.base_role::text,wm.role::text)<>'consulta'
      and c.available
    order by score desc,wm.joined_at
    limit 1;
    if next_user is not null and private.assign_helpdesk_internal(h.id,next_user,'overflow','Responsable principal sin capacidad; enviado al siguiente integrante disponible.',least(0.8,0.35+next_score*0.07)) then
      return jsonb_build_object('assigned',true,'user_id',next_user,'source','overflow','reason','next_available');
    end if;
  elsif cap.overflow_mode='fallback' then
    fallback:=coalesce(cap.overflow_user_id,ws.helpdesk_default_overflow_user_id);
    if fallback is not null and fallback<>candidate then
      select * into cap from private.helpdesk_member_capacity(h.workspace_id,fallback);
      if cap.available and private.assign_helpdesk_internal(h.id,fallback,'overflow','Responsable principal alcanzó su límite; enviado al responsable de respaldo.',0.3) then
        return jsonb_build_object('assigned',true,'user_id',fallback,'source','overflow','reason','fallback');
      end if;
    end if;
  end if;

  reason:=format('Capacidad alcanzada para el responsable sugerido (%s asignaciones hoy / %s activas).',cap.daily_count,cap.active_count);
  perform private.queue_helpdesk_assignment(h.id,reason,candidate);
  return jsonb_build_object('assigned',false,'queued',true,'suggested_user_id',candidate,'reason',reason);
end $$;
revoke all on function private.route_helpdesk_ticket_rules(uuid) from public,anon,authenticated;

create or replace function public.process_helpdesk_assignment_queue(p_workspace uuid default null)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  r record;
  result jsonb;
  processed int:=0;
  assigned int:=0;
  caller uuid:=(select auth.uid());
begin
  if caller is not null and p_workspace is not null and not private.has_workspace_permission(p_workspace,'manage_helpdesk') and not private.has_workspace_permission(p_workspace,'manage_staff') then
    raise exception 'Insufficient Helpdesk permissions';
  end if;
  if coalesce(current_setting('app.helpdesk_queue_draining',true),'')='1' then
    return jsonb_build_object('processed',0,'assigned',0,'skipped','already_draining');
  end if;
  perform set_config('app.helpdesk_queue_draining','1',true);
  for r in
    select q.helpdesk_ticket_id
    from public.helpdesk_assignment_queue q
    join public.helpdesk_tickets h on h.id=q.helpdesk_ticket_id
    where q.status='waiting'
      and (p_workspace is null or q.workspace_id=p_workspace)
      and h.assigned_to is null
      and h.status not in ('resolved','closed')
    order by q.queued_at
    limit 50
  loop
    processed:=processed+1;
    result:=private.route_helpdesk_ticket_rules(r.helpdesk_ticket_id);
    if coalesce((result->>'assigned')::boolean,false) then assigned:=assigned+1; end if;
  end loop;
  return jsonb_build_object('processed',processed,'assigned',assigned);
end $$;
revoke all on function public.process_helpdesk_assignment_queue(uuid) from public,anon;
grant execute on function public.process_helpdesk_assignment_queue(uuid) to authenticated;

create or replace function public.apply_helpdesk_auto_assignment(
  p_ticket_id uuid,
  p_assignee uuid,
  p_reason text,
  p_confidence numeric default null,
  p_source text default 'auto_ai'
)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  h public.helpdesk_tickets%rowtype;
  cap record;
begin
  if current_user<>'service_role' and (select auth.uid()) is not null then
    raise exception 'Service role required';
  end if;
  select * into h from public.helpdesk_tickets where id=p_ticket_id;
  if not found then raise exception 'Helpdesk ticket not found'; end if;
  if h.assigned_to is not null then return jsonb_build_object('assigned',true,'user_id',h.assigned_to,'reason','already_assigned'); end if;
  if not private.helpdesk_member_routable(h.workspace_id,p_assignee) then
    perform private.queue_helpdesk_assignment(h.id,'El usuario sugerido por IA ya no es elegible.',p_assignee);
    return jsonb_build_object('assigned',false,'queued',true,'reason','assignee_not_eligible');
  end if;
  select * into cap from private.helpdesk_member_capacity(h.workspace_id,p_assignee);
  if not cap.available then
    perform private.queue_helpdesk_assignment(h.id,coalesce(p_reason,'El usuario sugerido alcanzó su capacidad.'),p_assignee);
    return jsonb_build_object('assigned',false,'queued',true,'reason','capacity_reached');
  end if;
  if private.assign_helpdesk_internal(h.id,p_assignee,case when p_source in ('auto_ai','auto_rules','overflow') then p_source else 'auto_ai' end,p_reason,p_confidence) then
    return jsonb_build_object('assigned',true,'user_id',p_assignee,'source',p_source,'reason',p_reason,'confidence',p_confidence);
  end if;
  perform private.queue_helpdesk_assignment(h.id,'No fue posible aplicar la asignación sugerida.',p_assignee);
  return jsonb_build_object('assigned',false,'queued',true,'reason','assignment_failed');
end $$;
revoke all on function public.apply_helpdesk_auto_assignment(uuid,uuid,text,numeric,text) from public,anon,authenticated;
grant execute on function public.apply_helpdesk_auto_assignment(uuid,uuid,text,numeric,text) to service_role;

create or replace function public.get_helpdesk_member_capacity(p_workspace uuid,p_user uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path=public,private,pg_temp
as $$
declare c record;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not (p_user=(select auth.uid()) or private.has_workspace_permission(p_workspace,'manage_staff') or private.has_workspace_permission(p_workspace,'manage_helpdesk')) then
    raise exception 'Insufficient permissions';
  end if;
  select * into c from private.helpdesk_member_capacity(p_workspace,p_user);
  return jsonb_build_object('daily_count',c.daily_count,'active_count',c.active_count,'daily_limit',c.daily_limit,'active_limit',c.active_limit,'overflow_mode',c.overflow_mode,'overflow_user_id',c.overflow_user_id,'available',c.available);
end $$;
revoke all on function public.get_helpdesk_member_capacity(uuid,uuid) from public,anon;
grant execute on function public.get_helpdesk_member_capacity(uuid,uuid) to authenticated;

create or replace function public.assign_helpdesk_ticket(p_ticket_id uuid,p_assignee uuid,p_comment text default null)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_workspace uuid;
  v_key text;
  v_category text;
  v_current uuid;
  v_caller uuid:=(select auth.uid());
  v_comment text:=nullif(btrim(coalesce(p_comment,'')),'');
  v_manager boolean:=false;
  v_redirect boolean:=false;
begin
  if v_caller is null then raise exception 'Authentication required'; end if;
  select workspace_id,ticket_key,category,assigned_to into v_workspace,v_key,v_category,v_current
  from public.helpdesk_tickets where id=p_ticket_id;
  if v_workspace is null then raise exception 'Helpdesk ticket not found'; end if;
  v_manager:=private.has_workspace_permission(v_workspace,'manage_helpdesk');
  v_redirect:=v_current=v_caller;
  if not v_manager and not v_redirect then raise exception 'Insufficient Helpdesk permissions'; end if;
  if v_category in ('module','feature','new_requirement') then raise exception 'Requirement proposals are handled through the decision flow'; end if;
  if p_assignee is null or not private.helpdesk_member_routable(v_workspace,p_assignee) then raise exception 'The selected assignee is not an active team member eligible for Helpdesk'; end if;
  if v_comment is not null and char_length(v_comment)>4000 then raise exception 'Assignment comment is too long'; end if;
  perform set_config('app.helpdesk_assignment_action','1',true);
  perform set_config('app.helpdesk_assignment_source',case when v_redirect and not v_manager then 'redirect' else 'manual' end,true);
  update public.helpdesk_tickets
  set assigned_to=p_assignee,
      assignment_source=case when v_redirect and not v_manager then 'redirect' else 'manual' end,
      assignment_reason=case when v_redirect and not v_manager then coalesce(v_comment,'Redirigido por el responsable anterior.') else v_comment end,
      assignment_confidence=null,
      assignment_queued_at=null,
      assignment_last_routed_at=now()
  where id=p_ticket_id;
  if v_comment is not null then
    insert into public.helpdesk_comments(helpdesk_ticket_id,author_id,body) values(p_ticket_id,v_caller,v_comment);
  end if;
  return jsonb_build_object('ticket_id',p_ticket_id,'ticket_key',v_key,'assigned_to',p_assignee,'redirected',v_redirect and not v_manager,'comment_added',v_comment is not null);
end $$;
revoke all on function public.assign_helpdesk_ticket(uuid,uuid,text) from public,anon;
grant execute on function public.assign_helpdesk_ticket(uuid,uuid,text) to authenticated;

-- Allow an assignee to read their own routed Helpdesk request.
drop policy if exists helpdesk_tickets_select on public.helpdesk_tickets;
create policy helpdesk_tickets_select on public.helpdesk_tickets
for select to authenticated using (
  private.has_workspace_permission(workspace_id,'manage_helpdesk')
  or ((requester_user_id=(select auth.uid())) and private.is_workspace_member(workspace_id))
  or ((assigned_to=(select auth.uid())) and private.is_workspace_member(workspace_id))
);

-- The assignment RPC is privileged and constrained; direct updates remain managers only.

create or replace function private.guard_helpdesk_requester_update()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_assignment_context boolean:=coalesce(current_setting('app.helpdesk_assignment_action',true),'')='1';
begin
  if v_assignment_context then return new; end if;
  if private.has_workspace_permission(old.workspace_id,'manage_helpdesk') then return new; end if;
  if old.requester_user_id is distinct from (select auth.uid()) then
    raise exception 'You cannot update this Helpdesk request';
  end if;
  if row(new.workspace_id,new.requester_user_id,new.assigned_to,new.status,new.due_at,new.first_response_at,new.reviewed_at,new.attended_at,new.resolved_at,new.closed_at)
     is distinct from
     row(old.workspace_id,old.requester_user_id,old.assigned_to,old.status,old.due_at,old.first_response_at,old.reviewed_at,old.attended_at,old.resolved_at,old.closed_at) then
    raise exception 'Requesters cannot change internal Helpdesk handling fields';
  end if;
  return new;
end $$;

create or replace function private.capture_helpdesk_assignment()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_actor uuid:=(select auth.uid());
  v_source text;
begin
  if tg_op='INSERT' then
    if new.assigned_to is null then return new; end if;
  elsif old.assigned_to is not distinct from new.assigned_to or new.assigned_to is null then
    return new;
  end if;
  v_source:=coalesce(new.assignment_source,nullif(current_setting('app.helpdesk_assignment_source',true),''),'manual');
  insert into public.helpdesk_assignment_log(workspace_id,helpdesk_ticket_id,assigned_user_id,previous_user_id,source,reason,confidence,actor_id)
  values(new.workspace_id,new.id,new.assigned_to,case when tg_op='UPDATE' then old.assigned_to else null end,v_source,new.assignment_reason,new.assignment_confidence,v_actor);
  update public.helpdesk_assignment_queue
  set status='assigned',assigned_user_id=new.assigned_to,assigned_at=now(),updated_at=now(),reason=coalesce(new.assignment_reason,reason)
  where helpdesk_ticket_id=new.id;
  return new;
end $$;
revoke all on function private.capture_helpdesk_assignment() from public,anon,authenticated;
drop trigger if exists trg_helpdesk_assignment_log_insert on public.helpdesk_tickets;
create trigger trg_helpdesk_assignment_log_insert after insert on public.helpdesk_tickets for each row execute function private.capture_helpdesk_assignment();
drop trigger if exists trg_helpdesk_assignment_log_update on public.helpdesk_tickets;
create trigger trg_helpdesk_assignment_log_update after update of assigned_to on public.helpdesk_tickets for each row execute function private.capture_helpdesk_assignment();

create or replace function private.enqueue_helpdesk_auto_assignment()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_enabled boolean:=true;
begin
  if new.category in ('module','feature','new_requirement') or new.assigned_to is not null then return new; end if;
  select coalesce(helpdesk_auto_assignment_enabled,true) into v_enabled from public.workspace_settings where workspace_id=new.workspace_id;
  if not v_enabled then return new; end if;
  insert into public.helpdesk_assignment_queue(workspace_id,helpdesk_ticket_id,status,reason,queued_at,updated_at)
  values(new.workspace_id,new.id,'waiting','Pendiente de análisis automático.',now(),now())
  on conflict(helpdesk_ticket_id) do update set status='waiting',reason='Pendiente de análisis automático.',updated_at=now();
  perform set_config('app.helpdesk_assignment_action','1',true);
  update public.helpdesk_tickets set assignment_source='queue',assignment_reason='Pendiente de análisis automático.',assignment_queued_at=now() where id=new.id;
  return new;
end $$;
revoke all on function private.enqueue_helpdesk_auto_assignment() from public,anon,authenticated;
drop trigger if exists trg_helpdesk_auto_queue on public.helpdesk_tickets;
create trigger trg_helpdesk_auto_queue after insert on public.helpdesk_tickets for each row execute function private.enqueue_helpdesk_auto_assignment();

create or replace function private.drain_helpdesk_queue_on_capacity_release()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if coalesce(current_setting('app.helpdesk_queue_draining',true),'')='1' then return new; end if;
  if (old.assigned_to is distinct from new.assigned_to and old.assigned_to is not null)
     or (old.status not in ('resolved','closed') and new.status in ('resolved','closed')) then
    perform public.process_helpdesk_assignment_queue(new.workspace_id);
  end if;
  return new;
end $$;
revoke all on function private.drain_helpdesk_queue_on_capacity_release() from public,anon,authenticated;
drop trigger if exists trg_helpdesk_queue_drain on public.helpdesk_tickets;
create trigger trg_helpdesk_queue_drain after update of assigned_to,status on public.helpdesk_tickets for each row execute function private.drain_helpdesk_queue_on_capacity_release();

-- Seed sensible defaults when a new workspace is created.
create or replace function private.bootstrap_workspace()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_super_role uuid;
begin
  perform private.seed_workspace_roles(new.id);
  select id into v_super_role from public.workspace_roles where workspace_id=new.id and code='superadmin';
  if new.created_by is not null then
    insert into public.workspace_members(workspace_id,user_id,role,role_id,active,all_products,helpdesk_auto_assign_enabled)
    values(new.id,new.created_by,'superadmin',v_super_role,true,true,true)
    on conflict (workspace_id,user_id) do update set role='superadmin',role_id=v_super_role,active=true,all_products=true,permissions='{}'::jsonb,helpdesk_auto_assign_enabled=true;
  end if;
  insert into public.products(workspace_id,name,key,description,board_order) values
    (new.id,'Web Administrativa','ADM','Administración interna y operación',1),
    (new.id,'Web Socios','SOC','Portal web para socios/inversionistas',2),
    (new.id,'App Socios','APP','Aplicación móvil para socios/inversionistas',3),
    (new.id,'Automatizaciones','AUT','Automatizaciones, integraciones, jobs y procesos automáticos',4),
    (new.id,'Panel Financiero','FIN','Paneles, conciliación, indicadores y seguimiento financiero',5)
  on conflict (workspace_id,key) do update set name=excluded.name,description=excluded.description,board_order=excluded.board_order;
  insert into public.workspace_settings(workspace_id,helpdesk_auto_assignment_enabled,helpdesk_default_daily_limit,helpdesk_default_active_limit,helpdesk_default_overflow_mode,helpdesk_default_overflow_user_id)
  values(new.id,true,4,4,'fallback',new.created_by)
  on conflict (workspace_id) do nothing;
  insert into public.helpdesk_departments(workspace_id,name,color,active) values
    (new.id,'Reservaciones','#0D47A1',true),(new.id,'Recepción','#4D5A51',true),(new.id,'Gerencia','#21343E',true),(new.id,'Administración','#CA6832',true),(new.id,'Aperturas','#249F58',true),(new.id,'Marketing','#AE6A3E',true),(new.id,'Callcenter','#007BFF',true),(new.id,'Plataforma','#056D25',true),(new.id,'Atención a clientes','#D4DCE0',true),(new.id,'Atención a socios','#FF6363',true)
  on conflict (workspace_id,name) do update set color=excluded.color,active=true;
  perform private.seed_helpdesk_request_types(new.id);
  return new;
end $$;

-- Realtime for queue/capacity changes.
do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='helpdesk_assignment_queue') then
    alter publication supabase_realtime add table public.helpdesk_assignment_queue;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='helpdesk_assignment_log') then
    alter publication supabase_realtime add table public.helpdesk_assignment_log;
  end if;
end $$;

-- Drain queue every minute so daily limits automatically reopen after midnight too.
do $$
begin
  if exists(select 1 from cron.job where jobname='jira-helpdesk-assignment-queue') then
    perform cron.unschedule('jira-helpdesk-assignment-queue');
  end if;
  perform cron.schedule('jira-helpdesk-assignment-queue','* * * * *','select public.process_helpdesk_assignment_queue(null);');
exception when undefined_table or invalid_schema_name then
  null;
end $$;

-- v16.8 compatibility: assignees may be specialized team members without Helpdesk admin rights.
create or replace function private.validate_helpdesk_people()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if tg_op='UPDATE' and new.requester_user_id is distinct from old.requester_user_id then
    raise exception 'requester_user_id cannot be changed after request creation';
  end if;
  if tg_op='INSERT' and new.requester_user_id is not null and not exists(
    select 1 from public.workspace_members wm
    where wm.workspace_id=new.workspace_id and wm.user_id=new.requester_user_id and wm.active=true
  ) then
    raise exception 'Requester must be an active member of the workspace';
  end if;
  if (tg_op='INSERT' or new.assigned_to is distinct from old.assigned_to)
     and new.assigned_to is not null
     and not private.helpdesk_member_routable(new.workspace_id,new.assigned_to) then
    raise exception 'Helpdesk assignee must be an active eligible team member in the workspace';
  end if;
  return new;
end $$;
revoke all on function private.validate_helpdesk_people() from public,anon,authenticated;

-- v16.8 internal queue drain must not grant queue-processing rights to assignees.
create or replace function public.process_helpdesk_assignment_queue(p_workspace uuid default null)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  r record;
  result jsonb;
  processed int:=0;
  assigned int:=0;
  caller uuid:=(select auth.uid());
  internal_call boolean:=coalesce(current_setting('app.helpdesk_internal_queue',true),'')='1';
begin
  if caller is not null and not internal_call and p_workspace is not null
     and not private.has_workspace_permission(p_workspace,'manage_helpdesk')
     and not private.has_workspace_permission(p_workspace,'manage_staff') then
    raise exception 'Insufficient Helpdesk permissions';
  end if;
  if coalesce(current_setting('app.helpdesk_queue_draining',true),'')='1' then
    return jsonb_build_object('processed',0,'assigned',0,'skipped','already_draining');
  end if;
  perform set_config('app.helpdesk_queue_draining','1',true);
  for r in
    select q.helpdesk_ticket_id
    from public.helpdesk_assignment_queue q
    join public.helpdesk_tickets h on h.id=q.helpdesk_ticket_id
    where q.status='waiting'
      and (p_workspace is null or q.workspace_id=p_workspace)
      and h.assigned_to is null
      and h.status not in ('resolved','closed')
    order by q.queued_at
    limit 50
  loop
    processed:=processed+1;
    result:=private.route_helpdesk_ticket_rules(r.helpdesk_ticket_id);
    if coalesce((result->>'assigned')::boolean,false) then assigned:=assigned+1; end if;
  end loop;
  return jsonb_build_object('processed',processed,'assigned',assigned);
end $$;
revoke all on function public.process_helpdesk_assignment_queue(uuid) from public,anon;
grant execute on function public.process_helpdesk_assignment_queue(uuid) to authenticated;

create or replace function private.drain_helpdesk_queue_on_capacity_release()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if coalesce(current_setting('app.helpdesk_queue_draining',true),'')='1' then return new; end if;
  if (old.assigned_to is distinct from new.assigned_to and old.assigned_to is not null)
     or (old.status not in ('resolved','closed') and new.status in ('resolved','closed')) then
    perform set_config('app.helpdesk_internal_queue','1',true);
    perform public.process_helpdesk_assignment_queue(new.workspace_id);
  end if;
  return new;
end $$;
revoke all on function private.drain_helpdesk_queue_on_capacity_release() from public,anon,authenticated;

-- v16.8 assigned specialist access: comments/evidence without Helpdesk admin rights.
drop policy if exists helpdesk_comments_select on public.helpdesk_comments;
create policy helpdesk_comments_select on public.helpdesk_comments for select to authenticated using (
  exists(select 1 from public.helpdesk_tickets h where h.id=helpdesk_comments.helpdesk_ticket_id and private.is_workspace_member(h.workspace_id)
    and (private.has_workspace_permission(h.workspace_id,'manage_helpdesk') or h.requester_user_id=(select auth.uid()) or h.assigned_to=(select auth.uid())))
);
drop policy if exists helpdesk_comments_insert on public.helpdesk_comments;
create policy helpdesk_comments_insert on public.helpdesk_comments for insert to authenticated with check (
  author_id=(select auth.uid()) and exists(select 1 from public.helpdesk_tickets h where h.id=helpdesk_comments.helpdesk_ticket_id and private.is_workspace_member(h.workspace_id)
    and (private.has_workspace_permission(h.workspace_id,'manage_helpdesk') or h.requester_user_id=(select auth.uid()) or h.assigned_to=(select auth.uid())))
);
drop policy if exists helpdesk_comments_update on public.helpdesk_comments;
create policy helpdesk_comments_update on public.helpdesk_comments for update to authenticated
using (author_id=(select auth.uid()) and exists(select 1 from public.helpdesk_tickets h where h.id=helpdesk_comments.helpdesk_ticket_id and private.is_workspace_member(h.workspace_id)
  and (private.has_workspace_permission(h.workspace_id,'manage_helpdesk') or h.requester_user_id=(select auth.uid()) or h.assigned_to=(select auth.uid()))))
with check (author_id=(select auth.uid()) and exists(select 1 from public.helpdesk_tickets h where h.id=helpdesk_comments.helpdesk_ticket_id and private.is_workspace_member(h.workspace_id)
  and (private.has_workspace_permission(h.workspace_id,'manage_helpdesk') or h.requester_user_id=(select auth.uid()) or h.assigned_to=(select auth.uid()))));
drop policy if exists helpdesk_comments_delete on public.helpdesk_comments;
create policy helpdesk_comments_delete on public.helpdesk_comments for delete to authenticated using (
  author_id=(select auth.uid()) and exists(select 1 from public.helpdesk_tickets h where h.id=helpdesk_comments.helpdesk_ticket_id and private.is_workspace_member(h.workspace_id)
    and (private.has_workspace_permission(h.workspace_id,'manage_helpdesk') or h.requester_user_id=(select auth.uid()) or h.assigned_to=(select auth.uid())))
);
drop policy if exists helpdesk_attachments_select on public.helpdesk_attachments;
create policy helpdesk_attachments_select on public.helpdesk_attachments for select to authenticated using (
  exists(select 1 from public.helpdesk_tickets h where h.id=helpdesk_attachments.helpdesk_ticket_id and h.workspace_id=helpdesk_attachments.workspace_id and private.is_workspace_member(h.workspace_id)
    and (private.has_workspace_permission(h.workspace_id,'manage_helpdesk') or h.requester_user_id=(select auth.uid()) or h.assigned_to=(select auth.uid())))
);
drop policy if exists helpdesk_attachments_insert on public.helpdesk_attachments;
create policy helpdesk_attachments_insert on public.helpdesk_attachments for insert to authenticated with check (
  uploaded_by=(select auth.uid()) and exists(select 1 from public.helpdesk_tickets h where h.id=helpdesk_attachments.helpdesk_ticket_id and h.workspace_id=helpdesk_attachments.workspace_id and private.is_workspace_member(h.workspace_id)
    and (private.has_workspace_permission(h.workspace_id,'manage_helpdesk') or h.requester_user_id=(select auth.uid()) or h.assigned_to=(select auth.uid())))
  and (comment_id is null or exists(select 1 from public.helpdesk_comments c where c.id=comment_id and c.helpdesk_ticket_id=helpdesk_ticket_id))
);

create or replace function private.can_view_evidence_object(p_name text)
returns boolean language plpgsql stable security definer set search_path=public,storage,pg_temp as $$
declare v_workspace uuid;v_parent uuid;v_scope text;
begin
  v_workspace:=split_part(p_name,'/',1)::uuid;v_scope:=split_part(p_name,'/',2);v_parent:=split_part(p_name,'/',3)::uuid;
  if v_scope='tickets' then return exists(select 1 from public.tickets t where t.id=v_parent and t.workspace_id=v_workspace and private.has_workspace_permission(v_workspace,'view_tickets') and private.has_product_access(v_workspace,t.product_id));
  elsif v_scope='sprints' then return exists(select 1 from public.sprints s where s.id=v_parent and s.workspace_id=v_workspace and private.has_workspace_permission(v_workspace,'view_dashboard'));
  elsif v_scope='helpdesk' then return exists(select 1 from public.helpdesk_tickets h where h.id=v_parent and h.workspace_id=v_workspace and private.is_workspace_member(v_workspace) and (private.has_workspace_permission(v_workspace,'manage_helpdesk') or h.requester_user_id=(select auth.uid()) or h.assigned_to=(select auth.uid())));
  elsif v_scope='knowledge' then return exists(select 1 from public.knowledge_articles a where a.id=v_parent and a.workspace_id=v_workspace and private.is_workspace_member(v_workspace) and (a.status='published' or private.has_workspace_permission(v_workspace,'manage_settings')));end if;
  return false;exception when invalid_text_representation then return false;
end $$;
create or replace function private.can_upload_evidence_object(p_name text)
returns boolean language plpgsql stable security definer set search_path=public,storage,pg_temp as $$
declare v_workspace uuid;v_parent uuid;v_scope text;
begin
  v_workspace:=split_part(p_name,'/',1)::uuid;v_scope:=split_part(p_name,'/',2);v_parent:=split_part(p_name,'/',3)::uuid;
  if v_scope='tickets' then return exists(select 1 from public.tickets t where t.id=v_parent and t.workspace_id=v_workspace and private.has_workspace_permission(v_workspace,'edit_tickets') and private.has_product_access(v_workspace,t.product_id));
  elsif v_scope='sprints' then return exists(select 1 from public.sprints s where s.id=v_parent and s.workspace_id=v_workspace and private.has_workspace_permission(v_workspace,'edit_tickets'));
  elsif v_scope='helpdesk' then return exists(select 1 from public.helpdesk_tickets h where h.id=v_parent and h.workspace_id=v_workspace and private.is_workspace_member(v_workspace) and (private.has_workspace_permission(v_workspace,'manage_helpdesk') or h.requester_user_id=(select auth.uid()) or h.assigned_to=(select auth.uid())));
  elsif v_scope='knowledge' then return exists(select 1 from public.knowledge_articles a where a.id=v_parent and a.workspace_id=v_workspace and private.has_workspace_permission(v_workspace,'manage_settings'));end if;
  return false;exception when invalid_text_representation then return false;
end $$;


-- v16.8 current TROBBU workspace: Gustavo Chan is the unlimited default overflow fallback.
update public.workspace_members
set helpdesk_auto_assign_enabled=true,
    helpdesk_daily_limit=0,
    helpdesk_active_limit=0
where workspace_id='13345ea4-59e7-4d65-874c-f13a131647d4'
  and user_id='2ab7d928-9ffe-4b72-a433-cde74a9c9518';

-- v16.8 Staff capacity summary wrapper dependency.
-- private schema is not exposed by the Data API; this grant lets the validated public wrapper call the helper.
grant execute on function private.helpdesk_member_capacity(uuid,uuid) to authenticated;

-- v16.8 security hardening: keep privileged mutations in private schema and expose SECURITY INVOKER wrappers.
create or replace function private.assign_helpdesk_ticket_impl(p_ticket_id uuid,p_assignee uuid,p_comment text default null)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_workspace uuid;v_key text;v_category text;v_current uuid;v_caller uuid:=(select auth.uid());
  v_comment text:=nullif(btrim(coalesce(p_comment,'')),'');v_manager boolean:=false;v_redirect boolean:=false;
begin
  if v_caller is null then raise exception 'Authentication required'; end if;
  select workspace_id,ticket_key,category,assigned_to into v_workspace,v_key,v_category,v_current from public.helpdesk_tickets where id=p_ticket_id;
  if v_workspace is null then raise exception 'Helpdesk ticket not found'; end if;
  v_manager:=private.has_workspace_permission(v_workspace,'manage_helpdesk');v_redirect:=v_current=v_caller;
  if not v_manager and not v_redirect then raise exception 'Insufficient Helpdesk permissions'; end if;
  if v_category in ('module','feature','new_requirement') then raise exception 'Requirement proposals are handled through the decision flow'; end if;
  if p_assignee is null or not private.helpdesk_member_routable(v_workspace,p_assignee) then raise exception 'The selected assignee is not an active team member eligible for Helpdesk'; end if;
  if v_comment is not null and char_length(v_comment)>4000 then raise exception 'Assignment comment is too long'; end if;
  perform set_config('app.helpdesk_assignment_action','1',true);
  perform set_config('app.helpdesk_assignment_source',case when v_redirect and not v_manager then 'redirect' else 'manual' end,true);
  update public.helpdesk_tickets set assigned_to=p_assignee,
      assignment_source=case when v_redirect and not v_manager then 'redirect' else 'manual' end,
      assignment_reason=case when v_redirect and not v_manager then coalesce(v_comment,'Redirigido por el responsable anterior.') else v_comment end,
      assignment_confidence=null,assignment_queued_at=null,assignment_last_routed_at=now()
  where id=p_ticket_id;
  if v_comment is not null then insert into public.helpdesk_comments(helpdesk_ticket_id,author_id,body) values(p_ticket_id,v_caller,v_comment); end if;
  return jsonb_build_object('ticket_id',p_ticket_id,'ticket_key',v_key,'assigned_to',p_assignee,'redirected',v_redirect and not v_manager,'comment_added',v_comment is not null);
end $$;
revoke all on function private.assign_helpdesk_ticket_impl(uuid,uuid,text) from public,anon;
grant execute on function private.assign_helpdesk_ticket_impl(uuid,uuid,text) to authenticated;

create or replace function public.assign_helpdesk_ticket(p_ticket_id uuid,p_assignee uuid,p_comment text default null)
returns jsonb language sql security invoker set search_path=public,private,pg_temp
as $$ select private.assign_helpdesk_ticket_impl(p_ticket_id,p_assignee,p_comment) $$;
revoke all on function public.assign_helpdesk_ticket(uuid,uuid,text) from public,anon;
grant execute on function public.assign_helpdesk_ticket(uuid,uuid,text) to authenticated;

create or replace function private.process_helpdesk_assignment_queue_impl(p_workspace uuid default null)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp
as $$
declare r record;result jsonb;processed int:=0;assigned int:=0;caller uuid:=(select auth.uid());internal_call boolean:=coalesce(current_setting('app.helpdesk_internal_queue',true),'')='1';
begin
  if caller is not null and not internal_call and p_workspace is not null
     and not private.has_workspace_permission(p_workspace,'manage_helpdesk') and not private.has_workspace_permission(p_workspace,'manage_staff') then raise exception 'Insufficient Helpdesk permissions'; end if;
  if coalesce(current_setting('app.helpdesk_queue_draining',true),'')='1' then return jsonb_build_object('processed',0,'assigned',0,'skipped','already_draining'); end if;
  perform set_config('app.helpdesk_queue_draining','1',true);
  for r in select q.helpdesk_ticket_id from public.helpdesk_assignment_queue q join public.helpdesk_tickets h on h.id=q.helpdesk_ticket_id
    where q.status='waiting' and (p_workspace is null or q.workspace_id=p_workspace) and h.assigned_to is null and h.status not in ('resolved','closed') order by q.queued_at limit 50
  loop processed:=processed+1;result:=private.route_helpdesk_ticket_rules(r.helpdesk_ticket_id);if coalesce((result->>'assigned')::boolean,false) then assigned:=assigned+1;end if;end loop;
  return jsonb_build_object('processed',processed,'assigned',assigned);
end $$;
revoke all on function private.process_helpdesk_assignment_queue_impl(uuid) from public,anon;
grant execute on function private.process_helpdesk_assignment_queue_impl(uuid) to authenticated;

create or replace function public.process_helpdesk_assignment_queue(p_workspace uuid default null)
returns jsonb language plpgsql security invoker set search_path=public,private,pg_temp
as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_workspace is null then raise exception 'workspace_id is required'; end if;
  if not private.has_workspace_permission(p_workspace,'manage_helpdesk') and not private.has_workspace_permission(p_workspace,'manage_staff') then raise exception 'Insufficient Helpdesk permissions'; end if;
  return private.process_helpdesk_assignment_queue_impl(p_workspace);
end $$;
revoke all on function public.process_helpdesk_assignment_queue(uuid) from public,anon;
grant execute on function public.process_helpdesk_assignment_queue(uuid) to authenticated;

create or replace function private.drain_helpdesk_queue_on_capacity_release()
returns trigger language plpgsql security definer set search_path=public,pg_temp
as $$
begin
  if coalesce(current_setting('app.helpdesk_queue_draining',true),'')='1' then return new; end if;
  if (old.assigned_to is distinct from new.assigned_to and old.assigned_to is not null) or (old.status not in ('resolved','closed') and new.status in ('resolved','closed')) then
    perform set_config('app.helpdesk_internal_queue','1',true);perform private.process_helpdesk_assignment_queue_impl(new.workspace_id);
  end if;
  return new;
end $$;
revoke all on function private.drain_helpdesk_queue_on_capacity_release() from public,anon,authenticated;

select cron.unschedule('jira-helpdesk-assignment-queue') where exists(select 1 from cron.job where jobname='jira-helpdesk-assignment-queue');
select cron.schedule('jira-helpdesk-assignment-queue','* * * * *','select private.process_helpdesk_assignment_queue_impl(null);');

create index if not exists idx_helpdesk_assignment_log_assigned_user on public.helpdesk_assignment_log(assigned_user_id);
create index if not exists idx_helpdesk_assignment_log_previous_user on public.helpdesk_assignment_log(previous_user_id) where previous_user_id is not null;
create index if not exists idx_workspace_members_helpdesk_overflow_user on public.workspace_members(helpdesk_overflow_user_id) where helpdesk_overflow_user_id is not null;

-- Jira Interno TROBBU v16.9 consolidated upgrade
-- Stable RLS-aware navigation counters + privacy-preserving product visibility.
drop policy if exists products_select on public.products;
create policy products_select
on public.products for select to authenticated
using (
  private.is_workspace_member(workspace_id)
  and (
    private.has_product_access(workspace_id,id)
    or private.has_workspace_permission(workspace_id,'manage_helpdesk')
    or private.has_workspace_permission(workspace_id,'manage_products')
  )
);

create or replace function public.list_authorized_products(p_workspace uuid)
returns setof public.products
language sql
stable
security invoker
set search_path=public,pg_temp
as $$
  select p.*
  from public.products p
  where p.workspace_id=p_workspace
    and (private.has_product_access(p_workspace,p.id) or private.has_workspace_permission(p_workspace,'manage_products'))
  order by p.board_order,p.name
$$;
revoke all on function public.list_authorized_products(uuid) from public,anon;
grant execute on function public.list_authorized_products(uuid) to authenticated;

create or replace function public.get_navigation_counts(p_workspace uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path=public,pg_temp
as $$
declare
  v_uid uuid:=(select auth.uid());
  v_ticket_total bigint:=0;
  v_backlog_total bigint:=0;
  v_knowledge_total bigint:=0;
  v_helpdesk_total bigint:=0;
  v_my_tasks_total bigint:=0;
  v_product_counts jsonb:='{}'::jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not private.is_workspace_member(p_workspace) then raise exception 'Workspace access required'; end if;
  select count(*) into v_ticket_total from public.tickets t where t.workspace_id=p_workspace;
  select count(*) into v_backlog_total from public.tickets t where t.workspace_id=p_workspace and t.sprint_id is null and t.status<>'closed';
  select count(*) into v_knowledge_total from public.knowledge_articles k where k.workspace_id=p_workspace;
  select count(*) into v_helpdesk_total from public.helpdesk_tickets h where h.workspace_id=p_workspace;
  select count(*) into v_my_tasks_total from public.tickets t where t.workspace_id=p_workspace and (t.reporter_id=v_uid or t.dev_owner_id=v_uid or t.qa_owner_id=v_uid);
  select coalesce(jsonb_object_agg(x.product_id::text,x.cnt),'{}'::jsonb) into v_product_counts
  from (select t.product_id,count(*)::bigint cnt from public.tickets t where t.workspace_id=p_workspace group by t.product_id) x;
  return jsonb_build_object('tickets',v_ticket_total,'backlog',v_backlog_total,'knowledge',v_knowledge_total,'helpdesk',v_helpdesk_total,'mytasks',v_my_tasks_total,'products',v_product_counts);
end $$;
revoke all on function public.get_navigation_counts(uuid) from public,anon;
grant execute on function public.get_navigation_counts(uuid) to authenticated;

-- Jira Interno TROBBU v17.0
-- Knowledge relevance/RBAC, sprint product filters, configurable credentials,
-- Helpdesk prioritization/routing, Vacations + AI impact, and Knowledge taxonomy.

-- -----------------------------------------------------------------------------
-- 1) Expanded permissions
-- -----------------------------------------------------------------------------
create or replace function private.role_default_permission(p_role public.app_role,p_permission text)
returns boolean
language sql
immutable
security invoker
set search_path=public,pg_temp
as $$
  select case
    when p_role='superadmin' then true
    when p_role='admin' then p_permission in (
      'view_dashboard','view_tickets','create_tickets','edit_tickets','delete_tickets',
      'manage_sprints','qa_review','manage_helpdesk','manage_staff','manage_products','manage_ticket_fields','manage_settings',
      'view_knowledge','create_knowledge','edit_knowledge','delete_knowledge',
      'view_vacations','request_vacations','manage_vacations'
    )
    when p_role='pm' then p_permission in (
      'view_dashboard','view_tickets','create_tickets','edit_tickets','delete_tickets',
      'manage_sprints','qa_review','manage_helpdesk','manage_ticket_fields',
      'view_knowledge','create_knowledge','edit_knowledge',
      'view_vacations','request_vacations','manage_vacations'
    )
    when p_role='dev' then p_permission in (
      'view_dashboard','view_tickets','create_tickets','edit_tickets',
      'view_knowledge','view_vacations','request_vacations'
    )
    when p_role='qa' then p_permission in (
      'view_dashboard','view_tickets','create_tickets','edit_tickets','qa_review',
      'view_knowledge','view_vacations','request_vacations'
    )
    when p_role='consulta' then p_permission in (
      'view_dashboard','view_tickets','view_knowledge','view_vacations'
    )
    else false
  end;
$$;

-- -----------------------------------------------------------------------------
-- 2) Knowledge taxonomy by product + category
-- -----------------------------------------------------------------------------
create table if not exists public.knowledge_categories(
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  icon text not null default 'lucide:folder',
  color text not null default '#4D5A51',
  sort_order integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,code),
  unique(id,workspace_id)
);
create index if not exists idx_knowledge_categories_workspace on public.knowledge_categories(workspace_id,active,sort_order,name);
alter table public.knowledge_categories enable row level security;
revoke all on public.knowledge_categories from anon;
grant select,insert,update,delete on public.knowledge_categories to authenticated;

drop policy if exists knowledge_categories_select on public.knowledge_categories;
create policy knowledge_categories_select on public.knowledge_categories for select to authenticated
using(private.has_workspace_permission(workspace_id,'view_knowledge') or private.has_workspace_permission(workspace_id,'create_knowledge') or private.has_workspace_permission(workspace_id,'edit_knowledge'));
drop policy if exists knowledge_categories_insert on public.knowledge_categories;
create policy knowledge_categories_insert on public.knowledge_categories for insert to authenticated
with check(private.has_workspace_permission(workspace_id,'edit_knowledge'));
drop policy if exists knowledge_categories_update on public.knowledge_categories;
create policy knowledge_categories_update on public.knowledge_categories for update to authenticated
using(private.has_workspace_permission(workspace_id,'edit_knowledge'))
with check(private.has_workspace_permission(workspace_id,'edit_knowledge'));
drop policy if exists knowledge_categories_delete on public.knowledge_categories;
create policy knowledge_categories_delete on public.knowledge_categories for delete to authenticated
using(private.has_workspace_permission(workspace_id,'delete_knowledge'));

drop trigger if exists trg_knowledge_categories_updated on public.knowledge_categories;
create trigger trg_knowledge_categories_updated before update on public.knowledge_categories for each row execute function public.set_updated_at();

insert into public.knowledge_categories(workspace_id,code,name,description,icon,color,sort_order)
select w.id,x.code,x.name,x.description,x.icon,x.color,x.sort_order
from public.workspaces w
cross join (values
  ('systems','Sistemas','Plataformas, integraciones, accesos y soporte técnico.','lucide:monitor-cog','#02488D',10),
  ('reception','Recepción','Operación de recepción, check-in, huéspedes y atención en sitio.','lucide:concierge-bell','#D1AA87',20),
  ('operations','Operaciones','Procesos operativos transversales y ejecución diaria.','lucide:workflow','#4D5A51',30),
  ('policies','Políticas','Políticas internas, criterios y lineamientos.','lucide:shield-check','#0C2B2A',40),
  ('sop','SOP','Procedimientos operativos estándar paso a paso.','lucide:list-checks','#056D25',50),
  ('reservations','Reservaciones','Reservas, tarifas, disponibilidad, OTAs y atención previa a llegada.','lucide:calendar-check','#0D47A1',60),
  ('administration','Administración','Procesos administrativos, pagos y controles internos.','lucide:briefcase-business','#AE6A3E',70),
  ('general','General','Información transversal sin categoría específica.','lucide:folder','#6B7280',999)
) as x(code,name,description,icon,color,sort_order)
on conflict(workspace_id,code) do update set
  name=excluded.name,description=excluded.description,icon=excluded.icon,color=excluded.color,sort_order=excluded.sort_order,active=true;

create or replace function private.seed_default_knowledge_categories()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  insert into public.knowledge_categories(workspace_id,code,name,description,icon,color,sort_order)
  values
    (new.id,'systems','Sistemas','Plataformas, integraciones, accesos y soporte técnico.','lucide:monitor-cog','#02488D',10),
    (new.id,'reception','Recepción','Operación de recepción, check-in, huéspedes y atención en sitio.','lucide:concierge-bell','#D1AA87',20),
    (new.id,'operations','Operaciones','Procesos operativos transversales y ejecución diaria.','lucide:workflow','#4D5A51',30),
    (new.id,'policies','Políticas','Políticas internas, criterios y lineamientos.','lucide:shield-check','#0C2B2A',40),
    (new.id,'sop','SOP','Procedimientos operativos estándar paso a paso.','lucide:list-checks','#056D25',50),
    (new.id,'reservations','Reservaciones','Reservas, tarifas, disponibilidad, OTAs y atención previa a llegada.','lucide:calendar-check','#0D47A1',60),
    (new.id,'administration','Administración','Procesos administrativos, pagos y controles internos.','lucide:briefcase-business','#AE6A3E',70),
    (new.id,'general','General','Información transversal sin categoría específica.','lucide:folder','#6B7280',999)
  on conflict(workspace_id,code) do nothing;
  return new;
end $$;
revoke all on function private.seed_default_knowledge_categories() from public,anon,authenticated;
drop trigger if exists trg_seed_default_knowledge_categories on public.workspaces;
create trigger trg_seed_default_knowledge_categories after insert on public.workspaces for each row execute function private.seed_default_knowledge_categories();

alter table public.knowledge_articles add column if not exists category_id uuid;
alter table public.knowledge_article_versions add column if not exists category_id uuid;

do $$ begin
  if not exists(select 1 from pg_constraint where conname='knowledge_articles_category_workspace_fkey') then
    alter table public.knowledge_articles add constraint knowledge_articles_category_workspace_fkey
      foreign key(category_id,workspace_id) references public.knowledge_categories(id,workspace_id) on delete restrict;
  end if;
  if not exists(select 1 from pg_constraint where conname='knowledge_versions_category_workspace_fkey') then
    alter table public.knowledge_article_versions add constraint knowledge_versions_category_workspace_fkey
      foreign key(category_id,workspace_id) references public.knowledge_categories(id,workspace_id) on delete restrict;
  end if;
end $$;
create index if not exists idx_knowledge_articles_category on public.knowledge_articles(workspace_id,category_id) where category_id is not null;
create index if not exists idx_knowledge_versions_category on public.knowledge_article_versions(workspace_id,category_id) where category_id is not null;

-- Knowledge RLS now uses dedicated capabilities.
drop policy if exists knowledge_articles_select on public.knowledge_articles;
create policy knowledge_articles_select on public.knowledge_articles for select to authenticated using (
  (status='published' and private.has_workspace_permission(workspace_id,'view_knowledge'))
  or private.has_workspace_permission(workspace_id,'edit_knowledge')
  or (status='draft' and active_version_id is null and created_by=(select auth.uid()) and private.has_workspace_permission(workspace_id,'create_knowledge'))
);
drop policy if exists knowledge_articles_insert on public.knowledge_articles;
create policy knowledge_articles_insert on public.knowledge_articles for insert to authenticated with check (
  private.has_workspace_permission(workspace_id,'create_knowledge')
  and (created_by is null or created_by=(select auth.uid()))
);
drop policy if exists knowledge_articles_update on public.knowledge_articles;
create policy knowledge_articles_update on public.knowledge_articles for update to authenticated
using(
  private.has_workspace_permission(workspace_id,'edit_knowledge') or (
    private.has_workspace_permission(workspace_id,'create_knowledge') and created_by=(select auth.uid()) and status='draft' and active_version_id is null
  )
)
with check(
  private.has_workspace_permission(workspace_id,'edit_knowledge') or (
    private.has_workspace_permission(workspace_id,'create_knowledge') and created_by=(select auth.uid()) and status='draft' and active_version_id is null
  )
);
drop policy if exists knowledge_articles_delete on public.knowledge_articles;
create policy knowledge_articles_delete on public.knowledge_articles for delete to authenticated
using(
  private.has_workspace_permission(workspace_id,'delete_knowledge') or (
    private.has_workspace_permission(workspace_id,'create_knowledge') and created_by=(select auth.uid()) and status='draft' and active_version_id is null
  )
);

drop policy if exists knowledge_versions_select on public.knowledge_article_versions;
create policy knowledge_versions_select on public.knowledge_article_versions for select to authenticated using (
  (status in ('published','archived') and private.has_workspace_permission(workspace_id,'view_knowledge'))
  or private.has_workspace_permission(workspace_id,'edit_knowledge')
  or (status='draft' and created_by=(select auth.uid()) and private.has_workspace_permission(workspace_id,'create_knowledge'))
);
drop policy if exists knowledge_versions_insert on public.knowledge_article_versions;
create policy knowledge_versions_insert on public.knowledge_article_versions for insert to authenticated with check (
  private.has_workspace_permission(workspace_id,'create_knowledge')
  and (created_by is null or created_by=(select auth.uid()))
);
drop policy if exists knowledge_versions_update on public.knowledge_article_versions;
create policy knowledge_versions_update on public.knowledge_article_versions for update to authenticated
using(
  private.has_workspace_permission(workspace_id,'edit_knowledge') or (
    private.has_workspace_permission(workspace_id,'create_knowledge') and created_by=(select auth.uid()) and status='draft'
  )
)
with check(
  private.has_workspace_permission(workspace_id,'edit_knowledge') or (
    private.has_workspace_permission(workspace_id,'create_knowledge') and created_by=(select auth.uid()) and status='draft'
  )
);
drop policy if exists knowledge_versions_delete on public.knowledge_article_versions;
create policy knowledge_versions_delete on public.knowledge_article_versions for delete to authenticated using (
  status='draft' and (
    private.has_workspace_permission(workspace_id,'delete_knowledge') or (
      private.has_workspace_permission(workspace_id,'create_knowledge') and created_by=(select auth.uid())
    )
  )
);
drop policy if exists knowledge_version_events_select on public.knowledge_version_events;
create policy knowledge_version_events_select on public.knowledge_version_events for select to authenticated
using(private.has_workspace_permission(workspace_id,'view_knowledge'));
drop policy if exists knowledge_translations_select on public.knowledge_version_translations;
create policy knowledge_translations_select on public.knowledge_version_translations for select to authenticated using (
  private.has_workspace_permission(workspace_id,'view_knowledge') and exists(
    select 1 from public.knowledge_article_versions v where v.id=version_id and v.workspace_id=knowledge_version_translations.workspace_id
      and (v.status in ('published','archived') or private.has_workspace_permission(v.workspace_id,'edit_knowledge'))
  )
);

drop policy if exists knowledge_media_select on public.knowledge_media;
create policy knowledge_media_select on public.knowledge_media for select to authenticated using (
  exists(select 1 from public.knowledge_articles a where a.id=article_id and a.workspace_id=knowledge_media.workspace_id and (
    (a.status='published' and private.has_workspace_permission(a.workspace_id,'view_knowledge'))
    or private.has_workspace_permission(a.workspace_id,'edit_knowledge')
    or (a.status='draft' and a.active_version_id is null and a.created_by=(select auth.uid()) and private.has_workspace_permission(a.workspace_id,'create_knowledge'))
  ))
);
drop policy if exists knowledge_media_insert on public.knowledge_media;
create policy knowledge_media_insert on public.knowledge_media for insert to authenticated with check (
  uploaded_by=(select auth.uid()) and exists(
    select 1 from public.knowledge_articles a where a.id=article_id and a.workspace_id=knowledge_media.workspace_id and (
      private.has_workspace_permission(a.workspace_id,'edit_knowledge') or (
        private.has_workspace_permission(a.workspace_id,'create_knowledge') and a.created_by=(select auth.uid()) and a.status='draft' and a.active_version_id is null
      )
    )
  )
);
drop policy if exists knowledge_media_delete on public.knowledge_media;
create policy knowledge_media_delete on public.knowledge_media for delete to authenticated
using(
  private.has_workspace_permission(workspace_id,'delete_knowledge') or private.has_workspace_permission(workspace_id,'edit_knowledge') or exists(
    select 1 from public.knowledge_articles a where a.id=article_id and a.workspace_id=knowledge_media.workspace_id
      and private.has_workspace_permission(a.workspace_id,'create_knowledge') and a.created_by=(select auth.uid()) and a.status='draft' and a.active_version_id is null
  )
);

-- Preserve category through version lifecycle and use edit_knowledge instead of manage_settings.
create or replace function public.create_knowledge_draft_version(p_article_id uuid,p_change_note text)
returns uuid language plpgsql security invoker set search_path=public,private,pg_temp as $$
declare a public.knowledge_articles%rowtype;src public.knowledge_article_versions%rowtype;v_id uuid;v_no int;
begin
  select * into a from public.knowledge_articles where id=p_article_id;if not found then raise exception 'Knowledge article not found';end if;
  if not private.has_workspace_permission(a.workspace_id,'edit_knowledge') then raise exception 'Insufficient Knowledge permissions';end if;
  if nullif(btrim(coalesce(p_change_note,'')),'') is null then raise exception 'Describe why this new version is being created';end if;
  if a.draft_version_id is not null then raise exception 'This article already has an active draft version';end if;
  if a.active_version_id is not null then select * into src from public.knowledge_article_versions where id=a.active_version_id;
  else src.title:=a.title;src.slug:=a.slug;src.summary:=a.summary;src.content:=a.content;src.content_blocks:=a.content_blocks;src.tags:=a.tags;src.product_id:=a.product_id;src.module_id:=a.module_id;src.category_id:=a.category_id;end if;
  select coalesce(max(version_number),0)+1 into v_no from public.knowledge_article_versions where article_id=a.id;
  insert into public.knowledge_article_versions(article_id,workspace_id,version_number,status,change_note,title,slug,summary,content,content_blocks,tags,product_id,module_id,category_id,created_by,updated_by)
  values(a.id,a.workspace_id,v_no,'draft',btrim(p_change_note),src.title,src.slug,src.summary,src.content,src.content_blocks,src.tags,src.product_id,src.module_id,src.category_id,(select auth.uid()),(select auth.uid())) returning id into v_id;
  update public.knowledge_articles set draft_version_id=v_id where id=a.id;return v_id;
end $$;
revoke all on function public.create_knowledge_draft_version(uuid,text) from public,anon;grant execute on function public.create_knowledge_draft_version(uuid,text) to authenticated;

create or replace function public.publish_knowledge_version(p_version_id uuid)
returns jsonb language plpgsql security invoker set search_path=public,private,pg_temp as $$
declare v public.knowledge_article_versions%rowtype;a public.knowledge_articles%rowtype;old_id uuid;
begin
  select * into v from public.knowledge_article_versions where id=p_version_id;if not found then raise exception 'Knowledge version not found';end if;
  select * into a from public.knowledge_articles where id=v.article_id;
  if not private.has_workspace_permission(v.workspace_id,'edit_knowledge') then raise exception 'Insufficient Knowledge permissions';end if;
  perform set_config('app.knowledge_publish','on',true);old_id:=a.active_version_id;
  if old_id is not null and old_id<>v.id then update public.knowledge_article_versions set status='archived' where id=old_id;end if;
  update public.knowledge_article_versions set status='published',published_by=(select auth.uid()),published_at=now() where id=v.id;
  update public.knowledge_articles set title=v.title,slug=v.slug,summary=v.summary,content=v.content,content_blocks=v.content_blocks,tags=v.tags,product_id=v.product_id,module_id=v.module_id,category_id=v.category_id,status='published',active_version_id=v.id,draft_version_id=case when draft_version_id=v.id then null else draft_version_id end,updated_by=(select auth.uid()),updated_at=now() where id=v.article_id;
  return jsonb_build_object('article_id',v.article_id,'version_id',v.id,'version_number',v.version_number);
end $$;
revoke all on function public.publish_knowledge_version(uuid) from public,anon;grant execute on function public.publish_knowledge_version(uuid) to authenticated;

create or replace function public.discard_knowledge_draft_version(p_version_id uuid)
returns boolean language plpgsql security invoker set search_path=public,private,pg_temp as $$
declare v public.knowledge_article_versions%rowtype;
begin
  select * into v from public.knowledge_article_versions where id=p_version_id and status='draft';if not found then raise exception 'Draft version not found';end if;
  if not private.has_workspace_permission(v.workspace_id,'edit_knowledge') then raise exception 'Insufficient Knowledge permissions';end if;
  update public.knowledge_articles set draft_version_id=null where id=v.article_id and draft_version_id=v.id;delete from public.knowledge_article_versions where id=v.id;return true;
end $$;
revoke all on function public.discard_knowledge_draft_version(uuid) from public,anon;grant execute on function public.discard_knowledge_draft_version(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 3) Vacations / absences
-- -----------------------------------------------------------------------------
create table if not exists public.vacation_requests(
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text,
  status text not null default 'pending' check(status in ('pending','approved','rejected','cancelled')),
  decision_by uuid references auth.users(id) on delete set null,
  decision_note text,
  decided_at timestamptz,
  ai_risk text check(ai_risk is null or ai_risk in ('low','medium','high','critical')),
  ai_recommendation text check(ai_recommendation is null or ai_recommendation in ('approve','approve_with_conditions','review','decline')),
  ai_summary text,
  ai_analysis jsonb not null default '{}'::jsonb,
  ai_analyzed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(end_date>=start_date),
  check(end_date-start_date<=60)
);
create index if not exists idx_vacation_workspace_dates on public.vacation_requests(workspace_id,start_date,end_date,status);
create index if not exists idx_vacation_user_dates on public.vacation_requests(user_id,start_date,end_date,status);
alter table public.vacation_requests enable row level security;
revoke all on public.vacation_requests from anon;
grant select,insert,update,delete on public.vacation_requests to authenticated;

drop policy if exists vacation_requests_select on public.vacation_requests;
create policy vacation_requests_select on public.vacation_requests for select to authenticated using (
  private.is_workspace_member(workspace_id) and (
    user_id=(select auth.uid()) or private.has_workspace_permission(workspace_id,'manage_vacations') or (status='approved' and private.has_workspace_permission(workspace_id,'view_vacations'))
  )
);
drop policy if exists vacation_requests_insert on public.vacation_requests;
create policy vacation_requests_insert on public.vacation_requests for insert to authenticated with check (
  user_id=(select auth.uid()) and private.has_workspace_permission(workspace_id,'request_vacations') and status='pending'
);
drop policy if exists vacation_requests_update on public.vacation_requests;
create policy vacation_requests_update on public.vacation_requests for update to authenticated using (
  private.has_workspace_permission(workspace_id,'manage_vacations') or (user_id=(select auth.uid()) and status='pending')
) with check (
  private.has_workspace_permission(workspace_id,'manage_vacations') or (user_id=(select auth.uid()) and status in ('pending','cancelled'))
);
drop policy if exists vacation_requests_delete on public.vacation_requests;
create policy vacation_requests_delete on public.vacation_requests for delete to authenticated using (
  private.has_workspace_permission(workspace_id,'manage_vacations') or (user_id=(select auth.uid()) and status in ('pending','cancelled'))
);

drop trigger if exists trg_vacation_updated on public.vacation_requests;
create trigger trg_vacation_updated before update on public.vacation_requests for each row execute function public.set_updated_at();

create or replace function private.guard_vacation_request()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_service boolean:=coalesce(current_setting('request.jwt.claim.role',true),'')='service_role';
  v_manage boolean;
begin
  v_manage:=v_service or private.has_workspace_permission(new.workspace_id,'manage_vacations');
  if not exists(select 1 from public.workspace_members wm where wm.workspace_id=new.workspace_id and wm.user_id=new.user_id and wm.active=true) then
    raise exception 'Vacation requester must be an active member of the workspace';
  end if;
  if tg_op='INSERT' then
    if not v_manage then
      new.decision_by:=null;new.decision_note:=null;new.decided_at:=null;
      new.ai_risk:=null;new.ai_recommendation:=null;new.ai_summary:=null;new.ai_analysis:='{}'::jsonb;new.ai_analyzed_at:=null;
    end if;
  else
    if old.status<>'pending' and new.status is distinct from old.status then raise exception 'Only pending vacation requests can change status';end if;
    if new.start_date is distinct from old.start_date or new.end_date is distinct from old.end_date or new.user_id is distinct from old.user_id then
      new.ai_risk:=null;new.ai_recommendation:=null;new.ai_summary:=null;new.ai_analysis:='{}'::jsonb;new.ai_analyzed_at:=null;
    end if;
    if not v_manage then
      if new.workspace_id is distinct from old.workspace_id or new.user_id is distinct from old.user_id then raise exception 'Requester cannot change workspace or owner';end if;
      if new.decision_by is distinct from old.decision_by or new.decision_note is distinct from old.decision_note or new.decided_at is distinct from old.decided_at
         or new.ai_risk is distinct from old.ai_risk or new.ai_recommendation is distinct from old.ai_recommendation or new.ai_summary is distinct from old.ai_summary
         or new.ai_analysis is distinct from old.ai_analysis or new.ai_analyzed_at is distinct from old.ai_analyzed_at then
        raise exception 'Decision and AI analysis fields are restricted';
      end if;
      if new.status not in ('pending','cancelled') then raise exception 'Requester can only keep pending or cancel the request';end if;
    end if;
  end if;
  if new.status in ('pending','approved') and exists(
    select 1 from public.vacation_requests vr
    where vr.workspace_id=new.workspace_id and vr.user_id=new.user_id and vr.id<>new.id
      and vr.status in ('pending','approved') and vr.start_date<=new.end_date and vr.end_date>=new.start_date
  ) then raise exception 'Ya existe una solicitud pendiente o aprobada que se cruza con estas fechas';end if;
  if new.status='approved' then
    if new.ai_analyzed_at is null or new.ai_analysis is null or new.ai_analysis='{}'::jsonb then
      raise exception 'Analyze sprint impact before approving vacations';
    end if;
    if new.ai_analyzed_at < now()-interval '12 hours' then
      raise exception 'Vacation impact analysis is stale; analyze again before approving';
    end if;
    if exists(
      select 1 from public.tickets t
      where t.workspace_id=new.workspace_id and (t.dev_owner_id=new.user_id or t.qa_owner_id=new.user_id)
        and t.status<>'closed' and t.updated_at>new.ai_analyzed_at
    ) then raise exception 'Assigned work changed after the vacation analysis; analyze again before approving'; end if;
    if exists(
      select 1 from public.sprints s
      where s.workspace_id=new.workspace_id and s.status in ('active','planned')
        and s.start_date<=new.end_date and s.end_date>=new.start_date and s.updated_at>new.ai_analyzed_at
    ) then raise exception 'Sprint planning changed after the vacation analysis; analyze again before approving'; end if;
    if exists(
      select 1 from public.vacation_requests vr
      where vr.workspace_id=new.workspace_id and vr.id<>new.id and vr.status='approved'
        and vr.start_date<=new.end_date and vr.end_date>=new.start_date and vr.updated_at>new.ai_analyzed_at
    ) then raise exception 'Team availability changed after the vacation analysis; analyze again before approving'; end if;
  end if;
  if new.status in ('approved','rejected') then
    if not v_service then new.decision_by=(select auth.uid());
    elsif new.decision_by is null then new.decision_by=(select auth.uid()); end if;
    new.decided_at=coalesce(new.decided_at,now());
  end if;
  return new;
end $$;
revoke all on function private.guard_vacation_request() from public,anon,authenticated;
drop trigger if exists trg_guard_vacation_request on public.vacation_requests;
create trigger trg_guard_vacation_request before insert or update on public.vacation_requests for each row execute function private.guard_vacation_request();

create or replace function private.notify_vacation_request_change()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='INSERT' then
    insert into public.notifications(workspace_id,user_id,type,title,body,category,metadata)
    select new.workspace_id,wm.user_id,'vacation_requested','Nueva solicitud de vacaciones',
      coalesce(p.full_name,'Colaborador')||' solicitó ausencia del '||to_char(new.start_date,'DD/MM/YYYY')||' al '||to_char(new.end_date,'DD/MM/YYYY')||'.',
      'vacations',jsonb_build_object('entity_type','vacation','entity_id',new.id,'user_id',new.user_id,'start_date',new.start_date,'end_date',new.end_date)
    from public.workspace_members wm left join public.profiles p on p.id=new.user_id
    where wm.workspace_id=new.workspace_id and wm.active=true and wm.user_id<>new.user_id
      and private.member_has_permission(new.workspace_id,wm.user_id,'manage_vacations');
  elsif new.status is distinct from old.status then
    insert into public.notifications(workspace_id,user_id,type,title,body,category,metadata)
    values(new.workspace_id,new.user_id,'vacation_status',
      case new.status when 'approved' then 'Vacaciones aprobadas' when 'rejected' then 'Solicitud de vacaciones rechazada' when 'cancelled' then 'Solicitud de vacaciones cancelada' else 'Solicitud de vacaciones actualizada' end,
      coalesce(new.decision_note,case new.status when 'approved' then 'Tu ausencia fue aprobada y ya aparece en el calendario.' when 'rejected' then 'Revisa el detalle de la decisión.' else 'El estado de tu solicitud cambió.' end),
      'vacations',jsonb_build_object('entity_type','vacation','entity_id',new.id,'status',new.status,'start_date',new.start_date,'end_date',new.end_date));
  end if;
  return new;
end $$;
revoke all on function private.notify_vacation_request_change() from public,anon,authenticated;
drop trigger if exists trg_notify_vacation_request_change on public.vacation_requests;
create trigger trg_notify_vacation_request_change after insert or update of status on public.vacation_requests for each row execute function private.notify_vacation_request_change();

-- -----------------------------------------------------------------------------
-- 4) Knowledge storage helpers use dedicated permissions
-- -----------------------------------------------------------------------------
create or replace function private.can_view_evidence_object(p_name text)
returns boolean language plpgsql stable security definer
set search_path=public,storage,pg_temp as $$
declare v_workspace uuid;v_parent uuid;v_scope text;
begin
  v_workspace:=split_part(p_name,'/',1)::uuid;v_scope:=split_part(p_name,'/',2);v_parent:=split_part(p_name,'/',3)::uuid;
  if v_scope='tickets' then return exists(select 1 from public.tickets t where t.id=v_parent and t.workspace_id=v_workspace and private.has_workspace_permission(v_workspace,'view_tickets') and private.has_product_access(v_workspace,t.product_id));
  elsif v_scope='sprints' then return exists(select 1 from public.sprints s where s.id=v_parent and s.workspace_id=v_workspace and private.has_workspace_permission(v_workspace,'view_dashboard'));
  elsif v_scope='helpdesk' then return exists(select 1 from public.helpdesk_tickets h where h.id=v_parent and h.workspace_id=v_workspace and private.is_workspace_member(v_workspace) and (private.has_workspace_permission(v_workspace,'manage_helpdesk') or h.requester_user_id=(select auth.uid())));
  elsif v_scope='knowledge' then return exists(select 1 from public.knowledge_articles a where a.id=v_parent and a.workspace_id=v_workspace and private.has_workspace_permission(v_workspace,'view_knowledge') and (a.status='published' or private.has_workspace_permission(v_workspace,'edit_knowledge')));
  end if;return false;
exception when invalid_text_representation then return false;end $$;
create or replace function private.can_upload_evidence_object(p_name text)
returns boolean language plpgsql stable security definer
set search_path=public,storage,pg_temp as $$
declare v_workspace uuid;v_parent uuid;v_scope text;
begin
  v_workspace:=split_part(p_name,'/',1)::uuid;v_scope:=split_part(p_name,'/',2);v_parent:=split_part(p_name,'/',3)::uuid;
  if v_scope='tickets' then return exists(select 1 from public.tickets t where t.id=v_parent and t.workspace_id=v_workspace and private.has_workspace_permission(v_workspace,'edit_tickets') and private.has_product_access(v_workspace,t.product_id));
  elsif v_scope='sprints' then return exists(select 1 from public.sprints s where s.id=v_parent and s.workspace_id=v_workspace and private.has_workspace_permission(v_workspace,'edit_tickets'));
  elsif v_scope='helpdesk' then return exists(select 1 from public.helpdesk_tickets h where h.id=v_parent and h.workspace_id=v_workspace and private.is_workspace_member(v_workspace) and (private.has_workspace_permission(v_workspace,'manage_helpdesk') or h.requester_user_id=(select auth.uid())));
  elsif v_scope='knowledge' then return exists(select 1 from public.knowledge_articles a where a.id=v_parent and a.workspace_id=v_workspace and (
    private.has_workspace_permission(v_workspace,'edit_knowledge') or (private.has_workspace_permission(v_workspace,'create_knowledge') and a.created_by=(select auth.uid()) and a.status='draft' and a.active_version_id is null)
  ));
  end if;return false;
exception when invalid_text_representation then return false;end $$;
create or replace function private.can_manage_evidence_object(p_name text)
returns boolean language plpgsql stable security definer
set search_path=public,storage,pg_temp as $$
declare v_workspace uuid;v_parent uuid;v_scope text;
begin
  v_workspace:=split_part(p_name,'/',1)::uuid;v_scope:=split_part(p_name,'/',2);v_parent:=split_part(p_name,'/',3)::uuid;
  if v_scope='helpdesk' then return private.has_workspace_permission(v_workspace,'manage_helpdesk');
  elsif v_scope='sprints' then return private.has_workspace_permission(v_workspace,'manage_sprints');
  elsif v_scope='knowledge' then return private.has_workspace_permission(v_workspace,'delete_knowledge') or private.has_workspace_permission(v_workspace,'edit_knowledge') or exists(
    select 1 from public.knowledge_articles a where a.id=v_parent and a.workspace_id=v_workspace and private.has_workspace_permission(v_workspace,'create_knowledge') and a.created_by=(select auth.uid()) and a.status='draft' and a.active_version_id is null
  );
  end if;return private.has_workspace_permission(v_workspace,'delete_tickets');
exception when invalid_text_representation then return false;end $$;

-- Auto-assignment requires usable routing context at database level.
update public.workspace_members
set helpdesk_routing_description=coalesce(nullif(btrim(helpdesk_routing_description),''),'Atención general de Helpdesk; configurar responsabilidades específicas.')
where helpdesk_auto_assign_enabled=true and length(btrim(coalesce(helpdesk_routing_description,'')))<12;

do $$ begin
  if not exists(select 1 from pg_constraint where conname='workspace_members_helpdesk_routing_context_check') then
    alter table public.workspace_members add constraint workspace_members_helpdesk_routing_context_check
      check (not helpdesk_auto_assign_enabled or length(btrim(coalesce(helpdesk_routing_description,'')))>=12);
  end if;
end $$;

-- Realtime additions.
do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='knowledge_categories') then alter publication supabase_realtime add table public.knowledge_categories; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='vacation_requests') then alter publication supabase_realtime add table public.vacation_requests; end if;
end $$;

-- ============================================================================
-- Jira Interno TROBBU v17.1
-- ============================================================================
-- Jira Interno TROBBU v17.1
-- Base requerida: v17.0
-- Regression fixes: Knowledge draft creation, multi-block vacations and vacation planning.

begin;

-- -----------------------------------------------------------------------------
-- 1) Knowledge: atomic initial draft creation
-- -----------------------------------------------------------------------------
create or replace function public.create_knowledge_initial_draft(
  p_workspace_id uuid,
  p_article_id uuid,
  p_title text,
  p_slug text,
  p_summary text,
  p_content text,
  p_content_blocks jsonb,
  p_tags text[],
  p_product_id uuid,
  p_module_id uuid,
  p_category_id uuid,
  p_default_language text,
  p_change_note text
) returns uuid
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_version_id uuid;
  v_title text := btrim(coalesce(p_title,''));
  v_slug text := lower(btrim(coalesce(p_slug,'')));
  v_blocks jsonb := coalesce(p_content_blocks,'[]'::jsonb);
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not private.has_workspace_permission(p_workspace_id,'create_knowledge') then raise exception 'Insufficient Knowledge create permission'; end if;
  if v_title='' then raise exception 'Knowledge title is required'; end if;
  if v_slug='' then raise exception 'Knowledge slug is required'; end if;
  if jsonb_typeof(v_blocks)<>'array' then raise exception 'Knowledge content_blocks must be an array'; end if;
  if exists(select 1 from public.knowledge_articles where id=p_article_id) then raise exception 'Knowledge article already exists'; end if;
  if exists(select 1 from public.knowledge_articles where workspace_id=p_workspace_id and lower(slug)=v_slug) then raise exception 'Ya existe un artículo con este slug en el workspace'; end if;

  insert into public.knowledge_articles(
    id,workspace_id,title,slug,summary,content,content_blocks,tags,product_id,module_id,category_id,
    status,default_language,created_by,updated_by
  ) values (
    p_article_id,p_workspace_id,v_title,v_slug,nullif(btrim(coalesce(p_summary,'')),''),coalesce(p_content,''),v_blocks,
    coalesce(p_tags,'{}'::text[]),p_product_id,p_module_id,p_category_id,'draft',
    case when lower(coalesce(p_default_language,'es'))='en' then 'en' else 'es' end,v_uid,v_uid
  );

  insert into public.knowledge_article_versions(
    article_id,workspace_id,version_number,status,change_note,title,slug,summary,content,content_blocks,tags,
    product_id,module_id,category_id,created_by,updated_by
  ) values (
    p_article_id,p_workspace_id,1,'draft',coalesce(nullif(btrim(p_change_note),''),'Versión inicial'),v_title,v_slug,
    nullif(btrim(coalesce(p_summary,'')),''),coalesce(p_content,''),v_blocks,coalesce(p_tags,'{}'::text[]),
    p_product_id,p_module_id,p_category_id,v_uid,v_uid
  ) returning id into v_version_id;

  update public.knowledge_articles set draft_version_id=v_version_id where id=p_article_id;
  return v_version_id;
end $$;
revoke all on function public.create_knowledge_initial_draft(uuid,uuid,text,text,text,text,jsonb,text[],uuid,uuid,uuid,text,text) from public,anon;
grant execute on function public.create_knowledge_initial_draft(uuid,uuid,text,text,text,text,jsonb,text[],uuid,uuid,uuid,text,text) to authenticated;

-- -----------------------------------------------------------------------------
-- 2) Vacations: return date + multiple non-contiguous blocks in one request
-- -----------------------------------------------------------------------------
alter table public.vacation_requests add column if not exists return_date date;
alter table public.vacation_requests add column if not exists date_blocks jsonb not null default '[]'::jsonb;

update public.vacation_requests
set return_date=coalesce(return_date,end_date+1),
    date_blocks=case when jsonb_typeof(date_blocks)='array' and jsonb_array_length(date_blocks)>0 then date_blocks else jsonb_build_array(jsonb_build_object(
      'id','legacy','start_date',to_char(start_date,'YYYY-MM-DD'),'end_date',to_char(end_date,'YYYY-MM-DD'),'return_date',to_char(coalesce(return_date,end_date+1),'YYYY-MM-DD')
    )) end
where return_date is null or jsonb_typeof(date_blocks)<>'array' or jsonb_array_length(date_blocks)=0;

alter table public.vacation_requests alter column return_date set not null;

do $$
declare r record;
begin
  -- v17.0 limited the bounding range to 60 days. v17.1 limits the sum of actual blocks instead.
  for r in select conname from pg_constraint where conrelid='public.vacation_requests'::regclass and contype='c' and pg_get_constraintdef(oid) ilike '%end_date%start_date%60%'
  loop execute format('alter table public.vacation_requests drop constraint %I',r.conname); end loop;
  if not exists(select 1 from pg_constraint where conname='vacation_requests_date_blocks_check') then
    alter table public.vacation_requests add constraint vacation_requests_date_blocks_check check (
      jsonb_typeof(date_blocks)='array' and jsonb_array_length(date_blocks) between 1 and 8
    );
  end if;
  if not exists(select 1 from pg_constraint where conname='vacation_requests_return_date_check') then
    alter table public.vacation_requests add constraint vacation_requests_return_date_check check (return_date>end_date);
  end if;
end $$;

create or replace function private.guard_vacation_request()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_service boolean:=coalesce(current_setting('request.jwt.claim.role',true),'')='service_role';
  v_manage boolean;
  v_block jsonb;
  v_norm jsonb:='[]'::jsonb;
  v_start date;v_end date;v_return date;
  v_min date;v_max date;v_return_max date;
  v_total int:=0;v_count int:=0;
begin
  v_manage:=v_service or private.has_workspace_permission(new.workspace_id,'manage_vacations');
  if not exists(select 1 from public.workspace_members wm where wm.workspace_id=new.workspace_id and wm.user_id=new.user_id and wm.active=true) then
    raise exception 'Vacation requester must be an active member of the workspace';
  end if;

  if new.date_blocks is null or jsonb_typeof(new.date_blocks)<>'array' or jsonb_array_length(new.date_blocks)=0 then
    new.date_blocks:=jsonb_build_array(jsonb_build_object(
      'id','legacy','start_date',to_char(new.start_date,'YYYY-MM-DD'),'end_date',to_char(new.end_date,'YYYY-MM-DD'),
      'return_date',to_char(coalesce(new.return_date,new.end_date+1),'YYYY-MM-DD')
    ));
  end if;

  for v_block in select value from jsonb_array_elements(new.date_blocks)
  loop
    v_count:=v_count+1;
    begin
      v_start:=nullif(v_block->>'start_date','')::date;
      v_end:=nullif(v_block->>'end_date','')::date;
      v_return:=coalesce(nullif(v_block->>'return_date','')::date,v_end+1);
    exception when others then raise exception 'Cada bloque de vacaciones debe contener fechas válidas'; end;
    if v_start is null or v_end is null or v_end<v_start then raise exception 'Cada bloque requiere fecha de inicio y fin válidas'; end if;
    if v_return<=v_end then raise exception 'La fecha de reincorporación debe ser posterior al fin de cada bloque'; end if;
    v_total:=v_total+(v_end-v_start+1);
    if v_min is null or v_start<v_min then v_min:=v_start; end if;
    if v_max is null or v_end>v_max then v_max:=v_end; end if;
    if v_return_max is null or v_return>v_return_max then v_return_max:=v_return; end if;
    v_norm:=v_norm||jsonb_build_array(jsonb_build_object(
      'id',coalesce(nullif(v_block->>'id',''),gen_random_uuid()::text),
      'start_date',to_char(v_start,'YYYY-MM-DD'),'end_date',to_char(v_end,'YYYY-MM-DD'),'return_date',to_char(v_return,'YYYY-MM-DD')
    ));
  end loop;
  if v_count<1 or v_count>8 then raise exception 'Una solicitud permite entre 1 y 8 bloques'; end if;
  if v_total>61 then raise exception 'La suma de los bloques no puede superar 61 días de ausencia'; end if;
  if exists(
    select 1 from jsonb_array_elements(v_norm) with ordinality a(value,idx)
    join jsonb_array_elements(v_norm) with ordinality b(value,idx) on a.idx<b.idx
    where (a.value->>'start_date')::date <= (b.value->>'end_date')::date
      and (a.value->>'end_date')::date >= (b.value->>'start_date')::date
  ) then raise exception 'Los bloques de una misma solicitud no pueden traslaparse'; end if;

  new.date_blocks:=v_norm;new.start_date:=v_min;new.end_date:=v_max;new.return_date:=v_return_max;

  if tg_op='INSERT' then
    if not v_manage then
      new.decision_by:=null;new.decision_note:=null;new.decided_at:=null;
      new.ai_risk:=null;new.ai_recommendation:=null;new.ai_summary:=null;new.ai_analysis:='{}'::jsonb;new.ai_analyzed_at:=null;
    end if;
  else
    if old.status<>'pending' and new.status is distinct from old.status then raise exception 'Only pending vacation requests can change status';end if;
    if new.date_blocks is distinct from old.date_blocks or new.user_id is distinct from old.user_id then
      new.ai_risk:=null;new.ai_recommendation:=null;new.ai_summary:=null;new.ai_analysis:='{}'::jsonb;new.ai_analyzed_at:=null;
    end if;
    if not v_manage then
      if new.workspace_id is distinct from old.workspace_id or new.user_id is distinct from old.user_id then raise exception 'Requester cannot change workspace or owner';end if;
      if new.decision_by is distinct from old.decision_by or new.decision_note is distinct from old.decision_note or new.decided_at is distinct from old.decided_at
         or new.ai_risk is distinct from old.ai_risk or new.ai_recommendation is distinct from old.ai_recommendation or new.ai_summary is distinct from old.ai_summary
         or new.ai_analysis is distinct from old.ai_analysis or new.ai_analyzed_at is distinct from old.ai_analyzed_at then
        raise exception 'Decision and AI analysis fields are restricted';
      end if;
      if new.status not in ('pending','cancelled') then raise exception 'Requester can only keep pending or cancel the request';end if;
    end if;
  end if;

  if new.status in ('pending','approved') and exists(
    select 1 from public.vacation_requests vr
    cross join lateral jsonb_array_elements(vr.date_blocks) ob
    cross join lateral jsonb_array_elements(new.date_blocks) nb
    where vr.workspace_id=new.workspace_id and vr.user_id=new.user_id and vr.id<>new.id and vr.status in ('pending','approved')
      and (ob->>'start_date')::date <= (nb->>'end_date')::date and (ob->>'end_date')::date >= (nb->>'start_date')::date
  ) then raise exception 'Ya existe una solicitud pendiente o aprobada que se cruza con alguno de estos bloques';end if;

  if new.status='approved' then
    if new.ai_analyzed_at is null or new.ai_analysis is null or new.ai_analysis='{}'::jsonb then raise exception 'Analyze sprint impact before approving vacations';end if;
    if new.ai_analyzed_at < now()-interval '12 hours' then raise exception 'Vacation impact analysis is stale; analyze again before approving';end if;
    if exists(select 1 from public.tickets t where t.workspace_id=new.workspace_id and (t.dev_owner_id=new.user_id or t.qa_owner_id=new.user_id) and t.status<>'closed' and t.updated_at>new.ai_analyzed_at) then
      raise exception 'Assigned work changed after the vacation analysis; analyze again before approving';
    end if;
    if exists(
      select 1 from public.sprints s cross join lateral jsonb_array_elements(new.date_blocks) nb
      where s.workspace_id=new.workspace_id and s.status in ('active','planned')
        and s.start_date <= (nb->>'end_date')::date and s.end_date >= (nb->>'start_date')::date and s.updated_at>new.ai_analyzed_at
    ) then raise exception 'Sprint planning changed after the vacation analysis; analyze again before approving';end if;
    if exists(
      select 1 from public.vacation_requests vr
      cross join lateral jsonb_array_elements(vr.date_blocks) ob
      cross join lateral jsonb_array_elements(new.date_blocks) nb
      where vr.workspace_id=new.workspace_id and vr.id<>new.id and vr.status='approved'
        and (ob->>'start_date')::date <= (nb->>'end_date')::date and (ob->>'end_date')::date >= (nb->>'start_date')::date
        and vr.updated_at>new.ai_analyzed_at
    ) then raise exception 'Team availability changed after the vacation analysis; analyze again before approving';end if;
  end if;

  if new.status in ('approved','rejected') then
    if not v_service then new.decision_by=(select auth.uid());elsif new.decision_by is null then new.decision_by=(select auth.uid());end if;
    new.decided_at=coalesce(new.decided_at,now());
  end if;
  return new;
end $$;
revoke all on function private.guard_vacation_request() from public,anon,authenticated;

create or replace function private.notify_vacation_request_change()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_blocks int:=coalesce(jsonb_array_length(new.date_blocks),1);
begin
  if tg_op='INSERT' then
    insert into public.notifications(workspace_id,user_id,type,title,body,category,metadata)
    select new.workspace_id,wm.user_id,'vacation_requested','Nueva solicitud de vacaciones',
      coalesce(p.full_name,'Colaborador')||' solicitó '||v_blocks||case when v_blocks=1 then ' bloque' else ' bloques' end||
      ' de ausencia ('||to_char(new.start_date,'DD/MM/YYYY')||' → '||to_char(new.end_date,'DD/MM/YYYY')||').',
      'vacations',jsonb_build_object('entity_type','vacation','entity_id',new.id,'user_id',new.user_id,'start_date',new.start_date,'end_date',new.end_date,'return_date',new.return_date,'date_blocks',new.date_blocks)
    from public.workspace_members wm left join public.profiles p on p.id=new.user_id
    where wm.workspace_id=new.workspace_id and wm.active=true and wm.user_id<>new.user_id and private.member_has_permission(new.workspace_id,wm.user_id,'manage_vacations');
  elsif new.status is distinct from old.status then
    insert into public.notifications(workspace_id,user_id,type,title,body,category,metadata)
    values(new.workspace_id,new.user_id,'vacation_status',
      case new.status when 'approved' then 'Vacaciones aprobadas' when 'rejected' then 'Solicitud de vacaciones rechazada' when 'cancelled' then 'Solicitud de vacaciones cancelada' else 'Solicitud de vacaciones actualizada' end,
      coalesce(new.decision_note,case new.status when 'approved' then 'Tu ausencia fue aprobada y ya aparece en el calendario y proyección.' when 'rejected' then 'Revisa el detalle de la decisión.' else 'El estado de tu solicitud cambió.' end),
      'vacations',jsonb_build_object('entity_type','vacation','entity_id',new.id,'status',new.status,'start_date',new.start_date,'end_date',new.end_date,'return_date',new.return_date,'date_blocks',new.date_blocks));
  end if;
  return new;
end $$;
revoke all on function private.notify_vacation_request_change() from public,anon,authenticated;

commit;


-- ============================================================================
-- Jira Interno TROBBU v17.2
-- ============================================================================
-- Jira Interno TROBBU v17.2
-- Base requerida: v17.1
-- Knowledge regression hardening, authoring blocks, semantic relevance and responsive Gantt.

begin;

-- -----------------------------------------------------------------------------
-- 1) Knowledge tables: reassert grants and the exact create/edit/version RBAC.
--    Creators may fully maintain their own initial draft; published content and
--    subsequent versions remain controlled by edit_knowledge.
-- -----------------------------------------------------------------------------
alter table public.knowledge_articles enable row level security;
alter table public.knowledge_article_versions enable row level security;
alter table public.knowledge_media enable row level security;

revoke all on public.knowledge_articles from anon;
revoke all on public.knowledge_article_versions from anon;
revoke all on public.knowledge_media from anon;
grant select,insert,update,delete on public.knowledge_articles to authenticated;
grant select,insert,update,delete on public.knowledge_article_versions to authenticated;
grant select,insert,delete on public.knowledge_media to authenticated;

drop policy if exists knowledge_articles_select on public.knowledge_articles;
create policy knowledge_articles_select on public.knowledge_articles for select to authenticated using (
  (status='published' and private.has_workspace_permission(workspace_id,'view_knowledge'))
  or private.has_workspace_permission(workspace_id,'edit_knowledge')
  or (
    status='draft' and active_version_id is null and created_by=(select auth.uid())
    and private.has_workspace_permission(workspace_id,'create_knowledge')
  )
);

drop policy if exists knowledge_articles_insert on public.knowledge_articles;
create policy knowledge_articles_insert on public.knowledge_articles for insert to authenticated with check (
  private.has_workspace_permission(workspace_id,'create_knowledge')
  and (created_by is null or created_by=(select auth.uid()))
);

drop policy if exists knowledge_articles_update on public.knowledge_articles;
create policy knowledge_articles_update on public.knowledge_articles for update to authenticated
using (
  private.has_workspace_permission(workspace_id,'edit_knowledge') or (
    private.has_workspace_permission(workspace_id,'create_knowledge')
    and created_by=(select auth.uid()) and status='draft' and active_version_id is null
  )
)
with check (
  private.has_workspace_permission(workspace_id,'edit_knowledge') or (
    private.has_workspace_permission(workspace_id,'create_knowledge')
    and created_by=(select auth.uid()) and status='draft' and active_version_id is null
  )
);

drop policy if exists knowledge_articles_delete on public.knowledge_articles;
create policy knowledge_articles_delete on public.knowledge_articles for delete to authenticated using (
  private.has_workspace_permission(workspace_id,'delete_knowledge') or (
    private.has_workspace_permission(workspace_id,'create_knowledge')
    and created_by=(select auth.uid()) and status='draft' and active_version_id is null
  )
);

drop policy if exists knowledge_versions_select on public.knowledge_article_versions;
create policy knowledge_versions_select on public.knowledge_article_versions for select to authenticated using (
  (status in ('published','archived') and private.has_workspace_permission(workspace_id,'view_knowledge'))
  or private.has_workspace_permission(workspace_id,'edit_knowledge')
  or (
    status='draft' and created_by=(select auth.uid())
    and private.has_workspace_permission(workspace_id,'create_knowledge')
  )
);

drop policy if exists knowledge_versions_insert on public.knowledge_article_versions;
create policy knowledge_versions_insert on public.knowledge_article_versions for insert to authenticated with check (
  private.has_workspace_permission(workspace_id,'create_knowledge')
  and (created_by is null or created_by=(select auth.uid()))
);

drop policy if exists knowledge_versions_update on public.knowledge_article_versions;
create policy knowledge_versions_update on public.knowledge_article_versions for update to authenticated
using (
  private.has_workspace_permission(workspace_id,'edit_knowledge') or (
    private.has_workspace_permission(workspace_id,'create_knowledge')
    and created_by=(select auth.uid()) and status='draft'
  )
)
with check (
  private.has_workspace_permission(workspace_id,'edit_knowledge') or (
    private.has_workspace_permission(workspace_id,'create_knowledge')
    and created_by=(select auth.uid()) and status='draft'
  )
);

drop policy if exists knowledge_versions_delete on public.knowledge_article_versions;
create policy knowledge_versions_delete on public.knowledge_article_versions for delete to authenticated using (
  status='draft' and (
    private.has_workspace_permission(workspace_id,'delete_knowledge') or (
      private.has_workspace_permission(workspace_id,'create_knowledge') and created_by=(select auth.uid())
    )
  )
);

-- -----------------------------------------------------------------------------
-- 2) Knowledge media rows follow the same author/edit capabilities.
-- -----------------------------------------------------------------------------
drop policy if exists knowledge_media_select on public.knowledge_media;
create policy knowledge_media_select on public.knowledge_media for select to authenticated using (
  exists (
    select 1 from public.knowledge_articles a
    where a.id=article_id and a.workspace_id=knowledge_media.workspace_id and (
      (a.status='published' and private.has_workspace_permission(a.workspace_id,'view_knowledge'))
      or private.has_workspace_permission(a.workspace_id,'edit_knowledge')
      or (
        a.status='draft' and a.active_version_id is null and a.created_by=(select auth.uid())
        and private.has_workspace_permission(a.workspace_id,'create_knowledge')
      )
    )
  )
);

drop policy if exists knowledge_media_insert on public.knowledge_media;
create policy knowledge_media_insert on public.knowledge_media for insert to authenticated with check (
  uploaded_by=(select auth.uid()) and exists (
    select 1 from public.knowledge_articles a
    where a.id=article_id and a.workspace_id=knowledge_media.workspace_id and (
      private.has_workspace_permission(a.workspace_id,'edit_knowledge') or (
        private.has_workspace_permission(a.workspace_id,'create_knowledge')
        and a.created_by=(select auth.uid()) and a.status='draft' and a.active_version_id is null
      )
    )
  )
);

drop policy if exists knowledge_media_delete on public.knowledge_media;
create policy knowledge_media_delete on public.knowledge_media for delete to authenticated using (
  private.has_workspace_permission(workspace_id,'delete_knowledge')
  or private.has_workspace_permission(workspace_id,'edit_knowledge')
  or exists (
    select 1 from public.knowledge_articles a
    where a.id=article_id and a.workspace_id=knowledge_media.workspace_id
      and private.has_workspace_permission(a.workspace_id,'create_knowledge')
      and a.created_by=(select auth.uid()) and a.status='draft' and a.active_version_id is null
  )
);

-- -----------------------------------------------------------------------------
-- 3) Storage helpers: creators must be able to read/upload/rollback media from
--    their own initial draft. This fixes the table-vs-Storage RLS mismatch.
-- -----------------------------------------------------------------------------
create or replace function private.can_view_evidence_object(p_name text)
returns boolean language plpgsql stable security definer
set search_path=public,storage,pg_temp as $$
declare v_workspace uuid;v_parent uuid;v_scope text;
begin
  v_workspace:=split_part(p_name,'/',1)::uuid;v_scope:=split_part(p_name,'/',2);v_parent:=split_part(p_name,'/',3)::uuid;
  if v_scope='tickets' then
    return exists(select 1 from public.tickets t where t.id=v_parent and t.workspace_id=v_workspace and private.has_workspace_permission(v_workspace,'view_tickets') and private.has_product_access(v_workspace,t.product_id));
  elsif v_scope='sprints' then
    return exists(select 1 from public.sprints s where s.id=v_parent and s.workspace_id=v_workspace and private.has_workspace_permission(v_workspace,'view_dashboard'));
  elsif v_scope='helpdesk' then
    return exists(select 1 from public.helpdesk_tickets h where h.id=v_parent and h.workspace_id=v_workspace and private.is_workspace_member(v_workspace) and (private.has_workspace_permission(v_workspace,'manage_helpdesk') or h.requester_user_id=(select auth.uid())));
  elsif v_scope='knowledge' then
    return exists(
      select 1 from public.knowledge_articles a
      where a.id=v_parent and a.workspace_id=v_workspace and (
        (a.status='published' and private.has_workspace_permission(v_workspace,'view_knowledge'))
        or private.has_workspace_permission(v_workspace,'edit_knowledge')
        or (
          a.status='draft' and a.active_version_id is null and a.created_by=(select auth.uid())
          and private.has_workspace_permission(v_workspace,'create_knowledge')
        )
      )
    );
  end if;
  return false;
exception when invalid_text_representation then return false;
end $$;

create or replace function private.can_upload_evidence_object(p_name text)
returns boolean language plpgsql stable security definer
set search_path=public,storage,pg_temp as $$
declare v_workspace uuid;v_parent uuid;v_scope text;
begin
  v_workspace:=split_part(p_name,'/',1)::uuid;v_scope:=split_part(p_name,'/',2);v_parent:=split_part(p_name,'/',3)::uuid;
  if v_scope='tickets' then
    return exists(select 1 from public.tickets t where t.id=v_parent and t.workspace_id=v_workspace and private.has_workspace_permission(v_workspace,'edit_tickets') and private.has_product_access(v_workspace,t.product_id));
  elsif v_scope='sprints' then
    return exists(select 1 from public.sprints s where s.id=v_parent and s.workspace_id=v_workspace and private.has_workspace_permission(v_workspace,'edit_tickets'));
  elsif v_scope='helpdesk' then
    return exists(select 1 from public.helpdesk_tickets h where h.id=v_parent and h.workspace_id=v_workspace and private.is_workspace_member(v_workspace) and (private.has_workspace_permission(v_workspace,'manage_helpdesk') or h.requester_user_id=(select auth.uid())));
  elsif v_scope='knowledge' then
    return exists(
      select 1 from public.knowledge_articles a
      where a.id=v_parent and a.workspace_id=v_workspace and (
        private.has_workspace_permission(v_workspace,'edit_knowledge') or (
          private.has_workspace_permission(v_workspace,'create_knowledge')
          and a.created_by=(select auth.uid()) and a.status='draft' and a.active_version_id is null
        )
      )
    );
  end if;
  return false;
exception when invalid_text_representation then return false;
end $$;

create or replace function private.can_manage_evidence_object(p_name text)
returns boolean language plpgsql stable security definer
set search_path=public,storage,pg_temp as $$
declare v_workspace uuid;v_parent uuid;v_scope text;
begin
  v_workspace:=split_part(p_name,'/',1)::uuid;v_scope:=split_part(p_name,'/',2);v_parent:=split_part(p_name,'/',3)::uuid;
  if v_scope='helpdesk' then return private.has_workspace_permission(v_workspace,'manage_helpdesk');
  elsif v_scope='sprints' then return private.has_workspace_permission(v_workspace,'manage_sprints');
  elsif v_scope='knowledge' then
    return private.has_workspace_permission(v_workspace,'delete_knowledge')
      or private.has_workspace_permission(v_workspace,'edit_knowledge')
      or exists(
        select 1 from public.knowledge_articles a
        where a.id=v_parent and a.workspace_id=v_workspace
          and private.has_workspace_permission(v_workspace,'create_knowledge')
          and a.created_by=(select auth.uid()) and a.status='draft' and a.active_version_id is null
      );
  end if;
  return private.has_workspace_permission(v_workspace,'delete_tickets');
exception when invalid_text_representation then return false;
end $$;

revoke all on function private.can_view_evidence_object(text) from public,anon;
revoke all on function private.can_upload_evidence_object(text) from public,anon;
revoke all on function private.can_manage_evidence_object(text) from public,anon;
grant execute on function private.can_view_evidence_object(text) to authenticated;
grant execute on function private.can_upload_evidence_object(text) to authenticated;
grant execute on function private.can_manage_evidence_object(text) to authenticated;

-- Keep the existing MIME/name restriction while refreshing Storage policies.
drop policy if exists jira_evidence_select on storage.objects;
create policy jira_evidence_select on storage.objects for select to authenticated
using(bucket_id='jira-evidence' and private.can_view_evidence_object(name));

drop policy if exists jira_evidence_insert on storage.objects;
create policy jira_evidence_insert on storage.objects for insert to authenticated
with check(
  bucket_id='jira-evidence'
  and private.can_upload_evidence_object(name)
  and private.is_allowed_jira_evidence_name(name)
);

drop policy if exists jira_evidence_delete on storage.objects;
create policy jira_evidence_delete on storage.objects for delete to authenticated
using(bucket_id='jira-evidence' and (owner=(select auth.uid()) or private.can_manage_evidence_object(name)));

-- Explicitly retain RPC execution required for later-version workflow.
revoke all on function public.create_knowledge_draft_version(uuid,text) from public,anon;
revoke all on function public.publish_knowledge_version(uuid) from public,anon;
revoke all on function public.discard_knowledge_draft_version(uuid) from public,anon;
grant execute on function public.create_knowledge_draft_version(uuid,text) to authenticated;
grant execute on function public.publish_knowledge_version(uuid) to authenticated;
grant execute on function public.discard_knowledge_draft_version(uuid) to authenticated;

commit;


-- ============================================================================
-- Jira Interno TROBBU v17.3 incremental block (included for fresh installs)
-- ============================================================================
-- Jira Interno TROBBU v17.3.1 cumulative patch (re-runnable)
-- Knowledge module stabilization + rich-text runtime fix support + luxury cover blocks.
-- Keeps the existing v17.3 upgrade filename to avoid adding more project files.

begin;

-- -----------------------------------------------------------------------------
-- 1) Categories become a first-class, validated Knowledge container.
-- -----------------------------------------------------------------------------
create or replace function private.guard_knowledge_category()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  new.name:=btrim(coalesce(new.name,''));
  if length(new.name)<2 then raise exception 'El nombre de la categoría es obligatorio'; end if;
  new.code:=lower(regexp_replace(btrim(coalesce(new.code,new.name)),'[^a-zA-Z0-9]+','-','g'));
  new.code:=trim(both '-' from new.code);
  if new.code='' then raise exception 'El código de la categoría es obligatorio'; end if;
  new.icon:=coalesce(nullif(btrim(new.icon),''),'lucide:folder');
  if new.icon !~ '^lucide:[a-z0-9-]+$' then new.icon:='lucide:folder'; end if;
  if coalesce(new.color,'') !~ '^#[0-9A-Fa-f]{6}$' then new.color:='#4D5A51'; end if;
  new.sort_order:=greatest(0,least(coalesce(new.sort_order,100),9999));
  new.updated_at:=now();
  return new;
end $$;

drop trigger if exists trg_guard_knowledge_category on public.knowledge_categories;
create trigger trg_guard_knowledge_category before insert or update on public.knowledge_categories
for each row execute function private.guard_knowledge_category();

-- Every workspace gets a General fallback before existing articles are migrated.
insert into public.knowledge_categories(workspace_id,code,name,description,icon,color,sort_order,active)
select w.id,'general','General','Información transversal sin categoría específica.','lucide:folder','#6B7280',999,true
from public.workspaces w
on conflict(workspace_id,code) do update set active=true;

update public.knowledge_articles a
set category_id=c.id
from public.knowledge_categories c
where a.category_id is null and c.workspace_id=a.workspace_id and c.code='general';

update public.knowledge_article_versions v
set category_id=coalesce(a.category_id,c.id)
from public.knowledge_articles a
left join public.knowledge_categories c on c.workspace_id=a.workspace_id and c.code='general'
where v.article_id=a.id and v.category_id is null;

alter table public.knowledge_articles alter column category_id set not null;
alter table public.knowledge_article_versions alter column category_id set not null;

-- Delete safely: reclassify all article/version history before removing a category.
create or replace function public.delete_knowledge_category(p_category_id uuid,p_replacement_id uuid default null)
returns boolean language plpgsql security invoker set search_path=public,private,pg_temp as $$
declare
  v_cat public.knowledge_categories%rowtype;
  v_replacement uuid:=p_replacement_id;
  v_used boolean;
begin
  select * into v_cat from public.knowledge_categories where id=p_category_id;
  if not found then raise exception 'Categoría no encontrada'; end if;
  if v_cat.code='general' then raise exception 'La categoría General es un contenedor de sistema y no puede eliminarse'; end if;
  if not private.has_workspace_permission(v_cat.workspace_id,'delete_knowledge') then raise exception 'No tienes permiso para eliminar categorías de Knowledge'; end if;
  select exists(select 1 from public.knowledge_articles where workspace_id=v_cat.workspace_id and category_id=v_cat.id) into v_used;
  if v_used and not private.has_workspace_permission(v_cat.workspace_id,'edit_knowledge') then
    raise exception 'Eliminar una categoría con artículos también requiere permiso Editar/Publicar Knowledge para reclasificar su contenido';
  end if;
  if v_used then
    if v_replacement is null then
      select id into v_replacement from public.knowledge_categories where workspace_id=v_cat.workspace_id and code='general' and id<>v_cat.id limit 1;
    end if;
    if v_replacement is null or v_replacement=v_cat.id or not exists(select 1 from public.knowledge_categories where id=v_replacement and workspace_id=v_cat.workspace_id and active=true) then
      raise exception 'Selecciona una categoría destino válida para los artículos existentes';
    end if;
    update public.knowledge_articles set category_id=v_replacement where workspace_id=v_cat.workspace_id and category_id=v_cat.id;
    update public.knowledge_article_versions set category_id=v_replacement where workspace_id=v_cat.workspace_id and category_id=v_cat.id;
  end if;
  delete from public.knowledge_categories where id=v_cat.id;
  return true;
end $$;
revoke all on function public.delete_knowledge_category(uuid,uuid) from public,anon;
grant execute on function public.delete_knowledge_category(uuid,uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 2) Canonical block schema v3 + migration of existing articles/versions.
-- -----------------------------------------------------------------------------
alter table public.knowledge_articles add column if not exists content_schema_version smallint not null default 3;
alter table public.knowledge_article_versions add column if not exists content_schema_version smallint not null default 3;

create or replace function private.knowledge_escape_html(p_value text)
returns text language sql immutable security invoker set search_path=public,pg_temp as $$
  select replace(replace(replace(replace(coalesce(p_value,''),'&','&amp;'),'<','&lt;'),'>','&gt;'),E'\n','<br>')
$$;

create or replace function private.normalize_knowledge_blocks_v3(p_blocks jsonb,p_content text)
returns jsonb language plpgsql volatile security invoker set search_path=public,private,pg_temp as $$
declare
  v_blocks jsonb:=case when jsonb_typeof(p_blocks)='array' then p_blocks else '[]'::jsonb end;
  v_out jsonb:='[]'::jsonb;
  v_item jsonb;
  v_type text;
  v_id text;
  v_html text;
  v_line text;
begin
  if jsonb_array_length(v_blocks)=0 then
    if btrim(coalesce(p_content,''))='' then
      return jsonb_build_array(jsonb_build_object('id',gen_random_uuid()::text,'type','richtext','html','<p></p>','line_height','1.5'));
    end if;
    return jsonb_build_array(jsonb_build_object('id',gen_random_uuid()::text,'type','richtext','html','<p>'||private.knowledge_escape_html(p_content)||'</p>','line_height','1.5'));
  end if;

  for v_item in select value from jsonb_array_elements(v_blocks)
  loop
    v_type:=lower(coalesce(v_item->>'type','richtext'));
    v_id:=coalesce(nullif(v_item->>'id',''),gen_random_uuid()::text);
    if v_type in ('paragraph','text') then
      v_html:=coalesce(nullif(v_item->>'html',''),'<p>'||private.knowledge_escape_html(v_item->>'text')||'</p>');
      v_out:=v_out||jsonb_build_array(jsonb_build_object('id',v_id,'type','richtext','html',v_html,'line_height',coalesce(nullif(v_item->>'line_height',''),'1.5')));
    elsif v_type='richtext' then
      v_out:=v_out||jsonb_build_array(jsonb_build_object('id',v_id,'type','richtext','html',coalesce(v_item->>'html','<p></p>'),'line_height',coalesce(nullif(v_item->>'line_height',''),'1.5')));
    elsif v_type='heading' then
      v_out:=v_out||jsonb_build_array(jsonb_build_object('id',v_id,'type','heading2','text',coalesce(v_item->>'text','')));
    elsif v_type in ('heading1','heading2','heading3','heading4','heading5') then
      v_out:=v_out||jsonb_build_array(jsonb_build_object('id',v_id,'type',v_type,'text',coalesce(v_item->>'text','')));
    elsif v_type='list' then
      v_out:=v_out||jsonb_build_array(jsonb_build_object('id',v_id,'type','list','text',coalesce(v_item->>'text',''),'list_style',case when v_item->>'list_style'='ordered' then 'ordered' else 'unordered' end));
    elsif v_type='quote' then
      v_out:=v_out||jsonb_build_array(jsonb_build_object('id',v_id,'type','quote','text',coalesce(v_item->>'text',''),'author',coalesce(v_item->>'author','')));
    elsif v_type='callout' then
      v_out:=v_out||jsonb_build_array(jsonb_build_object('id',v_id,'type','callout','text',coalesce(v_item->>'text',''),'title',coalesce(v_item->>'title',''),'tone',case when v_item->>'tone' in ('info','success','warning','danger') then v_item->>'tone' else 'info' end));
    elsif v_type='code' then
      v_out:=v_out||jsonb_build_array(jsonb_build_object('id',v_id,'type','code','text',coalesce(v_item->>'text',''),'language',coalesce(nullif(v_item->>'language',''),'text')));
    elsif v_type='image' then
      v_out:=v_out||jsonb_build_array(jsonb_build_object('id',v_id,'type','image','media_id',v_item->'media_id','alt',coalesce(v_item->>'alt',''),'caption',coalesce(v_item->>'caption',''),'align',case when v_item->>'align' in ('left','center','right','wide') then v_item->>'align' else 'center' end));
    elsif v_type='video' then
      v_out:=v_out||jsonb_build_array(jsonb_build_object('id',v_id,'type','video','url',coalesce(v_item->>'url',''),'caption',coalesce(v_item->>'caption','')));
    elsif v_type='cover' then
      v_out:=v_out||jsonb_build_array(jsonb_build_object(
        'id',v_id,'type','cover',
        'template',case when v_item->>'template' in ('forest','ivory','midnight') then v_item->>'template' else 'forest' end,
        'eyebrow',left(coalesce(nullif(v_item->>'eyebrow',''),'TROBBU · KNOWLEDGE'),80),
        'title',left(coalesce(v_item->>'title',''),180),
        'subtitle',left(coalesce(v_item->>'subtitle',''),360),
        'meta',left(coalesce(nullif(v_item->>'meta',''),'Documento interno'),140),
        'show_logo',case when lower(coalesce(v_item->>'show_logo','true'))='false' then false else true end,
        'page_break',case when lower(coalesce(v_item->>'page_break','true'))='false' then false else true end
      ));
    elsif v_type in ('divider','pagebreak') then
      v_out:=v_out||jsonb_build_array(jsonb_build_object('id',v_id,'type',v_type));
    else
      v_out:=v_out||jsonb_build_array(jsonb_build_object('id',v_id,'type','richtext','html','<p>'||private.knowledge_escape_html(coalesce(v_item->>'text',v_item::text))||'</p>','line_height','1.5'));
    end if;
  end loop;
  return v_out;
end $$;
revoke all on function private.knowledge_escape_html(text) from public,anon;
revoke all on function private.normalize_knowledge_blocks_v3(jsonb,text) from public,anon;
-- The public SECURITY INVOKER authoring RPCs execute as the authenticated user.
-- These helpers are pure transformations (no privileged table access), so the
-- caller needs EXECUTE on them or article creation would fail at runtime.
grant execute on function private.knowledge_escape_html(text) to authenticated;
grant execute on function private.normalize_knowledge_blocks_v3(jsonb,text) to authenticated;

update public.knowledge_articles
set content_blocks=private.normalize_knowledge_blocks_v3(content_blocks,content),content_schema_version=3;
update public.knowledge_article_versions
set content_blocks=private.normalize_knowledge_blocks_v3(content_blocks,content),content_schema_version=3;

-- -----------------------------------------------------------------------------
-- 3) Atomic initial draft + guarded draft update.
-- -----------------------------------------------------------------------------
create or replace function public.create_knowledge_initial_draft(
  p_workspace_id uuid,p_article_id uuid,p_title text,p_slug text,p_summary text,p_content text,p_content_blocks jsonb,
  p_tags text[],p_product_id uuid,p_module_id uuid,p_category_id uuid,p_default_language text,p_change_note text
) returns uuid language plpgsql security invoker set search_path=public,private,pg_temp as $$
declare
  v_uid uuid:=(select auth.uid());
  v_version_id uuid;
  v_title text:=btrim(coalesce(p_title,''));
  v_slug text:=lower(btrim(coalesce(p_slug,'')));
  v_blocks jsonb:=private.normalize_knowledge_blocks_v3(p_content_blocks,p_content);
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not private.has_workspace_permission(p_workspace_id,'create_knowledge') then raise exception 'Insufficient Knowledge create permission'; end if;
  if v_title='' then raise exception 'El título es obligatorio'; end if;
  if v_slug='' then raise exception 'El slug es obligatorio'; end if;
  if p_category_id is null or not exists(select 1 from public.knowledge_categories where id=p_category_id and workspace_id=p_workspace_id and active=true) then raise exception 'Selecciona una categoría válida'; end if;
  if exists(select 1 from public.knowledge_articles where id=p_article_id) then raise exception 'Knowledge article already exists'; end if;
  if exists(select 1 from public.knowledge_articles where workspace_id=p_workspace_id and lower(slug)=v_slug) then raise exception 'Ya existe un artículo con este slug en el workspace'; end if;

  insert into public.knowledge_articles(id,workspace_id,title,slug,summary,content,content_blocks,content_schema_version,tags,product_id,module_id,category_id,status,default_language,created_by,updated_by)
  values(p_article_id,p_workspace_id,v_title,v_slug,nullif(btrim(coalesce(p_summary,'')),''),coalesce(p_content,''),v_blocks,3,coalesce(p_tags,'{}'::text[]),p_product_id,p_module_id,p_category_id,'draft',case when lower(coalesce(p_default_language,'es'))='en' then 'en' else 'es' end,v_uid,v_uid);

  insert into public.knowledge_article_versions(article_id,workspace_id,version_number,status,change_note,title,slug,summary,content,content_blocks,content_schema_version,tags,product_id,module_id,category_id,created_by,updated_by)
  values(p_article_id,p_workspace_id,1,'draft',coalesce(nullif(btrim(p_change_note),''),'Versión inicial'),v_title,v_slug,nullif(btrim(coalesce(p_summary,'')),''),coalesce(p_content,''),v_blocks,3,coalesce(p_tags,'{}'::text[]),p_product_id,p_module_id,p_category_id,v_uid,v_uid)
  returning id into v_version_id;
  update public.knowledge_articles set draft_version_id=v_version_id where id=p_article_id;
  return v_version_id;
end $$;
revoke all on function public.create_knowledge_initial_draft(uuid,uuid,text,text,text,text,jsonb,text[],uuid,uuid,uuid,text,text) from public,anon;
grant execute on function public.create_knowledge_initial_draft(uuid,uuid,text,text,text,text,jsonb,text[],uuid,uuid,uuid,text,text) to authenticated;

create or replace function public.update_knowledge_draft_version(
  p_version_id uuid,p_title text,p_slug text,p_summary text,p_content text,p_content_blocks jsonb,p_tags text[],p_product_id uuid,p_module_id uuid,p_category_id uuid
) returns public.knowledge_article_versions
language plpgsql security invoker set search_path=public,private,pg_temp as $$
declare
  v public.knowledge_article_versions%rowtype;
  a public.knowledge_articles%rowtype;
  v_blocks jsonb:=private.normalize_knowledge_blocks_v3(p_content_blocks,p_content);
begin
  select * into v from public.knowledge_article_versions where id=p_version_id and status='draft';
  if not found then raise exception 'Borrador de Knowledge no encontrado'; end if;
  select * into a from public.knowledge_articles where id=v.article_id;
  if not found then raise exception 'Artículo de Knowledge no encontrado'; end if;
  if not (private.has_workspace_permission(v.workspace_id,'edit_knowledge') or (private.has_workspace_permission(v.workspace_id,'create_knowledge') and a.created_by=(select auth.uid()) and a.active_version_id is null)) then
    raise exception 'No tienes permiso para editar este borrador';
  end if;
  if p_category_id is null or not exists(select 1 from public.knowledge_categories where id=p_category_id and workspace_id=v.workspace_id and active=true) then raise exception 'Selecciona una categoría válida'; end if;

  update public.knowledge_article_versions set
    title=btrim(p_title),slug=lower(btrim(p_slug)),summary=nullif(btrim(coalesce(p_summary,'')),''),content=coalesce(p_content,''),content_blocks=v_blocks,content_schema_version=3,
    tags=coalesce(p_tags,'{}'::text[]),product_id=p_product_id,module_id=p_module_id,category_id=p_category_id,updated_by=(select auth.uid()),updated_at=now()
  where id=v.id returning * into v;

  if a.active_version_id is null then
    update public.knowledge_articles set title=v.title,slug=v.slug,summary=v.summary,content=v.content,content_blocks=v.content_blocks,content_schema_version=3,tags=v.tags,product_id=v.product_id,module_id=v.module_id,category_id=v.category_id,draft_version_id=v.id,updated_by=(select auth.uid()),updated_at=now() where id=a.id;
  else
    update public.knowledge_articles set draft_version_id=v.id,updated_by=(select auth.uid()),updated_at=now() where id=a.id;
  end if;
  return v;
end $$;
revoke all on function public.update_knowledge_draft_version(uuid,text,text,text,text,jsonb,text[],uuid,uuid,uuid) from public,anon;
grant execute on function public.update_knowledge_draft_version(uuid,text,text,text,text,jsonb,text[],uuid,uuid,uuid) to authenticated;


-- Keep the article shadow row on the same block schema when a version is
-- published/restored. Older publish functions predate content_schema_version.
create or replace function public.publish_knowledge_version(p_version_id uuid)
returns jsonb language plpgsql security invoker set search_path=public,private,pg_temp as $$
declare v public.knowledge_article_versions%rowtype;a public.knowledge_articles%rowtype;old_id uuid;
begin
  select * into v from public.knowledge_article_versions where id=p_version_id;if not found then raise exception 'Knowledge version not found';end if;
  select * into a from public.knowledge_articles where id=v.article_id;
  if not private.has_workspace_permission(v.workspace_id,'edit_knowledge') then raise exception 'Insufficient Knowledge permissions';end if;
  perform set_config('app.knowledge_publish','on',true);old_id:=a.active_version_id;
  if old_id is not null and old_id<>v.id then update public.knowledge_article_versions set status='archived' where id=old_id;end if;
  update public.knowledge_article_versions set status='published',published_by=(select auth.uid()),published_at=now() where id=v.id;
  update public.knowledge_articles set title=v.title,slug=v.slug,summary=v.summary,content=v.content,content_blocks=v.content_blocks,content_schema_version=v.content_schema_version,tags=v.tags,product_id=v.product_id,module_id=v.module_id,category_id=v.category_id,status='published',active_version_id=v.id,draft_version_id=case when draft_version_id=v.id then null else draft_version_id end,updated_by=(select auth.uid()),updated_at=now() where id=v.article_id;
  return jsonb_build_object('article_id',v.article_id,'version_id',v.id,'version_number',v.version_number);
end $$;
revoke all on function public.publish_knowledge_version(uuid) from public,anon;
grant execute on function public.publish_knowledge_version(uuid) to authenticated;

commit;
-- TROBBU Jira Interno v17.5
-- Knowledge native rich-text stabilization + configurable executive cover templates.
-- Baseline: v17.3.1 Final Completo. Re-runnable.

begin;

alter table public.workspace_settings
  add column if not exists knowledge_cover_templates jsonb not null default
  '{"forest":{"background":"#0C2B2A","background_alt":"#4D5A51","text":"#F8F2E8","accent":"#D1AA87","border":"#354A40","title_font":"Inter","body_font":"Inter"},"ivory":{"background":"#FFFDF9","background_alt":"#F1E4CD","text":"#26362F","accent":"#8A6345","border":"#E7D9C4","title_font":"Georgia","body_font":"Inter"},"midnight":{"background":"#07172E","background_alt":"#02488D","text":"#F7FAFF","accent":"#D1AA87","border":"#0B315A","title_font":"Inter","body_font":"Inter"}}'::jsonb;

-- Preserve custom values while filling every missing template/property.
with defaults as (
  select '{"forest":{"background":"#0C2B2A","background_alt":"#4D5A51","text":"#F8F2E8","accent":"#D1AA87","border":"#354A40","title_font":"Inter","body_font":"Inter"},"ivory":{"background":"#FFFDF9","background_alt":"#F1E4CD","text":"#26362F","accent":"#8A6345","border":"#E7D9C4","title_font":"Georgia","body_font":"Inter"},"midnight":{"background":"#07172E","background_alt":"#02488D","text":"#F7FAFF","accent":"#D1AA87","border":"#0B315A","title_font":"Inter","body_font":"Inter"}}'::jsonb as v
)
update public.workspace_settings ws
set knowledge_cover_templates=jsonb_build_object(
  'forest',(select v->'forest' from defaults)||coalesce(ws.knowledge_cover_templates->'forest','{}'::jsonb),
  'ivory',(select v->'ivory' from defaults)||coalesce(ws.knowledge_cover_templates->'ivory','{}'::jsonb),
  'midnight',(select v->'midnight' from defaults)||coalesce(ws.knowledge_cover_templates->'midnight','{}'::jsonb)
);

-- Re-normalize every existing article/version through the canonical v3 block
-- converter. This preserves legacy paragraph/text/heading/media blocks and
-- guarantees the v17.5 editor receives a supported shape without data loss.
update public.knowledge_articles
set content_blocks=private.normalize_knowledge_blocks_v3(content_blocks,content),
    content_schema_version=3;

update public.knowledge_article_versions
set content_blocks=private.normalize_knowledge_blocks_v3(content_blocks,content),
    content_schema_version=3;

comment on column public.workspace_settings.knowledge_cover_templates is
  'Workspace-level visual parameters for Knowledge executive cover templates.';

commit;

-- ============================================================================
-- TROBBU Jira Interno v17.5.2 · Vacations balance/types + v17.5.1 schema repair
-- This block is intentionally re-runnable and self-contained from v17.5.1.
-- ============================================================================

begin;

-- Workspace default used when a collaborator has no explicit annual balance row.
alter table public.workspace_settings
  add column if not exists vacation_default_annual_days numeric(6,2) not null default 12;

do $$ begin
  if not exists(select 1 from pg_constraint where conname='workspace_settings_vacation_default_days_check') then
    alter table public.workspace_settings add constraint workspace_settings_vacation_default_days_check
      check(vacation_default_annual_days>=0 and vacation_default_annual_days<=365);
  end if;
end $$;

-- Canonical vacation types. Every request belongs to one type; the type decides
-- whether it consumes the annual balance and whether it represents half days.
create table if not exists public.vacation_types(
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  deducts_from_balance boolean not null default true,
  day_fraction numeric(3,2) not null default 1,
  requires_half_day_period boolean not null default false,
  color text not null default '#0C66E4',
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,code),
  check(day_fraction in (0.50,1.00)),
  check(length(trim(code)) between 1 and 60),
  check(length(trim(name)) between 1 and 120)
);
alter table public.vacation_types enable row level security;
revoke all on public.vacation_types from anon;
grant select,insert,update,delete on public.vacation_types to authenticated;
drop policy if exists vacation_types_select on public.vacation_types;
create policy vacation_types_select on public.vacation_types for select to authenticated
using(private.is_workspace_member(workspace_id) and (
  private.has_workspace_permission(workspace_id,'view_vacations') or
  private.has_workspace_permission(workspace_id,'request_vacations') or
  private.has_workspace_permission(workspace_id,'manage_vacations')
));
drop policy if exists vacation_types_insert on public.vacation_types;
create policy vacation_types_insert on public.vacation_types for insert to authenticated
with check(private.has_workspace_permission(workspace_id,'manage_vacations'));
drop policy if exists vacation_types_update on public.vacation_types;
create policy vacation_types_update on public.vacation_types for update to authenticated
using(private.has_workspace_permission(workspace_id,'manage_vacations'))
with check(private.has_workspace_permission(workspace_id,'manage_vacations'));
drop policy if exists vacation_types_delete on public.vacation_types;
create policy vacation_types_delete on public.vacation_types for delete to authenticated
using(private.has_workspace_permission(workspace_id,'manage_vacations'));
drop trigger if exists trg_vacation_types_updated on public.vacation_types;
create trigger trg_vacation_types_updated before update on public.vacation_types
for each row execute function public.set_updated_at();

insert into public.vacation_types(workspace_id,code,name,description,deducts_from_balance,day_fraction,requires_half_day_period,color,sort_order,active)
select w.id,x.code,x.name,x.description,x.deducts,x.fraction,x.half_period,x.color,x.sort_order,true
from public.workspaces w
cross join (values
  ('vacation','Vacaciones','Vacaciones regulares que descuentan del saldo anual.',true,1.00::numeric,false,'#0C66E4',10),
  ('compensation','Compensación','Días compensatorios registrados sin descontar del saldo anual.',false,1.00::numeric,false,'#6554C0',20),
  ('half_day','Medio día','Ausencia de media jornada; requiere definir primera o segunda mitad.',true,0.50::numeric,true,'#CA6B2D',30),
  ('sickness','Enfermedad','Ausencia por enfermedad; por defecto no descuenta del saldo anual.',false,1.00::numeric,false,'#AE2E24',40)
) as x(code,name,description,deducts,fraction,half_period,color,sort_order)
on conflict(workspace_id,code) do nothing;

-- Per-member annual allowance and manual used-days adjustment. System usage is
-- intentionally calculated from requests, never manually duplicated here.
create table if not exists public.vacation_balances(
  workspace_id uuid not null,
  user_id uuid not null,
  year integer not null,
  allowed_days numeric(6,2) not null default 12,
  adjustment_used_days numeric(6,2) not null default 0,
  note text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(workspace_id,user_id,year),
  foreign key(workspace_id,user_id) references public.workspace_members(workspace_id,user_id) on delete cascade,
  check(year between 2000 and 2200),
  check(allowed_days>=0 and allowed_days<=365),
  check(adjustment_used_days>=0 and adjustment_used_days<=365)
);
alter table public.vacation_balances enable row level security;
revoke all on public.vacation_balances from anon;
grant select,insert,update,delete on public.vacation_balances to authenticated;
drop policy if exists vacation_balances_select on public.vacation_balances;
create policy vacation_balances_select on public.vacation_balances for select to authenticated
using(private.is_workspace_member(workspace_id) and (
  user_id=(select auth.uid()) or private.has_workspace_permission(workspace_id,'manage_vacations')
));
drop policy if exists vacation_balances_insert on public.vacation_balances;
create policy vacation_balances_insert on public.vacation_balances for insert to authenticated
with check(private.has_workspace_permission(workspace_id,'manage_vacations'));
drop policy if exists vacation_balances_update on public.vacation_balances;
create policy vacation_balances_update on public.vacation_balances for update to authenticated
using(private.has_workspace_permission(workspace_id,'manage_vacations'))
with check(private.has_workspace_permission(workspace_id,'manage_vacations'));
drop policy if exists vacation_balances_delete on public.vacation_balances;
create policy vacation_balances_delete on public.vacation_balances for delete to authenticated
using(private.has_workspace_permission(workspace_id,'manage_vacations'));
drop trigger if exists trg_vacation_balances_updated on public.vacation_balances;
create trigger trg_vacation_balances_updated before update on public.vacation_balances
for each row execute function public.set_updated_at();

-- Repair the exact v17.5.1 production mismatch: these columns may not exist if
-- v17.1 was never applied even though the v17.5.1 frontend already uses them.
alter table public.vacation_requests add column if not exists return_date date;
alter table public.vacation_requests add column if not exists date_blocks jsonb not null default '[]'::jsonb;
alter table public.vacation_requests add column if not exists decision_by uuid references auth.users(id) on delete set null;
alter table public.vacation_requests add column if not exists ai_risk text;
alter table public.vacation_requests add column if not exists ai_recommendation text;
alter table public.vacation_requests add column if not exists ai_summary text;
alter table public.vacation_requests add column if not exists ai_analysis jsonb not null default '{}'::jsonb;
alter table public.vacation_requests add column if not exists ai_analyzed_at timestamptz;
alter table public.vacation_requests add column if not exists vacation_type_id uuid;
alter table public.vacation_requests add column if not exists half_day_period text;
alter table public.vacation_requests add column if not exists absence_days numeric(7,2) not null default 0;
alter table public.vacation_requests add column if not exists charged_days numeric(7,2) not null default 0;

-- Temporarily remove the legacy vacation guard while historical rows are normalized.
-- The old v17.5.1 trigger can otherwise reject maintenance updates on finalized requests.
drop trigger if exists trg_guard_vacation_request on public.vacation_requests;

-- Preserve compatible legacy decision / assistant data when present.
do $$
begin
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='vacation_requests' and column_name='decided_by') then
    execute 'update public.vacation_requests set decision_by=coalesce(decision_by,decided_by) where decision_by is null';
  end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='vacation_requests' and column_name='analyzed_at') then
    execute 'update public.vacation_requests set ai_analyzed_at=coalesce(ai_analyzed_at,analyzed_at) where ai_analyzed_at is null';
  end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='vacation_requests' and column_name='assistant_analysis') then
    execute $q$update public.vacation_requests set ai_summary=coalesce(ai_summary,nullif(assistant_analysis,'')), ai_analysis=case when ai_analysis='{}'::jsonb and nullif(assistant_analysis,'') is not null then jsonb_build_object('legacy_analysis',assistant_analysis) else ai_analysis end$q$;
  end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='vacation_requests' and column_name='assistant_recommendation') then
    execute $q$update public.vacation_requests set ai_recommendation=coalesce(ai_recommendation,case lower(coalesce(assistant_recommendation,'')) when 'approve' then 'approve' when 'approve_with_conditions' then 'approve_with_conditions' when 'review' then 'review' when 'decline' then 'decline' else null end)$q$;
  end if;
end $$;

update public.vacation_requests
set return_date=coalesce(return_date,end_date+1),
    date_blocks=case when jsonb_typeof(date_blocks)='array' and jsonb_array_length(date_blocks)>0 then date_blocks else jsonb_build_array(jsonb_build_object(
      'id','legacy','start_date',to_char(start_date,'YYYY-MM-DD'),'end_date',to_char(end_date,'YYYY-MM-DD'),'return_date',to_char(coalesce(return_date,end_date+1),'YYYY-MM-DD')
    )) end
where return_date is null or jsonb_typeof(date_blocks)<>'array' or jsonb_array_length(date_blocks)=0;

update public.vacation_requests vr
set vacation_type_id=vt.id
from public.vacation_types vt
where vr.vacation_type_id is null and vt.workspace_id=vr.workspace_id and vt.code='vacation';

alter table public.vacation_requests alter column return_date set not null;
alter table public.vacation_requests alter column vacation_type_id set not null;

do $$
declare r record;
begin
  for r in select conname from pg_constraint where conrelid='public.vacation_requests'::regclass and contype='c' and pg_get_constraintdef(oid) ilike '%end_date%start_date%60%'
  loop execute format('alter table public.vacation_requests drop constraint %I',r.conname); end loop;
  if not exists(select 1 from pg_constraint where conname='vacation_requests_date_blocks_check') then
    alter table public.vacation_requests add constraint vacation_requests_date_blocks_check check(jsonb_typeof(date_blocks)='array' and jsonb_array_length(date_blocks) between 1 and 8);
  end if;
  if not exists(select 1 from pg_constraint where conname='vacation_requests_return_date_check') then
    alter table public.vacation_requests add constraint vacation_requests_return_date_check check(return_date>end_date);
  end if;
  if not exists(select 1 from pg_constraint where conname='vacation_requests_half_day_period_check') then
    alter table public.vacation_requests add constraint vacation_requests_half_day_period_check check(half_day_period is null or half_day_period in ('first_half','second_half'));
  end if;
  if not exists(select 1 from pg_constraint where conname='vacation_requests_vacation_type_fk') then
    alter table public.vacation_requests add constraint vacation_requests_vacation_type_fk foreign key(vacation_type_id) references public.vacation_types(id) on delete restrict;
  end if;
end $$;

create index if not exists idx_vacation_type_workspace on public.vacation_types(workspace_id,active,sort_order);
create index if not exists idx_vacation_balance_workspace_year on public.vacation_balances(workspace_id,year,user_id);
create index if not exists idx_vacation_request_type on public.vacation_requests(workspace_id,vacation_type_id,status);

create or replace function private.vacation_units_for_year(p_blocks jsonb,p_fraction numeric,p_year integer)
returns numeric language plpgsql immutable security invoker set search_path=public,pg_temp as $$
declare b jsonb;s date;e date;ys date:=make_date(p_year,1,1);ye date:=make_date(p_year,12,31);a date;z date;total numeric:=0;
begin
  if jsonb_typeof(p_blocks)<>'array' then return 0; end if;
  for b in select value from jsonb_array_elements(p_blocks) loop
    begin s=(b->>'start_date')::date;e=(b->>'end_date')::date;exception when others then continue;end;
    a=greatest(s,ys);z=least(e,ye);
    if z>=a then total=total+((z-a)+1)*coalesce(p_fraction,1); end if;
  end loop;
  return total;
end $$;
revoke all on function private.vacation_units_for_year(jsonb,numeric,integer) from public,anon,authenticated;

create or replace function private.guard_vacation_request()
returns trigger language plpgsql security definer set search_path=public,private,pg_temp as $$
declare
  v_service boolean:=coalesce(current_setting('request.jwt.claim.role',true),'')='service_role';
  v_manage boolean;
  v_type public.vacation_types%rowtype;
  v_block jsonb;v_norm jsonb:='[]'::jsonb;
  v_start date;v_end date;v_return date;v_min date;v_max date;v_return_max date;
  v_calendar_days int:=0;v_count int:=0;v_year int;v_requested numeric;v_existing numeric;v_allowed numeric;v_adjustment numeric;
begin
  v_manage:=v_service or private.has_workspace_permission(new.workspace_id,'manage_vacations');
  if not exists(select 1 from public.workspace_members wm where wm.workspace_id=new.workspace_id and wm.user_id=new.user_id and wm.active=true) then
    raise exception 'Vacation requester must be an active member of the workspace';
  end if;

  if new.vacation_type_id is null then
    select * into v_type from public.vacation_types where workspace_id=new.workspace_id and code='vacation' and active=true limit 1;
    new.vacation_type_id:=v_type.id;
  else
    select * into v_type from public.vacation_types where id=new.vacation_type_id and workspace_id=new.workspace_id;
  end if;
  if v_type.id is null then raise exception 'Selecciona un tipo de ausencia válido'; end if;
  if tg_op='INSERT' and not v_type.active then raise exception 'El tipo de ausencia seleccionado está desactivado'; end if;
  if tg_op='UPDATE' and new.vacation_type_id is distinct from old.vacation_type_id and not v_type.active then raise exception 'El tipo de ausencia seleccionado está desactivado'; end if;

  if new.date_blocks is null or jsonb_typeof(new.date_blocks)<>'array' or jsonb_array_length(new.date_blocks)=0 then
    new.date_blocks:=jsonb_build_array(jsonb_build_object('id','legacy','start_date',to_char(new.start_date,'YYYY-MM-DD'),'end_date',to_char(new.end_date,'YYYY-MM-DD'),'return_date',to_char(coalesce(new.return_date,new.end_date+1),'YYYY-MM-DD')));
  end if;

  for v_block in select value from jsonb_array_elements(new.date_blocks) loop
    v_count:=v_count+1;
    begin
      v_start:=nullif(v_block->>'start_date','')::date;v_end:=nullif(v_block->>'end_date','')::date;v_return:=coalesce(nullif(v_block->>'return_date','')::date,v_end+1);
    exception when others then raise exception 'Cada bloque debe contener fechas válidas';end;
    if v_start is null or v_end is null or v_end<v_start then raise exception 'Cada bloque requiere fecha de inicio y fin válidas';end if;
    if v_return<=v_end then raise exception 'La fecha de reincorporación debe ser posterior al fin de cada bloque';end if;
    if v_type.day_fraction=0.50 and v_end<>v_start then raise exception 'El tipo Medio día requiere bloques de un solo día';end if;
    v_calendar_days:=v_calendar_days+(v_end-v_start+1);
    if v_min is null or v_start<v_min then v_min:=v_start;end if;if v_max is null or v_end>v_max then v_max:=v_end;end if;if v_return_max is null or v_return>v_return_max then v_return_max:=v_return;end if;
    v_norm:=v_norm||jsonb_build_array(jsonb_build_object('id',coalesce(nullif(v_block->>'id',''),gen_random_uuid()::text),'start_date',to_char(v_start,'YYYY-MM-DD'),'end_date',to_char(v_end,'YYYY-MM-DD'),'return_date',to_char(v_return,'YYYY-MM-DD')));
  end loop;
  if v_count<1 or v_count>8 then raise exception 'Una solicitud permite entre 1 y 8 bloques';end if;
  if v_calendar_days>61 then raise exception 'La suma de los bloques no puede superar 61 días';end if;
  if exists(select 1 from jsonb_array_elements(v_norm) with ordinality a(value,idx) join jsonb_array_elements(v_norm) with ordinality b(value,idx) on a.idx<b.idx where (a.value->>'start_date')::date<=(b.value->>'end_date')::date and (a.value->>'end_date')::date>=(b.value->>'start_date')::date) then
    raise exception 'Los bloques de una misma solicitud no pueden traslaparse';
  end if;

  new.date_blocks:=v_norm;new.start_date:=v_min;new.end_date:=v_max;new.return_date:=v_return_max;
  if v_type.requires_half_day_period or v_type.day_fraction=0.50 then
    if new.half_day_period not in ('first_half','second_half') then raise exception 'Selecciona primera o segunda mitad del día';end if;
  else new.half_day_period:=null;end if;
  new.absence_days:=v_calendar_days*v_type.day_fraction;
  new.charged_days:=case when v_type.deducts_from_balance then new.absence_days else 0 end;

  if tg_op='INSERT' then
    if not v_manage then new.decision_by:=null;new.decision_note:=null;new.decided_at:=null;new.ai_risk:=null;new.ai_recommendation:=null;new.ai_summary:=null;new.ai_analysis:='{}'::jsonb;new.ai_analyzed_at:=null;end if;
  else
    if old.status<>'pending' and new.status is distinct from old.status then raise exception 'Only pending vacation requests can change status';end if;
    if new.date_blocks is distinct from old.date_blocks or new.user_id is distinct from old.user_id or new.vacation_type_id is distinct from old.vacation_type_id or new.half_day_period is distinct from old.half_day_period then
      new.ai_risk:=null;new.ai_recommendation:=null;new.ai_summary:=null;new.ai_analysis:='{}'::jsonb;new.ai_analyzed_at:=null;
    end if;
    if not v_manage then
      if new.workspace_id is distinct from old.workspace_id or new.user_id is distinct from old.user_id then raise exception 'Requester cannot change workspace or owner';end if;
      if new.decision_by is distinct from old.decision_by or new.decision_note is distinct from old.decision_note or new.decided_at is distinct from old.decided_at or new.ai_risk is distinct from old.ai_risk or new.ai_recommendation is distinct from old.ai_recommendation or new.ai_summary is distinct from old.ai_summary or new.ai_analysis is distinct from old.ai_analysis or new.ai_analyzed_at is distinct from old.ai_analyzed_at then raise exception 'Decision and AI analysis fields are restricted';end if;
      if new.status not in ('pending','cancelled') then raise exception 'Requester can only keep pending or cancel the request';end if;
    end if;
  end if;

  if new.status in ('pending','approved') and exists(
    select 1 from public.vacation_requests vr
    join public.vacation_types ovt on ovt.id=vr.vacation_type_id
    cross join lateral jsonb_array_elements(vr.date_blocks) ob
    cross join lateral jsonb_array_elements(new.date_blocks) nb
    where vr.workspace_id=new.workspace_id and vr.user_id=new.user_id and vr.id<>new.id and vr.status in ('pending','approved')
      and (ob->>'start_date')::date<=(nb->>'end_date')::date and (ob->>'end_date')::date>=(nb->>'start_date')::date
      and not (v_type.day_fraction=0.50 and ovt.day_fraction=0.50 and coalesce(vr.half_day_period,'')<>coalesce(new.half_day_period,''))
  ) then raise exception 'Ya existe una solicitud pendiente o aprobada que se cruza con alguno de estos bloques';end if;

  if v_type.deducts_from_balance and new.status in ('pending','approved') then
    for v_year in extract(year from v_min)::int..extract(year from v_max)::int loop
      v_requested:=private.vacation_units_for_year(new.date_blocks,v_type.day_fraction,v_year);
      if v_requested<=0 then continue;end if;
      select coalesce(sum(private.vacation_units_for_year(vr.date_blocks,vt.day_fraction,v_year)),0) into v_existing
      from public.vacation_requests vr join public.vacation_types vt on vt.id=vr.vacation_type_id
      where vr.workspace_id=new.workspace_id and vr.user_id=new.user_id and vr.id<>new.id and vr.status in ('pending','approved') and vt.deducts_from_balance=true;
      select coalesce(vb.allowed_days,ws.vacation_default_annual_days,12),coalesce(vb.adjustment_used_days,0) into v_allowed,v_adjustment
      from public.workspace_settings ws left join public.vacation_balances vb on vb.workspace_id=ws.workspace_id and vb.user_id=new.user_id and vb.year=v_year
      where ws.workspace_id=new.workspace_id;
      v_allowed:=coalesce(v_allowed,12);v_adjustment:=coalesce(v_adjustment,0);
      if v_existing+v_adjustment+v_requested>v_allowed+0.0001 then
        raise exception 'Saldo insuficiente para %: disponibles %, solicitados %',v_year,greatest(0,v_allowed-v_adjustment-v_existing),v_requested;
      end if;
    end loop;
  end if;

  if new.status='approved' then
    if new.ai_analyzed_at is null or new.ai_analysis is null or new.ai_analysis='{}'::jsonb then raise exception 'Analyze sprint impact before approving vacations';end if;
    if new.ai_analyzed_at<now()-interval '12 hours' then raise exception 'Vacation impact analysis is stale; analyze again before approving';end if;
    if exists(select 1 from public.tickets t where t.workspace_id=new.workspace_id and (t.dev_owner_id=new.user_id or t.qa_owner_id=new.user_id) and t.status<>'closed' and t.updated_at>new.ai_analyzed_at) then raise exception 'Assigned work changed after the vacation analysis; analyze again before approving';end if;
    if exists(select 1 from public.sprints s cross join lateral jsonb_array_elements(new.date_blocks) nb where s.workspace_id=new.workspace_id and s.status in ('active','planned') and s.start_date<=(nb->>'end_date')::date and s.end_date>=(nb->>'start_date')::date and s.updated_at>new.ai_analyzed_at) then raise exception 'Sprint planning changed after the vacation analysis; analyze again before approving';end if;
    if exists(select 1 from public.vacation_requests vr cross join lateral jsonb_array_elements(vr.date_blocks) ob cross join lateral jsonb_array_elements(new.date_blocks) nb where vr.workspace_id=new.workspace_id and vr.id<>new.id and vr.status='approved' and (ob->>'start_date')::date<=(nb->>'end_date')::date and (ob->>'end_date')::date>=(nb->>'start_date')::date and vr.updated_at>new.ai_analyzed_at) then raise exception 'Team availability changed after the vacation analysis; analyze again before approving';end if;
  end if;

  if new.status in ('approved','rejected') then
    if not v_service then new.decision_by=(select auth.uid());elsif new.decision_by is null then new.decision_by=(select auth.uid());end if;
    new.decided_at=coalesce(new.decided_at,now());
  end if;
  return new;
end $$;
revoke all on function private.guard_vacation_request() from public,anon,authenticated;

-- Backfill authoritative counters for legacy requests while the guard trigger is
-- intentionally detached. This keeps approved/rejected historical rows migratable.
update public.vacation_requests vr
set absence_days=private.vacation_units_for_year(vr.date_blocks,vt.day_fraction,extract(year from vr.start_date)::int)
                + case when extract(year from vr.end_date)::int<>extract(year from vr.start_date)::int then private.vacation_units_for_year(vr.date_blocks,vt.day_fraction,extract(year from vr.end_date)::int) else 0 end,
    charged_days=case when vt.deducts_from_balance then
      private.vacation_units_for_year(vr.date_blocks,vt.day_fraction,extract(year from vr.start_date)::int)
      + case when extract(year from vr.end_date)::int<>extract(year from vr.start_date)::int then private.vacation_units_for_year(vr.date_blocks,vt.day_fraction,extract(year from vr.end_date)::int) else 0 end
    else 0 end
from public.vacation_types vt where vt.id=vr.vacation_type_id;

-- Re-enable the canonical v17.5.2 guard only after every historical request has
-- a normalized type, block structure and authoritative counters.
drop trigger if exists trg_guard_vacation_request on public.vacation_requests;
create trigger trg_guard_vacation_request before insert or update on public.vacation_requests
for each row execute function private.guard_vacation_request();

insert into public.vacation_balances(workspace_id,user_id,year,allowed_days,adjustment_used_days)
select wm.workspace_id,wm.user_id,extract(year from current_date)::int,coalesce(ws.vacation_default_annual_days,12),0
from public.workspace_members wm
join public.workspace_settings ws on ws.workspace_id=wm.workspace_id
where wm.active=true
on conflict(workspace_id,user_id,year) do nothing;

comment on table public.vacation_types is 'Workspace-configurable absence types. day_fraction controls full/half day units; deducts_from_balance controls annual allowance consumption.';
comment on table public.vacation_balances is 'Per-member annual vacation allowance and manual already-used adjustment. System occupied days are calculated from pending/approved requests.';
comment on column public.vacation_requests.charged_days is 'Balance-consuming units calculated by the database from type + blocks; never trusted from the client.';

commit;
