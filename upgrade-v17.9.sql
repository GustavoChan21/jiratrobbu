-- Jira Interno TROBBU v17.9.0
-- Unified Live counters, light/dark theme preference, Helpdesk 4-state workflow,
-- inline assignment/status controls and realtime hardening.

begin;

-- -----------------------------------------------------------------------------
-- 1) User theme preference
-- -----------------------------------------------------------------------------
alter table public.profiles add column if not exists theme_preference text not null default 'light';
update public.profiles set theme_preference='light' where theme_preference is null or theme_preference not in ('light','dark');
alter table public.profiles drop constraint if exists profiles_theme_preference_check;
alter table public.profiles add constraint profiles_theme_preference_check check (theme_preference in ('light','dark'));

-- -----------------------------------------------------------------------------
-- 2) Canonical Helpdesk workflow: created -> review -> attended -> closed.
--    Historical resolved rows become closed while retaining resolved_at as legacy audit data.
-- -----------------------------------------------------------------------------
alter table public.helpdesk_tickets drop constraint if exists helpdesk_tickets_status_check;
-- Historical normalization must not fire requester guards, SLA/activity triggers or
-- notifications. The DDL + UPDATE are transaction-scoped, so concurrent clients
-- never observe the table with user triggers disabled.
alter table public.helpdesk_tickets disable trigger user;
update public.helpdesk_tickets
set status='closed',
    closed_at=coalesce(closed_at,resolved_at,updated_at,now())
where status='resolved';
alter table public.helpdesk_tickets enable trigger user;
alter table public.helpdesk_tickets add constraint helpdesk_tickets_status_check
  check (status in ('created','review','attended','closed'));
alter table public.helpdesk_tickets alter column status set default 'created';

-- Managers keep full operational updates. Requesters and current assignees may
-- UPDATE their visible row, while the BEFORE guard below restricts exactly what
-- workflow fields they are allowed to change.
drop policy if exists helpdesk_tickets_update on public.helpdesk_tickets;
create policy helpdesk_tickets_update on public.helpdesk_tickets
for update to authenticated
using (
  private.has_workspace_permission(workspace_id,'manage_helpdesk')
  or (
    private.is_workspace_member(workspace_id)
    and (requester_user_id=(select auth.uid()) or assigned_to=(select auth.uid()))
  )
)
with check (
  private.has_workspace_permission(workspace_id,'manage_helpdesk')
  or (
    private.is_workspace_member(workspace_id)
    and (requester_user_id=(select auth.uid()) or assigned_to=(select auth.uid()))
  )
);

create or replace function private.guard_helpdesk_requester_update()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_actor uuid:=(select auth.uid());
  v_assignment_context boolean:=coalesce(current_setting('app.helpdesk_assignment_action',true),'')='1';
  v_requester boolean:=old.requester_user_id is not distinct from v_actor;
  v_assignee boolean:=old.assigned_to is not distinct from v_actor;
  v_internal_changed boolean;
begin
  if v_assignment_context then return new; end if;
  if private.has_workspace_permission(old.workspace_id,'manage_helpdesk') then return new; end if;

  v_internal_changed := row(
      new.workspace_id,new.requester_user_id,new.assigned_to,new.due_at,
      new.first_response_at,new.reviewed_at,new.attended_at,new.resolved_at,new.closed_at
    ) is distinct from row(
      old.workspace_id,old.requester_user_id,old.assigned_to,old.due_at,
      old.first_response_at,old.reviewed_at,old.attended_at,old.resolved_at,old.closed_at
    );

  if v_requester then
    if new.status is distinct from old.status then
      if not (old.status='attended' and new.status='closed') then
        raise exception 'The requester can only close an attended Helpdesk ticket';
      end if;
    end if;
    if v_internal_changed then
      raise exception 'Requesters cannot change internal Helpdesk handling fields';
    end if;
    return new;
  end if;

  if v_assignee then
    if v_internal_changed then
      raise exception 'Assigned users can only advance the Helpdesk status';
    end if;
    if new.status is not distinct from old.status then return new; end if;
    if not (
      (old.status='created' and new.status='review')
      or (old.status='review' and new.status='attended')
    ) then
      raise exception 'Assigned users must follow Nuevo -> En revisión -> Atendido';
    end if;
    return new;
  end if;

  raise exception 'You cannot update this Helpdesk request';
end $$;

create or replace function private.track_helpdesk_change()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_resolution_hours integer:=24;
  v_actor uuid:=auth.uid();
  v_status_label text;
begin
  select coalesce(ws.sla_resolution_hours,24)
  into v_resolution_hours
  from public.workspace_settings ws
  where ws.workspace_id=new.workspace_id;
  if not found then v_resolution_hours:=24; end if;

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
    if new.status='closed' and new.closed_at is null then new.closed_at=now(); end if;

    v_status_label:=case new.status
      when 'created' then 'Nuevo'
      when 'review' then 'En revisión'
      when 'attended' then 'Atendido'
      when 'closed' then 'Cerrado'
      else new.status
    end;

    insert into public.helpdesk_activity(helpdesk_ticket_id,actor_id,action,from_value,to_value)
    values(new.id,v_actor,'status_changed',old.status,new.status);

    if new.requester_user_id is not null and new.requester_user_id is distinct from v_actor then
      perform private.emit_notification(
        new.workspace_id,new.requester_user_id,'helpdesk_status','helpdesk',
        new.ticket_key||' actualizado','El estado de tu solicitud cambió a '||v_status_label||'.',
        jsonb_build_object('entity_type','helpdesk','entity_id',new.id,'helpdesk_key',new.ticket_key,'subject',new.subject,'action','status_changed','from_status',old.status,'to_status',new.status),
        v_actor,null,new.id,'helpdesk:'||new.id||':status:'||new.status||':'||extract(epoch from new.updated_at)::bigint,true
      );
    end if;
    if new.assigned_to is not null and new.assigned_to is distinct from v_actor and new.assigned_to is distinct from new.requester_user_id then
      perform private.emit_notification(
        new.workspace_id,new.assigned_to,'helpdesk_status','helpdesk',
        new.ticket_key||' actualizado','El estado cambió a '||v_status_label||'.',
        jsonb_build_object('entity_type','helpdesk','entity_id',new.id,'helpdesk_key',new.ticket_key,'subject',new.subject,'action','status_changed','from_status',old.status,'to_status',new.status),
        v_actor,null,new.id,'helpdesk:'||new.id||':status-assignee:'||new.status||':'||extract(epoch from new.updated_at)::bigint,true
      );
    end if;
  end if;

  if old.assigned_to is distinct from new.assigned_to and new.assigned_to is not null then
    insert into public.helpdesk_activity(helpdesk_ticket_id,actor_id,action,from_value,to_value)
    values(new.id,v_actor,'assigned',old.assigned_to::text,new.assigned_to::text);
    perform private.emit_notification(
      new.workspace_id,new.assigned_to,'helpdesk_assigned','helpdesk',new.ticket_key||' asignado',new.subject,
      jsonb_build_object('entity_type','helpdesk','entity_id',new.id,'helpdesk_key',new.ticket_key,'subject',new.subject,'action','assigned'),
      v_actor,null,new.id,'helpdesk:'||new.id||':assigned:'||new.assigned_to||':'||extract(epoch from new.updated_at)::bigint,true
    );
  end if;
  return new;
end $$;

create or replace function private.guard_helpdesk_absent_assignment()
returns trigger
language plpgsql
set search_path=public,private,pg_temp
as $$
declare actor uuid:=auth.uid();
begin
  if new.assigned_to is not null and (tg_op='INSERT' or old.assigned_to is distinct from new.assigned_to)
     and exists(
       select 1 from public.vacation_requests vr
       where vr.workspace_id=new.workspace_id and vr.user_id=new.assigned_to
         and vr.status='approved' and current_date between vr.start_date and vr.end_date
     ) then
    raise exception 'The selected assignee is currently out of office';
  end if;
  if tg_op='UPDATE' and actor is not null and actor=new.assigned_to
     and old.status is distinct from new.status and new.status in ('attended','closed')
     and exists(
       select 1 from public.vacation_requests vr
       where vr.workspace_id=new.workspace_id and vr.user_id=actor
         and vr.status='approved' and current_date between vr.start_date and vr.end_date
     ) then
    raise exception 'You cannot complete Helpdesk work while an approved absence is active';
  end if;
  return new;
end $$;

create or replace function private.helpdesk_member_capacity(p_workspace uuid,p_user uuid)
returns table(daily_count integer,active_count integer,daily_limit integer,active_limit integer,overflow_mode text,overflow_user_id uuid,available boolean)
language plpgsql
stable security definer
set search_path=public,pg_temp
as $$
declare
  v_timezone text:='America/Merida';v_daily integer:=4;v_active integer:=4;v_mode text:='fallback';v_overflow uuid;
  v_member_daily integer;v_member_active integer;v_member_mode text;v_member_overflow uuid;v_daily_count integer:=0;v_active_count integer:=0;
begin
  select coalesce(ws.timezone,'America/Merida'),coalesce(ws.helpdesk_default_daily_limit,4),coalesce(ws.helpdesk_default_active_limit,4),coalesce(ws.helpdesk_default_overflow_mode,'fallback'),ws.helpdesk_default_overflow_user_id
    into v_timezone,v_daily,v_active,v_mode,v_overflow from public.workspace_settings ws where ws.workspace_id=p_workspace;
  select wm.helpdesk_daily_limit,wm.helpdesk_active_limit,nullif(wm.helpdesk_overflow_mode,'inherit'),wm.helpdesk_overflow_user_id
    into v_member_daily,v_member_active,v_member_mode,v_member_overflow from public.workspace_members wm
    where wm.workspace_id=p_workspace and wm.user_id=p_user and wm.active=true;
  if not found then return query select 0,0,0,0,'queue'::text,null::uuid,false;return;end if;
  v_daily:=coalesce(v_member_daily,v_daily);v_active:=coalesce(v_member_active,v_active);v_mode:=coalesce(v_member_mode,v_mode);v_overflow:=coalesce(v_member_overflow,v_overflow);
  select count(*)::int into v_daily_count from public.helpdesk_assignment_log l
    where l.workspace_id=p_workspace and l.assigned_user_id=p_user and timezone(v_timezone,l.created_at)::date=timezone(v_timezone,now())::date;
  select count(*)::int into v_active_count from public.helpdesk_tickets h
    where h.workspace_id=p_workspace and h.assigned_to=p_user and h.category not in ('module','feature','new_requirement') and h.status<>'closed';
  return query select v_daily_count,v_active_count,v_daily,v_active,v_mode,v_overflow,((v_daily=0 or v_daily_count<v_daily) and (v_active=0 or v_active_count<v_active));
end $$;

create or replace function private.process_helpdesk_assignment_queue_impl(p_workspace uuid default null)
returns jsonb
language plpgsql security definer
set search_path=public,private,pg_temp
as $$
declare r record;result jsonb;processed int:=0;assigned int:=0;caller uuid:=(select auth.uid());internal_call boolean:=coalesce(current_setting('app.helpdesk_internal_queue',true),'')='1';
begin
  if caller is not null and not internal_call and p_workspace is not null
     and not private.has_workspace_permission(p_workspace,'manage_helpdesk')
     and not private.has_workspace_permission(p_workspace,'manage_staff') then raise exception 'Insufficient Helpdesk permissions';end if;
  if coalesce(current_setting('app.helpdesk_queue_draining',true),'')='1' then return jsonb_build_object('processed',0,'assigned',0,'skipped','already_draining');end if;
  perform set_config('app.helpdesk_queue_draining','1',true);
  for r in
    select q.helpdesk_ticket_id from public.helpdesk_assignment_queue q join public.helpdesk_tickets h on h.id=q.helpdesk_ticket_id
    where q.status='waiting' and (p_workspace is null or q.workspace_id=p_workspace) and h.assigned_to is null and h.status<>'closed'
    order by q.queued_at limit 50
  loop
    processed:=processed+1;result:=private.route_helpdesk_ticket_rules(r.helpdesk_ticket_id);if coalesce((result->>'assigned')::boolean,false) then assigned:=assigned+1;end if;
  end loop;
  return jsonb_build_object('processed',processed,'assigned',assigned);
end $$;

create or replace function private.drain_helpdesk_queue_on_capacity_release()
returns trigger
language plpgsql security definer
set search_path=public,pg_temp
as $$
begin
  if coalesce(current_setting('app.helpdesk_queue_draining',true),'')='1' then return new;end if;
  if (old.assigned_to is distinct from new.assigned_to and old.assigned_to is not null)
     or (old.status<>'closed' and new.status='closed') then
    perform set_config('app.helpdesk_internal_queue','1',true);
    perform private.process_helpdesk_assignment_queue_impl(new.workspace_id);
  end if;
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- 3) One authoritative counter snapshot per workspace.
--    Realtime events are signals; this RPC reconciles all derived counters in one request.
-- -----------------------------------------------------------------------------
create or replace function public.get_live_counters(p_workspace uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path=public,pg_temp
as $$
declare
  v_uid uuid:=(select auth.uid());
  v_navigation jsonb;
  v_modules jsonb:='[]'::jsonb;
  v_helpdesk jsonb;
begin
  if v_uid is null then raise exception 'Authentication required';end if;
  if not private.is_workspace_member(p_workspace) then raise exception 'Workspace access required';end if;

  select jsonb_build_object(
    'tickets',(select count(*) from public.tickets t where t.workspace_id=p_workspace),
    'backlog',(select count(*) from public.tickets t where t.workspace_id=p_workspace and t.sprint_id is null and t.status<>'closed'),
    'knowledge',(select count(*) from public.knowledge_articles k where k.workspace_id=p_workspace),
    'helpdesk',(select count(*) from public.helpdesk_tickets h where h.workspace_id=p_workspace),
    'mytasks',(select count(*) from public.tickets t where t.workspace_id=p_workspace and (t.reporter_id=v_uid or t.dev_owner_id=v_uid or t.qa_owner_id=v_uid)),
    'products',coalesce((select jsonb_object_agg(x.product_id::text,x.cnt) from (select t.product_id,count(*)::bigint cnt from public.tickets t where t.workspace_id=p_workspace group by t.product_id)x),'{}'::jsonb)
  ) into v_navigation;

  select coalesce(jsonb_agg(jsonb_build_object('module_id',q.module_id,'ticket_count',q.ticket_count,'activity_count',q.activity_count,'article_count',q.article_count) order by q.name),'[]'::jsonb)
  into v_modules
  from (
    select m.id module_id,m.name,
      (select count(*) from public.tickets t where t.workspace_id=p_workspace and t.module_id=m.id) ticket_count,
      (select count(*) from public.ticket_activity a join public.tickets t on t.id=a.ticket_id where t.workspace_id=p_workspace and t.module_id=m.id) activity_count,
      (select count(*) from public.knowledge_articles k where k.workspace_id=p_workspace and k.module_id=m.id) article_count
    from public.ticket_modules m where m.workspace_id=p_workspace
  ) q;

  select jsonb_build_object(
    'total',count(*),
    'created',count(*) filter(where h.category not in ('module','feature','new_requirement') and h.status='created'),
    'review',count(*) filter(where h.category not in ('module','feature','new_requirement') and h.status='review'),
    'attended',count(*) filter(where h.category not in ('module','feature','new_requirement') and h.status='attended'),
    'closed',count(*) filter(where h.category not in ('module','feature','new_requirement') and h.status='closed'),
    'pending_requirements',count(*) filter(where h.category in ('module','feature','new_requirement') and coalesce(h.proposal_status,'pending')='pending'),
    'overdue',count(*) filter(where h.category not in ('module','feature','new_requirement') and h.status<>'closed' and h.due_at is not null and h.due_at<now())
  ) into v_helpdesk
  from public.helpdesk_tickets h where h.workspace_id=p_workspace;

  return jsonb_build_object('navigation',v_navigation,'modules',v_modules,'helpdesk',v_helpdesk,'generated_at',now());
end $$;
revoke all on function public.get_live_counters(uuid) from public,anon;
grant execute on function public.get_live_counters(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 4) Realtime payload hardening for counters/comments/activity.
-- -----------------------------------------------------------------------------
alter table public.ticket_comments replica identity full;
alter table public.ticket_activity replica identity full;
alter table public.ticket_attachments replica identity full;
alter table public.sprint_comments replica identity full;
alter table public.sprint_attachments replica identity full;
alter table public.helpdesk_comments replica identity full;
alter table public.helpdesk_activity replica identity full;
alter table public.helpdesk_attachments replica identity full;

-- Ensure all counter/detail sources remain published without duplicating publication entries.
do $$
declare t text;
begin
  foreach t in array array[
    'ticket_comments','ticket_activity','ticket_attachments','sprint_comments','sprint_attachments',
    'helpdesk_comments','helpdesk_activity','helpdesk_attachments','helpdesk_tickets','tickets','sprints',
    'knowledge_articles','ticket_modules','profiles'
  ] loop
    if to_regclass(format('public.%I',t)) is not null and not exists(
      select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t
    ) then
      execute format('alter publication supabase_realtime add table public.%I',t);
    end if;
  end loop;
end $$;

notify pgrst,'reload schema';
commit;
