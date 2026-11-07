-- Jira Interno TROBBU · Upgrade v10
-- Privacidad Helpdesk tras baja de usuario y visibilidad de perfiles de colaboradores inactivos del mismo workspace.

-- Los miembros activos pueden seguir viendo el perfil de colaboradores desactivados
-- que conservan una membresía en el mismo workspace, para poder administrarlos/reactivarlos.
create or replace function private.shares_workspace_with(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select exists (
    select 1
    from public.workspace_members me
    join public.workspace_members other
      on other.workspace_id=me.workspace_id
    where me.user_id=(select auth.uid())
      and me.active=true
      and other.user_id=p_user
  );
$$;

-- Requesters solo conservan acceso al Helpdesk mientras su membresía siga activa.
drop policy if exists helpdesk_tickets_update on public.helpdesk_tickets;
create policy helpdesk_tickets_update on public.helpdesk_tickets
for update to authenticated
using (
  private.has_workspace_role(workspace_id,array['admin','pm','dev','qa']::public.app_role[])
  or (
    requester_user_id=(select auth.uid())
    and private.is_workspace_member(workspace_id)
  )
)
with check (
  private.has_workspace_role(workspace_id,array['admin','pm','dev','qa']::public.app_role[])
  or (
    requester_user_id=(select auth.uid())
    and private.is_workspace_member(workspace_id)
  )
);

drop policy if exists helpdesk_comments_select on public.helpdesk_comments;
create policy helpdesk_comments_select on public.helpdesk_comments
for select to authenticated
using (
  exists (
    select 1 from public.helpdesk_tickets h
    where h.id=helpdesk_ticket_id
      and private.is_workspace_member(h.workspace_id)
      and (
        private.has_workspace_role(h.workspace_id,array['admin','pm','dev','qa']::public.app_role[])
        or h.requester_user_id=(select auth.uid())
      )
  )
);

drop policy if exists helpdesk_comments_insert on public.helpdesk_comments;
create policy helpdesk_comments_insert on public.helpdesk_comments
for insert to authenticated
with check (
  author_id=(select auth.uid())
  and exists (
    select 1 from public.helpdesk_tickets h
    where h.id=helpdesk_ticket_id
      and private.is_workspace_member(h.workspace_id)
      and (
        private.has_workspace_role(h.workspace_id,array['admin','pm','dev','qa']::public.app_role[])
        or h.requester_user_id=(select auth.uid())
      )
  )
);

drop policy if exists helpdesk_comments_update on public.helpdesk_comments;
create policy helpdesk_comments_update on public.helpdesk_comments
for update to authenticated
using (
  author_id=(select auth.uid())
  and exists (
    select 1 from public.helpdesk_tickets h
    where h.id=helpdesk_ticket_id
      and private.is_workspace_member(h.workspace_id)
      and (
        private.has_workspace_role(h.workspace_id,array['admin','pm','dev','qa']::public.app_role[])
        or h.requester_user_id=(select auth.uid())
      )
  )
)
with check (
  author_id=(select auth.uid())
  and exists (
    select 1 from public.helpdesk_tickets h
    where h.id=helpdesk_ticket_id
      and private.is_workspace_member(h.workspace_id)
      and (
        private.has_workspace_role(h.workspace_id,array['admin','pm','dev','qa']::public.app_role[])
        or h.requester_user_id=(select auth.uid())
      )
  )
);

drop policy if exists helpdesk_comments_delete on public.helpdesk_comments;
create policy helpdesk_comments_delete on public.helpdesk_comments
for delete to authenticated
using (
  author_id=(select auth.uid())
  and exists (
    select 1 from public.helpdesk_tickets h
    where h.id=helpdesk_ticket_id
      and private.is_workspace_member(h.workspace_id)
      and (
        private.has_workspace_role(h.workspace_id,array['admin','pm','dev','qa']::public.app_role[])
        or h.requester_user_id=(select auth.uid())
      )
  )
);

drop policy if exists helpdesk_activity_select on public.helpdesk_activity;
create policy helpdesk_activity_select on public.helpdesk_activity
for select to authenticated
using (
  exists (
    select 1 from public.helpdesk_tickets h
    where h.id=helpdesk_ticket_id
      and private.is_workspace_member(h.workspace_id)
      and (
        private.has_workspace_role(h.workspace_id,array['admin','pm','dev','qa']::public.app_role[])
        or h.requester_user_id=(select auth.uid())
      )
  )
);
