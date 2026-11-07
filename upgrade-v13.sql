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
