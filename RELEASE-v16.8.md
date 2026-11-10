# Jira Interno TROBBU v16.8

## Intelligent Helpdesk routing and workload control

- Staff now includes an optional Helpdesk responsibility/reference description used by the routing assistant.
- Automatic Helpdesk assignment compares request subject, description, request type, department and product against eligible team profiles. OpenAI is used when configured; deterministic local routing is the fallback.
- Each staff member can define daily assignment and active-work limits, plus overflow behavior: workspace rule, fallback user, next available, or queue.
- Current TROBBU defaults: 4 new assignments/day, 4 active requests, overflow to Gustavo Chan. Gustavo is unlimited by default as the fallback.
- Queue entries are retried automatically when capacity is released and every minute through Supabase Cron.
- Assigned specialists can read, comment, attach evidence and redirect their assigned request without receiving global Helpdesk administration permissions.
- Assignment history stores manual, redirect, AI, rules, overflow and queue sources.

## UI / UX

- Kanban assignee remains a single compact control with avatar + assignee select + centered chevron.
- Global select arrows use consistent right padding and vertical alignment.
- Staff create/edit views reuse a Helpdesk routing component for descriptions, limits and overflow rules.
- Helpdesk exposes assignment source/reason/queue state and a dedicated Redirect action for the current assignee.
- Favicon and Apple touch icon use the supplied TROBBU isotipo in pure #FFFFFF with transparent background.

## Backend

- New tables: helpdesk_assignment_log and helpdesk_assignment_queue.
- New capacity/routing functions, queue processor and cron job.
- auto-assign-helpdesk Edge Function added.
- invite-member updated for routing profile fields.
- RLS updated so assigned specialists can only access their assigned Helpdesk request/comments/evidence; direct request editing remains manager-only.
- Public mutation RPCs use SECURITY INVOKER wrappers; privileged implementation remains in the private schema.

## Deployment

The current Supabase project already contains the v16.8 changes. For another environment, apply upgrade-v16.8.sql after the previous consolidated schema or use database.sql for a fresh deployment.
