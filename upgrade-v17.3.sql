-- Jira Interno TROBBU v17.3.1 cumulative patch (re-runnable)
-- Knowledge module stabilization + rich-text runtime fix support + luxury cover blocks.
-- Keeps the existing v17.3 upgrade filename to avoid adding more project files.

begin;

-- -----------------------------------------------------------------------------
-- 1) Categories become a first-class, validated Knowledge container.
-- -----------------------------------------------------------------------------
create or replace function private.guard_knowledge_category()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  new.name:=btrim(coalesce(new.name,''));
  if length(new.name)<2 then raise exception 'El nombre de la categoría es obligatorio'; end if;
  new.code:=lower(regexp_replace(btrim(coalesce(new.code,new.name)),'[^a-zA-Z0-9]+','-','g'));
  new.code:=trim(both '-' from new.code);
  if new.code='' then raise exception 'El código de la categoría es obligatorio'; end if;
  new.icon:=coalesce(nullif(btrim(new.icon),''),'lucide:folder');
  if new.icon !~ '^lucide:[a-z0-9-]+$' then new.icon:='lucide:folder'; end if;
  if coalesce(new.color,'') !~ '^#[0-9A-Fa-f]{6}$' then new.color:='#4D5A51'; end if;
  new.sort_order:=greatest(0,least(coalesce(new.sort_order,100),9999));
  new.updated_at:=now();
  return new;
end $$;

drop trigger if exists trg_guard_knowledge_category on public.knowledge_categories;
create trigger trg_guard_knowledge_category before insert or update on public.knowledge_categories
for each row execute function private.guard_knowledge_category();

-- Every workspace gets a General fallback before existing articles are migrated.
insert into public.knowledge_categories(workspace_id,code,name,description,icon,color,sort_order,active)
select w.id,'general','General','Información transversal sin categoría específica.','lucide:folder','#6B7280',999,true
from public.workspaces w
on conflict(workspace_id,code) do update set active=true;

update public.knowledge_articles a
set category_id=c.id
from public.knowledge_categories c
where a.category_id is null and c.workspace_id=a.workspace_id and c.code='general';

update public.knowledge_article_versions v
set category_id=coalesce(a.category_id,c.id)
from public.knowledge_articles a
left join public.knowledge_categories c on c.workspace_id=a.workspace_id and c.code='general'
where v.article_id=a.id and v.category_id is null;

alter table public.knowledge_articles alter column category_id set not null;
alter table public.knowledge_article_versions alter column category_id set not null;

-- Delete safely: reclassify all article/version history before removing a category.
create or replace function public.delete_knowledge_category(p_category_id uuid,p_replacement_id uuid default null)
returns boolean language plpgsql security invoker set search_path=public,private,pg_temp as $$
declare
  v_cat public.knowledge_categories%rowtype;
  v_replacement uuid:=p_replacement_id;
  v_used boolean;
begin
  select * into v_cat from public.knowledge_categories where id=p_category_id;
  if not found then raise exception 'Categoría no encontrada'; end if;
  if v_cat.code='general' then raise exception 'La categoría General es un contenedor de sistema y no puede eliminarse'; end if;
  if not private.has_workspace_permission(v_cat.workspace_id,'delete_knowledge') then raise exception 'No tienes permiso para eliminar categorías de Knowledge'; end if;
  select exists(select 1 from public.knowledge_articles where workspace_id=v_cat.workspace_id and category_id=v_cat.id) into v_used;
  if v_used and not private.has_workspace_permission(v_cat.workspace_id,'edit_knowledge') then
    raise exception 'Eliminar una categoría con artículos también requiere permiso Editar/Publicar Knowledge para reclasificar su contenido';
  end if;
  if v_used then
    if v_replacement is null then
      select id into v_replacement from public.knowledge_categories where workspace_id=v_cat.workspace_id and code='general' and id<>v_cat.id limit 1;
    end if;
    if v_replacement is null or v_replacement=v_cat.id or not exists(select 1 from public.knowledge_categories where id=v_replacement and workspace_id=v_cat.workspace_id and active=true) then
      raise exception 'Selecciona una categoría destino válida para los artículos existentes';
    end if;
    update public.knowledge_articles set category_id=v_replacement where workspace_id=v_cat.workspace_id and category_id=v_cat.id;
    update public.knowledge_article_versions set category_id=v_replacement where workspace_id=v_cat.workspace_id and category_id=v_cat.id;
  end if;
  delete from public.knowledge_categories where id=v_cat.id;
  return true;
end $$;
revoke all on function public.delete_knowledge_category(uuid,uuid) from public,anon;
grant execute on function public.delete_knowledge_category(uuid,uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 2) Canonical block schema v3 + migration of existing articles/versions.
-- -----------------------------------------------------------------------------
alter table public.knowledge_articles add column if not exists content_schema_version smallint not null default 3;
alter table public.knowledge_article_versions add column if not exists content_schema_version smallint not null default 3;

create or replace function private.knowledge_escape_html(p_value text)
returns text language sql immutable security invoker set search_path=public,pg_temp as $$
  select replace(replace(replace(replace(coalesce(p_value,''),'&','&amp;'),'<','&lt;'),'>','&gt;'),E'\n','<br>')
$$;

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
revoke all on function private.knowledge_escape_html(text) from public,anon;
revoke all on function private.normalize_knowledge_blocks_v3(jsonb,text) from public,anon;
-- The public SECURITY INVOKER authoring RPCs execute as the authenticated user.
-- These helpers are pure transformations (no privileged table access), so the
-- caller needs EXECUTE on them or article creation would fail at runtime.
grant execute on function private.knowledge_escape_html(text) to authenticated;
grant execute on function private.normalize_knowledge_blocks_v3(jsonb,text) to authenticated;

update public.knowledge_articles
set content_blocks=private.normalize_knowledge_blocks_v3(content_blocks,content),content_schema_version=3;
update public.knowledge_article_versions
set content_blocks=private.normalize_knowledge_blocks_v3(content_blocks,content),content_schema_version=3;

-- -----------------------------------------------------------------------------
-- 3) Atomic initial draft + guarded draft update.
-- -----------------------------------------------------------------------------
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


-- Keep the article shadow row on the same block schema when a version is
-- published/restored. Older publish functions predate content_schema_version.
create or replace function public.publish_knowledge_version(p_version_id uuid)
returns jsonb language plpgsql security invoker set search_path=public,private,pg_temp as $$
declare v public.knowledge_article_versions%rowtype;a public.knowledge_articles%rowtype;old_id uuid;
begin
  select * into v from public.knowledge_article_versions where id=p_version_id;if not found then raise exception 'Knowledge version not found';end if;
  select * into a from public.knowledge_articles where id=v.article_id;
  if not private.has_workspace_permission(v.workspace_id,'edit_knowledge') then raise exception 'Insufficient Knowledge permissions';end if;
  perform set_config('app.knowledge_publish','on',true);old_id:=a.active_version_id;
  if old_id is not null and old_id<>v.id then update public.knowledge_article_versions set status='archived' where id=old_id;end if;
  update public.knowledge_article_versions set status='published',published_by=(select auth.uid()),published_at=now() where id=v.id;
  update public.knowledge_articles set title=v.title,slug=v.slug,summary=v.summary,content=v.content,content_blocks=v.content_blocks,content_schema_version=v.content_schema_version,tags=v.tags,product_id=v.product_id,module_id=v.module_id,category_id=v.category_id,status='published',active_version_id=v.id,draft_version_id=case when draft_version_id=v.id then null else draft_version_id end,updated_by=(select auth.uid()),updated_at=now() where id=v.article_id;
  return jsonb_build_object('article_id',v.article_id,'version_id',v.id,'version_number',v.version_number);
end $$;
revoke all on function public.publish_knowledge_version(uuid) from public,anon;
grant execute on function public.publish_knowledge_version(uuid) to authenticated;

commit;
