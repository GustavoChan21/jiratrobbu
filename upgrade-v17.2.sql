-- Jira Interno TROBBU v17.2
-- Base requerida: v17.1
-- Knowledge regression hardening, authoring blocks, semantic relevance and responsive Gantt.

begin;

-- -----------------------------------------------------------------------------
-- 1) Knowledge tables: reassert grants and the exact create/edit/version RBAC.
--    Creators may fully maintain their own initial draft; published content and
--    subsequent versions remain controlled by edit_knowledge.
-- -----------------------------------------------------------------------------
alter table public.knowledge_articles enable row level security;
alter table public.knowledge_article_versions enable row level security;
alter table public.knowledge_media enable row level security;

revoke all on public.knowledge_articles from anon;
revoke all on public.knowledge_article_versions from anon;
revoke all on public.knowledge_media from anon;
grant select,insert,update,delete on public.knowledge_articles to authenticated;
grant select,insert,update,delete on public.knowledge_article_versions to authenticated;
grant select,insert,delete on public.knowledge_media to authenticated;

drop policy if exists knowledge_articles_select on public.knowledge_articles;
create policy knowledge_articles_select on public.knowledge_articles for select to authenticated using (
  (status='published' and private.has_workspace_permission(workspace_id,'view_knowledge'))
  or private.has_workspace_permission(workspace_id,'edit_knowledge')
  or (
    status='draft' and active_version_id is null and created_by=(select auth.uid())
    and private.has_workspace_permission(workspace_id,'create_knowledge')
  )
);

drop policy if exists knowledge_articles_insert on public.knowledge_articles;
create policy knowledge_articles_insert on public.knowledge_articles for insert to authenticated with check (
  private.has_workspace_permission(workspace_id,'create_knowledge')
  and (created_by is null or created_by=(select auth.uid()))
);

drop policy if exists knowledge_articles_update on public.knowledge_articles;
create policy knowledge_articles_update on public.knowledge_articles for update to authenticated
using (
  private.has_workspace_permission(workspace_id,'edit_knowledge') or (
    private.has_workspace_permission(workspace_id,'create_knowledge')
    and created_by=(select auth.uid()) and status='draft' and active_version_id is null
  )
)
with check (
  private.has_workspace_permission(workspace_id,'edit_knowledge') or (
    private.has_workspace_permission(workspace_id,'create_knowledge')
    and created_by=(select auth.uid()) and status='draft' and active_version_id is null
  )
);

drop policy if exists knowledge_articles_delete on public.knowledge_articles;
create policy knowledge_articles_delete on public.knowledge_articles for delete to authenticated using (
  private.has_workspace_permission(workspace_id,'delete_knowledge') or (
    private.has_workspace_permission(workspace_id,'create_knowledge')
    and created_by=(select auth.uid()) and status='draft' and active_version_id is null
  )
);

drop policy if exists knowledge_versions_select on public.knowledge_article_versions;
create policy knowledge_versions_select on public.knowledge_article_versions for select to authenticated using (
  (status in ('published','archived') and private.has_workspace_permission(workspace_id,'view_knowledge'))
  or private.has_workspace_permission(workspace_id,'edit_knowledge')
  or (
    status='draft' and created_by=(select auth.uid())
    and private.has_workspace_permission(workspace_id,'create_knowledge')
  )
);

drop policy if exists knowledge_versions_insert on public.knowledge_article_versions;
create policy knowledge_versions_insert on public.knowledge_article_versions for insert to authenticated with check (
  private.has_workspace_permission(workspace_id,'create_knowledge')
  and (created_by is null or created_by=(select auth.uid()))
);

drop policy if exists knowledge_versions_update on public.knowledge_article_versions;
create policy knowledge_versions_update on public.knowledge_article_versions for update to authenticated
using (
  private.has_workspace_permission(workspace_id,'edit_knowledge') or (
    private.has_workspace_permission(workspace_id,'create_knowledge')
    and created_by=(select auth.uid()) and status='draft'
  )
)
with check (
  private.has_workspace_permission(workspace_id,'edit_knowledge') or (
    private.has_workspace_permission(workspace_id,'create_knowledge')
    and created_by=(select auth.uid()) and status='draft'
  )
);

drop policy if exists knowledge_versions_delete on public.knowledge_article_versions;
create policy knowledge_versions_delete on public.knowledge_article_versions for delete to authenticated using (
  status='draft' and (
    private.has_workspace_permission(workspace_id,'delete_knowledge') or (
      private.has_workspace_permission(workspace_id,'create_knowledge') and created_by=(select auth.uid())
    )
  )
);

-- -----------------------------------------------------------------------------
-- 2) Knowledge media rows follow the same author/edit capabilities.
-- -----------------------------------------------------------------------------
drop policy if exists knowledge_media_select on public.knowledge_media;
create policy knowledge_media_select on public.knowledge_media for select to authenticated using (
  exists (
    select 1 from public.knowledge_articles a
    where a.id=article_id and a.workspace_id=knowledge_media.workspace_id and (
      (a.status='published' and private.has_workspace_permission(a.workspace_id,'view_knowledge'))
      or private.has_workspace_permission(a.workspace_id,'edit_knowledge')
      or (
        a.status='draft' and a.active_version_id is null and a.created_by=(select auth.uid())
        and private.has_workspace_permission(a.workspace_id,'create_knowledge')
      )
    )
  )
);

drop policy if exists knowledge_media_insert on public.knowledge_media;
create policy knowledge_media_insert on public.knowledge_media for insert to authenticated with check (
  uploaded_by=(select auth.uid()) and exists (
    select 1 from public.knowledge_articles a
    where a.id=article_id and a.workspace_id=knowledge_media.workspace_id and (
      private.has_workspace_permission(a.workspace_id,'edit_knowledge') or (
        private.has_workspace_permission(a.workspace_id,'create_knowledge')
        and a.created_by=(select auth.uid()) and a.status='draft' and a.active_version_id is null
      )
    )
  )
);

drop policy if exists knowledge_media_delete on public.knowledge_media;
create policy knowledge_media_delete on public.knowledge_media for delete to authenticated using (
  private.has_workspace_permission(workspace_id,'delete_knowledge')
  or private.has_workspace_permission(workspace_id,'edit_knowledge')
  or exists (
    select 1 from public.knowledge_articles a
    where a.id=article_id and a.workspace_id=knowledge_media.workspace_id
      and private.has_workspace_permission(a.workspace_id,'create_knowledge')
      and a.created_by=(select auth.uid()) and a.status='draft' and a.active_version_id is null
  )
);

-- -----------------------------------------------------------------------------
-- 3) Storage helpers: creators must be able to read/upload/rollback media from
--    their own initial draft. This fixes the table-vs-Storage RLS mismatch.
-- -----------------------------------------------------------------------------
create or replace function private.can_view_evidence_object(p_name text)
returns boolean language plpgsql stable security definer
set search_path=public,storage,pg_temp as $$
declare v_workspace uuid;v_parent uuid;v_scope text;
begin
  v_workspace:=split_part(p_name,'/',1)::uuid;v_scope:=split_part(p_name,'/',2);v_parent:=split_part(p_name,'/',3)::uuid;
  if v_scope='tickets' then
    return exists(select 1 from public.tickets t where t.id=v_parent and t.workspace_id=v_workspace and private.has_workspace_permission(v_workspace,'view_tickets') and private.has_product_access(v_workspace,t.product_id));
  elsif v_scope='sprints' then
    return exists(select 1 from public.sprints s where s.id=v_parent and s.workspace_id=v_workspace and private.has_workspace_permission(v_workspace,'view_dashboard'));
  elsif v_scope='helpdesk' then
    return exists(select 1 from public.helpdesk_tickets h where h.id=v_parent and h.workspace_id=v_workspace and private.is_workspace_member(v_workspace) and (private.has_workspace_permission(v_workspace,'manage_helpdesk') or h.requester_user_id=(select auth.uid())));
  elsif v_scope='knowledge' then
    return exists(
      select 1 from public.knowledge_articles a
      where a.id=v_parent and a.workspace_id=v_workspace and (
        (a.status='published' and private.has_workspace_permission(v_workspace,'view_knowledge'))
        or private.has_workspace_permission(v_workspace,'edit_knowledge')
        or (
          a.status='draft' and a.active_version_id is null and a.created_by=(select auth.uid())
          and private.has_workspace_permission(v_workspace,'create_knowledge')
        )
      )
    );
  end if;
  return false;
exception when invalid_text_representation then return false;
end $$;

create or replace function private.can_upload_evidence_object(p_name text)
returns boolean language plpgsql stable security definer
set search_path=public,storage,pg_temp as $$
declare v_workspace uuid;v_parent uuid;v_scope text;
begin
  v_workspace:=split_part(p_name,'/',1)::uuid;v_scope:=split_part(p_name,'/',2);v_parent:=split_part(p_name,'/',3)::uuid;
  if v_scope='tickets' then
    return exists(select 1 from public.tickets t where t.id=v_parent and t.workspace_id=v_workspace and private.has_workspace_permission(v_workspace,'edit_tickets') and private.has_product_access(v_workspace,t.product_id));
  elsif v_scope='sprints' then
    return exists(select 1 from public.sprints s where s.id=v_parent and s.workspace_id=v_workspace and private.has_workspace_permission(v_workspace,'edit_tickets'));
  elsif v_scope='helpdesk' then
    return exists(select 1 from public.helpdesk_tickets h where h.id=v_parent and h.workspace_id=v_workspace and private.is_workspace_member(v_workspace) and (private.has_workspace_permission(v_workspace,'manage_helpdesk') or h.requester_user_id=(select auth.uid())));
  elsif v_scope='knowledge' then
    return exists(
      select 1 from public.knowledge_articles a
      where a.id=v_parent and a.workspace_id=v_workspace and (
        private.has_workspace_permission(v_workspace,'edit_knowledge') or (
          private.has_workspace_permission(v_workspace,'create_knowledge')
          and a.created_by=(select auth.uid()) and a.status='draft' and a.active_version_id is null
        )
      )
    );
  end if;
  return false;
exception when invalid_text_representation then return false;
end $$;

create or replace function private.can_manage_evidence_object(p_name text)
returns boolean language plpgsql stable security definer
set search_path=public,storage,pg_temp as $$
declare v_workspace uuid;v_parent uuid;v_scope text;
begin
  v_workspace:=split_part(p_name,'/',1)::uuid;v_scope:=split_part(p_name,'/',2);v_parent:=split_part(p_name,'/',3)::uuid;
  if v_scope='helpdesk' then return private.has_workspace_permission(v_workspace,'manage_helpdesk');
  elsif v_scope='sprints' then return private.has_workspace_permission(v_workspace,'manage_sprints');
  elsif v_scope='knowledge' then
    return private.has_workspace_permission(v_workspace,'delete_knowledge')
      or private.has_workspace_permission(v_workspace,'edit_knowledge')
      or exists(
        select 1 from public.knowledge_articles a
        where a.id=v_parent and a.workspace_id=v_workspace
          and private.has_workspace_permission(v_workspace,'create_knowledge')
          and a.created_by=(select auth.uid()) and a.status='draft' and a.active_version_id is null
      );
  end if;
  return private.has_workspace_permission(v_workspace,'delete_tickets');
exception when invalid_text_representation then return false;
end $$;

revoke all on function private.can_view_evidence_object(text) from public,anon;
revoke all on function private.can_upload_evidence_object(text) from public,anon;
revoke all on function private.can_manage_evidence_object(text) from public,anon;
grant execute on function private.can_view_evidence_object(text) to authenticated;
grant execute on function private.can_upload_evidence_object(text) to authenticated;
grant execute on function private.can_manage_evidence_object(text) to authenticated;

-- Keep the existing MIME/name restriction while refreshing Storage policies.
drop policy if exists jira_evidence_select on storage.objects;
create policy jira_evidence_select on storage.objects for select to authenticated
using(bucket_id='jira-evidence' and private.can_view_evidence_object(name));

drop policy if exists jira_evidence_insert on storage.objects;
create policy jira_evidence_insert on storage.objects for insert to authenticated
with check(
  bucket_id='jira-evidence'
  and private.can_upload_evidence_object(name)
  and private.is_allowed_jira_evidence_name(name)
);

drop policy if exists jira_evidence_delete on storage.objects;
create policy jira_evidence_delete on storage.objects for delete to authenticated
using(bucket_id='jira-evidence' and (owner=(select auth.uid()) or private.can_manage_evidence_object(name)));

-- Explicitly retain RPC execution required for later-version workflow.
revoke all on function public.create_knowledge_draft_version(uuid,text) from public,anon;
revoke all on function public.publish_knowledge_version(uuid) from public,anon;
revoke all on function public.discard_knowledge_draft_version(uuid) from public,anon;
grant execute on function public.create_knowledge_draft_version(uuid,text) to authenticated;
grant execute on function public.publish_knowledge_version(uuid) to authenticated;
grant execute on function public.discard_knowledge_draft_version(uuid) to authenticated;

commit;
