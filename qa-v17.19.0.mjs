import fs from 'node:fs';
const read=n=>fs.readFileSync(new URL(n,import.meta.url),'utf8');
const app=read('./app-v17.19.0.js'),css=read('./styles-v17.19.0.css'),sql=read('./upgrade-v17.19.0.sql'),db=read('./database.sql'),idx=read('./index.html'),pkg=JSON.parse(read('./package.json')),staff=read('./manage-member.ts'),vacAI=read('./vacation-impact-assistant.ts');
let pass=0,fail=0;const ck=(name,ok,detail='')=>{if(ok){pass++;console.log('PASS ',name)}else{fail++;console.error('FAIL ',name,detail)}};const has=(t,...xs)=>xs.every(x=>t.includes(x));const count=(t,x)=>t.split(x).length-1;
ck('Package version 17.19.0',pkg.version==='17.19.0');
ck('Index loads isolated 17.19 app/css',has(idx,'app-v17.19.0.js','styles-v17.19.0.css','v=17.19.0'));
ck('App release marker 17.19.0',app.startsWith('/* Jira Interno TROBBU v17.19.0'));
ck('No merge markers',![app,css,sql,db,staff,vacAI,idx].some(t=>/^(<<<<<<<|=======|>>>>>>>)/m.test(t)));
ck('CSS braces balanced',count(css,'{')===count(css,'}'),`${count(css,'{')}/${count(css,'}')}`);
ck('Upgrade SQL dollar quotes balanced',count(sql,'$$')%2===0,count(sql,'$$'));
ck('database.sql ends with v17.19 migration',db.trimEnd().endsWith(sql.trimEnd()));

// Audit / sessions
ck('Audit starts date range at today',has(app,'[dateFrom,setDateFrom]=useState(today)','[dateTo,setDateTo]=useState(today)'));
ck('Audit allows prior date ranges and reset today',has(app,'Periodo de análisis','resetDates','max={today}','p_date_from:dateFrom','p_date_to:dateTo'));
ck('Audit counter uses exact DB RPC not array length',has(app,"db.rpc('get_audit_period_metrics'","actions_count")&&has(sql,'select count(*) into v_actions from public.app_audit_events'));
ck('Audit paging avoids first 1000 truncation',has(app,'.range(page*1000,page*1000+999)','while(page<20)'));
ck('Audit realtime listens to sessions and actions',has(app,"table:'app_user_sessions'","table:'app_audit_events'","event:'*'"));
ck('Audit Spanish action translations expanded',has(app,"insert:'Creado'","update:'Actualizado'","published:'Versión publicada'","cancelled:'Cancelado'"));
ck('Audit values translate statuses/booleans',has(app,'function auditDisplayValue',"draft:en?'Draft':'Borrador'","true:en?'Yes':'Sí'"));
ck('Audit activity opens detailed modal',has(app,'AuditEventDetail','audit-detail-modal-body','setSelectedEvent(e)'));
ck('Audit detail responsive/dark UI exists',has(css,'.audit-detail-modal-body','html[data-theme="dark"] .audit-date-toolbar','@media(max-width:760px)'));
ck('Audit metric RPC restricted to Superadmin',has(sql,'private.is_workspace_superadmin','Solo Superadmin puede consultar métricas de bitácora'));

// Realtime
ck('Global realtime uses event wildcard',has(app,"on('postgres_changes',{event:'*'","workspace-live-v2"));
ck('Detail tables trigger immediate reconciliation',has(app,"scheduleRevalidate(90)","ticket_comments","helpdesk_comments","vacation_types","workspace_members"));
ck('Primary realtime reconciliation retained as safety net',has(app,'reconcilePrimaryRows','setInterval(()=>{if(document.visibilityState===\'visible\')reconcilePrimaryRows()},30000)'));
ck('Realtime resume on focus/online/visibility',has(app,"window.addEventListener('focus',resume)","window.addEventListener('online',resume)","document.addEventListener('visibilitychange',resume)"));
ck('Critical new flow tables use replica identity full',has(sql,'alter table public.vacation_requests replica identity full','alter table public.workspace_members replica identity full','alter table public.profiles replica identity full'));

// Staff
ck('Staff Auth email update preserved metadata',has(staff,'getUserById(targetUserId)','user_metadata:{...currentMeta,full_name:fullName||null}'));
ck('Staff profile email is synchronized',has(staff,'update({email,full_name:fullName||null,job_title:jobTitle||null'));
ck('Staff modal persists current routing fields',has(app,'helpdesk_routing_description','helpdesk_auto_assign_enabled','helpdesk_daily_limit','helpdesk_active_limit','helpdesk_overflow_mode','helpdesk_overflow_user_id'));
ck('Staff edge errors no longer collapse to Unknown error',has(staff,'String((error as any)?.message||(error as any)?.error||error||"Unknown error")'));

// Vacations
ck('Vacation business-day helper exists',has(app,'const businessDaysInclusive=','const isBusinessDayKey=','const nextBusinessDayKey='));
ck('Vacation request units exclude weekends in UI',has(app,'businessDaysInclusive(s,e)*Number(type.day_fraction||1)'));
ck('Vacation DB units exclude weekends',has(sql,"extract(isodow from d)<6",'private.vacation_units_for_year'));
ck('Vacation guard rejects weekend-only block',has(sql,'Cada bloque debe incluir al menos un día hábil de lunes a viernes'));
ck('Vacation pending request can be edited by requester',has(app,'editPendingRequest','Editar solicitud pendiente',".eq('user_id',session.user.id).eq('status','pending')"));
ck('Vacation edit resets AI through DB guard',has(sql,"new.date_blocks is distinct from old.date_blocks","new.ai_analysis:='{}'::jsonb"));
ck('Vacation return date defaults to next workday',has(app,'nextBusinessDayKey(end)','nextBusinessDayKey(b.start_date||b.end_date)'));
ck('Fuera hoy excludes weekend-only presence',has(app,'isBusinessDayKey(currentDateKey)','isBusinessDayKey(today)?approved.filter'));
ck('Fuera hoy header opens modal',has(app,"onOutToday={()=>setModal({type:'out-today'})}",'function OutTodayModal','Reincorporación:'));
ck('Historical vacation totals backfilled safely',has(sql,'disable trigger trg_guard_vacation_request','enable trigger trg_guard_vacation_request','charged_days=case when vt.deducts_from_balance'));

// Vacation assistant
ck('Vacation AI uses workday duration',has(vacAI,'const businessDays=','blocks.reduce((n,b)=>n+businessDays'));
ck('Vacation AI validates dependent query errors',has(vacAI,"No se pudo consultar ${label}",'profileRes','ticketRes','absenceRes'));
ck('Vacation AI robust error formatter removes opaque unknown errors',has(vacAI,'const errMessage=','const message=errMessage(error)'));
ck('Vacation AI retains deterministic fallback',has(vacAI,"provider='deterministic-fallback'",'ai_error:aiError'));
ck('Vacation AI legacy recommendation is mapped safely',has(sql,"when 'approve_with_conditions' then 'review'","when 'decline' then 'avoid'"));

// Helpdesk filters
ck('Helpdesk filter state uses arrays',has(app,'status:[],requestType:[],department:[],product:[],assignee:[],priority:[]'));
ck('Helpdesk matching supports multiple status/priority/assignee',has(app,'helpFilterMatch(normalizeHelpdeskStatus(h.status),f.status)','helpFilterMatch(h.priority,f.priority)',"helpFilterMatch(h.assigned_to||'unassigned',f.assignee)"));
ck('Helpdesk multi option modal uses checkbox fields',has(app,'function MultiOptionField','type="checkbox"','help-multi-filter-grid'));
ck('Helpdesk filters OR within a column',has(app,'return !list.length||list.includes(value)'));
ck('Helpdesk multi filter responsive/dark styles exist',has(css,'.help-multi-filter-grid','.multi-option-list','html[data-theme="dark"] .multi-option-list'));

// Mentions
ck('Mention module visible for helpdesk-only desktop',has(app,"helpdeskOnly?[['helpdesk'","['mentioned','lucide:at-sign','Mencionados']"));
ck('Mention view separates mentions and requested tickets',has(app,'Menciones y solicitudes','Tickets solicitados','requestedHelpdesk'));
ck('Mentions RLS allows own mentions regardless of role',has(db,'create policy ticket_mentions_select','user_id=(select auth.uid())','create policy helpdesk_mentions_select'));
ck('Mention tables remain realtime',has(db,'alter table public.ticket_mentions replica identity full','alter table public.helpdesk_mentions replica identity full'));

// Schema / CRUD structural review
const refs=[...new Set([...app.matchAll(/\.from\(['"]([a-zA-Z0-9_]+)['"]\)/g)].map(x=>x[1]))];
const tables=new Set([...db.matchAll(/create table if not exists public\.([a-zA-Z0-9_]+)/ig)].map(x=>x[1]));
const missing=refs.filter(x=>!tables.has(x));
ck('Every frontend table reference exists in database.sql',missing.length===0,missing.join(','));
const noRls=refs.filter(t=>!new RegExp(`alter table public\\.${t} enable row level security`,'i').test(db));
ck('Every frontend table reference has RLS enabled',noRls.length===0,noRls.join(','));
ck('Current Staff Helpdesk columns exist in DB',has(db,'helpdesk_routing_description text','helpdesk_auto_assign_enabled boolean','helpdesk_daily_limit integer','helpdesk_active_limit integer','helpdesk_overflow_user_id uuid'));
ck('Vacation current fields exist in DB',has(db,'date_blocks','return_date','vacation_type_id','decision_by','ai_analysis','ai_analyzed_at'));
ck('Generic app/css copies match versioned build',read('./app.js')===app&&read('./styles.css')===css);

console.log(`\n${pass} passed · ${fail} failed`);if(fail)process.exit(1);
