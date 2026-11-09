-- Jira Interno TROBBU v15.8
-- Helpdesk: evidencia fotográfica optimizada + asignación rápida atómica.

create table if not exists public.helpdesk_attachments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  helpdesk_ticket_id uuid not null references public.helpdesk_tickets(id) on delete cascade,
  comment_id uuid references public.helpdesk_comments(id) on delete set null,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  original_size_bytes bigint,
  evidence_type text not null default 'general' check (evidence_type in ('general')),
  created_at timestamptz not null default now()
);

create index if not exists idx_helpdesk_attachments_ticket
  on public.helpdesk_attachments(helpdesk_ticket_id,created_at);
create index if not exists idx_helpdesk_attachments_comment
  on public.helpdesk_attachments(comment_id) where comment_id is not null;
create index if not exists idx_helpdesk_attachments_workspace
  on public.helpdesk_attachments(workspace_id);
create index if not exists idx_helpdesk_attachments_uploaded_by
  on public.helpdesk_attachments(uploaded_by);

alter table public.helpdesk_attachments enable row level security;
grant select,insert,delete on public.helpdesk_attachments to authenticated;
revoke all on public.helpdesk_attachments from anon;

drop policy if exists helpdesk_attachments_select on public.helpdesk_attachments;
create policy helpdesk_attachments_select on public.helpdesk_attachments
for select to authenticated using (
  exists (
    select 1 from public.helpdesk_tickets h
    where h.id=helpdesk_attachments.helpdesk_ticket_id
      and h.workspace_id=helpdesk_attachments.workspace_id
      and private.is_workspace_member(h.workspace_id)
      and (
        private.has_workspace_permission(h.workspace_id,'manage_helpdesk')
        or h.requester_user_id=(select auth.uid())
      )
  )
);

drop policy if exists helpdesk_attachments_insert on public.helpdesk_attachments;
create policy helpdesk_attachments_insert on public.helpdesk_attachments
for insert to authenticated with check (
  uploaded_by=(select auth.uid())
  and exists (
    select 1 from public.helpdesk_tickets h
    where h.id=helpdesk_ticket_id
      and h.workspace_id=helpdesk_attachments.workspace_id
      and private.is_workspace_member(h.workspace_id)
      and (
        private.has_workspace_permission(h.workspace_id,'manage_helpdesk')
        or h.requester_user_id=(select auth.uid())
      )
  )
  and (
    comment_id is null
    or exists (
      select 1 from public.helpdesk_comments c
      where c.id=helpdesk_attachments.comment_id
        and c.helpdesk_ticket_id=helpdesk_attachments.helpdesk_ticket_id
    )
  )
);

drop policy if exists helpdesk_attachments_delete on public.helpdesk_attachments;
create policy helpdesk_attachments_delete on public.helpdesk_attachments
for delete to authenticated using (
  uploaded_by=(select auth.uid())
  or private.has_workspace_permission(workspace_id,'manage_helpdesk')
);

create or replace function private.can_view_evidence_object(p_name text)
returns boolean
language plpgsql stable security definer
set search_path=public,storage,pg_temp
as $$
declare
  v_workspace uuid;
  v_parent uuid;
  v_scope text;
begin
  v_workspace:=split_part(p_name,'/',1)::uuid;
  v_scope:=split_part(p_name,'/',2);
  v_parent:=split_part(p_name,'/',3)::uuid;

  if v_scope='tickets' then
    return exists(
      select 1 from public.tickets t
      where t.id=v_parent
        and t.workspace_id=v_workspace
        and private.has_workspace_permission(v_workspace,'view_tickets')
        and private.has_product_access(v_workspace,t.product_id)
    );
  elsif v_scope='sprints' then
    return exists(
      select 1 from public.sprints s
      where s.id=v_parent
        and s.workspace_id=v_workspace
        and private.has_workspace_permission(v_workspace,'view_dashboard')
    );
  elsif v_scope='helpdesk' then
    return exists(
      select 1 from public.helpdesk_tickets h
      where h.id=v_parent
        and h.workspace_id=v_workspace
        and private.is_workspace_member(v_workspace)
        and (
          private.has_workspace_permission(v_workspace,'manage_helpdesk')
          or h.requester_user_id=(select auth.uid())
        )
    );
  end if;
  return false;
exception when invalid_text_representation then return false;
end
$$;

create or replace function private.can_upload_evidence_object(p_name text)
returns boolean
language plpgsql stable security definer
set search_path=public,storage,pg_temp
as $$
declare
  v_workspace uuid;
  v_parent uuid;
  v_scope text;
begin
  v_workspace:=split_part(p_name,'/',1)::uuid;
  v_scope:=split_part(p_name,'/',2);
  v_parent:=split_part(p_name,'/',3)::uuid;

  if v_scope='tickets' then
    return exists(
      select 1 from public.tickets t
      where t.id=v_parent
        and t.workspace_id=v_workspace
        and private.has_workspace_permission(v_workspace,'edit_tickets')
        and private.has_product_access(v_workspace,t.product_id)
    );
  elsif v_scope='sprints' then
    return exists(
      select 1 from public.sprints s
      where s.id=v_parent
        and s.workspace_id=v_workspace
        and private.has_workspace_permission(v_workspace,'edit_tickets')
    );
  elsif v_scope='helpdesk' then
    return exists(
      select 1 from public.helpdesk_tickets h
      where h.id=v_parent
        and h.workspace_id=v_workspace
        and private.is_workspace_member(v_workspace)
        and (
          private.has_workspace_permission(v_workspace,'manage_helpdesk')
          or h.requester_user_id=(select auth.uid())
        )
    );
  end if;
  return false;
exception when invalid_text_representation then return false;
end
$$;

create or replace function private.can_manage_evidence_object(p_name text)
returns boolean
language plpgsql stable security definer
set search_path=public,storage,pg_temp
as $$
declare
  v_workspace uuid;
  v_scope text;
begin
  v_workspace:=split_part(p_name,'/',1)::uuid;
  v_scope:=split_part(p_name,'/',2);
  if v_scope='helpdesk' then
    return private.has_workspace_permission(v_workspace,'manage_helpdesk');
  elsif v_scope='sprints' then
    return private.has_workspace_permission(v_workspace,'manage_sprints');
  end if;
  return private.has_workspace_permission(v_workspace,'delete_tickets');
exception when invalid_text_representation then return false;
end
$$;

revoke all on function private.can_view_evidence_object(text) from public,anon;
revoke all on function private.can_upload_evidence_object(text) from public,anon;
revoke all on function private.can_manage_evidence_object(text) from public,anon;
grant execute on function private.can_view_evidence_object(text) to authenticated;
grant execute on function private.can_upload_evidence_object(text) to authenticated;
grant execute on function private.can_manage_evidence_object(text) to authenticated;

-- Atomic quick assignment. Existing helpdesk trigger records the assignment and notifies the assignee.
create or replace function public.assign_helpdesk_ticket(
  p_ticket_id uuid,
  p_assignee uuid,
  p_comment text default null
)
returns jsonb
language plpgsql
security invoker
set search_path=public,private,pg_temp
as $$
declare
  v_workspace uuid;
  v_key text;
  v_category text;
  v_comment text:=nullif(btrim(coalesce(p_comment,'')),'');
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;

  select workspace_id,ticket_key,category
    into v_workspace,v_key,v_category
  from public.helpdesk_tickets
  where id=p_ticket_id;

  if v_workspace is null then raise exception 'Helpdesk ticket not found'; end if;
  if not private.has_workspace_permission(v_workspace,'manage_helpdesk') then
    raise exception 'Insufficient Helpdesk permissions';
  end if;
  if v_category in ('module','feature','new_requirement') then
    raise exception 'Requirement proposals are handled through the decision flow';
  end if;
  if p_assignee is null or not private.member_has_permission(v_workspace,p_assignee,'manage_helpdesk') then
    raise exception 'The selected assignee is not an active Helpdesk agent';
  end if;
  if v_comment is not null and char_length(v_comment)>4000 then
    raise exception 'Assignment comment is too long';
  end if;

  update public.helpdesk_tickets
  set assigned_to=p_assignee
  where id=p_ticket_id;

  if v_comment is not null then
    insert into public.helpdesk_comments(helpdesk_ticket_id,author_id,body)
    values(p_ticket_id,(select auth.uid()),v_comment);
  end if;

  return jsonb_build_object('ticket_id',p_ticket_id,'ticket_key',v_key,'assigned_to',p_assignee,'comment_added',v_comment is not null);
end
$$;

revoke all on function public.assign_helpdesk_ticket(uuid,uuid,text) from public,anon;
grant execute on function public.assign_helpdesk_ticket(uuid,uuid,text) to authenticated;
