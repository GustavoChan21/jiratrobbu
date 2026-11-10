-- Jira Interno TROBBU v16.1
-- Knowledge rich content + private media + Helpdesk author snapshot.

alter table public.knowledge_articles
  add column if not exists content_blocks jsonb not null default '[]'::jsonb;

create table if not exists public.knowledge_media (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  article_id uuid not null references public.knowledge_articles(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  original_size_bytes bigint,
  width integer,
  height integer,
  created_at timestamptz not null default now()
);
create index if not exists idx_knowledge_media_article on public.knowledge_media(article_id,created_at);
create index if not exists idx_knowledge_media_workspace on public.knowledge_media(workspace_id);
create index if not exists idx_knowledge_media_uploaded_by on public.knowledge_media(uploaded_by);

alter table public.knowledge_media enable row level security;
revoke all on public.knowledge_media from anon;
grant select,insert,delete on public.knowledge_media to authenticated;

drop policy if exists knowledge_media_select on public.knowledge_media;
create policy knowledge_media_select on public.knowledge_media
for select to authenticated using (
  exists (
    select 1 from public.knowledge_articles a
    where a.id=article_id
      and a.workspace_id=knowledge_media.workspace_id
      and private.is_workspace_member(a.workspace_id)
      and (a.status='published' or private.has_workspace_permission(a.workspace_id,'manage_settings'))
  )
);

drop policy if exists knowledge_media_insert on public.knowledge_media;
create policy knowledge_media_insert on public.knowledge_media
for insert to authenticated with check (
  uploaded_by=(select auth.uid())
  and private.has_workspace_permission(workspace_id,'manage_settings')
  and exists (
    select 1 from public.knowledge_articles a
    where a.id=article_id and a.workspace_id=knowledge_media.workspace_id
  )
);

drop policy if exists knowledge_media_delete on public.knowledge_media;
create policy knowledge_media_delete on public.knowledge_media
for delete to authenticated using (
  private.has_workspace_permission(workspace_id,'manage_settings')
);

create or replace function private.can_view_evidence_object(p_name text)
returns boolean language plpgsql stable security definer
set search_path=public,storage,pg_temp as $$
declare v_workspace uuid; v_parent uuid; v_scope text;
begin
  v_workspace:=split_part(p_name,'/',1)::uuid;
  v_scope:=split_part(p_name,'/',2);
  v_parent:=split_part(p_name,'/',3)::uuid;
  if v_scope='tickets' then
    return exists(select 1 from public.tickets t where t.id=v_parent and t.workspace_id=v_workspace and private.has_workspace_permission(v_workspace,'view_tickets') and private.has_product_access(v_workspace,t.product_id));
  elsif v_scope='sprints' then
    return exists(select 1 from public.sprints s where s.id=v_parent and s.workspace_id=v_workspace and private.has_workspace_permission(v_workspace,'view_dashboard'));
  elsif v_scope='helpdesk' then
    return exists(select 1 from public.helpdesk_tickets h where h.id=v_parent and h.workspace_id=v_workspace and private.is_workspace_member(v_workspace) and (private.has_workspace_permission(v_workspace,'manage_helpdesk') or h.requester_user_id=(select auth.uid())));
  elsif v_scope='knowledge' then
    return exists(select 1 from public.knowledge_articles a where a.id=v_parent and a.workspace_id=v_workspace and private.is_workspace_member(v_workspace) and (a.status='published' or private.has_workspace_permission(v_workspace,'manage_settings')));
  end if;
  return false;
exception when invalid_text_representation then return false;
end $$;

create or replace function private.can_upload_evidence_object(p_name text)
returns boolean language plpgsql stable security definer
set search_path=public,storage,pg_temp as $$
declare v_workspace uuid; v_parent uuid; v_scope text;
begin
  v_workspace:=split_part(p_name,'/',1)::uuid;
  v_scope:=split_part(p_name,'/',2);
  v_parent:=split_part(p_name,'/',3)::uuid;
  if v_scope='tickets' then
    return exists(select 1 from public.tickets t where t.id=v_parent and t.workspace_id=v_workspace and private.has_workspace_permission(v_workspace,'edit_tickets') and private.has_product_access(v_workspace,t.product_id));
  elsif v_scope='sprints' then
    return exists(select 1 from public.sprints s where s.id=v_parent and s.workspace_id=v_workspace and private.has_workspace_permission(v_workspace,'edit_tickets'));
  elsif v_scope='helpdesk' then
    return exists(select 1 from public.helpdesk_tickets h where h.id=v_parent and h.workspace_id=v_workspace and private.is_workspace_member(v_workspace) and (private.has_workspace_permission(v_workspace,'manage_helpdesk') or h.requester_user_id=(select auth.uid())));
  elsif v_scope='knowledge' then
    return exists(select 1 from public.knowledge_articles a where a.id=v_parent and a.workspace_id=v_workspace and private.has_workspace_permission(v_workspace,'manage_settings'));
  end if;
  return false;
exception when invalid_text_representation then return false;
end $$;

create or replace function private.can_manage_evidence_object(p_name text)
returns boolean language plpgsql stable security definer
set search_path=public,storage,pg_temp as $$
declare v_workspace uuid; v_scope text;
begin
  v_workspace:=split_part(p_name,'/',1)::uuid;
  v_scope:=split_part(p_name,'/',2);
  if v_scope='helpdesk' then return private.has_workspace_permission(v_workspace,'manage_helpdesk');
  elsif v_scope='sprints' then return private.has_workspace_permission(v_workspace,'manage_sprints');
  elsif v_scope='knowledge' then return private.has_workspace_permission(v_workspace,'manage_settings');
  end if;
  return private.has_workspace_permission(v_workspace,'delete_tickets');
exception when invalid_text_representation then return false;
end $$;

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='knowledge_media') then
    alter publication supabase_realtime add table public.knowledge_media;
  end if;
end $$;

alter table public.helpdesk_comments
  add column if not exists author_name text,
  add column if not exists author_email text;

update public.helpdesk_comments c
set author_name=coalesce(p.full_name,u.raw_user_meta_data->>'full_name',u.email,'Usuario'),
    author_email=u.email
from auth.users u
left join public.profiles p on p.id=u.id
where c.author_id=u.id and (c.author_name is null or c.author_email is null);

create or replace function private.snapshot_helpdesk_comment_author()
returns trigger language plpgsql security definer
set search_path=public,auth,pg_temp as $$
declare v_name text; v_email text;
begin
  select coalesce(p.full_name,u.raw_user_meta_data->>'full_name',u.email,'Usuario'),u.email
  into v_name,v_email
  from auth.users u left join public.profiles p on p.id=u.id
  where u.id=new.author_id;
  new.author_name=coalesce(new.author_name,v_name,'Usuario');
  new.author_email=coalesce(new.author_email,v_email);
  return new;
end $$;

drop trigger if exists trg_snapshot_helpdesk_comment_author on public.helpdesk_comments;
create trigger trg_snapshot_helpdesk_comment_author
before insert on public.helpdesk_comments
for each row execute function private.snapshot_helpdesk_comment_author();
