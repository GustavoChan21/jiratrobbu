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
