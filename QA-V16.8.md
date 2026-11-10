# QA v16.8 — Intelligent Helpdesk Routing

## Frontend regression

- TypeScript 5.8.3 parse/noEmit: PASS (exit 0).
- CSV/XLS/XLSX/XLSM importer regression: 16/16 PASS.
- csv-import-v15.2.js, config.js, speed-insights.js syntax: PASS.
- CSS braces: 1998 / 1998.
- Native alert/confirm/prompt calls: 0.
- v16.8 cache references for favicon/styles/config/app: PASS.
- Favicon SVG: only #FFFFFF and none fills; no background rect: PASS.
- Kanban assignee: one avatar+select capsule with custom chevron: PASS.
- Staff routing fields, capacity RPC, auto-assign Edge Function invocation and redirect UI present: PASS.

## Backend functional QA (transaction + rollback)

- Staff routing description/limit persistence and capacity summary: PASS.
- Default daily limit reached: next matching request overflowed to Gustavo Chan: PASS.
- Active limit reached: next request entered queue: PASS.
- Resolving active work automatically drained queue and assigned next request: PASS.
- Post-security-hardening queue drain: PASS.
- Current assignee without manage_helpdesk can redirect to another eligible member: PASS.
- Redirect audit in assignment log + Helpdesk activity/comment: PASS.
- Assigned specialist can read/comment/attach evidence: PASS.
- Assigned specialist cannot directly edit Helpdesk ticket fields: PASS.
- Assigned specialist cannot manually process global assignment queue: PASS.
- Public queue RPC with null workspace is blocked: PASS.
- QA Helpdesk ticket/comment/queue/attachment residues after rollbacks: 0.

## Security / operations

- Health Advisor: 0 findings.
- Security Advisor: only pre-existing Leaked Password Protection Disabled warning.
- Public assign/queue RPCs hardened to SECURITY INVOKER wrappers; privileged code is private.
- New FK coverage indexes added; remaining new indexes may appear as unused until real traffic reaches them.
- auto-assign-helpdesk: ACTIVE, JWT required.
- invite-member: ACTIVE v22, JWT required.
- Cron jira-helpdesk-assignment-queue: active every minute.

## Important scope note

The OpenAI-backed routing Edge Function is deployed and the deterministic database fallback/routing/capacity system was exercised end-to-end. This QA did not execute a billable OpenAI routing request from a real authenticated browser session, so no claim is made that a live OpenAI model call was observed in this session.
