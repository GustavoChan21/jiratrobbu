import fs from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';

const read = name => fs.readFileSync(new URL(name, import.meta.url), 'utf8');
const app = read('./app.js');
const migration = read('./upgrade-v17.1.sql');
const database = read('./database.sql');
const routing = read('./auto-assign-helpdesk.ts');
const vacation = read('./vacation-impact-assistant.ts');
const knowledge = read('./trobbu-knowledge-assistant.ts');
const translate = read('./translate-knowledge-version.ts');
const styles = read('./styles.css');
const index = read('./index.html');
const pkg = JSON.parse(read('./package.json'));
const invite = read('./invite-member.ts');
const manage = read('./manage-member.ts');

let passed=0; const failures=[];
function check(name,condition,detail=''){if(condition){passed++;console.log(`PASS  ${name}`)}else{failures.push({name,detail});console.error(`FAIL  ${name}${detail?` — ${detail}`:''}`)}}
const hasAll=(text,values)=>values.every(v=>text.includes(v));
const count=(text,needle)=>text.split(needle).length-1;

// Execute the actual pure helpers from app.js for regression scenarios.
const helperStart=app.indexOf('const helpdeskMatchesFilters=');
const helperEnd=app.indexOf('\nconst formatDate',helperStart);
const vacationHelperNames=['addDaysKey','vacationBlocks','vacationOccursOn','vacationRangesOverlap'];
const vacationHelperSource=vacationHelperNames.map(name=>{const start=app.indexOf(`const ${name}=`);const end=app.indexOf('\n',start);return app.slice(start,end)}).join('\n');
const helperSandbox={};
vm.createContext(helperSandbox);
vm.runInContext(`${app.slice(helperStart,helperEnd)}\n${vacationHelperSource}\nthis.__helpers={helpdeskMatchesFilters,vacationBlocks,vacationOccursOn,vacationRangesOverlap};`,helperSandbox);
const runtimeHelpers=helperSandbox.__helpers;

check('Package version is 17.1.0',pkg.version==='17.1.0');
check('Frontend cache bust targets 17.1.0',index.includes('v=17.1.0')&&!index.includes('v=17.0.0'));
check('App release marker is v17.1',app.startsWith('/* Jira Interno TROBBU v17.1'));
check('Incremental migration is appended exactly to database.sql',database.endsWith(migration),`${crypto.createHash('sha256').update(migration).digest('hex')}`);

// Knowledge regression + upgrades
check('Knowledge initial create uses atomic RPC',app.includes("db.rpc('create_knowledge_initial_draft'")&&migration.includes('create or replace function public.create_knowledge_initial_draft'));
check('Knowledge atomic RPC is SECURITY INVOKER',/create or replace function public\.create_knowledge_initial_draft[\s\S]*?security invoker/i.test(migration));
check('Knowledge RPC requires create_knowledge permission',migration.includes("private.has_workspace_permission(p_workspace_id,'create_knowledge')"));
check('Knowledge RPC creates article and v1 draft in one transaction context',hasAll(migration,['insert into public.knowledge_articles','insert into public.knowledge_article_versions','version_number,status','update public.knowledge_articles set draft_version_id=v_version_id']));
check('Knowledge creation keeps file/media rollback',hasAll(app,['uploadKnowledgeImage','if(uploaded.length)await deleteKnowledgeMediaRows(uploaded)','if(versionId){try{await db.from(\'knowledge_articles\').delete()']));
check('Knowledge editor resets saving state even after success',app.includes('finally{setSaving(false)}'));
check('Knowledge editor remounts after draft/version identity change',app.includes('key={`${knowledgeScreen.article?.id||\'new\'}:${knowledgeScreen.version?.id||\'new\'}`}'));
check('Knowledge rich editor supports H1-H5',hasAll(app,['<option value="h1">H1</option>','<option value="h2">H2</option>','<option value="h3">H3</option>','<option value="h4">H4</option>','<option value="h5">H5</option>']));
check('Knowledge rich editor supports font family and sizes',hasAll(app,["command('fontName'","command('fontSize'",'Times New Roman','Courier New']));
check('Knowledge rich editor supports bold/italic/underline',hasAll(app,["command('bold')","command('italic')","command('underline')"]));
check('Knowledge rich editor supports lists and alignment',hasAll(app,["command('insertUnorderedList')","command('insertOrderedList')","command('justifyLeft')","command('justifyCenter')","command('justifyRight')"]));
check('Knowledge sanitizer allowlists font families',hasAll(app,['allowedFonts=new Set','child.setAttribute(\'face\'','font-family']));
check('Knowledge translation preserves rich content blocks',hasAll(translate,['content_blocks','html','mergeBlocks']));
check('Knowledge AI still allows zero relevant matches',knowledge.includes('articles:[]'));

// Helpdesk filters/counters/ordering/manual assignment
check('Helpdesk counters derive from same non-status filters as list',hasAll(app,['const counterBase=allItems.filter(h=>helpdeskMatchesFilters(h,filters,false))','counterBase.filter(h=>h.status===status)','Ver todo <em>{counterBase.length}</em>']));
check('Helpdesk filtering function covers status/type/department/product/assignee/priority',hasAll(app,['f.status','f.requestType','f.department','f.product','f.assignee','f.priority']));
check('Helpdesk all view remains active-first',app.includes('const rank={created:0,review:1,attended:2,resolved:3,closed:4}'));
check('Manual auto-assign button exists',hasAll(app,['Autoasignar pendientes','autoAssignExistingHelpdesk','manual_trigger:true']));
check('Manual auto-assign processes existing active unassigned tickets',app.includes("!h.assigned_to&&!isProposalCategory(h.category)&&['created','review','attended'].includes(h.status)"));
check('Manual auto-assign Edge Function validates manage permission',hasAll(routing,['body.manual_trigger===true','manage_helpdesk','No tienes permiso para ejecutar la autoasignación manual.']));
check('Routing uses descriptions and capacity',hasAll(routing,['helpdesk_routing_description','daily_limit','active_limit','localScore']));
check('Routing excludes only actual approved vacation blocks today',hasAll(routing,['function vacationBlocks','function absentOn','date_blocks','absentOn(v,today)']));
const helpRows=[
  {status:'created',request_type_id:'r1',department_id:'d1',product_id:'p1',assigned_to:null,priority:'high'},
  {status:'review',request_type_id:'r1',department_id:'d1',product_id:'p1',assigned_to:'u1',priority:'high'},
  {status:'closed',request_type_id:'r2',department_id:'d1',product_id:'p1',assigned_to:'u1',priority:'low'}
];
const helpFilter={status:'created',requestType:'r1',department:'d1',product:'p1',assignee:'all',priority:'high'};
check('Behavior: Helpdesk visible rows honor the selected status',helpRows.filter(x=>runtimeHelpers.helpdeskMatchesFilters(x,helpFilter,true)).length===1);
check('Behavior: Helpdesk counter base ignores only status, not other filters',helpRows.filter(x=>runtimeHelpers.helpdeskMatchesFilters(x,helpFilter,false)).length===2);
const multiVacation={date_blocks:[{start_date:'2026-11-10',end_date:'2026-11-11',return_date:'2026-11-12'},{start_date:'2026-11-16',end_date:'2026-11-17',return_date:'2026-11-18'}]};
check('Behavior: gap between vacation blocks is not considered absent',runtimeHelpers.vacationOccursOn(multiVacation,'2026-11-13')===false&&runtimeHelpers.vacationOccursOn(multiVacation,'2026-11-16')===true);
check('Behavior: multi-block overlap checks exact blocks instead of bounding range',runtimeHelpers.vacationRangesOverlap(multiVacation,{date_blocks:[{start_date:'2026-11-13',end_date:'2026-11-15',return_date:'2026-11-16'}]})===false&&runtimeHelpers.vacationRangesOverlap(multiVacation,{date_blocks:[{start_date:'2026-11-17',end_date:'2026-11-18',return_date:'2026-11-19'}]})===true);

// Kanban/Table quick assignment
check('Shared TicketAssigneeSelect component exists',app.includes('function TicketAssigneeSelect'));
check('Kanban uses shared assignee selector',app.includes('variant="kanban"'));
check('Table uses shared assignee selector',app.includes('variant="table"'));
check('Whole assignee selector is clickable via covering select',hasAll(styles,['.quick-assignee-select>select','position:absolute!important','inset:0!important','opacity:0!important','cursor:pointer!important']));

// Ticket relationships
check('Ticket relation picker has search input',hasAll(app,['function TicketRelationPicker','Buscar por clave, título, producto o estado']));
check('Ticket relation search includes status/product/title/key',app.includes('`${t.ticket_key} ${t.title} ${products.find(p=>p.id===t.product_id)?.name||\'\'} ${statusLabel(t.status)}`'));
check('Closed tickets are allowed and sorted after active tickets',hasAll(app,["Number(a.status==='closed')-Number(b.status==='closed')",'Puedes relacionar tickets activos, en curso o cerrados.']));
check('Already related tickets are protected from duplicate selection',hasAll(app,['disabled={already}','already-related','Ya relacionado']));
check('Relation picker has styled results dropdown',hasAll(styles,['.ticket-relation-options','.ticket-relation-search','.ticket-relation-selected']));

// Gantt requested row layout
check('Gantt title and period text share first markup row',hasAll(app,['className="gantt-title-line"','<h3>Timeline / Gantt</h3>','histórico, proyección y progreso']));
check('Gantt controls are forced to second row',hasAll(styles,['.jira-timeline-toolbar{display:grid!important','grid-row:2','gantt-title-line']));
check('Gantt keeps all requested time ranges',hasAll(app,['value="1w"','value="4w"','value="6w"','value="8w"','value="1m"','value="2m"','value="3m"','value="6m"']));

// Vacations multi-block model + UX + projection
check('Vacation schema adds return_date',migration.includes('add column if not exists return_date date'));
check('Vacation schema adds JSON date_blocks',migration.includes("add column if not exists date_blocks jsonb not null default '[]'::jsonb"));
check('Vacation migration backfills legacy single ranges',hasAll(migration,["'id','legacy'",'jsonb_build_array','return_date=coalesce(return_date,end_date+1)']));
check('Vacation guard permits 1-8 blocks and total <=61 days',hasAll(migration,['v_count<1 or v_count>8','v_total>61','Los bloques de una misma solicitud no pueden traslaparse']));
check('Vacation guard requires return date after each block',migration.includes('La fecha de reincorporación debe ser posterior al fin de cada bloque'));
check('Vacation overlap validation uses individual JSON blocks',count(migration,'jsonb_array_elements(new.date_blocks)')>=4&&migration.includes('jsonb_array_elements(vr.date_blocks)'));
check('Vacation AI is invalidated when blocks change',migration.includes('new.date_blocks is distinct from old.date_blocks'));
check('Vacation approval still requires recent AI analysis',hasAll(migration,["new.status='approved'",'ai_analyzed_at is null',"interval '12 hours'"]));
check('Vacation UI exposes reincorporation field',app.includes('Fecha de reincorporación'));
check('Vacation UI can add/remove multiple blocks',hasAll(app,['Agregar bloque','requestBlocks.length>=8','setRequestBlocks(x=>x.filter']));
check('Vacation UI persists date_blocks and return_date',hasAll(app,['date_blocks:blocks.map','return_date:returnDate']));
check('Vacation calendar only marks exact blocks as out',app.includes('approved.filter(r=>vacationOccursOn(r,day.key))'));
check('Vacation out-today uses exact blocks',app.includes('const outToday=approved.filter(r=>vacationOccursOn(r,today))'));
check('Vacation timeline component exists',hasAll(app,['function VacationTimeline','Proyección de vacaciones','aprobadas y pendientes']));
check('Vacation timeline supports requested week ranges',hasAll(app,['value="1w">1 semana','value="4w">4 semanas','value="6w">6 semanas','value="8w">8 semanas']));
check('Vacation timeline supports requested month ranges',hasAll(app,['value="1m">1 mes','value="2m">2 meses','value="3m">3 meses','value="6m">6 meses']));
check('Vacation timeline draws every block separately',app.includes('vacationBlocks(r).map((b,i)=>'));
check('Vacation impact assistant models exact date_blocks',hasAll(vacation,['function blocksFor','date_blocks:blocks','Treat only the exact date blocks as absences']))
check('Vacation impact assistant sums actual absence days',vacation.includes('blocks.reduce((n,b)=>n+dateRangeDays'));
check('Vacation impact assistant filters real overlapping team absences',vacation.includes('blocksFor(v).some(other=>blocks.some(b=>overlaps(other,b)))'));
check('Vacation responsive spacing/layout styles exist',hasAll(styles,['.vacation-block-grid','.vacation-timeline-toolbar','.vacation-calendar-toolbar','.vacation-approval-list']));

// Security/version/RBAC regression checks
const permissionKeys=['view_knowledge','create_knowledge','edit_knowledge','delete_knowledge','view_vacations','request_vacations','manage_vacations'];
check('RBAC keys remain in frontend',hasAll(app,permissionKeys));
check('RBAC keys remain in invite backend',hasAll(invite,permissionKeys));
check('RBAC keys remain in manage backend',hasAll(manage,permissionKeys));
check('Admin password reset remains server-side',manage.includes('auth.admin.updateUserById')&&manage.includes('action==="set_password"'));
check('No service role key introduced in frontend',!app.includes('SUPABASE_SERVICE_ROLE_KEY'));
check('No unresolved merge markers',![app,migration,database,routing,vacation,knowledge,translate,styles,index].some(t=>/^(<<<<<<<|=======|>>>>>>>)/m.test(t)));
check('SQL dollar quotes are balanced',count(migration,'$$')%2===0);
check('CSS braces are balanced',count(styles,'{')===count(styles,'}'),`${count(styles,'{')} / ${count(styles,'}')}`);

console.log(`\nQA v17.1 summary: ${passed} passed, ${failures.length} failed.`);
if(failures.length){for(const f of failures)console.error(` - ${f.name}${f.detail?`: ${f.detail}`:''}`);process.exit(1)}
