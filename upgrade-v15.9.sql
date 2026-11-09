-- Jira Interno TROBBU v15.9
-- Helpdesk initial evidence: safe requester rollback for failed evidence uploads.

-- Preserve normal Helpdesk administration deletes while allowing the portal requester
-- to roll back only a freshly-created, still-unassigned request when its evidence upload fails.
drop policy if exists helpdesk_tickets_requester_recent_rollback_delete on public.helpdesk_tickets;
drop policy if exists helpdesk_tickets_delete on public.helpdesk_tickets;
create policy helpdesk_tickets_delete
on public.helpdesk_tickets
for delete
to authenticated
using (
  private.has_workspace_permission(workspace_id,'manage_helpdesk')
  or (
    requester_user_id=(select auth.uid())
    and source='portal'
    and status='created'
    and assigned_to is null
    and created_at >= now() - interval '10 minutes'
  )
);
