-- Jira Interno TROBBU v16.4
-- Knowledge: versionado, auditoría, ES/EN y cache de traducciones por versión activa.

alter table public.profiles
  add column if not exists locale text not null default 'es'
  check (locale in ('es','en'));

alter table public.knowledge_articles
  add column if not exists default_language text not null default 'es'
  check (default_language in ('es','en'));

create table if not exists public.knowledge_article_versions (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.knowledge_articles(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  change_note text not null default 'Actualización del artículo',
  title text not null,
  slug text not null,
  summary text,
  content text not null default '',
  content_blocks jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  product_id uuid references public.products(id) on delete set null,
  module_id uuid references public.ticket_modules(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  content_updated_by uuid references auth.users(id) on delete set null,
  published_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  content_updated_at timestamptz,
  published_at timestamptz,
  unique(article_id,version_number)
);
create unique index if not exists uq_knowledge_article_one_draft on public.knowledge_article_versions(article_id) where status='draft';
create index if not exists idx_knowledge_versions_article on public.knowledge_article_versions(article_id,version_number desc);
create index if not exists idx_knowledge_versions_workspace on public.knowledge_article_versions(workspace_id,status,updated_at desc);
create index if not exists idx_knowledge_versions_created_by on public.knowledge_article_versions(created_by) where created_by is not null;
create index if not exists idx_knowledge_versions_updated_by on public.knowledge_article_versions(updated_by) where updated_by is not null;
create index if not exists idx_knowledge_versions_content_updated_by on public.knowledge_article_versions(content_updated_by) where content_updated_by is not null;
create index if not exists idx_knowledge_versions_published_by on public.knowledge_article_versions(published_by) where published_by is not null;
create index if not exists idx_knowledge_versions_product on public.knowledge_article_versions(product_id) where product_id is not null;
create index if not exists idx_knowledge_versions_module on public.knowledge_article_versions(module_id) where module_id is not null;

alter table public.knowledge_articles
  add column if not exists active_version_id uuid,
  add column if not exists draft_version_id uuid;
do $$
begin
  if not exists(select 1 from pg_constraint where conname='knowledge_articles_active_version_fkey') then
    alter table public.knowledge_articles add constraint knowledge_articles_active_version_fkey foreign key(active_version_id) references public.knowledge_article_versions(id) on delete set null;
  end if;
  if not exists(select 1 from pg_constraint where conname='knowledge_articles_draft_version_fkey') then
    alter table public.knowledge_articles add constraint knowledge_articles_draft_version_fkey foreign key(draft_version_id) references public.knowledge_article_versions(id) on delete set null;
  end if;
end $$;

create table if not exists public.knowledge_version_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  article_id uuid not null references public.knowledge_articles(id) on delete cascade,
  version_id uuid not null references public.knowledge_article_versions(id) on delete cascade,
  event_type text not null check (event_type in ('created','updated','published','archived','restored')),
  note text,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_knowledge_version_events_version on public.knowledge_version_events(version_id,created_at desc);
create index if not exists idx_knowledge_version_events_article on public.knowledge_version_events(article_id,created_at desc);
create index if not exists idx_knowledge_version_events_actor on public.knowledge_version_events(actor_id) where actor_id is not null;

create table if not exists public.knowledge_version_translations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  article_id uuid not null references public.knowledge_articles(id) on delete cascade,
  version_id uuid not null references public.knowledge_article_versions(id) on delete cascade,
  language text not null check (language in ('es','en')),
  source_hash text not null,
  title text not null,
  summary text,
  content text not null default '',
  content_blocks jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  provider text not null default 'openai',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(version_id,language)
);
create index if not exists idx_knowledge_translations_article on public.knowledge_version_translations(article_id,language);
create index if not exists idx_knowledge_translations_workspace on public.knowledge_version_translations(workspace_id,language);
create index if not exists idx_knowledge_translations_version on public.knowledge_version_translations(version_id);

alter table public.knowledge_article_versions enable row level security;
alter table public.knowledge_version_events enable row level security;
alter table public.knowledge_version_translations enable row level security;
revoke all on public.knowledge_article_versions,public.knowledge_version_events,public.knowledge_version_translations from anon;
grant select,insert,update,delete on public.knowledge_article_versions to authenticated;
grant select on public.knowledge_version_events,public.knowledge_version_translations to authenticated;

drop policy if exists knowledge_versions_select on public.knowledge_article_versions;
create policy knowledge_versions_select on public.knowledge_article_versions for select to authenticated using (
  private.is_workspace_member(workspace_id) and (status in ('published','archived') or private.has_workspace_permission(workspace_id,'manage_settings'))
);
drop policy if exists knowledge_versions_insert on public.knowledge_article_versions;
create policy knowledge_versions_insert on public.knowledge_article_versions for insert to authenticated with check (
  private.has_workspace_permission(workspace_id,'manage_settings') and (created_by is null or created_by=(select auth.uid()))
);
drop policy if exists knowledge_versions_update on public.knowledge_article_versions;
create policy knowledge_versions_update on public.knowledge_article_versions for update to authenticated
using (private.has_workspace_permission(workspace_id,'manage_settings'))
with check (private.has_workspace_permission(workspace_id,'manage_settings'));
drop policy if exists knowledge_versions_delete on public.knowledge_article_versions;
create policy knowledge_versions_delete on public.knowledge_article_versions for delete to authenticated using (
  private.has_workspace_permission(workspace_id,'manage_settings') and status='draft'
);

drop policy if exists knowledge_version_events_select on public.knowledge_version_events;
create policy knowledge_version_events_select on public.knowledge_version_events for select to authenticated using (private.is_workspace_member(workspace_id));

drop policy if exists knowledge_translations_select on public.knowledge_version_translations;
create policy knowledge_translations_select on public.knowledge_version_translations for select to authenticated using (
  private.is_workspace_member(workspace_id) and exists (
    select 1 from public.knowledge_article_versions v where v.id=version_id and v.workspace_id=knowledge_version_translations.workspace_id
      and (v.status in ('published','archived') or private.has_workspace_permission(v.workspace_id,'manage_settings'))
  )
);

-- Existing articles become version 1 without changing their public content.
insert into public.knowledge_article_versions(
  article_id,workspace_id,version_number,status,change_note,title,slug,summary,content,content_blocks,tags,product_id,module_id,
  created_by,updated_by,content_updated_by,published_by,created_at,updated_at,content_updated_at,published_at
)
select a.id,a.workspace_id,1,case when a.status='published' then 'published' else 'draft' end,'Versión inicial',a.title,a.slug,a.summary,a.content,a.content_blocks,a.tags,a.product_id,a.module_id,
       a.created_by,a.updated_by,coalesce(a.updated_by,a.created_by),case when a.status='published' then coalesce(a.updated_by,a.created_by) end,
       a.created_at,a.updated_at,a.updated_at,case when a.status='published' then a.updated_at end
from public.knowledge_articles a
where not exists(select 1 from public.knowledge_article_versions v where v.article_id=a.id);

update public.knowledge_articles a set active_version_id=v.id
from public.knowledge_article_versions v where v.article_id=a.id and v.status='published' and a.active_version_id is null;
update public.knowledge_articles a set draft_version_id=v.id
from public.knowledge_article_versions v where v.article_id=a.id and v.status='draft' and a.draft_version_id is null;

insert into public.knowledge_version_events(workspace_id,article_id,version_id,event_type,note,actor_id,created_at)
select v.workspace_id,v.article_id,v.id,'created',v.change_note,v.created_by,v.created_at
from public.knowledge_article_versions v where not exists(select 1 from public.knowledge_version_events e where e.version_id=v.id and e.event_type='created');
insert into public.knowledge_version_events(workspace_id,article_id,version_id,event_type,note,actor_id,created_at)
select v.workspace_id,v.article_id,v.id,'published',v.change_note,v.published_by,coalesce(v.published_at,v.updated_at)
from public.knowledge_article_versions v where v.status='published' and not exists(select 1 from public.knowledge_version_events e where e.version_id=v.id and e.event_type='published');

create or replace function private.guard_knowledge_version()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare content_changed boolean:=true;
begin
  if not exists(select 1 from public.knowledge_articles a where a.id=new.article_id and a.workspace_id=new.workspace_id) then raise exception 'Knowledge version must belong to the same workspace as its article'; end if;
  if new.product_id is not null and not exists(select 1 from public.products p where p.id=new.product_id and p.workspace_id=new.workspace_id) then raise exception 'Knowledge version product must belong to the same workspace'; end if;
  if new.module_id is not null and not exists(select 1 from public.ticket_modules m where m.id=new.module_id and m.workspace_id=new.workspace_id) then raise exception 'Knowledge version module must belong to the same workspace'; end if;
  new.title=btrim(new.title);
  new.slug=trim(both '-' from lower(regexp_replace(btrim(new.slug),'[^a-zA-Z0-9]+','-','g')));
  if new.slug='' then raise exception 'Knowledge version slug is required'; end if;
  new.change_note=coalesce(nullif(btrim(new.change_note),''),'Actualización del artículo');
  if tg_op='UPDATE' then
    content_changed := row(new.title,new.slug,new.summary,new.content,new.content_blocks,new.tags,new.product_id,new.module_id)
      is distinct from row(old.title,old.slug,old.summary,old.content,old.content_blocks,old.tags,old.product_id,old.module_id);
  end if;
  if tg_op='INSERT' or content_changed then
    new.content_updated_by=coalesce((select auth.uid()),new.content_updated_by,new.updated_by,new.created_by);
    new.content_updated_at=now();
  end if;
  new.updated_at=now();new.updated_by=coalesce((select auth.uid()),new.updated_by);
  return new;
end $$;
drop trigger if exists trg_guard_knowledge_version on public.knowledge_article_versions;
create trigger trg_guard_knowledge_version before insert or update on public.knowledge_article_versions for each row execute function private.guard_knowledge_version();

create or replace function private.audit_knowledge_version()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare evt text;
begin
  if tg_op='INSERT' then evt:='created';
  elsif old.status is distinct from new.status and new.status='published' then evt:=case when old.status='archived' then 'restored' else 'published' end;
  elsif old.status is distinct from new.status and new.status='archived' then evt:='archived';
  else evt:='updated'; end if;
  insert into public.knowledge_version_events(workspace_id,article_id,version_id,event_type,note,actor_id)
  values(new.workspace_id,new.article_id,new.id,evt,new.change_note,coalesce((select auth.uid()),new.updated_by,new.created_by));
  return new;
end $$;
drop trigger if exists trg_audit_knowledge_version on public.knowledge_article_versions;
create trigger trg_audit_knowledge_version after insert or update on public.knowledge_article_versions for each row execute function private.audit_knowledge_version();

create or replace function public.create_knowledge_draft_version(p_article_id uuid,p_change_note text)
returns uuid language plpgsql security invoker set search_path=public,private,pg_temp as $$
declare a public.knowledge_articles%rowtype;src public.knowledge_article_versions%rowtype;v_id uuid;v_no int;
begin
  select * into a from public.knowledge_articles where id=p_article_id;if not found then raise exception 'Knowledge article not found';end if;
  if not private.has_workspace_permission(a.workspace_id,'manage_settings') then raise exception 'Insufficient Knowledge permissions';end if;
  if nullif(btrim(coalesce(p_change_note,'')),'') is null then raise exception 'Describe why this new version is being created';end if;
  if a.draft_version_id is not null then raise exception 'This article already has an active draft version';end if;
  if a.active_version_id is not null then select * into src from public.knowledge_article_versions where id=a.active_version_id;
  else src.title:=a.title;src.slug:=a.slug;src.summary:=a.summary;src.content:=a.content;src.content_blocks:=a.content_blocks;src.tags:=a.tags;src.product_id:=a.product_id;src.module_id:=a.module_id;end if;
  select coalesce(max(version_number),0)+1 into v_no from public.knowledge_article_versions where article_id=a.id;
  insert into public.knowledge_article_versions(article_id,workspace_id,version_number,status,change_note,title,slug,summary,content,content_blocks,tags,product_id,module_id,created_by,updated_by)
  values(a.id,a.workspace_id,v_no,'draft',btrim(p_change_note),src.title,src.slug,src.summary,src.content,src.content_blocks,src.tags,src.product_id,src.module_id,(select auth.uid()),(select auth.uid())) returning id into v_id;
  update public.knowledge_articles set draft_version_id=v_id where id=a.id;return v_id;
end $$;
revoke all on function public.create_knowledge_draft_version(uuid,text) from public,anon;grant execute on function public.create_knowledge_draft_version(uuid,text) to authenticated;

create or replace function public.publish_knowledge_version(p_version_id uuid)
returns jsonb language plpgsql security invoker set search_path=public,private,pg_temp as $$
declare v public.knowledge_article_versions%rowtype;a public.knowledge_articles%rowtype;old_id uuid;
begin
  select * into v from public.knowledge_article_versions where id=p_version_id;if not found then raise exception 'Knowledge version not found';end if;
  select * into a from public.knowledge_articles where id=v.article_id;
  if not private.has_workspace_permission(v.workspace_id,'manage_settings') then raise exception 'Insufficient Knowledge permissions';end if;
  old_id:=a.active_version_id;
  if old_id is not null and old_id<>v.id then update public.knowledge_article_versions set status='archived' where id=old_id;end if;
  update public.knowledge_article_versions set status='published',published_by=(select auth.uid()),published_at=now() where id=v.id;
  update public.knowledge_articles set title=v.title,slug=v.slug,summary=v.summary,content=v.content,content_blocks=v.content_blocks,tags=v.tags,product_id=v.product_id,module_id=v.module_id,status='published',active_version_id=v.id,draft_version_id=case when draft_version_id=v.id then null else draft_version_id end,updated_by=(select auth.uid()),updated_at=now() where id=v.article_id;
  return jsonb_build_object('article_id',v.article_id,'version_id',v.id,'version_number',v.version_number);
end $$;
revoke all on function public.publish_knowledge_version(uuid) from public,anon;grant execute on function public.publish_knowledge_version(uuid) to authenticated;

create or replace function public.discard_knowledge_draft_version(p_version_id uuid)
returns boolean language plpgsql security invoker set search_path=public,private,pg_temp as $$
declare v public.knowledge_article_versions%rowtype;
begin
  select * into v from public.knowledge_article_versions where id=p_version_id and status='draft';if not found then raise exception 'Draft version not found';end if;
  if not private.has_workspace_permission(v.workspace_id,'manage_settings') then raise exception 'Insufficient Knowledge permissions';end if;
  update public.knowledge_articles set draft_version_id=null where id=v.article_id and draft_version_id=v.id;delete from public.knowledge_article_versions where id=v.id;return true;
end $$;
revoke all on function public.discard_knowledge_draft_version(uuid) from public,anon;grant execute on function public.discard_knowledge_draft_version(uuid) to authenticated;

do $$
declare t text;
begin
  foreach t in array array['knowledge_article_versions','knowledge_version_events','knowledge_version_translations'] loop
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t);end if;
  end loop;
end $$;

-- v16.4 hardening: published/archived versions are immutable and status transitions are controlled.
create or replace function private.guard_knowledge_version()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
declare
  content_changed boolean:=true;
  state_change_allowed boolean:=coalesce(current_setting('app.knowledge_publish',true),'')='on';
begin
  if not exists(select 1 from public.knowledge_articles a where a.id=new.article_id and a.workspace_id=new.workspace_id) then raise exception 'Knowledge version must belong to the same workspace as its article'; end if;
  if new.product_id is not null and not exists(select 1 from public.products p where p.id=new.product_id and p.workspace_id=new.workspace_id) then raise exception 'Knowledge version product must belong to the same workspace'; end if;
  if new.module_id is not null and not exists(select 1 from public.ticket_modules m where m.id=new.module_id and m.workspace_id=new.workspace_id) then raise exception 'Knowledge version module must belong to the same workspace'; end if;
  new.title=btrim(new.title);
  new.slug=trim(both '-' from lower(regexp_replace(btrim(new.slug),'[^a-zA-Z0-9]+','-','g')));
  if new.slug='' then raise exception 'Knowledge version slug is required'; end if;
  new.change_note=coalesce(nullif(btrim(new.change_note),''),'Actualización del artículo');
  if tg_op='UPDATE' then
    content_changed := row(new.title,new.slug,new.summary,new.content,new.content_blocks,new.tags,new.product_id,new.module_id,new.change_note)
      is distinct from row(old.title,old.slug,old.summary,old.content,old.content_blocks,old.tags,old.product_id,old.module_id,old.change_note);
    if old.status<>'draft' and content_changed then raise exception 'Published or archived Knowledge versions are immutable'; end if;
    if new.status is distinct from old.status and not state_change_allowed then raise exception 'Knowledge version status can only change through the controlled publish workflow'; end if;
  end if;
  if tg_op='INSERT' or content_changed then
    new.content_updated_by=coalesce((select auth.uid()),new.content_updated_by,new.updated_by,new.created_by);
    new.content_updated_at=now();
  end if;
  new.updated_at=now();
  new.updated_by=coalesce((select auth.uid()),new.updated_by);
  return new;
end $$;

create or replace function public.publish_knowledge_version(p_version_id uuid)
returns jsonb
language plpgsql security invoker
set search_path=public,private,pg_temp
as $$
declare v public.knowledge_article_versions%rowtype;a public.knowledge_articles%rowtype;old_id uuid;
begin
  select * into v from public.knowledge_article_versions where id=p_version_id;if not found then raise exception 'Knowledge version not found';end if;
  select * into a from public.knowledge_articles where id=v.article_id;
  if not private.has_workspace_permission(v.workspace_id,'manage_settings') then raise exception 'Insufficient Knowledge permissions';end if;
  perform set_config('app.knowledge_publish','on',true);
  old_id:=a.active_version_id;
  if old_id is not null and old_id<>v.id then update public.knowledge_article_versions set status='archived' where id=old_id;end if;
  update public.knowledge_article_versions set status='published',published_by=(select auth.uid()),published_at=now() where id=v.id;
  update public.knowledge_articles set title=v.title,slug=v.slug,summary=v.summary,content=v.content,content_blocks=v.content_blocks,tags=v.tags,product_id=v.product_id,module_id=v.module_id,status='published',active_version_id=v.id,draft_version_id=case when draft_version_id=v.id then null else draft_version_id end,updated_by=(select auth.uid()),updated_at=now() where id=v.article_id;
  return jsonb_build_object('article_id',v.article_id,'version_id',v.id,'version_number',v.version_number);
end $$;
revoke all on function public.publish_knowledge_version(uuid) from public,anon;
grant execute on function public.publish_knowledge_version(uuid) to authenticated;

-- v16.4 performance indexes for new versioning foreign keys.
create index if not exists idx_knowledge_articles_active_version on public.knowledge_articles(active_version_id) where active_version_id is not null;
create index if not exists idx_knowledge_articles_draft_version on public.knowledge_articles(draft_version_id) where draft_version_id is not null;
create index if not exists idx_knowledge_version_events_workspace on public.knowledge_version_events(workspace_id);
