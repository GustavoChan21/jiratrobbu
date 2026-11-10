-- Jira Interno TROBBU v16.6
-- Deep links por entorno + Helpdesk product profiling + Knowledge preview/i18n frontend support

alter table public.helpdesk_tickets
  add column if not exists product_id uuid references public.products(id) on delete set null;

create index if not exists idx_helpdesk_tickets_product_id
  on public.helpdesk_tickets(product_id) where product_id is not null;

create or replace function private.validate_helpdesk_product()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if new.product_id is not null and not exists(
    select 1 from public.products p
    where p.id=new.product_id and p.workspace_id=new.workspace_id
  ) then
    raise exception 'El producto seleccionado no pertenece a este workspace';
  end if;
  if tg_op='UPDATE'
     and coalesce(old.proposal_status,'pending')<>'pending'
     and new.product_id is distinct from old.product_id then
    raise exception 'El producto de un requerimiento ya evaluado no puede modificarse';
  end if;
  return new;
end $$;
revoke all on function private.validate_helpdesk_product() from public,anon,authenticated;

drop trigger if exists trg_00_validate_helpdesk_product on public.helpdesk_tickets;
create trigger trg_00_validate_helpdesk_product
before insert or update of workspace_id,product_id on public.helpdesk_tickets
for each row execute function private.validate_helpdesk_product();


-- Catálogo Helpdesk integrado a la política SELECT existente de productos.
-- Ver el nombre/clave del producto no concede acceso a tickets/tableros; esas tablas conservan RLS independiente.
drop policy if exists products_helpdesk_catalog_select on public.products;
drop policy if exists products_select on public.products;
create policy products_select
on public.products for select to authenticated
using (
  private.is_workspace_member(workspace_id)
  and (
    private.has_product_access(workspace_id,id)
    or coalesce(
      (select ws.helpdesk_enabled from public.workspace_settings ws where ws.workspace_id=products.workspace_id),
      true
    )
  )
);

-- Catálogo de productos visible exclusivamente para clasificar solicitudes de Helpdesk.
-- No concede acceso operativo a tickets/tableros del producto.
create or replace function public.list_helpdesk_products(p_workspace uuid)
returns table(id uuid,name text,key text,description text,board_order integer)
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not private.is_workspace_member(p_workspace) then raise exception 'Workspace access required'; end if;
  if not coalesce((select ws.helpdesk_enabled from public.workspace_settings ws where ws.workspace_id=p_workspace),true) then
    return;
  end if;
  return query
  select p.id,p.name,p.key,p.description,p.board_order
  from public.products p
  where p.workspace_id=p_workspace
  order by p.board_order,p.name;
end $$;
revoke all on function public.list_helpdesk_products(uuid) from public,anon;
grant execute on function public.list_helpdesk_products(uuid) to authenticated;

create or replace function public.decide_helpdesk_requirement(
  p_helpdesk_id uuid,
  p_decision text,
  p_product_id uuid default null,
  p_note text default null
)
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  v_req public.helpdesk_tickets%rowtype;
  v_ticket_id uuid;
  v_ticket_key text;
  v_title text;
  v_product_id uuid;
begin
  select * into v_req from public.helpdesk_tickets where id=p_helpdesk_id for update;
  if not found then raise exception 'Solicitud no encontrada'; end if;
  if v_req.category not in ('module','feature','new_requirement') then raise exception 'La solicitud no es una propuesta de producto'; end if;
  if coalesce(v_req.proposal_status,'pending')<>'pending' then raise exception 'Este requerimiento ya fue evaluado'; end if;
  if not private.has_workspace_permission(v_req.workspace_id,'manage_sprints') then
    raise exception 'Solo PM, Admin, Superadmin o un rol con permiso de planeación puede evaluar nuevos requerimientos';
  end if;
  if p_decision not in ('accepted_backlog','rejected') then raise exception 'Decisión inválida'; end if;

  if p_decision='accepted_backlog' then
    v_product_id:=coalesce(p_product_id,v_req.product_id);
    if v_product_id is null then raise exception 'Selecciona el producto al que se enviará el requerimiento'; end if;
    if not exists(select 1 from public.products p where p.id=v_product_id and p.workspace_id=v_req.workspace_id) then
      raise exception 'El producto no pertenece a este workspace';
    end if;
    if not private.has_product_access(v_req.workspace_id,v_product_id) then
      raise exception 'No tienes acceso al producto seleccionado';
    end if;

    v_title:=left(coalesce(nullif(trim(v_req.subject),''),'Nuevo requerimiento'),220);
    insert into public.tickets(
      workspace_id,product_id,title,description,type,priority,status,reporter_id,
      sprint_id,dev_owner_id,qa_owner_id,story_points,start_date,due_date
    ) values (
      v_req.workspace_id,v_product_id,v_title,
      concat(
        'Origen: ',coalesce(v_req.ticket_key,'Helpdesk'),E'\n',
        'Tipo: ',coalesce(v_req.category,'new_requirement'),E'\n',
        'Solicitante: ',coalesce(v_req.requester_name,v_req.requester_email,'—'),E'\n\n',
        coalesce(v_req.description,'Sin descripción.'),
        case when nullif(trim(coalesce(p_note,'')),'') is not null
          then E'\n\nDecisión PM/Admin:\n'||trim(p_note) else '' end
      ),
      'improvement',v_req.priority,'backlog',auth.uid(),
      null,null,null,null,null,null
    ) returning id,ticket_key into v_ticket_id,v_ticket_key;
  else
    if nullif(trim(coalesce(p_note,'')),'') is null then
      raise exception 'Indica el motivo para rechazar la sugerencia';
    end if;
  end if;

  perform set_config('app.helpdesk_requirement_decision','1',true);
  update public.helpdesk_tickets
  set proposal_status=p_decision,
      decision_by=auth.uid(),
      decision_at=now(),
      decision_note=nullif(trim(coalesce(p_note,'')),''),
      converted_ticket_id=v_ticket_id,
      converted_ticket_key=v_ticket_key,
      product_id=case when p_decision='accepted_backlog' then v_product_id else product_id end
  where id=p_helpdesk_id;

  perform private.record_helpdesk_requirement_decision(p_helpdesk_id,p_decision,v_ticket_id,v_ticket_key,p_note);

  return jsonb_build_object(
    'ok',true,
    'decision',p_decision,
    'ticket_id',v_ticket_id,
    'ticket_key',v_ticket_key,
    'product_id',case when p_decision='accepted_backlog' then v_product_id else v_req.product_id end
  );
end $$;
revoke all on function public.decide_helpdesk_requirement(uuid,text,uuid,text) from public,anon;
grant execute on function public.decide_helpdesk_requirement(uuid,text,uuid,text) to authenticated;

-- Realtime already includes helpdesk_tickets; no additional publication required.
