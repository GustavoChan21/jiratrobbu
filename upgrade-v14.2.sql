-- Jira Interno TROBBU v14.2
-- Importación atómica de Backlog + notificaciones de seguimiento.

create or replace function public.import_backlog_tickets(p_workspace uuid,p_rows jsonb)
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  v_row jsonb;
  v_count integer:=0;
  v_keys text[]:=array[]::text[];
  v_id uuid;
  v_key text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not private.has_workspace_permission(p_workspace,'manage_sprints') then
    raise exception 'Solo PM, Admin, Superadmin o un rol con permiso de Backlog/Sprints puede importar tickets';
  end if;
  if jsonb_typeof(p_rows)<>'array' then raise exception 'Formato de importación inválido'; end if;
  if jsonb_array_length(p_rows)=0 then raise exception 'No hay filas para importar'; end if;
  if jsonb_array_length(p_rows)>250 then raise exception 'Máximo 250 tickets por importación'; end if;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    if coalesce(nullif(trim(v_row->>'title'),''),'')='' then raise exception 'Todos los tickets requieren título'; end if;
    if coalesce(nullif(v_row->>'product_id',''),'')='' then raise exception 'Todos los tickets requieren producto'; end if;

    insert into public.tickets(
      workspace_id,product_id,title,description,type,priority,status,reporter_id,
      sprint_id,dev_owner_id,qa_owner_id,story_points,start_date,due_date
    ) values (
      p_workspace,
      (v_row->>'product_id')::uuid,
      left(trim(v_row->>'title'),220),
      nullif(trim(coalesce(v_row->>'description','')),''),
      coalesce(nullif(v_row->>'type',''),'task')::public.ticket_type,
      coalesce(nullif(v_row->>'priority',''),'medium')::public.ticket_priority,
      'backlog'::public.ticket_status,
      auth.uid(),
      null,
      nullif(v_row->>'dev_owner_id','')::uuid,
      nullif(v_row->>'qa_owner_id','')::uuid,
      case when nullif(v_row->>'story_points','') is null then null else (v_row->>'story_points')::integer end,
      nullif(v_row->>'start_date','')::date,
      nullif(v_row->>'due_date','')::date
    )
    returning id,ticket_key into v_id,v_key;

    v_count:=v_count+1;
    v_keys:=array_append(v_keys,v_key);
  end loop;

  return jsonb_build_object('ok',true,'imported',v_count,'ticket_keys',to_jsonb(v_keys));
end
$$;
revoke all on function public.import_backlog_tickets(uuid,jsonb) from public,anon;
grant execute on function public.import_backlog_tickets(uuid,jsonb) to authenticated;

create or replace function private.notify_ticket_comment_created()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_ticket public.tickets%rowtype;
  v_in_app boolean:=true;
begin
  select * into v_ticket from public.tickets where id=new.ticket_id;
  if not found then return new; end if;
  select coalesce(in_app_notifications,true) into v_in_app
  from public.workspace_settings where workspace_id=v_ticket.workspace_id;
  if not found then v_in_app:=true; end if;

  if v_in_app then
    insert into public.notifications(workspace_id,user_id,ticket_id,type,title,body)
    select distinct
      v_ticket.workspace_id,u.user_id,v_ticket.id,'ticket_comment',
      v_ticket.ticket_key||' · nuevo seguimiento',
      left(coalesce(new.body,'Nuevo comentario'),180)
    from (values (v_ticket.reporter_id),(v_ticket.dev_owner_id),(v_ticket.qa_owner_id)) as u(user_id)
    where u.user_id is not null and u.user_id is distinct from new.author_id;
  end if;
  return new;
end
$$;
revoke all on function private.notify_ticket_comment_created() from public,anon,authenticated;

drop trigger if exists trg_notify_ticket_comment_created on public.ticket_comments;
create trigger trg_notify_ticket_comment_created
after insert on public.ticket_comments
for each row execute function private.notify_ticket_comment_created();

create or replace function private.notify_helpdesk_comment_created()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_req public.helpdesk_tickets%rowtype;
  v_in_app boolean:=true;
begin
  select * into v_req from public.helpdesk_tickets where id=new.helpdesk_ticket_id;
  if not found then return new; end if;
  select coalesce(in_app_notifications,true) into v_in_app
  from public.workspace_settings where workspace_id=v_req.workspace_id;
  if not found then v_in_app:=true; end if;

  if v_in_app then
    insert into public.notifications(workspace_id,user_id,helpdesk_ticket_id,type,title,body)
    select distinct v_req.workspace_id,x.user_id,v_req.id,'helpdesk_comment',
      v_req.ticket_key||' · nuevo seguimiento',
      left(coalesce(new.body,'Nuevo comentario'),180)
    from (
      select v_req.requester_user_id as user_id
      union
      select v_req.assigned_to
      union
      select wm.user_id
      from public.workspace_members wm
      where v_req.assigned_to is null
        and wm.workspace_id=v_req.workspace_id
        and wm.active=true
        and (
          wm.role in ('pm','admin','superadmin')
          or private.member_has_permission(v_req.workspace_id,wm.user_id,'manage_helpdesk')
        )
    ) x
    where x.user_id is not null and x.user_id is distinct from new.author_id;
  end if;
  return new;
end
$$;
revoke all on function private.notify_helpdesk_comment_created() from public,anon,authenticated;

drop trigger if exists trg_notify_helpdesk_comment_created on public.helpdesk_comments;
create trigger trg_notify_helpdesk_comment_created
after insert on public.helpdesk_comments
for each row execute function private.notify_helpdesk_comment_created();

create or replace function private.track_ticket_change()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_in_app boolean := true;
  v_email boolean := true;
begin
  select coalesce(ws.in_app_notifications,true),coalesce(ws.email_notifications,true)
  into v_in_app,v_email
  from public.workspace_settings ws
  where ws.workspace_id=new.workspace_id;
  if not found then v_in_app:=true; v_email:=true; end if;

  if old.status is distinct from new.status then
    if new.status='in_progress' and new.start_date is null then new.start_date:=current_date; end if;
    if new.status='dev_done' and new.dev_completed_at is null then new.dev_completed_at:=now(); end if;
    if new.status='qa_passed' and new.qa_completed_at is null then new.qa_completed_at:=now(); end if;
    if new.status='closed' and new.closed_at is null then new.closed_at:=now(); end if;

    insert into public.ticket_activity(ticket_id,actor_id,action,from_value,to_value)
    values(new.id,auth.uid(),'status_changed',old.status::text,new.status::text);

    if v_in_app and new.reporter_id is not null and new.reporter_id is distinct from auth.uid() then
      insert into public.notifications(workspace_id,user_id,ticket_id,type,title,body)
      values(new.workspace_id,new.reporter_id,new.id,'ticket_status',new.ticket_key||' actualizado','El estado cambió de '||old.status::text||' a '||new.status::text||'.');
    end if;

    if new.status in ('dev_done','qa_review') and new.qa_owner_id is not null and new.qa_owner_id is distinct from auth.uid() and v_in_app then
      insert into public.notifications(workspace_id,user_id,ticket_id,type,title,body)
      values(new.workspace_id,new.qa_owner_id,new.id,'qa_ready',new.ticket_key||' listo para QA',case when new.status='dev_done' then 'Desarrollo marcó el ticket como terminado y requiere revisión QA.' else 'El ticket está en revisión QA.' end);
    end if;

    if new.status='qa_rejected' and new.dev_owner_id is not null then
      if v_email then
        insert into public.notification_outbox(workspace_id,ticket_id,recipient_user_id,event_type,payload)
        values(new.workspace_id,new.id,new.dev_owner_id,'qa_rejected',jsonb_build_object('ticket_key',new.ticket_key,'title',new.title,'status',new.status));
      end if;
      if v_in_app and new.dev_owner_id is distinct from auth.uid() then
        insert into public.notifications(workspace_id,user_id,ticket_id,type,title,body)
        values(new.workspace_id,new.dev_owner_id,new.id,'qa_rejected',new.ticket_key||' regresado por QA','Requiere correcciones antes de volver a revisión.');
      end if;
    end if;

    if new.status='qa_passed' and new.dev_owner_id is not null and new.dev_owner_id is distinct from auth.uid() and v_in_app then
      insert into public.notifications(workspace_id,user_id,ticket_id,type,title,body)
      values(new.workspace_id,new.dev_owner_id,new.id,'qa_passed',new.ticket_key||' aprobado por QA','La revisión QA fue aprobada.');
    end if;

    if new.status='closed' and v_in_app then
      insert into public.notifications(workspace_id,user_id,ticket_id,type,title,body)
      select distinct new.workspace_id,u.user_id,new.id,'ticket_closed',new.ticket_key||' cerrado','El ticket fue cerrado completamente.'
      from (values (new.dev_owner_id),(new.qa_owner_id)) u(user_id)
      where u.user_id is not null and u.user_id is distinct from auth.uid() and u.user_id is distinct from new.reporter_id;
    end if;
  end if;

  if old.dev_owner_id is distinct from new.dev_owner_id and new.dev_owner_id is not null then
    if v_email then
      insert into public.notification_outbox(workspace_id,ticket_id,recipient_user_id,event_type,payload)
      values(new.workspace_id,new.id,new.dev_owner_id,'assigned_dev',jsonb_build_object('ticket_key',new.ticket_key,'title',new.title));
    end if;
    if v_in_app and new.dev_owner_id is distinct from auth.uid() then
      insert into public.notifications(workspace_id,user_id,ticket_id,type,title,body)
      values(new.workspace_id,new.dev_owner_id,new.id,'assigned_dev','Ticket asignado '||new.ticket_key,new.title);
    end if;
  end if;

  if old.qa_owner_id is distinct from new.qa_owner_id and new.qa_owner_id is not null then
    if v_email then
      insert into public.notification_outbox(workspace_id,ticket_id,recipient_user_id,event_type,payload)
      values(new.workspace_id,new.id,new.qa_owner_id,'assigned_qa',jsonb_build_object('ticket_key',new.ticket_key,'title',new.title));
    end if;
    if v_in_app and new.qa_owner_id is distinct from auth.uid() then
      insert into public.notifications(workspace_id,user_id,ticket_id,type,title,body)
      values(new.workspace_id,new.qa_owner_id,new.id,'assigned_qa','Ticket asignado a QA '||new.ticket_key,new.title);
    end if;
  end if;

  return new;
end
$$;

-- PM/planeación necesita consultar qué productos tiene autorizado cada Dev/QA para asignaciones e importación.
drop policy if exists member_products_select on public.workspace_member_products;
create policy member_products_select on public.workspace_member_products
for select to authenticated
using (
  user_id=(select auth.uid())
  or private.has_workspace_permission(workspace_id,'manage_staff')
  or private.has_workspace_permission(workspace_id,'manage_sprints')
);
