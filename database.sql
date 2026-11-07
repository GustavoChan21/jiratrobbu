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
