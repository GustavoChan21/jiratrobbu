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
const PRIORITIES = ['lowest','low','medium','high','highest','blocker']
const PRIORITY_LABELS = {lowest:'Muy baja',low:'Baja',medium:'Media',high:'Alta',highest:'Muy alta',blocker:'Bloqueante'}
const TYPES = ['task','bug','story','improvement']
const TYPE_LABELS = {task:'Tarea',bug:'Bug',story:'Historia',improvement:'Mejora'}
const ROLE_LABELS = {superadmin:'Superadmin',admin:'Administrador',pm:'Gestor / PM',dev:'Desarrollo',qa:'QA',reporter:'Solo carga de tickets',viewer:'Solo dashboards'}
const ROLE_DESCRIPTIONS = {
  superadmin:'Control total del workspace, permisos, configuración y eliminación.',
  admin:'Administra equipo, productos, configuración y operación del workspace.',
  pm:'Gestiona sprints, backlog, tickets y seguimiento de entregas.',
  dev:'Opera tickets de desarrollo, comentarios y evidencias.',
  qa:'Opera revisión QA, rechazo, aprobación y evidencias.',
  reporter:'Puede crear tickets y consultar únicamente los que reportó.',
  viewer:'Puede consultar dashboards, tablero y calendario sin modificar datos.'
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
const roleCanDashboard = role => ['superadmin','admin','pm','dev','qa','viewer'].includes(role)
const roleCanWork = role => ['superadmin','admin','pm','dev','qa'].includes(role)
const roleCanPlan = role => ['superadmin','admin','pm'].includes(role)
const roleCanAdmin = role => ['superadmin','admin'].includes(role)

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
  const [name,setName]=useState('')
  const [msg,setMsg]=useState('')
  const [submitting,setSubmitting]=useState(false)
  const submit=async e=>{
    e.preventDefault(); setSubmitting(true); setMsg('')
    const result=mode==='login'
      ? await db.auth.signInWithPassword({email,password})
      : await db.auth.signUp({email,password,options:{data:{full_name:name},emailRedirectTo:getAppUrl()}})
    setMsg(result.error ? result.error.message : mode==='login' ? 'Acceso correcto.' : 'Cuenta creada. Revisa tu correo para confirmar el acceso.')
    setSubmitting(false)
  }
  return <div className="auth-shell"><div className="auth-card">
    <img src="./logo.svg" className="auth-logo" alt="TROBBU" />
    <span className="eyebrow">JIRA INTERNO</span><h1>{mode==='login'?'Bienvenido de nuevo':'Crea tu cuenta'}</h1>
    <p>Gestión de tickets, sprints, QA, Helpdesk y operación del equipo.</p>
    <form onSubmit={submit} className="form">
      {mode==='signup' && <label>Nombre completo<input value={name} onChange={e=>setName(e.target.value)} required /></label>}
      <label>Correo<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required /></label>
      <label>Contraseña<input type="password" autoComplete={mode==='login'?'current-password':'new-password'} minLength="6" value={password} onChange={e=>setPassword(e.target.value)} required /></label>
      <button type="submit" className="primary full" disabled={submitting}>{submitting?'Procesando…':mode==='login'?'Iniciar sesión':'Crear cuenta'}</button>
    </form>
    <button type="button" className="text-button" onClick={()=>{setMode(mode==='login'?'signup':'login');setMsg('')}}>{mode==='login'?'Crear una cuenta':'Ya tengo cuenta'}</button>
    {msg && <div className="notice">{msg}</div>}
  </div></div>
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
    const {data,error}=await db.from('workspace_members').select('workspace_id,role,active,workspaces(id,name,slug,created_by)').eq('user_id',session.user.id).eq('active',true)
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
    const [p,s,t,m,ws,d,h,n,q]=await Promise.all([
      db.from('products').select('*').eq('workspace_id',workspace.id).order('board_order'),
      db.from('sprints').select('*').eq('workspace_id',workspace.id).order('created_at',{ascending:false}),
      db.from('tickets').select('*').eq('workspace_id',workspace.id).order('updated_at',{ascending:false}),
      db.from('workspace_members').select('user_id,role,active,joined_at').eq('workspace_id',workspace.id).order('joined_at'),
      db.from('workspace_settings').select('*').eq('workspace_id',workspace.id).maybeSingle(),
      db.from('helpdesk_departments').select('*').eq('workspace_id',workspace.id).order('name'),
      db.from('helpdesk_tickets').select('*').eq('workspace_id',workspace.id).order('updated_at',{ascending:false}),
      db.from('notifications').select('*').eq('workspace_id',workspace.id).order('created_at',{ascending:false}).limit(100),
      db.from('notification_outbox').select('id,event_type,status,attempts,last_error,created_at,sent_at,recipient_user_id').eq('workspace_id',workspace.id).order('created_at',{ascending:false}).limit(100)
    ])
    const fail=[p,s,t,m,ws,d,h,n,q].find(x=>x.error)?.error
    if(fail){showToast('error',fail.message);setBusy(false);return}
    const ids=(m.data||[]).map(x=>x.user_id)
    const profileMap={}
    if(ids.length){const pr=await db.from('profiles').select('*').in('id',ids); (pr.data||[]).forEach(x=>profileMap[x.id]=x)}
    setProducts(p.data||[]); setSprints(s.data||[]); setTickets(t.data||[]); setSettings(ws.data||null)
    setDepartments(d.data||[]); setHelpdesk(h.data||[]); setNotifications(n.data||[]); setEmailQueue(q.data||[])
    setMembers((m.data||[]).map(x=>({...x,profile:profileMap[x.user_id]})))
    setBusy(false)
  }

  const myRole=memberships.find(m=>m.workspace_id===workspace?.id)?.role || 'viewer'
  const isSuperadmin=myRole==='superadmin'
  const canAdminWorkspace=roleCanAdmin(myRole)
  const canPlan=roleCanPlan(myRole)
  const canWork=roleCanWork(myRole)
  const canCreateTicket=canWork || myRole==='reporter'
  const canViewDashboard=roleCanDashboard(myRole)
  const dashboardOnly=myRole==='viewer'
  const helpdeskStaff=canWork
  const canManage=canPlan
  const isAdmin=canAdminWorkspace
  const helpdeskEnabled=settings?.helpdesk_enabled!==false
  const workspaces=memberships.map(m=>({...m.workspaces,role:m.role})).filter(Boolean)
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
  useEffect(()=>{if(settings?.helpdesk_enabled===false && view==='helpdesk')setView('overview')},[settings?.helpdesk_enabled,view])
  useEffect(()=>{if(search.trim() && !['board','mytasks'].includes(view))setView('board')},[search])
  useEffect(()=>{
    if(!workspace?.id)return
    if(myRole==='reporter' && !['mytasks','helpdesk'].includes(view)) setView('mytasks')
    if(myRole==='viewer' && !['overview','board','backlog','helpdesk'].includes(view)) setView('overview')
    if(!canAdminWorkspace && ['team','settings'].includes(view)) setView(canViewDashboard?'overview':'mytasks')
  },[workspace?.id,myRole])
  useEffect(()=>{
    const onKey=e=>{
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){
        e.preventDefault()
        document.getElementById('global-ticket-search')?.focus()
      }
    }
    window.addEventListener('keydown',onKey)
    return ()=>window.removeEventListener('keydown',onKey)
  },[])

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
    if(myRole==='reporter' && !ticket){
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
    const {error}=await db.from('tickets').update({sprint_id:sprintId||null,status:sprintId?(ticket.status==='backlog'?'todo':ticket.status):'backlog'}).eq('id',ticket.id)
    if(error)throw error
    await refresh();showToast('success',sprintId?'Ticket agregado al sprint.':'Ticket regresado al Backlog.')
  }

  const saveHelpdesk=async(form,item=null)=>{
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
      ? (canWork
          ? {...base,status:form.status,assigned_to:form.assigned_to||null,due_at:localDateTimeToIso(form.due_at)}
          : base)
      : {...base,workspace_id:workspace.id,requester_user_id:session.user.id,status:canWork?(form.status||'created'):'created',assigned_to:canWork?(form.assigned_to||null):null,due_at:canWork?localDateTimeToIso(form.due_at):null}
    const result=item ? await db.from('helpdesk_tickets').update(payload).eq('id',item.id) : await db.from('helpdesk_tickets').insert(payload)
    if(result.error) throw result.error
    await refresh(); showToast('success',item?'Solicitud actualizada.':'Solicitud de soporte creada.')
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
    <Topbar session={session} unread={unread} search={search} setSearch={setSearch} canCreate={canCreateTicket} onCreate={()=>setModal({type:'ticket-create'})} onNotifications={()=>setDrawer('notifications')} onAppSwitcher={()=>setModal({type:'workspace-switch'})} onHelp={()=>setModal({type:'quick-help'})}/>
    <Sidebar workspace={workspace} workspaces={workspaces} products={products} productId={productId} setProductId={setProductId} view={view} setView={setView} tickets={tickets} helpdesk={helpdesk} helpdeskEnabled={helpdeskEnabled} role={myRole} canAdmin={canAdminWorkspace} canPlan={canPlan} canViewDashboard={canViewDashboard} onWorkspace={()=>setModal({type:'workspace-switch'})}/>
    <MobileNav view={view} setView={setView} setProductId={setProductId} helpdeskEnabled={helpdeskEnabled} role={myRole} canAdmin={canAdminWorkspace} canViewDashboard={canViewDashboard}/>
    <main className="main-area">
      {busy ? <LoadingPanel/> : <>
        {view==='overview' && canViewDashboard && <Overview workspace={workspace} tickets={tickets} helpdesk={helpdesk} products={products} sprints={sprints}/>} 
        {view==='board' && canViewDashboard && <TicketWorkspace workspace={workspace} title="Tablero" subtitle="Consulta, filtra y gestiona tickets del equipo." tickets={filteredTickets} allTickets={tickets} products={products} members={members} sprints={sprints} boardMode={boardMode} setBoardMode={setBoardMode} filters={filters} onFilter={()=>setModal({type:'ticket-filters'})} onClearFilters={()=>setFilters({status:'all',assignee:'all',sprint:'all',priority:'all',type:'all'})} canWork={canWork} canCreate={canCreateTicket} onCreate={()=>setModal({type:'ticket-create'})} onActions={ticket=>setModal({type:'ticket-actions',ticket})} onOpen={ticket=>setModal({type:'ticket-detail',ticket})} onMove={moveTicket}/>} 
        {view==='backlog' && canViewDashboard && <BacklogView workspace={workspace} tickets={tickets} products={products} sprints={sprints} members={members} canPlan={canPlan} onTicket={ticket=>setModal({type:'ticket-detail',ticket})} onPlan={ticket=>setModal({type:'ticket-plan',ticket})} onSprint={sprint=>setModal({type:'sprint-detail',sprint})} onCloseSprint={sprint=>setModal({type:'sprint-rollover',sprint})} onCreateSprint={()=>setModal({type:'sprint-create'})}/>} 
        {view==='mytasks' && (myRole==='reporter'
          ? <ReporterTicketsView tickets={myTickets} products={products} onCreate={()=>setModal({type:'ticket-create'})} onOpen={ticket=>setModal({type:'ticket-detail',ticket})}/>
          : <TicketWorkspace workspace={workspace} title="Mis tareas" subtitle="Tickets que reportaste o que tienes asignados." tickets={myTickets} allTickets={myTickets} products={products} members={members} sprints={sprints} boardMode={boardMode} setBoardMode={setBoardMode} filters={filters} onFilter={()=>setModal({type:'ticket-filters'})} onClearFilters={()=>setFilters({status:'all',assignee:'all',sprint:'all',priority:'all',type:'all'})} canWork={canWork} canCreate={canCreateTicket} onCreate={()=>setModal({type:'ticket-create'})} onActions={ticket=>setModal({type:'ticket-actions',ticket})} onOpen={ticket=>setModal({type:'ticket-detail',ticket})} onMove={moveTicket}/>)} 
        {view==='helpdesk' && helpdeskEnabled && (helpdeskStaff
          ? <HelpdeskView items={filteredHelpdesk} allItems={helpdesk} departments={departments} members={members} filters={helpFilters} onFilter={()=>setModal({type:'help-filters'})} onCreate={()=>setModal({type:'help-create'})} onActions={item=>setModal({type:'help-actions',item})} onOpen={item=>setModal({type:'help-detail',item})}/>
          : <HelpdeskPortal items={helpdesk} departments={departments} onCreate={()=>setModal({type:'help-create'})} onOpen={item=>setModal({type:'help-detail',item})}/>)} 
        {view==='team' && canAdminWorkspace && <TeamView members={members} canManage={canAdminWorkspace} isSuperadmin={isSuperadmin} session={session} onInvite={()=>setModal({type:'invite'})} onMember={member=>setModal({type:'member-edit',member})}/>} 
        {view==='settings' && canAdminWorkspace && <SettingsView workspace={workspace} settings={settings} products={products} sprints={sprints} departments={departments} emailQueue={emailQueue} emailProviderStatus={emailProviderStatus} canManage={canAdminWorkspace} canDeleteWorkspace={isSuperadmin} onWorkspaceEdit={()=>setModal({type:'workspace-edit'})} onWorkspaceConfig={()=>setModal({type:'workspace-config'})} onWorkspaceDelete={()=>setModal({type:'workspace-delete'})} onSettingsSaved={refresh} onProductCreate={()=>setModal({type:'product-create'})} onProductEdit={product=>setModal({type:'product-edit',product})} onProductDelete={product=>setModal({type:'product-delete',product})} onSprintCreate={()=>setModal({type:'sprint-create'})} onSprintEdit={sprint=>setModal({type:'sprint-edit',sprint})} onSprintDelete={sprint=>setModal({type:'sprint-delete',sprint})} onDepartmentCreate={()=>setModal({type:'department-create'})} onDepartmentEdit={department=>setModal({type:'department-edit',department})} onDepartmentDelete={department=>setModal({type:'department-delete',department})} onProcessEmails={processEmails} toast={showToast}/>} 
      </>}
    </main>
    {drawer==='notifications' && <NotificationsDrawer notifications={notifications} onClose={()=>setDrawer(null)} onMark={markNotification} onMarkAll={markAll} onDelete={deleteNotification} onClearRead={clearReadNotifications} onOpen={n=>{setDrawer(null); if(n.ticket_id){const t=tickets.find(x=>x.id===n.ticket_id); if(t)setModal({type:'ticket-detail',ticket:t});else showToast('error','El ticket relacionado ya no está disponible.')} else if(n.helpdesk_ticket_id){const h=helpdesk.find(x=>x.id===n.helpdesk_ticket_id); if(h)setModal({type:'help-detail',item:h});else showToast('error','La solicitud relacionada ya no está disponible.')}}}/>} 
    {modal && <ModalRouter modal={modal} setModal={setModal} workspace={workspace} workspaces={workspaces} memberships={memberships} products={products} sprints={sprints} tickets={tickets} members={members} departments={departments} settings={settings} session={session} myRole={myRole} isSuperadmin={isSuperadmin} isAdmin={canAdminWorkspace} canManage={canPlan} canAdminWorkspace={canAdminWorkspace} canPlan={canPlan} canWork={canWork} canCreateTicket={canCreateTicket} filters={filters} setFilters={setFilters} helpFilters={helpFilters} setHelpFilters={setHelpFilters} createWorkspace={createWorkspace} saveTicket={saveTicket} deleteTicket={deleteTicket} saveHelpdesk={saveHelpdesk} deleteHelpdesk={deleteHelpdesk} closeSprintAndRollover={closeSprintAndRollover} planTicket={planTicket} refresh={refresh} loadMemberships={loadMemberships} setWorkspace={setWorkspace} setView={setView} toast={showToast}/>} 
    {toast && <Toast toast={toast}/>} 
  </div>
}

function Topbar({session,unread,search,setSearch,canCreate,onCreate,onNotifications,onAppSwitcher,onHelp}){return <header className="global-topbar">
  <div className="topbar-brand"><button className="app-switcher" onClick={onAppSwitcher} title="Cambiar workspace"><Icon name="lucide:grid-2x2"/></button><img src="./logo.svg" alt="TROBBU"/><span></span><b>Jira Interno</b></div>
  <div className="global-search"><Icon name="lucide:search"/><input id="global-ticket-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar tickets por clave, título o descripción"/><kbd>⌘ K</kbd></div>
  <div className="topbar-actions">{canCreate&&<button className="primary create-button" onClick={onCreate}><Icon name="lucide:plus"/> Crear</button>}<button className="icon-button bell" onClick={onNotifications} title="Notificaciones"><Icon name="lucide:bell"/>{unread>0&&<em>{unread>9?'9+':unread}</em>}</button><button className="icon-button" onClick={onHelp} title="Ayuda"><Icon name="lucide:circle-help"/></button><div className="top-user"><span className="avatar sm">{initials(session.user.user_metadata?.full_name||session.user.email)}</span><div><b>{session.user.user_metadata?.full_name||'Usuario'}</b><small>{session.user.email}</small></div></div></div>
</header>}

function Sidebar({workspace,workspaces,products,productId,setProductId,view,setView,tickets,helpdesk,helpdeskEnabled,role,canAdmin,canPlan,canViewDashboard,onWorkspace}){
  const staff=roleCanWork(role)
  const items=role==='reporter'
    ? [['mytasks','lucide:ticket-check','Mis tickets'],...(helpdeskEnabled?[['helpdesk','lucide:life-buoy','Mis solicitudes']]:[])]
    : role==='viewer'
      ? [['overview','lucide:layout-dashboard','Resumen'],['board','lucide:columns-3','Tablero'],['backlog','lucide:list-todo','Backlog / Sprints'],...(helpdeskEnabled?[['helpdesk','lucide:life-buoy','Mis solicitudes']]:[])]
      : [['overview','lucide:layout-dashboard','Resumen'],['board','lucide:columns-3','Tablero'],['backlog','lucide:list-todo','Backlog / Sprints'],['mytasks','lucide:circle-check-big','Mis tareas'],...(helpdeskEnabled?[['helpdesk','lucide:life-buoy','Helpdesk']]:[]),...(canAdmin?[['team','lucide:users','Equipo']]:[])]
  return <aside className="sidebar">
    <div className="sidebar-section-title"><span>ESPACIO DE TRABAJO</span><button className="ghost-icon" onClick={onWorkspace} title="Cambiar o crear workspace"><Icon name="lucide:plus" size={16}/></button></div>
    <button className="workspace-card" onClick={onWorkspace}><span className="workspace-icon"><Icon name="lucide:layers-3"/></span><div><b>{workspace?.name}</b><small>{ROLE_LABELS[role]||role}</small></div><Icon name="lucide:chevrons-up-down" size={16}/></button>
    <nav className="side-nav">{items.map(([key,icon,label])=><button key={key} className={view===key?'active':''} onClick={()=>{if(key!=='board')setProductId('all');setView(key)}}><Icon name={icon}/><span>{label}</span>{key==='board'&&<em>{tickets.length}</em>}{key==='backlog'&&<em>{tickets.filter(t=>!t.sprint_id&&t.status!=='closed').length}</em>}{key==='helpdesk'&&<em>{helpdesk.filter(h=>!['resolved','closed'].includes(h.status)).length}</em>}</button>)}</nav>
    {canViewDashboard&&<><div className="sidebar-divider"></div><div className="sidebar-section-title"><span>PRODUCTOS</span></div>
      <button className={`product-nav ${productId==='all'?'active':''}`} onClick={()=>{setProductId('all');setView('board')}}><span className="product-dot all"><Icon name="lucide:boxes" size={15}/></span><span>Todos los productos</span><em>{tickets.length}</em></button>
      {products.map((p,i)=><button key={p.id} className={`product-nav ${productId===p.id?'active':''}`} onClick={()=>{setProductId(p.id);setView('board')}}><span className={`product-dot p${i%4}`}><Icon name={i===2?'lucide:smartphone':'lucide:monitor'} size={15}/></span><span>{p.name}</span><em>{tickets.filter(t=>t.product_id===p.id).length}</em></button>)}
    </>}
    <div className="sidebar-spacer"></div><div className="sidebar-divider"></div>
    {canAdmin&&<button className={`footer-nav ${view==='settings'?'active':''}`} onClick={()=>{setProductId('all');setView('settings')}}><Icon name="lucide:settings"/>Configuración</button>}
    <button className="footer-nav" onClick={()=>db.auth.signOut()}><Icon name="lucide:log-out"/>Cerrar sesión</button>
  </aside>
}

function MobileNav({view,setView,setProductId,helpdeskEnabled,role,canAdmin,canViewDashboard}){
  const items=role==='reporter'
    ? [['mytasks','lucide:ticket-check','Tickets'],...(helpdeskEnabled?[['helpdesk','lucide:life-buoy','Solicitudes']]:[])]
    : role==='viewer'
      ? [['overview','lucide:layout-dashboard','Resumen'],['board','lucide:columns-3','Tablero'],['backlog','lucide:list-todo','Backlog'],...(helpdeskEnabled?[['helpdesk','lucide:life-buoy','Solicitudes']]:[])]
      : [['overview','lucide:layout-dashboard','Resumen'],['board','lucide:columns-3','Tablero'],['backlog','lucide:list-todo','Backlog'],['mytasks','lucide:circle-check-big','Mis tareas'],...(helpdeskEnabled?[['helpdesk','lucide:life-buoy','Helpdesk']]:[]),...(canAdmin?[['team','lucide:users','Equipo'],['settings','lucide:settings','Ajustes']]:[])]
  return <nav className="mobile-nav" aria-label="Navegación móvil">
    {items.map(([key,icon,label])=><button type="button" key={key} className={view===key?'active':''} onClick={()=>{setProductId('all');setView(key)}}><Icon name={icon} size={19}/><span>{label}</span></button>)}
  </nav>
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

function DashboardFilterModal({product,sprint,products,sprints,onClose,onApply}){const [f,setF]=useState({product,sprint});return <Modal title="Filtros del dashboard" subtitle="Segmenta las métricas por producto y sprint." onClose={onClose}><AsyncForm onSubmit={()=>onApply(f)} submitLabel="Aplicar filtros"><div className="form-grid"><label>Producto<select value={f.product} onChange={e=>setF({...f,product:e.target.value})}><option value="all">Todos los productos</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Sprint<select value={f.sprint} onChange={e=>setF({...f,sprint:e.target.value})}><option value="all">Todos los sprints</option>{sprints.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label></div><div className="modal-secondary"><button type="button" className="secondary-button" onClick={()=>setF({product:'all',sprint:'all'})}>Restablecer</button></div></AsyncForm></Modal>}

function TicketWorkspace({workspace,title,subtitle,tickets,allTickets,products,members,sprints,boardMode,setBoardMode,filters,onFilter,onClearFilters,canWork,canCreate,onCreate,onActions,onOpen,onMove}){
  const activeFilters=Object.values(filters).filter(v=>v!=='all').length
  return <div className="page"><PageHeader title={title} subtitle={subtitle} action={canCreate?<button className="primary" onClick={onCreate}><Icon name="lucide:plus"/> Nuevo ticket</button>:<span className="readonly-chip"><Icon name="lucide:eye"/> Solo consulta</span>}/>
    <section className="workspace-panel"><div className="panel-toolbar"><div className="tabs"><button className={boardMode==='table'?'active':''} onClick={()=>setBoardMode('table')}><Icon name="lucide:table-2"/>Tabla</button><button className={boardMode==='kanban'?'active':''} onClick={()=>setBoardMode('kanban')}><Icon name="lucide:columns-3"/>Kanban</button><button className={boardMode==='calendar'?'active':''} onClick={()=>setBoardMode('calendar')}><Icon name="lucide:calendar-days"/>Calendario</button></div><div className="toolbar-actions"><button className={`filter-button ${activeFilters?'active':''}`} onClick={onFilter}><Icon name="lucide:list-filter"/> Filtros {activeFilters>0&&<em>{activeFilters}</em>}</button>{activeFilters>0&&<button className="text-button" onClick={onClearFilters}>Limpiar</button>}{canCreate&&<button className="primary compact" onClick={onCreate}><Icon name="lucide:plus"/> Nuevo</button>}</div></div>
    <div className="mini-stats"><span>Total <b>{allTickets.length}</b></span><span className="gray">Backlog <b>{allTickets.filter(t=>t.status==='backlog').length}</b></span><span className="amber">En desarrollo <b>{allTickets.filter(t=>['todo','in_progress','dev_done'].includes(t.status)).length}</b></span><span className="blue">En QA <b>{allTickets.filter(t=>['qa_review','qa_rejected','qa_passed'].includes(t.status)).length}</b></span><span className="green">Cerrados <b>{allTickets.filter(t=>t.status==='closed').length}</b></span></div>
    {boardMode==='table'&&<TicketTable tickets={tickets} products={products} members={members} onActions={onActions} onOpen={onOpen}/>} 
    {boardMode==='kanban'&&<Kanban tickets={tickets} products={products} members={members} canWork={canWork} onActions={onActions} onOpen={onOpen} onMove={onMove}/>} 
    {boardMode==='calendar'&&<CalendarView workspace={workspace} tickets={tickets} products={products} onOpen={onOpen}/>} 
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

function HelpdeskPortal({items,departments,onCreate,onOpen}){
  const order=['created','review','attended','resolved','closed']
  const active=items.filter(x=>!['resolved','closed'].includes(x.status)).length
  return <div className="page"><PageHeader eyebrow="Portal de servicio" title="Mis solicitudes" subtitle="Crea solicitudes para la mesa de atención y consulta su seguimiento de principio a fin." icon="lucide:life-buoy" action={<button className="primary" onClick={onCreate}><Icon name="lucide:plus"/> Nueva solicitud</button>}/><div className="metric-grid four"><Metric label="Solicitudes" value={items.length} icon="lucide:inbox" tone="blue"/><Metric label="En seguimiento" value={active} icon="lucide:loader-circle" tone="orange"/><Metric label="Resueltas" value={items.filter(x=>x.status==='resolved').length} icon="lucide:circle-check" tone="green"/><Metric label="Cerradas" value={items.filter(x=>x.status==='closed').length} icon="lucide:badge-check" tone="navy"/></div><div className="portal-info"><Icon name="lucide:shield-check"/><div><b>Solo ves tus propias solicitudes.</b><p>El equipo interno administra responsable, SLA y cambios de estado. Puedes abrir el detalle para consultar comentarios y actividad.</p></div></div><section className="request-list">{items.length===0&&<div className="empty-state-inline"><Icon name="lucide:life-buoy" size={34}/><h3>No tienes solicitudes</h3><p>Cuando necesites apoyo, crea una solicitud y podrás seguirla desde aquí.</p><button className="primary compact" onClick={onCreate}>Crear solicitud</button></div>}{items.map(item=>{const dept=departments.find(d=>d.id===item.department_id),idx=Math.max(0,order.indexOf(item.status));return <article className="request-card" key={item.id}><button type="button" className="request-card-main" onClick={()=>onOpen(item)}><div className="request-card-title"><span className="request-icon"><Icon name="lucide:headphones"/></span><div><small>{item.ticket_key} · {dept?.name||'Sin área'}</small><h3>{item.subject}</h3><p>{item.description||'Sin descripción.'}</p></div><HelpStatusBadge status={item.status}/></div><div className="request-stepper">{order.map((st,i)=><div key={st} className={`${i<idx?'done':''} ${i===idx?'current':''}`}><i>{i<idx?<Icon name="lucide:check" size={12}/>:i+1}</i><span>{helpStatusLabel(st)}</span></div>)}</div><div className="request-meta"><span><Icon name="lucide:calendar"/> Creado {formatDateTime(item.created_at)}</span>{item.due_at&&<span><Icon name="lucide:clock"/> Objetivo {formatDateTime(item.due_at)}</span>}<span><Icon name="lucide:refresh-cw"/> Actualizado {formatDateTime(item.updated_at)}</span></div></button></article>})}</section></div>
}

function HelpdeskView({items,allItems,departments,members,filters,onFilter,onCreate,onActions,onOpen}){
  const open=allItems.filter(h=>['created','review','attended'].includes(h.status)).length
  const resolved=allItems.filter(h=>h.status==='resolved').length
  const closed=allItems.filter(h=>h.status==='closed').length
  const overdue=allItems.filter(h=>h.due_at && !['resolved','closed'].includes(h.status) && new Date(h.due_at)<new Date()).length
  const withResponse=allItems.filter(h=>h.first_response_at)
  const avgFirst=withResponse.length?Math.round(withResponse.reduce((a,h)=>a+(new Date(h.first_response_at)-new Date(h.created_at))/36e5,0)/withResponse.length*10)/10:null
  const resolvedRows=allItems.filter(h=>h.resolved_at)
  const avgResolution=resolvedRows.length?Math.round(resolvedRows.reduce((a,h)=>a+(new Date(h.resolved_at)-new Date(h.created_at))/36e5,0)/resolvedRows.length*10)/10:null
  const slaRows=resolvedRows.filter(h=>h.due_at)
  const slaPct=slaRows.length?Math.round(slaRows.filter(h=>new Date(h.resolved_at)<=new Date(h.due_at)).length/slaRows.length*100):100
  const active=Object.values(filters).filter(v=>v!=='all').length
  return <div className="page"><PageHeader eyebrow="Servicio interno" title="Helpdesk" subtitle="Recibe solicitudes de otras áreas y gestiona su atención con el mismo equipo." icon="lucide:life-buoy" action={<button className="primary" onClick={onCreate}><Icon name="lucide:plus"/> Nueva solicitud</button>}/>
    <div className="metric-grid six"><Metric label="Solicitudes" value={allItems.length} icon="lucide:inbox" tone="blue"/><Metric label="Abiertas" value={open} icon="lucide:loader-circle" tone="orange"/><Metric label="Vencidas" value={overdue} icon="lucide:alarm-clock" tone="red"/><Metric label="Resueltas" value={resolved} icon="lucide:circle-check" tone="green"/><Metric label="SLA cumplido" value={`${slaPct}%`} icon="lucide:gauge" tone="navy"/><Metric label="1ª respuesta" value={avgFirst==null?'—':`${avgFirst}h`} icon="lucide:timer" tone="purple"/></div>
    <div className="dashboard-grid helpdesk-insights"><section className="panel"><div className="panel-heading"><div><h3>Solicitudes por área</h3><p>Volumen y carga de atención.</p></div></div>{departments.map(d=>{const rows=allItems.filter(h=>h.department_id===d.id);const activeRows=rows.filter(h=>!['resolved','closed'].includes(h.status)).length;return <div className="dept-stat" key={d.id}><span className="dept-dot" style={{background:d.color||'#D4DCE0'}}></span><b>{d.name}</b><span>{activeRows} abiertas</span><strong>{rows.length}</strong></div>})}</section><section className="panel"><div className="panel-heading"><div><h3>Tiempos de servicio</h3><p>Indicadores de respuesta y resolución.</p></div></div><div className="service-kpi"><span>Promedio primera respuesta</span><b>{avgFirst==null?'Sin datos':`${avgFirst} horas`}</b></div><div className="service-kpi"><span>Promedio resolución</span><b>{avgResolution==null?'Sin datos':`${avgResolution} horas`}</b></div><div className="service-kpi"><span>Casos cerrados</span><b>{closed}</b></div></section></div>
    <section className="workspace-panel"><div className="panel-toolbar"><div><h3>Solicitudes internas</h3><p className="muted">Reservaciones, Recepción, Gerencia, Administración, Aperturas, Marketing, Callcenter, Plataforma, Atención a clientes y Atención a socios.</p></div><div className="toolbar-actions"><button className={`filter-button ${active?'active':''}`} onClick={onFilter}><Icon name="lucide:list-filter"/> Filtros {active>0&&<em>{active}</em>}</button><button className="primary compact" onClick={onCreate}><Icon name="lucide:plus"/> Crear</button></div></div>
    <div className="table-wrap"><div className="table help-table"><div className="tr th"><span>SOLICITUD</span><span>ÁREA</span><span>ASIGNADO</span><span>PRIORIDAD</span><span>ESTADO</span><span></span></div>{items.length===0&&<TableEmpty text="No hay solicitudes con estos filtros."/>}{items.map(h=>{const dep=departments.find(d=>d.id===h.department_id),owner=members.find(m=>m.user_id===h.assigned_to)?.profile?.full_name||'Sin asignar';return <div className="tr" key={h.id}><span className="task-cell"><button className="task-link" onClick={()=>onOpen(h)}><b>{h.subject}</b><small>{h.ticket_key} · {h.category}</small></button></span><span><span className="dept-dot" style={{background:dep?.color||'#D4DCE0'}}></span>{dep?.name||'Sin área'}</span><span className="assignee-cell"><span className="mini-avatar">{initials(owner)}</span>{owner}</span><span><span className={`priority-badge priority-${h.priority}`}>{PRIORITY_LABELS[h.priority]}</span></span><span><HelpStatusBadge status={h.status}/></span><span><button className="icon-button" onClick={()=>onActions(h)} title="Acciones"><Icon name="lucide:ellipsis-vertical"/></button></span></div>})}</div></div></section>
  </div>
}

function TeamView({members,canManage,isSuperadmin,session,onInvite,onMember}){
  const guide=[
    ['superadmin','lucide:crown'],['admin','lucide:shield-check'],['pm','lucide:calendar-range'],['dev','lucide:code-2'],['qa','lucide:scan-search'],['reporter','lucide:upload'],['viewer','lucide:chart-no-axes-combined']
  ]
  return <div className="page"><PageHeader title="Equipo y permisos" subtitle="Cada rol se aplica únicamente dentro de este workspace. Los datos, productos, sprints y tickets no se comparten entre espacios." icon="lucide:users" action={canManage?<button className="primary" onClick={onInvite}><Icon name="lucide:user-plus"/> Invitar colaborador</button>:null}/>
    <div className="role-guide role-guide-all">{guide.map(([role,icon])=><div key={role}><Icon name={icon}/><span><b>{ROLE_LABELS[role]}</b><small>{ROLE_DESCRIPTIONS[role]}</small></span></div>)}</div>
    <section className="workspace-panel"><div className="member-grid">{members.map(m=>{const editable=canManage&&(isSuperadmin||m.role!=='superadmin');return <div className={`member-card ${m.active?'':'inactive'}`} key={m.user_id}><span className="avatar">{initials(m.profile?.full_name)}</span><div className="member-info"><b>{m.profile?.full_name||'Usuario'}{m.user_id===session.user.id&&<small> Tú</small>}</b><span>{m.profile?.job_title||ROLE_LABELS[m.role]} · {m.active?'Activo':'Acceso desactivado'}</span><small className="role-description">{ROLE_DESCRIPTIONS[m.role]||''}</small></div><em>{ROLE_LABELS[m.role]||m.role}</em>{editable&&<button type="button" className="icon-button" onClick={()=>onMember(m)}><Icon name="lucide:ellipsis-vertical"/></button>}</div>})}</div></section>
  </div>
}

function SettingsView({workspace,settings,products,sprints,departments,emailQueue,emailProviderStatus,canManage,canDeleteWorkspace,onWorkspaceEdit,onWorkspaceConfig,onWorkspaceDelete,onSettingsSaved,onProductCreate,onProductEdit,onProductDelete,onSprintCreate,onSprintEdit,onSprintDelete,onDepartmentCreate,onDepartmentEdit,onDepartmentDelete,onProcessEmails,toast}){
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
      {tab==='workspace'&&<WorkspaceSettings workspace={workspace} settings={settings} canManage={canManage} canDelete={canDeleteWorkspace} onEdit={onWorkspaceEdit} onConfig={onWorkspaceConfig} onDelete={onWorkspaceDelete}/>}
      {tab==='products'&&<EntitySettings title="Productos" subtitle="Tableros separados para cada producto." items={products} canManage={canManage} onCreate={onProductCreate} render={p=><><div><b>{p.name}</b><span>{p.key} · {p.description||'Sin descripción'}</span></div><div className="row-actions">{canManage&&<><button onClick={()=>onProductEdit(p)}><Icon name="lucide:pencil"/>Editar</button><button className="danger-text" onClick={()=>onProductDelete(p)}><Icon name="lucide:trash-2"/>Eliminar</button></>}</div></>}/>}
      {tab==='sprints'&&<EntitySettings title="Sprints" subtitle="Planeación y periodos de trabajo." items={sprints} canManage={canManage} onCreate={onSprintCreate} render={x=><><div><b>{x.name}</b><span>{x.status} · {formatDate(x.start_date)} — {formatDate(x.end_date)}</span></div><div className="row-actions">{canManage&&<><button onClick={()=>onSprintEdit(x)}><Icon name="lucide:pencil"/>Editar</button><button className="danger-text" onClick={()=>onSprintDelete(x)}><Icon name="lucide:trash-2"/>Eliminar</button></>}</div></>}/>}
      {tab==='helpdesk'&&<HelpdeskSettings settings={settings} departments={departments} canManage={canManage} onCreate={onDepartmentCreate} onEdit={onDepartmentEdit} onDelete={onDepartmentDelete}/>}
      {tab==='notifications'&&<NotificationSettings settings={settings} queue={emailQueue} providerStatus={emailProviderStatus} canManage={canManage} onProcess={onProcessEmails} toast={toast}/>}
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

  if(modal.type==='ticket-create') return <TicketModal title="Crear ticket" reporterMode={props.myRole==='reporter'} products={props.products} sprints={props.sprints} members={props.members} onClose={close} onSave={async f=>{await props.saveTicket(f);close()}}/>
  if(modal.type==='ticket-edit' && props.canWork) return <TicketModal title={`Editar ${modal.ticket.ticket_key}`} ticket={modal.ticket} products={props.products} sprints={props.sprints} members={props.members} onClose={close} onSave={async f=>{await props.saveTicket(f,modal.ticket);close()}}/>
  if(modal.type==='ticket-detail') return <TicketDetailModal workspace={props.workspace} ticket={modal.ticket} products={props.products} members={props.members} session={props.session} canWork={props.canWork} canManage={props.canManage} onClose={close} onEdit={()=>setModal({type:'ticket-edit',ticket:modal.ticket})} onPlan={()=>setModal({type:'ticket-plan',ticket:modal.ticket})} onRefresh={props.refresh} toast={props.toast}/>
  if(modal.type==='ticket-actions'){
    const actions=[['lucide:eye','Ver detalle',()=>setModal({type:'ticket-detail',ticket:modal.ticket})]]
    if(props.canWork) actions.push(['lucide:pencil','Editar ticket',()=>setModal({type:'ticket-edit',ticket:modal.ticket})])
    if(props.canPlan) actions.push(['lucide:calendar-plus','Planificar / cambiar sprint',()=>setModal({type:'ticket-plan',ticket:modal.ticket})])
    if(props.canManage) actions.push(['lucide:trash-2','Eliminar ticket',()=>setModal({type:'ticket-delete',ticket:modal.ticket}),'danger'])
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

  if(modal.type==='help-create') return <HelpdeskModal title="Nueva solicitud de Helpdesk" departments={props.departments} members={props.members} session={props.session} canWork={props.canWork} onClose={close} onSave={async f=>{await props.saveHelpdesk(f);close()}}/>
  if(modal.type==='help-edit') return <HelpdeskModal title={`Editar ${modal.item.ticket_key}`} item={modal.item} departments={props.departments} members={props.members} session={props.session} canWork={props.canWork} onClose={close} onSave={async f=>{await props.saveHelpdesk(f,modal.item);close()}}/>
  if(modal.type==='help-detail') return <HelpdeskDetailModal item={modal.item} departments={props.departments} members={props.members} session={props.session} canWork={props.canWork} canManage={props.canManage} onClose={close} onEdit={()=>setModal({type:'help-edit',item:modal.item})} onRefresh={props.refresh} toast={props.toast}/>
  if(modal.type==='help-actions'){
    const mayEdit=props.canWork
    const actions=[['lucide:eye','Ver solicitud',()=>setModal({type:'help-detail',item:modal.item})]]
    if(mayEdit) actions.push(['lucide:pencil','Editar solicitud',()=>setModal({type:'help-edit',item:modal.item})])
    if(props.canManage) actions.push(['lucide:trash-2','Eliminar solicitud',()=>setModal({type:'help-delete',item:modal.item}),'danger'])
    return <ActionSheet title={modal.item.ticket_key} subtitle={modal.item.subject} onClose={close} actions={actions}/>
  }
  if(modal.type==='help-delete') return <ConfirmModal title={`Eliminar ${modal.item.ticket_key}`} message={`¿Deseas eliminar “${modal.item.subject}”?`} danger onClose={close} onConfirm={async()=>{await props.deleteHelpdesk(modal.item);close()}}/>
  if(modal.type==='help-filters') return <HelpFilterModal filters={props.helpFilters} departments={props.departments} members={props.members} onClose={close} onApply={f=>{props.setHelpFilters(f);close()}}/>

  if(modal.type==='invite') return <InviteModal workspace={props.workspace} isSuperadmin={props.isSuperadmin} onClose={close} onSaved={async()=>{await props.loadMemberships(props.workspace.id);await props.refresh();props.toast('success','Invitación procesada.');close()}}/>
  if(modal.type==='member-edit') return <MemberModal member={modal.member} session={props.session} isSuperadmin={props.isSuperadmin} onClose={close} onSave={async f=>{const {error}=await db.from('workspace_members').update({role:f.role,active:f.active}).eq('workspace_id',props.workspace.id).eq('user_id',modal.member.user_id);if(error)throw error;await props.loadMemberships(props.workspace.id);await props.refresh();props.toast('success','Colaborador actualizado.');close()}}/>

  if(modal.type==='product-create') return <ProductModal title="Nuevo producto" onClose={close} onSave={async f=>{const {error}=await db.from('products').insert({...f,workspace_id:props.workspace.id,board_order:props.products.length+1});if(error)throw error;await props.refresh();props.toast('success','Producto creado.');close()}}/>
  if(modal.type==='product-edit') return <ProductModal title="Editar producto" initial={modal.product} onClose={close} onSave={async f=>{const {error}=await db.from('products').update(f).eq('id',modal.product.id);if(error)throw error;await props.refresh();props.toast('success','Producto actualizado.');close()}}/>
  if(modal.type==='product-delete') return <ConfirmModal title="Eliminar producto" message="No podrás eliminar un producto si tiene tickets asociados. Reasigna o elimina esos tickets primero." danger onClose={close} onConfirm={async()=>{const {error}=await db.from('products').delete().eq('id',modal.product.id);if(error)throw error;await props.refresh();props.toast('success','Producto eliminado.');close()}}/>

  if(modal.type==='department-create') return <DepartmentModal title="Nueva área de Helpdesk" onClose={close} onSave={async f=>{const {error}=await db.from('helpdesk_departments').insert({...f,workspace_id:props.workspace.id});if(error)throw error;await props.refresh();props.toast('success','Área creada.');close()}}/>
  if(modal.type==='department-edit') return <DepartmentModal title="Editar área de Helpdesk" initial={modal.department} onClose={close} onSave={async f=>{const {error}=await db.from('helpdesk_departments').update(f).eq('id',modal.department.id);if(error)throw error;await props.refresh();props.toast('success','Área actualizada.');close()}}/>
  if(modal.type==='department-delete') return <ConfirmModal title="Eliminar área" message="Las solicitudes existentes conservarán el ticket, pero quedarán sin área asignada." danger onClose={close} onConfirm={async()=>{const {error}=await db.from('helpdesk_departments').delete().eq('id',modal.department.id);if(error)throw error;await props.refresh();props.toast('success','Área eliminada.');close()}}/>
  if(modal.type==='quick-help') return <QuickHelpModal helpdeskEnabled={props.settings?.helpdesk_enabled!==false} onClose={close} onHelpdesk={()=>{props.setView('helpdesk');close()}} onSettings={()=>{props.setView('settings');close()}}/>
  return null
}

function Modal({title,subtitle,onClose,children,size='md'}){return <div className="modal-backdrop" onMouseDown={onClose}><div className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-label={title} onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">JIRA INTERNO</span><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div><button type="button" className="icon-button" onClick={onClose} title="Cerrar" aria-label="Cerrar modal"><Icon name="lucide:x"/></button></div>{children}</div></div>}
function AsyncForm({onSubmit,children,submitLabel='Guardar',danger=false}){
  const [error,setError]=useState(''),[saving,setSaving]=useState(false)
  const go=async e=>{e.preventDefault();setSaving(true);setError('');try{await onSubmit()}catch(err){setError(err.message||String(err))}finally{setSaving(false)}}
  const list=React.Children.toArray(children)
  const secondary=list.filter(child=>child?.props?.className==='modal-secondary')
  const content=list.filter(child=>child?.props?.className!=='modal-secondary')
  return <form className="form" onSubmit={go}>{content}{error&&<div className="error"><Icon name="lucide:triangle-alert"/>{error}</div>}<div className="form-footer"><div className="form-footer-left">{secondary}</div><div className="modal-actions"><button type="submit" className={danger?'danger-button':'primary'} disabled={saving}>{saving?'Procesando…':submitLabel}</button></div></div></form>
}

function ConfirmModal({title,message,danger,onClose,onConfirm}){return <Modal title={title} onClose={onClose} size="sm"><AsyncForm onSubmit={onConfirm} submitLabel={danger?'Eliminar definitivamente':'Confirmar'} danger={danger}><div className="confirm-box"><span className={danger?'danger-icon':'info-icon'}><Icon name={danger?'lucide:triangle-alert':'lucide:circle-help'} size={26}/></span><p>{message}</p></div><div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div></AsyncForm></Modal>}
function ActionSheet({title,subtitle,onClose,actions}){return <Modal title={title} subtitle={subtitle} onClose={onClose} size="sm"><div className="action-sheet">{actions.map(([icon,label,fn,tone])=><button key={label} className={tone==='danger'?'danger-action':''} onClick={fn}><Icon name={icon}/><span>{label}</span><Icon name="lucide:chevron-right" size={16}/></button>)}</div></Modal>}

function WorkspaceModal({title,initial,onClose,onSave}){const [name,setName]=useState(initial?.name||'');return <Modal title={title} subtitle="Los datos y permisos permanecerán aislados por espacio." onClose={onClose}><AsyncForm onSubmit={()=>onSave({name:name.trim()})} submitLabel="Guardar workspace"><label>Nombre del workspace<input autoFocus value={name} onChange={e=>setName(e.target.value)} required placeholder="Ej. Desarrollo TROBBU"/></label><div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div></AsyncForm></Modal>}
function WorkspaceConfigModal({workspace,settings,onClose,onSaved}){const [f,setF]=useState({timezone:settings?.timezone||'America/Merida',default_sprint_days:settings?.default_sprint_days||14,support_email:settings?.support_email||'',sla_first_response_hours:settings?.sla_first_response_hours||4,sla_resolution_hours:settings?.sla_resolution_hours||24,in_app_notifications:settings?.in_app_notifications??true,email_notifications:settings?.email_notifications??true,helpdesk_enabled:settings?.helpdesk_enabled??true});return <Modal title="Editar configuración" subtitle={`Preferencias operativas de ${workspace.name}.`} onClose={onClose} size="lg"><AsyncForm onSubmit={async()=>{const sprintDays=Number(f.default_sprint_days),first=Number(f.sla_first_response_hours),resolution=Number(f.sla_resolution_hours);if(!f.timezone.trim())throw new Error('La zona horaria es obligatoria.');try{new Intl.DateTimeFormat('es-MX',{timeZone:f.timezone.trim()}).format(new Date())}catch{throw new Error('Ingresa una zona horaria IANA válida, por ejemplo America/Merida.')}if(sprintDays<1||sprintDays>90)throw new Error('La duración del sprint debe estar entre 1 y 90 días.');if(first<1||first>720)throw new Error('El SLA de primera respuesta debe estar entre 1 y 720 horas.');if(resolution<1||resolution>2160)throw new Error('El SLA de resolución debe estar entre 1 y 2160 horas.');const {error}=await db.from('workspace_settings').update({timezone:f.timezone.trim(),default_sprint_days:sprintDays,support_email:f.support_email.trim()||null,sla_first_response_hours:first,sla_resolution_hours:resolution,in_app_notifications:!!f.in_app_notifications,email_notifications:!!f.email_notifications,helpdesk_enabled:!!f.helpdesk_enabled}).eq('workspace_id',workspace.id);if(error)throw error;await onSaved()}} submitLabel="Guardar configuración"><div className="form-section"><h4>Operación</h4><div className="form-grid"><label>Zona horaria<input value={f.timezone} onChange={e=>setF({...f,timezone:e.target.value})} required/></label><label>Duración de sprint (días)<input type="number" min="1" max="90" value={f.default_sprint_days} onChange={e=>setF({...f,default_sprint_days:e.target.value})}/></label><label>Correo de soporte<input type="email" value={f.support_email} onChange={e=>setF({...f,support_email:e.target.value})} placeholder="soporte@trobbu.com"/></label><label>SLA primera respuesta (hrs)<input type="number" min="1" max="720" value={f.sla_first_response_hours} onChange={e=>setF({...f,sla_first_response_hours:e.target.value})}/></label><label>SLA resolución (hrs)<input type="number" min="1" max="2160" value={f.sla_resolution_hours} onChange={e=>setF({...f,sla_resolution_hours:e.target.value})}/></label></div></div><div className="form-section"><h4>Funciones</h4><div className="toggle-list"><Toggle label="Notificaciones dentro de la plataforma" checked={!!f.in_app_notifications} onChange={v=>setF({...f,in_app_notifications:v})}/><Toggle label="Notificaciones por correo" checked={!!f.email_notifications} onChange={v=>setF({...f,email_notifications:v})}/><Toggle label="Helpdesk habilitado" checked={!!f.helpdesk_enabled} onChange={v=>setF({...f,helpdesk_enabled:v})}/></div></div><div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div></AsyncForm></Modal>}
function WorkspaceSwitcherModal({workspaces,current,onClose,onSelect,onCreate}){return <Modal title="Cambiar espacio de trabajo" subtitle="Selecciona el contexto que deseas administrar." onClose={onClose}><div className="workspace-list">{workspaces.map(w=><button key={w.id} className={w.id===current?.id?'active':''} onClick={()=>onSelect(w)}><span className="workspace-icon"><Icon name="lucide:layers-3"/></span><div><b>{w.name}</b><span>{ROLE_LABELS[w.role]||w.role}</span></div>{w.id===current?.id&&<Icon name="lucide:check"/>}</button>)}</div><div className="modal-actions"><button className="primary" onClick={onCreate}><Icon name="lucide:plus"/> Crear otro workspace</button></div></Modal>}

function TicketModal({title,ticket,products,sprints,members,reporterMode=false,onClose,onSave}){
  const [f,setF]=useState({
    product_id:ticket?.product_id||products[0]?.id||'',sprint_id:ticket?.sprint_id||'',title:ticket?.title||'',description:ticket?.description||'',type:ticket?.type||'task',priority:ticket?.priority||'medium',status:ticket?.status||'backlog',dev_owner_id:ticket?.dev_owner_id||'',qa_owner_id:ticket?.qa_owner_id||'',story_points:ticket?.story_points??'',start_date:ticket?.start_date||'',due_date:ticket?.due_date||''
  })
  const set=(k,v)=>setF(x=>({...x,[k]:v}))
  const devs=members.filter(m=>m.active&&['superadmin','admin','pm','dev'].includes(m.role))
  const qas=members.filter(m=>m.active&&['superadmin','admin','pm','qa'].includes(m.role))
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

function TicketFilterModal({filters,members,sprints,onClose,onApply}){const [f,setF]=useState({...filters});return <Modal title="Filtros de tickets" subtitle="Combina criterios para encontrar exactamente lo que necesitas." onClose={onClose}><AsyncForm onSubmit={()=>onApply(f)} submitLabel="Aplicar filtros"><div className="form-grid"><label>Estado<select value={f.status} onChange={e=>setF({...f,status:e.target.value})}><option value="all">Todos</option>{STATUS.map(([k,l])=><option value={k} key={k}>{l}</option>)}</select></label><label>Responsable<select value={f.assignee} onChange={e=>setF({...f,assignee:e.target.value})}><option value="all">Todos</option>{members.map(m=><option value={m.user_id} key={m.user_id}>{m.profile?.full_name||'Usuario'}</option>)}</select></label><label>Sprint<select value={f.sprint} onChange={e=>setF({...f,sprint:e.target.value})}><option value="all">Todos</option>{sprints.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label><label>Prioridad<select value={f.priority} onChange={e=>setF({...f,priority:e.target.value})}><option value="all">Todas</option>{PRIORITIES.map(p=><option value={p} key={p}>{PRIORITY_LABELS[p]}</option>)}</select></label><label>Tipo<select value={f.type} onChange={e=>setF({...f,type:e.target.value})}><option value="all">Todos</option>{TYPES.map(t=><option value={t} key={t}>{TYPE_LABELS[t]}</option>)}</select></label></div><div className="modal-secondary"><button type="button" className="secondary-button" onClick={()=>setF({status:'all',assignee:'all',sprint:'all',priority:'all',type:'all'})}>Restablecer</button></div></AsyncForm></Modal>}

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
  const assignees=members.filter(m=>m.active&&['superadmin','admin','pm','dev','qa'].includes(m.role))
  return <Modal title={title} subtitle={canWork?'Registra y administra una solicitud interna de servicio.':'Describe tu solicitud y consulta después su seguimiento desde Mis solicitudes.'} onClose={onClose} size="lg"><AsyncForm onSubmit={()=>onSave({...f,source:canWork?f.source:'portal'})} submitLabel={item?'Guardar cambios':'Crear solicitud'}>
    <div className="form-section"><h4>Solicitud</h4><label>Asunto<input value={f.subject} onChange={e=>setF({...f,subject:e.target.value})} required placeholder="¿Qué apoyo necesitas?"/></label><label>Descripción<textarea rows="5" value={f.description} onChange={e=>setF({...f,description:e.target.value})} placeholder="Contexto, impacto, evidencia y resultado esperado…"/></label><div className="form-grid"><label>Departamento solicitante<select value={f.department_id} onChange={e=>setF({...f,department_id:e.target.value})} required><option value="" disabled>Selecciona un departamento</option>{activeDepartments.map(d=><option value={d.id} key={d.id}>{d.name}</option>)}</select></label><label>Categoría<select value={f.category} onChange={e=>setF({...f,category:e.target.value})}><option value="general">General</option><option value="access">Accesos</option><option value="incident">Incidente</option><option value="request">Solicitud</option><option value="data">Datos / Reporte</option><option value="configuration">Configuración</option></select></label><label>Prioridad<select value={f.priority} onChange={e=>setF({...f,priority:e.target.value})}>{PRIORITIES.map(p=><option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}</select></label>{canWork&&<label>Origen<select value={f.source} onChange={e=>setF({...f,source:e.target.value})}><option value="internal">Interno</option><option value="portal">Portal</option><option value="email">Correo</option><option value="phone">Teléfono</option><option value="whatsapp">WhatsApp</option></select></label>}</div></div>
    <div className="form-section"><h4>Solicitante</h4><div className="form-grid"><label>Solicitante<input value={f.requester_name} onChange={e=>setF({...f,requester_name:e.target.value})}/></label><label>Correo<input type="email" value={f.requester_email} onChange={e=>setF({...f,requester_email:e.target.value})}/></label></div></div>
    {canWork&&<div className="form-section internal-section"><h4>Atención interna</h4><div className="form-grid"><label>Asignado a<select value={f.assigned_to} onChange={e=>setF({...f,assigned_to:e.target.value})}><option value="">Sin asignar</option>{assignees.map(m=><option value={m.user_id} key={m.user_id}>{m.profile?.full_name||'Usuario'}</option>)}</select></label><label>Estado<select value={f.status} onChange={e=>setF({...f,status:e.target.value})}>{HELP_STATUS.map(([k,l])=><option value={k} key={k}>{l}</option>)}</select></label><label>Fecha objetivo<input type="datetime-local" value={f.due_at} onChange={e=>setF({...f,due_at:e.target.value})}/></label></div></div>}
    {!canWork&&<div className="notice"><Icon name="lucide:shield-check"/><span>Tu solicitud seguirá el flujo <b>Creado → En revisión → Atendido → Resuelto → Cerrado</b>. El equipo de atención administra responsable y SLA.</span></div>}
    <div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div>
  </AsyncForm></Modal>
}

function HelpdeskDetailModal({item,departments,members,session,canWork,canManage,onClose,onEdit,onRefresh,toast}){
  const [comments,setComments]=useState([])
  const [activity,setActivity]=useState([])
  const [tab,setTab]=useState('comments')
  const [commentModal,setCommentModal]=useState(null)
  const load=async()=>{
    const [c,a]=await Promise.all([
      db.from('helpdesk_comments').select('*').eq('helpdesk_ticket_id',item.id).order('created_at'),
      db.from('helpdesk_activity').select('*').eq('helpdesk_ticket_id',item.id).order('created_at',{ascending:false})
    ])
    if(c.error) toast('error',c.error.message); else setComments(c.data||[])
    if(a.error) toast('error',a.error.message); else setActivity(a.data||[])
  }
  useEffect(()=>{load()},[item.id])
  const addComment=async text=>{const body=String(text||'').trim();if(!body)throw new Error('Escribe un comentario.');const {error}=await db.from('helpdesk_comments').insert({helpdesk_ticket_id:item.id,author_id:session.user.id,body});if(error)throw error;await load();toast('success','Comentario agregado.')}
  const editComment=async(comment,text)=>{const {error}=await db.from('helpdesk_comments').update({body:String(text||'').trim()}).eq('id',comment.id);if(error)throw error;await load();toast('success','Comentario actualizado.')}
  const deleteComment=async comment=>{const {error}=await db.from('helpdesk_comments').delete().eq('id',comment.id);if(error)throw error;await load();toast('success','Comentario eliminado.')}
  const dep=departments.find(d=>d.id===item.department_id)
  const owner=members.find(m=>m.user_id===item.assigned_to)?.profile?.full_name||'Sin asignar'
  const mayEdit=canWork
  const order=['created','review','attended','resolved','closed']
  const current=Math.max(0,order.indexOf(item.status))
  return <><Modal title={`${item.ticket_key} · ${item.subject}`} subtitle={dep?.name||'Helpdesk'} onClose={onClose} size="xl"><div className="detail-grid"><div className="detail-main">
    <div className="helpdesk-detail-progress"><div className="request-stepper">{order.map((st,i)=><div key={st} className={`${i<current?'done':''} ${i===current?'current':''}`}><i>{i<current?<Icon name="lucide:check" size={12}/>:i+1}</i><span>{helpStatusLabel(st)}</span></div>)}</div></div>
    <div className="detail-description"><h4>Descripción de la solicitud</h4><p>{item.description||'Sin descripción.'}</p></div>
    <div className="detail-tabs"><button type="button" className={tab==='comments'?'active':''} onClick={()=>setTab('comments')}>Comentarios <em>{comments.length}</em></button><button type="button" className={tab==='activity'?'active':''} onClick={()=>setTab('activity')}>Seguimiento <em>{activity.length}</em></button></div>
    {tab==='comments'?<><div className="comment-list">{comments.length===0&&<p className="muted">Todavía no hay comentarios.</p>}{comments.map(c=>{const author=members.find(m=>m.user_id===c.author_id)?.profile?.full_name||'Usuario',own=c.author_id===session.user.id;return <div className="comment" key={c.id}><span className="mini-avatar">{initials(author)}</span><div className="comment-body"><div className="comment-head"><div><b>{author}</b><small>{formatDateTime(c.created_at)}</small></div>{own&&<button type="button" className="icon-button" onClick={()=>setCommentModal({type:'actions',comment:c})}><Icon name="lucide:ellipsis" size={16}/></button>}</div><p>{c.body}</p></div></div>})}</div><div className="comment-create-row"><button type="button" className="primary compact" onClick={()=>setCommentModal({type:'create'})}><Icon name="lucide:message-square-plus"/> Agregar comentario</button></div></>:<div className="activity-list">{activity.length===0&&<p className="muted">Sin movimientos registrados.</p>}{activity.map(a=><div className="activity-item" key={a.id}><span className="activity-dot"></span><div><b>{a.action==='created'?'Solicitud creada':a.action==='status_changed'?'Cambio de estado':a.action==='assigned'?'Asignación':'Actividad'}</b><p>{a.from_value&&`${helpStatusLabel(a.from_value)} → `}{a.action==='status_changed'?helpStatusLabel(a.to_value):a.to_value}</p><small>{formatDateTime(a.created_at)}</small></div></div>)}</div>}
  </div><aside className="detail-aside">{mayEdit&&<button type="button" className="primary full" onClick={onEdit}><Icon name="lucide:pencil"/> Editar solicitud</button>}<DetailRow label="Estado"><HelpStatusBadge status={item.status}/></DetailRow><DetailRow label="Prioridad"><span className={`priority-badge priority-${item.priority}`}>{PRIORITY_LABELS[item.priority]}</span></DetailRow><DetailRow label="Departamento">{dep?.name||'—'}</DetailRow><DetailRow label="Asignado">{owner}</DetailRow><DetailRow label="Solicitante">{item.requester_name||'—'}</DetailRow><DetailRow label="Correo">{item.requester_email||'—'}</DetailRow><DetailRow label="Creado">{formatDateTime(item.created_at)}</DetailRow><DetailRow label="En revisión">{formatDateTime(item.reviewed_at)}</DetailRow><DetailRow label="Atendido">{formatDateTime(item.attended_at)}</DetailRow><DetailRow label="Objetivo SLA">{formatDateTime(item.due_at)}</DetailRow><DetailRow label="Resuelto">{formatDateTime(item.resolved_at)}</DetailRow><DetailRow label="Cerrado">{formatDateTime(item.closed_at)}</DetailRow></aside></div></Modal>
    {commentModal?.type==='create'&&<CommentEditModal title="Agregar comentario" initial="" onClose={()=>setCommentModal(null)} onSave={async text=>{await addComment(text);setCommentModal(null)}}/>}
    {commentModal?.type==='actions'&&<ActionSheet title="Comentario" subtitle="Selecciona una acción" onClose={()=>setCommentModal(null)} actions={[['lucide:pencil','Editar comentario',()=>setCommentModal({type:'edit',comment:commentModal.comment})],['lucide:trash-2','Eliminar comentario',()=>setCommentModal({type:'delete',comment:commentModal.comment}),'danger']]}/>} 
    {commentModal?.type==='edit'&&<CommentEditModal title="Editar comentario" initial={commentModal.comment.body} onClose={()=>setCommentModal(null)} onSave={async text=>{await editComment(commentModal.comment,text);setCommentModal(null)}}/>}
    {commentModal?.type==='delete'&&<ConfirmModal title="Eliminar comentario" message="Este comentario se eliminará definitivamente." danger onClose={()=>setCommentModal(null)} onConfirm={async()=>{await deleteComment(commentModal.comment);setCommentModal(null)}}/>}
  </>
}

function HelpFilterModal({filters,departments,members,onClose,onApply}){const [f,setF]=useState({...filters});return <Modal title="Filtros de Helpdesk" onClose={onClose}><AsyncForm onSubmit={()=>onApply(f)} submitLabel="Aplicar filtros"><div className="form-grid"><label>Estado<select value={f.status} onChange={e=>setF({...f,status:e.target.value})}><option value="all">Todos</option>{HELP_STATUS.map(([k,l])=><option value={k} key={k}>{l}</option>)}</select></label><label>Área<select value={f.department} onChange={e=>setF({...f,department:e.target.value})}><option value="all">Todas</option>{departments.map(d=><option value={d.id} key={d.id}>{d.name}</option>)}</select></label><label>Asignado<select value={f.assignee} onChange={e=>setF({...f,assignee:e.target.value})}><option value="all">Todos</option>{members.map(m=><option value={m.user_id} key={m.user_id}>{m.profile?.full_name||'Usuario'}</option>)}</select></label><label>Prioridad<select value={f.priority} onChange={e=>setF({...f,priority:e.target.value})}><option value="all">Todas</option>{PRIORITIES.map(p=><option value={p} key={p}>{PRIORITY_LABELS[p]}</option>)}</select></label></div></AsyncForm></Modal>}

function InviteModal({workspace,isSuperadmin,onClose,onSaved}){
  const [email,setEmail]=useState(''),[name,setName]=useState(''),[role,setRole]=useState('reporter')
  const roles=Object.entries(ROLE_LABELS).filter(([k])=>isSuperadmin||k!=='superadmin')
  return <Modal title="Invitar colaborador" subtitle="El rol se aplicará únicamente dentro de este workspace." onClose={onClose}><AsyncForm onSubmit={async()=>{const {data,error}=await db.functions.invoke('invite-member',{body:{email,full_name:name.trim()||null,role,workspace_id:workspace.id,redirect_to:getAppUrl()}});if(error||data?.error)throw new Error(error?.message||data.error);await onSaved()}} submitLabel="Enviar invitación">
    <label>Nombre del colaborador <span className="optional">Opcional</span><input value={name} onChange={e=>setName(e.target.value)} placeholder="Nombre y apellido"/></label>
    <label>Correo<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="colaborador@trobbu.com"/></label>
    <label>Rol<select value={role} onChange={e=>setRole(e.target.value)}>{roles.map(([k,l])=><option value={k} key={k}>{l}</option>)}</select><small className="field-help">{ROLE_DESCRIPTIONS[role]}</small></label>
    <div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div>
  </AsyncForm></Modal>
}

function MemberModal({member,session,isSuperadmin,onClose,onSave}){
  const [role,setRole]=useState(member.role),[active,setActive]=useState(member.active)
  const self=member.user_id===session.user.id
  const roles=Object.entries(ROLE_LABELS).filter(([k])=>isSuperadmin||k!=='superadmin')
  return <Modal title="Editar colaborador" subtitle={member.profile?.full_name||'Usuario'} onClose={onClose}><AsyncForm onSubmit={()=>onSave({role,active})} submitLabel="Guardar cambios">
    <label>Rol<select value={role} onChange={e=>setRole(e.target.value)} disabled={self}>{roles.map(([k,l])=><option value={k} key={k}>{l}</option>)}</select><small className="field-help">{ROLE_DESCRIPTIONS[role]}</small></label>
    <Toggle label="Acceso activo" checked={active} onChange={setActive} disabled={self}/>
    {self&&<div className="notice">No puedes desactivar ni cambiar tu propio rol desde esta pantalla.</div>}
    <div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div>
  </AsyncForm></Modal>
}

function ProductModal({title,initial,onClose,onSave}){const [f,setF]=useState({name:initial?.name||'',key:initial?.key||'',description:initial?.description||''});return <Modal title={title} onClose={onClose}><AsyncForm onSubmit={()=>onSave({...f,key:f.key.trim().toUpperCase()})} submitLabel="Guardar producto"><label>Nombre<input value={f.name} onChange={e=>setF({...f,name:e.target.value})} required/></label><label>Clave<input value={f.key} onChange={e=>setF({...f,key:e.target.value.replace(/[^A-Za-z0-9]/g,'').slice(0,6)})} required placeholder="WEB"/></label><label>Descripción<textarea rows="3" value={f.description} onChange={e=>setF({...f,description:e.target.value})}/></label></AsyncForm></Modal>}
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

function QuickHelpModal({helpdeskEnabled,onClose,onHelpdesk,onSettings}){return <Modal title="Centro de ayuda" subtitle="Accesos rápidos y guía del Jira Interno TROBBU." onClose={onClose}><div className="help-grid">{helpdeskEnabled?<button onClick={onHelpdesk}><span><Icon name="lucide:life-buoy"/></span><div><b>Abrir Helpdesk</b><p>Registra o atiende solicitudes internas de otras áreas.</p></div><Icon name="lucide:chevron-right"/></button>:<button onClick={onSettings}><span><Icon name="lucide:life-buoy"/></span><div><b>Helpdesk deshabilitado</b><p>Actívalo desde Configuración para recibir solicitudes internas.</p></div><Icon name="lucide:settings"/></button>}<button onClick={onSettings}><span><Icon name="lucide:settings"/></span><div><b>Configuración</b><p>Administra workspace, productos, sprints y notificaciones.</p></div><Icon name="lucide:chevron-right"/></button><div className="shortcut-card"><span><Icon name="lucide:keyboard"/></span><div><b>Atajo de búsqueda</b><p>Usa <kbd>⌘ K</kbd> o <kbd>Ctrl K</kbd> para enfocar el buscador global.</p></div></div></div></Modal>}

ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>)
