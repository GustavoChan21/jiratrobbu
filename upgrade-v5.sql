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
