-- Jira Interno TROBBU v16.8
-- Helpdesk intelligent routing, staff capacity rules, queueing and UI-support metadata.

create extension if not exists pg_cron;

alter table public.workspace_members
  add column if not exists helpdesk_routing_description text,
  add column if not exists helpdesk_auto_assign_enabled boolean not null default false,
  add column if not exists helpdesk_daily_limit integer,
  add column if not exists helpdesk_active_limit integer,
  add column if not exists helpdesk_overflow_mode text,
  add column if not exists helpdesk_overflow_user_id uuid references auth.users(id) on delete set null;

do $$
begin
  if not exists(select 1 from pg_constraint where conname='workspace_members_helpdesk_daily_limit_check') then
    alter table public.workspace_members add constraint workspace_members_helpdesk_daily_limit_check check (helpdesk_daily_limit is null or helpdesk_daily_limit between 0 and 500);
  end if;
  if not exists(select 1 from pg_constraint where conname='workspace_members_helpdesk_active_limit_check') then
    alter table public.workspace_members add constraint workspace_members_helpdesk_active_limit_check check (helpdesk_active_limit is null or helpdesk_active_limit between 0 and 500);
  end if;
  if not exists(select 1 from pg_constraint where conname='workspace_members_helpdesk_overflow_mode_check') then
    alter table public.workspace_members add constraint workspace_members_helpdesk_overflow_mode_check check (helpdesk_overflow_mode is null or helpdesk_overflow_mode in ('inherit','fallback','queue','next_available'));
  end if;
end $$;

create index if not exists idx_workspace_members_helpdesk_auto on public.workspace_members(workspace_id,helpdesk_auto_assign_enabled,active);
create index if not exists idx_workspace_members_helpdesk_overflow on public.workspace_members(workspace_id,helpdesk_overflow_user_id) where helpdesk_overflow_user_id is not null;

alter table public.workspace_settings
  add column if not exists helpdesk_auto_assignment_enabled boolean not null default true,
  add column if not exists helpdesk_default_daily_limit integer not null default 4,
  add column if not exists helpdesk_default_active_limit integer not null default 4,
  add column if not exists helpdesk_default_overflow_mode text not null default 'fallback',
  add column if not exists helpdesk_default_overflow_user_id uuid references auth.users(id) on delete set null;

do $$
begin
  if not exists(select 1 from pg_constraint where conname='workspace_settings_helpdesk_daily_limit_check') then
    alter table public.workspace_settings add constraint workspace_settings_helpdesk_daily_limit_check check (helpdesk_default_daily_limit between 0 and 500);
  end if;
  if not exists(select 1 from pg_constraint where conname='workspace_settings_helpdesk_active_limit_check') then
    alter table public.workspace_settings add constraint workspace_settings_helpdesk_active_limit_check check (helpdesk_default_active_limit between 0 and 500);
  end if;
  if not exists(select 1 from pg_constraint where conname='workspace_settings_helpdesk_overflow_mode_check') then
    alter table public.workspace_settings add constraint workspace_settings_helpdesk_overflow_mode_check check (helpdesk_default_overflow_mode in ('fallback','queue','next_available'));
  end if;
end $$;

-- Current TROBBU workspace defaults requested by the product owner.
update public.workspace_settings
set helpdesk_auto_assignment_enabled=true,
    helpdesk_default_daily_limit=4,
    helpdesk_default_active_limit=4,
    helpdesk_default_overflow_mode='fallback',
    helpdesk_default_overflow_user_id='2ab7d928-9ffe-4b72-a433-cde74a9c9518'
where workspace_id='13345ea4-59e7-4d65-874c-f13a131647d4';

-- Existing non-portal team members are eligible by default. Admin can disable individually.
update public.workspace_members wm
set helpdesk_auto_assign_enabled=true
from public.workspace_roles wr
where wr.id=wm.role_id and wr.workspace_id=wm.workspace_id
  and coalesce(wr.base_role::text,wm.role::text) in ('dev','qa','pm','admin','superadmin')
  and wm.active=true;

alter table public.helpdesk_tickets
  add column if not exists assignment_source text,
  add column if not exists assignment_reason text,
  add column if not exists assignment_confidence numeric(5,4),
  add column if not exists assignment_queued_at timestamptz,
  add column if not exists assignment_last_routed_at timestamptz;

do $$
begin
  if not exists(select 1 from pg_constraint where conname='helpdesk_tickets_assignment_source_check') then
    alter table public.helpdesk_tickets add constraint helpdesk_tickets_assignment_source_check check (
      assignment_source is null or assignment_source in ('manual','redirect','auto_ai','auto_rules','overflow','queue')
    );
  end if;
  if not exists(select 1 from pg_constraint where conname='helpdesk_tickets_assignment_confidence_check') then
    alter table public.helpdesk_tickets add constraint helpdesk_tickets_assignment_confidence_check check (
      assignment_confidence is null or assignment_confidence between 0 and 1
    );
  end if;
end $$;

create table if not exists public.helpdesk_assignment_log (
  id bigint generated by default as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  helpdesk_ticket_id uuid not null references public.helpdesk_tickets(id) on delete cascade,
  assigned_user_id uuid not null references auth.users(id) on delete cascade,
  previous_user_id uuid references auth.users(id) on delete set null,
  source text not null default 'manual',
  reason text,
  confidence numeric(5,4),
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_helpdesk_assignment_log_daily on public.helpdesk_assignment_log(workspace_id,assigned_user_id,created_at desc);
create index if not exists idx_helpdesk_assignment_log_ticket on public.helpdesk_assignment_log(helpdesk_ticket_id,created_at desc);
create index if not exists idx_helpdesk_assignment_log_actor on public.helpdesk_assignment_log(actor_id) where actor_id is not null;
alter table public.helpdesk_assignment_log enable row level security;
revoke all on public.helpdesk_assignment_log from anon;
grant select on public.helpdesk_assignment_log to authenticated;
drop policy if exists helpdesk_assignment_log_select on public.helpdesk_assignment_log;
create policy helpdesk_assignment_log_select on public.helpdesk_assignment_log
for select to authenticated using (
  assigned_user_id=(select auth.uid())
  or private.has_workspace_permission(workspace_id,'manage_helpdesk')
  or private.has_workspace_permission(workspace_id,'manage_staff')
);

create table if not exists public.helpdesk_assignment_queue (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  helpdesk_ticket_id uuid not null references public.helpdesk_tickets(id) on delete cascade,
  status text not null default 'waiting' check (status in ('waiting','assigned','cancelled')),
  suggested_user_id uuid references auth.users(id) on delete set null,
  assigned_user_id uuid references auth.users(id) on delete set null,
  reason text,
  attempts integer not null default 0,
  queued_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  assigned_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(helpdesk_ticket_id)
);
create index if not exists idx_helpdesk_assignment_queue_waiting on public.helpdesk_assignment_queue(workspace_id,status,queued_at) where status='waiting';
create index if not exists idx_helpdesk_assignment_queue_suggested on public.helpdesk_assignment_queue(suggested_user_id) where suggested_user_id is not null;
create index if not exists idx_helpdesk_assignment_queue_assigned on public.helpdesk_assignment_queue(assigned_user_id) where assigned_user_id is not null;
alter table public.helpdesk_assignment_queue enable row level security;
revoke all on public.helpdesk_assignment_queue from anon;
grant select on public.helpdesk_assignment_queue to authenticated;
drop policy if exists helpdesk_assignment_queue_select on public.helpdesk_assignment_queue;
create policy helpdesk_assignment_queue_select on public.helpdesk_assignment_queue
for select to authenticated using (
  private.has_workspace_permission(workspace_id,'manage_helpdesk')
  or private.has_workspace_permission(workspace_id,'manage_staff')
);

create or replace function private.helpdesk_member_capacity(
  p_workspace uuid,
  p_user uuid
)
returns table(
  daily_count integer,
  active_count integer,
  daily_limit integer,
  active_limit integer,
  overflow_mode text,
  overflow_user_id uuid,
  available boolean
)
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare
  v_timezone text:='America/Merida';
  v_daily integer:=4;
  v_active integer:=4;
  v_mode text:='fallback';
  v_overflow uuid;
  v_member_daily integer;
  v_member_active integer;
  v_member_mode text;
  v_member_overflow uuid;
  v_daily_count integer:=0;
  v_active_count integer:=0;
begin
  select coalesce(ws.timezone,'America/Merida'),
         coalesce(ws.helpdesk_default_daily_limit,4),
         coalesce(ws.helpdesk_default_active_limit,4),
         coalesce(ws.helpdesk_default_overflow_mode,'fallback'),
         ws.helpdesk_default_overflow_user_id
    into v_timezone,v_daily,v_active,v_mode,v_overflow
  from public.workspace_settings ws where ws.workspace_id=p_workspace;

  select wm.helpdesk_daily_limit,wm.helpdesk_active_limit,
         nullif(wm.helpdesk_overflow_mode,'inherit'),wm.helpdesk_overflow_user_id
    into v_member_daily,v_member_active,v_member_mode,v_member_overflow
  from public.workspace_members wm
  where wm.workspace_id=p_workspace and wm.user_id=p_user and wm.active=true;

  if not found then
    return query select 0,0,0,0,'queue'::text,null::uuid,false;
    return;
  end if;

  v_daily:=coalesce(v_member_daily,v_daily);
  v_active:=coalesce(v_member_active,v_active);
  v_mode:=coalesce(v_member_mode,v_mode);
  v_overflow:=coalesce(v_member_overflow,v_overflow);

  select count(*)::int into v_daily_count
  from public.helpdesk_assignment_log l
  where l.workspace_id=p_workspace and l.assigned_user_id=p_user
    and timezone(v_timezone,l.created_at)::date=timezone(v_timezone,now())::date;

  select count(*)::int into v_active_count
  from public.helpdesk_tickets h
  where h.workspace_id=p_workspace and h.assigned_to=p_user
    and h.category not in ('module','feature','new_requirement')
    and h.status not in ('resolved','closed');

  return query select v_daily_count,v_active_count,v_daily,v_active,v_mode,v_overflow,
    ((v_daily=0 or v_daily_count<v_daily) and (v_active=0 or v_active_count<v_active));
end $$;
revoke all on function private.helpdesk_member_capacity(uuid,uuid) from public,anon,authenticated;

create or replace function private.helpdesk_member_routable(p_workspace uuid,p_user uuid)
returns boolean
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select exists(
    select 1
    from public.workspace_members wm
    left join public.workspace_roles wr on wr.id=wm.role_id and wr.workspace_id=wm.workspace_id
    where wm.workspace_id=p_workspace and wm.user_id=p_user and wm.active=true
      and (
        wm.helpdesk_auto_assign_enabled
        or private.member_has_permission(p_workspace,p_user,'manage_helpdesk')
        or coalesce(wr.base_role::text,wm.role::text) in ('dev','qa','pm','admin','superadmin')
      )
      and coalesce(wr.code,'')<>'helpdesk_requester'
  )
$$;
revoke all on function private.helpdesk_member_routable(uuid,uuid) from public,anon,authenticated;

create or replace function private.helpdesk_match_score(p_ticket_text text,p_profile_text text)
returns integer
language sql
immutable
set search_path=pg_catalog,pg_temp
as $$
  with src as (
    select trim(translate(lower(coalesce(p_ticket_text,'')),'áéíóúüñ','aeiouun')) as ticket,
           trim(translate(lower(coalesce(p_profile_text,'')),'áéíóúüñ','aeiouun')) as profile
  ), tokens as (
    select distinct token
    from src, regexp_split_to_table(regexp_replace(ticket,'[^a-z0-9]+',' ','g'),'\s+') token
    where length(token)>=4
      and token not in ('para','como','este','esta','estos','estas','ticket','helpdesk','solicitud','reporte','usuario','sistema','necesito','quiero','error')
  )
  select coalesce(sum(case when position(token in profile)>0 then 1 else 0 end),0)::int from tokens,src
$$;
revoke all on function private.helpdesk_match_score(text,text) from public,anon,authenticated;

create or replace function private.helpdesk_ticket_context(p_ticket uuid)
returns text
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select concat_ws(' ',h.subject,h.description,rt.name,d.name,p.name,h.category,h.priority::text)
  from public.helpdesk_tickets h
  left join public.helpdesk_request_types rt on rt.id=h.request_type_id
  left join public.helpdesk_departments d on d.id=h.department_id
  left join public.products p on p.id=h.product_id
  where h.id=p_ticket
$$;
revoke all on function private.helpdesk_ticket_context(uuid) from public,anon,authenticated;

create or replace function private.helpdesk_member_context(p_workspace uuid,p_user uuid)
returns text
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select concat_ws(' ',wm.helpdesk_routing_description,p.job_title,wr.name,wr.description,wm.role::text)
  from public.workspace_members wm
  left join public.profiles p on p.id=wm.user_id
  left join public.workspace_roles wr on wr.id=wm.role_id and wr.workspace_id=wm.workspace_id
  where wm.workspace_id=p_workspace and wm.user_id=p_user
$$;
revoke all on function private.helpdesk_member_context(uuid,uuid) from public,anon,authenticated;

create or replace function private.queue_helpdesk_assignment(p_ticket uuid,p_reason text,p_suggested uuid default null)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_workspace uuid;
begin
  select workspace_id into v_workspace from public.helpdesk_tickets where id=p_ticket;
  if v_workspace is null then return; end if;
  insert into public.helpdesk_assignment_queue(workspace_id,helpdesk_ticket_id,status,suggested_user_id,reason,attempts,queued_at,last_attempt_at,updated_at)
  values(v_workspace,p_ticket,'waiting',p_suggested,left(coalesce(p_reason,'Pendiente de asignación automática'),1000),1,now(),now(),now())
  on conflict(helpdesk_ticket_id) do update set
    status='waiting',suggested_user_id=excluded.suggested_user_id,reason=excluded.reason,
    attempts=public.helpdesk_assignment_queue.attempts+1,last_attempt_at=now(),updated_at=now();
  perform set_config('app.helpdesk_assignment_action','1',true);
  update public.helpdesk_tickets
  set assignment_source='queue',assignment_reason=left(coalesce(p_reason,'Pendiente de asignación automática'),1000),
      assignment_queued_at=coalesce(assignment_queued_at,now()),assignment_last_routed_at=now()
  where id=p_ticket and assigned_to is null;
end $$;
revoke all on function private.queue_helpdesk_assignment(uuid,text,uuid) from public,anon,authenticated;

create or replace function private.assign_helpdesk_internal(
  p_ticket uuid,
  p_user uuid,
  p_source text,
  p_reason text,
  p_confidence numeric default null
)
returns boolean
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_workspace uuid;
  v_category text;
begin
  select workspace_id,category into v_workspace,v_category from public.helpdesk_tickets where id=p_ticket for update;
  if v_workspace is null or v_category in ('module','feature','new_requirement') then return false; end if;
  if not private.helpdesk_member_routable(v_workspace,p_user) then return false; end if;
  perform set_config('app.helpdesk_assignment_action','1',true);
  perform set_config('app.helpdesk_assignment_source',coalesce(p_source,'auto_rules'),true);
  update public.helpdesk_tickets
  set assigned_to=p_user,
      assignment_source=coalesce(p_source,'auto_rules'),
      assignment_reason=left(nullif(btrim(coalesce(p_reason,'')),''),1000),
      assignment_confidence=case when p_confidence is null then null else greatest(0,least(1,p_confidence)) end,
      assignment_queued_at=null,
      assignment_last_routed_at=now()
  where id=p_ticket and assigned_to is null;
  if not found then return false; end if;
  update public.helpdesk_assignment_queue
  set status='assigned',assigned_user_id=p_user,assigned_at=now(),updated_at=now(),reason=left(coalesce(p_reason,reason),1000)
  where helpdesk_ticket_id=p_ticket;
  return true;
end $$;
revoke all on function private.assign_helpdesk_internal(uuid,uuid,text,text,numeric) from public,anon,authenticated;

create or replace function private.route_helpdesk_ticket_rules(p_ticket uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  h public.helpdesk_tickets%rowtype;
  ws public.workspace_settings%rowtype;
  ticket_text text;
  candidate uuid;
  candidate_score int:=0;
  cap record;
  fallback uuid;
  next_user uuid;
  next_score int:=0;
  reason text;
begin
  select * into h from public.helpdesk_tickets where id=p_ticket;
  if not found then return jsonb_build_object('assigned',false,'reason','ticket_not_found'); end if;
  if h.category in ('module','feature','new_requirement') then return jsonb_build_object('assigned',false,'reason','proposal'); end if;
  if h.assigned_to is not null then return jsonb_build_object('assigned',true,'user_id',h.assigned_to,'reason','already_assigned'); end if;
  select * into ws from public.workspace_settings where workspace_id=h.workspace_id;
  if not coalesce(ws.helpdesk_auto_assignment_enabled,true) then return jsonb_build_object('assigned',false,'reason','auto_assignment_disabled'); end if;
  ticket_text:=private.helpdesk_ticket_context(h.id);

  select wm.user_id,
         private.helpdesk_match_score(ticket_text,private.helpdesk_member_context(h.workspace_id,wm.user_id)) as score
  into candidate,candidate_score
  from public.workspace_members wm
  left join public.workspace_roles wr on wr.id=wm.role_id and wr.workspace_id=wm.workspace_id
  where wm.workspace_id=h.workspace_id and wm.active=true and wm.helpdesk_auto_assign_enabled
    and coalesce(wr.code,'')<>'helpdesk_requester'
    and coalesce(wr.base_role::text,wm.role::text)<>'consulta'
    and wm.user_id is distinct from h.requester_user_id
  order by score desc,wm.joined_at
  limit 1;

  if candidate is null or candidate_score<=0 then
    candidate:=ws.helpdesk_default_overflow_user_id;
    candidate_score:=0;
  end if;

  if candidate is null then
    reason:='No se encontró un integrante con perfil de atención relacionado.';
    perform private.queue_helpdesk_assignment(h.id,reason,null);
    return jsonb_build_object('assigned',false,'queued',true,'reason',reason);
  end if;

  select * into cap from private.helpdesk_member_capacity(h.workspace_id,candidate);
  if cap.available then
    reason:=case when candidate_score>0 then 'Coincidencia automática por descripción de responsabilidades.' else 'Asignado al responsable de respaldo del workspace.' end;
    if private.assign_helpdesk_internal(h.id,candidate,case when candidate_score>0 then 'auto_rules' else 'overflow' end,reason,case when candidate_score>0 then least(0.95,0.45+candidate_score*0.08) else 0.25 end) then
      return jsonb_build_object('assigned',true,'user_id',candidate,'source',case when candidate_score>0 then 'auto_rules' else 'overflow' end,'score',candidate_score,'reason',reason);
    end if;
  end if;

  if cap.overflow_mode='next_available' then
    select wm.user_id,private.helpdesk_match_score(ticket_text,private.helpdesk_member_context(h.workspace_id,wm.user_id)) as score
      into next_user,next_score
    from public.workspace_members wm
    left join public.workspace_roles wr on wr.id=wm.role_id and wr.workspace_id=wm.workspace_id
    cross join lateral private.helpdesk_member_capacity(h.workspace_id,wm.user_id) c
    where wm.workspace_id=h.workspace_id and wm.active=true and wm.helpdesk_auto_assign_enabled
      and wm.user_id<>candidate and wm.user_id is distinct from h.requester_user_id
      and coalesce(wr.code,'')<>'helpdesk_requester' and coalesce(wr.base_role::text,wm.role::text)<>'consulta'
      and c.available
    order by score desc,wm.joined_at
    limit 1;
    if next_user is not null and private.assign_helpdesk_internal(h.id,next_user,'overflow','Responsable principal sin capacidad; enviado al siguiente integrante disponible.',least(0.8,0.35+next_score*0.07)) then
      return jsonb_build_object('assigned',true,'user_id',next_user,'source','overflow','reason','next_available');
    end if;
  elsif cap.overflow_mode='fallback' then
    fallback:=coalesce(cap.overflow_user_id,ws.helpdesk_default_overflow_user_id);
    if fallback is not null and fallback<>candidate then
      select * into cap from private.helpdesk_member_capacity(h.workspace_id,fallback);
      if cap.available and private.assign_helpdesk_internal(h.id,fallback,'overflow','Responsable principal alcanzó su límite; enviado al responsable de respaldo.',0.3) then
        return jsonb_build_object('assigned',true,'user_id',fallback,'source','overflow','reason','fallback');
      end if;
    end if;
  end if;

  reason:=format('Capacidad alcanzada para el responsable sugerido (%s asignaciones hoy / %s activas).',cap.daily_count,cap.active_count);
  perform private.queue_helpdesk_assignment(h.id,reason,candidate);
  return jsonb_build_object('assigned',false,'queued',true,'suggested_user_id',candidate,'reason',reason);
end $$;
revoke all on function private.route_helpdesk_ticket_rules(uuid) from public,anon,authenticated;

create or replace function public.process_helpdesk_assignment_queue(p_workspace uuid default null)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  r record;
  result jsonb;
  processed int:=0;
  assigned int:=0;
  caller uuid:=(select auth.uid());
begin
  if caller is not null and p_workspace is not null and not private.has_workspace_permission(p_workspace,'manage_helpdesk') and not private.has_workspace_permission(p_workspace,'manage_staff') then
    raise exception 'Insufficient Helpdesk permissions';
  end if;
  if coalesce(current_setting('app.helpdesk_queue_draining',true),'')='1' then
    return jsonb_build_object('processed',0,'assigned',0,'skipped','already_draining');
  end if;
  perform set_config('app.helpdesk_queue_draining','1',true);
  for r in
    select q.helpdesk_ticket_id
    from public.helpdesk_assignment_queue q
    join public.helpdesk_tickets h on h.id=q.helpdesk_ticket_id
    where q.status='waiting'
      and (p_workspace is null or q.workspace_id=p_workspace)
      and h.assigned_to is null
      and h.status not in ('resolved','closed')
    order by q.queued_at
    limit 50
  loop
    processed:=processed+1;
    result:=private.route_helpdesk_ticket_rules(r.helpdesk_ticket_id);
    if coalesce((result->>'assigned')::boolean,false) then assigned:=assigned+1; end if;
  end loop;
  return jsonb_build_object('processed',processed,'assigned',assigned);
end $$;
revoke all on function public.process_helpdesk_assignment_queue(uuid) from public,anon;
grant execute on function public.process_helpdesk_assignment_queue(uuid) to authenticated;

create or replace function public.apply_helpdesk_auto_assignment(
  p_ticket_id uuid,
  p_assignee uuid,
  p_reason text,
  p_confidence numeric default null,
  p_source text default 'auto_ai'
)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  h public.helpdesk_tickets%rowtype;
  cap record;
begin
  if current_user<>'service_role' and (select auth.uid()) is not null then
    raise exception 'Service role required';
  end if;
  select * into h from public.helpdesk_tickets where id=p_ticket_id;
  if not found then raise exception 'Helpdesk ticket not found'; end if;
  if h.assigned_to is not null then return jsonb_build_object('assigned',true,'user_id',h.assigned_to,'reason','already_assigned'); end if;
  if not private.helpdesk_member_routable(h.workspace_id,p_assignee) then
    perform private.queue_helpdesk_assignment(h.id,'El usuario sugerido por IA ya no es elegible.',p_assignee);
    return jsonb_build_object('assigned',false,'queued',true,'reason','assignee_not_eligible');
  end if;
  select * into cap from private.helpdesk_member_capacity(h.workspace_id,p_assignee);
  if not cap.available then
    perform private.queue_helpdesk_assignment(h.id,coalesce(p_reason,'El usuario sugerido alcanzó su capacidad.'),p_assignee);
    return jsonb_build_object('assigned',false,'queued',true,'reason','capacity_reached');
  end if;
  if private.assign_helpdesk_internal(h.id,p_assignee,case when p_source in ('auto_ai','auto_rules','overflow') then p_source else 'auto_ai' end,p_reason,p_confidence) then
    return jsonb_build_object('assigned',true,'user_id',p_assignee,'source',p_source,'reason',p_reason,'confidence',p_confidence);
  end if;
  perform private.queue_helpdesk_assignment(h.id,'No fue posible aplicar la asignación sugerida.',p_assignee);
  return jsonb_build_object('assigned',false,'queued',true,'reason','assignment_failed');
end $$;
revoke all on function public.apply_helpdesk_auto_assignment(uuid,uuid,text,numeric,text) from public,anon,authenticated;
grant execute on function public.apply_helpdesk_auto_assignment(uuid,uuid,text,numeric,text) to service_role;

create or replace function public.get_helpdesk_member_capacity(p_workspace uuid,p_user uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path=public,private,pg_temp
as $$
declare c record;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not (p_user=(select auth.uid()) or private.has_workspace_permission(p_workspace,'manage_staff') or private.has_workspace_permission(p_workspace,'manage_helpdesk')) then
    raise exception 'Insufficient permissions';
  end if;
  select * into c from private.helpdesk_member_capacity(p_workspace,p_user);
  return jsonb_build_object('daily_count',c.daily_count,'active_count',c.active_count,'daily_limit',c.daily_limit,'active_limit',c.active_limit,'overflow_mode',c.overflow_mode,'overflow_user_id',c.overflow_user_id,'available',c.available);
end $$;
revoke all on function public.get_helpdesk_member_capacity(uuid,uuid) from public,anon;
grant execute on function public.get_helpdesk_member_capacity(uuid,uuid) to authenticated;

create or replace function public.assign_helpdesk_ticket(p_ticket_id uuid,p_assignee uuid,p_comment text default null)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_workspace uuid;
  v_key text;
  v_category text;
  v_current uuid;
  v_caller uuid:=(select auth.uid());
  v_comment text:=nullif(btrim(coalesce(p_comment,'')),'');
  v_manager boolean:=false;
  v_redirect boolean:=false;
begin
  if v_caller is null then raise exception 'Authentication required'; end if;
  select workspace_id,ticket_key,category,assigned_to into v_workspace,v_key,v_category,v_current
  from public.helpdesk_tickets where id=p_ticket_id;
  if v_workspace is null then raise exception 'Helpdesk ticket not found'; end if;
  v_manager:=private.has_workspace_permission(v_workspace,'manage_helpdesk');
  v_redirect:=v_current=v_caller;
  if not v_manager and not v_redirect then raise exception 'Insufficient Helpdesk permissions'; end if;
  if v_category in ('module','feature','new_requirement') then raise exception 'Requirement proposals are handled through the decision flow'; end if;
  if p_assignee is null or not private.helpdesk_member_routable(v_workspace,p_assignee) then raise exception 'The selected assignee is not an active team member eligible for Helpdesk'; end if;
  if v_comment is not null and char_length(v_comment)>4000 then raise exception 'Assignment comment is too long'; end if;
  perform set_config('app.helpdesk_assignment_action','1',true);
  perform set_config('app.helpdesk_assignment_source',case when v_redirect and not v_manager then 'redirect' else 'manual' end,true);
  update public.helpdesk_tickets
  set assigned_to=p_assignee,
      assignment_source=case when v_redirect and not v_manager then 'redirect' else 'manual' end,
      assignment_reason=case when v_redirect and not v_manager then coalesce(v_comment,'Redirigido por el responsable anterior.') else v_comment end,
      assignment_confidence=null,
      assignment_queued_at=null,
      assignment_last_routed_at=now()
  where id=p_ticket_id;
  if v_comment is not null then
    insert into public.helpdesk_comments(helpdesk_ticket_id,author_id,body) values(p_ticket_id,v_caller,v_comment);
  end if;
  return jsonb_build_object('ticket_id',p_ticket_id,'ticket_key',v_key,'assigned_to',p_assignee,'redirected',v_redirect and not v_manager,'comment_added',v_comment is not null);
end $$;
revoke all on function public.assign_helpdesk_ticket(uuid,uuid,text) from public,anon;
grant execute on function public.assign_helpdesk_ticket(uuid,uuid,text) to authenticated;

-- Allow an assignee to read their own routed Helpdesk request.
drop policy if exists helpdesk_tickets_select on public.helpdesk_tickets;
create policy helpdesk_tickets_select on public.helpdesk_tickets
for select to authenticated using (
  private.has_workspace_permission(workspace_id,'manage_helpdesk')
  or ((requester_user_id=(select auth.uid())) and private.is_workspace_member(workspace_id))
  or ((assigned_to=(select auth.uid())) and private.is_workspace_member(workspace_id))
);

-- The assignment RPC is privileged and constrained; direct updates remain managers only.

create or replace function private.guard_helpdesk_requester_update()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_assignment_context boolean:=coalesce(current_setting('app.helpdesk_assignment_action',true),'')='1';
begin
  if v_assignment_context then return new; end if;
  if private.has_workspace_permission(old.workspace_id,'manage_helpdesk') then return new; end if;
  if old.requester_user_id is distinct from (select auth.uid()) then
    raise exception 'You cannot update this Helpdesk request';
  end if;
  if row(new.workspace_id,new.requester_user_id,new.assigned_to,new.status,new.due_at,new.first_response_at,new.reviewed_at,new.attended_at,new.resolved_at,new.closed_at)
     is distinct from
     row(old.workspace_id,old.requester_user_id,old.assigned_to,old.status,old.due_at,old.first_response_at,old.reviewed_at,old.attended_at,old.resolved_at,old.closed_at) then
    raise exception 'Requesters cannot change internal Helpdesk handling fields';
  end if;
  return new;
end $$;

create or replace function private.capture_helpdesk_assignment()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_actor uuid:=(select auth.uid());
  v_source text;
begin
  if tg_op='INSERT' then
    if new.assigned_to is null then return new; end if;
  elsif old.assigned_to is not distinct from new.assigned_to or new.assigned_to is null then
    return new;
  end if;
  v_source:=coalesce(new.assignment_source,nullif(current_setting('app.helpdesk_assignment_source',true),''),'manual');
  insert into public.helpdesk_assignment_log(workspace_id,helpdesk_ticket_id,assigned_user_id,previous_user_id,source,reason,confidence,actor_id)
  values(new.workspace_id,new.id,new.assigned_to,case when tg_op='UPDATE' then old.assigned_to else null end,v_source,new.assignment_reason,new.assignment_confidence,v_actor);
  update public.helpdesk_assignment_queue
  set status='assigned',assigned_user_id=new.assigned_to,assigned_at=now(),updated_at=now(),reason=coalesce(new.assignment_reason,reason)
  where helpdesk_ticket_id=new.id;
  return new;
end $$;
revoke all on function private.capture_helpdesk_assignment() from public,anon,authenticated;
drop trigger if exists trg_helpdesk_assignment_log_insert on public.helpdesk_tickets;
create trigger trg_helpdesk_assignment_log_insert after insert on public.helpdesk_tickets for each row execute function private.capture_helpdesk_assignment();
drop trigger if exists trg_helpdesk_assignment_log_update on public.helpdesk_tickets;
create trigger trg_helpdesk_assignment_log_update after update of assigned_to on public.helpdesk_tickets for each row execute function private.capture_helpdesk_assignment();

create or replace function private.enqueue_helpdesk_auto_assignment()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_enabled boolean:=true;
begin
  if new.category in ('module','feature','new_requirement') or new.assigned_to is not null then return new; end if;
  select coalesce(helpdesk_auto_assignment_enabled,true) into v_enabled from public.workspace_settings where workspace_id=new.workspace_id;
  if not v_enabled then return new; end if;
  insert into public.helpdesk_assignment_queue(workspace_id,helpdesk_ticket_id,status,reason,queued_at,updated_at)
  values(new.workspace_id,new.id,'waiting','Pendiente de análisis automático.',now(),now())
  on conflict(helpdesk_ticket_id) do update set status='waiting',reason='Pendiente de análisis automático.',updated_at=now();
  perform set_config('app.helpdesk_assignment_action','1',true);
  update public.helpdesk_tickets set assignment_source='queue',assignment_reason='Pendiente de análisis automático.',assignment_queued_at=now() where id=new.id;
  return new;
end $$;
revoke all on function private.enqueue_helpdesk_auto_assignment() from public,anon,authenticated;
drop trigger if exists trg_helpdesk_auto_queue on public.helpdesk_tickets;
create trigger trg_helpdesk_auto_queue after insert on public.helpdesk_tickets for each row execute function private.enqueue_helpdesk_auto_assignment();

create or replace function private.drain_helpdesk_queue_on_capacity_release()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if coalesce(current_setting('app.helpdesk_queue_draining',true),'')='1' then return new; end if;
  if (old.assigned_to is distinct from new.assigned_to and old.assigned_to is not null)
     or (old.status not in ('resolved','closed') and new.status in ('resolved','closed')) then
    perform public.process_helpdesk_assignment_queue(new.workspace_id);
  end if;
  return new;
end $$;
revoke all on function private.drain_helpdesk_queue_on_capacity_release() from public,anon,authenticated;
drop trigger if exists trg_helpdesk_queue_drain on public.helpdesk_tickets;
create trigger trg_helpdesk_queue_drain after update of assigned_to,status on public.helpdesk_tickets for each row execute function private.drain_helpdesk_queue_on_capacity_release();

-- Seed sensible defaults when a new workspace is created.
create or replace function private.bootstrap_workspace()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_super_role uuid;
begin
  perform private.seed_workspace_roles(new.id);
  select id into v_super_role from public.workspace_roles where workspace_id=new.id and code='superadmin';
  if new.created_by is not null then
    insert into public.workspace_members(workspace_id,user_id,role,role_id,active,all_products,helpdesk_auto_assign_enabled)
    values(new.id,new.created_by,'superadmin',v_super_role,true,true,true)
    on conflict (workspace_id,user_id) do update set role='superadmin',role_id=v_super_role,active=true,all_products=true,permissions='{}'::jsonb,helpdesk_auto_assign_enabled=true;
  end if;
  insert into public.products(workspace_id,name,key,description,board_order) values
    (new.id,'Web Administrativa','ADM','Administración interna y operación',1),
    (new.id,'Web Socios','SOC','Portal web para socios/inversionistas',2),
    (new.id,'App Socios','APP','Aplicación móvil para socios/inversionistas',3),
    (new.id,'Automatizaciones','AUT','Automatizaciones, integraciones, jobs y procesos automáticos',4),
    (new.id,'Panel Financiero','FIN','Paneles, conciliación, indicadores y seguimiento financiero',5)
  on conflict (workspace_id,key) do update set name=excluded.name,description=excluded.description,board_order=excluded.board_order;
  insert into public.workspace_settings(workspace_id,helpdesk_auto_assignment_enabled,helpdesk_default_daily_limit,helpdesk_default_active_limit,helpdesk_default_overflow_mode,helpdesk_default_overflow_user_id)
  values(new.id,true,4,4,'fallback',new.created_by)
  on conflict (workspace_id) do nothing;
  insert into public.helpdesk_departments(workspace_id,name,color,active) values
    (new.id,'Reservaciones','#0D47A1',true),(new.id,'Recepción','#4D5A51',true),(new.id,'Gerencia','#21343E',true),(new.id,'Administración','#CA6832',true),(new.id,'Aperturas','#249F58',true),(new.id,'Marketing','#AE6A3E',true),(new.id,'Callcenter','#007BFF',true),(new.id,'Plataforma','#056D25',true),(new.id,'Atención a clientes','#D4DCE0',true),(new.id,'Atención a socios','#FF6363',true)
  on conflict (workspace_id,name) do update set color=excluded.color,active=true;
  perform private.seed_helpdesk_request_types(new.id);
  return new;
end $$;

-- Realtime for queue/capacity changes.
do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='helpdesk_assignment_queue') then
    alter publication supabase_realtime add table public.helpdesk_assignment_queue;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='helpdesk_assignment_log') then
    alter publication supabase_realtime add table public.helpdesk_assignment_log;
  end if;
end $$;

-- Drain queue every minute so daily limits automatically reopen after midnight too.
do $$
begin
  if exists(select 1 from cron.job where jobname='jira-helpdesk-assignment-queue') then
    perform cron.unschedule('jira-helpdesk-assignment-queue');
  end if;
  perform cron.schedule('jira-helpdesk-assignment-queue','* * * * *','select public.process_helpdesk_assignment_queue(null);');
exception when undefined_table or invalid_schema_name then
  null;
end $$;

-- v16.8 compatibility: assignees may be specialized team members without Helpdesk admin rights.
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
  ) then
    raise exception 'Requester must be an active member of the workspace';
  end if;
  if (tg_op='INSERT' or new.assigned_to is distinct from old.assigned_to)
     and new.assigned_to is not null
     and not private.helpdesk_member_routable(new.workspace_id,new.assigned_to) then
    raise exception 'Helpdesk assignee must be an active eligible team member in the workspace';
  end if;
  return new;
end $$;
revoke all on function private.validate_helpdesk_people() from public,anon,authenticated;

-- v16.8 internal queue drain must not grant queue-processing rights to assignees.
create or replace function public.process_helpdesk_assignment_queue(p_workspace uuid default null)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  r record;
  result jsonb;
  processed int:=0;
  assigned int:=0;
  caller uuid:=(select auth.uid());
  internal_call boolean:=coalesce(current_setting('app.helpdesk_internal_queue',true),'')='1';
begin
  if caller is not null and not internal_call and p_workspace is not null
     and not private.has_workspace_permission(p_workspace,'manage_helpdesk')
     and not private.has_workspace_permission(p_workspace,'manage_staff') then
    raise exception 'Insufficient Helpdesk permissions';
  end if;
  if coalesce(current_setting('app.helpdesk_queue_draining',true),'')='1' then
    return jsonb_build_object('processed',0,'assigned',0,'skipped','already_draining');
  end if;
  perform set_config('app.helpdesk_queue_draining','1',true);
  for r in
    select q.helpdesk_ticket_id
    from public.helpdesk_assignment_queue q
    join public.helpdesk_tickets h on h.id=q.helpdesk_ticket_id
    where q.status='waiting'
      and (p_workspace is null or q.workspace_id=p_workspace)
      and h.assigned_to is null
      and h.status not in ('resolved','closed')
    order by q.queued_at
    limit 50
  loop
    processed:=processed+1;
    result:=private.route_helpdesk_ticket_rules(r.helpdesk_ticket_id);
    if coalesce((result->>'assigned')::boolean,false) then assigned:=assigned+1; end if;
  end loop;
  return jsonb_build_object('processed',processed,'assigned',assigned);
end $$;
revoke all on function public.process_helpdesk_assignment_queue(uuid) from public,anon;
grant execute on function public.process_helpdesk_assignment_queue(uuid) to authenticated;

create or replace function private.drain_helpdesk_queue_on_capacity_release()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if coalesce(current_setting('app.helpdesk_queue_draining',true),'')='1' then return new; end if;
  if (old.assigned_to is distinct from new.assigned_to and old.assigned_to is not null)
     or (old.status not in ('resolved','closed') and new.status in ('resolved','closed')) then
    perform set_config('app.helpdesk_internal_queue','1',true);
    perform public.process_helpdesk_assignment_queue(new.workspace_id);
  end if;
  return new;
end $$;
revoke all on function private.drain_helpdesk_queue_on_capacity_release() from public,anon,authenticated;

-- v16.8 assigned specialist access: comments/evidence without Helpdesk admin rights.
drop policy if exists helpdesk_comments_select on public.helpdesk_comments;
create policy helpdesk_comments_select on public.helpdesk_comments for select to authenticated using (
  exists(select 1 from public.helpdesk_tickets h where h.id=helpdesk_comments.helpdesk_ticket_id and private.is_workspace_member(h.workspace_id)
    and (private.has_workspace_permission(h.workspace_id,'manage_helpdesk') or h.requester_user_id=(select auth.uid()) or h.assigned_to=(select auth.uid())))
);
drop policy if exists helpdesk_comments_insert on public.helpdesk_comments;
create policy helpdesk_comments_insert on public.helpdesk_comments for insert to authenticated with check (
  author_id=(select auth.uid()) and exists(select 1 from public.helpdesk_tickets h where h.id=helpdesk_comments.helpdesk_ticket_id and private.is_workspace_member(h.workspace_id)
    and (private.has_workspace_permission(h.workspace_id,'manage_helpdesk') or h.requester_user_id=(select auth.uid()) or h.assigned_to=(select auth.uid())))
);
drop policy if exists helpdesk_comments_update on public.helpdesk_comments;
create policy helpdesk_comments_update on public.helpdesk_comments for update to authenticated
using (author_id=(select auth.uid()) and exists(select 1 from public.helpdesk_tickets h where h.id=helpdesk_comments.helpdesk_ticket_id and private.is_workspace_member(h.workspace_id)
  and (private.has_workspace_permission(h.workspace_id,'manage_helpdesk') or h.requester_user_id=(select auth.uid()) or h.assigned_to=(select auth.uid()))))
with check (author_id=(select auth.uid()) and exists(select 1 from public.helpdesk_tickets h where h.id=helpdesk_comments.helpdesk_ticket_id and private.is_workspace_member(h.workspace_id)
  and (private.has_workspace_permission(h.workspace_id,'manage_helpdesk') or h.requester_user_id=(select auth.uid()) or h.assigned_to=(select auth.uid()))));
drop policy if exists helpdesk_comments_delete on public.helpdesk_comments;
create policy helpdesk_comments_delete on public.helpdesk_comments for delete to authenticated using (
  author_id=(select auth.uid()) and exists(select 1 from public.helpdesk_tickets h where h.id=helpdesk_comments.helpdesk_ticket_id and private.is_workspace_member(h.workspace_id)
    and (private.has_workspace_permission(h.workspace_id,'manage_helpdesk') or h.requester_user_id=(select auth.uid()) or h.assigned_to=(select auth.uid())))
);
drop policy if exists helpdesk_attachments_select on public.helpdesk_attachments;
create policy helpdesk_attachments_select on public.helpdesk_attachments for select to authenticated using (
  exists(select 1 from public.helpdesk_tickets h where h.id=helpdesk_attachments.helpdesk_ticket_id and h.workspace_id=helpdesk_attachments.workspace_id and private.is_workspace_member(h.workspace_id)
    and (private.has_workspace_permission(h.workspace_id,'manage_helpdesk') or h.requester_user_id=(select auth.uid()) or h.assigned_to=(select auth.uid())))
);
drop policy if exists helpdesk_attachments_insert on public.helpdesk_attachments;
create policy helpdesk_attachments_insert on public.helpdesk_attachments for insert to authenticated with check (
  uploaded_by=(select auth.uid()) and exists(select 1 from public.helpdesk_tickets h where h.id=helpdesk_attachments.helpdesk_ticket_id and h.workspace_id=helpdesk_attachments.workspace_id and private.is_workspace_member(h.workspace_id)
    and (private.has_workspace_permission(h.workspace_id,'manage_helpdesk') or h.requester_user_id=(select auth.uid()) or h.assigned_to=(select auth.uid())))
  and (comment_id is null or exists(select 1 from public.helpdesk_comments c where c.id=comment_id and c.helpdesk_ticket_id=helpdesk_ticket_id))
);

create or replace function private.can_view_evidence_object(p_name text)
returns boolean language plpgsql stable security definer set search_path=public,storage,pg_temp as $$
declare v_workspace uuid;v_parent uuid;v_scope text;
begin
  v_workspace:=split_part(p_name,'/',1)::uuid;v_scope:=split_part(p_name,'/',2);v_parent:=split_part(p_name,'/',3)::uuid;
  if v_scope='tickets' then return exists(select 1 from public.tickets t where t.id=v_parent and t.workspace_id=v_workspace and private.has_workspace_permission(v_workspace,'view_tickets') and private.has_product_access(v_workspace,t.product_id));
  elsif v_scope='sprints' then return exists(select 1 from public.sprints s where s.id=v_parent and s.workspace_id=v_workspace and private.has_workspace_permission(v_workspace,'view_dashboard'));
  elsif v_scope='helpdesk' then return exists(select 1 from public.helpdesk_tickets h where h.id=v_parent and h.workspace_id=v_workspace and private.is_workspace_member(v_workspace) and (private.has_workspace_permission(v_workspace,'manage_helpdesk') or h.requester_user_id=(select auth.uid()) or h.assigned_to=(select auth.uid())));
  elsif v_scope='knowledge' then return exists(select 1 from public.knowledge_articles a where a.id=v_parent and a.workspace_id=v_workspace and private.is_workspace_member(v_workspace) and (a.status='published' or private.has_workspace_permission(v_workspace,'manage_settings')));end if;
  return false;exception when invalid_text_representation then return false;
end $$;
create or replace function private.can_upload_evidence_object(p_name text)
returns boolean language plpgsql stable security definer set search_path=public,storage,pg_temp as $$
declare v_workspace uuid;v_parent uuid;v_scope text;
begin
  v_workspace:=split_part(p_name,'/',1)::uuid;v_scope:=split_part(p_name,'/',2);v_parent:=split_part(p_name,'/',3)::uuid;
  if v_scope='tickets' then return exists(select 1 from public.tickets t where t.id=v_parent and t.workspace_id=v_workspace and private.has_workspace_permission(v_workspace,'edit_tickets') and private.has_product_access(v_workspace,t.product_id));
  elsif v_scope='sprints' then return exists(select 1 from public.sprints s where s.id=v_parent and s.workspace_id=v_workspace and private.has_workspace_permission(v_workspace,'edit_tickets'));
  elsif v_scope='helpdesk' then return exists(select 1 from public.helpdesk_tickets h where h.id=v_parent and h.workspace_id=v_workspace and private.is_workspace_member(v_workspace) and (private.has_workspace_permission(v_workspace,'manage_helpdesk') or h.requester_user_id=(select auth.uid()) or h.assigned_to=(select auth.uid())));
  elsif v_scope='knowledge' then return exists(select 1 from public.knowledge_articles a where a.id=v_parent and a.workspace_id=v_workspace and private.has_workspace_permission(v_workspace,'manage_settings'));end if;
  return false;exception when invalid_text_representation then return false;
end $$;


-- v16.8 current TROBBU workspace: Gustavo Chan is the unlimited default overflow fallback.
update public.workspace_members
set helpdesk_auto_assign_enabled=true,
    helpdesk_daily_limit=0,
    helpdesk_active_limit=0
where workspace_id='13345ea4-59e7-4d65-874c-f13a131647d4'
  and user_id='2ab7d928-9ffe-4b72-a433-cde74a9c9518';

-- v16.8 Staff capacity summary wrapper dependency.
-- private schema is not exposed by the Data API; this grant lets the validated public wrapper call the helper.
grant execute on function private.helpdesk_member_capacity(uuid,uuid) to authenticated;

-- v16.8 security hardening: keep privileged mutations in private schema and expose SECURITY INVOKER wrappers.
create or replace function private.assign_helpdesk_ticket_impl(p_ticket_id uuid,p_assignee uuid,p_comment text default null)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_workspace uuid;v_key text;v_category text;v_current uuid;v_caller uuid:=(select auth.uid());
  v_comment text:=nullif(btrim(coalesce(p_comment,'')),'');v_manager boolean:=false;v_redirect boolean:=false;
begin
  if v_caller is null then raise exception 'Authentication required'; end if;
  select workspace_id,ticket_key,category,assigned_to into v_workspace,v_key,v_category,v_current from public.helpdesk_tickets where id=p_ticket_id;
  if v_workspace is null then raise exception 'Helpdesk ticket not found'; end if;
  v_manager:=private.has_workspace_permission(v_workspace,'manage_helpdesk');v_redirect:=v_current=v_caller;
  if not v_manager and not v_redirect then raise exception 'Insufficient Helpdesk permissions'; end if;
  if v_category in ('module','feature','new_requirement') then raise exception 'Requirement proposals are handled through the decision flow'; end if;
  if p_assignee is null or not private.helpdesk_member_routable(v_workspace,p_assignee) then raise exception 'The selected assignee is not an active team member eligible for Helpdesk'; end if;
  if v_comment is not null and char_length(v_comment)>4000 then raise exception 'Assignment comment is too long'; end if;
  perform set_config('app.helpdesk_assignment_action','1',true);
  perform set_config('app.helpdesk_assignment_source',case when v_redirect and not v_manager then 'redirect' else 'manual' end,true);
  update public.helpdesk_tickets set assigned_to=p_assignee,
      assignment_source=case when v_redirect and not v_manager then 'redirect' else 'manual' end,
      assignment_reason=case when v_redirect and not v_manager then coalesce(v_comment,'Redirigido por el responsable anterior.') else v_comment end,
      assignment_confidence=null,assignment_queued_at=null,assignment_last_routed_at=now()
  where id=p_ticket_id;
  if v_comment is not null then insert into public.helpdesk_comments(helpdesk_ticket_id,author_id,body) values(p_ticket_id,v_caller,v_comment); end if;
  return jsonb_build_object('ticket_id',p_ticket_id,'ticket_key',v_key,'assigned_to',p_assignee,'redirected',v_redirect and not v_manager,'comment_added',v_comment is not null);
end $$;
revoke all on function private.assign_helpdesk_ticket_impl(uuid,uuid,text) from public,anon;
grant execute on function private.assign_helpdesk_ticket_impl(uuid,uuid,text) to authenticated;

create or replace function public.assign_helpdesk_ticket(p_ticket_id uuid,p_assignee uuid,p_comment text default null)
returns jsonb language sql security invoker set search_path=public,private,pg_temp
as $$ select private.assign_helpdesk_ticket_impl(p_ticket_id,p_assignee,p_comment) $$;
revoke all on function public.assign_helpdesk_ticket(uuid,uuid,text) from public,anon;
grant execute on function public.assign_helpdesk_ticket(uuid,uuid,text) to authenticated;

create or replace function private.process_helpdesk_assignment_queue_impl(p_workspace uuid default null)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp
as $$
declare r record;result jsonb;processed int:=0;assigned int:=0;caller uuid:=(select auth.uid());internal_call boolean:=coalesce(current_setting('app.helpdesk_internal_queue',true),'')='1';
begin
  if caller is not null and not internal_call and p_workspace is not null
     and not private.has_workspace_permission(p_workspace,'manage_helpdesk') and not private.has_workspace_permission(p_workspace,'manage_staff') then raise exception 'Insufficient Helpdesk permissions'; end if;
  if coalesce(current_setting('app.helpdesk_queue_draining',true),'')='1' then return jsonb_build_object('processed',0,'assigned',0,'skipped','already_draining'); end if;
  perform set_config('app.helpdesk_queue_draining','1',true);
  for r in select q.helpdesk_ticket_id from public.helpdesk_assignment_queue q join public.helpdesk_tickets h on h.id=q.helpdesk_ticket_id
    where q.status='waiting' and (p_workspace is null or q.workspace_id=p_workspace) and h.assigned_to is null and h.status not in ('resolved','closed') order by q.queued_at limit 50
  loop processed:=processed+1;result:=private.route_helpdesk_ticket_rules(r.helpdesk_ticket_id);if coalesce((result->>'assigned')::boolean,false) then assigned:=assigned+1;end if;end loop;
  return jsonb_build_object('processed',processed,'assigned',assigned);
end $$;
revoke all on function private.process_helpdesk_assignment_queue_impl(uuid) from public,anon;
grant execute on function private.process_helpdesk_assignment_queue_impl(uuid) to authenticated;

create or replace function public.process_helpdesk_assignment_queue(p_workspace uuid default null)
returns jsonb language plpgsql security invoker set search_path=public,private,pg_temp
as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_workspace is null then raise exception 'workspace_id is required'; end if;
  if not private.has_workspace_permission(p_workspace,'manage_helpdesk') and not private.has_workspace_permission(p_workspace,'manage_staff') then raise exception 'Insufficient Helpdesk permissions'; end if;
  return private.process_helpdesk_assignment_queue_impl(p_workspace);
end $$;
revoke all on function public.process_helpdesk_assignment_queue(uuid) from public,anon;
grant execute on function public.process_helpdesk_assignment_queue(uuid) to authenticated;

create or replace function private.drain_helpdesk_queue_on_capacity_release()
returns trigger language plpgsql security definer set search_path=public,pg_temp
as $$
begin
  if coalesce(current_setting('app.helpdesk_queue_draining',true),'')='1' then return new; end if;
  if (old.assigned_to is distinct from new.assigned_to and old.assigned_to is not null) or (old.status not in ('resolved','closed') and new.status in ('resolved','closed')) then
    perform set_config('app.helpdesk_internal_queue','1',true);perform private.process_helpdesk_assignment_queue_impl(new.workspace_id);
  end if;
  return new;
end $$;
revoke all on function private.drain_helpdesk_queue_on_capacity_release() from public,anon,authenticated;

select cron.unschedule('jira-helpdesk-assignment-queue') where exists(select 1 from cron.job where jobname='jira-helpdesk-assignment-queue');
select cron.schedule('jira-helpdesk-assignment-queue','* * * * *','select private.process_helpdesk_assignment_queue_impl(null);');

create index if not exists idx_helpdesk_assignment_log_assigned_user on public.helpdesk_assignment_log(assigned_user_id);
create index if not exists idx_helpdesk_assignment_log_previous_user on public.helpdesk_assignment_log(previous_user_id) where previous_user_id is not null;
create index if not exists idx_workspace_members_helpdesk_overflow_user on public.workspace_members(helpdesk_overflow_user_id) where helpdesk_overflow_user_id is not null;
