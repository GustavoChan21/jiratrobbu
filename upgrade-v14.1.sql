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
