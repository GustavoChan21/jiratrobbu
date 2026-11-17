import fs from 'node:fs';
import ts from '/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js';
const read=n=>fs.readFileSync(new URL(n,import.meta.url),'utf8');
const app=read('./app-v17.20.0.js'),css=read('./styles-v17.20.0.css'),sql=read('./upgrade-v17.20.0.sql'),db=read('./database.sql'),idx=read('./index.html'),proc=read('./process-notifications.ts'),qaSetup=read('./SENDPULSE-QA-SETUP.md'),ready=read('./SENDPULSE-PRODUCTION-READINESS-v17.20.md'),pkg=JSON.parse(read('./package.json'));
let pass=0,fail=0;const ck=(n,o,d='')=>{if(o){pass++;console.log('PASS ',n)}else{fail++;console.error('FAIL ',n,d)}};const has=(t,...xs)=>xs.every(x=>t.includes(x));const count=(t,x)=>t.split(x).length-1;

ck('Package version 17.20.0',pkg.version==='17.20.0');
ck('Index cache-busts 17.20 app/css',has(idx,'app-v17.20.0.js','styles-v17.20.0.css','v=17.20.0'));
ck('App release marker 17.20.0',app.startsWith('/* Jira Interno TROBBU v17.20.0'));
ck('Generic app/css copies match versioned build',read('./app.js')===app&&read('./styles.css')===css);
ck('No merge markers',![app,css,sql,db,proc,idx].some(t=>/^(<<<<<<<|=======|>>>>>>>)/m.test(t)));
ck('CSS braces balanced',count(css,'{')===count(css,'}'),`${count(css,'{')}/${count(css,'}')}`);
ck('Upgrade SQL transaction balanced',has(sql,'begin;','commit;')&&count(sql,'begin;')===count(sql,'commit;'));
ck('database.sql ends with v17.20 migration',db.trimEnd().endsWith(sql.trimEnd()));

ck('Exact sender alias is configured in processor',has(proc,'DEFAULT_SENDER_NAME = "Notificaciones Helpdesk x Jira"'));
ck('Exact sender alias is new DB default',has(sql,"set default 'Notificaciones Helpdesk x Jira'","set email_sender_name='Notificaciones Helpdesk x Jira'"));
ck('QA setup docs use exact sender alias',has(qaSetup,'Nombre: `Notificaciones Helpdesk x Jira`','SENDPULSE_FROM_NAME=Notificaciones Helpdesk x Jira'));
ck('Migration never disables QA mode',!sql.includes('email_qa_mode=false')&&!sql.includes('email_qa_mode = false'));

ck('Email event policy remains low-noise',has(proc,'const EMAIL_EVENTS','"daily_jira_reminder"','"helpdesk_assigned"','"helpdesk_comment"','"helpdesk_closed"','"ticket_closed"'));
ck('No mention email event added',!proc.match(/EMAIL_EVENTS[\s\S]{0,600}mention/));
ck('Helpdesk subject is canonical per folio',has(proc,'[Jira Interno] ${key} · Seguimiento Helpdesk'));
ck('Jira subject is canonical per folio',has(proc,'[Jira Interno] ${key} · Seguimiento Jira'));
ck('Action labels moved into body',has(proc,'Solicitud asignada','Nuevo comentario del solicitante','Nueva respuesta de seguimiento','Solicitud cerrada','Ticket cerrado'));
ck('Title changes do not drive Helpdesk/Jira thread subject',!proc.includes('subject=(key||"Helpdesk")')&&!proc.includes('subject=(key||"Ticket")+" · cerrado"'));

ck('QA banner is conditional',has(proc,'const qa = o.qa','? \'<div style="margin:0 0 20px'));
ck('Old fixed QA recipient display name removed',!proc.includes('name:"QA Jira Interno"')&&!proc.includes('name: "QA Jira Interno"'));
ck('Recipient profile name is loaded',has(proc,'.select("email,full_name")','intended.name'));
ck('Support email can populate Reply-To',has(proc,'email.reply_to','support_email','emailLike(s.support_email)'));
ck('Processor does not fake RFC threading headers',!proc.includes('email[\"In-Reply-To\"]')&&!proc.includes('email.in_reply_to')&&!proc.includes('email.references'));
ck('Processor declares canonical subject mode',has(proc,'threading_mode: "canonical_subject"','threading_rfc_guaranteed: false'));
ck('Production sender hard gate retained',has(proc,'!qa && !productionReady','production_sender_not_ready','sender?.preferredActive'));
ck('SMTP Test sender is detected',has(proc,'@sendpulseemail.com','test: sender.toLowerCase().endsWith'));
ck('QA physical recipient gate retained',has(proc,'qa ? qaTo','QA recipient gate rejected destination'));
ck('QA hourly limit retained',has(proc,'email_qa_hourly_limit','qaHourlyLimit'));
ck('General 45/hour safety default retained',has(proc,'Number(s.email_hourly_limit || 45)'));
ck('Monthly 11k safety default retained',has(proc,'Number(s.email_monthly_limit || 11000)'));
ck('Daily reminder yields to transactional quota',has(proc,'monthly_reserve_for_transactional_email','monthRemaining <= 100'));

const transpiled=ts.transpileModule(proc,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true});
const syntaxDiagnostics=(transpiled.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
ck('process-notifications TypeScript parses',syntaxDiagnostics.length===0,syntaxDiagnostics.map(d=>d.messageText).join('; '));
ck('Production readiness explicitly remains QA',has(ready,'NO habilitar todavía destinatarios productivos','email_qa_mode` debe permanecer en `true`','threading RFC garantizado'));

// Regression anchors from v17.19 release.
ck('Realtime wildcard remains present',has(app,"on('postgres_changes',{event:'*'","workspace-live-v2"));
ck('Audit exact metric RPC remains present',has(app,"db.rpc('get_audit_period_metrics'","actions_count"));
ck('Vacation workday calculation remains present',has(app,'const businessDaysInclusive=','nextBusinessDayKey'));
ck('Helpdesk multi filters remain present',has(app,'status:[],requestType:[],department:[],product:[],assignee:[],priority:[]'));
ck('Helpdesk-only mentions remain visible',has(app,"['mentioned','lucide:at-sign','Mencionados']"));
ck('DB final notification policy still limits email events',has(db,"v_email_type_allowed boolean:=p_type in ('daily_jira_reminder','helpdesk_assigned','helpdesk_comment','helpdesk_closed','ticket_closed')"));

console.log(`\n${pass} passed · ${fail} failed`);if(fail)process.exit(1);
