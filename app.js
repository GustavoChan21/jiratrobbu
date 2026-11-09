/* Jira Interno TROBBU v15.5 · CSV + Helpdesk Request Types */
const { useEffect, useMemo, useState } = React

const cfg = window.JIRA_CONFIG || {}
if (!cfg.supabaseUrl || !cfg.supabasePublishableKey) throw new Error('Falta la configuración pública de Supabase en config.js')
const db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey)

const getAppUrl = () => {
  const configured = String(cfg.appUrl || '').trim()
  if (configured) return configured.endsWith('/') ? configured : configured + '/'
  const path = window.location.pathname.endsWith('/') ? window.location.pathname : window.location.pathname.replace(/[^/]*$/, '')
  return `${window.location.origin}${path || '/'}`
}

const generateAccessPassword = () => {
  const upper='ABCDEFGHJKLMNPQRSTUVWXYZ',lower='abcdefghijkmnopqrstuvwxyz',digits='23456789',symbols='!@#$%&*?'
  const all=upper+lower+digits+symbols,bytes=new Uint32Array(18);crypto.getRandomValues(bytes)
  const chars=[upper[bytes[0]%upper.length],lower[bytes[1]%lower.length],digits[bytes[2]%digits.length],symbols[bytes[3]%symbols.length]]
  for(let i=4;i<bytes.length;i++)chars.push(all[bytes[i]%all.length])
  for(let i=chars.length-1;i>0;i--){const j=bytes[i]% (i+1);[chars[i],chars[j]]=[chars[j],chars[i]]}
  return chars.join('')
}

const cleanupAuthUrl = () => {
  const authHash = /(?:access_token|refresh_token|error|error_description)=/.test(window.location.hash)
  const authQuery = /(?:code|token_hash|type)=/.test(window.location.search)
  if (authHash || authQuery) window.history.replaceState({}, document.title, getAppUrl())
}

const STATUS = [
  ['backlog','Backlog','lucide:circle-dashed'],
  ['todo','Por hacer','lucide:circle'],
  ['in_progress','En curso','lucide:loader-circle'],
  ['dev_done','Dev terminado','lucide:code-2'],
  ['qa_review','Revisión QA','lucide:scan-search'],
  ['qa_rejected','QA rechazado','lucide:circle-x'],
  ['qa_passed','QA aprobado','lucide:circle-check-big'],
  ['closed','Cerrado','lucide:badge-check']
]
const HELP_STATUS = [
  ['created','Creado','lucide:sparkles'],
  ['review','En revisión','lucide:search-check'],
  ['attended','Atendido','lucide:headset'],
  ['resolved','Resuelto','lucide:circle-check'],
  ['closed','Cerrado','lucide:badge-check']
]
const HELP_CATEGORY_LABELS = {
  general:'Otro / General',
  access:'Acceso a panel / permisos',
  incident:'Error / incidente',
  request:'Solicitud general',
  module:'Nuevo módulo',
  feature:'Nueva funcionalidad',
  new_requirement:'Nuevo requerimiento',
  data:'Datos / reporte',
  configuration:'Configuración'
}
const REQUIREMENT_STATUS_LABELS = {
  pending:'Pendiente de decisión',
  accepted_backlog:'Aceptado a Backlog',
  rejected:'Sugerencia rechazada'
}
const helpCategoryLabel = value => HELP_CATEGORY_LABELS[value] || value || 'General'
const requirementStatusLabel = value => REQUIREMENT_STATUS_LABELS[value] || value || 'Pendiente de decisión'
const isProposalCategory = value => ['module','feature','new_requirement'].includes(value)
const PRIORITIES = ['lowest','low','medium','high','highest','blocker']
const PRIORITY_LABELS = {lowest:'Muy baja',low:'Baja',medium:'Media',high:'Alta',highest:'Muy alta',blocker:'Bloqueante'}
const TYPES = ['task','bug','story','improvement']
const TYPE_LABELS = {task:'Tarea',bug:'Bug',story:'Historia',improvement:'Mejora'}
const LINK_TYPES = [['blocks','Bloquea a'],['blocked_by','Está bloqueado por'],['relates','Relacionado con'],['follows','Da seguimiento a']]
const LINK_LABELS = {blocks:'Bloquea a',blocked_by:'Está bloqueado por',relates:'Relacionado con',follows:'Da seguimiento a',followed_by:'Es seguido por'}
const CUSTOM_FIELD_TYPES = [['text','Texto corto'],['textarea','Texto largo'],['number','Número'],['date','Fecha'],['boolean','Sí / No'],['select','Selección'],['multiselect','Selección múltiple'],['url','URL']]
const CUSTOM_FIELD_TYPE_LABELS = Object.fromEntries(CUSTOM_FIELD_TYPES)
const STORY_POINTS = [1,2,3,4,5]
const STORY_POINT_LABELS = {1:'Muy simple',2:'Simple',3:'Intermedio',4:'Complejo',5:'Muy complejo'}
const ROLE_LABELS = {superadmin:'Superadmin',admin:'Admin',pm:'PM',dev:'Dev',qa:'QA',consulta:'Consulta'}
const ROLE_DESCRIPTIONS = {
  superadmin:'Control total del workspace. Siempre accede a todos los productos, módulos, configuración y pruebas.',
  admin:'Administra Staff, productos, configuración y toda la operación del workspace.',
  pm:'Gestiona planeación, Backlog, sprints, tickets, cronograma y seguimiento.',
  dev:'Trabaja tickets de desarrollo dentro de los productos asignados.',
  qa:'Trabaja revisión, rechazo, aprobación y evidencias dentro de los productos asignados.',
  consulta:'Acceso de solo lectura a dashboards, tableros, Backlog y cronograma de los productos autorizados.'
}
const PERMISSION_DEFS = [
  ['view_dashboard','Dashboards y estadísticas','lucide:chart-no-axes-combined'],
  ['view_tickets','Ver tickets y tableros','lucide:columns-3'],
  ['create_tickets','Crear tickets','lucide:ticket-plus'],
  ['edit_tickets','Editar y mover tickets','lucide:pencil'],
  ['delete_tickets','Eliminar tickets','lucide:trash-2'],
  ['manage_sprints','Backlog y sprints','lucide:list-todo'],
  ['qa_review','Revisión QA','lucide:scan-search'],
  ['manage_helpdesk','Mesa de Helpdesk','lucide:life-buoy'],
  ['manage_staff','Staff y Roles','lucide:users'],
  ['manage_products','Administrar productos','lucide:boxes'],
  ['manage_ticket_fields','Campos, módulos y tags','lucide:tags'],
  ['manage_settings','Configuración','lucide:settings']
]
const ROLE_DEFAULTS = {
  superadmin:Object.fromEntries(PERMISSION_DEFS.map(([k])=>[k,true])),
  admin:Object.fromEntries(PERMISSION_DEFS.map(([k])=>[k,true])),
  pm:{view_dashboard:true,view_tickets:true,create_tickets:true,edit_tickets:true,delete_tickets:true,manage_sprints:true,qa_review:true,manage_helpdesk:true,manage_staff:false,manage_products:false,manage_ticket_fields:true,manage_settings:false},
  dev:{view_dashboard:true,view_tickets:true,create_tickets:true,edit_tickets:true,delete_tickets:false,manage_sprints:false,qa_review:false,manage_helpdesk:false,manage_staff:false,manage_products:false,manage_ticket_fields:false,manage_settings:false},
  qa:{view_dashboard:true,view_tickets:true,create_tickets:true,edit_tickets:true,delete_tickets:false,manage_sprints:false,qa_review:true,manage_helpdesk:false,manage_staff:false,manage_products:false,manage_ticket_fields:false,manage_settings:false},
  consulta:{view_dashboard:true,view_tickets:true,create_tickets:false,edit_tickets:false,delete_tickets:false,manage_sprints:false,qa_review:false,manage_helpdesk:false,manage_staff:false,manage_products:false,manage_ticket_fields:false,manage_settings:false}
}
const roleDefinitionPermissions = roleDef => {
  const baseRole=roleDef?.base_role||roleDef?.code||'consulta'
  const base={...(ROLE_DEFAULTS[baseRole]||ROLE_DEFAULTS.consulta)}
  if(roleDef?.code==='superadmin'||baseRole==='superadmin') return {...ROLE_DEFAULTS.superadmin}
  const overrides=roleDef?.permissions||{}
  Object.keys(overrides).forEach(k=>{if(typeof overrides[k]==='boolean')base[k]=overrides[k]})
  return base
}
const effectivePermissions = (member,roleDef=null) => {
  const base=roleDefinitionPermissions(roleDef||{base_role:member?.role,code:member?.role})
  if(member?.role==='superadmin'||roleDef?.code==='superadmin') return {...ROLE_DEFAULTS.superadmin}
  const overrides=member?.permissions||{}
  Object.keys(overrides).forEach(k=>{if(typeof overrides[k]==='boolean')base[k]=overrides[k]})
  return base
}
const roleDisplayName = member => member?.role_template?.name || ROLE_LABELS[member?.role] || member?.role || 'Consulta'
const roleIsHelpdeskRequester = roleDef => roleDef?.code==='helpdesk_requester'
const roleNeedsProducts = (roleDef,memberOverrides={}) => {
  if(!roleDef)return true
  if(roleDef.code==='superadmin')return true
  const effective={...roleDefinitionPermissions(roleDef),...(memberOverrides||{})}
  return ['view_dashboard','view_tickets','create_tickets','edit_tickets','delete_tickets','manage_sprints','qa_review','manage_products'].some(k=>!!effective[k])
}

const EVIDENCE_TYPES = [['general','General'],['review','Revisión'],['rejection','Rechazo'],['fix','Fix / Corrección'],['closure','Cierre']]
const evidenceLabel = value => EVIDENCE_TYPES.find(x=>x[0]===value)?.[1] || value
const Icon = ({name,size=18}) => <iconify-icon icon={name} width={size} height={size}></iconify-icon>
const initials = value => String(value || '?').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()
const statusLabel = value => STATUS.find(x=>x[0]===value)?.[1] || value
const statusIcon = value => STATUS.find(x=>x[0]===value)?.[2] || 'lucide:circle'
const helpStatusLabel = value => HELP_STATUS.find(x=>x[0]===value)?.[1] || value
const helpStatusIcon = value => HELP_STATUS.find(x=>x[0]===value)?.[2] || 'lucide:circle'
const formatDate = value => value ? new Intl.DateTimeFormat('es-MX',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(`${value}T12:00:00`)) : '—'
const formatDateTime = value => value ? new Intl.DateTimeFormat('es-MX',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value)) : '—'
const toLocalDateTimeInput = value => {if(!value)return '';const d=new Date(value);if(Number.isNaN(d.getTime()))return '';const local=new Date(d.getTime()-d.getTimezoneOffset()*60000);return local.toISOString().slice(0,16)}
const localDateTimeToIso = value => value ? new Date(value).toISOString() : null
const slugify = value => String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')
const safeFileName = value => String(value||'archivo').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]+/g,'-').slice(-90)
const dateKey = d => {const x=new Date(d);const y=x.getFullYear(),m=String(x.getMonth()+1).padStart(2,'0'),day=String(x.getDate()).padStart(2,'0');return `${y}-${m}-${day}`}
const sameDate = (a,b) => a && b && String(a).slice(0,10)===String(b).slice(0,10)
const roleCanDashboard = role => !!ROLE_DEFAULTS[role]?.view_dashboard
const roleCanWork = role => !!ROLE_DEFAULTS[role]?.edit_tickets
const roleCanPlan = role => !!ROLE_DEFAULTS[role]?.manage_sprints
const roleCanAdmin = role => ['superadmin','admin'].includes(role)
const ticketProgress = status => ({backlog:0,todo:10,in_progress:45,dev_done:65,qa_review:78,qa_rejected:58,qa_passed:92,closed:100}[status]??0)
const daysBetween=(a,b)=>Math.round((new Date(`${b}T12:00:00`)-new Date(`${a}T12:00:00`))/86400000)
const importNorm = value => String(value??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
const IMPORT_TYPE_MAP = {tarea:'task',task:'task',bug:'bug',historia:'story',story:'story',mejora:'improvement',improvement:'improvement'}
const IMPORT_PRIORITY_MAP = {'muy baja':'lowest',lowest:'lowest',baja:'low',low:'low',media:'medium',medium:'medium',alta:'high',high:'high','muy alta':'highest',highest:'highest',bloqueante:'blocker',blocker:'blocker',critica:'blocker',critical:'blocker'}
const importDateValue = value => {
  const raw=String(value??'').trim(); if(!raw)return ''
  if(/^\d{4}-\d{2}-\d{2}$/.test(raw))return raw
  const slash=raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);if(slash)return `${slash[3]}-${String(slash[2]).padStart(2,'0')}-${String(slash[1]).padStart(2,'0')}`
  const n=Number(raw);if(Number.isFinite(n)&&n>20000&&n<70000){const d=new Date(Date.UTC(1899,11,30)+n*86400000);return d.toISOString().slice(0,10)}
  const d=new Date(raw);return Number.isNaN(d.getTime())?null:dateKey(d)
}
const importCell = (row,...names) => {
  const entries=Object.entries(row||{});for(const name of names){const n=importNorm(name).replace(/\*/g,'');const hit=entries.find(([k])=>importNorm(k).replace(/\*/g,'')===n);if(hit)return hit[1]}
  return ''
}


async function signedEvidenceRows(rows){
  return Promise.all((rows||[]).map(async row=>{
    const {data,error}=await db.storage.from('jira-evidence').createSignedUrl(row.storage_path,3600)
    return {...row,signed_url:error?null:data?.signedUrl||null}
  }))
}

async function uploadEvidenceFiles({workspaceId,scope,parentId,commentId,files,evidenceType='general',userId}){
  const list=Array.from(files||[]).slice(0,5)
  if(!list.length)return []
  const table=scope==='tickets'?'ticket_attachments':'sprint_attachments'
  const parentKey=scope==='tickets'?'ticket_id':'sprint_id'
  const inserted=[]
  for(const file of list){
    if(!file.type?.startsWith('image/'))throw new Error('Solo se permiten imágenes como evidencia.')
    if(file.size>10*1024*1024)throw new Error('Cada imagen debe pesar máximo 10 MB.')
    const path=`${workspaceId}/${scope}/${parentId}/${crypto.randomUUID()}-${safeFileName(file.name)}`
    const {error:uploadError}=await db.storage.from('jira-evidence').upload(path,file,{contentType:file.type,upsert:false})
    if(uploadError)throw uploadError
    const payload={workspace_id:workspaceId,[parentKey]:parentId,comment_id:commentId||null,uploaded_by:userId,storage_path:path,file_name:file.name,mime_type:file.type,size_bytes:file.size,evidence_type:evidenceType}
    const {data,error}=await db.from(table).insert(payload).select('*').single()
    if(error){await db.storage.from('jira-evidence').remove([path]);throw error}
    inserted.push(data)
  }
  return inserted
}

async function functionErrorMessage(error,data){
  if(data?.error)return data.error
  if(error?.context){
    try{const payload=await error.context.clone().json();if(payload?.error)return payload.error}catch{}
    try{const text=await error.context.clone().text();if(text)return text}catch{}
  }
  return error?.message||'La función no pudo completar la operación.'
}

function useSession(){
  const [session,setSession]=useState(null)
  const [loading,setLoading]=useState(true)
  useEffect(()=>{
    db.auth.getSession().then(({data})=>{setSession(data.session); if(data.session) cleanupAuthUrl(); setLoading(false)})
    const {data:{subscription}}=db.auth.onAuthStateChange((event,s)=>{setSession(s); if(s && ['SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED'].includes(event)) cleanupAuthUrl()})
    return ()=>subscription.unsubscribe()
  },[])
  return {session,loading}
}

function Auth(){
  const [mode,setMode]=useState('login')
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [confirmPassword,setConfirmPassword]=useState('')
  const [name,setName]=useState('')
  const [showPassword,setShowPassword]=useState(false)
  const [showConfirm,setShowConfirm]=useState(false)
  const [msg,setMsg]=useState('')
  const [submitting,setSubmitting]=useState(false)
  const signup=mode==='signup'
  const changeMode=next=>{setMode(next);setMsg('');setPassword('');setConfirmPassword('');setShowPassword(false);setShowConfirm(false)}
  const submit=async e=>{
    e.preventDefault();setSubmitting(true);setMsg('')
    try{
      if(signup&&password!==confirmPassword)throw new Error('Las contraseñas no coinciden.')
      const result=signup
        ? await db.auth.signUp({email,password,options:{data:{full_name:name.trim()},emailRedirectTo:getAppUrl()}})
        : await db.auth.signInWithPassword({email,password})
      if(result.error)throw result.error
      setMsg(signup?'Cuenta creada. Revisa tu correo para confirmar el acceso.':'Acceso correcto.')
    }catch(err){setMsg(err.message||String(err))}
    finally{setSubmitting(false)}
  }
  return <div className="auth-shell">
    <div className="auth-visual-copy" aria-hidden="true">
      <span className="auth-collection">TROBBU</span>
      <small>BOUTIQUE COLLECTION</small>
    </div>
    <div className={`auth-card luxury-auth-card ${signup?'signup':''}`}>
      <div className="auth-brand">
        <img src="./logo.svg" className="auth-logo" alt="TROBBU"/>
        <div className="auth-eyebrow-row"><i></i><span>JIRA INTERNO</span><i></i></div>
        <h1>{signup?'Crea tu cuenta':'Bienvenido de nuevo'}</h1>
        <p>{signup?'Solicita acceso para colaborar en tickets, sprints, QA y Helpdesk del equipo.':'Gestión de tickets, sprints, QA, Helpdesk y operación del equipo.'}</p>
      </div>
      <form onSubmit={submit} className="form auth-form">
        {signup&&<label>Nombre completo<div className="auth-input"><Icon name="lucide:user" size={18}/><input value={name} onChange={e=>setName(e.target.value)} required placeholder="Ej. Gustavo A. Mendoza" autoComplete="name"/></div></label>}
        <label>Correo<div className="auth-input"><Icon name="lucide:mail" size={18}/><input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="Ej. usuario@trobbu.com"/></div></label>
        <label>Contraseña<div className="auth-input"><Icon name="lucide:lock-keyhole" size={18}/><input type={showPassword?'text':'password'} autoComplete={signup?'new-password':'current-password'} minLength="6" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="Mínimo 6 caracteres"/><button type="button" className="auth-eye" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?'Ocultar contraseña':'Mostrar contraseña'}><Icon name={showPassword?'lucide:eye-off':'lucide:eye'} size={18}/></button></div></label>
        {signup&&<label>Confirmar contraseña<div className="auth-input"><Icon name="lucide:lock-keyhole" size={18}/><input type={showConfirm?'text':'password'} autoComplete="new-password" minLength="6" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} required placeholder="Repite tu contraseña"/><button type="button" className="auth-eye" onClick={()=>setShowConfirm(v=>!v)} aria-label={showConfirm?'Ocultar contraseña':'Mostrar contraseña'}><Icon name={showConfirm?'lucide:eye-off':'lucide:eye'} size={18}/></button></div></label>}
        {signup&&<p className="auth-legal">Al continuar aceptas las políticas internas de acceso y uso de la plataforma.</p>}
        <button type="submit" className="primary full auth-submit" disabled={submitting}>{submitting?'Procesando…':signup?'Crear cuenta':'Iniciar sesión'}<Icon name="lucide:arrow-right" size={18}/></button>
      </form>
      <div className="auth-divider"><i></i><Icon name="lucide:sun-medium" size={18}/><i></i></div>
      <button type="button" className="auth-switch" onClick={()=>changeMode(signup?'login':'signup')}>{signup?'Ya tengo una cuenta':'Crear una cuenta'}</button>
      {msg&&<div className="notice auth-message">{msg}</div>}
    </div>
  </div>
}
function App(){
  const {session,loading}=useSession()
  if(loading) return <div className="center loading-screen"><span className="loader"></span><span>Cargando Jira Interno…</span></div>
  if(!session) return <Auth />
  return <WorkspaceApp session={session}/>
}

function WorkspaceApp({session}){
  const [memberships,setMemberships]=useState([])
  const [workspace,setWorkspace]=useState(null)
  const [products,setProducts]=useState([])
  const [sprints,setSprints]=useState([])
  const [tickets,setTickets]=useState([])
  const [members,setMembers]=useState([])
  const [memberProductAccess,setMemberProductAccess]=useState([])
  const [roleTemplates,setRoleTemplates]=useState([])
  const [settings,setSettings]=useState(null)
  const [departments,setDepartments]=useState([])
  const [requestTypes,setRequestTypes]=useState([])
  const [helpdesk,setHelpdesk]=useState([])
  const [notifications,setNotifications]=useState([])
  const [emailQueue,setEmailQueue]=useState([])
  const [emailProviderStatus,setEmailProviderStatus]=useState(null)
  const [modules,setModules]=useState([])
  const [tags,setTags]=useState([])
  const [ticketTagLinks,setTicketTagLinks]=useState([])
  const [ticketLinks,setTicketLinks]=useState([])
  const [customFields,setCustomFields]=useState([])
  const [customFieldProducts,setCustomFieldProducts]=useState([])
  const [customValues,setCustomValues]=useState([])
  const [view,setView]=useState('board')
  const [boardMode,setBoardMode]=useState('table')
  const [productId,setProductId]=useState('all')
  const [search,setSearch]=useState('')
  const [filters,setFilters]=useState({status:'all',assignee:'all',sprint:'all',priority:'all',type:'all',module:'all',tag:'all'})
  const [helpFilters,setHelpFilters]=useState({status:'all',requestType:'all',department:'all',assignee:'all',priority:'all'})
  const [busy,setBusy]=useState(true)
  const [modal,setModal]=useState(null)
  const [drawer,setDrawer]=useState(null)
  const [toast,setToast]=useState(null)

  const showToast=(type,message)=>{setToast({type,message,id:Date.now()}); setTimeout(()=>setToast(null),3500)}

  const loadMemberships=async(preferredId=null)=>{
    const {data,error}=await db.from('workspace_members').select('workspace_id,role,role_id,active,permissions,all_products,workspaces(id,name,slug,created_by)').eq('user_id',session.user.id).eq('active',true)
    if(error){showToast('error',error.message);setBusy(false);return []}
    const rows=data||[]; setMemberships(rows)
    const id=preferredId || workspace?.id
    const selected=rows.find(x=>x.workspace_id===id)?.workspaces || rows[0]?.workspaces || null
    setWorkspace(selected)
    return rows
  }

  const loadWorkspaceData=async()=>{
    if(!workspace){setBusy(false);return}
    setBusy(true)
    const [p,s,t,m,mp,wr,ws,d,rt,h,n,q,mods,tagsQ,tagLinks,links,fields,fieldProducts,values]=await Promise.all([
      db.from('products').select('*').eq('workspace_id',workspace.id).order('board_order'),
      db.from('sprints').select('*').eq('workspace_id',workspace.id).order('created_at',{ascending:false}),
      db.from('tickets').select('*').eq('workspace_id',workspace.id).order('updated_at',{ascending:false}),
      db.from('workspace_members').select('user_id,role,role_id,active,joined_at,permissions,all_products').eq('workspace_id',workspace.id).order('joined_at'),
      db.from('workspace_member_products').select('user_id,product_id').eq('workspace_id',workspace.id),
      db.from('workspace_roles').select('*').eq('workspace_id',workspace.id).order('created_at'),
      db.from('workspace_settings').select('*').eq('workspace_id',workspace.id).maybeSingle(),
      db.from('helpdesk_departments').select('*').eq('workspace_id',workspace.id).order('name'),
      db.from('helpdesk_request_types').select('*').eq('workspace_id',workspace.id).order('sort_order').order('name'),
      db.from('helpdesk_tickets').select('*').eq('workspace_id',workspace.id).order('updated_at',{ascending:false}),
      db.from('notifications').select('*').eq('workspace_id',workspace.id).order('created_at',{ascending:false}).limit(100),
      db.from('notification_outbox').select('id,event_type,status,attempts,last_error,created_at,sent_at,recipient_user_id').eq('workspace_id',workspace.id).order('created_at',{ascending:false}).limit(100),
      db.from('ticket_modules').select('*').eq('workspace_id',workspace.id).order('name'),
      db.from('ticket_tags').select('*').eq('workspace_id',workspace.id).order('name'),
      db.from('ticket_tag_links').select('*').eq('workspace_id',workspace.id),
      db.from('ticket_links').select('*').eq('workspace_id',workspace.id).order('created_at'),
      db.from('custom_ticket_fields').select('*').eq('workspace_id',workspace.id).order('sort_order').order('name'),
      db.from('custom_ticket_field_products').select('*').eq('workspace_id',workspace.id),
      db.from('ticket_custom_field_values').select('*').eq('workspace_id',workspace.id)
    ])
    const fail=[p,s,t,m,mp,wr,ws,d,rt,h,n,q,mods,tagsQ,tagLinks,links,fields,fieldProducts,values].find(x=>x.error)?.error
    if(fail){showToast('error',fail.message);setBusy(false);return}
    const ids=(m.data||[]).map(x=>x.user_id)
    const profileMap={}
    if(ids.length){const pr=await db.from('profiles').select('*').in('id',ids); (pr.data||[]).forEach(x=>profileMap[x.id]=x)}
    const roles=wr.data||[]
    setProducts(p.data||[]); setSprints(s.data||[]); setTickets(t.data||[]); setRoleTemplates(roles); setSettings(ws.data||null)
    setDepartments(d.data||[]); setRequestTypes(rt.data||[]); setHelpdesk(h.data||[]); setNotifications(n.data||[]); setEmailQueue(q.data||[]); setMemberProductAccess(mp.data||[])
    setModules(mods.data||[]); setTags(tagsQ.data||[]); setTicketTagLinks(tagLinks.data||[]); setTicketLinks(links.data||[]); setCustomFields(fields.data||[]); setCustomFieldProducts(fieldProducts.data||[]); setCustomValues(values.data||[])
    setMembers((m.data||[]).map(x=>({...x,profile:profileMap[x.user_id],role_template:roles.find(r=>r.id===x.role_id)||roles.find(r=>r.code===x.role),product_ids:(mp.data||[]).filter(a=>a.user_id===x.user_id).map(a=>a.product_id)})))
    setBusy(false)
  }

  const myMembership=memberships.find(m=>m.workspace_id===workspace?.id)||null
  const myRole=myMembership?.role || 'consulta'
  const myRoleTemplate=roleTemplates.find(r=>r.id===myMembership?.role_id)||roleTemplates.find(r=>r.code===myRole)||null
  const myPermissions=effectivePermissions(myMembership,myRoleTemplate)
  const hasPermission=key=>myRole==='superadmin'||!!myPermissions[key]
  const isSuperadmin=myRole==='superadmin'
  const canViewDashboard=hasPermission('view_dashboard')
  const canViewTickets=hasPermission('view_tickets')
  const canCreateTicket=hasPermission('create_tickets')
  const canWork=hasPermission('edit_tickets')
  const canDeleteTicket=hasPermission('delete_tickets')
  const canPlan=hasPermission('manage_sprints')
  const canManageHelpdesk=hasPermission('manage_helpdesk')
  const canManageStaff=hasPermission('manage_staff')
  const canManageProducts=hasPermission('manage_products')
  const canManageSettings=hasPermission('manage_settings')
  const canManageTicketFields=hasPermission('manage_ticket_fields')
  const canAdminWorkspace=canManageStaff||canManageProducts||canManageSettings
  const dashboardOnly=!canWork
  const helpdeskStaff=canManageHelpdesk
  const canManage=canPlan
  const isAdmin=canAdminWorkspace
  const helpdeskEnabled=settings?.helpdesk_enabled!==false
  const helpdeskOnly=helpdeskEnabled && roleIsHelpdeskRequester(myRoleTemplate)
  const myRoleName=myRoleTemplate?.name||ROLE_LABELS[myRole]||myRole
  const workspaces=memberships.map(m=>({...m.workspaces,role:m.role,role_id:m.role_id})).filter(Boolean)
  const unread=notifications.filter(n=>!n.read_at).length

  useEffect(()=>{loadMemberships().then(()=>setBusy(false))},[])
  useEffect(()=>{loadWorkspaceData()},[workspace?.id])
  useEffect(()=>{
    if(!workspace?.id) return
    setProductId('all')
    setSearch('')
    setFilters({status:'all',assignee:'all',sprint:'all',priority:'all',type:'all',module:'all',tag:'all'})
    setHelpFilters({status:'all',requestType:'all',department:'all',assignee:'all',priority:'all'})
    setDrawer(null)
    setModal(null)
  },[workspace?.id])
  useEffect(()=>{
    if(!workspace?.id) return
    let active=true
    const poll=async()=>{
      const {data}=await db.from('notifications').select('*').eq('workspace_id',workspace.id).order('created_at',{ascending:false}).limit(100)
      if(active && data) setNotifications(data)
    }
    const timer=setInterval(poll,15000)
    const onFocus=()=>poll()
    window.addEventListener('focus',onFocus)
    return ()=>{active=false;clearInterval(timer);window.removeEventListener('focus',onFocus)}
  },[workspace?.id])
  useEffect(()=>{
    if(!workspace?.id) return
    let cancelled=false
    db.functions.invoke('process-notifications',{body:{workspace_id:workspace.id,status_only:true}}).then(({data,error})=>{if(!cancelled)setEmailProviderStatus(error?{configured:false,error:error.message}:data||null)}).catch(err=>{if(!cancelled)setEmailProviderStatus({configured:false,error:err.message||String(err)})})
    return ()=>{cancelled=true}
  },[workspace?.id,settings?.email_notifications])
  useEffect(()=>{if(settings?.helpdesk_enabled===false && view==='helpdesk')setView(canViewDashboard?'overview':'mytasks')},[settings?.helpdesk_enabled,view,canViewDashboard])
  useEffect(()=>{if(search.trim() && canViewTickets && !['board','mytasks'].includes(view))setView('board')},[search,canViewTickets])
  useEffect(()=>{
    if(!workspace?.id)return
    if(helpdeskOnly && view!=='helpdesk'){setView('helpdesk');return}
    if(!canViewDashboard && !['mytasks','helpdesk'].includes(view)) setView(helpdeskEnabled?'helpdesk':'mytasks')
    if(canViewDashboard && !canWork && !['overview','board','backlog','timeline','helpdesk'].includes(view)) setView('overview')
    if(!canManageStaff && view==='team') setView(canViewDashboard?'overview':helpdeskEnabled?'helpdesk':'mytasks')
    if(!(canManageSettings||canManageProducts) && view==='settings') setView(canViewDashboard?'overview':helpdeskEnabled?'helpdesk':'mytasks')
    if(!canManageTicketFields && view==='catalogs') setView(canViewDashboard?'overview':helpdeskEnabled?'helpdesk':'mytasks')
    if(!canViewDashboard && view==='reports') setView(helpdeskEnabled?'helpdesk':'mytasks')
  },[workspace?.id,myRole,myRoleTemplate?.id,helpdeskOnly,helpdeskEnabled])
  useEffect(()=>{
    const onKey=e=>{
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'&&canViewTickets){
        e.preventDefault()
        document.getElementById('global-ticket-search')?.focus()
      }
    }
    window.addEventListener('keydown',onKey)
    return ()=>window.removeEventListener('keydown',onKey)
  },[canViewTickets])

  const filteredTickets=useMemo(()=>tickets.filter(t=>{
    const q=search.trim().toLowerCase()
    return (productId==='all'||t.product_id===productId)
      && (filters.status==='all'||t.status===filters.status)
      && (filters.assignee==='all'||t.dev_owner_id===filters.assignee||t.qa_owner_id===filters.assignee)
      && (filters.sprint==='all'||t.sprint_id===filters.sprint)
      && (filters.priority==='all'||t.priority===filters.priority)
      && (filters.type==='all'||t.type===filters.type)
      && (filters.module==='all'||t.module_id===filters.module)
      && (filters.tag==='all'||ticketTagLinks.some(x=>x.ticket_id===t.id&&x.tag_id===filters.tag))
      && (!q||`${t.ticket_key||''} ${t.title||''} ${t.description||''} ${modules.find(m=>m.id===t.module_id)?.name||''} ${ticketTagLinks.filter(x=>x.ticket_id===t.id).map(x=>tags.find(tag=>tag.id===x.tag_id)?.name||'').join(' ')}`.toLowerCase().includes(q))
  }),[tickets,productId,filters,search,ticketTagLinks,tags,modules])

  const myTickets=useMemo(()=>filteredTickets.filter(t=>t.dev_owner_id===session.user.id||t.qa_owner_id===session.user.id||t.reporter_id===session.user.id),[filteredTickets,session.user.id])
  const filteredHelpdesk=useMemo(()=>helpdesk.filter(h=>(helpFilters.status==='all'||h.status===helpFilters.status)&&(helpFilters.requestType==='all'||h.request_type_id===helpFilters.requestType)&&(helpFilters.department==='all'||h.department_id===helpFilters.department)&&(helpFilters.assignee==='all'||h.assigned_to===helpFilters.assignee)&&(helpFilters.priority==='all'||h.priority===helpFilters.priority)),[helpdesk,helpFilters])

  const refresh=async()=>{await loadWorkspaceData()}
  const runEmails=()=>{if(settings?.email_notifications) db.functions.invoke('process-notifications',{body:{workspace_id:workspace.id}}).catch(()=>{})}

  const createWorkspace=async({name})=>{
    const base=slugify(name)||'workspace'; const slug=`${base}-${Math.random().toString(36).slice(2,6)}`
    const {data,error}=await db.rpc('create_workspace',{p_name:name,p_slug:slug})
    if(error) throw error
    await loadMemberships(data); showToast('success','Espacio de trabajo creado.')
  }

  const saveTicket=async(form,ticket=null)=>{
    if(ticket && !canWork) throw new Error('Tu rol no permite editar tickets.')
    const {tag_ids=[],custom_values={},...core}=form
    const sp=core.story_points===''||core.story_points==null?null:Number(core.story_points)
    if(sp!==null&&!STORY_POINTS.includes(sp)) throw new Error('Story Points debe ser un valor entre 1 y 5.')
    const productId=core.product_id
    const applicableFields=customFields.filter(cf=>cf.active&&(cf.applies_to_all_products||customFieldProducts.some(fp=>fp.field_id===cf.id&&fp.product_id===productId)))
    for(const field of applicableFields){
      const raw=custom_values[field.id],empty=raw===undefined||raw===null||raw===''||(Array.isArray(raw)&&raw.length===0)
      if(field.required&&empty) throw new Error(`El campo ${field.name} es obligatorio.`)
    }
    const params={
      p_ticket_id:ticket?.id||null,
      p_workspace:workspace.id,
      p_product_id:productId,
      p_title:core.title,
      p_description:core.description||null,
      p_type:core.type||'task',
      p_priority:core.priority||'medium',
      p_status:!canWork&&!ticket?'backlog':(core.status||ticket?.status||'backlog'),
      p_sprint_id:!canWork&&!ticket?null:(core.sprint_id||null),
      p_dev_owner_id:!canWork&&!ticket?null:(core.dev_owner_id||null),
      p_qa_owner_id:!canWork&&!ticket?null:(core.qa_owner_id||null),
      p_story_points:!canWork&&!ticket?null:sp,
      p_start_date:!canWork&&!ticket?null:(core.start_date||null),
      p_due_date:!canWork&&!ticket?null:(core.due_date||null),
      p_module_id:core.module_id||null,
      p_tag_ids:tag_ids,
      p_custom_values:custom_values
    }
    const {data,error}=await db.rpc('save_ticket_documented',params)
    if(error)throw error
    await refresh();runEmails();showToast('success',ticket?'Ticket actualizado.':'Ticket enviado a Backlog.')
    return data
  }

  const deleteTicket=async ticket=>{
    const {error}=await db.from('tickets').delete().eq('id',ticket.id); if(error) throw error
    await refresh(); showToast('success','Ticket eliminado.')
  }

  const moveTicket=async(ticket,status)=>{
    if(!canWork) return showToast('error','Tu rol no permite cambiar estados.')
    const {error}=await db.rpc('transition_ticket_status',{p_ticket_id:ticket.id,p_status:status,p_override_blockers:false,p_note:null})
    if(error){
      if(/bloquead/i.test(error.message||'')&&(myRole==='admin'||myRole==='superadmin')){setModal({type:'dependency-override',ticket,status});return}
      return showToast('error',error.message)
    }
    await refresh(); runEmails()
  }

  const closeSprintAndRollover=async(sprint,nextSprintId)=>{
    if(!canPlan) throw new Error('Tu rol no permite cerrar sprints.')
    const {data,error}=await db.rpc('close_sprint_and_rollover',{p_sprint_id:sprint.id,p_next_sprint_id:nextSprintId||null})
    if(error)throw error
    await refresh();showToast('success',`${data?.moved||0} tickets no resueltos fueron trasladados.`)
    return data
  }

  const planTicket=async(ticket,sprintId)=>{
    if(!canPlan)throw new Error('Tu rol no permite planificar tickets.')
    const sprint=sprints.find(s=>s.id===sprintId)
    const payload=sprintId
      ? {sprint_id:sprintId,status:ticket.status==='backlog'?'todo':ticket.status,start_date:ticket.start_date||sprint?.start_date||null,due_date:ticket.due_date||sprint?.end_date||null}
      : {sprint_id:null,status:'backlog',start_date:null,due_date:null}
    const {error}=await db.from('tickets').update(payload).eq('id',ticket.id)
    if(error)throw error
    await refresh();showToast('success',sprintId?'Ticket agregado al sprint y reflejado en el Timeline.':'Ticket regresado al Backlog y retirado del Timeline.')
  }

  const saveHelpdesk=async(form,item=null)=>{
    const selectedType=requestTypes.find(x=>x.id===form.request_type_id)||requestTypes.find(x=>x.id===item?.request_type_id)
    const mappedCategory=selectedType?(selectedType.code==='requirement'?'new_requirement':selectedType.code==='incident'?'incident':selectedType.code==='access'?'access':selectedType.code==='configuration'?'configuration':'general'):(item?.category||'general')
    const isRequirement=isProposalCategory(mappedCategory)||isProposalCategory(item?.category)
    const base={
      department_id:form.department_id||null,
      request_type_id:form.request_type_id||item?.request_type_id||null,
      subject:form.subject,
      description:form.description||null,
      requester_name:form.requester_name||null,
      requester_email:form.requester_email||session.user.email,
      category:mappedCategory,
      priority:form.priority||'medium',
      source:form.source||'internal'
    }
    const payload=item
      ? (canManageHelpdesk
          ? (isRequirement?base:{...base,status:form.status,assigned_to:form.assigned_to||null,due_at:localDateTimeToIso(form.due_at)})
          : base)
      : {...base,source:'portal',workspace_id:workspace.id,requester_user_id:session.user.id,status:'created',assigned_to:null,due_at:null}
    const result=item ? await db.from('helpdesk_tickets').update(payload).eq('id',item.id) : await db.from('helpdesk_tickets').insert(payload)
    if(result.error) throw result.error
    await refresh(); showToast('success',item?'Solicitud actualizada.':isRequirement?'Nuevo requerimiento enviado para decisión.':'Solicitud de soporte creada.')
  }

  const decideRequirement=async(item,decision,productId,note)=>{
    if(!canPlan)throw new Error('Tu rol no permite decidir nuevos requerimientos.')
    const {data,error}=await db.rpc('decide_helpdesk_requirement',{p_helpdesk_id:item.id,p_decision:decision,p_product_id:decision==='accepted_backlog'?productId:null,p_note:note||null})
    if(error)throw error
    await refresh();runEmails()
    showToast('success',decision==='accepted_backlog'?`Requerimiento aceptado a Backlog${data?.ticket_key?` como ${data.ticket_key}`:''}.`:'Sugerencia rechazada y notificada al solicitante.')
    return data
  }

  const deleteHelpdesk=async item=>{
    const {error}=await db.from('helpdesk_tickets').delete().eq('id',item.id); if(error) throw error
    await refresh(); showToast('success','Solicitud eliminada.')
  }

  const markNotification=async(id,read=true)=>{
    const {error}=await db.from('notifications').update({read_at:read?new Date().toISOString():null}).eq('id',id)
    if(error) return showToast('error',error.message)
    setNotifications(n=>n.map(x=>x.id===id?{...x,read_at:read?new Date().toISOString():null}:x))
  }
  const markAll=async()=>{
    const ids=notifications.filter(n=>!n.read_at).map(n=>n.id); if(!ids.length) return
    const now=new Date().toISOString(); const {error}=await db.from('notifications').update({read_at:now}).in('id',ids)
    if(error) return showToast('error',error.message)
    setNotifications(n=>n.map(x=>({...x,read_at:x.read_at||now})))
  }
  const deleteNotification=async id=>{
    const {error}=await db.from('notifications').delete().eq('id',id)
    if(error) return showToast('error',error.message)
    setNotifications(n=>n.filter(x=>x.id!==id))
  }
  const clearReadNotifications=async()=>{
    const ids=notifications.filter(n=>n.read_at).map(n=>n.id)
    if(!ids.length) return
    const {error}=await db.from('notifications').delete().in('id',ids)
    if(error) return showToast('error',error.message)
    setNotifications(n=>n.filter(x=>!x.read_at))
  }
  const processEmails=async()=>{
    const {data,error}=await db.functions.invoke('process-notifications',{body:{workspace_id:workspace.id}})
    if(error) throw error
    if(data)setEmailProviderStatus(data)
    await refresh()
    return data
  }

  if(!workspace && !busy) return <EmptyWorkspace onCreate={()=>setModal({type:'workspace-create'})}/>

  return <div className="app-shell">
    <Topbar session={session} unread={unread} search={search} setSearch={setSearch} canSearch={canViewTickets} portalOnly={helpdeskOnly} canCreate={canCreateTicket} onCreate={()=>setModal({type:'ticket-create'})} onNotifications={()=>setDrawer('notifications')} onAppSwitcher={()=>setModal({type:'workspace-switch'})} onHelp={()=>setModal({type:'quick-help'})}/>
    <Sidebar workspace={workspace} workspaces={workspaces} products={products} productId={productId} setProductId={setProductId} view={view} setView={setView} tickets={tickets} helpdesk={helpdesk} helpdeskEnabled={helpdeskEnabled} role={myRole} roleName={myRoleName} helpdeskOnly={helpdeskOnly} canManageStaff={canManageStaff} canManageSettings={canManageSettings||canManageProducts} canManageTicketFields={canManageTicketFields} canViewDashboard={canViewDashboard} onWorkspace={()=>setModal({type:'workspace-switch'})}/>
    <MobileNav view={view} setView={setView} setProductId={setProductId} helpdeskEnabled={helpdeskEnabled} role={myRole} helpdeskOnly={helpdeskOnly} canManageStaff={canManageStaff} canManageSettings={canManageSettings||canManageProducts} canManageTicketFields={canManageTicketFields} canViewDashboard={canViewDashboard}/>
    <main className="main-area">
      {busy ? <LoadingPanel/> : <>
        {view==='overview' && canViewDashboard && <Overview workspace={workspace} tickets={tickets} helpdesk={helpdesk} products={products} sprints={sprints}/>} 
        {view==='board' && canViewDashboard && <TicketWorkspace workspace={workspace} title="Tablero" subtitle="Consulta, filtra y gestiona tickets del equipo." tickets={filteredTickets} allTickets={tickets} products={products} members={members} sprints={sprints} boardMode={boardMode} setBoardMode={setBoardMode} filters={filters} onFilter={()=>setModal({type:'ticket-filters'})} onClearFilters={()=>setFilters({status:'all',assignee:'all',sprint:'all',priority:'all',type:'all',module:'all',tag:'all'})} canWork={canWork} canPlan={canPlan} canDelete={canDeleteTicket} canCreate={canCreateTicket} onCreate={()=>setModal({type:'ticket-create'})} onActions={ticket=>setModal({type:'ticket-actions',ticket})} onOpen={ticket=>setModal({type:'ticket-detail',ticket})} onEdit={ticket=>setModal({type:'ticket-edit',ticket})} onDelete={ticket=>setModal({type:'ticket-delete',ticket})} onBacklog={ticket=>planTicket(ticket,null)} onSprint={sprint=>setModal({type:'sprint-detail',sprint})} onMove={moveTicket}/>} 
        {view==='timeline' && canViewDashboard && <GanttView workspace={workspace} tickets={filteredTickets} products={products} sprints={sprints} members={members} modules={modules} ticketLinks={ticketLinks} onOpen={ticket=>setModal({type:'ticket-detail',ticket})} onEdit={ticket=>setModal({type:'ticket-edit',ticket})} onDelete={ticket=>setModal({type:'ticket-delete',ticket})} onBacklog={ticket=>planTicket(ticket,null)} onSprint={sprint=>setModal({type:'sprint-detail',sprint})} canWork={canWork} canPlan={canPlan} canDelete={canDeleteTicket}/>}
        {view==='backlog' && canViewDashboard && <BacklogView workspace={workspace} tickets={tickets} products={products} sprints={sprints} members={members} modules={modules} tags={tags} ticketTagLinks={ticketTagLinks} canPlan={canPlan} onTicket={ticket=>setModal({type:'ticket-detail',ticket})} onPlan={ticket=>setModal({type:'ticket-plan',ticket})} onSprint={sprint=>setModal({type:'sprint-detail',sprint})} onCloseSprint={sprint=>setModal({type:'sprint-rollover',sprint})} onCreateSprint={()=>setModal({type:'sprint-create'})} onImport={()=>setModal({type:'backlog-import'})}/>} 
        {view==='mytasks' && <TicketWorkspace workspace={workspace} title="Mis tareas" subtitle="Tickets que reportaste o que tienes asignados." tickets={myTickets} allTickets={myTickets} products={products} members={members} sprints={sprints} boardMode={boardMode} setBoardMode={setBoardMode} filters={filters} onFilter={()=>setModal({type:'ticket-filters'})} onClearFilters={()=>setFilters({status:'all',assignee:'all',sprint:'all',priority:'all',type:'all',module:'all',tag:'all'})} canWork={canWork} canPlan={canPlan} canDelete={canDeleteTicket} canCreate={canCreateTicket} onCreate={()=>setModal({type:'ticket-create'})} onActions={ticket=>setModal({type:'ticket-actions',ticket})} onOpen={ticket=>setModal({type:'ticket-detail',ticket})} onEdit={ticket=>setModal({type:'ticket-edit',ticket})} onDelete={ticket=>setModal({type:'ticket-delete',ticket})} onBacklog={ticket=>planTicket(ticket,null)} onSprint={sprint=>setModal({type:'sprint-detail',sprint})} onMove={moveTicket}/>} 
        {view==='helpdesk' && helpdeskEnabled && (helpdeskStaff
          ? <HelpdeskView items={filteredHelpdesk} allItems={helpdesk} departments={departments} requestTypes={requestTypes} members={members} canPlan={canPlan} filters={helpFilters} onFilter={()=>setModal({type:'help-filters'})} onCreate={()=>setModal({type:'help-create'})} onActions={item=>setModal({type:'help-actions',item})} onOpen={item=>setModal({type:'help-detail',item})} onDecision={item=>setModal({type:'help-requirement-decision',item})}/>
          : <HelpdeskPortal items={helpdesk} departments={departments} requestTypes={requestTypes} onCreate={()=>setModal({type:'help-create'})} onOpen={item=>setModal({type:'help-detail',item})}/>)} 
        {view==='reports' && canViewDashboard && <ReportsView workspace={workspace} products={products} modules={modules} tickets={tickets} sprints={sprints} toast={showToast}/>}
        {view==='catalogs' && canManageTicketFields && <TicketCatalogsView workspace={workspace} modules={modules} tags={tags} customFields={customFields} tickets={tickets} ticketTagLinks={ticketTagLinks} canManage={canManageTicketFields} onModuleCreate={()=>setModal({type:'module-create'})} onModuleEdit={module=>setModal({type:'module-edit',module})} onModuleDelete={module=>setModal({type:'module-delete',module})} onTagCreate={()=>setModal({type:'tag-create'})} onTagEdit={tag=>setModal({type:'tag-edit',tag})} onTagDelete={tag=>setModal({type:'tag-delete',tag})} onFieldCreate={()=>setModal({type:'field-create'})} onFieldEdit={field=>setModal({type:'field-edit',field})} onFieldDelete={field=>setModal({type:'field-delete',field})}/>}
        {view==='team' && canManageStaff && <StaffRolesView workspace={workspace} members={members} products={products} memberProductAccess={memberProductAccess} roleTemplates={roleTemplates} canManage={canManageStaff} isSuperadmin={isSuperadmin} session={session} onInvite={()=>setModal({type:'invite'})} onMember={member=>setModal({type:'member-edit',member})} onRoleCreate={()=>setModal({type:'role-create'})} onRoleEdit={role=>setModal({type:'role-edit',role})} onRoleDelete={role=>setModal({type:'role-delete',role})}/>} 
        {view==='settings' && (canManageSettings||canManageProducts) && <SettingsView workspace={workspace} settings={settings} products={products} sprints={sprints} departments={departments} requestTypes={requestTypes} emailQueue={emailQueue} emailProviderStatus={emailProviderStatus} canManageSettings={canManageSettings} canManageProducts={canManageProducts} canPlan={canPlan} canDeleteWorkspace={isSuperadmin} onWorkspaceEdit={()=>setModal({type:'workspace-edit'})} onWorkspaceConfig={()=>setModal({type:'workspace-config'})} onWorkspaceDelete={()=>setModal({type:'workspace-delete'})} onSettingsSaved={refresh} onProductCreate={()=>setModal({type:'product-create'})} onProductEdit={product=>setModal({type:'product-edit',product})} onProductDelete={product=>setModal({type:'product-delete',product})} onSprintCreate={()=>setModal({type:'sprint-create'})} onSprintEdit={sprint=>setModal({type:'sprint-edit',sprint})} onSprintDelete={sprint=>setModal({type:'sprint-delete',sprint})} onDepartmentCreate={()=>setModal({type:'department-create'})} onDepartmentEdit={department=>setModal({type:'department-edit',department})} onDepartmentDelete={department=>setModal({type:'department-delete',department})} onRequestTypeCreate={()=>setModal({type:'request-type-create'})} onRequestTypeEdit={requestType=>setModal({type:'request-type-edit',requestType})} onRequestTypeDelete={requestType=>setModal({type:'request-type-delete',requestType})} onProcessEmails={processEmails} toast={showToast}/>} 
      </>}
    </main>
    {drawer==='notifications' && <NotificationsDrawer notifications={notifications} onClose={()=>setDrawer(null)} onMark={markNotification} onMarkAll={markAll} onDelete={deleteNotification} onClearRead={clearReadNotifications} onOpen={n=>{setDrawer(null); if(n.ticket_id){const t=tickets.find(x=>x.id===n.ticket_id); if(t)setModal({type:'ticket-detail',ticket:t});else showToast('error','El ticket relacionado ya no está disponible.')} else if(n.helpdesk_ticket_id){const h=helpdesk.find(x=>x.id===n.helpdesk_ticket_id); if(h)setModal({type:'help-detail',item:h});else showToast('error','La solicitud relacionada ya no está disponible.')}}}/>} 
    {modal && <ModalRouter modal={modal} setModal={setModal} workspace={workspace} workspaces={workspaces} memberships={memberships} products={products} sprints={sprints} tickets={tickets} members={members} memberProductAccess={memberProductAccess} roleTemplates={roleTemplates} departments={departments} requestTypes={requestTypes} helpdesk={helpdesk} modules={modules} tags={tags} ticketTagLinks={ticketTagLinks} ticketLinks={ticketLinks} customFields={customFields} customFieldProducts={customFieldProducts} customValues={customValues} settings={settings} session={session} myRole={myRole} myPermissions={myPermissions} isSuperadmin={isSuperadmin} isAdmin={canAdminWorkspace} canManage={canPlan} canAdminWorkspace={canAdminWorkspace} canManageStaff={canManageStaff} canManageHelpdesk={canManageHelpdesk} canManageSettings={canManageSettings} canManageProducts={canManageProducts} canManageTicketFields={canManageTicketFields} canDeleteTicket={canDeleteTicket} canPlan={canPlan} canWork={canWork} canCreateTicket={canCreateTicket} filters={filters} setFilters={setFilters} helpFilters={helpFilters} setHelpFilters={setHelpFilters} createWorkspace={createWorkspace} saveTicket={saveTicket} deleteTicket={deleteTicket} saveHelpdesk={saveHelpdesk} deleteHelpdesk={deleteHelpdesk} decideRequirement={decideRequirement} closeSprintAndRollover={closeSprintAndRollover} planTicket={planTicket} refresh={refresh} loadMemberships={loadMemberships} setWorkspace={setWorkspace} setView={setView} toast={showToast}/>} 
    {toast && <Toast toast={toast}/>} 
  </div>
}

function Topbar({session,unread,search,setSearch,canSearch=true,portalOnly=false,canCreate,onCreate,onNotifications,onAppSwitcher,onHelp}){return <header className="global-topbar">
  <div className="topbar-brand"><button className="app-switcher" onClick={onAppSwitcher} title="Cambiar workspace"><Icon name="lucide:grid-2x2"/></button><img src="./logo.svg" alt="TROBBU"/><span></span><b>Jira Interno</b></div>
  {canSearch?<div className="global-search"><Icon name="lucide:search"/><input id="global-ticket-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar tickets por clave, título o descripción"/><kbd>⌘ K</kbd></div>:<div className="portal-topbar-context"><Icon name="lucide:life-buoy"/><span><b>Portal de solicitudes</b><small>{portalOnly?'Seguimiento personal de Helpdesk':'Workspace interno'}</small></span></div>}
  <div className="topbar-actions">{canCreate&&<button className="primary create-button" onClick={onCreate}><Icon name="lucide:plus"/> Crear</button>}<button className="icon-button bell" onClick={onNotifications} title="Notificaciones"><Icon name="lucide:bell"/>{unread>0&&<em>{unread>9?'9+':unread}</em>}</button><button className="icon-button" onClick={onHelp} title="Ayuda"><Icon name="lucide:circle-help"/></button><div className="top-user"><span className="avatar sm">{initials(session.user.user_metadata?.full_name||session.user.email)}</span><div><b>{session.user.user_metadata?.full_name||'Usuario'}</b><small>{session.user.email}</small></div></div></div>
</header>}
function Sidebar({workspace,workspaces,products,productId,setProductId,view,setView,tickets,helpdesk,helpdeskEnabled,role,roleName,helpdeskOnly=false,canManageStaff,canManageSettings,canManageTicketFields,canViewDashboard,onWorkspace}){
  const items=helpdeskOnly
    ? [['helpdesk','lucide:life-buoy','Mis solicitudes']]
    : canViewDashboard
      ? [['overview','lucide:layout-dashboard','Resumen'],['board','lucide:columns-3','Tablero'],['backlog','lucide:list-todo','Backlog / Sprints'],['timeline','lucide:gantt-chart','Cronograma'],['reports','lucide:chart-no-axes-combined','Reportes / AI'],...(role!=='consulta'?[['mytasks','lucide:circle-check-big','Mis tareas']]:[]),...(helpdeskEnabled?[['helpdesk','lucide:life-buoy',role==='consulta'?'Mis solicitudes':'Helpdesk']]:[]),...(canManageTicketFields?[['catalogs','lucide:tags','Campos y módulos']]:[]),...(canManageStaff?[['team','lucide:users-round','Staff y Roles']]:[])]
      : [...(role!=='consulta'?[['mytasks','lucide:circle-check-big','Mis tareas']]:[]),...(helpdeskEnabled?[['helpdesk','lucide:life-buoy','Mis solicitudes']]:[])]
  return <aside className="sidebar">
    <div className="sidebar-section-title"><span>ESPACIO DE TRABAJO</span><button className="ghost-icon" onClick={onWorkspace} title="Cambiar o crear workspace"><Icon name="lucide:plus" size={16}/></button></div>
    <button className="workspace-card" onClick={onWorkspace}><span className="workspace-icon"><Icon name="lucide:layers-3"/></span><div><b>{workspace?.name}</b><small>{roleName||ROLE_LABELS[role]||role}</small></div><Icon name="lucide:chevrons-up-down" size={16}/></button>
    <nav className="side-nav">{items.map(([key,icon,label])=><button key={key} className={view===key?'active':''} onClick={()=>{if(!['board','timeline'].includes(key))setProductId('all');setView(key)}}><Icon name={icon}/><span>{label}</span>{key==='board'&&<em>{tickets.length}</em>}{key==='backlog'&&<em>{tickets.filter(t=>!t.sprint_id&&t.status!=='closed').length}</em>}{key==='helpdesk'&&<em>{helpdeskOnly?helpdesk.length:helpdesk.filter(h=>isProposalCategory(h.category)?h.proposal_status==='pending':!['resolved','closed'].includes(h.status)).length}</em>}</button>)}</nav>
    {canViewDashboard&&!helpdeskOnly&&<><div className="sidebar-divider"></div><div className="sidebar-section-title"><span>PRODUCTOS AUTORIZADOS</span></div><button className={`product-nav ${productId==='all'?'active':''}`} onClick={()=>{setProductId('all');setView('board')}}><span className="product-dot all"><Icon name="lucide:boxes" size={15}/></span><span>Todos los autorizados</span><em>{tickets.length}</em></button>{products.map((p,i)=><button key={p.id} className={`product-nav ${productId===p.id?'active':''}`} onClick={()=>{setProductId(p.id);setView('board')}}><span className={`product-dot p${i%4}`}><Icon name={i===2?'lucide:smartphone':'lucide:monitor'} size={15}/></span><span>{p.name}</span><em>{tickets.filter(t=>t.product_id===p.id).length}</em></button>)}</>}
    <div className="sidebar-spacer"></div><div className="sidebar-divider"></div>{canManageSettings&&!helpdeskOnly&&<button className={`footer-nav ${view==='settings'?'active':''}`} onClick={()=>{setProductId('all');setView('settings')}}><Icon name="lucide:settings"/>Configuración</button>}<button className="footer-nav" onClick={()=>db.auth.signOut()}><Icon name="lucide:log-out"/>Cerrar sesión</button>
  </aside>
}
function MobileNav({view,setView,setProductId,helpdeskEnabled,role,helpdeskOnly=false,canManageStaff,canManageSettings,canManageTicketFields,canViewDashboard}){
  const items=helpdeskOnly
    ? [['helpdesk','lucide:life-buoy','Solicitudes']]
    : canViewDashboard
      ? [['overview','lucide:layout-dashboard','Resumen'],['board','lucide:columns-3','Tablero'],['backlog','lucide:list-todo','Backlog'],['timeline','lucide:gantt-chart','Gantt'],['reports','lucide:chart-no-axes-combined','Reportes'],...(role!=='consulta'?[['mytasks','lucide:circle-check-big','Mis tareas']]:[]),...(helpdeskEnabled?[['helpdesk','lucide:life-buoy','Helpdesk']]:[]),...(canManageTicketFields?[['catalogs','lucide:tags','Campos']]:[]),...(canManageStaff?[['team','lucide:users-round','Staff']]:[]),...(canManageSettings?[['settings','lucide:settings','Ajustes']]:[])]
      : [...(role!=='consulta'?[['mytasks','lucide:circle-check-big','Mis tareas']]:[]),...(helpdeskEnabled?[['helpdesk','lucide:life-buoy','Solicitudes']]:[])]
  return <nav className="mobile-nav" aria-label="Navegación móvil">{items.map(([key,icon,label])=><button type="button" key={key} className={view===key?'active':''} onClick={()=>{setProductId('all');setView(key)}}><Icon name={icon} size={19}/><span>{label}</span></button>)}</nav>
}
function PageHeader({eyebrow='Proyectos',title,subtitle,icon='lucide:clipboard-check',action}){return <div className="page-header"><div><div className="breadcrumbs"><span>{eyebrow}</span><Icon name="lucide:chevron-right" size={14}/><span>TROBBU</span></div><div className="page-title-row"><span className="page-icon"><Icon name={icon}/></span><div><h1>{title}</h1><p>{subtitle}</p></div></div></div>{action}</div>}
function LoadingPanel(){return <div className="center content-loading"><span className="loader"></span><span>Actualizando información…</span></div>}
function EmptyWorkspace({onCreate}){return <div className="empty-state"><img src="./logo.svg"/><span className="page-icon"><Icon name="lucide:layers-3" size={26}/></span><h2>Crea tu primer espacio de trabajo</h2><p>Los productos base y la configuración se crearán automáticamente.</p><button className="primary" onClick={onCreate}><Icon name="lucide:plus"/> Crear workspace</button></div>}
function Toast({toast}){return <div className={`toast ${toast.type}`}><Icon name={toast.type==='error'?'lucide:circle-alert':'lucide:circle-check'} /><span>{toast.message}</span></div>}

function Overview({workspace,tickets,helpdesk,products,sprints}){
  const [product,setProduct]=useState('all')
  const [sprint,setSprint]=useState('all')
  const [filterOpen,setFilterOpen]=useState(false)
  useEffect(()=>{setProduct('all');setSprint('all');setFilterOpen(false)},[workspace?.id])
  const scoped=tickets.filter(t=>(product==='all'||t.product_id===product)&&(sprint==='all'||t.sprint_id===sprint))
  const metrics={
    created:scoped.length,
    inProgress:scoped.filter(t=>t.status==='in_progress').length,
    devDone:scoped.filter(t=>t.dev_completed_at).length,
    qaDone:scoped.filter(t=>t.qa_completed_at).length,
    rejected:scoped.filter(t=>t.status==='qa_rejected').length,
    closed:scoped.filter(t=>t.status==='closed').length
  }
  const supportOpen=helpdesk.filter(h=>!['resolved','closed'].includes(h.status)).length
  const totalPoints=scoped.reduce((a,t)=>a+Number(t.story_points||0),0)
  const closedPoints=scoped.filter(t=>t.status==='closed').reduce((a,t)=>a+Number(t.story_points||0),0)
  const completion=totalPoints?Math.round(closedPoints/totalPoints*100):(scoped.length?Math.round(metrics.closed/scoped.length*100):0)
  return <div className="page"><PageHeader title="Resumen" subtitle={`Dashboard interactivo de ${workspace.name}`} icon="lucide:layout-dashboard"/>
    <div className="dashboard-filters"><button className={`filter-button ${(product!=='all'||sprint!=='all')?'active':''}`} onClick={()=>setFilterOpen(true)}><Icon name="lucide:list-filter"/> Filtros del dashboard {(product!=='all'||sprint!=='all')&&<em>{Number(product!=='all')+Number(sprint!=='all')}</em>}</button>{product!=='all'&&<span className="filter-summary-chip"><Icon name="lucide:boxes"/>{products.find(p=>p.id===product)?.name}</span>}{sprint!=='all'&&<span className="filter-summary-chip"><Icon name="lucide:calendar-range"/>{sprints.find(x=>x.id===sprint)?.name}</span>}<span className="dashboard-context"><Icon name="lucide:filter" size={15}/> {scoped.length} tickets analizados</span></div>
    <div className="metric-grid six"><Metric label="Tickets creados" value={metrics.created} icon="lucide:ticket-plus" tone="blue"/><Metric label="En curso" value={metrics.inProgress} icon="lucide:loader-circle" tone="orange"/><Metric label="Finalizados Dev" value={metrics.devDone} icon="lucide:code-2" tone="navy"/><Metric label="Finalizados QA" value={metrics.qaDone} icon="lucide:scan-search" tone="purple"/><Metric label="QA rechazados" value={metrics.rejected} icon="lucide:circle-x" tone="red"/><Metric label="Cerrados" value={metrics.closed} icon="lucide:badge-check" tone="green"/></div>
    <div className="dashboard-grid">
      <section className="panel"><div className="panel-heading"><div><h3>Avance del alcance</h3><p>Story points cerrados frente al total del filtro actual.</p></div><strong className="completion-value">{completion}%</strong></div><div className="big-progress"><i style={{width:`${completion}%`}}></i></div><div className="progress-caption"><span>{closedPoints} pts cerrados</span><span>{totalPoints} pts totales</span></div><div className="support-callout"><Icon name="lucide:life-buoy"/><div><b>{supportOpen} solicitudes de Helpdesk abiertas</b><span>Atención interna pendiente en el mismo workspace.</span></div></div></section>
      <section className="panel"><div className="panel-heading"><div><h3>Distribución por estado</h3><p>Flujo de los tickets filtrados.</p></div></div><div className="status-stack">{STATUS.map(([key,label])=><div key={key}><span><Icon name={statusIcon(key)} size={15}/>{label}</span><b>{scoped.filter(t=>t.status===key).length}</b></div>)}</div></section>
    </div>
    <section className="panel"><div className="panel-heading"><div><h3>Avance por producto</h3><p>Cerrados frente al total en el contexto seleccionado.</p></div></div>{products.filter(p=>product==='all'||p.id===product).map(p=>{const rows=scoped.filter(t=>t.product_id===p.id),done=rows.filter(t=>t.status==='closed').length,pct=rows.length?Math.round(done/rows.length*100):0;return <div className="progress-row" key={p.id}><div><b>{p.name}</b><span>{done}/{rows.length} cerrados</span></div><div className="progress-track"><i style={{width:`${pct}%`}}></i></div><strong>{pct}%</strong></div>})}</section>
    {filterOpen&&<DashboardFilterModal product={product} sprint={sprint} products={products} sprints={sprints} onClose={()=>setFilterOpen(false)} onApply={({product:nextProduct,sprint:nextSprint})=>{setProduct(nextProduct);setSprint(nextSprint);setFilterOpen(false)}}/>}
  </div>
}
function Metric({label,value,icon,tone}){return <div className={`metric-card ${tone}`}><span className="metric-icon"><Icon name={icon}/></span><div><small>{label}</small><strong>{value}</strong></div></div>}

function DashboardFilterModal({product,sprint,products,sprints,onClose,onApply}){const [f,setF]=useState({product,sprint});return <Modal title="Filtros del dashboard" subtitle="Segmenta las métricas por producto y sprint." onClose={onClose}><AsyncForm onSubmit={()=>onApply(f)} submitLabel="Aplicar filtros"><div className="form-grid"><label>Producto<select value={f.product} onChange={e=>setF({...f,product:e.target.value})}><option value="all">Todos los productos</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Sprint<select value={f.sprint} onChange={e=>setF({...f,sprint:e.target.value})}><option value="all">Todos los sprints</option>{sprints.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label></div><div className="modal-secondary"><button type="button" className="text-button" onClick={()=>setF({product:'all',sprint:'all'})}>Restablecer</button><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div></AsyncForm></Modal>}

function TicketWorkspace({workspace,title,subtitle,tickets,allTickets,products,members,sprints,boardMode,setBoardMode,filters,onFilter,onClearFilters,canWork,canPlan,canDelete,canCreate,onCreate,onActions,onOpen,onEdit,onDelete,onBacklog,onSprint,onMove}){
  const activeFilters=Object.values(filters).filter(v=>v!=='all').length
  return <div className="page"><PageHeader title={title} subtitle={subtitle} action={canCreate?<button className="primary" onClick={onCreate}><Icon name="lucide:plus"/> Nuevo ticket</button>:<span className="readonly-chip"><Icon name="lucide:eye"/> Solo consulta</span>}/>
    <section className="workspace-panel"><div className="panel-toolbar"><div className="tabs"><button className={boardMode==='table'?'active':''} onClick={()=>setBoardMode('table')}><Icon name="lucide:table-2"/>Tabla</button><button className={boardMode==='kanban'?'active':''} onClick={()=>setBoardMode('kanban')}><Icon name="lucide:columns-3"/>Kanban</button><button className={boardMode==='calendar'?'active':''} onClick={()=>setBoardMode('calendar')}><Icon name="lucide:calendar-days"/>Calendario</button><button className={boardMode==='gantt'?'active':''} onClick={()=>setBoardMode('gantt')}><Icon name="lucide:gantt-chart"/>Cronograma</button></div><div className="toolbar-actions"><button className={`filter-button ${activeFilters?'active':''}`} onClick={onFilter}><Icon name="lucide:list-filter"/> Filtros {activeFilters>0&&<em>{activeFilters}</em>}</button>{activeFilters>0&&<button className="text-button" onClick={onClearFilters}>Limpiar</button>}{canCreate&&<button className="primary compact" onClick={onCreate}><Icon name="lucide:plus"/> Nuevo</button>}</div></div>
    <div className="mini-stats"><span>Total <b>{allTickets.length}</b></span><span className="gray">Backlog <b>{allTickets.filter(t=>t.status==='backlog').length}</b></span><span className="amber">En desarrollo <b>{allTickets.filter(t=>['todo','in_progress','dev_done'].includes(t.status)).length}</b></span><span className="blue">En QA <b>{allTickets.filter(t=>['qa_review','qa_rejected','qa_passed'].includes(t.status)).length}</b></span><span className="green">Cerrados <b>{allTickets.filter(t=>t.status==='closed').length}</b></span></div>
    {boardMode==='table'&&<TicketTable tickets={tickets} products={products} members={members} onActions={onActions} onOpen={onOpen}/>} 
    {boardMode==='kanban'&&<Kanban tickets={tickets} products={products} members={members} canWork={canWork} onActions={onActions} onOpen={onOpen} onMove={onMove}/>} 
    {boardMode==='calendar'&&<CalendarView workspace={workspace} tickets={tickets} products={products} onOpen={onOpen}/>}
    {boardMode==='gantt'&&<GanttView workspace={workspace} tickets={tickets} products={products} sprints={sprints} members={members} onOpen={onOpen} onEdit={onEdit} onDelete={onDelete} onBacklog={onBacklog} onSprint={onSprint} canWork={canWork} canPlan={canPlan} canDelete={canDelete} embedded/>} 
    </section>
  </div>
}

function TicketTable({tickets,products,members,onActions,onOpen}){return <div className="table-wrap"><div className="table modern-table"><div className="tr th"><span>TICKET</span><span>PROYECTO</span><span>RESPONSABLE</span><span>FECHA LÍMITE</span><span>ESTADO</span><span></span></div>{tickets.length===0&&<TableEmpty text="No hay tickets con estos criterios."/>}{tickets.map(t=>{const p=products.find(x=>x.id===t.product_id),dev=members.find(m=>m.user_id===t.dev_owner_id)?.profile?.full_name,qa=members.find(m=>m.user_id===t.qa_owner_id)?.profile?.full_name,owner=dev||qa||'Sin asignar';return <div className="tr" key={t.id}><span className="task-cell"><button className="task-link" onClick={()=>onOpen(t)}><b>{t.title}</b><small>{t.ticket_key} · {TYPE_LABELS[t.type]}</small></button></span><span><span className="product-cell-icon"><Icon name="lucide:folder" size={14}/></span>{p?.name||'—'}</span><span className="assignee-cell"><span className="mini-avatar">{initials(owner)}</span>{owner}</span><span>{formatDate(t.due_date)}</span><span><StatusBadge status={t.status}/></span><span><button className="icon-button" onClick={()=>onActions(t)} title="Acciones"><Icon name="lucide:ellipsis-vertical"/></button></span></div>})}</div></div>}
function TableEmpty({text}){return <div className="table-empty"><Icon name="lucide:inbox" size={32}/><b>Sin resultados</b><span>{text}</span></div>}
function StatusBadge({status}){return <span className={`status-badge status-badge-${status}`}><Icon name={statusIcon(status)} size={13}/>{statusLabel(status)}</span>}
function HelpStatusBadge({status}){return <span className={`help-status help-${status}`}><Icon name={helpStatusIcon(status)} size={13}/>{helpStatusLabel(status)}</span>}

function Kanban({tickets,products,members,canWork,onActions,onOpen,onMove}){return <div className="kanban-shell">{STATUS.map(([key,label,icon])=>{const rows=tickets.filter(t=>t.status===key);return <div className="kanban-column" key={key} onDragOver={e=>canWork&&e.preventDefault()} onDrop={e=>{if(!canWork)return;const id=e.dataTransfer.getData('text/plain');const t=tickets.find(x=>x.id===id);if(t)onMove(t,key)}}><div className="kanban-head"><span><Icon name={icon} size={16}/>{label}</span><b>{rows.length}</b></div><div className="kanban-list">{rows.map(t=><TicketCard key={t.id} ticket={t} product={products.find(p=>p.id===t.product_id)} members={members} canWork={canWork} onActions={onActions} onOpen={onOpen}/>)}</div></div>})}</div>}
function TicketCard({ticket,product,members,canWork,onActions,onOpen}){const dev=members.find(m=>m.user_id===ticket.dev_owner_id)?.profile?.full_name,qa=members.find(m=>m.user_id===ticket.qa_owner_id)?.profile?.full_name,owner=dev||qa||'Sin asignar';return <article className="ticket-card" draggable={canWork} onDragStart={e=>e.dataTransfer.setData('text/plain',ticket.id)}><div className="ticket-card-top"><small>{ticket.ticket_key}</small><button className="icon-button" onClick={()=>onActions(ticket)}><Icon name="lucide:ellipsis"/></button></div><button className="ticket-title-link" onClick={()=>onOpen(ticket)}><h4>{ticket.title}</h4></button><div className="card-meta"><span className="mini-avatar">{initials(owner)}</span><span>{owner}</span>{ticket.due_date&&<><i>•</i><span>{formatDate(ticket.due_date)}</span></>}</div><div className="card-footer"><span className="product-badge"><Icon name="lucide:folder" size={13}/>{product?.name||'Producto'}</span><span className={`priority-badge priority-${ticket.priority}`}>{PRIORITY_LABELS[ticket.priority]}</span></div></article>}


function CalendarView({workspace,tickets,products,onOpen}){
  const [cursor,setCursor]=useState(()=>{const d=new Date();return new Date(d.getFullYear(),d.getMonth(),1)})
  useEffect(()=>{const d=new Date();setCursor(new Date(d.getFullYear(),d.getMonth(),1))},[workspace?.id])
  const year=cursor.getFullYear(),month=cursor.getMonth()
  const first=new Date(year,month,1)
  const mondayOffset=(first.getDay()+6)%7
  const start=new Date(year,month,1-mondayOffset)
  const days=Array.from({length:42},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d})
  const inRange=(ticket,key)=>{
    const a=ticket.start_date||ticket.due_date
    const b=ticket.due_date||ticket.start_date
    if(!a||!b)return false
    return key>=String(a).slice(0,10)&&key<=String(b).slice(0,10)
  }
  const unscheduled=tickets.filter(t=>!t.start_date&&!t.due_date&&t.status!=='closed')
  const upcoming=tickets.filter(t=>t.due_date&&t.status!=='closed').sort((a,b)=>String(a.due_date).localeCompare(String(b.due_date))).slice(0,8)
  const monthLabel=new Intl.DateTimeFormat('es-MX',{month:'long',year:'numeric'}).format(cursor)
  return <div className="calendar-layout">
    <div className="calendar-main">
      <div className="calendar-toolbar"><div><h3>{monthLabel}</h3><p>Inicio planificado, duración y fecha de entrega.</p></div><div className="calendar-actions"><button type="button" className="secondary-button compact" onClick={()=>setCursor(new Date(year,month-1,1))}><Icon name="lucide:chevron-left"/></button><button type="button" className="secondary-button compact" onClick={()=>{const d=new Date();setCursor(new Date(d.getFullYear(),d.getMonth(),1))}}>Hoy</button><button type="button" className="secondary-button compact" onClick={()=>setCursor(new Date(year,month+1,1))}><Icon name="lucide:chevron-right"/></button></div></div>
      <div className="calendar-weekdays">{['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(x=><span key={x}>{x}</span>)}</div>
      <div className="calendar-grid">{days.map(day=>{const key=dateKey(day),rows=tickets.filter(t=>inRange(t,key)).slice(0,4),outside=day.getMonth()!==month,today=key===dateKey(new Date());return <div className={`calendar-day ${outside?'outside':''} ${today?'today':''}`} key={key}><div className="calendar-day-number"><span>{day.getDate()}</span>{today&&<em>Hoy</em>}</div><div className="calendar-events">{rows.map(t=>{const product=products.find(p=>p.id===t.product_id);const start=String(t.start_date||'').slice(0,10)===key,end=String(t.due_date||'').slice(0,10)===key;return <button type="button" key={t.id} className={`calendar-ticket ${start?'starts':''} ${end?'ends':''}`} onClick={()=>onOpen(t)} title={`${t.ticket_key} · ${t.title}`}><span>{start?'▶':end?'◆':'•'}</span><b>{t.ticket_key}</b><small>{t.title}</small>{product&&<i>{product.key}</i>}</button>})}{tickets.filter(t=>inRange(t,key)).length>4&&<span className="calendar-more">+{tickets.filter(t=>inRange(t,key)).length-4} más</span>}</div></div>})}</div>
    </div>
    <aside className="calendar-aside"><div className="calendar-legend"><h4>Leyenda</h4><span><i className="legend-start">▶</i> Inicio</span><span><i className="legend-range">•</i> En ejecución</span><span><i className="legend-end">◆</i> Entrega</span></div><div className="calendar-side-card"><h4>Sin programar</h4><strong>{unscheduled.length}</strong><p>Tickets sin fecha de inicio ni entrega.</p></div><div className="calendar-side-card"><h4>Próximas entregas</h4>{upcoming.length===0&&<p className="muted">No hay fechas próximas.</p>}{upcoming.map(t=><button type="button" key={t.id} onClick={()=>onOpen(t)}><span><b>{t.ticket_key}</b><small>{t.title}</small></span><time>{formatDate(t.due_date)}</time></button>)}</div></aside>
  </div>
}

function GanttView({workspace,tickets,products,sprints,members=[],modules=[],ticketLinks=[],onOpen,onEdit,onDelete,onBacklog,onSprint,canWork=false,canPlan=false,canDelete=false,embedded=false}){
  const yesterday=()=>{const d=new Date();d.setDate(d.getDate()-1);return dateKey(d)}
  const [range,setRange]=useState('4w')
  const [groupBy,setGroupBy]=useState('none')
  const [cursor,setCursor]=useState(yesterday)
  useEffect(()=>{setCursor(yesterday());setRange('4w');setGroupBy('none')},[workspace?.id])
  const start=new Date(`${cursor}T12:00:00`)
  const addRange=(date,key)=>{const d=new Date(date);if(key.endsWith('w'))d.setDate(d.getDate()+Number(key.slice(0,-1))*7);else d.setMonth(d.getMonth()+Number(key.slice(0,-1)));return d}
  const endExclusive=addRange(start,range)
  const end=new Date(endExclusive);end.setDate(end.getDate()-1)
  const span=daysBetween(cursor,dateKey(end))+1
  const days=Array.from({length:span},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d})
  const todayKey=dateKey(new Date())
  const scheduled=tickets.filter(t=>t.start_date||t.due_date).sort((a,b)=>String(a.start_date||a.due_date).localeCompare(String(b.start_date||b.due_date)))
  const unscheduled=tickets.filter(t=>!t.start_date&&!t.due_date&&t.status!=='closed')
  const overdue=tickets.filter(t=>t.due_date&&t.due_date<todayKey&&!['qa_passed','closed'].includes(t.status)).length
  const dayWidth=span<=8?70:span<=30?34:span<=45?26:span<=60?22:span<=95?16:11
  const cellStyle={gridTemplateColumns:`repeat(${span},${dayWidth}px)`}
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n))
  const position=t=>{const a=t.start_date||t.due_date,b=t.due_date||t.start_date;if(!a||!b)return null;const from=daysBetween(cursor,a),to=daysBetween(cursor,b);if(to<0||from>=span)return null;return {start:clamp(from,0,span-1)+1,end:clamp(to,0,span-1)+2,leftCut:from<0,rightCut:to>=span}}
  const visibleTickets=scheduled.filter(t=>position(t))
  const ticketGroups=groupBy==='module'
    ? Object.values(visibleTickets.reduce((acc,t)=>{const key=t.module_id||'none';if(!acc[key])acc[key]={id:key,module:modules.find(m=>m.id===t.module_id)||null,tickets:[]};acc[key].tickets.push(t);return acc},{})).sort((a,b)=>String(a.module?.name||'ZZZ Sin módulo').localeCompare(String(b.module?.name||'ZZZ Sin módulo')))
    : [{id:'all',module:null,tickets:visibleTickets}]
  const sprintRows=sprints.filter(x=>x.start_date&&x.end_date).map(s=>({s,pos:position({start_date:s.start_date,due_date:s.end_date})})).filter(x=>x.pos).sort((a,b)=>String(a.s.start_date).localeCompare(String(b.s.start_date)))
  const shiftPeriod=dir=>{const d=new Date(start);if(range.endsWith('w'))d.setDate(d.getDate()+dir*Number(range.slice(0,-1))*7);else d.setMonth(d.getMonth()+dir*Number(range.slice(0,-1)));setCursor(dateKey(d))}
  const today=()=>setCursor(yesterday())
  const jumpSprint=id=>{const sprint=sprints.find(x=>x.id===id);if(sprint?.start_date)setCursor(sprint.start_date)}
  const monthGroups=[]
  days.forEach((d,i)=>{const key=`${d.getFullYear()}-${d.getMonth()}`;const last=monthGroups[monthGroups.length-1];if(last?.key===key)last.count++;else monthGroups.push({key,label:new Intl.DateTimeFormat('es-MX',{month:'long',year:'numeric'}).format(d),start:i+1,count:1})})
  const assignee=t=>members.find(m=>m.user_id===(t.qa_owner_id||t.dev_owner_id))?.profile?.full_name||''
  const rangeLabel={ '1w':'1 semana','4w':'4 semanas','6w':'6 semanas','8w':'8 semanas','1m':'1 mes','2m':'2 meses','3m':'3 meses','6m':'6 meses' }[range]
  const content=<>
    <div className="gantt-toolbar jira-timeline-toolbar"><div><h3>Timeline / Gantt</h3><p>{formatDate(cursor)} → {formatDate(dateKey(end))} · {rangeLabel} · histórico, proyección y progreso</p></div><div className="gantt-controls gantt-controls-v14">
      <label className="gantt-date-control"><span>Desde</span><input type="date" value={cursor} onChange={e=>e.target.value&&setCursor(e.target.value)} aria-label="Fecha inicial del Gantt"/></label>
      <select value={range} onChange={e=>setRange(e.target.value)} aria-label="Periodo visible"><optgroup label="Semanas"><option value="1w">1 semana</option><option value="4w">4 semanas</option><option value="6w">6 semanas</option><option value="8w">8 semanas</option></optgroup><optgroup label="Meses"><option value="1m">1 mes</option><option value="2m">2 meses</option><option value="3m">3 meses</option><option value="6m">6 meses</option></optgroup></select>
      <select value={groupBy} onChange={e=>setGroupBy(e.target.value)} aria-label="Agrupar Timeline"><option value="none">Sin agrupar</option><option value="module">Agrupar por módulo</option></select>
      <select value="" onChange={e=>{if(e.target.value)jumpSprint(e.target.value)}} aria-label="Ir a sprint"><option value="">Ir a sprint…</option>{[...sprints].sort((a,b)=>String(b.start_date||'').localeCompare(String(a.start_date||''))).map(s=><option key={s.id} value={s.id}>{s.status==='completed'?'✓ ':s.status==='active'?'● ':'○ '}{s.name} · {formatDate(s.start_date)}</option>)}</select>
      <button type="button" className="secondary-button compact" onClick={()=>shiftPeriod(-1)} title="Periodo anterior"><Icon name="lucide:chevron-left"/></button><button type="button" className="secondary-button compact" onClick={today}>Hoy</button><button type="button" className="secondary-button compact" onClick={()=>shiftPeriod(1)} title="Periodo siguiente"><Icon name="lucide:chevron-right"/></button>
    </div></div>
    <div className="gantt-kpis"><span><b>{scheduled.length}</b> planificados</span><span><b>{unscheduled.length}</b> en Backlog / sin fechas</span><span className={overdue?'danger-text':''}><b>{overdue}</b> vencidos</span><span><b>{sprints.filter(s=>s.status==='completed').length}</b> sprints históricos</span><span><b>{tickets.filter(t=>t.status==='closed').length}</b> tickets cerrados</span></div>
    <div className="gantt-scroll jira-timeline-scroll"><div className="gantt-canvas jira-timeline-canvas" style={{'--gantt-days':span,'--gantt-day-width':`${dayWidth}px`}}>
      <div className="gantt-month-header"><div className="gantt-label gantt-label-head">Actividad</div><div className="gantt-days gantt-month-grid" style={cellStyle}>{monthGroups.map(g=><span key={g.key} style={{gridColumn:`${g.start}/span ${g.count}`}}>{g.label}</span>)}</div></div>
      <div className="gantt-header"><div className="gantt-label gantt-label-head"><span>Tarea</span><small>{visibleTickets.length} visibles</small></div><div className="gantt-days gantt-days-head" style={cellStyle}>{days.map(d=><span key={dateKey(d)} className={`${[0,6].includes(d.getDay())?'weekend':''} ${dateKey(d)===todayKey?'today':''}`}><b>{d.getDate()}</b><small>{new Intl.DateTimeFormat('es-MX',{weekday:'narrow'}).format(d)}</small></span>)}</div></div>
      {sprintRows.length>0&&<div className="gantt-sprints"><div className="gantt-group-title"><Icon name="lucide:calendar-range"/> Sprints · activos, planeados e históricos</div>{sprintRows.map(({s,pos})=>{const rows=tickets.filter(t=>t.sprint_id===s.id),pct=rows.length?Math.round(rows.reduce((a,t)=>a+ticketProgress(t.status),0)/rows.length):0;return <div className={`gantt-row sprint-row sprint-${s.status}`} key={s.id}><button type="button" className="gantt-label sprint-label-button" onClick={()=>onSprint?.(s)}><span className={`sprint-status ${s.status}`}>{s.status==='active'?'Activo':s.status==='completed'?'Cerrado':'Planeado'}</span><b>{s.name}</b><small>{formatDate(s.start_date)} → {formatDate(s.end_date)} · {rows.length} tickets · {pct}%</small></button><div className="gantt-days gantt-track" style={cellStyle}>{days.map(d=><i key={dateKey(d)} className={`${[0,6].includes(d.getDay())?'weekend':''} ${dateKey(d)===todayKey?'today':''}`}></i>)}<button type="button" className={`gantt-sprint-bar ${s.status}`} style={{gridColumn:`${pos.start}/${pos.end}`}} onClick={()=>onSprint?.(s)} title={`${s.name} · ${pct}%`}><b>{s.name}</b><em style={{width:`${pct}%`}}></em></button></div></div>})}</div>}
      <div className="gantt-group-title"><Icon name="lucide:ticket"/> Actividades</div>
      {visibleTickets.length===0&&<div className="gantt-empty"><Icon name="lucide:calendar-off"/><span>No hay tickets programados dentro del periodo visible. Cambia la fecha, el periodo o selecciona un sprint histórico.</span></div>}
      {ticketGroups.map(group=><React.Fragment key={group.id}>{groupBy==='module'&&<div className="gantt-module-group-row"><div className="gantt-label"><span className="module-chip" style={{'--module-color':group.module?.color||'#D4DCE0'}}><i></i>{group.module?`${group.module.module_key} · ${group.module.name}`:'Sin módulo'}</span><small>{group.tickets.length} tickets</small></div><div className="gantt-days gantt-track" style={cellStyle}></div></div>}{group.tickets.map(t=>{const pos=position(t),product=products.find(p=>p.id===t.product_id),module=modules.find(m=>m.id===t.module_id),pct=ticketProgress(t.status),owner=assignee(t),blockers=ticketLinks.filter(l=>l.link_type==='blocks'&&l.target_ticket_id===t.id).map(l=>tickets.find(x=>x.id===l.source_ticket_id)).filter(Boolean),blocker=blockers[0],blockPos=blocker?position(blocker):null;return <div className={`gantt-row ticket-timeline-row ${t.status==='closed'?'historical':''}`} key={t.id}><div className="gantt-label gantt-ticket-label jira-task-label"><button type="button" className="gantt-task-main" onClick={()=>onOpen(t)}><span><Icon name={statusIcon(t.status)} size={13}/><b>{t.ticket_key}</b><em>{product?.key||'—'}</em></span><strong>{t.title}</strong><small>{statusLabel(t.status)} · {pct}%{owner?` · ${owner}`:''}{module?` · ${module.module_key}`:''}</small></button><div className="gantt-row-actions"><button type="button" title="Ver detalle" onClick={()=>onOpen(t)}><Icon name="lucide:eye"/></button>{canWork&&<button type="button" title="Editar" onClick={()=>onEdit?.(t)}><Icon name="lucide:pencil"/></button>}{canPlan&&t.sprint_id&&<button type="button" title="Mover a Backlog" onClick={()=>onBacklog?.(t)}><Icon name="lucide:inbox"/></button>}{canDelete&&<button type="button" className="danger-text" title="Eliminar" onClick={()=>onDelete?.(t)}><Icon name="lucide:trash-2"/></button>}</div></div><div className="gantt-days gantt-track" style={cellStyle}>{days.map(d=><i key={dateKey(d)} className={`${[0,6].includes(d.getDay())?'weekend':''} ${dateKey(d)===todayKey?'today':''}`}></i>)}{blockPos&&pos&&<span className="gantt-dependency-line" style={{gridColumn:`${Math.min(Math.max(blockPos.end-1,1),pos.start)}/${Math.max(Math.max(blockPos.end-1,1),pos.start)+1}`}} title={`Bloqueado por ${blocker.ticket_key}`}><Icon name="lucide:corner-down-right" size={12}/><em>{blocker.ticket_key}</em></span>}{pos&&<button type="button" className={`gantt-bar status-${t.status} ${pos.leftCut?'cut-left':''} ${pos.rightCut?'cut-right':''}`} style={{gridColumn:`${pos.start}/${pos.end}`}} onClick={()=>onOpen(t)} title={`${t.ticket_key} · ${t.title} · ${pct}%`}><span style={{width:`${pct}%`}}></span><b>{pct}%</b></button>}</div></div>})}</React.Fragment>)}
    </div></div>
    {unscheduled.length>0&&<div className="gantt-unscheduled"><div><Icon name="lucide:inbox"/><span><b>{unscheduled.length} actividades en Backlog / sin programar</b><small>Asigna sprint y fechas para incorporarlas al Timeline.</small></span></div><div>{unscheduled.slice(0,8).map(t=><button type="button" key={t.id} onClick={()=>onOpen(t)}>{t.ticket_key} · {t.title}</button>)}</div></div>}
  </>
  if(embedded)return <div className="gantt-embedded">{content}</div>
  return <div className="page"><PageHeader eyebrow="Planificación" title="Timeline / Gantt" subtitle="Cronograma estilo Jira con fecha inicial configurable, ventanas semanales/mensuales e histórico de sprints." icon="lucide:gantt-chart"/><section className="workspace-panel gantt-panel">{content}</section></div>
}
function BacklogView({workspace,tickets,products,sprints,members,modules=[],tags=[],ticketTagLinks=[],canPlan,onTicket,onPlan,onSprint,onCloseSprint,onCreateSprint,onImport}){
  const [moduleFilter,setModuleFilter]=useState('all'),[tagFilter,setTagFilter]=useState('all')
  const tagTicketIds=useMemo(()=>tagFilter==='all'?null:new Set(ticketTagLinks.filter(x=>x.tag_id===tagFilter).map(x=>x.ticket_id)),[tagFilter,ticketTagLinks])
  const visibleTickets=useMemo(()=>tickets.filter(t=>(moduleFilter==='all'||(moduleFilter===''?!t.module_id:t.module_id===moduleFilter))&&(!tagTicketIds||tagTicketIds.has(t.id))),[tickets,moduleFilter,tagTicketIds])
  const backlog=visibleTickets.filter(t=>!t.sprint_id&&t.status!=='closed')
  const ordered=[...sprints].sort((a,b)=>String(a.start_date||'9999').localeCompare(String(b.start_date||'9999')))
  const active=ordered.filter(s=>s.status!=='completed')
  const completed=ordered.filter(s=>s.status==='completed').slice(-4).reverse()
  const today=dateKey(new Date())
  return <div className="page"><PageHeader eyebrow="Planificación" title="Backlog y Sprints" subtitle="Prioriza el trabajo pendiente, organiza ciclos y arrastra lo no resuelto al siguiente sprint." icon="lucide:list-todo" action={canPlan?<div className="page-header-actions"><button className="secondary-button" onClick={onImport}><Icon name="lucide:file-spreadsheet"/> Importar Excel / CSV</button><button className="primary" onClick={onCreateSprint}><Icon name="lucide:plus"/> Nuevo sprint</button></div>:<span className="readonly-chip"><Icon name="lucide:eye"/> Consulta</span>}/>
    <div className="backlog-filterbar"><div><Icon name="lucide:filter"/><b>Agrupar / filtrar trabajo</b></div><label>Módulo<select value={moduleFilter} onChange={e=>setModuleFilter(e.target.value)}><option value="all">Todos los módulos</option><option value="">Sin módulo</option>{modules.map(m=><option value={m.id} key={m.id}>{m.module_key} · {m.name}</option>)}</select></label><label>Tag<select value={tagFilter} onChange={e=>setTagFilter(e.target.value)}><option value="all">Todas las tags</option>{tags.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</select></label>{(moduleFilter!=='all'||tagFilter!=='all')&&<button type="button" className="text-button" onClick={()=>{setModuleFilter('all');setTagFilter('all')}}>Limpiar</button>}</div>
    <div className="backlog-summary"><Metric label="Backlog" value={backlog.length} icon="lucide:inbox" tone="navy"/><Metric label="Sprints activos" value={active.filter(s=>s.status==='active').length} icon="lucide:zap" tone="orange"/><Metric label="Planeados" value={active.filter(s=>s.status==='planned').length} icon="lucide:calendar-clock" tone="blue"/><Metric label="Sin resolver en sprint" value={visibleTickets.filter(t=>t.sprint_id&&!['qa_passed','closed'].includes(t.status)).length} icon="lucide:circle-dashed" tone="red"/></div>
    <section className="backlog-board"><div className="backlog-column backlog-pool"><div className="backlog-head"><div><span className="eyebrow">COLA DE TRABAJO</span><h3>Backlog</h3><p>Tickets aún no comprometidos en un sprint.</p></div><b>{backlog.length}</b></div><div className="backlog-ticket-list">{backlog.length===0&&<div className="compact-empty"><Icon name="lucide:inbox"/><span>Backlog vacío para este filtro</span></div>}{backlog.map(t=>{const p=products.find(x=>x.id===t.product_id),m=modules.find(x=>x.id===t.module_id);return <article className="backlog-ticket" key={t.id}><button type="button" className="backlog-ticket-main" onClick={()=>onTicket(t)}><small>{t.ticket_key} · {p?.name||'Producto'}{m?` · ${m.module_key}`:''}</small><b>{t.title}</b><span><StatusBadge status={t.status}/><em className={`priority-badge priority-${t.priority}`}>{PRIORITY_LABELS[t.priority]}</em></span></button>{canPlan&&<button type="button" className="secondary-button compact" onClick={()=>onPlan(t)}><Icon name="lucide:calendar-plus"/> Planificar</button>}</article>})}</div></div>
      <div className="sprint-stack"><div className="backlog-head"><div><span className="eyebrow">CICLOS</span><h3>Sprints</h3><p>Trabajo comprometido y proyección de entregas.</p></div></div>{active.length===0&&<div className="compact-empty"><Icon name="lucide:calendar-off"/><span>No hay sprints planeados o activos.</span></div>}{active.map(s=>{const rows=visibleTickets.filter(t=>t.sprint_id===s.id),done=rows.filter(t=>['qa_passed','closed'].includes(t.status)).length,pct=rows.length?Math.round(done/rows.length*100):0,unresolved=rows.length-done,expired=s.end_date&&s.end_date<today;return <article className={`sprint-card ${s.status} ${expired?'expired':''}`} key={s.id}><div className="sprint-card-head"><div><span className={`sprint-status ${s.status}`}>{s.status==='active'?'Activo':'Planeado'}</span>{expired&&<span className="expired-chip"><Icon name="lucide:alarm-clock"/> Vencido</span>}<h3>{s.name}</h3><p>{s.goal||'Sin objetivo definido.'}</p></div><button type="button" className="icon-button" onClick={()=>onSprint(s)}><Icon name="lucide:expand"/></button></div><div className="sprint-dates"><span><Icon name="lucide:calendar-range"/> {formatDate(s.start_date)} → {formatDate(s.end_date)}</span><span>{rows.length} tickets · {unresolved} no resueltos</span></div><div className="sprint-progress"><div><i style={{width:`${pct}%`}}></i></div><b>{pct}%</b></div><div className="sprint-preview">{rows.slice(0,4).map(t=><button type="button" key={t.id} onClick={()=>onTicket(t)}><span>{t.ticket_key}</span><b>{t.title}</b><StatusBadge status={t.status}/></button>)}{rows.length>4&&<small>+{rows.length-4} actividades</small>}</div><div className="sprint-card-actions"><button type="button" className="secondary-button compact" onClick={()=>onSprint(s)}><Icon name="lucide:file-text"/> Detalle</button>{canPlan&&<button type="button" className={expired?'primary compact':'secondary-button compact'} onClick={()=>onCloseSprint(s)}><Icon name="lucide:arrow-right-circle"/> Cerrar / trasladar</button>}</div></article>})}
      {completed.length>0&&<div className="completed-sprints"><h4>Sprints completados</h4>{completed.map(s=><button type="button" key={s.id} onClick={()=>onSprint(s)}><span><b>{s.name}</b><small>{formatDate(s.start_date)} → {formatDate(s.end_date)}</small></span><Icon name="lucide:chevron-right"/></button>)}</div>}</div>
    </section>
  </div>
}
function BacklogImportModal({workspace,products,members,session,onClose,onImported}){
  const [fileName,setFileName]=useState('')
  const [rows,setRows]=useState([])
  const [issues,setIssues]=useState([])
  const [parsing,setParsing]=useState(false)
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState('')
  const [sourceType,setSourceType]=useState('')
  const productMap=useMemo(()=>{const map={};products.forEach(p=>{map[importNorm(p.key)]=p;map[importNorm(p.name)]=p});return map},[products])
  const memberCanProduct=(m,productId)=>m.role==='superadmin'||m.all_products||m.product_ids?.includes(productId)
  const normalizeRecords=(source,rowOffset=2)=>{
    const parsed=[],errs=[]
    const candidates=source.map((r,i)=>({r,excelRow:r.__rowNumber||i+rowOffset,title:String(importCell(r,'Titulo','Titulo*','Título','Título*')||'').trim(),productValue:String(importCell(r,'Producto','Producto*')||'').trim()})).filter(x=>(x.title||x.productValue)&&!importNorm(x.title).startsWith('ejemplo -'))
    if(candidates.length>250)errs.push({row:'—',message:'El archivo supera el máximo de 250 tickets por importación.'})
    candidates.slice(0,250).forEach(({r,excelRow,title,productValue})=>{
      const localIssues=[]
      if(!title)localIssues.push('Falta Titulo.')
      if(title.length>220)localIssues.push('Titulo supera 220 caracteres.')
      const product=productMap[importNorm(productValue)]
      if(!product)localIssues.push(`Producto “${productValue||'—'}” no existe o no está autorizado.`)
      const typeText=importNorm(importCell(r,'Tipo')||'tarea'),type=IMPORT_TYPE_MAP[typeText]
      if(!type)localIssues.push(`Tipo “${importCell(r,'Tipo')}” inválido.`)
      const priorityText=importNorm(importCell(r,'Prioridad')||'media'),priority=IMPORT_PRIORITY_MAP[priorityText]
      if(!priority)localIssues.push(`Prioridad “${importCell(r,'Prioridad')}” inválida.`)
      const spRaw=String(importCell(r,'Story Points','Story points')||'').trim();const storyPoints=spRaw===''?null:Number(spRaw)
      if(storyPoints!==null&&(!Number.isInteger(storyPoints)||storyPoints<1||storyPoints>5))localIssues.push('Story Points debe ser un entero entre 1 y 5.')
      const startRaw=importCell(r,'Fecha inicio'),dueRaw=importCell(r,'Fecha limite','Fecha límite')
      const startDate=importDateValue(startRaw),dueDate=importDateValue(dueRaw)
      if(String(startRaw).trim()&&startDate===null)localIssues.push(`Fecha inicio “${startRaw}” inválida.`)
      if(String(dueRaw).trim()&&dueDate===null)localIssues.push(`Fecha limite “${dueRaw}” inválida.`)
      if(startDate&&dueDate&&dueDate<startDate)localIssues.push('Fecha límite no puede ser anterior a Fecha inicio.')
      localIssues.forEach(message=>errs.push({row:excelRow,message}))
      let devOwner=null,qaOwner=null
      if(product&&localIssues.length===0){
        const resolverIssues=[]
        const resolve=(value,permission,label)=>{const raw=String(value??'').trim();if(!raw)return null;const norm=importNorm(raw);const matches=members.filter(m=>m.active&&effectivePermissions(m,m.role_template)[permission]&&memberCanProduct(m,product.id)&&(m.user_id===raw||importNorm(m.profile?.full_name)===norm));if(matches.length===0){resolverIssues.push(`${label}: “${raw}” no coincide con Staff autorizado.`);return null}if(matches.length>1){resolverIssues.push(`${label}: “${raw}” es ambiguo; usa UUID.`);return null}return matches[0].user_id}
        devOwner=resolve(importCell(r,'Responsable Dev'),'edit_tickets','Responsable Dev')
        qaOwner=resolve(importCell(r,'Responsable QA'),'qa_review','Responsable QA')
        resolverIssues.forEach(message=>errs.push({row:excelRow,message}))
      }
      parsed.push({row:excelRow,title,product_id:product?.id||'',product_key:product?.key||productValue,description:String(importCell(r,'Descripcion','Descripción')||'').trim(),type:type||'task',priority:priority||'medium',story_points:storyPoints,dev_owner_id:devOwner,qa_owner_id:qaOwner,start_date:startDate||'',due_date:dueDate||''})
    })
    if(parsed.length===0&&!errs.length)errs.push({row:'—',message:'No se encontraron tickets válidos en el archivo.'})
    return {parsed,errs}
  }
  const parseFile=async file=>{
    setError('');setRows([]);setIssues([]);setFileName(file?.name||'');setSourceType('')
    if(!file)return
    setParsing(true)
    try{
      const lower=String(file.name||'').toLowerCase()
      let source=[],rowOffset=2
      if(lower.endsWith('.csv')){
        if(!window.TrobbuCsvImport)throw new Error('No se pudo cargar el lector CSV. Recarga la página e intenta nuevamente.')
        const result=await window.TrobbuCsvImport.readFile(file)
        if(!result.headerCheck.valid)throw new Error(result.headerCheck.errors.join(' '))
        source=result.records||[];rowOffset=2;setSourceType('CSV')
      }else if(lower.endsWith('.xlsx')||lower.endsWith('.xls')){
        if(!window.XLSX)throw new Error('No se pudo cargar el lector de Excel. Recarga la página e intenta nuevamente.')
        const buffer=await file.arrayBuffer(),book=window.XLSX.read(buffer,{type:'array',cellDates:false})
        const sheet=book.Sheets['Tickets Backlog']||book.Sheets[book.SheetNames[0]]
        if(!sheet)throw new Error('El archivo no contiene una hoja válida.')
        source=window.XLSX.utils.sheet_to_json(sheet,{range:3,defval:'',raw:false});rowOffset=5;setSourceType('Excel')
      }else throw new Error('Formato no compatible. Usa XLSX, XLS o CSV exportado desde Google Sheets.')
      const {parsed,errs}=normalizeRecords(source,rowOffset)
      setRows(parsed);setIssues(errs)
    }catch(err){setError(err.message||String(err))}finally{setParsing(false)}
  }
  const valid=rows.length>0&&issues.length===0
  const save=async()=>{
    if(!valid)throw new Error('Corrige los errores del archivo antes de importar.')
    setSaving(true);setError('')
    try{
      const payload=rows.map(({row,product_key,...x})=>x)
      const {data,error}=await db.rpc('import_backlog_tickets',{p_workspace:workspace.id,p_rows:payload})
      if(error)throw error
      await onImported(data||{imported:rows.length})
    }catch(err){setError(err.message||String(err))}finally{setSaving(false)}
  }
  return <Modal title="Importar tickets al Backlog" subtitle="Carga actividades desde Excel o CSV exportado desde Google Sheets. Todo el archivo se valida antes de crear tickets." onClose={onClose} size="xl">
    <div className="form-body backlog-import-body">
      <div className="import-intro"><span><Icon name="lucide:file-spreadsheet" size={26}/></span><div><b>Plantilla controlada para Backlog</b><p>Título y producto son obligatorios. Sprint siempre queda vacío; estado siempre será Backlog.</p></div><div className="import-template-actions"><a className="secondary-button compact" href="./plantilla-importacion-backlog-trobbu.xlsx" download><Icon name="lucide:download"/> Excel</a><a className="secondary-button compact" href="./plantilla-importacion-backlog-trobbu.csv" download><Icon name="lucide:download"/> CSV</a></div></div>
      <label className="file-drop import-file-drop"><input type="file" accept=".xlsx,.xls,.csv,text/csv" onChange={e=>parseFile(e.target.files?.[0])}/><Icon name="lucide:upload-cloud" size={28}/><b>{fileName||'Seleccionar Excel o CSV'}</b><span>{parsing?'Validando archivo…':`${sourceType?sourceType+' · ':''}XLSX, XLS o CSV · máximo 250 tickets`}</span></label>
      {(rows.length>0||issues.length>0)&&<div className="import-kpis"><span><b>{rows.length}</b> filas detectadas</span><span className={issues.length?'danger-text':'success-text'}><b>{issues.length}</b> errores</span><span><b>{valid?rows.length:0}</b> listos para importar</span></div>}
      {issues.length>0&&<div className="import-errors"><h4><Icon name="lucide:triangle-alert"/> Corrige antes de importar</h4>{issues.slice(0,20).map((x,i)=><p key={`${x.row}-${i}`}><b>Fila {x.row}</b>{x.message}</p>)}{issues.length>20&&<small>+{issues.length-20} errores adicionales</small>}</div>}
      {rows.length>0&&<div className="import-preview"><div className="panel-heading"><div><h4>Vista previa</h4><p>Se muestran hasta 20 tickets.</p></div></div><div className="table-wrap"><table><thead><tr><th>Fila</th><th>Producto</th><th>Título</th><th>Tipo</th><th>Prioridad</th><th>SP</th><th>Inicio</th><th>Límite</th></tr></thead><tbody>{rows.slice(0,20).map(r=><tr key={r.row}><td>{r.row}</td><td><b>{r.product_key}</b></td><td>{r.title}</td><td>{TYPE_LABELS[r.type]}</td><td>{PRIORITY_LABELS[r.priority]}</td><td>{r.story_points??'—'}</td><td>{r.start_date||'—'}</td><td>{r.due_date||'—'}</td></tr>)}</tbody></table></div></div>}
      {error&&<div className="error"><Icon name="lucide:triangle-alert"/>{error}</div>}
    </div>
    <div className="form-footer static-footer"><div className="form-footer-left"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div><div className="modal-actions"><button type="button" className="primary" disabled={!valid||saving||parsing} onClick={save}>{saving?'Importando…':`Importar ${valid?rows.length:0} tickets`}</button></div></div>
  </Modal>
}

function ReporterTicketsView({tickets,products,onCreate,onOpen}){
  const open=tickets.filter(t=>!['qa_passed','closed'].includes(t.status)).length
  const done=tickets.filter(t=>['qa_passed','closed'].includes(t.status)).length
  return <div className="page"><PageHeader eyebrow="Portal de tickets" title="Mis tickets enviados" subtitle="Crea solicitudes de desarrollo y consulta su avance sin acceder a la administración del tablero." icon="lucide:ticket-check" action={<button className="primary" onClick={onCreate}><Icon name="lucide:plus"/> Enviar ticket</button>}/><div className="metric-grid four"><Metric label="Enviados" value={tickets.length} icon="lucide:send" tone="blue"/><Metric label="En backlog" value={tickets.filter(t=>t.status==='backlog').length} icon="lucide:inbox" tone="navy"/><Metric label="En seguimiento" value={open} icon="lucide:loader-circle" tone="orange"/><Metric label="Completados" value={done} icon="lucide:circle-check" tone="green"/></div><section className="workspace-panel"><div className="requester-ticket-list">{tickets.length===0&&<TableEmpty text="Todavía no has enviado tickets en este workspace."/>}{tickets.map(t=>{const product=products.find(p=>p.id===t.product_id);return <button type="button" key={t.id} onClick={()=>onOpen(t)}><span className="requester-ticket-icon"><Icon name="lucide:ticket"/></span><span><small>{t.ticket_key} · {product?.name||'Producto'}</small><b>{t.title}</b><em>Actualizado {formatDateTime(t.updated_at)}</em></span><StatusBadge status={t.status}/><Icon name="lucide:chevron-right"/></button>})}</div></section></div>
}

function RequirementBadge({status}){const value=status||'pending';const icon=value==='accepted_backlog'?'lucide:circle-check-big':value==='rejected'?'lucide:circle-x':'lucide:clock-3';return <span className={`requirement-badge requirement-${value}`}><Icon name={icon} size={13}/>{requirementStatusLabel(value)}</span>}
function HelpdeskPortal({items,departments,requestTypes=[],onCreate,onOpen}){
  const order=['created','review','attended','resolved','closed']
  const normal=items.filter(x=>!isProposalCategory(x.category))
  const requirements=items.filter(x=>isProposalCategory(x.category))
  const active=normal.filter(x=>!['resolved','closed'].includes(x.status)).length
  const categoryCounts=requestTypes.map(type=>({key:type.id,label:type.name,count:items.filter(x=>x.request_type_id===type.id).length,color:type.color})).filter(x=>x.count)
  return <div className="page"><PageHeader eyebrow="Portal administrativo" title="Mis solicitudes" subtitle="Crea solicitudes, consulta únicamente las tuyas y sigue su resolución o decisión." icon="lucide:life-buoy" action={<button className="primary" onClick={onCreate}><Icon name="lucide:plus"/> Nueva solicitud</button>}/>
    <div className="metric-grid six portal-metrics"><Metric label="Solicitudes" value={items.length} icon="lucide:inbox" tone="blue"/><Metric label="En seguimiento" value={active} icon="lucide:loader-circle" tone="orange"/><Metric label="Resueltas / cerradas" value={normal.filter(x=>['resolved','closed'].includes(x.status)).length} icon="lucide:circle-check" tone="green"/><Metric label="Requerimientos pendientes" value={requirements.filter(x=>(x.proposal_status||'pending')==='pending').length} icon="lucide:lightbulb" tone="purple"/><Metric label="Aceptados a Backlog" value={requirements.filter(x=>x.proposal_status==='accepted_backlog').length} icon="lucide:list-plus" tone="navy"/><Metric label="Sugerencias rechazadas" value={requirements.filter(x=>x.proposal_status==='rejected').length} icon="lucide:circle-x" tone="red"/></div>
    <div className="portal-info"><Icon name="lucide:shield-check"/><div><b>Portal privado de solicitudes.</b><p>No tienes acceso a productos, tableros ni Gantt. Aquí solo ves lo que tú creaste, sus comentarios y su seguimiento.</p></div></div>
    {categoryCounts.length>0&&<section className="panel portal-category-stats"><div className="panel-heading"><div><h3>Solicitudes por tipo</h3><p>Distribución personal de lo que has solicitado.</p></div></div><div>{categoryCounts.map(c=><span key={c.key}><b>{c.count}</b><small><i className="request-type-dot" style={{background:c.color||'#D4DCE0'}}></i>{c.label}</small></span>)}</div></section>}
    <section className="request-list">{items.length===0&&<div className="empty-state-inline"><Icon name="lucide:life-buoy" size={34}/><h3>No tienes solicitudes</h3><p>Cuando necesites acceso, reportar un error o proponer un requerimiento, créalo desde aquí.</p><button className="primary compact" onClick={onCreate}>Crear solicitud</button></div>}{items.map(item=>{const dept=departments.find(d=>d.id===item.department_id),requestType=requestTypes.find(x=>x.id===item.request_type_id),isRequirement=isProposalCategory(item.category),idx=Math.max(0,order.indexOf(item.status));return <article className={`request-card ${isRequirement?'requirement-card':''}`} key={item.id}><button type="button" className="request-card-main" onClick={()=>onOpen(item)}><div className="request-card-title"><span className="request-icon"><Icon name={isRequirement?'lucide:lightbulb':'lucide:headphones'}/></span><div><small>{item.ticket_key} · {dept?.name||'Sin área'} · {requestType?.name||helpCategoryLabel(item.category)}</small><h3>{item.subject}</h3><p>{item.description||'Sin descripción.'}</p></div>{isRequirement?<RequirementBadge status={item.proposal_status}/>:<HelpStatusBadge status={item.status}/>}</div>{isRequirement?<div className="requirement-flow"><span className="requirement-flow-node done"><i><Icon name="lucide:send" size={12}/></i><b>Solicitado</b></span><span className={`requirement-flow-line ${(item.proposal_status||'pending')!=='pending'?'done':''}`}></span><span className={`requirement-flow-node ${(item.proposal_status||'pending')==='pending'?'current':'done'}`}><i><Icon name={(item.proposal_status||'pending')==='pending'?'lucide:clock-3':item.proposal_status==='accepted_backlog'?'lucide:list-plus':'lucide:circle-x'} size={12}/></i><b>{requirementStatusLabel(item.proposal_status)}</b></span>{item.converted_ticket_key&&<span className="converted-ticket-chip"><Icon name="lucide:ticket-check"/>{item.converted_ticket_key}</span>}</div>:<div className="request-stepper">{order.map((st,i)=><div key={st} className={`${i<idx?'done':''} ${i===idx?'current':''}`}><i>{i<idx?<Icon name="lucide:check" size={12}/>:i+1}</i><span>{helpStatusLabel(st)}</span></div>)}</div>}<div className="request-meta"><span><Icon name="lucide:calendar"/> Creado {formatDateTime(item.created_at)}</span>{!isRequirement&&item.due_at&&<span><Icon name="lucide:clock"/> Objetivo {formatDateTime(item.due_at)}</span>}{isRequirement&&item.decision_at&&<span><Icon name="lucide:gavel"/> Decisión {formatDateTime(item.decision_at)}</span>}<span><Icon name="lucide:refresh-cw"/> Actualizado {formatDateTime(item.updated_at)}</span></div></button></article>})}</section>
  </div>
}
function HelpdeskView({items,allItems,departments,requestTypes=[],members,canPlan,filters,onFilter,onCreate,onActions,onOpen,onDecision}){
  const normal=allItems.filter(h=>!isProposalCategory(h.category))
  const requirements=allItems.filter(h=>isProposalCategory(h.category))
  const open=normal.filter(h=>['created','review','attended'].includes(h.status)).length
  const resolved=normal.filter(h=>h.status==='resolved').length
  const closed=normal.filter(h=>h.status==='closed').length
  const pendingRequirements=requirements.filter(h=>(h.proposal_status||'pending')==='pending').length
  const overdue=normal.filter(h=>h.due_at && !['resolved','closed'].includes(h.status) && new Date(h.due_at)<new Date()).length
  const withResponse=normal.filter(h=>h.first_response_at)
  const avgFirst=withResponse.length?Math.round(withResponse.reduce((a,h)=>a+(new Date(h.first_response_at)-new Date(h.created_at))/36e5,0)/withResponse.length*10)/10:null
  const resolvedRows=normal.filter(h=>h.resolved_at),slaRows=resolvedRows.filter(h=>h.due_at)
  const slaPct=slaRows.length?Math.round(slaRows.filter(h=>new Date(h.resolved_at)<=new Date(h.due_at)).length/slaRows.length*100):100
  const typeStats=requestTypes.map(type=>({type,total:allItems.filter(h=>h.request_type_id===type.id).length,open:allItems.filter(h=>h.request_type_id===type.id&&!['resolved','closed'].includes(h.status)).length,done:allItems.filter(h=>h.request_type_id===type.id&&['resolved','closed'].includes(h.status)).length})).filter(x=>x.total)
  const active=Object.values(filters).filter(v=>v!=='all').length
  return <div className="page"><PageHeader eyebrow="Servicio interno" title="Helpdesk" subtitle="Atiende solicitudes operativas y decide qué nuevos requerimientos pasan al Backlog." icon="lucide:life-buoy" action={<button className="primary" onClick={onCreate}><Icon name="lucide:plus"/> Nueva solicitud</button>}/>
    <div className="metric-grid six"><Metric label="Solicitudes" value={allItems.length} icon="lucide:inbox" tone="blue"/><Metric label="Abiertas" value={open} icon="lucide:loader-circle" tone="orange"/><Metric label="Requerimientos por decidir" value={pendingRequirements} icon="lucide:lightbulb" tone="purple"/><Metric label="Vencidas" value={overdue} icon="lucide:alarm-clock" tone="red"/><Metric label="Resueltas / cerradas" value={resolved+closed} icon="lucide:circle-check" tone="green"/><Metric label="SLA cumplido" value={`${slaPct}%`} icon="lucide:gauge" tone="navy"/></div>
    {typeStats.length>0&&<section className="panel helpdesk-type-stats"><div className="panel-heading"><div><h3>Solicitudes por tipo</h3><p>Segmentación usando el catálogo configurable de Helpdesk.</p></div></div><div className="helpdesk-type-stat-grid">{typeStats.map(x=><button type="button" key={x.type.id} onClick={()=>onFilter?.()}><span className="request-type-icon" style={{background:`${x.type.color||'#0D47A1'}18`,color:x.type.color||'#0D47A1'}}><Icon name={x.type.icon||'lucide:ticket'}/></span><span><b>{x.type.name}</b><small>{x.open} abiertas · {x.done} resueltas/cerradas</small></span><strong>{x.total}</strong></button>)}</div></section>}
    <section className="workspace-panel"><div className="panel-toolbar"><div><h3>Solicitudes internas</h3><p className="muted">Los nuevos requerimientos no usan SLA: PM/Admin/Superadmin decide si se aceptan a Backlog o se rechazan.</p></div><div className="toolbar-actions"><button className={`filter-button ${active?'active':''}`} onClick={onFilter}><Icon name="lucide:list-filter"/> Filtros {active>0&&<em>{active}</em>}</button><button className="primary compact" onClick={onCreate}><Icon name="lucide:plus"/> Crear</button></div></div>
    <div className="table-wrap"><div className="table help-table"><div className="tr th"><span>SOLICITUD</span><span>ÁREA</span><span>ASIGNADO</span><span>PRIORIDAD</span><span>ESTADO / DECISIÓN</span><span></span></div>{items.length===0&&<TableEmpty text="No hay solicitudes con estos filtros."/>}{items.map(h=>{const dep=departments.find(d=>d.id===h.department_id),requestType=requestTypes.find(x=>x.id===h.request_type_id),owner=members.find(m=>m.user_id===h.assigned_to)?.profile?.full_name||'Sin asignar',req=isProposalCategory(h.category);return <div className={`tr ${req?'requirement-row':''}`} key={h.id}><span className="task-cell"><button className="task-link" onClick={()=>onOpen(h)}><b>{h.subject}</b><small>{h.ticket_key} · {requestType?.name||helpCategoryLabel(h.category)}</small></button></span><span><span className="dept-dot" style={{background:dep?.color||'#D4DCE0'}}></span>{dep?.name||'Sin área'}</span><span className="assignee-cell">{req?<span className="muted"><Icon name="lucide:gavel" size={14}/> Decisión PM</span>:<><span className="mini-avatar">{initials(owner)}</span>{owner}</>}</span><span><span className={`priority-badge priority-${h.priority}`}>{PRIORITY_LABELS[h.priority]}</span></span><span>{req?<RequirementBadge status={h.proposal_status}/>:<HelpStatusBadge status={h.status}/>}</span><span><div className="inline-actions">{req&&canPlan&&(h.proposal_status||'pending')==='pending'&&<button type="button" className="decision-button" onClick={()=>onDecision(h)} title="Evaluar requerimiento"><Icon name="lucide:gavel"/></button>}<button className="icon-button" onClick={()=>onActions(h)} title="Acciones"><Icon name="lucide:ellipsis-vertical"/></button></div></span></div>})}</div></div></section>
  </div>
}
function StaffRolesView({workspace,members,products,memberProductAccess,roleTemplates,canManage,isSuperadmin,session,onInvite,onMember,onRoleCreate,onRoleEdit,onRoleDelete}){
  const [tab,setTab]=useState('staff')
  const accessFor=m=>m.role==='superadmin'||m.all_products ? products : products.filter(p=>memberProductAccess.some(x=>x.user_id===m.user_id&&x.product_id===p.id))
  const orderedRoles=[...roleTemplates].sort((a,b)=>Number(b.protected)-Number(a.protected)||Number(b.is_system)-Number(a.is_system)||a.name.localeCompare(b.name))
  const systemRoles=orderedRoles.filter(r=>['consulta','dev','qa','pm','admin','superadmin'].includes(r.code))
  return <div className="page"><PageHeader title="Staff y Roles" subtitle={`Control de acceso de ${workspace.name}: rol, permisos y productos autorizados.`} icon="lucide:users-round" action={canManage?<button className="primary" onClick={onInvite}><Icon name="lucide:user-plus"/> Agregar Staff</button>:null}/>
    <div className="workspace-scope-strip"><Icon name="lucide:layers-3"/><span><b>Workspace activo: {workspace.name}</b><small>Cada colaborador, rol y producto de esta vista pertenece únicamente a este workspace.</small></span></div>
    <div className="staff-tabs"><button type="button" className={tab==='staff'?'active':''} onClick={()=>setTab('staff')}><Icon name="lucide:users"/> Staff <em>{members.length}</em></button><button type="button" className={tab==='roles'?'active':''} onClick={()=>setTab('roles')}><Icon name="lucide:shield-check"/> Roles <em>{roleTemplates.length}</em></button></div>
    {tab==='staff'&&<section className="workspace-panel staff-panel"><div className="staff-table-head"><span>COLABORADOR</span><span>ROL</span><span>PRODUCTOS</span><span>ESTADO</span><span></span></div><div className="staff-list">{members.map(m=>{const editable=canManage&&(isSuperadmin||m.role!=='superadmin'||m.user_id===session.user.id),scope=accessFor(m);return <div className={`staff-row ${m.active?'':'inactive'}`} key={m.user_id}><div className="staff-person"><span className="avatar">{initials(m.profile?.full_name)}</span><span><b>{m.profile?.full_name||'Usuario'}{m.user_id===session.user.id&&<small> Tú</small>}</b><small>{m.profile?.job_title||m.profile?.email||'Colaborador del workspace'}</small></span></div><span><em className={`role-pill role-${m.role}`}>{roleDisplayName(m)}</em></span><div className="staff-products">{roleIsHelpdeskRequester(m.role_template)?<span className="scope-portal"><Icon name="lucide:life-buoy"/> Portal Helpdesk · sin productos</span>:m.role==='superadmin'||m.all_products?<span className="scope-all"><Icon name="lucide:boxes"/> Todos los productos</span>:scope.length?<>{scope.slice(0,2).map(p=><span key={p.id}>{p.name}</span>)}{scope.length>2&&<em>+{scope.length-2}</em>}</>:<span className="scope-none">Sin productos</span>}</div><span className={`staff-status ${m.active?'active':'off'}`}><i></i>{m.active?'Activo':'Desactivado'}</span><span>{editable&&<button type="button" className="secondary-button compact" onClick={()=>onMember(m)}><Icon name="lucide:sliders-horizontal"/> Accesos</button>}</span></div>})}</div></section>}
    {tab==='roles'&&<><section className="workspace-panel roles-admin-panel"><div className="settings-list-head"><div><h3>Roles del workspace</h3><p>Edita permisos base, crea roles personalizados o elimina roles que ya no estén asignados.</p></div>{canManage&&<button type="button" className="primary compact" onClick={onRoleCreate}><Icon name="lucide:plus"/> Nuevo rol</button>}</div><div className="roles-card-grid">{orderedRoles.map(role=>{const perms=roleDefinitionPermissions(role),count=PERMISSION_DEFS.filter(([k])=>perms[k]).length,assigned=members.filter(m=>m.role_id===role.id).length;return <article className={`role-admin-card ${role.protected?'protected':''}`} key={role.id}><div className="role-admin-head"><span className={`role-admin-icon role-${role.base_role}`}><Icon name={role.protected?'lucide:crown':'lucide:shield-check'}/></span><div><b>{role.name}</b><small>{role.is_system?'Rol base':'Rol personalizado'} · {assigned} asignado{assigned===1?'':'s'}</small></div>{role.protected&&<span className="readonly-chip"><Icon name="lucide:lock"/> Protegido</span>}</div><p>{role.description||'Sin descripción.'}</p><div className="role-admin-meta"><span><b>{count}</b> permisos activos</span><span>Base: <b>{ROLE_LABELS[role.base_role]||role.base_role}</b></span></div>{canManage&&<div className="row-actions"><button type="button" onClick={()=>onRoleEdit(role)} disabled={role.protected}><Icon name="lucide:pencil"/> Editar</button><button type="button" className="danger-text" onClick={()=>onRoleDelete(role)} disabled={role.protected}><Icon name="lucide:trash-2"/> Eliminar</button></div>}</article>})}</div></section>
      <section className="workspace-panel role-matrix-wrap"><div className="panel-heading"><div><h3>Matriz de roles base</h3><p>Comparación rápida de las seis plantillas estándar del workspace.</p></div></div><div className="role-matrix"><div className="role-matrix-head"><span>Permiso</span>{systemRoles.map(r=><b key={r.id}>{r.name}</b>)}</div>{PERMISSION_DEFS.map(([key,label,icon])=><div className="role-matrix-row" key={key}><span><Icon name={icon} size={15}/>{label}</span>{systemRoles.map(r=>{const yes=!!roleDefinitionPermissions(r)[key];return <i key={r.id} className={yes?'yes':'no'}><Icon name={yes?'lucide:check':'lucide:minus'} size={14}/></i>})}</div>)}</div><div className="role-note"><Icon name="lucide:info"/><span><b>Superadmin</b> siempre conserva todos los accesos y no puede eliminarse. Los demás roles pueden ajustarse en este workspace.</span></div></section></>}
  </div>
}

function SettingsView({workspace,settings,products,sprints,departments,requestTypes,emailQueue,emailProviderStatus,canManageSettings,canManageProducts,canPlan,canDeleteWorkspace,onWorkspaceEdit,onWorkspaceConfig,onWorkspaceDelete,onSettingsSaved,onProductCreate,onProductEdit,onProductDelete,onSprintCreate,onSprintEdit,onSprintDelete,onDepartmentCreate,onDepartmentEdit,onDepartmentDelete,onRequestTypeCreate,onRequestTypeEdit,onRequestTypeDelete,onProcessEmails,toast}){
  const [tab,setTab]=useState('workspace')
  const tabs=[
    ['workspace','lucide:building-2','Workspace'],
    ['products','lucide:boxes','Productos'],
    ['sprints','lucide:calendar-range','Sprints'],
    ['helpdesk','lucide:life-buoy','Helpdesk'],
    ['notifications','lucide:bell-ring','Notificaciones']
  ]
  return <div className="page"><PageHeader title="Configuración" subtitle="Gestiona el espacio, productos, sprints, Helpdesk y notificaciones." icon="lucide:settings"/>
    <section className="workspace-panel settings-panel">
      <div className="settings-tabs">{tabs.map(([key,icon,label])=><button key={key} className={tab===key?'active':''} onClick={()=>setTab(key)}><Icon name={icon} size={16}/>{label}</button>)}</div>
      {tab==='workspace'&&<WorkspaceSettings workspace={workspace} settings={settings} canManage={canManageSettings} canDelete={canDeleteWorkspace} onEdit={onWorkspaceEdit} onConfig={onWorkspaceConfig} onDelete={onWorkspaceDelete}/>}
      {tab==='products'&&<EntitySettings title="Productos" subtitle="Tableros separados para cada producto." items={products} canManage={canManageProducts} onCreate={onProductCreate} render={p=><><div><b>{p.name}</b><span>{p.key} · {p.description||'Sin descripción'}</span></div><div className="row-actions">{canManageProducts&&<><button onClick={()=>onProductEdit(p)}><Icon name="lucide:pencil"/>Editar</button><button className="danger-text" onClick={()=>onProductDelete(p)}><Icon name="lucide:trash-2"/>Eliminar</button></>}</div></>}/>}
      {tab==='sprints'&&<EntitySettings title="Sprints" subtitle="Planeación y periodos de trabajo." items={sprints} canManage={canPlan} onCreate={onSprintCreate} render={x=><><div><b>{x.name}</b><span>{x.status} · {formatDate(x.start_date)} — {formatDate(x.end_date)}</span></div><div className="row-actions">{canPlan&&<><button onClick={()=>onSprintEdit(x)}><Icon name="lucide:pencil"/>Editar</button><button className="danger-text" onClick={()=>onSprintDelete(x)}><Icon name="lucide:trash-2"/>Eliminar</button></>}</div></>}/>}
      {tab==='helpdesk'&&<HelpdeskSettings settings={settings} departments={departments} requestTypes={requestTypes} canManage={canManageSettings} onDepartmentCreate={onDepartmentCreate} onDepartmentEdit={onDepartmentEdit} onDepartmentDelete={onDepartmentDelete} onRequestTypeCreate={onRequestTypeCreate} onRequestTypeEdit={onRequestTypeEdit} onRequestTypeDelete={onRequestTypeDelete}/>}
      {tab==='notifications'&&<NotificationSettings settings={settings} queue={emailQueue} providerStatus={emailProviderStatus} canManage={canManageSettings} onProcess={onProcessEmails} toast={toast}/>}
    </section>
  </div>
}

function WorkspaceSettings({workspace,settings,canManage,canDelete,onEdit,onConfig,onDelete}){return <div className="settings-content"><div className="settings-card"><div className="settings-card-head"><div><h3>{workspace.name}</h3><p>Datos generales, SLA y funciones habilitadas del espacio.</p></div>{canManage&&<div className="row-actions"><button className="secondary-button" onClick={onEdit}><Icon name="lucide:pencil"/> Editar nombre</button><button className="primary compact" onClick={onConfig}><Icon name="lucide:sliders-horizontal"/> Editar configuración</button></div>}</div><div className="settings-summary-grid"><DetailRow label="Zona horaria">{settings?.timezone||'America/Merida'}</DetailRow><DetailRow label="Duración de sprint">{settings?.default_sprint_days||14} días</DetailRow><DetailRow label="Correo de soporte">{settings?.support_email||'Sin configurar'}</DetailRow><DetailRow label="SLA primera respuesta">{settings?.sla_first_response_hours||4} h</DetailRow><DetailRow label="SLA resolución">{settings?.sla_resolution_hours||24} h</DetailRow><DetailRow label="Notificaciones in-app"><span className={`settings-status ${settings?.in_app_notifications?'on':'off'}`}>{settings?.in_app_notifications?'Activas':'Desactivadas'}</span></DetailRow><DetailRow label="Notificaciones por correo"><span className={`settings-status ${settings?.email_notifications?'on':'off'}`}>{settings?.email_notifications?'Activas':'Desactivadas'}</span></DetailRow><DetailRow label="Helpdesk"><span className={`settings-status ${settings?.helpdesk_enabled?'on':'off'}`}>{settings?.helpdesk_enabled?'Habilitado':'Deshabilitado'}</span></DetailRow></div>{canDelete&&<div className="settings-actions"><button className="danger-outline" onClick={onDelete}><Icon name="lucide:trash-2"/> Eliminar workspace</button></div>}</div></div>}

function HelpdeskSettings({settings,departments,requestTypes=[],canManage,onDepartmentCreate,onDepartmentEdit,onDepartmentDelete,onRequestTypeCreate,onRequestTypeEdit,onRequestTypeDelete}){
  const [subTab,setSubTab]=useState('departments')
  return <div className="settings-content">
    <div className="helpdesk-settings-head"><div><h3>Configuración de Helpdesk</h3><p>SLA operativo: {settings?.sla_first_response_hours||4}h primera respuesta / {settings?.sla_resolution_hours||24}h resolución.</p></div></div>
    <div className="helpdesk-settings-tabs"><button type="button" className={subTab==='departments'?'active':''} onClick={()=>setSubTab('departments')}><Icon name="lucide:building-2"/> Departamentos <em>{departments.length}</em></button><button type="button" className={subTab==='types'?'active':''} onClick={()=>setSubTab('types')}><Icon name="lucide:tags"/> Tipos de solicitudes <em>{requestTypes.length}</em></button></div>
    {subTab==='departments'&&<><div className="settings-list-head"><div><h3>Departamentos solicitantes</h3><p>Áreas disponibles para clasificar y canalizar solicitudes.</p></div>{canManage&&<button type="button" className="primary compact" onClick={onDepartmentCreate}><Icon name="lucide:plus"/> Nueva área</button>}</div><div className="entity-list">{departments.length===0&&<div className="empty-inline">Sin áreas configuradas.</div>}{departments.map(d=><div className="entity-row" key={d.id}><div className="department-entity"><span className="dept-dot large" style={{background:d.color||'#D4DCE0'}}></span><div><b>{d.name}</b><span>{d.active?'Disponible para solicitudes':'Área desactivada'}</span></div></div><div className="row-actions"><span className={`settings-status ${d.active?'on':'off'}`}>{d.active?'Activo':'Inactivo'}</span>{canManage&&<><button type="button" onClick={()=>onDepartmentEdit(d)}><Icon name="lucide:pencil"/>Editar</button><button type="button" className="danger-text" onClick={()=>onDepartmentDelete(d)}><Icon name="lucide:trash-2"/>Eliminar</button></>}</div></div>)}</div></>}
    {subTab==='types'&&<><div className="settings-list-head"><div><h3>Tipos de solicitudes</h3><p>Catálogo escalable para segmentar soporte, incidencias, requerimientos y cualquier clasificación futura.</p></div>{canManage&&<button type="button" className="primary compact" onClick={onRequestTypeCreate}><Icon name="lucide:plus"/> Nuevo tipo</button>}</div><div className="entity-list request-type-list">{requestTypes.length===0&&<div className="empty-inline">Sin tipos configurados.</div>}{requestTypes.map(type=><div className="entity-row request-type-row" key={type.id}><div className="request-type-entity"><span className="request-type-icon" style={{background:`${type.color||'#0D47A1'}18`,color:type.color||'#0D47A1'}}><Icon name={type.icon||'lucide:ticket'}/></span><div><b>{type.name}</b><span>{type.description||'Sin descripción'}</span><small><code>{type.code}</code> · Orden {type.sort_order}</small></div></div><div className="row-actions"><span className={`settings-status ${type.active?'on':'off'}`}>{type.active?'Activo':'Inactivo'}</span>{canManage&&<><button type="button" onClick={()=>onRequestTypeEdit(type)}><Icon name="lucide:pencil"/>Editar</button><button type="button" className="danger-text" onClick={()=>onRequestTypeDelete(type)}><Icon name="lucide:trash-2"/>Eliminar</button></>}</div></div>)}</div><div className="notice request-type-note"><Icon name="lucide:info"/><span><b>Los tipos desactivados se conservan en el histórico.</b> Solo los tipos activos pueden seleccionarse en nuevas solicitudes.</span></div></>}
  </div>
}

function NotificationSettings({settings,queue,providerStatus,canManage,onProcess,toast}){
  const [processing,setProcessing]=useState(false)
  const [provider,setProvider]=useState(providerStatus?.provider||null)
  useEffect(()=>setProvider(providerStatus?.provider||null),[providerStatus?.provider])
  const pending=queue.filter(q=>q.status==='pending').length
  const failed=queue.filter(q=>q.status==='failed').length
  const sent=queue.filter(q=>q.status==='sent').length
  const run=async()=>{setProcessing(true);try{const data=await onProcess();setProvider(data?.provider||null);if(data?.configured===false)toast('error','Correo operativo sin proveedor configurado. Agrega Resend o Mailgun en los secretos de Supabase.');else toast('success',`Correos procesados: ${data?.sent||0} enviados, ${data?.failed||0} fallidos.`)}catch(e){toast('error',e.message||String(e))}finally{setProcessing(false)}}
  return <div className="settings-content"><div className="settings-card"><div className="settings-card-head"><div><h3>Canales de notificación</h3><p>Estado de notificaciones dentro de la plataforma y cola de correo.</p></div></div><div className="notification-health-grid"><div><span>In-app</span><b className={settings?.in_app_notifications?'ok':'off'}>{settings?.in_app_notifications?'Activo':'Desactivado'}</b></div><div><span>Email</span><b className={settings?.email_notifications?'ok':'off'}>{settings?.email_notifications?'Activo':'Desactivado'}</b></div><div><span>Pendientes</span><strong>{pending}</strong></div><div><span>Enviados</span><strong>{sent}</strong></div><div><span>Fallidos</span><strong>{failed}</strong></div></div>{failed>0&&<div className="error subtle"><Icon name="lucide:triangle-alert"/><span>{queue.find(q=>q.status==='failed')?.last_error||'Hay correos fallidos pendientes de reintento.'}</span></div>}{providerStatus?.configured===false&&<div className="notice provider-warning"><Icon name="lucide:mail-warning"/><span><b>Proveedor de correo no configurado.</b> Las notificaciones dentro de la plataforma funcionan; para enviar emails configura Resend o Mailgun como secretos de Supabase.</span></div>}<div className="settings-actions">{provider&&<span className="provider-chip"><Icon name="lucide:mail-check"/>Proveedor: {provider}</span>}{providerStatus?.configured&&<span className="settings-status on">Proveedor listo</span>}{canManage&&settings?.email_notifications&&<button className="primary" onClick={run} disabled={processing||providerStatus?.configured===false}><Icon name="lucide:send"/>{processing?'Procesando…':'Procesar cola de correo'}</button>}</div></div></div>
}

function Toggle({label,checked,onChange,disabled}){return <label className={`toggle-row ${disabled?'disabled':''}`}><span>{label}</span><button type="button" className={`switch ${checked?'on':''}`} onClick={()=>!disabled&&onChange(!checked)}><i></i></button></label>}
function EntitySettings({title,subtitle,items,canManage,onCreate,render}){return <div className="settings-content"><div className="settings-list-head"><div><h3>{title}</h3><p>{subtitle}</p></div>{canManage&&<button className="primary compact" onClick={onCreate}><Icon name="lucide:plus"/> Nuevo</button>}</div><div className="entity-list">{items.length===0&&<div className="empty-inline">Sin registros todavía.</div>}{items.map(item=><div className="entity-row" key={item.id}>{render(item)}</div>)}</div></div>}

function NotificationsDrawer({notifications,onClose,onMark,onMarkAll,onDelete,onClearRead,onOpen}){
  const [confirmAction,setConfirmAction]=useState(null)
  const unread=notifications.filter(n=>!n.read_at).length,read=notifications.length-unread
  return <>
    <div className="drawer-backdrop" onMouseDown={onClose}><aside className="drawer" onMouseDown={e=>e.stopPropagation()}><div className="drawer-head"><div><span className="eyebrow">CENTRO DE ACTIVIDAD</span><h2>Notificaciones</h2><p>{unread} sin leer · {read} leídas</p></div><button className="icon-button" onClick={onClose}><Icon name="lucide:x"/></button></div><div className="drawer-toolbar"><button className="text-button" onClick={onMarkAll} disabled={!unread}>Marcar todas como leídas</button><button className="text-button danger-text" onClick={()=>setConfirmAction({type:'clear-read'})} disabled={!read}>Eliminar leídas</button></div><div className="notification-list">{notifications.length===0&&<div className="empty-notifications"><Icon name="lucide:bell-off" size={30}/><b>Sin notificaciones</b><span>Las asignaciones, revisiones y solicitudes aparecerán aquí.</span></div>}{notifications.map(n=><div key={n.id} className={`notification-item ${n.read_at?'':'unread'}`}><button className="notification-main" onClick={()=>{onMark(n.id,true);onOpen(n)}}><span className="notification-icon"><Icon name={n.type.includes('helpdesk')?'lucide:life-buoy':n.type==='qa_rejected'?'lucide:circle-x':n.type==='system'?'lucide:sparkles':'lucide:ticket'} /></span><div><b>{n.title}</b><p>{n.body}</p><small>{formatDateTime(n.created_at)}</small></div>{!n.read_at&&<i></i>}</button><div className="notification-actions"><button className="icon-button" title={n.read_at?'Marcar como no leída':'Marcar como leída'} onClick={()=>onMark(n.id,!n.read_at)}><Icon name={n.read_at?'lucide:mail':'lucide:mail-open'} size={15}/></button><button className="icon-button danger-text" title="Eliminar notificación" onClick={()=>setConfirmAction({type:'delete',notification:n})}><Icon name="lucide:trash-2" size={15}/></button></div></div>)}</div></aside></div>
    {confirmAction?.type==='delete'&&<ConfirmModal title="Eliminar notificación" message="La notificación se eliminará definitivamente de tu centro de actividad." danger onClose={()=>setConfirmAction(null)} onConfirm={async()=>{await onDelete(confirmAction.notification.id);setConfirmAction(null)}}/>}
    {confirmAction?.type==='clear-read'&&<ConfirmModal title="Eliminar notificaciones leídas" message={`Se eliminarán ${read} notificaciones leídas. Esta acción no se puede deshacer.`} danger onClose={()=>setConfirmAction(null)} onConfirm={async()=>{await onClearRead();setConfirmAction(null)}}/>}
  </>
}

function ModalRouter(props){const {modal,setModal}=props;const close=()=>setModal(null)
  if(modal.type==='workspace-create') return <WorkspaceModal title="Crear espacio de trabajo" onClose={close} onSave={async f=>{await props.createWorkspace(f);close()}}/>
  if(modal.type==='workspace-switch') return <WorkspaceSwitcherModal workspaces={props.workspaces} current={props.workspace} onClose={close} onSelect={w=>{props.setWorkspace(w);close()}} onCreate={()=>setModal({type:'workspace-create'})}/>
  if(modal.type==='workspace-edit') return <WorkspaceModal title="Editar espacio" initial={{name:props.workspace.name}} onClose={close} onSave={async f=>{const {error}=await db.from('workspaces').update({name:f.name}).eq('id',props.workspace.id);if(error)throw error;await props.loadMemberships(props.workspace.id);props.toast('success','Workspace actualizado.');close()}}/>
  if(modal.type==='workspace-config') return <WorkspaceConfigModal workspace={props.workspace} settings={props.settings} onClose={close} onSaved={async()=>{await props.refresh();props.toast('success','Configuración guardada.');close()}}/>
  if(modal.type==='workspace-delete' && props.isSuperadmin) return <ConfirmModal title="Eliminar workspace" message="Se eliminarán productos, sprints, tickets, Helpdesk y configuración de este espacio. Esta acción no se puede deshacer." danger onClose={close} onConfirm={async()=>{const {error}=await db.from('workspaces').delete().eq('id',props.workspace.id);if(error)throw error;await props.loadMemberships();props.toast('success','Workspace eliminado.');close()}}/>

  if(modal.type==='ticket-create') return <TicketModal title="Crear ticket" reporterMode={!props.canWork} products={props.products} sprints={props.sprints} members={props.members} modules={props.modules} tags={props.tags} ticketTagLinks={props.ticketTagLinks} customFields={props.customFields} customFieldProducts={props.customFieldProducts} customValues={props.customValues} onClose={close} onSave={async f=>{await props.saveTicket(f);close()}}/>
  if(modal.type==='ticket-edit' && props.canWork) return <TicketModal title={`Editar ${modal.ticket.ticket_key}`} ticket={modal.ticket} products={props.products} sprints={props.sprints} members={props.members} modules={props.modules} tags={props.tags} ticketTagLinks={props.ticketTagLinks} customFields={props.customFields} customFieldProducts={props.customFieldProducts} customValues={props.customValues} onClose={close} onSave={async f=>{await props.saveTicket(f,modal.ticket);close()}}/>
  if(modal.type==='ticket-detail') return <TicketDetailModal workspace={props.workspace} ticket={modal.ticket} tickets={props.tickets} products={props.products} members={props.members} modules={props.modules} tags={props.tags} ticketTagLinks={props.ticketTagLinks} ticketLinks={props.ticketLinks} customFields={props.customFields} customValues={props.customValues} session={props.session} canWork={props.canWork} canManage={props.canManage} onClose={close} onEdit={()=>setModal({type:'ticket-edit',ticket:modal.ticket})} onPlan={()=>setModal({type:'ticket-plan',ticket:modal.ticket})} onLink={()=>setModal({type:'ticket-link',ticket:modal.ticket})} onOpenRelated={ticket=>setModal({type:'ticket-detail',ticket})} onRefresh={props.refresh} toast={props.toast}/>
  if(modal.type==='ticket-link') return <TicketLinkModal ticket={modal.ticket} tickets={props.tickets} products={props.products} existing={props.ticketLinks} onClose={close} onSave={async f=>{const direction=f.link_type==='blocked_by';const row={workspace_id:props.workspace.id,source_ticket_id:direction?f.other_ticket_id:modal.ticket.id,target_ticket_id:direction?modal.ticket.id:f.other_ticket_id,link_type:direction?'blocks':f.link_type,note:f.note||null,created_by:props.session.user.id};const {error}=await db.from('ticket_links').insert(row);if(error)throw error;await props.refresh();props.toast('success','Relación creada.');close()}}/>
  if(modal.type==='dependency-override') return <DependencyOverrideModal ticket={modal.ticket} status={modal.status} onClose={close} onSave={async note=>{const {error}=await db.rpc('transition_ticket_status',{p_ticket_id:modal.ticket.id,p_status:modal.status,p_override_blockers:true,p_note:note});if(error)throw error;await props.refresh();props.toast('success','Avance forzado y registrado en actividad.');close()}}/>
  if(modal.type==='ticket-actions'){
    const actions=[['lucide:eye','Ver detalle',()=>setModal({type:'ticket-detail',ticket:modal.ticket})]]
    if(props.canWork) actions.push(['lucide:pencil','Editar ticket',()=>setModal({type:'ticket-edit',ticket:modal.ticket})])
    if(props.canPlan) actions.push(['lucide:calendar-plus','Planificar / cambiar sprint',()=>setModal({type:'ticket-plan',ticket:modal.ticket})])
    if(props.canDeleteTicket) actions.push(['lucide:trash-2','Eliminar ticket',()=>setModal({type:'ticket-delete',ticket:modal.ticket}),'danger'])
    return <ActionSheet title={modal.ticket.ticket_key} subtitle={modal.ticket.title} onClose={close} actions={actions}/>
  }
  if(modal.type==='ticket-delete') return <ConfirmModal title={`Eliminar ${modal.ticket.ticket_key}`} message={`¿Deseas eliminar “${modal.ticket.title}”? También se eliminarán comentarios, evidencias e historial asociado.`} danger onClose={close} onConfirm={async()=>{await props.deleteTicket(modal.ticket);close()}}/>
  if(modal.type==='ticket-filters') return <TicketFilterModal filters={props.filters} members={props.members} sprints={props.sprints} modules={props.modules} tags={props.tags} onClose={close} onApply={f=>{props.setFilters(f);close()}}/>
  if(modal.type==='ticket-plan') return <PlanTicketModal ticket={modal.ticket} sprints={props.sprints} onClose={close} onSave={async sprintId=>{await props.planTicket(modal.ticket,sprintId);close()}}/>

  if(modal.type==='backlog-import') return <BacklogImportModal workspace={props.workspace} products={props.products} members={props.members} session={props.session} onClose={close} onImported={async result=>{await props.refresh();props.toast('success',`${result.imported} tickets importados al Backlog.`);close()}}/>
  if(modal.type==='sprint-create') return <SprintModal title="Nuevo sprint" onClose={close} onSave={async f=>{const {error}=await db.from('sprints').insert({...f,workspace_id:props.workspace.id,created_by:props.session.user.id,start_date:f.start_date||null,end_date:f.end_date||null});if(error)throw error;await props.refresh();props.toast('success','Sprint creado.');close()}}/>
  if(modal.type==='sprint-edit') return <SprintModal title="Editar sprint" initial={modal.sprint} onClose={close} onSave={async f=>{const {error}=await db.from('sprints').update({...f,start_date:f.start_date||null,end_date:f.end_date||null}).eq('id',modal.sprint.id);if(error)throw error;await props.refresh();props.toast('success','Sprint actualizado.');close()}}/>
  if(modal.type==='sprint-detail') return <SprintDetailModal workspace={props.workspace} sprint={modal.sprint} tickets={props.tickets} products={props.products} members={props.members} session={props.session} canWork={props.canWork} canPlan={props.canPlan} onClose={close} onTicket={ticket=>setModal({type:'ticket-detail',ticket})} onEdit={()=>setModal({type:'sprint-edit',sprint:modal.sprint})} onRollover={()=>setModal({type:'sprint-rollover',sprint:modal.sprint})} onRefresh={props.refresh} toast={props.toast}/>
  if(modal.type==='sprint-rollover') return <SprintRolloverModal sprint={modal.sprint} sprints={props.sprints} tickets={props.tickets} onClose={close} onSave={async nextId=>{await props.closeSprintAndRollover(modal.sprint,nextId);close()}}/>
  if(modal.type==='sprint-delete') return <ConfirmModal title="Eliminar sprint" message="Los tickets del sprint quedarán sin sprint. Para conservar el flujo recomendado usa “Cerrar / trasladar” desde Backlog." danger onClose={close} onConfirm={async()=>{const {error}=await db.from('sprints').delete().eq('id',modal.sprint.id);if(error)throw error;await props.refresh();props.toast('success','Sprint eliminado.');close()}}/>

  if(modal.type==='help-create') return <HelpdeskModal title="Nueva solicitud de Helpdesk" departments={props.departments} requestTypes={props.requestTypes} members={props.members} session={props.session} canWork={props.canManageHelpdesk} onClose={close} onSave={async f=>{await props.saveHelpdesk(f);close()}}/>
  if(modal.type==='help-edit') return <HelpdeskModal title={`Editar ${modal.item.ticket_key}`} item={modal.item} departments={props.departments} requestTypes={props.requestTypes} members={props.members} session={props.session} canWork={props.canManageHelpdesk} onClose={close} onSave={async f=>{await props.saveHelpdesk(f,modal.item);close()}}/>
  if(modal.type==='help-detail') return <HelpdeskDetailModal item={modal.item} departments={props.departments} requestTypes={props.requestTypes} members={props.members} session={props.session} canWork={props.canManageHelpdesk} canManage={props.canPlan} onClose={close} onEdit={()=>setModal({type:'help-edit',item:modal.item})} onDecision={()=>setModal({type:'help-requirement-decision',item:modal.item})} onRefresh={props.refresh} toast={props.toast}/>
  if(modal.type==='help-actions'){
    const requirement=isProposalCategory(modal.item.category)
    const actions=[['lucide:eye','Ver solicitud',()=>setModal({type:'help-detail',item:modal.item})]]
    if(requirement&&props.canPlan&&(modal.item.proposal_status||'pending')==='pending') actions.push(['lucide:gavel','Evaluar requerimiento',()=>setModal({type:'help-requirement-decision',item:modal.item})])
    if(props.canManageHelpdesk&&!requirement) actions.push(['lucide:pencil','Editar solicitud',()=>setModal({type:'help-edit',item:modal.item})])
    if(props.canManageHelpdesk) actions.push(['lucide:trash-2','Eliminar solicitud',()=>setModal({type:'help-delete',item:modal.item}),'danger'])
    return <ActionSheet title={modal.item.ticket_key} subtitle={modal.item.subject} onClose={close} actions={actions}/>
  }
  if(modal.type==='help-requirement-decision') return <RequirementDecisionModal item={modal.item} products={props.products} onClose={close} onSave={async(decision,productId,note)=>{await props.decideRequirement(modal.item,decision,productId,note);close()}}/>
  if(modal.type==='help-delete') return <ConfirmModal title={`Eliminar ${modal.item.ticket_key}`} message={`¿Deseas eliminar “${modal.item.subject}”?`} danger onClose={close} onConfirm={async()=>{await props.deleteHelpdesk(modal.item);close()}}/>
  if(modal.type==='help-filters') return <HelpFilterModal filters={props.helpFilters} departments={props.departments} requestTypes={props.requestTypes} members={props.members} onClose={close} onApply={f=>{props.setHelpFilters(f);close()}}/>

  if(modal.type==='invite') return <InviteModal workspace={props.workspace} products={props.products} roleTemplates={props.roleTemplates} isSuperadmin={props.isSuperadmin} onClose={close} onSaved={async result=>{await props.loadMemberships(props.workspace.id);await props.refresh();if(result?.temporary_password){setModal({type:'temporary-credentials',credentials:result});return}props.toast('success',result?.invitation_sent?'Invitación enviada y accesos configurados.':'Usuario y accesos configurados.');close()}}/>
  if(modal.type==='temporary-credentials') return <TemporaryCredentialsModal credentials={modal.credentials} onClose={close}/>
  if(modal.type==='member-edit') return <MemberModal workspace={props.workspace} member={{...modal.member,product_ids:props.memberProductAccess.filter(x=>x.user_id===modal.member.user_id).map(x=>x.product_id)}} products={props.products} roleTemplates={props.roleTemplates} session={props.session} isSuperadmin={props.isSuperadmin} onClose={close} onRemove={()=>setModal({type:'member-remove',member:modal.member})} onSave={async f=>{const selected=props.roleTemplates.find(r=>r.id===f.role_id);if(!selected)throw new Error('Selecciona un rol válido.');const allProducts=selected.code==='superadmin'?true:!!f.all_products;const permissions=selected.code==='superadmin'?{}:f.permissions;const {error}=await db.from('workspace_members').update({role_id:f.role_id,role:selected.base_role,active:f.active,all_products:allProducts,permissions}).eq('workspace_id',props.workspace.id).eq('user_id',modal.member.user_id);if(error)throw error;const del=await db.from('workspace_member_products').delete().eq('workspace_id',props.workspace.id).eq('user_id',modal.member.user_id);if(del.error)throw del.error;if(!allProducts&&f.product_ids.length){const ins=await db.from('workspace_member_products').insert(f.product_ids.map(product_id=>({workspace_id:props.workspace.id,user_id:modal.member.user_id,product_id})));if(ins.error)throw ins.error}await props.loadMemberships(props.workspace.id);await props.refresh();props.toast('success','Rol, permisos y productos actualizados.');close()}}/>
  if(modal.type==='member-remove') return <ConfirmModal title="Retirar colaborador" message={`¿Deseas retirar a ${modal.member.profile?.full_name||'este colaborador'} de ${props.workspace.name}? Perderá acceso a este workspace, pero sus tickets e historial se conservarán.`} danger onClose={close} onConfirm={async()=>{if(modal.member.user_id===props.session.user.id)throw new Error('No puedes retirarte a ti mismo desde esta pantalla.');const {error}=await db.from('workspace_members').delete().eq('workspace_id',props.workspace.id).eq('user_id',modal.member.user_id);if(error)throw error;await props.loadMemberships(props.workspace.id);await props.refresh();props.toast('success','Colaborador retirado del workspace.');close()}}/>
  if(modal.type==='role-create') return <RoleModal workspace={props.workspace} roleTemplates={props.roleTemplates} onClose={close} onSave={async f=>{const {error}=await db.from('workspace_roles').insert({...f,workspace_id:props.workspace.id,is_system:false,protected:false});if(error)throw error;await props.refresh();props.toast('success','Rol creado.');close()}}/>
  if(modal.type==='role-edit') return <RoleModal workspace={props.workspace} initial={modal.role} roleTemplates={props.roleTemplates} onClose={close} onSave={async f=>{const {error}=await db.from('workspace_roles').update(f).eq('id',modal.role.id);if(error)throw error;await props.refresh();props.toast('success','Rol actualizado.');close()}}/>
  if(modal.type==='role-delete') return <ConfirmModal title={`Eliminar rol ${modal.role.name}`} message="Solo se puede eliminar un rol si no está asignado a ningún colaborador. Los roles Superadmin están protegidos." danger onClose={close} onConfirm={async()=>{const {error}=await db.from('workspace_roles').delete().eq('id',modal.role.id);if(error)throw error;await props.refresh();props.toast('success','Rol eliminado.');close()}}/>

  if(modal.type==='module-create') return <ModuleModal title="Nuevo módulo / grupo" onClose={close} onSave={async f=>{const {error}=await db.from('ticket_modules').insert({...f,workspace_id:props.workspace.id,module_key:'',created_by:props.session.user.id});if(error)throw error;await props.refresh();props.toast('success','Módulo creado.');close()}}/>
  if(modal.type==='module-edit') return <ModuleModal title={`Editar ${modal.module.module_key}`} initial={modal.module} onClose={close} onSave={async f=>{const {error}=await db.from('ticket_modules').update(f).eq('id',modal.module.id);if(error)throw error;await props.refresh();props.toast('success','Módulo actualizado.');close()}}/>
  if(modal.type==='module-delete') return <ConfirmModal title={`Eliminar ${modal.module.name}`} message="Los tickets conservarán su información pero quedarán sin módulo." danger onClose={close} onConfirm={async()=>{const {error}=await db.from('ticket_modules').delete().eq('id',modal.module.id);if(error)throw error;await props.refresh();props.toast('success','Módulo eliminado.');close()}}/>
  if(modal.type==='tag-create') return <TagModal title="Nueva tag" onClose={close} onSave={async f=>{const {error}=await db.from('ticket_tags').insert({...f,workspace_id:props.workspace.id,slug:'',created_by:props.session.user.id});if(error)throw error;await props.refresh();props.toast('success','Tag creada.');close()}}/>
  if(modal.type==='tag-edit') return <TagModal title={`Editar ${modal.tag.name}`} initial={modal.tag} onClose={close} onSave={async f=>{const {error}=await db.from('ticket_tags').update(f).eq('id',modal.tag.id);if(error)throw error;await props.refresh();props.toast('success','Tag actualizada.');close()}}/>
  if(modal.type==='tag-delete') return <ConfirmModal title={`Eliminar tag ${modal.tag.name}`} message="Se retirará esta tag de todos los tickets relacionados." danger onClose={close} onConfirm={async()=>{const {error}=await db.from('ticket_tags').delete().eq('id',modal.tag.id);if(error)throw error;await props.refresh();props.toast('success','Tag eliminada.');close()}}/>
  if(modal.type==='field-create') return <CustomFieldModal title="Nuevo campo personalizado" products={props.products} onClose={close} onSave={async f=>{const {product_ids=[],...row}=f;const {data,error}=await db.from('custom_ticket_fields').insert({...row,workspace_id:props.workspace.id,field_key:'',created_by:props.session.user.id}).select('*').single();if(error)throw error;if(!row.applies_to_all_products&&product_ids.length){const a=await db.from('custom_ticket_field_products').insert(product_ids.map(product_id=>({workspace_id:props.workspace.id,field_id:data.id,product_id})));if(a.error)throw a.error}await props.refresh();props.toast('success','Campo personalizado creado.');close()}}/>
  if(modal.type==='field-edit') return <CustomFieldModal title={`Editar ${modal.field.name}`} initial={{...modal.field,product_ids:props.customFieldProducts.filter(x=>x.field_id===modal.field.id).map(x=>x.product_id)}} products={props.products} onClose={close} onSave={async f=>{const {product_ids=[],...row}=f;const {error}=await db.from('custom_ticket_fields').update(row).eq('id',modal.field.id);if(error)throw error;const del=await db.from('custom_ticket_field_products').delete().eq('field_id',modal.field.id);if(del.error)throw del.error;if(!row.applies_to_all_products&&product_ids.length){const a=await db.from('custom_ticket_field_products').insert(product_ids.map(product_id=>({workspace_id:props.workspace.id,field_id:modal.field.id,product_id})));if(a.error)throw a.error}await props.refresh();props.toast('success','Campo actualizado.');close()}}/>
  if(modal.type==='field-delete') return <ConfirmModal title={`Eliminar campo ${modal.field.name}`} message="Se eliminarán los valores de este campo en los tickets." danger onClose={close} onConfirm={async()=>{const {error}=await db.from('custom_ticket_fields').delete().eq('id',modal.field.id);if(error)throw error;await props.refresh();props.toast('success','Campo eliminado.');close()}}/>

  if(modal.type==='product-create') return <ProductModal title="Nuevo producto" onClose={close} onSave={async f=>{const {error}=await db.from('products').insert({...f,workspace_id:props.workspace.id,board_order:props.products.length+1});if(error)throw error;await props.refresh();props.toast('success','Producto creado.');close()}}/>
  if(modal.type==='product-edit') return <ProductModal title="Editar producto" initial={modal.product} onClose={close} onSave={async f=>{const {error}=await db.from('products').update(f).eq('id',modal.product.id);if(error)throw error;await props.refresh();props.toast('success','Producto actualizado.');close()}}/>
  if(modal.type==='product-delete') return <ConfirmModal title="Eliminar producto" message="No podrás eliminar un producto si tiene tickets asociados. Reasigna o elimina esos tickets primero." danger onClose={close} onConfirm={async()=>{const {error}=await db.from('products').delete().eq('id',modal.product.id);if(error)throw error;await props.refresh();props.toast('success','Producto eliminado.');close()}}/>

  if(modal.type==='request-type-create') return <RequestTypeModal title="Nuevo tipo de solicitud" requestTypes={props.requestTypes} onClose={close} onSave={async f=>{const {error}=await db.from('helpdesk_request_types').insert({...f,workspace_id:props.workspace.id,created_by:props.session.user.id});if(error)throw error;await props.refresh();props.toast('success','Tipo de solicitud creado.');close()}}/>
  if(modal.type==='request-type-edit') return <RequestTypeModal title="Editar tipo de solicitud" initial={modal.requestType} requestTypes={props.requestTypes} onClose={close} onSave={async f=>{const {error}=await db.from('helpdesk_request_types').update(f).eq('id',modal.requestType.id);if(error)throw error;await props.refresh();props.toast('success','Tipo de solicitud actualizado.');close()}}/>
  if(modal.type==='request-type-delete'){
    const used=props.helpdesk?.filter?.(h=>h.request_type_id===modal.requestType.id)?.length||0
    if(used>0) return <ConfirmModal title="Desactivar tipo de solicitud" message={`“${modal.requestType.name}” tiene ${used} solicitud${used===1?'':'es'} asociada${used===1?'':'s'}. Para conservar el histórico se desactivará en lugar de eliminarse.`} onClose={close} onConfirm={async()=>{const {error}=await db.from('helpdesk_request_types').update({active:false}).eq('id',modal.requestType.id);if(error)throw error;await props.refresh();props.toast('success','Tipo desactivado; el histórico se conserva.');close()}}/>
    return <ConfirmModal title="Eliminar tipo de solicitud" message={`Se eliminará “${modal.requestType.name}”. Esta acción solo está disponible porque todavía no tiene solicitudes asociadas.`} danger onClose={close} onConfirm={async()=>{const {error}=await db.from('helpdesk_request_types').delete().eq('id',modal.requestType.id);if(error)throw error;await props.refresh();props.toast('success','Tipo de solicitud eliminado.');close()}}/>
  }
  if(modal.type==='department-create') return <DepartmentModal title="Nueva área de Helpdesk" onClose={close} onSave={async f=>{const {error}=await db.from('helpdesk_departments').insert({...f,workspace_id:props.workspace.id});if(error)throw error;await props.refresh();props.toast('success','Área creada.');close()}}/>
  if(modal.type==='department-edit') return <DepartmentModal title="Editar área de Helpdesk" initial={modal.department} onClose={close} onSave={async f=>{const {error}=await db.from('helpdesk_departments').update(f).eq('id',modal.department.id);if(error)throw error;await props.refresh();props.toast('success','Área actualizada.');close()}}/>
  if(modal.type==='department-delete') return <ConfirmModal title="Eliminar área" message="Las solicitudes existentes conservarán el ticket, pero quedarán sin área asignada." danger onClose={close} onConfirm={async()=>{const {error}=await db.from('helpdesk_departments').delete().eq('id',modal.department.id);if(error)throw error;await props.refresh();props.toast('success','Área eliminada.');close()}}/>
  if(modal.type==='quick-help') return <QuickHelpModal helpdeskEnabled={props.settings?.helpdesk_enabled!==false} canOpenSettings={props.canManageSettings||props.canManageProducts} onClose={close} onHelpdesk={()=>{props.setView('helpdesk');close()}} onSettings={()=>{props.setView('settings');close()}}/>
  return null
}

function Modal({title,subtitle,onClose,children,size='md'}){return <div className="modal-backdrop" onMouseDown={onClose}><div className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-label={title} onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">JIRA INTERNO</span><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div><button type="button" className="icon-button" onClick={onClose} title="Cerrar" aria-label="Cerrar modal"><Icon name="lucide:x"/></button></div>{children}</div></div>}
function AsyncForm({onSubmit,children,submitLabel='Guardar',danger=false}){
  const [error,setError]=useState(''),[saving,setSaving]=useState(false)
  const go=async e=>{e.preventDefault();setSaving(true);setError('');try{await onSubmit()}catch(err){setError(err.message||String(err))}finally{setSaving(false)}}
  const list=React.Children.toArray(children)
  const secondary=list.filter(child=>child?.props?.className==='modal-secondary')
  const content=list.filter(child=>child?.props?.className!=='modal-secondary')
  return <form className="form modal-form" onSubmit={go}><div className="form-body">{content}{error&&<div className="error"><Icon name="lucide:triangle-alert"/>{error}</div>}</div><div className="form-footer"><div className="form-footer-left">{secondary.flatMap(x=>React.Children.toArray(x.props.children))}</div><div className="modal-actions"><button type="submit" className={danger?'danger-button':'primary'} disabled={saving}>{saving?'Procesando…':submitLabel}</button></div></div></form>
}

function ConfirmModal({title,message,danger,onClose,onConfirm}){return <Modal title={title} onClose={onClose} size="sm"><AsyncForm onSubmit={onConfirm} submitLabel={danger?'Eliminar definitivamente':'Confirmar'} danger={danger}><div className="confirm-box"><span className={danger?'danger-icon':'info-icon'}><Icon name={danger?'lucide:triangle-alert':'lucide:circle-help'} size={26}/></span><p>{message}</p></div><div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div></AsyncForm></Modal>}
function ActionSheet({title,subtitle,onClose,actions}){return <Modal title={title} subtitle={subtitle} onClose={onClose} size="sm"><div className="action-sheet">{actions.map(([icon,label,fn,tone])=><button key={label} className={tone==='danger'?'danger-action':''} onClick={fn}><Icon name={icon}/><span>{label}</span><Icon name="lucide:chevron-right" size={16}/></button>)}</div></Modal>}

function WorkspaceModal({title,initial,onClose,onSave}){const [name,setName]=useState(initial?.name||'');return <Modal title={title} subtitle="Los datos y permisos permanecerán aislados por espacio." onClose={onClose}><AsyncForm onSubmit={()=>onSave({name:name.trim()})} submitLabel="Guardar workspace"><label>Nombre del workspace<input autoFocus value={name} onChange={e=>setName(e.target.value)} required placeholder="Ej. Desarrollo TROBBU"/></label><div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div></AsyncForm></Modal>}
function WorkspaceConfigModal({workspace,settings,onClose,onSaved}){const [f,setF]=useState({timezone:settings?.timezone||'America/Merida',default_sprint_days:settings?.default_sprint_days||14,support_email:settings?.support_email||'',sla_first_response_hours:settings?.sla_first_response_hours||4,sla_resolution_hours:settings?.sla_resolution_hours||24,in_app_notifications:settings?.in_app_notifications??true,email_notifications:settings?.email_notifications??true,helpdesk_enabled:settings?.helpdesk_enabled??true});return <Modal title="Editar configuración" subtitle={`Preferencias operativas de ${workspace.name}.`} onClose={onClose} size="lg"><AsyncForm onSubmit={async()=>{const sprintDays=Number(f.default_sprint_days),first=Number(f.sla_first_response_hours),resolution=Number(f.sla_resolution_hours);if(!f.timezone.trim())throw new Error('La zona horaria es obligatoria.');try{new Intl.DateTimeFormat('es-MX',{timeZone:f.timezone.trim()}).format(new Date())}catch{throw new Error('Ingresa una zona horaria IANA válida, por ejemplo America/Merida.')}if(sprintDays<1||sprintDays>90)throw new Error('La duración del sprint debe estar entre 1 y 90 días.');if(first<1||first>720)throw new Error('El SLA de primera respuesta debe estar entre 1 y 720 horas.');if(resolution<1||resolution>2160)throw new Error('El SLA de resolución debe estar entre 1 y 2160 horas.');const {error}=await db.from('workspace_settings').update({timezone:f.timezone.trim(),default_sprint_days:sprintDays,support_email:f.support_email.trim()||null,sla_first_response_hours:first,sla_resolution_hours:resolution,in_app_notifications:!!f.in_app_notifications,email_notifications:!!f.email_notifications,helpdesk_enabled:!!f.helpdesk_enabled}).eq('workspace_id',workspace.id);if(error)throw error;await onSaved()}} submitLabel="Guardar configuración"><div className="form-section"><h4>Operación</h4><div className="form-grid"><label>Zona horaria<input value={f.timezone} onChange={e=>setF({...f,timezone:e.target.value})} required/></label><label>Duración de sprint (días)<input type="number" min="1" max="90" value={f.default_sprint_days} onChange={e=>setF({...f,default_sprint_days:e.target.value})}/></label><label>Correo de soporte<input type="email" value={f.support_email} onChange={e=>setF({...f,support_email:e.target.value})} placeholder="soporte@trobbu.com"/></label><label>SLA primera respuesta (hrs)<input type="number" min="1" max="720" value={f.sla_first_response_hours} onChange={e=>setF({...f,sla_first_response_hours:e.target.value})}/></label><label>SLA resolución (hrs)<input type="number" min="1" max="2160" value={f.sla_resolution_hours} onChange={e=>setF({...f,sla_resolution_hours:e.target.value})}/></label></div></div><div className="form-section"><h4>Funciones</h4><div className="toggle-list"><Toggle label="Notificaciones dentro de la plataforma" checked={!!f.in_app_notifications} onChange={v=>setF({...f,in_app_notifications:v})}/><Toggle label="Notificaciones por correo" checked={!!f.email_notifications} onChange={v=>setF({...f,email_notifications:v})}/><Toggle label="Helpdesk habilitado" checked={!!f.helpdesk_enabled} onChange={v=>setF({...f,helpdesk_enabled:v})}/></div></div><div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div></AsyncForm></Modal>}
function WorkspaceSwitcherModal({workspaces,current,onClose,onSelect,onCreate}){return <Modal title="Cambiar espacio de trabajo" subtitle="Selecciona el contexto que deseas administrar." onClose={onClose}><div className="form-body switcher-body"><div className="workspace-list">{workspaces.map(w=><button type="button" key={w.id} className={w.id===current?.id?'active':''} onClick={()=>onSelect(w)}><span className="workspace-icon"><Icon name="lucide:layers-3"/></span><div><b>{w.name}</b><span>{ROLE_LABELS[w.role]||w.role}</span></div>{w.id===current?.id&&<Icon name="lucide:check"/>}</button>)}</div></div><div className="form-footer static-footer"><div className="form-footer-left"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div><div className="modal-actions"><button type="button" className="primary" onClick={onCreate}><Icon name="lucide:plus"/> Crear otro workspace</button></div></div></Modal>}

function TicketModal({title,ticket,products,sprints,members,modules=[],tags=[],ticketTagLinks=[],customFields=[],customFieldProducts=[],customValues=[],reporterMode=false,onClose,onSave}){
  const initialCustom={}
  customValues.filter(v=>v.ticket_id===ticket?.id).forEach(v=>initialCustom[v.field_id]=v.value)
  const [f,setF]=useState({
    product_id:ticket?.product_id||products[0]?.id||'',module_id:ticket?.module_id||'',tag_ids:ticketTagLinks.filter(x=>x.ticket_id===ticket?.id).map(x=>x.tag_id),custom_values:initialCustom,
    sprint_id:ticket?.sprint_id||'',title:ticket?.title||'',description:ticket?.description||'',type:ticket?.type||'task',priority:ticket?.priority||'medium',status:ticket?.status||'backlog',dev_owner_id:ticket?.dev_owner_id||'',qa_owner_id:ticket?.qa_owner_id||'',story_points:ticket?.story_points??'',start_date:ticket?.start_date||'',due_date:ticket?.due_date||''
  })
  const set=(k,v)=>setF(x=>({...x,[k]:v}))
  const setCustom=(id,v)=>setF(x=>({...x,custom_values:{...x.custom_values,[id]:v}}))
  const toggleTag=id=>set('tag_ids',f.tag_ids.includes(id)?f.tag_ids.filter(x=>x!==id):[...f.tag_ids,id])
  const memberHasProduct=m=>m.role==='superadmin'||m.all_products||m.product_ids?.includes(f.product_id)
  const devs=members.filter(m=>m.active&&effectivePermissions(m,m.role_template).edit_tickets&&memberHasProduct(m))
  const qas=members.filter(m=>m.active&&effectivePermissions(m,m.role_template).qa_review&&memberHasProduct(m))
  const fields=customFields.filter(cf=>cf.active&&(cf.applies_to_all_products||customFieldProducts.some(fp=>fp.field_id===cf.id&&fp.product_id===f.product_id)))
  const activeModules=modules.filter(m=>m.active||m.id===ticket?.module_id)
  const activeTags=tags.filter(t=>t.active||f.tag_ids.includes(t.id))
  const validate=()=>{
    for(const field of fields){const v=f.custom_values[field.id],empty=v===undefined||v===null||v===''||(Array.isArray(v)&&!v.length);if(field.required&&empty)throw new Error(`Completa el campo obligatorio: ${field.name}.`)}
    return onSave(f)
  }
  return <Modal title={title} subtitle={reporterMode?'Envía una solicitud documentada al Backlog. El equipo definirá sprint, responsables y fechas.':'Define alcance, clasificación, documentación y ciclo de entrega.'} onClose={onClose} size="xl"><AsyncForm onSubmit={validate} submitLabel={ticket?'Guardar cambios':reporterMode?'Enviar al Backlog':'Crear ticket'}>
    <div className="form-section"><h4>Información principal</h4><label>Título<input value={f.title} onChange={e=>set('title',e.target.value)} required placeholder="Describe el trabajo en una frase"/></label><label>Descripción<textarea rows="5" value={f.description} onChange={e=>set('description',e.target.value)} placeholder="Contexto, criterios de aceptación, pasos para reproducir…"/></label></div>
    <div className="form-section"><h4>Clasificación y agrupación</h4><div className="form-grid">
      <label>Producto<select value={f.product_id} onChange={e=>set('product_id',e.target.value)} required>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label>Módulo / Grupo<select value={f.module_id} onChange={e=>set('module_id',e.target.value)}><option value="">Sin módulo</option>{activeModules.map(m=><option key={m.id} value={m.id}>{m.module_key} · {m.name}</option>)}</select></label>
      <label>Tipo<select value={f.type} onChange={e=>set('type',e.target.value)}>{TYPES.map(x=><option key={x} value={x}>{TYPE_LABELS[x]}</option>)}</select></label>
      <label>Prioridad<select value={f.priority} onChange={e=>set('priority',e.target.value)}>{PRIORITIES.map(x=><option key={x} value={x}>{PRIORITY_LABELS[x]}</option>)}</select></label>
    </div>
    <div className="tag-picker"><span className="field-label">Tags</span><div className="tag-chip-grid">{activeTags.length?activeTags.map(tag=><button type="button" key={tag.id} className={`tag-choice ${f.tag_ids.includes(tag.id)?'selected':''}`} onClick={()=>toggleTag(tag.id)} style={{'--tag-color':tag.color}}><span></span>{tag.name}<Icon name={f.tag_ids.includes(tag.id)?'lucide:check':'lucide:plus'} size={13}/></button>):<small className="muted">No hay tags configuradas.</small>}</div></div>
    {reporterMode&&<div className="notice"><Icon name="lucide:inbox"/><span>El ticket se creará en <b>Backlog</b>, sin responsables, sprint ni fechas. Módulo, tags y campos documentales sí se conservarán.</span></div>}</div>
    {!reporterMode&&<div className="form-section"><h4>Planeación</h4><div className="form-grid">
      <label>Sprint<select value={f.sprint_id} onChange={e=>set('sprint_id',e.target.value)}><option value="">Sin sprint / Backlog</option>{sprints.filter(s=>s.status!=='completed'||s.id===ticket?.sprint_id).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label>Estado<select value={f.status} onChange={e=>set('status',e.target.value)}>{STATUS.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label>
      <label>Story Points<select value={f.story_points} onChange={e=>set('story_points',e.target.value)}><option value="">Sin estimar</option>{STORY_POINTS.map(sp=><option key={sp} value={sp}>{sp} · {STORY_POINT_LABELS[sp]}</option>)}</select><small>Complejidad relativa 1–5; no representa horas. <a href="./Story_Points_1_a_5_TROBBU.pdf" target="_blank" rel="noreferrer">Ver escala y ejemplos</a>.</small></label>
      <label>Responsable Dev<select value={f.dev_owner_id} onChange={e=>set('dev_owner_id',e.target.value)}><option value="">Sin asignar</option>{devs.map(m=><option key={m.user_id} value={m.user_id}>{m.profile?.full_name||m.user_id.slice(0,8)}</option>)}</select></label>
      <label>Responsable QA<select value={f.qa_owner_id} onChange={e=>set('qa_owner_id',e.target.value)}><option value="">Sin asignar</option>{qas.map(m=><option key={m.user_id} value={m.user_id}>{m.profile?.full_name||m.user_id.slice(0,8)}</option>)}</select></label>
      <label>Fecha de inicio<input type="date" value={f.start_date} onChange={e=>set('start_date',e.target.value)}/></label><label>Fecha de entrega<input type="date" min={f.start_date||undefined} value={f.due_date} onChange={e=>set('due_date',e.target.value)}/></label>
    </div></div>}
    {fields.length>0&&<div className="form-section"><div className="section-heading"><div><h4>Campos adicionales</h4><p>Documentación específica configurada para este workspace/producto.</p></div></div><div className="form-grid custom-field-form">{fields.map(field=><CustomFieldInput key={field.id} field={field} value={f.custom_values[field.id]} onChange={v=>setCustom(field.id,v)}/>)}</div></div>}
    <div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div>
  </AsyncForm></Modal>
}

function EvidenceKind({kind='comment'}){
  const map={comment:['Comentario','lucide:message-square'],review:['Revisión','lucide:search-check'],rejection:['Rechazo','lucide:circle-x'],fix:['Fix / Corrección','lucide:wrench'],closure:['Cierre','lucide:badge-check']}
  const row=map[kind]||map.comment
  return <span className={`evidence-kind evidence-${kind}`}><Icon name={row[1]} size={12}/>{row[0]}</span>
}

function EvidenceGallery({rows,session,canManage,onDelete}){
  if(!rows?.length)return null
  return <div className="evidence-gallery">{rows.map(row=><figure className="evidence-card" key={row.id}>{row.signed_url?<a href={row.signed_url} target="_blank" rel="noreferrer"><img src={row.signed_url} alt={row.file_name}/></a>:<div className="evidence-missing"><Icon name="lucide:image-off"/></div>}<figcaption><span><b>{row.file_name}</b><small>{evidenceLabel(row.evidence_type)} · {formatDateTime(row.created_at)}</small></span>{(row.uploaded_by===session.user.id||canManage)&&<button type="button" className="icon-button danger-text" title="Eliminar evidencia" onClick={()=>onDelete(row)}><Icon name="lucide:trash-2" size={14}/></button>}</figcaption></figure>)}</div>
}

function EvidenceCommentModal({title,initial,onClose,onSave,allowFiles=false}){
  const [body,setBody]=useState(initial?.body||'')
  const [kind,setKind]=useState(initial?.kind||'comment')
  const [files,setFiles]=useState([])
  return <Modal title={title} subtitle="Documenta revisión, rechazo, solicitud de fixes o cierre del trabajo." onClose={onClose}><AsyncForm onSubmit={()=>onSave({body,kind,files})} submitLabel="Guardar evidencia">
    <label>Tipo<select value={kind} onChange={e=>setKind(e.target.value)}><option value="comment">Comentario general</option><option value="review">Revisión</option><option value="rejection">Rechazo</option><option value="fix">Fix / Corrección</option><option value="closure">Cierre</option></select></label>
    <label>Comentario<textarea rows="5" value={body} onChange={e=>setBody(e.target.value)} required placeholder="Describe la revisión, hallazgo, corrección o criterio de cierre…"/></label>
    {allowFiles&&<label>Evidencia en imágenes <span className="optional">Hasta 5 · 10 MB c/u</span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={e=>setFiles(Array.from(e.target.files||[]).slice(0,5))}/>{files.length>0&&<small className="field-help">{files.map(f=>f.name).join(' · ')}</small>}</label>}
    <div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div>
  </AsyncForm></Modal>
}

function TicketDetailModal({workspace,ticket,tickets,products,members,modules=[],tags=[],ticketTagLinks=[],ticketLinks=[],customFields=[],customValues=[],session,canWork,canManage,onClose,onEdit,onPlan,onLink,onOpenRelated,onRefresh,toast}){
  const [comments,setComments]=useState([])
  const [activity,setActivity]=useState([])
  const [attachments,setAttachments]=useState([])
  const [tab,setTab]=useState('comments')
  const [commentModal,setCommentModal]=useState(null)
  const load=async()=>{
    const [c,a,e]=await Promise.all([
      db.from('ticket_comments').select('*').eq('ticket_id',ticket.id).order('created_at'),
      db.from('ticket_activity').select('*').eq('ticket_id',ticket.id).order('created_at',{ascending:false}),
      db.from('ticket_attachments').select('*').eq('ticket_id',ticket.id).order('created_at')
    ])
    if(c.error) toast('error',c.error.message); else setComments(c.data||[])
    if(a.error) toast('error',a.error.message); else setActivity(a.data||[])
    if(e.error) toast('error',e.error.message); else setAttachments(await signedEvidenceRows(e.data||[]))
  }
  useEffect(()=>{load()},[ticket.id])
  const addComment=async({body,kind,files})=>{
    body=String(body||'').trim();if(!body)throw new Error('Escribe un comentario.')
    const {data,error}=await db.from('ticket_comments').insert({ticket_id:ticket.id,author_id:session.user.id,body,kind:kind||'comment'}).select('*').single()
    if(error)throw error
    try{await uploadEvidenceFiles({workspaceId:workspace.id,scope:'tickets',parentId:ticket.id,commentId:data.id,files,evidenceType:kind==='comment'?'general':kind,userId:session.user.id})}catch(err){await db.from('ticket_comments').delete().eq('id',data.id);throw err}
    await load();toast('success','Comentario y evidencia agregados.')
  }
  const editComment=async(comment,{body,kind})=>{const {error}=await db.from('ticket_comments').update({body:String(body||'').trim(),kind:kind||'comment'}).eq('id',comment.id);if(error)throw error;await load();toast('success','Comentario actualizado.')}
  const deleteComment=async comment=>{const {error}=await db.from('ticket_comments').delete().eq('id',comment.id);if(error)throw error;await load();toast('success','Comentario eliminado. Las evidencias se conservan en el historial.')}
  const deleteEvidence=async row=>{const {error:se}=await db.storage.from('jira-evidence').remove([row.storage_path]);if(se)throw se;const {error}=await db.from('ticket_attachments').delete().eq('id',row.id);if(error)throw error;await load();toast('success','Evidencia eliminada.')}
  const product=products.find(p=>p.id===ticket.product_id)
  const dev=members.find(m=>m.user_id===ticket.dev_owner_id)?.profile?.full_name||'Sin asignar'
  const qa=members.find(m=>m.user_id===ticket.qa_owner_id)?.profile?.full_name||'Sin asignar'
  const module=modules.find(m=>m.id===ticket.module_id)
  const ticketTags=ticketTagLinks.filter(x=>x.ticket_id===ticket.id).map(x=>tags.find(t=>t.id===x.tag_id)).filter(Boolean)
  const fieldRows=customFields.filter(f=>f.active).map(field=>({field,value:customValues.find(v=>v.ticket_id===ticket.id&&v.field_id===field.id)?.value})).filter(x=>x.value!==undefined&&x.value!==null&&x.value!==''&&(!Array.isArray(x.value)||x.value.length))
  const relations=ticketLinks.filter(l=>l.source_ticket_id===ticket.id||l.target_ticket_id===ticket.id).map(link=>{const outgoing=link.source_ticket_id===ticket.id;const other=tickets.find(t=>t.id===(outgoing?link.target_ticket_id:link.source_ticket_id));let label=LINK_LABELS[link.link_type]||link.link_type;if(link.link_type==='blocks'&&!outgoing)label='Está bloqueado por';if(link.link_type==='follows'&&!outgoing)label='Es seguido por';return {...link,outgoing,other,label}})
  const blockerRelations=relations.filter(r=>r.link_type==='blocks'&&!r.outgoing&&!['qa_passed','closed'].includes(r.other?.status))
  const deleteRelation=async row=>{const {error}=await db.from('ticket_links').delete().eq('id',row.id);if(error)return toast('error',error.message);await onRefresh();toast('success','Relación eliminada.')}
  const unlinked=attachments.filter(a=>!a.comment_id)
  return <><Modal title={`${ticket.ticket_key} · ${ticket.title}`} subtitle={product?.name} onClose={onClose} size="xl"><div className="detail-grid"><div className="detail-main">
    <div className="detail-description"><h4>Descripción</h4><p>{ticket.description||'Sin descripción.'}</p></div>
    {blockerRelations.length>0&&<div className="blocked-banner"><Icon name="lucide:lock-keyhole"/><div><b>Ticket bloqueado</b><p>Debe liberarse {blockerRelations.map(r=>r.other?.ticket_key).filter(Boolean).join(', ')} antes de continuar.</p></div></div>}
    {(module||ticketTags.length>0)&&<div className="ticket-metadata-panel"><div><span className="field-label">Módulo / Grupo</span>{module?<span className="module-chip" style={{'--module-color':module.color}}><i></i>{module.module_key} · {module.name}</span>:<span className="muted">Sin módulo</span>}</div><div><span className="field-label">Tags</span><div className="tag-chip-grid compact">{ticketTags.length?ticketTags.map(tag=><span className="tag-display" key={tag.id} style={{'--tag-color':tag.color}}><i></i>{tag.name}</span>):<span className="muted">Sin tags</span>}</div></div></div>}
    {fieldRows.length>0&&<div className="custom-values-panel"><h4>Campos adicionales</h4><div className="custom-value-grid">{fieldRows.map(({field,value})=><div key={field.id}><span>{field.name}</span><b>{Array.isArray(value)?value.join(', '):field.field_type==='boolean'?(value?'Sí':'No'):String(value)}</b></div>)}</div></div>}
    <div className="relations-panel"><div className="section-heading"><div><h4>Relaciones</h4><p>Dependencias, seguimiento y referencias entre tickets.</p></div>{canWork&&<button type="button" className="secondary-button compact" onClick={onLink}><Icon name="lucide:git-branch-plus"/> Relacionar</button>}</div>{relations.length===0?<p className="muted">Este ticket todavía no tiene relaciones.</p>:<div className="relation-list">{relations.map(r=><div className={`relation-row ${r.link_type==='blocks'?'dependency':''}`} key={r.id}><span className="relation-type">{r.label}</span><button type="button" className="relation-ticket" onClick={()=>r.other&&onOpenRelated(r.other)}><b>{r.other?.ticket_key||'Ticket'}</b><span>{r.other?.title||'No disponible'}</span>{r.other&&<StatusBadge status={r.other.status}/>}</button>{canWork&&<button type="button" className="icon-button danger-text" onClick={()=>deleteRelation(r)} title="Eliminar relación"><Icon name="lucide:unlink" size={15}/></button>}</div>)}</div>}</div>
    <div className="detail-tabs"><button type="button" className={tab==='comments'?'active':''} onClick={()=>setTab('comments')}>Revisión y evidencias <em>{comments.length+attachments.length}</em></button><button type="button" className={tab==='activity'?'active':''} onClick={()=>setTab('activity')}>Actividad <em>{activity.length}</em></button></div>
    {tab==='comments'?<><div className="comment-list">{comments.length===0&&unlinked.length===0&&<p className="muted">Todavía no hay comentarios ni evidencias.</p>}{comments.map(c=>{const author=members.find(m=>m.user_id===c.author_id)?.profile?.full_name||'Usuario',own=c.author_id===session.user.id,files=attachments.filter(a=>a.comment_id===c.id);return <div className={`comment evidence-comment kind-${c.kind||'comment'}`} key={c.id}><span className="mini-avatar">{initials(author)}</span><div className="comment-body"><div className="comment-head"><div><div className="comment-kind-row"><b>{author}</b><EvidenceKind kind={c.kind}/></div><small>{formatDateTime(c.created_at)}</small></div>{(own||canManage)&&<button type="button" className="icon-button" onClick={()=>setCommentModal({type:'actions',comment:c,own})}><Icon name="lucide:ellipsis" size={16}/></button>}</div><p>{c.body}</p><EvidenceGallery rows={files} session={session} canManage={canManage} onDelete={row=>setCommentModal({type:'delete-evidence',row})}/></div></div>})}{unlinked.length>0&&<div className="standalone-evidence"><h4>Evidencias conservadas</h4><EvidenceGallery rows={unlinked} session={session} canManage={canManage} onDelete={row=>setCommentModal({type:'delete-evidence',row})}/></div>}</div>{canWork?<div className="comment-create-row"><button type="button" className="primary compact" onClick={()=>setCommentModal({type:'create'})}><Icon name="lucide:image-plus"/> Agregar revisión / evidencia</button></div>:<div className="notice"><Icon name="lucide:eye"/> Tu rol tiene acceso de solo lectura a la revisión del ticket.</div>}</>:<div className="activity-list">{activity.map(a=><div className="activity-item" key={a.id}><span className="activity-dot"></span><div><b>{a.action==='created'?'Ticket creado':'Cambio de '+a.action.replaceAll('_',' ')}</b><p>{a.from_value&&`${a.from_value} → `}{a.to_value}</p><small>{formatDateTime(a.created_at)}</small></div></div>)}</div>}
  </div><aside className="detail-aside">{canWork&&<button type="button" className="primary full" onClick={onEdit}><Icon name="lucide:pencil"/> Editar ticket</button>}{canManage&&<button type="button" className="secondary-button full" onClick={onPlan}><Icon name="lucide:calendar-plus"/> Planificar sprint</button>}<DetailRow label="Estado"><StatusBadge status={ticket.status}/></DetailRow><DetailRow label="Prioridad"><span className={`priority-badge priority-${ticket.priority}`}>{PRIORITY_LABELS[ticket.priority]}</span></DetailRow><DetailRow label="Dev">{dev}</DetailRow><DetailRow label="QA">{qa}</DetailRow><DetailRow label="Story points">{ticket.story_points?<span className="sp-pill">{ticket.story_points} · {STORY_POINT_LABELS[ticket.story_points]}</span>:'—'}</DetailRow><DetailRow label="Inicio">{formatDate(ticket.start_date)}</DetailRow><DetailRow label="Entrega">{formatDate(ticket.due_date)}</DetailRow><DetailRow label="Actualizado">{formatDateTime(ticket.updated_at)}</DetailRow></aside></div></Modal>
    {commentModal?.type==='create'&&<EvidenceCommentModal title="Agregar revisión / evidencia" initial={{body:'',kind:'comment'}} allowFiles onClose={()=>setCommentModal(null)} onSave={async data=>{await addComment(data);setCommentModal(null)}}/>}
    {commentModal?.type==='actions'&&<ActionSheet title="Comentario" subtitle="Selecciona una acción" onClose={()=>setCommentModal(null)} actions={[...(commentModal.own?[['lucide:pencil','Editar comentario',()=>setCommentModal({type:'edit',comment:commentModal.comment})]]:[]),['lucide:trash-2','Eliminar comentario',()=>setCommentModal({type:'delete',comment:commentModal.comment}),'danger']]}/>} 
    {commentModal?.type==='edit'&&<EvidenceCommentModal title="Editar comentario" initial={{body:commentModal.comment.body,kind:commentModal.comment.kind||'comment'}} onClose={()=>setCommentModal(null)} onSave={async data=>{await editComment(commentModal.comment,data);setCommentModal(null)}}/>}
    {commentModal?.type==='delete'&&<ConfirmModal title="Eliminar comentario" message="El texto se eliminará. Las imágenes de evidencia se conservarán en el historial del ticket." danger onClose={()=>setCommentModal(null)} onConfirm={async()=>{await deleteComment(commentModal.comment);setCommentModal(null)}}/>}
    {commentModal?.type==='delete-evidence'&&<ConfirmModal title="Eliminar evidencia" message={`Se eliminará “${commentModal.row.file_name}” de forma permanente.`} danger onClose={()=>setCommentModal(null)} onConfirm={async()=>{await deleteEvidence(commentModal.row);setCommentModal(null)}}/>}
  </>
}

function DetailRow({label,children}){return <div className="detail-row"><span>{label}</span><div>{children}</div></div>}

function CustomFieldInput({field,value,onChange}){
  const options=Array.isArray(field.options)?field.options:[]
  const label=<>{field.name}{field.required&&<b className="required-star"> *</b>}</>
  if(field.field_type==='textarea')return <label>{label}<textarea rows="3" value={value??''} onChange={e=>onChange(e.target.value)} placeholder={field.placeholder||''}/></label>
  if(field.field_type==='number')return <label>{label}<input type="number" value={value??''} onChange={e=>onChange(e.target.value===''?'':Number(e.target.value))} placeholder={field.placeholder||''}/></label>
  if(field.field_type==='date')return <label>{label}<input type="date" value={value??''} onChange={e=>onChange(e.target.value)}/></label>
  if(field.field_type==='boolean')return <label>{label}<select value={value===true?'true':value===false?'false':''} onChange={e=>onChange(e.target.value===''?'':e.target.value==='true')}><option value="">Selecciona…</option><option value="true">Sí</option><option value="false">No</option></select></label>
  if(field.field_type==='select')return <label>{label}<select value={value??''} onChange={e=>onChange(e.target.value)}><option value="">Selecciona…</option>{options.map(o=><option key={o} value={o}>{o}</option>)}</select></label>
  if(field.field_type==='multiselect')return <div className="field-multiselect"><span className="field-label">{label}</span><div className="check-chip-grid">{options.map(o=>{const selected=Array.isArray(value)&&value.includes(o);return <button type="button" key={o} className={selected?'selected':''} onClick={()=>onChange(selected?value.filter(x=>x!==o):[...(Array.isArray(value)?value:[]),o])}><Icon name={selected?'lucide:check-square-2':'lucide:square'} size={15}/>{o}</button>})}</div></div>
  return <label>{label}<input type={field.field_type==='url'?'url':'text'} value={value??''} onChange={e=>onChange(e.target.value)} placeholder={field.placeholder||''}/></label>
}

function TicketLinkModal({ticket,tickets,products,existing,onClose,onSave}){
  const [f,setF]=useState({link_type:'blocks',other_ticket_id:'',note:''})
  const options=tickets.filter(t=>t.id!==ticket.id)
  return <Modal title={`Relacionar ${ticket.ticket_key}`} subtitle="Crea dependencias, referencias o continuidad entre tickets." onClose={onClose} size="lg"><AsyncForm onSubmit={()=>{if(!f.other_ticket_id)throw new Error('Selecciona el ticket relacionado.');return onSave(f)}} submitLabel="Crear relación">
    <div className="relation-explainer"><Icon name="lucide:git-fork"/><div><b>Las dependencias Bloquea / Está bloqueado por son funcionales.</b><p>El ticket dependiente no puede avanzar hasta que el bloqueador llegue a QA aprobado o Cerrado.</p></div></div>
    <div className="form-grid"><label>Relación<select value={f.link_type} onChange={e=>setF({...f,link_type:e.target.value})}>{LINK_TYPES.map(([k,l])=><option value={k} key={k}>{l}</option>)}</select></label><label>Ticket relacionado<select value={f.other_ticket_id} onChange={e=>setF({...f,other_ticket_id:e.target.value})} required><option value="">Selecciona…</option>{options.map(t=><option value={t.id} key={t.id}>{t.ticket_key} · {t.title} · {products.find(p=>p.id===t.product_id)?.name||''}</option>)}</select></label></div>
    <label>Nota de relación<textarea rows="3" value={f.note} onChange={e=>setF({...f,note:e.target.value})} placeholder="Ej. La API debe estar liberada antes de iniciar esta vista."/></label>
    <div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div>
  </AsyncForm></Modal>
}

function DependencyOverrideModal({ticket,status,onClose,onSave}){const [note,setNote]=useState('');return <Modal title="Forzar avance de ticket bloqueado" subtitle={`${ticket.ticket_key} tiene dependencias pendientes. Esta excepción quedará registrada.`} onClose={onClose} size="sm"><AsyncForm onSubmit={()=>{if(note.trim().length<5)throw new Error('Indica el motivo del override.');return onSave(note.trim())}} submitLabel="Forzar avance"><div className="warning-panel"><Icon name="lucide:triangle-alert"/><div><b>Excepción administrativa</b><p>Solo Admin/Superadmin puede continuar sin liberar todos los bloqueadores.</p></div></div><label>Motivo<textarea rows="4" value={note} onChange={e=>setNote(e.target.value)} placeholder="Explica por qué puede continuar…" required/></label><div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div></AsyncForm></Modal>}

function ModuleModal({title,initial,onClose,onSave}){const [f,setF]=useState({name:initial?.name||'',description:initial?.description||'',color:initial?.color||'#4D5A51',active:initial?.active??true});return <Modal title={title} subtitle="Agrupa tickets individuales bajo una iniciativa medible, incluso entre productos." onClose={onClose}><AsyncForm onSubmit={()=>onSave({...f,name:f.name.trim()})} submitLabel="Guardar módulo"><label>Nombre<input value={f.name} onChange={e=>setF({...f,name:e.target.value})} required placeholder="Ej. Cuponera Digital"/></label><label>Descripción<textarea rows="4" value={f.description} onChange={e=>setF({...f,description:e.target.value})} placeholder="Objetivo y alcance del módulo…"/></label><div className="form-grid"><label>Color<input type="color" value={f.color} onChange={e=>setF({...f,color:e.target.value})}/></label><Toggle label="Módulo activo" checked={f.active} onChange={v=>setF({...f,active:v})}/></div><div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div></AsyncForm></Modal>}

function TagModal({title,initial,onClose,onSave}){const [f,setF]=useState({name:initial?.name||'',description:initial?.description||'',color:initial?.color||'#0D47A1',active:initial?.active??true});return <Modal title={title} subtitle="Etiqueta reutilizable para clasificar y filtrar tickets." onClose={onClose}><AsyncForm onSubmit={()=>onSave({...f,name:f.name.trim()})} submitLabel="Guardar tag"><label>Nombre<input value={f.name} onChange={e=>setF({...f,name:e.target.value})} required placeholder="Ej. Pagos MSI"/></label><label>Descripción<textarea rows="3" value={f.description} onChange={e=>setF({...f,description:e.target.value})}/></label><div className="form-grid"><label>Color<input type="color" value={f.color} onChange={e=>setF({...f,color:e.target.value})}/></label><Toggle label="Tag activa" checked={f.active} onChange={v=>setF({...f,active:v})}/></div><div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div></AsyncForm></Modal>}

function CustomFieldModal({title,initial,products,onClose,onSave}){
  const [f,setF]=useState({name:initial?.name||'',description:initial?.description||'',field_type:initial?.field_type||'text',required:initial?.required??false,placeholder:initial?.placeholder||'',options:Array.isArray(initial?.options)?initial.options.join('\n'):'',applies_to_all_products:initial?.applies_to_all_products??true,product_ids:initial?.product_ids||[],sort_order:initial?.sort_order??100,active:initial?.active??true})
  const toggleProduct=id=>setF(x=>({...x,product_ids:x.product_ids.includes(id)?x.product_ids.filter(v=>v!==id):[...x.product_ids,id]}))
  return <Modal title={title} subtitle="Agrega documentación estructurada al ticket sin modificar su esquema cada vez." onClose={onClose} size="lg"><AsyncForm onSubmit={()=>{if(!f.applies_to_all_products&&!f.product_ids.length)throw new Error('Selecciona al menos un producto.');const options=['select','multiselect'].includes(f.field_type)?f.options.split('\n').map(x=>x.trim()).filter(Boolean):[];if(['select','multiselect'].includes(f.field_type)&&!options.length)throw new Error('Agrega al menos una opción.');return onSave({...f,name:f.name.trim(),options})}} submitLabel="Guardar campo"><div className="form-grid"><label>Nombre<input value={f.name} onChange={e=>setF({...f,name:e.target.value})} required placeholder="Ej. Ambiente"/></label><label>Tipo<select value={f.field_type} onChange={e=>setF({...f,field_type:e.target.value})}>{CUSTOM_FIELD_TYPES.map(([k,l])=><option value={k} key={k}>{l}</option>)}</select></label><label>Orden<input type="number" value={f.sort_order} onChange={e=>setF({...f,sort_order:Number(e.target.value)||100})}/></label><label>Placeholder<input value={f.placeholder} onChange={e=>setF({...f,placeholder:e.target.value})}/></label></div><label>Descripción<textarea rows="3" value={f.description} onChange={e=>setF({...f,description:e.target.value})}/></label>{['select','multiselect'].includes(f.field_type)&&<label>Opciones · una por línea<textarea rows="5" value={f.options} onChange={e=>setF({...f,options:e.target.value})} placeholder={'Producción\nStaging\nDesarrollo'}/></label>}<div className="toggle-list"><Toggle label="Campo obligatorio" checked={f.required} onChange={v=>setF({...f,required:v})}/><Toggle label="Aplicar a todos los productos" checked={f.applies_to_all_products} onChange={v=>setF({...f,applies_to_all_products:v})}/><Toggle label="Campo activo" checked={f.active} onChange={v=>setF({...f,active:v})}/></div>{!f.applies_to_all_products&&<div className="product-checkbox-grid">{products.map(p=><button type="button" key={p.id} className={f.product_ids.includes(p.id)?'selected':''} onClick={()=>toggleProduct(p.id)}><Icon name={f.product_ids.includes(p.id)?'lucide:check-square-2':'lucide:square'} size={16}/><span><b>{p.name}</b><small>{p.key}</small></span></button>)}</div>}<div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div></AsyncForm></Modal>
}

function TicketCatalogsView({workspace,modules,tags,customFields,tickets,ticketTagLinks,canManage,onModuleCreate,onModuleEdit,onModuleDelete,onTagCreate,onTagEdit,onTagDelete,onFieldCreate,onFieldEdit,onFieldDelete}){
  const [tab,setTab]=useState('modules')
  return <div className="page"><PageHeader eyebrow="Configuración de tickets" title="Campos, módulos y tags" subtitle="Estructura la información de los tickets sin perder flexibilidad." icon="lucide:tags"/><div className="content-card catalog-shell"><div className="settings-tabs"><button className={tab==='modules'?'active':''} onClick={()=>setTab('modules')}>Módulos <em>{modules.length}</em></button><button className={tab==='tags'?'active':''} onClick={()=>setTab('tags')}>Tags <em>{tags.length}</em></button><button className={tab==='fields'?'active':''} onClick={()=>setTab('fields')}>Campos adicionales <em>{customFields.length}</em></button></div>
  {tab==='modules'&&<div className="catalog-content"><div className="settings-list-head"><div><h3>Módulos / Grupos</h3><p>Agrupan varios tickets bajo una iniciativa medible. Un ticket puede tener un módulo principal.</p></div><button className="primary compact" onClick={onModuleCreate}><Icon name="lucide:plus"/> Nuevo módulo</button></div><div className="catalog-grid">{modules.map(m=>{const rows=tickets.filter(t=>t.module_id===m.id),done=rows.filter(t=>t.status==='closed').length,pct=rows.length?Math.round(rows.reduce((a,t)=>a+ticketProgress(t.status),0)/rows.length):0;return <div className="catalog-card" key={m.id}><div className="catalog-title"><span className="color-dot" style={{background:m.color}}></span><div><b>{m.module_key} · {m.name}</b><p>{m.description||'Sin descripción'}</p></div></div><div className="catalog-metrics"><span><b>{rows.length}</b> tickets</span><span><b>{rows.reduce((a,t)=>a+(Number(t.story_points)||1),0)}</b> SP</span><span><b>{pct}%</b> avance</span></div><div className="row-actions"><button onClick={()=>onModuleEdit(m)}><Icon name="lucide:pencil"/>Editar</button><button className="danger-text" onClick={()=>onModuleDelete(m)}><Icon name="lucide:trash-2"/>Eliminar</button></div></div>})}{!modules.length&&<div className="empty-inline">Aún no hay módulos. Crea uno para agrupar trabajo transversal.</div>}</div></div>}
  {tab==='tags'&&<div className="catalog-content"><div className="settings-list-head"><div><h3>Tags</h3><p>Clasificación flexible y múltiple para filtros y búsqueda.</p></div><button className="primary compact" onClick={onTagCreate}><Icon name="lucide:plus"/> Nueva tag</button></div><div className="catalog-grid">{tags.map(tag=>{const count=ticketTagLinks.filter(x=>x.tag_id===tag.id).length;return <div className="catalog-card" key={tag.id}><div className="catalog-title"><span className="color-dot" style={{background:tag.color}}></span><div><b>{tag.name}</b><p>{tag.description||tag.slug}</p></div></div><div className="catalog-metrics"><span><b>{count}</b> tickets</span><span>{tag.active?'Activa':'Inactiva'}</span></div><div className="row-actions"><button onClick={()=>onTagEdit(tag)}><Icon name="lucide:pencil"/>Editar</button><button className="danger-text" onClick={()=>onTagDelete(tag)}><Icon name="lucide:trash-2"/>Eliminar</button></div></div>})}{!tags.length&&<div className="empty-inline">Sin tags configuradas.</div>}</div></div>}
  {tab==='fields'&&<div className="catalog-content"><div className="settings-list-head"><div><h3>Campos adicionales</h3><p>Campos estructurados que se solicitan en el ticket según producto.</p></div><button className="primary compact" onClick={onFieldCreate}><Icon name="lucide:plus"/> Nuevo campo</button></div><div className="entity-list">{customFields.map(f=><div className="entity-row" key={f.id}><div><b>{f.name}</b><span>{CUSTOM_FIELD_TYPE_LABELS[f.field_type]} · {f.required?'Obligatorio':'Opcional'} · {f.applies_to_all_products?'Todos los productos':'Productos seleccionados'}</span></div><div className="row-actions"><span className={`settings-status ${f.active?'on':'off'}`}>{f.active?'Activo':'Inactivo'}</span><button onClick={()=>onFieldEdit(f)}><Icon name="lucide:pencil"/>Editar</button><button className="danger-text" onClick={()=>onFieldDelete(f)}><Icon name="lucide:trash-2"/>Eliminar</button></div></div>)}{!customFields.length&&<div className="empty-inline">No hay campos adicionales todavía.</div>}</div></div>}</div></div>
}

function MetricProgress({value}){const v=Math.max(0,Math.min(100,Number(value)||0));return <div className="metric-progress"><span style={{width:`${v}%`}}></span></div>}

function ReportsView({workspace,products,modules,tickets,sprints,toast}){
  const [metrics,setMetrics]=useState(null),[question,setQuestion]=useState('Dime cómo vamos al día de hoy con los 3 productos y qué se proyecta finalizar esta semana.'),[answer,setAnswer]=useState(''),[mode,setMode]=useState('chat'),[loading,setLoading]=useState(false),[provider,setProvider]=useState('')
  const load=async()=>{const {data,error}=await db.rpc('get_workspace_progress_report',{p_workspace:workspace.id,p_as_of:dateKey(new Date())});if(error)toast('error',error.message);else setMetrics(data)}
  useEffect(()=>{load()},[workspace.id,tickets.length,sprints.length])
  const ask=async(nextMode=mode,nextQuestion=question)=>{setLoading(true);try{const {data,error}=await db.functions.invoke('trobbu-ai-report',{body:{workspace_id:workspace.id,question:nextQuestion,mode:nextMode}});if(error)throw error;setAnswer(data?.content||'');setProvider(data?.provider||'deterministic');setMode(nextMode)}catch(e){toast('error',e.message||String(e))}finally{setLoading(false)}}
  const ps=metrics?.products||[],totals=metrics?.totals||{},active=metrics?.active_sprints||[],mods=metrics?.modules||[]
  return <div className="page"><PageHeader eyebrow="Inteligencia operativa" title="Reportes / TROBBU AI" subtitle="Avance determinístico, proyección de entrega y análisis ejecutivo del workspace." icon="lucide:chart-no-axes-combined" action={<button className="secondary-button" onClick={()=>window.print()}><Icon name="lucide:printer"/> Imprimir / PDF</button>}/><div className="report-layout"><section className="report-main"><div className="report-summary-grid"><div className="report-kpi"><span>Avance general</span><strong>{Number(totals.progress_percent||0).toFixed(1)}%</strong><MetricProgress value={totals.progress_percent}/></div><div className="report-kpi"><span>Tickets</span><strong>{totals.total_tickets||0}</strong><small>{totals.closed||0} cerrados · {totals.backlog||0} Backlog</small></div><div className="report-kpi warning"><span>Bloqueados</span><strong>{totals.blocked||0}</strong><small>{totals.overdue||0} vencidos</small></div><div className="report-kpi"><span>Proyección semanal</span><strong>{totals.due_this_week||0}</strong><small>entregas hasta {metrics?.week_end?formatDate(metrics.week_end):'—'}</small></div></div><div className="content-card report-products"><div className="section-heading"><div><h3>Avance por producto</h3><p>Promedio ponderado por Story Points; si un ticket no está estimado usa peso 1.</p></div></div><div className="product-report-grid">{ps.map(p=><div className="product-report-card" key={p.id}><div className="product-report-head"><div><b>{p.name}</b><span>{p.key}</span></div><strong>{Number(p.progress_percent||0).toFixed(1)}%</strong></div><MetricProgress value={p.progress_percent}/><div className="product-report-metrics"><span>{p.total_tickets} tickets</span><span>{p.total_sp} SP</span><span>{p.due_this_week} esta semana</span><span>{p.blocked} bloqueados</span></div></div>)}</div></div>{active.length>0&&<div className="content-card report-sprints"><div className="section-heading"><div><h3>Sprint y proyección de cierre</h3><p>Compromiso actual, pendientes y actividades con fecha objetivo antes del cierre.</p></div></div><div className="sprint-report-grid">{active.map(s=><div className="sprint-report-card" key={s.id}><div className="product-report-head"><div><b>{s.name}</b><span>{s.end_date?`Cierra ${formatDate(s.end_date)}`:'Sin fecha de cierre'}</span></div><strong>{Number(s.progress_percent||0).toFixed(1)}%</strong></div><MetricProgress value={s.progress_percent}/><div className="sprint-report-stats"><span><b>{s.completed||0}</b><small>Completados</small></span><span><b>{s.remaining||0}</b><small>Pendientes</small></span><span><b>{s.completed_sp||0}/{s.total_sp||0}</b><small>SP completados</small></span><span><b>{s.planned_by_sprint_end||0}</b><small>Previstos al cierre</small></span><span className={s.blocked?'danger-text':''}><b>{s.blocked||0}</b><small>Bloqueados</small></span></div></div>)}</div></div>}<div className="content-card report-modules"><div className="section-heading"><div><h3>Módulos con trabajo</h3><p>Cuánto trabajo consumió cada iniciativa agrupada.</p></div></div><div className="module-report-list">{mods.length?mods.map(m=><div key={m.id}><span className="module-chip" style={{'--module-color':m.color}}><i></i>{m.module_key} · {m.name}</span><MetricProgress value={m.progress_percent}/><b>{m.progress_percent}% · {m.total_tickets} tickets · {m.total_sp} SP</b></div>):<p className="muted">Todavía no hay módulos con tickets.</p>}</div></div></section><aside className="ai-panel content-card"><div className="ai-panel-head"><span className="ai-orb"><Icon name="lucide:sparkles"/></span><div><h3>TROBBU AI</h3><p>Pregunta por avance, sprint, entregas, riesgos o módulos.</p></div></div><div className="ai-quick"><button onClick={()=>ask('chat','Dime cómo vamos al día de hoy con los 3 productos y qué se proyecta finalizar esta semana.')}>Estado de productos</button><button onClick={()=>ask('executive','Genera un reporte ejecutivo del estado del workspace, avance por producto, sprint, bloqueos y próximos pasos.')}>Reporte ejecutivo</button><button onClick={()=>ask('infographic','Genera el contenido ejecutivo en formato breve de infografía con KPIs, productos, riesgos y entregas próximas.')}>Infografía</button></div><label>Consulta<textarea rows="5" value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Ej. ¿Cómo vamos con Web Administrativa y qué riesgo existe para cerrar el sprint?"/></label><button className="primary full" disabled={loading||!question.trim()} onClick={()=>ask(mode,question)}><Icon name="lucide:sparkles"/>{loading?'Analizando…':'Generar análisis'}</button>{answer&&<div className="ai-answer"><div className="ai-answer-meta"><span>{provider?.startsWith('deterministic')?'Análisis del sistema':'TROBBU AI'}</span><button type="button" className="text-button" onClick={()=>navigator.clipboard?.writeText(answer)}>Copiar</button></div><pre>{answer}</pre></div>}<div className="ai-data-note"><Icon name="lucide:shield-check"/><span>Los porcentajes y KPIs los calcula Supabase. La IA solo interpreta esos datos y no puede inventar métricas.</span></div></aside></div></div>
}


function TicketFilterModal({filters,members,sprints,modules=[],tags=[],onClose,onApply}){const [f,setF]=useState({...filters});const reset={status:'all',assignee:'all',sprint:'all',priority:'all',type:'all',module:'all',tag:'all'};return <Modal title="Filtros de tickets" subtitle="Combina criterios para encontrar exactamente lo que necesitas." onClose={onClose}><AsyncForm onSubmit={()=>onApply(f)} submitLabel="Aplicar filtros"><div className="form-grid"><label>Estado<select value={f.status} onChange={e=>setF({...f,status:e.target.value})}><option value="all">Todos</option>{STATUS.map(([k,l])=><option value={k} key={k}>{l}</option>)}</select></label><label>Responsable<select value={f.assignee} onChange={e=>setF({...f,assignee:e.target.value})}><option value="all">Todos</option>{members.map(m=><option value={m.user_id} key={m.user_id}>{m.profile?.full_name||'Usuario'}</option>)}</select></label><label>Sprint<select value={f.sprint} onChange={e=>setF({...f,sprint:e.target.value})}><option value="all">Todos</option>{sprints.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label><label>Prioridad<select value={f.priority} onChange={e=>setF({...f,priority:e.target.value})}><option value="all">Todas</option>{PRIORITIES.map(p=><option value={p} key={p}>{PRIORITY_LABELS[p]}</option>)}</select></label><label>Tipo<select value={f.type} onChange={e=>setF({...f,type:e.target.value})}><option value="all">Todos</option>{TYPES.map(t=><option value={t} key={t}>{TYPE_LABELS[t]}</option>)}</select></label><label>Módulo<select value={f.module||'all'} onChange={e=>setF({...f,module:e.target.value})}><option value="all">Todos</option><option value="">Sin módulo</option>{modules.map(m=><option value={m.id} key={m.id}>{m.module_key} · {m.name}</option>)}</select></label><label>Tag<select value={f.tag||'all'} onChange={e=>setF({...f,tag:e.target.value})}><option value="all">Todas</option>{tags.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</select></label></div><div className="modal-secondary"><button type="button" className="text-button" onClick={()=>setF(reset)}>Restablecer</button><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div></AsyncForm></Modal>}

function PlanTicketModal({ticket,sprints,onClose,onSave}){
  const [sprintId,setSprintId]=useState(ticket.sprint_id||'')
  const available=sprints.filter(s=>s.status!=='completed'||s.id===ticket.sprint_id)
  return <Modal title={`Planificar ${ticket.ticket_key}`} subtitle="Mueve el ticket a un sprint o regresa el trabajo al Backlog." onClose={onClose} size="sm"><AsyncForm onSubmit={()=>onSave(sprintId)} submitLabel="Guardar planificación">
    <label>Destino<select value={sprintId} onChange={e=>setSprintId(e.target.value)}><option value="">Backlog · Sin sprint</option>{available.map(s=><option value={s.id} key={s.id}>{s.name} · {s.status==='active'?'Activo':'Planeado'}</option>)}</select></label>
    <div className="notice"><Icon name="lucide:list-todo"/><span>{sprintId?'El ticket quedará comprometido en el sprint seleccionado.':'El ticket quedará pendiente de planificación en Backlog.'}</span></div>
    <div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div>
  </AsyncForm></Modal>
}

function SprintRolloverModal({sprint,sprints,tickets,onClose,onSave}){
  const options=sprints.filter(s=>s.id!==sprint.id&&s.status!=='completed').sort((a,b)=>String(a.start_date||'9999').localeCompare(String(b.start_date||'9999')))
  const [nextId,setNextId]=useState(options[0]?.id||'')
  const unresolved=tickets.filter(t=>t.sprint_id===sprint.id&&!['qa_passed','closed'].includes(t.status))
  return <Modal title={`Cerrar ${sprint.name}`} subtitle="Los tickets resueltos permanecen en el sprint cerrado. Decide qué hacer con los pendientes." onClose={onClose}><AsyncForm onSubmit={()=>onSave(nextId)} submitLabel="Cerrar sprint y trasladar">
    <div className="rollover-summary"><span><Icon name="lucide:circle-dashed"/></span><div><b>{unresolved.length} tickets no resueltos</b><p>Se trasladarán de forma atómica para no perder seguimiento.</p></div></div>
    <label>Destino de pendientes<select value={nextId} onChange={e=>setNextId(e.target.value)}><option value="">Regresar al Backlog</option>{options.map(s=><option key={s.id} value={s.id}>{s.name} · {s.status==='active'?'Activo':'Planeado'}</option>)}</select></label>
    {unresolved.length>0&&<div className="rollover-ticket-list">{unresolved.slice(0,8).map(t=><span key={t.id}><b>{t.ticket_key}</b>{t.title}</span>)}{unresolved.length>8&&<small>+{unresolved.length-8} tickets adicionales</small>}</div>}
    <div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div>
  </AsyncForm></Modal>
}

function SprintDetailModal({workspace,sprint,tickets,products,members,session,canWork,canPlan,onClose,onTicket,onEdit,onRollover,onRefresh,toast}){
  const [comments,setComments]=useState([])
  const [attachments,setAttachments]=useState([])
  const [commentModal,setCommentModal]=useState(null)
  const rows=tickets.filter(t=>t.sprint_id===sprint.id)
  const done=rows.filter(t=>['qa_passed','closed'].includes(t.status)).length
  const unresolved=rows.length-done
  const pct=rows.length?Math.round(done/rows.length*100):0
  const load=async()=>{
    const [c,e]=await Promise.all([
      db.from('sprint_comments').select('*').eq('sprint_id',sprint.id).order('created_at'),
      db.from('sprint_attachments').select('*').eq('sprint_id',sprint.id).order('created_at')
    ])
    if(c.error)toast('error',c.error.message);else setComments(c.data||[])
    if(e.error)toast('error',e.error.message);else setAttachments(await signedEvidenceRows(e.data||[]))
  }
  useEffect(()=>{load()},[sprint.id])
  const add=async({body,kind,files})=>{body=String(body||'').trim();if(!body)throw new Error('Escribe un comentario.');const {data,error}=await db.from('sprint_comments').insert({sprint_id:sprint.id,author_id:session.user.id,body,kind:kind||'comment'}).select('*').single();if(error)throw error;try{await uploadEvidenceFiles({workspaceId:workspace.id,scope:'sprints',parentId:sprint.id,commentId:data.id,files,evidenceType:kind==='comment'?'general':kind,userId:session.user.id})}catch(err){await db.from('sprint_comments').delete().eq('id',data.id);throw err}await load();toast('success','Evidencia del sprint agregada.')}
  const edit=async(comment,data)=>{const {error}=await db.from('sprint_comments').update({body:String(data.body||'').trim(),kind:data.kind||'comment'}).eq('id',comment.id);if(error)throw error;await load();toast('success','Comentario actualizado.')}
  const removeComment=async comment=>{const {error}=await db.from('sprint_comments').delete().eq('id',comment.id);if(error)throw error;await load();toast('success','Comentario eliminado.')}
  const removeEvidence=async row=>{const {error:se}=await db.storage.from('jira-evidence').remove([row.storage_path]);if(se)throw se;const {error}=await db.from('sprint_attachments').delete().eq('id',row.id);if(error)throw error;await load();toast('success','Evidencia eliminada.')}
  const unlinked=attachments.filter(a=>!a.comment_id)
  return <><Modal title={sprint.name} subtitle={`${formatDate(sprint.start_date)} → ${formatDate(sprint.end_date)}`} onClose={onClose} size="xl"><div className="sprint-detail-layout"><div className="sprint-detail-main"><div className="sprint-detail-hero"><div><span className={`sprint-status ${sprint.status}`}>{sprint.status==='active'?'Activo':sprint.status==='completed'?'Completado':'Planeado'}</span><h3>{sprint.goal||'Sin objetivo definido'}</h3><p>{sprint.details||'Sin detalles adicionales.'}</p></div><div className="sprint-ring"><b>{pct}%</b><small>{done}/{rows.length} resueltos</small></div></div><div className="sprint-ticket-section"><div className="section-heading"><div><h4>Actividades del sprint</h4><p>{unresolved} pendientes · {done} resueltas</p></div></div><div className="sprint-ticket-table">{rows.length===0&&<div className="compact-empty"><Icon name="lucide:inbox"/><span>Este sprint todavía no tiene tickets.</span></div>}{rows.map(t=>{const p=products.find(x=>x.id===t.product_id);return <button type="button" key={t.id} onClick={()=>onTicket(t)}><span><small>{t.ticket_key} · {p?.name||'Producto'}</small><b>{t.title}</b></span><StatusBadge status={t.status}/><time>{formatDate(t.due_date)}</time><Icon name="lucide:chevron-right"/></button>})}</div></div><div className="sprint-review-section"><div className="section-heading"><div><h4>Comentarios y evidencias</h4><p>Documenta revisión, rechazo, fixes y cierre del sprint.</p></div>{canWork&&<button type="button" className="primary compact" onClick={()=>setCommentModal({type:'create'})}><Icon name="lucide:image-plus"/> Agregar evidencia</button>}</div><div className="comment-list">{comments.length===0&&unlinked.length===0&&<p className="muted">Sin comentarios ni evidencias del sprint.</p>}{comments.map(c=>{const author=members.find(m=>m.user_id===c.author_id)?.profile?.full_name||'Usuario',own=c.author_id===session.user.id,files=attachments.filter(a=>a.comment_id===c.id);return <div className="comment evidence-comment" key={c.id}><span className="mini-avatar">{initials(author)}</span><div className="comment-body"><div className="comment-head"><div><div className="comment-kind-row"><b>{author}</b><EvidenceKind kind={c.kind}/></div><small>{formatDateTime(c.created_at)}</small></div>{(own||canPlan)&&<button type="button" className="icon-button" onClick={()=>setCommentModal({type:'actions',comment:c,own})}><Icon name="lucide:ellipsis"/></button>}</div><p>{c.body}</p><EvidenceGallery rows={files} session={session} canManage={canPlan} onDelete={row=>setCommentModal({type:'delete-evidence',row})}/></div></div>})}{unlinked.length>0&&<EvidenceGallery rows={unlinked} session={session} canManage={canPlan} onDelete={row=>setCommentModal({type:'delete-evidence',row})}/>}</div></div></div><aside className="sprint-detail-aside"><div className="sprint-side-stat"><span>Tickets</span><b>{rows.length}</b></div><div className="sprint-side-stat"><span>No resueltos</span><b>{unresolved}</b></div><div className="sprint-side-stat"><span>Story points</span><b>{rows.reduce((a,t)=>a+Number(t.story_points||0),0)}</b></div>{canPlan&&<><button type="button" className="secondary-button full" onClick={onEdit}><Icon name="lucide:pencil"/> Editar sprint</button>{sprint.status!=='completed'&&<button type="button" className="primary full" onClick={onRollover}><Icon name="lucide:arrow-right-circle"/> Cerrar / trasladar</button>}</>}</aside></div></Modal>
    {commentModal?.type==='create'&&<EvidenceCommentModal title="Evidencia del sprint" initial={{body:'',kind:'review'}} allowFiles onClose={()=>setCommentModal(null)} onSave={async data=>{await add(data);setCommentModal(null)}}/>}
    {commentModal?.type==='actions'&&<ActionSheet title="Comentario del sprint" onClose={()=>setCommentModal(null)} actions={[...(commentModal.own?[['lucide:pencil','Editar',()=>setCommentModal({type:'edit',comment:commentModal.comment})]]:[]),['lucide:trash-2','Eliminar',()=>setCommentModal({type:'delete',comment:commentModal.comment}),'danger']]}/>} 
    {commentModal?.type==='edit'&&<EvidenceCommentModal title="Editar comentario" initial={{body:commentModal.comment.body,kind:commentModal.comment.kind||'comment'}} onClose={()=>setCommentModal(null)} onSave={async data=>{await edit(commentModal.comment,data);setCommentModal(null)}}/>}
    {commentModal?.type==='delete'&&<ConfirmModal title="Eliminar comentario" message="El comentario se eliminará; sus imágenes quedarán conservadas en el historial del sprint." danger onClose={()=>setCommentModal(null)} onConfirm={async()=>{await removeComment(commentModal.comment);setCommentModal(null)}}/>}
    {commentModal?.type==='delete-evidence'&&<ConfirmModal title="Eliminar evidencia" message={`Se eliminará “${commentModal.row.file_name}”.`} danger onClose={()=>setCommentModal(null)} onConfirm={async()=>{await removeEvidence(commentModal.row);setCommentModal(null)}}/>}
  </>
}

function HelpdeskModal({title,item,departments,requestTypes=[],members,session,canWork,onClose,onSave}){
  const isCreate=!item
  const [f,setF]=useState({department_id:item?.department_id||departments.find(d=>d.active)?.id||'',request_type_id:item?.request_type_id||requestTypes.find(x=>x.active)?.id||'',subject:item?.subject||'',description:item?.description||'',requester_name:item?.requester_name||session.user.user_metadata?.full_name||'',requester_email:item?.requester_email||session.user.email||'',category:item?.category||'general',priority:item?.priority||'medium',status:item?.status||'created',assigned_to:item?.assigned_to||'',source:item?.source||'portal',due_at:toLocalDateTimeInput(item?.due_at)})
  const activeDepartments=departments.filter(d=>d.active||d.id===item?.department_id)
  const assignees=members.filter(m=>m.active&&effectivePermissions(m,m.role_template).manage_helpdesk)
  const activeRequestTypes=requestTypes.filter(x=>x.active||x.id===item?.request_type_id)
  const selectedRequestType=requestTypes.find(x=>x.id===f.request_type_id)
  const isRequirement=selectedRequestType?.code==='requirement'||(!selectedRequestType&&isProposalCategory(f.category))
  const internalMode=!isCreate&&canWork&&!isRequirement
  return <Modal title={title} subtitle={isCreate?'Registra únicamente la información de la solicitud. La canalización, responsable, estado y SLA se definen después por PM/Admin/Superadmin.':isRequirement?'Revisa la propuesta; su decisión se gestiona desde Evaluar requerimiento.':'Canaliza la solicitud y actualiza su atención interna.'} onClose={onClose} size="lg"><AsyncForm onSubmit={()=>onSave({...f,source:isCreate?'portal':f.source,status:isCreate||isRequirement?'created':f.status,assigned_to:isCreate||isRequirement?'':f.assigned_to,due_at:isCreate||isRequirement?'':f.due_at})} submitLabel={item?'Guardar cambios':'Crear solicitud'}>
    <div className="form-section"><h4>Solicitud</h4><label>Asunto<input value={f.subject} onChange={e=>setF({...f,subject:e.target.value})} required placeholder="¿Qué necesitas o qué quieres proponer?"/></label><label>Descripción<textarea rows="5" value={f.description} onChange={e=>setF({...f,description:e.target.value})} required placeholder="Contexto, impacto, pasos, evidencia y resultado esperado…"/></label><div className="form-grid"><label>Departamento solicitante<select value={f.department_id} onChange={e=>setF({...f,department_id:e.target.value})} required><option value="" disabled>Selecciona un departamento</option>{activeDepartments.map(d=><option value={d.id} key={d.id}>{d.name}</option>)}</select></label><label>Tipo de solicitud<select value={f.request_type_id} onChange={e=>setF({...f,request_type_id:e.target.value})} required disabled={!!item&&isProposalCategory(item.category)}><option value="" disabled>Selecciona un tipo</option>{activeRequestTypes.map(type=><option value={type.id} key={type.id}>{type.name}</option>)}</select></label><label>Prioridad<select value={f.priority} onChange={e=>setF({...f,priority:e.target.value})}>{PRIORITIES.map(p=><option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}</select></label>{!isCreate&&canWork&&<label>Origen<select value={f.source} onChange={e=>setF({...f,source:e.target.value})}><option value="internal">Interno</option><option value="portal">Portal</option><option value="email">Correo</option><option value="phone">Teléfono</option><option value="whatsapp">WhatsApp</option></select></label>}</div></div>
    <div className="form-section"><h4>Solicitante</h4><div className="form-grid"><label>Solicitante<input value={f.requester_name} onChange={e=>setF({...f,requester_name:e.target.value})} readOnly={isCreate}/></label><label>Correo<input type="email" value={f.requester_email} onChange={e=>setF({...f,requester_email:e.target.value})} readOnly={isCreate}/></label></div>{isCreate&&<small className="section-help">Se toma de la sesión actual para conservar la trazabilidad de quién realizó la solicitud.</small>}</div>
    {isRequirement?<div className="requirement-notice"><Icon name="lucide:lightbulb"/><span><b>Propuesta de producto · sin SLA operativo.</b><small>PM/Admin/Superadmin decidirá posteriormente si pasa a Backlog o si se rechaza con una nota para el solicitante.</small></span></div>:internalMode?<div className="form-section internal-section"><h4>Atención interna</h4><div className="form-grid"><label>Asignado a<select value={f.assigned_to} onChange={e=>setF({...f,assigned_to:e.target.value})}><option value="">Sin asignar</option>{assignees.map(m=><option value={m.user_id} key={m.user_id}>{m.profile?.full_name||'Usuario'}</option>)}</select></label><label>Estado<select value={f.status} onChange={e=>setF({...f,status:e.target.value})}>{HELP_STATUS.map(([k,l])=><option value={k} key={k}>{l}</option>)}</select></label><label>Fecha objetivo<input type="datetime-local" value={f.due_at} onChange={e=>setF({...f,due_at:e.target.value})}/></label></div></div>:<div className="notice routing-notice"><Icon name="lucide:route"/><span><b>{isCreate?'Se enviará sin asignar para canalización.':'Canalización administrada por la mesa.'}</b><small>PM/Admin/Superadmin define responsable, estado y fecha objetivo después de revisar la solicitud.</small></span></div>}
    <div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div>
  </AsyncForm></Modal>
}
function HelpdeskDetailModal({item,departments,requestTypes=[],members,session,canWork,canManage,onClose,onEdit,onDecision,onRefresh,toast}){
  const [comments,setComments]=useState([]),[activity,setActivity]=useState([]),[tab,setTab]=useState('comments'),[commentModal,setCommentModal]=useState(null)
  const requirement=isProposalCategory(item.category)
  const requestType=requestTypes.find(x=>x.id===item.request_type_id)
  const load=async()=>{const [c,a]=await Promise.all([db.from('helpdesk_comments').select('*').eq('helpdesk_ticket_id',item.id).order('created_at'),db.from('helpdesk_activity').select('*').eq('helpdesk_ticket_id',item.id).order('created_at',{ascending:false})]);if(c.error)toast('error',c.error.message);else setComments(c.data||[]);if(a.error)toast('error',a.error.message);else setActivity(a.data||[])}
  useEffect(()=>{load()},[item.id])
  const addComment=async text=>{const body=String(text||'').trim();if(!body)throw new Error('Escribe un comentario.');const {error}=await db.from('helpdesk_comments').insert({helpdesk_ticket_id:item.id,author_id:session.user.id,body});if(error)throw error;await load();toast('success','Comentario agregado.')}
  const editComment=async(comment,text)=>{const {error}=await db.from('helpdesk_comments').update({body:String(text||'').trim()}).eq('id',comment.id);if(error)throw error;await load();toast('success','Comentario actualizado.')}
  const deleteComment=async comment=>{const {error}=await db.from('helpdesk_comments').delete().eq('id',comment.id);if(error)throw error;await load();toast('success','Comentario eliminado.')}
  const dep=departments.find(d=>d.id===item.department_id),owner=members.find(m=>m.user_id===item.assigned_to)?.profile?.full_name||'Sin asignar'
  const mayEdit=canWork&&!requirement
  const order=['created','review','attended','resolved','closed'],current=Math.max(0,order.indexOf(item.status))
  const activityTitle=a=>a.action==='created'?'Solicitud creada':a.action==='status_changed'?'Cambio de estado':a.action==='assigned'?'Asignación':a.action==='requirement_decision'?'Decisión del requerimiento':'Actividad'
  return <><Modal title={`${item.ticket_key} · ${item.subject}`} subtitle={`${dep?.name||'Helpdesk'} · ${requestType?.name||helpCategoryLabel(item.category)}`} onClose={onClose} size="xl"><div className="detail-grid"><div className="detail-main">
    {requirement?<div className="requirement-detail-hero"><div><span className="eyebrow">NUEVO REQUERIMIENTO</span><h3>{requirementStatusLabel(item.proposal_status)}</h3><p>{item.proposal_status==='pending'?'Pendiente de evaluación por PM/Admin/Superadmin.':item.proposal_status==='accepted_backlog'?`Aceptado para desarrollo futuro${item.converted_ticket_key?` como ${item.converted_ticket_key}`:''}.`:'La sugerencia fue descartada y devuelta al solicitante.'}</p></div><RequirementBadge status={item.proposal_status}/>{item.decision_note&&<div className="decision-note"><b>Nota de decisión</b><p>{item.decision_note}</p></div>}</div>:<div className="helpdesk-detail-progress"><div className="request-stepper">{order.map((st,i)=><div key={st} className={`${i<current?'done':''} ${i===current?'current':''}`}><i>{i<current?<Icon name="lucide:check" size={12}/>:i+1}</i><span>{helpStatusLabel(st)}</span></div>)}</div></div>}
    <div className="detail-description"><h4>Descripción de la solicitud</h4><p>{item.description||'Sin descripción.'}</p></div>
    <div className="detail-tabs"><button type="button" className={tab==='comments'?'active':''} onClick={()=>setTab('comments')}>Comentarios <em>{comments.length}</em></button><button type="button" className={tab==='activity'?'active':''} onClick={()=>setTab('activity')}>Seguimiento <em>{activity.length}</em></button></div>
    {tab==='comments'?<><div className="comment-list">{comments.length===0&&<p className="muted">Todavía no hay comentarios.</p>}{comments.map(c=>{const author=members.find(m=>m.user_id===c.author_id)?.profile?.full_name||(c.author_id===session.user.id?session.user.user_metadata?.full_name||'Tú':'Usuario'),own=c.author_id===session.user.id;return <div className="comment" key={c.id}><span className="mini-avatar">{initials(author)}</span><div className="comment-body"><div className="comment-head"><div><b>{author}</b><small>{formatDateTime(c.created_at)}</small></div>{own&&<button type="button" className="icon-button" onClick={()=>setCommentModal({type:'actions',comment:c})}><Icon name="lucide:ellipsis" size={16}/></button>}</div><p>{c.body}</p></div></div>})}</div><div className="comment-create-row"><button type="button" className="primary compact" onClick={()=>setCommentModal({type:'create'})}><Icon name="lucide:message-square-plus"/> Agregar comentario</button></div></>:<div className="activity-list">{activity.length===0&&<p className="muted">Sin movimientos registrados.</p>}{activity.map(a=><div className="activity-item" key={a.id}><span className="activity-dot"></span><div><b>{activityTitle(a)}</b><p>{a.action==='status_changed'?`${helpStatusLabel(a.from_value)} → ${helpStatusLabel(a.to_value)}`:a.action==='requirement_decision'?(a.to_value?.startsWith('accepted_backlog')?'Aceptado a Backlog':'Sugerencia rechazada'):a.to_value}</p><small>{formatDateTime(a.created_at)}</small></div></div>)}</div>}
  </div><aside className="detail-aside">{mayEdit&&<button type="button" className="primary full" onClick={onEdit}><Icon name="lucide:pencil"/> Editar solicitud</button>}{requirement&&canManage&&(item.proposal_status||'pending')==='pending'&&<button type="button" className="primary full" onClick={onDecision}><Icon name="lucide:gavel"/> Evaluar requerimiento</button>}<DetailRow label={requirement?'Decisión':'Estado'}>{requirement?<RequirementBadge status={item.proposal_status}/>:<HelpStatusBadge status={item.status}/>}</DetailRow><DetailRow label="Tipo de solicitud">{requestType?.name||helpCategoryLabel(item.category)}</DetailRow><DetailRow label="Prioridad"><span className={`priority-badge priority-${item.priority}`}>{PRIORITY_LABELS[item.priority]}</span></DetailRow><DetailRow label="Departamento">{dep?.name||'—'}</DetailRow>{!requirement&&<DetailRow label="Asignado">{owner}</DetailRow>}<DetailRow label="Solicitante">{item.requester_name||'—'}</DetailRow><DetailRow label="Correo">{item.requester_email||'—'}</DetailRow><DetailRow label="Creado">{formatDateTime(item.created_at)}</DetailRow>{requirement?<><DetailRow label="Decisión">{formatDateTime(item.decision_at)}</DetailRow>{item.converted_ticket_key&&<DetailRow label="Ticket Backlog"><b>{item.converted_ticket_key}</b></DetailRow>}</>:<><DetailRow label="En revisión">{formatDateTime(item.reviewed_at)}</DetailRow><DetailRow label="Atendido">{formatDateTime(item.attended_at)}</DetailRow><DetailRow label="Objetivo SLA">{formatDateTime(item.due_at)}</DetailRow><DetailRow label="Resuelto">{formatDateTime(item.resolved_at)}</DetailRow><DetailRow label="Cerrado">{formatDateTime(item.closed_at)}</DetailRow></>}</aside></div></Modal>
    {commentModal?.type==='create'&&<CommentEditModal title="Agregar comentario" initial="" onClose={()=>setCommentModal(null)} onSave={async text=>{await addComment(text);setCommentModal(null)}}/>}
    {commentModal?.type==='actions'&&<ActionSheet title="Comentario" subtitle="Selecciona una acción" onClose={()=>setCommentModal(null)} actions={[["lucide:pencil","Editar comentario",()=>setCommentModal({type:'edit',comment:commentModal.comment})],["lucide:trash-2","Eliminar comentario",()=>setCommentModal({type:'delete',comment:commentModal.comment}),'danger']]}/>} 
    {commentModal?.type==='edit'&&<CommentEditModal title="Editar comentario" initial={commentModal.comment.body} onClose={()=>setCommentModal(null)} onSave={async text=>{await editComment(commentModal.comment,text);setCommentModal(null)}}/>}
    {commentModal?.type==='delete'&&<ConfirmModal title="Eliminar comentario" message="Este comentario se eliminará definitivamente." danger onClose={()=>setCommentModal(null)} onConfirm={async()=>{await deleteComment(commentModal.comment);setCommentModal(null)}}/>}
  </>
}
function RequirementDecisionModal({item,products,onClose,onSave}){
  const [decision,setDecision]=useState('accepted_backlog'),[productId,setProductId]=useState(products[0]?.id||''),[note,setNote]=useState('')
  const accepting=decision==='accepted_backlog'
  return <Modal title={`Evaluar ${item.ticket_key}`} subtitle="Decide si el requerimiento entra al Backlog o se devuelve como sugerencia rechazada." onClose={onClose} size="md"><AsyncForm onSubmit={()=>{if(accepting&&!productId)throw new Error('Selecciona el producto.');if(!accepting&&!note.trim())throw new Error('Indica el motivo del rechazo.');return onSave(decision,productId,note.trim())}} submitLabel={accepting?'Aceptar a Backlog':'Rechazar sugerencia'} danger={!accepting}>
    <div className="decision-choice"><button type="button" className={accepting?'active accept':''} onClick={()=>setDecision('accepted_backlog')}><Icon name="lucide:list-plus"/><span><b>Aceptar a Backlog</b><small>Crear un ticket de mejora para desarrollo futuro.</small></span></button><button type="button" className={!accepting?'active reject':''} onClick={()=>setDecision('rejected')}><Icon name="lucide:circle-x"/><span><b>Sugerencia rechazada</b><small>Descartar por alcance, prioridad o porque no corresponde al proyecto.</small></span></button></div>
    {accepting&&<label>Producto destino<select value={productId} onChange={e=>setProductId(e.target.value)} required><option value="" disabled>Selecciona un producto</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
    <label>{accepting?'Nota de decisión (opcional)':'Motivo del rechazo'}<textarea rows="4" value={note} onChange={e=>setNote(e.target.value)} required={!accepting} placeholder={accepting?'Contexto para el equipo de producto…':'Explica al solicitante por qué no se incorporará…'}/></label>
    <div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div>
  </AsyncForm></Modal>
}

function HelpFilterModal({filters,departments,requestTypes=[],members,onClose,onApply}){const [f,setF]=useState({...filters});return <Modal title="Filtros de Helpdesk" onClose={onClose}><AsyncForm onSubmit={()=>onApply(f)} submitLabel="Aplicar filtros"><div className="form-grid"><label>Estado<select value={f.status} onChange={e=>setF({...f,status:e.target.value})}><option value="all">Todos</option>{HELP_STATUS.map(([k,l])=><option value={k} key={k}>{l}</option>)}</select></label><label>Tipo de solicitud<select value={f.requestType||'all'} onChange={e=>setF({...f,requestType:e.target.value})}><option value="all">Todos</option>{requestTypes.map(type=><option value={type.id} key={type.id}>{type.name}</option>)}</select></label><label>Área<select value={f.department} onChange={e=>setF({...f,department:e.target.value})}><option value="all">Todas</option>{departments.map(d=><option value={d.id} key={d.id}>{d.name}</option>)}</select></label><label>Asignado<select value={f.assignee} onChange={e=>setF({...f,assignee:e.target.value})}><option value="all">Todos</option>{members.map(m=><option value={m.user_id} key={m.user_id}>{m.profile?.full_name||'Usuario'}</option>)}</select></label><label>Prioridad<select value={f.priority} onChange={e=>setF({...f,priority:e.target.value})}><option value="all">Todas</option>{PRIORITIES.map(p=><option value={p} key={p}>{PRIORITY_LABELS[p]}</option>)}</select></label></div><div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div></AsyncForm></Modal>}

function ProductScopeEditor({products,role,allProducts,setAllProducts,selected,setSelected,disabled=false}){
  const forced=role==='superadmin'
  const all=forced||allProducts
  const toggle=id=>setSelected(selected.includes(id)?selected.filter(x=>x!==id):[...selected,id])
  return <div className="access-section"><div className="access-section-head"><div><h4>Productos autorizados</h4><p>Define qué productos puede consultar y operar dentro de este workspace.</p></div>{forced&&<span className="readonly-chip"><Icon name="lucide:lock"/> Todos por rol</span>}</div>{!forced&&<div className="scope-choice"><button type="button" className={all?'active':''} disabled={disabled} onClick={()=>setAllProducts(true)}><Icon name="lucide:boxes"/><span><b>Todos</b><small>Incluye productos nuevos automáticamente</small></span></button><button type="button" className={!all?'active':''} disabled={disabled} onClick={()=>setAllProducts(false)}><Icon name="lucide:list-checks"/><span><b>Seleccionados</b><small>Limita el acceso a productos concretos</small></span></button></div>}{!all&&<div className="product-access-grid">{products.map(p=><label key={p.id} className={selected.includes(p.id)?'checked':''}><input type="checkbox" checked={selected.includes(p.id)} disabled={disabled} onChange={()=>toggle(p.id)}/><span><b>{p.name}</b><small>{p.key}</small></span><Icon name={selected.includes(p.id)?'lucide:circle-check':'lucide:circle'} /></label>)}</div>}</div>
}

function PermissionEditor({role,roleDef,permissions,setPermissions,disabled=false}){
  const defaults=roleDefinitionPermissions(roleDef||{base_role:role,code:role})
  const effective={...defaults,...permissions}
  const protectedRole=role==='superadmin'||roleDef?.code==='superadmin'
  const set=(key,value)=>{const next={...permissions};if(value===defaults[key])delete next[key];else next[key]=value;setPermissions(next)}
  return <div className="access-section"><div className="access-section-head"><div><h4>Permisos efectivos</h4><p>El rol define la base. Puedes ajustar excepciones por usuario.</p></div>{protectedRole&&<span className="readonly-chip"><Icon name="lucide:crown"/> Acceso total</span>}</div><div className="permission-grid">{PERMISSION_DEFS.map(([key,label,icon])=><label key={key} className={effective[key]?'on':''}><span><Icon name={icon}/><b>{label}</b></span><button type="button" className={`switch ${effective[key]?'on':''}`} disabled={disabled||protectedRole} onClick={()=>set(key,!effective[key])}><i></i></button></label>)}</div></div>
}


function WorkspaceAccessSummary({workspace}){return <div className="form-section workspace-access-summary"><h4>Workspace</h4><div className="notice"><Icon name="lucide:layers-3"/><span><b>{workspace.name}</b><small>Estos accesos aplican únicamente dentro de este espacio de trabajo.</small></span></div></div>}

function InviteModal({workspace,products,roleTemplates,isSuperadmin,onClose,onSaved}){
  const available=roleTemplates.filter(r=>r.active&&(isSuperadmin||r.code!=='superadmin'))
  const portalRole=available.find(r=>r.code==='helpdesk_requester')
  const defaultTeamRole=available.find(r=>r.code==='consulta')||available.find(r=>r.code!=='helpdesk_requester')||available[0]
  const [accessMode,setAccessMode]=useState('team')
  const [credentialMode,setCredentialMode]=useState('password'),[password,setPassword]=useState(()=>generateAccessPassword()),[showPassword,setShowPassword]=useState(false)
  const [email,setEmail]=useState(''),[name,setName]=useState(''),[roleId,setRoleId]=useState(defaultTeamRole?.id||'')
  const [allProducts,setAllProducts]=useState(true),[productIds,setProductIds]=useState(products.map(p=>p.id)),[permissions,setPermissions]=useState({})
  const selectedRole=accessMode==='portal'&&portalRole?portalRole:available.find(r=>r.id===roleId)||defaultTeamRole
  const needsProducts=roleNeedsProducts(selectedRole,permissions)
  const changeMode=mode=>{setAccessMode(mode);setPermissions({});if(mode==='portal'&&portalRole){setRoleId(portalRole.id);setAllProducts(false);setProductIds([])}else{setRoleId(defaultTeamRole?.id||'');setAllProducts(true);setProductIds(products.map(p=>p.id))}}
  const changeRole=value=>{setRoleId(value);setPermissions({});const next=available.find(r=>r.id===value);if(next?.code==='superadmin')setAllProducts(true)}
  return <Modal title="Agregar Staff" subtitle="Define el acceso al workspace y entrega credenciales desde el momento del alta." onClose={onClose} size="lg"><AsyncForm onSubmit={async()=>{if(!selectedRole)throw new Error('Selecciona un rol.');if(credentialMode==='password'&&password.length<10)throw new Error('La contraseña inicial debe tener al menos 10 caracteres.');if(needsProducts&&!allProducts&&selectedRole.code!=='superadmin'&&!productIds.length)throw new Error('Selecciona al menos un producto o habilita Todos.');const finalAll=needsProducts?(selectedRole.code==='superadmin'?true:allProducts):false;const finalProducts=needsProducts?productIds:[];const {data,error}=await db.functions.invoke('invite-member',{body:{email,full_name:name.trim()||null,role_id:selectedRole.id,role:selectedRole.code,workspace_id:workspace.id,redirect_to:getAppUrl(),all_products:finalAll,product_ids:finalProducts,permissions:accessMode==='portal'?{}:permissions,auth_mode:credentialMode,password:credentialMode==='password'?password:null}});if(error||data?.error)throw new Error(await functionErrorMessage(error,data));await onSaved({...data,email})}} submitLabel={credentialMode==='password'?"Crear usuario y mostrar claves":"Enviar invitación"}>
    <WorkspaceAccessSummary workspace={workspace}/>
    {portalRole&&<div className="form-section"><h4>Tipo de acceso</h4><div className="staff-access-mode"><button type="button" className={accessMode==='team'?'active':''} onClick={()=>changeMode('team')}><Icon name="lucide:panels-top-left"/><span><b>Equipo de producto</b><small>Tableros, tickets, QA, sprints o administración según rol.</small></span></button><button type="button" className={accessMode==='portal'?'active portal':''} onClick={()=>changeMode('portal')}><Icon name="lucide:life-buoy"/><span><b>Portal administrativo Helpdesk</b><small>Solo crea y consulta sus solicitudes. Sin productos ni tableros.</small></span></button></div></div>}
    <div className="form-section"><h4>Colaborador</h4><div className="form-grid"><label>Nombre <span className="optional">Opcional</span><input value={name} onChange={e=>setName(e.target.value)} placeholder="Nombre y apellido"/></label><label>Correo<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="colaborador@trobbu.com"/></label>{accessMode==='team'&&<label>Rol<select value={roleId} onChange={e=>changeRole(e.target.value)} required>{available.filter(r=>r.code!=='helpdesk_requester').map(r=><option value={r.id} key={r.id}>{r.name}</option>)}</select><small className="field-help">{selectedRole?.description||ROLE_DESCRIPTIONS[selectedRole?.base_role]}</small></label>}</div></div>
    <div className="form-section credential-section"><h4>Credenciales iniciales</h4><div className="credential-mode-choice"><button type="button" className={credentialMode==='password'?'active':''} onClick={()=>setCredentialMode('password')}><Icon name="lucide:key-round"/><span><b>Crear con contraseña</b><small>Acceso inmediato y claves visibles al finalizar.</small></span></button><button type="button" className={credentialMode==='invite'?'active':''} onClick={()=>setCredentialMode('invite')}><Icon name="lucide:mail-plus"/><span><b>Enviar invitación</b><small>El usuario configura su acceso desde el correo.</small></span></button></div>{credentialMode==='password'&&<label>Contraseña inicial<div className="password-create-row"><input type={showPassword?'text':'password'} autoComplete="new-password" minLength="10" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo 10 caracteres"/><button type="button" className="secondary-button compact" onClick={()=>setShowPassword(v=>!v)}><Icon name={showPassword?'lucide:eye-off':'lucide:eye'}/>{showPassword?'Ocultar':'Ver'}</button><button type="button" className="secondary-button compact" onClick={()=>{setPassword(generateAccessPassword());setShowPassword(true)}}><Icon name="lucide:refresh-cw"/>Generar</button></div><small className="field-help">Se mostrará nuevamente al terminar para que puedas copiar correo y contraseña. No se almacena en el perfil del workspace.</small></label>}{credentialMode==='invite'&&<div className="notice"><Icon name="lucide:mail-check"/><span>Se enviará un enlace de invitación. Si el proveedor de correo de Auth no puede enviarlo, el sistema generará una contraseña temporal como respaldo.</span></div>}</div>
    {accessMode==='portal'?<div className="portal-access-summary"><Icon name="lucide:shield-check"/><div><b>Acceso sin productos</b><p>Podrá crear accesos, incidentes, nuevos módulos, funcionalidades y requerimientos; consultar solo sus propias solicitudes, comentarios, decisiones y estadísticas personales.</p><div><span><Icon name="lucide:life-buoy"/> Mis solicitudes</span><span><Icon name="lucide:chart-no-axes-combined"/> Mis estadísticas</span><span><Icon name="lucide:message-square"/> Comentarios</span><span><Icon name="lucide:ban"/> Sin tableros/productos</span></div></div></div>:<>{needsProducts&&<ProductScopeEditor products={products} role={selectedRole?.code||selectedRole?.base_role} allProducts={allProducts} setAllProducts={setAllProducts} selected={productIds} setSelected={setProductIds}/>}<PermissionEditor role={selectedRole?.base_role} roleDef={selectedRole} permissions={permissions} setPermissions={setPermissions}/></>}
    <div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div>
  </AsyncForm></Modal>
}
function MemberModal({workspace,member,products,roleTemplates,session,isSuperadmin,onClose,onSave,onRemove}){
  const available=roleTemplates.filter(r=>r.active&&(isSuperadmin||r.code!=='superadmin'))
  const initialRole=roleTemplates.find(r=>r.id===member.role_id)||roleTemplates.find(r=>r.code===member.role)||available[0]
  const [roleId,setRoleId]=useState(initialRole?.id||''),[active,setActive]=useState(member.active),[allProducts,setAllProducts]=useState(member.role==='superadmin'||!!member.all_products),[productIds,setProductIds]=useState(member.product_ids||[]),[permissions,setPermissions]=useState(member.permissions||{})
  const self=member.user_id===session.user.id
  const selectedRole=roleTemplates.find(r=>r.id===roleId)||initialRole
  const portal=roleIsHelpdeskRequester(selectedRole),needsProducts=roleNeedsProducts(selectedRole,permissions)
  const changeRole=value=>{setRoleId(value);setPermissions({});const next=roleTemplates.find(r=>r.id===value);if(next?.code==='superadmin')setAllProducts(true);if(roleIsHelpdeskRequester(next)){setAllProducts(false);setProductIds([])}}
  return <Modal title="Accesos del colaborador" subtitle={member.profile?.full_name||'Usuario'} onClose={onClose} size="lg"><AsyncForm onSubmit={()=>{if(!selectedRole)throw new Error('Selecciona un rol.');if(needsProducts&&!allProducts&&selectedRole.code!=='superadmin'&&!productIds.length)throw new Error('Selecciona al menos un producto o habilita Todos.');return onSave({role_id:selectedRole.id,role:selectedRole.base_role,active,all_products:needsProducts?(selectedRole.code==='superadmin'?true:allProducts):false,product_ids:needsProducts?productIds:[],permissions:selectedRole.code==='superadmin'||portal?{}:permissions})}} submitLabel="Guardar accesos">
    <WorkspaceAccessSummary workspace={workspace}/>
    <div className="form-section"><h4>Rol y estado</h4><div className="form-grid"><label>Rol<select value={roleId} onChange={e=>changeRole(e.target.value)} disabled={self&&member.role==='superadmin'}>{available.map(r=><option value={r.id} key={r.id}>{r.name}</option>)}</select><small className="field-help">{selectedRole?.description||ROLE_DESCRIPTIONS[selectedRole?.base_role]}</small></label><div><Toggle label="Acceso activo" checked={active} onChange={setActive} disabled={self}/></div></div>{self&&member.role==='superadmin'&&<div className="notice"><Icon name="lucide:crown"/><span>Tu Superadmin conserva siempre acceso total.</span></div>}</div>
    {portal?<div className="portal-access-summary"><Icon name="lucide:life-buoy"/><div><b>Portal administrativo Helpdesk</b><p>Este colaborador no requiere productos. Solo verá sus propias solicitudes y estadísticas personales.</p></div></div>:<>{needsProducts&&<ProductScopeEditor products={products} role={selectedRole?.code||selectedRole?.base_role} allProducts={allProducts} setAllProducts={setAllProducts} selected={productIds} setSelected={setProductIds} disabled={self&&member.role==='superadmin'}/>}<PermissionEditor role={selectedRole?.base_role} roleDef={selectedRole} permissions={permissions} setPermissions={setPermissions} disabled={self&&member.role==='superadmin'}/></>}
    <div className="modal-secondary">{!self&&<button type="button" className="danger-text-button" onClick={onRemove}><Icon name="lucide:user-minus"/> Retirar del workspace</button>}<button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div>
  </AsyncForm></Modal>
}
function TemporaryCredentialsModal({credentials,onClose}){
  const [copied,setCopied]=useState(false)
  const copy=async()=>{await navigator.clipboard.writeText(`Correo: ${credentials.email}\nContraseña temporal: ${credentials.temporary_password}`);setCopied(true);setTimeout(()=>setCopied(false),1600)}
  return <Modal title="Usuario creado" subtitle={credentials.credential_mode==='password'?'Acceso creado correctamente. Comparte estas claves de forma segura.':'La invitación no pudo enviarse y se generó un acceso temporal de respaldo.'} onClose={onClose} size="sm"><div className="credential-card"><span><small>Correo</small><b>{credentials.email}</b></span><span><small>Contraseña temporal</small><code>{credentials.temporary_password}</code></span><div className="notice"><Icon name="lucide:shield-alert"/><span>Comparte esta contraseña de forma segura y pide al colaborador cambiarla después de iniciar sesión.</span></div></div><div className="form-footer static-footer"><div className="form-footer-left"><button type="button" className="secondary-button" onClick={onClose}>Cerrar</button></div><div className="modal-actions"><button type="button" className="primary" onClick={copy}><Icon name={copied?'lucide:check':'lucide:copy'}/>{copied?'Copiado':'Copiar credenciales'}</button></div></div></Modal>
}

function RoleModal({workspace,initial,roleTemplates,onClose,onSave}){
  const system=!!initial?.is_system
  const protectedRole=!!initial?.protected
  const [name,setName]=useState(initial?.name||'')
  const [description,setDescription]=useState(initial?.description||'')
  const [baseRole,setBaseRole]=useState(initial?.base_role||'consulta')
  const initialPerms=initial?roleDefinitionPermissions(initial):{...ROLE_DEFAULTS.consulta}
  const [permissions,setPermissions]=useState(initialPerms)
  const [active,setActive]=useState(initial?.active??true)
  const setPerm=(key,value)=>setPermissions(p=>({...p,[key]:value}))
  return <Modal title={initial?'Editar rol':'Nuevo rol'} subtitle={`Rol disponible únicamente dentro de ${workspace.name}.`} onClose={onClose} size="lg"><AsyncForm onSubmit={()=>{if(protectedRole)throw new Error('Superadmin es un rol protegido.');const code=initial?.code||slugify(name).replace(/-/g,'_').slice(0,40);if(!name.trim())throw new Error('El nombre es obligatorio.');if(!code)throw new Error('No se pudo generar una clave válida para el rol.');if(!initial&&roleTemplates.some(r=>r.code===code))throw new Error('Ya existe un rol con una clave equivalente.');const base=ROLE_DEFAULTS[baseRole]||ROLE_DEFAULTS.consulta;const overrides={};PERMISSION_DEFS.forEach(([k])=>{if(permissions[k]!==base[k])overrides[k]=!!permissions[k]});return onSave({name:name.trim(),description:description.trim()||null,code,base_role:baseRole,permissions:overrides,active})}} submitLabel={initial?'Guardar rol':'Crear rol'}>
    <WorkspaceAccessSummary workspace={workspace}/>
    <div className="form-section"><h4>Definición</h4><div className="form-grid"><label>Nombre<input value={name} onChange={e=>setName(e.target.value)} required disabled={protectedRole}/></label><label>Base<select value={baseRole} onChange={e=>{const v=e.target.value;setBaseRole(v);setPermissions({...ROLE_DEFAULTS[v]})}} disabled={system||protectedRole}><option value="consulta">Consulta</option><option value="dev">Dev</option><option value="qa">QA</option><option value="pm">PM</option><option value="admin">Admin</option></select></label></div><label>Descripción<textarea rows="3" value={description} onChange={e=>setDescription(e.target.value)} disabled={protectedRole}/></label><Toggle label="Rol activo" checked={active} onChange={setActive} disabled={protectedRole}/></div>
    <div className="access-section"><div className="access-section-head"><div><h4>Permisos del rol</h4><p>Estos permisos serán la base para todos los colaboradores que utilicen este rol.</p></div></div><div className="permission-grid">{PERMISSION_DEFS.map(([key,label,icon])=><label key={key} className={permissions[key]?'on':''}><span><Icon name={icon}/><b>{label}</b></span><button type="button" className={`switch ${permissions[key]?'on':''}`} disabled={protectedRole} onClick={()=>setPerm(key,!permissions[key])}><i></i></button></label>)}</div></div>
    <div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div>
  </AsyncForm></Modal>
}

function ProductModal({title,initial,onClose,onSave}){const [f,setF]=useState({name:initial?.name||'',key:initial?.key||'',description:initial?.description||''});return <Modal title={title} onClose={onClose}><AsyncForm onSubmit={()=>onSave({...f,key:f.key.trim().toUpperCase()})} submitLabel="Guardar producto"><label>Nombre<input value={f.name} onChange={e=>setF({...f,name:e.target.value})} required/></label><label>Clave<input value={f.key} onChange={e=>setF({...f,key:e.target.value.replace(/[^A-Za-z0-9]/g,'').slice(0,6)})} required placeholder="WEB"/></label><label>Descripción<textarea rows="3" value={f.description} onChange={e=>setF({...f,description:e.target.value})}/></label><div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div></AsyncForm></Modal>}
function SprintModal({title,initial,onClose,onSave}){
  const [f,setF]=useState({name:initial?.name||'',goal:initial?.goal||'',details:initial?.details||'',start_date:initial?.start_date||'',end_date:initial?.end_date||'',status:initial?.status||'planned'})
  return <Modal title={title} subtitle="Define objetivo, alcance y ventana de trabajo del sprint." onClose={onClose}><AsyncForm onSubmit={()=>onSave(f)} submitLabel="Guardar sprint">
    <label>Nombre<input value={f.name} onChange={e=>setF({...f,name:e.target.value})} required placeholder="Ej. Sprint 14 · Noviembre"/></label>
    <label>Objetivo<textarea rows="3" value={f.goal} onChange={e=>setF({...f,goal:e.target.value})} placeholder="Resultado que debe lograr el ciclo."/></label>
    <label>Detalles y criterios<textarea rows="5" value={f.details} onChange={e=>setF({...f,details:e.target.value})} placeholder="Alcance, dependencias, criterios de salida, notas de planeación…"/></label>
    <div className="form-grid"><label>Inicio<input type="date" value={f.start_date} onChange={e=>setF({...f,start_date:e.target.value})}/></label><label>Fin<input type="date" min={f.start_date||undefined} value={f.end_date} onChange={e=>setF({...f,end_date:e.target.value})}/></label><label>Estado<select value={f.status} onChange={e=>setF({...f,status:e.target.value})}><option value="planned">Planeado</option><option value="active">Activo</option><option value="completed">Completado</option></select></label></div>
    <div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div>
  </AsyncForm></Modal>
}

function RequestTypeModal({title,initial,requestTypes=[],onClose,onSave}){
  const [f,setF]=useState({name:initial?.name||'',code:initial?.code||'',description:initial?.description||'',color:initial?.color||'#0D47A1',icon:initial?.icon||'lucide:ticket',sort_order:initial?.sort_order??100,active:initial?.active??true})
  const updateName=value=>setF(prev=>({...prev,name:value,code:initial?prev.code:slugify(value).replace(/-/g,'_').slice(0,40)}))
  return <Modal title={title} subtitle="Define una clasificación reutilizable para solicitudes y reportes de Helpdesk." onClose={onClose} size="md"><AsyncForm onSubmit={()=>{const name=f.name.trim(),code=f.code.trim().toLowerCase().replace(/[^a-z0-9_-]/g,'').slice(0,40);if(!name)throw new Error('El nombre es obligatorio.');if(code.length<2)throw new Error('El código debe tener al menos 2 caracteres.');if(requestTypes.some(x=>x.id!==initial?.id&&importNorm(x.name)===importNorm(name)))throw new Error('Ya existe un tipo con ese nombre.');if(requestTypes.some(x=>x.id!==initial?.id&&x.code===code))throw new Error('Ya existe un tipo con ese código.');return onSave({...f,name,code,description:f.description.trim()||null,sort_order:Number(f.sort_order)||100})}} submitLabel="Guardar tipo"><div className="form-grid"><label>Nombre<input value={f.name} onChange={e=>updateName(e.target.value)} required placeholder="Ej. Soporte técnico"/></label><label>Código<input value={f.code} onChange={e=>setF({...f,code:e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g,'').slice(0,40)})} required placeholder="soporte_tecnico"/></label><label>Icono Iconify<input value={f.icon} onChange={e=>setF({...f,icon:e.target.value})} placeholder="lucide:headphones"/></label><label>Color<input type="color" value={f.color} onChange={e=>setF({...f,color:e.target.value})}/></label><label>Orden<input type="number" min="1" max="9999" value={f.sort_order} onChange={e=>setF({...f,sort_order:e.target.value})}/></label></div><label>Descripción<textarea rows="3" value={f.description} onChange={e=>setF({...f,description:e.target.value})} placeholder="Cuándo debe utilizarse este tipo de solicitud."/></label><Toggle label="Tipo activo" checked={!!f.active} onChange={v=>setF({...f,active:v})}/><div className="request-type-preview"><span className="request-type-icon" style={{background:`${f.color}18`,color:f.color}}><Icon name={f.icon||'lucide:ticket'}/></span><span><b>{f.name||'Vista previa'}</b><small>{f.code||'codigo_tipo'}</small></span></div><div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div></AsyncForm></Modal>
}

function DepartmentModal({title,initial,onClose,onSave}){const [f,setF]=useState({name:initial?.name||'',color:initial?.color||'#0D47A1',active:initial?.active??true});return <Modal title={title} subtitle="Configura cómo se clasifica el origen de las solicitudes de Helpdesk." onClose={onClose}><AsyncForm onSubmit={()=>onSave(f)} submitLabel="Guardar área"><label>Nombre del área<input value={f.name} onChange={e=>setF({...f,name:e.target.value})} required placeholder="Ej. Recursos Humanos"/></label><label>Color<input type="color" value={f.color||'#0D47A1'} onChange={e=>setF({...f,color:e.target.value})}/></label><Toggle label="Área activa" checked={!!f.active} onChange={v=>setF({...f,active:v})}/><div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div></AsyncForm></Modal>}

function CommentEditModal({title,initial,onClose,onSave}){const [body,setBody]=useState(initial||'');return <Modal title={title} subtitle="Actualiza el contenido sin perder el contexto del ticket." onClose={onClose} size="sm"><AsyncForm onSubmit={()=>onSave(body)} submitLabel="Guardar comentario"><label>Comentario<textarea rows="5" value={body} onChange={e=>setBody(e.target.value)} required/></label><div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div></AsyncForm></Modal>}

function QuickHelpModal({helpdeskEnabled,canOpenSettings,onClose,onHelpdesk,onSettings}){return <Modal title="Centro de ayuda" subtitle="Accesos rápidos y guía del Jira Interno TROBBU." onClose={onClose}><div className="help-grid">{helpdeskEnabled?<button type="button" onClick={onHelpdesk}><span><Icon name="lucide:life-buoy"/></span><div><b>Abrir Helpdesk</b><p>Registra o atiende solicitudes internas de otras áreas.</p></div><Icon name="lucide:chevron-right"/></button>:canOpenSettings?<button type="button" onClick={onSettings}><span><Icon name="lucide:life-buoy"/></span><div><b>Helpdesk deshabilitado</b><p>Actívalo desde Configuración para recibir solicitudes internas.</p></div><Icon name="lucide:settings"/></button>:<div className="shortcut-card"><span><Icon name="lucide:life-buoy"/></span><div><b>Helpdesk deshabilitado</b><p>Solicita a un administrador que habilite el módulo.</p></div></div>}{canOpenSettings&&<button type="button" onClick={onSettings}><span><Icon name="lucide:settings"/></span><div><b>Configuración</b><p>Administra workspace, productos y notificaciones.</p></div><Icon name="lucide:chevron-right"/></button>}<div className="shortcut-card"><span><Icon name="lucide:keyboard"/></span><div><b>Atajo de búsqueda</b><p>Usa <kbd>⌘ K</kbd> o <kbd>Ctrl K</kbd> para enfocar el buscador global.</p></div></div></div></Modal>}

ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>)
