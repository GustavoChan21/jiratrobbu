-- Jira Interno TROBBU v17.1
-- Base requerida: v17.0
-- Regression fixes: Knowledge draft creation, multi-block vacations and vacation planning.

begin;

-- -----------------------------------------------------------------------------
-- 1) Knowledge: atomic initial draft creation
-- -----------------------------------------------------------------------------
create or replace function public.create_knowledge_initial_draft(
  p_workspace_id uuid,
  p_article_id uuid,
  p_title text,
  p_slug text,
  p_summary text,
  p_content text,
  p_content_blocks jsonb,
  p_tags text[],
  p_product_id uuid,
  p_module_id uuid,
  p_category_id uuid,
  p_default_language text,
  p_change_note text
) returns uuid
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_version_id uuid;
  v_title text := btrim(coalesce(p_title,''));
  v_slug text := lower(btrim(coalesce(p_slug,'')));
  v_blocks jsonb := coalesce(p_content_blocks,'[]'::jsonb);
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not private.has_workspace_permission(p_workspace_id,'create_knowledge') then raise exception 'Insufficient Knowledge create permission'; end if;
  if v_title='' then raise exception 'Knowledge title is required'; end if;
  if v_slug='' then raise exception 'Knowledge slug is required'; end if;
  if jsonb_typeof(v_blocks)<>'array' then raise exception 'Knowledge content_blocks must be an array'; end if;
  if exists(select 1 from public.knowledge_articles where id=p_article_id) then raise exception 'Knowledge article already exists'; end if;
  if exists(select 1 from public.knowledge_articles where workspace_id=p_workspace_id and lower(slug)=v_slug) then raise exception 'Ya existe un artículo con este slug en el workspace'; end if;

  insert into public.knowledge_articles(
    id,workspace_id,title,slug,summary,content,content_blocks,tags,product_id,module_id,category_id,
    status,default_language,created_by,updated_by
  ) values (
    p_article_id,p_workspace_id,v_title,v_slug,nullif(btrim(coalesce(p_summary,'')),''),coalesce(p_content,''),v_blocks,
    coalesce(p_tags,'{}'::text[]),p_product_id,p_module_id,p_category_id,'draft',
    case when lower(coalesce(p_default_language,'es'))='en' then 'en' else 'es' end,v_uid,v_uid
  );

  insert into public.knowledge_article_versions(
    article_id,workspace_id,version_number,status,change_note,title,slug,summary,content,content_blocks,tags,
    product_id,module_id,category_id,created_by,updated_by
  ) values (
    p_article_id,p_workspace_id,1,'draft',coalesce(nullif(btrim(p_change_note),''),'Versión inicial'),v_title,v_slug,
    nullif(btrim(coalesce(p_summary,'')),''),coalesce(p_content,''),v_blocks,coalesce(p_tags,'{}'::text[]),
    p_product_id,p_module_id,p_category_id,v_uid,v_uid
  ) returning id into v_version_id;

  update public.knowledge_articles set draft_version_id=v_version_id where id=p_article_id;
  return v_version_id;
end $$;
revoke all on function public.create_knowledge_initial_draft(uuid,uuid,text,text,text,text,jsonb,text[],uuid,uuid,uuid,text,text) from public,anon;
grant execute on function public.create_knowledge_initial_draft(uuid,uuid,text,text,text,text,jsonb,text[],uuid,uuid,uuid,text,text) to authenticated;

-- -----------------------------------------------------------------------------
-- 2) Vacations: return date + multiple non-contiguous blocks in one request
-- -----------------------------------------------------------------------------
alter table public.vacation_requests add column if not exists return_date date;
alter table public.vacation_requests add column if not exists date_blocks jsonb not null default '[]'::jsonb;

update public.vacation_requests
set return_date=coalesce(return_date,end_date+1),
    date_blocks=case when jsonb_typeof(date_blocks)='array' and jsonb_array_length(date_blocks)>0 then date_blocks else jsonb_build_array(jsonb_build_object(
      'id','legacy','start_date',to_char(start_date,'YYYY-MM-DD'),'end_date',to_char(end_date,'YYYY-MM-DD'),'return_date',to_char(coalesce(return_date,end_date+1),'YYYY-MM-DD')
    )) end
where return_date is null or jsonb_typeof(date_blocks)<>'array' or jsonb_array_length(date_blocks)=0;

alter table public.vacation_requests alter column return_date set not null;

do $$
declare r record;
begin
  -- v17.0 limited the bounding range to 60 days. v17.1 limits the sum of actual blocks instead.
  for r in select conname from pg_constraint where conrelid='public.vacation_requests'::regclass and contype='c' and pg_get_constraintdef(oid) ilike '%end_date%start_date%60%'
  loop execute format('alter table public.vacation_requests drop constraint %I',r.conname); end loop;
  if not exists(select 1 from pg_constraint where conname='vacation_requests_date_blocks_check') then
    alter table public.vacation_requests add constraint vacation_requests_date_blocks_check check (
      jsonb_typeof(date_blocks)='array' and jsonb_array_length(date_blocks) between 1 and 8
    );
  end if;
  if not exists(select 1 from pg_constraint where conname='vacation_requests_return_date_check') then
    alter table public.vacation_requests add constraint vacation_requests_return_date_check check (return_date>end_date);
  end if;
end $$;

create or replace function private.guard_vacation_request()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_service boolean:=coalesce(current_setting('request.jwt.claim.role',true),'')='service_role';
  v_manage boolean;
  v_block jsonb;
  v_norm jsonb:='[]'::jsonb;
  v_start date;v_end date;v_return date;
  v_min date;v_max date;v_return_max date;
  v_total int:=0;v_count int:=0;
begin
  v_manage:=v_service or private.has_workspace_permission(new.workspace_id,'manage_vacations');
  if not exists(select 1 from public.workspace_members wm where wm.workspace_id=new.workspace_id and wm.user_id=new.user_id and wm.active=true) then
    raise exception 'Vacation requester must be an active member of the workspace';
  end if;

  if new.date_blocks is null or jsonb_typeof(new.date_blocks)<>'array' or jsonb_array_length(new.date_blocks)=0 then
    new.date_blocks:=jsonb_build_array(jsonb_build_object(
      'id','legacy','start_date',to_char(new.start_date,'YYYY-MM-DD'),'end_date',to_char(new.end_date,'YYYY-MM-DD'),
      'return_date',to_char(coalesce(new.return_date,new.end_date+1),'YYYY-MM-DD')
    ));
  end if;

  for v_block in select value from jsonb_array_elements(new.date_blocks)
  loop
    v_count:=v_count+1;
    begin
      v_start:=nullif(v_block->>'start_date','')::date;
      v_end:=nullif(v_block->>'end_date','')::date;
      v_return:=coalesce(nullif(v_block->>'return_date','')::date,v_end+1);
    exception when others then raise exception 'Cada bloque de vacaciones debe contener fechas válidas'; end;
    if v_start is null or v_end is null or v_end<v_start then raise exception 'Cada bloque requiere fecha de inicio y fin válidas'; end if;
    if v_return<=v_end then raise exception 'La fecha de reincorporación debe ser posterior al fin de cada bloque'; end if;
    v_total:=v_total+(v_end-v_start+1);
    if v_min is null or v_start<v_min then v_min:=v_start; end if;
    if v_max is null or v_end>v_max then v_max:=v_end; end if;
    if v_return_max is null or v_return>v_return_max then v_return_max:=v_return; end if;
    v_norm:=v_norm||jsonb_build_array(jsonb_build_object(
      'id',coalesce(nullif(v_block->>'id',''),gen_random_uuid()::text),
      'start_date',to_char(v_start,'YYYY-MM-DD'),'end_date',to_char(v_end,'YYYY-MM-DD'),'return_date',to_char(v_return,'YYYY-MM-DD')
    ));
  end loop;
  if v_count<1 or v_count>8 then raise exception 'Una solicitud permite entre 1 y 8 bloques'; end if;
  if v_total>61 then raise exception 'La suma de los bloques no puede superar 61 días de ausencia'; end if;
  if exists(
    select 1 from jsonb_array_elements(v_norm) with ordinality a(value,idx)
    join jsonb_array_elements(v_norm) with ordinality b(value,idx) on a.idx<b.idx
    where (a.value->>'start_date')::date <= (b.value->>'end_date')::date
      and (a.value->>'end_date')::date >= (b.value->>'start_date')::date
  ) then raise exception 'Los bloques de una misma solicitud no pueden traslaparse'; end if;

  new.date_blocks:=v_norm;new.start_date:=v_min;new.end_date:=v_max;new.return_date:=v_return_max;

  if tg_op='INSERT' then
    if not v_manage then
      new.decision_by:=null;new.decision_note:=null;new.decided_at:=null;
      new.ai_risk:=null;new.ai_recommendation:=null;new.ai_summary:=null;new.ai_analysis:='{}'::jsonb;new.ai_analyzed_at:=null;
    end if;
  else
    if old.status<>'pending' and new.status is distinct from old.status then raise exception 'Only pending vacation requests can change status';end if;
    if new.date_blocks is distinct from old.date_blocks or new.user_id is distinct from old.user_id then
      new.ai_risk:=null;new.ai_recommendation:=null;new.ai_summary:=null;new.ai_analysis:='{}'::jsonb;new.ai_analyzed_at:=null;
    end if;
    if not v_manage then
      if new.workspace_id is distinct from old.workspace_id or new.user_id is distinct from old.user_id then raise exception 'Requester cannot change workspace or owner';end if;
      if new.decision_by is distinct from old.decision_by or new.decision_note is distinct from old.decision_note or new.decided_at is distinct from old.decided_at
         or new.ai_risk is distinct from old.ai_risk or new.ai_recommendation is distinct from old.ai_recommendation or new.ai_summary is distinct from old.ai_summary
         or new.ai_analysis is distinct from old.ai_analysis or new.ai_analyzed_at is distinct from old.ai_analyzed_at then
        raise exception 'Decision and AI analysis fields are restricted';
      end if;
      if new.status not in ('pending','cancelled') then raise exception 'Requester can only keep pending or cancel the request';end if;
    end if;
  end if;

  if new.status in ('pending','approved') and exists(
    select 1 from public.vacation_requests vr
    cross join lateral jsonb_array_elements(vr.date_blocks) ob
    cross join lateral jsonb_array_elements(new.date_blocks) nb
    where vr.workspace_id=new.workspace_id and vr.user_id=new.user_id and vr.id<>new.id and vr.status in ('pending','approved')
      and (ob->>'start_date')::date <= (nb->>'end_date')::date and (ob->>'end_date')::date >= (nb->>'start_date')::date
  ) then raise exception 'Ya existe una solicitud pendiente o aprobada que se cruza con alguno de estos bloques';end if;

  if new.status='approved' then
    if new.ai_analyzed_at is null or new.ai_analysis is null or new.ai_analysis='{}'::jsonb then raise exception 'Analyze sprint impact before approving vacations';end if;
    if new.ai_analyzed_at < now()-interval '12 hours' then raise exception 'Vacation impact analysis is stale; analyze again before approving';end if;
    if exists(select 1 from public.tickets t where t.workspace_id=new.workspace_id and (t.dev_owner_id=new.user_id or t.qa_owner_id=new.user_id) and t.status<>'closed' and t.updated_at>new.ai_analyzed_at) then
      raise exception 'Assigned work changed after the vacation analysis; analyze again before approving';
    end if;
    if exists(
      select 1 from public.sprints s cross join lateral jsonb_array_elements(new.date_blocks) nb
      where s.workspace_id=new.workspace_id and s.status in ('active','planned')
        and s.start_date <= (nb->>'end_date')::date and s.end_date >= (nb->>'start_date')::date and s.updated_at>new.ai_analyzed_at
    ) then raise exception 'Sprint planning changed after the vacation analysis; analyze again before approving';end if;
    if exists(
      select 1 from public.vacation_requests vr
      cross join lateral jsonb_array_elements(vr.date_blocks) ob
      cross join lateral jsonb_array_elements(new.date_blocks) nb
      where vr.workspace_id=new.workspace_id and vr.id<>new.id and vr.status='approved'
        and (ob->>'start_date')::date <= (nb->>'end_date')::date and (ob->>'end_date')::date >= (nb->>'start_date')::date
        and vr.updated_at>new.ai_analyzed_at
    ) then raise exception 'Team availability changed after the vacation analysis; analyze again before approving';end if;
  end if;

  if new.status in ('approved','rejected') then
    if not v_service then new.decision_by=(select auth.uid());elsif new.decision_by is null then new.decision_by=(select auth.uid());end if;
    new.decided_at=coalesce(new.decided_at,now());
  end if;
  return new;
end $$;
revoke all on function private.guard_vacation_request() from public,anon,authenticated;

create or replace function private.notify_vacation_request_change()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_blocks int:=coalesce(jsonb_array_length(new.date_blocks),1);
begin
  if tg_op='INSERT' then
    insert into public.notifications(workspace_id,user_id,type,title,body,category,metadata)
    select new.workspace_id,wm.user_id,'vacation_requested','Nueva solicitud de vacaciones',
      coalesce(p.full_name,'Colaborador')||' solicitó '||v_blocks||case when v_blocks=1 then ' bloque' else ' bloques' end||
      ' de ausencia ('||to_char(new.start_date,'DD/MM/YYYY')||' → '||to_char(new.end_date,'DD/MM/YYYY')||').',
      'vacations',jsonb_build_object('entity_type','vacation','entity_id',new.id,'user_id',new.user_id,'start_date',new.start_date,'end_date',new.end_date,'return_date',new.return_date,'date_blocks',new.date_blocks)
    from public.workspace_members wm left join public.profiles p on p.id=new.user_id
    where wm.workspace_id=new.workspace_id and wm.active=true and wm.user_id<>new.user_id and private.member_has_permission(new.workspace_id,wm.user_id,'manage_vacations');
  elsif new.status is distinct from old.status then
    insert into public.notifications(workspace_id,user_id,type,title,body,category,metadata)
    values(new.workspace_id,new.user_id,'vacation_status',
      case new.status when 'approved' then 'Vacaciones aprobadas' when 'rejected' then 'Solicitud de vacaciones rechazada' when 'cancelled' then 'Solicitud de vacaciones cancelada' else 'Solicitud de vacaciones actualizada' end,
      coalesce(new.decision_note,case new.status when 'approved' then 'Tu ausencia fue aprobada y ya aparece en el calendario y proyección.' when 'rejected' then 'Revisa el detalle de la decisión.' else 'El estado de tu solicitud cambió.' end),
      'vacations',jsonb_build_object('entity_type','vacation','entity_id',new.id,'status',new.status,'start_date',new.start_date,'end_date',new.end_date,'return_date',new.return_date,'date_blocks',new.date_blocks));
  end if;
  return new;
end $$;
revoke all on function private.notify_vacation_request_change() from public,anon,authenticated;

commit;
