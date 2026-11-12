-- ============================================================================
-- Jira Interno TROBBU v17.6.0 · Production drift repair
-- Repairs Knowledge authoring RPCs/version integrity and Vacation AI persistence.
-- Re-runnable over v17.5.x.
-- ============================================================================

begin;

-- Knowledge v3 content schema was present in the consolidated schema but could
-- be absent from incrementally upgraded production databases.
alter table public.knowledge_articles add column if not exists content_schema_version smallint not null default 3;
alter table public.knowledge_article_versions add column if not exists content_schema_version smallint not null default 3;

create or replace function private.knowledge_escape_html(p_value text)
returns text language sql immutable security invoker set search_path=public,pg_temp as $$
  select replace(replace(replace(replace(coalesce(p_value,''),'&','&amp;'),'<','&lt;'),'>','&gt;'),E'\n','<br>')
$$;

revoke all on function private.knowledge_escape_html(text) from public,anon;
grant execute on function private.knowledge_escape_html(text) to authenticated;

create or replace function private.normalize_knowledge_blocks_v3(p_blocks jsonb,p_content text)
returns jsonb language plpgsql volatile security invoker set search_path=public,private,pg_temp as $$
declare
  v_blocks jsonb:=case when jsonb_typeof(p_blocks)='array' then p_blocks else '[]'::jsonb end;
  v_out jsonb:='[]'::jsonb;
  v_item jsonb;
  v_type text;
  v_id text;
  v_html text;
  v_line text;
begin
  if jsonb_array_length(v_blocks)=0 then
    if btrim(coalesce(p_content,''))='' then
      return jsonb_build_array(jsonb_build_object('id',gen_random_uuid()::text,'type','richtext','html','<p></p>','line_height','1.5'));
    end if;
    return jsonb_build_array(jsonb_build_object('id',gen_random_uuid()::text,'type','richtext','html','<p>'||private.knowledge_escape_html(p_content)||'</p>','line_height','1.5'));
  end if;

  for v_item in select value from jsonb_array_elements(v_blocks)
  loop
    v_type:=lower(coalesce(v_item->>'type','richtext'));
    v_id:=coalesce(nullif(v_item->>'id',''),gen_random_uuid()::text);
    if v_type in ('paragraph','text') then
      v_html:=coalesce(nullif(v_item->>'html',''),'<p>'||private.knowledge_escape_html(v_item->>'text')||'</p>');
      v_out:=v_out||jsonb_build_array(jsonb_build_object('id',v_id,'type','richtext','html',v_html,'line_height',coalesce(nullif(v_item->>'line_height',''),'1.5')));
    elsif v_type='richtext' then
      v_out:=v_out||jsonb_build_array(jsonb_build_object('id',v_id,'type','richtext','html',coalesce(v_item->>'html','<p></p>'),'line_height',coalesce(nullif(v_item->>'line_height',''),'1.5')));
    elsif v_type='heading' then
      v_out:=v_out||jsonb_build_array(jsonb_build_object('id',v_id,'type','heading2','text',coalesce(v_item->>'text','')));
    elsif v_type in ('heading1','heading2','heading3','heading4','heading5') then
      v_out:=v_out||jsonb_build_array(jsonb_build_object('id',v_id,'type',v_type,'text',coalesce(v_item->>'text','')));
    elsif v_type='list' then
      v_out:=v_out||jsonb_build_array(jsonb_build_object('id',v_id,'type','list','text',coalesce(v_item->>'text',''),'list_style',case when v_item->>'list_style'='ordered' then 'ordered' else 'unordered' end));
    elsif v_type='quote' then
      v_out:=v_out||jsonb_build_array(jsonb_build_object('id',v_id,'type','quote','text',coalesce(v_item->>'text',''),'author',coalesce(v_item->>'author','')));
    elsif v_type='callout' then
      v_out:=v_out||jsonb_build_array(jsonb_build_object('id',v_id,'type','callout','text',coalesce(v_item->>'text',''),'title',coalesce(v_item->>'title',''),'tone',case when v_item->>'tone' in ('info','success','warning','danger') then v_item->>'tone' else 'info' end));
    elsif v_type='code' then
      v_out:=v_out||jsonb_build_array(jsonb_build_object('id',v_id,'type','code','text',coalesce(v_item->>'text',''),'language',coalesce(nullif(v_item->>'language',''),'text')));
    elsif v_type='image' then
      v_out:=v_out||jsonb_build_array(jsonb_build_object('id',v_id,'type','image','media_id',v_item->'media_id','alt',coalesce(v_item->>'alt',''),'caption',coalesce(v_item->>'caption',''),'align',case when v_item->>'align' in ('left','center','right','wide') then v_item->>'align' else 'center' end));
    elsif v_type='video' then
      v_out:=v_out||jsonb_build_array(jsonb_build_object('id',v_id,'type','video','url',coalesce(v_item->>'url',''),'caption',coalesce(v_item->>'caption','')));
    elsif v_type='cover' then
      v_out:=v_out||jsonb_build_array(jsonb_build_object(
        'id',v_id,'type','cover',
        'template',case when v_item->>'template' in ('forest','ivory','midnight') then v_item->>'template' else 'forest' end,
        'eyebrow',left(coalesce(nullif(v_item->>'eyebrow',''),'TROBBU · KNOWLEDGE'),80),
        'title',left(coalesce(v_item->>'title',''),180),
        'subtitle',left(coalesce(v_item->>'subtitle',''),360),
        'meta',left(coalesce(nullif(v_item->>'meta',''),'Documento interno'),140),
        'show_logo',case when lower(coalesce(v_item->>'show_logo','true'))='false' then false else true end,
        'page_break',case when lower(coalesce(v_item->>'page_break','true'))='false' then false else true end
      ));
    elsif v_type in ('divider','pagebreak') then
      v_out:=v_out||jsonb_build_array(jsonb_build_object('id',v_id,'type',v_type));
    else
      v_out:=v_out||jsonb_build_array(jsonb_build_object('id',v_id,'type','richtext','html','<p>'||private.knowledge_escape_html(coalesce(v_item->>'text',v_item::text))||'</p>','line_height','1.5'));
    end if;
  end loop;
  return v_out;
end $$;

revoke all on function private.normalize_knowledge_blocks_v3(jsonb,text) from public,anon;
grant execute on function private.normalize_knowledge_blocks_v3(jsonb,text) to authenticated;

update public.knowledge_articles
set content_blocks=private.normalize_knowledge_blocks_v3(content_blocks,content),content_schema_version=3;

-- Existing published/archived versions are intentionally immutable in normal
-- application traffic. Migration-only normalization temporarily disables the
-- version guard and audit triggers inside this transaction so legacy blocks can
-- be upgraded without creating fake user-facing version history events.
alter table public.knowledge_article_versions disable trigger trg_guard_knowledge_version;
alter table public.knowledge_article_versions disable trigger trg_audit_knowledge_version;
update public.knowledge_article_versions
set content_blocks=private.normalize_knowledge_blocks_v3(content_blocks,content),content_schema_version=3;
alter table public.knowledge_article_versions enable trigger trg_audit_knowledge_version;
alter table public.knowledge_article_versions enable trigger trg_guard_knowledge_version;

create or replace function public.create_knowledge_initial_draft(
  p_workspace_id uuid,p_article_id uuid,p_title text,p_slug text,p_summary text,p_content text,p_content_blocks jsonb,
  p_tags text[],p_product_id uuid,p_module_id uuid,p_category_id uuid,p_default_language text,p_change_note text
) returns uuid language plpgsql security invoker set search_path=public,private,pg_temp as $$
declare
  v_uid uuid:=(select auth.uid());
  v_version_id uuid;
  v_title text:=btrim(coalesce(p_title,''));
  v_slug text:=lower(btrim(coalesce(p_slug,'')));
  v_blocks jsonb:=private.normalize_knowledge_blocks_v3(p_content_blocks,p_content);
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not private.has_workspace_permission(p_workspace_id,'create_knowledge') then raise exception 'Insufficient Knowledge create permission'; end if;
  if v_title='' then raise exception 'El título es obligatorio'; end if;
  if v_slug='' then raise exception 'El slug es obligatorio'; end if;
  if p_category_id is null or not exists(select 1 from public.knowledge_categories where id=p_category_id and workspace_id=p_workspace_id and active=true) then raise exception 'Selecciona una categoría válida'; end if;
  if exists(select 1 from public.knowledge_articles where id=p_article_id) then raise exception 'Knowledge article already exists'; end if;
  if exists(select 1 from public.knowledge_articles where workspace_id=p_workspace_id and lower(slug)=v_slug) then raise exception 'Ya existe un artículo con este slug en el workspace'; end if;

  insert into public.knowledge_articles(id,workspace_id,title,slug,summary,content,content_blocks,content_schema_version,tags,product_id,module_id,category_id,status,default_language,created_by,updated_by)
  values(p_article_id,p_workspace_id,v_title,v_slug,nullif(btrim(coalesce(p_summary,'')),''),coalesce(p_content,''),v_blocks,3,coalesce(p_tags,'{}'::text[]),p_product_id,p_module_id,p_category_id,'draft',case when lower(coalesce(p_default_language,'es'))='en' then 'en' else 'es' end,v_uid,v_uid);

  insert into public.knowledge_article_versions(article_id,workspace_id,version_number,status,change_note,title,slug,summary,content,content_blocks,content_schema_version,tags,product_id,module_id,category_id,created_by,updated_by)
  values(p_article_id,p_workspace_id,1,'draft',coalesce(nullif(btrim(p_change_note),''),'Versión inicial'),v_title,v_slug,nullif(btrim(coalesce(p_summary,'')),''),coalesce(p_content,''),v_blocks,3,coalesce(p_tags,'{}'::text[]),p_product_id,p_module_id,p_category_id,v_uid,v_uid)
  returning id into v_version_id;
  update public.knowledge_articles set draft_version_id=v_version_id where id=p_article_id;
  return v_version_id;
end $$;

revoke all on function public.create_knowledge_initial_draft(uuid,uuid,text,text,text,text,jsonb,text[],uuid,uuid,uuid,text,text) from public,anon;
grant execute on function public.create_knowledge_initial_draft(uuid,uuid,text,text,text,text,jsonb,text[],uuid,uuid,uuid,text,text) to authenticated;

create or replace function public.update_knowledge_draft_version(
  p_version_id uuid,p_title text,p_slug text,p_summary text,p_content text,p_content_blocks jsonb,p_tags text[],p_product_id uuid,p_module_id uuid,p_category_id uuid
) returns public.knowledge_article_versions
language plpgsql security invoker set search_path=public,private,pg_temp as $$
declare
  v public.knowledge_article_versions%rowtype;
  a public.knowledge_articles%rowtype;
  v_blocks jsonb:=private.normalize_knowledge_blocks_v3(p_content_blocks,p_content);
begin
  select * into v from public.knowledge_article_versions where id=p_version_id and status='draft';
  if not found then raise exception 'Borrador de Knowledge no encontrado'; end if;
  select * into a from public.knowledge_articles where id=v.article_id;
  if not found then raise exception 'Artículo de Knowledge no encontrado'; end if;
  if not (private.has_workspace_permission(v.workspace_id,'edit_knowledge') or (private.has_workspace_permission(v.workspace_id,'create_knowledge') and a.created_by=(select auth.uid()) and a.active_version_id is null)) then
    raise exception 'No tienes permiso para editar este borrador';
  end if;
  if p_category_id is null or not exists(select 1 from public.knowledge_categories where id=p_category_id and workspace_id=v.workspace_id and active=true) then raise exception 'Selecciona una categoría válida'; end if;

  update public.knowledge_article_versions set
    title=btrim(p_title),slug=lower(btrim(p_slug)),summary=nullif(btrim(coalesce(p_summary,'')),''),content=coalesce(p_content,''),content_blocks=v_blocks,content_schema_version=3,
    tags=coalesce(p_tags,'{}'::text[]),product_id=p_product_id,module_id=p_module_id,category_id=p_category_id,updated_by=(select auth.uid()),updated_at=now()
  where id=v.id returning * into v;

  if a.active_version_id is null then
    update public.knowledge_articles set title=v.title,slug=v.slug,summary=v.summary,content=v.content,content_blocks=v.content_blocks,content_schema_version=3,tags=v.tags,product_id=v.product_id,module_id=v.module_id,category_id=v.category_id,draft_version_id=v.id,updated_by=(select auth.uid()),updated_at=now() where id=a.id;
  else
    update public.knowledge_articles set draft_version_id=v.id,updated_by=(select auth.uid()),updated_at=now() where id=a.id;
  end if;
  return v;
end $$;

revoke all on function public.update_knowledge_draft_version(uuid,text,text,text,text,jsonb,text[],uuid,uuid,uuid) from public,anon;
grant execute on function public.update_knowledge_draft_version(uuid,text,text,text,text,jsonb,text[],uuid,uuid,uuid) to authenticated;

create or replace function public.publish_knowledge_version(p_version_id uuid)
returns jsonb language plpgsql security invoker set search_path=public,private,pg_temp as $$
declare
  v public.knowledge_article_versions%rowtype;
  a public.knowledge_articles%rowtype;
  old_id uuid;
  creator_initial boolean:=false;
begin
  select * into v from public.knowledge_article_versions where id=p_version_id;
  if not found then raise exception 'Knowledge version not found'; end if;
  select * into a from public.knowledge_articles where id=v.article_id;
  if not found then raise exception 'Knowledge article not found'; end if;
  creator_initial:=private.has_workspace_permission(v.workspace_id,'create_knowledge')
    and a.created_by=(select auth.uid()) and v.created_by=(select auth.uid())
    and a.active_version_id is null and v.status='draft';
  if not private.has_workspace_permission(v.workspace_id,'edit_knowledge') and not creator_initial then
    raise exception 'Insufficient Knowledge publish permission';
  end if;
  perform set_config('app.knowledge_publish','on',true);
  old_id:=a.active_version_id;
  if old_id is not null and old_id<>v.id then
    update public.knowledge_article_versions set status='archived' where id=old_id;
  end if;
  update public.knowledge_article_versions
  set status='published',published_by=(select auth.uid()),published_at=now()
  where id=v.id;
  update public.knowledge_articles set
    title=v.title,slug=v.slug,summary=v.summary,content=v.content,content_blocks=v.content_blocks,
    content_schema_version=coalesce(v.content_schema_version,3),tags=v.tags,product_id=v.product_id,module_id=v.module_id,
    category_id=v.category_id,status='published',active_version_id=v.id,
    draft_version_id=case when draft_version_id=v.id then null else draft_version_id end,
    updated_by=(select auth.uid()),updated_at=now()
  where id=v.article_id;
  return jsonb_build_object('article_id',v.article_id,'version_id',v.id,'version_number',v.version_number);
end $$;

revoke all on function public.publish_knowledge_version(uuid) from public,anon;
grant execute on function public.publish_knowledge_version(uuid) to authenticated;

-- Canonical Vacation workflow fields. Keeping these here makes the repair safe
-- even if a prior v17.5 deployment stopped halfway through.
alter table public.vacation_requests add column if not exists decision_by uuid references auth.users(id) on delete set null;
alter table public.vacation_requests add column if not exists ai_risk text;
alter table public.vacation_requests add column if not exists ai_recommendation text;
alter table public.vacation_requests add column if not exists ai_summary text;
alter table public.vacation_requests add column if not exists ai_analysis jsonb not null default '{}'::jsonb;
alter table public.vacation_requests add column if not exists ai_analyzed_at timestamptz;

-- Reinstall the guard with current PostgREST JWT claim handling. Supabase
-- service-role requests expose the role in request.jwt.claims; relying only on
-- request.jwt.claim.role caused the Vacation Edge Function to be treated as a
-- normal requester and its ai_* update to be rejected.
create or replace function private.guard_vacation_request()
returns trigger language plpgsql security definer set search_path=public,private,pg_temp as $$
declare
  v_service boolean:=coalesce((nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role'),current_setting('request.jwt.claim.role',true),'')='service_role';
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
    new.assistant_recommendation:=new.ai_recommendation;
    new.assistant_analysis:=new.ai_summary;
    new.assistant_snapshot:=coalesce(new.ai_analysis,'{}'::jsonb);
  end if;
  return new;
end $$;

revoke all on function private.guard_vacation_request() from public,anon,authenticated;
drop trigger if exists trg_guard_vacation_request on public.vacation_requests;
create trigger trg_guard_vacation_request before insert or update on public.vacation_requests
for each row execute function private.guard_vacation_request();

notify pgrst,'reload schema';
commit;
