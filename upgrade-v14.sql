-- Jira Interno TROBBU v14.0
-- Luxury Auth, flexible Timeline/Gantt and Helpdesk-only administrative portal.

alter table public.helpdesk_tickets
  add column if not exists proposal_status text,
  add column if not exists decision_by uuid references auth.users(id) on delete set null,
  add column if not exists decision_at timestamptz,
  add column if not exists decision_note text,
  add column if not exists converted_ticket_id uuid references public.tickets(id) on delete set null,
  add column if not exists converted_ticket_key text;

alter table public.helpdesk_tickets drop constraint if exists helpdesk_tickets_proposal_status_check;
alter table public.helpdesk_tickets add constraint helpdesk_tickets_proposal_status_check
  check (proposal_status is null or proposal_status in ('pending','accepted_backlog','rejected'));

create index if not exists idx_helpdesk_requirement_decisions
  on public.helpdesk_tickets(workspace_id,category,proposal_status,created_at desc);
create index if not exists idx_helpdesk_requester_category
  on public.helpdesk_tickets(requester_user_id,category,created_at desc);

-- Dedicated portal role: no products, boards, backlog or timeline.
insert into public.workspace_roles(
  workspace_id,code,name,description,base_role,permissions,is_system,protected,active
)
select
  w.id,
  'helpdesk_requester',
  'Solicitante Helpdesk',
  'Portal administrativo: crea y consulta únicamente sus solicitudes de Helpdesk. No accede a productos, tableros, Backlog ni Gantt.',
  'consulta'::public.app_role,
  '{"view_dashboard":false,"view_tickets":false,"create_tickets":false,"edit_tickets":false,"delete_tickets":false,"manage_sprints":false,"qa_review":false,"manage_helpdesk":false,"manage_staff":false,"manage_products":false,"manage_settings":false}'::jsonb,
  true,false,true
from public.workspaces w
on conflict (workspace_id,code) do update set
  name=excluded.name,
  description=excluded.description,
  base_role=excluded.base_role,
  permissions=excluded.permissions,
  is_system=true,
  protected=false,
  active=true;

create or replace function private.seed_workspace_roles(p_workspace uuid)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  insert into public.workspace_roles(workspace_id,code,name,description,base_role,permissions,is_system,protected,active)
  values
    (p_workspace,'superadmin','Superadmin','Control total del workspace. Acceso forzado a todas las funciones y productos.','superadmin','{}',true,true,true),
    (p_workspace,'admin','Admin','Administración integral del workspace, Staff, productos y operación.','admin','{}',true,false,true),
    (p_workspace,'pm','PM','Planeación, Backlog, Sprints, Timeline/Gantt y seguimiento.','pm','{}',true,false,true),
    (p_workspace,'dev','Dev','Desarrollo y actualización de tickets dentro de productos autorizados.','dev','{}',true,false,true),
    (p_workspace,'qa','QA','Revisión QA, rechazo/aprobación y evidencias dentro de productos autorizados.','qa','{}',true,false,true),
    (p_workspace,'consulta','Consulta','Lectura de dashboards, tickets, Backlog y Timeline/Gantt.','consulta','{}',true,false,true),
    (
      p_workspace,'helpdesk_requester','Solicitante Helpdesk',
      'Portal administrativo: crea y consulta únicamente sus solicitudes de Helpdesk. No accede a productos, tableros, Backlog ni Gantt.',
      'consulta',
      '{"view_dashboard":false,"view_tickets":false,"create_tickets":false,"edit_tickets":false,"delete_tickets":false,"manage_sprints":false,"qa_review":false,"manage_helpdesk":false,"manage_staff":false,"manage_products":false,"manage_settings":false}'::jsonb,
      true,false,true
    )
  on conflict (workspace_id,code) do update set
    name=excluded.name,
    description=excluded.description,
    base_role=excluded.base_role,
    permissions=excluded.permissions,
    is_system=true,
    protected=(excluded.code='superadmin'),
    active=true;
end
$$;
revoke all on function private.seed_workspace_roles(uuid) from public,anon,authenticated;

-- Portal users should only receive their own membership. Staff/product teams keep the access they need.
drop policy if exists members_select on public.workspace_members;
create policy members_select on public.workspace_members
for select to authenticated
using (
  user_id=(select auth.uid())
  or private.has_workspace_permission(workspace_id,'view_dashboard')
  or private.has_workspace_permission(workspace_id,'manage_helpdesk')
  or private.has_workspace_permission(workspace_id,'manage_staff')
);

-- Normalize portal requests. Product proposals are decision items, not operational SLA cases.
create or replace function private.normalize_helpdesk_insert()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if not private.has_workspace_permission(new.workspace_id,'manage_helpdesk') then
    new.requester_user_id:=auth.uid();
    new.status:='created';
    new.assigned_to:=null;
    new.due_at:=null;
    new.source:='portal';
  end if;

  if new.category in ('module','feature','new_requirement') then
    new.status:='created';
    new.assigned_to:=null;
    new.due_at:=null;
    new.proposal_status:='pending';
    new.decision_by:=null;
    new.decision_at:=null;
    new.decision_note:=null;
    new.converted_ticket_id:=null;
    new.converted_ticket_key:=null;
  else
    new.proposal_status:=null;
    new.decision_by:=null;
    new.decision_at:=null;
    new.decision_note:=null;
    new.converted_ticket_id:=null;
    new.converted_ticket_key:=null;
  end if;
  return new;
end
$$;
revoke all on function private.normalize_helpdesk_insert() from public,anon,authenticated;

create or replace function private.assign_helpdesk_key()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_seq bigint;
  v_sla integer;
begin
  insert into public.workspace_settings(workspace_id)
  values(new.workspace_id)
  on conflict (workspace_id) do nothing;

  update public.workspace_settings
  set helpdesk_seq=helpdesk_seq+1
  where workspace_id=new.workspace_id
  returning helpdesk_seq,sla_resolution_hours into v_seq,v_sla;

  new.ticket_number:=v_seq;
  new.ticket_key:='HD-'||v_seq::text;

  if new.category not in ('module','feature','new_requirement') and new.due_at is null then
    new.due_at:=now()+make_interval(hours=>coalesce(v_sla,24));
  end if;
  return new;
end
$$;
revoke all on function private.assign_helpdesk_key() from public,anon,authenticated;

create or replace function private.guard_helpdesk_requirement()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_decision_context text:=coalesce(current_setting('app.helpdesk_requirement_decision',true),'');
  v_old_proposal boolean:=old.category in ('module','feature','new_requirement');
  v_new_proposal boolean:=new.category in ('module','feature','new_requirement');
begin
  if v_old_proposal then
    if new.category is distinct from old.category then
      raise exception 'A product proposal cannot change category after creation';
    end if;
    if row(new.status,new.assigned_to,new.due_at)
       is distinct from row(old.status,old.assigned_to,old.due_at) then
      raise exception 'Product proposals do not use the operational Helpdesk status/SLA workflow';
    end if;
    if row(new.proposal_status,new.decision_by,new.decision_at,new.decision_note,new.converted_ticket_id,new.converted_ticket_key)
       is distinct from
       row(old.proposal_status,old.decision_by,old.decision_at,old.decision_note,old.converted_ticket_id,old.converted_ticket_key)
       and v_decision_context<>'1' then
      raise exception 'Use the requirement decision action to accept or reject this proposal';
    end if;
  elsif v_new_proposal then
    raise exception 'Create a product proposal as a new request instead of changing an existing Helpdesk ticket';
  end if;
  return new;
end
$$;
revoke all on function private.guard_helpdesk_requirement() from public,anon,authenticated;

drop trigger if exists trg_01_guard_helpdesk_requirement on public.helpdesk_tickets;
create trigger trg_01_guard_helpdesk_requirement
before update on public.helpdesk_tickets
for each row execute function private.guard_helpdesk_requirement();

create or replace function private.record_helpdesk_requirement_decision(
  p_helpdesk_id uuid,
  p_decision text,
  p_ticket_id uuid,
  p_ticket_key text,
  p_note text
)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_req public.helpdesk_tickets%rowtype;
  v_actor uuid:=auth.uid();
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  select * into v_req from public.helpdesk_tickets where id=p_helpdesk_id;
  if not found then raise exception 'Solicitud no encontrada'; end if;
  if not private.member_has_permission(v_req.workspace_id,v_actor,'manage_sprints') then
    raise exception 'No tienes permiso para registrar esta decisión';
  end if;

  insert into public.helpdesk_activity(helpdesk_ticket_id,actor_id,action,from_value,to_value)
  values(
    p_helpdesk_id,v_actor,'requirement_decision','pending',
    case when p_decision='accepted_backlog'
      then 'accepted_backlog:'||coalesce(p_ticket_key,'')
      else 'rejected'
    end
  );

  if v_req.requester_user_id is not null then
    insert into public.notifications(workspace_id,user_id,helpdesk_ticket_id,ticket_id,type,title,body)
    values(
      v_req.workspace_id,v_req.requester_user_id,p_helpdesk_id,p_ticket_id,
      'helpdesk_requirement_decision',
      case when p_decision='accepted_backlog'
        then coalesce(v_req.ticket_key,'Solicitud')||' aceptado a Backlog'
        else coalesce(v_req.ticket_key,'Solicitud')||' · sugerencia rechazada'
      end,
      case when p_decision='accepted_backlog'
        then 'El requerimiento fue aceptado para evaluación/desarrollo futuro como '||coalesce(p_ticket_key,'ticket de Backlog')||'.'
        else 'El requerimiento fue descartado. '||trim(coalesce(p_note,''))
      end
    );
  end if;
end
$$;
revoke all on function private.record_helpdesk_requirement_decision(uuid,text,uuid,text,text) from public,anon;
grant execute on function private.record_helpdesk_requirement_decision(uuid,text,uuid,text,text) to authenticated;

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
    if p_product_id is null then raise exception 'Selecciona el producto al que se enviará el requerimiento'; end if;
    if not exists(select 1 from public.products p where p.id=p_product_id and p.workspace_id=v_req.workspace_id) then
      raise exception 'El producto no pertenece a este workspace';
    end if;
    if not private.has_product_access(v_req.workspace_id,p_product_id) then
      raise exception 'No tienes acceso al producto seleccionado';
    end if;

    v_title:=left(coalesce(nullif(trim(v_req.subject),''),'Nuevo requerimiento'),220);
    insert into public.tickets(
      workspace_id,product_id,title,description,type,priority,status,reporter_id,
      sprint_id,dev_owner_id,qa_owner_id,story_points,start_date,due_date
    ) values (
      v_req.workspace_id,p_product_id,v_title,
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
      converted_ticket_key=v_ticket_key
  where id=p_helpdesk_id;

  perform private.record_helpdesk_requirement_decision(p_helpdesk_id,p_decision,v_ticket_id,v_ticket_key,p_note);

  return jsonb_build_object('ok',true,'decision',p_decision,'ticket_id',v_ticket_id,'ticket_key',v_ticket_key);
end
$$;
revoke all on function public.decide_helpdesk_requirement(uuid,text,uuid,text) from public,anon;
grant execute on function public.decide_helpdesk_requirement(uuid,text,uuid,text) to authenticated;

-- A requester can see the decision notification linked to their own Helpdesk request,
-- while the internal converted ticket remains protected by tickets RLS.
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
for select to authenticated
using (
  user_id=(select auth.uid())
  and private.is_workspace_member(workspace_id)
  and (
    (
      helpdesk_ticket_id is not null
      and exists(
        select 1 from public.helpdesk_tickets h
        where h.id=notifications.helpdesk_ticket_id
          and (
            private.has_workspace_permission(h.workspace_id,'manage_helpdesk')
            or h.requester_user_id=(select auth.uid())
          )
      )
    )
    or
    (
      helpdesk_ticket_id is null
      and (
        ticket_id is null
        or exists(
          select 1 from public.tickets t
          where t.id=notifications.ticket_id
            and private.has_workspace_permission(t.workspace_id,'view_tickets')
            and private.has_product_access(t.workspace_id,t.product_id)
        )
      )
    )
  )
);
