-- Jira Interno TROBBU · Upgrade v6
-- Integridad multi-workspace, privacidad Helpdesk y controles finales de permisos.

-- 1) Integridad: las relaciones operativas deben permanecer dentro del mismo workspace.
alter table public.products drop constraint if exists products_id_workspace_id_key;
alter table public.products add constraint products_id_workspace_id_key unique(id,workspace_id);

alter table public.sprints drop constraint if exists sprints_id_workspace_id_key;
alter table public.sprints add constraint sprints_id_workspace_id_key unique(id,workspace_id);

alter table public.helpdesk_departments drop constraint if exists helpdesk_departments_id_workspace_id_key;
alter table public.helpdesk_departments add constraint helpdesk_departments_id_workspace_id_key unique(id,workspace_id);

alter table public.tickets drop constraint if exists tickets_product_workspace_fkey;
alter table public.tickets add constraint tickets_product_workspace_fkey
  foreign key(product_id,workspace_id)
  references public.products(id,workspace_id)
  on update cascade on delete restrict;

alter table public.tickets drop constraint if exists tickets_sprint_workspace_fkey;
alter table public.tickets add constraint tickets_sprint_workspace_fkey
  foreign key(sprint_id,workspace_id)
  references public.sprints(id,workspace_id)
  on update cascade on delete set null (sprint_id);

alter table public.helpdesk_tickets drop constraint if exists helpdesk_department_workspace_fkey;
alter table public.helpdesk_tickets add constraint helpdesk_department_workspace_fkey
  foreign key(department_id,workspace_id)
  references public.helpdesk_departments(id,workspace_id)
  on update cascade on delete set null (department_id);

-- 2) Solo Admin puede eliminar por completo un workspace.
drop policy if exists workspaces_delete on public.workspaces;
create policy workspaces_delete on public.workspaces
for delete to authenticated
using (private.has_workspace_role(id,array['admin']::public.app_role[]));

-- 3) Privacidad de Helpdesk:
-- Staff ve todas las solicitudes; usuarios Viewer/requesters solo ven las propias.
drop policy if exists helpdesk_tickets_select on public.helpdesk_tickets;
create policy helpdesk_tickets_select on public.helpdesk_tickets
for select to authenticated
using (
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
      and (
        private.has_workspace_role(h.workspace_id,array['admin','pm','dev','qa']::public.app_role[])
        or h.requester_user_id=(select auth.uid())
      )
  )
);

-- 4) El toggle Helpdesk debe ser efectivo también a nivel de API/RLS.
drop policy if exists helpdesk_tickets_insert on public.helpdesk_tickets;
create policy helpdesk_tickets_insert on public.helpdesk_tickets
for insert to authenticated
with check (
  private.is_workspace_member(workspace_id)
  and (requester_user_id is null or requester_user_id=(select auth.uid()))
  and coalesce(
    (select ws.helpdesk_enabled
       from public.workspace_settings ws
      where ws.workspace_id=helpdesk_tickets.workspace_id),
    true
  )
);
