import fs from 'node:fs';
import crypto from 'node:crypto';

const read=name=>fs.readFileSync(new URL(name,import.meta.url),'utf8');
const app=read('./app.js');
const migration=read('./upgrade-v17.5.sql');
const repair=read('./upgrade-v17.6.sql');
const liveMigration=read('./upgrade-v17.7.sql');
const releaseMigration=read('./upgrade-v17.9.sql');
const release1710=read('./upgrade-v17.10.sql');
const release1711=read('./upgrade-v17.11.sql');
const notificationFn=read('./process-notifications.ts');
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
check('Package version is 17.17.0',pkg.version==='17.17.0');
check('QA npm script targets v17.17.0',pkg.scripts?.qa==='node qa-v17.17.mjs');
check('Frontend cache bust targets 17.17.0',index.includes('v=17.17.0'));    
check('App release marker is v17.17.0',app.startsWith('/* Jira Interno TROBBU v17.17.0'));
check('Index loads isolated v17.17 runtime app',index.includes('app-v17.17.0.js'));
check('Index loads isolated v17.17 runtime CSS',index.includes('styles-v17.17.0.css'));
check('Versioned runtime app exists',fs.existsSync(new URL('./app-v17.17.0.js',import.meta.url)));
check('Versioned runtime CSS exists',fs.existsSync(new URL('./styles-v17.17.0.css',import.meta.url)));    
check('Incremental v17.11 migration is the final database.sql block',database.trimEnd().endsWith(release1711.trimEnd()),crypto.createHash('sha256').update(release1711).digest('hex'));
check('No unresolved merge markers',![app,migration,repair,liveMigration,releaseMigration,release1710,release1711,notificationFn,database,styles,index,knowledgeAI,translate].some(t=>/^(<<<<<<<|=======|>>>>>>>)/m.test(t)));
check('v17.5 SQL dollar quotes are balanced',count(migration,'$$')%2===0);
check('v17.6 SQL dollar quotes are balanced',count(repair,'$$')%2===0);
check('v17.7 SQL dollar quotes are balanced',count(liveMigration,'$$')%2===0);
check('v17.9 SQL dollar quotes are balanced',count(releaseMigration,'$$')%2===0);
check('v17.10 SQL dollar quotes are balanced',count(release1710,'$$')%2===0);
check('v17.11 SQL dollar quotes are balanced',count(release1711,'$$')%2===0);
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
check('Rich text pasted HTML is sanitized and inserted through Range',hasAll(app,['const handlePaste=e=>','sanitizeKnowledgeHtml(htmlValue)','knowledgeInsertHtmlRange(el,range,clean)'])&&!app.includes("execCommand('insertHTML'"));
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
check('Richtext keeps the same persisted html schema for backwards compatibility',hasAll(app,["if(type==='richtext')return {id,type,html:sanitizeKnowledgeHtml",'normalizeKnowledgeBlocks(blocksWithLiveHtml(blocks))']));
check('Cover block preserves template brand and print flags',hasAll(app,["template:['forest','ivory','midnight'].includes(b.template)?b.template:'forest'",'show_logo:b.show_logo!==false','page_break:b.page_break!==false']));
check('Heading blocks preserve all five heading levels end-to-end',hasAll(app,["['heading1','heading2','heading3','heading4','heading5']","if(b.type==='heading5')return <h5>{b.text}</h5>"]));
check('List block trims and renders individual newline-separated list items',hasAll(app,["const items=String(b.text||'').split('\\n').map(x=>x.trim()).filter(Boolean)",'items.map((x,i)=><li key={i}>{x}</li>']));
check('Quote callout and code fields persist independently',hasAll(app,["author:String(b.author||'')","tone:['info','success','warning','danger'].includes(b.tone)","language:String(b.language||'text').slice(0,30)",'knowledge-code-rendered']));
check('Image block preserves media id alt caption and alignment',hasAll(app,["media_id:b.media_id||null","alt:String(b.alt||'')","caption:String(b.caption||'')","align:['left','center','right','wide']"]));
check('Video block is rendered only after provider URL validation',hasAll(app,['const src=knowledgeVideoEmbed(b.url)','return src?<figure className="knowledge-video"']));
check('Divider and page break remain zero-data structural blocks',hasAll(app,["if(['divider','pagebreak'].includes(type))return {id,type}","if(b.type==='divider')return <hr/>"]));
check('Quote callout and list rendered text preserve intentional line breaks',hasAll(styles,['.knowledge-rendered blockquote,.knowledge-rich-rendered blockquote{white-space:pre-wrap}','.knowledge-callout p{white-space:pre-wrap}','.knowledge-rendered li,.knowledge-rich-rendered li{white-space:pre-wrap}']));

// v17.3.1 continuous-editing regression and executive output
check('Rich editor input stays outside React state',app.includes("const handleInput=()=>{const clean=normalizeEditorHtml(el.innerHTML);draftHtmlRef.current=clean")&&!/handleInput=.*onChangeRef/.test(app));
check('Rich editor persists on external blur after continuous typing',hasAll(app,["const handleBlur=e=>","commit(true)","el.addEventListener('blur',handleBlur)"]));
check('Rich editor preserves selected ranges across toolbar interaction',hasAll(app,['rangeRef=useRef(null)','range.cloneRange()','restoreSelection()','onMouseDown={preserveSelection}']));
check('Rich editor formatting actions persist sanitized HTML',hasAll(app,['document.execCommand(cmd,false,value)','saveSelection();commit(false)','normalizeEditorHtml(readSurface())']));
check('Partial selection supports bold italic underline and non-duplicating links',hasAll(app,["command('bold')","command('italic')","command('underline')",'knowledgeApplyLinkRange','range.extractContents()','range.insertNode(anchor)'])&&!app.includes("execCommand('createLink'"));
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
check('Project package retains critical runtime and migration files', ['app.js','styles.css','index.html','database.sql','upgrade-v17.9.sql','package.json'].every(name=>fs.existsSync(new URL(name,import.meta.url))));

// Category / editor UI stability
check('Knowledge search remains a single visual input',hasAll(styles,['.knowledge-toolbar-expanded .knowledge-search input','border:0!important','box-shadow:none!important']));
check('Category cards are responsive',hasAll(styles,['.knowledge-category-grid','repeat(auto-fit,minmax(240px,1fr))','@media(max-width:620px)']));
check('Editor toolbar is responsive',hasAll(styles,['.knowledge-rich-toolbar{','overflow-x:auto','flex-wrap:nowrap']));
check('Global input styles cannot double rich editor toolbar controls',hasAll(styles,['.knowledge-rich-toolbar select','border:0!important','box-shadow:none!important']));

// v17.5 native editor, modal consistency and configurable covers
check('Rich text surface is created imperatively and owned by native DOM',hasAll(app,["document.createElement('div')","host.replaceChildren(el)","surfaceRef.current=el"]));
check('React only renders the rich editor host, not the contentEditable node',app.includes('ref={hostRef} className="knowledge-rich-surface-host"')&&!app.includes('<div ref={hostRef} contentEditable'));
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
check('Direct typing path does not update React state on input',app.includes("const handleInput=()=>{const clean=normalizeEditorHtml(el.innerHTML);draftHtmlRef.current=clean")&&!app.includes('handleInput=()=>{setBlocks'));
check('Safe writing mode is fully removed from Knowledge text blocks',!app.includes('Escritura segura')&&!app.includes('safeWriting')&&!app.includes('knowledge-safe-writing-area'));
check('Knowledge text block is always live rich editing',hasAll(app,['Edición enriquecida en vivo','Escribe y aplica estilos, fuentes y enlaces sin cambiar de modo ni perder formato.','knowledge-rich-editor-live']));
check('Link insertion uses DOM Range and never execCommand createLink',hasAll(app,['function knowledgeApplyLinkRange','range.extractContents()','range.insertNode(anchor)','knowledgeUnwrapAnchors(fragment)'])&&!app.includes("execCommand('createLink'"));
check('Collapsed link insertion inserts the URL once and advances caret',hasAll(app,['if(range.collapsed){anchor.textContent=url','next.setStartAfter(anchor)','next.collapse(true)']));
check('Existing link editing updates href without recreating surrounding content',hasAll(app,["existing.setAttribute('href',url)","next.selectNodeContents(existing)"]));
check('Unlink unwraps anchor without deleting its text',hasAll(app,['function knowledgeRemoveLinkRange','existing.replaceWith(...existing.childNodes)','changed:true']));
check('Rich link input supports Enter apply and Escape cancel',hasAll(app,["if(e.key==='Enter')","if(e.key==='Escape')",'applyLink()','setShowLink(false)']));
check('Rich editor keeps DOM selection while focus moves to its own toolbar or URL input',hasAll(app,["const editorRoot=()=>hostRef.current?.closest?.('.knowledge-rich-editor')","root&&e.relatedTarget&&root.contains(e.relatedTarget)","syncLive(clean);saveSelection();return"]));
check('External React html sync cannot overwrite live DOM while any editor control has focus',hasAll(app,['const editorHasFocus=()=>','if(el&&editorHasFocus())return','draftHtmlRef.current=next']));

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
check('Vacation types configure whether they deduct annual balance',hasAll(migration,['deducts_from_balance boolean','day_fraction numeric','requires_half_day_period boolean'])&&app.includes('Descontar del saldo anual'));
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
check('Database canonical schema retains v17.6/v17.7/v17.9/v17.10 and ends with v17.11',hasAll(database,['-- Jira Interno TROBBU v17.6','-- Jira Interno TROBBU v17.7','-- Jira Interno TROBBU v17.9','-- Jira Interno TROBBU v17.10','-- Jira Interno TROBBU v17.11'])&&database.trimEnd().endsWith(release1711.trimEnd()));
check('Package layout supports full and compact distributions without runtime truncation', ['auto-assign-helpdesk.ts','process-notifications.ts','vacation-impact-assistant.ts','trobbu-knowledge-assistant.ts'].every(name=>fs.existsSync(new URL(name,import.meta.url))));

// v17.5.4 workflow/realtime regressions
check('Vacation Analyze sends request_id and legacy fallback identifiers',hasAll(app,["request_id:r.id","workspace_id:r.workspace_id||workspace.id","user_id:r.user_id","start_date:vacationStart(r)","end_date:vacationEnd(r)"]));
check('Vacation Edge Function is request-centric and no longer requires four identifiers',vacation.includes("const requestId=String(body?.request_id||'')")&&!vacation.includes('workspace_id, user_id, start_date and end_date are required'));
check('Vacation request metrics are interactive filters',hasAll(app,["onClick={()=>switchRequestFilter('today')}","onClick={()=>switchRequestFilter('pending')}","onClick={()=>switchRequestFilter('upcoming')}","onClick={()=>selectSectionTab('mine')}"]));
check('Vacation request tabs include priority views and Ver todo',hasAll(app,["['pending','Pendientes'","['today','Fuera hoy'","['upcoming','Aprobadas próximas'","['mine','Mis solicitudes'","['all','Ver todo'"]));
check('Managers land on prioritized Requests while balance is isolated in My Vacations',hasAll(app,["return canManage?'requests':'mine'","sectionTab==='requests'&&canManage","sectionTab==='mine'&&<>",'vacation-requests-primary','vacation-balance-panel']));
check('Monthly absence calendar was removed from Vacations UI',!app.includes('Calendario de ausencias'));
check('Vacation approval is not disabled by AI state',app.includes("onClick={()=>setDecision({item:r,status:'approved'})}")&&!app.includes('Análisis requerido para aprobar'));
check('Database explicitly treats AI as advisory only',migration.includes('IA is advisory only. Approval never depends on an analysis existing or being fresh.')&&!migration.includes('Analyze sprint impact before approving vacations'));
check('Decimal vacation balances accept dot or comma and half-day rounding',hasAll(app,["replace(',','.')",'Math.round(n*2)/2','inputMode="decimal"']));
check('Balance database columns retain two decimal places',hasAll(migration,['allowed_days type numeric(7,2)','adjustment_used_days type numeric(7,2)']));
check('Vacation metadata tables are published to Supabase Realtime',hasAll(migration,["array['vacation_requests','vacation_types','vacation_balances']",'alter publication supabase_realtime add table']));
check('Vacation tables use FULL replica identity for realtime payloads',hasAll(migration,['vacation_requests replica identity full','vacation_types replica identity full','vacation_balances replica identity full']));
check('Frontend Live v2 subscribes vacation requests/types/balances',hasAll(app,["'vacation_requests','vacation_types','vacation_balances'",'workspace-live-v2-${workspaceId}']));
check('Realtime fallback revalidates only while websocket is unhealthy and visible',hasAll(app,["status==='SUBSCRIBED'","['CHANNEL_ERROR','TIMED_OUT','CLOSED']","if(!realtimeHealthy&&document.visibilityState==='visible')scheduleRevalidate(0)",'15000']));
check('PostgREST schema reload is requested by current migration',migration.includes("notify pgrst, 'reload schema';"));

// v17.8 Knowledge assistant proactive title matching regression
check('Knowledge Assistant triggers from title-only context at five characters',hasAll(app,["titleReady=subject.length>=5","if(!titleReady&&!detailReady)",'},650)']));
check('Knowledge Assistant no longer requires description before invocation',!app.includes('subject.length<3||detail.length<12')&&!app.includes('detail.length<12){setState'));
check('Knowledge Assistant forwards Helpdesk request metadata',hasAll(app,['department_id:departmentId||null','request_type_id:requestTypeId||null','product_id:productId||null']));
check('Knowledge backend accepts title-only mode',hasAll(knowledgeAI,['const subject=title.trim(),detail=description.trim(),mode=detail.length>=12?"full":"title"','subject.length<5&&detail.length<12']));
check('Knowledge backend normalizes plurals and prefix variants',hasAll(knowledgeAI,['const stem=','endsWith("es")','const tokenMatch=']));
check('Knowledge AI searches full published article content',knowledgeAI.includes('String(a.content||"").slice(0,60000)'));
check('Knowledge AI downweights generic create/admin/panel/profile terms',hasAll(knowledgeAI,['const GENERIC=new Set','"crear"','"admin"','"panel"','"perfil"']));
check('Knowledge ranking weights category, tags, title and context',hasAll(knowledgeAI,['categoryHits','tagHits','titleHits','contextMatches','category_name','category_description']));
check('Knowledge assistant loads Helpdesk department and request type context',hasAll(knowledgeAI,['helpdesk_departments','helpdesk_request_types','departmentId','requestTypeId']));
check('Knowledge deterministic title fallback requires strong evidence',hasAll(knowledgeAI,['mode==="title"','strongFieldHits>0','a.relevance>=.64']));
check('Knowledge full-request deterministic fallback keeps strict threshold',hasAll(knowledgeAI,['a.coverage>=.28','a.relevance>=.58']));
check('Knowledge AI outage falls back to deterministic results',hasAll(knowledgeAI,['deterministic-fallback','relevant:any[]=deterministic','knowledge assistant AI fallback']));
check('Knowledge response exposes AI configured diagnostic',hasAll(knowledgeAI,['ai_configured:aiConfigured','ai_error:aiError||null']));
check('Knowledge assistant can still return zero suggestions for weak evidence',hasAll(knowledgeAI,['articles:[]','No encontré un artículo publicado de Knowledge con relevancia específica suficiente.']));
check('Translation flow still carries content_blocks',hasAll(translate,['content_blocks','mergeBlocks']));


// v17.5.4 URL state, Vacation IA/schema, permissions and layout
check('Top-level menu view initializes from URL',app.includes("new URL(window.location.href).searchParams.get('view')||'board'"));
check('Sidebar navigation writes view to browser history',hasAll(app,['const writeViewUrl=','window.history[method]','const navigateView=next=>']));
check('Board Table/Kanban/Calendar/Gantt mode persists in URL',hasAll(app,["searchParams.get('mode')","url.searchParams.set('mode',boardMode)","['table','kanban','calendar','gantt']"]));
check('Settings tabs persist in URL',app.includes("useUrlTab('settings','workspace',['workspace','products','sprints','helpdesk','notifications'])"));
check('Staff/Roles tabs persist in URL',app.includes("useUrlTab('team','staff',['staff','roles'])"));
check('Vacation section tabs persist in URL',hasAll(app,["searchParams.set('view','vacations')","searchParams.set('tab',next)","Mis Vacaciones","Proyección de Vacaciones","Control por Integrante","Tipos de Vacaciones"]));
check('Vacation projection has dedicated RBAC permission',hasAll(app,['view_vacation_projection','canViewVacationProjection','canViewProjection'])&&migration.includes('view_vacation_projection'));
check('Projection permission defaults to PM/Admin but not Dev/QA',migration.includes("'view_vacations','request_vacations','view_vacation_projection','manage_vacations'")&&app.includes('pm:{')&&!/dev:\{[^}]*view_vacation_projection:true/.test(app));
check('Vacation decision canonical columns are created for old schemas',hasAll(migration,['add column if not exists decision_by','add column if not exists ai_risk','add column if not exists ai_recommendation','add column if not exists ai_analysis','add column if not exists ai_analyzed_at']));
check('Legacy vacation decision/assistant data migrates to canonical fields',hasAll(migration,['decision_by=coalesce(decision_by,decided_by)','assistant_recommendation','assistant_snapshot','analyzed_at']));
check('Vacation annual-unit helper exists before guard uses it',migration.indexOf('create or replace function private.vacation_units_for_year')>=0&&migration.indexOf('create or replace function private.vacation_units_for_year')<migration.lastIndexOf('private.vacation_units_for_year(new.date_blocks'));
check('Vacation approval writes decision_by',app.includes('decision_by:session.user.id'));
check('Balance save returns authoritative DB row immediately',hasAll(app,["onConflict:'workspace_id,user_id,year'",".select('*').single()",'setVacationBalances(rows=>']));
check('Vacation metadata uses central Live revision instead of duplicate channel',app.includes('useEffect(()=>{loadVacationMeta()},[workspace.id,liveRevision])')&&!app.includes('vacation-meta-${workspace.id}'));
check('Knowledge Assistant queries only published articles with active versions',hasAll(knowledgeAI,[`.eq("status","published")`,`.not("active_version_id","is",null)`]));
check('Knowledge Assistant validates exact active published version content',hasAll(knowledgeAI,['knowledge_article_versions','versionMap.get(article.active_version_id)','version.article_id!==article.id','.eq("status","published")']));
check('Knowledge Assistant AI semantic judge keeps strict 0.72 threshold and active version binding',hasAll(knowledgeAI,['rel>=.72','active_version_id','version.article_id!==article.id']));
check('Knowledge Assistant targets GPT-6.1 Sol when AI is available',knowledgeAI.includes('gpt-6.1-sol'));
check('Knowledge direct link opens Knowledge reader route',hasAll(app,["const knowledgeArticleUrl=id=>appDeepLink({view:'knowledge',knowledge:id})",'target="_blank"']));
check('Gantt KPI chips are actual button filters',hasAll(app,['const [kpiFilter,setKpiFilter]','toggleKpi','gantt-kpis','setKpiFilter(\'all\')']));
check('Gantt filters expose backlog, overdue, historical and closed results',hasAll(app,["kpiFilter==='unscheduled'","kpiFilter==='overdue'","kpiFilter==='historical'","kpiFilter==='closed'",'gantt-filter-results']));
check('Backlog bulk selection controls share one desktop row',hasAll(styles,['.bulk-sprint-bar{display:grid;grid-template-columns:minmax(180px,.55fr) minmax(420px,1.45fr)', '.bulk-sprint-bar>div{width:100%;display:grid;grid-template-columns:minmax(260px,1fr) auto auto']));
check('Backlog bulk controls still stack on mobile only',styles.includes('@media(max-width:760px)')&&styles.includes('.bulk-sprint-bar{display:grid;grid-template-columns:1fr}'));

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


// v17.6 production-drift regressions
check('v17.6 repair recreates missing Knowledge initial draft RPC',repair.includes('create or replace function public.create_knowledge_initial_draft'));
check('v17.6 repair recreates missing Knowledge draft update RPC',repair.includes('create or replace function public.update_knowledge_draft_version'));
check('v17.6 repair grants Knowledge draft update to authenticated',repair.includes('grant execute on function public.update_knowledge_draft_version(uuid,text,text,text,text,jsonb,text[],uuid,uuid,uuid) to authenticated'));
check('v17.6 publish keeps active published shadow and content schema in sync',hasAll(repair,['create or replace function public.publish_knowledge_version','active_version_id=v.id','content_schema_version=coalesce(v.content_schema_version,3)']));
check('Knowledge reader scopes published fallback to current article',app.includes("versions.filter(v=>v.article_id===article.id&&v.status==='published')"));
check('Knowledge list scopes active id to current article',app.includes("v.id===a.active_version_id&&v.article_id===a.id"));
check('Vacation guard recognizes current request.jwt.claims service role',repair.includes("current_setting('request.jwt.claims',true)")&&repair.includes("'service_role'"));
check('Vacation meta loads current-user balance independently',app.includes(".eq('user_id',session.user.id)")&&app.includes('const merged=new Map()'));
check('Vacation UI never presents fallback balance as authoritative while loading',hasAll(app,['vacationMetaLoading','myBalance.loading?\'…\'','Espera a que termine de cargar el saldo de vacaciones']));
check('Vacation assistant exposes provider/fallback diagnostics',hasAll(vacation,["provider='deterministic'","provider='deterministic-fallback'",'ai_configured:Boolean(gatewayKey||openaiKey)']));
check('Vacation assistant honors explicit manage_vacations=false overrides',hasAll(vacation,["memberOverride!==null?memberOverride","roleOverride!==null?roleOverride","defaultManage(role?.base_role||member?.role)"]));


// v17.7 Live Data / URL synchronization regressions
check('Single workspace Live Data channel replaces duplicate module channels',count(app,'db.channel(`workspace-live-v2-${workspaceId}`)')===1&&count(app,'db.channel(`vacation-meta-')===0);
check('Live Data channel patches tickets immediately',hasAll(app,["if(table==='tickets')","reconcileLiveArray(setTickets,payload","bumpLiveRevision('tickets')"]));
check('Live Data channel patches Helpdesk immediately',hasAll(app,["table==='helpdesk_tickets'","reconcileLiveArray(setHelpdesk,payload","bumpLiveRevision('helpdesk')"]));
check('Live Data channel patches Knowledge immediately',hasAll(app,["table==='knowledge_articles'","reconcileLiveArray(setKnowledgeArticles,payload","bumpLiveRevision('knowledge')"]));
check('Live Data channel patches Vacations immediately',hasAll(app,["table==='vacation_requests'","reconcileLiveArray(setVacationRequests,payload","bumpLiveRevision('vacations')"]));
check('Live Data channel patches workspace settings immediately',hasAll(app,["table==='workspace_settings'","setSettings(prev=>({...prev,...payload.new}))"]));
check('Live Data channel includes Helpdesk departments and request types',hasAll(app,["'helpdesk_departments','helpdesk_request_types','helpdesk_tickets'","helpdesk_activity"]));
check('Live Data channel listens to workspace row changes',app.includes("table:'workspaces',filter:`id=eq.${workspaceId}`"));
check('First Realtime SUBSCRIBED closes initial query/subscription race',app.includes('scheduleRevalidate(recovering?40:80)'));
check('Reconnect, focus, online and visibility restore trigger silent reconciliation',hasAll(app,["window.addEventListener('focus',resume)","window.addEventListener('online',resume)","document.addEventListener('visibilitychange',resume)","Date.now()-liveLastSyncRef.current>5000"]));
check('Live status exposes connecting/live/degraded states',hasAll(app,["setLiveStatus('connecting')","setLiveStatus('live')","setLiveStatus('degraded')","live-sync-indicator"]));
check('Live status has responsive CSS indicator',hasAll(styles,['.live-sync-indicator.live','.live-sync-indicator.connecting','.live-sync-indicator.degraded','@keyframes live-sync-pulse']));
check('Workspace loads are sequence-guarded against stale async overwrite',hasAll(app,['workspaceLoadSeqRef','const loadSeq=++workspaceLoadSeqRef.current','loadSeq!==workspaceLoadSeqRef.current']));
check('Open Ticket modal refreshes details on Live revisions',app.includes('function TicketDetailModal({workspace,ticket')&&app.includes('liveRevision=0,onClose')&&app.includes('[ticket.id,liveRevision]'));
check('Open Sprint modal refreshes details on Live revisions',app.includes('function SprintDetailModal({workspace,sprint')&&app.includes('liveRevision=0,onClose')&&app.includes('[sprint.id,liveRevision]'));
check('Open Helpdesk modal refreshes details on Live revisions',app.includes('function HelpdeskDetailModal({workspace,item')&&app.includes('liveRevision=0,onClose')&&app.includes('[item.id,liveRevision]'));
check('Open modal snapshot follows updated list entities',hasAll(app,['setModal(current=>','tickets.find(row=>row.id===current.ticket.id)','helpdesk.find(row=>row.id===current.item.id)','sprints.find(row=>row.id===current.sprint.id)']));
check('Knowledge read/preview media revalidates on Live revision',hasAll(app,['function KnowledgeArticlePage({liveRevision=0','[article.id,liveRevision]','function KnowledgeListPreviewPage({liveRevision=0']));
check('Knowledge editor refreshes media without replacing dirty document content',app.includes('function KnowledgeArticleEditorPage({liveRevision=0')&&app.includes('[article?.id,liveRevision]')&&app.includes('window.__jiraKnowledgeEditorGuard'));
check('Knowledge preview snapshot follows live version updates',hasAll(app,["const freshVersion=knowledgeScreen.mode==='preview'","knowledgeVersions.find(row=>row.id===knowledgeScreen.version.id)"]));
check('URL popstate resets missing board mode to table',app.includes("setBoardMode(['table','kanban','calendar','gantt'].includes(mode||'')?mode:'table')"));
check('URL synchronization removes stale tab/mode parameters',hasAll(app,["!['team','settings','vacations'].includes(view)&&url.searchParams.has('tab')","!['board','mytasks'].includes(view)&&url.searchParams.has('mode')"]));
check('v17.7 migration publishes previously missing live UI tables',hasAll(liveMigration,["'workspace_settings'","'helpdesk_departments'","'helpdesk_request_types'","'helpdesk_activity'","'workspaces'",'alter publication supabase_realtime add table']));
check('v17.7 migration enables FULL replica identity for filtered deletes',hasAll(liveMigration,['replica identity full',"'tickets'","'vacation_requests'","'knowledge_articles'","'workspace_settings'","'workspaces'"]));
check('v17.7 migration is idempotent for publication membership',hasAll(liveMigration,['pg_publication_tables',"pubname='supabase_realtime'",'not exists']));
check('Live intervals are bounded to counter/full safety reconciliation and degraded fallback',count(app,'setInterval(')<=5&&hasAll(app,['counterReconcile=setInterval','liveReconcile=setInterval','const fallback=setInterval']));
check('Derived navigation/module counters use one authoritative Live snapshot',hasAll(app,['const scheduleDerived=','get_live_counters','liveDerivedTimerRef'])&&!app.includes("db.rpc('list_module_counts'")&&!app.includes("db.rpc('get_navigation_counts'"));
check('Full workspace refetch is limited to relationship/permission tables',hasAll(app,["const fullRevalidateTables=new Set(['workspace_members','workspace_member_products','workspace_roles','profiles','products','workspaces'])",'if(fullRevalidateTables.has(table))scheduleRevalidate(260)']));
check('Helpdesk assignment queue/log participate in Live revisions',hasAll(app,["'helpdesk_assignment_queue','helpdesk_assignment_log'","bumpLiveRevision('helpdesk')"]));
check('Open Staff capacity revalidates when Helpdesk assignment state changes',app.includes('function MemberModal({liveRevision=0')&&app.includes('[workspace.id,member.user_id,liveRevision]'));
check('Open Workspace settings refreshes routing members on Staff Live revisions',app.includes('function WorkspaceConfigModal({liveRevision=0')&&app.includes('[workspace.id,liveRevision]'));
check('DELETE events always finish with authoritative silent reconciliation',app.includes("if(eventType==='DELETE')scheduleRevalidate(120)"));
check('Helpdesk assignment tables use FULL replica identity in v17.7',hasAll(liveMigration,["'helpdesk_assignment_queue'","'helpdesk_assignment_log'",'replica identity full']));


// v17.8 Helpdesk KPI filters / Knowledge Assistant integration
check('Helpdesk quick filter state is stored with detailed filters',app.includes("priority:'all',quick:'all'"));
check('Helpdesk quick matcher supports all five KPI datasets',hasAll(app,["mode==='all'","mode==='open'","mode==='pending_requirements'","mode==='overdue'","mode==='closed'"]));
check('Helpdesk quick filter participates in the canonical filter predicate',app.includes("helpdeskQuickMatches(h,f.quick||'all')"));
check('Helpdesk KPI cards are actionable filters',hasAll(app,["onQuickFilter?.('all')","onQuickFilter?.('open')","onQuickFilter?.('pending_requirements')","onQuickFilter?.('overdue')","onQuickFilter?.('closed')"]));
check('Helpdesk SLA KPI card is removed from the metric row',!app.includes('label="SLA cumplido"'));
check('Helpdesk KPI row has exactly five responsive columns on desktop',styles.includes('.metric-grid.helpdesk-kpi-grid{grid-template-columns:repeat(5,minmax(0,1fr))'));
check('Helpdesk KPI row adapts at 1400, 900 and 520 widths',hasAll(styles,['@media(max-width:1400px){.metric-grid.helpdesk-kpi-grid','@media(max-width:900px){.metric-grid.helpdesk-kpi-grid','@media(max-width:520px){.metric-grid.helpdesk-kpi-grid']));
check('Detailed Helpdesk filters clear active KPI quick filter',app.includes("props.setHelpFilters({...f,quick:'all'})"));
check('Status filter clears active KPI quick filter',app.includes("onStatusChange={status=>setHelpFilters(f=>({...f,status,quick:'all'}))}"));
check('KPI filter resets detailed filters to avoid ambiguous intersections',app.includes("onQuickFilter={quick=>setHelpFilters({status:'all',requestType:'all',department:'all',product:'all',assignee:'all',priority:'all',quick})}"));
check('Knowledge suggestions in Helpdesk receive title, description, product, department and request type',hasAll(app,['title={f.subject}','description={f.description}','productId={f.product_id}','departmentId={f.department_id}','requestTypeId={f.request_type_id}']));
check('Knowledge title-only suggestions stay quiet when no match exists',knowledgeAI.includes('mode==="full"?')&&knowledgeAI.includes(':"";'));



// v17.9 unified counters, theme and Helpdesk canonical workflow
check('Theme preference is persisted in profile schema',hasAll(releaseMigration,["profiles add column if not exists theme_preference","theme_preference in ('light','dark')"]));
check('Theme is applied before CSS paint',hasAll(index,["localStorage.getItem('jira_theme')","document.documentElement.dataset.theme=t"]));
check('Theme toggle is available globally',hasAll(app,['const ThemeToggle=','theme-toggle','setTheme'])&&count(app,'<ThemeToggle')>=3);
check('Theme persists locally and to authenticated profile',hasAll(app,["localStorage.setItem('jira_theme',value)","theme_preference:value","document.documentElement.dataset.theme=value"]));
check('Dark theme has global structural overrides',hasAll(styles,['html[data-theme="dark"] body','html[data-theme="dark"] .global-topbar','html[data-theme="dark"] .sidebar','html[data-theme="dark"] .modal','html[data-theme="dark"] .table']));
check('Helpdesk exposes only four canonical statuses in UI',(()=>{const h=app.slice(app.indexOf('const HELP_STATUS'),app.indexOf('const normalizeHelpdeskStatus'));return hasAll(h,["['created','Nuevo'","['review','En revisión'","['attended','Atendido'","['closed','Cerrado'"])&&!h.includes('resolved')})());
check('Legacy resolved Helpdesk cache is normalized to closed',app.includes("value==='resolved'?'closed':value"));
check('Database migrates historical resolved Helpdesk rows to closed',hasAll(releaseMigration,["where status='resolved'","set status='closed'","closed_at=coalesce(closed_at,resolved_at"]));
check('Database Helpdesk status constraint only permits canonical four states',releaseMigration.includes("check (status in ('created','review','attended','closed'))"));
check('Requester may only close an attended Helpdesk request',hasAll(releaseMigration,["old.status='attended' and new.status='closed'","The requester can only close an attended Helpdesk ticket"]));
check('Assignee must advance Nuevo to En revision to Atendido',hasAll(releaseMigration,["old.status='created' and new.status='review'","old.status='review' and new.status='attended'","Assigned users must follow Nuevo -> En revisión -> Atendido"]));
check('Helpdesk update policy includes manager requester and current assignee',hasAll(releaseMigration,["create policy helpdesk_tickets_update","requester_user_id=(select auth.uid())","assigned_to=(select auth.uid())"]));
check('Helpdesk table has inline assignment selector',hasAll(app,['table-inline-control assignee-inline','aria-label={`Responsable ${h.ticket_key}`}','onInlineAssign?.(h,e.target.value)']));
check('Helpdesk table has inline status selector',hasAll(app,['table-inline-control status-inline','aria-label={`Estado ${h.ticket_key}`}','onInlineStatus?.(h,e.target.value)']));
check('Helpdesk inline status follows current-to-next workflow only',hasAll(app,['const helpdeskWorkflowOptions=value=>','helpdeskWorkflowOptions(status).map']));
check('Helpdesk requirement decision is inline',hasAll(app,['table-inline-control decision-inline','Aceptar a Backlog','Rechazar']));
check('Helpdesk detail lets requester confirm solution and close',hasAll(app,['requesterCanClose','Confirmar solución y cerrar']));
check('Helpdesk manager close action appears only after attended',app.includes("managerCanClose=canManageHelpdesk&&!requirement&&status==='attended'"));
check('Helpdesk detail lets assignee advance sequential workflow',hasAll(app,['assigneeNext','Iniciar revisión','Marcar como Atendido']));
check('Unified server counter snapshot covers navigation modules and Helpdesk',hasAll(releaseMigration,['create or replace function public.get_live_counters','\'navigation\'','\'modules\'','\'helpdesk\'']));
check('Workspace initial load uses unified counter snapshot',app.includes("db.rpc('get_live_counters',{p_workspace:workspaceId})"));
check('Realtime derived refresh uses unified counter snapshot',count(app,"get_live_counters")>=3);
check('Counter snapshot has periodic authoritative reconciliation',hasAll(app,['counterReconcile=setInterval','20000']));
check('Helpdesk KPI counters consume authoritative server snapshot',hasAll(app,['counterSnapshot={liveCounters?.helpdesk||null}','const serverNumber=(key,fallback)=>','value={total}']));
check('Primary Live rows have periodic authoritative safety reconciliation',hasAll(app,['const reconcilePrimaryRows=async()=>','liveReconcile=setInterval','60000','setHelpdesk(h.data||[])','setTickets(t.data||[])']));
check('Ticket detail has resilient comment/activity refresh',/function TicketDetailModal[\s\S]{0,5000}useResilientLiveRefresh\(load/.test(app));
check('Sprint detail has resilient comment/activity refresh',/function SprintDetailModal[\s\S]{0,5000}useResilientLiveRefresh\(load/.test(app));
check('Helpdesk detail has resilient comment/activity refresh',/function HelpdeskDetailModal[\s\S]{0,5000}useResilientLiveRefresh\(load/.test(app));
check('Comment activity attachment tables use FULL replica identity',hasAll(releaseMigration,['ticket_comments replica identity full','ticket_activity replica identity full','sprint_comments replica identity full','helpdesk_comments replica identity full','helpdesk_activity replica identity full']));
check('Realtime publication safeguards all comment/activity sources',hasAll(releaseMigration,["'ticket_comments'","'sprint_comments'","'helpdesk_comments'","pg_publication_tables"]));
check('Vacation type editor uses switches for deduct and active',hasAll(app,['Descontar del saldo anual','Tipo activo','<Toggle'])&&app.includes('role="switch"'));
check('Auto assignment no longer treats resolved as active status',routing.includes('.neq("status","closed")')&&!routing.includes('(resolved,closed)'));
check('Frontend active Helpdesk status lists do not expose Resuelto',!app.includes("['resolved','Resuelto'")&&!app.includes('>Resuelto<'));


// v17.9.2 dark-mode and exact detail counter hardening
check('Dark login preserves the same luxury background photograph',hasAll(styles,["html[data-theme=\"dark\"] .auth-shell","url('./auth-bg.webp') center/cover no-repeat!important"]));
check('Dark TROBBU isotipo/logo is forced to white',hasAll(styles,["html[data-theme=\"dark\"] .topbar-brand img","html[data-theme=\"dark\"] .auth-logo",'filter:brightness(0) invert(1)!important']));
check('Dark login card and inputs have explicit luxury contrast',hasAll(styles,['html[data-theme=\"dark\"] .luxury-auth-card','background:rgba(16,24,32,.965)!important','html[data-theme=\"dark\"] .auth-input','background:#0D151D!important']));
check('Dark Backlog filter and work surfaces no longer stay white',hasAll(styles,['html[data-theme=\"dark\"] .backlog-filterbar','html[data-theme=\"dark\"] .bulk-sprint-bar','html[data-theme=\"dark\"] .backlog-column','html[data-theme=\"dark\"] .sprint-stack']));
check('Dark notification drawer has explicit row and action contrast',hasAll(styles,['html[data-theme=\"dark\"] .notification-drawer','html[data-theme=\"dark\"] .notification-item','html[data-theme=\"dark\"] .notification-actions']));
check('Dark access validation card and skeleton are explicitly styled',hasAll(styles,['html[data-theme=\"dark\"] .access-validation-card','html[data-theme=\"dark\"] .skeleton-shimmer']));
check('Dark Helpdesk detail aside and comments are explicitly styled',hasAll(styles,['html[data-theme=\"dark\"] .detail-aside','html[data-theme=\"dark\"] .comment p','html[data-theme=\"dark\"] .helpdesk-comment-create']));

check('Dark secondary modules are audited beyond the supplied screenshots',hasAll(styles,['.role-admin-card','.jira-timeline-scroll','.import-preview','.custom-values-panel','.relations-panel','.report-kpi','.product-report-card','.vacation-approval-card','.ticket-relation-search','.knowledge-rich-editor']));
check('Dark form controls outside page wrappers retain readable fields',hasAll(styles,['html[data-theme="dark"] .form input','html[data-theme="dark"] .form select','html[data-theme="dark"] .form textarea','html[data-theme="dark"] .quick-assignee-select']));
check('Dark native select options use dark menu colors',styles.includes('html[data-theme="dark"] select option{background:#151F29;color:#F3F6F9}'));

check('Helpdesk inline list controls expose the whole component as the native select hit area',hasAll(styles,['.table-inline-control .table-inline-native','position:absolute!important','inset:0!important','width:100%!important','height:100%!important','opacity:0!important','cursor:pointer!important'])&&count(app,'className="table-inline-native"')>=3);
check('Helpdesk inline list visual value is separate from transparent native select',hasAll(app,['className="table-inline-value"','full-click-select status-${status}','full-click-select ${decision}']));
check('Dark inline Helpdesk status colors stay visible behind transparent select',hasAll(styles,['.table-inline-control.status-review','.table-inline-control.status-attended','.table-inline-control.status-closed']));
check('Exact relation count helper uses server COUNT head query',hasAll(app,['async function exactRelationCount',"select('*',{count:'exact',head:true})"]));
check('Helpdesk comment badge uses the exact rendered comments collection',hasAll(app,['Comentarios <DetailCounter rows={commentRows}','{commentRows.map(c=>','const commentRows=Array.isArray(comments)?comments:[]']));
check('Helpdesk activity badge uses the exact rendered activity collection',hasAll(app,['Seguimiento <DetailCounter rows={followupRows}','{followupRows.map(a=>','const followupRows=Array.isArray(activity)?activity:[]']));
check('Helpdesk attachments load in the same detail refresh without a second count source',app.includes("db.from('helpdesk_attachments').select('*').eq('helpdesk_ticket_id',item.id)")&&app.includes('setAttachments([...signed])'));
check('Ticket detail counters use the same loaded collections as rendered rows',hasAll(app,['Revisión y evidencias <DetailCounter rows={commentRows}','Actividad <DetailCounter rows={activityRows}',"db.from('ticket_comments').select('*')","db.from('ticket_activity').select('*')"]));
check('Sprint detail counter uses loaded comments and standalone evidence rows',hasAll(app,['const sprintReviewRows=[...sprintCommentRows,...sprintEvidenceRows]','<DetailCounter rows={sprintReviewRows}',"db.from('sprint_comments').select('*')"]));
check('Helpdesk status action immediately reloads exact comments/activity counts',/const runStatus=async status=>\{setWorkflowBusy\(true\);try\{await onStatusChange\?\.\(status\);await load\(\)/.test(app));


// v17.9.2 screenshot-driven dark-mode parity and count fallback tests
check('Detail badges use visible rendered rows as the single source of truth',hasAll(app,['const commentRows=Array.isArray(comments)?comments:[]','const activityRows=Array.isArray(activity)?activity:[]','const followupRows=Array.isArray(activity)?activity:[]','function DetailCounter({rows=[]']));
check('Dark active switch uses a green track with a white knob',hasAll(styles,['html[data-theme="dark"] .switch.on{background:#249F58!important','html[data-theme="dark"] .switch.on i{background:#FFFFFF!important']));
check('Dark inactive switch uses a gray knob',styles.includes('html[data-theme="dark"] .switch i{background:#6F8090!important'));
check('Dark Knowledge reader hero no longer uses a light surface',hasAll(styles,['html[data-theme="dark"] .knowledge-reader-hero','background:linear-gradient(180deg,#17232E 0%,#121B24 100%)!important','html[data-theme="dark"] .knowledge-reader-hero h1{color:#FFFFFF!important']));
check('Dark rendered Knowledge content overrides legacy inline text colors',hasAll(styles,['.knowledge-reader-page .knowledge-rich-rendered :where(p,li,span,strong,b,em,font)','color:#DCE6EF!important']));
check('Dark Knowledge author block header is not a white strip',hasAll(styles,['html[data-theme="dark"] .knowledge-block-head{background:#101922!important','html[data-theme="dark"] .knowledge-block-drag b{background:#173A64!important']));
check('Dark Staff workspace scope strip is fully dark',styles.includes('html[data-theme="dark"] .workspace-scope-strip{background:#142636!important'));
check('Dark Helpdesk routing panel is fully dark',styles.includes('html[data-theme="dark"] .helpdesk-routing-config{background:#121D27!important'));
check('Dark Gantt KPI rail is fully dark',styles.includes('html[data-theme="dark"] .gantt-kpis{background:#101922!important'));
check('Dark Sprint review sticky header is fully dark',styles.includes('html[data-theme="dark"] .sprint-review-section .section-heading{background:#121B24!important'));
check('Dark upload drop zones no longer look like white sheets',styles.includes('html[data-theme="dark"] .helpdesk-evidence-picker{background:#101922!important'));
check('Dark ticket metadata panel no longer looks like a white sheet',styles.includes('html[data-theme="dark"] .ticket-metadata-panel{background:#101922!important'));
check('Dark Helpdesk/Ticket detail aside removes gray slab background',styles.includes('html[data-theme="dark"] .detail-aside{background:transparent!important'));
check('Dark detail and section counters remain readable',hasAll(styles,['html[data-theme="dark"] .detail-tabs button em','html[data-theme="dark"] .section-counter','background:#263746!important']));


// v17.9.2 final contrast sweep regression checks
check('Dark Staff selected permission/access cards use semantic navy instead of pale blue',hasAll(styles,['html[data-theme="dark"] .scope-choice>button.active','html[data-theme="dark"] .product-access-grid label.checked','background:#173A64!important']));
check('Dark import intro is not a white information strip',styles.includes('html[data-theme="dark"] .import-intro'));
check('Dark report and catalog hard-coded text is overridden',hasAll(styles,['html[data-theme="dark"] .catalog-title b','html[data-theme="dark"] .report-kpi strong','color:#F1F5F8!important']));
check('Dark AI quick actions do not retain pale buttons',styles.includes('html[data-theme="dark"] .ai-quick button{'));
check('Dark Knowledge preview banner and pending media are not pale blue sheets',hasAll(styles,['html[data-theme="dark"] .knowledge-preview-banner','html[data-theme="dark"] .knowledge-pending-media','background:#142331!important']));
check('Dark Knowledge callout/quote textareas have dark semantic surfaces',hasAll(styles,['html[data-theme="dark"] .block-callout textarea','html[data-theme="dark"] .block-quote textarea']));
check('Dark Helpdesk settings active tab is dark blue',hasAll(styles,['html[data-theme="dark"] .helpdesk-settings-tabs button.active','background:#173A64!important']));
check('Dark Gantt filter results and module group rows are dark',hasAll(styles,['html[data-theme="dark"] .gantt-module-group-row','html[data-theme="dark"] .gantt-filter-results button']));
check('Dark Vacation tabs are fully dark and active state readable',hasAll(styles,['html[data-theme="dark"] .vacation-request-tabs','html[data-theme="dark"] .vacation-request-tabs button.active']));
check('Dark readonly fields do not fall back to light disabled background',styles.includes('html[data-theme="dark"] input[readonly]{background:#101922!important'));
check('Ticket and Helpdesk comment counters equal rendered rows',count(app,'<DetailCounter rows={commentRows}')>=2&&count(app,'{commentRows.map(c=>')>=2);
check('Ticket and Helpdesk activity counters equal rendered rows',app.includes('<DetailCounter rows={activityRows}')&&app.includes('<DetailCounter rows={followupRows}')&&app.includes('{activityRows.map(a=>')&&app.includes('{followupRows.map(a=>'));


// v17.10 SendPulse QA email delivery, templates, scheduling and latest contrast corrections
check('SendPulse QA rollout is hard-gated to Gustavo corporate mailbox',hasAll(release1710,["email_qa_mode boolean not null default true","email_qa_recipient text not null default 'gustavo.chan@trobbucollection.com'"]));
check('QA hourly rate cap cannot exceed SendPulse free-plan hourly ceiling',hasAll(release1710,['email_qa_hourly_limit integer not null default 8','check (email_qa_hourly_limit between 1 and 50)']));
check('Legacy email backlog is preserved but suppressed before rollout',hasAll(release1710,["status='suppressed'","pre_sendpulse_qa_rollout_v17.10","o.created_at < ws.email_rollout_at"]));
check('Notification outbox audits provider intended and delivered recipients',hasAll(release1710,['provider_message_id text','intended_recipient_email text','delivered_to text','suppressed_reason text']));
check('Helpdesk requester and reviewer comment directions are explicit',hasAll(release1710,["'requester_to_team'","'team_to_requester'","comment_direction"]));
check('Helpdesk comment trigger emits email only to one primary counterpart',hasAll(release1710,['v_email_user:=v_req.assigned_to','v_email_user:=v_req.requester_user_id','v_user is not distinct from v_email_user']));
check('Helpdesk assignment has a dedicated email event',release1710.includes("'helpdesk_assigned'"));
check('Helpdesk closure has a dedicated email event',release1710.includes("'helpdesk_closed'"));
check('Daily Jira reminder generates one QA workspace summary per day',hasAll(release1710,['create or replace function private.queue_daily_jira_reminders','daily-jira-reminder:qa:','email_daily_reminder_enabled']));
check('Daily Jira reminder is scheduled for 09:00 America Merida equivalent',hasAll(release1710,["'0 15 * * *'","jira-daily-email-reminder"]));
check('Outbox processor cron runs every minute',hasAll(release1710,["'jira-process-email-outbox'","'* * * * *'","net.http_post"]));
check('Cron notification token is generated randomly and stored in Vault',hasAll(release1710,["encode(gen_random_bytes(32),'hex')","vault.create_secret","jira_notification_cron_token_"]));
check('Only the cron token hash is stored in workspace settings',hasAll(release1710,['email_cron_token_hash text',"digest(v_token,'sha256')"]));
check('SendPulse API endpoint is used by notification processor',notificationFn.includes('https://api.sendpulse.com/smtp/emails'));
check('SendPulse HTML is Base64 encoded before SMTP API delivery',hasAll(notificationFn,['html:b64(doc.html)','new TextEncoder().encode(v)']));
check('SendPulse processor records provider message IDs',hasAll(notificationFn,['provider_message_id:pr.id','provider:"sendpulse"']));
check('QA physical delivery destination is overridden by workspace QA recipient',hasAll(notificationFn,['delivered=qa?qaTo','QA recipient gate rejected destination']));
check('QA email allowlist is restricted to requested event families',hasAll(notificationFn,['daily_jira_reminder','helpdesk_assigned','helpdesk_comment','helpdesk_closed','ticket_closed','qa_event_not_enabled']));
check('Professional email template uses TROBBU palette and Jira CTA',hasAll(notificationFn,['#0C2B2A','#02488D','#D1AA87','#F1E4CD','Abrir Jira Interno']));
check('Daily reminder template includes operational counters',hasAll(notificationFn,['Tickets abiertos','Backlog','Helpdesk','Sprints activos / planeados']));
check('Helpdesk comment template changes copy by POV direction',hasAll(notificationFn,['comentario del solicitante','respuesta de seguimiento','Solicitante → seguimiento','Seguimiento → solicitante']));
check('Frontend invokes email processor after Helpdesk modal assignment',app.includes("db.rpc('assign_helpdesk_ticket',{p_ticket_id:modal.item.id")&&app.includes("db.functions.invoke('process-notifications',{body:{workspace_id:props.workspace.id}}"));
check('Frontend invokes email processor after Helpdesk comments',app.includes("helpdesk_comments').insert")&&app.includes("db.functions.invoke('process-notifications',{body:{workspace_id:workspace.id}}"));
check('Visible detail counters are tied directly to loaded rows',hasAll(app,['setComments([...(c.data||[])])','setActivity([...(a.data||[])])','<DetailCounter rows={commentRows}','<DetailCounter rows={followupRows}']));
check('Dark Reports sprint projection card has explicit dark surface',hasAll(styles,['html[data-theme="dark"] .sprint-report-card','background:linear-gradient(180deg,#15212B 0%,#111A23 100%)!important']));
check('Dark Staff and Roles counter pills are no longer white',hasAll(styles,['html[data-theme="dark"] .staff-tabs em{background:#2A3947!important','html[data-theme="dark"] .staff-tabs button.active em{background:#214B75!important']));
check('Dark Gantt progress labels use semantic dark colors rather than white',hasAll(styles,['html[data-theme="dark"] .gantt-bar{color:#123C67!important','status-in_progress{color:#6F3C08!important','status-dev_done','color:#3C3277!important','status-closed{color:#075A42!important']));
check('Old blanket white Gantt label is overridden later by v17.10 rules',styles.lastIndexOf('html[data-theme="dark"] .gantt-bar{color:#123C67!important')>styles.lastIndexOf('html[data-theme="dark"] .gantt-bar{color:#E8F0F8!important'));

check('v17.10 installs pg_net outside public schema on clean deployments',release1710.includes('create extension if not exists pg_net with schema extensions'));
check('QA processor deduplicates repeated physical delivery for the same logical event',hasAll(notificationFn,['seenQaEvents=new Set<string>()','qa_duplicate_logical_event']));


// v17.11 scoped mentions, guarded production email, optimistic UX and private auth
check('Signup UI is removed from Auth',!app.includes('db.auth.signUp(')&&app.includes('Acceso exclusivo para usuarios dados de alta por administración.'));
check('Helpdesk-only users can navigate to Mentions',app.includes("!['helpdesk','mentioned',...(canViewKnowledge?['knowledge']:[])].includes(view)"));
check('Mentioned view is available in desktop navigation',hasAll(app,["['mentioned','lucide:at-sign','Mencionados']",'mentionCount']));
check('Mentioned view is available in portal mobile navigation',app.includes("helpdeskOnly?[['helpdesk','lucide:life-buoy','Solicitudes'],['mentioned','lucide:at-sign','Mencionados']"));
check('Ticket and Helpdesk mentions have dedicated tables',hasAll(release1711,['create table if not exists public.ticket_mentions','create table if not exists public.helpdesk_mentions']));
check('Mention tables enforce one active mention per entity/user',hasAll(release1711,['unique(ticket_id,user_id)','unique(helpdesk_ticket_id,user_id)']));
check('Mentions are realtime with FULL replica identity',hasAll(release1711,['alter table public.ticket_mentions replica identity full','alter table public.helpdesk_mentions replica identity full','alter publication supabase_realtime add table public.ticket_mentions','alter publication supabase_realtime add table public.helpdesk_mentions']));
check('Mention RPC validates active workspace membership',hasAll(release1711,['public.mention_entity_users','workspace_members wm','wm.active=true']));
check('Mention RPC sends in-app only notification',hasAll(release1711,["'ticket_mention','mentions'","'helpdesk_mention','mentions'"])&&count(release1711,",false);")>=2);
check('Mentioned Jira users can read specific ticket without global product access',release1711.includes('or private.is_ticket_mentioned(id)'));
check('Mentioned Jira users can comment on specific ticket',release1711.includes('or private.is_ticket_mentioned(t.id)'));
check('Mentioned Helpdesk users can read specific request',release1711.includes('or private.is_helpdesk_mentioned(id)'));
check('Mentioned Helpdesk users can comment on specific request',release1711.includes('or private.is_helpdesk_mentioned(h.id)'));
check('Mentioned access does not broaden ticket update policy',!release1711.includes('drop policy if exists tickets_update'));
check('Mentioned access does not broaden Helpdesk update policy',!release1711.includes('drop policy if exists helpdesk_tickets_update'));
check('Comment modals expose MentionPicker',count(app,'<MentionPicker')>=2);
check('Comment submission persists mentions through RPC',count(app,"db.rpc('mention_entity_users'")>=2);
check('Notification drawer has Mentions category',hasAll(app,["mentions:'lucide:at-sign'","Menciones"]));
check('Assignment activity resolves UUID to a human name',hasAll(app,['const activityPerson=id=>','Asignado a →']));
check('Kanban move is optimistic and rolls back on failure',hasAll(app,['const previous={...(tickets.find(row=>row.id===ticket.id)||ticket)}','const optimisticAt=new Date().toISOString()','{...row,status,updated_at:optimisticAt}','?previous:row']));
check('Kanban quick assignment is optimistic and targeted',count(app,'const previous={...(tickets.find(row=>row.id===ticket.id)||ticket)}')>=2&&app.includes('reconcileTicketItem(ticket.id)'));
check('v17.11 Vercel config prevents stale app/style cache',fs.existsSync(new URL('./vercel.json',import.meta.url))&&read('./vercel.json').includes('no-cache, no-store, must-revalidate'));
check('Dark Gantt percent labels are black for maximum contrast',styles.includes('html[data-theme="dark"] .gantt-bar>*{color:#071019!important'));
check('Dark Staff counters have explicit blue background and readable text',hasAll(styles,['background:#173A64!important','color:#9CC7FF!important']));
check('Dark detail counters have explicit readable pills',hasAll(styles,['html[data-theme="dark"] .detail-tabs button em','background:#22384A!important','color:#A9D2FF!important']));
check('Email queue is intentionally reset for v17.11',release1711.includes('delete from public.notification_outbox;'));
check('Free-plan hourly cap has safety margin below SendPulse 50/hour',hasAll(release1711,['email_hourly_limit integer not null default 45','check (email_hourly_limit between 1 and 50)']));
check('Free-plan monthly cap has safety margin below SendPulse 12000/month',hasAll(release1711,['email_monthly_limit integer not null default 11000','check (email_monthly_limit between 1 and 12000)']));
check('Preferred production sender is TROBBU corporate domain',release1711.includes("email_sender_address text not null default 'helpdesk@trobbucollection.com'"));
check('Only high-value email families enter outbox',hasAll(release1711,["v_email_type_allowed boolean:=p_type in ('daily_jira_reminder','helpdesk_assigned','helpdesk_comment','helpdesk_closed','ticket_closed')",'p_email and v_email and v_email_type_allowed']));
check('Production processor blocks non-authenticated preferred sender',notificationFn.includes('production_sender_not_ready')&&notificationFn.includes('preferredSender'));
check('Email processor enforces hourly and monthly safety caps',hasAll(notificationFn,['email_hourly_limit','email_monthly_limit','hourRemaining','monthRemaining']));
check('Daily reminders yield to transactional capacity near monthly cap',notificationFn.includes('monthly_reserve_for_transactional_email'));
check('Daily production reminders only target users with open relevant work',hasAll(release1711,["coalesce(wr.code,'')<>'helpdesk_requester'","t.reporter_id=wm.user_id or t.dev_owner_id=wm.user_id or t.qa_owner_id=wm.user_id","h.assigned_to=wm.user_id"]));

// v17.17.0 acceptance checks are defined below.

// v17.15 acceptance: detail counters, vacation type label and attachment carousel
const runtimeApp=read('./app-v17.17.0.js');
const runtimeStyles=read('./styles-v17.17.0.css');
check('Versioned runtime app is byte-identical to source app',runtimeApp===app);
check('Versioned runtime CSS is byte-identical to source CSS',runtimeStyles===styles);
check('Index loads version-isolated JS asset',index.includes('src="./app-v17.17.0.js"'));
check('Index loads version-isolated CSS asset',index.includes('href="./styles-v17.17.0.css"'));
check('Ticket comment badge uses the exact rendered commentRows collection',hasAll(app,['Revisión y evidencias <DetailCounter rows={commentRows}','{commentRows.map(c=>']));
check('Ticket activity badge uses the exact rendered activityRows collection',hasAll(app,['Actividad <DetailCounter rows={activityRows}','{activityRows.map(a=>']));
check('Helpdesk comment badge uses the exact rendered commentRows collection',hasAll(app,['Comentarios <DetailCounter rows={commentRows}','{commentRows.map(c=>']));
check('Helpdesk follow-up badge uses the exact rendered followupRows collection',hasAll(app,['Seguimiento <DetailCounter rows={followupRows}','{followupRows.map(a=>']));
check('Detail loaders reject stale overlapping responses',count(app,'const sequence=++loadSequence.current')>=3&&count(app,'if(sequence!==loadSequence.current)return')>=3);
check('Detail row queries no longer depend on exact HEAD counters',!app.includes("ticket_comments').select('*',{count:'exact'}")&&!app.includes("helpdesk_comments').select('*',{count:'exact'}")&&!app.includes("sprint_comments').select('*',{count:'exact'}"));
check('Vacation type selection stores the exact selected type snapshot',hasAll(app,['requestTypeSnapshot','setRequestTypeSnapshot(next?{...next}:null)','selectedType=requestTypeSnapshot?.id===requestTypeId?requestTypeSnapshot']));
check('Vacation deduction label is keyed by selected type configuration',hasAll(app,["data-deducts={selectedType.deducts_from_balance===true?'true':'false'}","selectedType.deducts_from_balance===true?'Descuenta del saldo':'No descuenta del saldo'"]));
check('Attachment preview uses a centered dedicated backdrop',hasAll(app,["size==='preview'?'modal-backdrop-preview':''",'size="preview"'])&&hasAll(styles,['.modal-backdrop-preview{','align-items:center!important','justify-content:center!important']));
check('Attachment preview is exactly 90 percent viewport in both axes',hasAll(styles,['width:90vw!important','height:90dvh!important','max-width:90vw!important','max-height:90dvh!important']));
check('Attachment preview has in-modal carousel navigation',hasAll(app,['attachment-preview-nav prev','attachment-preview-nav next','Adjunto ${previewIndex+1} de ${allRows.length}','ArrowLeft','ArrowRight']));
check('Ticket, Sprint and Helpdesk galleries receive the full attachment collection',count(app,'galleryRows={attachments}')>=6);


// v17.17 Knowledge editor regression acceptance
const priorRuntimeApp=read('./app-v17.16.0.js');
check('v17.17 runtime is materially different from v17.16 bundle',runtimeApp!==priorRuntimeApp,crypto.createHash('sha256').update(runtimeApp).digest('hex'));
check('Active Knowledge editor has no Safe Writing UI or state',!app.includes('Escritura segura')&&!app.includes('knowledge-safe-writing-area')&&!app.includes('safeWriting'));
check('Link selection is persisted as a DOM-path bookmark',hasAll(app,['function knowledgeBookmarkFromRange','function knowledgeRangeFromBookmark','bookmarkRef=useRef(null)','bookmarkRef.current=knowledgeBookmarkFromRange']));
check('Link application restores bookmark instead of trusting stale browser selection',app.includes('knowledgeRangeFromBookmark(el,bookmarkRef.current)||restoreSelection()'));
check('Selected link insertion protects visible-text invariance',hasAll(app,['const beforeHtml=el.innerHTML','beforeText=knowledgeVisibleTextSnapshot(el)','if(!range.collapsed&&beforeText!==afterText)','el.innerHTML=beforeHtml']));
check('Rich link editor reports invalid or changed selection without mutating content',hasAll(app,['knowledge-link-error','Usa una URL https://, mailto: o tel: válida.','No se aplicó el enlace porque la selección cambió.']));
check('Active CSS contains no legacy safe-writing textarea rules',!styles.includes('knowledge-safe-writing-area'));
check('Active rich editor explicitly preserves live selection styling',hasAll(styles,['knowledge-rich-editor-live .knowledge-rich-surface','::selection']));
check('Knowledge persistence schema remains unchanged and backwards compatible',hasAll(app,["if(b.type==='richtext')return {...base,html:sanitizeKnowledgeHtml","content_blocks:clean"]));

console.log(`\nQA v17.17 summary: ${passed} passed, ${failures.length} failed.`);

if(failures.length){for(const f of failures)console.error(` - ${f.name}${f.detail?`: ${f.detail}`:''}`);process.exit(1)}
