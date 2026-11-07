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
