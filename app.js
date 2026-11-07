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
  ['manage_settings','Configuración','lucide:settings']
]
const ROLE_DEFAULTS = {
  superadmin:Object.fromEntries(PERMISSION_DEFS.map(([k])=>[k,true])),
  admin:Object.fromEntries(PERMISSION_DEFS.map(([k])=>[k,true])),
  pm:{view_dashboard:true,view_tickets:true,create_tickets:true,edit_tickets:true,delete_tickets:true,manage_sprints:true,qa_review:true,manage_helpdesk:true,manage_staff:false,manage_products:false,manage_settings:false},
  dev:{view_dashboard:true,view_tickets:true,create_tickets:true,edit_tickets:true,delete_tickets:false,manage_sprints:false,qa_review:false,manage_helpdesk:false,manage_staff:false,manage_products:false,manage_settings:false},
  qa:{view_dashboard:true,view_tickets:true,create_tickets:true,edit_tickets:true,delete_tickets:false,manage_sprints:false,qa_review:true,manage_helpdesk:false,manage_staff:false,manage_products:false,manage_settings:false},
  consulta:{view_dashboard:true,view_tickets:true,create_tickets:false,edit_tickets:false,delete_tickets:false,manage_sprints:false,qa_review:false,manage_helpdesk:false,manage_staff:false,manage_products:false,manage_settings:false}
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
  const [helpdesk,setHelpdesk]=useState([])
  const [notifications,setNotifications]=useState([])
  const [emailQueue,setEmailQueue]=useState([])
  const [emailProviderStatus,setEmailProviderStatus]=useState(null)
  const [view,setView]=useState('board')
  const [boardMode,setBoardMode]=useState('table')
  const [productId,setProductId]=useState('all')
  const [search,setSearch]=useState('')
  const [filters,setFilters]=useState({status:'all',assignee:'all',sprint:'all',priority:'all',type:'all'})
  const [helpFilters,setHelpFilters]=useState({status:'all',department:'all',assignee:'all',priority:'all'})
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
    const [p,s,t,m,mp,wr,ws,d,h,n,q]=await Promise.all([
      db.from('products').select('*').eq('workspace_id',workspace.id).order('board_order'),
      db.from('sprints').select('*').eq('workspace_id',workspace.id).order('created_at',{ascending:false}),
      db.from('tickets').select('*').eq('workspace_id',workspace.id).order('updated_at',{ascending:false}),
      db.from('workspace_members').select('user_id,role,role_id,active,joined_at,permissions,all_products').eq('workspace_id',workspace.id).order('joined_at'),
      db.from('workspace_member_products').select('user_id,product_id').eq('workspace_id',workspace.id),
      db.from('workspace_roles').select('*').eq('workspace_id',workspace.id).order('created_at'),
      db.from('workspace_settings').select('*').eq('workspace_id',workspace.id).maybeSingle(),
      db.from('helpdesk_departments').select('*').eq('workspace_id',workspace.id).order('name'),
      db.from('helpdesk_tickets').select('*').eq('workspace_id',workspace.id).order('updated_at',{ascending:false}),
      db.from('notifications').select('*').eq('workspace_id',workspace.id).order('created_at',{ascending:false}).limit(100),
      db.from('notification_outbox').select('id,event_type,status,attempts,last_error,created_at,sent_at,recipient_user_id').eq('workspace_id',workspace.id).order('created_at',{ascending:false}).limit(100)
    ])
    const fail=[p,s,t,m,mp,wr,ws,d,h,n,q].find(x=>x.error)?.error
    if(fail){showToast('error',fail.message);setBusy(false);return}
    const ids=(m.data||[]).map(x=>x.user_id)
    const profileMap={}
    if(ids.length){const pr=await db.from('profiles').select('*').in('id',ids); (pr.data||[]).forEach(x=>profileMap[x.id]=x)}
    const roles=wr.data||[]
    setProducts(p.data||[]); setSprints(s.data||[]); setTickets(t.data||[]); setRoleTemplates(roles); setSettings(ws.data||null)
    setDepartments(d.data||[]); setHelpdesk(h.data||[]); setNotifications(n.data||[]); setEmailQueue(q.data||[]); setMemberProductAccess(mp.data||[])
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
    setFilters({status:'all',assignee:'all',sprint:'all',priority:'all',type:'all'})
    setHelpFilters({status:'all',department:'all',assignee:'all',priority:'all'})
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
      && (!q||`${t.ticket_key||''} ${t.title||''} ${t.description||''}`.toLowerCase().includes(q))
  }),[tickets,productId,filters,search])

  const myTickets=useMemo(()=>filteredTickets.filter(t=>t.dev_owner_id===session.user.id||t.qa_owner_id===session.user.id||t.reporter_id===session.user.id),[filteredTickets,session.user.id])
  const filteredHelpdesk=useMemo(()=>helpdesk.filter(h=>(helpFilters.status==='all'||h.status===helpFilters.status)&&(helpFilters.department==='all'||h.department_id===helpFilters.department)&&(helpFilters.assignee==='all'||h.assigned_to===helpFilters.assignee)&&(helpFilters.priority==='all'||h.priority===helpFilters.priority)),[helpdesk,helpFilters])

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
    let payload
    if(!canWork && !ticket){
      payload={
        workspace_id:workspace.id,
        product_id:form.product_id,
        title:form.title,
        description:form.description||null,
        type:form.type||'task',
        priority:form.priority||'medium',
        status:'backlog',
        reporter_id:session.user.id,
        sprint_id:null,dev_owner_id:null,qa_owner_id:null,story_points:null,start_date:null,due_date:null
      }
    }else{
      payload={...form,workspace_id:workspace.id,reporter_id:ticket?.reporter_id||session.user.id,sprint_id:form.sprint_id||null,dev_owner_id:form.dev_owner_id||null,qa_owner_id:form.qa_owner_id||null,story_points:form.story_points===''||form.story_points==null?null:Number(form.story_points),start_date:form.start_date||null,due_date:form.due_date||null}
    }
    const result=ticket ? await db.from('tickets').update(payload).eq('id',ticket.id) : await db.from('tickets').insert(payload)
    if(result.error) throw result.error
    await refresh(); runEmails(); showToast('success',ticket?'Ticket actualizado.':'Ticket enviado a Backlog.')
  }

  const deleteTicket=async ticket=>{
    const {error}=await db.from('tickets').delete().eq('id',ticket.id); if(error) throw error
    await refresh(); showToast('success','Ticket eliminado.')
  }

  const moveTicket=async(ticket,status)=>{
    if(!canWork) return showToast('error','Tu rol no permite cambiar estados.')
    const {error}=await db.from('tickets').update({status}).eq('id',ticket.id)
    if(error) return showToast('error',error.message)
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
    const isRequirement=isProposalCategory(form.category)||isProposalCategory(item?.category)
    const base={
      department_id:form.department_id||null,
      subject:form.subject,
      description:form.description||null,
      requester_name:form.requester_name||null,
      requester_email:form.requester_email||session.user.email,
      category:form.category||'general',
      priority:form.priority||'medium',
      source:form.source||'internal'
    }
    const payload=item
      ? (canManageHelpdesk
          ? (isRequirement?base:{...base,status:form.status,assigned_to:form.assigned_to||null,due_at:localDateTimeToIso(form.due_at)})
          : base)
      : {...base,workspace_id:workspace.id,requester_user_id:session.user.id,status:isRequirement?'created':canManageHelpdesk?(form.status||'created'):'created',assigned_to:isRequirement?null:canManageHelpdesk?(form.assigned_to||null):null,due_at:isRequirement?null:canManageHelpdesk?localDateTimeToIso(form.due_at):null}
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
    <Sidebar workspace={workspace} workspaces={workspaces} products={products} productId={productId} setProductId={setProductId} view={view} setView={setView} tickets={tickets} helpdesk={helpdesk} helpdeskEnabled={helpdeskEnabled} role={myRole} roleName={myRoleName} helpdeskOnly={helpdeskOnly} canManageStaff={canManageStaff} canManageSettings={canManageSettings||canManageProducts} canViewDashboard={canViewDashboard} onWorkspace={()=>setModal({type:'workspace-switch'})}/>
    <MobileNav view={view} setView={setView} setProductId={setProductId} helpdeskEnabled={helpdeskEnabled} role={myRole} helpdeskOnly={helpdeskOnly} canManageStaff={canManageStaff} canManageSettings={canManageSettings||canManageProducts} canViewDashboard={canViewDashboard}/>
    <main className="main-area">
      {busy ? <LoadingPanel/> : <>
        {view==='overview' && canViewDashboard && <Overview workspace={workspace} tickets={tickets} helpdesk={helpdesk} products={products} sprints={sprints}/>} 
        {view==='board' && canViewDashboard && <TicketWorkspace workspace={workspace} title="Tablero" subtitle="Consulta, filtra y gestiona tickets del equipo." tickets={filteredTickets} allTickets={tickets} products={products} members={members} sprints={sprints} boardMode={boardMode} setBoardMode={setBoardMode} filters={filters} onFilter={()=>setModal({type:'ticket-filters'})} onClearFilters={()=>setFilters({status:'all',assignee:'all',sprint:'all',priority:'all',type:'all'})} canWork={canWork} canPlan={canPlan} canDelete={canDeleteTicket} canCreate={canCreateTicket} onCreate={()=>setModal({type:'ticket-create'})} onActions={ticket=>setModal({type:'ticket-actions',ticket})} onOpen={ticket=>setModal({type:'ticket-detail',ticket})} onEdit={ticket=>setModal({type:'ticket-edit',ticket})} onDelete={ticket=>setModal({type:'ticket-delete',ticket})} onBacklog={ticket=>planTicket(ticket,null)} onSprint={sprint=>setModal({type:'sprint-detail',sprint})} onMove={moveTicket}/>} 
        {view==='timeline' && canViewDashboard && <GanttView workspace={workspace} tickets={filteredTickets} products={products} sprints={sprints} members={members} onOpen={ticket=>setModal({type:'ticket-detail',ticket})} onEdit={ticket=>setModal({type:'ticket-edit',ticket})} onDelete={ticket=>setModal({type:'ticket-delete',ticket})} onBacklog={ticket=>planTicket(ticket,null)} onSprint={sprint=>setModal({type:'sprint-detail',sprint})} canWork={canWork} canPlan={canPlan} canDelete={canDeleteTicket}/>}
        {view==='backlog' && canViewDashboard && <BacklogView workspace={workspace} tickets={tickets} products={products} sprints={sprints} members={members} canPlan={canPlan} onTicket={ticket=>setModal({type:'ticket-detail',ticket})} onPlan={ticket=>setModal({type:'ticket-plan',ticket})} onSprint={sprint=>setModal({type:'sprint-detail',sprint})} onCloseSprint={sprint=>setModal({type:'sprint-rollover',sprint})} onCreateSprint={()=>setModal({type:'sprint-create'})}/>} 
        {view==='mytasks' && <TicketWorkspace workspace={workspace} title="Mis tareas" subtitle="Tickets que reportaste o que tienes asignados." tickets={myTickets} allTickets={myTickets} products={products} members={members} sprints={sprints} boardMode={boardMode} setBoardMode={setBoardMode} filters={filters} onFilter={()=>setModal({type:'ticket-filters'})} onClearFilters={()=>setFilters({status:'all',assignee:'all',sprint:'all',priority:'all',type:'all'})} canWork={canWork} canPlan={canPlan} canDelete={canDeleteTicket} canCreate={canCreateTicket} onCreate={()=>setModal({type:'ticket-create'})} onActions={ticket=>setModal({type:'ticket-actions',ticket})} onOpen={ticket=>setModal({type:'ticket-detail',ticket})} onEdit={ticket=>setModal({type:'ticket-edit',ticket})} onDelete={ticket=>setModal({type:'ticket-delete',ticket})} onBacklog={ticket=>planTicket(ticket,null)} onSprint={sprint=>setModal({type:'sprint-detail',sprint})} onMove={moveTicket}/>} 
        {view==='helpdesk' && helpdeskEnabled && (helpdeskStaff
          ? <HelpdeskView items={filteredHelpdesk} allItems={helpdesk} departments={departments} members={members} canPlan={canPlan} filters={helpFilters} onFilter={()=>setModal({type:'help-filters'})} onCreate={()=>setModal({type:'help-create'})} onActions={item=>setModal({type:'help-actions',item})} onOpen={item=>setModal({type:'help-detail',item})} onDecision={item=>setModal({type:'help-requirement-decision',item})}/>
          : <HelpdeskPortal items={helpdesk} departments={departments} onCreate={()=>setModal({type:'help-create'})} onOpen={item=>setModal({type:'help-detail',item})}/>)} 
        {view==='team' && canManageStaff && <StaffRolesView workspace={workspace} members={members} products={products} memberProductAccess={memberProductAccess} roleTemplates={roleTemplates} canManage={canManageStaff} isSuperadmin={isSuperadmin} session={session} onInvite={()=>setModal({type:'invite'})} onMember={member=>setModal({type:'member-edit',member})} onRoleCreate={()=>setModal({type:'role-create'})} onRoleEdit={role=>setModal({type:'role-edit',role})} onRoleDelete={role=>setModal({type:'role-delete',role})}/>} 
        {view==='settings' && (canManageSettings||canManageProducts) && <SettingsView workspace={workspace} settings={settings} products={products} sprints={sprints} departments={departments} emailQueue={emailQueue} emailProviderStatus={emailProviderStatus} canManageSettings={canManageSettings} canManageProducts={canManageProducts} canPlan={canPlan} canDeleteWorkspace={isSuperadmin} onWorkspaceEdit={()=>setModal({type:'workspace-edit'})} onWorkspaceConfig={()=>setModal({type:'workspace-config'})} onWorkspaceDelete={()=>setModal({type:'workspace-delete'})} onSettingsSaved={refresh} onProductCreate={()=>setModal({type:'product-create'})} onProductEdit={product=>setModal({type:'product-edit',product})} onProductDelete={product=>setModal({type:'product-delete',product})} onSprintCreate={()=>setModal({type:'sprint-create'})} onSprintEdit={sprint=>setModal({type:'sprint-edit',sprint})} onSprintDelete={sprint=>setModal({type:'sprint-delete',sprint})} onDepartmentCreate={()=>setModal({type:'department-create'})} onDepartmentEdit={department=>setModal({type:'department-edit',department})} onDepartmentDelete={department=>setModal({type:'department-delete',department})} onProcessEmails={processEmails} toast={showToast}/>} 
      </>}
    </main>
    {drawer==='notifications' && <NotificationsDrawer notifications={notifications} onClose={()=>setDrawer(null)} onMark={markNotification} onMarkAll={markAll} onDelete={deleteNotification} onClearRead={clearReadNotifications} onOpen={n=>{setDrawer(null); if(n.ticket_id){const t=tickets.find(x=>x.id===n.ticket_id); if(t)setModal({type:'ticket-detail',ticket:t});else showToast('error','El ticket relacionado ya no está disponible.')} else if(n.helpdesk_ticket_id){const h=helpdesk.find(x=>x.id===n.helpdesk_ticket_id); if(h)setModal({type:'help-detail',item:h});else showToast('error','La solicitud relacionada ya no está disponible.')}}}/>} 
    {modal && <ModalRouter modal={modal} setModal={setModal} workspace={workspace} workspaces={workspaces} memberships={memberships} products={products} sprints={sprints} tickets={tickets} members={members} memberProductAccess={memberProductAccess} roleTemplates={roleTemplates} departments={departments} settings={settings} session={session} myRole={myRole} myPermissions={myPermissions} isSuperadmin={isSuperadmin} isAdmin={canAdminWorkspace} canManage={canPlan} canAdminWorkspace={canAdminWorkspace} canManageStaff={canManageStaff} canManageHelpdesk={canManageHelpdesk} canManageSettings={canManageSettings} canManageProducts={canManageProducts} canDeleteTicket={canDeleteTicket} canPlan={canPlan} canWork={canWork} canCreateTicket={canCreateTicket} filters={filters} setFilters={setFilters} helpFilters={helpFilters} setHelpFilters={setHelpFilters} createWorkspace={createWorkspace} saveTicket={saveTicket} deleteTicket={deleteTicket} saveHelpdesk={saveHelpdesk} deleteHelpdesk={deleteHelpdesk} decideRequirement={decideRequirement} closeSprintAndRollover={closeSprintAndRollover} planTicket={planTicket} refresh={refresh} loadMemberships={loadMemberships} setWorkspace={setWorkspace} setView={setView} toast={showToast}/>} 
    {toast && <Toast toast={toast}/>} 
  </div>
}

function Topbar({session,unread,search,setSearch,canSearch=true,portalOnly=false,canCreate,onCreate,onNotifications,onAppSwitcher,onHelp}){return <header className="global-topbar">
  <div className="topbar-brand"><button className="app-switcher" onClick={onAppSwitcher} title="Cambiar workspace"><Icon name="lucide:grid-2x2"/></button><img src="./logo.svg" alt="TROBBU"/><span></span><b>Jira Interno</b></div>
  {canSearch?<div className="global-search"><Icon name="lucide:search"/><input id="global-ticket-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar tickets por clave, título o descripción"/><kbd>⌘ K</kbd></div>:<div className="portal-topbar-context"><Icon name="lucide:life-buoy"/><span><b>Portal de solicitudes</b><small>{portalOnly?'Seguimiento personal de Helpdesk':'Workspace interno'}</small></span></div>}
  <div className="topbar-actions">{canCreate&&<button className="primary create-button" onClick={onCreate}><Icon name="lucide:plus"/> Crear</button>}<button className="icon-button bell" onClick={onNotifications} title="Notificaciones"><Icon name="lucide:bell"/>{unread>0&&<em>{unread>9?'9+':unread}</em>}</button><button className="icon-button" onClick={onHelp} title="Ayuda"><Icon name="lucide:circle-help"/></button><div className="top-user"><span className="avatar sm">{initials(session.user.user_metadata?.full_name||session.user.email)}</span><div><b>{session.user.user_metadata?.full_name||'Usuario'}</b><small>{session.user.email}</small></div></div></div>
</header>}
function Sidebar({workspace,workspaces,products,productId,setProductId,view,setView,tickets,helpdesk,helpdeskEnabled,role,roleName,helpdeskOnly=false,canManageStaff,canManageSettings,canViewDashboard,onWorkspace}){
  const items=helpdeskOnly
    ? [['helpdesk','lucide:life-buoy','Mis solicitudes']]
    : canViewDashboard
      ? [['overview','lucide:layout-dashboard','Resumen'],['board','lucide:columns-3','Tablero'],['backlog','lucide:list-todo','Backlog / Sprints'],['timeline','lucide:gantt-chart','Cronograma'],...(role!=='consulta'?[['mytasks','lucide:circle-check-big','Mis tareas']]:[]),...(helpdeskEnabled?[['helpdesk','lucide:life-buoy',role==='consulta'?'Mis solicitudes':'Helpdesk']]:[]),...(canManageStaff?[['team','lucide:users-round','Staff y Roles']]:[])]
      : [...(role!=='consulta'?[['mytasks','lucide:circle-check-big','Mis tareas']]:[]),...(helpdeskEnabled?[['helpdesk','lucide:life-buoy','Mis solicitudes']]:[])]
  return <aside className="sidebar">
    <div className="sidebar-section-title"><span>ESPACIO DE TRABAJO</span><button className="ghost-icon" onClick={onWorkspace} title="Cambiar o crear workspace"><Icon name="lucide:plus" size={16}/></button></div>
    <button className="workspace-card" onClick={onWorkspace}><span className="workspace-icon"><Icon name="lucide:layers-3"/></span><div><b>{workspace?.name}</b><small>{roleName||ROLE_LABELS[role]||role}</small></div><Icon name="lucide:chevrons-up-down" size={16}/></button>
    <nav className="side-nav">{items.map(([key,icon,label])=><button key={key} className={view===key?'active':''} onClick={()=>{if(!['board','timeline'].includes(key))setProductId('all');setView(key)}}><Icon name={icon}/><span>{label}</span>{key==='board'&&<em>{tickets.length}</em>}{key==='backlog'&&<em>{tickets.filter(t=>!t.sprint_id&&t.status!=='closed').length}</em>}{key==='helpdesk'&&<em>{helpdeskOnly?helpdesk.length:helpdesk.filter(h=>isProposalCategory(h.category)?h.proposal_status==='pending':!['resolved','closed'].includes(h.status)).length}</em>}</button>)}</nav>
    {canViewDashboard&&!helpdeskOnly&&<><div className="sidebar-divider"></div><div className="sidebar-section-title"><span>PRODUCTOS AUTORIZADOS</span></div><button className={`product-nav ${productId==='all'?'active':''}`} onClick={()=>{setProductId('all');setView('board')}}><span className="product-dot all"><Icon name="lucide:boxes" size={15}/></span><span>Todos los autorizados</span><em>{tickets.length}</em></button>{products.map((p,i)=><button key={p.id} className={`product-nav ${productId===p.id?'active':''}`} onClick={()=>{setProductId(p.id);setView('board')}}><span className={`product-dot p${i%4}`}><Icon name={i===2?'lucide:smartphone':'lucide:monitor'} size={15}/></span><span>{p.name}</span><em>{tickets.filter(t=>t.product_id===p.id).length}</em></button>)}</>}
    <div className="sidebar-spacer"></div><div className="sidebar-divider"></div>{canManageSettings&&!helpdeskOnly&&<button className={`footer-nav ${view==='settings'?'active':''}`} onClick={()=>{setProductId('all');setView('settings')}}><Icon name="lucide:settings"/>Configuración</button>}<button className="footer-nav" onClick={()=>db.auth.signOut()}><Icon name="lucide:log-out"/>Cerrar sesión</button>
  </aside>
}
function MobileNav({view,setView,setProductId,helpdeskEnabled,role,helpdeskOnly=false,canManageStaff,canManageSettings,canViewDashboard}){
  const items=helpdeskOnly
    ? [['helpdesk','lucide:life-buoy','Solicitudes']]
    : canViewDashboard
      ? [['overview','lucide:layout-dashboard','Resumen'],['board','lucide:columns-3','Tablero'],['backlog','lucide:list-todo','Backlog'],['timeline','lucide:gantt-chart','Gantt'],...(role!=='consulta'?[['mytasks','lucide:circle-check-big','Mis tareas']]:[]),...(helpdeskEnabled?[['helpdesk','lucide:life-buoy','Helpdesk']]:[]),...(canManageStaff?[['team','lucide:users-round','Staff']]:[]),...(canManageSettings?[['settings','lucide:settings','Ajustes']]:[])]
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

function GanttView({workspace,tickets,products,sprints,members=[],onOpen,onEdit,onDelete,onBacklog,onSprint,canWork=false,canPlan=false,canDelete=false,embedded=false}){
  const yesterday=()=>{const d=new Date();d.setDate(d.getDate()-1);return dateKey(d)}
  const [range,setRange]=useState('4w')
  const [cursor,setCursor]=useState(yesterday)
  useEffect(()=>{setCursor(yesterday());setRange('4w')},[workspace?.id])
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
      {visibleTickets.map(t=>{const pos=position(t),product=products.find(p=>p.id===t.product_id),pct=ticketProgress(t.status),owner=assignee(t);return <div className={`gantt-row ticket-timeline-row ${t.status==='closed'?'historical':''}`} key={t.id}><div className="gantt-label gantt-ticket-label jira-task-label"><button type="button" className="gantt-task-main" onClick={()=>onOpen(t)}><span><Icon name={statusIcon(t.status)} size={13}/><b>{t.ticket_key}</b><em>{product?.key||'—'}</em></span><strong>{t.title}</strong><small>{statusLabel(t.status)} · {pct}%{owner?` · ${owner}`:''}</small></button><div className="gantt-row-actions"><button type="button" title="Ver detalle" onClick={()=>onOpen(t)}><Icon name="lucide:eye"/></button>{canWork&&<button type="button" title="Editar" onClick={()=>onEdit?.(t)}><Icon name="lucide:pencil"/></button>}{canPlan&&t.sprint_id&&<button type="button" title="Mover a Backlog" onClick={()=>onBacklog?.(t)}><Icon name="lucide:inbox"/></button>}{canDelete&&<button type="button" className="danger-text" title="Eliminar" onClick={()=>onDelete?.(t)}><Icon name="lucide:trash-2"/></button>}</div></div><div className="gantt-days gantt-track" style={cellStyle}>{days.map(d=><i key={dateKey(d)} className={`${[0,6].includes(d.getDay())?'weekend':''} ${dateKey(d)===todayKey?'today':''}`}></i>)}{pos&&<button type="button" className={`gantt-bar status-${t.status} ${pos.leftCut?'cut-left':''} ${pos.rightCut?'cut-right':''}`} style={{gridColumn:`${pos.start}/${pos.end}`}} onClick={()=>onOpen(t)} title={`${t.ticket_key} · ${t.title} · ${pct}%`}><span style={{width:`${pct}%`}}></span><b>{pct}%</b></button>}</div></div>})}
    </div></div>
    {unscheduled.length>0&&<div className="gantt-unscheduled"><div><Icon name="lucide:inbox"/><span><b>{unscheduled.length} actividades en Backlog / sin programar</b><small>Asigna sprint y fechas para incorporarlas al Timeline.</small></span></div><div>{unscheduled.slice(0,8).map(t=><button type="button" key={t.id} onClick={()=>onOpen(t)}>{t.ticket_key} · {t.title}</button>)}</div></div>}
  </>
  if(embedded)return <div className="gantt-embedded">{content}</div>
  return <div className="page"><PageHeader eyebrow="Planificación" title="Timeline / Gantt" subtitle="Cronograma estilo Jira con fecha inicial configurable, ventanas semanales/mensuales e histórico de sprints." icon="lucide:gantt-chart"/><section className="workspace-panel gantt-panel">{content}</section></div>
}
function BacklogView({workspace,tickets,products,sprints,members,canPlan,onTicket,onPlan,onSprint,onCloseSprint,onCreateSprint}){
  const backlog=tickets.filter(t=>!t.sprint_id&&t.status!=='closed')
  const ordered=[...sprints].sort((a,b)=>String(a.start_date||'9999').localeCompare(String(b.start_date||'9999')))
  const active=ordered.filter(s=>s.status!=='completed')
  const completed=ordered.filter(s=>s.status==='completed').slice(-4).reverse()
  const today=dateKey(new Date())
  return <div className="page"><PageHeader eyebrow="Planificación" title="Backlog y Sprints" subtitle="Prioriza el trabajo pendiente, organiza ciclos y arrastra lo no resuelto al siguiente sprint." icon="lucide:list-todo" action={canPlan?<button className="primary" onClick={onCreateSprint}><Icon name="lucide:plus"/> Nuevo sprint</button>:<span className="readonly-chip"><Icon name="lucide:eye"/> Consulta</span>}/>
    <div className="backlog-summary"><Metric label="Backlog" value={backlog.length} icon="lucide:inbox" tone="navy"/><Metric label="Sprints activos" value={active.filter(s=>s.status==='active').length} icon="lucide:zap" tone="orange"/><Metric label="Planeados" value={active.filter(s=>s.status==='planned').length} icon="lucide:calendar-clock" tone="blue"/><Metric label="Sin resolver en sprint" value={tickets.filter(t=>t.sprint_id&&!['qa_passed','closed'].includes(t.status)).length} icon="lucide:circle-dashed" tone="red"/></div>
    <section className="backlog-board"><div className="backlog-column backlog-pool"><div className="backlog-head"><div><span className="eyebrow">COLA DE TRABAJO</span><h3>Backlog</h3><p>Tickets aún no comprometidos en un sprint.</p></div><b>{backlog.length}</b></div><div className="backlog-ticket-list">{backlog.length===0&&<div className="compact-empty"><Icon name="lucide:inbox"/><span>Backlog vacío</span></div>}{backlog.map(t=>{const p=products.find(x=>x.id===t.product_id);return <article className="backlog-ticket" key={t.id}><button type="button" className="backlog-ticket-main" onClick={()=>onTicket(t)}><small>{t.ticket_key} · {p?.name||'Producto'}</small><b>{t.title}</b><span><StatusBadge status={t.status}/><em className={`priority-badge priority-${t.priority}`}>{PRIORITY_LABELS[t.priority]}</em></span></button>{canPlan&&<button type="button" className="secondary-button compact" onClick={()=>onPlan(t)}><Icon name="lucide:calendar-plus"/> Planificar</button>}</article>})}</div></div>
      <div className="sprint-stack"><div className="backlog-head"><div><span className="eyebrow">CICLOS</span><h3>Sprints</h3><p>Trabajo comprometido y proyección de entregas.</p></div></div>{active.length===0&&<div className="compact-empty"><Icon name="lucide:calendar-off"/><span>No hay sprints planeados o activos.</span></div>}{active.map(s=>{const rows=tickets.filter(t=>t.sprint_id===s.id),done=rows.filter(t=>['qa_passed','closed'].includes(t.status)).length,pct=rows.length?Math.round(done/rows.length*100):0,unresolved=rows.length-done,expired=s.end_date&&s.end_date<today;return <article className={`sprint-card ${s.status} ${expired?'expired':''}`} key={s.id}><div className="sprint-card-head"><div><span className={`sprint-status ${s.status}`}>{s.status==='active'?'Activo':'Planeado'}</span>{expired&&<span className="expired-chip"><Icon name="lucide:alarm-clock"/> Vencido</span>}<h3>{s.name}</h3><p>{s.goal||'Sin objetivo definido.'}</p></div><button type="button" className="icon-button" onClick={()=>onSprint(s)}><Icon name="lucide:expand"/></button></div><div className="sprint-dates"><span><Icon name="lucide:calendar-range"/> {formatDate(s.start_date)} → {formatDate(s.end_date)}</span><span>{rows.length} tickets · {unresolved} no resueltos</span></div><div className="sprint-progress"><div><i style={{width:`${pct}%`}}></i></div><b>{pct}%</b></div><div className="sprint-preview">{rows.slice(0,4).map(t=><button type="button" key={t.id} onClick={()=>onTicket(t)}><span>{t.ticket_key}</span><b>{t.title}</b><StatusBadge status={t.status}/></button>)}{rows.length>4&&<small>+{rows.length-4} actividades</small>}</div><div className="sprint-card-actions"><button type="button" className="secondary-button compact" onClick={()=>onSprint(s)}><Icon name="lucide:file-text"/> Detalle</button>{canPlan&&<button type="button" className={expired?'primary compact':'secondary-button compact'} onClick={()=>onCloseSprint(s)}><Icon name="lucide:arrow-right-circle"/> Cerrar / trasladar</button>}</div></article>})}
      {completed.length>0&&<div className="completed-sprints"><h4>Sprints completados</h4>{completed.map(s=><button type="button" key={s.id} onClick={()=>onSprint(s)}><span><b>{s.name}</b><small>{formatDate(s.start_date)} → {formatDate(s.end_date)}</small></span><Icon name="lucide:chevron-right"/></button>)}</div>}</div>
    </section>
  </div>
}

function ReporterTicketsView({tickets,products,onCreate,onOpen}){
  const open=tickets.filter(t=>!['qa_passed','closed'].includes(t.status)).length
  const done=tickets.filter(t=>['qa_passed','closed'].includes(t.status)).length
  return <div className="page"><PageHeader eyebrow="Portal de tickets" title="Mis tickets enviados" subtitle="Crea solicitudes de desarrollo y consulta su avance sin acceder a la administración del tablero." icon="lucide:ticket-check" action={<button className="primary" onClick={onCreate}><Icon name="lucide:plus"/> Enviar ticket</button>}/><div className="metric-grid four"><Metric label="Enviados" value={tickets.length} icon="lucide:send" tone="blue"/><Metric label="En backlog" value={tickets.filter(t=>t.status==='backlog').length} icon="lucide:inbox" tone="navy"/><Metric label="En seguimiento" value={open} icon="lucide:loader-circle" tone="orange"/><Metric label="Completados" value={done} icon="lucide:circle-check" tone="green"/></div><section className="workspace-panel"><div className="requester-ticket-list">{tickets.length===0&&<TableEmpty text="Todavía no has enviado tickets en este workspace."/>}{tickets.map(t=>{const product=products.find(p=>p.id===t.product_id);return <button type="button" key={t.id} onClick={()=>onOpen(t)}><span className="requester-ticket-icon"><Icon name="lucide:ticket"/></span><span><small>{t.ticket_key} · {product?.name||'Producto'}</small><b>{t.title}</b><em>Actualizado {formatDateTime(t.updated_at)}</em></span><StatusBadge status={t.status}/><Icon name="lucide:chevron-right"/></button>})}</div></section></div>
}

function RequirementBadge({status}){const value=status||'pending';const icon=value==='accepted_backlog'?'lucide:circle-check-big':value==='rejected'?'lucide:circle-x':'lucide:clock-3';return <span className={`requirement-badge requirement-${value}`}><Icon name={icon} size={13}/>{requirementStatusLabel(value)}</span>}
function HelpdeskPortal({items,departments,onCreate,onOpen}){
  const order=['created','review','attended','resolved','closed']
  const normal=items.filter(x=>!isProposalCategory(x.category))
  const requirements=items.filter(x=>isProposalCategory(x.category))
  const active=normal.filter(x=>!['resolved','closed'].includes(x.status)).length
  const categoryCounts=Object.entries(HELP_CATEGORY_LABELS).map(([key,label])=>({key,label,count:items.filter(x=>x.category===key).length})).filter(x=>x.count)
  return <div className="page"><PageHeader eyebrow="Portal administrativo" title="Mis solicitudes" subtitle="Crea solicitudes, consulta únicamente las tuyas y sigue su resolución o decisión." icon="lucide:life-buoy" action={<button className="primary" onClick={onCreate}><Icon name="lucide:plus"/> Nueva solicitud</button>}/>
    <div className="metric-grid six portal-metrics"><Metric label="Solicitudes" value={items.length} icon="lucide:inbox" tone="blue"/><Metric label="En seguimiento" value={active} icon="lucide:loader-circle" tone="orange"/><Metric label="Resueltas / cerradas" value={normal.filter(x=>['resolved','closed'].includes(x.status)).length} icon="lucide:circle-check" tone="green"/><Metric label="Requerimientos pendientes" value={requirements.filter(x=>(x.proposal_status||'pending')==='pending').length} icon="lucide:lightbulb" tone="purple"/><Metric label="Aceptados a Backlog" value={requirements.filter(x=>x.proposal_status==='accepted_backlog').length} icon="lucide:list-plus" tone="navy"/><Metric label="Sugerencias rechazadas" value={requirements.filter(x=>x.proposal_status==='rejected').length} icon="lucide:circle-x" tone="red"/></div>
    <div className="portal-info"><Icon name="lucide:shield-check"/><div><b>Portal privado de solicitudes.</b><p>No tienes acceso a productos, tableros ni Gantt. Aquí solo ves lo que tú creaste, sus comentarios y su seguimiento.</p></div></div>
    {categoryCounts.length>0&&<section className="panel portal-category-stats"><div className="panel-heading"><div><h3>Solicitudes por tipo</h3><p>Distribución personal de lo que has solicitado.</p></div></div><div>{categoryCounts.map(c=><span key={c.key}><b>{c.count}</b><small>{c.label}</small></span>)}</div></section>}
    <section className="request-list">{items.length===0&&<div className="empty-state-inline"><Icon name="lucide:life-buoy" size={34}/><h3>No tienes solicitudes</h3><p>Cuando necesites acceso, reportar un error o proponer un requerimiento, créalo desde aquí.</p><button className="primary compact" onClick={onCreate}>Crear solicitud</button></div>}{items.map(item=>{const dept=departments.find(d=>d.id===item.department_id),isRequirement=isProposalCategory(item.category),idx=Math.max(0,order.indexOf(item.status));return <article className={`request-card ${isRequirement?'requirement-card':''}`} key={item.id}><button type="button" className="request-card-main" onClick={()=>onOpen(item)}><div className="request-card-title"><span className="request-icon"><Icon name={isRequirement?'lucide:lightbulb':'lucide:headphones'}/></span><div><small>{item.ticket_key} · {dept?.name||'Sin área'} · {helpCategoryLabel(item.category)}</small><h3>{item.subject}</h3><p>{item.description||'Sin descripción.'}</p></div>{isRequirement?<RequirementBadge status={item.proposal_status}/>:<HelpStatusBadge status={item.status}/>}</div>{isRequirement?<div className="requirement-flow"><span className="requirement-flow-node done"><i><Icon name="lucide:send" size={12}/></i><b>Solicitado</b></span><span className={`requirement-flow-line ${(item.proposal_status||'pending')!=='pending'?'done':''}`}></span><span className={`requirement-flow-node ${(item.proposal_status||'pending')==='pending'?'current':'done'}`}><i><Icon name={(item.proposal_status||'pending')==='pending'?'lucide:clock-3':item.proposal_status==='accepted_backlog'?'lucide:list-plus':'lucide:circle-x'} size={12}/></i><b>{requirementStatusLabel(item.proposal_status)}</b></span>{item.converted_ticket_key&&<span className="converted-ticket-chip"><Icon name="lucide:ticket-check"/>{item.converted_ticket_key}</span>}</div>:<div className="request-stepper">{order.map((st,i)=><div key={st} className={`${i<idx?'done':''} ${i===idx?'current':''}`}><i>{i<idx?<Icon name="lucide:check" size={12}/>:i+1}</i><span>{helpStatusLabel(st)}</span></div>)}</div>}<div className="request-meta"><span><Icon name="lucide:calendar"/> Creado {formatDateTime(item.created_at)}</span>{!isRequirement&&item.due_at&&<span><Icon name="lucide:clock"/> Objetivo {formatDateTime(item.due_at)}</span>}{isRequirement&&item.decision_at&&<span><Icon name="lucide:gavel"/> Decisión {formatDateTime(item.decision_at)}</span>}<span><Icon name="lucide:refresh-cw"/> Actualizado {formatDateTime(item.updated_at)}</span></div></button></article>})}</section>
  </div>
}
function HelpdeskView({items,allItems,departments,members,canPlan,filters,onFilter,onCreate,onActions,onOpen,onDecision}){
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
  const active=Object.values(filters).filter(v=>v!=='all').length
  return <div className="page"><PageHeader eyebrow="Servicio interno" title="Helpdesk" subtitle="Atiende solicitudes operativas y decide qué nuevos requerimientos pasan al Backlog." icon="lucide:life-buoy" action={<button className="primary" onClick={onCreate}><Icon name="lucide:plus"/> Nueva solicitud</button>}/>
    <div className="metric-grid six"><Metric label="Solicitudes" value={allItems.length} icon="lucide:inbox" tone="blue"/><Metric label="Abiertas" value={open} icon="lucide:loader-circle" tone="orange"/><Metric label="Requerimientos por decidir" value={pendingRequirements} icon="lucide:lightbulb" tone="purple"/><Metric label="Vencidas" value={overdue} icon="lucide:alarm-clock" tone="red"/><Metric label="Resueltas / cerradas" value={resolved+closed} icon="lucide:circle-check" tone="green"/><Metric label="SLA cumplido" value={`${slaPct}%`} icon="lucide:gauge" tone="navy"/></div>
    <section className="workspace-panel"><div className="panel-toolbar"><div><h3>Solicitudes internas</h3><p className="muted">Los nuevos requerimientos no usan SLA: PM/Admin/Superadmin decide si se aceptan a Backlog o se rechazan.</p></div><div className="toolbar-actions"><button className={`filter-button ${active?'active':''}`} onClick={onFilter}><Icon name="lucide:list-filter"/> Filtros {active>0&&<em>{active}</em>}</button><button className="primary compact" onClick={onCreate}><Icon name="lucide:plus"/> Crear</button></div></div>
    <div className="table-wrap"><div className="table help-table"><div className="tr th"><span>SOLICITUD</span><span>ÁREA</span><span>ASIGNADO</span><span>PRIORIDAD</span><span>ESTADO / DECISIÓN</span><span></span></div>{items.length===0&&<TableEmpty text="No hay solicitudes con estos filtros."/>}{items.map(h=>{const dep=departments.find(d=>d.id===h.department_id),owner=members.find(m=>m.user_id===h.assigned_to)?.profile?.full_name||'Sin asignar',req=isProposalCategory(h.category);return <div className={`tr ${req?'requirement-row':''}`} key={h.id}><span className="task-cell"><button className="task-link" onClick={()=>onOpen(h)}><b>{h.subject}</b><small>{h.ticket_key} · {helpCategoryLabel(h.category)}</small></button></span><span><span className="dept-dot" style={{background:dep?.color||'#D4DCE0'}}></span>{dep?.name||'Sin área'}</span><span className="assignee-cell">{req?<span className="muted"><Icon name="lucide:gavel" size={14}/> Decisión PM</span>:<><span className="mini-avatar">{initials(owner)}</span>{owner}</>}</span><span><span className={`priority-badge priority-${h.priority}`}>{PRIORITY_LABELS[h.priority]}</span></span><span>{req?<RequirementBadge status={h.proposal_status}/>:<HelpStatusBadge status={h.status}/>}</span><span><div className="inline-actions">{req&&canPlan&&(h.proposal_status||'pending')==='pending'&&<button type="button" className="decision-button" onClick={()=>onDecision(h)} title="Evaluar requerimiento"><Icon name="lucide:gavel"/></button>}<button className="icon-button" onClick={()=>onActions(h)} title="Acciones"><Icon name="lucide:ellipsis-vertical"/></button></div></span></div>})}</div></div></section>
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

function SettingsView({workspace,settings,products,sprints,departments,emailQueue,emailProviderStatus,canManageSettings,canManageProducts,canPlan,canDeleteWorkspace,onWorkspaceEdit,onWorkspaceConfig,onWorkspaceDelete,onSettingsSaved,onProductCreate,onProductEdit,onProductDelete,onSprintCreate,onSprintEdit,onSprintDelete,onDepartmentCreate,onDepartmentEdit,onDepartmentDelete,onProcessEmails,toast}){
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
      {tab==='products'&&<EntitySettings title="Productos" subtitle="Tableros separados para cada producto." items={products} canManage={canManageProducts} onCreate={onProductCreate} render={p=><><div><b>{p.name}</b><span>{p.key} · {p.description||'Sin descripción'}</span></div><div className="row-actions">{canManage&&<><button onClick={()=>onProductEdit(p)}><Icon name="lucide:pencil"/>Editar</button><button className="danger-text" onClick={()=>onProductDelete(p)}><Icon name="lucide:trash-2"/>Eliminar</button></>}</div></>}/>}
      {tab==='sprints'&&<EntitySettings title="Sprints" subtitle="Planeación y periodos de trabajo." items={sprints} canManage={canPlan} onCreate={onSprintCreate} render={x=><><div><b>{x.name}</b><span>{x.status} · {formatDate(x.start_date)} — {formatDate(x.end_date)}</span></div><div className="row-actions">{canManage&&<><button onClick={()=>onSprintEdit(x)}><Icon name="lucide:pencil"/>Editar</button><button className="danger-text" onClick={()=>onSprintDelete(x)}><Icon name="lucide:trash-2"/>Eliminar</button></>}</div></>}/>}
      {tab==='helpdesk'&&<HelpdeskSettings settings={settings} departments={departments} canManage={canManageSettings} onCreate={onDepartmentCreate} onEdit={onDepartmentEdit} onDelete={onDepartmentDelete}/>}
      {tab==='notifications'&&<NotificationSettings settings={settings} queue={emailQueue} providerStatus={emailProviderStatus} canManage={canManageSettings} onProcess={onProcessEmails} toast={toast}/>}
    </section>
  </div>
}

function WorkspaceSettings({workspace,settings,canManage,canDelete,onEdit,onConfig,onDelete}){return <div className="settings-content"><div className="settings-card"><div className="settings-card-head"><div><h3>{workspace.name}</h3><p>Datos generales, SLA y funciones habilitadas del espacio.</p></div>{canManage&&<div className="row-actions"><button className="secondary-button" onClick={onEdit}><Icon name="lucide:pencil"/> Editar nombre</button><button className="primary compact" onClick={onConfig}><Icon name="lucide:sliders-horizontal"/> Editar configuración</button></div>}</div><div className="settings-summary-grid"><DetailRow label="Zona horaria">{settings?.timezone||'America/Merida'}</DetailRow><DetailRow label="Duración de sprint">{settings?.default_sprint_days||14} días</DetailRow><DetailRow label="Correo de soporte">{settings?.support_email||'Sin configurar'}</DetailRow><DetailRow label="SLA primera respuesta">{settings?.sla_first_response_hours||4} h</DetailRow><DetailRow label="SLA resolución">{settings?.sla_resolution_hours||24} h</DetailRow><DetailRow label="Notificaciones in-app"><span className={`settings-status ${settings?.in_app_notifications?'on':'off'}`}>{settings?.in_app_notifications?'Activas':'Desactivadas'}</span></DetailRow><DetailRow label="Notificaciones por correo"><span className={`settings-status ${settings?.email_notifications?'on':'off'}`}>{settings?.email_notifications?'Activas':'Desactivadas'}</span></DetailRow><DetailRow label="Helpdesk"><span className={`settings-status ${settings?.helpdesk_enabled?'on':'off'}`}>{settings?.helpdesk_enabled?'Habilitado':'Deshabilitado'}</span></DetailRow></div>{canDelete&&<div className="settings-actions"><button className="danger-outline" onClick={onDelete}><Icon name="lucide:trash-2"/> Eliminar workspace</button></div>}</div></div>}

function HelpdeskSettings({settings,departments}){
  const visible=departments.filter(d=>d.active)
  return <div className="settings-content"><div className="settings-list-head"><div><h3>Departamentos solicitantes</h3><p>Catálogo fijo por workspace para el portal interno. SLA: {settings?.sla_first_response_hours||4}h primera respuesta / {settings?.sla_resolution_hours||24}h resolución.</p></div><span className="readonly-chip"><Icon name="lucide:lock-keyhole"/> Catálogo controlado</span></div><div className="entity-list">{visible.map(d=><div className="entity-row" key={d.id}><div className="department-entity"><span className="dept-dot large" style={{background:d.color||'#D4DCE0'}}></span><div><b>{d.name}</b><span>Disponible para solicitudes</span></div></div><span className="settings-status on">Activo</span></div>)}</div></div>
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

  if(modal.type==='ticket-create') return <TicketModal title="Crear ticket" reporterMode={!props.canWork} products={props.products} sprints={props.sprints} members={props.members} onClose={close} onSave={async f=>{await props.saveTicket(f);close()}}/>
  if(modal.type==='ticket-edit' && props.canWork) return <TicketModal title={`Editar ${modal.ticket.ticket_key}`} ticket={modal.ticket} products={props.products} sprints={props.sprints} members={props.members} onClose={close} onSave={async f=>{await props.saveTicket(f,modal.ticket);close()}}/>
  if(modal.type==='ticket-detail') return <TicketDetailModal workspace={props.workspace} ticket={modal.ticket} products={props.products} members={props.members} session={props.session} canWork={props.canWork} canManage={props.canManage} onClose={close} onEdit={()=>setModal({type:'ticket-edit',ticket:modal.ticket})} onPlan={()=>setModal({type:'ticket-plan',ticket:modal.ticket})} onRefresh={props.refresh} toast={props.toast}/>
  if(modal.type==='ticket-actions'){
    const actions=[['lucide:eye','Ver detalle',()=>setModal({type:'ticket-detail',ticket:modal.ticket})]]
    if(props.canWork) actions.push(['lucide:pencil','Editar ticket',()=>setModal({type:'ticket-edit',ticket:modal.ticket})])
    if(props.canPlan) actions.push(['lucide:calendar-plus','Planificar / cambiar sprint',()=>setModal({type:'ticket-plan',ticket:modal.ticket})])
    if(props.canDeleteTicket) actions.push(['lucide:trash-2','Eliminar ticket',()=>setModal({type:'ticket-delete',ticket:modal.ticket}),'danger'])
    return <ActionSheet title={modal.ticket.ticket_key} subtitle={modal.ticket.title} onClose={close} actions={actions}/>
  }
  if(modal.type==='ticket-delete') return <ConfirmModal title={`Eliminar ${modal.ticket.ticket_key}`} message={`¿Deseas eliminar “${modal.ticket.title}”? También se eliminarán comentarios, evidencias e historial asociado.`} danger onClose={close} onConfirm={async()=>{await props.deleteTicket(modal.ticket);close()}}/>
  if(modal.type==='ticket-filters') return <TicketFilterModal filters={props.filters} members={props.members} sprints={props.sprints} onClose={close} onApply={f=>{props.setFilters(f);close()}}/>
  if(modal.type==='ticket-plan') return <PlanTicketModal ticket={modal.ticket} sprints={props.sprints} onClose={close} onSave={async sprintId=>{await props.planTicket(modal.ticket,sprintId);close()}}/>

  if(modal.type==='sprint-create') return <SprintModal title="Nuevo sprint" onClose={close} onSave={async f=>{const {error}=await db.from('sprints').insert({...f,workspace_id:props.workspace.id,created_by:props.session.user.id,start_date:f.start_date||null,end_date:f.end_date||null});if(error)throw error;await props.refresh();props.toast('success','Sprint creado.');close()}}/>
  if(modal.type==='sprint-edit') return <SprintModal title="Editar sprint" initial={modal.sprint} onClose={close} onSave={async f=>{const {error}=await db.from('sprints').update({...f,start_date:f.start_date||null,end_date:f.end_date||null}).eq('id',modal.sprint.id);if(error)throw error;await props.refresh();props.toast('success','Sprint actualizado.');close()}}/>
  if(modal.type==='sprint-detail') return <SprintDetailModal workspace={props.workspace} sprint={modal.sprint} tickets={props.tickets} products={props.products} members={props.members} session={props.session} canWork={props.canWork} canPlan={props.canPlan} onClose={close} onTicket={ticket=>setModal({type:'ticket-detail',ticket})} onEdit={()=>setModal({type:'sprint-edit',sprint:modal.sprint})} onRollover={()=>setModal({type:'sprint-rollover',sprint:modal.sprint})} onRefresh={props.refresh} toast={props.toast}/>
  if(modal.type==='sprint-rollover') return <SprintRolloverModal sprint={modal.sprint} sprints={props.sprints} tickets={props.tickets} onClose={close} onSave={async nextId=>{await props.closeSprintAndRollover(modal.sprint,nextId);close()}}/>
  if(modal.type==='sprint-delete') return <ConfirmModal title="Eliminar sprint" message="Los tickets del sprint quedarán sin sprint. Para conservar el flujo recomendado usa “Cerrar / trasladar” desde Backlog." danger onClose={close} onConfirm={async()=>{const {error}=await db.from('sprints').delete().eq('id',modal.sprint.id);if(error)throw error;await props.refresh();props.toast('success','Sprint eliminado.');close()}}/>

  if(modal.type==='help-create') return <HelpdeskModal title="Nueva solicitud de Helpdesk" departments={props.departments} members={props.members} session={props.session} canWork={props.canManageHelpdesk} onClose={close} onSave={async f=>{await props.saveHelpdesk(f);close()}}/>
  if(modal.type==='help-edit') return <HelpdeskModal title={`Editar ${modal.item.ticket_key}`} item={modal.item} departments={props.departments} members={props.members} session={props.session} canWork={props.canManageHelpdesk} onClose={close} onSave={async f=>{await props.saveHelpdesk(f,modal.item);close()}}/>
  if(modal.type==='help-detail') return <HelpdeskDetailModal item={modal.item} departments={props.departments} members={props.members} session={props.session} canWork={props.canManageHelpdesk} canManage={props.canPlan} onClose={close} onEdit={()=>setModal({type:'help-edit',item:modal.item})} onDecision={()=>setModal({type:'help-requirement-decision',item:modal.item})} onRefresh={props.refresh} toast={props.toast}/>
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
  if(modal.type==='help-filters') return <HelpFilterModal filters={props.helpFilters} departments={props.departments} members={props.members} onClose={close} onApply={f=>{props.setHelpFilters(f);close()}}/>

  if(modal.type==='invite') return <InviteModal workspace={props.workspace} products={props.products} roleTemplates={props.roleTemplates} isSuperadmin={props.isSuperadmin} onClose={close} onSaved={async result=>{await props.loadMemberships(props.workspace.id);await props.refresh();if(result?.temporary_password){setModal({type:'temporary-credentials',credentials:result});return}props.toast('success',result?.invitation_sent?'Invitación enviada y accesos configurados.':'Usuario y accesos configurados.');close()}}/>
  if(modal.type==='temporary-credentials') return <TemporaryCredentialsModal credentials={modal.credentials} onClose={close}/>
  if(modal.type==='member-edit') return <MemberModal workspace={props.workspace} member={{...modal.member,product_ids:props.memberProductAccess.filter(x=>x.user_id===modal.member.user_id).map(x=>x.product_id)}} products={props.products} roleTemplates={props.roleTemplates} session={props.session} isSuperadmin={props.isSuperadmin} onClose={close} onRemove={()=>setModal({type:'member-remove',member:modal.member})} onSave={async f=>{const selected=props.roleTemplates.find(r=>r.id===f.role_id);if(!selected)throw new Error('Selecciona un rol válido.');const allProducts=selected.code==='superadmin'?true:!!f.all_products;const permissions=selected.code==='superadmin'?{}:f.permissions;const {error}=await db.from('workspace_members').update({role_id:f.role_id,role:selected.base_role,active:f.active,all_products:allProducts,permissions}).eq('workspace_id',props.workspace.id).eq('user_id',modal.member.user_id);if(error)throw error;const del=await db.from('workspace_member_products').delete().eq('workspace_id',props.workspace.id).eq('user_id',modal.member.user_id);if(del.error)throw del.error;if(!allProducts&&f.product_ids.length){const ins=await db.from('workspace_member_products').insert(f.product_ids.map(product_id=>({workspace_id:props.workspace.id,user_id:modal.member.user_id,product_id})));if(ins.error)throw ins.error}await props.loadMemberships(props.workspace.id);await props.refresh();props.toast('success','Rol, permisos y productos actualizados.');close()}}/>
  if(modal.type==='member-remove') return <ConfirmModal title="Retirar colaborador" message={`¿Deseas retirar a ${modal.member.profile?.full_name||'este colaborador'} de ${props.workspace.name}? Perderá acceso a este workspace, pero sus tickets e historial se conservarán.`} danger onClose={close} onConfirm={async()=>{if(modal.member.user_id===props.session.user.id)throw new Error('No puedes retirarte a ti mismo desde esta pantalla.');const {error}=await db.from('workspace_members').delete().eq('workspace_id',props.workspace.id).eq('user_id',modal.member.user_id);if(error)throw error;await props.loadMemberships(props.workspace.id);await props.refresh();props.toast('success','Colaborador retirado del workspace.');close()}}/>
  if(modal.type==='role-create') return <RoleModal workspace={props.workspace} roleTemplates={props.roleTemplates} onClose={close} onSave={async f=>{const {error}=await db.from('workspace_roles').insert({...f,workspace_id:props.workspace.id,is_system:false,protected:false});if(error)throw error;await props.refresh();props.toast('success','Rol creado.');close()}}/>
  if(modal.type==='role-edit') return <RoleModal workspace={props.workspace} initial={modal.role} roleTemplates={props.roleTemplates} onClose={close} onSave={async f=>{const {error}=await db.from('workspace_roles').update(f).eq('id',modal.role.id);if(error)throw error;await props.refresh();props.toast('success','Rol actualizado.');close()}}/>
  if(modal.type==='role-delete') return <ConfirmModal title={`Eliminar rol ${modal.role.name}`} message="Solo se puede eliminar un rol si no está asignado a ningún colaborador. Los roles Superadmin están protegidos." danger onClose={close} onConfirm={async()=>{const {error}=await db.from('workspace_roles').delete().eq('id',modal.role.id);if(error)throw error;await props.refresh();props.toast('success','Rol eliminado.');close()}}/>

  if(modal.type==='product-create') return <ProductModal title="Nuevo producto" onClose={close} onSave={async f=>{const {error}=await db.from('products').insert({...f,workspace_id:props.workspace.id,board_order:props.products.length+1});if(error)throw error;await props.refresh();props.toast('success','Producto creado.');close()}}/>
  if(modal.type==='product-edit') return <ProductModal title="Editar producto" initial={modal.product} onClose={close} onSave={async f=>{const {error}=await db.from('products').update(f).eq('id',modal.product.id);if(error)throw error;await props.refresh();props.toast('success','Producto actualizado.');close()}}/>
  if(modal.type==='product-delete') return <ConfirmModal title="Eliminar producto" message="No podrás eliminar un producto si tiene tickets asociados. Reasigna o elimina esos tickets primero." danger onClose={close} onConfirm={async()=>{const {error}=await db.from('products').delete().eq('id',modal.product.id);if(error)throw error;await props.refresh();props.toast('success','Producto eliminado.');close()}}/>

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

function TicketModal({title,ticket,products,sprints,members,reporterMode=false,onClose,onSave}){
  const [f,setF]=useState({
    product_id:ticket?.product_id||products[0]?.id||'',sprint_id:ticket?.sprint_id||'',title:ticket?.title||'',description:ticket?.description||'',type:ticket?.type||'task',priority:ticket?.priority||'medium',status:ticket?.status||'backlog',dev_owner_id:ticket?.dev_owner_id||'',qa_owner_id:ticket?.qa_owner_id||'',story_points:ticket?.story_points??'',start_date:ticket?.start_date||'',due_date:ticket?.due_date||''
  })
  const set=(k,v)=>setF(x=>({...x,[k]:v}))
  const memberHasProduct=m=>m.role==='superadmin'||m.role==='admin'||m.all_products||m.product_ids?.includes(f.product_id)
  const devs=members.filter(m=>m.active&&effectivePermissions(m,m.role_template).edit_tickets&&memberHasProduct(m))
  const qas=members.filter(m=>m.active&&effectivePermissions(m,m.role_template).qa_review&&memberHasProduct(m))
  return <Modal title={title} subtitle={reporterMode?'Envía una solicitud al Backlog. El equipo definirá sprint, responsables y fechas.':'Define alcance, prioridad, responsables y ciclo de entrega.'} onClose={onClose} size="lg"><AsyncForm onSubmit={()=>onSave(f)} submitLabel={ticket?'Guardar cambios':reporterMode?'Enviar al Backlog':'Crear ticket'}>
    <div className="form-section"><h4>Información principal</h4><label>Título<input value={f.title} onChange={e=>set('title',e.target.value)} required placeholder="Describe el trabajo en una frase"/></label><label>Descripción<textarea rows="5" value={f.description} onChange={e=>set('description',e.target.value)} placeholder="Contexto, criterios de aceptación, pasos para reproducir…"/></label></div>
    <div className="form-section"><h4>{reporterMode?'Clasificación':'Planeación'}</h4><div className="form-grid">
      <label>Producto<select value={f.product_id} onChange={e=>set('product_id',e.target.value)} required>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label>Tipo<select value={f.type} onChange={e=>set('type',e.target.value)}>{TYPES.map(x=><option key={x} value={x}>{TYPE_LABELS[x]}</option>)}</select></label>
      <label>Prioridad<select value={f.priority} onChange={e=>set('priority',e.target.value)}>{PRIORITIES.map(x=><option key={x} value={x}>{PRIORITY_LABELS[x]}</option>)}</select></label>
      {!reporterMode&&<><label>Sprint<select value={f.sprint_id} onChange={e=>set('sprint_id',e.target.value)}><option value="">Sin sprint / Backlog</option>{sprints.filter(s=>s.status!=='completed'||s.id===ticket?.sprint_id).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Estado<select value={f.status} onChange={e=>set('status',e.target.value)}>{STATUS.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label><label>Story points<input type="number" min="0" step="0.5" value={f.story_points} onChange={e=>set('story_points',e.target.value)}/></label><label>Responsable Dev<select value={f.dev_owner_id} onChange={e=>set('dev_owner_id',e.target.value)}><option value="">Sin asignar</option>{devs.map(m=><option key={m.user_id} value={m.user_id}>{m.profile?.full_name||m.user_id.slice(0,8)}</option>)}</select></label><label>Responsable QA<select value={f.qa_owner_id} onChange={e=>set('qa_owner_id',e.target.value)}><option value="">Sin asignar</option>{qas.map(m=><option key={m.user_id} value={m.user_id}>{m.profile?.full_name||m.user_id.slice(0,8)}</option>)}</select></label><label>Fecha de inicio<input type="date" value={f.start_date} onChange={e=>set('start_date',e.target.value)}/></label><label>Fecha de entrega<input type="date" min={f.start_date||undefined} value={f.due_date} onChange={e=>set('due_date',e.target.value)}/></label></>}
    </div>{reporterMode&&<div className="notice"><Icon name="lucide:inbox"/><span>El ticket se creará en <b>Backlog</b>, sin responsables, sprint ni fechas de planificación.</span></div>}</div>
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

function TicketDetailModal({workspace,ticket,products,members,session,canWork,canManage,onClose,onEdit,onPlan,onRefresh,toast}){
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
  const unlinked=attachments.filter(a=>!a.comment_id)
  return <><Modal title={`${ticket.ticket_key} · ${ticket.title}`} subtitle={product?.name} onClose={onClose} size="xl"><div className="detail-grid"><div className="detail-main">
    <div className="detail-description"><h4>Descripción</h4><p>{ticket.description||'Sin descripción.'}</p></div>
    <div className="detail-tabs"><button type="button" className={tab==='comments'?'active':''} onClick={()=>setTab('comments')}>Revisión y evidencias <em>{comments.length+attachments.length}</em></button><button type="button" className={tab==='activity'?'active':''} onClick={()=>setTab('activity')}>Actividad <em>{activity.length}</em></button></div>
    {tab==='comments'?<><div className="comment-list">{comments.length===0&&unlinked.length===0&&<p className="muted">Todavía no hay comentarios ni evidencias.</p>}{comments.map(c=>{const author=members.find(m=>m.user_id===c.author_id)?.profile?.full_name||'Usuario',own=c.author_id===session.user.id,files=attachments.filter(a=>a.comment_id===c.id);return <div className={`comment evidence-comment kind-${c.kind||'comment'}`} key={c.id}><span className="mini-avatar">{initials(author)}</span><div className="comment-body"><div className="comment-head"><div><div className="comment-kind-row"><b>{author}</b><EvidenceKind kind={c.kind}/></div><small>{formatDateTime(c.created_at)}</small></div>{(own||canManage)&&<button type="button" className="icon-button" onClick={()=>setCommentModal({type:'actions',comment:c,own})}><Icon name="lucide:ellipsis" size={16}/></button>}</div><p>{c.body}</p><EvidenceGallery rows={files} session={session} canManage={canManage} onDelete={row=>setCommentModal({type:'delete-evidence',row})}/></div></div>})}{unlinked.length>0&&<div className="standalone-evidence"><h4>Evidencias conservadas</h4><EvidenceGallery rows={unlinked} session={session} canManage={canManage} onDelete={row=>setCommentModal({type:'delete-evidence',row})}/></div>}</div>{canWork?<div className="comment-create-row"><button type="button" className="primary compact" onClick={()=>setCommentModal({type:'create'})}><Icon name="lucide:image-plus"/> Agregar revisión / evidencia</button></div>:<div className="notice"><Icon name="lucide:eye"/> Tu rol tiene acceso de solo lectura a la revisión del ticket.</div>}</>:<div className="activity-list">{activity.map(a=><div className="activity-item" key={a.id}><span className="activity-dot"></span><div><b>{a.action==='created'?'Ticket creado':'Cambio de '+a.action.replaceAll('_',' ')}</b><p>{a.from_value&&`${a.from_value} → `}{a.to_value}</p><small>{formatDateTime(a.created_at)}</small></div></div>)}</div>}
  </div><aside className="detail-aside">{canWork&&<button type="button" className="primary full" onClick={onEdit}><Icon name="lucide:pencil"/> Editar ticket</button>}{canManage&&<button type="button" className="secondary-button full" onClick={onPlan}><Icon name="lucide:calendar-plus"/> Planificar sprint</button>}<DetailRow label="Estado"><StatusBadge status={ticket.status}/></DetailRow><DetailRow label="Prioridad"><span className={`priority-badge priority-${ticket.priority}`}>{PRIORITY_LABELS[ticket.priority]}</span></DetailRow><DetailRow label="Dev">{dev}</DetailRow><DetailRow label="QA">{qa}</DetailRow><DetailRow label="Story points">{ticket.story_points??'—'}</DetailRow><DetailRow label="Inicio">{formatDate(ticket.start_date)}</DetailRow><DetailRow label="Entrega">{formatDate(ticket.due_date)}</DetailRow><DetailRow label="Actualizado">{formatDateTime(ticket.updated_at)}</DetailRow></aside></div></Modal>
    {commentModal?.type==='create'&&<EvidenceCommentModal title="Agregar revisión / evidencia" initial={{body:'',kind:'comment'}} allowFiles onClose={()=>setCommentModal(null)} onSave={async data=>{await addComment(data);setCommentModal(null)}}/>}
    {commentModal?.type==='actions'&&<ActionSheet title="Comentario" subtitle="Selecciona una acción" onClose={()=>setCommentModal(null)} actions={[...(commentModal.own?[['lucide:pencil','Editar comentario',()=>setCommentModal({type:'edit',comment:commentModal.comment})]]:[]),['lucide:trash-2','Eliminar comentario',()=>setCommentModal({type:'delete',comment:commentModal.comment}),'danger']]}/>} 
    {commentModal?.type==='edit'&&<EvidenceCommentModal title="Editar comentario" initial={{body:commentModal.comment.body,kind:commentModal.comment.kind||'comment'}} onClose={()=>setCommentModal(null)} onSave={async data=>{await editComment(commentModal.comment,data);setCommentModal(null)}}/>}
    {commentModal?.type==='delete'&&<ConfirmModal title="Eliminar comentario" message="El texto se eliminará. Las imágenes de evidencia se conservarán en el historial del ticket." danger onClose={()=>setCommentModal(null)} onConfirm={async()=>{await deleteComment(commentModal.comment);setCommentModal(null)}}/>}
    {commentModal?.type==='delete-evidence'&&<ConfirmModal title="Eliminar evidencia" message={`Se eliminará “${commentModal.row.file_name}” de forma permanente.`} danger onClose={()=>setCommentModal(null)} onConfirm={async()=>{await deleteEvidence(commentModal.row);setCommentModal(null)}}/>}
  </>
}

function DetailRow({label,children}){return <div className="detail-row"><span>{label}</span><div>{children}</div></div>}

function TicketFilterModal({filters,members,sprints,onClose,onApply}){const [f,setF]=useState({...filters});return <Modal title="Filtros de tickets" subtitle="Combina criterios para encontrar exactamente lo que necesitas." onClose={onClose}><AsyncForm onSubmit={()=>onApply(f)} submitLabel="Aplicar filtros"><div className="form-grid"><label>Estado<select value={f.status} onChange={e=>setF({...f,status:e.target.value})}><option value="all">Todos</option>{STATUS.map(([k,l])=><option value={k} key={k}>{l}</option>)}</select></label><label>Responsable<select value={f.assignee} onChange={e=>setF({...f,assignee:e.target.value})}><option value="all">Todos</option>{members.map(m=><option value={m.user_id} key={m.user_id}>{m.profile?.full_name||'Usuario'}</option>)}</select></label><label>Sprint<select value={f.sprint} onChange={e=>setF({...f,sprint:e.target.value})}><option value="all">Todos</option>{sprints.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label><label>Prioridad<select value={f.priority} onChange={e=>setF({...f,priority:e.target.value})}><option value="all">Todas</option>{PRIORITIES.map(p=><option value={p} key={p}>{PRIORITY_LABELS[p]}</option>)}</select></label><label>Tipo<select value={f.type} onChange={e=>setF({...f,type:e.target.value})}><option value="all">Todos</option>{TYPES.map(t=><option value={t} key={t}>{TYPE_LABELS[t]}</option>)}</select></label></div><div className="modal-secondary"><button type="button" className="text-button" onClick={()=>setF({status:'all',assignee:'all',sprint:'all',priority:'all',type:'all'})}>Restablecer</button><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div></AsyncForm></Modal>}

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

function HelpdeskModal({title,item,departments,members,session,canWork,onClose,onSave}){
  const [f,setF]=useState({department_id:item?.department_id||departments.find(d=>d.active)?.id||'',subject:item?.subject||'',description:item?.description||'',requester_name:item?.requester_name||session.user.user_metadata?.full_name||'',requester_email:item?.requester_email||session.user.email||'',category:item?.category||'general',priority:item?.priority||'medium',status:item?.status||'created',assigned_to:item?.assigned_to||'',source:item?.source||(canWork?'internal':'portal'),due_at:toLocalDateTimeInput(item?.due_at)})
  const activeDepartments=departments.filter(d=>d.active||d.id===item?.department_id)
  const assignees=members.filter(m=>m.active&&effectivePermissions(m,m.role_template).manage_helpdesk)
  const isRequirement=isProposalCategory(f.category)
  const categoryOptions=['access','incident','module','feature','new_requirement','data','configuration','general']
  return <Modal title={title} subtitle={canWork?'Registra una solicitud operativa o un nuevo requerimiento.':'Solicita accesos, reporta errores o propone mejoras sin entrar a los tableros de desarrollo.'} onClose={onClose} size="lg"><AsyncForm onSubmit={()=>onSave({...f,source:canWork?f.source:'portal',status:isRequirement?'created':f.status,assigned_to:isRequirement?'':f.assigned_to,due_at:isRequirement?'':f.due_at})} submitLabel={item?'Guardar cambios':'Crear solicitud'}>
    <div className="form-section"><h4>Solicitud</h4><label>Asunto<input value={f.subject} onChange={e=>setF({...f,subject:e.target.value})} required placeholder="¿Qué necesitas o qué quieres proponer?"/></label><label>Descripción<textarea rows="5" value={f.description} onChange={e=>setF({...f,description:e.target.value})} required placeholder="Contexto, impacto, pasos, evidencia y resultado esperado…"/></label><div className="form-grid"><label>Departamento solicitante<select value={f.department_id} onChange={e=>setF({...f,department_id:e.target.value})} required><option value="" disabled>Selecciona un departamento</option>{activeDepartments.map(d=><option value={d.id} key={d.id}>{d.name}</option>)}</select></label><label>Tipo de solicitud<select value={f.category} onChange={e=>setF({...f,category:e.target.value})} disabled={!!item}>{categoryOptions.map(k=><option value={k} key={k}>{helpCategoryLabel(k)}</option>)}</select></label><label>Prioridad<select value={f.priority} onChange={e=>setF({...f,priority:e.target.value})}>{PRIORITIES.map(p=><option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}</select></label>{canWork&&<label>Origen<select value={f.source} onChange={e=>setF({...f,source:e.target.value})}><option value="internal">Interno</option><option value="portal">Portal</option><option value="email">Correo</option><option value="phone">Teléfono</option><option value="whatsapp">WhatsApp</option></select></label>}</div></div>
    <div className="form-section"><h4>Solicitante</h4><div className="form-grid"><label>Solicitante<input value={f.requester_name} onChange={e=>setF({...f,requester_name:e.target.value})}/></label><label>Correo<input type="email" value={f.requester_email} onChange={e=>setF({...f,requester_email:e.target.value})}/></label></div></div>
    {isRequirement?<div className="requirement-notice"><Icon name="lucide:lightbulb"/><span><b>Nuevo requerimiento · sin SLA operativo.</b><small>Se registra como propuesta. PM/Admin/Superadmin decidirá si pasa a Backlog de un producto o si se devuelve como sugerencia rechazada.</small></span></div>:canWork?<div className="form-section internal-section"><h4>Atención interna</h4><div className="form-grid"><label>Asignado a<select value={f.assigned_to} onChange={e=>setF({...f,assigned_to:e.target.value})}><option value="">Sin asignar</option>{assignees.map(m=><option value={m.user_id} key={m.user_id}>{m.profile?.full_name||'Usuario'}</option>)}</select></label><label>Estado<select value={f.status} onChange={e=>setF({...f,status:e.target.value})}>{HELP_STATUS.map(([k,l])=><option value={k} key={k}>{l}</option>)}</select></label><label>Fecha objetivo<input type="datetime-local" value={f.due_at} onChange={e=>setF({...f,due_at:e.target.value})}/></label></div></div>:<div className="notice"><Icon name="lucide:shield-check"/><span>La solicitud seguirá <b>Creado → En revisión → Atendido → Resuelto → Cerrado</b>. Solo la mesa de atención administra responsable y SLA.</span></div>}
    <div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div>
  </AsyncForm></Modal>
}
function HelpdeskDetailModal({item,departments,members,session,canWork,canManage,onClose,onEdit,onDecision,onRefresh,toast}){
  const [comments,setComments]=useState([]),[activity,setActivity]=useState([]),[tab,setTab]=useState('comments'),[commentModal,setCommentModal]=useState(null)
  const requirement=isProposalCategory(item.category)
  const load=async()=>{const [c,a]=await Promise.all([db.from('helpdesk_comments').select('*').eq('helpdesk_ticket_id',item.id).order('created_at'),db.from('helpdesk_activity').select('*').eq('helpdesk_ticket_id',item.id).order('created_at',{ascending:false})]);if(c.error)toast('error',c.error.message);else setComments(c.data||[]);if(a.error)toast('error',a.error.message);else setActivity(a.data||[])}
  useEffect(()=>{load()},[item.id])
  const addComment=async text=>{const body=String(text||'').trim();if(!body)throw new Error('Escribe un comentario.');const {error}=await db.from('helpdesk_comments').insert({helpdesk_ticket_id:item.id,author_id:session.user.id,body});if(error)throw error;await load();toast('success','Comentario agregado.')}
  const editComment=async(comment,text)=>{const {error}=await db.from('helpdesk_comments').update({body:String(text||'').trim()}).eq('id',comment.id);if(error)throw error;await load();toast('success','Comentario actualizado.')}
  const deleteComment=async comment=>{const {error}=await db.from('helpdesk_comments').delete().eq('id',comment.id);if(error)throw error;await load();toast('success','Comentario eliminado.')}
  const dep=departments.find(d=>d.id===item.department_id),owner=members.find(m=>m.user_id===item.assigned_to)?.profile?.full_name||'Sin asignar'
  const mayEdit=canWork&&!requirement
  const order=['created','review','attended','resolved','closed'],current=Math.max(0,order.indexOf(item.status))
  const activityTitle=a=>a.action==='created'?'Solicitud creada':a.action==='status_changed'?'Cambio de estado':a.action==='assigned'?'Asignación':a.action==='requirement_decision'?'Decisión del requerimiento':'Actividad'
  return <><Modal title={`${item.ticket_key} · ${item.subject}`} subtitle={`${dep?.name||'Helpdesk'} · ${helpCategoryLabel(item.category)}`} onClose={onClose} size="xl"><div className="detail-grid"><div className="detail-main">
    {requirement?<div className="requirement-detail-hero"><div><span className="eyebrow">NUEVO REQUERIMIENTO</span><h3>{requirementStatusLabel(item.proposal_status)}</h3><p>{item.proposal_status==='pending'?'Pendiente de evaluación por PM/Admin/Superadmin.':item.proposal_status==='accepted_backlog'?`Aceptado para desarrollo futuro${item.converted_ticket_key?` como ${item.converted_ticket_key}`:''}.`:'La sugerencia fue descartada y devuelta al solicitante.'}</p></div><RequirementBadge status={item.proposal_status}/>{item.decision_note&&<div className="decision-note"><b>Nota de decisión</b><p>{item.decision_note}</p></div>}</div>:<div className="helpdesk-detail-progress"><div className="request-stepper">{order.map((st,i)=><div key={st} className={`${i<current?'done':''} ${i===current?'current':''}`}><i>{i<current?<Icon name="lucide:check" size={12}/>:i+1}</i><span>{helpStatusLabel(st)}</span></div>)}</div></div>}
    <div className="detail-description"><h4>Descripción de la solicitud</h4><p>{item.description||'Sin descripción.'}</p></div>
    <div className="detail-tabs"><button type="button" className={tab==='comments'?'active':''} onClick={()=>setTab('comments')}>Comentarios <em>{comments.length}</em></button><button type="button" className={tab==='activity'?'active':''} onClick={()=>setTab('activity')}>Seguimiento <em>{activity.length}</em></button></div>
    {tab==='comments'?<><div className="comment-list">{comments.length===0&&<p className="muted">Todavía no hay comentarios.</p>}{comments.map(c=>{const author=members.find(m=>m.user_id===c.author_id)?.profile?.full_name||(c.author_id===session.user.id?session.user.user_metadata?.full_name||'Tú':'Usuario'),own=c.author_id===session.user.id;return <div className="comment" key={c.id}><span className="mini-avatar">{initials(author)}</span><div className="comment-body"><div className="comment-head"><div><b>{author}</b><small>{formatDateTime(c.created_at)}</small></div>{own&&<button type="button" className="icon-button" onClick={()=>setCommentModal({type:'actions',comment:c})}><Icon name="lucide:ellipsis" size={16}/></button>}</div><p>{c.body}</p></div></div>})}</div><div className="comment-create-row"><button type="button" className="primary compact" onClick={()=>setCommentModal({type:'create'})}><Icon name="lucide:message-square-plus"/> Agregar comentario</button></div></>:<div className="activity-list">{activity.length===0&&<p className="muted">Sin movimientos registrados.</p>}{activity.map(a=><div className="activity-item" key={a.id}><span className="activity-dot"></span><div><b>{activityTitle(a)}</b><p>{a.action==='status_changed'?`${helpStatusLabel(a.from_value)} → ${helpStatusLabel(a.to_value)}`:a.action==='requirement_decision'?(a.to_value?.startsWith('accepted_backlog')?'Aceptado a Backlog':'Sugerencia rechazada'):a.to_value}</p><small>{formatDateTime(a.created_at)}</small></div></div>)}</div>}
  </div><aside className="detail-aside">{mayEdit&&<button type="button" className="primary full" onClick={onEdit}><Icon name="lucide:pencil"/> Editar solicitud</button>}{requirement&&canManage&&(item.proposal_status||'pending')==='pending'&&<button type="button" className="primary full" onClick={onDecision}><Icon name="lucide:gavel"/> Evaluar requerimiento</button>}<DetailRow label={requirement?'Decisión':'Estado'}>{requirement?<RequirementBadge status={item.proposal_status}/>:<HelpStatusBadge status={item.status}/>}</DetailRow><DetailRow label="Tipo">{helpCategoryLabel(item.category)}</DetailRow><DetailRow label="Prioridad"><span className={`priority-badge priority-${item.priority}`}>{PRIORITY_LABELS[item.priority]}</span></DetailRow><DetailRow label="Departamento">{dep?.name||'—'}</DetailRow>{!requirement&&<DetailRow label="Asignado">{owner}</DetailRow>}<DetailRow label="Solicitante">{item.requester_name||'—'}</DetailRow><DetailRow label="Correo">{item.requester_email||'—'}</DetailRow><DetailRow label="Creado">{formatDateTime(item.created_at)}</DetailRow>{requirement?<><DetailRow label="Decisión">{formatDateTime(item.decision_at)}</DetailRow>{item.converted_ticket_key&&<DetailRow label="Ticket Backlog"><b>{item.converted_ticket_key}</b></DetailRow>}</>:<><DetailRow label="En revisión">{formatDateTime(item.reviewed_at)}</DetailRow><DetailRow label="Atendido">{formatDateTime(item.attended_at)}</DetailRow><DetailRow label="Objetivo SLA">{formatDateTime(item.due_at)}</DetailRow><DetailRow label="Resuelto">{formatDateTime(item.resolved_at)}</DetailRow><DetailRow label="Cerrado">{formatDateTime(item.closed_at)}</DetailRow></>}</aside></div></Modal>
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

function HelpFilterModal({filters,departments,members,onClose,onApply}){const [f,setF]=useState({...filters});return <Modal title="Filtros de Helpdesk" onClose={onClose}><AsyncForm onSubmit={()=>onApply(f)} submitLabel="Aplicar filtros"><div className="form-grid"><label>Estado<select value={f.status} onChange={e=>setF({...f,status:e.target.value})}><option value="all">Todos</option>{HELP_STATUS.map(([k,l])=><option value={k} key={k}>{l}</option>)}</select></label><label>Área<select value={f.department} onChange={e=>setF({...f,department:e.target.value})}><option value="all">Todas</option>{departments.map(d=><option value={d.id} key={d.id}>{d.name}</option>)}</select></label><label>Asignado<select value={f.assignee} onChange={e=>setF({...f,assignee:e.target.value})}><option value="all">Todos</option>{members.map(m=><option value={m.user_id} key={m.user_id}>{m.profile?.full_name||'Usuario'}</option>)}</select></label><label>Prioridad<select value={f.priority} onChange={e=>setF({...f,priority:e.target.value})}><option value="all">Todas</option>{PRIORITIES.map(p=><option value={p} key={p}>{PRIORITY_LABELS[p]}</option>)}</select></label></div><div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div></AsyncForm></Modal>}

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
  const [email,setEmail]=useState(''),[name,setName]=useState(''),[roleId,setRoleId]=useState(defaultTeamRole?.id||'')
  const [allProducts,setAllProducts]=useState(true),[productIds,setProductIds]=useState(products.map(p=>p.id)),[permissions,setPermissions]=useState({})
  const selectedRole=accessMode==='portal'&&portalRole?portalRole:available.find(r=>r.id===roleId)||defaultTeamRole
  const needsProducts=roleNeedsProducts(selectedRole,permissions)
  const changeMode=mode=>{setAccessMode(mode);setPermissions({});if(mode==='portal'&&portalRole){setRoleId(portalRole.id);setAllProducts(false);setProductIds([])}else{setRoleId(defaultTeamRole?.id||'');setAllProducts(true);setProductIds(products.map(p=>p.id))}}
  const changeRole=value=>{setRoleId(value);setPermissions({});const next=available.find(r=>r.id===value);if(next?.code==='superadmin')setAllProducts(true)}
  return <Modal title="Agregar Staff" subtitle="Elige si colaborará en productos o únicamente utilizará el Portal Helpdesk." onClose={onClose} size="lg"><AsyncForm onSubmit={async()=>{if(!selectedRole)throw new Error('Selecciona un rol.');if(needsProducts&&!allProducts&&selectedRole.code!=='superadmin'&&!productIds.length)throw new Error('Selecciona al menos un producto o habilita Todos.');const finalAll=needsProducts?(selectedRole.code==='superadmin'?true:allProducts):false;const finalProducts=needsProducts?productIds:[];const {data,error}=await db.functions.invoke('invite-member',{body:{email,full_name:name.trim()||null,role_id:selectedRole.id,role:selectedRole.code,workspace_id:workspace.id,redirect_to:getAppUrl(),all_products:finalAll,product_ids:finalProducts,permissions:accessMode==='portal'?{}:permissions}});if(error||data?.error)throw new Error(await functionErrorMessage(error,data));await onSaved({...data,email})}} submitLabel="Crear / invitar usuario">
    <WorkspaceAccessSummary workspace={workspace}/>
    {portalRole&&<div className="form-section"><h4>Tipo de acceso</h4><div className="staff-access-mode"><button type="button" className={accessMode==='team'?'active':''} onClick={()=>changeMode('team')}><Icon name="lucide:panels-top-left"/><span><b>Equipo de producto</b><small>Tableros, tickets, QA, sprints o administración según rol.</small></span></button><button type="button" className={accessMode==='portal'?'active portal':''} onClick={()=>changeMode('portal')}><Icon name="lucide:life-buoy"/><span><b>Portal administrativo Helpdesk</b><small>Solo crea y consulta sus solicitudes. Sin productos ni tableros.</small></span></button></div></div>}
    <div className="form-section"><h4>Colaborador</h4><div className="form-grid"><label>Nombre <span className="optional">Opcional</span><input value={name} onChange={e=>setName(e.target.value)} placeholder="Nombre y apellido"/></label><label>Correo<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="colaborador@trobbu.com"/></label>{accessMode==='team'&&<label>Rol<select value={roleId} onChange={e=>changeRole(e.target.value)} required>{available.filter(r=>r.code!=='helpdesk_requester').map(r=><option value={r.id} key={r.id}>{r.name}</option>)}</select><small className="field-help">{selectedRole?.description||ROLE_DESCRIPTIONS[selectedRole?.base_role]}</small></label>}</div></div>
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
  return <Modal title="Usuario creado" subtitle="Supabase no pudo enviar la invitación por correo, así que se creó un acceso temporal." onClose={onClose} size="sm"><div className="credential-card"><span><small>Correo</small><b>{credentials.email}</b></span><span><small>Contraseña temporal</small><code>{credentials.temporary_password}</code></span><div className="notice"><Icon name="lucide:shield-alert"/><span>Comparte esta contraseña de forma segura y pide al colaborador cambiarla después de iniciar sesión.</span></div></div><div className="form-footer static-footer"><div className="form-footer-left"><button type="button" className="secondary-button" onClick={onClose}>Cerrar</button></div><div className="modal-actions"><button type="button" className="primary" onClick={copy}><Icon name={copied?'lucide:check':'lucide:copy'}/>{copied?'Copiado':'Copiar credenciales'}</button></div></div></Modal>
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

function DepartmentModal({title,initial,onClose,onSave}){const [f,setF]=useState({name:initial?.name||'',color:initial?.color||'#0D47A1',active:initial?.active??true});return <Modal title={title} subtitle="Configura cómo se clasifica el origen de las solicitudes de Helpdesk." onClose={onClose}><AsyncForm onSubmit={()=>onSave(f)} submitLabel="Guardar área"><label>Nombre del área<input value={f.name} onChange={e=>setF({...f,name:e.target.value})} required placeholder="Ej. Recursos Humanos"/></label><label>Color<input type="color" value={f.color||'#0D47A1'} onChange={e=>setF({...f,color:e.target.value})}/></label><Toggle label="Área activa" checked={!!f.active} onChange={v=>setF({...f,active:v})}/><div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div></AsyncForm></Modal>}

function CommentEditModal({title,initial,onClose,onSave}){const [body,setBody]=useState(initial||'');return <Modal title={title} subtitle="Actualiza el contenido sin perder el contexto del ticket." onClose={onClose} size="sm"><AsyncForm onSubmit={()=>onSave(body)} submitLabel="Guardar comentario"><label>Comentario<textarea rows="5" value={body} onChange={e=>setBody(e.target.value)} required/></label><div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div></AsyncForm></Modal>}

function QuickHelpModal({helpdeskEnabled,canOpenSettings,onClose,onHelpdesk,onSettings}){return <Modal title="Centro de ayuda" subtitle="Accesos rápidos y guía del Jira Interno TROBBU." onClose={onClose}><div className="help-grid">{helpdeskEnabled?<button type="button" onClick={onHelpdesk}><span><Icon name="lucide:life-buoy"/></span><div><b>Abrir Helpdesk</b><p>Registra o atiende solicitudes internas de otras áreas.</p></div><Icon name="lucide:chevron-right"/></button>:canOpenSettings?<button type="button" onClick={onSettings}><span><Icon name="lucide:life-buoy"/></span><div><b>Helpdesk deshabilitado</b><p>Actívalo desde Configuración para recibir solicitudes internas.</p></div><Icon name="lucide:settings"/></button>:<div className="shortcut-card"><span><Icon name="lucide:life-buoy"/></span><div><b>Helpdesk deshabilitado</b><p>Solicita a un administrador que habilite el módulo.</p></div></div>}{canOpenSettings&&<button type="button" onClick={onSettings}><span><Icon name="lucide:settings"/></span><div><b>Configuración</b><p>Administra workspace, productos y notificaciones.</p></div><Icon name="lucide:chevron-right"/></button>}<div className="shortcut-card"><span><Icon name="lucide:keyboard"/></span><div><b>Atajo de búsqueda</b><p>Usa <kbd>⌘ K</kbd> o <kbd>Ctrl K</kbd> para enfocar el buscador global.</p></div></div></div></Modal>}

ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>)
