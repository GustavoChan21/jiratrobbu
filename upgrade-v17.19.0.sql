-- Jira Interno TROBBU v17.19.0
-- Integrity, realtime, audit metrics, vacations business days, mentions/staff support.
begin;

create or replace function private.vacation_units_for_year(p_blocks jsonb,p_fraction numeric,p_year integer)
returns numeric language plpgsql immutable security invoker set search_path=public,pg_temp as $$
declare b jsonb;s date;e date;ys date:=make_date(p_year,1,1);ye date:=make_date(p_year,12,31);a date;z date;total numeric:=0;v_work_units numeric:=0;
begin
  if jsonb_typeof(p_blocks)<>'array' then return 0; end if;
  for b in select value from jsonb_array_elements(p_blocks) loop
    begin s=(b->>'start_date')::date;e=(b->>'end_date')::date;exception when others then continue;end;
    a=greatest(s,ys);z=least(e,ye);
    if z>=a then select count(*)::numeric*coalesce(p_fraction,1) into v_work_units from generate_series(a,z,interval '1 day') d where extract(isodow from d)<6; total=total+coalesce(v_work_units,0); end if;
  end loop;
  return total;
end $$;
revoke all on function private.vacation_units_for_year(jsonb,numeric,integer) from public,anon,authenticated;

create or replace function private.guard_vacation_request()
returns trigger language plpgsql security definer set search_path=public,private,pg_temp as $$
declare
  v_service boolean:=coalesce((nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role'),current_setting('request.jwt.claim.role',true),'')='service_role';
  v_manage boolean;
  v_type public.vacation_types%rowtype;
  v_block jsonb;v_norm jsonb:='[]'::jsonb;
  v_start date;v_end date;v_return date;v_min date;v_max date;v_return_max date;
  v_calendar_days int:=0;v_block_business_days int:=0;v_count int:=0;v_year int;v_requested numeric;v_existing numeric;v_allowed numeric;v_adjustment numeric;
begin
  v_manage:=v_service or private.has_workspace_permission(new.workspace_id,'manage_vacations');
  if not exists(select 1 from public.workspace_members wm where wm.workspace_id=new.workspace_id and wm.user_id=new.user_id and wm.active=true) then
    raise exception 'Vacation requester must be an active member of the workspace';
  end if;

  if new.vacation_type_id is null then
    select * into v_type from public.vacation_types where workspace_id=new.workspace_id and code='vacation' and active=true limit 1;
    new.vacation_type_id:=v_type.id;
  else
    select * into v_type from public.vacation_types where id=new.vacation_type_id and workspace_id=new.workspace_id;
  end if;
  if v_type.id is null then raise exception 'Selecciona un tipo de ausencia válido'; end if;
  if tg_op='INSERT' and not v_type.active then raise exception 'El tipo de ausencia seleccionado está desactivado'; end if;
  if tg_op='UPDATE' and new.vacation_type_id is distinct from old.vacation_type_id and not v_type.active then raise exception 'El tipo de ausencia seleccionado está desactivado'; end if;

  if new.date_blocks is null or jsonb_typeof(new.date_blocks)<>'array' or jsonb_array_length(new.date_blocks)=0 then
    new.date_blocks:=jsonb_build_array(jsonb_build_object('id','legacy','start_date',to_char(new.start_date,'YYYY-MM-DD'),'end_date',to_char(new.end_date,'YYYY-MM-DD'),'return_date',to_char(coalesce(new.return_date,new.end_date+1),'YYYY-MM-DD')));
  end if;

  for v_block in select value from jsonb_array_elements(new.date_blocks) loop
    v_count:=v_count+1;
    begin
      v_start:=nullif(v_block->>'start_date','')::date;v_end:=nullif(v_block->>'end_date','')::date;v_return:=coalesce(nullif(v_block->>'return_date','')::date,v_end+1);
    exception when others then raise exception 'Cada bloque debe contener fechas válidas';end;
    if v_start is null or v_end is null or v_end<v_start then raise exception 'Cada bloque requiere fecha de inicio y fin válidas';end if;
    if v_return<=v_end then raise exception 'La fecha de reincorporación debe ser posterior al fin de cada bloque';end if;
    if v_type.day_fraction=0.50 and v_end<>v_start then raise exception 'El tipo Medio día requiere bloques de un solo día';end if;
    select count(*)::int into v_block_business_days from generate_series(v_start,v_end,interval '1 day') d where extract(isodow from d)<6; if coalesce(v_block_business_days,0)=0 then raise exception 'Cada bloque debe incluir al menos un día hábil de lunes a viernes'; end if; v_calendar_days:=v_calendar_days+v_block_business_days;
    if v_min is null or v_start<v_min then v_min:=v_start;end if;
    if v_max is null or v_end>v_max then v_max:=v_end;end if;
    if v_return_max is null or v_return>v_return_max then v_return_max:=v_return;end if;
    v_norm:=v_norm||jsonb_build_array(jsonb_build_object('id',coalesce(nullif(v_block->>'id',''),gen_random_uuid()::text),'start_date',to_char(v_start,'YYYY-MM-DD'),'end_date',to_char(v_end,'YYYY-MM-DD'),'return_date',to_char(v_return,'YYYY-MM-DD')));
  end loop;

  if v_count<1 or v_count>8 then raise exception 'Una solicitud permite entre 1 y 8 bloques';end if;
  if v_calendar_days>61 then raise exception 'La suma de los bloques no puede superar 61 días';end if;
  if exists(
    select 1 from jsonb_array_elements(v_norm) with ordinality a(value,idx)
    join jsonb_array_elements(v_norm) with ordinality b(value,idx) on a.idx<b.idx
    where (a.value->>'start_date')::date<=(b.value->>'end_date')::date
      and (a.value->>'end_date')::date>=(b.value->>'start_date')::date
  ) then raise exception 'Los bloques de una misma solicitud no pueden traslaparse';end if;

  new.date_blocks:=v_norm;new.start_date:=v_min;new.end_date:=v_max;new.return_date:=v_return_max;
  if v_type.requires_half_day_period or v_type.day_fraction=0.50 then
    if new.half_day_period not in ('first_half','second_half') then raise exception 'Selecciona primera o segunda mitad del día';end if;
  else new.half_day_period:=null; end if;
  new.absence_days:=v_calendar_days*v_type.day_fraction;
  new.charged_days:=case when v_type.deducts_from_balance then new.absence_days else 0 end;

  if tg_op='INSERT' then
    if not v_manage then
      new.decision_by:=null;new.decided_by:=null;new.decision_note:=null;new.decided_at:=null;
      new.ai_risk:=null;new.ai_recommendation:=null;new.ai_summary:=null;new.ai_analysis:='{}'::jsonb;new.ai_analyzed_at:=null;
      new.assistant_recommendation:=null;new.assistant_confidence:=null;new.assistant_analysis:=null;new.assistant_snapshot:='{}'::jsonb;new.assistant_provider:=null;new.analyzed_at:=null;
    end if;
  else
    if old.status<>'pending' and new.status is distinct from old.status then raise exception 'Only pending vacation requests can change status';end if;
    if new.date_blocks is distinct from old.date_blocks or new.user_id is distinct from old.user_id or new.vacation_type_id is distinct from old.vacation_type_id or new.half_day_period is distinct from old.half_day_period then
      new.ai_risk:=null;new.ai_recommendation:=null;new.ai_summary:=null;new.ai_analysis:='{}'::jsonb;new.ai_analyzed_at:=null;
      new.assistant_recommendation:=null;new.assistant_confidence:=null;new.assistant_analysis:=null;new.assistant_snapshot:='{}'::jsonb;new.assistant_provider:=null;new.analyzed_at:=null;
    end if;
    if not v_manage then
      if new.workspace_id is distinct from old.workspace_id or new.user_id is distinct from old.user_id then raise exception 'Requester cannot change workspace or owner';end if;
      if new.decision_by is distinct from old.decision_by or new.decided_by is distinct from old.decided_by or new.decision_note is distinct from old.decision_note or new.decided_at is distinct from old.decided_at
         or new.ai_risk is distinct from old.ai_risk or new.ai_recommendation is distinct from old.ai_recommendation or new.ai_summary is distinct from old.ai_summary or new.ai_analysis is distinct from old.ai_analysis or new.ai_analyzed_at is distinct from old.ai_analyzed_at
         or new.assistant_recommendation is distinct from old.assistant_recommendation or new.assistant_analysis is distinct from old.assistant_analysis or new.assistant_snapshot is distinct from old.assistant_snapshot or new.analyzed_at is distinct from old.analyzed_at then
        raise exception 'Decision and AI analysis fields are restricted';
      end if;
      if new.status not in ('pending','cancelled') then raise exception 'Requester can only keep pending or cancel the request';end if;
    end if;
  end if;

  if new.status in ('pending','approved') and exists(
    select 1 from public.vacation_requests vr
    join public.vacation_types ovt on ovt.id=vr.vacation_type_id
    cross join lateral jsonb_array_elements(vr.date_blocks) ob
    cross join lateral jsonb_array_elements(new.date_blocks) nb
    where vr.workspace_id=new.workspace_id and vr.user_id=new.user_id and vr.id<>new.id and vr.status in ('pending','approved')
      and (ob->>'start_date')::date<=(nb->>'end_date')::date and (ob->>'end_date')::date>=(nb->>'start_date')::date
      and not (v_type.day_fraction=0.50 and ovt.day_fraction=0.50 and coalesce(vr.half_day_period,'')<>coalesce(new.half_day_period,''))
  ) then raise exception 'Ya existe una solicitud pendiente o aprobada que se cruza con alguno de estos bloques';end if;

  if v_type.deducts_from_balance and new.status in ('pending','approved') then
    for v_year in extract(year from v_min)::int..extract(year from v_max)::int loop
      v_requested:=private.vacation_units_for_year(new.date_blocks,v_type.day_fraction,v_year);
      if v_requested<=0 then continue;end if;
      select coalesce(sum(private.vacation_units_for_year(vr.date_blocks,vt.day_fraction,v_year)),0) into v_existing
      from public.vacation_requests vr join public.vacation_types vt on vt.id=vr.vacation_type_id
      where vr.workspace_id=new.workspace_id and vr.user_id=new.user_id and vr.id<>new.id and vr.status in ('pending','approved') and vt.deducts_from_balance=true;
      select coalesce(vb.allowed_days,ws.vacation_default_annual_days,12),coalesce(vb.adjustment_used_days,0) into v_allowed,v_adjustment
      from public.workspace_settings ws left join public.vacation_balances vb on vb.workspace_id=ws.workspace_id and vb.user_id=new.user_id and vb.year=v_year
      where ws.workspace_id=new.workspace_id;
      v_allowed:=coalesce(v_allowed,12);v_adjustment:=coalesce(v_adjustment,0);
      if v_existing+v_adjustment+v_requested>v_allowed+0.0001 then raise exception 'Saldo insuficiente para %: disponibles %, solicitados %',v_year,greatest(0,v_allowed-v_adjustment-v_existing),v_requested;end if;
    end loop;
  end if;

  if new.status in ('approved','rejected') then
    if not v_service then new.decision_by=(select auth.uid());elsif new.decision_by is null then new.decision_by=(select auth.uid());end if;
    new.decided_by:=coalesce(new.decision_by,new.decided_by);
    new.decided_at=coalesce(new.decided_at,now());
  end if;

  -- Keep historical assistant fields synchronized for older clients/integrations.
  if new.ai_analyzed_at is not null then
    new.analyzed_at:=new.ai_analyzed_at;
    new.assistant_recommendation:=case new.ai_recommendation when 'approve' then 'approve' when 'approve_with_conditions' then 'review' when 'review' then 'review' when 'decline' then 'avoid' else null end;
    new.assistant_analysis:=new.ai_summary;
    new.assistant_snapshot:=coalesce(new.ai_analysis,'{}'::jsonb);
  end if;
  return new;
end $$;

revoke all on function private.guard_vacation_request() from public,anon,authenticated;

drop trigger if exists trg_guard_vacation_request on public.vacation_requests;
create trigger trg_guard_vacation_request before insert or update on public.vacation_requests
for each row execute function private.guard_vacation_request();

-- Recalculate historical request totals using business days only (Mon-Fri).
-- This is a controlled migration backfill, so bypass the request workflow guard for this statement only.
alter table public.vacation_requests disable trigger trg_guard_vacation_request;
update public.vacation_requests vr
set absence_days=private.vacation_units_for_year(vr.date_blocks,vt.day_fraction,extract(year from vr.start_date)::int)
                 + case when extract(year from vr.end_date)::int<>extract(year from vr.start_date)::int
                        then private.vacation_units_for_year(vr.date_blocks,vt.day_fraction,extract(year from vr.end_date)::int) else 0 end,
    charged_days=case when vt.deducts_from_balance then private.vacation_units_for_year(vr.date_blocks,vt.day_fraction,extract(year from vr.start_date)::int)
                 + case when extract(year from vr.end_date)::int<>extract(year from vr.start_date)::int
                        then private.vacation_units_for_year(vr.date_blocks,vt.day_fraction,extract(year from vr.end_date)::int) else 0 end else 0 end
from public.vacation_types vt
where vt.id=vr.vacation_type_id;
alter table public.vacation_requests enable trigger trg_guard_vacation_request;

-- Exact period metrics: avoids PostgREST row-limit based counters (the old 1000 symptom).
create or replace function public.get_audit_period_metrics(p_workspace uuid,p_date_from date,p_date_to date,p_timezone text default 'America/Merida')
returns jsonb
language plpgsql
stable
security definer
set search_path=public,private,pg_temp
as $$
declare v_actions bigint:=0;v_sessions bigint:=0;v_seconds bigint:=0;v_tz text:=coalesce(nullif(p_timezone,''),'America/Merida');
begin
  if p_date_from is null or p_date_to is null or p_date_to<p_date_from then raise exception 'Rango de fechas inválido'; end if;
  if not private.is_workspace_superadmin(p_workspace,(select auth.uid())) then raise exception 'Solo Superadmin puede consultar métricas de bitácora'; end if;
  select count(*) into v_actions from public.app_audit_events e where e.workspace_id=p_workspace and (e.created_at at time zone v_tz)::date between p_date_from and p_date_to;
  select count(*),coalesce(sum(s.active_seconds),0) into v_sessions,v_seconds from public.app_user_sessions s where s.workspace_id=p_workspace and (s.started_at at time zone v_tz)::date between p_date_from and p_date_to;
  return jsonb_build_object('actions_count',v_actions,'sessions_count',v_sessions,'active_seconds',v_seconds,'date_from',p_date_from,'date_to',p_date_to,'timezone',v_tz);
end $$;
revoke all on function public.get_audit_period_metrics(uuid,date,date,text) from public,anon;
grant execute on function public.get_audit_period_metrics(uuid,date,date,text) to authenticated;

-- Ensure live tables required by these flows are part of Supabase Realtime.
alter table public.vacation_requests replica identity full;
alter table public.workspace_members replica identity full;
alter table public.profiles replica identity full;
alter table public.ticket_mentions replica identity full;
alter table public.helpdesk_mentions replica identity full;
do $$ begin
  begin alter publication supabase_realtime add table public.vacation_requests; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.workspace_members; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.profiles; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.ticket_mentions; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.helpdesk_mentions; exception when duplicate_object then null; end;
end $$;

notify pgrst,'reload schema';
commit;
