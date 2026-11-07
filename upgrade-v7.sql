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
