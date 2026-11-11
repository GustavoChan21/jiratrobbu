import fs from 'node:fs';
import crypto from 'node:crypto';

const read=name=>fs.readFileSync(new URL(name,import.meta.url),'utf8');
const app=read('./app.js');
const migration=read('./upgrade-v17.3.sql');
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
check('Package version is 17.3.1',pkg.version==='17.3.1');
check('QA npm script targets v17.3',pkg.scripts?.qa==='node qa-v17.3.mjs');
check('Frontend cache bust targets 17.3.1',index.includes('v=17.3.1')&&!index.includes('v=17.3.0'));
check('App release marker is v17.3.1',app.startsWith('/* Jira Interno TROBBU v17.3.1'));
check('Incremental v17.3 migration is the final database.sql block',database.endsWith(migration),crypto.createHash('sha256').update(migration).digest('hex'));
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
check('Category deletion reclassifies article history through RPC',hasAll(migration,['create or replace function public.delete_knowledge_category','update public.knowledge_articles set category_id=v_replacement','update public.knowledge_article_versions set category_id=v_replacement']));
check('System General category cannot be deleted',migration.includes("if v_cat.code='general' then raise exception"));
check('Category data is validated by database trigger',hasAll(migration,['private.guard_knowledge_category','trg_guard_knowledge_category','sort_order:=greatest']));
check('Every workspace receives General category',hasAll(migration,["'general','General'",'from public.workspaces w','on conflict(workspace_id,code) do update set active=true']));
check('Legacy articles without category are migrated to General',hasAll(migration,['update public.knowledge_articles a','where a.category_id is null',"c.code='general'"]));
check('Legacy versions without category are migrated',hasAll(migration,['update public.knowledge_article_versions v','where v.article_id=a.id and v.category_id is null']));
check('Article category becomes mandatory at database level',migration.includes('alter table public.knowledge_articles alter column category_id set not null'));
check('Version category becomes mandatory at database level',migration.includes('alter table public.knowledge_article_versions alter column category_id set not null'));
check('Reader and list preview receive category metadata',hasAll(app,['categories={knowledgeCategories}','category=categories.find','c=categories.find']));

// Atomic create/edit/version/publish flow
check('Initial article creation uses atomic RPC',app.includes("db.rpc('create_knowledge_initial_draft'"));
check('Atomic initial RPC inserts article and v1 in one database transaction scope',hasAll(migration,['create or replace function public.create_knowledge_initial_draft','insert into public.knowledge_articles','insert into public.knowledge_article_versions','update public.knowledge_articles set draft_version_id=v_version_id']));
check('Atomic RPC enforces create_knowledge',migration.includes("private.has_workspace_permission(p_workspace_id,'create_knowledge')"));
check('Atomic RPC rejects invalid category',migration.includes("raise exception 'Selecciona una categoría válida'"));
check('Draft save uses guarded update RPC',app.includes("db.rpc('update_knowledge_draft_version'"));
check('Draft update permits creator own initial draft but protects published content',hasAll(migration,["private.has_workspace_permission(v.workspace_id,'edit_knowledge')","a.created_by=(select auth.uid())","a.active_version_id is null"]));
check('Version creation flow remains available',hasAll(app,['createKnowledgeVersion','create_knowledge_draft_version','knowledge-new-version']));
check('Publishing flow remains available',hasAll(app,['publishKnowledgeVersion','publish_knowledge_version','Publicar versión']));
check('Publish copies content schema version to article shadow row',migration.includes('content_schema_version=v.content_schema_version'));
check('Media upload occurs only after atomic article exists',app.indexOf("db.rpc('create_knowledge_initial_draft'")<app.indexOf('const cleanBlocks=await uploadPending(article_id)'));
check('Partial media failure keeps safe draft recoverable',hasAll(app,['if(createdVersionId)','setKnowledgeScreen({mode:\'edit\',article,version})','El borrador se creó de forma segura']));
check('Unused media cleanup remains enabled',app.includes('cleanupUnusedKnowledgeMedia(existingArticle.id)'));
check('Slug duplicate has friendly validation message',app.includes('Ya existe un artículo con ese slug'));

// Important SECURITY INVOKER helper regression discovered in review
check('Block normalization helper is callable by authenticated SECURITY INVOKER RPC',migration.includes('grant execute on function private.normalize_knowledge_blocks_v3(jsonb,text) to authenticated'));
check('HTML escape helper is callable by authenticated normalizer',migration.includes('grant execute on function private.knowledge_escape_html(text) to authenticated'));
check('Public authoring RPCs remain SECURITY INVOKER',count(migration,'security invoker')>=5&&!/create or replace function public\.create_knowledge_initial_draft[\s\S]*?security definer/i.test(migration));

// Canonical block migration / backwards compatibility
check('Knowledge schema version 3 exists on articles',migration.includes('knowledge_articles add column if not exists content_schema_version smallint not null default 3'));
check('Knowledge schema version 3 exists on versions',migration.includes('knowledge_article_versions add column if not exists content_schema_version smallint not null default 3'));
check('Legacy paragraph/text migrates to richtext',hasAll(migration,["if v_type in ('paragraph','text')","'type','richtext'"]));
check('Legacy generic heading migrates to H2',hasAll(migration,["elsif v_type='heading'","'type','heading2'"]));
check('H1-H5 are preserved by migration',migration.includes("v_type in ('heading1','heading2','heading3','heading4','heading5')"));
check('Lists preserve ordered/unordered semantics',migration.includes("v_item->>'list_style'='ordered'"));
check('Quotes preserve author/source',migration.includes("'author',coalesce(v_item->>'author','')"));
check('Callouts preserve title and tone',hasAll(migration,["'title',coalesce(v_item->>'title','')","('info','success','warning','danger')"]));
check('Code blocks preserve language',migration.includes("'language',coalesce(nullif(v_item->>'language',''),'text')"));
check('Image blocks preserve media id, alt, caption and alignment',hasAll(migration,["'media_id',v_item->'media_id'","'alt'","'caption'","('left','center','right','wide')"]));
check('Video, divider and pagebreak blocks migrate',hasAll(migration,["elsif v_type='video'","v_type in ('divider','pagebreak')"]));
check('Existing article blocks are migrated in-place',migration.includes('update public.knowledge_articles\nset content_blocks=private.normalize_knowledge_blocks_v3'));
check('Existing version blocks are migrated in-place',migration.includes('update public.knowledge_article_versions\nset content_blocks=private.normalize_knowledge_blocks_v3'));
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
check('Rich text pasted HTML is sanitized',hasAll(app,['const onPaste=','sanitizeKnowledgeHtml(ref.current.innerHTML)']));
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
check('Rich editor never updates parent state on each input event',app.includes("const inputChanged=()=>{const raw=readSurface();draftHtmlRef.current=raw;updateStats(raw);saveSelection()}")&&!app.includes('queueCommit()')&&!app.includes('commitTimerRef'));
check('Rich editor persists on blur after continuous typing',app.includes('onBlur={()=>commit(true)}'));
check('Rich editor preserves selected ranges across toolbar interaction',hasAll(app,['rangeRef=useRef(null)','range.cloneRange()','restoreSelection()','onMouseDown={preserveSelection}']));
check('Rich editor formatting actions persist sanitized HTML',hasAll(app,['document.execCommand(cmd,false,value)','saveSelection();commit(false)','sanitizeKnowledgeHtml(readSurface())']));
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
check('Luxury cover is preserved by runtime and SQL normalizers',hasAll(app,["if(type==='cover')return",'knowledge-cover-rendered'])&&hasAll(migration,["elsif v_type='cover'","('forest','ivory','midnight')","'show_logo'","'page_break'"]));
check('Translation pipeline preserves luxury cover metadata and non-translated cover flags',hasAll(translate,['eyebrow','subtitle','meta','return {...b,','plainText'])&&translate.includes('b.type==="cover"'));
check('No separate v17.3.1 migration/QA/release files are introduced by patch',!fs.existsSync(new URL('./upgrade-v17.3.1.sql',import.meta.url))&&!fs.existsSync(new URL('./QA-v17.3.1.md',import.meta.url))&&!fs.existsSync(new URL('./RELEASE-v17.3.1.md',import.meta.url)));

// Category / editor UI stability
check('Knowledge search remains a single visual input',hasAll(styles,['.knowledge-toolbar-expanded .knowledge-search input','border:0!important','box-shadow:none!important']));
check('Category cards are responsive',hasAll(styles,['.knowledge-category-grid','repeat(auto-fit,minmax(240px,1fr))','@media(max-width:620px)']));
check('Editor toolbar is responsive',hasAll(styles,['.knowledge-rich-toolbar{','overflow-x:auto','flex-wrap:nowrap']));
check('Global input styles cannot double rich editor toolbar controls',hasAll(styles,['.knowledge-rich-toolbar select','border:0!important','box-shadow:none!important']));

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
check('Vacation impact assistant still consumes date_blocks',hasAll(vacation,['function blocksFor','date_blocks:blocks']));
check('v17.1 vacation migration remains in package history',migration171.includes('date_blocks'));

console.log(`\nQA v17.3.1 summary: ${passed} passed, ${failures.length} failed.`);
if(failures.length){for(const f of failures)console.error(` - ${f.name}${f.detail?`: ${f.detail}`:''}`);process.exit(1)}
