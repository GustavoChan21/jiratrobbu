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

