-- Jira Interno TROBBU v17.10.0
-- SendPulse transactional email QA gate, daily reminder scheduler,
-- professional Helpdesk email routing and notification outbox auditing.

begin;

create extension if not exists pgcrypto;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- -----------------------------------------------------------------------------
-- 1) Workspace-level email rollout / QA controls.
-- -----------------------------------------------------------------------------
alter table public.workspace_settings
  add column if not exists email_qa_mode boolean not null default true,
  add column if not exists email_qa_recipient text not null default 'gustavo.chan@trobbucollection.com',
  add column if not exists email_daily_reminder_enabled boolean not null default true,
  add column if not exists email_qa_hourly_limit integer not null default 8,
  add column if not exists email_rollout_at timestamptz,
  add column if not exists email_cron_token_hash text;

do $$
begin
  if not exists(select 1 from pg_constraint where conname='workspace_settings_email_qa_hourly_limit_check') then
    alter table public.workspace_settings
      add constraint workspace_settings_email_qa_hourly_limit_check
      check (email_qa_hourly_limit between 1 and 50);
  end if;
end $$;

update public.workspace_settings
set email_qa_mode=true,
    email_qa_recipient='gustavo.chan@trobbucollection.com',
    email_daily_reminder_enabled=true,
    email_qa_hourly_limit=least(greatest(coalesce(email_qa_hourly_limit,8),1),8),
    email_rollout_at=coalesce(email_rollout_at,now());

-- -----------------------------------------------------------------------------
-- 2) Outbox audit fields and a safe status for intentionally blocked messages.
-- -----------------------------------------------------------------------------
alter table public.notification_outbox
  add column if not exists provider text,
  add column if not exists provider_message_id text,
  add column if not exists intended_recipient_email text,
  add column if not exists delivered_to text,
  add column if not exists suppressed_at timestamptz,
  add column if not exists suppressed_reason text;

alter table public.notification_outbox drop constraint if exists notification_outbox_status_check;
alter table public.notification_outbox
  add constraint notification_outbox_status_check
  check (status in ('pending','processing','sent','failed','suppressed'));

-- Preserve the legacy queue as audit history, but never release it when the first
-- real provider is enabled. Only events generated at/after the workspace rollout
-- timestamp are eligible for delivery.
update public.notification_outbox o
set status='suppressed',
    suppressed_at=coalesce(o.suppressed_at,now()),
    suppressed_reason=coalesce(o.suppressed_reason,'pre_sendpulse_qa_rollout_v17.10')
from public.workspace_settings ws
where ws.workspace_id=o.workspace_id
  and o.status in ('pending','failed')
  and o.created_at < ws.email_rollout_at;

create index if not exists ix_notification_outbox_workspace_status_created
  on public.notification_outbox(workspace_id,status,created_at);
create index if not exists ix_notification_outbox_delivered_to_sent
  on public.notification_outbox(delivered_to,sent_at desc)
  where status='sent';

-- -----------------------------------------------------------------------------
-- 3) Helpdesk comments: one email counterpart per comment, while retaining the
--    existing in-app fan-out for requester / assignee / Helpdesk managers.
-- -----------------------------------------------------------------------------
create or replace function private.notify_helpdesk_comment_created()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_req public.helpdesk_tickets%rowtype;
  v_user uuid;
  v_email_user uuid;
  v_direction text;
  v_author_name text;
  v_author_email text;
begin
  select * into v_req from public.helpdesk_tickets where id=new.helpdesk_ticket_id;
  if not found then return new; end if;

  select coalesce(nullif(new.author_name,''),p.full_name,'Usuario'),
         coalesce(nullif(new.author_email,''),p.email)
  into v_author_name,v_author_email
  from public.profiles p
  where p.id=new.author_id;

  v_author_name:=coalesce(v_author_name,nullif(new.author_name,''),'Usuario');
  v_author_email:=coalesce(v_author_email,nullif(new.author_email,''));

  if new.author_id is not distinct from v_req.requester_user_id then
    v_direction:='requester_to_team';
    v_email_user:=v_req.assigned_to;
    if v_email_user is null then
      select wm.user_id into v_email_user
      from public.workspace_members wm
      where wm.workspace_id=v_req.workspace_id
        and wm.active=true
        and private.member_has_permission(v_req.workspace_id,wm.user_id,'manage_helpdesk')
        and wm.user_id is distinct from new.author_id
      order by wm.created_at nulls last,wm.user_id
      limit 1;
    end if;
  else
    v_direction:='team_to_requester';
    v_email_user:=v_req.requester_user_id;
  end if;

  for v_user in
    select distinct x.user_id from (
      select v_req.requester_user_id user_id
      union select v_req.assigned_to
      union select wm.user_id
      from public.workspace_members wm
      where wm.workspace_id=v_req.workspace_id
        and wm.active=true
        and private.member_has_permission(v_req.workspace_id,wm.user_id,'manage_helpdesk')
    ) x
    where x.user_id is not null and x.user_id is distinct from new.author_id
  loop
    perform private.emit_notification(
      v_req.workspace_id,
      v_user,
      'helpdesk_comment',
      'helpdesk',
      v_req.ticket_key||' · nuevo comentario',
      left(coalesce(new.body,'Nuevo comentario'),180),
      jsonb_build_object(
        'entity_type','helpdesk',
        'entity_id',v_req.id,
        'helpdesk_key',v_req.ticket_key,
        'subject',v_req.subject,
        'action','comment',
        'comment_id',new.id,
        'comment_preview',left(coalesce(new.body,''),360),
        'comment_direction',v_direction,
        'comment_author_name',v_author_name,
        'comment_author_email',v_author_email,
        'requester_user_id',v_req.requester_user_id,
        'assigned_to',v_req.assigned_to
      ),
      new.author_id,
      null,
      v_req.id,
      'helpdesk:'||v_req.id||':comment:'||new.id||':'||v_user,
      v_user is not distinct from v_email_user
    );
  end loop;
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- 4) Helpdesk assignment / closing email semantics.
--    Intermediate state changes remain in-app only. Assignment and close get a
--    dedicated transactional email event.
-- -----------------------------------------------------------------------------
create or replace function private.track_helpdesk_change()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_resolution_hours integer:=24;
  v_actor uuid:=auth.uid();
  v_status_label text;
  v_requester_name text;
  v_assignee_name text;
begin
  select coalesce(ws.sla_resolution_hours,24)
  into v_resolution_hours
  from public.workspace_settings ws
  where ws.workspace_id=new.workspace_id;
  if not found then v_resolution_hours:=24; end if;

  select full_name into v_requester_name from public.profiles where id=new.requester_user_id;
  select full_name into v_assignee_name from public.profiles where id=new.assigned_to;

  if old.status is distinct from new.status then
    if new.status='review' and new.reviewed_at is null then
      new.reviewed_at=now();
      new.first_response_at=coalesce(new.first_response_at,now());
      new.due_at=coalesce(new.due_at,now()+make_interval(hours=>v_resolution_hours));
    end if;
    if new.status='attended' and new.attended_at is null then
      new.attended_at=now();
      new.first_response_at=coalesce(new.first_response_at,now());
      new.due_at=coalesce(new.due_at,now()+make_interval(hours=>v_resolution_hours));
    end if;
    if new.status='closed' and new.closed_at is null then new.closed_at=now(); end if;

    v_status_label:=case new.status
      when 'created' then 'Nuevo'
      when 'review' then 'En revisión'
      when 'attended' then 'Atendido'
      when 'closed' then 'Cerrado'
      else new.status
    end;

    insert into public.helpdesk_activity(helpdesk_ticket_id,actor_id,action,from_value,to_value)
    values(new.id,v_actor,'status_changed',old.status,new.status);

    -- In-app status updates stay available, but do not generate email noise.
    if new.requester_user_id is not null and new.requester_user_id is distinct from v_actor then
      perform private.emit_notification(
        new.workspace_id,new.requester_user_id,'helpdesk_status','helpdesk',
        new.ticket_key||' actualizado','El estado de tu solicitud cambió a '||v_status_label||'.',
        jsonb_build_object('entity_type','helpdesk','entity_id',new.id,'helpdesk_key',new.ticket_key,'subject',new.subject,'action','status_changed','from_status',old.status,'to_status',new.status),
        v_actor,null,new.id,'helpdesk:'||new.id||':status:'||new.status||':'||extract(epoch from new.updated_at)::bigint,false
      );
    end if;
    if new.assigned_to is not null and new.assigned_to is distinct from v_actor and new.assigned_to is distinct from new.requester_user_id then
      perform private.emit_notification(
        new.workspace_id,new.assigned_to,'helpdesk_status','helpdesk',
        new.ticket_key||' actualizado','El estado cambió a '||v_status_label||'.',
        jsonb_build_object('entity_type','helpdesk','entity_id',new.id,'helpdesk_key',new.ticket_key,'subject',new.subject,'action','status_changed','from_status',old.status,'to_status',new.status),
        v_actor,null,new.id,'helpdesk:'||new.id||':status-assignee:'||new.status||':'||extract(epoch from new.updated_at)::bigint,false
      );
    end if;

    if new.status='closed' then
      if new.requester_user_id is not null then
        perform private.emit_notification(
          new.workspace_id,new.requester_user_id,'helpdesk_closed','helpdesk',
          new.ticket_key||' cerrado','La solicitud fue cerrada.',
          jsonb_build_object(
            'entity_type','helpdesk','entity_id',new.id,'helpdesk_key',new.ticket_key,'subject',new.subject,
            'action','closed','from_status',old.status,'to_status',new.status,
            'requester_name',v_requester_name,'assignee_name',v_assignee_name,'closed_at',coalesce(new.closed_at,now())
          ),
          v_actor,null,new.id,'helpdesk:'||new.id||':closed:'||extract(epoch from coalesce(new.closed_at,now()))::bigint,true
        );
      elsif new.assigned_to is not null then
        perform private.emit_notification(
          new.workspace_id,new.assigned_to,'helpdesk_closed','helpdesk',
          new.ticket_key||' cerrado','La solicitud fue cerrada.',
          jsonb_build_object('entity_type','helpdesk','entity_id',new.id,'helpdesk_key',new.ticket_key,'subject',new.subject,'action','closed','assignee_name',v_assignee_name,'closed_at',coalesce(new.closed_at,now())),
          v_actor,null,new.id,'helpdesk:'||new.id||':closed:'||extract(epoch from coalesce(new.closed_at,now()))::bigint,true
        );
      end if;
    end if;
  end if;

  if old.assigned_to is distinct from new.assigned_to and new.assigned_to is not null then
    insert into public.helpdesk_activity(helpdesk_ticket_id,actor_id,action,from_value,to_value)
    values(new.id,v_actor,'assigned',old.assigned_to::text,new.assigned_to::text);
    perform private.emit_notification(
      new.workspace_id,new.assigned_to,'helpdesk_assigned','helpdesk',new.ticket_key||' asignado',new.subject,
      jsonb_build_object(
        'entity_type','helpdesk','entity_id',new.id,'helpdesk_key',new.ticket_key,'subject',new.subject,'action','assigned',
        'requester_name',v_requester_name,'assignee_name',v_assignee_name,'priority',new.priority,'department_id',new.department_id
      ),
      v_actor,null,new.id,'helpdesk:'||new.id||':assigned:'||new.assigned_to||':'||extract(epoch from new.updated_at)::bigint,true
    );
  end if;
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- 5) Daily Jira reminder. During QA, one workspace summary email is queued only
--    for the QA mailbox. Once QA mode is disabled, it can fan out per member.
-- -----------------------------------------------------------------------------
create or replace function private.queue_daily_jira_reminders(p_workspace uuid default null)
returns integer
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  ws record;
  v_user uuid;
  v_date date;
  v_key text;
  v_open bigint;
  v_backlog bigint;
  v_helpdesk bigint;
  v_sprints bigint;
  v_inserted integer:=0;
begin
  for ws in
    select * from public.workspace_settings s
    where coalesce(s.email_notifications,true)=true
      and coalesce(s.email_daily_reminder_enabled,true)=true
      and (p_workspace is null or s.workspace_id=p_workspace)
  loop
    v_date:=timezone(coalesce(ws.timezone,'America/Merida'),now())::date;
    select count(*) into v_open from public.tickets t where t.workspace_id=ws.workspace_id and t.status<>'closed';
    select count(*) into v_backlog from public.tickets t where t.workspace_id=ws.workspace_id and t.sprint_id is null and t.status<>'closed';
    select count(*) into v_helpdesk from public.helpdesk_tickets h where h.workspace_id=ws.workspace_id and h.status<>'closed';
    select count(*) into v_sprints from public.sprints s where s.workspace_id=ws.workspace_id and s.status in ('active','planned');

    if coalesce(ws.email_qa_mode,true) then
      v_key:='daily-jira-reminder:qa:'||ws.workspace_id||':'||v_date;
      if not exists(select 1 from public.notification_outbox o where o.workspace_id=ws.workspace_id and o.dedupe_key=v_key) then
        insert into public.notification_outbox(
          workspace_id,recipient_email,event_type,payload,category,dedupe_key,status
        ) values(
          ws.workspace_id,ws.email_qa_recipient,'daily_jira_reminder',
          jsonb_build_object(
            'title','Recordatorio diario de Jira Interno',
            'body','Revisa y actualiza el avance de tus tickets.',
            'metadata',jsonb_build_object(
              'entity_type','system','action','daily_reminder','date',v_date,
              'open_tickets',v_open,'backlog_tickets',v_backlog,'open_helpdesk',v_helpdesk,'active_sprints',v_sprints
            )
          ),
          'system',v_key,'pending'
        );
        v_inserted:=v_inserted+1;
      end if;
    else
      for v_user in
        select wm.user_id from public.workspace_members wm
        where wm.workspace_id=ws.workspace_id and wm.active=true
      loop
        v_key:='daily-jira-reminder:'||ws.workspace_id||':'||v_user||':'||v_date;
        if not exists(select 1 from public.notification_outbox o where o.recipient_user_id=v_user and o.dedupe_key=v_key) then
          insert into public.notification_outbox(
            workspace_id,recipient_user_id,event_type,payload,category,dedupe_key,status
          ) values(
            ws.workspace_id,v_user,'daily_jira_reminder',
            jsonb_build_object(
              'title','Recordatorio diario de Jira Interno',
              'body','Revisa y actualiza el avance de tus tickets.',
              'metadata',jsonb_build_object(
                'entity_type','system','action','daily_reminder','date',v_date,
                'open_tickets',v_open,'backlog_tickets',v_backlog,'open_helpdesk',v_helpdesk,'active_sprints',v_sprints
              )
            ),
            'system',v_key,'pending'
          );
          v_inserted:=v_inserted+1;
        end if;
      end loop;
    end if;
  end loop;
  return v_inserted;
end $$;
revoke all on function private.queue_daily_jira_reminders(uuid) from public,anon,authenticated;

-- -----------------------------------------------------------------------------
-- 6) Create per-workspace cron tokens in Vault. Only SHA-256 hashes are exposed
--    to the Edge Function through workspace_settings; raw tokens remain in Vault.
-- -----------------------------------------------------------------------------
do $$
declare
  ws record;
  v_name text;
  v_token text;
  v_id uuid;
begin
  for ws in select workspace_id,email_cron_token_hash from public.workspace_settings loop
    v_name:='jira_notification_cron_token_'||replace(ws.workspace_id::text,'-','');
    select decrypted_secret into v_token from vault.decrypted_secrets where name=v_name limit 1;
    if v_token is null then
      v_token:=encode(gen_random_bytes(32),'hex');
      select vault.create_secret(v_token,v_name,'Jira Interno notification processor cron token',null) into v_id;
    end if;
    update public.workspace_settings
    set email_cron_token_hash=encode(digest(v_token,'sha256'),'hex')
    where workspace_id=ws.workspace_id;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 7) Schedules. Supabase Cron uses UTC. 15:00 UTC = 09:00 America/Merida.
-- -----------------------------------------------------------------------------
do $$
begin
  perform cron.schedule(
    'jira-daily-email-reminder',
    '0 15 * * *',
    'select private.queue_daily_jira_reminders(null);'
  );

  perform cron.schedule(
    'jira-process-email-outbox',
    '* * * * *',
    $cron$
      select net.http_post(
        url:='https://prweelxfuvbsdsxfopuh.supabase.co/functions/v1/process-notifications',
        headers:=jsonb_build_object(
          'Content-Type','application/json',
          'x-notification-cron-token',(
            select decrypted_secret from vault.decrypted_secrets
            where name='jira_notification_cron_token_'||replace(ws.workspace_id::text,'-','')
            limit 1
          )
        ),
        body:=jsonb_build_object('workspace_id',ws.workspace_id,'source','cron'),
        timeout_milliseconds:=10000
      )
      from public.workspace_settings ws
      where coalesce(ws.email_notifications,true)=true
        and ws.email_cron_token_hash is not null;
    $cron$
  );
end $$;

notify pgrst,'reload schema';
commit;
