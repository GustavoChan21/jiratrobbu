-- Jira Interno TROBBU v16
-- Knowledge, bulk sprint planning, Staff identity sync and Realtime publication.

create table if not exists public.knowledge_articles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  slug text not null,
  summary text,
  content text not null default '',
  tags text[] not null default '{}',
  product_id uuid references public.products(id) on delete set null,
  module_id uuid references public.ticket_modules(id) on delete set null,
  status text not null default 'published' check (status in ('draft','published','archived')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,slug),
  check (length(btrim(title)) between 2 and 180),
  check (length(content) <= 80000)
);
create index if not exists idx_knowledge_articles_workspace_status on public.knowledge_articles(workspace_id,status,updated_at desc);
create index if not exists idx_knowledge_articles_product on public.knowledge_articles(workspace_id,product_id) where product_id is not null;
create index if not exists idx_knowledge_articles_module on public.knowledge_articles(workspace_id,module_id) where module_id is not null;
create index if not exists idx_knowledge_articles_product_id on public.knowledge_articles(product_id) where product_id is not null;
create index if not exists idx_knowledge_articles_module_id on public.knowledge_articles(module_id) where module_id is not null;
create index if not exists idx_knowledge_articles_created_by on public.knowledge_articles(created_by) where created_by is not null;
create index if not exists idx_knowledge_articles_updated_by on public.knowledge_articles(updated_by) where updated_by is not null;
alter table public.knowledge_articles enable row level security;
revoke all on public.knowledge_articles from anon;
grant select,insert,update,delete on public.knowledge_articles to authenticated;

drop policy if exists knowledge_articles_select on public.knowledge_articles;
create policy knowledge_articles_select on public.knowledge_articles for select to authenticated using (
  private.is_workspace_member(workspace_id)
  and (status='published' or private.has_workspace_permission(workspace_id,'manage_settings'))
);
drop policy if exists knowledge_articles_insert on public.knowledge_articles;
create policy knowledge_articles_insert on public.knowledge_articles for insert to authenticated with check (
  private.has_workspace_permission(workspace_id,'manage_settings')
  and (created_by is null or created_by=(select auth.uid()))
);
drop policy if exists knowledge_articles_update on public.knowledge_articles;
create policy knowledge_articles_update on public.knowledge_articles for update to authenticated
using (private.has_workspace_permission(workspace_id,'manage_settings'))
with check (private.has_workspace_permission(workspace_id,'manage_settings'));
drop policy if exists knowledge_articles_delete on public.knowledge_articles;
create policy knowledge_articles_delete on public.knowledge_articles for delete to authenticated
using (private.has_workspace_permission(workspace_id,'manage_settings'));

create or replace function private.guard_knowledge_article()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  new.title=btrim(new.title);
  new.slug=lower(regexp_replace(btrim(new.slug),'[^a-zA-Z0-9]+','-','g'));
  new.slug=trim(both '-' from new.slug);
  if new.slug='' then raise exception 'Knowledge slug is required'; end if;
  if new.product_id is not null and not exists(select 1 from public.products p where p.id=new.product_id and p.workspace_id=new.workspace_id) then
    raise exception 'Knowledge product must belong to the same workspace';
  end if;
  if new.module_id is not null and not exists(select 1 from public.ticket_modules m where m.id=new.module_id and m.workspace_id=new.workspace_id) then
    raise exception 'Knowledge module must belong to the same workspace';
  end if;
  new.updated_at=now();
  new.updated_by=coalesce((select auth.uid()),new.updated_by);
  return new;
end $$;
drop trigger if exists trg_guard_knowledge_article on public.knowledge_articles;
create trigger trg_guard_knowledge_article before insert or update on public.knowledge_articles
for each row execute function private.guard_knowledge_article();

create or replace function public.bulk_move_tickets_to_sprint(p_workspace uuid,p_ticket_ids uuid[],p_sprint_id uuid)
returns jsonb language plpgsql security invoker set search_path=public,private,pg_temp as $$
declare
  v_sprint public.sprints%rowtype;
  v_requested int;
  v_allowed int;
  v_moved int;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not private.has_workspace_permission(p_workspace,'manage_sprints') then raise exception 'Insufficient sprint permissions'; end if;
  if p_ticket_ids is null or cardinality(p_ticket_ids)=0 then raise exception 'Select at least one ticket'; end if;
  if cardinality(p_ticket_ids)>100 then raise exception 'Maximum 100 tickets per bulk move'; end if;
  select * into v_sprint from public.sprints where id=p_sprint_id and workspace_id=p_workspace and status in ('active','planned');
  if not found then raise exception 'Sprint is not active or planned in this workspace'; end if;
  select count(distinct x) into v_requested from unnest(p_ticket_ids) x;
  select count(*) into v_allowed from public.tickets t
  where t.workspace_id=p_workspace and t.id=any(p_ticket_ids) and t.sprint_id is null and t.status<>'closed'
    and private.has_product_access(p_workspace,t.product_id);
  if v_allowed<>v_requested then raise exception 'One or more selected tickets are invalid, already planned, closed, or outside your product scope'; end if;
  update public.tickets t set sprint_id=v_sprint.id,
      status=case when t.status='backlog' then 'todo'::public.ticket_status else t.status end,
      start_date=coalesce(t.start_date,v_sprint.start_date),due_date=coalesce(t.due_date,v_sprint.end_date),updated_at=now()
  where t.workspace_id=p_workspace and t.id=any(p_ticket_ids);
  get diagnostics v_moved=row_count;
  return jsonb_build_object('moved',v_moved,'sprint_id',v_sprint.id,'sprint_name',v_sprint.name);
end $$;
revoke all on function public.bulk_move_tickets_to_sprint(uuid,uuid[],uuid) from public,anon;
grant execute on function public.bulk_move_tickets_to_sprint(uuid,uuid[],uuid) to authenticated;

alter table public.profiles add column if not exists email text;
update public.profiles p set email=u.email from auth.users u where u.id=p.id and p.email is distinct from u.email;
create or replace function private.sync_profile_auth_identity()
returns trigger language plpgsql security definer set search_path=public,auth,pg_temp as $$
begin
  insert into public.profiles(id,email,full_name,updated_at)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name'),now())
  on conflict(id) do update set email=excluded.email,full_name=coalesce(public.profiles.full_name,excluded.full_name),updated_at=now();
  return new;
end $$;
drop trigger if exists trg_sync_profile_auth_identity on auth.users;
create trigger trg_sync_profile_auth_identity after insert or update of email,raw_user_meta_data on auth.users
for each row execute function private.sync_profile_auth_identity();

-- Realtime: add only when absent so this migration is idempotent.
do $$
declare t text;
begin
  foreach t in array array[
    'tickets','sprints','products','ticket_modules','ticket_tags','ticket_tag_links','ticket_links','ticket_attachments',
    'ticket_comments','ticket_activity','sprint_comments','sprint_attachments','workspace_members','workspace_member_products',
    'workspace_roles','profiles','helpdesk_tickets','helpdesk_comments','helpdesk_attachments','notifications','knowledge_articles',
    'custom_ticket_fields','custom_ticket_field_products','ticket_custom_field_values'
  ] loop
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime add table public.%I',t);
    end if;
  end loop;
end $$;
