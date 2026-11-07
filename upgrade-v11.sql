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
