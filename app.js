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
  ['new','Nuevo','lucide:sparkles'],
  ['triage','Clasificación','lucide:list-filter'],
  ['in_progress','En atención','lucide:loader-circle'],
  ['waiting_requester','Esperando solicitante','lucide:hourglass'],
  ['resolved','Resuelto','lucide:circle-check'],
  ['closed','Cerrado','lucide:badge-check']
]
const PRIORITIES = ['lowest','low','medium','high','highest','blocker']
const PRIORITY_LABELS = {lowest:'Muy baja',low:'Baja',medium:'Media',high:'Alta',highest:'Muy alta',blocker:'Bloqueante'}
const TYPES = ['task','bug','story','improvement']
const TYPE_LABELS = {task:'Tarea',bug:'Bug',story:'Historia',improvement:'Mejora'}
const ROLE_LABELS = {admin:'Administrador',pm:'Project Manager',dev:'Desarrollo',qa:'QA',viewer:'Solo lectura'}
const Icon = ({name,size=18}) => <iconify-icon icon={name} width={size} height={size}></iconify-icon>
const initials = value => String(value || '?').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()
const statusLabel = value => STATUS.find(x=>x[0]===value)?.[1] || value
const statusIcon = value => STATUS.find(x=>x[0]===value)?.[2] || 'lucide:circle'
const helpStatusLabel = value => HELP_STATUS.find(x=>x[0]===value)?.[1] || value
const helpStatusIcon = value => HELP_STATUS.find(x=>x[0]===value)?.[2] || 'lucide:circle'
const formatDate = value => value ? new Intl.DateTimeFormat('es-MX',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(`${value}T12:00:00`)) : '—'
const formatDateTime = value => value ? new Intl.DateTimeFormat('es-MX',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value)) : '—'
const slugify = value => String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')

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
      <label>Correo<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></label>
      <label>Contraseña<input type="password" minLength="6" value={password} onChange={e=>setPassword(e.target.value)} required /></label>
      <button className="primary full" disabled={submitting}>{submitting?'Procesando…':mode==='login'?'Iniciar sesión':'Crear cuenta'}</button>
    </form>
    <button className="text-button" onClick={()=>{setMode(mode==='login'?'signup':'login');setMsg('')}}>{mode==='login'?'Crear una cuenta':'Ya tengo cuenta'}</button>
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
    const {data,error}=await db.from('workspace_members').select('workspace_id,role,active,workspaces(id,name,slug,created_by)').eq('active',true)
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
    const [p,s,t,m,ws,d,h,n]=await Promise.all([
      db.from('products').select('*').eq('workspace_id',workspace.id).order('board_order'),
      db.from('sprints').select('*').eq('workspace_id',workspace.id).order('created_at',{ascending:false}),
      db.from('tickets').select('*').eq('workspace_id',workspace.id).order('updated_at',{ascending:false}),
      db.from('workspace_members').select('user_id,role,active,joined_at').eq('workspace_id',workspace.id).order('joined_at'),
      db.from('workspace_settings').select('*').eq('workspace_id',workspace.id).maybeSingle(),
      db.from('helpdesk_departments').select('*').eq('workspace_id',workspace.id).order('name'),
      db.from('helpdesk_tickets').select('*').eq('workspace_id',workspace.id).order('updated_at',{ascending:false}),
      db.from('notifications').select('*').eq('workspace_id',workspace.id).order('created_at',{ascending:false}).limit(100)
    ])
    const fail=[p,s,t,m,ws,d,h,n].find(x=>x.error)?.error
    if(fail){showToast('error',fail.message);setBusy(false);return}
    const ids=(m.data||[]).map(x=>x.user_id)
    const profileMap={}
    if(ids.length){const pr=await db.from('profiles').select('*').in('id',ids); (pr.data||[]).forEach(x=>profileMap[x.id]=x)}
    setProducts(p.data||[]); setSprints(s.data||[]); setTickets(t.data||[]); setSettings(ws.data||null)
    setDepartments(d.data||[]); setHelpdesk(h.data||[]); setNotifications(n.data||[])
    setMembers((m.data||[]).map(x=>({...x,profile:profileMap[x.user_id]})))
    setBusy(false)
  }

  useEffect(()=>{loadMemberships().then(()=>setBusy(false))},[])
  useEffect(()=>{loadWorkspaceData()},[workspace?.id])

  const myRole=memberships.find(m=>m.workspace_id===workspace?.id)?.role || 'viewer'
  const canManage=['admin','pm'].includes(myRole)
  const canWork=['admin','pm','dev','qa'].includes(myRole)
  const workspaces=memberships.map(m=>({...m.workspaces,role:m.role})).filter(Boolean)
  const unread=notifications.filter(n=>!n.read_at).length

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
    const payload={...form,workspace_id:workspace.id,reporter_id:ticket?.reporter_id||session.user.id,sprint_id:form.sprint_id||null,dev_owner_id:form.dev_owner_id||null,qa_owner_id:form.qa_owner_id||null,story_points:form.story_points===''||form.story_points==null?null:Number(form.story_points),due_date:form.due_date||null}
    const result=ticket ? await db.from('tickets').update(payload).eq('id',ticket.id) : await db.from('tickets').insert(payload)
    if(result.error) throw result.error
    await refresh(); runEmails(); showToast('success',ticket?'Ticket actualizado.':'Ticket creado.')
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

  const saveHelpdesk=async(form,item=null)=>{
    const payload={...form,workspace_id:workspace.id,requester_user_id:item?.requester_user_id||session.user.id,department_id:form.department_id||null,assigned_to:form.assigned_to||null,due_at:form.due_at||null,requester_email:form.requester_email||session.user.email}
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

  if(!workspace && !busy) return <EmptyWorkspace onCreate={()=>setModal({type:'workspace-create'})}/>

  return <div className="app-shell">
    <Topbar session={session} unread={unread} search={search} setSearch={setSearch} onCreate={()=>setModal({type:'ticket-create'})} onNotifications={()=>setDrawer('notifications')}/>
    <Sidebar workspace={workspace} workspaces={workspaces} products={products} productId={productId} setProductId={setProductId} view={view} setView={setView} tickets={tickets} helpdesk={helpdesk} onWorkspace={()=>setModal({type:'workspace-switch'})} canManage={canManage}/>
    <main className="main-area">
      {busy ? <LoadingPanel/> : <>
        {view==='overview' && <Overview workspace={workspace} tickets={tickets} helpdesk={helpdesk} products={products}/>} 
        {view==='board' && <TicketWorkspace title="Tablero" subtitle="Consulta, filtra y gestiona tickets del equipo." tickets={filteredTickets} allTickets={tickets} products={products} members={members} sprints={sprints} boardMode={boardMode} setBoardMode={setBoardMode} filters={filters} onFilter={()=>setModal({type:'ticket-filters'})} onClearFilters={()=>setFilters({status:'all',assignee:'all',sprint:'all',priority:'all',type:'all'})} canWork={canWork} onCreate={()=>setModal({type:'ticket-create'})} onActions={ticket=>setModal({type:'ticket-actions',ticket})} onMove={moveTicket}/>} 
        {view==='mytasks' && <TicketWorkspace title="Mis tareas" subtitle="Tickets que reportaste o que tienes asignados." tickets={myTickets} allTickets={myTickets} products={products} members={members} sprints={sprints} boardMode={boardMode} setBoardMode={setBoardMode} filters={filters} onFilter={()=>setModal({type:'ticket-filters'})} onClearFilters={()=>setFilters({status:'all',assignee:'all',sprint:'all',priority:'all',type:'all'})} canWork={canWork} onCreate={()=>setModal({type:'ticket-create'})} onActions={ticket=>setModal({type:'ticket-actions',ticket})} onMove={moveTicket}/>} 
        {view==='helpdesk' && <HelpdeskView items={filteredHelpdesk} allItems={helpdesk} departments={departments} members={members} filters={helpFilters} onFilter={()=>setModal({type:'help-filters'})} onCreate={()=>setModal({type:'help-create'})} onActions={item=>setModal({type:'help-actions',item})}/>} 
        {view==='team' && <TeamView members={members} canManage={canManage} session={session} onInvite={()=>setModal({type:'invite'})} onMember={member=>setModal({type:'member-edit',member})}/>} 
        {view==='settings' && <SettingsView workspace={workspace} settings={settings} products={products} sprints={sprints} canManage={canManage} onWorkspaceEdit={()=>setModal({type:'workspace-edit'})} onWorkspaceDelete={()=>setModal({type:'workspace-delete'})} onSettingsSaved={refresh} onProductCreate={()=>setModal({type:'product-create'})} onProductEdit={product=>setModal({type:'product-edit',product})} onProductDelete={product=>setModal({type:'product-delete',product})} onSprintCreate={()=>setModal({type:'sprint-create'})} onSprintEdit={sprint=>setModal({type:'sprint-edit',sprint})} onSprintDelete={sprint=>setModal({type:'sprint-delete',sprint})} toast={showToast}/>} 
      </>}
    </main>
    {drawer==='notifications' && <NotificationsDrawer notifications={notifications} onClose={()=>setDrawer(null)} onMark={markNotification} onMarkAll={markAll} onOpen={n=>{setDrawer(null); if(n.ticket_id){const t=tickets.find(x=>x.id===n.ticket_id); if(t)setModal({type:'ticket-detail',ticket:t})} else if(n.helpdesk_ticket_id){const h=helpdesk.find(x=>x.id===n.helpdesk_ticket_id); if(h)setModal({type:'help-detail',item:h})}}}/>} 
    {modal && <ModalRouter modal={modal} setModal={setModal} workspace={workspace} workspaces={workspaces} memberships={memberships} products={products} sprints={sprints} tickets={tickets} members={members} departments={departments} settings={settings} session={session} canManage={canManage} filters={filters} setFilters={setFilters} helpFilters={helpFilters} setHelpFilters={setHelpFilters} createWorkspace={createWorkspace} saveTicket={saveTicket} deleteTicket={deleteTicket} saveHelpdesk={saveHelpdesk} deleteHelpdesk={deleteHelpdesk} refresh={refresh} loadMemberships={loadMemberships} setWorkspace={setWorkspace} toast={showToast}/>} 
    {toast && <Toast toast={toast}/>} 
  </div>
}

function Topbar({session,unread,search,setSearch,onCreate,onNotifications}){return <header className="global-topbar">
  <div className="topbar-brand"><button className="app-switcher"><Icon name="lucide:grid-2x2"/></button><img src="./logo.svg"/><span></span><b>Jira Interno</b></div>
  <div className="global-search"><Icon name="lucide:search"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar tickets por clave, título o descripción"/><kbd>⌘ K</kbd></div>
  <div className="topbar-actions"><button className="primary create-button" onClick={onCreate}><Icon name="lucide:plus"/> Crear</button><button className="icon-button bell" onClick={onNotifications}><Icon name="lucide:bell"/>{unread>0&&<em>{unread>9?'9+':unread}</em>}</button><button className="icon-button"><Icon name="lucide:circle-help"/></button><div className="top-user"><span className="avatar sm">{initials(session.user.user_metadata?.full_name||session.user.email)}</span><div><b>{session.user.user_metadata?.full_name||'Usuario'}</b><small>{session.user.email}</small></div></div></div>
</header>}

function Sidebar({workspace,workspaces,products,productId,setProductId,view,setView,tickets,helpdesk,onWorkspace,canManage}){
  const items=[['overview','lucide:layout-dashboard','Resumen'],['board','lucide:columns-3','Tablero'],['mytasks','lucide:circle-check-big','Mis tareas'],['helpdesk','lucide:life-buoy','Helpdesk'],['team','lucide:users','Equipo']]
  return <aside className="sidebar">
    <div className="sidebar-section-title"><span>ESPACIO DE TRABAJO</span>{canManage&&<button className="ghost-icon" onClick={onWorkspace}><Icon name="lucide:plus" size={16}/></button>}</div>
    <button className="workspace-card" onClick={onWorkspace}><span className="workspace-icon"><Icon name="lucide:layers-3"/></span><div><b>{workspace?.name}</b><small>{workspaces.find(w=>w.id===workspace?.id)?.role?.toUpperCase()}</small></div><Icon name="lucide:chevrons-up-down" size={16}/></button>
    <nav className="side-nav">{items.map(([key,icon,label])=><button key={key} className={view===key?'active':''} onClick={()=>setView(key)}><Icon name={icon}/><span>{label}</span>{key==='board'&&<em>{tickets.length}</em>}{key==='helpdesk'&&<em>{helpdesk.filter(h=>!['resolved','closed'].includes(h.status)).length}</em>}</button>)}</nav>
    <div className="sidebar-divider"></div><div className="sidebar-section-title"><span>PRODUCTOS</span></div>
    <button className={`product-nav ${productId==='all'?'active':''}`} onClick={()=>{setProductId('all');setView('board')}}><span className="product-dot all"><Icon name="lucide:boxes" size={15}/></span><span>Todos los productos</span><em>{tickets.length}</em></button>
    {products.map((p,i)=><button key={p.id} className={`product-nav ${productId===p.id?'active':''}`} onClick={()=>{setProductId(p.id);setView('board')}}><span className={`product-dot p${i%4}`}><Icon name={i===2?'lucide:smartphone':'lucide:monitor'} size={15}/></span><span>{p.name}</span><em>{tickets.filter(t=>t.product_id===p.id).length}</em></button>)}
    <div className="sidebar-spacer"></div><div className="sidebar-divider"></div>
    <button className={`footer-nav ${view==='settings'?'active':''}`} onClick={()=>setView('settings')}><Icon name="lucide:settings"/>Configuración</button>
    <button className={`footer-nav ${view==='helpdesk'?'active':''}`} onClick={()=>setView('helpdesk')}><Icon name="lucide:headphones"/>Soporte</button>
    <button className="footer-nav" onClick={()=>db.auth.signOut()}><Icon name="lucide:log-out"/>Cerrar sesión</button>
  </aside>
}

function PageHeader({eyebrow='Proyectos',title,subtitle,icon='lucide:clipboard-check',action}){return <div className="page-header"><div><div className="breadcrumbs"><span>{eyebrow}</span><Icon name="lucide:chevron-right" size={14}/><span>TROBBU</span></div><div className="page-title-row"><span className="page-icon"><Icon name={icon}/></span><div><h1>{title}</h1><p>{subtitle}</p></div></div></div>{action}</div>}
function LoadingPanel(){return <div className="center content-loading"><span className="loader"></span><span>Actualizando información…</span></div>}
function EmptyWorkspace({onCreate}){return <div className="empty-state"><img src="./logo.svg"/><span className="page-icon"><Icon name="lucide:layers-3" size={26}/></span><h2>Crea tu primer espacio de trabajo</h2><p>Los productos base y la configuración se crearán automáticamente.</p><button className="primary" onClick={onCreate}><Icon name="lucide:plus"/> Crear workspace</button></div>}
function Toast({toast}){return <div className={`toast ${toast.type}`}><Icon name={toast.type==='error'?'lucide:circle-alert':'lucide:circle-check'} /><span>{toast.message}</span></div>}

function Overview({workspace,tickets,helpdesk,products}){
  const open=tickets.filter(t=>!['closed'].includes(t.status)).length, qa=tickets.filter(t=>['qa_review','qa_rejected','qa_passed'].includes(t.status)).length, closed=tickets.filter(t=>t.status==='closed').length
  const supportOpen=helpdesk.filter(h=>!['resolved','closed'].includes(h.status)).length
  return <div className="page"><PageHeader title="Resumen" subtitle={`Estado general de ${workspace.name}`} icon="lucide:layout-dashboard"/>
    <div className="metric-grid four"><Metric label="Tickets totales" value={tickets.length} icon="lucide:ticket" tone="blue"/><Metric label="Trabajo abierto" value={open} icon="lucide:loader-circle" tone="orange"/><Metric label="En QA" value={qa} icon="lucide:scan-search" tone="purple"/><Metric label="Helpdesk abierto" value={supportOpen} icon="lucide:life-buoy" tone="green"/></div>
    <div className="dashboard-grid"><section className="panel"><div className="panel-heading"><div><h3>Avance por producto</h3><p>Tickets cerrados frente al total.</p></div></div>{products.map(p=>{const total=tickets.filter(t=>t.product_id===p.id).length,done=tickets.filter(t=>t.product_id===p.id&&t.status==='closed').length,pct=total?Math.round(done/total*100):0;return <div className="progress-row" key={p.id}><div><b>{p.name}</b><span>{done}/{total} cerrados</span></div><div className="progress-track"><i style={{width:`${pct}%`}}></i></div><strong>{pct}%</strong></div>})}</section>
    <section className="panel"><div className="panel-heading"><div><h3>Flujo actual</h3><p>Distribución por estado.</p></div></div><div className="status-stack">{STATUS.map(([key,label])=><div key={key}><span><Icon name={statusIcon(key)} size={15}/>{label}</span><b>{tickets.filter(t=>t.status===key).length}</b></div>)}</div></section></div>
  </div>
}
function Metric({label,value,icon,tone}){return <div className={`metric-card ${tone}`}><span className="metric-icon"><Icon name={icon}/></span><div><small>{label}</small><strong>{value}</strong></div></div>}

function TicketWorkspace({title,subtitle,tickets,allTickets,products,members,sprints,boardMode,setBoardMode,filters,onFilter,onClearFilters,canWork,onCreate,onActions,onMove}){
  const activeFilters=Object.values(filters).filter(v=>v!=='all').length
  return <div className="page"><PageHeader title={title} subtitle={subtitle} action={<button className="primary" onClick={onCreate}><Icon name="lucide:plus"/> Nuevo ticket</button>}/>
    <section className="workspace-panel"><div className="panel-toolbar"><div className="tabs"><button className={boardMode==='table'?'active':''} onClick={()=>setBoardMode('table')}><Icon name="lucide:table-2"/>Tabla</button><button className={boardMode==='kanban'?'active':''} onClick={()=>setBoardMode('kanban')}><Icon name="lucide:columns-3"/>Kanban</button></div><div className="toolbar-actions"><button className={`filter-button ${activeFilters?'active':''}`} onClick={onFilter}><Icon name="lucide:list-filter"/> Filtros {activeFilters>0&&<em>{activeFilters}</em>}</button>{activeFilters>0&&<button className="text-button" onClick={onClearFilters}>Limpiar</button>}<button className="primary compact" onClick={onCreate}><Icon name="lucide:plus"/> Nuevo</button></div></div>
    <div className="mini-stats"><span>Total <b>{allTickets.length}</b></span><span className="amber">En desarrollo <b>{allTickets.filter(t=>['todo','in_progress','dev_done'].includes(t.status)).length}</b></span><span className="blue">En QA <b>{allTickets.filter(t=>['qa_review','qa_rejected','qa_passed'].includes(t.status)).length}</b></span><span className="green">Cerrados <b>{allTickets.filter(t=>t.status==='closed').length}</b></span></div>
    {boardMode==='table'?<TicketTable tickets={tickets} products={products} members={members} onActions={onActions}/>:<Kanban tickets={tickets} products={products} members={members} canWork={canWork} onActions={onActions} onMove={onMove}/>} 
    </section>
  </div>
}

function TicketTable({tickets,products,members,onActions}){return <div className="table-wrap"><div className="table modern-table"><div className="tr th"><span>TICKET</span><span>PROYECTO</span><span>RESPONSABLE</span><span>FECHA LÍMITE</span><span>ESTADO</span><span></span></div>{tickets.length===0&&<TableEmpty text="No hay tickets con estos criterios."/>}{tickets.map(t=>{const p=products.find(x=>x.id===t.product_id),dev=members.find(m=>m.user_id===t.dev_owner_id)?.profile?.full_name,qa=members.find(m=>m.user_id===t.qa_owner_id)?.profile?.full_name,owner=dev||qa||'Sin asignar';return <div className="tr" key={t.id}><span className="task-cell"><b>{t.title}</b><small>{t.ticket_key} · {TYPE_LABELS[t.type]}</small></span><span><span className="product-cell-icon"><Icon name="lucide:folder" size={14}/></span>{p?.name||'—'}</span><span className="assignee-cell"><span className="mini-avatar">{initials(owner)}</span>{owner}</span><span>{formatDate(t.due_date)}</span><span><StatusBadge status={t.status}/></span><span><button className="icon-button" onClick={()=>onActions(t)} title="Acciones"><Icon name="lucide:ellipsis-vertical"/></button></span></div>})}</div></div>}
function TableEmpty({text}){return <div className="table-empty"><Icon name="lucide:inbox" size={32}/><b>Sin resultados</b><span>{text}</span></div>}
function StatusBadge({status}){return <span className={`status-badge status-badge-${status}`}><Icon name={statusIcon(status)} size={13}/>{statusLabel(status)}</span>}
function HelpStatusBadge({status}){return <span className={`help-status help-${status}`}><Icon name={helpStatusIcon(status)} size={13}/>{helpStatusLabel(status)}</span>}

function Kanban({tickets,products,members,canWork,onActions,onMove}){return <div className="kanban-shell">{STATUS.map(([key,label,icon])=>{const rows=tickets.filter(t=>t.status===key);return <div className="kanban-column" key={key} onDragOver={e=>canWork&&e.preventDefault()} onDrop={e=>{if(!canWork)return;const id=e.dataTransfer.getData('text/plain');const t=tickets.find(x=>x.id===id);if(t)onMove(t,key)}}><div className="kanban-head"><span><Icon name={icon} size={16}/>{label}</span><b>{rows.length}</b></div><div className="kanban-list">{rows.map(t=><TicketCard key={t.id} ticket={t} product={products.find(p=>p.id===t.product_id)} members={members} canWork={canWork} onActions={onActions}/>)}</div></div>})}</div>}
function TicketCard({ticket,product,members,canWork,onActions}){const dev=members.find(m=>m.user_id===ticket.dev_owner_id)?.profile?.full_name,qa=members.find(m=>m.user_id===ticket.qa_owner_id)?.profile?.full_name,owner=dev||qa||'Sin asignar';return <article className="ticket-card" draggable={canWork} onDragStart={e=>e.dataTransfer.setData('text/plain',ticket.id)}><div className="ticket-card-top"><small>{ticket.ticket_key}</small><button className="icon-button" onClick={()=>onActions(ticket)}><Icon name="lucide:ellipsis"/></button></div><h4>{ticket.title}</h4><div className="card-meta"><span className="mini-avatar">{initials(owner)}</span><span>{owner}</span>{ticket.due_date&&<><i>•</i><span>{formatDate(ticket.due_date)}</span></>}</div><div className="card-footer"><span className="product-badge"><Icon name="lucide:folder" size={13}/>{product?.name||'Producto'}</span><span className={`priority-badge priority-${ticket.priority}`}>{PRIORITY_LABELS[ticket.priority]}</span></div></article>}

function HelpdeskView({items,allItems,departments,members,filters,onFilter,onCreate,onActions}){
  const open=allItems.filter(h=>['new','triage','in_progress','waiting_requester'].includes(h.status)).length,resolved=allItems.filter(h=>h.status==='resolved').length,closed=allItems.filter(h=>h.status==='closed').length,active=Object.values(filters).filter(v=>v!=='all').length
  return <div className="page"><PageHeader eyebrow="Servicio interno" title="Helpdesk" subtitle="Recibe solicitudes de otras áreas y gestiona su atención con el mismo equipo." icon="lucide:life-buoy" action={<button className="primary" onClick={onCreate}><Icon name="lucide:plus"/> Nueva solicitud</button>}/>
    <div className="metric-grid four"><Metric label="Solicitudes" value={allItems.length} icon="lucide:inbox" tone="blue"/><Metric label="Abiertas" value={open} icon="lucide:loader-circle" tone="orange"/><Metric label="Resueltas" value={resolved} icon="lucide:circle-check" tone="green"/><Metric label="Cerradas" value={closed} icon="lucide:badge-check" tone="navy"/></div>
    <section className="workspace-panel"><div className="panel-toolbar"><div><h3>Solicitudes internas</h3><p className="muted">Reservaciones, Operaciones, Finanzas, Comercial y otras áreas.</p></div><div className="toolbar-actions"><button className={`filter-button ${active?'active':''}`} onClick={onFilter}><Icon name="lucide:list-filter"/> Filtros {active>0&&<em>{active}</em>}</button><button className="primary compact" onClick={onCreate}><Icon name="lucide:plus"/> Crear</button></div></div>
    <div className="table-wrap"><div className="table help-table"><div className="tr th"><span>SOLICITUD</span><span>ÁREA</span><span>ASIGNADO</span><span>PRIORIDAD</span><span>ESTADO</span><span></span></div>{items.length===0&&<TableEmpty text="No hay solicitudes con estos filtros."/>}{items.map(h=>{const dep=departments.find(d=>d.id===h.department_id),owner=members.find(m=>m.user_id===h.assigned_to)?.profile?.full_name||'Sin asignar';return <div className="tr" key={h.id}><span className="task-cell"><b>{h.subject}</b><small>{h.ticket_key} · {h.category}</small></span><span><span className="dept-dot" style={{background:dep?.color||'#D4DCE0'}}></span>{dep?.name||'Sin área'}</span><span className="assignee-cell"><span className="mini-avatar">{initials(owner)}</span>{owner}</span><span><span className={`priority-badge priority-${h.priority}`}>{PRIORITY_LABELS[h.priority]}</span></span><span><HelpStatusBadge status={h.status}/></span><span><button className="icon-button" onClick={()=>onActions(h)}><Icon name="lucide:ellipsis-vertical"/></button></span></div>})}</div></div></section>
  </div>
}

function TeamView({members,canManage,session,onInvite,onMember}){return <div className="page"><PageHeader title="Equipo" subtitle="Administra colaboradores, roles y acceso al workspace." icon="lucide:users" action={canManage?<button className="primary" onClick={onInvite}><Icon name="lucide:user-plus"/> Invitar colaborador</button>:null}/><section className="workspace-panel"><div className="member-grid">{members.map(m=><div className="member-card" key={m.user_id}><span className="avatar">{initials(m.profile?.full_name)}</span><div className="member-info"><b>{m.profile?.full_name||'Usuario'}{m.user_id===session.user.id&&<small> Tú</small>}</b><span>{m.profile?.job_title||ROLE_LABELS[m.role]}</span></div><em>{ROLE_LABELS[m.role]}</em>{canManage&&<button className="icon-button" onClick={()=>onMember(m)}><Icon name="lucide:ellipsis-vertical"/></button>}</div>)}</div></section></div>}

function SettingsView({workspace,settings,products,sprints,canManage,onWorkspaceEdit,onWorkspaceDelete,onSettingsSaved,onProductCreate,onProductEdit,onProductDelete,onSprintCreate,onSprintEdit,onSprintDelete,toast}){
  const [tab,setTab]=useState('workspace')
  return <div className="page"><PageHeader title="Configuración" subtitle="Gestiona el espacio, productos, sprints y reglas operativas." icon="lucide:settings"/><section className="workspace-panel settings-panel"><div className="settings-tabs"><button className={tab==='workspace'?'active':''} onClick={()=>setTab('workspace')}>Workspace</button><button className={tab==='products'?'active':''} onClick={()=>setTab('products')}>Productos</button><button className={tab==='sprints'?'active':''} onClick={()=>setTab('sprints')}>Sprints</button></div>{tab==='workspace'&&<WorkspaceSettings workspace={workspace} settings={settings} canManage={canManage} onEdit={onWorkspaceEdit} onDelete={onWorkspaceDelete} onSaved={onSettingsSaved} toast={toast}/>} {tab==='products'&&<EntitySettings title="Productos" subtitle="Tableros separados para cada producto." items={products} canManage={canManage} onCreate={onProductCreate} render={p=><><div><b>{p.name}</b><span>{p.key} · {p.description||'Sin descripción'}</span></div><div className="row-actions"><button onClick={()=>onProductEdit(p)}><Icon name="lucide:pencil"/>Editar</button><button className="danger-text" onClick={()=>onProductDelete(p)}><Icon name="lucide:trash-2"/>Eliminar</button></div></>}/>} {tab==='sprints'&&<EntitySettings title="Sprints" subtitle="Planeación y periodos de trabajo." items={sprints} canManage={canManage} onCreate={onSprintCreate} render={s=><><div><b>{s.name}</b><span>{s.status} · {formatDate(s.start_date)} — {formatDate(s.end_date)}</span></div><div className="row-actions"><button onClick={()=>onSprintEdit(s)}><Icon name="lucide:pencil"/>Editar</button><button className="danger-text" onClick={()=>onSprintDelete(s)}><Icon name="lucide:trash-2"/>Eliminar</button></div></>}/>}</section></div>
}
function WorkspaceSettings({workspace,settings,canManage,onEdit,onDelete,onSaved,toast}){const [f,setF]=useState(settings||{});useEffect(()=>setF(settings||{}),[settings?.workspace_id]);const save=async()=>{const {error}=await db.from('workspace_settings').update({timezone:f.timezone,default_sprint_days:Number(f.default_sprint_days),email_notifications:!!f.email_notifications,in_app_notifications:!!f.in_app_notifications,helpdesk_enabled:!!f.helpdesk_enabled,support_email:f.support_email||null,sla_first_response_hours:Number(f.sla_first_response_hours),sla_resolution_hours:Number(f.sla_resolution_hours)}).eq('workspace_id',workspace.id);if(error)return toast('error',error.message);toast('success','Configuración guardada.');onSaved()};return <div className="settings-content"><div className="settings-card"><div className="settings-card-head"><div><h3>{workspace.name}</h3><p>Datos generales del espacio.</p></div>{canManage&&<button className="secondary-button" onClick={onEdit}><Icon name="lucide:pencil"/> Editar nombre</button>}</div><div className="form-grid"><label>Zona horaria<input value={f.timezone||''} onChange={e=>setF({...f,timezone:e.target.value})} disabled={!canManage}/></label><label>Duración de sprint (días)<input type="number" value={f.default_sprint_days||14} onChange={e=>setF({...f,default_sprint_days:e.target.value})} disabled={!canManage}/></label><label>Correo de soporte<input type="email" value={f.support_email||''} onChange={e=>setF({...f,support_email:e.target.value})} disabled={!canManage}/></label><label>SLA primera respuesta (hrs)<input type="number" value={f.sla_first_response_hours||4} onChange={e=>setF({...f,sla_first_response_hours:e.target.value})} disabled={!canManage}/></label><label>SLA resolución (hrs)<input type="number" value={f.sla_resolution_hours||24} onChange={e=>setF({...f,sla_resolution_hours:e.target.value})} disabled={!canManage}/></label></div><div className="toggle-list"><Toggle label="Notificaciones dentro de la plataforma" checked={!!f.in_app_notifications} onChange={v=>setF({...f,in_app_notifications:v})} disabled={!canManage}/><Toggle label="Notificaciones por correo" checked={!!f.email_notifications} onChange={v=>setF({...f,email_notifications:v})} disabled={!canManage}/><Toggle label="Helpdesk habilitado" checked={!!f.helpdesk_enabled} onChange={v=>setF({...f,helpdesk_enabled:v})} disabled={!canManage}/></div>{canManage&&<div className="settings-actions"><button className="danger-outline" onClick={onDelete}><Icon name="lucide:trash-2"/> Eliminar workspace</button><button className="primary" onClick={save}><Icon name="lucide:save"/> Guardar cambios</button></div>}</div></div>}
function Toggle({label,checked,onChange,disabled}){return <label className={`toggle-row ${disabled?'disabled':''}`}><span>{label}</span><button type="button" className={`switch ${checked?'on':''}`} onClick={()=>!disabled&&onChange(!checked)}><i></i></button></label>}
function EntitySettings({title,subtitle,items,canManage,onCreate,render}){return <div className="settings-content"><div className="settings-list-head"><div><h3>{title}</h3><p>{subtitle}</p></div>{canManage&&<button className="primary compact" onClick={onCreate}><Icon name="lucide:plus"/> Nuevo</button>}</div><div className="entity-list">{items.length===0&&<div className="empty-inline">Sin registros todavía.</div>}{items.map(item=><div className="entity-row" key={item.id}>{render(item)}</div>)}</div></div>}

function NotificationsDrawer({notifications,onClose,onMark,onMarkAll,onOpen}){return <div className="drawer-backdrop" onMouseDown={onClose}><aside className="drawer" onMouseDown={e=>e.stopPropagation()}><div className="drawer-head"><div><span className="eyebrow">CENTRO DE ACTIVIDAD</span><h2>Notificaciones</h2></div><button className="icon-button" onClick={onClose}><Icon name="lucide:x"/></button></div><div className="drawer-toolbar"><button className="text-button" onClick={onMarkAll}>Marcar todas como leídas</button></div><div className="notification-list">{notifications.length===0&&<div className="empty-notifications"><Icon name="lucide:bell-off" size={30}/><b>Sin notificaciones</b><span>Las asignaciones, revisiones y solicitudes aparecerán aquí.</span></div>}{notifications.map(n=><button key={n.id} className={`notification-item ${n.read_at?'':'unread'}`} onClick={()=>{onMark(n.id,true);onOpen(n)}}><span className="notification-icon"><Icon name={n.type.includes('helpdesk')?'lucide:life-buoy':n.type==='qa_rejected'?'lucide:circle-x':'lucide:ticket'} /></span><div><b>{n.title}</b><p>{n.body}</p><small>{formatDateTime(n.created_at)}</small></div>{!n.read_at&&<i></i>}</button>)}</div></aside></div>}

function ModalRouter(props){const {modal,setModal}=props;const close=()=>setModal(null)
  if(modal.type==='workspace-create') return <WorkspaceModal title="Crear espacio de trabajo" onClose={close} onSave={async f=>{await props.createWorkspace(f);close()}}/>
  if(modal.type==='workspace-switch') return <WorkspaceSwitcherModal workspaces={props.workspaces} current={props.workspace} canManage={props.canManage} onClose={close} onSelect={w=>{props.setWorkspace(w);close()}} onCreate={()=>setModal({type:'workspace-create'})}/>
  if(modal.type==='workspace-edit') return <WorkspaceModal title="Editar espacio" initial={{name:props.workspace.name}} onClose={close} onSave={async f=>{const {error}=await db.from('workspaces').update({name:f.name}).eq('id',props.workspace.id);if(error)throw error;await props.loadMemberships(props.workspace.id);props.toast('success','Workspace actualizado.');close()}}/>
  if(modal.type==='workspace-delete') return <ConfirmModal title="Eliminar workspace" message="Se eliminarán productos, sprints, tickets, Helpdesk y configuración de este espacio. Esta acción no se puede deshacer." danger onClose={close} onConfirm={async()=>{const {error}=await db.from('workspaces').delete().eq('id',props.workspace.id);if(error)throw error;await props.loadMemberships();props.toast('success','Workspace eliminado.');close()}}/>
  if(modal.type==='ticket-create') return <TicketModal title="Crear ticket" workspace={props.workspace} products={props.products} sprints={props.sprints} members={props.members} onClose={close} onSave={async f=>{await props.saveTicket(f);close()}}/>
  if(modal.type==='ticket-edit') return <TicketModal title={`Editar ${modal.ticket.ticket_key}`} ticket={modal.ticket} workspace={props.workspace} products={props.products} sprints={props.sprints} members={props.members} onClose={close} onSave={async f=>{await props.saveTicket(f,modal.ticket);close()}}/>
  if(modal.type==='ticket-detail') return <TicketDetailModal ticket={modal.ticket} products={props.products} members={props.members} session={props.session} onClose={close} onEdit={()=>setModal({type:'ticket-edit',ticket:modal.ticket})} onRefresh={props.refresh} toast={props.toast}/>
  if(modal.type==='ticket-actions') return <ActionSheet title={modal.ticket.ticket_key} subtitle={modal.ticket.title} onClose={close} actions={[['lucide:eye','Ver detalle',()=>setModal({type:'ticket-detail',ticket:modal.ticket})],['lucide:pencil','Editar ticket',()=>setModal({type:'ticket-edit',ticket:modal.ticket})],['lucide:trash-2','Eliminar ticket',()=>setModal({type:'ticket-delete',ticket:modal.ticket}),'danger']]}/>
  if(modal.type==='ticket-delete') return <ConfirmModal title={`Eliminar ${modal.ticket.ticket_key}`} message={`¿Deseas eliminar “${modal.ticket.title}”? También se eliminarán comentarios e historial asociado.`} danger onClose={close} onConfirm={async()=>{await props.deleteTicket(modal.ticket);close()}}/>
  if(modal.type==='ticket-filters') return <TicketFilterModal filters={props.filters} members={props.members} sprints={props.sprints} onClose={close} onApply={f=>{props.setFilters(f);close()}}/>
  if(modal.type==='help-create') return <HelpdeskModal title="Nueva solicitud de Helpdesk" departments={props.departments} members={props.members} session={props.session} onClose={close} onSave={async f=>{await props.saveHelpdesk(f);close()}}/>
  if(modal.type==='help-edit') return <HelpdeskModal title={`Editar ${modal.item.ticket_key}`} item={modal.item} departments={props.departments} members={props.members} session={props.session} onClose={close} onSave={async f=>{await props.saveHelpdesk(f,modal.item);close()}}/>
  if(modal.type==='help-detail') return <HelpdeskDetailModal item={modal.item} departments={props.departments} members={props.members} session={props.session} onClose={close} onEdit={()=>setModal({type:'help-edit',item:modal.item})} onRefresh={props.refresh} toast={props.toast}/>
  if(modal.type==='help-actions') return <ActionSheet title={modal.item.ticket_key} subtitle={modal.item.subject} onClose={close} actions={[['lucide:eye','Ver solicitud',()=>setModal({type:'help-detail',item:modal.item})],['lucide:pencil','Editar solicitud',()=>setModal({type:'help-edit',item:modal.item})],['lucide:trash-2','Eliminar solicitud',()=>setModal({type:'help-delete',item:modal.item}),'danger']]}/>
  if(modal.type==='help-delete') return <ConfirmModal title={`Eliminar ${modal.item.ticket_key}`} message={`¿Deseas eliminar “${modal.item.subject}”?`} danger onClose={close} onConfirm={async()=>{await props.deleteHelpdesk(modal.item);close()}}/>
  if(modal.type==='help-filters') return <HelpFilterModal filters={props.helpFilters} departments={props.departments} members={props.members} onClose={close} onApply={f=>{props.setHelpFilters(f);close()}}/>
  if(modal.type==='invite') return <InviteModal workspace={props.workspace} onClose={close} onSaved={async()=>{await props.refresh();props.toast('success','Invitación procesada.');close()}}/>
  if(modal.type==='member-edit') return <MemberModal member={modal.member} session={props.session} onClose={close} onSave={async f=>{const {error}=await db.from('workspace_members').update({role:f.role,active:f.active}).eq('workspace_id',props.workspace.id).eq('user_id',modal.member.user_id);if(error)throw error;await props.refresh();props.toast('success','Colaborador actualizado.');close()}}/>
  if(modal.type==='product-create') return <ProductModal title="Nuevo producto" onClose={close} onSave={async f=>{const {error}=await db.from('products').insert({...f,workspace_id:props.workspace.id,board_order:props.products.length+1});if(error)throw error;await props.refresh();props.toast('success','Producto creado.');close()}}/>
  if(modal.type==='product-edit') return <ProductModal title="Editar producto" initial={modal.product} onClose={close} onSave={async f=>{const {error}=await db.from('products').update(f).eq('id',modal.product.id);if(error)throw error;await props.refresh();props.toast('success','Producto actualizado.');close()}}/>
  if(modal.type==='product-delete') return <ConfirmModal title="Eliminar producto" message="No podrás eliminar un producto si tiene tickets asociados. Reasigna o elimina esos tickets primero." danger onClose={close} onConfirm={async()=>{const {error}=await db.from('products').delete().eq('id',modal.product.id);if(error)throw error;await props.refresh();props.toast('success','Producto eliminado.');close()}}/>
  if(modal.type==='sprint-create') return <SprintModal title="Nuevo sprint" workspace={props.workspace} session={props.session} onClose={close} onSave={async f=>{const {error}=await db.from('sprints').insert({...f,workspace_id:props.workspace.id,created_by:props.session.user.id,start_date:f.start_date||null,end_date:f.end_date||null});if(error)throw error;await props.refresh();props.toast('success','Sprint creado.');close()}}/>
  if(modal.type==='sprint-edit') return <SprintModal title="Editar sprint" initial={modal.sprint} workspace={props.workspace} session={props.session} onClose={close} onSave={async f=>{const {error}=await db.from('sprints').update({...f,start_date:f.start_date||null,end_date:f.end_date||null}).eq('id',modal.sprint.id);if(error)throw error;await props.refresh();props.toast('success','Sprint actualizado.');close()}}/>
  if(modal.type==='sprint-delete') return <ConfirmModal title="Eliminar sprint" message="Los tickets del sprint pasarán a quedar sin sprint, pero no se eliminarán." danger onClose={close} onConfirm={async()=>{const {error}=await db.from('sprints').delete().eq('id',modal.sprint.id);if(error)throw error;await props.refresh();props.toast('success','Sprint eliminado.');close()}}/>
  return null
}

function Modal({title,subtitle,onClose,children,size='md'}){return <div className="modal-backdrop" onMouseDown={onClose}><div className={`modal modal-${size}`} onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">JIRA INTERNO</span><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div><button className="icon-button" onClick={onClose}><Icon name="lucide:x"/></button></div>{children}</div></div>}
function AsyncForm({onSubmit,children,submitLabel='Guardar',danger=false}){const [error,setError]=useState(''),[saving,setSaving]=useState(false);const go=async e=>{e.preventDefault();setSaving(true);setError('');try{await onSubmit()}catch(err){setError(err.message||String(err))}finally{setSaving(false)}};return <form className="form" onSubmit={go}>{children}{error&&<div className="error"><Icon name="lucide:triangle-alert"/>{error}</div>}<div className="modal-actions"><button className={danger?'danger-button':'primary'} disabled={saving}>{saving?'Procesando…':submitLabel}</button></div></form>}
function ConfirmModal({title,message,danger,onClose,onConfirm}){return <Modal title={title} onClose={onClose} size="sm"><AsyncForm onSubmit={onConfirm} submitLabel={danger?'Eliminar definitivamente':'Confirmar'} danger={danger}><div className="confirm-box"><span className={danger?'danger-icon':'info-icon'}><Icon name={danger?'lucide:triangle-alert':'lucide:circle-help'} size={26}/></span><p>{message}</p></div><div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div></AsyncForm></Modal>}
function ActionSheet({title,subtitle,onClose,actions}){return <Modal title={title} subtitle={subtitle} onClose={onClose} size="sm"><div className="action-sheet">{actions.map(([icon,label,fn,tone])=><button key={label} className={tone==='danger'?'danger-action':''} onClick={fn}><Icon name={icon}/><span>{label}</span><Icon name="lucide:chevron-right" size={16}/></button>)}</div></Modal>}

function WorkspaceModal({title,initial,onClose,onSave}){const [name,setName]=useState(initial?.name||'');return <Modal title={title} subtitle="Los datos y permisos permanecerán aislados por espacio." onClose={onClose}><AsyncForm onSubmit={()=>onSave({name:name.trim()})} submitLabel="Guardar workspace"><label>Nombre del workspace<input autoFocus value={name} onChange={e=>setName(e.target.value)} required placeholder="Ej. Desarrollo TROBBU"/></label><div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div></AsyncForm></Modal>}
function WorkspaceSwitcherModal({workspaces,current,canManage,onClose,onSelect,onCreate}){return <Modal title="Cambiar espacio de trabajo" subtitle="Selecciona el contexto que deseas administrar." onClose={onClose}><div className="workspace-list">{workspaces.map(w=><button key={w.id} className={w.id===current?.id?'active':''} onClick={()=>onSelect(w)}><span className="workspace-icon"><Icon name="lucide:layers-3"/></span><div><b>{w.name}</b><span>{ROLE_LABELS[w.role]||w.role}</span></div>{w.id===current?.id&&<Icon name="lucide:check"/>}</button>)}</div>{canManage&&<div className="modal-actions"><button className="primary" onClick={onCreate}><Icon name="lucide:plus"/> Crear otro workspace</button></div>}</Modal>}

function TicketModal({title,ticket,products,sprints,members,onClose,onSave}){const [f,setF]=useState({product_id:ticket?.product_id||products[0]?.id||'',sprint_id:ticket?.sprint_id||'',title:ticket?.title||'',description:ticket?.description||'',type:ticket?.type||'task',priority:ticket?.priority||'medium',status:ticket?.status||'backlog',dev_owner_id:ticket?.dev_owner_id||'',qa_owner_id:ticket?.qa_owner_id||'',story_points:ticket?.story_points??'',due_date:ticket?.due_date||''});const set=(k,v)=>setF(x=>({...x,[k]:v}));return <Modal title={title} subtitle="Define alcance, prioridad, responsables y ciclo de entrega." onClose={onClose} size="lg"><AsyncForm onSubmit={()=>onSave(f)} submitLabel={ticket?'Guardar cambios':'Crear ticket'}><div className="form-section"><h4>Información principal</h4><label>Título<input value={f.title} onChange={e=>set('title',e.target.value)} required placeholder="Describe el trabajo en una frase"/></label><label>Descripción<textarea rows="5" value={f.description} onChange={e=>set('description',e.target.value)} placeholder="Contexto, criterios de aceptación, pasos para reproducir…"/></label></div><div className="form-section"><h4>Planeación</h4><div className="form-grid"><label>Producto<select value={f.product_id} onChange={e=>set('product_id',e.target.value)} required>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Sprint<select value={f.sprint_id} onChange={e=>set('sprint_id',e.target.value)}><option value="">Sin sprint</option>{sprints.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Tipo<select value={f.type} onChange={e=>set('type',e.target.value)}>{TYPES.map(x=><option key={x} value={x}>{TYPE_LABELS[x]}</option>)}</select></label><label>Prioridad<select value={f.priority} onChange={e=>set('priority',e.target.value)}>{PRIORITIES.map(x=><option key={x} value={x}>{PRIORITY_LABELS[x]}</option>)}</select></label><label>Estado<select value={f.status} onChange={e=>set('status',e.target.value)}>{STATUS.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label><label>Story points<input type="number" min="0" step="0.5" value={f.story_points} onChange={e=>set('story_points',e.target.value)}/></label><label>Responsable Dev<select value={f.dev_owner_id} onChange={e=>set('dev_owner_id',e.target.value)}><option value="">Sin asignar</option>{members.filter(m=>['admin','pm','dev'].includes(m.role)).map(m=><option key={m.user_id} value={m.user_id}>{m.profile?.full_name||m.user_id.slice(0,8)}</option>)}</select></label><label>Responsable QA<select value={f.qa_owner_id} onChange={e=>set('qa_owner_id',e.target.value)}><option value="">Sin asignar</option>{members.filter(m=>['admin','pm','qa'].includes(m.role)).map(m=><option key={m.user_id} value={m.user_id}>{m.profile?.full_name||m.user_id.slice(0,8)}</option>)}</select></label><label>Fecha límite<input type="date" value={f.due_date} onChange={e=>set('due_date',e.target.value)}/></label></div></div><div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div></AsyncForm></Modal>}

function TicketDetailModal({ticket,products,members,session,onClose,onEdit,onRefresh,toast}){const [comments,setComments]=useState([]),[activity,setActivity]=useState([]),[body,setBody]=useState(''),[tab,setTab]=useState('comments');const load=async()=>{const [c,a]=await Promise.all([db.from('ticket_comments').select('*').eq('ticket_id',ticket.id).order('created_at'),db.from('ticket_activity').select('*').eq('ticket_id',ticket.id).order('created_at',{ascending:false})]);setComments(c.data||[]);setActivity(a.data||[])};useEffect(()=>{load()},[ticket.id]);const add=async e=>{e.preventDefault();if(!body.trim())return;const {error}=await db.from('ticket_comments').insert({ticket_id:ticket.id,author_id:session.user.id,body:body.trim()});if(error)return toast('error',error.message);setBody('');load();toast('success','Comentario agregado.')};const product=products.find(p=>p.id===ticket.product_id),dev=members.find(m=>m.user_id===ticket.dev_owner_id)?.profile?.full_name||'Sin asignar',qa=members.find(m=>m.user_id===ticket.qa_owner_id)?.profile?.full_name||'Sin asignar';return <Modal title={`${ticket.ticket_key} · ${ticket.title}`} subtitle={product?.name} onClose={onClose} size="xl"><div className="detail-grid"><div className="detail-main"><div className="detail-description"><h4>Descripción</h4><p>{ticket.description||'Sin descripción.'}</p></div><div className="detail-tabs"><button className={tab==='comments'?'active':''} onClick={()=>setTab('comments')}>Comentarios <em>{comments.length}</em></button><button className={tab==='activity'?'active':''} onClick={()=>setTab('activity')}>Actividad <em>{activity.length}</em></button></div>{tab==='comments'?<><div className="comment-list">{comments.length===0&&<p className="muted">Todavía no hay comentarios.</p>}{comments.map(c=><div className="comment" key={c.id}><span className="mini-avatar">{initials(members.find(m=>m.user_id===c.author_id)?.profile?.full_name||'U')}</span><div><div><b>{members.find(m=>m.user_id===c.author_id)?.profile?.full_name||'Usuario'}</b><small>{formatDateTime(c.created_at)}</small></div><p>{c.body}</p></div></div>)}</div><form className="comment-form" onSubmit={add}><textarea rows="3" value={body} onChange={e=>setBody(e.target.value)} placeholder="Escribe una actualización, evidencia o comentario…"></textarea><button className="primary compact"><Icon name="lucide:send"/> Comentar</button></form></>:<div className="activity-list">{activity.map(a=><div className="activity-item" key={a.id}><span className="activity-dot"></span><div><b>{a.action==='created'?'Ticket creado':'Cambio de '+a.action.replace('_',' ')}</b><p>{a.from_value&&`${a.from_value} → `}{a.to_value}</p><small>{formatDateTime(a.created_at)}</small></div></div>)}</div>}</div><aside className="detail-aside"><button className="primary full" onClick={onEdit}><Icon name="lucide:pencil"/> Editar ticket</button><DetailRow label="Estado"><StatusBadge status={ticket.status}/></DetailRow><DetailRow label="Prioridad"><span className={`priority-badge priority-${ticket.priority}`}>{PRIORITY_LABELS[ticket.priority]}</span></DetailRow><DetailRow label="Dev">{dev}</DetailRow><DetailRow label="QA">{qa}</DetailRow><DetailRow label="Story points">{ticket.story_points??'—'}</DetailRow><DetailRow label="Fecha límite">{formatDate(ticket.due_date)}</DetailRow><DetailRow label="Actualizado">{formatDateTime(ticket.updated_at)}</DetailRow></aside></div></Modal>}
function DetailRow({label,children}){return <div className="detail-row"><span>{label}</span><div>{children}</div></div>}

function TicketFilterModal({filters,members,sprints,onClose,onApply}){const [f,setF]=useState({...filters});return <Modal title="Filtros de tickets" subtitle="Combina criterios para encontrar exactamente lo que necesitas." onClose={onClose}><AsyncForm onSubmit={()=>onApply(f)} submitLabel="Aplicar filtros"><div className="form-grid"><label>Estado<select value={f.status} onChange={e=>setF({...f,status:e.target.value})}><option value="all">Todos</option>{STATUS.map(([k,l])=><option value={k} key={k}>{l}</option>)}</select></label><label>Responsable<select value={f.assignee} onChange={e=>setF({...f,assignee:e.target.value})}><option value="all">Todos</option>{members.map(m=><option value={m.user_id} key={m.user_id}>{m.profile?.full_name||'Usuario'}</option>)}</select></label><label>Sprint<select value={f.sprint} onChange={e=>setF({...f,sprint:e.target.value})}><option value="all">Todos</option>{sprints.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label><label>Prioridad<select value={f.priority} onChange={e=>setF({...f,priority:e.target.value})}><option value="all">Todas</option>{PRIORITIES.map(p=><option value={p} key={p}>{PRIORITY_LABELS[p]}</option>)}</select></label><label>Tipo<select value={f.type} onChange={e=>setF({...f,type:e.target.value})}><option value="all">Todos</option>{TYPES.map(t=><option value={t} key={t}>{TYPE_LABELS[t]}</option>)}</select></label></div><div className="modal-secondary"><button type="button" className="secondary-button" onClick={()=>setF({status:'all',assignee:'all',sprint:'all',priority:'all',type:'all'})}>Restablecer</button></div></AsyncForm></Modal>}

function HelpdeskModal({title,item,departments,members,session,onClose,onSave}){const [f,setF]=useState({department_id:item?.department_id||departments[0]?.id||'',subject:item?.subject||'',description:item?.description||'',requester_name:item?.requester_name||session.user.user_metadata?.full_name||'',requester_email:item?.requester_email||session.user.email||'',category:item?.category||'general',priority:item?.priority||'medium',status:item?.status||'new',assigned_to:item?.assigned_to||'',source:item?.source||'internal',due_at:item?.due_at?item.due_at.slice(0,16):''});return <Modal title={title} subtitle="Formulario interno de servicio para centralizar solicitudes de otras áreas." onClose={onClose} size="lg"><AsyncForm onSubmit={()=>onSave(f)} submitLabel={item?'Guardar cambios':'Crear solicitud'}><div className="form-section"><h4>Solicitud</h4><label>Asunto<input value={f.subject} onChange={e=>setF({...f,subject:e.target.value})} required placeholder="¿Qué necesita el área solicitante?"/></label><label>Descripción<textarea rows="5" value={f.description} onChange={e=>setF({...f,description:e.target.value})} placeholder="Contexto, impacto, evidencia y resultado esperado…"/></label><div className="form-grid"><label>Área solicitante<select value={f.department_id} onChange={e=>setF({...f,department_id:e.target.value})}>{departments.map(d=><option value={d.id} key={d.id}>{d.name}</option>)}</select></label><label>Categoría<select value={f.category} onChange={e=>setF({...f,category:e.target.value})}><option value="general">General</option><option value="access">Accesos</option><option value="incident">Incidente</option><option value="request">Solicitud</option><option value="data">Datos / Reporte</option><option value="configuration">Configuración</option></select></label><label>Prioridad<select value={f.priority} onChange={e=>setF({...f,priority:e.target.value})}>{PRIORITIES.map(p=><option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}</select></label><label>Origen<select value={f.source} onChange={e=>setF({...f,source:e.target.value})}><option value="internal">Interno</option><option value="portal">Portal</option><option value="email">Correo</option><option value="phone">Teléfono</option><option value="whatsapp">WhatsApp</option></select></label></div></div><div className="form-section"><h4>Solicitante y atención</h4><div className="form-grid"><label>Solicitante<input value={f.requester_name} onChange={e=>setF({...f,requester_name:e.target.value})}/></label><label>Correo<input type="email" value={f.requester_email} onChange={e=>setF({...f,requester_email:e.target.value})}/></label><label>Asignado a<select value={f.assigned_to} onChange={e=>setF({...f,assigned_to:e.target.value})}><option value="">Sin asignar</option>{members.filter(m=>['admin','pm','dev','qa'].includes(m.role)).map(m=><option value={m.user_id} key={m.user_id}>{m.profile?.full_name||'Usuario'}</option>)}</select></label><label>Estado<select value={f.status} onChange={e=>setF({...f,status:e.target.value})}>{HELP_STATUS.map(([k,l])=><option value={k} key={k}>{l}</option>)}</select></label><label>Fecha objetivo<input type="datetime-local" value={f.due_at} onChange={e=>setF({...f,due_at:e.target.value})}/></label></div></div><div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div></AsyncForm></Modal>}

function HelpdeskDetailModal({item,departments,members,session,onClose,onEdit,onRefresh,toast}){const [comments,setComments]=useState([]),[activity,setActivity]=useState([]),[body,setBody]=useState(''),[tab,setTab]=useState('comments');const load=async()=>{const [c,a]=await Promise.all([db.from('helpdesk_comments').select('*').eq('helpdesk_ticket_id',item.id).order('created_at'),db.from('helpdesk_activity').select('*').eq('helpdesk_ticket_id',item.id).order('created_at',{ascending:false})]);setComments(c.data||[]);setActivity(a.data||[])};useEffect(()=>{load()},[item.id]);const add=async e=>{e.preventDefault();if(!body.trim())return;const {error}=await db.from('helpdesk_comments').insert({helpdesk_ticket_id:item.id,author_id:session.user.id,body:body.trim()});if(error)return toast('error',error.message);setBody('');load();toast('success','Comentario agregado.')};const dep=departments.find(d=>d.id===item.department_id),owner=members.find(m=>m.user_id===item.assigned_to)?.profile?.full_name||'Sin asignar';return <Modal title={`${item.ticket_key} · ${item.subject}`} subtitle={dep?.name||'Helpdesk'} onClose={onClose} size="xl"><div className="detail-grid"><div className="detail-main"><div className="detail-description"><h4>Descripción de la solicitud</h4><p>{item.description||'Sin descripción.'}</p></div><div className="detail-tabs"><button className={tab==='comments'?'active':''} onClick={()=>setTab('comments')}>Comentarios <em>{comments.length}</em></button><button className={tab==='activity'?'active':''} onClick={()=>setTab('activity')}>Actividad <em>{activity.length}</em></button></div>{tab==='comments'?<><div className="comment-list">{comments.length===0&&<p className="muted">Todavía no hay comentarios.</p>}{comments.map(c=><div className="comment" key={c.id}><span className="mini-avatar">{initials(members.find(m=>m.user_id===c.author_id)?.profile?.full_name||'U')}</span><div><div><b>{members.find(m=>m.user_id===c.author_id)?.profile?.full_name||'Usuario'}</b><small>{formatDateTime(c.created_at)}</small></div><p>{c.body}</p></div></div>)}</div><form className="comment-form" onSubmit={add}><textarea rows="3" value={body} onChange={e=>setBody(e.target.value)} placeholder="Agrega seguimiento, diagnóstico o resolución…"></textarea><button className="primary compact"><Icon name="lucide:send"/> Comentar</button></form></>:<div className="activity-list">{activity.map(a=><div className="activity-item" key={a.id}><span className="activity-dot"></span><div><b>{a.action}</b><p>{a.from_value&&`${a.from_value} → `}{a.to_value}</p><small>{formatDateTime(a.created_at)}</small></div></div>)}</div>}</div><aside className="detail-aside"><button className="primary full" onClick={onEdit}><Icon name="lucide:pencil"/> Editar solicitud</button><DetailRow label="Estado"><HelpStatusBadge status={item.status}/></DetailRow><DetailRow label="Prioridad"><span className={`priority-badge priority-${item.priority}`}>{PRIORITY_LABELS[item.priority]}</span></DetailRow><DetailRow label="Área">{dep?.name||'—'}</DetailRow><DetailRow label="Asignado">{owner}</DetailRow><DetailRow label="Solicitante">{item.requester_name||'—'}</DetailRow><DetailRow label="Correo">{item.requester_email||'—'}</DetailRow><DetailRow label="Origen">{item.source}</DetailRow><DetailRow label="Fecha objetivo">{formatDateTime(item.due_at)}</DetailRow></aside></div></Modal>}
function HelpFilterModal({filters,departments,members,onClose,onApply}){const [f,setF]=useState({...filters});return <Modal title="Filtros de Helpdesk" onClose={onClose}><AsyncForm onSubmit={()=>onApply(f)} submitLabel="Aplicar filtros"><div className="form-grid"><label>Estado<select value={f.status} onChange={e=>setF({...f,status:e.target.value})}><option value="all">Todos</option>{HELP_STATUS.map(([k,l])=><option value={k} key={k}>{l}</option>)}</select></label><label>Área<select value={f.department} onChange={e=>setF({...f,department:e.target.value})}><option value="all">Todas</option>{departments.map(d=><option value={d.id} key={d.id}>{d.name}</option>)}</select></label><label>Asignado<select value={f.assignee} onChange={e=>setF({...f,assignee:e.target.value})}><option value="all">Todos</option>{members.map(m=><option value={m.user_id} key={m.user_id}>{m.profile?.full_name||'Usuario'}</option>)}</select></label><label>Prioridad<select value={f.priority} onChange={e=>setF({...f,priority:e.target.value})}><option value="all">Todas</option>{PRIORITIES.map(p=><option value={p} key={p}>{PRIORITY_LABELS[p]}</option>)}</select></label></div></AsyncForm></Modal>}

function InviteModal({workspace,onClose,onSaved}){const [email,setEmail]=useState(''),[role,setRole]=useState('dev');return <Modal title="Invitar colaborador" subtitle="El usuario recibirá un correo para unirse al workspace." onClose={onClose}><AsyncForm onSubmit={async()=>{const {data,error}=await db.functions.invoke('invite-member',{body:{email,role,workspace_id:workspace.id,redirect_to:getAppUrl()}});if(error||data?.error)throw new Error(error?.message||data.error);await onSaved()}} submitLabel="Enviar invitación"><label>Correo<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="colaborador@trobbu.com"/></label><label>Rol<select value={role} onChange={e=>setRole(e.target.value)}>{Object.entries(ROLE_LABELS).map(([k,l])=><option value={k} key={k}>{l}</option>)}</select></label><div className="modal-secondary"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button></div></AsyncForm></Modal>}
function MemberModal({member,session,onClose,onSave}){const [role,setRole]=useState(member.role),[active,setActive]=useState(member.active);const self=member.user_id===session.user.id;return <Modal title="Editar colaborador" subtitle={member.profile?.full_name||'Usuario'} onClose={onClose}><AsyncForm onSubmit={()=>onSave({role,active})} submitLabel="Guardar cambios"><label>Rol<select value={role} onChange={e=>setRole(e.target.value)} disabled={self}>{Object.entries(ROLE_LABELS).map(([k,l])=><option value={k} key={k}>{l}</option>)}</select></label><Toggle label="Acceso activo" checked={active} onChange={setActive} disabled={self}/>{self&&<div className="notice">No puedes desactivar ni degradar tu propia cuenta desde esta pantalla.</div>}</AsyncForm></Modal>}
function ProductModal({title,initial,onClose,onSave}){const [f,setF]=useState({name:initial?.name||'',key:initial?.key||'',description:initial?.description||''});return <Modal title={title} onClose={onClose}><AsyncForm onSubmit={()=>onSave({...f,key:f.key.trim().toUpperCase()})} submitLabel="Guardar producto"><label>Nombre<input value={f.name} onChange={e=>setF({...f,name:e.target.value})} required/></label><label>Clave<input value={f.key} onChange={e=>setF({...f,key:e.target.value.replace(/[^A-Za-z0-9]/g,'').slice(0,6)})} required placeholder="WEB"/></label><label>Descripción<textarea rows="3" value={f.description} onChange={e=>setF({...f,description:e.target.value})}/></label></AsyncForm></Modal>}
function SprintModal({title,initial,onClose,onSave}){const [f,setF]=useState({name:initial?.name||'',goal:initial?.goal||'',start_date:initial?.start_date||'',end_date:initial?.end_date||'',status:initial?.status||'planned'});return <Modal title={title} onClose={onClose}><AsyncForm onSubmit={()=>onSave(f)} submitLabel="Guardar sprint"><label>Nombre<input value={f.name} onChange={e=>setF({...f,name:e.target.value})} required/></label><label>Objetivo<textarea rows="3" value={f.goal} onChange={e=>setF({...f,goal:e.target.value})}/></label><div className="form-grid"><label>Inicio<input type="date" value={f.start_date} onChange={e=>setF({...f,start_date:e.target.value})}/></label><label>Fin<input type="date" value={f.end_date} onChange={e=>setF({...f,end_date:e.target.value})}/></label><label>Estado<select value={f.status} onChange={e=>setF({...f,status:e.target.value})}><option value="planned">Planeado</option><option value="active">Activo</option><option value="completed">Completado</option></select></label></div></AsyncForm></Modal>}

ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>)
