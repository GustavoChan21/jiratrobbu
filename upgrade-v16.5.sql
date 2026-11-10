-- Jira Interno TROBBU v16.5
-- Notification Center 360 · Tickets, Helpdesk, Sprints, Knowledge, Staff · ES/EN metadata-ready.

alter table public.notifications
  add column if not exists category text not null default 'system',
  add column if not exists actor_id uuid references auth.users(id) on delete set null,
  add column if not exists dedupe_key text;

alter table public.notification_outbox
  add column if not exists category text not null default 'system',
  add column if not exists dedupe_key text;

create index if not exists idx_notifications_user_unread_created
  on public.notifications(user_id,read_at,created_at desc);
create index if not exists idx_notifications_workspace_category_created
  on public.notifications(workspace_id,category,created_at desc);
create index if not exists idx_notifications_actor on public.notifications(actor_id) where actor_id is not null;
create unique index if not exists uq_notifications_user_dedupe
  on public.notifications(user_id,dedupe_key) where dedupe_key is not null;
create unique index if not exists uq_notification_outbox_user_dedupe
  on public.notification_outbox(recipient_user_id,dedupe_key)
  where recipient_user_id is not null and dedupe_key is not null;

create or replace function private.emit_notification(
  p_workspace uuid,
  p_user uuid,
  p_type text,
  p_category text,
  p_title text,
  p_body text,
  p_metadata jsonb default '{}'::jsonb,
  p_actor uuid default null,
  p_ticket uuid default null,
  p_helpdesk uuid default null,
  p_dedupe text default null,
  p_email boolean default true
)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_in_app boolean:=true;
  v_email boolean:=true;
  v_meta jsonb:=coalesce(p_metadata,'{}'::jsonb)
    || jsonb_build_object('category',coalesce(nullif(p_category,''),'system'),'event_type',p_type);
begin
  if p_workspace is null or p_user is null then return; end if;
  if not exists(select 1 from public.workspace_members wm where wm.workspace_id=p_workspace and wm.user_id=p_user and wm.active=true) then return; end if;

  select coalesce(ws.in_app_notifications,true),coalesce(ws.email_notifications,true)
  into v_in_app,v_email
  from public.workspace_settings ws where ws.workspace_id=p_workspace;
  if not found then v_in_app:=true;v_email:=true;end if;

  if v_in_app and not exists(
    select 1 from public.notifications n
    where n.user_id=p_user and p_dedupe is not null and n.dedupe_key=p_dedupe
  ) then
    insert into public.notifications(
      workspace_id,user_id,ticket_id,helpdesk_ticket_id,type,category,title,body,metadata,actor_id,dedupe_key
    ) values(
      p_workspace,p_user,p_ticket,p_helpdesk,p_type,coalesce(nullif(p_category,''),'system'),
      coalesce(p_title,p_type),p_body,v_meta,p_actor,p_dedupe
    );
  end if;

  if p_email and v_email and not exists(
    select 1 from public.notification_outbox o
    where o.recipient_user_id=p_user and p_dedupe is not null and o.dedupe_key=p_dedupe
  ) then
    insert into public.notification_outbox(
      workspace_id,ticket_id,recipient_user_id,event_type,payload,category,dedupe_key
    ) values(
      p_workspace,p_ticket,p_user,p_type,
      jsonb_build_object('title',p_title,'body',p_body,'metadata',v_meta,'helpdesk_ticket_id',p_helpdesk),
      coalesce(nullif(p_category,''),'system'),p_dedupe
    );
  end if;
end $$;
revoke all on function private.emit_notification(uuid,uuid,text,text,text,text,jsonb,uuid,uuid,uuid,text,boolean) from public,anon;
grant execute on function private.emit_notification(uuid,uuid,text,text,text,text,jsonb,uuid,uuid,uuid,text,boolean) to authenticated;

-- Tickets --------------------------------------------------------------------
create or replace function private.notify_ticket_created()
returns trigger
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare v_user uuid; v_actor uuid:=coalesce(auth.uid(),new.reporter_id);
begin
  if new.reporter_id is not null then
    perform private.emit_notification(new.workspace_id,new.reporter_id,'ticket_created','tickets',
      'Ticket creado '||new.ticket_key,new.title,
      jsonb_build_object('entity_type','ticket','entity_id',new.id,'ticket_key',new.ticket_key,'ticket_title',new.title,'action','created'),
      v_actor,new.id,null,'ticket:'||new.id||':created:reporter:'||new.reporter_id,true);
  end if;

  for v_user in
    select distinct x.uid from (
      select wm.user_id uid from public.workspace_members wm
      where wm.workspace_id=new.workspace_id and wm.active=true
        and (private.member_has_permission(new.workspace_id,wm.user_id,'manage_sprints') or private.member_has_permission(new.workspace_id,wm.user_id,'manage_staff'))
        and private.member_has_product_access(new.workspace_id,wm.user_id,new.product_id)
      union select new.dev_owner_id
      union select new.qa_owner_id
    ) x
    where x.uid is not null and x.uid is distinct from new.reporter_id
  loop
    perform private.emit_notification(new.workspace_id,v_user,'ticket_created','tickets',
      'Nuevo ticket '||new.ticket_key,new.title,
      jsonb_build_object('entity_type','ticket','entity_id',new.id,'ticket_key',new.ticket_key,'ticket_title',new.title,'action','created'),
      v_actor,new.id,null,'ticket:'||new.id||':created:user:'||v_user,true);
  end loop;
  return new;
end $$;

create or replace function private.track_ticket_change()
returns trigger
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare
  v_actor uuid:=auth.uid(); v_user uuid; v_sprint_name text; v_old_sprint_name text;
begin
  if old.status is distinct from new.status then
    if new.status='in_progress' and new.start_date is null then new.start_date:=current_date; end if;
    if new.status='dev_done' and new.dev_completed_at is null then new.dev_completed_at:=now(); end if;
    if new.status='qa_passed' and new.qa_completed_at is null then new.qa_completed_at:=now(); end if;
    if new.status='closed' and new.closed_at is null then new.closed_at:=now(); end if;
    insert into public.ticket_activity(ticket_id,actor_id,action,from_value,to_value)
    values(new.id,v_actor,'status_changed',old.status::text,new.status::text);

    for v_user in select distinct x.uid from (values(new.reporter_id),(new.dev_owner_id),(new.qa_owner_id)) x(uid)
      where x.uid is not null and x.uid is distinct from v_actor
    loop
      perform private.emit_notification(new.workspace_id,v_user,
        case when new.status='qa_rejected' then 'qa_rejected' when new.status='qa_passed' then 'qa_passed' when new.status='closed' then 'ticket_closed' else 'ticket_status' end,
        'tickets',new.ticket_key||' actualizado',
        'El estado cambió de '||old.status::text||' a '||new.status::text||'.',
        jsonb_build_object('entity_type','ticket','entity_id',new.id,'ticket_key',new.ticket_key,'ticket_title',new.title,'action','status_changed','from_status',old.status::text,'to_status',new.status::text),
        v_actor,new.id,null,'ticket:'||new.id||':status:'||new.status::text||':'||v_user||':'||extract(epoch from new.updated_at)::bigint,true);
    end loop;
  end if;

  if old.dev_owner_id is distinct from new.dev_owner_id and new.dev_owner_id is not null and new.dev_owner_id is distinct from v_actor then
    perform private.emit_notification(new.workspace_id,new.dev_owner_id,'assigned_dev','tickets',
      'Ticket asignado '||new.ticket_key,new.title,
      jsonb_build_object('entity_type','ticket','entity_id',new.id,'ticket_key',new.ticket_key,'ticket_title',new.title,'action','assigned_dev'),
      v_actor,new.id,null,'ticket:'||new.id||':dev:'||new.dev_owner_id||':'||extract(epoch from new.updated_at)::bigint,true);
  end if;

  if old.qa_owner_id is distinct from new.qa_owner_id and new.qa_owner_id is not null and new.qa_owner_id is distinct from v_actor then
    perform private.emit_notification(new.workspace_id,new.qa_owner_id,'assigned_qa','tickets',
      'Ticket asignado a QA '||new.ticket_key,new.title,
      jsonb_build_object('entity_type','ticket','entity_id',new.id,'ticket_key',new.ticket_key,'ticket_title',new.title,'action','assigned_qa'),
      v_actor,new.id,null,'ticket:'||new.id||':qa:'||new.qa_owner_id||':'||extract(epoch from new.updated_at)::bigint,true);
  end if;

  if old.sprint_id is distinct from new.sprint_id then
    if new.sprint_id is not null then select name into v_sprint_name from public.sprints where id=new.sprint_id; end if;
    if old.sprint_id is not null then select name into v_old_sprint_name from public.sprints where id=old.sprint_id; end if;
    for v_user in select distinct x.uid from (values(new.reporter_id),(new.dev_owner_id),(new.qa_owner_id)) x(uid)
      where x.uid is not null and x.uid is distinct from v_actor
    loop
      perform private.emit_notification(new.workspace_id,v_user,'ticket_sprint','sprints',
        new.ticket_key||case when new.sprint_id is null then ' volvió a Backlog' else ' movido a sprint' end,
        case when new.sprint_id is null then 'Se retiró de '||coalesce(v_old_sprint_name,'Sprint')||' y volvió a Backlog.' else 'Ahora forma parte de '||coalesce(v_sprint_name,'Sprint')||'.' end,
        jsonb_build_object('entity_type','ticket','entity_id',new.id,'ticket_key',new.ticket_key,'ticket_title',new.title,'action','sprint_changed','sprint_id',new.sprint_id,'sprint_name',v_sprint_name,'old_sprint_id',old.sprint_id,'old_sprint_name',v_old_sprint_name),
        v_actor,new.id,null,'ticket:'||new.id||':sprint:'||coalesce(new.sprint_id::text,'backlog')||':'||v_user||':'||extract(epoch from new.updated_at)::bigint,true);
    end loop;
  end if;
  return new;
end $$;

create or replace function private.notify_ticket_comment_created()
returns trigger
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare v_ticket public.tickets%rowtype; v_user uuid;
begin
  select * into v_ticket from public.tickets where id=new.ticket_id;if not found then return new;end if;
  for v_user in select distinct x.uid from (values(v_ticket.reporter_id),(v_ticket.dev_owner_id),(v_ticket.qa_owner_id)) x(uid)
    where x.uid is not null and x.uid is distinct from new.author_id
  loop
    perform private.emit_notification(v_ticket.workspace_id,v_user,'ticket_comment','tickets',
      v_ticket.ticket_key||' · nuevo comentario',left(coalesce(new.body,'Nuevo comentario'),180),
      jsonb_build_object('entity_type','ticket','entity_id',v_ticket.id,'ticket_key',v_ticket.ticket_key,'ticket_title',v_ticket.title,'action','comment','comment_id',new.id,'comment_preview',left(coalesce(new.body,''),180)),
      new.author_id,v_ticket.id,null,'ticket:'||v_ticket.id||':comment:'||new.id||':'||v_user,true);
  end loop;
  return new;
end $$;

create or replace function private.notify_ticket_attachment_created()
returns trigger
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare v_ticket public.tickets%rowtype; v_user uuid;
begin
  if new.comment_id is not null then return new; end if;
  select * into v_ticket from public.tickets where id=new.ticket_id;if not found then return new;end if;
  for v_user in select distinct x.uid from (values(v_ticket.reporter_id),(v_ticket.dev_owner_id),(v_ticket.qa_owner_id)) x(uid)
    where x.uid is not null and x.uid is distinct from new.uploaded_by
  loop
    perform private.emit_notification(v_ticket.workspace_id,v_user,'ticket_evidence','tickets',
      v_ticket.ticket_key||' · nueva evidencia',coalesce(new.file_name,'Se agregó una evidencia al ticket.'),
      jsonb_build_object('entity_type','ticket','entity_id',v_ticket.id,'ticket_key',v_ticket.ticket_key,'ticket_title',v_ticket.title,'action','evidence','attachment_id',new.id,'file_name',new.file_name),
      new.uploaded_by,v_ticket.id,null,'ticket:'||v_ticket.id||':evidence:'||new.id||':'||v_user,true);
  end loop;
  return new;
end $$;
drop trigger if exists trg_notify_ticket_attachment_created on public.ticket_attachments;
create trigger trg_notify_ticket_attachment_created after insert on public.ticket_attachments for each row execute function private.notify_ticket_attachment_created();

-- Helpdesk -------------------------------------------------------------------
create or replace function private.helpdesk_created()
returns trigger
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare v_user uuid;v_proposal boolean:=new.category in ('module','feature','new_requirement');v_actor uuid:=coalesce(auth.uid(),new.requester_user_id);
begin
  insert into public.helpdesk_activity(helpdesk_ticket_id,actor_id,action,to_value) values(new.id,v_actor,'created',new.status);
  if new.requester_user_id is not null then
    perform private.emit_notification(new.workspace_id,new.requester_user_id,'helpdesk_created','helpdesk',
      'Solicitud creada '||new.ticket_key,case when v_proposal then 'Tu propuesta fue registrada y quedó pendiente de decisión.' else 'Tu solicitud fue registrada y está pendiente de canalización.' end,
      jsonb_build_object('entity_type','helpdesk','entity_id',new.id,'helpdesk_key',new.ticket_key,'subject',new.subject,'action','created'),
      v_actor,null,new.id,'helpdesk:'||new.id||':created:requester:'||new.requester_user_id,true);
  end if;
  for v_user in select wm.user_id from public.workspace_members wm
    where wm.workspace_id=new.workspace_id and wm.active=true
      and (wm.role in ('pm','admin','superadmin') or private.member_has_permission(new.workspace_id,wm.user_id,'manage_helpdesk'))
      and wm.user_id is distinct from new.requester_user_id
  loop
    perform private.emit_notification(new.workspace_id,v_user,'helpdesk_new','helpdesk',
      case when v_proposal then 'Nueva propuesta por decidir · '||new.ticket_key else 'Nueva solicitud por canalizar · '||new.ticket_key end,new.subject,
      jsonb_build_object('entity_type','helpdesk','entity_id',new.id,'helpdesk_key',new.ticket_key,'subject',new.subject,'action','new'),
      v_actor,null,new.id,'helpdesk:'||new.id||':new:'||v_user,true);
  end loop;
  return new;
end $$;

create or replace function private.track_helpdesk_change()
returns trigger
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare v_resolution_hours integer:=24;v_actor uuid:=auth.uid();v_user uuid;
begin
  select coalesce(ws.sla_resolution_hours,24) into v_resolution_hours from public.workspace_settings ws where ws.workspace_id=new.workspace_id;
  if not found then v_resolution_hours:=24;end if;
  if old.status is distinct from new.status then
    if new.status='review' and new.reviewed_at is null then new.reviewed_at=now();new.first_response_at=coalesce(new.first_response_at,now());new.due_at=coalesce(new.due_at,now()+make_interval(hours=>v_resolution_hours));end if;
    if new.status='attended' and new.attended_at is null then new.attended_at=now();new.first_response_at=coalesce(new.first_response_at,now());new.due_at=coalesce(new.due_at,now()+make_interval(hours=>v_resolution_hours));end if;
    if new.status='resolved' and new.resolved_at is null then new.resolved_at=now();end if;
    if new.status='closed' and new.closed_at is null then new.closed_at=now();end if;
    insert into public.helpdesk_activity(helpdesk_ticket_id,actor_id,action,from_value,to_value) values(new.id,v_actor,'status_changed',old.status,new.status);
    if new.requester_user_id is not null and new.requester_user_id is distinct from v_actor then
      perform private.emit_notification(new.workspace_id,new.requester_user_id,'helpdesk_status','helpdesk',new.ticket_key||' actualizado','El estado de tu solicitud cambió a '||new.status||'.',
        jsonb_build_object('entity_type','helpdesk','entity_id',new.id,'helpdesk_key',new.ticket_key,'subject',new.subject,'action','status_changed','from_status',old.status,'to_status',new.status),v_actor,null,new.id,'helpdesk:'||new.id||':status:'||new.status||':'||extract(epoch from new.updated_at)::bigint,true);
    end if;
    if new.assigned_to is not null and new.assigned_to is distinct from v_actor and new.assigned_to is distinct from new.requester_user_id then
      perform private.emit_notification(new.workspace_id,new.assigned_to,'helpdesk_status','helpdesk',new.ticket_key||' actualizado','El estado cambió a '||new.status||'.',
        jsonb_build_object('entity_type','helpdesk','entity_id',new.id,'helpdesk_key',new.ticket_key,'subject',new.subject,'action','status_changed','from_status',old.status,'to_status',new.status),v_actor,null,new.id,'helpdesk:'||new.id||':status-assignee:'||new.status||':'||extract(epoch from new.updated_at)::bigint,true);
    end if;
  end if;
  if old.assigned_to is distinct from new.assigned_to and new.assigned_to is not null then
    insert into public.helpdesk_activity(helpdesk_ticket_id,actor_id,action,from_value,to_value) values(new.id,v_actor,'assigned',old.assigned_to::text,new.assigned_to::text);
    perform private.emit_notification(new.workspace_id,new.assigned_to,'helpdesk_assigned','helpdesk',new.ticket_key||' asignado',new.subject,
      jsonb_build_object('entity_type','helpdesk','entity_id',new.id,'helpdesk_key',new.ticket_key,'subject',new.subject,'action','assigned'),v_actor,null,new.id,'helpdesk:'||new.id||':assigned:'||new.assigned_to||':'||extract(epoch from new.updated_at)::bigint,true);
  end if;
  return new;
end $$;

create or replace function private.notify_helpdesk_comment_created()
returns trigger
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare v_req public.helpdesk_tickets%rowtype;v_user uuid;
begin
  select * into v_req from public.helpdesk_tickets where id=new.helpdesk_ticket_id;if not found then return new;end if;
  for v_user in
    select distinct x.user_id from (
      select v_req.requester_user_id user_id union select v_req.assigned_to
      union select wm.user_id from public.workspace_members wm where wm.workspace_id=v_req.workspace_id and wm.active=true and private.member_has_permission(v_req.workspace_id,wm.user_id,'manage_helpdesk')
    ) x where x.user_id is not null and x.user_id is distinct from new.author_id
  loop
    perform private.emit_notification(v_req.workspace_id,v_user,'helpdesk_comment','helpdesk',v_req.ticket_key||' · nuevo comentario',left(coalesce(new.body,'Nuevo comentario'),180),
      jsonb_build_object('entity_type','helpdesk','entity_id',v_req.id,'helpdesk_key',v_req.ticket_key,'subject',v_req.subject,'action','comment','comment_id',new.id,'comment_preview',left(coalesce(new.body,''),180)),new.author_id,null,v_req.id,'helpdesk:'||v_req.id||':comment:'||new.id||':'||v_user,true);
  end loop;
  return new;
end $$;

create or replace function private.notify_helpdesk_attachment_created()
returns trigger
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare v_req public.helpdesk_tickets%rowtype;v_user uuid;
begin
  if new.comment_id is not null then return new;end if;
  select * into v_req from public.helpdesk_tickets where id=new.helpdesk_ticket_id;if not found then return new;end if;
  for v_user in
    select distinct x.user_id from (
      select v_req.requester_user_id user_id union select v_req.assigned_to
      union select wm.user_id from public.workspace_members wm where wm.workspace_id=v_req.workspace_id and wm.active=true and private.member_has_permission(v_req.workspace_id,wm.user_id,'manage_helpdesk')
    ) x where x.user_id is not null and x.user_id is distinct from new.uploaded_by
  loop
    perform private.emit_notification(v_req.workspace_id,v_user,'helpdesk_evidence','helpdesk',v_req.ticket_key||' · nueva evidencia',coalesce(new.file_name,'Se agregó evidencia a la solicitud.'),
      jsonb_build_object('entity_type','helpdesk','entity_id',v_req.id,'helpdesk_key',v_req.ticket_key,'subject',v_req.subject,'action','evidence','attachment_id',new.id,'file_name',new.file_name),new.uploaded_by,null,v_req.id,'helpdesk:'||v_req.id||':evidence:'||new.id||':'||v_user,true);
  end loop;
  return new;
end $$;
drop trigger if exists trg_notify_helpdesk_attachment_created on public.helpdesk_attachments;
create trigger trg_notify_helpdesk_attachment_created after insert on public.helpdesk_attachments for each row execute function private.notify_helpdesk_attachment_created();

-- Sprint ---------------------------------------------------------------------
create or replace function private.notify_sprint_created()
returns trigger
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare v_user uuid;v_actor uuid:=coalesce(auth.uid(),new.created_by);
begin
  for v_user in select wm.user_id from public.workspace_members wm
    where wm.workspace_id=new.workspace_id and wm.active=true and private.member_has_permission(new.workspace_id,wm.user_id,'manage_sprints') and wm.user_id is distinct from v_actor
  loop
    perform private.emit_notification(new.workspace_id,v_user,'sprint_created','sprints','Nuevo sprint · '||new.name,coalesce(new.goal,'Sprint creado.'),
      jsonb_build_object('entity_type','sprint','entity_id',new.id,'sprint_name',new.name,'action','created','status',new.status::text),v_actor,null,null,'sprint:'||new.id||':created:'||v_user,true);
  end loop;
  return new;
end $$;
drop trigger if exists trg_notify_sprint_created on public.sprints;
create trigger trg_notify_sprint_created after insert on public.sprints for each row execute function private.notify_sprint_created();

create or replace function private.notify_sprint_changed()
returns trigger
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare v_user uuid;v_actor uuid:=auth.uid();v_important boolean:=false;
begin
  v_important:=old.status is distinct from new.status or old.start_date is distinct from new.start_date or old.end_date is distinct from new.end_date or old.goal is distinct from new.goal;
  if not v_important then return new;end if;
  for v_user in
    select distinct x.uid from (
      select wm.user_id uid from public.workspace_members wm where wm.workspace_id=new.workspace_id and wm.active=true and private.member_has_permission(new.workspace_id,wm.user_id,'manage_sprints')
      union select t.reporter_id from public.tickets t where t.sprint_id=new.id
      union select t.dev_owner_id from public.tickets t where t.sprint_id=new.id
      union select t.qa_owner_id from public.tickets t where t.sprint_id=new.id
    ) x where x.uid is not null and x.uid is distinct from v_actor
  loop
    perform private.emit_notification(new.workspace_id,v_user,'sprint_updated','sprints',new.name||' actualizado',
      case when old.status is distinct from new.status then 'El sprint cambió a '||new.status::text||'.' else 'Se actualizaron la planeación u objetivo del sprint.' end,
      jsonb_build_object('entity_type','sprint','entity_id',new.id,'sprint_name',new.name,'action','updated','status',new.status::text,'old_status',old.status::text,'start_date',new.start_date,'end_date',new.end_date),v_actor,null,null,'sprint:'||new.id||':updated:'||v_user||':'||extract(epoch from new.updated_at)::bigint,true);
  end loop;
  return new;
end $$;
drop trigger if exists trg_notify_sprint_changed on public.sprints;
create trigger trg_notify_sprint_changed after update on public.sprints for each row execute function private.notify_sprint_changed();

create or replace function private.notify_sprint_comment_created()
returns trigger
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare v_sprint public.sprints%rowtype;v_user uuid;
begin
  select * into v_sprint from public.sprints where id=new.sprint_id;if not found then return new;end if;
  for v_user in
    select distinct x.uid from (
      select wm.user_id uid from public.workspace_members wm where wm.workspace_id=v_sprint.workspace_id and wm.active=true and private.member_has_permission(v_sprint.workspace_id,wm.user_id,'manage_sprints')
      union select t.reporter_id from public.tickets t where t.sprint_id=v_sprint.id
      union select t.dev_owner_id from public.tickets t where t.sprint_id=v_sprint.id
      union select t.qa_owner_id from public.tickets t where t.sprint_id=v_sprint.id
    ) x where x.uid is not null and x.uid is distinct from new.author_id
  loop
    perform private.emit_notification(v_sprint.workspace_id,v_user,'sprint_comment','sprints',v_sprint.name||' · nuevo comentario',left(coalesce(new.body,'Nuevo comentario'),180),
      jsonb_build_object('entity_type','sprint','entity_id',v_sprint.id,'sprint_name',v_sprint.name,'action','comment','comment_id',new.id,'comment_preview',left(coalesce(new.body,''),180)),new.author_id,null,null,'sprint:'||v_sprint.id||':comment:'||new.id||':'||v_user,true);
  end loop;
  return new;
end $$;
drop trigger if exists trg_notify_sprint_comment_created on public.sprint_comments;
create trigger trg_notify_sprint_comment_created after insert on public.sprint_comments for each row execute function private.notify_sprint_comment_created();

create or replace function private.notify_sprint_attachment_created()
returns trigger
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare v_sprint public.sprints%rowtype;v_user uuid;
begin
  if new.comment_id is not null then return new;end if;
  select * into v_sprint from public.sprints where id=new.sprint_id;if not found then return new;end if;
  for v_user in
    select distinct x.uid from (
      select wm.user_id uid from public.workspace_members wm where wm.workspace_id=v_sprint.workspace_id and wm.active=true and private.member_has_permission(v_sprint.workspace_id,wm.user_id,'manage_sprints')
      union select t.reporter_id from public.tickets t where t.sprint_id=v_sprint.id
      union select t.dev_owner_id from public.tickets t where t.sprint_id=v_sprint.id
      union select t.qa_owner_id from public.tickets t where t.sprint_id=v_sprint.id
    ) x where x.uid is not null and x.uid is distinct from new.uploaded_by
  loop
    perform private.emit_notification(v_sprint.workspace_id,v_user,'sprint_evidence','sprints',v_sprint.name||' · nueva evidencia',coalesce(new.file_name,'Se agregó evidencia al sprint.'),
      jsonb_build_object('entity_type','sprint','entity_id',v_sprint.id,'sprint_name',v_sprint.name,'action','evidence','attachment_id',new.id,'file_name',new.file_name),new.uploaded_by,null,null,'sprint:'||v_sprint.id||':evidence:'||new.id||':'||v_user,true);
  end loop;
  return new;
end $$;
drop trigger if exists trg_notify_sprint_attachment_created on public.sprint_attachments;
create trigger trg_notify_sprint_attachment_created after insert on public.sprint_attachments for each row execute function private.notify_sprint_attachment_created();

-- Knowledge ------------------------------------------------------------------
create or replace function private.notify_knowledge_version_event()
returns trigger
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare v_version public.knowledge_article_versions%rowtype;v_article public.knowledge_articles%rowtype;v_user uuid;v_type text;v_title text;v_body text;
begin
  select * into v_version from public.knowledge_article_versions where id=new.version_id;if not found then return new;end if;
  select * into v_article from public.knowledge_articles where id=new.article_id;if not found then return new;end if;
  if new.event_type='created' then
    v_type:='knowledge_draft';v_title:='Nuevo borrador · '||v_version.title;v_body:='Versión '||v_version.version_number||' · '||coalesce(new.note,'Nueva versión en borrador.');
    for v_user in select wm.user_id from public.workspace_members wm where wm.workspace_id=new.workspace_id and wm.active=true and private.member_has_permission(new.workspace_id,wm.user_id,'manage_settings') and wm.user_id is distinct from new.actor_id loop
      perform private.emit_notification(new.workspace_id,v_user,v_type,'knowledge',v_title,v_body,
        jsonb_build_object('entity_type','knowledge','entity_id',new.article_id,'article_id',new.article_id,'version_id',new.version_id,'version_number',v_version.version_number,'article_title',v_version.title,'action','draft_created'),new.actor_id,null,null,'knowledge:'||new.version_id||':draft:'||v_user,true);
    end loop;
  elsif new.event_type in ('published','restored') then
    v_type:=case when new.event_type='restored' then 'knowledge_restored' else 'knowledge_published' end;
    v_title:=case when new.event_type='restored' then 'Artículo restaurado · ' else 'Nuevo artículo publicado · ' end||v_version.title;
    v_body:='Versión '||v_version.version_number||' · '||coalesce(new.note,'Knowledge actualizado.');
    for v_user in select wm.user_id from public.workspace_members wm where wm.workspace_id=new.workspace_id and wm.active=true and wm.user_id is distinct from new.actor_id loop
      perform private.emit_notification(new.workspace_id,v_user,v_type,'knowledge',v_title,v_body,
        jsonb_build_object('entity_type','knowledge','entity_id',new.article_id,'article_id',new.article_id,'version_id',new.version_id,'version_number',v_version.version_number,'article_title',v_version.title,'action',new.event_type),new.actor_id,null,null,'knowledge:'||new.version_id||':'||new.event_type||':'||v_user,true);
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists trg_notify_knowledge_version_event on public.knowledge_version_events;
create trigger trg_notify_knowledge_version_event after insert on public.knowledge_version_events for each row execute function private.notify_knowledge_version_event();

-- Staff ----------------------------------------------------------------------
create or replace function private.notify_workspace_member_change()
returns trigger
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare v_actor uuid:=auth.uid();v_name text;v_role text;
begin
  select coalesce(p.full_name,p.email,'Usuario') into v_name from public.profiles p where p.id=new.user_id;
  v_role:=coalesce(new.role::text,'consulta');
  if tg_op='INSERT' then
    perform private.emit_notification(new.workspace_id,new.user_id,'member_added','staff','Acceso al workspace habilitado',
      'Fuiste agregado al workspace con rol '||v_role||'.',
      jsonb_build_object('entity_type','staff','entity_id',new.user_id,'member_user_id',new.user_id,'member_name',v_name,'role',v_role,'action','added'),v_actor,null,null,'staff:'||new.workspace_id||':'||new.user_id||':added',true);
  elsif old.role is distinct from new.role or old.role_id is distinct from new.role_id or old.active is distinct from new.active or old.all_products is distinct from new.all_products or old.permissions is distinct from new.permissions then
    perform private.emit_notification(new.workspace_id,new.user_id,'member_access_updated','staff','Tus accesos fueron actualizados',
      case when new.active then 'Tu rol, permisos o alcance de productos fue actualizado.' else 'Tu acceso al workspace fue desactivado.' end,
      jsonb_build_object('entity_type','staff','entity_id',new.user_id,'member_user_id',new.user_id,'member_name',v_name,'role',v_role,'active',new.active,'action','access_updated'),v_actor,null,null,'staff:'||new.workspace_id||':'||new.user_id||':updated:'||extract(epoch from now())::bigint,true);
  end if;
  return new;
end $$;
drop trigger if exists trg_notify_workspace_member_change on public.workspace_members;
create trigger trg_notify_workspace_member_change after insert or update on public.workspace_members for each row execute function private.notify_workspace_member_change();

-- Requirement decision now uses the unified notification pipeline.
create or replace function private.record_helpdesk_requirement_decision(p_helpdesk_id uuid,p_decision text,p_ticket_id uuid,p_ticket_key text,p_note text)
returns void
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare v_req public.helpdesk_tickets%rowtype;v_actor uuid:=auth.uid();
begin
  if v_actor is null then raise exception 'Authentication required';end if;
  select * into v_req from public.helpdesk_tickets where id=p_helpdesk_id;if not found then raise exception 'Solicitud no encontrada';end if;
  if not private.member_has_permission(v_req.workspace_id,v_actor,'manage_sprints') then raise exception 'No tienes permiso para registrar esta decisión';end if;
  insert into public.helpdesk_activity(helpdesk_ticket_id,actor_id,action,from_value,to_value)
  values(p_helpdesk_id,v_actor,'requirement_decision','pending',case when p_decision='accepted_backlog' then 'accepted_backlog:'||coalesce(p_ticket_key,'') else 'rejected' end);
  if v_req.requester_user_id is not null then
    perform private.emit_notification(v_req.workspace_id,v_req.requester_user_id,'helpdesk_requirement_decision','helpdesk',
      case when p_decision='accepted_backlog' then coalesce(v_req.ticket_key,'Solicitud')||' aceptado a Backlog' else coalesce(v_req.ticket_key,'Solicitud')||' · sugerencia rechazada' end,
      case when p_decision='accepted_backlog' then 'El requerimiento fue aceptado como '||coalesce(p_ticket_key,'ticket de Backlog')||'.' else 'El requerimiento fue descartado. '||trim(coalesce(p_note,'')) end,
      jsonb_build_object('entity_type','helpdesk','entity_id',p_helpdesk_id,'helpdesk_key',v_req.ticket_key,'subject',v_req.subject,'action','requirement_decision','decision',p_decision,'converted_ticket_id',p_ticket_id,'converted_ticket_key',p_ticket_key,'note',p_note),v_actor,p_ticket_id,p_helpdesk_id,
      'helpdesk:'||p_helpdesk_id||':decision:'||p_decision||':'||coalesce(p_ticket_id::text,'none'),true);
  end if;
end $$;

-- Keep notification rows visible to their recipient for metadata-only entity types.
-- Existing ticket/helpdesk restrictions remain enforced where foreign ids exist.

-- Add new related tables to Realtime when needed.
do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notification_outbox') then
    alter publication supabase_realtime add table public.notification_outbox;
  end if;
end $$;

-- Performance hardening final v16.5
-- Reuse pre-existing unread index and cover notification resource FKs.
drop index if exists public.idx_notifications_user_read;
create index if not exists idx_notifications_ticket_id on public.notifications(ticket_id) where ticket_id is not null;
create index if not exists idx_notifications_helpdesk_ticket_id on public.notifications(helpdesk_ticket_id) where helpdesk_ticket_id is not null;
