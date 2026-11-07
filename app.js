const { useEffect, useMemo, useState } = React

const cfg = window.JIRA_CONFIG || {}
if (!cfg.supabaseUrl || !cfg.supabasePublishableKey) {
  throw new Error('Falta la configuración pública de Supabase en config.js')
}
const db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey)
const getAppUrl = () => `${window.location.origin}${window.location.pathname}`


const STATUS = [
  ['backlog','Backlog'],['todo','Por hacer'],['in_progress','En curso'],['dev_done','Dev terminado'],
  ['qa_review','Revisión QA'],['qa_rejected','QA rechazado'],['qa_passed','QA aprobado'],['closed','Cerrado']
]
const PRIORITIES = ['lowest','low','medium','high','highest','blocker']
const TYPES = ['task','bug','story','improvement']

function useSession() {
  const [session,setSession] = useState(null)
  const [loading,setLoading] = useState(true)
  useEffect(() => {
    db.auth.getSession().then(({data}) => { setSession(data.session); setLoading(false) })
    const {data:{subscription}} = db.auth.onAuthStateChange((_e,s) => setSession(s))
    return () => subscription.unsubscribe()
  },[])
  return {session,loading}
}

function Auth() {
  const [mode,setMode] = useState('login')
  const [email,setEmail] = useState('')
  const [password,setPassword] = useState('')
  const [name,setName] = useState('')
  const [msg,setMsg] = useState('')
  const submit = async (e) => {
    e.preventDefault(); setMsg('Procesando...')
    const result = mode === 'login'
      ? await db.auth.signInWithPassword({email,password})
      : await db.auth.signUp({email,password,options:{data:{full_name:name},emailRedirectTo:getAppUrl()}})
    setMsg(result.error ? result.error.message : mode === 'login' ? 'Acceso correcto.' : 'Cuenta creada. Revisa tu correo si se requiere confirmación.')
  }
  return <div className="auth-shell">
    <div className="auth-card">
      <div className="brand-mark">T</div>
      <h1>Jira Interno Trobbu</h1>
      <p>Gestión de tickets, sprints, Desarrollo y QA.</p>
      <form onSubmit={submit}>
        {mode === 'signup' && <label>Nombre<input value={name} onChange={e=>setName(e.target.value)} required /></label>}
        <label>Correo<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></label>
        <label>Contraseña<input type="password" minLength="6" value={password} onChange={e=>setPassword(e.target.value)} required /></label>
        <button className="primary" type="submit">{mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</button>
      </form>
      <button className="link" onClick={()=>{setMode(mode==='login'?'signup':'login');setMsg('')}}>
        {mode === 'login' ? 'Crear cuenta' : 'Ya tengo cuenta'}
      </button>
      {msg && <div className="notice">{msg}</div>}
    </div>
  </div>
}

function App(){
  const {session,loading} = useSession()
  if (loading) return <div className="center">Cargando…</div>
  if (!session) return <Auth />
  return <WorkspaceApp session={session} />
}

function WorkspaceApp({session}){
  const [memberships,setMemberships] = useState([])
  const [workspace,setWorkspace] = useState(null)
  const [products,setProducts] = useState([])
  const [productId,setProductId] = useState('all')
  const [sprints,setSprints] = useState([])
  const [sprintId,setSprintId] = useState('all')
  const [tickets,setTickets] = useState([])
  const [members,setMembers] = useState([])
  const [view,setView] = useState('dashboard')
  const [busy,setBusy] = useState(true)
  const [error,setError] = useState('')
  const [ticketModal,setTicketModal] = useState(false)
  const [sprintModal,setSprintModal] = useState(false)
  const [inviteModal,setInviteModal] = useState(false)

  const loadMemberships = async () => {
    const {data,error} = await db.from('workspace_members').select('workspace_id,role,workspaces(id,name,slug)').eq('active',true)
    if (error) { setError(error.message); setBusy(false); return }
    setMemberships(data||[])
    if (!workspace && data?.length) setWorkspace(data[0].workspaces)
    setBusy(false)
  }
  useEffect(()=>{ loadMemberships() },[])

  const loadAll = async () => {
    if (!workspace) return
    setBusy(true); setError('')
    const [p,s,t,m] = await Promise.all([
      db.from('products').select('*').eq('workspace_id',workspace.id).order('board_order'),
      db.from('sprints').select('*').eq('workspace_id',workspace.id).order('created_at',{ascending:false}),
      db.from('tickets').select('*').eq('workspace_id',workspace.id).order('updated_at',{ascending:false}),
      db.from('workspace_members').select('user_id,role,active').eq('workspace_id',workspace.id).eq('active',true)
    ])
    const firstErr = [p,s,t,m].find(x=>x.error)?.error
    if(firstErr){ setError(firstErr.message); setBusy(false); return }
    setProducts(p.data||[]); setSprints(s.data||[]); setTickets(t.data||[])
    const ids=(m.data||[]).map(x=>x.user_id)
    let profileMap={}
    if(ids.length){ const pr=await db.from('profiles').select('*').in('id',ids); (pr.data||[]).forEach(x=>profileMap[x.id]=x) }
    setMembers((m.data||[]).map(x=>({...x,profile:profileMap[x.user_id]})))
    setBusy(false)
  }
  useEffect(()=>{ loadAll() },[workspace?.id])

  const filtered = useMemo(()=>tickets.filter(t =>
    (productId==='all'||t.product_id===productId) && (sprintId==='all'||t.sprint_id===sprintId)
  ),[tickets,productId,sprintId])
  const stats = useMemo(()=>({
    created: filtered.length,
    inProgress: filtered.filter(t=>t.status==='in_progress').length,
    devDone: filtered.filter(t=>t.dev_completed_at).length,
    qaDone: filtered.filter(t=>t.qa_completed_at).length,
    rejected: filtered.filter(t=>t.status==='qa_rejected').length,
    closed: filtered.filter(t=>t.status==='closed').length,
  }),[filtered])

  const createWorkspace = async () => {
    const name = prompt('Nombre del workspace','Trobbu Tecnología')
    if(!name) return
    const slug = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')+'-'+Math.random().toString(36).slice(2,6)
    const {data,error}=await db.from('workspaces').insert({name,slug,created_by:session.user.id}).select().single()
    if(error) return setError(error.message)
    setWorkspace(data); await loadMemberships()
  }

  if(!workspace && !busy) return <div className="empty-state"><h2>Configura tu espacio de trabajo</h2><p>Se crearán automáticamente Web Administrativa, Web Socios y App Socios.</p><button className="primary" onClick={createWorkspace}>Crear workspace</button></div>

  const myRole = memberships.find(m=>m.workspace_id===workspace?.id)?.role || 'viewer'
  const canManage = ['admin','pm'].includes(myRole)
  const runNotifications = async () => { try { await db.functions.invoke('process-notifications',{body:{workspace_id:workspace.id}}) } catch {} }
  const moveTicket = async (ticket,status) => {
    const {error}=await db.from('tickets').update({status}).eq('id',ticket.id)
    if(error) setError(error.message); else { await loadAll(); runNotifications() }
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="logo-row"><div className="brand-mark small">T</div><div><strong>TROBBU</strong><span>Jira Interno</span></div></div>
      <nav>
        <button className={view==='dashboard'?'active':''} onClick={()=>setView('dashboard')}>◫ Dashboard</button>
        <button className={view==='board'?'active':''} onClick={()=>setView('board')}>▦ Tablero</button>
        <button className={view==='team'?'active':''} onClick={()=>setView('team')}>◎ Equipo</button>
      </nav>
      <div className="sidebar-title">PRODUCTOS</div>
      <button className={productId==='all'?'active product':''} onClick={()=>setProductId('all')}>Todos los productos</button>
      {products.map(p=><button key={p.id} className={productId===p.id?'active product':'product'} onClick={()=>{setProductId(p.id);setView('board')}}><span className="dot"/> {p.name}</button>)}
      <div className="sidebar-footer"><span>{session.user.email}</span><button onClick={()=>db.auth.signOut()}>Salir</button></div>
    </aside>
    <main>
      <header className="topbar">
        <div><h1>{view==='dashboard'?'Dashboard de Sprint':view==='board'?'Tablero de tickets':'Colaboradores'}</h1><p>{workspace?.name} · Rol: {myRole.toUpperCase()}</p></div>
        <div className="top-actions">
          <select value={sprintId} onChange={e=>setSprintId(e.target.value)}><option value="all">Todos los sprints</option>{sprints.map(s=><option key={s.id} value={s.id}>{s.name} · {s.status}</option>)}</select>
          {canManage && <button onClick={()=>setSprintModal(true)}>+ Sprint</button>}
          <button className="primary" onClick={()=>setTicketModal(true)}>+ Ticket</button>
        </div>
      </header>
      {error && <div className="error">{error}</div>}
      {busy ? <div className="center">Actualizando información…</div> : <>
        {view==='dashboard' && <Dashboard stats={stats} tickets={filtered} products={products} members={members} />}
        {view==='board' && <Board tickets={filtered} products={products} members={members} moveTicket={moveTicket} />}
        {view==='team' && <Team members={members} canManage={canManage} openInvite={()=>setInviteModal(true)} />}
      </>}
    </main>
    {ticketModal && <TicketModal workspace={workspace} products={products} sprints={sprints} members={members} user={session.user} onClose={()=>setTicketModal(false)} onSaved={async()=>{setTicketModal(false);await loadAll();runNotifications()}} />}
    {sprintModal && <SprintModal workspace={workspace} user={session.user} onClose={()=>setSprintModal(false)} onSaved={async()=>{setSprintModal(false);await loadAll()}} />}
    {inviteModal && <InviteModal workspace={workspace} onClose={()=>setInviteModal(false)} onSaved={async()=>{setInviteModal(false);await loadAll()}} />}
  </div>
}

function Dashboard({stats,tickets,products,members}){
  const cards=[['Tickets creados',stats.created],['En curso',stats.inProgress],['Finalizados Dev',stats.devDone],['Finalizados QA',stats.qaDone],['Regresados QA',stats.rejected],['Cerrados',stats.closed]]
  const byProduct = products.map(p=>({name:p.name,total:tickets.filter(t=>t.product_id===p.id).length,closed:tickets.filter(t=>t.product_id===p.id&&t.status==='closed').length}))
  const max=Math.max(1,...byProduct.map(x=>x.total))
  return <div className="content">
    <div className="kpi-grid">{cards.map(([label,value])=><div className="kpi" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    <div className="grid-2">
      <section className="panel"><h3>Avance por producto</h3>{byProduct.map(x=><div className="bar-row" key={x.name}><div><span>{x.name}</span><b>{x.closed}/{x.total}</b></div><div className="bar"><i style={{width:`${(x.closed/max)*100}%`}}/></div></div>)}</section>
      <section className="panel"><h3>Distribución del sprint</h3><div className="status-list">{STATUS.map(([key,label])=>{const n=tickets.filter(t=>t.status===key).length;return <div key={key}><span>{label}</span><b>{n}</b></div>})}</div></section>
    </div>
    <section className="panel"><h3>Últimos tickets</h3><TicketTable tickets={tickets.slice(0,10)} products={products} members={members}/></section>
  </div>
}

function Board({tickets,products,members,moveTicket}){
  return <div className="board-wrap">{STATUS.map(([key,label])=><div className="column" key={key} onDragOver={e=>e.preventDefault()} onDrop={e=>{const id=e.dataTransfer.getData('text/plain');const t=tickets.find(x=>x.id===id);if(t) moveTicket(t,key)}}><div className="column-head"><span>{label}</span><b>{tickets.filter(t=>t.status===key).length}</b></div>{tickets.filter(t=>t.status===key).map(t=><TicketCard key={t.id} ticket={t} product={products.find(p=>p.id===t.product_id)} members={members}/>)}</div>)}</div>
}
function TicketCard({ticket,product,members}){
  const dev=members.find(m=>m.user_id===ticket.dev_owner_id)?.profile?.full_name
  const qa=members.find(m=>m.user_id===ticket.qa_owner_id)?.profile?.full_name
  return <article className="ticket-card" draggable onDragStart={e=>e.dataTransfer.setData('text/plain',ticket.id)}><div className="ticket-key">{ticket.ticket_key} · {product?.name}</div><h4>{ticket.title}</h4><div className="chips"><span>{ticket.type}</span><span>{ticket.priority}</span>{ticket.story_points!=null&&<span>{ticket.story_points} pts</span>}</div><div className="owners"><small>DEV {dev||'—'}</small><small>QA {qa||'—'}</small></div></article>
}
function TicketTable({tickets,products,members}){return <div className="table"><div className="tr th"><span>Ticket</span><span>Producto</span><span>Estado</span><span>Dev</span><span>QA</span></div>{tickets.map(t=><div className="tr" key={t.id}><span><b>{t.ticket_key}</b><small>{t.title}</small></span><span>{products.find(p=>p.id===t.product_id)?.name}</span><span>{STATUS.find(x=>x[0]===t.status)?.[1]}</span><span>{members.find(m=>m.user_id===t.dev_owner_id)?.profile?.full_name||'—'}</span><span>{members.find(m=>m.user_id===t.qa_owner_id)?.profile?.full_name||'—'}</span></div>)}</div>}
function Team({members,canManage,openInvite}){return <div className="content"><section className="panel"><div className="section-title"><div><h3>Equipo</h3><p>Roles y colaboradores con acceso al workspace.</p></div>{canManage&&<button className="primary" onClick={openInvite}>+ Invitar colaborador</button>}</div><div className="member-grid">{members.map(m=><div className="member-card" key={m.user_id}><div className="avatar">{(m.profile?.full_name||'?').slice(0,1).toUpperCase()}</div><div><b>{m.profile?.full_name||'Usuario'}</b><span>{m.profile?.job_title||'Colaborador'}</span></div><em>{m.role.toUpperCase()}</em></div>)}</div></section></div>}

function Modal({title,onClose,children}){return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><h3>{title}</h3><button onClick={onClose}>×</button></div>{children}</div></div>}
function TicketModal({workspace,products,sprints,members,user,onClose,onSaved}){
  const [form,setForm]=useState({product_id:products[0]?.id||'',sprint_id:'',title:'',description:'',type:'task',priority:'medium',dev_owner_id:'',qa_owner_id:'',story_points:''})
  const [err,setErr]=useState('')
  const save=async e=>{e.preventDefault();const payload={...form,workspace_id:workspace.id,reporter_id:user.id,sprint_id:form.sprint_id||null,dev_owner_id:form.dev_owner_id||null,qa_owner_id:form.qa_owner_id||null,story_points:form.story_points===''?null:Number(form.story_points)};const {error}=await db.from('tickets').insert(payload);if(error)setErr(error.message);else onSaved()}
  const set=(k,v)=>setForm(f=>({...f,[k]:v}))
  return <Modal title="Crear ticket" onClose={onClose}><form className="form" onSubmit={save}><label>Título<input value={form.title} onChange={e=>set('title',e.target.value)} required/></label><label>Descripción<textarea rows="4" value={form.description} onChange={e=>set('description',e.target.value)}/></label><div className="form-grid"><label>Producto<select value={form.product_id} onChange={e=>set('product_id',e.target.value)} required>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Sprint<select value={form.sprint_id} onChange={e=>set('sprint_id',e.target.value)}><option value="">Backlog / sin sprint</option>{sprints.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Tipo<select value={form.type} onChange={e=>set('type',e.target.value)}>{TYPES.map(x=><option key={x}>{x}</option>)}</select></label><label>Prioridad<select value={form.priority} onChange={e=>set('priority',e.target.value)}>{PRIORITIES.map(x=><option key={x}>{x}</option>)}</select></label><label>Responsable Dev<select value={form.dev_owner_id} onChange={e=>set('dev_owner_id',e.target.value)}><option value="">Sin asignar</option>{members.filter(m=>['dev','admin','pm'].includes(m.role)).map(m=><option key={m.user_id} value={m.user_id}>{m.profile?.full_name||m.user_id.slice(0,8)}</option>)}</select></label><label>Responsable QA<select value={form.qa_owner_id} onChange={e=>set('qa_owner_id',e.target.value)}><option value="">Sin asignar</option>{members.filter(m=>['qa','admin','pm'].includes(m.role)).map(m=><option key={m.user_id} value={m.user_id}>{m.profile?.full_name||m.user_id.slice(0,8)}</option>)}</select></label><label>Story points<input type="number" min="0" step="0.5" value={form.story_points} onChange={e=>set('story_points',e.target.value)}/></label></div>{err&&<div className="error">{err}</div>}<div className="modal-actions"><button type="button" onClick={onClose}>Cancelar</button><button className="primary">Crear ticket</button></div></form></Modal>
}
function SprintModal({workspace,user,onClose,onSaved}){const [f,setF]=useState({name:'',goal:'',start_date:'',end_date:'',status:'planned'});const save=async e=>{e.preventDefault();const {error}=await db.from('sprints').insert({...f,workspace_id:workspace.id,created_by:user.id,start_date:f.start_date||null,end_date:f.end_date||null});if(error)alert(error.message);else onSaved()};return <Modal title="Nuevo sprint" onClose={onClose}><form className="form" onSubmit={save}><label>Nombre<input required value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></label><label>Objetivo<textarea value={f.goal} onChange={e=>setF({...f,goal:e.target.value})}/></label><div className="form-grid"><label>Inicio<input type="date" value={f.start_date} onChange={e=>setF({...f,start_date:e.target.value})}/></label><label>Fin<input type="date" value={f.end_date} onChange={e=>setF({...f,end_date:e.target.value})}/></label><label>Estado<select value={f.status} onChange={e=>setF({...f,status:e.target.value})}><option value="planned">Planeado</option><option value="active">Activo</option><option value="completed">Completado</option></select></label></div><div className="modal-actions"><button type="button" onClick={onClose}>Cancelar</button><button className="primary">Guardar sprint</button></div></form></Modal>}
function InviteModal({workspace,onClose,onSaved}){const [email,setEmail]=useState('');const [role,setRole]=useState('dev');const [msg,setMsg]=useState('');const send=async e=>{e.preventDefault();setMsg('Enviando invitación…');const {data,error}=await db.functions.invoke('invite-member',{body:{email,role,workspace_id:workspace.id,redirect_to:getAppUrl()}});if(error||data?.error)setMsg(error?.message||data.error);else{setMsg('Invitación enviada correctamente.');setTimeout(onSaved,500)}};return <Modal title="Invitar colaborador" onClose={onClose}><form className="form" onSubmit={send}><label>Correo<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Rol<select value={role} onChange={e=>setRole(e.target.value)}><option value="dev">Desarrollo</option><option value="qa">QA</option><option value="pm">PM</option><option value="viewer">Solo lectura</option><option value="admin">Administrador</option></select></label>{msg&&<div className="notice">{msg}</div>}<div className="modal-actions"><button type="button" onClick={onClose}>Cancelar</button><button className="primary">Enviar invitación</button></div></form></Modal>}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>
)
