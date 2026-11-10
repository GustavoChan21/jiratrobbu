-- Jira Interno TROBBU v16.9
-- Stable RLS-aware navigation counters + privacy-preserving product visibility.

-- Operational product lists must expose only assigned/authorized products.
-- Helpdesk managers and product managers may still read the catalog to route requests.
drop policy if exists products_select on public.products;
create policy products_select
on public.products for select to authenticated
using (
  private.is_workspace_member(workspace_id)
  and (
    private.has_product_access(workspace_id,id)
    or private.has_workspace_permission(workspace_id,'manage_helpdesk')
    or private.has_workspace_permission(workspace_id,'manage_products')
  )
);

-- Explicit operational product source for Board/Backlog/Timeline/sidebar.
create or replace function public.list_authorized_products(p_workspace uuid)
returns setof public.products
language sql
stable
security invoker
set search_path=public,pg_temp
as $$
  select p.*
  from public.products p
  where p.workspace_id=p_workspace
    and (private.has_product_access(p_workspace,p.id) or private.has_workspace_permission(p_workspace,'manage_products'))
  order by p.board_order,p.name
$$;
revoke all on function public.list_authorized_products(uuid) from public,anon;
grant execute on function public.list_authorized_products(uuid) to authenticated;

-- Sidebar badges are independent of frontend arrays and always respect RLS.
create or replace function public.get_navigation_counts(p_workspace uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path=public,pg_temp
as $$
declare
  v_uid uuid:=(select auth.uid());
  v_ticket_total bigint:=0;
  v_backlog_total bigint:=0;
  v_knowledge_total bigint:=0;
  v_helpdesk_total bigint:=0;
  v_my_tasks_total bigint:=0;
  v_product_counts jsonb:='{}'::jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not private.is_workspace_member(p_workspace) then raise exception 'Workspace access required'; end if;

  select count(*) into v_ticket_total
  from public.tickets t
  where t.workspace_id=p_workspace;

  select count(*) into v_backlog_total
  from public.tickets t
  where t.workspace_id=p_workspace
    and t.sprint_id is null
    and t.status<>'closed';

  select count(*) into v_knowledge_total
  from public.knowledge_articles k
  where k.workspace_id=p_workspace;

  select count(*) into v_helpdesk_total
  from public.helpdesk_tickets h
  where h.workspace_id=p_workspace;

  select count(*) into v_my_tasks_total
  from public.tickets t
  where t.workspace_id=p_workspace
    and (t.reporter_id=v_uid or t.dev_owner_id=v_uid or t.qa_owner_id=v_uid);

  select coalesce(jsonb_object_agg(x.product_id::text,x.cnt),'{}'::jsonb)
  into v_product_counts
  from (
    select t.product_id,count(*)::bigint cnt
    from public.tickets t
    where t.workspace_id=p_workspace
    group by t.product_id
  ) x;

  return jsonb_build_object(
    'tickets',v_ticket_total,
    'backlog',v_backlog_total,
    'knowledge',v_knowledge_total,
    'helpdesk',v_helpdesk_total,
    'mytasks',v_my_tasks_total,
    'products',v_product_counts
  );
end $$;
revoke all on function public.get_navigation_counts(uuid) from public,anon;
grant execute on function public.get_navigation_counts(uuid) to authenticated;
