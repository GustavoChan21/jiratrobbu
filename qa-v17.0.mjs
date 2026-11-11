import fs from 'node:fs';
import crypto from 'node:crypto';

const read = name => fs.readFileSync(new URL(name, import.meta.url), 'utf8');
const app = read('./app.js');
const migration = read('./upgrade-v17.0.sql');
const database = read('./database.sql');
const invite = read('./invite-member.ts');
const manage = read('./manage-member.ts');
const routing = read('./auto-assign-helpdesk.ts');
const knowledge = read('./trobbu-knowledge-assistant.ts');
const vacation = read('./vacation-impact-assistant.ts');
const styles = read('./styles.css');
const index = read('./index.html');
const pkg = JSON.parse(read('./package.json'));

let passed = 0;
const failures = [];
function check(name, condition, detail='') {
  if (condition) { passed++; console.log(`PASS  ${name}`); }
  else { failures.push({name, detail}); console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}
function hasAll(text, values){ return values.every(v => text.includes(v)); }

const permissionKeys = ['view_knowledge','create_knowledge','edit_knowledge','delete_knowledge','view_vacations','request_vacations','manage_vacations'];
check('Package version is 17.0.0', pkg.version === '17.0.0');
check('Frontend cache bust targets 17.0.0', index.includes('v=17.0.0'));
check('RBAC keys exist in frontend', hasAll(app, permissionKeys));
check('RBAC keys exist in invite-member backend', hasAll(invite, permissionKeys));
check('RBAC keys exist in manage-member backend', hasAll(manage, permissionKeys));
check('RBAC keys exist in SQL defaults', hasAll(migration, permissionKeys));

check('Knowledge categories table is created', migration.includes('create table if not exists public.knowledge_categories'));
check('Knowledge categories include requested operational groups', hasAll(migration, ["'systems','Sistemas'", "'reception','Recepción'", "'operations','Operaciones'", "'policies','Políticas'", "'sop','SOP'"]));
check('Create-only Knowledge users can read own initial draft', migration.includes("status='draft' and active_version_id is null and created_by=(select auth.uid())") && migration.includes("private.has_workspace_permission(workspace_id,'create_knowledge')"));
check('Knowledge editor exposes H1-H5', hasAll(app, ['H1','H2','H3','H4','H5']));
check('Knowledge editor exposes bold/italic/underline/font size', hasAll(app, ["command('bold')", "command('italic')", "command('underline')", "command('fontSize'"]));
check('Rich Knowledge HTML is sanitized', app.includes('sanitizeKnowledgeHtml'));
check('Knowledge translation carries rich HTML', hasAll(read('./translate-knowledge-version.ts'), ['html','mergeBlocks','content_blocks','translate only visible human-readable text nodes']));

check('Knowledge assistant enforces AI relevance threshold', knowledge.includes('relevance>=.58') && knowledge.includes('r.relevant===true&&relevance>=.58'));
check('Knowledge assistant allows zero matches', hasAll(knowledge, ['No encontré artículos', 'articles:[]']) || hasAll(knowledge, ['no relevant', 'articles:[]']));
check('Knowledge assistant has deterministic fallback threshold', knowledge.includes('a.relevance>=.42'));
check('Knowledge assistant default model is GPT-6.1 Sol', knowledge.includes('gpt-6.1-sol'));

const helpdeskStatuses = ['created','review','attended','resolved','closed'];
check('Helpdesk exposes all requested status filters', hasAll(app, helpdeskStatuses));
check('Helpdesk all-view status ranking is active-first', hasAll(app, ["created:0","review:1","attended:2","resolved:3","closed:4"]));
check('Sprint detail has product filter', hasAll(app, ["const [productFilter,setProductFilter]=useState('all')", 'sprint-product-filter', 'No hay actividades de este producto en el sprint.']));

check('Admin can set a chosen password server-side', manage.includes('action==="set_password"') && manage.includes('auth.admin.updateUserById') && manage.includes('password:newPassword'));
check('Password UI requires confirmation', hasAll(app, ['newPassword','confirmPassword']));

check('Helpdesk routing requires responsibility context', migration.includes('workspace_members_helpdesk_routing_context_check'));
check('Routing supports daily and active capacity', hasAll(routing, ['daily_limit','active_limit','daily_count','active_count']));
check('Routing excludes approved vacation absences today', routing.includes('vacation_requests') && routing.includes('absent_today:absentToday'));
check('Next-available overflow does not pick zero-match staff', routing.includes('c.user_id!==chosen.user_id&&c.score>0'));
check('Auto-routing default model is GPT-6.1 Sol', routing.includes('gpt-6.1-sol'));

check('Vacation table and RLS exist', migration.includes('create table if not exists public.vacation_requests') && migration.includes('alter table public.vacation_requests enable row level security'));
check('Vacation viewers only see approved requests from others', migration.includes("status='approved' and private.has_workspace_permission(workspace_id,'view_vacations')"));
check('Vacation approval is blocked without fresh AI analysis', migration.includes("new.status='approved'") && migration.includes('ai_analyzed_at is null') && migration.includes("ai_analysis='{}'::jsonb"));
check('Vacation approval is invalidated by newer work/planning', hasAll(migration, ['Assigned work changed after the vacation analysis','Sprint planning changed after the vacation analysis','Team availability changed after the vacation analysis']) && migration.includes("interval '12 hours'"));
check('Vacation AI invalidates when dates/owner change', migration.includes('new.start_date is distinct from old.start_date') && migration.includes('new.ai_analyzed_at:=null'));
check('Vacation impact assistant uses sprint/ticket workload', hasAll(vacation, ['affected_tickets','story_points','in_progress','simultaneous_absences']));
check('Vacation impact assistant default model is GPT-6.1 Sol', vacation.includes('gpt-6.1-sol'));
check('Vacation UI has calendar and out-today alert', hasAll(app, ['vacation-calendar-grid','outToday','Fuera hoy']));
check('Vacation UI blocks stale analysis and exposes notification filter', hasAll(app, ['analysisFresh','vacation-analysis-stale',"['vacations','lucide:calendar-off'",'vacation_requested','vacation_status']));

check('Shared input styling is applied to current surfaces', styles.includes(':where(.page,.modal,.workspace-panel') && hasAll(styles, ['input','select','textarea']));

const marker = '-- Jira Interno TROBBU v17.0';
const migrationTail = migration.slice(migration.indexOf(marker));
const databaseTail = database.slice(database.indexOf(marker));
check('Incremental migration matches database.sql v17.0 tail', migrationTail === databaseTail, `${crypto.createHash('sha256').update(migrationTail).digest('hex')} vs ${crypto.createHash('sha256').update(databaseTail).digest('hex')}`);
check('No unresolved merge markers in changed sources', ![app,migration,database,invite,manage,routing,knowledge,vacation,styles,index].some(t => /^(<<<<<<<|=======|>>>>>>>)/m.test(t)));

console.log(`\nQA summary: ${passed} passed, ${failures.length} failed.`);
if (failures.length) process.exit(1);
