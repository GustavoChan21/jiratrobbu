-- TROBBU Jira Interno v17.5
-- Knowledge native rich-text stabilization + configurable executive cover templates.
-- Baseline: v17.3.1 Final Completo. Re-runnable.

begin;

alter table public.workspace_settings
  add column if not exists knowledge_cover_templates jsonb not null default
  '{"forest":{"background":"#0C2B2A","background_alt":"#4D5A51","text":"#F8F2E8","accent":"#D1AA87","border":"#354A40","title_font":"Inter","body_font":"Inter"},"ivory":{"background":"#FFFDF9","background_alt":"#F1E4CD","text":"#26362F","accent":"#8A6345","border":"#E7D9C4","title_font":"Georgia","body_font":"Inter"},"midnight":{"background":"#07172E","background_alt":"#02488D","text":"#F7FAFF","accent":"#D1AA87","border":"#0B315A","title_font":"Inter","body_font":"Inter"}}'::jsonb;

-- Preserve custom values while filling every missing template/property.
with defaults as (
  select '{"forest":{"background":"#0C2B2A","background_alt":"#4D5A51","text":"#F8F2E8","accent":"#D1AA87","border":"#354A40","title_font":"Inter","body_font":"Inter"},"ivory":{"background":"#FFFDF9","background_alt":"#F1E4CD","text":"#26362F","accent":"#8A6345","border":"#E7D9C4","title_font":"Georgia","body_font":"Inter"},"midnight":{"background":"#07172E","background_alt":"#02488D","text":"#F7FAFF","accent":"#D1AA87","border":"#0B315A","title_font":"Inter","body_font":"Inter"}}'::jsonb as v
)
update public.workspace_settings ws
set knowledge_cover_templates=jsonb_build_object(
  'forest',(select v->'forest' from defaults)||coalesce(ws.knowledge_cover_templates->'forest','{}'::jsonb),
  'ivory',(select v->'ivory' from defaults)||coalesce(ws.knowledge_cover_templates->'ivory','{}'::jsonb),
  'midnight',(select v->'midnight' from defaults)||coalesce(ws.knowledge_cover_templates->'midnight','{}'::jsonb)
);

-- Re-normalize every existing article/version through the canonical v3 block
-- converter. This preserves legacy paragraph/text/heading/media blocks and
-- guarantees the v17.5 editor receives a supported shape without data loss.
update public.knowledge_articles
set content_blocks=private.normalize_knowledge_blocks_v3(content_blocks,content),
    content_schema_version=3;

update public.knowledge_article_versions
set content_blocks=private.normalize_knowledge_blocks_v3(content_blocks,content),
    content_schema_version=3;

comment on column public.workspace_settings.knowledge_cover_templates is
  'Workspace-level visual parameters for Knowledge executive cover templates.';

commit;

-- ============================================================================
-- TROBBU Jira Interno v17.5.2 · Vacations balance/types + v17.5.1 schema repair
-- This block is intentionally re-runnable and self-contained from v17.5.1.
-- ============================================================================

begin;

-- Workspace default used when a collaborator has no explicit annual balance row.
alter table public.workspace_settings
  add column if not exists vacation_default_annual_days numeric(6,2) not null default 12;

do $$ begin
  if not exists(select 1 from pg_constraint where conname='workspace_settings_vacation_default_days_check') then
    alter table public.workspace_settings add constraint workspace_settings_vacation_default_days_check
      check(vacation_default_annual_days>=0 and vacation_default_annual_days<=365);
  end if;
end $$;

-- Canonical vacation types. Every request belongs to one type; the type decides
-- whether it consumes the annual balance and whether it represents half days.
create table if not exists public.vacation_types(
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  deducts_from_balance boolean not null default true,
  day_fraction numeric(3,2) not null default 1,
  requires_half_day_period boolean not null default false,
  color text not null default '#0C66E4',
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,code),
  check(day_fraction in (0.50,1.00)),
  check(length(trim(code)) between 1 and 60),
  check(length(trim(name)) between 1 and 120)
);
alter table public.vacation_types enable row level security;
revoke all on public.vacation_types from anon;
grant select,insert,update,delete on public.vacation_types to authenticated;
drop policy if exists vacation_types_select on public.vacation_types;
create policy vacation_types_select on public.vacation_types for select to authenticated
using(private.is_workspace_member(workspace_id) and (
  private.has_workspace_permission(workspace_id,'view_vacations') or
  private.has_workspace_permission(workspace_id,'request_vacations') or
  private.has_workspace_permission(workspace_id,'manage_vacations')
));
drop policy if exists vacation_types_insert on public.vacation_types;
create policy vacation_types_insert on public.vacation_types for insert to authenticated
with check(private.has_workspace_permission(workspace_id,'manage_vacations'));
drop policy if exists vacation_types_update on public.vacation_types;
create policy vacation_types_update on public.vacation_types for update to authenticated
using(private.has_workspace_permission(workspace_id,'manage_vacations'))
with check(private.has_workspace_permission(workspace_id,'manage_vacations'));
drop policy if exists vacation_types_delete on public.vacation_types;
create policy vacation_types_delete on public.vacation_types for delete to authenticated
using(private.has_workspace_permission(workspace_id,'manage_vacations'));
drop trigger if exists trg_vacation_types_updated on public.vacation_types;
create trigger trg_vacation_types_updated before update on public.vacation_types
for each row execute function public.set_updated_at();

insert into public.vacation_types(workspace_id,code,name,description,deducts_from_balance,day_fraction,requires_half_day_period,color,sort_order,active)
select w.id,x.code,x.name,x.description,x.deducts,x.fraction,x.half_period,x.color,x.sort_order,true
from public.workspaces w
cross join (values
  ('vacation','Vacaciones','Vacaciones regulares que descuentan del saldo anual.',true,1.00::numeric,false,'#0C66E4',10),
  ('compensation','Compensación','Días compensatorios registrados sin descontar del saldo anual.',false,1.00::numeric,false,'#6554C0',20),
  ('half_day','Medio día','Ausencia de media jornada; requiere definir primera o segunda mitad.',true,0.50::numeric,true,'#CA6B2D',30),
  ('sickness','Enfermedad','Ausencia por enfermedad; por defecto no descuenta del saldo anual.',false,1.00::numeric,false,'#AE2E24',40)
) as x(code,name,description,deducts,fraction,half_period,color,sort_order)
on conflict(workspace_id,code) do nothing;

-- Per-member annual allowance and manual used-days adjustment. System usage is
-- intentionally calculated from requests, never manually duplicated here.
create table if not exists public.vacation_balances(
  workspace_id uuid not null,
  user_id uuid not null,
  year integer not null,
  allowed_days numeric(6,2) not null default 12,
  adjustment_used_days numeric(6,2) not null default 0,
  note text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(workspace_id,user_id,year),
  foreign key(workspace_id,user_id) references public.workspace_members(workspace_id,user_id) on delete cascade,
  check(year between 2000 and 2200),
  check(allowed_days>=0 and allowed_days<=365),
  check(adjustment_used_days>=0 and adjustment_used_days<=365)
);
alter table public.vacation_balances enable row level security;
revoke all on public.vacation_balances from anon;
grant select,insert,update,delete on public.vacation_balances to authenticated;
drop policy if exists vacation_balances_select on public.vacation_balances;
create policy vacation_balances_select on public.vacation_balances for select to authenticated
using(private.is_workspace_member(workspace_id) and (
  user_id=(select auth.uid()) or private.has_workspace_permission(workspace_id,'manage_vacations')
));
drop policy if exists vacation_balances_insert on public.vacation_balances;
create policy vacation_balances_insert on public.vacation_balances for insert to authenticated
with check(private.has_workspace_permission(workspace_id,'manage_vacations'));
drop policy if exists vacation_balances_update on public.vacation_balances;
create policy vacation_balances_update on public.vacation_balances for update to authenticated
using(private.has_workspace_permission(workspace_id,'manage_vacations'))
with check(private.has_workspace_permission(workspace_id,'manage_vacations'));
drop policy if exists vacation_balances_delete on public.vacation_balances;
create policy vacation_balances_delete on public.vacation_balances for delete to authenticated
using(private.has_workspace_permission(workspace_id,'manage_vacations'));
drop trigger if exists trg_vacation_balances_updated on public.vacation_balances;
create trigger trg_vacation_balances_updated before update on public.vacation_balances
for each row execute function public.set_updated_at();

-- Repair the exact v17.5.1 production mismatch: these columns may not exist if
-- v17.1 was never applied even though the v17.5.1 frontend already uses them.
alter table public.vacation_requests add column if not exists return_date date;
alter table public.vacation_requests add column if not exists date_blocks jsonb not null default '[]'::jsonb;
alter table public.vacation_requests add column if not exists decision_by uuid references auth.users(id) on delete set null;
alter table public.vacation_requests add column if not exists ai_risk text;
alter table public.vacation_requests add column if not exists ai_recommendation text;
alter table public.vacation_requests add column if not exists ai_summary text;
alter table public.vacation_requests add column if not exists ai_analysis jsonb not null default '{}'::jsonb;
alter table public.vacation_requests add column if not exists ai_analyzed_at timestamptz;
alter table public.vacation_requests add column if not exists vacation_type_id uuid;
alter table public.vacation_requests add column if not exists half_day_period text;
alter table public.vacation_requests add column if not exists absence_days numeric(7,2) not null default 0;
alter table public.vacation_requests add column if not exists charged_days numeric(7,2) not null default 0;

-- Temporarily remove the legacy vacation guard while historical rows are normalized.
-- The old v17.5.1 trigger can otherwise reject maintenance updates on finalized requests.
drop trigger if exists trg_guard_vacation_request on public.vacation_requests;

-- Preserve compatible legacy decision / assistant data when present.
do $$
begin
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='vacation_requests' and column_name='decided_by') then
    execute 'update public.vacation_requests set decision_by=coalesce(decision_by,decided_by) where decision_by is null';
  end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='vacation_requests' and column_name='analyzed_at') then
    execute 'update public.vacation_requests set ai_analyzed_at=coalesce(ai_analyzed_at,analyzed_at) where ai_analyzed_at is null';
  end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='vacation_requests' and column_name='assistant_analysis') then
    execute $q$update public.vacation_requests set ai_summary=coalesce(ai_summary,nullif(assistant_analysis,'')), ai_analysis=case when ai_analysis='{}'::jsonb and nullif(assistant_analysis,'') is not null then jsonb_build_object('legacy_analysis',assistant_analysis) else ai_analysis end$q$;
  end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='vacation_requests' and column_name='assistant_recommendation') then
    execute $q$update public.vacation_requests set ai_recommendation=coalesce(ai_recommendation,case lower(coalesce(assistant_recommendation,'')) when 'approve' then 'approve' when 'approve_with_conditions' then 'approve_with_conditions' when 'review' then 'review' when 'decline' then 'decline' else null end)$q$;
  end if;
end $$;

update public.vacation_requests
set return_date=coalesce(return_date,end_date+1),
    date_blocks=case when jsonb_typeof(date_blocks)='array' and jsonb_array_length(date_blocks)>0 then date_blocks else jsonb_build_array(jsonb_build_object(
      'id','legacy','start_date',to_char(start_date,'YYYY-MM-DD'),'end_date',to_char(end_date,'YYYY-MM-DD'),'return_date',to_char(coalesce(return_date,end_date+1),'YYYY-MM-DD')
    )) end
where return_date is null or jsonb_typeof(date_blocks)<>'array' or jsonb_array_length(date_blocks)=0;

update public.vacation_requests vr
set vacation_type_id=vt.id
from public.vacation_types vt
where vr.vacation_type_id is null and vt.workspace_id=vr.workspace_id and vt.code='vacation';

alter table public.vacation_requests alter column return_date set not null;
alter table public.vacation_requests alter column vacation_type_id set not null;

do $$
declare r record;
begin
  for r in select conname from pg_constraint where conrelid='public.vacation_requests'::regclass and contype='c' and pg_get_constraintdef(oid) ilike '%end_date%start_date%60%'
  loop execute format('alter table public.vacation_requests drop constraint %I',r.conname); end loop;
  if not exists(select 1 from pg_constraint where conname='vacation_requests_date_blocks_check') then
    alter table public.vacation_requests add constraint vacation_requests_date_blocks_check check(jsonb_typeof(date_blocks)='array' and jsonb_array_length(date_blocks) between 1 and 8);
  end if;
  if not exists(select 1 from pg_constraint where conname='vacation_requests_return_date_check') then
    alter table public.vacation_requests add constraint vacation_requests_return_date_check check(return_date>end_date);
  end if;
  if not exists(select 1 from pg_constraint where conname='vacation_requests_half_day_period_check') then
    alter table public.vacation_requests add constraint vacation_requests_half_day_period_check check(half_day_period is null or half_day_period in ('first_half','second_half'));
  end if;
  if not exists(select 1 from pg_constraint where conname='vacation_requests_vacation_type_fk') then
    alter table public.vacation_requests add constraint vacation_requests_vacation_type_fk foreign key(vacation_type_id) references public.vacation_types(id) on delete restrict;
  end if;
end $$;

create index if not exists idx_vacation_type_workspace on public.vacation_types(workspace_id,active,sort_order);
create index if not exists idx_vacation_balance_workspace_year on public.vacation_balances(workspace_id,year,user_id);
create index if not exists idx_vacation_request_type on public.vacation_requests(workspace_id,vacation_type_id,status);

create or replace function private.vacation_units_for_year(p_blocks jsonb,p_fraction numeric,p_year integer)
returns numeric language plpgsql immutable security invoker set search_path=public,pg_temp as $$
declare b jsonb;s date;e date;ys date:=make_date(p_year,1,1);ye date:=make_date(p_year,12,31);a date;z date;total numeric:=0;
begin
  if jsonb_typeof(p_blocks)<>'array' then return 0; end if;
  for b in select value from jsonb_array_elements(p_blocks) loop
    begin s=(b->>'start_date')::date;e=(b->>'end_date')::date;exception when others then continue;end;
    a=greatest(s,ys);z=least(e,ye);
    if z>=a then total=total+((z-a)+1)*coalesce(p_fraction,1); end if;
  end loop;
  return total;
end $$;
revoke all on function private.vacation_units_for_year(jsonb,numeric,integer) from public,anon,authenticated;

create or replace function private.guard_vacation_request()
returns trigger language plpgsql security definer set search_path=public,private,pg_temp as $$
declare
  v_service boolean:=coalesce(current_setting('request.jwt.claim.role',true),'')='service_role';
  v_manage boolean;
  v_type public.vacation_types%rowtype;
  v_block jsonb;v_norm jsonb:='[]'::jsonb;
  v_start date;v_end date;v_return date;v_min date;v_max date;v_return_max date;
  v_calendar_days int:=0;v_count int:=0;v_year int;v_requested numeric;v_existing numeric;v_allowed numeric;v_adjustment numeric;
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
    v_calendar_days:=v_calendar_days+(v_end-v_start+1);
    if v_min is null or v_start<v_min then v_min:=v_start;end if;if v_max is null or v_end>v_max then v_max:=v_end;end if;if v_return_max is null or v_return>v_return_max then v_return_max:=v_return;end if;
    v_norm:=v_norm||jsonb_build_array(jsonb_build_object('id',coalesce(nullif(v_block->>'id',''),gen_random_uuid()::text),'start_date',to_char(v_start,'YYYY-MM-DD'),'end_date',to_char(v_end,'YYYY-MM-DD'),'return_date',to_char(v_return,'YYYY-MM-DD')));
  end loop;
  if v_count<1 or v_count>8 then raise exception 'Una solicitud permite entre 1 y 8 bloques';end if;
  if v_calendar_days>61 then raise exception 'La suma de los bloques no puede superar 61 días';end if;
  if exists(select 1 from jsonb_array_elements(v_norm) with ordinality a(value,idx) join jsonb_array_elements(v_norm) with ordinality b(value,idx) on a.idx<b.idx where (a.value->>'start_date')::date<=(b.value->>'end_date')::date and (a.value->>'end_date')::date>=(b.value->>'start_date')::date) then
    raise exception 'Los bloques de una misma solicitud no pueden traslaparse';
  end if;

  new.date_blocks:=v_norm;new.start_date:=v_min;new.end_date:=v_max;new.return_date:=v_return_max;
  if v_type.requires_half_day_period or v_type.day_fraction=0.50 then
    if new.half_day_period not in ('first_half','second_half') then raise exception 'Selecciona primera o segunda mitad del día';end if;
  else new.half_day_period:=null;end if;
  new.absence_days:=v_calendar_days*v_type.day_fraction;
  new.charged_days:=case when v_type.deducts_from_balance then new.absence_days else 0 end;

  if tg_op='INSERT' then
    if not v_manage then new.decision_by:=null;new.decision_note:=null;new.decided_at:=null;new.ai_risk:=null;new.ai_recommendation:=null;new.ai_summary:=null;new.ai_analysis:='{}'::jsonb;new.ai_analyzed_at:=null;end if;
  else
    if old.status<>'pending' and new.status is distinct from old.status then raise exception 'Only pending vacation requests can change status';end if;
    if new.date_blocks is distinct from old.date_blocks or new.user_id is distinct from old.user_id or new.vacation_type_id is distinct from old.vacation_type_id or new.half_day_period is distinct from old.half_day_period then
      new.ai_risk:=null;new.ai_recommendation:=null;new.ai_summary:=null;new.ai_analysis:='{}'::jsonb;new.ai_analyzed_at:=null;
    end if;
    if not v_manage then
      if new.workspace_id is distinct from old.workspace_id or new.user_id is distinct from old.user_id then raise exception 'Requester cannot change workspace or owner';end if;
      if new.decision_by is distinct from old.decision_by or new.decision_note is distinct from old.decision_note or new.decided_at is distinct from old.decided_at or new.ai_risk is distinct from old.ai_risk or new.ai_recommendation is distinct from old.ai_recommendation or new.ai_summary is distinct from old.ai_summary or new.ai_analysis is distinct from old.ai_analysis or new.ai_analyzed_at is distinct from old.ai_analyzed_at then raise exception 'Decision and AI analysis fields are restricted';end if;
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
      if v_existing+v_adjustment+v_requested>v_allowed+0.0001 then
        raise exception 'Saldo insuficiente para %: disponibles %, solicitados %',v_year,greatest(0,v_allowed-v_adjustment-v_existing),v_requested;
      end if;
    end loop;
  end if;

  if new.status='approved' then
    if new.ai_analyzed_at is null or new.ai_analysis is null or new.ai_analysis='{}'::jsonb then raise exception 'Analyze sprint impact before approving vacations';end if;
    if new.ai_analyzed_at<now()-interval '12 hours' then raise exception 'Vacation impact analysis is stale; analyze again before approving';end if;
    if exists(select 1 from public.tickets t where t.workspace_id=new.workspace_id and (t.dev_owner_id=new.user_id or t.qa_owner_id=new.user_id) and t.status<>'closed' and t.updated_at>new.ai_analyzed_at) then raise exception 'Assigned work changed after the vacation analysis; analyze again before approving';end if;
    if exists(select 1 from public.sprints s cross join lateral jsonb_array_elements(new.date_blocks) nb where s.workspace_id=new.workspace_id and s.status in ('active','planned') and s.start_date<=(nb->>'end_date')::date and s.end_date>=(nb->>'start_date')::date and s.updated_at>new.ai_analyzed_at) then raise exception 'Sprint planning changed after the vacation analysis; analyze again before approving';end if;
    if exists(select 1 from public.vacation_requests vr cross join lateral jsonb_array_elements(vr.date_blocks) ob cross join lateral jsonb_array_elements(new.date_blocks) nb where vr.workspace_id=new.workspace_id and vr.id<>new.id and vr.status='approved' and (ob->>'start_date')::date<=(nb->>'end_date')::date and (ob->>'end_date')::date>=(nb->>'start_date')::date and vr.updated_at>new.ai_analyzed_at) then raise exception 'Team availability changed after the vacation analysis; analyze again before approving';end if;
  end if;

  if new.status in ('approved','rejected') then
    if not v_service then new.decision_by=(select auth.uid());elsif new.decision_by is null then new.decision_by=(select auth.uid());end if;
    new.decided_at=coalesce(new.decided_at,now());
  end if;
  return new;
end $$;
revoke all on function private.guard_vacation_request() from public,anon,authenticated;

-- Backfill authoritative counters for legacy requests while the guard trigger is
-- intentionally detached. This keeps approved/rejected historical rows migratable.
update public.vacation_requests vr
set absence_days=private.vacation_units_for_year(vr.date_blocks,vt.day_fraction,extract(year from vr.start_date)::int)
                + case when extract(year from vr.end_date)::int<>extract(year from vr.start_date)::int then private.vacation_units_for_year(vr.date_blocks,vt.day_fraction,extract(year from vr.end_date)::int) else 0 end,
    charged_days=case when vt.deducts_from_balance then
      private.vacation_units_for_year(vr.date_blocks,vt.day_fraction,extract(year from vr.start_date)::int)
      + case when extract(year from vr.end_date)::int<>extract(year from vr.start_date)::int then private.vacation_units_for_year(vr.date_blocks,vt.day_fraction,extract(year from vr.end_date)::int) else 0 end
    else 0 end
from public.vacation_types vt where vt.id=vr.vacation_type_id;

-- Re-enable the canonical v17.5.2 guard only after every historical request has
-- a normalized type, block structure and authoritative counters.
drop trigger if exists trg_guard_vacation_request on public.vacation_requests;
create trigger trg_guard_vacation_request before insert or update on public.vacation_requests
for each row execute function private.guard_vacation_request();

insert into public.vacation_balances(workspace_id,user_id,year,allowed_days,adjustment_used_days)
select wm.workspace_id,wm.user_id,extract(year from current_date)::int,coalesce(ws.vacation_default_annual_days,12),0
from public.workspace_members wm
join public.workspace_settings ws on ws.workspace_id=wm.workspace_id
where wm.active=true
on conflict(workspace_id,user_id,year) do nothing;

comment on table public.vacation_types is 'Workspace-configurable absence types. day_fraction controls full/half day units; deducts_from_balance controls annual allowance consumption.';
comment on table public.vacation_balances is 'Per-member annual vacation allowance and manual already-used adjustment. System occupied days are calculated from pending/approved requests.';
comment on column public.vacation_requests.charged_days is 'Balance-consuming units calculated by the database from type + blocks; never trusted from the client.';

commit;
