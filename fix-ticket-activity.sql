-- Fix: ticket_activity FK violation on ticket creation.
-- The ticket audit row must be written AFTER the parent ticket exists.

create or replace function private.track_ticket_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status is distinct from new.status then
    if new.status = 'dev_done' and new.dev_completed_at is null then new.dev_completed_at := now(); end if;
    if new.status = 'qa_passed' and new.qa_completed_at is null then new.qa_completed_at := now(); end if;
    if new.status = 'closed' and new.closed_at is null then new.closed_at := now(); end if;

    insert into public.ticket_activity(ticket_id,actor_id,action,from_value,to_value)
    values(new.id,(select auth.uid()),'status_changed',old.status::text,new.status::text);

    if new.status = 'qa_rejected' and new.dev_owner_id is not null then
      insert into public.notification_outbox(workspace_id,ticket_id,recipient_user_id,event_type,payload)
      values(new.workspace_id,new.id,new.dev_owner_id,'qa_rejected',
        jsonb_build_object('ticket_key',new.ticket_key,'title',new.title,'status',new.status));
    end if;
  end if;

  if old.dev_owner_id is distinct from new.dev_owner_id and new.dev_owner_id is not null then
    insert into public.notification_outbox(workspace_id,ticket_id,recipient_user_id,event_type,payload)
    values(new.workspace_id,new.id,new.dev_owner_id,'assigned_dev',jsonb_build_object('ticket_key',new.ticket_key,'title',new.title));
  end if;

  if old.qa_owner_id is distinct from new.qa_owner_id and new.qa_owner_id is not null then
    insert into public.notification_outbox(workspace_id,ticket_id,recipient_user_id,event_type,payload)
    values(new.workspace_id,new.id,new.qa_owner_id,'assigned_qa',jsonb_build_object('ticket_key',new.ticket_key,'title',new.title));
  end if;

  return new;
end
$$;

create or replace function private.log_ticket_created()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.ticket_activity(ticket_id,actor_id,action,to_value)
  values(new.id,(select auth.uid()),'created',new.status::text);
  return new;
end
$$;

revoke all on function private.log_ticket_created() from public, anon, authenticated;

drop trigger if exists trg_ticket_change on public.tickets;
create trigger trg_ticket_change before update on public.tickets
for each row execute function private.track_ticket_change();

drop trigger if exists trg_ticket_activity_created on public.tickets;
create trigger trg_ticket_activity_created after insert on public.tickets
for each row execute function private.log_ticket_created();
