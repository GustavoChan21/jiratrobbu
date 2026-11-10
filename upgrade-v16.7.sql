-- Jira Interno TROBBU v16.7
-- Workspace permissions + assignment audit + document attachments.

-- -----------------------------------------------------------------------------
-- 1) Workspace creation: only Admin / PM / Superadmin (plus first-install bootstrap)
-- -----------------------------------------------------------------------------
create or replace function private.user_can_create_workspace(p_user uuid default auth.uid())
returns boolean
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
begin
  if p_user is null then return false; end if;
  -- Bootstrap exception only when the installation does not contain any workspace yet.
  if not exists(select 1 from public.workspaces) then return true; end if;
  return exists(
    select 1
    from public.workspace_members wm
    left join public.workspace_roles wr
      on wr.id=wm.role_id and wr.workspace_id=wm.workspace_id
    where wm.user_id=p_user
      and wm.active=true
      and coalesce(wr.base_role::text,wm.role::text) in ('admin','pm','superadmin')
  );
end $$;
revoke all on function private.user_can_create_workspace(uuid) from public,anon;
grant execute on function private.user_can_create_workspace(uuid) to authenticated;

drop policy if exists workspaces_insert on public.workspaces;
create policy workspaces_insert
on public.workspaces
for insert
to authenticated
with check (
  created_by=(select auth.uid())
  and private.user_can_create_workspace((select auth.uid()))
);

create or replace function public.create_workspace(p_name text,p_slug text)
returns uuid
language plpgsql
security invoker
set search_path=public,private,pg_temp
as $$
declare
  v_uid uuid:=(select auth.uid());
  v_id uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not private.user_can_create_workspace(v_uid) then
    raise exception 'Solo Admin, PM o Superadmin pueden crear espacios de trabajo';
  end if;
  if nullif(trim(p_name),'') is null or nullif(trim(p_slug),'') is null then
    raise exception 'Workspace name and slug are required';
  end if;
  insert into public.workspaces(name,slug,created_by)
  values(trim(p_name),trim(p_slug),v_uid)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.create_workspace(text,text) from public,anon;
grant execute on function public.create_workspace(text,text) to authenticated;

-- -----------------------------------------------------------------------------
-- 2) Ticket assignment audit for all assignment / reassignment / unassignment
-- -----------------------------------------------------------------------------
create or replace function private.log_ticket_assignment_change()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_actor uuid:=(select auth.uid());
begin
  if old.dev_owner_id is distinct from new.dev_owner_id then
    insert into public.ticket_activity(ticket_id,actor_id,action,from_value,to_value,metadata)
    values(
      new.id,v_actor,'dev_assignee_changed',
      old.dev_owner_id::text,new.dev_owner_id::text,
      jsonb_build_object('assignment_role','dev','product_id',new.product_id,'ticket_key',new.ticket_key)
    );
  end if;
  if old.qa_owner_id is distinct from new.qa_owner_id then
    insert into public.ticket_activity(ticket_id,actor_id,action,from_value,to_value,metadata)
    values(
      new.id,v_actor,'qa_assignee_changed',
      old.qa_owner_id::text,new.qa_owner_id::text,
      jsonb_build_object('assignment_role','qa','product_id',new.product_id,'ticket_key',new.ticket_key)
    );
  end if;
  return new;
end $$;
revoke all on function private.log_ticket_assignment_change() from public,anon,authenticated;

drop trigger if exists trg_ticket_assignment_activity on public.tickets;
create trigger trg_ticket_assignment_activity
after update of dev_owner_id,qa_owner_id on public.tickets
for each row execute function private.log_ticket_assignment_change();

-- -----------------------------------------------------------------------------
-- 3) Private Storage: images + business documents.
-- -----------------------------------------------------------------------------
alter table public.ticket_attachments add column if not exists original_size_bytes bigint;
alter table public.sprint_attachments add column if not exists original_size_bytes bigint;

create or replace function private.is_allowed_jira_evidence_name(p_name text)
returns boolean
language plpgsql
immutable
set search_path=pg_catalog,pg_temp
as $$
declare
  v_scope text:=lower(split_part(coalesce(p_name,''),'/',2));
  v_name text:=lower(coalesce(p_name,''));
begin
  if v_scope='knowledge' then
    return v_name ~ '\.(jpg|jpeg|png|webp|gif)$';
  end if;
  return v_name ~ '\.(jpg|jpeg|png|webp|gif|pdf|csv|xls|xlsx|xlsm|xlsb|xlt|xltx|xltm|doc|docx|docm|dot|dotx|dotm|rtf|ppt|pptx|pptm|pps|ppsx|ppsm|pot|potx|potm|odt|ods|odp|txt)$';
end $$;
revoke all on function private.is_allowed_jira_evidence_name(text) from public,anon;
grant execute on function private.is_allowed_jira_evidence_name(text) to authenticated;

update storage.buckets
set file_size_limit=26214400,
    allowed_mime_types=array[
      'image/jpeg','image/png','image/webp','image/gif',
      'application/pdf','text/csv','application/csv','text/plain',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel.sheet.macroEnabled.12',
      'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
      'application/vnd.ms-excel.template.macroEnabled.12',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-word.document.macroEnabled.12',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
      'application/vnd.ms-word.template.macroEnabled.12',
      'application/rtf','text/rtf',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
      'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
      'application/vnd.ms-powerpoint.slideshow.macroEnabled.12',
      'application/vnd.openxmlformats-officedocument.presentationml.template',
      'application/vnd.ms-powerpoint.template.macroEnabled.12',
      'application/vnd.oasis.opendocument.text',
      'application/vnd.oasis.opendocument.spreadsheet',
      'application/vnd.oasis.opendocument.presentation',
      'application/octet-stream'
    ]::text[]
where id='jira-evidence';

drop policy if exists jira_evidence_insert on storage.objects;
create policy jira_evidence_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id='jira-evidence'
  and private.can_upload_evidence_object(name)
  and private.is_allowed_jira_evidence_name(name)
);


-- -----------------------------------------------------------------------------
-- 4) Live module counters: visible tickets, ticket activity and Knowledge articles.
-- -----------------------------------------------------------------------------
create or replace function public.list_module_counts(p_workspace uuid)
returns table(
  module_id uuid,
  ticket_count bigint,
  activity_count bigint,
  article_count bigint
)
language sql
stable
security invoker
set search_path=public,pg_temp
as $$
  select m.id,
    (select count(*) from public.tickets t where t.workspace_id=p_workspace and t.module_id=m.id) as ticket_count,
    (select count(*) from public.ticket_activity a join public.tickets t on t.id=a.ticket_id where t.workspace_id=p_workspace and t.module_id=m.id) as activity_count,
    (select count(*) from public.knowledge_articles k where k.workspace_id=p_workspace and k.module_id=m.id) as article_count
  from public.ticket_modules m
  where m.workspace_id=p_workspace
  order by m.name
$$;
revoke all on function public.list_module_counts(uuid) from public,anon;
grant execute on function public.list_module_counts(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 5) Attachment FK indexes for document-heavy workloads.
-- -----------------------------------------------------------------------------
create index if not exists idx_ticket_attachments_ticket_workspace on public.ticket_attachments(ticket_id,workspace_id);
create index if not exists idx_ticket_attachments_comment on public.ticket_attachments(comment_id) where comment_id is not null;
create index if not exists idx_ticket_attachments_uploaded_by on public.ticket_attachments(uploaded_by);
create index if not exists idx_ticket_attachments_workspace on public.ticket_attachments(workspace_id);
create index if not exists idx_sprint_attachments_sprint_workspace on public.sprint_attachments(sprint_id,workspace_id);
create index if not exists idx_sprint_attachments_comment on public.sprint_attachments(comment_id) where comment_id is not null;
create index if not exists idx_sprint_attachments_uploaded_by on public.sprint_attachments(uploaded_by);
create index if not exists idx_sprint_attachments_workspace on public.sprint_attachments(workspace_id);

-- -----------------------------------------------------------------------------
-- 6) Initial assignment audit on ticket creation.
-- -----------------------------------------------------------------------------
create or replace function private.log_ticket_initial_assignment()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_actor uuid:=(select auth.uid());
begin
  if new.dev_owner_id is not null then
    insert into public.ticket_activity(ticket_id,actor_id,action,from_value,to_value,metadata)
    values(new.id,v_actor,'dev_assignee_changed',null,new.dev_owner_id::text,
      jsonb_build_object('assignment_role','dev','initial',true,'product_id',new.product_id,'ticket_key',new.ticket_key));
  end if;
  if new.qa_owner_id is not null then
    insert into public.ticket_activity(ticket_id,actor_id,action,from_value,to_value,metadata)
    values(new.id,v_actor,'qa_assignee_changed',null,new.qa_owner_id::text,
      jsonb_build_object('assignment_role','qa','initial',true,'product_id',new.product_id,'ticket_key',new.ticket_key));
  end if;
  return new;
end $$;
revoke all on function private.log_ticket_initial_assignment() from public,anon,authenticated;
drop trigger if exists trg_ticket_initial_assignment_activity on public.tickets;
create trigger trg_ticket_initial_assignment_activity
after insert on public.tickets
for each row execute function private.log_ticket_initial_assignment();
