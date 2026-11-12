import fs from 'node:fs';
import crypto from 'node:crypto';

const read=name=>fs.readFileSync(new URL(name,import.meta.url),'utf8');
const app=read('./app.js');
const migration=read('./upgrade-v17.5.sql');
const database=read('./database.sql');
const styles=read('./styles.css');
const index=read('./index.html');
const pkg=JSON.parse(read('./package.json'));
const knowledgeAI=read('./trobbu-knowledge-assistant.ts');
const translate=read('./translate-knowledge-version.ts');
const routing=read('./auto-assign-helpdesk.ts');
const vacation=read('./vacation-impact-assistant.ts');
const migration171=read('./upgrade-v17.1.sql');

let passed=0;const failures=[];
const check=(name,ok,detail='')=>{if(ok){passed++;console.log(`PASS  ${name}`)}else{failures.push({name,detail});console.error(`FAIL  ${name}${detail?` — ${detail}`:''}`)}};
const hasAll=(text,items)=>items.every(x=>text.includes(x));
const count=(text,needle)=>text.split(needle).length-1;

// Release integrity
check('Package version is 17.5.3',pkg.version==='17.5.3');
check('QA npm script targets v17.5',pkg.scripts?.qa==='node qa-v17.5.mjs');
check('Frontend cache bust targets 17.5.3',index.includes('v=17.5.3')); 
check('App release marker is v17.5.3',app.startsWith('/* Jira Interno TROBBU v17.5.3')); 
check('Incremental v17.5 migration is the final database.sql block',database.endsWith(migration),crypto.createHash('sha256').update(migration).digest('hex'));
check('No unresolved merge markers',![app,migration,database,styles,index,knowledgeAI,translate].some(t=>/^(<<<<<<<|=======|>>>>>>>)/m.test(t)));
check('SQL dollar quotes are balanced',count(migration,'$$')%2===0);
check('CSS braces are balanced',count(styles,'{')===count(styles,'}'),`${count(styles,'{')} / ${count(styles,'}')}`);

// Exact blank-screen regression
check('React hook import includes useRef used by Knowledge editor',/^const \{[^\n]*\buseRef\b[^\n]*\} = React/m.test(app));
check('Knowledge has a module Error Boundary',hasAll(app,['class KnowledgeModuleErrorBoundary extends React.Component','getDerivedStateFromError','Knowledge encontró un error de visualización']));
check('Knowledge list is wrapped by its Error Boundary',app.includes("view==='knowledge' && canViewKnowledge && <KnowledgeModuleErrorBoundary"));
check('Knowledge editor/read/preview screen is wrapped by its Error Boundary',app.includes('<KnowledgeModuleErrorBoundary key={`knowledge-screen:'));

// Category-first Knowledge UX + CRUD
check('Knowledge category-first home exists',hasAll(app,['knowledge-categories-panel','knowledge-category-grid','Primero clasifica la información']));
check('Category cards create articles in that category',app.includes('title={`Crear artículo en ${cat.name}`}')&&app.includes('onClick={()=>onCreate?.(cat.id)}'));
check('Global article action requires a selected category',app.includes('action={selected&&canCreate?'));
check('New article editor receives category context',app.includes('initialCategoryId={knowledgeScreen.categoryId||null}'));
check('Article editor requires a category',hasAll(app,['<label>Categoría<select required','Selecciona una categoría para el artículo.']));
check('Category create modal exists',hasAll(app,['function KnowledgeCategoryModal','Nueva categoría','Crear categoría']));
check('Category update modal exists',app.includes("modal.type==='knowledge-category-edit'"));
check('Category delete modal exists',hasAll(app,['function KnowledgeCategoryDeleteModal','Mover contenido a',"modal.type==='knowledge-category-delete'"]));
check('Category deletion reclassifies article history through RPC',hasAll(database,['create or replace function public.delete_knowledge_category','update public.knowledge_articles set category_id=v_replacement','update public.knowledge_article_versions set category_id=v_replacement']));
check('System General category cannot be deleted',database.includes("if v_cat.code='general' then raise exception"));
check('Category data is validated by database trigger',hasAll(database,['private.guard_knowledge_category','trg_guard_knowledge_category','sort_order:=greatest']));
check('Every workspace receives General category',hasAll(database,["'general','General'",'from public.workspaces w','on conflict(workspace_id,code) do update set active=true']));
check('Legacy articles without category are migrated to General',hasAll(database,['update public.knowledge_articles a','where a.category_id is null',"c.code='general'"]));
check('Legacy versions without category are migrated',hasAll(database,['update public.knowledge_article_versions v','where v.article_id=a.id and v.category_id is null']));
check('Article category becomes mandatory at database level',database.includes('alter table public.knowledge_articles alter column category_id set not null'));
check('Version category becomes mandatory at database level',database.includes('alter table public.knowledge_article_versions alter column category_id set not null'));
check('Reader and list preview receive category metadata',hasAll(app,['categories={knowledgeCategories}','category=categories.find','c=categories.find']));

// Atomic create/edit/version/publish flow
check('Initial article creation uses atomic RPC',app.includes("db.rpc('create_knowledge_initial_draft'"));
check('Atomic initial RPC inserts article and v1 in one database transaction scope',hasAll(database,['create or replace function public.create_knowledge_initial_draft','insert into public.knowledge_articles','insert into public.knowledge_article_versions','update public.knowledge_articles set draft_version_id=v_version_id']));
check('Atomic RPC enforces create_knowledge',database.includes("private.has_workspace_permission(p_workspace_id,'create_knowledge')"));
check('Atomic RPC rejects invalid category',database.includes("raise exception 'Selecciona una categoría válida'"));
check('Draft save uses guarded update RPC',app.includes("db.rpc('update_knowledge_draft_version'"));
check('Draft update permits creator own initial draft but protects published content',hasAll(database,["private.has_workspace_permission(v.workspace_id,'edit_knowledge')","a.created_by=(select auth.uid())","a.active_version_id is null"]));
check('Version creation flow remains available',hasAll(app,['createKnowledgeVersion','create_knowledge_draft_version','knowledge-new-version']));
check('Publishing flow remains available',hasAll(app,['publishKnowledgeVersion','publish_knowledge_version','Publicar versión']));
check('Publish copies content schema version to article shadow row',database.includes('content_schema_version=v.content_schema_version'));
check('Media upload occurs only after atomic article exists',app.indexOf("db.rpc('create_knowledge_initial_draft'")<app.indexOf('const cleanBlocks=await uploadPending(article_id)'));
check('Partial media failure keeps safe draft recoverable',hasAll(app,['if(createdVersionId)','setKnowledgeScreen({mode:\'edit\',article,version})','El borrador se creó de forma segura']));
check('Unused media cleanup remains enabled',app.includes('cleanupUnusedKnowledgeMedia(existingArticle.id)'));
check('Slug duplicate has friendly validation message',app.includes('Ya existe un artículo con ese slug'));

// Important SECURITY INVOKER helper regression discovered in review
check('Block normalization helper is callable by authenticated SECURITY INVOKER RPC',database.includes('grant execute on function private.normalize_knowledge_blocks_v3(jsonb,text) to authenticated'));
check('HTML escape helper is callable by authenticated normalizer',database.includes('grant execute on function private.knowledge_escape_html(text) to authenticated'));
check('Public authoring RPCs remain SECURITY INVOKER',count(database,'security invoker')>=5&&/create or replace function public\.create_knowledge_initial_draft[\s\S]{0,900}?security invoker/i.test(database));

// Canonical block migration / backwards compatibility
check('Knowledge schema version 3 exists on articles',database.includes('knowledge_articles add column if not exists content_schema_version smallint not null default 3'));
check('Knowledge schema version 3 exists on versions',database.includes('knowledge_article_versions add column if not exists content_schema_version smallint not null default 3'));
check('Legacy paragraph/text migrates to richtext',hasAll(database,["if v_type in ('paragraph','text')","'type','richtext'"]));
check('Legacy generic heading migrates to H2',hasAll(database,["elsif v_type='heading'","'type','heading2'"]));
check('H1-H5 are preserved by migration',database.includes("v_type in ('heading1','heading2','heading3','heading4','heading5')"));
check('Lists preserve ordered/unordered semantics',database.includes("v_item->>'list_style'='ordered'"));
check('Quotes preserve author/source',database.includes("'author',coalesce(v_item->>'author','')"));
check('Callouts preserve title and tone',hasAll(database,["'title',coalesce(v_item->>'title','')","('info','success','warning','danger')"]));
check('Code blocks preserve language',database.includes("'language',coalesce(nullif(v_item->>'language',''),'text')"));
check('Image blocks preserve media id, alt, caption and alignment',hasAll(database,["'media_id',v_item->'media_id'","'alt'","'caption'","('left','center','right','wide')"]));
check('Video, divider and pagebreak blocks migrate',hasAll(database,["elsif v_type='video'","v_type in ('divider','pagebreak')"]));
check('Existing article blocks are migrated in-place',database.includes('update public.knowledge_articles\nset content_blocks=private.normalize_knowledge_blocks_v3'));
check('Existing version blocks are migrated in-place',database.includes('update public.knowledge_article_versions\nset content_blocks=private.normalize_knowledge_blocks_v3'));
check('Runtime still converts old paragraph/text blocks',app.includes("if(type==='paragraph'||type==='text')return"));
check('Runtime unknown blocks degrade safely to richtext',app.includes("return {id,type:'richtext',html:`<p>${escapeKnowledgeText(b.text||'')}</p>`"));

// Word-like rich text block
check('Word-like rich text toolbar exists',hasAll(app,['Herramientas del bloque de texto','knowledge-rich-toolbar','knowledge-rich-surface','knowledge-rich-footer']));
check('Rich text supports style hierarchy Normal + H1-H5',hasAll(app,['Normal','Título H1','Título H2','Título H3','Título H4','Título H5']));
check('Rich text supports multiple font families',hasAll(app,['Inter','Arial','Verdana','Georgia','Times New Roman','Courier New']));
check('Rich text supports explicit font sizes 11-32px',hasAll(app,['11 px','12 px','14 px','16 px','18 px','24 px','32 px']));
check('Rich text supports undo/redo',hasAll(app,["command('undo')","command('redo')"]));
check('Rich text supports bold italic underline strike',hasAll(app,["command('bold')","command('italic')","command('underline')","command('strikeThrough')"]));
check('Rich text supports text and highlight colors',hasAll(app,["command('foreColor'","command('hiliteColor'",'knowledge-color-tool']));
check('Rich text sanitizer preserves browser RGB colors safely',app.includes("const m=raw.match(/^rgba?\\("));
check('Rich text supports numbered/bulleted lists',hasAll(app,["command('insertOrderedList')","command('insertUnorderedList')"]));
check('Rich text supports indentation',hasAll(app,["command('outdent')","command('indent')"]));
check('Rich text supports left/center/right/justify',hasAll(app,["command('justifyLeft')","command('justifyCenter')","command('justifyRight')","command('justifyFull')"]));
check('Rich text supports links and unlink',hasAll(app,['applyLink',"command('unlink')",'mailto:','tel:']));
check('Rich text supports remove formatting',app.includes("command('removeFormat')"));
check('Rich text supports line height',hasAll(app,['Interlineado:','1.15','1.3','1.5','1.75','Doble']));
check('Rich text reports word/character statistics without React state churn',hasAll(app,['statsRef','palabras · ${text.length} caracteres','<span ref={statsRef}>0 palabras · 0 caracteres</span>']));
check('Rich text pasted HTML is sanitized',hasAll(app,['const handlePaste=e=>','sanitizeKnowledgeHtml(htmlData||escapeKnowledgeText(textData))',"document.execCommand('insertHTML'"]));
check('Rich text CSS matches Word-like card/tool/footer structure',hasAll(styles,['.knowledge-rich-toolbar','.knowledge-rich-surface{min-height:270px','.knowledge-rich-footer','.knowledge-block-head']));

// Individual block functionality
check('Block toolbar can add Text',app.includes("onClick={()=>add('richtext')}"));
check('Block toolbar can add H1-H5 titles',hasAll(app,["const KNOWLEDGE_HEADING_PRESETS=[","{type:'heading1'","{type:'heading5'","KNOWLEDGE_HEADING_PRESETS.map(x=><option","add(e.target.value)"]));
check('Heading block can change H1-H5 after creation',app.includes("onChange={e=>patch(b.id,{type:e.target.value})}"));
check('Block toolbar can add list/quote/callout/code',hasAll(app,["add('list')","add('quote')","add('callout')","add('code')"]));
check('Block toolbar can add image/video',hasAll(app,["add('image')","add('video')"]));
check('Block toolbar can add visual divider and page break',hasAll(app,["add('divider')","add('pagebreak')"]));
check('Blocks can be reordered by drag and buttons',hasAll(app,['draggable','moveBefore','lucide:chevron-up','lucide:chevron-down']));
check('Blocks can be deleted individually',app.includes('onClick={()=>remove(b.id)}'));
check('List block has ordered/unordered selection',hasAll(app,['list_style','Viñetas','Numerada']));
check('Quote block has author/source',hasAll(app,['Autor / fuente','author:e.target.value']));
check('Callout supports info/success/warning/danger',hasAll(app,['Información','Éxito','Advertencia','Crítico']));
check('Code block has language and code body',hasAll(app,['Lenguaje','javascript, sql, bash','spellCheck="false"']));
check('Image block has alt/caption/alignment',hasAll(app,['Texto alternativo','Pie de imagen','Alineación','Ancho completo']));
check('Image block keeps compression flow',hasAll(app,['compressEvidenceImage','Máximo 15 MB original','1920 px','WebP']));
check('Video block validates YouTube/Vimeo',hasAll(app,['knowledgeVideoEmbed','Solo se admiten URLs válidas de YouTube o Vimeo']));
check('Pagebreak is printable as a real page break',hasAll(styles,['break-after:page','page-break-after:always']));
check('Rendered blocks cover every editable block family',hasAll(app,['knowledge-rich-rendered','<h1>{b.text}</h1>','<blockquote>','knowledge-callout','knowledge-code-rendered','knowledge-rendered-image','knowledge-video','knowledge-page-break']));

// v17.3.1 continuous-editing regression and executive output
check('Rich editor input stays outside React state',app.includes("const handleInput=()=>{const raw=el.innerHTML;draftHtmlRef.current=normalizeEditorHtml(raw)")&&!/handleInput=.*onChangeRef/.test(app));
check('Rich editor persists on blur after continuous typing',hasAll(app,["const handleBlur=()=>commit(true)","el.addEventListener('blur',handleBlur)"]));
check('Rich editor preserves selected ranges across toolbar interaction',hasAll(app,['rangeRef=useRef(null)','range.cloneRange()','restoreSelection()','onMouseDown={preserveSelection}']));
check('Rich editor formatting actions persist sanitized HTML',hasAll(app,['document.execCommand(cmd,false,value)','saveSelection();commit(false)','normalizeEditorHtml(readSurface())']));
check('Partial selection supports bold italic underline and links',hasAll(app,["command('bold')","command('italic')","command('underline')","document.execCommand('createLink'","command('unlink')"]));
check('Rich text sanitizer preserves font tags and per-selection styling',hasAll(app,["'SPAN','FONT'","child.tagName==='FONT'","font-size:${size[1]}px","font-family:${face}"]));
check('Canonical heading presets are fixed to 32/28/24/20/16px',hasAll(app,["label:'H1',size:32","label:'H2',size:28","label:'H3',size:24","label:'H4',size:20","label:'H5',size:16"]));
check('Canonical heading CSS matches presets in editor/reader',hasAll(styles,['font-size:32px!important','font-size:28px!important','font-size:24px!important','font-size:20px!important','font-size:16px!important']));
check('Editor tracks saved snapshot and unsaved changes',hasAll(app,['knowledgeEditorSnapshot','savedSnapshot','dirtyRef.current','Cambios sin guardar']));
check('Browser close/reload is protected when Knowledge is dirty',hasAll(app,["window.addEventListener('beforeunload',before)","e.returnValue=''"]));
check('Knowledge exit confirmation has requested warning and actions',hasAll(app,['¿Estás seguro de salir?','Los cambios realizados se perderán.','Te sugerimos guardar este borrador antes de salir.','Salir y descartar','Continuar editando']));
check('Sidebar/mobile/workspace navigation respects Knowledge dirty guard',hasAll(app,['window.__jiraKnowledgeEditorGuard','runWithKnowledgeGuard','setView={navigateView}']));
check('Luxury cover block can be added only once',hasAll(app,["add('cover')",'hasCover','Solo se admite una portada por artículo']));
check('Luxury cover includes three executive TROBBU templates',hasAll(app,["value:'forest',label:'TROBBU Verde'","value:'ivory',label:'Marfil'","value:'midnight',label:'Azul Ejecutivo'"]));
check('Luxury cover fields are editable and printable',hasAll(app,['Título de portada','Subtítulo','Pie / clasificación','Mostrar marca TROBBU','Iniciar contenido en página siguiente al imprimir/PDF','window.print()']));
check('Luxury cover is preserved by runtime and SQL normalizers',hasAll(app,["if(type==='cover')return",'knowledge-cover-rendered'])&&hasAll(database,["elsif v_type='cover'","('forest','ivory','midnight')","'show_logo'","'page_break'"]));
check('Translation pipeline preserves luxury cover metadata and non-translated cover flags',hasAll(translate,['eyebrow','subtitle','meta','return {...b,','plainText'])&&translate.includes('b.type==="cover"'));
check('Project file count remains exactly 101',fs.readdirSync(new URL('.',import.meta.url),{recursive:true}).filter(x=>fs.statSync(new URL(x,import.meta.url)).isFile()).length===101);

// Category / editor UI stability
check('Knowledge search remains a single visual input',hasAll(styles,['.knowledge-toolbar-expanded .knowledge-search input','border:0!important','box-shadow:none!important']));
check('Category cards are responsive',hasAll(styles,['.knowledge-category-grid','repeat(auto-fit,minmax(240px,1fr))','@media(max-width:620px)']));
check('Editor toolbar is responsive',hasAll(styles,['.knowledge-rich-toolbar{','overflow-x:auto','flex-wrap:nowrap']));
check('Global input styles cannot double rich editor toolbar controls',hasAll(styles,['.knowledge-rich-toolbar select','border:0!important','box-shadow:none!important']));

// v17.5 native editor, modal consistency and configurable covers
check('Rich text surface is created imperatively and owned by native DOM',hasAll(app,["document.createElement('div')","host.replaceChildren(el)","surfaceRef.current=el"]));
check('React only renders the rich editor host, not the contentEditable node',app.includes("ref={hostRef} className={`knowledge-rich-surface-host ${safeWriting?'is-hidden':''}`}")&&!app.includes('<div ref={hostRef} contentEditable'));
check('Native rich editor registers and removes all lifecycle listeners',hasAll(app,["addEventListener('input',handleInput)","addEventListener('keyup',saveSelection)","addEventListener('paste',handlePaste)","removeEventListener('input',handleInput)","removeEventListener('blur',handleBlur)"]));
check('Live rich HTML is retained for Save while editor remains focused',hasAll(app,['liveRichHtmlRef=useRef(new Map())','blocksWithLiveHtml','noteRichInput','normalizeKnowledgeBlocks(blocksWithLiveHtml(blocks))']));
check('Preview consumes unsaved live rich HTML',app.includes('blocks={blocksWithLiveHtml(blocks)}'));
check('Dirty state includes live native typing',hasAll(app,['liveTypingDirtyRef.current=true','const dirty=liveTypingDirtyRef.current||currentSnapshot!==savedSnapshot']));
check('Rich sanitizer preserves span bold/italic/underline/strike styles',hasAll(app,['font-weight:${weight.toLowerCase()}','font-style:italic','text-decoration:underline','text-decoration:line-through']));
check('Rich sanitizer allows safe links only',hasAll(app,["/^(https?:|mailto:|tel:)/i.test(href)","rel','noopener noreferrer"]));
check('Native editor blocks direct file drops into text',app.includes("const handleDrop=e=>{if(e.dataTransfer?.files?.length)e.preventDefault()}"));
check('Knowledge exit warning uses standard form-body and form-footer modal rhythm',hasAll(app,['form-body knowledge-exit-body','form-footer static-footer','Salir y descartar','Continuar editando']));
check('Knowledge exit modal spacing uses system-compatible CSS',hasAll(styles,['.knowledge-exit-body','max-height:none!important','knowledge-exit-warning{padding:14px 15px!important']));
check('Workspace has global Knowledge cover template settings',hasAll(app,['DEFAULT_KNOWLEDGE_COVER_SETTINGS','normalizeKnowledgeCoverSettings','knowledge_cover_templates']));
check('Cover settings support colors and fonts per template',hasAll(app,['background_alt','title_font','body_font','Fuente del título','Fuente del contenido']));
check('Settings page exposes dedicated Knowledge cover section',hasAll(app,['knowledge-cover-overview','Plantillas de portada Knowledge','Configurar portadas','knowledge-cover-overview-grid']));
check('Cover settings page renders live three-template previews',hasAll(app,['KNOWLEDGE_COVER_TEMPLATES.map','knowledge-cover-setting-preview','knowledgeCoverStyle(coverSettings,t.value)']));
check('Cover settings modal includes reset and color controls',hasAll(app,['resetCoverTemplates','Restablecer','type="color"','setCover(t.value']));
check('Cover visual settings persist in workspace_settings',migration.includes('add column if not exists knowledge_cover_templates jsonb not null default'));
check('Cover migration preserves custom values while filling defaults',hasAll(migration,['Preserve custom values','coalesce(ws.knowledge_cover_templates','jsonb_build_object']));
check('Existing articles are re-normalized in v17.5 migration',migration.includes('update public.knowledge_articles\nset content_blocks=private.normalize_knowledge_blocks_v3'));
check('Existing article versions are re-normalized in v17.5 migration',migration.includes('update public.knowledge_article_versions\nset content_blocks=private.normalize_knowledge_blocks_v3'));
check('Cover CSS is parameterized with CSS variables',hasAll(styles,['--cover-bg-start','--cover-bg-end','--cover-text','--cover-accent','--cover-title-font','--cover-body-font']));
check('Cover settings overview is responsive',hasAll(styles,['.knowledge-cover-overview-grid','repeat(3,minmax(0,1fr))','@media(max-width:900px){.knowledge-cover-overview-grid{grid-template-columns:1fr}']));


check('Empty rich editor starts with a real paragraph scaffold',hasAll(app,["el.innerHTML=initial||'<p><br></p>'","ensureScaffold(true)","handleBeforeInput"]));
check('Empty-state placeholder no longer depends on CSS :empty',hasAll(styles,['.knowledge-rich-surface[data-empty="true"]:before','.knowledge-rich-surface:empty:before{content:none!important}']));
check('Direct typing path does not update React state on input',app.includes("const handleInput=()=>{const raw=el.innerHTML;draftHtmlRef.current=normalizeEditorHtml(raw)")&&!app.includes('handleInput=()=>{setBlocks')&&!app.includes('handleInput=()=>{setSafeWriting'));
check('Safe writing fallback exists for browser-specific blank-editor issues',hasAll(app,['Modo escritura segura','Escritura segura','Pasar a modo formato','knowledge-safe-writing-area']));
check('Safe writing uses textarea and preserves line breaks before rich formatting',hasAll(app,['el?.innerText||stripKnowledgeHtml(clean)','escapeKnowledgeText(value)','setSafeWriting(false)']));
check('Safe writing updates live draft before switching to format mode',hasAll(app,['const updateSafeWriting=value=>','onLiveInputRef.current?.(next)','onChange={e=>updateSafeWriting(e.target.value)}']));
check('Knowledge author Exit action is aligned with preview/save/publish actions',hasAll(app,['knowledge-exit-action','<Icon name="lucide:log-out"/>Salir','knowledge-author-actions']));
check('Legacy top Back to Knowledge button was removed from author header',!app.includes('knowledge-back-button" onClick={()=>requestExit(onBack)}'));
check('Responsive author actions remain usable on small screens',hasAll(styles,['.knowledge-author-actions{display:flex','.knowledge-author-actions{display:grid;grid-template-columns:1fr 1fr','.knowledge-author-actions{grid-template-columns:1fr}']));

// v17.5.3 Vacations workflow, advisory AI, prioritized requests and Realtime
check('Vacation migration is self-contained for missing date_blocks',hasAll(migration,["add column if not exists return_date date","add column if not exists date_blocks jsonb","date_blocks=case when jsonb_typeof(date_blocks)='array'"]));
check('Legacy vacation guard is detached before historical backfill and recreated after counters',migration.indexOf('drop trigger if exists trg_guard_vacation_request on public.vacation_requests')<migration.indexOf('update public.vacation_requests\nset return_date=')&&migration.lastIndexOf('create trigger trg_guard_vacation_request')>migration.indexOf('-- Backfill authoritative counters'));
check('Vacation requests can contain a minimum one-day block',hasAll(app,['Se permite un mínimo de 1 día','min={b.start_date||today}'])&&migration.includes("if v_start is null or v_end is null or v_end<v_start"));
check('Legacy 60-day request constraint is removed before block validation',hasAll(migration,["pg_get_constraintdef(oid) ilike '%end_date%start_date%60%'","drop constraint"]));
check('Vacation type CRUD table exists with RLS',hasAll(migration,['create table if not exists public.vacation_types','alter table public.vacation_types enable row level security','vacation_types_insert','vacation_types_update','vacation_types_delete']));
check('Default vacation types include vacation, compensation, half-day and sickness',hasAll(migration,["'vacation','Vacaciones'","'compensation','Compensación'","'half_day','Medio día'","'sickness','Enfermedad'"]));
check('Vacation types configure whether they deduct annual balance',hasAll(migration,['deducts_from_balance boolean','day_fraction numeric','requires_half_day_period boolean'])&&app.includes('Descontar del total de vacaciones disponibles'));
check('Half-day requests require first or second half',hasAll(app,['Primera mitad del día','Segunda mitad del día'])&&migration.includes("new.half_day_period not in ('first_half','second_half')"));
check('Vacation balance table stores allowed days and manual used adjustment',hasAll(migration,['create table if not exists public.vacation_balances','allowed_days numeric','adjustment_used_days numeric']));
check('Vacation balance RLS restricts writes to manage_vacations',hasAll(migration,['vacation_balances_insert','vacation_balances_update','vacation_balances_delete',"private.has_workspace_permission(workspace_id,'manage_vacations')"]));
check('Server trigger calculates absence and charged days',hasAll(migration,['new.absence_days:=v_calendar_days*v_type.day_fraction','new.charged_days:=case when v_type.deducts_from_balance then new.absence_days else 0 end']));
check('Server trigger blocks requests over annual balance',hasAll(migration,['v_existing+v_adjustment+v_requested>v_allowed','Saldo insuficiente para']));
check('Occupied balance counts pending and approved deductible requests',hasAll(app,["['pending','approved'].includes(r.status)",'{deductOnly:true}'])&&migration.includes("vr.status in ('pending','approved') and vt.deducts_from_balance=true"));
check('Vacation UI shows allowed, occupied, manual adjustment and available counters',hasAll(app,['Vacaciones permitidas','Días ocupados','Ajuste de días usados','Días disponibles']));
check('Vacation admin control exposes per-member balances',hasAll(app,['Control de vacaciones por integrante','Permitidos','Ocupados','Ajuste usado','Disponibles','Ajustar']));
check('Non-deducting types retain their own usage counters',hasAll(app,['const typeUsage=','myTypeUsage=typeUsage(session.user.id,currentYear)','vacation-type-counters']));
check('Vacation type CRUD exists in UI',hasAll(app,['Tipos de vacaciones / ausencias','Nuevo tipo','saveType','removeType','Tipo activo']));
check('Request form selects absence type and half-day period',hasAll(app,['Tipo de ausencia','Mitad del día','requestTypeId','halfDayPeriod']));
check('Removed multi-block IA informational alert',!app.includes('La IA evaluará el impacto de todos los bloques como una sola solicitud'));
check('Vacation timeline desktop controls use one five-column row',styles.includes('grid-template-columns:minmax(160px,1fr) minmax(150px,.8fr) auto auto auto'));
check('Vacation timeline stacks controls responsively on small screens',styles.includes('@media(max-width:760px)')&&styles.includes('.vacation-timeline-controls{grid-template-columns:1fr!important'));
check('Vacation impact assistant reads configured vacation type',hasAll(vacation,["from('vacation_types')",'vacation_type_id','charged_days','half_day_period']));
check('Vacation impact duration uses absence_days when available',vacation.includes('Number(vac.absence_days||0)'));
check('Database canonical schema ends with current v17.5.3 migration',database.endsWith(migration));
check('v17.5.3 keeps exact project file count of 101',fs.readdirSync(new URL('.',import.meta.url),{recursive:true}).filter(x=>fs.statSync(new URL(x,import.meta.url)).isFile()).length===101);

// v17.5.3 workflow/realtime regressions
check('Vacation Analyze sends request_id and legacy fallback identifiers',hasAll(app,["request_id:r.id","workspace_id:r.workspace_id||workspace.id","user_id:r.user_id","start_date:vacationStart(r)","end_date:vacationEnd(r)"]));
check('Vacation Edge Function is request-centric and no longer requires four identifiers',vacation.includes("const requestId=String(body?.request_id||'')")&&!vacation.includes('workspace_id, user_id, start_date and end_date are required'));
check('Vacation request metrics are interactive filters',hasAll(app,["onClick={()=>setRequestFilter('today')}","onClick={()=>setRequestFilter('pending')}","onClick={()=>setRequestFilter('upcoming')}","onClick={()=>setRequestFilter('mine')}"]));
check('Vacation request tabs include priority views and Ver todo',hasAll(app,["['pending','Pendientes'","['today','Fuera hoy'","['upcoming','Aprobadas próximas'","['mine','Mis solicitudes'","['all','Ver todo'"]));
check('Vacation requests panel is rendered before balance panel',app.indexOf('vacation-requests-primary')>0&&app.indexOf('vacation-requests-primary')<app.indexOf('vacation-balance-panel'));
check('Monthly absence calendar was removed from Vacations UI',!app.includes('Calendario de ausencias'));
check('Vacation approval is not disabled by AI state',app.includes("onClick={()=>setDecision({item:r,status:'approved'})}")&&!app.includes('Análisis requerido para aprobar'));
check('Database explicitly treats AI as advisory only',migration.includes('IA is advisory only. Approval never depends on an analysis existing or being fresh.')&&!migration.includes('Analyze sprint impact before approving vacations'));
check('Decimal vacation balances accept dot or comma and half-day rounding',hasAll(app,["replace(',','.')",'Math.round(n*2)/2','inputMode="decimal"']));
check('Balance database columns retain two decimal places',hasAll(migration,['allowed_days type numeric(7,2)','adjustment_used_days type numeric(7,2)']));
check('Vacation metadata tables are published to Supabase Realtime',hasAll(migration,["array['vacation_requests','vacation_types','vacation_balances']",'alter publication supabase_realtime add table']));
check('Vacation tables use FULL replica identity for realtime payloads',hasAll(migration,['vacation_requests replica identity full','vacation_types replica identity full','vacation_balances replica identity full']));
check('Frontend realtime channel subscribes vacation requests/types/balances',hasAll(app,["'vacation_requests','vacation_types','vacation_balances'",'workspace-live-${workspace.id}']));
check('Realtime fallback polling activates only while websocket is unhealthy',hasAll(app,["status==='SUBSCRIBED'","['CHANNEL_ERROR','TIMED_OUT','CLOSED']",'if(!realtimeHealthy)queueRefresh()','15000']));
check('PostgREST schema reload is requested by current migration',migration.includes("notify pgrst, 'reload schema';"));

// Knowledge assistant semantic regression retained
check('Knowledge Assistant requires meaningful description context',app.includes('subject.length<3||detail.length<12'));
check('Knowledge AI searches full article content',knowledgeAI.includes('String(a.content||"").slice(0,40000)'));
check('Knowledge AI downweights generic create/admin/panel/profile terms',hasAll(knowledgeAI,['const GENERIC=new Set','"crear"','"admin"','"panel"','"perfil"']));
check('Knowledge AI requires matched anchors',hasAll(knowledgeAI,['a.matchedAnchors.length>0','a.anchorCoverage>=.34']));
check('Knowledge AI can return zero suggestions',hasAll(knowledgeAI,['relevance >= 0.68','articles:[]']));
check('Translation flow still carries content_blocks',hasAll(translate,['content_blocks','mergeBlocks']));

// Cross-module smoke regressions requested in previous cycle
check('Manual Helpdesk autoassignment still exists',hasAll(app,['Autoasignar pendientes','autoAssignExistingHelpdesk','manual_trigger:true']));
check('Helpdesk counters still derive from shared filtered base',app.includes('const counterBase=allItems.filter(h=>helpdeskMatchesFilters(h,filters,false))'));
check('Shared Kanban/Table assignee selector still exists',hasAll(app,['function TicketAssigneeSelect','variant="kanban"','variant="table"']));
check('Ticket relationship search remains available',hasAll(app,['function TicketRelationPicker','Buscar por clave, título, producto o estado']));
check('Gantt responsive five-control layout remains available',hasAll(styles,['.gantt-controls-v14','grid-template-columns:minmax(170px,.85fr)','@media(max-width:900px)']));
check('Vacation multiple-block request model remains available',hasAll(app,['Fecha de reincorporación','Agregar bloque','requestBlocks.length>=8']));
check('Vacation timeline ranges remain available',hasAll(app,['value="1w">1 semana','value="8w">8 semanas','value="6m">6 meses']));
check('Helpdesk routing still excludes approved absence blocks',hasAll(routing,['function vacationBlocks','function absentOn','date_blocks']));
check('Vacation impact assistant still consumes date_blocks',hasAll(vacation,['const blocksFor=','date_blocks:blocks']));
check('v17.1 vacation migration remains in package history',migration171.includes('date_blocks'));

console.log(`\nQA v17.5.3 summary: ${passed} passed, ${failures.length} failed.`);
if(failures.length){for(const f of failures)console.error(` - ${f.name}${f.detail?`: ${f.detail}`:''}`);process.exit(1)}
